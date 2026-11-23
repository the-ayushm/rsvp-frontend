/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/**
 * Shopify store connections (account owner only).
 * Requests go directly to the hosted API and retain the shared JWT interceptor.
 * OAuth start also sends credentials to bind its callback cookie.
 */
const BASE = "/admin/shopify";
const API_URL = "https://hostapi.soft7.in/v1";
const enc = encodeURIComponent;
const opts = { baseURL: API_URL, timeout: 20_000 };

export interface ShopifySetupInfo {
  ready: boolean;
  issue: string | null;
  scopes?: string[];
}

export interface ShopifyStore {
  id: string;
  name: string;
  shop_domain: string;
  status: string;
  scopes?: string | string[] | null;
  desired_topics?: string[] | null;
  subscribed_topics?: string[];
  subscription_issue?: string | null;
  created_at?: string;
  updated_at?: string;
}

const FALLBACK: Record<number, string> = {
  400: "Some details are invalid. Check the store domain and app credentials.",
  401: "Your session has ended. Please sign in again.",
  403: "Only the account owner can manage Shopify connections.",
  404: "This Shopify connection is no longer available.",
  409: "This store is already connected or a connection is in progress.",
};

export function shopifyErrorMessage(err: unknown): string {
  const e = err as any;
  const status: number | undefined = e?.response?.status;
  const body = e?.response?.data;
  const server = (typeof body?.message === "string" && body.message) || (typeof body?.error === "string" && body.error) || null;
  if (!e?.response) {
    if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT") return "The Shopify API took too long to respond. Please try again.";
    if (e?.code === "ERR_NETWORK") return "Couldn't reach the Shopify API. Check your connection and try again.";
    return e instanceof Error && e.message ? e.message : "Couldn't reach the Shopify API. Please try again.";
  }
  if (status && status >= 500) return server ?? "The Shopify API is unavailable. Please try again shortly.";
  return server ?? (status && FALLBACK[status]) ?? "Something went wrong. Please try again.";
}

const data = <T>(res: { data: any }): T => res.data?.data as T;

const normalize = (c: any): ShopifyStore => ({
  ...c,
  id: String(c.id ?? c._id),
  name: String(c.name || c.shop_domain || "Shopify store"),
  shop_domain: String(c.shop_domain ?? c.shop ?? ""),
  status: String(c.status ?? "connected"),
});

export const shopifyApi = {
  setup: async () => data<ShopifySetupInfo>(await soft7AxiosInstance.get(`${BASE}/setup`, opts)),

  connections: async () => {
    const res = data<any>(await soft7AxiosInstance.get(`${BASE}/connections`, opts));
    const list: any[] = res?.connections ?? (Array.isArray(res) ? res : []);
    return list.map(normalize);
  },

  /** OAuth: returns Shopify's consent URL. The callback saves the connection server-side. */
  startOAuth: async (body: { shop: string; name: string }) =>
    data<{ authorization_url: string }>(await soft7AxiosInstance.post(`${BASE}/oauth/start`, body, { ...opts, withCredentials: true })),

  /**
   * Connection from an installed custom app's Client ID / secret. The secret is
   * sent once and never kept in the browser; the backend manages access tokens.
   */
  connectWithCredentials: async (body: { name: string; shop: string; client_id: string; client_secret: string }) =>
    normalize(data<any>(await soft7AxiosInstance.post(`${API_URL}/admin/flows/connections`, { appKey: "shopify", ...body }, opts))),

  /** Removes the store's webhooks and stored credentials. */
  disconnect: async (id: string) => data<unknown>(await soft7AxiosInstance.delete(`${BASE}/connections/${enc(id)}`, opts)),
};

/** Accepts "store", "store.myshopify.com" or a full admin URL; returns the myshopify.com host or null. */
export { normalizeShop as normalizeShopDomain } from "@/features/flows/automation/steps";
