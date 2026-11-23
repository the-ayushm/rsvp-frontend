"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { Button, EmptyState, Modal } from "@/components/ui";
import type { AppDef, EventDef } from "../types";
import AppIcon from "./AppIcon";

const row =
  "flex min-h-[66px] w-full items-center gap-4 rounded-md px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

/** Two-step dialog driven by GET /flows/apps: Select App → Select trigger/action. */
export default function StepPickerModal({
  open,
  kind,
  catalog,
  initialAppKey,
  onRefresh,
  loading,
  onClose,
  onPick,
}: {
  open: boolean;
  kind: "trigger" | "action";
  catalog: AppDef[];
  initialAppKey?: string | null;
  onRefresh?: () => void;
  loading?: boolean;
  onClose: () => void;
  onPick: (app: AppDef, event: EventDef) => void;
}) {
  const [app, setApp] = useState<AppDef | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setApp(catalog.find((a) => a.key === initialAppKey && (kind === "trigger" ? a.triggers : a.actions).length > 0) ?? null);
    setQuery("");
  }, [open, catalog, initialAppKey, kind]);

  const q = query.trim().toLowerCase();
  const apps = useMemo(
    () =>
      catalog
        .filter((a) => (kind === "trigger" ? a.triggers : a.actions).length > 0)
        .filter((a) => !q || a.name.toLowerCase().includes(q)),
    [catalog, kind, q],
  );
  const events = useMemo(
    () =>
      app
        ? (kind === "trigger" ? app.triggers : app.actions).filter(
            (e) => !q || e.name.toLowerCase().includes(q) || (e.topic ?? "").toLowerCase().includes(q),
          )
        : [],
    [app, kind, q],
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      className="!max-w-[812px] !rounded-xl"
      title={app ? `Select ${kind}` : "Select App"}
      description={app ? `Choose a ${kind} from ${app.name}` : `Choose an app that provides ${kind}s`}
    >
      <div className="grid gap-4">
        {onRefresh && (
          <Button variant="ghost" size="sm" className="justify-self-end" leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : undefined} />} disabled={loading} onClick={onRefresh}>
            {loading ? "Loading apps…" : "Refresh apps"}
          </Button>
        )}
        {app && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => {
              setApp(null);
              setQuery("");
            }}
          >
            Back to Apps
          </Button>
        )}

        <div className="overflow-hidden rounded-lg border border-border shadow-xs">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              key={app?.key ?? "apps"}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={app ? `Search ${kind}s...` : "Search apps..."}
              aria-label={app ? `Search ${kind}s` : "Search apps"}
              className="h-[50px] w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain p-1.5">
            {!app &&
              apps.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={row}
                  onClick={() => {
                    setApp(a);
                    setQuery("");
                  }}
                >
                  <AppIcon appKey={a.key} className="!h-10 !w-9" />
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-foreground">{a.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {(kind === "trigger" ? a.triggers : a.actions).length} {kind}s
                    </span>
                  </span>
                </button>
              ))}

            {app &&
              events.map((event) => (
                <button key={event.key} type="button" className={row} onClick={() => onPick(app, event)}>
                  <AppIcon appKey={app.key} className="!h-10 !w-9" />
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-foreground">{event.name}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                      {event.topic ?? event.description ?? (event.write ? "Writes data" : "Reads data")}
                    </span>
                  </span>
                </button>
              ))}

            {(app ? events : apps).length === 0 && <EmptyState compact title={app ? `No ${kind}s match` : "No apps match"} />}
          </div>
        </div>
      </div>
    </Modal>
  );
}
