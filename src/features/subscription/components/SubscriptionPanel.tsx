/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { X, Crown, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { parsePlanStatus, formatPlanDate, type PlanSummary } from "../utils/planEntitlements";
import { AddonsSection } from "./AddonsSection";

interface SubscriptionData {
  plan: string;
  startDate: string;
  endDate: string;
  status: string;
  features?: {
    label: string;
    limitValue?: number | null;
    limitType?: string | null;
  }[];
  usage?: Record<string, number>;
  limits?: Record<string, { limit: number }>;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: "MONTHLY" | "YEARLY" | "FREE";
}

interface SubscriptionPanelProps {
  subscriptionData: SubscriptionData | undefined | null;
  onClose: () => void;
  onSubscriptionUpdated?: () => Promise<any>;
}

export default function SubscriptionPanel({
  onClose,
  onSubscriptionUpdated,
}: SubscriptionPanelProps) {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<SubscriptionData | null>(null);
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      // Only show the full-panel spinner on first load; refreshes keep the content visible.
      if (reloadKey === 0) setLoading(true);
      try {
        // Fetch active plan
        const statusRes = await soft7AxiosInstance.get("/admin/users/plan/status");
        if (statusRes.data && statusRes.data.data) {
          const planData = statusRes.data.data;
          // Check if plan is active
          if (planData.active || planData.status === "COMPLETED") {
            setActivePlan({
              plan: planData.plan_name || planData.planName || "Unknown",
              startDate: planData.start_date || planData.startDate || new Date().toISOString(),
              endDate: planData.end_date || planData.endDate || new Date().toISOString(),
              status: "active",
              features: [],
              usage: planData.usage || {},
              limits: planData.limits || {}
            });
            setSummary(parsePlanStatus(planData));
          }
        }

        // Fetch available plans
        const plansRes = await soft7AxiosInstance.get("/admin/subscription/plan?active=true");
        console.log("Plans API:", plansRes.data);
        let plansData: any[] = [];

        if (Array.isArray(plansRes.data?.data?.data)) {
          plansData = plansRes.data.data.data;
        } else if (Array.isArray(plansRes.data?.data)) {
          plansData = plansRes.data.data;
        }

console.log("Parsed Plans:", plansData);
        
        const parsedPlans = plansData
         .filter((plan: any) => plan.active !== false)
          .sort((a: any, b: any) => (Number(a.price) || 0) - (Number(b.price) || 0))
          .map((plan: any) => ({
            id: plan.id,
            name: plan.plan_name || plan.name,
        price: Number(plan.price || 0),
          billingCycle: (plan.billing_cycle?.toUpperCase() === "FREE"
    ? "FREE"
    : plan.billing_cycle?.toUpperCase() === "YEARLY"
      ? "YEARLY"
      : "MONTHLY") as "FREE" | "YEARLY" | "MONTHLY",
          }))
          .slice(0, 3); // Take top 3 plans
          
        setAvailablePlans(parsedPlans);
      } catch (error) {
        console.error("Error fetching subscription data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reloadKey]);

  const handleAddonPurchased = () => {
    setReloadKey((k) => k + 1);
    onSubscriptionUpdated?.();
  };

  const isPremium = activePlan?.status === "active";
  const expiringSoon = summary?.daysRemaining != null && summary.daysRemaining <= 15;

  const goToBilling = () => {
    onClose();
    router.push("/user/settings/billing");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-surface dark:bg-surface shadow-2xl z-[201] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border dark:border-border">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-warning" />
            <h2 className="text-xl font-bold text-foreground dark:text-white">
              Subscription
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover dark:hover:bg-surface-raised rounded-lg transition"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {isPremium && summary ? (
                <>
                  {/* Status Badge */}
                  <div
                    className="flex items-center gap-3 rounded-lg p-4"
                    style={{
                      backgroundColor: expiringSoon ? "var(--color-warning-bg)" : "var(--color-success-light)",
                      border: `1px solid ${expiringSoon ? "var(--color-warning)" : "var(--color-success)"}`,
                    }}
                  >
                    {expiringSoon ? (
                      <AlertCircle className="h-6 w-6 shrink-0 text-warning" />
                    ) : (
                      <CheckCircle className="h-6 w-6 shrink-0" style={{ color: "var(--color-success)" }} />
                    )}
                    <div>
                      <p className={`font-semibold ${expiringSoon ? "text-warning" : ""}`} style={expiringSoon ? undefined : { color: "var(--color-success-dark)" }}>
                        {expiringSoon ? "Plan expiring soon" : "Premium Active"}
                      </p>
                      <p className={`text-sm ${expiringSoon ? "text-warning" : ""}`} style={expiringSoon ? undefined : { color: "var(--color-success)" }}>
                        {summary.daysRemaining !== null
                          ? `${summary.daysRemaining} day${summary.daysRemaining === 1 ? "" : "s"} remaining`
                          : "Enjoy all premium features"}
                      </p>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="space-y-4">
                    <div className="bg-surface-muted dark:bg-surface-raised rounded-lg p-4">
                      <p className="text-sm text-secondary-foreground dark:text-muted-foreground mb-1">
                        Current Plan
                      </p>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-lg font-semibold text-foreground dark:text-white capitalize">
                          {summary.planName}
                        </p>
                        <p className="text-sm font-semibold text-foreground dark:text-white">
                          ₹{summary.price.toLocaleString("en-IN")}
                          <span className="font-normal text-muted-foreground"> / {summary.billingCycle}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-muted dark:bg-surface-raised rounded-lg p-4">
                        <p className="text-sm text-secondary-foreground dark:text-muted-foreground mb-1">
                          Started
                        </p>
                        <p className="font-semibold text-foreground dark:text-white">
                          {formatPlanDate(summary.startDate)}
                        </p>
                      </div>

                      <div className="bg-surface-muted dark:bg-surface-raised rounded-lg p-4">
                        <p className="text-sm text-secondary-foreground dark:text-muted-foreground mb-1">
                          Expires On
                        </p>
                        <p className={`font-semibold ${expiringSoon ? "text-error! dark:text-error!" : "text-foreground dark:text-white"}`}>
                          {formatPlanDate(summary.endDate)}
                        </p>
                      </div>
                    </div>

                    {/* Plan period progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-secondary-foreground dark:text-muted-foreground">
                        <span>Plan period</span>
                        <span>
                          {summary.durationDays ? `${summary.durationDays} days` : ""}
                          {summary.extensionDays > 0 ? ` + ${summary.extensionDays} extended` : ""}
                        </span>
                      </div>
                      <div className="w-full bg-surface-active rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${expiringSoon ? "bg-warning" : "bg-primary"}`}
                          style={{ width: `${summary.periodElapsedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* No Subscription */}
                  <div className="flex items-center gap-3 bg-warning-bg dark:bg-warning-bg/20! border border-warning-border! dark:border-warning-border! rounded-lg p-4">
                    <AlertCircle className="h-6 w-6 text-warning! dark:text-warning! shrink-0" />
                    <div>
                      <p className="font-semibold text-warning dark:text-warning">
                        No Active Subscription
                      </p>
                      <p className="text-sm text-warning dark:text-warning">
                        Upgrade to premium now
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Usage Statistics */}
              {isPremium && summary && summary.quotas.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border dark:border-border mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-secondary-foreground dark:text-secondary-foreground" />
                    <h3 className="font-semibold text-foreground dark:text-white">Usage Statistics</h3>
                  </div>

                  {summary.quotas.map((q) => (
                    <div key={q.key} className={`space-y-1.5 ${q.enabled ? "" : "opacity-50"}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary-foreground dark:text-secondary-foreground">{q.label}</span>
                        <span className={`font-medium ${q.overLimit ? "text-error" : "text-foreground dark:text-white"}`}>
                          {q.used.toLocaleString("en-IN")} / {q.totalLimit?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="w-full bg-surface-active dark:bg-surface-active rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${q.overLimit || q.percent >= 90 ? "bg-error" : "bg-primary"}`}
                          style={{ width: `${Math.max(q.percent, q.used > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {!q.enabled
                            ? "Not enabled"
                            : q.addonLimit > 0
                              ? `${q.baseLimit?.toLocaleString("en-IN")} plan + ${q.addonLimit.toLocaleString("en-IN")} add-on`
                              : `${q.remaining?.toLocaleString("en-IN")} remaining`}
                        </span>
                        {q.nextReset && <span>Resets {formatPlanDate(q.nextReset)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Included features (no cap) */}
              {isPremium && summary && summary.features.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border dark:border-border">
                  <h3 className="font-semibold text-foreground dark:text-white text-sm">Included Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {summary.features.map((f) => (
                      <span
                        key={f.key}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                          f.enabled
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-surface-muted text-muted-foreground line-through"
                        }`}
                      >
                        {f.enabled && <CheckCircle className="h-3 w-3" />}
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons: what's applied + packs available to buy */}
              {isPremium && summary && (
                <AddonsSection summary={summary} onPurchased={handleAddonPurchased} />
              )}

              {/* Subscription ID */}
              {isPremium && summary?.subscriptionId && (
                <div className="pt-4 border-t border-border dark:border-border">
                  <p className="text-xs text-muted-foreground mb-1">Subscription ID</p>
                  <p className="truncate rounded-md bg-surface-muted dark:bg-surface-raised px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {summary.subscriptionId}
                  </p>
                </div>
              )}

              {/* CTA Button */}
              <div className="pt-6">
                <button
                  onClick={goToBilling}
                  className="w-full py-3 bg-linear-to-r from-primary to-primary hover:from-primary hover:to-primary-hover text-primary-foreground font-bold rounded-lg transition shadow-lg"
                >
                  View All Plans
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border dark:border-border p-6 bg-surface-muted dark:bg-surface-raised">
          <p className="text-xs text-secondary-foreground dark:text-muted-foreground text-center">
            Secure payments powered by Razorpay
          </p>
        </div>
      </div>
    </>
  );
}