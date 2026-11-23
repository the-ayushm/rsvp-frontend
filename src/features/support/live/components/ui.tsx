"use client";

import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import type { StreamStatus, TicketStatus } from "../types";

const STATUS_STYLES: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-info-bg text-info border-info-border" },
  in_progress: { label: "In progress", className: "bg-warning-bg text-warning border-warning-border" },
  resolved: { label: "Resolved", className: "bg-success-bg text-success border-success-border" },
  closed: { label: "Closed", className: "bg-surface-active text-muted-foreground border-border" },
};

export function StatusPill({ status }: { status: TicketStatus | string | undefined }) {
  const s = STATUS_STYLES[(status as TicketStatus) ?? "open"] ?? STATUS_STYLES.open;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.className}`}>
      {s.label}
    </span>
  );
}

const CONNECTION: Record<StreamStatus, { label: string; dot: string; pulse?: boolean }> = {
  idle: { label: "Offline", dot: "bg-muted-foreground" },
  connecting: { label: "Connecting…", dot: "bg-warning", pulse: true },
  live: { label: "Online · replies in real time", dot: "bg-success" },
  reconnecting: { label: "Reconnecting…", dot: "bg-warning", pulse: true },
  expired: { label: "Session expired", dot: "bg-error" },
  denied: { label: "Unavailable", dot: "bg-error" },
};

export function ConnectionIndicator({ status, detail }: { status: StreamStatus; detail?: string | null }) {
  const c = CONNECTION[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title={detail ?? c.label} role="status" aria-live="polite">
      <span className="relative flex h-2 w-2">
        {c.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}

export function Avatar({ name, tone = "primary", size = 28 }: { name?: string | null; tone?: "primary" | "muted"; size?: number }) {
  const initials =
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "S";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        tone === "primary" ? "bg-primary text-primary-foreground" : "bg-surface-active text-foreground"
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (Date.now() - d.getTime() < 60_000) return "now";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
}

export const clockTime = (iso: string) => format(new Date(iso), "h:mm a");
