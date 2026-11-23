/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type {
  AutomationFlow,
  FlowConnection,
  FlowEvent,
  FlowEventDetail,
  FlowListResult,
  FlowRun,
  FlowStatus,
  FlowStep,
  FlowTemplate,
  ShopifySetup,
  WebhookConfigResult,
  WebhookStatus,
} from "./types";
import type { StepPayload } from "./steps";

/** soft7AxiosInstance's baseURL already ends in /v1. */
const BASE = "/admin/flows";
const enc = encodeURIComponent;

const data = <T>(res: { data: any }): T => res.data?.data as T;

export class FlowApiError extends Error {
  constructor(
    public status: number | null,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === null;
  }
}

const FALLBACK: Record<number, string> = {
  400: "Some settings are invalid or incomplete.",
  401: "Your session has ended. Please sign in again.",
  403: "You don't have permission to do this, or your account is inactive.",
  404: "This item is no longer available.",
  409: "This flow changed since you loaded it, or it is active. Refresh and try again.",
  413: "That's too large — reduce the number of rows, cells or the range.",
};

/** Turns any thrown value into a FlowApiError carrying the server's message. */
export function toFlowError(err: unknown): FlowApiError {
  if (err instanceof FlowApiError) return err;
  const e = err as any;
  const status: number | null = e?.response?.status ?? null;
  const body = e?.response?.data;
  const serverMessage =
    (typeof body?.message === "string" && body.message) || (typeof body?.error === "string" && body.error) || null;
  if (status === null) return new FlowApiError(null, "Network error — check your connection and try again.");
  if (status >= 500) return new FlowApiError(status, serverMessage ?? "Setup, provider or server error. Please try again.", body);
  return new FlowApiError(status, serverMessage ?? FALLBACK[status] ?? "Something went wrong.", body);
}

async function call<T>(fn: () => Promise<{ data: any }>): Promise<T> {
  try {
    return data<T>(await fn());
  } catch (err) {
    throw toFlowError(err);
  }
}

/** Normalizes id/_id so the rest of the UI can rely on `id`. */
export function normalizeFlow(raw: any): AutomationFlow {
  const steps: FlowStep[] = Array.isArray(raw?.steps)
    ? raw.steps.filter((s: any) => !s?.deletedAt).map((s: any) => ({ ...s, _id: String(s._id ?? s.id), parameters: s.parameters ?? {} }))
    : [];
  return {
    ...raw,
    id: String(raw?.id ?? raw?._id),
    revision: Number(raw?.revision ?? 0),
    webhookPath: raw?.webhookPath ?? steps[0]?.webhookPath ?? null,
    steps,
  };
}

/** Some endpoints may return the step rather than the flow. */
export const flowOrNull = (raw: any): AutomationFlow | null =>
  raw && Array.isArray(raw.steps) ? normalizeFlow(raw) : raw?.flow && Array.isArray(raw.flow.steps) ? normalizeFlow(raw.flow) : null;

const normalizeConnection = (c: any): FlowConnection => ({ ...c, id: String(c.id ?? c._id) });

export const flowsApi = {
  apps: () => call<unknown>(() => soft7AxiosInstance.get(`${BASE}/apps`)),

  connections: async () => {
    const list = await call<any[]>(() => soft7AxiosInstance.get(`${BASE}/connections`));
    return (Array.isArray(list) ? list : (list as any)?.items ?? []).map(normalizeConnection) as FlowConnection[];
  },

  templates: async (connectionId: string) => {
    const list = await call<FlowTemplate[]>(() => soft7AxiosInstance.get(`${BASE}/connections/${enc(connectionId)}/templates`));
    return (Array.isArray(list) ? list : []).map((template) => ({ ...template, id: String(template.id) }));
  },

  createRazorpayConnection: async (body: { name: string; mode: "test" | "live"; key_id: string; key_secret: string }) =>
    normalizeConnection(await call<any>(() => soft7AxiosInstance.post(`${BASE}/connections`, { appKey: "razorpay", ...body }))),

  /**
   * Shopify connection from an installed app's credentials. The secret is sent
   * once and never kept in the browser; the backend manages access tokens.
   */
  createShopifyConnection: async (body: { name: string; shop: string; client_id: string; client_secret: string }) =>
    normalizeConnection(await call<any>(() => soft7AxiosInstance.post(`${BASE}/connections`, { appKey: "shopify", ...body }))),

  deleteConnection: (connectionId: string) => call<unknown>(() => soft7AxiosInstance.delete(`${BASE}/connections/${enc(connectionId)}`)),

  list: async (params: { page?: number; limit?: number; status?: FlowStatus; search?: string }) => {
    const res = await call<any>(() =>
      soft7AxiosInstance.get(`${BASE}`, {
        params: {
          page: params.page ?? 1,
          limit: Math.min(params.limit ?? 20, 100),
          status: params.status,
          search: params.search?.trim() || undefined,
        },
      }),
    );
    return {
      items: (res?.items ?? []).map(normalizeFlow),
      pagination: res?.pagination ?? { page: 1, limit: 20, total: 0 },
      counts: { all: 0, active: 0, inactive: 0, draft: 0, ...(res?.counts ?? {}) },
    } as FlowListResult;
  },

  create: async (name: string) => normalizeFlow(await call<any>(() => soft7AxiosInstance.post(`${BASE}`, { name }))),

  get: async (flowId: string) => normalizeFlow(await call<any>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}`))),

  rename: async (flowId: string, name: string, revision: number) =>
    flowOrNull(await call<any>(() => soft7AxiosInstance.patch(`${BASE}/${enc(flowId)}`, { name, revision }))),

  remove: (flowId: string) => call<unknown>(() => soft7AxiosInstance.delete(`${BASE}/${enc(flowId)}`)),

  /** Returns the updated flow when the API sends one, otherwise null (caller refetches). */
  addStep: async (flowId: string, revision: number, body: Partial<StepPayload> = {}) =>
    flowOrNull(await call<any>(() => soft7AxiosInstance.post(`${BASE}/${enc(flowId)}/steps`, { ...body, revision }))),

  updateStep: async (flowId: string, stepId: string, revision: number, body: Partial<StepPayload>) =>
    flowOrNull(
      await call<any>(() => soft7AxiosInstance.patch(`${BASE}/${enc(flowId)}/steps/${enc(stepId)}`, { ...body, revision })),
    ),

  saveSteps: async (flowId: string, revision: number, steps: StepPayload[]) =>
    flowOrNull(await call<any>(() => soft7AxiosInstance.put(`${BASE}/${enc(flowId)}/steps`, { revision, steps }))),

  deleteStep: async (flowId: string, stepId: string, revision: number) =>
    flowOrNull(
      await call<any>(() =>
        soft7AxiosInstance.delete(`${BASE}/${enc(flowId)}/steps/${enc(stepId)}`, { data: { revision }, params: { revision } }),
      ),
    ),

  setStatus: async (flowId: string, status: "active" | "inactive", revision: number) =>
    flowOrNull(await call<any>(() => soft7AxiosInstance.patch(`${BASE}/${enc(flowId)}/status`, { status, revision }))),

  configureWebhook: (flowId: string, body: { signing_secret: string; revision: number; rotate_token?: boolean }) =>
    call<WebhookConfigResult>(() => soft7AxiosInstance.post(`${BASE}/${enc(flowId)}/webhook`, body)),

  /**
   * Automatic webhook registration (apps with automatic_webhook_setup, e.g.
   * Shopify). The backend uses the stored connection and the platform app
   * secret — nothing secret is sent from the browser. Safe to retry: an
   * existing matching subscription is reused.
   */
  subscribeWebhook: (flowId: string) =>
    call<WebhookStatus>(() => soft7AxiosInstance.post(`${BASE}/${enc(flowId)}/webhook/subscribe`, {})),

  webhookStatus: (flowId: string) => call<WebhookStatus>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}/webhook/status`)),

  unsubscribeWebhook: (flowId: string) =>
    call<unknown>(() => soft7AxiosInstance.delete(`${BASE}/${enc(flowId)}/webhook/subscription`)),

  events: async (flowId: string) => {
    const res = await call<any>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}/events`));
    const items = Array.isArray(res) ? res : res?.items ?? [];
    return items.map((e: any) => ({ ...e, id: String(e.id ?? e._id) })) as FlowEvent[];
  },

  event: async (flowId: string, eventId: string) => {
    const e = await call<any>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}/events/${enc(eventId)}`));
    return { ...e, id: String(e?.id ?? e?._id ?? eventId) } as FlowEventDetail;
  },

  startTestRun: async (flowId: string, body: { event_id: string; request_id: string }) => {
    const r = await call<any>(() => soft7AxiosInstance.post(`${BASE}/${enc(flowId)}/test-runs`, body));
    return { ...r, id: String(r?.id ?? r?._id) } as FlowRun;
  },

  runs: async (flowId: string) => {
    const res = await call<any>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}/runs`));
    const items = Array.isArray(res) ? res : res?.items ?? [];
    return items.map((r: any) => ({ ...r, id: String(r.id ?? r._id) })) as FlowRun[];
  },

  run: async (flowId: string, runId: string) => {
    const r = await call<any>(() => soft7AxiosInstance.get(`${BASE}/${enc(flowId)}/runs/${enc(runId)}`));
    return { ...r, id: String(r?.id ?? r?._id ?? runId) } as FlowRun;
  },
};

// ── Connection setup (existing Shopify OAuth endpoints) ──────
// Google Sheets lives in features/integrations/google-sheets.
// OAuth start relies on the browser-cookie flow, so send credentials.

export const connectionSetupApi = {
  shopifySetup: () => call<ShopifySetup>(() => soft7AxiosInstance.get("/admin/shopify/setup", { withCredentials: true })),

  startShopifyOAuth: (body: { shop: string; name: string }) =>
    call<{ authorization_url: string }>(() => soft7AxiosInstance.post("/admin/shopify/oauth/start", body, { withCredentials: true })),
};
