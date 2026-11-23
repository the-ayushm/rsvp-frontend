"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, CreditCard, Crown, LifeBuoy, LogOut, Menu, Palette, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useThemeColors } from "@/theme";
import Avatar from "@/components/ui/Avatar";
import Dropdown, { DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import IconButton from "@/components/ui/IconButton";
import SubscriptionPanel from "@/features/subscription/components/SubscriptionPanel";
import { WabaStatus } from "@/features/integrations/components/WabaStatus";
import { SUBSCRIPTION_ACTIVATED_EVENT } from "@/features/subscription/utils/checkout";
import { ENTITLEMENTS_UPDATED_EVENT } from "@/features/subscription/utils/entitlements";
import ThemeToggle from "../ThemeToggle";
import styles from "./Topbar.module.css";

/* -----------------------------------------------------------------
   Types
   ----------------------------------------------------------------- */
interface SubscriptionData {
  plan: string;
  startDate: string;
  endDate: string;
  status: string;
  stats?: {
    leadsAdded: number;
    campaignsRun: number;
    contactsManaged: number;
  };
}

type PlanState = "active" | "expiring" | "expired" | "none";

interface CurrentPlan {
  name: string;
  state: PlanState;
  /** Days left on an active plan, when the API returns an end date. */
  daysLeft: number | null;
}

const PLAN_STATE: Record<PlanState, { label: (p: CurrentPlan) => string; dot: string; text: string }> = {
  active: { label: () => "Active", dot: "bg-success", text: "text-success" },
  expiring: {
    label: (p) => (p.daysLeft === 0 ? "Expires today" : `${p.daysLeft}d left`),
    dot: "bg-warning",
    text: "text-warning",
  },
  expired: { label: () => "Expired", dot: "bg-error", text: "text-error" },
  none: { label: () => "No plan", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

/** GET /admin/users/plan/status → what the topbar badge shows. */
async function fetchCurrentPlan(): Promise<CurrentPlan> {
  const res = await soft7AxiosInstance.get("/admin/users/plan/status");
  const plan = res.data?.data;
  if (!plan || typeof plan !== "object" || !plan.plan_name) return { name: "No plan", state: "none", daysLeft: null };

  const end = plan.end_date ? new Date(plan.end_date) : null;
  const daysLeft =
    end && !Number.isNaN(end.getTime()) ? Math.max(Math.ceil((end.getTime() - Date.now()) / 86_400_000), 0) : null;
  const active = plan.active === true && (!end || Number.isNaN(end.getTime()) || end.getTime() > Date.now());

  return {
    name: String(plan.plan_name),
    state: !active ? "expired" : daysLeft !== null && daysLeft <= 7 ? "expiring" : "active",
    daysLeft,
  };
}

const CHATBOT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Intermediate URL segments with no page of their own; linking them would 404.
const NO_INDEX_ROUTES = [
  /^\/user\/(manage|manage\/templates\/phone|ai-assistant\/edit|chatbot-faq\/edit|flows\/builder|flows\/edit|flows\/create\/edit|campaigns\/execute(\/api)?)$/,
  /^\/user\/campaigns\/(?!create$)[^/]+$/,
];

/* -----------------------------------------------------------------
   Topbar
   ----------------------------------------------------------------- */
interface TopbarProps {
  onOpenNavigation: () => void;
  sidebarCollapsed?: boolean;
  isMobile?: boolean;
  onToggleSidebar?: () => void;
}

export function Topbar({
  onOpenNavigation,
  sidebarCollapsed = false,
  isMobile = false,
  onToggleSidebar,
}: TopbarProps) {
  const { setPickerOpen } = useThemeColors();

  /* User & UI state */
  const [userData, setUserData] = useState<{ id: string; name: string; image?: string; walletBalance?: number }>({
    id: "",
    name: "",
  });

  /* Subscription panel (data is loaded by the panel itself) */
  const [subscriptionData] = useState<SubscriptionData | null>(null);
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(false);

  /* Current plan badge */
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const loadCurrentPlan = useCallback(() => {
    fetchCurrentPlan()
      .then(setCurrentPlan)
      .catch(() => setCurrentPlan(null));
  }, []);
  useEffect(() => {
    loadCurrentPlan();
    // Refresh after an upgrade/activation anywhere in the app.
    window.addEventListener(SUBSCRIPTION_ACTIVATED_EVENT, loadCurrentPlan);
    window.addEventListener(ENTITLEMENTS_UPDATED_EVENT, loadCurrentPlan);
    return () => {
      window.removeEventListener(SUBSCRIPTION_ACTIVATED_EVENT, loadCurrentPlan);
      window.removeEventListener(ENTITLEMENTS_UPDATED_EVENT, loadCurrentPlan);
    };
  }, [loadCurrentPlan]);

  const pathname = usePathname() || "/";
  const router = useRouter();

  /* Chatbot breadcrumb name — the builder URL contains the chatbot UUID
     (/user/chatbot/<uuid>/builder); show its name instead of the id. */
  const chatbotId = pathname.match(/^\/user\/chatbot\/([^/]+)(?:\/|$)/i)?.[1] || null;
  const [chatbotName, setChatbotName] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!chatbotId || !CHATBOT_UUID.test(chatbotId)) {
      setChatbotName("");
      return;
    }
    (async () => {
      try {
        const response = await soft7AxiosInstance.get(`/admin/chatbot/${chatbotId}`);
        const name = String(response?.data?.data?.name ?? response?.data?.name ?? "").trim();
        if (!cancelled) setChatbotName(name);
      } catch (error) {
        console.error("Error fetching chatbot name for breadcrumb:", error);
        if (!cancelled) setChatbotName("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatbotId]);

  /* Logged-in user */
  useEffect(() => {
    const savedUser = localStorage.getItem("user_data");
    if (savedUser) {
      try {
        setUserData(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing user_data from localStorage:", e);
      }
    }
  }, []);

  /* Breadcrumbs (the "user" segment is hidden) */
  const rawParts = pathname.split("/").filter(Boolean);
  const filteredParts = rawParts.filter((p) => p.toLowerCase() !== "user");
  const isDashboardPage = pathname === "/" || pathname === "/dashboard" || pathname === "/user/dashboard";
  const breadcrumbItems: { label: string; href?: string }[] = [];
  if (!isDashboardPage && filteredParts.length > 0) {
    breadcrumbItems.push({ label: "Dashboard", href: "/user/dashboard" });
  }
  let urlIndex = 0;
  filteredParts.forEach((part) => {
    while (urlIndex < rawParts.length && rawParts[urlIndex].toLowerCase() === "user") urlIndex++;
    const cumulative = "/" + rawParts.slice(0, urlIndex + 1).join("/");
    const isChatbotId =
      rawParts[urlIndex - 1]?.toLowerCase() === "chatbot" && CHATBOT_UUID.test(rawParts[urlIndex]);
    const pretty = decodeURIComponent(part)
      .replace(/[-_]+/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase());
    const hasNoPage = isChatbotId || NO_INDEX_ROUTES.some((re) => re.test(cumulative));
    breadcrumbItems.push({
      label: isChatbotId ? chatbotName || "Chatbot" : pretty,
      href: hasNoPage ? undefined : cumulative,
    });
    urlIndex++;
  });
  const current = isDashboardPage ? "Dashboard" : breadcrumbItems[breadcrumbItems.length - 1]?.label ?? "Dashboard";
  const trail = isDashboardPage ? [] : breadcrumbItems.slice(0, -1);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Also clear auth cookies from the client side
    for (const name of ["consoleAccessToken", "accessToken", "refreshToken", "adminToken", "company_id", "user_role"]) {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    }
    localStorage.clear();
    router.push("/auth");
  };

  return (
    <>
      <header className={styles.topbar}>
        {/* Title / breadcrumbs */}
        <div className={styles.titleArea}>
          {isMobile && (
            <IconButton
              aria-label="Open navigation"
              className={styles.menuButton}
              icon={<Menu size={19} />}
              onClick={onOpenNavigation}
            />
          )}
          {/* The dashboard has its own greeting, so no page title there. */}
          {!isDashboardPage && <nav aria-label="Breadcrumb" className={styles.crumbs}>
            {trail.length > 0 && (
              <span className={styles.crumbsTrail}>
                {trail.map((item, idx) => (
                  <Fragment key={`${item.label}-${idx}`}>
                    {item.href ? (
                      <Link href={item.href} className={styles.crumb}>
                        {item.label}
                      </Link>
                    ) : (
                      <span className={styles.crumb}>{item.label}</span>
                    )}
                    <ChevronRight size={14} className={styles.crumbSeparator} aria-hidden />
                  </Fragment>
                ))}
              </span>
            )}
            <span className={styles.current} aria-current="page">
              {current}
            </span>
          </nav>}
        </div>

        {/* WhatsApp Business API status per WABA, centred in the bar; "Apply now" when pending */}
        <div className={styles.waba}>
          <WabaStatus />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Current plan — opens the subscription sidebar */}
          <button
            type="button"
            onClick={() => setShowSubscriptionPanel(true)}
            aria-label={currentPlan ? `Current plan: ${currentPlan.name}, ${PLAN_STATE[currentPlan.state].label(currentPlan)}` : "Subscription"}
            title="View subscription"
            className="group inline-flex h-9 max-w-[16rem] items-center gap-2 rounded-full border border-border bg-surface pl-1 pr-3 text-left transition hover:border-primary hover:bg-primary-light"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text group-hover:bg-surface">
              <Crown size={15} />
            </span>
            {currentPlan ? (
              <span className={cn("flex min-w-0 items-center gap-2", styles.hideSm)}>
                <span className="truncate text-sm font-semibold text-foreground">{currentPlan.name}</span>
                <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold", PLAN_STATE[currentPlan.state].text)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", PLAN_STATE[currentPlan.state].dot)} />
                  {PLAN_STATE[currentPlan.state].label(currentPlan)}
                </span>
              </span>
            ) : (
              <span className={cn("text-sm font-semibold text-foreground", styles.hideSm)}>Plan</span>
            )}
          </button>

          <span className={cn(styles.divider, styles.hideSm)} aria-hidden />

          <ThemeToggle />
          <IconButton
            aria-label="Customize theme"
            className={styles.hideSm}
            icon={<Palette size={18} />}
            onClick={() => setPickerOpen(true)}
          />

          <span className={cn(styles.divider, styles.hideSm)} aria-hidden />

          {/* Profile */}
          <Dropdown
            width="14rem"
            trigger={
              <button type="button" className={styles.profileButton} aria-label="Account menu">
                <Avatar name={userData.name} src={userData.image} size="sm" />
                <span className={styles.profileName}>{userData.name}</span>
              </button>
            }
          >
            <div className={styles.menuHeader}>
              <p className={styles.menuHeaderName}>{userData.name || "Account"}</p>
            </div>
            <DropdownItem href="/user/settings/profile" icon={<User size={15} />}>
              Profile
            </DropdownItem>
            <DropdownItem href="/user/settings" icon={<Settings size={15} />}>
              Settings
            </DropdownItem>
            <DropdownItem href="/user/settings/billing" icon={<CreditCard size={15} />}>
              Billing
            </DropdownItem>
            <DropdownItem onSelect={() => setShowSubscriptionPanel(true)} icon={<Crown size={15} />}>
              Subscription
            </DropdownItem>
            <DropdownItem onSelect={() => setPickerOpen(true)} icon={<Palette size={15} />}>
              Appearance
            </DropdownItem>
            <DropdownItem
              onSelect={() => window.dispatchEvent(new Event("soft7:open-support"))}
              icon={<LifeBuoy size={15} />}
            >
              Help & support
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onSelect={handleLogout} icon={<LogOut size={15} />}>
              Log out
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Subscription panel — portal so fixed positioning is viewport-relative */}
      {showSubscriptionPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <SubscriptionPanel subscriptionData={subscriptionData} onClose={() => setShowSubscriptionPanel(false)} />,
          document.body,
        )}
    </>
  );
}

export default Topbar;
