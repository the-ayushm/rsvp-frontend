"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  apiErrorMessage,
  billingCycleLabel,
  clearSavedPurchase,
  createPlanPaymentLink,
  getPlanPurchase,
  getPurchaseState,
  getSavedPurchase,
  isTerminalPurchaseState,
  purchaseStorageId,
  verifyPlanPurchase,
  type PlanPurchase,
  type PurchasableItem,
  type PurchaseState,
} from "@/features/subscription/utils/checkout";

const POLL_MS = 4000;
const ACTIVATION_PENDING_POLL_MS = 15000;

interface PlanPaymentDialogProps {
  /** A subscription plan, or an add-on when `plan.kind === "addon"`. */
  plan: PurchasableItem;
  onClose: () => void;
  onActivated: (planName: string) => void;
}

export function PlanPaymentDialog({ plan, onClose, onActivated }: PlanPaymentDialogProps) {
  const [purchase, setPurchase] = useState<PlanPurchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const activatedRef = useRef(false);
  const kind = plan.kind ?? "plan";
  const isAddon = kind === "addon";
  const storageId = purchaseStorageId(plan);
  const noun = isAddon ? "add-on" : "plan";
  const cycle = billingCycleLabel(plan.billingCycle);
  const priceSuffix = cycle === "one-time" ? " · one-time" : ` / ${cycle}`;

  const state: PurchaseState | null = purchase ? getPurchaseState(purchase) : null;

  // Every request goes through here so polling, verify and create never overlap.
  const run = useCallback(async (request: () => Promise<PlanPurchase>, showBusy = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (showBusy) setBusy(true);
    try {
      const next = await request();
      setPurchase(next);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to reach the payment service. Please try again."));
    } finally {
      inFlight.current = false;
      if (showBusy) setBusy(false);
    }
  }, []);

  // Resume a saved purchase for this plan, otherwise create the payment link.
  useEffect(() => {
    const saved = getSavedPurchase(storageId, kind);
    run(
      saved?.purchaseId ? () => getPlanPurchase(saved.purchaseId!) : () => createPlanPaymentLink(plan),
      true,
    );
    // Only restart when a different plan/pack is selected, not when the object is refetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, run]);

  // Poll saved state while the dialog is open and the tab is visible.
  useEffect(() => {
    if (!purchase || !state || isTerminalPurchaseState(state)) return;
    const interval = state === "activation_pending" ? ACTIVATION_PENDING_POLL_MS : POLL_MS;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") run(() => getPlanPurchase(purchase.id));
    }, interval);
    return () => window.clearInterval(timer);
  }, [purchase, state, run]);

  // Customer is back from the Razorpay tab → verify once.
  useEffect(() => {
    if (!purchase || !state || isTerminalPurchaseState(state)) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") run(() => verifyPlanPurchase(purchase.id));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [purchase, state, run]);

  useEffect(() => {
    if (state === "activated" && !activatedRef.current) {
      activatedRef.current = true;
      clearSavedPurchase(storageId, kind);
      onActivated(plan.name);
    } else if (state === "test_only") {
      clearSavedPurchase(storageId, kind);
    }
  }, [state, plan, storageId, kind, onActivated]);

  const checkStatus = () => purchase && run(() => verifyPlanPurchase(purchase.id), true);
  const createNewLink = () => run(() => createPlanPaymentLink(plan, { fresh: true }), true);
  const retry = () =>
    purchase ? run(() => getPlanPurchase(purchase.id), true) : run(() => createPlanPaymentLink(plan), true);

  const copyLink = async () => {
    if (!purchase?.payment_url) return;
    try {
      await navigator.clipboard.writeText(purchase.payment_url);
      toast.success("Payment link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  // Razorpay's hosted page is embedded so the customer pays without leaving the dashboard.
  // The first load is the payment page itself; later loads mean Razorpay navigated inside
  // the frame (e.g. to its success page), so ask the backend to verify.
  const frameLoads = useRef(0);
  const onFrameLoad = () => {
    frameLoads.current += 1;
    if (frameLoads.current > 1 && purchase) run(() => verifyPlanPurchase(purchase.id));
  };

  const embedded = state === "awaiting_payment" && !!purchase?.payment_url;
  const validUntil = purchase?.expires_at
    ? new Date(purchase.expires_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  const amount = purchase
    ? `₹${(purchase.amount_paise / 100).toLocaleString("en-IN")}`
    : `₹${plan.price.toLocaleString("en-IN")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-payment-title"
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {embedded && purchase?.payment_url ? (
        <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
            <div className="min-w-0">
              <h2 id="plan-payment-title" className="truncate text-base font-extrabold text-foreground">
                {plan.name}
                <span className="ml-2 text-sm font-semibold text-muted-foreground">
                  {amount}{priceSuffix}
                </span>
                {purchase.is_test && <span className="ml-2 text-xs font-bold text-warning">TEST MODE</span>}
              </h2>
              <p className="text-xs text-muted-foreground">
                Your {noun} activates automatically once the payment is confirmed.
                {validUntil && ` Link valid until ${validUntil}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <iframe
            key={purchase.payment_url}
            src={purchase.payment_url}
            title="Razorpay secure payment"
            allow="payment; clipboard-write"
            onLoad={onFrameLoad}
            className="h-[min(680px,72vh)] w-full border-0 bg-white"
          />

          <div className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              {error ? <span className="font-semibold text-error">{error}</span> : "Payment page not loading?"}{" "}
              <a
                href={purchase.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                Open in new tab
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-foreground transition hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </button>
              <button
                type="button"
                onClick={checkStatus}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                Check payment status
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{isAddon ? "Add-on purchase" : "Plan upgrade"}</p>
        <h2 id="plan-payment-title" className="mt-1 text-xl font-extrabold text-foreground">
          {plan.name}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {amount}{priceSuffix}
          {purchase?.is_test && <span className="ml-2 font-bold text-warning">TEST MODE</span>}
        </p>

        <div className="mt-6">
          {!purchase && error ? (
            <StatusBlock tone="error" icon={<AlertTriangle className="h-6 w-6" />} title="Couldn't start the payment">
              {error}
            </StatusBlock>
          ) : !purchase || state === "preparing" ? (
            <StatusBlock tone="neutral" icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Preparing payment link">
              This usually takes a few seconds. Please don&apos;t start another purchase.
            </StatusBlock>
          ) : state === "partially_paid" ? (
            <StatusBlock tone="error" icon={<AlertTriangle className="h-6 w-6" />} title="Payment incomplete">
              Only part of the amount was received, so the {noun} was not activated. Please contact support.
            </StatusBlock>
          ) : state === "unavailable" ? (
            <StatusBlock tone="error" icon={<AlertTriangle className="h-6 w-6" />} title="Payment link unavailable">
              This link has {purchase.link_status === "cancelled" ? "been cancelled" : "expired"}. You can create a new
              payment link to continue.
            </StatusBlock>
          ) : state === "activation_pending" ? (
            <StatusBlock tone="primary" icon={<CheckCircle2 className="h-6 w-6" />} title="Payment received">
              Your {noun} activation is pending. We&apos;ll keep retrying automatically — there&apos;s no need to pay
              again. Contact support if this takes long.
            </StatusBlock>
          ) : state === "test_only" ? (
            <StatusBlock tone="neutral" icon={<FlaskConical className="h-6 w-6" />} title="Test payment completed">
              This was a test-mode payment. No real {isAddon ? "add-on" : "plan upgrade"} has been applied.
            </StatusBlock>
          ) : (
            <StatusBlock tone="primary" icon={<CheckCircle2 className="h-6 w-6" />} title={isAddon ? "Add-on activated" : "Plan activated"}>
              {isAddon
                ? `${plan.name} is now active and the extra limit has been added to your plan.`
                : `Your ${plan.name} plan is now active.`}
            </StatusBlock>
          )}

          {purchase && error && (
            <p className="mt-3 text-center text-xs font-semibold text-error">{error}</p>
          )}
        </div>

        <div className="mt-6 space-y-2.5">
          {(state === "partially_paid" || state === "activation_pending") && (
            <button
              type="button"
              onClick={checkStatus}
              disabled={busy}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              Check payment status
            </button>
          )}

          {state === "unavailable" && (
            <button
              type="button"
              onClick={createNewLink}
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Create new payment link
            </button>
          )}

          {error && (!purchase || state === "preparing") && (
            <button
              type="button"
              onClick={retry}
              disabled={busy}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              Try again
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function StatusBlock({
  tone,
  icon,
  title,
  children,
}: {
  tone: "primary" | "error" | "neutral";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "bg-error/10 text-error"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}>{icon}</div>
      <h3 className="mt-3 text-base font-extrabold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
