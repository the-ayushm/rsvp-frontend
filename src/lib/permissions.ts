// src/lib/permissions.ts

export const NAV_PERMISSIONS_LIST = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inbox", label: "Inbox" },
  { key: "contact", label: "Contacts" },
  { key: "campaigns", label: "Campaigns" },
  { key: "integrations", label: "Suite Integrations" },
  { key: "manage", label: "Manage" },
  { key: "faqbot", label: "FAQ Bot" },
  { key: "chatbot", label: "Chatbot" },
  { key: "ai_assistant", label: "AI Assistant" },
  { key: "flows", label: "Flows" },
  { key: "developers", label: "Developers" },
  { key: "schedules", label: "Schedules" },
  { key: "settings", label: "Settings" },
];

export const isTeamMemberUser = (): boolean => {
  if (typeof window === "undefined") return false;

  try {
    const saved = localStorage.getItem("user_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      const role = String(parsed?.role ?? "").trim().toLowerCase();
      if (role === "member" || role === "viewer") return true;
      if (parsed?.is_team_member || parsed?.team_id || parsed?.teamMemberId) return true;
      if (role === "user" || role === "admin" || role === "superadmin" || role === "super_admin") return false;
    }
  } catch {
    /* ignore */
  }

  try {
    const token = localStorage.getItem("console_access_token");
    if (token) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        const role = String(payload?.role ?? "").trim().toLowerCase();
        if (role === "member" || role === "viewer") return true;
        if (role === "user" || role === "admin" || role === "superadmin" || role === "super_admin") return false;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
};

export function hasPermissionKey(permissions: string[], key: string): boolean {
  if (!Array.isArray(permissions)) return false;
  const lowerPerms = permissions.map((p) => String(p).toLowerCase().trim());
  const k = key.toLowerCase().trim();

  if (k === "contact" || k === "contacts") {
    return lowerPerms.includes("contact") || lowerPerms.includes("contacts");
  }
  if (k === "campaign" || k === "campaigns") {
    return lowerPerms.includes("campaign") || lowerPerms.includes("campaigns");
  }
  if (k === "integration" || k === "integrations") {
    return lowerPerms.includes("integration") || lowerPerms.includes("integrations");
  }
  return lowerPerms.includes(k);
}

export const ROUTE_PERMISSION_MAP: { pattern: RegExp; key: string; label: string }[] = [
  { pattern: /^\/user\/dashboard(\/.*)?$/, key: "dashboard", label: "Dashboard" },
  { pattern: /^\/user\/inbox(\/.*)?$/, key: "inbox", label: "Inbox" },
  { pattern: /^\/user\/contacts(\/.*)?$/, key: "contact", label: "Contacts" },
  { pattern: /^\/user\/campaigns(\/.*)?$/, key: "campaigns", label: "Campaigns" },
  { pattern: /^\/user\/integrations(\/.*)?$/, key: "integrations", label: "Suite Integrations" },
  { pattern: /^\/user\/manage(\/.*)?$/, key: "manage", label: "Manage" },
  { pattern: /^\/user\/chatbot-faq(\/.*)?$/, key: "faqbot", label: "FAQ Bot" },
  { pattern: /^\/user\/chatbot(\/.*)?$/, key: "chatbot", label: "Chatbot" },
  { pattern: /^\/user\/ai-assistant(\/.*)?$/, key: "ai_assistant", label: "AI Assistant" },
  { pattern: /^\/user\/flows(\/.*)?$/, key: "flows", label: "Flows" },
  { pattern: /^\/user\/(whatsapp-business-api|whatsapp-api-docs|developers)(\/.*)?$/, key: "developers", label: "Developers" },
  { pattern: /^\/user\/reminder(\/.*)?$/, key: "schedules", label: "Schedules" },
];

export function isRoutePermitted(
  pathname: string,
  permissions: string[] | null,
  isTeam: boolean
): { allowed: boolean; requiredKey?: string; label?: string; reason?: string } {
  if (!isTeam) {
    return { allowed: true };
  }

  // If team member permissions are not yet loaded (null), treat as blocked until loaded
  if (permissions === null) {
    return { allowed: false, reason: "loading" };
  }

  // Owner/Admin settings are strictly off-limits to team members
  if (
    pathname.startsWith("/user/settings/team") ||
    pathname.startsWith("/user/settings/billing") ||
    pathname.startsWith("/user/settings/organization")
  ) {
    return { allowed: false, reason: "owner_only", label: "Organization Settings" };
  }

  // Profile is accessible to any authenticated user
  if (pathname === "/user/settings/profile") {
    return { allowed: true };
  }

  // /user/settings base: requires settings permission
  if (pathname === "/user/settings") {
    const hasSettings = hasPermissionKey(permissions, "settings");
    return {
      allowed: hasSettings,
      requiredKey: "settings",
      label: "Settings",
    };
  }

  // Check known route permissions
  for (const item of ROUTE_PERMISSION_MAP) {
    if (item.pattern.test(pathname)) {
      const allowed = hasPermissionKey(permissions, item.key);
      return {
        allowed,
        requiredKey: item.key,
        label: item.label,
      };
    }
  }

  // Default allowed for other non-restricted user subpages
  return { allowed: true };
}

export function getFirstPermittedRoute(permissions: string[]): string {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return "";
  }

  const routePriority: { key: string; route: string }[] = [
    { key: "dashboard", route: "/user/dashboard" },
    { key: "inbox", route: "/user/inbox" },
    { key: "contact", route: "/user/contacts" },
    { key: "campaigns", route: "/user/campaigns" },
    { key: "manage", route: "/user/manage/templates" },
    { key: "faqbot", route: "/user/chatbot-faq" },
    { key: "chatbot", route: "/user/chatbot" },
    { key: "ai_assistant", route: "/user/ai-assistant" },
    { key: "flows", route: "/user/flows" },
    { key: "integrations", route: "/user/integrations" },
    { key: "developers", route: "/user/whatsapp-business-api" },
    { key: "schedules", route: "/user/reminder" },
    { key: "settings", route: "/user/settings/profile" },
  ];

  for (const item of routePriority) {
    if (hasPermissionKey(permissions, item.key)) {
      return item.route;
    }
  }

  return "";
}
