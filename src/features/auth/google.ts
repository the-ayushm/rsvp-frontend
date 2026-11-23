/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/**
 * Google sign-in with Google Identity Services (ID token + server nonce).
 *
 *   login:  POST /auth/google/start       → { client_id, flow_token, nonce, expires_at }
 *           POST /auth/google/login       { credential, flow_token } → same envelope as /auth/login
 *   link:   POST /auth/google/link/start  (JWT) → same as start
 *           POST /auth/google/link        (JWT) { credential, flow_token, current_password }
 *   status: GET  /auth/google/status      (JWT) → { google_connected, has_password }
 *
 * The company is resolved on the server from the page origin, so nothing else is sent.
 * flow_token stays in memory only.
 */

export type GoogleFlow = {
  client_id: string;
  flow_token: string;
  nonce: string;
  expires_at: string;
};

export type GoogleSignInStatus = { google_connected: boolean; has_password: boolean };

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GsiId = {
  initialize: (config: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_button?: boolean;
    button_auto_select?: boolean;
    callback: (res: { credential?: string }) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

let gsiPromise: Promise<GsiId> | null = null;
/** Loads Google Identity Services once per page. */
export function loadGsi(): Promise<GsiId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  gsiPromise ??= new Promise<GsiId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("GSI_LOAD")));
    script.onerror = () => {
      gsiPromise = null;
      script.remove();
      reject(new Error("GSI_LOAD"));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/* ── Errors ── */

export class GoogleAuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  GOOGLE_AUTH_NOT_CONFIGURED: "Google sign-in isn't available right now.",
  GOOGLE_ORIGIN_NOT_ALLOWED: "Google sign-in isn't enabled for this website yet. Please contact support.",
  GOOGLE_DOMAIN_UNAVAILABLE: "Google sign-in isn't available for this website. Please contact support.",
  GOOGLE_ACCOUNT_LINK_REQUIRED:
    "An account with this email already exists. Log in with your email and password, then connect Google from your profile.",
  GOOGLE_EMAIL_VERIFICATION_REQUIRED:
    "This Google account can't be used to sign up directly. Sign up with email first, then connect Google from your profile.",
  GOOGLE_ACCOUNT_UNAVAILABLE: "This account is inactive or belongs to another dashboard.",
  GOOGLE_FLOW_EXPIRED: "Your Google sign-in timed out. Please try again.",
  GOOGLE_TOKEN_INVALID: "We couldn't verify your Google account. Please try again.",
  GOOGLE_AUTH_UNAVAILABLE: "Google verification is temporarily unavailable. Please try again in a moment.",
  GOOGLE_AUTH_RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  GOOGLE_PASSWORD_REQUIRED: "Your current password is incorrect.",
  GOOGLE_EMAIL_MISMATCH: "Choose the Google account that uses the same email as this account.",
  GOOGLE_ALREADY_LINKED: "This account is already connected to a Google account.",
  GOOGLE_ACCOUNT_CONFLICT: "That Google account is already connected to another account.",
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  GSI_LOAD: "Couldn't load Google sign-in. Check your connection or disable blockers and retry.",
};

/** Maps any API/axios error to a GoogleAuthError with a readable message (reads error.code). */
export function toGoogleAuthError(err: any): GoogleAuthError {
  if (err instanceof GoogleAuthError) return err;
  if (err?.message === "GSI_LOAD") return new GoogleAuthError("GSI_LOAD", MESSAGES.GSI_LOAD);
  const data = err?.response?.data;
  if (!err?.response) return new GoogleAuthError("NETWORK_ERROR", MESSAGES.NETWORK_ERROR);
  // API without the Google routes yet: treat like "not configured" so the button stays hidden.
  if (err.response.status === 404) return new GoogleAuthError("GOOGLE_AUTH_NOT_CONFIGURED", MESSAGES.GOOGLE_AUTH_NOT_CONFIGURED);
  const code: string = data?.error?.code || "UNKNOWN";
  const fallback =
    (typeof data?.error === "string" ? data.error : data?.error?.message) || data?.message || "Google sign-in failed. Please try again.";
  return new GoogleAuthError(code, MESSAGES[code] ?? fallback);
}

/* ── API ── */

const unwrapFlow = (res: any): GoogleFlow => {
  const flow = res?.data?.data;
  if (!flow?.client_id || !flow?.flow_token || !flow?.nonce) throw new GoogleAuthError("UNKNOWN", "Google sign-in failed to start.");
  return flow;
};

// The login flow is reused while valid, so switching Log in / Sign up tabs doesn't start a new one.
let cachedLoginFlow: GoogleFlow | null = null;
const flowIsFresh = (f: GoogleFlow) => new Date(f.expires_at).getTime() - Date.now() > 60_000;

export async function startGoogleLogin(): Promise<GoogleFlow> {
  if (cachedLoginFlow && flowIsFresh(cachedLoginFlow)) return cachedLoginFlow;
  try {
    cachedLoginFlow = unwrapFlow(await soft7AxiosInstance.post("/auth/google/start", {}));
    return cachedLoginFlow;
  } catch (err) {
    throw toGoogleAuthError(err);
  }
}

/** Returns the same envelope as password login (outer data = login result). */
export async function completeGoogleLogin(credential: string, flowToken: string) {
  // Success consumes the flow; on failure we start a new one with a new nonce anyway.
  cachedLoginFlow = null;
  try {
    const res = await soft7AxiosInstance.post("/auth/google/login", { credential, flow_token: flowToken });
    if (!res.data?.success) throw new GoogleAuthError("UNKNOWN", res.data?.message || "Google sign-in failed.");
    return res.data;
  } catch (err) {
    throw toGoogleAuthError(err);
  }
}

export async function startGoogleLink(): Promise<GoogleFlow> {
  try {
    return unwrapFlow(await soft7AxiosInstance.post("/auth/google/link/start", {}));
  } catch (err) {
    throw toGoogleAuthError(err);
  }
}

export async function linkGoogle(credential: string, flowToken: string, currentPassword: string) {
  try {
    const res = await soft7AxiosInstance.post("/auth/google/link", {
      credential,
      flow_token: flowToken,
      current_password: currentPassword,
    });
    return res.data?.data as GoogleSignInStatus;
  } catch (err) {
    throw toGoogleAuthError(err);
  }
}

export async function getGoogleSignInStatus(): Promise<GoogleSignInStatus> {
  const res = await soft7AxiosInstance.get("/auth/google/status");
  const d = res.data?.data ?? {};
  return { google_connected: !!d.google_connected, has_password: d.has_password !== false };
}
