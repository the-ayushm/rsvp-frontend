import assert from "node:assert/strict";
import { test } from "node:test";
import { createSseParser } from "./sse-parser";
import {
  addOptimisticMessage,
  compareSequence,
  generateUUID,
  markOptimisticFailed,
  mergeMessages,
  mergeTicket,
  stringifyBigNumbers,
  upsertTicket,
  validateMessage,
  validateSubject,
} from "./state";
import { SupportStream, type ParsedStreamEvent } from "./support-stream";
import type { StreamEvent, StreamStatus, SupportMessage, SupportTicket } from "./types";

// ── SSE parser ──────────────────────────────────────────────────────────────

const collect = (chunks: string[]) => {
  const events: StreamEvent[] = [];
  const parser = createSseParser((e) => events.push(e));
  chunks.forEach((c) => parser.push(c));
  return events;
};

test("parser handles frames split across network chunks at any point", () => {
  const frame = 'id: 43\nevent: message.created\ndata: {"a":1}\n\n';
  const whole = collect([frame]);
  for (let i = 1; i < frame.length; i++) {
    assert.deepEqual(collect([frame.slice(0, i), frame.slice(i)]), whole, `split at ${i}`);
  }
  assert.deepEqual(whole, [{ event: "message.created", data: '{"a":1}', id: "43" }]);
});

test("parser handles CRLF split between chunks, comments, and multi-line data", () => {
  const events = collect([": heartbeat\r", "\n\r\nevent: ready\r\ndata: line1\r\ndata: line2\r", "\n\r\n"]);
  assert.deepEqual(events, [{ event: "ready", data: "line1\nline2", id: null }]);
});

test("parser ignores heartbeat-only frames and does not leak fields between frames", () => {
  const events = collect([":ping\n\n", "id: 7\nevent: a\ndata: x\n\n", "data: y\n\n"]);
  assert.deepEqual(events, [
    { event: "a", data: "x", id: "7" },
    { event: "message", data: "y", id: null },
  ]);
});

// ── Message merging ─────────────────────────────────────────────────────────

const msg = (id: string, sequence: string, extra: Partial<SupportMessage> = {}): SupportMessage => ({
  id,
  ticket_id: "t1",
  sequence,
  message: `m${id}`,
  user_id: "u1",
  created_at: "2026-10-22T10:00:00.000Z",
  ...extra,
});

test("messages are deduplicated by saved id regardless of arrival order", () => {
  let list = mergeMessages([], [msg("b", "2"), msg("a", "1")]);
  list = mergeMessages(list, [msg("b", "2")]); // live event replayed after reconnect
  list = mergeMessages(list, [msg("c", "3"), msg("a", "1")]);
  assert.deepEqual(list.map((m) => m.id), ["a", "b", "c"]);
});

test("sequences beyond Number precision stay ordered and stringly typed", () => {
  const list = mergeMessages([], [msg("y", "9007199254740993"), msg("x", "9007199254740992")]);
  assert.deepEqual(list.map((m) => m.sequence), ["9007199254740992", "9007199254740993"]);
  assert.equal(compareSequence("10", "9"), 1);
  const parsed = JSON.parse(stringifyBigNumbers('{"sequence":9007199254740993,"next_cursor":12,"message":"\\"sequence\\": 5"}'));
  assert.equal(parsed.sequence, "9007199254740993");
  assert.equal(parsed.next_cursor, "12");
  assert.equal(parsed.message, '"sequence": 5');
});

test("optimistic message is replaced by the saved message with the same client_message_id", () => {
  let list = mergeMessages([], [msg("a", "1")]);
  list = addOptimisticMessage(list, { clientMessageId: "cid-1", ticketId: "t1", text: "hello", userId: "u1" });
  assert.equal(list.length, 2);
  assert.equal(list[1].localStatus, "sending");

  // The live event may arrive before the POST response…
  list = mergeMessages(list, [msg("s1", "2", { client_message_id: "cid-1", message: "hello" })]);
  // …and then the POST response arrives too.
  list = mergeMessages(list, [msg("s1", "2", { client_message_id: "cid-1", message: "hello" })]);
  assert.deepEqual(list.map((m) => m.id), ["a", "s1"]);
  assert.equal(list[1].localStatus, undefined);
});

test("failed optimistic messages keep their client id for a retry", () => {
  let list = addOptimisticMessage([], { clientMessageId: "cid-2", ticketId: "t1", text: "x", userId: "u1" });
  list = markOptimisticFailed(list, "cid-2", "offline");
  assert.equal(list[0].localStatus, "failed");
  assert.equal(list[0].client_message_id, "cid-2");
  // Retrying re-adds with the same key without duplicating the bubble.
  list = addOptimisticMessage(list, { clientMessageId: "cid-2", ticketId: "t1", text: "x", userId: "u1" });
  assert.equal(list.length, 1);
  assert.equal(list[0].localStatus, "sending");
});

// ── Tickets ─────────────────────────────────────────────────────────────────

test("partial ticket events never wipe contact fields", () => {
  const full: SupportTicket = {
    id: "t1",
    status: "open",
    subject: "Import",
    name: "Asha",
    email: "a@x.com",
    phone: "+91 99999",
    assigned_admin_id: null,
    updated_at: "2026-10-22T10:00:00Z",
  };
  const merged = mergeTicket(full, { id: "t1", status: "resolved", updated_at: "2026-10-22T11:00:00Z" });
  assert.equal(merged.status, "resolved");
  assert.equal(merged.email, "a@x.com");
  assert.equal(merged.phone, "+91 99999");
  // An explicit null (unassigned) is still applied.
  assert.equal(mergeTicket({ ...full, assigned_admin_id: "adm" }, { id: "t1", assigned_admin_id: null }).assigned_admin_id, null);
});

test("ticket list stays ordered by latest update", () => {
  let list: SupportTicket[] = [
    { id: "a", status: "open", updated_at: "2026-10-22T10:00:00Z" },
    { id: "b", status: "open", updated_at: "2026-10-22T09:00:00Z" },
  ];
  list = upsertTicket(list, { id: "b", updated_at: "2026-10-22T11:00:00Z" });
  list = upsertTicket(list, { id: "c", status: "open", updated_at: "2026-10-22T08:00:00Z" });
  assert.deepEqual(list.map((t) => t.id), ["b", "a", "c"]);
});

test("message and subject validation follow the API limits", () => {
  assert.ok(validateMessage("   "));
  assert.equal(validateMessage(" hi "), null);
  assert.equal(validateMessage("x".repeat(10_000)), null);
  assert.ok(validateMessage("x".repeat(10_001)));
  assert.equal(validateSubject(""), null);
  assert.ok(validateSubject("   "));
  assert.ok(validateSubject("x".repeat(256)));
});

test("generateUUID returns unique v4 UUIDs", () => {
  const a = generateUUID();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, generateUUID());
});

// ── Stream client ───────────────────────────────────────────────────────────

interface ScriptedResponse {
  status?: number;
  chunks?: string[];
  /** keep the stream open after the chunks until aborted */
  hang?: boolean;
}

function fakeFetch(script: ScriptedResponse[]) {
  const calls: { url: string; headers: Record<string, string>; after: string | null }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: { ...(init.headers as Record<string, string>) }, after: new URL(url).searchParams.get("after") });
    const step = script.shift() ?? { hang: true };
    const signal = init.signal as AbortSignal;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of step.chunks ?? []) controller.enqueue(encoder.encode(c));
        if (!step.hang) controller.close();
        signal.addEventListener("abort", () => {
          try {
            controller.error(new DOMException("aborted", "AbortError"));
          } catch {
            /* closed */
          }
        });
      },
    });
    return new Response(step.status && step.status !== 200 ? null : body, {
      status: step.status ?? 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const frame = (event: string, data: unknown, id?: string) => `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function waitFor(pred: () => boolean, ms = 2000) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 5));
  }
}

function makeStream(script: ScriptedResponse[], opts: Partial<ConstructorParameters<typeof SupportStream>[0]> = {}) {
  const { impl, calls } = fakeFetch(script);
  const applied: ParsedStreamEvent[] = [];
  const statuses: StreamStatus[] = [];
  const stream = new SupportStream({
    url: "https://api.test/v1/admin/support/live/events",
    getToken: () => "jwt-1",
    onEvent: (e) => {
      applied.push(e);
    },
    onStatus: (s) => statuses.push(s),
    fetchImpl: impl,
    backoff: { baseMs: 1, maxMs: 5 },
    ...opts,
  });
  return { stream, calls, applied, statuses };
}

test("stream authenticates with a header, applies events in order, and keeps the JWT out of the URL", async () => {
  const created = frame("message.created", { message: { id: "m1", ticket_id: "t1", sequence: 17 }, event_id: "43" }, "43");
  const { stream, calls, applied, statuses } = makeStream([
    { chunks: [frame("ready", { cursor: "42", heartbeat_ms: 15000 }), ": heartbeat\n\n", created.slice(0, 20), created.slice(20)], hang: true },
  ]);
  stream.start();
  await waitFor(() => applied.length === 1);
  assert.equal(calls[0].headers.Authorization, "Bearer jwt-1");
  assert.equal(calls[0].after, null);
  assert.ok(!calls[0].url.includes("jwt"));
  assert.equal(applied[0].event, "message.created");
  assert.equal(applied[0].data.message.sequence, "17", "sequence kept as a string");
  assert.equal(stream.getCursor(), "43");
  assert.ok(statuses.includes("live"));
  stream.close();
});

test("reconnect replays from the last applied event id", async () => {
  const { stream, calls, applied } = makeStream([
    { chunks: [frame("ready", { cursor: "42" }), frame("ticket.updated", { ticket: { id: "t1" } }, "43"), frame("ticket.updated", { ticket: { id: "t1" } }, "44")] },
    { chunks: [frame("ready", { cursor: "44" })], hang: true },
  ]);
  stream.start();
  await waitFor(() => calls.length === 2);
  assert.equal(calls[1].after, "44");
  assert.equal(applied.length, 2);
  stream.close();
});

test("an event that fails to apply does not advance the cursor and is replayed", async () => {
  let fail = true;
  const { stream, calls } = makeStream(
    [
      { chunks: [frame("ready", { cursor: "10" }), frame("ticket.updated", { ticket: { id: "t" } }, "11")] },
      { chunks: [frame("ready", { cursor: "11" })], hang: true },
    ],
    {
      onEvent: () => {
        if (fail) {
          fail = false;
          throw new Error("boom");
        }
      },
    },
  );
  const origError = console.error;
  console.error = () => undefined;
  try {
    stream.start();
    await waitFor(() => calls.length === 2);
    assert.equal(calls[1].after, "10");
  } finally {
    console.error = origError;
    stream.close();
  }
});

test("stream.reconnect REFRESH_AUTHENTICATION refreshes auth and reconnects with the new token", async () => {
  let token = "old";
  let refreshed = 0;
  const { stream, calls } = makeStream(
    [{ chunks: [frame("ready", { cursor: "1" }), frame("stream.reconnect", { reason: "REFRESH_AUTHENTICATION" })], hang: true }, { hang: true }],
    {
      getToken: () => token,
      refreshAuth: async () => {
        refreshed++;
        token = "new";
      },
    },
  );
  stream.start();
  await waitFor(() => calls.length === 2);
  assert.equal(refreshed, 1);
  assert.equal(calls[1].headers.Authorization, "Bearer new");
  assert.equal(calls[1].after, "1");
  stream.close();
});

test("ACCESS_REVOKED stops reconnecting", async () => {
  const { stream, calls, statuses } = makeStream([
    { chunks: [frame("ready", { cursor: "1" }), frame("stream.error", { code: "ACCESS_REVOKED", reconnect: false })] },
  ]);
  stream.start();
  await waitFor(() => statuses.includes("denied"));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls.length, 1);
});

test("TEMPORARILY_UNAVAILABLE reconnects with backoff and the saved cursor", async () => {
  const { stream, calls } = makeStream([
    { chunks: [frame("ready", { cursor: "5" }), frame("ticket.updated", { ticket: { id: "t" } }, "6"), frame("stream.error", { code: "TEMPORARILY_UNAVAILABLE", reconnect: true })] },
    { status: 503 },
    { hang: true },
  ]);
  stream.start();
  await waitFor(() => calls.length === 3);
  assert.equal(calls[1].after, "6");
  assert.equal(calls[2].after, "6");
  stream.close();
});

test("401 tries one auth refresh, then reports the session as expired", async () => {
  let refreshes = 0;
  const { stream, calls, statuses } = makeStream([{ status: 401 }, { status: 401 }], {
    refreshAuth: async () => {
      refreshes++;
    },
  });
  stream.start();
  await waitFor(() => statuses.includes("expired"));
  assert.equal(refreshes, 1);
  assert.equal(calls.length, 2);
});

test("no token means no request at all", async () => {
  const { stream, calls, statuses } = makeStream([], { getToken: () => null });
  stream.start();
  await waitFor(() => statuses.includes("expired"));
  assert.equal(calls.length, 0);
});

test("close() aborts the open stream and prevents reconnects (logout / unmount)", async () => {
  const { stream, calls, statuses } = makeStream([{ chunks: [frame("ready", { cursor: "1" })], hang: true }]);
  stream.start();
  await waitFor(() => statuses.includes("live"));
  stream.close();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls.length, 1);
  assert.equal(stream.getStatus(), "idle");
});
