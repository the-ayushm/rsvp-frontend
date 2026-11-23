/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type { PurchasableItem } from "./checkout";
import { entitlementLabel, entitlementUnit } from "./planEntitlements";

/**
 * Add-on packs from GET /admin/subscription/addons (same API the admin console uses).
 * Row shape: { id, name, feature_key, feature_label?, units, price_paise,
 *              total_price_paise?, active, enabled? }
 * total_price_paise = platform fee + company markup → the customer-facing price.
 */
export interface AddonOffer {
  id: string;
  name: string;
  featureKey: string;
  featureLabel: string;
  /** units added per pack, e.g. 500 contacts */
  units: number;
  /** customer price per pack, in paise */
  pricePaise: number;
  active: boolean;
}

const toInt = (v: unknown): number => {
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return Number.isSafeInteger(n) ? Number(n) : NaN;
};

function mapAddon(a: any): AddonOffer | null {
  const units = toInt(a?.units);
  const price = toInt(a?.total_price_paise ?? a?.price_paise);
  if (!a?.id || typeof a.feature_key !== "string" || !(units > 0) || !(price >= 0)) return null;
  return {
    id: String(a.id),
    name: String(a.name ?? `Extra ${entitlementLabel(a.feature_key)}`),
    featureKey: a.feature_key,
    featureLabel: String(a.feature_label ?? entitlementLabel(a.feature_key)),
    units,
    pricePaise: price,
    active: a.active !== false,
  };
}

export async function fetchAddonCatalog(planId?: string | null): Promise<AddonOffer[]> {
  const response: any = await soft7AxiosInstance.get("/admin/subscription/addons", {
    params: planId ? { plan_id: planId } : undefined,
  });
  const payload = response?.data ?? response;
  if (payload?.success === false) throw new Error(payload?.message || "Failed to load add-ons");
  const rows = payload?.data?.data ?? payload?.data ?? [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map(mapAddon)
    .filter((a): a is AddonOffer => a !== null && a.active)
    .sort((x, y) => x.pricePaise - y.pricePaise);
}

export const formatPaise = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);

export const describePack = (offer: AddonOffer, quantity = 1) =>
  `+${(offer.units * quantity).toLocaleString("en-IN")} ${entitlementUnit(offer.featureKey)}`;

/** The item handed to the payment dialog for an add-on purchase. */
export function addonPurchaseItem(offer: AddonOffer, quantity: number, userPlanId: string | null): PurchasableItem {
  return {
    kind: "addon",
    id: offer.id,
    name: quantity > 1 ? `${offer.name} × ${quantity}` : offer.name,
    price: (offer.pricePaise * quantity) / 100,
    billingCycle: "ONE_TIME",
    quantity,
    userPlanId,
  };
}
