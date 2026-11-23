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
import { timeFrameDays } from "../types";

const num = (v: unknown) => Number(v) || 0;
const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0);
const DAY = 24 * 60 * 60 * 1000;
const ts = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

/* ── Message metrics ─────────────────────────────────────────────────────── */

export interface DashboardMetrics {
  totalMessages: number;
  statusTotal: number;
  sent: number;
  delivered: number;
  failed: number;
  received: number;
  contacts: number;
  uniqueContacts: number;
  contactLists: number;
  campaigns: number;
  deliveryRate: number;
  failureRate: number;
  replyRate: number;
  inTransitRate: number;
}

/**
 * Derived dashboard numbers. Rates use `total_count` (the API's status-count
 * denominator) — sent_count is only the "still in transit" status subset.
 */
export function deriveMetrics(stats: DashboardStats): DashboardMetrics {
  const statusTotal = num(stats.total_count);
  const sent = num(stats.sent_count);
  const delivered = num(stats.delivered_count);
  const failed = num(stats.failed_count);
  const received = num(stats.received_count);

  return {
    totalMessages: num(stats.total_messages),
    statusTotal,
    sent,
    delivered,
    failed,
    received,
    contacts: num(stats.contacts_count),
    uniqueContacts: num(stats.unique_contacts_count),
    contactLists: num(stats.contact_lists_count),
    campaigns: num(stats.campaigns_count),
    deliveryRate: pct(delivered, statusTotal),
    failureRate: pct(failed, statusTotal),
    replyRate: pct(received, statusTotal),
    inTransitRate: pct(sent, statusTotal),
  };
}

/* ── Trends ──────────────────────────────────────────────────────────────────
   The stats API only returns totals for a window. To compare against the
   previous period we load the next-longer window and take the part that
   precedes the current one, then compare per-day averages
   (e.g. last 7 days vs. the 23 days before). */

const COMPARISON: Partial<Record<TimeFrame, TimeFrame>> = {
  "7days": "1month",
  "1month": "6months",
  "6months": "1year",
};

export const comparisonFrame = (frame: TimeFrame): TimeFrame | null => COMPARISON[frame] ?? null;

export interface Trend {
  /** Change, in % for counts or percentage points for rates */
  delta: number;
  unit: "%" | "pts";
  /** true when the change is good news (more delivered, fewer failures…) */
  positive: boolean;
  label: string;
}

function periodLabel(days: number) {
  if (days >= 60) return `previous ${Math.round(days / 30.4)} months`;
  return `previous ${days} days`;
}

export function computeTrends(frame: TimeFrame, current: DashboardMetrics, longer: DashboardMetrics | null) {
  const compare = comparisonFrame(frame);
  const curDays = timeFrameDays(frame);
  const longDays = compare ? timeFrameDays(compare) : null;
  if (!longer || !curDays || !longDays) return null;
  const restDays = longDays - curDays;
  const label = `vs ${periodLabel(restDays)}`;

  const countTrend = (cur: number, long: number, higherIsBetter = true): Trend | null => {
    const rest = long - cur;
    if (rest <= 0) return null;
    const before = rest / restDays;
    const now = cur / curDays;
    const delta = Math.round(((now - before) / before) * 1000) / 10;
    if (!Number.isFinite(delta)) return null;
    return { delta, unit: "%", positive: higherIsBetter ? delta >= 0 : delta <= 0, label };
  };
  const rateTrend = (curRate: number, part: number, whole: number, higherIsBetter = true): Trend | null => {
    if (whole <= 0) return null;
    const delta = Math.round((curRate - (part / whole) * 100) * 10) / 10;
    return { delta, unit: "pts", positive: higherIsBetter ? delta >= 0 : delta <= 0, label };
  };
  const restTotal = longer.statusTotal - current.statusTotal;

  return {
    messages: countTrend(current.totalMessages, longer.totalMessages),
    deliveryRate: rateTrend(current.deliveryRate, longer.delivered - current.delivered, restTotal),
    received: countTrend(current.received, longer.received),
    failureRate: rateTrend(current.failureRate, longer.failed - current.failed, restTotal, false),
    reached: countTrend(current.uniqueContacts, longer.uniqueContacts),
  };
}

export type Trends = NonNullable<ReturnType<typeof computeTrends>>;

/* ── Conversations ─────────────────────────────────────────────────────── */

export interface ConversationHealth {
  total: number;
  unread: number;
  unreadMessages: number;
  awaitingReply: number;
  /** Customers who wrote last and have waited more than an hour */
  waitingLong: number;
  activeToday: number;
}

export function conversationHealth(list: ConversationSummary[], now = Date.now()): ConversationHealth {
  let unread = 0;
  let unreadMessages = 0;
  let awaitingReply = 0;
  let waitingLong = 0;
  let activeToday = 0;
  for (const c of list) {
    if (c.unread > 0) {
      unread++;
      unreadMessages += c.unread;
    }
    const last = ts(c.lastMessageAt);
    if (last && now - last < DAY) activeToday++;
    if (c.lastDirection === "inbound") {
      awaitingReply++;
      if (last && now - last > 60 * 60 * 1000) waitingLong++;
    }
  }
  return { total: list.length, unread, unreadMessages, awaitingReply, waitingLong, activeToday };
}

/** Chats that need a human next: unread or customer wrote last, newest first. */
export function conversationQueue(list: ConversationSummary[], limit = 4): ConversationSummary[] {
  return list
    .filter((c) => c.unread > 0 || c.lastDirection === "inbound")
    .sort((a, b) => ts(b.lastMessageAt) - ts(a.lastMessageAt))
    .slice(0, limit);
}

/* ── Campaigns ─────────────────────────────────────────────────────────── */

const RUNNING = new Set(["running", "processing", "in_progress", "sending", "active", "started"]);
const SCHEDULED = new Set(["scheduled", "pending", "queued"]);

export const isRunning = (c: CampaignSummary) => RUNNING.has(c.status);
export const isScheduled = (c: CampaignSummary, now = Date.now()) =>
  SCHEDULED.has(c.status) || (c.status !== "completed" && ts(c.scheduledAt) > now);

export interface CampaignPerformance {
  inPeriod: number;
  running: number;
  scheduled: number;
  completed: number;
  failed: number;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failedMessages: number;
  deliveryRate: number;
  readRate: number;
  recent: CampaignSummary[];
}

export function campaignPerformance(items: CampaignSummary[], frame: TimeFrame, now = Date.now()): CampaignPerformance {
  const days = timeFrameDays(frame);
  const from = days ? now - days * DAY : 0;
  const inWindow = items.filter((c) => ts(c.createdAt) >= from);
  const sum = (key: "recipients" | "sent" | "delivered" | "read" | "failed") =>
    inWindow.reduce((acc, c) => acc + c[key], 0);
  const attempted = sum("sent") + sum("failed");
  return {
    inPeriod: inWindow.length,
    running: items.filter(isRunning).length,
    scheduled: items.filter((c) => isScheduled(c, now)).length,
    completed: inWindow.filter((c) => c.status === "completed").length,
    failed: inWindow.filter((c) => c.status === "failed").length,
    recipients: sum("recipients"),
    sent: sum("sent"),
    delivered: sum("delivered"),
    read: sum("read"),
    failedMessages: sum("failed"),
    deliveryRate: pct(sum("delivered"), attempted),
    readRate: pct(sum("read"), sum("delivered")),
    recent: [...items].sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 5),
  };
}

/** Per-campaign delivery: delivered of everything attempted */
export const campaignDeliveryRate = (c: CampaignSummary) => pct(c.delivered, c.sent + c.failed);

/* ── Contacts ──────────────────────────────────────────────────────────── */

export function importedInWindow(lists: ContactListSummary[], frame: TimeFrame, now = Date.now()) {
  const days = timeFrameDays(frame);
  const from = days ? now - days * DAY : 0;
  const inWindow = lists.filter((l) => ts(l.createdAt) >= from);
  return { lists: inWindow.length, contacts: inWindow.reduce((a, l) => a + l.imported, 0) };
}

/* ── Action items ──────────────────────────────────────────────────────── */

export interface ActionItem {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  cta: string;
}

interface AlertInput {
  metrics: DashboardMetrics | null;
  frameLabel: string;
  phoneNumbers?: PhoneNumberSummary[];
  templates?: TemplateSummary[];
  campaigns?: CampaignSummary[];
  plan?: PlanSummary | null;
  conversations?: ConversationHealth | null;
  now?: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const CONNECTED = new Set(["active", "connected", "verified", "approved", ""]);

export function actionItems({
  metrics,
  frameLabel,
  phoneNumbers = [],
  templates = [],
  campaigns = [],
  plan,
  conversations,
  now = Date.now(),
}: AlertInput): ActionItem[] {
  const items: ActionItem[] = [];

  for (const p of phoneNumbers) {
    if (!CONNECTED.has(p.status)) {
      items.push({
        id: `phone-status-${p.id}`,
        severity: "error",
        title: `${p.displayNumber} is ${p.status}`,
        description: "Messages can't be sent from this number until it is reconnected.",
        href: "/user/integrations/whatsapp",
        cta: "Review number",
      });
    } else if (p.qualityRating === "RED" || p.qualityRating === "YELLOW") {
      items.push({
        id: `phone-quality-${p.id}`,
        severity: p.qualityRating === "RED" ? "error" : "warning",
        title: `${p.displayNumber} quality is ${p.qualityRating.toLowerCase()}`,
        description: "Meta may limit messaging. Review recent templates and opt-out rates.",
        href: "/user/manage/templates",
        cta: "Review templates",
      });
    }
  }

  if (metrics && metrics.statusTotal >= 20 && metrics.failureRate >= 20) {
    items.push({
      id: "failure-rate",
      severity: metrics.failureRate >= 50 ? "error" : "warning",
      title: `${metrics.failureRate}% of messages failed`,
      description: `${plural(metrics.failed, "message")} failed to deliver — ${frameLabel.toLowerCase()}.`,
      href: "/user/campaigns",
      cta: "Check campaigns",
    });
  }

  const recentFailed = campaigns.filter((c) => c.status === "failed" && now - ts(c.updatedAt || c.createdAt) < 7 * DAY);
  if (recentFailed.length) {
    items.push({
      id: "campaigns-failed",
      severity: "error",
      title: `${plural(recentFailed.length, "campaign")} failed this week`,
      description: recentFailed
        .slice(0, 2)
        .map((c) => `“${c.name}”`)
        .join(", "),
      href: "/user/campaigns",
      cta: "View campaigns",
    });
  }

  const rejected = templates.filter((t) => t.status === "REJECTED");
  const paused = templates.filter((t) => t.status === "PAUSED" || t.status === "DISABLED");
  if (rejected.length) {
    items.push({
      id: "templates-rejected",
      severity: "warning",
      title: `${plural(rejected.length, "template")} rejected by Meta`,
      description: "Rejected templates can't be used in campaigns.",
      href: "/user/manage/templates",
      cta: "Fix templates",
    });
  }
  if (paused.length) {
    items.push({
      id: "templates-paused",
      severity: "warning",
      title: `${plural(paused.length, "template")} paused or disabled`,
      description: "Meta paused these templates because of low quality signals.",
      href: "/user/manage/templates",
      cta: "Review",
    });
  }

  if (plan) {
    const daysLeft = plan.endDate ? Math.ceil((ts(plan.endDate) - now) / DAY) : null;
    if (!plan.active) {
      items.push({
        id: "plan-inactive",
        severity: "error",
        title: "Your plan is inactive",
        description: "Renew to keep sending campaigns and automations.",
        href: "/user/subscription",
        cta: "Renew plan",
      });
    } else if (daysLeft !== null && daysLeft <= 14) {
      items.push({
        id: "plan-expiring",
        severity: "warning",
        title: daysLeft <= 0 ? "Your plan has expired" : `${plan.name || "Plan"} renews in ${plural(daysLeft, "day")}`,
        description: "Renew early to avoid interrupting messaging.",
        href: "/user/subscription",
        cta: "Manage plan",
      });
    }
  }

  if (conversations && conversations.waitingLong > 0) {
    items.push({
      id: "conversations-waiting",
      severity: "info",
      title: `${plural(conversations.waitingLong, "customer")} waiting over an hour`,
      description: "Reply inside the 24-hour window to keep the conversation free-form.",
      href: "/user/inbox",
      cta: "Open inbox",
    });
  }

  const rank = { error: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* ── Activity feed ─────────────────────────────────────────────────────── */

export interface ActivityEvent {
  id: string;
  kind: "campaign" | "campaign-failed" | "campaign-scheduled" | "contacts" | "template" | "message" | "chatbot";
  title: string;
  detail?: string;
  at: number;
  href?: string;
}

interface ActivityInput {
  campaigns?: CampaignSummary[];
  contactLists?: ContactListSummary[];
  templates?: TemplateSummary[];
  conversations?: ConversationSummary[];
  chatbots?: ChatbotSummary[];
  now?: number;
}

export function recentActivity({
  campaigns = [],
  contactLists = [],
  templates = [],
  conversations = [],
  chatbots = [],
  now = Date.now(),
}: ActivityInput, limit = 7): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const c of campaigns.slice(0, 30)) {
    if (c.status === "failed") {
      events.push({ id: `c-${c.id}`, kind: "campaign-failed", title: `Campaign “${c.name}” failed`, at: ts(c.updatedAt || c.createdAt), href: `/user/campaigns/${c.id}/stats` });
    } else if (c.status === "completed" && c.completedAt) {
      events.push({
        id: `c-${c.id}`,
        kind: "campaign",
        title: `Campaign “${c.name}” completed`,
        detail: `${c.sent.toLocaleString()} sent · ${c.failed.toLocaleString()} failed`,
        at: ts(c.completedAt),
        href: `/user/campaigns/${c.id}/stats`,
      });
    } else if (isScheduled(c, now)) {
      events.push({ id: `c-${c.id}`, kind: "campaign-scheduled", title: `Campaign “${c.name}” scheduled`, detail: c.scheduledAt ? `Sends ${new Date(c.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : undefined, at: ts(c.createdAt), href: "/user/campaigns" });
    } else if (c.createdAt) {
      events.push({ id: `c-${c.id}`, kind: "campaign", title: `Campaign “${c.name}” ${isRunning(c) ? "started" : "created"}`, at: ts(c.startedAt || c.createdAt), href: "/user/campaigns" });
    }
  }
  for (const l of contactLists.slice(0, 20)) {
    events.push({ id: `l-${l.id}`, kind: "contacts", title: `${l.imported.toLocaleString()} contacts imported`, detail: `List “${l.name}”`, at: ts(l.createdAt), href: "/user/contacts/lists" });
  }
  for (const t of templates) {
    events.push({ id: `t-${t.id}`, kind: "template", title: `Template “${t.name}” added`, detail: t.status ? t.status.charAt(0) + t.status.slice(1).toLowerCase() : undefined, at: ts(t.createdAt), href: "/user/manage/templates" });
  }
  for (const c of conversations) {
    if (c.lastDirection === "inbound") {
      events.push({ id: `m-${c.phoneNumberId}-${c.id}`, kind: "message", title: `New message from ${c.name}`, detail: c.unread ? `${c.unread} unread` : undefined, at: ts(c.lastMessageAt), href: "/user/inbox" });
    }
  }
  for (const b of chatbots) {
    events.push({ id: `b-${b.id}`, kind: "chatbot", title: `Chatbot “${b.name}” created`, at: ts(b.createdAt), href: "/user/chatbot" });
  }

  return events
    .filter((e) => e.at > 0 && e.at <= now + 60_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

/* ── Formatting ────────────────────────────────────────────────────────── */

export const formatNumber = (n: number) => n.toLocaleString();

/** Compact number for KPI tiles: 12,345 → 12.3K */
export const formatCompact = (n: number) =>
  n >= 10_000 ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n) : n.toLocaleString();

export function relativeTime(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString([], { day: "numeric", month: "short" });
}
