/** Shape returned by GET /admin/users/stats */
export interface DashboardStats {
  campaigns_count: string;
  chatbot_count: string;
  contacts_count: string;
  contact_lists_count: string;
  sent_count: string;
  failed_count: string;
  delivered_count: string;
  total_count: string;
  received_count: string;
  message_template_count: string;
  unique_contacts_count: string;
  templates_count: string;
  total_messages: number;
}

export type TimeFrame = "7days" | "1month" | "6months" | "1year" | "all";

export const TIME_FRAMES: { value: TimeFrame; label: string; short: string; days: number | null }[] = [
  { value: "7days", label: "Last 7 days", short: "7D", days: 7 },
  { value: "1month", label: "Last month", short: "1M", days: 30 },
  { value: "6months", label: "Last 6 months", short: "6M", days: 182 },
  { value: "1year", label: "Last year", short: "1Y", days: 365 },
  { value: "all", label: "All time", short: "All", days: null },
];

export const timeFrameLabel = (frame: TimeFrame) => TIME_FRAMES.find((t) => t.value === frame)?.label ?? frame;
export const timeFrameDays = (frame: TimeFrame) => TIME_FRAMES.find((t) => t.value === frame)?.days ?? null;

/* ── Normalized resources used by the dashboard ─────────────────────────── */

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  createdAt: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface PhoneNumberSummary {
  id: string;
  displayNumber: string;
  verifiedName: string;
  status: string;
  qualityRating: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  status: string;
  category: string;
  createdAt: string | null;
}

export interface PlanSummary {
  name: string;
  active: boolean;
  endDate: string | null;
}

export interface ChatbotSummary {
  id: string;
  name: string;
  active: boolean;
  published: boolean;
  createdAt: string | null;
}

export interface ContactListSummary {
  id: string;
  name: string;
  imported: number;
  createdAt: string | null;
}

export interface ConversationSummary {
  id: string;
  name: string;
  phone: string;
  phoneNumberId: string;
  unread: number;
  lastMessageAt: string | null;
  lastDirection: "inbound" | "outbound" | null;
}

export interface DashboardStatsResponse {
  success: boolean;
  data?: DashboardStats;
}
