/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Plus,
  Eye,
  MoreHorizontal,
  Trash2,
  X,
  Check,
  Loader2,
  Settings,
  ExternalLink,
  Clock,
  RefreshCw,
  UserPlus,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { isAxiosError } from "axios";
import {
  MessagingLimitStrip,
  messagingLimitError,
  refreshWabaMessagingLimit,
} from "@/features/integrations/components/MessagingLimit";

type WhatsAppAccount = {
  id: string;
  display_phone_number: string;
  phone_number_id: string;
  waba_id: string;
  status: string;
  verified_name?: string;
  quality_rating?: string;
  messaging_limit_tier?: number | null;
  meta_data?: Record<string, any>;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
  // keep these for backward compat
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  isActive?: boolean;
};

// Summary of a WABA (WhatsApp Business Account) as returned by /admin/waba
type WabaSummary = {
  id: string; // internal id - this is the value used as :wabaId in URLs
  waba_id: string; // Meta's numeric WABA id
  name: string;
  currency?: string;
  timezone?: string | null;
  message_template_namespace?: string | null;
  status?: string;
  meta_data?: Record<string, any>;
  // Meta messaging limit tier saved by the API (null until the first refresh).
  whatsapp_business_manager_messaging_limit?: string | null;
  messaging_limit_synced_at?: string | null;
};

type MessagingLimit = Pick<WabaSummary, "whatsapp_business_manager_messaging_limit" | "messaging_limit_synced_at">;

export default function ManageWhatsAppPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<Partial<WhatsAppAccount> | null>(null);
  const [saving, setSaving] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const [pendingStatus, setPendingStatus] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingWabaId, setDeletingWabaId] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── WABA (multi-account) selection state ──
  const [wabaAccounts, setWabaAccounts] = useState<WabaSummary[]>([]);
  const [wabaLoading, setWabaLoading] = useState(true);
  const [selectedWabaId, setSelectedWabaId] = useState<string | null>(null);
  const [syncingWabaId, setSyncingWabaId] = useState<string | null>(null);
  const [refreshingLimitIds, setRefreshingLimitIds] = useState<Record<string, boolean>>({});
  const refreshedLimitIdsRef = useRef<Set<string>>(new Set());
  const [limitErrors, setLimitErrors] = useState<Record<string, string>>({});
  const selectedWabaIdRef = useRef<string | null>(null);
  const syncControllerRef = useRef<AbortController | null>(null);
  const phoneRequestRef = useRef(0);
  selectedWabaIdRef.current = selectedWabaId;

  // Fetch the list of WABAs the user has access to, and pick a default
  // (the first one) unless a selection has already been made.
  const fetchWabaAccounts = useCallback(async () => {
    setWabaLoading(true);
    try {
      const res = await soft7AxiosInstance.get("/admin/waba");
      const data = res.data;
      const wabaList: WabaSummary[] = data?.data || data || [];

      if (Array.isArray(wabaList)) {
        setWabaAccounts(wabaList);

        setSelectedWabaId((prev) => {
          if (prev && wabaList.some((w) => w.id === prev)) {
            return prev;
          }
          const onboardedWabaId = new URLSearchParams(window.location.search).get("waba_id");
          const onboardedWaba = wabaList.find(w => w.waba_id === onboardedWabaId);
          if (onboardedWaba) return onboardedWaba.id;
          return wabaList.length > 0 ? wabaList[0].id : null;
        });
      }
    } catch (error) {
      console.error("Failed to fetch WABA accounts:", error);
      toast.error("Failed to load WhatsApp Business Accounts");
    } finally {
      setWabaLoading(false);
    }
  }, []);

  // Fetch phone numbers scoped to the currently selected WABA.
  const fetchAccounts = useCallback(
    async (wabaId: string, signal?: AbortSignal) => {
      if (!wabaId || wabaId !== selectedWabaIdRef.current || signal?.aborted) return false;
      const requestId = ++phoneRequestRef.current;
      const isCurrent = () => requestId === phoneRequestRef.current && wabaId === selectedWabaIdRef.current && !signal?.aborted;
      try {
        setLoading(true);
        const res = await soft7AxiosInstance.get(
          `/admin/waba/${encodeURIComponent(wabaId)}/phone-numbers`,
          { signal },
        );
        if (!isCurrent()) return false;

        const data = res.data;
        const accountList = data?.data || data;

        if (Array.isArray(accountList)) {
          setAccounts(accountList);

          const hasPending = accountList.some(
            (acc: WhatsAppAccount) => acc.status === "PENDING_EMBEDDED_SIGNUP",
          );

          if (pendingAccountId && !hasPending) {
            const resolvedAccount = accountList.find(
              (acc: WhatsAppAccount) => acc.id === pendingAccountId,
            );

            if (resolvedAccount?.status === "active") {
              toast.success("WhatsApp account setup completed!");
              setPendingStatus(false);
              setPendingAccountId(null);
              window.history.replaceState({}, "", "/integrations/whatsapp");
            }
          }

          return hasPending;
        }

        setAccounts([]);
        return false;
      } catch (error) {
        if (!isCurrent()) return false;
        console.error("Failed to fetch accounts:", error);
        return false;
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [pendingAccountId],
  );

  const syncWabaAndRefresh = useCallback(async (wabaId: string, controller: AbortController) => {
    syncControllerRef.current = controller;
    setSyncingWabaId(wabaId);
    setLoading(true);
    const toastId = toast.loading("Syncing WhatsApp account...");
    const isCurrent = () => syncControllerRef.current === controller && selectedWabaIdRef.current === wabaId && !controller.signal.aborted;
    try {
      const response = await soft7AxiosInstance.post(
        `/admin/waba/${encodeURIComponent(wabaId)}/sync`,
        undefined,
        { signal: controller.signal },
      );
      if (!isCurrent()) {
        toast.dismiss(toastId);
        return;
      }
      if (response.data?.success === false) {
        throw new Error(response.data?.error?.message || response.data?.message || "Failed to sync WhatsApp account.");
      }
      toast.success(response.data?.message || "WhatsApp account synced successfully.", { id: toastId });
    } catch (error) {
      if (!isCurrent()) {
        toast.dismiss(toastId);
        return;
      }
      const message = isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.error?.message || "Failed to sync WhatsApp account. Please try again."
        : error instanceof Error ? error.message : "Failed to sync WhatsApp account. Please try again.";
      toast.error(message, { id: toastId });
    } finally {
      // Still show cached phone numbers if synchronization failed.
      if (isCurrent()) await fetchAccounts(wabaId, controller.signal);
      if (syncControllerRef.current === controller) {
        syncControllerRef.current = null;
        setSyncingWabaId(null);
      }
    }
  }, [fetchAccounts]);

  const mergeMessagingLimit = useCallback((wabaId: string, limit: MessagingLimit) => {
    setWabaAccounts((list) =>
      list.map((w) =>
        w.id === wabaId
          ? {
              ...w,
              whatsapp_business_manager_messaging_limit: limit.whatsapp_business_manager_messaging_limit ?? null,
              messaging_limit_synced_at: limit.messaging_limit_synced_at ?? null,
            }
          : w,
      ),
    );
  }, []);

  // Older API rows may not include the limit columns; read the saved value (no Meta call).
  useEffect(() => {
    const waba = wabaAccounts.find((w) => w.id === selectedWabaId);
    if (!waba || "whatsapp_business_manager_messaging_limit" in waba) return;
    let cancelled = false;
    soft7AxiosInstance
      .get(`/admin/waba/${encodeURIComponent(waba.id)}/messaging-limit`)
      .then((res) => {
        if (!cancelled) mergeMessagingLimit(waba.id, res.data?.data ?? {});
      })
      .catch((error) => {
        // Mark as loaded so we don't retry in a loop; the UI shows "Not fetched".
        if (!cancelled) mergeMessagingLimit(waba.id, {});
        console.error("Failed to load messaging limit:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWabaId, wabaAccounts, mergeMessagingLimit]);

  // Refresh the tier from Meta once per WABA each time the page loads (and when another WABA is
  // first selected). On failure the previously saved value and its timestamp are kept.
  useEffect(() => {
    const wabaId = selectedWabaId;
    if (!wabaId || refreshedLimitIdsRef.current.has(wabaId)) return;
    refreshedLimitIdsRef.current.add(wabaId);

    setRefreshingLimitIds((prev) => ({ ...prev, [wabaId]: true }));
    setLimitErrors((prev) => {
      const next = { ...prev };
      delete next[wabaId];
      return next;
    });

    refreshWabaMessagingLimit(wabaId)
      .then((data) => mergeMessagingLimit(wabaId, data))
      .catch((error) => {
        setLimitErrors((prev) => ({
          ...prev,
          [wabaId]: messagingLimitError(error),
        }));
      })
      .finally(() => {
        setRefreshingLimitIds((prev) => {
          const next = { ...prev };
          delete next[wabaId];
          return next;
        });
      });
  }, [selectedWabaId, mergeMessagingLimit]);

  // Load the WABA list once on mount.
  useEffect(() => {
    fetchWabaAccounts();
  }, [fetchWabaAccounts]);

  // Sync on initial selection and every WABA change, then reload phone numbers.
  useEffect(() => {
    if (selectedWabaId) {
      const controller = new AbortController();
      setAccounts([]);
      void syncWabaAndRefresh(selectedWabaId, controller);
      return () => {
        controller.abort();
        syncControllerRef.current?.abort();
      };
    } else {
      setAccounts([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWabaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const pending = params.get("status") === "pending";
    const accountId = params.get("account_id");

    if (success) {
      toast.success(
        "WhatsApp account connected successfully! Credits have been allocated.",
      );
      if (accountId) {
        fetch("/api/user/whatsapp/accounts/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accountId }),
        })
          .then(() => fetchWabaAccounts())
          .catch(() => fetchWabaAccounts());
      } else {
        fetchWabaAccounts();
      }
      window.history.replaceState({}, "", "/integrations/whatsapp");
    }

    if (pending) {
      setPendingStatus(true);
      setPendingAccountId(accountId);
      if (accountId) {
        fetch("/api/user/whatsapp/accounts/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accountId }),
        }).catch(console.error);
      }
    }
  }, [fetchWabaAccounts]);

  useEffect(() => {
    if (pendingStatus && selectedWabaId) {
      refreshIntervalRef.current = setInterval(async () => {
        const stillPending = await fetchAccounts(selectedWabaId);
        if (!stillPending) {
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
          }
        }
      }, 10000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [pendingStatus, selectedWabaId, fetchAccounts]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOnboardError(null);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("console_access_token")
        : null;

    if (!token) return;

    try {
      const res = await soft7AxiosInstance.post("/admin/waba/onboard", {
        waba_id: editingAccount?.wabaId,
      });

      const data = res.data;

      if (!res.status.toString().startsWith("2")) {
        setOnboardError(
          data?.message ||
            data?.error ||
            `Error ${res.status}: Invalid WABA ID or request failed.`,
        );
        return;
      }

      setIsModalOpen(false);
      setOnboardError(null);
      fetchWabaAccounts();
      toast.success("Account connected successfully!");
    } catch (error) {
      setOnboardError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (account: WhatsAppAccount | null = null) => {
    setEditingAccount(account || { isActive: true });
    setIsModalOpen(true);
  };

  const getStatusBadge = (account: WhatsAppAccount) => {
    if (account.status === "PENDING_EMBEDDED_SIGNUP") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full tex font-bold bg-warning/15 text-warning">
          <Clock size={12} className="animate-pulse" />
          Setting up...
        </span>
      );
    }
    if (account.status === "ERROR") {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full tex font-bold bg-destructive/10 text-destructive">
          Error
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full tex font-bold ${
          account.isActive
            ? "bg-accent/15 text-accent"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {account.isActive ? "Active" : "Inactive"}
      </span>
    );
  };

  const handleRegister = async (accountId: string) => {
    setRegisteringId(accountId);
    const toastId = toast.loading("Registering phone number...");
    try {
      const res = await soft7AxiosInstance.post("/api/user/whatsapp/register", {
        accountId,
      });
      const data = res.data;
      if (data?.success) {
        toast.success("Phone number registered successfully!", { id: toastId });
        if (selectedWabaId) fetchAccounts(selectedWabaId);
      } else {
        toast.error(
          typeof data?.error === "object"
            ? JSON.stringify(data.error)
            : data?.error || "Registration failed",
          { id: toastId },
        );
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(
        err?.response?.data?.error || "Failed to register phone number",
        { id: toastId },
      );
    } finally {
      setRegisteringId(null);
    }
  };

  /**
   * Most specific error text from an API body. Meta errors arrive nested, e.g.
   * { message: "Failed to fetch…", error: { error: { message: "Register endpoint is not available…" } } }.
   */
  const specificErrorMessage = (body: any, fallback: string): string => {
    const candidates = [
      body?.error?.error?.error_user_msg,
      body?.error?.error?.message,
      body?.error?.error_user_msg,
      body?.error?.message,
      typeof body?.error === "string" ? body.error : undefined,
      body?.message,
    ];
    const found = candidates.find((m) => typeof m === "string" && m.trim());
    return found ? found.trim() : fallback;
  };

  const handleVerify = async (phoneNumberId: string) => {
    setVerifyingId(phoneNumberId);

    const toastId = toast.loading("Verifying phone number...");

    try {
      const res = await soft7AxiosInstance.post(
        `/admin/waba/${phoneNumberId}/verify-number`,
      );

      const data = res.data;

      if (data?.success) {
        toast.success(data?.message || "Phone number verified successfully!", {
          id: toastId,
        });

        if (selectedWabaId) fetchAccounts(selectedWabaId);
      } else {
        toast.error(specificErrorMessage(data, "Verification failed"), {
          id: toastId,
        });
      }
    } catch (e: any) {
      console.error("Verify Error:", e);

      toast.error(specificErrorMessage(e?.response?.data, "Failed to verify phone number"), {
        id: toastId,
      });
    } finally {
      setVerifyingId(null);
    }
  };
  const confirmDeleteWaba = () => {
    if (!selectedWabaId) return;

    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold text-foreground">
              Delete WhatsApp Business Account?
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              This will remove the connected phone numbers and cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                toast.dismiss(t.id);
                handleDeleteWaba();
              }}
              className="px-3 py-1.5 text-sm font-medium text-destructive-foreground bg-destructive hover:opacity-90 rounded-lg"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      {
        duration: Infinity,
        position: "top-center",
      },
    );
  };
  const handleDeleteWaba = async () => {
    if (!selectedWabaId) return;
    setDeletingWabaId(selectedWabaId);
    const toastId = toast.loading("Deleting WhatsApp Business Account...");

    try {
      await soft7AxiosInstance.delete(
        `/admin/waba/${selectedWabaId}/waba-account`,
      );
      toast.success("WhatsApp Business Account deleted successfully.", {
        id: toastId,
      });
      setAccounts([]);
      await fetchWabaAccounts();
    } catch (error: unknown) {
      const apiError = error as {
        response?: {
          data?: { message?: string; error?: { message?: string } | string };
        };
      };
      const errorMessage = apiError.response?.data?.error;
      toast.error(
        typeof errorMessage === "object"
          ? errorMessage.message ||
              "Failed to delete WhatsApp Business Account."
          : errorMessage ||
              apiError.response?.data?.message ||
              "Failed to delete WhatsApp Business Account.",
        { id: toastId },
      );
    } finally {
      setDeletingWabaId(null);
    }
  };

  /* ── Shared field classNames (theme-token based — flips automatically in dark mode) ── */
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent transition-all text-foreground placeholder-muted-foreground";

  const labelCls = "text-sm font-bold ml-1 text-foreground/80";

  const selectCls =
    "px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent transition-all text-foreground";

  const selectedWaba =
    wabaAccounts.find((w) => w.id === selectedWabaId) || null;

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        </div>

        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Manage WhatsApp
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Configure your Meta Business credentials and API settings
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/user/signup-embedded"
              className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
            >
              <ExternalLink size={20} />
              Embedded Signup
            </Link>
            <Link
              href="/user/integrations/whatsapp/embedded-signup"
              className="flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-xl font-semibold hover:bg-muted transition-all duration-200 border border-border"
            >
              <Settings size={18} />
              Embedded Signup Setup
            </Link>
            <button
              onClick={() => openEdit()}
              className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
            >
              Add Account
            </button>
          </div>
        </div>

        {/* Pending Status Banner */}
        {pendingStatus && (
          <div className="mb-6 bg-warning/10 border border-warning/30 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-warning animate-spin" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">
                  WhatsApp setup is in progress
                </h3>
                <p className="text-muted-foreground text-sm">
                  This may take up to 1 minute. The page will automatically
                  update once complete.
                </p>
              </div>
            </div>
            <button
              onClick={() => selectedWabaId && fetchAccounts(selectedWabaId)}
              className="px-4 py-2 bg-warning/15 hover:bg-warning/25 text-foreground rounded-lg font-medium text-sm transition-colors"
            >
              Check Now
            </button>
          </div>
        )}

        {/* WABA selector — shown whenever the user has at least one WABA */}
        {!wabaLoading && wabaAccounts.length >= 1 && (
          <div className="mb-6 rounded-2xl p-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 bg-card border border-border shadow-sm">
            <div>
              <p className="text-sm font-bold mb-1 text-foreground">
                WhatsApp Business Account
              </p>
              <p className="text-sm text-muted-foreground">
                Phone numbers below belong to the selected account.
              </p>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-3 min-w-0">
              <select
                className={`${selectCls} min-w-0 flex-1 sm:flex-none`}
                aria-label="WhatsApp Business Account"
                value={selectedWabaId ?? ""}
                onChange={(e) => setSelectedWabaId(e.target.value)}
              >
                {wabaAccounts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.waba_id ? `(${w.waba_id})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (selectedWabaId && !syncControllerRef.current) {
                    void syncWabaAndRefresh(selectedWabaId, new AbortController());
                  }
                }}
                disabled={!selectedWabaId || syncingWabaId !== null || wabaLoading}
                className="flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} className={syncingWabaId ? "animate-spin" : ""} />
                {syncingWabaId ? "Syncing..." : "Sync"}
              </button>
            </div>

            {/* Meta messaging limit for the selected WABA */}
            {selectedWaba && (
              <MessagingLimitStrip
                className="sm:basis-full"
                limit={selectedWaba.whatsapp_business_manager_messaging_limit ?? null}
                syncedAt={selectedWaba.messaging_limit_synced_at ?? null}
                refreshing={!!refreshingLimitIds[selectedWaba.id]}
                error={limitErrors[selectedWaba.id] ?? null}
              />
            )}
          </div>
        )}

        {wabaLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-card rounded-3xl border border-border shadow-sm">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-muted-foreground font-medium">
              Loading your WhatsApp Business Accounts...
            </p>
          </div>
        ) : wabaAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-accent/10">
              <Plus className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              No WhatsApp Accounts
            </h3>
            <p className="max-w-md mx-auto mb-8 text-muted-foreground">
              You haven&apos;t added any WhatsApp Business accounts yet. Connect
              your first account to start sending messages.
            </p>
            <button
              onClick={() => openEdit()}
              className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
            >
              Add Account
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-card rounded-3xl border border-border shadow-sm">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-muted-foreground font-medium">
              Loading phone numbers...
            </p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-accent/10">
              <Plus className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              No Phone Numbers
            </h3>
            <p className="max-w-md mx-auto mb-8 text-muted-foreground">
              {selectedWaba?.name || "This WhatsApp Business Account"}{" "}
              doesn&apos;t have any phone numbers yet.
            </p>
            <button
              onClick={() => openEdit()}
              className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
            >
              Add Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                WhatsApp Accounts
              </h2>
            </div>

            {/* ── Accounts Table ── */}
            <div className="rounded-2xl overflow-hidden bg-card border border-border shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left border-collapse">
                  <thead>
                    <tr className="tex font-bold uppercase tracking-wider bg-muted text-accent">
                      <th className="px-6 py-4">Account</th>
                      <th className="px-6 py-4">Phone Number</th>
                      <th className="px-6 py-4">Phone Number ID</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accounts.map((account) => (
                      <tr
                        key={account.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        {/* Account (icon + name) */}
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 font-bold text-sm py-2.5 px-3 rounded-lg bg-accent/15 text-accent">
                              WA
                            </div>
                            <span className="font-semibold text-foreground">
                              {account.verified_name ||
                                account.phoneNumber ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        {/* Phone Number */}
                        <td className="px-6 py-4 align-middle">
                          <span className="whitespace-nowrap text-sm text-foreground/90">
                            {account.display_phone_number ||
                              account.phoneNumber ||
                              "—"}
                          </span>
                        </td>

                        {/* Phone Number ID */}
                        <td className="px-6 py-4 align-middle">
                          <code className="text-sm px-2 py-1 rounded font-mono bg-accent/10 text-accent">
                            {account.phone_number_id ||
                              account.phoneNumberId ||
                              "—"}
                          </code>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[20px] text-[13px] font-medium ${
                              account.status === "active" || account.isActive
                                ? "bg-accent/15 text-accent"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Check size={12} />
                            {account.status === "active" || account.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 align-middle">
                          <div className="flex flex-nowrap items-center justify-end gap-2">
                            {/* ── Verify Button ── */}
                            <button
                              onClick={() =>
                                handleVerify(account.phone_number_id)
                              }
                              disabled={verifyingId === account.phone_number_id}
                              className="flex h-9 w-9 items-center justify-center rounded-lg transition bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50"
                              title="Verify phone number"
                              aria-label="Verify phone number"
                            >
                              {verifyingId === account.phone_number_id ? (
                                <Loader2 size={17} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={17} />
                              )}
                            </button>

                            <button
                              onClick={confirmDeleteWaba}
                              disabled={deletingWabaId === selectedWabaId}
                              className="flex h-9 w-9 items-center justify-center rounded-lg transition disabled:opacity-50 bg-destructive/10 text-destructive hover:bg-destructive/20"
                              title="Delete WhatsApp Business Account"
                              aria-label="Delete WhatsApp Business Account"
                            >
                              {deletingWabaId === selectedWabaId ? (
                                <Loader2 size={17} className="animate-spin" />
                              ) : (
                                <Trash2 size={17} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL ── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 backdrop-blur-sm bg-black/60"
              onClick={() => {
                setIsModalOpen(false);
                setOnboardError(null);
              }}
            />

            {/* Modal card */}
            <div className="wa-modal relative rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 bg-card">
              {/* Header */}
              <div className="wa-modal-header px-8 py-6 border-b border-border bg-muted/40 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {editingAccount?.id
                      ? "Edit WhatsApp Config"
                      : "Connect New Account"}
                  </h2>
                  <p className="text-sm mt-1 text-muted-foreground">
                    Enter your Meta Graph API credentials
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="p-8" autoComplete="off">
                {/* Hidden dummy fields to defeat browser autofill */}
                <input
                  type="text"
                  name="prevent_autofill"
                  style={{ display: "none" }}
                  aria-hidden="true"
                  readOnly
                />
                <input
                  type="password"
                  name="prevent_autofill_pw"
                  style={{ display: "none" }}
                  aria-hidden="true"
                  readOnly
                />

                {/* WABA ID */}
                <div className="space-y-2">
                  <label className={labelCls}>WABA ID</label>
                  <input
                    required
                    autoComplete="off"
                    placeholder="WhatsApp Business Account ID"
                    className={`${inputCls} ${onboardError ? "border-destructive focus:border-destructive" : ""}`}
                    value={editingAccount?.wabaId || ""}
                    onChange={(e) => {
                      setOnboardError(null);
                      setEditingAccount({
                        ...editingAccount!,
                        wabaId: e.target.value,
                      });
                    }}
                  />
                  {onboardError && (
                    <div className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{onboardError}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setOnboardError(null);
                    }}
                    className="btn-cancel px-6 py-3 rounded-xl font-bold transition-colors text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    type="submit"
                    className="px-8 py-3 rounded-xl font-bold text-accent-foreground bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-xl hover:opacity-90"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check size={20} />
                    )}
                    {editingAccount?.id ? "Update Settings" : "Connect Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
