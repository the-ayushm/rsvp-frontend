/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @typescript-eslint/no-unused-vars */
// components/topbar.tsx
"use client";

import {
  Menu,
  Search,
  Clock,
  X,
  User,
  Settings,
  CreditCard,
  LogOut,
  Plus,
  Bell,
  Tag,
  MessageSquare,
  FileText,
  Users,
  Crown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/shell/ThemeToggle/ThemeToggle";
import Link from "next/link";
import Notifications from "@/features/notifications/components/Notifications";
import ReminderItem from "../reminders/ReminderItem";
import SubscriptionPanel from "@/features/subscription/components/SubscriptionPanel";
import useSWR from "swr";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/* -----------------------------------------------------------------
   Types
   ----------------------------------------------------------------- */
interface Reminder {
  id: string;
  creatorId: string;
  assigneeId?: number;
  note: string;
  date: string;
  time: string;
  triggered: boolean;
}

type SearchResult = {
  id: string | number;
  type:
  | "contact"
  | "page"
  | "campaign"
  | "tag"
  | "lead"
  | "media"
  | "flow"
  | "chatbot"
  | "ai-assistant"
  | "webhook"
  | "column"
  | "opt-keyword"
  | "whatsapp-flow"
  | "faq-bot"
  | "reminder"
  | "team-member";
  title: string;
  subtitle?: string;
  url: string;
  icon?: React.ReactNode;
};

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

/* -----------------------------------------------------------------
   SSR-safe today string
   ----------------------------------------------------------------- */
const todayStr =
  typeof window !== "undefined" ? new Date().toISOString().split("T")[0] : "";
const tomorrow = typeof window !== "undefined" ? new Date() : null;
if (tomorrow) tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow ? tomorrow.toISOString().split("T")[0] : "";

/* -----------------------------------------------------------------
   Fetcher
   ----------------------------------------------------------------- */
const fetcher = async (url: string) => {
  try {
    const res = await soft7AxiosInstance.get(url);
    const json = res.data;
    return json?.data ?? [];
  } catch {
    return [];
  }
};

const ngrokFetcher = async (url: string) => {
  try {
    const res = await soft7AxiosInstance.get(url);
    const data = res.data;

    // Try to find the array in common keys
    if (Array.isArray(data)) return data;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.reminders && Array.isArray(data.reminders)) return data.reminders;
    if (data?.reminder && Array.isArray(data.reminder)) return data.reminder;

    return [];
  } catch {
    return [];
  }
};

/* -----------------------------------------------------------------
   Singleton AudioContext
   ----------------------------------------------------------------- */
let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
  if (!audioCtx) {
    interface Window {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as Window & typeof globalThis).webkitAudioContext;

    if (!AudioCtx) throw new Error("Web Audio API not supported");
    audioCtx = new AudioCtx();
    const resumeOnInteraction = () => {
      audioCtx?.resume().catch(() => { });
      document.removeEventListener("click", resumeOnInteraction);
      document.removeEventListener("touchstart", resumeOnInteraction);
    };
    document.addEventListener("click", resumeOnInteraction);
    document.addEventListener("touchstart", resumeOnInteraction);
  }
  return audioCtx!;
};

/* -----------------------------------------------------------------
   Topbar Component
   ----------------------------------------------------------------- */
export function Topbar() {
  /* User & UI state */
  const [userData, setUserData] = useState<{
    id: string;
    name: string;
    image?: string;
    walletBalance?: number;
  }>({ id: "", name: "" });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [openReminders, setOpenReminders] = useState(false);
  const [cnt, setCntNotifications] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const remindersRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  /* Subscription state (no demo data here) */
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(false);

  /* Search state */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  /* Reminder state */
  const [showRemindersDropdown, setShowRemindersDropdown] = useState(false);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [note, setNote] = useState("");
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");
  const [popupReminder, setPopupReminder] = useState<Reminder | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [showSidebar, setShowSidebar] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  /* Router & pathname */
  const pathname = usePathname() || "/";
  const router = useRouter();

  /*
   * Chatbot breadcrumb name
   * -----------------------
   * The builder URL contains the chatbot UUID:
   * /user/chatbot/<uuid>/builder
   *
   * Topbar is rendered independently from the builder component, so it
   * cannot read the builder's local `botName` state. Fetch the chatbot
   * details here and use the API name for the breadcrumb instead of the UUID.
   */
  const chatbotId = (() => {
    const match = pathname.match(
      /^\/user\/chatbot\/([^/]+)(?:\/|$)/i,
    );
    return match?.[1] || null;
  })();

  const [chatbotName, setChatbotName] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Clear the previous chatbot name when navigating away from a chatbot.
    if (!chatbotId) {
      setChatbotName("");
      return;
    }

    // Only treat a valid UUID as a chatbot ID. This prevents unnecessary
    // requests on unrelated /chatbot/... routes.
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        chatbotId,
      );

    if (!isUuid) {
      setChatbotName("");
      return;
    }

    const fetchChatbotName = async () => {
      try {
        const response = await soft7AxiosInstance.get(
          `/admin/chatbot/${chatbotId}`,
        );

        const name = String(
          response?.data?.data?.name ??
            response?.data?.name ??
            "",
        ).trim();

        if (!cancelled) {
          setChatbotName(name);
        }
      } catch (error) {
        // Keep the breadcrumb usable even if the chatbot details request fails.
        console.error("Error fetching chatbot name for breadcrumb:", error);

        if (!cancelled) {
          setChatbotName("");
        }
      }
    };

    fetchChatbotName();

    return () => {
      cancelled = true;
    };
  }, [chatbotId]);

  /* Fetch reminders */
  const { data: reminders, mutate: mutateReminders } = useSWR<Reminder[]>(
    "/admin/users/reminder",
    ngrokFetcher,
    {
      shouldRetryOnError: false,   // don't loop on 401/5xx
      revalidateOnFocus: false,    // don't re-fetch every tab focus
      dedupingInterval: 60_000,    // at most once per minute
    }
  );
  const remindersToday = reminders?.filter((r) => r.date === todayStr) || [];
  const remindersTomorrow =
    reminders?.filter((r) => r.date === tomorrowStr) || [];
  const remindersCount = remindersToday.length + remindersTomorrow.length;

  /* Fetch logged-in user from localStorage */
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

  /* Close profile menu on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Close search results on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(target) &&
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(target)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Search functionality */
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const res = await soft7AxiosInstance.get(
          `/api/user/search?q=${encodeURIComponent(searchQuery)}`,
        );

        const data = await res.data;
        setSearchResults(data.results || []);
        setShowSearchResults(true);
      } catch (e) {
        console.error("Search error:", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "contact":
        return <User className="h-4 w-4 text-blue-500" />;
      case "page":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "campaign":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "tag":
        return <Tag className="h-4 w-4 text-orange-500" />;
      case "lead":
        return <Users className="h-4 w-4 text-indigo-500" />;
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  /* Breadcrumb logic - Updated to hide "user" segment */
  const rawParts = pathname.split("/").filter(Boolean);
  // Filter out "user" segment from the breadcrumb
  const filteredParts = rawParts.filter((p) => p.toLowerCase() !== "user");
  const parts = filteredParts.map(
    (p) => p.charAt(0).toUpperCase() + p.slice(1),
  );
  const breadcrumbItems: { label: string; href?: string; isLast?: boolean }[] =
    [];

  // Check if current page is dashboard
  const isDashboardPage =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/user/dashboard";

  // Only add "Dashboard" link if we're NOT on dashboard and have other pages
  if (!isDashboardPage && filteredParts.length > 0) {
    breadcrumbItems.push({ label: "Dashboard", href: "/" });
  }

  // Build breadcrumb with filtered parts but maintain correct URLs
  let urlIndex = 0;
  filteredParts.forEach((_, idx) => {
    // Find the actual index in rawParts to build correct URL
    while (
      urlIndex < rawParts.length &&
      rawParts[urlIndex].toLowerCase() === "user"
    ) {
      urlIndex++;
    }
    const cumulative = "/" + rawParts.slice(0, urlIndex + 1).join("/");
    const isChatbotId =
      rawParts[urlIndex - 1]?.toLowerCase() === "chatbot" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawParts[urlIndex],
      );

    breadcrumbItems.push({
      // Replace the chatbot UUID with the actual chatbot name returned by
      // GET /admin/chatbot/:id. While the request is loading, show "Chatbot"
      // instead of exposing the UUID in the topbar.
      label: isChatbotId
        ? chatbotName || "Chatbot"
        : parts[idx],
      // There is no route for /user/chatbot/:id; keep the chatbot name
      // as context only.
      href: isChatbotId ? undefined : cumulative,
    });
    urlIndex++;
  });

  if (breadcrumbItems.length > 0) {
    breadcrumbItems[breadcrumbItems.length - 1].isLast = true;
  }
  const pageTitle = isDashboardPage
    ? "Dashboard"
    : (breadcrumbItems[breadcrumbItems.length - 1]?.label ?? "Dashboard");

  /* Add reminder helper */
  const handleAddReminder = async () => {
    if (!note.trim() || !time) return;
    const newReminder: Omit<Reminder, "id" | "creatorId"> = {
      note,
      date: date || todayStr,
      time,
      triggered: false,
    };

    if (assigneeId) {
      newReminder.assigneeId = assigneeId;
    }
    try {
      await soft7AxiosInstance.post("/admin/users/reminder", newReminder);
      mutateReminders();
      setNote("");
      setTime("");
      setDate("");
      setAssigneeId(null);
      setShowNewReminder(false);
    } catch (e) {
      console.error("Error adding reminder:", e);
    }
  };

  const getUsers = async () => {
    try {
      const res = await soft7AxiosInstance.get("/api/user/users/getUsers");

      const users = await res.data;
      setAssignees(await users.data);
      return users;
    } catch (e) {
      console.error("Error fetching users:", e);
    }
  };

  useEffect(() => {
    // getUsers(); // Removed local API call
  }, []);

  /* Reminder trigger check */
  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const curDate = now.toISOString().split("T")[0];
      const curTime = now.toTimeString().slice(0, 5);
      const allReminders = reminders || [];
      for (const r of allReminders) {
        if (!r.triggered && r.date === curDate && r.time === curTime) {
          setPopupReminder({ ...r });
          try {
            await soft7AxiosInstance.put(`/admin/users/reminder/${r.id}`, {
              triggered: true,
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
      mutateReminders();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [reminders, mutateReminders]);

  /* Play chime on popup */
  const playChime = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    gain.connect(ctx.destination);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = osc2.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    osc2.frequency.setValueAtTime(987.77, now);
    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  };

  useEffect(() => {
    if (popupReminder) playChime();
  }, [popupReminder]);

  /* Close Reminders dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        remindersRef.current &&
        !remindersRef.current.contains(e.target as Node)
      ) {
        setShowRemindersDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Close Notifications dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setOpenReminders(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Render */
  return (
    <>
      {/* =================== TOPBAR =================== */}
      <header className="topbar-main-wrapper sticky top-0 w-full h-16
  flex items-center justify-between
  px-3 md:px-4 lg:px-6
  z-40"> 

        {/* LEFT: Breadcrumbs / Mobile Search */}
        <div className="flex min-w-0 items-center gap-3 w-full lg:w-auto">
          <button type="button" aria-label="Toggle navigation" className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}>
            <Menu size={20} />
          </button>
          {/* Mobile Search */}
          <div
            className="flex lg:hidden w-full max-w-[200px] relative"
            ref={mobileSearchRef}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

              <input
                type="text"
                value={searchQuery}
                placeholder="Search..."
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-card dark:bg-gray-800"
              />
            </div>

            {/* SEARCH RESULTS */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-card dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[var(--z-overlay)]">
                {searchResults.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.url}
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <span>{getResultIcon(item.type)}</span>

                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {item.title}
                      </span>

                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Breadcrumbs (Desktop only) */}
          <nav className="hidden lg:flex min-w-0 max-w-[min(58vw,52rem)] items-center gap-1 overflow-hidden text-sm whitespace-nowrap">
            {breadcrumbItems.length === 0 ? (
              <span className="font-semibold text-lg text-foreground">
                {pageTitle}
              </span>
            ) : (
              breadcrumbItems.map((item, idx) => (
                <span key={idx} className="flex min-w-0 items-center">
                  {item.isLast ? (
                    <span className="max-w-[12rem] truncate font-semibold text-lg text-foreground xl:max-w-[20rem]">
                      {item.label}
                    </span>
                  ) : (
                    <span className="max-w-[9rem] truncate text-sm font-medium text-muted-foreground xl:max-w-[12rem]">
                      {item.label}
                    </span>
                  )}
                  {idx < breadcrumbItems.length - 1 && (
                    <span className="mx-1 text-gray-300">/</span>
                  )}
                </span>
              ))
            )}
          </nav>
        </div>

        {/* MIDDLE: Search */}

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Subscription Button */}
          <div className="relative group">
            <button
              onClick={() => setShowSubscriptionPanel(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-linear-to-br hover:from-yellow-400 hover:to-orange-500 hover:text-primary-foreground transition-all duration-300"
              aria-label="Subscription"
              title="Subscription"
            >
              <Crown className="h-5 w-5 text-yellow-500 group-hover:text-primary-foreground dark:text-yellow-400 transition-colors" />
            </button>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setOpenReminders(!openReminders)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              {cnt > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-background" />
              )}
            </button>

            {openReminders && <Notifications cnt={setCntNotifications} />}
          </div>

          {/* Reminders */}
          <div className="relative" ref={remindersRef}>
            <button
              onClick={() => setShowRemindersDropdown((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition cursor-pointer"
            >
              <Clock className="h-5 w-5 text-accent" />
              {remindersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 border border-background shadow-xs">
                  {remindersCount}
                </span>
              )}
            </button>

            {showRemindersDropdown && (
              <div
                className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-2xl shadow-xl z-[var(--z-overlay)] overflow-hidden font-sans transition-all duration-300"
              >
                {/* HEADER */}
                <div
                  className="px-5 py-3.5 border-b border-border flex justify-between items-center"
                  style={{ backgroundColor: "#eaf1ee" }}
                >
                  <h3 className="font-bold text-sm text-foreground">
                    Remind Me
                  </h3>

                  <button
                    onClick={() => setShowNewReminder(true)}
                    className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition cursor-pointer"
                    style={{ backgroundColor: "var(--terracotta)", color: "#FFFFFF" }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* TABS */}
                <div className="p-3 bg-paper-2/40 border-b border-border">
                  <div className="flex w-full rounded-xl bg-paper-2 p-1 border border-border text-xs font-bold">
                    <button
                      onClick={() => setActiveTab("today")}
                      className={`flex-1 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        activeTab === "today"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Today
                    </button>

                    <button
                      onClick={() => setActiveTab("tomorrow")}
                      className={`flex-1 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                        activeTab === "tomorrow"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>

                {/* LIST */}
                <div className="p-4 max-h-60 overflow-y-auto space-y-2.5 custom-scrollbar bg-background">
                  {activeTab === "today" ? (
                    remindersToday.length === 0 ? (
                      <p className="text-center text-muted-foreground text-xs py-4 italic">
                        No reminders for today
                      </p>
                    ) : (
                      remindersToday.map((r, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-card border border-border shadow-2xs transition"
                        >
                          <p className="text-xs font-bold text-foreground">
                            {r.note}
                          </p>
                          <p className="text-[11px] font-semibold text-accent mt-1">
                            {r.time}
                          </p>
                        </div>
                      ))
                    )
                  ) : remindersTomorrow.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-4 italic">
                      No reminders for tomorrow
                    </p>
                  ) : (
                    remindersTomorrow.map((r, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-card border border-border shadow-2xs transition"
                      >
                        <p className="text-xs font-bold text-foreground">
                          {r.note}
                        </p>
                        <p className="text-[11px] font-semibold text-accent mt-1">
                          {r.time}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfileMenu((p) => !p)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-paper-2 border border-border hover:bg-paper-2/80 transition shadow-2xs text-foreground cursor-pointer"
            >
              <div className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center bg-primary/15 text-terracotta border border-border shrink-0">
                {userData.image ? (
                  <img
                    src={userData.image}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-sm text-terracotta">
                    {userData.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <span className="hidden md:block text-xs font-bold text-foreground">
                {userData.name}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-2xl shadow-xl border border-border z-[var(--z-modal)] overflow-hidden p-1.5 font-sans animate-in fade-in zoom-in-95 duration-150">
                <Link
                  href="/user/settings/profile"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-foreground hover:bg-primary/10 hover:text-terracotta transition"
                >
                  <User size={15} /> Profile
                </Link>
                <Link
                  href="/user/settings"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-foreground hover:bg-primary/10 hover:text-terracotta transition"
                >
                  <Settings size={15} /> Settings
                </Link>
                <Link
                  href="/user/settings/billing"
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-foreground hover:bg-primary/10 hover:text-terracotta transition"
                >
                  <CreditCard size={15} /> Billing
                </Link>
                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", {
                      method: "POST",
                    });
                    // ✅ Also clear auth cookies from client side
                    document.cookie =
                      "consoleAccessToken=; path=/; max-age=0; SameSite=Lax";
                    document.cookie =
                      "accessToken=; path=/; max-age=0; SameSite=Lax";
                    document.cookie =
                      "refreshToken=; path=/; max-age=0; SameSite=Lax";
                    document.cookie =
                      "adminToken=; path=/; max-age=0; SameSite=Lax";
                    document.cookie =
                      "company_id=; path=/; max-age=0; SameSite=Lax";
                    document.cookie =
                      "user_role=; path=/; max-age=0; SameSite=Lax";
                    localStorage.clear();
                    router.push("/auth");
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 transition cursor-pointer"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CREATE REMINDER MODAL */}
      {showNewReminder &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
            <div
              className="w-full max-w-sm rounded-2xl overflow-hidden bg-card border border-border shadow-2xl font-sans animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div
                className="flex justify-between items-center px-5 py-3.5 border-b border-border"
                style={{ backgroundColor: "#eaf1ee" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--terracotta)" }}>
                    <Clock className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.2} style={{ color: "#FFFFFF", stroke: "#FFFFFF" }} />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">
                    Create Reminder
                  </h2>
                </div>

                <button
                  onClick={() => setShowNewReminder(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-black/5 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 bg-card">
                {/* Note */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Reminder Note
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Enter reminder note..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-black/15 bg-[var(--background)] text-foreground placeholder:text-[#8C827A] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-black/15 bg-[var(--background)] text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">
                      Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-black/15 bg-[var(--background)] text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition cursor-pointer"
                    />
                  </div>
                </div>

                {/* Assign to */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Assign to
                  </label>
                  <select
                    value={assigneeId ?? ""}
                    onChange={(e) => setAssigneeId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-black/15 bg-[var(--background)] text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition cursor-pointer font-sans"
                  >
                    <option value={userData.id}>Myself</option>
                    {assignees
                      .filter((u) => u.id !== userData.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowNewReminder(false)}
                    className="btn btn-secondary text-xs px-4 py-2 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleAddReminder}
                    className="btn btn-primary text-xs px-5 py-2 cursor-pointer shadow-xs"
                    style={{ backgroundColor: "var(--terracotta)", color: "#FFFFFF" }}
                  >
                    Save Reminder
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* SUBSCRIPTION PANEL - rendered via portal so fixed positioning is always viewport-relative */}
      {showSubscriptionPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <SubscriptionPanel
            subscriptionData={subscriptionData}
            onClose={() => setShowSubscriptionPanel(false)}
          />,
          document.body,
        )}
    </>
  );
}