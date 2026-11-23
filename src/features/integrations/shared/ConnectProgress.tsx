"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConnectPhase } from "./useOAuthPopup";

/** What a connection hook exposes for an OAuth popup attempt (Google Sheets, Shopify, …). */
export interface ConnectProgressState {
  phase: ConnectPhase;
  connectError: string | null;
  /** Retries the last attempt. Must stay synchronous so the popup isn't blocked. */
  connect: () => void;
  cancel: () => void;
  dismiss: () => void;
  /** Optional manual check after a timeout. */
  refresh?: () => Promise<unknown>;
}

/** Status line for an in-flight / failed OAuth popup attempt. Renders nothing when idle. */
export default function ConnectProgress({
  state,
  provider = "Google",
  className,
}: {
  state: ConnectProgressState;
  provider?: string;
  className?: string;
}) {
  const { phase, connectError, connect, cancel, dismiss } = state;
  if (phase === "idle") return null;

  if (phase === "waiting") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-md border border-info-border bg-info-bg px-3 py-2.5 text-xs text-info", className)} role="status">
        <RefreshCw size={14} className="shrink-0 animate-spin" />
        <span className="min-w-0 flex-1">
          Waiting for {provider}… Approve access in the popup window. This updates automatically.
        </span>
        <Button size="sm" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  const message =
    phase === "blocked"
      ? `Your browser blocked the ${provider} popup. Allow popups for this site, then try again.`
      : phase === "timeout"
        ? `We didn't receive the ${provider} connection in time. If you finished in the popup, check again; otherwise retry.`
        : phase === "cancelled"
          ? `${provider} connection cancelled.`
          : connectError ?? `Couldn't start the ${provider} connection.`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 text-xs",
        phase === "cancelled" ? "border-border bg-surface-muted text-muted-foreground" : "border-warning-border bg-warning-bg text-warning",
        className,
      )}
      role={phase === "cancelled" ? "status" : "alert"}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {phase === "timeout" && state.refresh && (
        <Button size="sm" variant="ghost" onClick={() => void state.refresh?.().then(dismiss)}>
          Check again
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={connect}>
        Try again
      </Button>
      <Button size="sm" variant="ghost" onClick={dismiss}>
        Dismiss
      </Button>
    </div>
  );
}
