/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shared parsing for GET /admin/users/plan/status so the Subscription panel
 * and the Billing page show the same numbers.
 *
 * Effective quota = limits[key].limit + limits[key].addon_limit.
 * limit === null means the feature is included without a cap.
 */

export interface PlanEntitlement {
  key: string;
  label: string;
  enabled: boolean;
  used: number;
  baseLimit: number | null;
  addonLimit: number;
  /** base + add-on; null when uncapped */
  totalLimit: number | null;
  unlimited: boolean;
  remaining: number | null;
  percent: number;
  overLimit: boolean;
  resetPeriod: string;
  nextReset: Date | null;
}

export interface PlanAddon {
  /** entitlement key it boosts (e.g. "Contact"), when known */
  key: string | null;
  label: string;
  /** short badge text: "+500" or "Active" */
  value: string;
  quantity: number | null;
  /** plain-language explanation of what the add-on gives */
  description: string;
  status: string | null;
  purchasedAt: Date | null;
  expiresAt: Date | null;
}

export interface PlanSummary {
  active: boolean;
  planName: string;
  price: number;
  billingCycle: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  extensionDays: number;
  daysRemaining: number | null;
  /** 0–100, how much of the plan period has elapsed */
  periodElapsedPercent: number;
  subscriptionId: string | null;
  paymentMethod: string | null;
  paymentId: string | null;
  /** metered quotas (numeric limit) */
  quotas: PlanEntitlement[];
  /** uncapped features (limit null) */
  features: PlanEntitlement[];
  /** add-on boosts currently applied to this plan */
  addons: PlanAddon[];
  /** catalog add-on ids this plan allows buying (from plan.addons selections) */
  offeredAddonIds: string[];
  /** user_plan id, needed when purchasing add-ons */
  userPlanId: string | null;
  /** subscription_plan id of the active plan */
  planId: string | null;
}

const LABELS: Record<string, string> = {
  Chatbot: "Chatbots",
  Contact: "Contacts",
  Campaign: "Campaigns",
  TeamInvite: "Team Members",
  WabaNumber: "WhatsApp Numbers",
  AiAssistant: "AI Assistant",
  developer_api: "Developer API",
};

/** Unit + one-line pitch per entitlement, used to explain add-ons in plain words. */
const ENTITLEMENT_INFO: Record<string, { unit: string; blurb: string }> = {
  Contact: { unit: "contacts", blurb: "Store and message more customers." },
  Campaign: { unit: "campaigns", blurb: "Run more broadcast campaigns." },
  Chatbot: { unit: "chatbots", blurb: "Build more automated chatbot flows." },
  TeamInvite: { unit: "team seats", blurb: "Invite more teammates to your workspace." },
  WabaNumber: { unit: "WhatsApp numbers", blurb: "Connect more WhatsApp Business numbers." },
  AiAssistant: { unit: "AI replies", blurb: "Get more AI-assisted replies." },
  developer_api: { unit: "API calls", blurb: "Connect your own systems through the developer API." },
};

export function entitlementUnit(key: string | null): string {
  if (!key) return "units";
  return ENTITLEMENT_INFO[key]?.unit ?? entitlementLabel(key).toLowerCase();
}

export function describeEntitlementBoost(key: string | null, quantity: number | null): string {
  if (quantity !== null && quantity > 0) {
    return `Adds ${quantity.toLocaleString("en-IN")} extra ${entitlementUnit(key)} on top of your plan limit.`;
  }
  return (key && ENTITLEMENT_INFO[key]?.blurb) || "Extra capacity on top of your current plan.";
}

export function entitlementLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function computeNextReset(periodStart: Date | null, resetPeriod: string): Date | null {
  if (!periodStart) return null;
  const next = new Date(periodStart);
  switch (resetPeriod) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return next;
}

function makeAddon(
  key: string | null,
  label: string,
  quantity: number | null,
  extra: Partial<PlanAddon> = {},
): PlanAddon {
  return {
    key,
    label,
    quantity,
    value: quantity !== null ? `+${quantity.toLocaleString("en-IN")}` : "Active",
    description: extra.description || describeEntitlementBoost(key, quantity),
    status: extra.status ?? null,
    purchasedAt: extra.purchasedAt ?? null,
    expiresAt: extra.expiresAt ?? null,
  };
}

/**
 * `plan.addons` on the plan-status response is the plan's add-on *selection*
 * list — [{ addon_id, enabled }] — i.e. which catalog packs this plan offers.
 * Purchased units are reported separately through limits[key].addon_limit.
 * Records that do carry their own details (feature_key / units / name) are
 * treated as purchases.
 */
function parseAddonField(raw: any): { offeredIds: string[]; purchased: PlanAddon[] } {
  const offeredIds: string[] = [];
  const purchased: PlanAddon[] = [];
  if (!Array.isArray(raw)) return { offeredIds, purchased };

  for (const a of raw) {
    if (a === null || a === undefined) continue;
    if (typeof a !== "object") {
      offeredIds.push(String(a));
      continue;
    }
    const featureKey = a.feature_key ?? a.entitlement_key ?? null;
    const qty = toNumOrNull(a.units ?? a.quantity ?? a.addon_limit);
    const name = a.name ?? a.addon_name ?? null;
    const id = a.addon_id ?? a.id;

    if (!featureKey && qty === null && !name) {
      if (id != null && a.enabled !== false) offeredIds.push(String(id));
      continue;
    }
    purchased.push(
      makeAddon(featureKey, name ?? (featureKey ? `Extra ${entitlementLabel(featureKey)}` : "Add-on"), qty, {
        status: a.status ?? null,
        purchasedAt: toDate(a.created_at ?? a.purchased_at),
        expiresAt: toDate(a.expires_at ?? a.end_date),
      }),
    );
  }
  return { offeredIds, purchased };
}

export function parsePlanStatus(plan: any): PlanSummary | null {
  if (!plan || typeof plan !== "object" || !plan.plan_name) return null;

  const limits: Record<string, any> = plan.limits && typeof plan.limits === "object" ? plan.limits : {};
  const usage: Record<string, any> = plan.usage && typeof plan.usage === "object" ? plan.usage : {};
  const usagePeriods: Record<string, any> = plan.usage_periods && typeof plan.usage_periods === "object" ? plan.usage_periods : {};
  const startDate = toDate(plan.start_date);
  const endDate = toDate(plan.end_date);

  const keys = Array.from(new Set([...Object.keys(limits), ...Object.keys(usage)]));
  const quotas: PlanEntitlement[] = [];
  const features: PlanEntitlement[] = [];
  const addonFromLimits: PlanAddon[] = [];

  for (const key of keys) {
    const cfg = limits[key] ?? {};
    const used = Number(usage[key]) || 0;
    const baseLimit = toNumOrNull(cfg.limit);
    const addonLimit = toNumOrNull(cfg.addon_limit) ?? 0;
    const unlimited = baseLimit === null || baseLimit < 0;
    const totalLimit = unlimited ? null : baseLimit + addonLimit;
    const resetPeriod = String(cfg.reset_period ?? "never");
    const periodStart = toDate(usagePeriods[key]) ?? startDate;

    const entry: PlanEntitlement = {
      key,
      label: entitlementLabel(key),
      enabled: cfg.enabled !== false,
      used,
      baseLimit: unlimited ? null : baseLimit,
      addonLimit,
      totalLimit,
      unlimited,
      remaining: totalLimit === null ? null : Math.max(totalLimit - used, 0),
      percent: totalLimit ? Math.min((used / totalLimit) * 100, 100) : 0,
      overLimit: totalLimit !== null && used > totalLimit,
      resetPeriod,
      nextReset: computeNextReset(periodStart, resetPeriod),
    };

    (unlimited ? features : quotas).push(entry);
    if (!unlimited && addonLimit > 0) {
      addonFromLimits.push(
        makeAddon(key, `Extra ${entry.label}`, addonLimit, {
          status: "active",
          expiresAt: endDate,
          description: `+${addonLimit.toLocaleString("en-IN")} ${entitlementUnit(key)} on top of your plan's ${baseLimit.toLocaleString("en-IN")} — total limit ${(totalLimit ?? 0).toLocaleString("en-IN")}.`,
        }),
      );
    }
  }

  const now = Date.now();
  const daysRemaining = endDate ? Math.max(Math.ceil((endDate.getTime() - now) / 86_400_000), 0) : null;
  const totalSpan = startDate && endDate ? endDate.getTime() - startDate.getTime() : 0;
  const periodElapsedPercent =
    totalSpan > 0 && startDate
      ? Math.min(Math.max(((now - startDate.getTime()) / totalSpan) * 100, 0), 100)
      : 0;

  const addonField = parseAddonField(plan.addons);

  return {
    active: plan.active === true,
    planName: plan.plan_name,
    price: Number(plan.price ?? 0),
    billingCycle: plan.billing_cycle ?? "—",
    status: plan.status ?? "",
    startDate,
    endDate,
    durationDays: toNumOrNull(plan.duration_days),
    extensionDays: Number(plan.extension_days) || 0,
    daysRemaining,
    periodElapsedPercent,
    subscriptionId: plan.subscription_id ?? plan.id ?? null,
    paymentMethod: plan.payment_method ?? null,
    paymentId: plan.razorpaymentId ?? null,
    quotas,
    features,
    // limits[].addon_limit is the source of truth for what's applied; fall back to
    // detailed purchase records only when limits carry no add-on info.
    addons: addonFromLimits.length > 0 ? addonFromLimits : addonField.purchased,
    offeredAddonIds: addonField.offeredIds,
    userPlanId: plan.user_plan_id != null ? String(plan.user_plan_id) : (plan.subscription_id ?? plan.id ?? null),
    planId: plan.plan_id ?? plan.subscription_plan_id ?? null,
  };
}

export const formatPlanDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
