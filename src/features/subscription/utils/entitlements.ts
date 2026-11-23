/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type { PlanEntitlement, PlanSummary } from "./planEntitlements";

/**
 * GET /admin/subscription/entitlements — the source of truth for the current
 * user_plan_id (needed to buy add-ons) and for effective limits after add-ons.
 *
 * features[key] = { base_limit, addon_limit, effective_limit, used, remaining }
 */
export interface FeatureAllowance {
  baseLimit: number | null;
  addonLimit: number;
  effectiveLimit: number | null;
  used: number;
  remaining: number | null;
}

export interface Entitlements {
  userPlanId: string | null;
  features: Record<string, FeatureAllowance>;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function fetchEntitlements(): Promise<Entitlements> {
  const response: any = await soft7AxiosInstance.get("/admin/subscription/entitlements");
  const body = response?.data ?? response;
  if (body?.success === false) throw new Error(body?.message || "Failed to load plan allowances");
  const d = body?.data?.data ?? body?.data ?? body ?? {};

  const rawId = d.user_plan_id ?? d.userPlanId ?? d.user_plan?.id ?? null;
  const rawFeatures = d.features && typeof d.features === "object" ? d.features : {};
  const features: Record<string, FeatureAllowance> = {};
  for (const [key, f] of Object.entries<any>(rawFeatures)) {
    if (!f || typeof f !== "object") continue;
    const baseLimit = num(f.base_limit);
    const addonLimit = num(f.addon_limit) ?? 0;
    const effectiveLimit = num(f.effective_limit) ?? (baseLimit === null ? null : baseLimit + addonLimit);
    const used = num(f.used) ?? 0;
    features[key] = {
      baseLimit,
      addonLimit,
      effectiveLimit,
      used,
      remaining: num(f.remaining) ?? (effectiveLimit === null ? null : Math.max(effectiveLimit - used, 0)),
    };
  }
  return { userPlanId: rawId != null ? String(rawId) : null, features };
}

/** Overlays entitlement numbers onto plan-status quotas so add-on allowance shows up immediately. */
export function applyEntitlements(summary: PlanSummary, ent: Entitlements | null): PlanSummary {
  if (!ent) return summary;
  const quotas = summary.quotas.map((q): PlanEntitlement => {
    const f = ent.features[q.key];
    if (!f || f.effectiveLimit === null || f.effectiveLimit < 0) return q;
    const total = f.effectiveLimit;
    return {
      ...q,
      used: f.used,
      baseLimit: f.baseLimit ?? q.baseLimit,
      addonLimit: f.addonLimit,
      totalLimit: total,
      remaining: f.remaining,
      percent: total ? Math.min((f.used / total) * 100, 100) : 0,
      overLimit: f.used > total,
    };
  });
  return { ...summary, quotas, userPlanId: ent.userPlanId ?? summary.userPlanId };
}

// Fired after an add-on activates. The plan name/ID stay the same, so listeners
// must refetch allowances instead of waiting for a subscription change.
export const ENTITLEMENTS_UPDATED_EVENT = "subscription:entitlements-updated";

export function announceEntitlementsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENTITLEMENTS_UPDATED_EVENT));
}
