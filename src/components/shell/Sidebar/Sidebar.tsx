/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FocusEvent, MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Blocks,
  Bot,
  CalendarClock,
  ChevronDown,
  CodeXml,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  Lock,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Settings2,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { hasPermissionKey, isTeamMemberUser } from "@/lib/permissions";
import IconButton from "@/components/ui/IconButton";
import { DoveKnotLogo, DoveKnotMark } from "@/components/brand/DoveKnotLogo";
import styles from "./Sidebar.module.css";

/* ─────────────────────────────────────────────────────────────────────────────
   Navigation config — the single place the app's navigation is defined.
   `navKey` maps to team-member permissions (see lib/permissions).
   ───────────────────────────────────────────────────────────────────────── */

interface NavLink {
  type: "link";
  navKey: string;
  label: string;
  href: string;
  icon: ReactNode;
}
interface NavGroup {
  type: "group";
  id: string;
  navKey: string;
  label: string;
  icon: ReactNode;
  /** `logo` is an optional brand image shown before the label (e.g. the Inbox channels). */
  children: { label: string; href: string; logo?: string }[];
}
type NavEntry = NavLink | NavGroup;

const ICON = 18;

const NAV_SECTIONS: { title: string; items: NavEntry[] }[] = [
  {
    title: "Workspace",
    items: [
      { type: "link", navKey: "dashboard", label: "Dashboard", href: "/user/dashboard", icon: <LayoutDashboard size={ICON} /> },
      {
        type: "group",
        id: "inbox",
        navKey: "inbox",
        label: "Inbox",
        icon: <Inbox size={ICON} />,
        children: [
          { label: "WhatsApp", href: "/user/inbox", logo: "/whatsapp-logo.jpg" },
          { label: "Facebook Messenger", href: "/user/inbox/messenger", logo: "/messenger-logo.svg" },
        ],
      },
      {
        type: "group",
        id: "contacts",
        navKey: "contact",
        label: "Contacts",
        icon: <Users size={ICON} />,
        children: [
          { label: "Contact List", href: "/user/contacts" },
          { label: "Sales Pipeline", href: "/user/contacts/sales-pipeline" },
        ],
      },
      { type: "link", navKey: "campaigns", label: "Campaigns", href: "/user/campaigns", icon: <Megaphone size={ICON} /> },
      { type: "link", navKey: "upload_media", label: "Upload Media", href: "/user/manage/upload-image", icon: <ImageIcon size={ICON} /> },
    ],
  },
  {
    title: "Automation",
    items: [
      { type: "link", navKey: "chatbot", label: "Chatbot", href: "/user/chatbot", icon: <Bot size={ICON} /> },
      { type: "link", navKey: "ai_assistant", label: "AI Assistant", href: "/user/ai-assistant", icon: <Sparkles size={ICON} /> },
      { type: "link", navKey: "flows", label: "Flows", href: "/user/flows", icon: <Workflow size={ICON} /> },
      { type: "link", navKey: "schedules", label: "Schedules", href: "/user/reminder", icon: <CalendarClock size={ICON} /> },
    ],
  },
  {
    title: "Configure",
    items: [
      { type: "link", navKey: "integrations", label: "Integrations", href: "/user/integrations", icon: <Blocks size={ICON} /> },
      {
        type: "group",
        id: "manage",
        navKey: "manage",
        label: "Manage",
        icon: <Settings2 size={ICON} />,
        children: [
          { label: "WhatsApp Templates", href: "/user/manage/templates" },
          { label: "Flow Builder", href: "/user/manage/whatsapp-flows" },
          { label: "Tags", href: "/user/manage/tags" },
          { label: "Columns", href: "/user/manage/columns" },
          { label: "Pipeline Stages", href: "/user/manage/stages" },
          { label: "Opts Management", href: "/user/manage/opts-management" },
        ],
      },
      {
        type: "group",
        id: "developers",
        navKey: "developers",
        label: "Developers",
        icon: <CodeXml size={ICON} />,
        children: [
          { label: "WhatsApp Business API", href: "/user/whatsapp-business-api" },
          { label: "API Documentation", href: "/user/whatsapp-api-docs" },
        ],
      },
    ],
  },
];

const SETTINGS: NavLink = {
  type: "link",
  navKey: "settings",
  label: "Settings",
  href: "/user/settings",
  icon: <Settings size={ICON} />,
};

const COLLAPSE_KEY = "doveknot_sidebar_collapsed";

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/user/dashboard" && pathname.startsWith(`${href}/`));

/** Exact match for sub-items so "/user/contacts" isn't active on the pipeline page */
const isSubActive = (pathname: string, href: string, siblings: { href: string }[]) =>
  pathname === href ||
  (pathname.startsWith(`${href}/`) && !siblings.some((s) => s.href !== href && pathname.startsWith(s.href)));

/* ─────────────────────────────────────────────────────────────────────────── */

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname() || "";
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : (desktopCollapsed && !isMobile);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [allowedNav, setAllowedNav] = useState<string[] | null>(null); // null = no restriction
  const [floating, setFloating] = useState<{ label: string; top: number; left: number } | null>(null);

  const navRef = useRef<HTMLElement>(null);
  const scrollPosRef = useRef(0);

  /* Layout state */
  useEffect(() => {
    try {
      setDesktopCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleCollapsed = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setDesktopCollapsed((prev) => {
        try {
          localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
        } catch {
          /* ignore */
        }
        return !prev;
      });
    }
    setFloating(null);
  };

  /* Auto-open the group that contains the current route; close mobile drawer */
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.type === "group" && item.children.some((c) => isRouteActive(pathname, c.href))) {
          next[item.id] = true;
        }
      }
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* Persist nav scroll position across navigations */
  useEffect(() => {
    if (navRef.current) navRef.current.scrollTop = scrollPosRef.current;
  }, [pathname]);

  useEffect(() => {
    // Load permissions — only if the user is a team member
    if (isTeamMemberUser()) {
      const savedPerms = localStorage.getItem("permissions");
      if (savedPerms !== null) {
        try {
          const parsed = JSON.parse(savedPerms);
          setAllowedNav(Array.isArray(parsed) ? parsed.map((p: string) => p.toLowerCase()) : []);
        } catch {
          setAllowedNav([]);
        }
      } else {
        setAllowedNav([]);
      }
    } else {
      setAllowedNav(null);
      localStorage.removeItem("permissions");
    }

  }, []);

  /* Fetch latest permissions dynamically from backend (only for team members) */
  const fetchPermissions = useCallback(async () => {
    if (!isTeamMemberUser()) {
      setAllowedNav(null);
      localStorage.removeItem("permissions");
      return;
    }
    try {
      const res = await soft7AxiosInstance.get("/admin/team/my-permissions");
      const perms = res.data?.data?.permissions;
      if (Array.isArray(perms)) {
        const lower = perms.map((p: string) => p.toLowerCase());
        setAllowedNav(lower);
        localStorage.setItem("permissions", JSON.stringify(lower));
      }
    } catch {
      // keep existing localStorage if network fails
    }
  }, []);

  useEffect(() => {
    if (!isTeamMemberUser()) {
      setAllowedNav(null);
      return;
    }
    fetchPermissions();
    const handleFocus = () => fetchPermissions();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchPermissions]);

  /* Check for assigned contacts if general contact permission is missing */
  useEffect(() => {
    const checkAssignedContacts = async () => {
      if (allowedNav && !allowedNav.includes("contact") && !allowedNav.includes("contacts")) {
        try {
          const res = await soft7AxiosInstance.get("/admin/contacts?limit=1");
          if (res.data?.success && res.data?.data?.contacts?.length > 0) {
            const newPerms = [...allowedNav, "contact"];
            setAllowedNav(newPerms);
            localStorage.setItem("permissions", JSON.stringify(newPerms));
          }
        } catch (err) {
          console.error("Failed to check assigned contacts:", err);
        }
      }
    };
    checkAssignedContacts();
  }, [allowedNav]);

  const isAllowed = (key: string) => {
    if (!isTeamMemberUser()) return true;
    if (allowedNav === null) return false;
    return hasPermissionKey(allowedNav, key);
  };

  /* Collapsed-mode labels rendered in a fixed layer (escapes overflow) */
  const labelProps = (label: string) =>
    collapsed
      ? {
          onMouseEnter: (e: MouseEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            setFloating({ label, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onMouseLeave: () => setFloating(null),
          onFocus: (e: FocusEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect();
            setFloating({ label, top: r.top + r.height / 2, left: r.right + 10 });
          },
          onBlur: () => setFloating(null),
          "aria-label": label,
        }
      : {};

  const renderLocked = (label: string, icon: ReactNode) => (
    <li key={label}>
      <span
        className={cn(styles.item, styles.locked)}
        aria-disabled="true"
        title="Not permitted"
        {...labelProps(`${label} · Not permitted`)}
      >
        <span className={styles.icon}>{icon}</span>
        <span className={styles.label}>{label}</span>
        <Lock size={13} className={styles.lockIcon} aria-hidden />
      </span>
    </li>
  );

  const renderLink = (item: NavLink) => {
    if (!isAllowed(item.navKey)) return renderLocked(item.label, item.icon);
    const active = isRouteActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={cn(styles.item, active && styles.active)}
          aria-current={active ? "page" : undefined}
          {...labelProps(item.label)}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </Link>
      </li>
    );
  };

  const renderGroup = (group: NavGroup) => {
    if (!isAllowed(group.navKey)) return renderLocked(group.label, group.icon);
    const open = !!openGroups[group.id];
    const containsActive = group.children.some((c) => isRouteActive(pathname, c.href));
    const subId = `nav-group-${group.id}`;
    return (
      <li key={group.id}>
        <button
          type="button"
          className={cn(styles.item, open && styles.groupOpen, containsActive && styles.groupActive)}
          aria-expanded={open}
          aria-controls={subId}
          onClick={() => {
            if (collapsed) {
              toggleCollapsed();
              setOpenGroups((p) => ({ ...p, [group.id]: true }));
            } else {
              setOpenGroups((p) => ({ ...p, [group.id]: !open }));
            }
          }}
          {...labelProps(group.label)}
        >
          <span className={styles.icon}>{group.icon}</span>
          <span className={styles.label}>{group.label}</span>
          <ChevronDown size={15} className={styles.chevron} aria-hidden />
        </button>
        {open && (
          <ul id={subId} className={styles.subList}>
            {group.children.map((child) => {
              const active = isSubActive(pathname, child.href, group.children);
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={cn(styles.subItem, active && styles.subActive, child.logo && "flex items-center gap-2")}
                    aria-current={active ? "page" : undefined}
                  >
                    {child.logo && (
                      <img src={child.logo} alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded object-contain" />
                    )}
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {mobileOpen && <div className={styles.backdrop} onClick={onMobileClose} aria-hidden />}
      <aside
        className={cn(styles.sidebar, collapsed && styles.collapsed, mobileOpen && styles.mobileOpen)}
        aria-label="Main navigation"
      >
        {collapsed ? (
          <button
            type="button"
            className={cn(styles.brand, styles.brandCollapsedButton)}
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar (Ctrl+B)"
            {...labelProps("Expand sidebar")}
          >
            <span className={styles.brandMark}>
              <DoveKnotMark className="h-9 w-9" priority />
              <span className={styles.logoHoverIcon} aria-hidden>
                <PanelLeftOpen size={16} />
              </span>
            </span>
          </button>
        ) : (
          <div className={styles.brand}>
            <DoveKnotLogo light priority className={styles.doveknotLogo} markClassName="h-9 w-9" />
            <IconButton
              aria-label="Collapse sidebar"
              title="Collapse sidebar (Ctrl+B)"
              size="sm"
              className={styles.collapseButton}
              icon={<PanelLeftClose size={17} />}
              onClick={toggleCollapsed}
            />
          </div>
        )}

        <nav
          ref={navRef}
          className={styles.nav}
          onScroll={() => {
            scrollPosRef.current = navRef.current?.scrollTop ?? 0;
            setFloating(null);
          }}
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              <ul className={styles.list}>
                {section.items.map((item) => (item.type === "link" ? renderLink(item) : renderGroup(item)))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <ul className={styles.list}>
            {renderLink(SETTINGS)}
            <li>
              <button
                type="button"
                className={cn(styles.item, styles.expandButton)}
                onClick={toggleCollapsed}
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
                {...labelProps("Expand sidebar")}
              >
                <span className={styles.icon}>
                  <PanelLeftOpen size={ICON} />
                </span>
                <span className={styles.label}>Expand sidebar</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {collapsed && floating && (
        <div className={styles.floatingLabel} style={{ top: floating.top, left: floating.left }} role="tooltip">
          {floating.label}
        </div>
      )}
    </>
  );
}

export default Sidebar;
