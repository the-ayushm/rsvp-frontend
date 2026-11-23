export const META_SESSION_WAIT_MS = 2500;
export const META_CODE_WAIT_MS = 15000;
export const META_FINISH_EVENTS = new Set([
  "FINISH", "FINISH_ONLY_WABA", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  "FINISH_OBO_MIGRATION", "FINISH_GRANT_ONLY_API_ACCESS",
]);

export interface SignupSession {
  type: "WA_EMBEDDED_SIGNUP";
  event: string;
  data: Record<string, unknown>;
}

export interface OnboardPayload {
  code: string;
  state: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
}

export type SignupStage = "idle" | "waiting_meta" | "connecting" | "success" | "error";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function parseSignupSession(origin: string, value: unknown): SignupSession | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || (url.hostname !== "facebook.com" && !url.hostname.endsWith(".facebook.com"))) return null;
    const message = record(typeof value === "string" ? JSON.parse(value) : value);
    if (message?.type !== "WA_EMBEDDED_SIGNUP" || typeof message.event !== "string") return null;
    return { type: "WA_EMBEDDED_SIGNUP", event: message.event, data: record(message.data) ?? {} };
  } catch { return null; }
}

function metaId(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

export function signupAssetIds(session: SignupSession | null) {
  const ids = Array.isArray(session?.data.waba_ids) ? [...new Set(session.data.waba_ids.map(metaId).filter(Boolean))] : [];
  return {
    waba_id: metaId(session?.data.waba_id) ?? (ids.length === 1 ? ids[0] : null),
    phone_number_id: metaId(session?.data.phone_number_id),
  };
}

function messages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(messages);
  const item = record(value);
  if (!item) return [];
  if (item.message || item.msg) return messages(item.message ?? item.msg);
  return Object.values(item).flatMap(messages);
}

export function signupErrorMessage(error: unknown): string {
  const item = record(error);
  const data = record(record(item?.response)?.data);
  const nested = record(data?.error);
  const details = messages(data?.errors ?? data?.validation_errors ?? data?.detail);
  if (details.length) return [...new Set(details)].join(" ");
  for (const value of [data?.message, nested?.message, data?.error]) {
    const text = messages(value);
    if (text.length) return text.join(" ");
  }
  if (!data && (item?.code === "ECONNABORTED" || item?.code === "ERR_NETWORK" || item?.isAxiosError)) {
    return "We could not confirm the backend connection. Check your WhatsApp accounts before starting signup again; the request may still have completed.";
  }
  return error instanceof Error ? error.message : "Unable to connect your WhatsApp account. Please try signup again.";
}

export function assertOnboardingAccepted(value: unknown): void {
  const root = record(value);
  const data = record(root?.data);
  if (root?.success === false || data?.success === false) {
    throw Object.assign(new Error("Onboarding failed"), { response: { data: data?.success === false ? data : root } });
  }
  if (root?.success === true || data?.success === true || metaId(data?.waba_id ?? root?.waba_id)) return;
  throw new Error("The backend did not confirm onboarding. Check your WhatsApp accounts before starting signup again.");
}

interface CoordinatorOptions {
  onboard: (payload: OnboardPayload) => Promise<void>;
  onStage: (stage: SignupStage) => void;
  onError: (message: string) => void;
  schedule?: (callback: () => void, delay: number) => () => void;
}

/** Joins Meta's independent SDK callback and popup session without replaying a single-use code. */
export class EmbeddedSignupCoordinator {
  private attempt = 0;
  private active = false;
  private sent = false;
  private code: string | null = null;
  private session: SignupSession | null = null;
  private stopTimer?: () => void;
  private readonly schedule: NonNullable<CoordinatorOptions["schedule"]>;

  constructor(private readonly options: CoordinatorOptions) {
    this.schedule = options.schedule ?? ((callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    });
  }

  start(): number {
    this.stopTimer?.();
    this.attempt++;
    this.active = true;
    this.sent = false;
    this.code = null;
    this.session = null;
    this.options.onStage("waiting_meta");
    return this.attempt;
  }

  receiveSession(origin: string, value: unknown): void {
    if (!this.active || this.sent) return;
    const session = parseSignupSession(origin, value);
    if (!session) return;
    if (META_FINISH_EVENTS.has(session.event)) {
      this.session = session;
      if (this.code) this.submit();
      else {
        this.stopTimer?.();
        this.stopTimer = this.schedule(() => this.fail("Meta completed signup but did not return an authorization code. Please start Facebook signup again."), META_CODE_WAIT_MS);
      }
    } else if ((session.event === "CANCEL" || session.event === "ERROR") && !this.session) {
      this.fail(typeof session.data.error_message === "string" ? session.data.error_message : "Signup was cancelled or interrupted. Please try again.");
    }
  }

  receiveLogin(value: unknown, attempt: number): void {
    if (!this.active || this.sent || attempt !== this.attempt || this.code) return;
    const code = record(record(value)?.authResponse)?.code;
    if (typeof code !== "string" || !code.trim()) {
      this.fail("Meta did not return an authorization code. Please complete Facebook signup again.");
      return;
    }
    this.code = code;
    this.stopTimer?.();
    if (this.session) this.submit();
    else this.stopTimer = this.schedule(() => this.submit(), META_SESSION_WAIT_MS);
  }

  fail(message: string): void {
    if (!this.active || this.sent) return;
    this.stopTimer?.();
    this.active = false;
    this.code = null;
    this.options.onError(message);
    this.options.onStage("error");
  }

  dispose(): void {
    this.stopTimer?.();
    this.active = false;
    this.code = null;
    this.attempt++;
  }

  private submit(): void {
    if (!this.active || this.sent || !this.code) return;
    this.stopTimer?.();
    this.sent = true;
    const attempt = this.attempt;
    const payload: OnboardPayload = { code: this.code, state: null, ...signupAssetIds(this.session) };
    this.code = null;
    this.options.onStage("connecting");
    // A timeout can occur after Meta's code was exchanged: never automatically replay it.
    Promise.resolve().then(() => this.options.onboard(payload)).then(() => {
      if (this.active && attempt === this.attempt) this.options.onStage("success");
    }).catch(error => {
      if (!this.active || attempt !== this.attempt) return;
      this.options.onError(signupErrorMessage(error));
      this.options.onStage("error");
    });
  }
}
