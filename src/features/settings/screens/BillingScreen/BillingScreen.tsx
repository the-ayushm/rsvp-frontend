/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import {
  Inbox,
  Users,
  Zap,
  Star,
  Layers,
  Plug,
  Settings,
  Image,
  Workflow,
  Code2,
  CreditCard,
  BarChart2,
  Crown,
  AlertCircle,
  Check,
  Rocket,
  Shield,
  Gem,
  MessageSquare,
  Megaphone,
  HelpCircle,
  PackagePlus,
  UserPlus,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { parsePlanStatus, formatPlanDate } from "@/features/subscription/utils/planEntitlements";
import {
  activateFreePlan,
  announceSubscriptionActivated,
  fetchSubscriptionPlans,
  isFreePlan,
  type SubscriptionPlan,
} from "@/features/subscription/utils/checkout";
import { PlanPaymentDialog } from "@/features/subscription/components/PlanPaymentDialog";

const USAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Chatbot: MessageSquare,
  Contact: Users,
  Campaign: Megaphone,
  TeamInvite: UserPlus,
  WabaNumber: Smartphone,
};

interface UserData {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
  subscriptionPlan?: string;
  subscriptionEnd?: string;
  company_id?: string;
  companyId?: string;
}

interface ModuleItem {
  label: string;
  value: string;
}

interface ModuleContent {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  items: ModuleItem[];
}

interface Module {
  name: string;
  icon: React.ComponentType<any>;
}

interface ContactStats {
  totalContacts: number;
  activeContacts: number;
  inactiveContacts: number;
  canImport: boolean;
  canExport: boolean;
  contactLimit: string;
  contactsUsed: number;
  contactsRemaining: string;
}

const DEFAULT_PLANS: SubscriptionPlan[] = [];

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY" | "FREE">("MONTHLY");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan | null>(null);
  const [contactStats, setContactStats] = useState<ContactStats>({
    totalContacts: 0,
    activeContacts: 0,
    inactiveContacts: 0,
    canImport: true,
    canExport: true,
    contactLimit: "Unlimited",
    contactsUsed: 0,
    contactsRemaining: "Unlimited",
  });
  const [loadingContacts, setLoadingContacts] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: userData, isLoading: loading } = useQuery<UserData>({
    queryKey: ["users-data-billing"],
    queryFn: async () => {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      return userStr ? JSON.parse(userStr) : null;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Available plans are loaded from:
  // GET /admin/subscription/plan?active=true
  //
  // API response shape:
  // {
  //   success: true,
  //   data: {
  //     data: [
  //       {
  //         id,
  //         plan_name,
  //         price,
  //         billing_cycle,
  //         features: {
  //           chatbot: { limit_type, limit_value },
  //           contacts: { limit_type, limit_value },
  //           campaigns: { limit_type, limit_value }
  //         }
  //       }
  //     ]
  //   }
  // }
  const {
    data: subscriptionPlansData,
    isLoading: loadingSubscriptionPlans,
  } = useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      try {
        return await fetchSubscriptionPlans();
      } catch (error) {
        console.error("Error fetching subscription plans:", error);
        toast.error("Failed to load subscription plans");
        return [];
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  const { data: activePlanData, isLoading: loadingActivePlan, error: activePlanError } = useQuery({
    queryKey: [
      "active-subscription-plan",
      userData?.id,
      userData?.company_id ?? userData?.companyId,
    ],
    enabled: true,
    queryFn: async () => {
      try {
        /*
         * IMPORTANT:
         * This endpoint returns the logged-in user's plan:
         *
         * {
         *   success: true,
         *   data: {
         *     plan_name: "Starter",
         *     price: "3500.00",
         *     billing_cycle: "Yearly",
         *     start_date: "...",
         *     end_date: "...",
         *     limits: {...},
         *     usage: {...},
         *     active: true,
         *     subscription_id: "..."
         *   }
         * }
         *
         * Some axios configurations/interceptors return response.data,
         * while others return the complete AxiosResponse. Handle both so
         * the Billing UI always receives the actual plan object.
         */
        const response: any = await soft7AxiosInstance.get("/admin/users/plan/status");

        // Standard AxiosResponse -> response.data
        // Axios interceptor returning body -> response
        const payload = response?.data ?? response;

        if (payload?.success === false) {
          return null;
        }

        // Expected API body: payload.data = the active plan.
        // Also support an extra data.data wrapper just in case.
        const plan =
          payload?.data?.data ??
          payload?.data ??
          payload;

        // Only accept an object that actually looks like a plan.
        if (!plan || typeof plan !== "object" || !plan.plan_name) {
          console.warn("Active plan API returned an unexpected response:", payload);
          return null;
        }

        return plan;
      } catch (err) {
        console.error("Error fetching active subscription plan:", err);
        return null;
      }
    },
    retry: 1,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
  });

  // The query function above returns the actual plan object, regardless of
  // whether axios returned AxiosResponse or response.data.
  const currentPlan = activePlanData ?? null;

  // Normalize the exact response fields used by the Billing UI.
  const normalizedCurrentPlan = {
    active: currentPlan?.active === true,
    plan_name: currentPlan?.plan_name ?? "No Active Plan",
    price: Number(currentPlan?.price ?? 0),
    billing_cycle: currentPlan?.billing_cycle ?? "Free",
    start_date: currentPlan?.start_date ?? null,
    end_date: currentPlan?.end_date ?? null,
    description: currentPlan?.description ?? "",
    created_at: currentPlan?.created_at ?? null,
    subscription_id: currentPlan?.subscription_id ?? currentPlan?.id ?? null,
    usage:
      currentPlan?.usage && typeof currentPlan.usage === "object"
        ? currentPlan.usage
        : {},
    limits:
      currentPlan?.limits && typeof currentPlan.limits === "object"
        ? currentPlan.limits
        : {},
  };

  const planSummary = parsePlanStatus(currentPlan);

  const fetchContactStats = async () => {
    try {
      setLoadingContacts(true);
      const response = await soft7AxiosInstance.get("/user/contacts/stats");
      if (response.data?.success && response.data?.data) {
        setContactStats({
          totalContacts: response.data.data.totalContacts || 0,
          activeContacts: response.data.data.activeContacts || 0,
          inactiveContacts: response.data.data.inactiveContacts || 0,
          canImport: response.data.data.canImport ?? true,
          canExport: response.data.data.canExport ?? true,
          contactLimit: response.data.data.contactLimit || "Unlimited",
          contactsUsed: response.data.data.contactsUsed || 0,
          contactsRemaining: response.data.data.contactsRemaining || "Unlimited",
        });
      }
    } catch (error) {
      console.error("Error fetching contact stats:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (selectedModule === "Contact") {
      fetchContactStats();
    }
  }, [selectedModule]);

  const exportContacts = async () => {
    try {
      const response = await soft7AxiosInstance.get("/user/contacts/export", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `contacts-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Contacts exported successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to export contacts");
    }
  };

  const importContacts = () => {
    router.push("/user/contacts?action=import");
  };

  const refreshPlanQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["users-data-billing"] });
    await queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["active-subscription-plan"] });
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      setProcessingPlan(plan.name);
      if (isFreePlan(plan)) {
        if (normalizedCurrentPlan.active) {
          toast.error("You already have an active subscription plan.");
          setProcessingPlan(null);
          return;
        }

        await activateFreePlan(plan);
        await refreshPlanQueries();
        announceSubscriptionActivated(plan.name);
        setProcessingPlan(null);
        return;
      }

      // Paid plans go through a Razorpay Payment Link; PlanPaymentDialog tracks it to activation.
      setProcessingPlan(null);
      setPayingPlan(plan);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Failed to process subscription");
      setProcessingPlan(null);
    }
  };

  // The plan cards now use the response from
  // GET /admin/subscription/plan?active=true.
  const effectivePlans = subscriptionPlansData ?? DEFAULT_PLANS;

  const displayPlans = effectivePlans
    .filter((plan) => {
      // Free Plan is shown only in the Monthly section.
      if (plan.billingCycle === "FREE") return billingCycle === "MONTHLY";
      return plan.billingCycle === billingCycle;
    })
    .sort((a, b) => {
      if (a.billingCycle === "FREE" && b.billingCycle !== "FREE") return -1;
      if (a.billingCycle !== "FREE" && b.billingCycle === "FREE") return 1;
      return 0;
    });

  const modules: Module[] = [
    { name: "Inbox", icon: Inbox },
    { name: "Contact", icon: Users },
    { name: "Campaign", icon: Layers },
    { name: "Integration", icon: Plug },
    { name: "Manage", icon: Settings },
    { name: "Gallery", icon: Image },
    { name: "Automation", icon: Workflow },
    { name: "Developer", icon: Code2 },
  ];

  const moduleContent: Record<string, ModuleContent> = {
    Inbox: {
      icon: Inbox,
      title: "Inbox",
      description: "Manage your Inbox and Contacts inside billing.",
      items: [
        { label: "Inbox", value: "✅ New" },
        { label: "Contacts", value: contactStats.totalContacts.toString() },
      ],
    },
    Contact: {
      icon: Users,
      title: "Contact",
      description: "Manage and export contact lists.",
      items: [
        { label: "Total Contacts", value: contactStats.totalContacts.toString() },
        { label: "Active Contacts", value: contactStats.activeContacts.toString() },
        { label: "Contact Limit", value: contactStats.contactLimit },
        { label: "Remaining", value: contactStats.contactsRemaining },
      ],
    },
    Campaign: {
      icon: Layers,
      title: "Campaign",
      description: "Broadcasting and messaging campaigns.",
      items: [
        { label: "Broadcast", value: "✅" },
        { label: "Templates", value: "✅ 50" },
      ],
    },
    Integration: {
      icon: Plug,
      title: "Integration",
      description: "Connect your favorite CRM and platforms.",
      items: [
        { label: "Shopify", value: "✅" },
        { label: "WooCommerce", value: "✅" },
      ],
    },
    Manage: {
      icon: Settings,
      title: "Manage",
      description: "Tags, sequences, stages, and uploads.",
      items: [
        { label: "Tags", value: "✅ Unlimited" },
        { label: "Stages", value: "✅ Unlimited" },
      ],
    },
    Gallery: {
      icon: Image,
      title: "Gallery",
      description: "Upload and host images & media.",
      items: [
        { label: "Storage", value: "5 GB" },
        { label: "Uploads", value: "✅ Fast" },
      ],
    },
    Automation: {
      icon: Workflow,
      title: "Automation",
      description: "Build powerful automated workflows.",
      items: [
        { label: "Flows", value: "✅ 100" },
        { label: "ChatBot", value: "✅ 20" },
      ],
    },
    Developer: {
      icon: Code2,
      title: "Developer",
      description: "Access API and developer resources.",
      items: [
        { label: "WhatsApp API", value: "✅" },
        { label: "Docs", value: "✅" },
      ],
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 py-6 sm:py-8 space-y-6">
      {/* Page Header */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute right-20 bottom-[-90px] h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md sm:h-20 sm:w-20">
              <CreditCard className="h-8 w-8 stroke-[2.1] sm:h-10 sm:w-10" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <span>Settings</span>
                <span className="h-1 w-1 rounded-full bg-primary" />
                <span>Billing</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Billing &amp; Plans
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your subscription, usage and plan upgrades from one place.
              </p>
            </div>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Secure billing
          </div>
        </div>
      </section>

      {/* Current subscription */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Subscription</p>
              <h2 className="mt-1 text-lg font-extrabold text-foreground">Current Plan</h2>
            </div>
            {loadingActivePlan ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading
              </span>
            ) : normalizedCurrentPlan.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Active
              </span>
            ) : (
              <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
                No Active Plan
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/60 p-5 sm:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Shield className="h-7 w-7 stroke-[2]" />
                </div>
                <div>
                  <p className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    {normalizedCurrentPlan.plan_name}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-foreground">
                      ₹{normalizedCurrentPlan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      / {normalizedCurrentPlan.billing_cycle}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 xl:min-w-[330px]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan Period</p>
                  <p className="mt-1 text-xs font-bold text-foreground">
                    {normalizedCurrentPlan.start_date
                      ? new Date(normalizedCurrentPlan.start_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "N/A"}
                    <span className="mx-1 text-muted-foreground">—</span>
                    {normalizedCurrentPlan.end_date
                      ? new Date(normalizedCurrentPlan.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Billing</p>
                  <p className="mt-1 text-xs font-bold text-foreground">
                    {normalizedCurrentPlan.end_date
                      ? new Date(normalizedCurrentPlan.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subscription ID</p>
                  <p className="mt-1 max-w-full truncate rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {normalizedCurrentPlan.subscription_id || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {planSummary && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Days Remaining",
                  value: planSummary.daysRemaining !== null ? `${planSummary.daysRemaining} days` : "N/A",
                  warn: planSummary.daysRemaining !== null && planSummary.daysRemaining <= 15,
                },
                {
                  label: "Duration",
                  value: planSummary.durationDays
                    ? `${planSummary.durationDays} days${planSummary.extensionDays > 0 ? ` + ${planSummary.extensionDays}` : ""}`
                    : "N/A",
                },
                { label: "Payment Status", value: planSummary.status ? planSummary.status.charAt(0) + planSummary.status.slice(1).toLowerCase() : "N/A" },
                { label: "Payment Method", value: planSummary.paymentMethod || "—" },
              ].map((d) => (
                <div key={d.label} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</p>
                  <p className={`mt-1 text-xs font-bold capitalize ${d.warn ? "text-error" : "text-foreground"}`}>{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {planSummary && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[10px] font-semibold text-muted-foreground">
                <span>Plan period elapsed</span>
                <span>{Math.round(planSummary.periodElapsedPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${planSummary.periodElapsedPercent}%` }} />
              </div>
            </div>
          )}

          {planSummary && planSummary.addons.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <PackagePlus className="h-3.5 w-3.5" />
                Active Add-ons
              </p>
              <div className="flex flex-wrap gap-2">
                {planSummary.addons.map((a) => (
                  <span key={a.label} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                    {a.label}
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{a.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Usage */}
        <div className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Plan utilization</p>
              <h2 className="mt-1 text-lg font-extrabold text-foreground">Usage Overview</h2>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>

          {!planSummary || planSummary.quotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage data available.</p>
          ) : (
            <div className="space-y-5">
              {planSummary.quotas.map((q) => {
                const Icon = USAGE_ICONS[q.key] ?? BarChart2;
                const danger = q.overLimit || q.percent >= 90;
                return (
                  <div key={q.key} className={q.enabled ? "" : "opacity-50"}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-foreground">{q.label}</span>
                      </div>
                      <span className={`text-[11px] font-bold ${q.overLimit ? "text-error" : "text-muted-foreground"}`}>
                        {q.used.toLocaleString("en-IN")} / {q.totalLimit?.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${danger ? "bg-error" : "bg-primary"}`}
                        style={{ width: `${Math.max(q.percent, q.used > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>
                        {!q.enabled
                          ? "Not enabled on this plan"
                          : q.overLimit
                            ? `Over limit by ${(q.used - (q.totalLimit ?? 0)).toLocaleString("en-IN")}`
                            : `${Math.round(q.percent)}% used · ${q.remaining?.toLocaleString("en-IN")} remaining`}
                        {q.addonLimit > 0 && (
                          <span className="ml-1 font-semibold text-primary">
                            ({q.baseLimit?.toLocaleString("en-IN")} plan + {q.addonLimit.toLocaleString("en-IN")} add-on)
                          </span>
                        )}
                      </span>
                      {q.nextReset && <span className="shrink-0">Resets {formatPlanDate(q.nextReset)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {planSummary && planSummary.features.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Included features</p>
              <div className="flex flex-wrap gap-2">
                {planSummary.features.map((f) => (
                  <span
                    key={f.key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      f.enabled ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground line-through"
                    }`}
                  >
                    {f.enabled && <Check className="h-3 w-3" />}
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Choose plan */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
              <Rocket className="h-3 w-3" />
              Plans &amp; Pricing
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">Choose your plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select the plan that fits your organization. You can upgrade or downgrade whenever you need.</p>
          </div>

          <div className="inline-flex w-fit items-center rounded-2xl border border-border bg-muted p-1.5">
            <button
              type="button"
              onClick={() => setBillingCycle("MONTHLY")}
              className={`rounded-xl px-5 py-2.5 text-xs font-extrabold transition-all ${billingCycle === "MONTHLY" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("YEARLY")}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold transition-all ${billingCycle === "YEARLY" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Yearly
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${billingCycle === "YEARLY" ? "bg-surface/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>SAVE 20%</span>
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:gap-6">
          {loadingSubscriptionPlans ? (
            <div className="md:col-span-2 rounded-2xl border border-border bg-muted/50 p-12 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-3 text-xs font-semibold text-muted-foreground">Loading plans...</p>
            </div>
          ) : displayPlans.length > 0 ? (
            displayPlans.map((plan) => {
              const isCurrent = normalizedCurrentPlan.plan_name === plan.name;
              const isFree = plan.billingCycle === "FREE";
              return (
                <div
                  key={plan.id}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-200 sm:p-7 ${isCurrent ? "border-primary/50 bg-primary/[0.025] shadow-md" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"}`}
                >
                  {isCurrent && (
                    <div className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary-foreground">Current</div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${isCurrent ? "border-primary/30 bg-primary text-primary-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}>
                        {isFree ? <Star className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-foreground">{plan.name}</h3>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {plan.description || (isFree ? "Essential tools to get started" : "More capacity for growing teams")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-end gap-1.5">
                    <span className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">₹{plan.price.toLocaleString("en-IN")}</span>
                    <span className="mb-1 text-xs font-semibold text-muted-foreground">/{plan.billingCycle.toLowerCase()}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan)}
                    disabled={processingPlan !== null || isCurrent || (isFree && normalizedCurrentPlan.active)}
                    className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition-all ${isCurrent ? "cursor-default border border-border bg-muted text-muted-foreground" : isFree && normalizedCurrentPlan.active ? "cursor-not-allowed border border-border bg-muted text-muted-foreground opacity-60" : "bg-primary text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"}`}
                  >
                    {processingPlan === plan.name ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processing...
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isFree && normalizedCurrentPlan.active ? (
                      "Plan Already Active"
                    ) : isFree ? (
                      "Activate Free Plan"
                    ) : (
                      `Subscribe to ${plan.name}`
                    )}
                  </button>

                  <div className="my-6 h-px bg-border" />
                  <div className="flex-1 space-y-3">
                    {plan.features.map((feature, fIdx) => {
                      const unlimited = feature.limitValue === -1 || String(feature.limitValue).toLowerCase() === "unlimited";
                      const value = unlimited ? "Unlimited" : feature.limitValue ?? "Included";
                      return (
                        <div key={fIdx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                            <span className="truncate font-semibold text-foreground">{feature.label}</span>
                          </div>
                          <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
                            {value}{!unlimited && feature.limitType ? ` ${feature.limitType}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-border bg-muted/50 p-10 text-center">
              <Gem className="mx-auto h-8 w-8 text-primary/60" />
              <p className="mt-3 text-sm font-bold text-foreground">No plans available</p>
              <p className="mt-1 text-xs text-muted-foreground">No {billingCycle.toLowerCase()} subscription plans were returned by the API.</p>
            </div>
          )}
        </div>
      </section>

      {/* Feature explorer */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3 w-3 text-primary" />
            Product features
          </div>
          <h2 className="text-xl font-extrabold text-foreground">Explore Features</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">Explore what each module includes and understand the capabilities available with your subscription.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const isSelected = selectedModule === mod.name;
            return (
              <button
                type="button"
                key={i}
                onClick={() => setSelectedModule(selectedModule === mod.name ? null : mod.name)}
                className={`group rounded-2xl border p-3.5 text-xs font-bold transition-all duration-200 ${isSelected ? "border-primary/40 bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted"}`}
              >
                <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105 ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-2.5 block">{mod.name}</span>
              </button>
            );
          })}
        </div>

        {selectedModule && moduleContent[selectedModule] && (
          <div className="mt-5 rounded-2xl border border-primary/15 bg-muted/50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  {(() => {
                    const Icon = moduleContent[selectedModule].icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">{moduleContent[selectedModule].title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{moduleContent[selectedModule].description}</p>
                </div>
              </div>
              {selectedModule === "Contact" && (
                <div className="flex gap-2">
                  <button type="button" onClick={exportContacts} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted">Export</button>
                  <button type="button" onClick={importContacts} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90">Import</button>
                </div>
              )}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {moduleContent[selectedModule].items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-xs">
                  <span className="font-medium text-muted-foreground">{item.label}</span>
                  <span className="font-extrabold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7 lg:p-8">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">Need help?</p>
          <h2 className="mt-1 text-xl font-extrabold text-foreground">Frequently Asked Questions</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            [HelpCircle, "Can I change plans anytime?", "Yes, upgrades and downgrades can be initiated at any time with prorated adjustments."],
            [CreditCard, "What payment methods work?", "All major credit/debit cards, Net Banking, and UPI via Razorpay secure checkout."],
            [Crown, "Custom enterprise plans?", "Contact support to configure custom message volumes and enterprise seat allowances."],
          ].map(([Icon, title, description], index) => {
            const FAQIcon = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={index} className="rounded-2xl border border-border bg-muted/45 p-5 transition hover:border-primary/25">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <FAQIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold leading-5 text-foreground">{title as string}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description as string}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {payingPlan && (
        <PlanPaymentDialog
          plan={payingPlan}
          onClose={() => setPayingPlan(null)}
          onActivated={async (planName) => {
            setPayingPlan(null);
            await refreshPlanQueries();
            announceSubscriptionActivated(planName);
            router.push("/user/dashboard");
          }}
        />
      )}
    </div>
  );
}
