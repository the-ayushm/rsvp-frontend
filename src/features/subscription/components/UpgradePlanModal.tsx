"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Check,
  Crown,
  LogOut,
  Megaphone,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  activateFreePlan,
  apiErrorMessage,
  fetchSubscriptionPlans,
  isFreePlan,
  type SubscriptionPlan,
} from "@/features/subscription/utils/checkout";
import { PlanPaymentDialog } from "@/features/subscription/components/PlanPaymentDialog";

interface UpgradePlanModalProps {
  /** True when the user had a plan that has now expired (vs. never subscribed). */
  expired: boolean;
  expiredPlanName?: string | null;
  expiredOn?: string | null;
  /** Free plan is only offered to users who never had a plan. */
  allowFreePlan: boolean;
  onActivated: (planName: string) => void;
  onLogout: () => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Friendly names and icons for the plan feature keys the API returns.
const FEATURES: Record<string, { label: string; icon: ComponentType<{ className?: string }> }> = {
  chatbot: { label: "Chatbots", icon: Bot },
  contact: { label: "Contacts", icon: Users },
  campaign: { label: "Campaigns", icon: Megaphone },
  teaminvite: { label: "Team members", icon: UserPlus },
  wabanumber: { label: "WhatsApp numbers", icon: Phone },
};
const featureInfo = (label: string) => {
  const known = FEATURES[label.toLowerCase().replace(/[^a-z]/g, "")];
  return known ?? { label: label.replace(/([a-z])([A-Z])/g, "$1 $2"), icon: Check };
};

const CSS = `
@keyframes upm-rise { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes upm-shine { 0% { transform: translateX(-120%) skewX(-20deg) } 70%, 100% { transform: translateX(320%) skewX(-20deg) } }
.upm-rise { animation: upm-rise .45s cubic-bezier(.2,.8,.2,1) both }
.upm-shine::after { content: ""; position: absolute; inset: 0; width: 35%; pointer-events: none;
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary-foreground) 45%, transparent), transparent);
  animation: upm-shine 3s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .upm-rise, .upm-shine::after { animation: none } }
`;

export function UpgradePlanModal({
  expired,
  expiredPlanName,
  expiredOn,
  allowFreePlan,
  onActivated,
  onLogout,
}: UpgradePlanModalProps) {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan | null>(null);

  const { data: plans = [], isLoading, isError, refetch } = useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription-plans"],
    queryFn: fetchSubscriptionPlans,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Lock page scroll while the user is blocked.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const availablePlans = useMemo(
    () => plans.filter((plan) => allowFreePlan || !isFreePlan(plan)),
    [plans, allowFreePlan],
  );
  const hasYearly = availablePlans.some((plan) => plan.billingCycle === "YEARLY");
  const hasMonthly = availablePlans.some((plan) => plan.billingCycle === "MONTHLY");

  // Default to whichever cycle actually has plans.
  useEffect(() => {
    if (!hasMonthly && hasYearly) setBillingCycle("YEARLY");
  }, [hasMonthly, hasYearly]);

  const displayPlans = availablePlans
    .filter((plan) =>
      plan.billingCycle === "FREE" ? billingCycle === "MONTHLY" : plan.billingCycle === billingCycle,
    )
    .sort((a, b) => a.price - b.price);

  // Highlight the plan marked popular; otherwise the cheapest paid plan.
  const featuredId =
    displayPlans.find((plan) => plan.isPopular)?.id ?? displayPlans.find((plan) => !isFreePlan(plan))?.id ?? null;

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!isFreePlan(plan)) {
      setPayingPlan(plan);
      return;
    }
    setProcessingPlan(plan.id);
    try {
      await activateFreePlan(plan);
      onActivated(plan.name);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to activate the free plan"));
    } finally {
      setProcessingPlan(null);
    }
  };

  const expiredOnLabel = formatDate(expiredOn);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-plan-title"
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 sm:p-6"
    >
      <style>{CSS}</style>
      {/* Backdrop intentionally has no click handler: the popup cannot be dismissed. */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />

      <div className="upm-rise relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-transparent px-6 pb-6 pt-8 text-center sm:px-10">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

          <div
            className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${
              expired ? "bg-error text-primary-foreground" : "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground"
            }`}
          >
            {expired ? <AlertTriangle className="h-7 w-7" /> : <Crown className="h-7 w-7" />}
          </div>

          <h2 id="upgrade-plan-title" className="relative mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-[28px]">
            {expired ? "Your plan has expired" : "Choose a plan to get started"}
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {expired
              ? `${expiredPlanName ? `Your ${expiredPlanName} plan` : "Your subscription"} ${
                  expiredOnLabel ? `ended on ${expiredOnLabel}` : "has ended"
                }. Renew to continue. Your data is safe and will be available as soon as you do.`
              : "Pick the plan that fits your business. You can upgrade anytime as you grow."}
          </p>

          {hasMonthly && hasYearly && (
            <div className="relative mt-5 inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
              {(["MONTHLY", "YEARLY"] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                    billingCycle === cycle
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cycle === "MONTHLY" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-4 px-6 pb-2 pt-2 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[340px] animate-pulse rounded-2xl border border-border bg-muted/60" />
            ))
          ) : isError || displayPlans.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-border bg-muted/50 p-10 text-center">
              <p className="text-sm font-bold text-foreground">
                {isError ? "Couldn't load plans" : "No plans available right now"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Please try again or contact support.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : (
            displayPlans.map((plan, index) => {
              const free = isFreePlan(plan);
              const featured = plan.id === featuredId;
              const processing = processingPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  style={{ animationDelay: `${80 + index * 60}ms` }}
                  className={`upm-rise group relative flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                    featured
                      ? "border-primary shadow-lg ring-4 ring-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Most popular
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        featured
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      }`}
                    >
                      {free ? <Star className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground">{plan.name}</h3>
                      {plan.description && plan.description.toLowerCase() !== "plan" && (
                        <p className="truncate text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-[34px] font-black leading-none tracking-tight text-foreground">
                      {free ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                    </span>
                    {!free && (
                      <span className="text-sm font-medium text-muted-foreground">
                        /{plan.billingCycle === "YEARLY" ? "year" : "month"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {free ? "Try the essentials, no payment needed" : plan.billingCycle === "YEARLY" ? "Billed yearly" : "Billed monthly"}
                  </p>

                  <div className="my-4 h-px bg-border" />

                  <ul className="flex-1 space-y-2.5">
                    {plan.features.map((feature) => {
                      const { label, icon: Icon } = featureInfo(feature.label);
                      const unlimited = feature.limitValue === -1;
                      return (
                        <li key={feature.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate text-foreground">{label}</span>
                          </span>
                          <span className="shrink-0 font-bold text-foreground">
                            {unlimited ? "Unlimited" : feature.limitValue?.toLocaleString("en-IN") ?? "Included"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan)}
                    disabled={processingPlan !== null}
                    className={`relative mt-5 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      featured
                        ? "upm-shine bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-md hover:shadow-lg"
                        : "border border-primary/40 bg-card text-primary-text hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {processing ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Activating…
                      </>
                    ) : free ? (
                      "Start for free"
                    ) : expired ? (
                      `Renew with ${plan.name}`
                    ) : (
                      `Get ${plan.name}`
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-between sm:px-8">
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Secure payments via Razorpay. Need help? Contact support.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </div>

      {payingPlan && (
        <PlanPaymentDialog
          plan={payingPlan}
          onClose={() => setPayingPlan(null)}
          onActivated={(planName) => {
            setPayingPlan(null);
            onActivated(planName);
          }}
        />
      )}
    </div>
  );
}
