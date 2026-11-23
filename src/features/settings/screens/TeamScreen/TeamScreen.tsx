/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Users,
  Crown,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  LayoutDashboard,
  Inbox,
  BookUser,
  Megaphone,
  Plug,
  Settings2,
  Image,
  Bot,
  MessageSquare,
  Cpu,
  Workflow,
  Code2,
  CalendarClock,
  SlidersHorizontal,
  UserCog,
  CreditCard,
  BarChart2,
  Activity,
  Wrench,
  UserCheck,
  Star,
  User,
  HelpCircle,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Pencil,
  X,
  Save,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { getSocket } from "@/lib/socket-client";
import PhoneInput, { CountryData } from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ─── Types ────────────────────────────────────────────────────
interface TeamInvite {
  id: string;
  name: string | null;
  email: string;
  user_id: string;
  phone_number: string | null;
  role: string;
  invite_status: "sent" | "accepted" | "expired";
  user_status?: string;
  created_at: string;
  permission?: string[] | { nav?: string[]; admin?: string[] };
}

interface TeamCountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const TEAM_COUNTRY_CODES: TeamCountryCode[] = [
  { code: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "USA" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "UK" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "AE", dialCode: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "MY", dialCode: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "LK", dialCode: "+94", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "BD", dialCode: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "PK", dialCode: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "NP", dialCode: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "ID", dialCode: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "TH", dialCode: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "VN", dialCode: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "PH", dialCode: "+63", flag: "🇵🇭", name: "Philippines" },
];

// ─── Permission Definitions ───────────────────────────────────
const NAV_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "contact", label: "Contact", icon: BookUser },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "integrations", label: "Suite Integrations", icon: Plug },
  { key: "manage", label: "Manage", icon: Settings2 },
  { key: "gallery", label: "Gallery", icon: Image },
  { key: "faqbot", label: "FAQ Bot", icon: Bot },
  { key: "chatbot", label: "Chatbot", icon: MessageSquare },
  { key: "ai_assistant", label: "AI Assistant", icon: Cpu },
  { key: "flows", label: "Flows", icon: Workflow },
  { key: "developers", label: "Developers", icon: Code2 },
  { key: "schedules", label: "Schedules", icon: CalendarClock },
  { key: "settings", label: "Settings", icon: SlidersHorizontal },
];

const ADMIN_PERMISSIONS = [
  { key: "adm_dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "adm_users", label: "Users", icon: UserCog },
  { key: "adm_subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "adm_analytics", label: "Analytics", icon: BarChart2 },
  { key: "adm_activity", label: "Activity Logs", icon: Activity },
  { key: "adm_system", label: "System Settings", icon: Wrench },
  { key: "adm_admins", label: "Admins", icon: UserCheck },
  { key: "adm_manage_subs", label: "Manage Subscriptions", icon: Star },
  { key: "adm_features", label: "Features", icon: CheckSquare as any },
  { key: "adm_profile", label: "Profile", icon: User },
  { key: "adm_user_query", label: "User Query", icon: HelpCircle },
];

const DEFAULT_PERMISSIONS: Record<string, { nav: string[]; admin: string[] }> = {
  member: { nav: [], admin: [] },
  viewer: { nav: [], admin: [] },
};

const showConfirmToast = (
  message: string,
  onConfirm: () => void | Promise<void>,
  confirmText = "Yes"
) => {
  toast(
    ({ closeToast }) => (
      <div className="text-xs">
        <p className="font-semibold text-foreground mb-3">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeToast}
            className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-foreground text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              closeToast?.();
              await onConfirm();
            }}
            className="px-3 py-1.5 rounded-lg bg-destructive hover:opacity-90 text-white text-xs font-semibold"
          >
            {confirmText}
          </button>
        </div>
      </div>
    ),
    {
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      position: "top-center",
    }
  );
};

// ─── PermissionDropdown Component ────────────────────────────
function PermissionDropdown({
  title,
  items,
  checked,
  onChange,
  defaultOpen = true,
  required = false,
}: {
  title: string;
  items: { key: string; label: string; icon: any }[];
  checked: string[];
  onChange: (keys: string[]) => void;
  defaultOpen?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = (key: string) =>
    onChange(checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key]);

  const allChecked = items.every((i) => checked.includes(i.key));
  const toggleAll = () => onChange(allChecked ? [] : items.map((i) => i.key));

  return (
    <div className={`rounded-xl border ${checked.length === 0 && required ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"} overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 font-semibold text-xs text-foreground hover:bg-muted transition"
      >
        <span className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {title}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            checked.length === 0 && required
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/15 text-primary"
          }`}>
            {checked.length}/{items.length} {checked.length === 0 && required ? "(Required)" : ""}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-card">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold mb-3 px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition"
          >
            {allChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {allChecked ? "Deselect All" : "Select All"}
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isChecked = checked.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer select-none transition border text-xs ${
                    isChecked
                      ? "bg-primary/10 border-primary/40 text-foreground font-semibold"
                      : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    onChange={() => toggle(item.key)}
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                      isChecked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
                    }`}
                  >
                    {isChecked && (
                      <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="truncate">{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit Permissions Modal ───────────────────────────────────
function EditPermissionsModal({
  invite,
  onClose,
  onSave,
}: {
  invite: TeamInvite;
  onClose: () => void;
  onSave: (invite: TeamInvite, newNav: string[]) => Promise<void>;
}) {
  const parseNav = (perm: TeamInvite["permission"]): string[] => {
    if (!perm) return [];
    if (Array.isArray(perm)) return perm as string[];
    if (Array.isArray((perm as any).nav)) return (perm as any).nav;
    return [];
  };

  const [nav, setNav] = useState<string[]>(parseNav(invite.permission));
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleNav = (key: string) =>
    setNav((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleSave = async () => {
    if (nav.length === 0) {
      toast.error("Please select at least one permission.");
      return;
    }
    setSaving(true);
    await onSave(invite, nav);
    setSaving(false);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const modal = (
    <>
      <div className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Edit Permissions</h3>
                <p className="text-xs text-muted-foreground">
                  {invite.name || invite.email} · <span className="capitalize">{invite.role}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 max-h-[55vh] overflow-y-auto space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Navigation Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {NAV_PERMISSIONS.map(({ key, label, icon: Icon }) => {
                const checked = nav.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleNav(key)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold transition text-left ${
                      checked
                        ? "bg-primary/10 border-primary/40 text-foreground"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
                      }`}
                    >
                      {checked && (
                        <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {nav.length} permission{nav.length !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold transition shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(modal, portalTarget);
}

/**
 * Hostname the backend puts in invite links (hostname only: no scheme, port or path).
 * NEXT_PUBLIC_TEAM_INVITE_HOST overrides it, e.g. when testing on localhost.
 */
function inviteHostname() {
  const raw = (process.env.NEXT_PUBLIC_TEAM_INVITE_HOST || window.location.hostname).trim().toLowerCase();
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return raw;
  }
}

const isLocalHostname = (host: string) =>
  host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

// ─── Main Team Page ───────────────────────────────────────────
export default function TeamPage() {
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [navPerms, setNavPerms] = useState<string[]>([]);
  const [adminPerms, setAdminPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvites, setFetchingInvites] = useState(true);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [editingInvite, setEditingInvite] = useState<TeamInvite | null>(null);
  // "email": backend emails the invite. "link": backend only returns invite_url for the admin to share.
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "link">("email");
  // The invite link is a secret: keep it in memory only, never log it.
  const [generatedInvite, setGeneratedInvite] = useState<{ url: string; name: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Phone state follows the same country-code logic used on the Contacts page.
  // fullPhone stores the raw concatenated value from react-phone-input-2
  // e.g. "919876543210" for +91 9876543210.
  const [fullPhone, setFullPhone] = useState("");
  const [dialCode, setDialCode] = useState("91"); // default India
  const [emailError, setEmailError] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("IN");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

  const selectedCountry =
    TEAM_COUNTRY_CODES.find((country) => country.code === selectedCountryCode) ??
    TEAM_COUNTRY_CODES[0];

  const filteredTeamCountries = TEAM_COUNTRY_CODES.filter((country) => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return true;

    return (
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.dialCode.includes(query.replace(/^\\+/, ""))
    );
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        phoneDropdownRef.current &&
        !phoneDropdownRef.current.contains(event.target as Node)
      ) {
        setCountryDropdownOpen(false);
        setCountrySearch("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleCountrySelect = (country: TeamCountryCode) => {
    const currentLocalDigits = fullPhone.startsWith(dialCode)
      ? fullPhone.slice(dialCode.length)
      : fullPhone.replace(/^\\+/, "");

    setSelectedCountryCode(country.code);
    setDialCode(country.dialCode.replace("+", ""));
    setFullPhone(`${country.dialCode.replace("+", "")}${currentLocalDigits}`);
    setCountryDropdownOpen(false);
    setCountrySearch("");
  };

  // Local digits = full phone string minus the selected dial code prefix.
  const localDigits = fullPhone.startsWith(dialCode)
    ? fullPhone.slice(dialCode.length)
    : fullPhone;

  const isIndia = dialCode === "91";
  const isValidPhone = isIndia
    ? localDigits.length === 10
    : localDigits.length >= 7;

  useEffect(() => {
    if (role && DEFAULT_PERMISSIONS[role]) {
      setNavPerms(DEFAULT_PERMISSIONS[role].nav);
      setAdminPerms(DEFAULT_PERMISSIONS[role].admin);
    } else {
      setNavPerms([]);
      setAdminPerms([]);
    }
  }, [role]);

  const fetchTeamInvites = async (silent = false) => {
    try {
      if (!silent) setFetchingInvites(true);
      const res = await soft7AxiosInstance.get("/admin/team/invites");
      const data = res.data;
      const list = data?.data?.data ?? data?.data ?? [];
      setTeamInvites(list);
    } catch (error) {
      console.error("❌ Error fetching team invites:", error);
    } finally {
      if (!silent) setFetchingInvites(false);
    }
  };

  // Polling is only active while there are pending invites waiting for acceptance
  const hasPendingInvites = useMemo(
    () => teamInvites.some((inv) => inv.invite_status === "sent"),
    [teamInvites]
  );

  useEffect(() => {
    fetchTeamInvites();

    // Auto-refresh when tab gains focus or becomes visible
    const onVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchTeamInvites(true);
      }
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    // Socket real-time update
    let socket: any = null;
    try {
      socket = getSocket();
      const handleAccepted = (payload: any) => {
        console.log("Team invite accepted event received:", payload);
        fetchTeamInvites(true);
        if (payload?.email) {
          toast.success(`${payload.email} has accepted the invitation!`);
        }
      };
      socket?.on("team_invite_accepted", handleAccepted);
      socket?.on("team_invite_update", () => fetchTeamInvites(true));

      return () => {
        window.removeEventListener("focus", onVisibilityOrFocus);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        socket?.off("team_invite_accepted", handleAccepted);
        socket?.off("team_invite_update");
      };
    } catch {
      return () => {
        window.removeEventListener("focus", onVisibilityOrFocus);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      };
    }
  }, []);

  // Polling ONLY runs when there is at least one pending invite ("sent").
  // As soon as the invite is accepted (or expired), hasPendingInvites becomes false
  // and the timer is cleared immediately — no unnecessary polling occurs.
  useEffect(() => {
    if (!hasPendingInvites) return;

    const pollTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchTeamInvites(true);
      }
    }, 4000);

    return () => clearInterval(pollTimer);
  }, [hasPendingInvites]);

  const validateEmail = (val: string) => {
    if (!val.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Enter a valid email address";
    return "";
  };

  const validatePhone = (local: string) => {
    const digits = local.replace(/\D/g, "");

    // Phone is optional for the team invite, but when provided it must
    // satisfy the same country-specific validation as the Contacts page.
    if (!digits.trim()) return "";

    if (isIndia) {
      return digits.length === 10 ? "" : "Indian phone numbers must be exactly 10 digits";
    }

    return digits.length >= 7 ? "" : "Enter a valid phone number (min 7 digits)";
  };

  const handlePhoneChange = (
    value: string,
    data: CountryData | Record<string, unknown>
  ) => {
    setFullPhone(value);

    const dc = (data as CountryData).dialCode ?? dialCode;
    setDialCode(dc);

  };

  const handleSuspendInvite = (invite: TeamInvite) => {
    const isSuspended = invite.user_status === "suspended";
    const action = isSuspended ? "restore" : "suspend";

    showConfirmToast(
      `Are you sure you want to ${action} this member?`,
      async () => {
        try {
          setSuspendingId(invite.id);
          const endpoint = isSuspended
            ? `/admin/users/${invite.id}/active-user`
            : `/admin/users/${invite.id}/suspend-user`;

          await soft7AxiosInstance.put(endpoint);

          setTeamInvites((prev) =>
            prev.map((i) =>
              i.id === invite.id ? { ...i, user_status: isSuspended ? "active" : "suspended" } : i
            )
          );

          toast.success(`Member ${isSuspended ? "restored" : "suspended"} successfully`);
        } catch (error: any) {
          toast.error(error?.response?.data?.message || `Failed to ${action} member`);
        } finally {
          setSuspendingId(null);
        }
      },
      isSuspended ? "Restore" : "Suspend"
    );
  };

  const handleAddMember = async () => {
    const eErr = validateEmail(email);
    const pErr = validatePhone(localDigits);
    // The backend builds invite_url on this hostname, so it must serve this dashboard over HTTPS.
    const domain_name = inviteHostname();
    setEmailError(eErr);
    if (eErr || !name.trim() || !role || !localDigits.trim()) {
      if (!name.trim()) toast.error("Name is required.");
      else if (eErr) toast.error(eErr);
      else if (!localDigits.trim()) toast.error("Phone number is required.");
      else toast.error("Please select a role.");
      return;
    }

    if (pErr) {
      toast.error(pErr);
      return;
    }

    if (navPerms.length === 0) {
      toast.error("Please select at least one permission for the team member.");
      return;
    }

    if (deliveryMethod === "link" && isLocalHostname(domain_name)) {
      toast.error(
        `An invite link on "${domain_name}" won't open for your team member. Open the dashboard on its public domain, or set NEXT_PUBLIC_TEAM_INVITE_HOST.`
      );
      return;
    }
    try {
      setLoading(true);
      setGeneratedInvite(null);
      setCopied(false);
      const res = await soft7AxiosInstance.post("/admin/team/invite", {
        name,
        email,
        phone_number: fullPhone.trim() ? `+${fullPhone.trim()}` : undefined,
        role,
        permission: navPerms,
        domain_name,
        delivery_method: deliveryMethod,
      });
      const data = res.data;
      const invite = data?.data ?? {};
      const inviteUrl: string = typeof invite.invite_url === "string" ? invite.invite_url : "";

      if (deliveryMethod === "link") {
        if (invite.delivery_method === "link" && inviteUrl) {
          setGeneratedInvite({ url: inviteUrl, name: name.trim(), email: email.trim() });
          toast.success("Invite link generated. Copy it and share it with your team member.");
        } else if (invite.email_sent) {
          // Older backend ignores delivery_method and still emails the invite.
          toast.info("Link sharing isn't available yet. An invitation email was sent instead.");
        } else {
          toast.warning(data?.warning || "Invite created, but no link was returned.");
        }
      } else if (data.warning) {
        toast.warning(data.warning);
      } else if (invite.email_sent === false) {
        toast.warning("Invite created, but the email wasn't sent. Try Generate link instead.");
      } else {
        toast.success("Member invited successfully! Email has been sent.");
      }

      setName("");
      setEmail("");
      setDialCode("91");
      setFullPhone("");
      setRole("");
      setNavPerms([]);
      setAdminPerms([]);
      setEmailError("");
      fetchTeamInvites();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.response?.data?.error || "Failed to invite member.";
      toast.error(msg);
      console.error("❌ Error adding member:", error);
    } finally {
      setLoading(false);
    }
  };

  const inviteLinkRef = useRef<HTMLInputElement>(null);
  const handleCopyInviteLink = async () => {
    if (!generatedInvite) return;
    try {
      await navigator.clipboard.writeText(generatedInvite.url);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS): fall back to selecting the field.
      const input = inviteLinkRef.current;
      input?.focus();
      input?.select();
      if (!document.execCommand?.("copy")) {
        toast.error("Couldn't copy automatically. Select the link and copy it manually.");
        return;
      }
    }
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteInvite = (id: string) => {
    showConfirmToast(
      "Are you sure you want to revoke this invite?",
      async () => {
        try {
          setDeletingInviteId(id);
          await soft7AxiosInstance.delete(`/admin/team/${id}/invite`);
          setTeamInvites((prev) => prev.filter((i) => i.id !== id));
          toast.success("Invite revoked successfully");
        } catch (error: any) {
          const msg = error?.response?.data?.message || error?.response?.data?.error || "Failed to revoke invite.";
          toast.error(msg);
          console.error("❌ Error revoking invite:", error);
        } finally {
          setDeletingInviteId(null);
        }
      },
      "Revoke"
    );
  };

  const handleSavePermissions = async (invite: TeamInvite, newNav: string[]) => {
    try {
      await soft7AxiosInstance.patch(`/admin/team/${invite.user_id}/permissions`, {
        replace: newNav,
      });
      setTeamInvites((prev) =>
        prev.map((i) => (i.id === invite.id ? { ...i, permission: { nav: newNav } } : i))
      );
      setEditingInvite(null);
      toast.success("Permissions updated successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update permissions");
    }
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName?.toLowerCase()) {
      case "admin":
        return <Crown className="w-3.5 h-3.5" />;
      case "member":
        return <Users className="w-3.5 h-3.5" />;
      case "viewer":
        return <Eye className="w-3.5 h-3.5" />;
      case "user":
        return <User className="w-3.5 h-3.5" />;
      default:
        return <Shield className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── Header Card ── */}
      <div className="bg-card border border-border rounded-3xl p-7 sm:p-9 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Team Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage, invite, and configure permissions for your team members
            </p>
          </div>
        </div>
      </div>

      {/* ── Invite Form Card ── */}
      {/* relative + overflow-visible give the phone field's dropdown a
          correct positioning context without letting the card clip it,
          while isolate prevents internal z-indexes from bleeding over sticky header */}
      <div className="relative isolate bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5 overflow-visible">
      <style jsx global>{`
        .phone-input-team-wrapper {
          position: relative !important;
          z-index: 50 !important;
          width: 100% !important;
          overflow: visible !important;
        }

        .phone-input-team-wrapper .react-tel-input {
          width: 100% !important;
        }

        .phone-input-team-wrapper .react-tel-input .form-control {
          width: 100% !important;
          height: 40px !important;
          border: 1px solid hsl(var(--color-border)) !important;
          border-radius: 8px !important;
          background: hsl(var(--color-surface-muted)) !important;
          padding-left: 54px !important;
          padding-right: 10px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: hsl(var(--color-text)) !important;
          box-sizing: border-box !important;
        }

        .phone-input-team-wrapper.is-invalid .react-tel-input .form-control {
          border-color: var(--color-destructive) !important;
        }

        /* Do not use react-phone-input-2's own dropdown. */
        .phone-input-team-wrapper .react-tel-input .flag-dropdown {
          display: none !important;
        }

        /* Independent country-code trigger. */
        .phone-input-team-wrapper .team-country-trigger {
          position: absolute !important;
          left: 1px !important;
          top: 1px !important;
          z-index: 20 !important;
          width: 50px !important;
          height: 38px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 7px 0 0 7px !important;
          background: hsl(var(--color-surface-muted)) !important;
          cursor: pointer !important;
        }

        .phone-input-team-wrapper .team-country-trigger img {
          width: 20px !important;
          height: auto !important;
          object-fit: contain !important;
          border-radius: 2px !important;
        }

        .phone-input-team-wrapper .team-country-chevron {
          font-size: 8px !important;
          color: hsl(var(--color-text-muted)) !important;
        }

        .phone-input-team-wrapper .team-country-trigger.open .team-country-chevron {
          transform: rotate(180deg) !important;
        }

        /* Fixed header + independently scrolling options. */
        .phone-input-team-wrapper .team-country-menu {
          position: absolute !important;
          top: 44px !important;
          left: 0 !important;
          z-index: 100000 !important;
          width: 280px !important;
          max-width: min(280px, calc(100vw - 24px)) !important;
          overflow: hidden !important;
          background: hsl(var(--color-surface)) !important;
          border: 1px solid hsl(var(--color-border)) !important;
          border-radius: 10px !important;
          box-shadow: var(--elevation-xl) !important;
        }

        .phone-input-team-wrapper .team-country-menu-header {
          position: relative !important;
          z-index: 2 !important;
          height: 50px !important;
          padding: 7px 8px !important;
          background: hsl(var(--color-surface)) !important;
          border-bottom: 1px solid hsl(var(--color-border)) !important;
          box-sizing: border-box !important;
        }

        .phone-input-team-wrapper .team-country-search-input {
          width: 100% !important;
          height: 36px !important;
          display: block !important;
          margin: 0 !important;
          padding: 0 10px 0 34px !important;
          box-sizing: border-box !important;
          border: 1px solid hsl(var(--color-border)) !important;
          border-radius: 7px !important;
          outline: none !important;
          background: hsl(var(--color-surface-muted)) !important;
          color: hsl(var(--color-text)) !important;
          font-size: 12px !important;
          line-height: 36px !important;
        }

        .phone-input-team-wrapper .team-country-search-input::placeholder {
          color: hsl(var(--color-text-muted)) !important;
          opacity: 0.8 !important;
        }

        .phone-input-team-wrapper .team-country-search-input:focus {
          border-color: hsl(var(--color-primary)) !important;
          box-shadow: 0 0 0 1px hsl(var(--color-primary)) !important;
        }

        .phone-input-team-wrapper .team-country-search-icon {
          position: absolute !important;
          left: 19px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          z-index: 3 !important;
          pointer-events: none !important;
          font-size: 14px !important;
          line-height: 1 !important;
        }

        .phone-input-team-wrapper .team-country-options {
          height: 220px !important;
          max-height: 220px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          background: hsl(var(--color-surface)) !important;
        }

        .phone-input-team-wrapper .team-country-option {
          width: 100% !important;
          min-height: 40px !important;
          display: flex !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 7px 10px !important;
          border: 0 !important;
          background: transparent !important;
          color: hsl(var(--color-text)) !important;
          text-align: left !important;
          cursor: pointer !important;
          box-sizing: border-box !important;
        }

        .phone-input-team-wrapper .team-country-option:hover,
        .phone-input-team-wrapper .team-country-option.selected {
          background: hsl(var(--color-surface-muted)) !important;
        }

        .phone-input-team-wrapper .team-country-option img {
          width: 22px !important;
          height: auto !important;
          flex: 0 0 22px !important;
          object-fit: contain !important;
          border-radius: 2px !important;
        }

        .phone-input-team-wrapper .team-country-option-name {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 12px !important;
        }

        .phone-input-team-wrapper .team-country-option-dial {
          flex: 0 0 auto !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }

        .phone-input-team-wrapper .team-country-no-results {
          padding: 18px 12px !important;
          text-align: center !important;
          font-size: 12px !important;
          color: hsl(var(--color-text-muted)) !important;
        }

        /* keep cards below the invite form out of the dropdown's stacking context */
        .team-page-card {
          position: relative;
          z-index: 0;
        }
      `}</style>

        {/* Header: title + how the invite is delivered */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">Invite New Members</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {deliveryMethod === "email"
                  ? "We'll email the invitation to the address you enter."
                  : "No email is sent. You'll get a link to copy and share yourself."}
              </p>
            </div>
          </div>

          {/* Delivery method */}
          <div
            role="radiogroup"
            aria-label="How to deliver the invite"
            className="grid grid-cols-2 p-1 rounded-xl bg-muted border border-border w-full sm:w-auto shrink-0"
          >
            {([
              { value: "email", label: "Send email", icon: <Mail className="w-3.5 h-3.5" /> },
              { value: "link", label: "Generate link", icon: <Link2 className="w-3.5 h-3.5" /> },
            ] as const).map((opt) => {
              const active = deliveryMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={loading}
                  onClick={() => setDeliveryMethod(opt.value)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-card text-primary shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Inputs Grid: items-start keeps inputs aligned when a field shows a validation message */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-5 items-start relative z-10">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-primary" /> Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-primary" /> Email <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(validateEmail(e.target.value));
              }}
              disabled={loading}
              aria-invalid={!!emailError || undefined}
              className={`w-full px-3 py-2 bg-muted border rounded-lg text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 h-10 ${
                emailError ? "border-destructive focus:ring-destructive" : "border-border focus:ring-ring"
              }`}
            />
            {emailError && <p className="text-[10px] font-medium text-destructive">{emailError}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-primary" /> Phone <span className="text-destructive">*</span>
            </label>

            <div
              ref={phoneDropdownRef}
              className={`relative phone-input-team-wrapper ${localDigits.length > 0 && !isValidPhone ? "is-invalid" : ""}`}
            >
              <button
                type="button"
                className={`team-country-trigger ${countryDropdownOpen ? "open" : ""}`}
                onClick={() => setCountryDropdownOpen((open) => !open)}
                disabled={loading}
                aria-label="Select country code"
                aria-expanded={countryDropdownOpen}
              >
                <img
                  src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                  alt={selectedCountry.name}
                />
                <span className="team-country-chevron">▼</span>
              </button>

              <PhoneInput
                country={selectedCountry.code.toLowerCase()}
                value={fullPhone}
                onChange={handlePhoneChange}
                disableDropdown
                inputProps={{
                  name: "phone",
                  autoComplete: "tel",
                }}
                containerClass="!w-full"
                inputClass="!w-full !rounded-lg !border !border-border !bg-muted !pl-14 !py-2 !h-10 !text-xs !font-semibold !text-foreground focus:!border-border focus:!ring-1 focus:!ring-ring transition-all"
                disabled={loading}
              />

              {countryDropdownOpen && (
                <div className="team-country-menu">
                  <div className="team-country-menu-header">
                    <span className="team-country-search-icon">🔎</span>
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country..."
                      className="team-country-search-input"
                      autoComplete="off"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="team-country-options">
                    {filteredTeamCountries.length > 0 ? (
                      filteredTeamCountries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          className={`team-country-option ${
                            selectedCountry.code === country.code ? "selected" : ""
                          }`}
                          onClick={() => handleCountrySelect(country)}
                        >
                          <img
                            src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                            alt=""
                          />
                          <span className="team-country-option-name">{country.name}</span>
                          <span className="team-country-option-dial">{country.dialCode}</span>
                        </button>
                      ))
                    ) : (
                      <div className="team-country-no-results">No country found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {fullPhone && localDigits.length > 0 && (
              <p className={`text-[10px] font-medium ${isValidPhone ? "text-primary" : "text-destructive"}`}>
                {isValidPhone
                  ? "✓ Valid number"
                  : isIndia
                    ? "Enter exactly 10 digits"
                    : "Enter at least 7 digits"}
              </p>
            )}

          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" /> Role <span className="text-destructive">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground h-10 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select role</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Submit Button: invisible label keeps it level with the inputs on the 5-column layout */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <span aria-hidden="true" className="hidden lg:flex text-[11px] font-bold uppercase tracking-wider invisible select-none items-center gap-1">
              <Send className="w-3.5 h-3.5" /> Action
            </span>
            <button
              onClick={handleAddMember}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-semibold text-xs transition shadow-xs h-10 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {deliveryMethod === "link" ? "Generating…" : "Sending…"}
                </>
              ) : deliveryMethod === "link" ? (
                <>
                  <Link2 className="w-3.5 h-3.5" /> Generate link
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Invite
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated invite link */}
        {generatedInvite && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">Invite link ready</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                    Share this link only with {generatedInvite.name || "the invitee"} ({generatedInvite.email}). It works once, for that email address.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setGeneratedInvite(null); setCopied(false); }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                aria-label="Dismiss invite link"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={inviteLinkRef}
                type="text"
                readOnly
                value={generatedInvite.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Invite link"
                className="flex-1 min-w-0 px-3 h-10 bg-card border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="inline-flex items-center justify-center gap-2 px-4 h-10 bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-semibold text-xs transition shadow-xs shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        )}

        {/* Permissions Accordions */}
        {role && (
          <div className="pt-2">
            <PermissionDropdown
              title="App Navigation Access Permissions *"
              items={NAV_PERMISSIONS}
              checked={navPerms}
              onChange={setNavPerms}
              defaultOpen={true}
              required={true}
            />
          </div>
        )}
      </div>

      {/* ── Sent Invites Table ── */}
      <div className="team-page-card bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Send className="w-4 h-4" />
            </div>
            Sent Invites ({teamInvites.length})
          </h2>
          <button
            onClick={() => fetchTeamInvites()}
            disabled={fetchingInvites}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-card hover:bg-muted border border-border rounded-lg transition h-8 shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${fetchingInvites ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
        </div>

        {fetchingInvites ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Loading invites...</p>
          </div>
        ) : teamInvites.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/30">
            <Send className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-xs font-semibold text-foreground">No invites sent yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/70 border-b border-border text-[11px] uppercase tracking-wider text-foreground/80 dark:text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent On</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamInvites.map((invite) => {
                  const statusConfig = {
                    sent: {
                      icon: <Clock className="w-3 h-3" />,
                      badgeClass: "bg-warning/10 text-warning dark:text-warning border-warning/20",
                      label: "Sent",
                    },
                    accepted: {
                      icon: <CheckCircle className="w-3 h-3" />,
                      badgeClass: "bg-primary/10 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] border-[var(--color-primary)]/20",
                      label: "Accepted",
                    },
                    expired: {
                      icon: <XCircle className="w-3 h-3" />,
                      badgeClass: "bg-error/10 text-error dark:text-error border-error/20",
                      label: "Expired",
                    },
                  }[invite.invite_status] ?? {
                    icon: null,
                    badgeClass: "bg-muted text-muted-foreground border-border",
                    label: invite.invite_status,
                  };

                  return (
                    <tr key={invite.id} className="hover:bg-muted/40 transition">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                            {invite.name ? invite.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="font-semibold text-foreground">
                            {invite.name || <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-muted-foreground">{invite.email}</td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-muted-foreground">{invite.phone_number ?? "—"}</td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
                          {getRoleIcon(invite.role)}
                          {invite.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.badgeClass}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Sent On */}
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {invite.created_at
                          ? new Date(invite.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Suspend / Restore */}
                          {invite.invite_status === "accepted" && (
                            <button
                              onClick={() => handleSuspendInvite(invite)}
                              disabled={suspendingId === invite.id}
                              title={invite.user_status === "suspended" ? "Restore member" : "Suspend member"}
                              className={`p-1.5 rounded-md border transition ${
                                invite.user_status === "suspended"
                                  ? "bg-primary/10 text-[var(--color-primary)] border-[var(--color-primary)]/20"
                                  : "bg-warning/10 text-warning border-warning/20"
                              }`}
                            >
                              {suspendingId === invite.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Shield className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {/* Edit Permissions */}
                          {invite.invite_status === "accepted" && (
                            <button
                              onClick={() => setEditingInvite(invite)}
                              title="Edit permissions"
                              className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Revoke */}
                          <button
                            onClick={() => handleDeleteInvite(invite.id)}
                            disabled={deletingInviteId === invite.id}
                            title="Revoke invite"
                            className="p-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition"
                          >
                            {deletingInviteId === invite.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Permissions Modal ── */}
      {editingInvite && (
        <EditPermissionsModal
          invite={editingInvite}
          onClose={() => setEditingInvite(null)}
          onSave={handleSavePermissions}
        />
      )}

      <ToastContainer position="top-center" autoClose={2500} />
    </div>
  );
}