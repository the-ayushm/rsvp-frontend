"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  ChevronDown,
  Code2,
  Info,
  Megaphone,
  Minus,
  PackagePlus,
  Phone,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { PlanPaymentDialog } from "./PlanPaymentDialog";
import { SubscriptionCelebration } from "./SubscriptionCelebration";
import type { PurchasableItem } from "../utils/checkout";
import {
  addonPurchaseItem,
  describePack,
  fetchAddonCatalog,
  formatPaise,
  type AddonOffer,
} from "../utils/addons";
import {
  entitlementUnit,
  formatPlanDate,
  type PlanAddon,
  type PlanEntitlement,
  type PlanSummary,
} from "../utils/planEntitlements";
import {
  announceEntitlementsUpdated,
  applyEntitlements,
  fetchEntitlements,
  type Entitlements,
} from "../utils/entitlements";

const ICONS: Record<string, LucideIcon> = {
  Contact: Users,
  Campaign: Megaphone,
  Chatbot: Bot,
  TeamInvite: UserPlus,
  WabaNumber: Phone,
  AiAssistant: Sparkles,
  developer_api: Code2,
};
const iconFor = (key: string | null) => (key && ICONS[key]) || PackagePlus;

const MAX_QTY = 20;
const fmt = (n: number) => n.toLocaleString("en-IN");

interface AddonsSectionProps {
  summary: PlanSummary;
  /** called after an add-on payment is confirmed, to refresh plan status */
  onPurchased: () => void;
}

export function AddonsSection({ summary: planStatus, onPurchased }: AddonsSectionProps) {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [preparingBuy, setPreparingBuy] = useState(false);
  // Entitlements carry the real user_plan_id and the effective (base + add-on) limits.
  const summary = useMemo(() => applyEntitlements(planStatus, entitlements), [planStatus, entitlements]);
  const [catalog, setCatalog] = useState<AddonOffer[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paying, setPaying] = useState<PurchasableItem | null>(null);
  const [payingOffer, setPayingOffer] = useState<{ offer: AddonOffer; qty: number } | null>(null);
  const [celebration, setCelebration] = useState<{
    name: string;
    gained: string;
    unit: string;
    newLimit: number | null;
    remaining: number | null;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const isFree = /free/i.test(summary.billingCycle) || summary.price === 0;

  useEffect(() => {
    if (isFree) return;
    let cancelled = false;
    setCatalogState("loading");
    fetchAddonCatalog(summary.planId)
      .then((rows) => {
        if (cancelled) return;
        setCatalog(rows);
        setCatalogState("ready");
      })
      .catch(() => !cancelled && setCatalogState("error"));
    return () => {
      cancelled = true;
    };
  }, [summary.planId, isFree]);

  const loadEntitlements = useCallback(async () => {
    try {
      const next = await fetchEntitlements();
      setEntitlements(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadEntitlements();
  }, [loadEntitlements]);

  // Always buy against the current user_plan from /subscription/entitlements.
  const startPurchase = async (offer: AddonOffer, qty: number) => {
    if (preparingBuy) return;
    setPreparingBuy(true);
    const fresh = await loadEntitlements();
    setPreparingBuy(false);
    const userPlanId = fresh?.userPlanId ?? summary.userPlanId;
    if (!userPlanId) {
      toast.error("Couldn't find your current plan. Please refresh and try again.");
      return;
    }
    setPayingOffer({ offer, qty });
    setPaying(addonPurchaseItem(offer, qty, userPlanId));
  };

  const quotaByKey = useMemo(
    () => new Map(summary.quotas.map((q): [string, PlanEntitlement] => [q.key, q])),
    [summary.quotas],
  );

  // Only packs this plan offers, for features that are metered and enabled.
  const offers = useMemo(() => {
    const offered = new Set(summary.offeredAddonIds);
    return catalog
      .filter((o) => offered.size === 0 || offered.has(o.id))
      .filter((o) => quotaByKey.get(o.featureKey)?.enabled !== false && quotaByKey.has(o.featureKey))
      .map((o) => ({ offer: o, quota: quotaByKey.get(o.featureKey)! }))
      .sort((a, b) => b.quota.percent - a.quota.percent);
  }, [catalog, summary.offeredAddonIds, quotaByKey]);

  const handleActivated = async (name: string) => {
    const bought = payingOffer;
    setPaying(null);
    setPayingOffer(null);
    setExpandedId(null);
    // The plan ID/name don't change for add-ons — refetch allowances and tell the rest of the app.
    const fresh = await loadEntitlements();
    const allowance = bought ? fresh?.features[bought.offer.featureKey] : undefined;
    setCelebration({
      name,
      gained: bought ? describePack(bought.offer, bought.qty) : "",
      unit: bought ? entitlementUnit(bought.offer.featureKey) : "",
      newLimit: allowance?.effectiveLimit ?? null,
      remaining: allowance?.remaining ?? null,
    });
    announceEntitlementsUpdated();
    onPurchased();
  };

  return (
    <div className="space-y-5 pt-4 border-t border-border">
      {/* ── Active add-ons ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-secondary-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Your add-ons</h3>
            {summary.addons.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {summary.addons.length} active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            aria-expanded={showHelp}
          >
            <Info className="h-3.5 w-3.5" />
            How it works
          </button>
        </div>

        {showHelp && (
          <ul className="space-y-1.5 rounded-lg border border-border bg-surface-muted p-3 text-[11px] leading-relaxed text-secondary-foreground">
            <li>• Add-ons are one-time packs that raise a single limit (e.g. +500 contacts) on your current plan.</li>
            <li>• The extra units are added on top of your plan limit right after payment is confirmed.</li>
            <li>
              • They stay valid until your plan period ends
              {summary.endDate ? ` (${formatPlanDate(summary.endDate)})` : ""} and don&apos;t carry over on renewal.
            </li>
            <li>• Need much more? Upgrading the plan is often cheaper than several packs.</li>
          </ul>
        )}

        {summary.addons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No add-ons on this plan yet. Running low on a limit? Top it up below without changing your plan.
          </p>
        ) : (
          <div className="space-y-2">
            {summary.addons.map((a) => (
              <ActiveAddonCard key={`${a.key}-${a.label}`} addon={a} quota={a.key ? quotaByKey.get(a.key) : undefined} />
            ))}
          </div>
        )}
      </section>

      {/* ── Buy add-ons ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Boost your limits</h3>
          </div>
          {!isFree && summary.endDate && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              One-time packs · valid till {formatPlanDate(summary.endDate)}
            </p>
          )}
        </div>

        {isFree ? (
          <p className="rounded-lg bg-surface-muted px-3 py-3 text-xs text-secondary-foreground">
            Add-ons are available on paid plans. Upgrade to unlock extra contacts, campaigns, numbers and more.
          </p>
        ) : catalogState === "loading" ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : catalogState === "error" ? (
          <p className="rounded-lg bg-error/10 px-3 py-3 text-xs text-error">
            Couldn&apos;t load add-on prices right now. Please try again in a moment.
          </p>
        ) : offers.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-3 text-xs text-secondary-foreground">
            Your plan doesn&apos;t offer add-on packs. Check other plans for higher limits.
          </p>
        ) : (
          <div className="space-y-2">
            {offers.map(({ offer, quota }) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                quota={quota}
                planEnd={summary.endDate}
                expanded={expandedId === offer.id}
                onToggle={() => setExpandedId((id) => (id === offer.id ? null : offer.id))}
                busy={preparingBuy}
                onBuy={(qty) => startPurchase(offer, qty)}
              />
            ))}
          </div>
        )}
      </section>

      {paying && (
        <PlanPaymentDialog
          plan={paying}
          onClose={() => {
            setPaying(null);
            setPayingOffer(null);
          }}
          onActivated={handleActivated}
        />
      )}

      {celebration && (
        <SubscriptionCelebration
          planName={celebration.name}
          onClose={() => setCelebration(null)}
          icon={<Zap className="h-10 w-10" />}
          title="Limit boosted! 🚀"
          ctaLabel="Awesome"
          message={
            <>
              <p>
                <span className="font-bold text-primary">{celebration.name}</span> is now active on your plan.
              </p>
              {celebration.gained && (
                <p className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">{celebration.gained}</p>
              )}
              {celebration.newLimit !== null && (
                <p className="mt-2 text-xs">
                  New limit: <span className="font-bold text-foreground">{fmt(celebration.newLimit)}</span>{" "}
                  {celebration.unit}
                  {celebration.remaining !== null && <> · {fmt(celebration.remaining)} available</>}
                </p>
              )}
            </>
          }
        />
      )}
    </div>
  );
}

function ActiveAddonCard({ addon, quota }: { addon: PlanAddon; quota?: PlanEntitlement }) {
  const Icon = iconFor(addon.key);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{addon.label}</p>
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {addon.value}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-secondary-foreground">{addon.description}</p>

          {quota && quota.totalLimit !== null && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-active">
                <div
                  className={`h-full rounded-full ${quota.percent >= 90 ? "bg-error" : "bg-primary"}`}
                  style={{ width: `${Math.max(quota.percent, quota.used > 0 ? 2 : 0)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {fmt(quota.used)} of {fmt(quota.totalLimit)} {entitlementUnit(quota.key)} used
              </p>
            </div>
          )}

          {addon.expiresAt && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              Valid till {formatPlanDate(addon.expiresAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface OfferCardProps {
  offer: AddonOffer;
  quota: PlanEntitlement;
  planEnd: Date | null;
  expanded: boolean;
  onToggle: () => void;
  busy?: boolean;
  onBuy: (quantity: number) => void;
}

function OfferCard({ offer, quota, planEnd, expanded, onToggle, busy, onBuy }: OfferCardProps) {
  const [qty, setQty] = useState(1);
  const Icon = iconFor(offer.featureKey);
  const unit = entitlementUnit(offer.featureKey);
  const running = quota.percent >= 80;
  const currentLimit = quota.totalLimit ?? 0;
  const newLimit = currentLimit + offer.units * qty;
  const total = offer.pricePaise * qty;

  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        expanded ? "border-primary shadow-sm" : running ? "border-warning/50" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-hover"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{offer.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {describePack(offer)} per pack
            {running && (
              <span className="ml-1.5 font-semibold text-warning">· {Math.round(quota.percent)}% used</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">{formatPaise(offer.pricePaise)}</p>
          <ChevronDown
            className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-surface-muted/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-secondary-foreground">Packs</span>
            <div className="flex items-center rounded-lg border border-border bg-surface">
              <button
                type="button"
                aria-label="Fewer packs"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="p-1.5 text-secondary-foreground disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">{qty}</span>
              <button
                type="button"
                aria-label="More packs"
                onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                disabled={qty >= MAX_QTY}
                className="p-1.5 text-secondary-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <dl className="space-y-1.5 rounded-lg bg-surface p-3 text-xs">
            <Row label="You get" value={`+${fmt(offer.units * qty)} ${unit}`} strong />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Limit</dt>
              <dd className="flex items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground">{fmt(currentLimit)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-bold text-primary">{fmt(newLimit)}</span>
              </dd>
            </div>
            <Row label="Currently used" value={`${fmt(quota.used)} ${unit}`} />
            {planEnd && <Row label="Valid till" value={formatPlanDate(planEnd)} />}
            <div className="!mt-2 border-t border-border pt-2">
              <Row label="Total (one-time)" value={formatPaise(total)} strong />
            </div>
          </dl>

          <button
            type="button"
            onClick={() => onBuy(qty)}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Preparing…" : `Pay ${formatPaise(total)}`}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            Applied instantly after payment · unused units expire with your plan period
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold text-foreground" : "text-secondary-foreground"}`}>{value}</dd>
    </div>
  );
}
