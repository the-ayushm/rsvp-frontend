"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { UpgradePlanModal } from "@/features/subscription/components/UpgradePlanModal";
import { SubscriptionCelebration } from "@/features/subscription/components/SubscriptionCelebration";
import {
  SUBSCRIPTION_ACTIVATED_EVENT,
  announceSubscriptionActivated,
  type SubscriptionActivatedDetail,
} from "@/features/subscription/utils/checkout";
import { ENTITLEMENTS_UPDATED_EVENT } from "@/features/subscription/utils/entitlements";

const AUTH_ROUTES = ["/", "/login", "/signup", "/auth", "/team/setup-password"];

interface ExpiredPlanInfo {
  planName: string | null;
  endDate: string | null;
}

// Last-resort check used only when the plan status API gives us nothing usable.
function hasActivePlanInLocalStorage() {
  try {
    const userData = localStorage.getItem("user_data");
    if (!userData) return false;
    const parsed = JSON.parse(userData);
    const planEndDate = parsed?.plan_end_date ? new Date(parsed.plan_end_date) : null;
    return parsed?.plan_active === true && (!planEndDate || planEndDate > new Date());
  } catch {
    return false;
  }
}

export function PlanCheckWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [hasPlan, setHasPlan] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPastPlans, setHasPastPlans] = useState<boolean>(false);
  const [expiredPlan, setExpiredPlan] = useState<ExpiredPlanInfo | null>(null);
  const [celebratePlan, setCelebratePlan] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname || AUTH_ROUTES.includes(pathname) || pathname.startsWith("/admin")) {
      setIsLoading(false);
      return;
    }

    // ✅ Only enforce plan check for role === "user"
    try {
      const userData = localStorage.getItem("user_data");
      if (userData) {
        const parsed = JSON.parse(userData);
        const role = String(parsed?.role ?? "").toLowerCase();
        if (role !== "user") {
          setHasPlan(true);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // If we can't read the role, fall through to the plan check
    }

    let cancelled = false;

    const checkPlanStatus = async () => {
      try {
        const response = await soft7AxiosInstance.get("/admin/users/plan/status");
        const status = response.data?.success ? response.data?.data : null;
        if (cancelled) return;

        if (status?.active) {
          setHasPlan(true);
          setExpiredPlan(null);
          return;
        }

        let pastPlans = false;
        try {
          const pastPlansRes = await soft7AxiosInstance.get("/admin/users/plans");
          pastPlans =
            pastPlansRes.data?.success &&
            Array.isArray(pastPlansRes.data?.data) &&
            pastPlansRes.data.data.length > 0;
        } catch (e) {
          console.error("Failed to fetch past plans:", e);
        }
        if (cancelled) return;
        setHasPastPlans(pastPlans);

        // The API explicitly reported an inactive plan → the plan is expired, block the user.
        if (status && status.active === false) {
          setExpiredPlan({
            planName: status.plan_name ?? null,
            endDate: status.end_date ?? null,
          });
          setHasPlan(false);
          return;
        }

        // No plan info returned — trust local storage only if it shows a still-valid plan.
        if (hasActivePlanInLocalStorage()) {
          setHasPlan(true);
          return;
        }
        setExpiredPlan(pastPlans ? { planName: null, endDate: null } : null);
        setHasPlan(false);
      } catch (error) {
        console.error("Failed to check plan status:", error);
        // Fallback to local storage on network/API failure so we don't lock out valid users
        if (!cancelled) setHasPlan(hasActivePlanInLocalStorage());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkPlanStatus();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Any plan activation (from this popup or the Billing page) unlocks the app and celebrates.
  useEffect(() => {
    const onActivated = (event: Event) => {
      const { planName } = (event as CustomEvent<SubscriptionActivatedDetail>).detail ?? {};
      setHasPlan(true);
      setExpiredPlan(null);
      setCelebratePlan(planName || "new");
      queryClient.invalidateQueries({ queryKey: ["active-subscription-plan"] });
      queryClient.invalidateQueries({ queryKey: ["users-data-billing"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    };
    window.addEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated);
    return () => window.removeEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onActivated);
  }, [queryClient]);

  // Add-on activated: same plan, higher allowances — refresh cached plan data (no celebration).
  useEffect(() => {
    const onEntitlementsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["active-subscription-plan"] });
      queryClient.invalidateQueries({ queryKey: ["users-data-billing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "plan"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-entitlements"] });
    };
    window.addEventListener(ENTITLEMENTS_UPDATED_EVENT, onEntitlementsUpdated);
    return () => window.removeEventListener(ENTITLEMENTS_UPDATED_EVENT, onEntitlementsUpdated);
  }, [queryClient]);

  const handleLogout = () => {
    localStorage.removeItem("console_access_token");
    document.cookie = "consoleAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = "/";
  };

  const closeCelebration = useCallback(() => setCelebratePlan(null), []);

  const showUpgradeModal = !isLoading && !hasPlan && !!pathname && !AUTH_ROUTES.includes(pathname);

  return (
    <>
      {children}

      {showUpgradeModal && (
        <UpgradePlanModal
          expired={expiredPlan !== null}
          expiredPlanName={expiredPlan?.planName}
          expiredOn={expiredPlan?.endDate}
          allowFreePlan={!hasPastPlans}
          onActivated={announceSubscriptionActivated}
          onLogout={handleLogout}
        />
      )}

      {celebratePlan && (
        <SubscriptionCelebration planName={celebratePlan} onClose={closeCelebration} />
      )}
    </>
  );
}
