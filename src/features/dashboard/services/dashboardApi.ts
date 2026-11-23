import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type {
  CampaignSummary,
  ChatbotSummary,
  ContactListSummary,
  ConversationSummary,
  DashboardStats,
  PhoneNumberSummary,
  PlanSummary,
  TemplateSummary,
  TimeFrame,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any -- normalizing loosely typed API payloads */

const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const date = (v: unknown) => (v ? String(v) : null);

/** The API wraps lists inconsistently ({data: []}, {data: {items: []}}, …). */
function pickList(raw: any, ...keys: string[]): any[] {
  const candidates = [raw, raw?.data, raw?.data?.data];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    for (const k of keys) if (Array.isArray(c?.[k])) return c[k];
  }
  return [];
}

export async function fetchStats(timeFrame: TimeFrame): Promise<DashboardStats> {
  const { data } = await soft7AxiosInstance.get(`/admin/users/stats?time_frame=${timeFrame}`);
  if (!data?.success || !data?.data) throw new Error("Invalid data format from server");
  return data.data;
}

/** The most recent campaigns (newest first) — enough for summaries and trends. */
export async function fetchCampaigns(): Promise<{ items: CampaignSummary[]; total: number }> {
  const { data } = await soft7AxiosInstance.get("/admin/campaigns", { params: { page: 1, limit: 100 } });
  const items = pickList(data, "campaigns").map(
    (c: any): CampaignSummary => ({
      id: str(c.id),
      name: str(c.name) || "Untitled campaign",
      status: str(c.status).toLowerCase(),
      recipients: num(c.total_recipients),
      sent: num(c.sent_count),
      delivered: num(c.delivered_count),
      read: num(c.read_count),
      failed: num(c.failed_count),
      createdAt: date(c.created_at),
      scheduledAt: date(c.scheduled_at),
      startedAt: date(c.started_at),
      completedAt: date(c.completed_at),
      updatedAt: date(c.updated_at),
    }),
  );
  return { items, total: num(data?.data?.total) || items.length };
}

export async function fetchPhoneNumbers(): Promise<PhoneNumberSummary[]> {
  const { data } = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
  return pickList(data, "phone_numbers", "phoneNumbers").map(
    (p: any): PhoneNumberSummary => ({
      id: str(p.id),
      displayNumber: str(p.display_phone_number || p.phone_number),
      verifiedName: str(p.verified_name),
      status: str(p.status).toLowerCase(),
      qualityRating: str(p.quality_rating || p.meta_data?.quality_rating).toUpperCase(),
    }),
  );
}

export async function fetchTemplates(): Promise<TemplateSummary[]> {
  const { data } = await soft7AxiosInstance.get("/admin/templates");
  return pickList(data, "templates").map(
    (t: any): TemplateSummary => ({
      id: str(t.id),
      name: str(t.name),
      status: str(t.status).toUpperCase(),
      category: str(t.category),
      createdAt: date(t.created_at),
    }),
  );
}

export async function fetchPlan(): Promise<PlanSummary | null> {
  const { data } = await soft7AxiosInstance.get("/admin/users/plan/status");
  const p = data?.data;
  if (!p) return null;
  return { name: str(p.plan_name), active: Boolean(p.active), endDate: date(p.end_date) };
}

export async function fetchChatbots(): Promise<ChatbotSummary[]> {
  const { data } = await soft7AxiosInstance.get("/admin/chatbot");
  return pickList(data, "chatbots").map(
    (b: any): ChatbotSummary => ({
      id: str(b.id),
      name: str(b.name),
      active: Boolean(b.is_active),
      published: Boolean(b.published) || str(b.status).toLowerCase() === "published",
      createdAt: date(b.created_at),
    }),
  );
}

export async function fetchContactLists(): Promise<ContactListSummary[]> {
  const { data } = await soft7AxiosInstance.get("/admin/contacts/lists");
  return pickList(data, "lists").map(
    (l: any): ContactListSummary => ({
      id: str(l.id),
      name: str(l.name),
      imported: num(l.imported_contacts ?? l.total_contacts),
      createdAt: date(l.created_at),
    }),
  );
}

/** Latest conversations per connected number — the same source the Inbox uses. */
export async function fetchConversations(phoneIds: string[]): Promise<ConversationSummary[]> {
  const pages = await Promise.all(
    phoneIds.map((phoneId) =>
      soft7AxiosInstance
        .get(`/admin/contacts/${phoneId}`, {
          params: { page: 1, limit: 100, sortBy: "created_at", sortOrder: "desc" },
        })
        .then(({ data }) =>
          pickList(data, "contacts").map((c: any): ConversationSummary => {
            const direction = str(c.last_message?.direction).toLowerCase();
            return {
              id: str(c.id),
              name: str(c.name) || str(c.phone_number),
              phone: str(c.phone_number),
              phoneNumberId: phoneId,
              unread: num(c.unread_count),
              lastMessageAt: date(c.last_message_at || c.last_message?.created_at),
              lastDirection: direction === "inbound" || direction === "outbound" ? direction : null,
            };
          }),
        )
        .catch(() => [] as ConversationSummary[]),
    ),
  );
  return pages.flat();
}
