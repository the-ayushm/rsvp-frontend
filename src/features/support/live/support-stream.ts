import { createSseParser } from "./sse-parser";
import { maxCursor, stringifyBigNumbers } from "./state";
import type { StreamEvent, StreamStatus } from "./types";

export interface ParsedStreamEvent {
  event: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  id: string | null;
}

export interface ReadyInfo {
  cursor: string | null;
  heartbeatMs: number | null;
  /** true when this is a reconnect rather than the first connection */
  resumed: boolean;
}

export interface SupportStreamOptions {
  /** Full URL of the events endpoint, including any filter query. */
  url: string;
  getToken: () => string | null;
  headers?: Record<string, string>;
  /** Applies a data event. Throwing means "not applied": the cursor is not advanced. */
  onEvent: (event: ParsedStreamEvent) => void | Promise<void>;
  onReady?: (info: ReadyInfo) => void | Promise<void>;
  onStatus?: (status: StreamStatus, detail?: string) => void;
  /** Called on stream.reconnect(REFRESH_AUTHENTICATION) or a 401, before reconnecting. */
  refreshAuth?: () => Promise<void>;
  fetchImpl?: typeof fetch;
  backoff?: { baseMs: number; maxMs: number };
  random?: () => number;
}

type AttemptResult = "stop" | "immediate" | "backoff";

function withQuery(url: string, key: string, value: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

const CONTROL_EVENTS = new Set(["ready", "stream.reconnect", "stream.error"]);

/**
 * One authenticated Server-Sent Events subscription. Native EventSource can't
 * send an Authorization header, so this reads the stream through fetch, and
 * keeps the JWT out of the URL.
 *
 * The replay cursor is advanced only after onEvent resolves, and is sent as
 * ?after=<cursor> on every reconnect so missed events are replayed.
 */
export class SupportStream {
  private readonly opts: SupportStreamOptions;
  private controller: AbortController | null = null;
  private closed = false;
  private cursor: string | null = null;
  private attempts = 0;
  private everReady = false;
  private authRetried = false;
  private wakeSleep: (() => void) | null = null;
  private status: StreamStatus = "idle";

  constructor(opts: SupportStreamOptions) {
    this.opts = opts;
  }

  getCursor() {
    return this.cursor;
  }

  getStatus() {
    return this.status;
  }

  start() {
    void this.run();
    return this;
  }

  close() {
    this.closed = true;
    this.controller?.abort();
    this.wakeSleep?.();
    this.setStatus("idle");
  }

  private setStatus(status: StreamStatus, detail?: string) {
    if (this.status === status && !detail) return;
    this.status = status;
    this.opts.onStatus?.(status, detail);
  }

  private async run() {
    while (!this.closed) {
      this.setStatus(this.everReady ? "reconnecting" : "connecting");
      const result = await this.connectOnce();
      if (this.closed || result === "stop") return;
      if (result === "backoff") await this.sleep(this.nextDelay());
    }
  }

  private nextDelay() {
    const { baseMs, maxMs } = this.opts.backoff ?? { baseMs: 1000, maxMs: 30_000 };
    const exp = Math.min(maxMs, baseMs * 2 ** Math.min(this.attempts, 10));
    this.attempts++;
    const random = this.opts.random ?? Math.random;
    return Math.round(exp * (0.5 + random() * 0.5));
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.wakeSleep = done;
    }).finally(() => {
      this.wakeSleep = null;
    });
  }

  private async connectOnce(): Promise<AttemptResult> {
    const token = this.opts.getToken();
    if (!token) {
      this.setStatus("expired", "Your session has ended. Please sign in again.");
      return "stop";
    }

    const controller = new AbortController();
    this.controller = controller;
    const headers: Record<string, string> = {
      ...(this.opts.headers ?? {}),
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    };
    // Replay via ?after= rather than a Last-Event-ID header: a custom header
    // would need its own CORS allowance on the API for cross-origin dashboards.
    const url = this.cursor ? withQuery(this.opts.url, "after", this.cursor) : this.opts.url;

    let res: Response;
    try {
      const fetchImpl = this.opts.fetchImpl ?? fetch;
      res = await fetchImpl(url, { headers, signal: controller.signal, cache: "no-store" });
    } catch {
      return this.closed ? "stop" : "backoff";
    }

    if (res.status === 401) {
      if (!this.authRetried && this.opts.refreshAuth) {
        this.authRetried = true;
        await this.opts.refreshAuth().catch(() => undefined);
        return "immediate";
      }
      this.setStatus("expired", "Your session has ended. Please sign in again.");
      return "stop";
    }
    if (res.status === 403) {
      this.setStatus("denied", "You don't have access to live support.");
      return "stop";
    }
    if (res.status === 429) {
      // Too many streams: back off harder.
      this.attempts += 2;
      return "backoff";
    }
    if (!res.ok || !res.body) return "backoff";

    return this.readBody(res.body, controller);
  }

  private async readBody(body: ReadableStream<Uint8Array>, controller: AbortController): Promise<AttemptResult> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const queue: StreamEvent[] = [];
    const parser = createSseParser((e) => queue.push(e));
    let result: AttemptResult | null = null;

    try {
      while (result === null) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));

        while (queue.length > 0 && result === null) {
          result = await this.handle(queue.shift()!);
        }
      }
    } catch {
      if (this.closed) return "stop";
      result = result ?? "backoff";
    } finally {
      controller.abort();
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }

    if (this.closed) return "stop";
    // Server ends streams at JWT expiry / after 15 minutes: reconnect straight away.
    return result ?? (this.everReady ? "immediate" : "backoff");
  }

  /** Returns a result to end this connection, or null to keep reading. */
  private async handle(raw: StreamEvent): Promise<AttemptResult | null> {
    let data: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      data = raw.data ? JSON.parse(stringifyBigNumbers(raw.data)) : null;
    } catch {
      // Unparseable data can never be applied; skip past it.
      if (raw.id) this.cursor = maxCursor(this.cursor, raw.id);
      return null;
    }

    if (raw.event === "ready") {
      const resumed = this.everReady;
      this.everReady = true;
      this.attempts = 0;
      this.authRetried = false;
      if (!this.cursor && data?.cursor != null) this.cursor = String(data.cursor);
      this.setStatus("live");
      await this.opts.onReady?.({
        cursor: data?.cursor != null ? String(data.cursor) : null,
        heartbeatMs: typeof data?.heartbeat_ms === "number" ? data.heartbeat_ms : null,
        resumed,
      });
      return null;
    }

    if (raw.event === "stream.reconnect") {
      if (data?.reason === "REFRESH_AUTHENTICATION") {
        await this.opts.refreshAuth?.().catch(() => undefined);
      }
      return "immediate";
    }

    if (raw.event === "stream.error") {
      if (data?.reconnect === false) {
        this.setStatus(
          "denied",
          data?.code === "ACCESS_REVOKED" ? "Your access to live support was revoked." : "Live support is unavailable.",
        );
        return "stop";
      }
      return "backoff";
    }

    if (CONTROL_EVENTS.has(raw.event)) return null;

    try {
      await this.opts.onEvent({ event: raw.event, data, id: raw.id });
    } catch (err) {
      // Not applied: reconnect from the last applied cursor so it is replayed.
      console.error("[support-stream] failed to apply event", raw.event, err);
      return "backoff";
    }
    const eventId = raw.id ?? (data?.event_id != null ? String(data.event_id) : null);
    if (eventId) this.cursor = maxCursor(this.cursor, eventId);
    return null;
  }
}
