"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, Clock, Gauge, Loader2 } from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/* ── Meta WABA messaging limit: formatting, API and shared UI ─────────────── */

export type MessagingLimitData = {
  whatsapp_business_manager_messaging_limit?: string | null;
  messaging_limit_synced_at?: string | null;
};

const MESSAGING_LIMIT_LABELS: Record<string, string> = {
  TIER_50: "50",
  TIER_250: "250",
  TIER_1K: "1,000",
  TIER_2K: "2,000",
  TIER_10K: "10,000",
  TIER_100K: "100,000",
  TIER_UNLIMITED: "Unlimited",
  UNTIERED: "Untiered",
};

/** Human label for a Meta tier; null means it was never fetched (not zero, not unlimited). */
export const formatMessagingLimit = (tier: string | null | undefined) => {
  if (!tier) return null;
  return MESSAGING_LIMIT_LABELS[tier] ?? tier;
};

/** Numeric tiers are a per-24h conversation cap. */
const isCountTier = (tier: string | null | undefined) => !!tier?.startsWith("TIER_") && tier !== "TIER_UNLIMITED";

export const formatSyncedAt = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export const messagingLimitError = (error: unknown, fallback = "Couldn't update the messaging limit from Meta.") =>
  isAxiosError(error)
    ? error.response?.data?.error?.message || error.response?.data?.message || fallback
    : error instanceof Error ? error.message : fallback;

/** Asks the API to fetch the tier from Meta and save it. `wabaId` may be the Meta WABA ID or the internal UUID. */
export async function refreshWabaMessagingLimit(wabaId: string): Promise<MessagingLimitData> {
  const res = await soft7AxiosInstance.post(`/admin/waba/${encodeURIComponent(wabaId)}/messaging-limit/refresh`);
  if (res.data?.success === false) {
    throw new Error(res.data?.error?.message || res.data?.message || "Failed to refresh messaging limit.");
  }
  return res.data?.data ?? {};
}

/** Last saved value, without calling Meta. */
export async function getWabaMessagingLimit(wabaId: string): Promise<MessagingLimitData> {
  const res = await soft7AxiosInstance.get(`/admin/waba/${encodeURIComponent(wabaId)}/messaging-limit`);
  return res.data?.data ?? {};
}

export type MessagingLimitState = {
  limit: string | null;
  syncedAt: string | null;
  refreshing: boolean;
  error: string | null;
};

const EMPTY_STATE: MessagingLimitState = { limit: null, syncedAt: null, refreshing: false, error: null };

/**
 * Refreshes the selected WABA's limit from Meta once per page load (and once for each other WABA
 * the user switches to). If Meta fails, falls back to the last saved value and reports the error.
 */
export function useWabaMessagingLimit(wabaId: string | null | undefined): MessagingLimitState {
  const [byId, setById] = useState<Record<string, MessagingLimitState>>({});
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!wabaId || started.current.has(wabaId)) return;
    started.current.add(wabaId);

    const update = (patch: Partial<MessagingLimitState>) =>
      setById((prev) => ({ ...prev, [wabaId]: { ...(prev[wabaId] ?? EMPTY_STATE), ...patch } }));

    update({ refreshing: true, error: null });
    refreshWabaMessagingLimit(wabaId)
      .then((data) =>
        update({
          limit: data.whatsapp_business_manager_messaging_limit ?? null,
          syncedAt: data.messaging_limit_synced_at ?? null,
          error: null,
        }),
      )
      .catch(async (error) => {
        let saved: MessagingLimitData = {};
        try {
          saved = await getWabaMessagingLimit(wabaId);
        } catch {
          // Nothing saved either; the UI shows "Not fetched".
        }
        update({
          limit: saved.whatsapp_business_manager_messaging_limit ?? null,
          syncedAt: saved.messaging_limit_synced_at ?? null,
          error: messagingLimitError(error),
        });
      })
      .finally(() => update({ refreshing: false }));
  }, [wabaId]);

  return (wabaId && byId[wabaId]) || EMPTY_STATE;
}

/* ── UI ──────────────────────────────────────────────────────────────── */

/** One-line summary for the WABA header card. */
export function MessagingLimitStrip({ limit, syncedAt, refreshing, error, className = "" }: MessagingLimitState & { className?: string }) {
  const label = formatMessagingLimit(limit);
  const updated = formatSyncedAt(syncedAt);

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-muted/60 px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-accent" />
        <span className="text-sm text-muted-foreground">Meta messaging limit</span>
        {label ? (
          <span className="text-sm font-bold text-foreground">
            {label}
            {isCountTier(limit) && <span className="font-normal text-muted-foreground"> conversations / 24h</span>}
          </span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{refreshing ? "Loading…" : "Not fetched"}</span>
        )}
      </div>

      <span className="hidden h-4 w-px bg-border sm:block" />

      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {refreshing ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Updating from Meta…
          </>
        ) : (
          <>
            <Clock size={12} />
            {updated ? `Updated ${updated}` : "Never updated"}
          </>
        )}
      </span>

      {error && !refreshing && (
        <span className="flex items-center gap-1 text-xs font-medium text-destructive" title={error}>
          <AlertCircle size={12} />
          Couldn&apos;t update from Meta — showing last saved value
        </span>
      )}
    </div>
  );
}

/** Compact badge for a table cell. */
export function MessagingLimitBadge({ limit, syncedAt, refreshing }: Pick<MessagingLimitState, "limit" | "syncedAt" | "refreshing">) {
  const label = formatMessagingLimit(limit);
  const updated = formatSyncedAt(syncedAt);

  if (!label) {
    return <span className="whitespace-nowrap text-sm text-muted-foreground">{refreshing ? "Loading…" : "Not fetched"}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent/10 px-3 py-1.5 text-[13px] font-semibold text-accent"
      title={updated ? `Updated ${updated}` : undefined}
    >
      <Gauge size={13} />
      {label}
      {isCountTier(limit) && <span className="font-normal opacity-75">/ 24h</span>}
    </span>
  );
}
