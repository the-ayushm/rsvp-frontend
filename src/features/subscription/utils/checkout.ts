/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";

export interface PlanFeature {
  label: string;
  limitValue?: number | null;
  limitType?: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: "MONTHLY" | "YEARLY" | "FREE";
  isPopular: boolean;
  features: PlanFeature[];
}

export const isFreePlan = (plan: SubscriptionPlan) =>
  plan.price === 0 || plan.billingCycle === "FREE";

// Fired on window whenever a plan (paid or free) gets activated.
// PlanCheckWrapper listens for it to unlock the app and show the celebration popup.
export const SUBSCRIPTION_ACTIVATED_EVENT = "subscription:activated";

export interface SubscriptionActivatedDetail {
  planName: string;
}

export function announceSubscriptionActivated(planName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SubscriptionActivatedDetail>(SUBSCRIPTION_ACTIVATED_EVENT, {
      detail: { planName },
    }),
  );
}

function mapApiPlan(apiPlan: any): SubscriptionPlan {
  const rawFeatures = apiPlan?.features ?? {};

  const features: PlanFeature[] = Object.entries(rawFeatures).map(
    ([key, value]: [string, any]) => {
      const rawLimit = value?.limit_value;

      let limitValue: number | null = null;

      if (
        typeof rawLimit === "number" ||
        (typeof rawLimit === "string" &&
          rawLimit.trim() !== "" &&
          !Number.isNaN(Number(rawLimit)))
      ) {
        limitValue = Number(rawLimit);
      } else if (String(rawLimit).toLowerCase() === "unlimited") {
        limitValue = -1;
      }

      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char: string) => char.toUpperCase());

      return {
        label,
        limitValue,
        limitType: value?.limit_type ?? "count",
      };
    },
  );

  const billingCycle = String(apiPlan?.billing_cycle ?? "Free").toUpperCase();

  return {
    id: String(apiPlan.id),
    name: apiPlan?.plan_name ?? "Unnamed Plan",
    description: apiPlan?.description ?? "",
    price: Number(apiPlan?.price ?? 0),
    billingCycle:
      billingCycle === "YEARLY"
        ? "YEARLY"
        : billingCycle === "MONTHLY"
          ? "MONTHLY"
          : "FREE",
    isPopular: false,
    features,
  };
}

// GET /admin/subscription/plan?active=true
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response: any = await soft7AxiosInstance.get(
    "/admin/subscription/plan?active=true",
  );

  // Works with both a normal AxiosResponse and an interceptor
  // that returns response.data directly.
  const payload = response?.data ?? response;

  if (payload?.success === false) {
    throw new Error(payload?.message || "Failed to fetch subscription plans");
  }

  const apiPlans = payload?.data?.data ?? payload?.data ?? [];

  if (!Array.isArray(apiPlans)) {
    console.warn("Subscription plans API returned an unexpected response:", payload);
    return [];
  }

  return apiPlans
    .filter((apiPlan: any) => apiPlan && apiPlan.active !== false)
    .map(mapApiPlan);
}

export async function activateFreePlan(plan: SubscriptionPlan) {
  await soft7AxiosInstance.post(
    `/admin/subscription/${plan.id}/activate-free-trial`,
    { planId: plan.id },
  );
}

function readStoredUser(): { id?: string; _id?: string } {
  try {
    const raw = localStorage.getItem("user") ?? localStorage.getItem("user_data");
    return raw ? JSON.parse(raw) ?? {} : {};
  } catch {
    return {};
  }
}

export function apiErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    (typeof error?.response?.data?.error === "string" ? error.response.data.error : null) ||
    error?.message ||
    fallback
  );
}

// ── Razorpay Payment Link purchases ─────────────────────────────────────────
// The API creates a fixed-price Razorpay-hosted link for the plan; activation
// happens server-side once the payment is verified. No checkout SDK or merchant
// keys are needed in the browser.

export interface PlanPurchase {
  id: string;
  amount_paise: number;
  currency: string;
  is_test: boolean;
  status: string; // creating | creation_unknown | pending | paid | ...
  payment_url: string | null;
  link_status: string | null; // created | partially_paid | paid | expired | cancelled
  activation_status: string | null; // awaiting_payment | activation_pending | active | test_only
  fulfillment_error: string | null;
  fulfilled_at: string | null;
  expires_at: string | null;
}

export type PurchaseState =
  | "preparing"
  | "awaiting_payment"
  | "partially_paid"
  | "unavailable"
  | "activated"
  | "activation_pending"
  | "test_only";

export function getPurchaseState(p: PlanPurchase): PurchaseState {
  if (p.activation_status === "test_only") return "test_only";
  if (p.status === "paid") {
    return p.activation_status === "active" && p.fulfilled_at ? "activated" : "activation_pending";
  }
  if (p.link_status === "expired" || p.link_status === "cancelled") return "unavailable";
  if (p.link_status === "partially_paid") return "partially_paid";
  if (p.status === "creating" || p.status === "creation_unknown" || !p.payment_url) return "preparing";
  return "awaiting_payment";
}

/** States after which polling stops. */
export const isTerminalPurchaseState = (state: PurchaseState) =>
  state === "activated" || state === "unavailable" || state === "test_only";

function toPurchase(response: any): PlanPurchase {
  const body = response?.data ?? response;
  if (body?.success === false) {
    throw new Error(body?.error?.message || body?.message || "Unable to load purchase");
  }
  const d = body?.data ?? body;
  return {
    id: String(d.id),
    amount_paise: Number(d.amount_paise ?? 0),
    currency: d.currency ?? "INR",
    is_test: d.is_test === true,
    status: d.status ?? "pending",
    payment_url: d.payment_url ?? d.checkout?.payment_url ?? null,
    link_status: d.link_status ?? null,
    activation_status: d.activation_status ?? null,
    fulfillment_error: d.fulfillment_error ?? null,
    fulfilled_at: d.fulfilled_at ?? null,
    expires_at: d.checkout?.expires_at ?? d.expires_at ?? null,
  };
}

// ── What can be bought through a payment link ──────────────────────────────
// Plans and add-ons share the same Razorpay Payment Link flow; only the
// request body and the local storage namespace differ.
export type PurchaseKind = "plan" | "addon";

export interface PurchasableItem {
  id: string;
  name: string;
  price: number;
  /** MONTHLY | YEARLY | FREE for plans, ONE_TIME | MONTHLY | YEARLY for add-ons */
  billingCycle: string;
  kind?: PurchaseKind;
  /** add-on only: number of packs */
  quantity?: number;
  /** add-on only: the user_plan the packs are applied to */
  userPlanId?: string | null;
}

/** Local-storage id for resuming a purchase; add-on links are per pack count. */
export const purchaseStorageId = (item: PurchasableItem) =>
  item.kind === "addon" && item.quantity ? `${item.id}:${item.quantity}` : item.id;

export const billingCycleLabel = (cycle: string) => {
  const c = cycle.toUpperCase();
  if (c === "ONE_TIME") return "one-time";
  if (c === "MONTHLY") return "month";
  if (c === "YEARLY") return "year";
  return cycle.toLowerCase();
};

// The Idempotency-Key and purchase ID are persisted per account + item so that
// retries and page reloads resume the same purchase instead of creating a new one.
interface SavedPurchase {
  key: string;
  purchaseId: string | null;
}

const savedPurchaseKey = (itemId: string, kind: PurchaseKind = "plan") => {
  const user = readStoredUser();
  return `${kind}_purchase:${user.id ?? user._id ?? "anon"}:${itemId}`;
};

export function getSavedPurchase(itemId: string, kind: PurchaseKind = "plan"): SavedPurchase | null {
  try {
    const raw = localStorage.getItem(savedPurchaseKey(itemId, kind));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePurchase(itemId: string, kind: PurchaseKind, value: SavedPurchase) {
  localStorage.setItem(savedPurchaseKey(itemId, kind), JSON.stringify(value));
}

export function clearSavedPurchase(itemId: string, kind: PurchaseKind = "plan") {
  localStorage.removeItem(savedPurchaseKey(itemId, kind));
}

/**
 * Creates (or, with the same saved key, safely re-requests) a payment link for a plan or add-on.
 * Pass `fresh: true` only for a deliberate new purchase after the previous link expired/was cancelled.
 */
export async function createPlanPaymentLink(
  item: PurchasableItem,
  options: { fresh?: boolean; customerPhone?: string } = {},
): Promise<PlanPurchase> {
  const kind = item.kind ?? "plan";
  const storageId = purchaseStorageId(item);
  const saved = options.fresh ? null : getSavedPurchase(storageId, kind);
  const key = saved?.key ?? crypto.randomUUID();
  savePurchase(storageId, kind, { key, purchaseId: saved?.purchaseId ?? null });

  const response = await soft7AxiosInstance.post(
    "/admin/payments/payment-links",
    {
      mode: "live",
      ...(kind === "addon"
        ? {
            purchase_type: "addon",
            addon_id: item.id,
            quantity: item.quantity ?? 1,
            ...(item.userPlanId ? { user_plan_id: item.userPlanId } : {}),
          }
        : { subscription_plan_id: item.id }),
      ...(options.customerPhone ? { customer_phone: options.customerPhone } : {}),
    },
    { headers: { "Idempotency-Key": key } },
  );
  const purchase = toPurchase(response);
  savePurchase(storageId, kind, { key, purchaseId: purchase.id });
  return purchase;
}

/** Reads saved purchase state (does not call Razorpay). */
export async function getPlanPurchase(purchaseId: string): Promise<PlanPurchase> {
  return toPurchase(await soft7AxiosInstance.get(`/admin/payments/orders/${purchaseId}`));
}

/** Asks the backend to verify the purchase with Razorpay. */
export async function verifyPlanPurchase(purchaseId: string): Promise<PlanPurchase> {
  return toPurchase(await soft7AxiosInstance.post(`/admin/payments/orders/${purchaseId}/verify`));
}
