import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { stringifyBigNumbers } from "./state";
import type { MessagesPage, SupportAdmin, SupportMessage, SupportTicket, TicketChannel, TicketStatus, TicketsPage } from "./types";

/** soft7AxiosInstance's baseURL already ends in /v1. */
export const SUPPORT_BASE_PATH = "/admin/support/live";

export function supportEventsUrl(ticketId?: string): string {
  const base = String(soft7AxiosInstance.defaults.baseURL ?? "").replace(/\/+$/, "");
  const query = ticketId ? `?ticket_id=${encodeURIComponent(ticketId)}` : "";
  return `${base}${SUPPORT_BASE_PATH}/events${query}`;
}

const path = (p: string) => `${SUPPORT_BASE_PATH}${p}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = <T>(res: { data: any }): T => res.data?.data as T;

export async function listAdmins(): Promise<SupportAdmin[]> {
  const data = unwrap<SupportAdmin[]>(await soft7AxiosInstance.get(path("/admins")));
  return Array.isArray(data) ? data : [];
}

export interface CreateTicketInput {
  message: string;
  subject?: string;
  channel?: TicketChannel;
  admin_id?: string;
  client_request_id: string;
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const body: Record<string, string> = {
    message: input.message.trim(),
    channel: input.channel ?? "live_chat",
    client_request_id: input.client_request_id,
  };
  if (input.subject?.trim()) body.subject = input.subject.trim();
  if (input.admin_id) body.admin_id = input.admin_id;
  return unwrap<SupportTicket>(await soft7AxiosInstance.post(path("/tickets"), body));
}

export async function listTickets(params: {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  channel?: TicketChannel;
}): Promise<TicketsPage> {
  const data = unwrap<TicketsPage>(
    await soft7AxiosInstance.get(path("/tickets"), {
      params: { page: params.page ?? 1, limit: Math.min(params.limit ?? 20, 100), status: params.status, channel: params.channel },
    }),
  );
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? { page: params.page ?? 1, limit: params.limit ?? 20, total: 0 },
  };
}

export async function getTicket(ticketId: string): Promise<SupportTicket> {
  return unwrap<SupportTicket>(await soft7AxiosInstance.get(path(`/tickets/${encodeURIComponent(ticketId)}`)));
}

const normalizeMessage = (m: SupportMessage): SupportMessage => ({ ...m, sequence: String(m.sequence) });

export async function listMessages(
  ticketId: string,
  params: { before?: string; after?: string; limit?: number } = {},
): Promise<MessagesPage> {
  if (params.before && params.after) throw new Error("Use before OR after, not both.");
  const data = unwrap<MessagesPage>(
    await soft7AxiosInstance.get(path(`/tickets/${encodeURIComponent(ticketId)}/messages`), {
      params: { limit: Math.min(params.limit ?? 50, 100), before: params.before, after: params.after },
      // Keep cursors as strings even if the server sent them as numbers.
      transformResponse: [(raw) => (typeof raw === "string" && raw ? JSON.parse(stringifyBigNumbers(raw)) : raw)],
    }),
  );
  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeMessage) : [],
    has_more: Boolean(data?.has_more),
    next_cursor: data?.next_cursor != null ? String(data.next_cursor) : null,
    previous_cursor: data?.previous_cursor != null ? String(data.previous_cursor) : null,
  };
}

export async function sendMessage(ticketId: string, message: string, clientMessageId: string): Promise<SupportMessage> {
  const saved = unwrap<SupportMessage>(
    await soft7AxiosInstance.post(path(`/tickets/${encodeURIComponent(ticketId)}/messages`), {
      message: message.trim(),
      client_message_id: clientMessageId,
    }),
  );
  return normalizeMessage(saved);
}

export async function updateTicketStatus(ticketId: string, status: "open" | "resolved" | "closed"): Promise<SupportTicket> {
  return unwrap<SupportTicket>(
    await soft7AxiosInstance.patch(path(`/tickets/${encodeURIComponent(ticketId)}/status`), { status }),
  );
}

export interface SupportApiError {
  status: number | null;
  message: string;
}

/** Turns an axios error into the HTTP status plus the server's message. */
export function toSupportError(err: unknown): SupportApiError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;
  const status: number | null = e?.response?.status ?? null;
  const body = e?.response?.data;
  const serverMessage =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    null;

  if (status === null) return { status, message: "You appear to be offline. Check your connection and try again." };
  if (status >= 500) return { status, message: "Support is temporarily unavailable. Please try again." };
  if (status === 401) return { status, message: serverMessage ?? "Your session has ended. Please sign in again." };
  if (status === 403) return { status, message: serverMessage ?? "You don't have permission to do that." };
  if (status === 404) return { status, message: serverMessage ?? "This conversation is no longer available." };
  if (status === 429) return { status, message: serverMessage ?? "Too many requests. Please wait a moment." };
  return { status, message: serverMessage ?? "Something went wrong." };
}
