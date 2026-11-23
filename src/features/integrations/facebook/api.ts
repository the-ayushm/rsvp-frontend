/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/** Which Meta app the backend uses: Lead Ads (App 1) or Messenger (App 2). */
export type FacebookFeature = "leads" | "messaging";

export type FacebookSetup = { ready: boolean; issue: string | null };

/** started/authorizing: the login exists but the backend hasn't finished exchanging the code yet. */
export type OAuthStatus = "none" | "started" | "authorizing" | "ready" | "failed";
const OAUTH_STATUSES: OAuthStatus[] = ["none", "started", "authorizing", "ready", "failed"];
export const isOAuthPending = (s: OAuthStatus) => s === "started" || s === "authorizing";
export type FacebookCandidatePage = { page_id: string; name: string };
export type FacebookOAuthPages = { status: OAuthStatus; error: string | null; pages: FacebookCandidatePage[] };
/** A saved Page connection. `id` is the local UUID used in all other paths. */
export type FacebookPageConnection = { id: string; page_id: string; name: string; status: string; error: string | null };
export type FacebookFormQuestion = { key: string; label: string; type: string };
/** A Page's Instant Form. `id` is the local form connection UUID. */
export type FacebookLeadForm = {
  id: string; form_id: string; name: string; status: string; enabled: boolean;
  questions: FacebookFormQuestion[]; error: string | null;
};
export type FacebookLead = { lead_id: string; submitted_at: string; field_data: { name: string; values: string[] }[] };
export type FacebookLeadsPage = { leads: FacebookLead[]; page: number; hasMore: boolean; total: number | null };

const BASE = "/admin/facebook";
const LEADS_LIMIT = 25;
const str = (v: unknown) => (v == null ? "" : String(v));
const id = (v: string) => encodeURIComponent(v);
const message = (v: any): string | null =>
  !v ? null : typeof v === "string" ? v : typeof v?.message === "string" ? v.message : typeof v?.error === "string" ? v.error : null;
const list = (d: any, key: string): any[] => (Array.isArray(d) ? d : Array.isArray(d?.[key]) ? d[key] : []);

// The OAuth calls carry the HttpOnly browser cookie set at /oauth/start.
// Credentialed cross-origin requests need the API to return the exact
// dashboard origin with Allow-Credentials, not "*", so only these opt in.
async function call<T>(method: "get" | "post" | "patch" | "delete", path: string, body?: unknown, withCredentials = false): Promise<T> {
  const response = await soft7AxiosInstance.request({ method, url: `${BASE}${path}`, data: body, withCredentials });
  if (response.data?.success === false) throw new Error(message(response.data) || "Facebook request failed.");
  return (response.data?.data ?? response.data) as T;
}

const toConnection = (p: any): FacebookPageConnection => ({
  id: str(p?.id), page_id: str(p?.page_id),
  name: str(p?.name ?? p?.page_name) || str(p?.page_id),
  status: str(p?.status) || "connected", error: message(p?.error ?? p?.last_error),
});

const toForm = (f: any): FacebookLeadForm => ({
  id: str(f?.id), form_id: str(f?.form_id ?? f?.meta_form_id),
  name: str(f?.name ?? f?.form_name) || "Untitled form",
  status: str(f?.status), enabled: Boolean(f?.enabled ?? f?.sync_enabled),
  questions: (Array.isArray(f?.questions) ? f.questions : []).map((q: any) => ({
    key: str(q?.key ?? q?.id), label: str(q?.label ?? q?.key), type: str(q?.type),
  })),
  error: message(f?.error ?? f?.last_error),
});

const toLead = (l: any): FacebookLead => {
  // Answers arrive as Graph-style field_data, or as a flat object.
  const raw = Array.isArray(l?.field_data) ? l.field_data
    : l?.fields && typeof l.fields === "object" ? Object.entries(l.fields).map(([name, values]) => ({ name, values }))
    : [];
  return {
    lead_id: str(l?.lead_id ?? l?.id), submitted_at: str(l?.submitted_at ?? l?.created_time ?? l?.created_at),
    field_data: raw.map((f: any) => ({
      name: str(f?.name), values: (Array.isArray(f?.values) ? f.values : [f?.values]).filter((v: unknown) => v != null).map(str),
    })),
  };
};

export const facebookError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    // No response at all: blocked by CORS (or the API is unreachable).
    if (!error.response && error.code === "ERR_NETWORK") {
      return error.config?.withCredentials
        ? "Facebook login is blocked by the API's CORS settings. Open the dashboard on the API's allowed origin, or allow this origin with credentials on the API."
        : "Couldn't reach the API. Check your connection and retry.";
    }
    const backend = message(error.response?.data);
    if (backend) return backend;
    if (error.response?.status === 401) return "Your session expired. Sign in again and retry.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};

export const facebookApi = {
  setup: async (feature: FacebookFeature): Promise<FacebookSetup> => {
    const d = await call<any>("get", `/setup?feature=${feature}`);
    return { ready: d?.ready !== false && d?.configured !== false, issue: message(d?.issue ?? d?.error) };
  },
  start: (feature: FacebookFeature = "leads") =>
    call<{ authorization_url: string; expires_at?: string }>("post", "/oauth/start", { feature }, true),
  oauthPages: async (feature: FacebookFeature = "leads"): Promise<FacebookOAuthPages> => {
    const d = await call<any>("get", `/oauth/pages?feature=${feature}`, undefined, true);
    const status: OAuthStatus = OAUTH_STATUSES.includes(d?.status) ? d.status : "none";
    return {
      status, error: message(d?.error),
      pages: list(d, "pages").map((p: any) => ({ page_id: str(p?.page_id), name: str(p?.name) || str(p?.page_id) })),
    };
  },
  /** Connecting a Page completes the OAuth session; another Page needs a new login. */
  connectPage: async (pageId: string, feature: FacebookFeature = "leads"): Promise<FacebookPageConnection> =>
    toConnection(await call<any>("post", "/pages", { feature, page_id: pageId }, true)),
  pages: async (feature: FacebookFeature = "leads"): Promise<FacebookPageConnection[]> =>
    list(await call<any>("get", `/pages?feature=${feature}`), "pages").map(toConnection),
  disconnect: (connectionId: string, feature: FacebookFeature = "leads") =>
    call("delete", `/pages/${id(connectionId)}?feature=${feature}`),
  forms: async (connectionId: string): Promise<FacebookLeadForm[]> =>
    list(await call<any>("get", `/pages/${id(connectionId)}/forms`), "forms").map(toForm),
  /** Pulls the latest Instant Forms from Facebook into the saved list. */
  refreshForms: (connectionId: string) => call("post", `/pages/${id(connectionId)}/forms/refresh`),
  setFormEnabled: async (formId: string, enabled: boolean) =>
    toForm(await call<any>("patch", `/forms/${id(formId)}`, { enabled })),
  sync: async (formId: string) => {
    const d = await call<any>("post", `/forms/${id(formId)}/sync`);
    const imported = d?.imported ?? d?.created ?? d?.saved ?? d?.synced;
    return { imported: imported == null ? null : Number(imported), fetched: d?.fetched == null ? null : Number(d.fetched) };
  },
  leads: async (formId: string, page = 1): Promise<FacebookLeadsPage> => {
    const d = await call<any>("get", `/forms/${id(formId)}/leads?page=${page}&limit=${LEADS_LIMIT}`);
    const leads = list(d, "leads").map(toLead);
    const meta = d?.pagination ?? d?.meta ?? d ?? {};
    const total = meta.total ?? meta.total_count ?? meta.totalCount;
    const pages = meta.total_pages ?? meta.totalPages ?? meta.pages;
    const hasMore = typeof meta.has_more === "boolean" ? meta.has_more
      : pages != null ? page < Number(pages)
      : total != null ? page * LEADS_LIMIT < Number(total)
      : leads.length === LEADS_LIMIT;
    return { leads, page, hasMore, total: total == null ? null : Number(total) };
  },
};

// ---- Messenger inbox (App 2). Proposed backend contract; endpoints may not exist yet. ----

export type MessengerConversation = {
  id: string; name: string; participant_id: string;
  last_message: string; last_message_at: string; unread: number;
};
export type MessengerMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | "received";
export type MessengerMessage = {
  id: string; client_request_id: string | null; outgoing: boolean;
  text: string; created_at: string; status: MessengerMessageStatus; error: string | null;
};

/** True when the backend hasn't shipped the Messenger inbox endpoints yet. */
export const isNotImplemented = (error: unknown) =>
  axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status ?? 0);

const toConversation = (c: any): MessengerConversation => ({
  id: str(c?.id),
  name: str(c?.participant_name ?? c?.customer_name ?? c?.name ?? c?.participant?.name) || "Facebook user",
  participant_id: str(c?.participant_id ?? c?.psid ?? c?.participant?.id),
  last_message: str(c?.last_message?.text ?? c?.last_message_text ?? c?.snippet ?? (typeof c?.last_message === "string" ? c.last_message : "")),
  last_message_at: str(c?.last_message_at ?? c?.last_message?.created_at ?? c?.updated_at),
  unread: Number(c?.unread_count ?? c?.unread ?? 0) || 0,
});

const toMessage = (m: any): MessengerMessage => {
  const direction = str(m?.direction).toLowerCase();
  const outgoing = m?.from_page === true || m?.is_echo === true || ["outbound", "outgoing", "sent"].includes(direction);
  const status = str(m?.status).toLowerCase();
  return {
    id: str(m?.id ?? m?.message_id), client_request_id: m?.client_request_id ? str(m.client_request_id) : null,
    outgoing, text: str(m?.text ?? m?.message ?? m?.body),
    created_at: str(m?.created_at ?? m?.timestamp ?? m?.sent_at),
    status: (["sending", "sent", "delivered", "read", "failed"].includes(status) ? status : outgoing ? "sent" : "received") as MessengerMessageStatus,
    error: message(m?.error ?? m?.error_message),
  };
};

export const messengerApi = {
  conversations: async (pageConnectionId: string, limit = 25): Promise<MessengerConversation[]> =>
    list(await call<any>("get", `/pages/${id(pageConnectionId)}/conversations?limit=${limit}`), "conversations").map(toConversation),
  messages: async (conversationId: string, limit = 50): Promise<MessengerMessage[]> =>
    list(await call<any>("get", `/conversations/${id(conversationId)}/messages?limit=${limit}`), "messages").map(toMessage),
  /** Reuse the same clientRequestId when retrying a message; the backend dedupes on it. */
  send: async (conversationId: string, text: string, clientRequestId: string): Promise<MessengerMessage> =>
    toMessage(await call<any>("post", `/conversations/${id(conversationId)}/messages`, { text, client_request_id: clientRequestId })),
};
