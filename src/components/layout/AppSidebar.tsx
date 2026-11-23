/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

import { Settings as SettingsIcon } from "lucide-react"; // optional, only if you want a settings icon
import { useTheme } from "next-themes";

import {
  ChevronDown,
  ChevronUp,
  Home,
  User,
  BarChart2,
  Settings,
  Inbox,
  Blocks,
  Cog,
  Image as ImageIcon,
  Bot,
  Cable,
  BookOpenText,
  FolderCode,
  Zap,
  Moon,
  Sun,
  Bell,
  MessageSquare,
  LayoutGrid, ContactRound, FileText, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import ProfileCard from "@/components/ProfileCard";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useCompany } from "@/context/CompanyContext";
import "../sidebar-contacts.css";

interface UserData {
  id?: number;
  name: string;
  email: string;
  image?: string;
  role?: string;
}

import { isTeamMemberUser, hasPermissionKey } from "@/lib/permissions";


interface SidebarItemProps {
  expanded: boolean;
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children?: React.ReactNode;
}

function SidebarItem({
  expanded,
  icon,
  label,
  href,
  onClick,
  className,
  children,
}: SidebarItemProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = href && (pathname === href || (href !== "/user/dashboard" && pathname.startsWith(`${href}/`)));
  const baseClasses =
    "relative flex items-center gap-3 p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group sidebar-item";
  const activeClasses = "sidebar-item-active";
  const inactiveClasses = "";

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    else if (href) router.push(href);
  };

  return (
    <li
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`${baseClasses} ${
        isActive ? activeClasses : inactiveClasses
      } ${className || ""}`}
    >
      {children ? (
        children
      ) : (
        <>
          {/* Icon */}
          <div
            className={`transition-colors duration-300 ${
              isActive ? "sidebar-icon-active" : "sidebar-icon-inactive"
            }`}
          >
            {icon}
          </div>

          {/* Label */}
          <span
            className={`overflow-hidden whitespace-nowrap ${
              "block"
            }`}
          >
            {label}
          </span>

          {/* Tooltip when collapsed */}
          {false && (
            <div
              className="sidebar-tooltip absolute left-full rounded-md px-2 py-1 ml-6 text-sm
                invisible opacity-0 translate-x-3 transition-all duration-300
                group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-[var(--z-overlay)]"
            >
              {label}
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { companyLogo: contextLogo } = useCompany();
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(media.matches);
      setExpanded(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setExpanded(false);
  }, [pathname]);
  useEffect(() => {
    const toggle = () => setExpanded(value => !value);
    window.addEventListener("toggle-sidebar", toggle);
    return () => window.removeEventListener("toggle-sidebar", toggle);
  }, []);
  const [manageOpen, setManageOpen] = useState(pathname?.startsWith("/user/manage") || false);
  const [contactsOpen, setContactsOpen] = useState(pathname?.startsWith("/user/contacts") || false);
  const [developersOpen, setDevelopersOpen] = useState(false);
  const devDropdownRef = useRef<HTMLLIElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const scrollPosRef = useRef(0);

  // Persist sidebar scroll position across navigations
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // Restore saved position immediately after pathname changes
    nav.scrollTop = scrollPosRef.current;
  }, [pathname]);

  // Scroll the Developers dropdown into view whenever it opens
  useEffect(() => {
    if (developersOpen && devDropdownRef.current) {
      setTimeout(() => {
        devDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50); // small delay lets the max-h transition start first
    }
  }, [developersOpen]);

  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [allowedNav, setAllowedNav] = useState<string[] | null>(null); // null = no restriction
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    if (contextLogo) {
      setCompanyLogo(contextLogo);
    }
  }, [contextLogo]);

  useEffect(() => {
    if (pathname?.startsWith("/user/contacts")) {
      setContactsOpen(true);
    }
    if (pathname?.startsWith("/user/manage")) {
      setManageOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/user/contacts")) {
      setContactsOpen(true);
    }
    if (pathname?.startsWith("/user/manage")) {
      setManageOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user_data");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Error parsing user_data from localStorage:", err);
      }
    }
    // Load permissions — only if the user is a team member
    if (isTeamMemberUser()) {
      const savedPerms = localStorage.getItem("permissions");
      if (savedPerms !== null) {
        try {
          const parsed = JSON.parse(savedPerms);
          if (Array.isArray(parsed)) {
            setAllowedNav(parsed.map((p: string) => p.toLowerCase()));
          } else {
            setAllowedNav([]);
          }
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

    // Fetch company logo dynamically
    const fetchCompanyLogo = async () => {
      try {
        let companyId = localStorage.getItem("company_id");
        if (!companyId) {
          const savedUser = localStorage.getItem("user_data");
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            companyId = parsedUser?.company_id || parsedUser?.companyId;
          }
        }
        
        if (companyId) {
          const res = await soft7AxiosInstance.get(`/admin/companies/${companyId}`);
          
          if (res.data?.data?.logo) {
            setCompanyLogo(res.data.data.logo);
          } else if (res.data?.logo) {
            setCompanyLogo(res.data.logo);
          }
        }
      } catch {
        // Silently ignore if company endpoint is not available
      }
    };
    fetchCompanyLogo();
  }, []);

  // Fetch latest permissions dynamically from backend (only for team members)
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
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchPermissions]);


  // Check for assigned contacts if general contact permission is missing
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

  // Helper: returns true if the nav key is allowed (or if no restriction exists)
  const isAllowed = (key: string) => {
    if (!isTeamMemberUser()) return true;
    if (allowedNav === null) return false;
    return hasPermissionKey(allowedNav, key);
  };

  // Wrapper that greys out + shows "Not permitted" tooltip for restricted items
  const NavGuard = ({ navKey, children }: { navKey: string; children: React.ReactNode }) => {
    const allowed = isAllowed(navKey);
    if (allowed) return <>{children}</>;
    return (
      <div className="relative group/guard" style={{ opacity: 0.38, pointerEvents: 'none', cursor: 'not-allowed' }}>
        {children}
        {/* tooltip */}
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap z-[var(--z-overlay)]
            bg-ink text-paper opacity-0 pointer-events-none
            group-hover/guard:opacity-100 transition-opacity duration-150"
          style={{ pointerEvents: 'none' }}
        >
          🔒 Not permitted
        </div>
      </div>
    );
  };

  return (
    <>
      {isMobile && expanded && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setExpanded(false)} />
      )}
      <aside
        data-app-sidebar
        data-expanded={expanded}
        data-rail={!expanded}
        className={`${
          expanded ? "w-64" : "w-20"
        }  h-screen transition-all duration-300 ease-in-out font-sans`}
      >
        <div className="bg-background text-foreground h-full flex flex-col border-r border-border shadow-xs">
          {/* ✅ Logo Section */}
          <div
            role="button"
            tabIndex={0}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(!expanded);
              }
            }}
            className="flex items-center justify-center border-b border-border h-16 cursor-pointer hover:bg-primary/10 transition duration-150"
            onClick={() => setExpanded(!expanded)}
          >
            {/* Expanded View Logo */}
            <div
              className={`flex items-center justify-center transition-opacity duration-300 w-full py-0 ${
                expanded ? "opacity-100" : "opacity-0 hidden"
              }`}
            >
              {/* ✅ Only render Image when logo URL is known — prevents Soft7 logo flash */}
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border shadow-2xs flex items-center justify-center bg-card">
                {companyLogo && (
                  <Image
                    src={companyLogo}
                    alt="Company Logo"
                    fill
                    sizes="48px"
                    priority
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                )}
                {!companyLogo && <MessageSquare size={24} className="text-primary" />}
              </div>
            </div>

            {/* Collapsed View Logo */}
            <div
              className={`flex items-center justify-center transition-opacity duration-300 w-full py-0 ${
                expanded ? "hidden opacity-0" : "block opacity-100"
              }`}
            >
              {/* ✅ Only render Image when logo URL is known — prevents Soft7 logo flash */}
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border shadow-2xs flex items-center justify-center bg-card">
                {companyLogo && (
                  <Image
                    src={companyLogo}
                    alt="Company Logo Small"
                    fill
                    sizes="40px"
                    priority
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                )}
                {!companyLogo && <MessageSquare size={20} className="text-primary" />}
              </div>
            </div>
          </div>
          {/* Navigation Section */}
          <nav
            ref={navRef}
            onScroll={() => { scrollPosRef.current = navRef.current?.scrollTop ?? 0; }}
            className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar"
          >
            <ul>
              <NavGuard navKey="dashboard">
                <SidebarItem expanded={expanded} icon={<LayoutGrid size={24} />} label="Dashboard" href="/user/dashboard" />
              </NavGuard>

              {/* Contacts Dropdown */}
              <NavGuard navKey="contact">
                {!expanded ? <SidebarItem expanded={false} icon={<ContactRound size={24} />} label="Contacts" href="/user/contacts" className="sidebar-contacts-rail" /> : (
                <li className="sidebar-contacts my-1 font-medium rounded-xl">
                  <button type="button" className="sidebar-contacts-toggle flex items-center justify-between w-full p-3 rounded-xl transition-colors duration-150" aria-expanded={contactsOpen} aria-controls="sidebar-contacts-submenu" onClick={() => setContactsOpen(!contactsOpen)}>
                    <div className="flex items-center gap-3">
                      <User size={20} />
                      <span className="font-semibold">Contacts</span>
                    </div>
                    {contactsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div id="sidebar-contacts-submenu" inert={!contactsOpen} className={`sidebar-contacts-submenu overflow-hidden transition-all duration-300 ${contactsOpen && expanded ? "max-h-96 pb-2" : "max-h-0"}`}>
                    <ul className="ml-8 mr-3 space-y-1 text-sm border-l-2">
                      <LinkItem href="/user/contacts" label="Contact List" contacts />
                      <LinkItem href="/user/contacts/sales-pipeline" label="Sales Pipeline" contacts />
                    </ul>
                  </div>
                </li>
                )}
              </NavGuard>

              <NavGuard navKey="inbox">
                <SidebarItem expanded={expanded} icon={<Inbox size={20} />} label="Inbox" href="/user/inbox" />
              </NavGuard>

              <NavGuard navKey="manage">
                <SidebarItem expanded={expanded} icon={<FileText size={24} />} label="Templates" href="/user/manage/templates" />
              </NavGuard>

              <NavGuard navKey="campaigns">
                <SidebarItem expanded={expanded} icon={<BarChart2 size={20} />} label="Campaigns" href="/user/campaigns" />
              </NavGuard>

              <NavGuard navKey="integrations">
                <SidebarItem expanded={expanded} icon={<Blocks size={20} />} label="Integrations" href="/user/integrations" />
              </NavGuard>

              {/* Manage Dropdown */}
              <NavGuard navKey="manage">
                <li className={`p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group ${manageOpen ? "bg-primary/10 text-foreground" : "text-ink/80 hover:text-foreground hover:bg-primary/5"}`}>
                  <div className="flex items-center justify-between" role="button" tabIndex={0} aria-label="Manage" aria-expanded={expanded && manageOpen}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(true); setManageOpen(expanded ? !manageOpen : true); } } }
                    onClick={() => { setExpanded(true); setManageOpen(expanded ? !manageOpen : true); } }>
                    <div className="flex items-center gap-3">
                      <Cog size={20} className="text-terracotta" />
                      <span className="text-foreground font-semibold">Manage</span>

                    </div>
                    {expanded && <div className="text-muted-foreground">{manageOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>}
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${manageOpen && expanded ? "max-h-96 mt-2" : "max-h-0"}`}>
                    <ul className="ml-5 mt-2 space-y-1 text-sm border-l-2 border-border">
                      <LinkItem href="/user/manage/templates" label="WhatsApp Templates" />
                      <LinkItem href="/user/manage/whatsapp-flows" label="Flow Builder" />
                      <LinkItem href="/user/manage/tags" label="Tags" />
                      <LinkItem href="/user/manage/columns" label="Columns" />
                      <LinkItem href="/user/manage/stages" label="Pipeline Stages" />
                      <LinkItem href="/user/manage/opts-management" label="Opts Management" />
                      {/* <LinkItem href="/user/manage/webhooks" label="Webhook Events" /> */}
                      <LinkItem href="/user/manage/upload-image" label="Upload Media" />
                    </ul>
                  </div>
                </li>
              </NavGuard>

              <NavGuard navKey="chatbot">
                <SidebarItem expanded={expanded} icon={<Bot size={20} />} label="Chatbot" href="/user/chatbot" />
              </NavGuard>

              <NavGuard navKey="ai_assistant">
                <SidebarItem expanded={expanded} icon={<Bot size={20} />} label="AI Assistant" href="/user/ai-assistant" />
              </NavGuard>

              {false && (
                <NavGuard navKey="knowledge">
                  <SidebarItem expanded={expanded} icon={<BookOpenText size={20} />} label="Knowledge Base" href="/user/knowledge-base" />
                </NavGuard>
              )}

              {/* Developers Dropdown */}
              <NavGuard navKey="developers">
                <li ref={devDropdownRef} className={`p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group ${developersOpen ? "bg-primary/10 text-foreground" : "text-ink/80 hover:text-foreground hover:bg-primary/5"}`}>
                  <div className="flex items-center justify-between" role="button" tabIndex={0} aria-label="Developers" aria-expanded={expanded && developersOpen}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(true); setDevelopersOpen(expanded ? !developersOpen : true); } } }
                    onClick={() => { setExpanded(true); setDevelopersOpen(expanded ? !developersOpen : true); } }>
                    <div className="flex items-center gap-3">
                      <FolderCode size={20} className="text-terracotta" />
                      <span className="text-foreground font-semibold">Developers</span>

                    </div>
                    {expanded && <div className="text-muted-foreground">{developersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>}
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${developersOpen && expanded ? "max-h-96 mt-2" : "max-h-0"}`}>
                    <ul className="ml-5 mt-2 space-y-1 text-sm border-l-2 border-border">
                      <li>
                        <Link
                          href="/user/whatsapp-business-api"
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ${pathname === "/user/whatsapp-business-api" ? "text-terracotta font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"}`}
                        >
                          WhatsApp Business API
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/user/whatsapp-api-docs"
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ${pathname === "/user/whatsapp-api-docs" ? "text-terracotta font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"}`}
                        >
                          WhatsApp Api Document
                        </Link>
                      </li>
                    </ul>
                  </div>
                </li>
              </NavGuard>
              <NavGuard navKey="schedules">
                <SidebarItem expanded={expanded} icon={<Bell size={20} />} label="Schedules" href="/user/reminder" />
              </NavGuard>

              <NavGuard navKey="settings">
              <SidebarItem expanded={expanded} icon={<SettingsIcon size={24} />} label="Settings" href="/user/settings" />
              </NavGuard>
            </ul>
          </nav>

          <button className="sidebar-rail-toggle" aria-label={expanded ? "Use compact navigation" : "Expand navigation"}
            aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>
      </aside>

      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}
    </>
  );
}

interface LinkItemProps {
  href: string;
  label: string;
  contacts?: boolean;
}

function LinkItem({ href, label, contacts = false }: LinkItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <li className="relative">
      <Link
        href={href}
        aria-current={contacts && isActive ? "page" : undefined}
        className={contacts ? `sidebar-item sidebar-contacts-link block px-3 py-1.5 rounded-lg transition duration-150 ${isActive ? "sidebar-item-active font-semibold" : ""}` : `sidebar-item block px-3 py-1.5 rounded-lg transition duration-150 border-l-2 ${
          isActive 
            ? "border-terracotta bg-primary/10 text-terracotta font-semibold"
            : "border-transparent text-muted-foreground hover:border-terracotta/50 hover:text-foreground"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
