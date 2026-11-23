"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, CircleX, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { flowsApi, toFlowError } from "../api";
import { findEvent } from "../catalog";
import { isTerminalRun, runStepResults } from "../steps";
import type { FlowRun } from "../types";
import type { FlowBuilder } from "../useFlowBuilder";

export const formatTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

/** Pretty JSON rendered as plain text — never as HTML. */
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
  return (
    <pre className={cn("overflow-auto whitespace-pre-wrap break-all bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground", className)}>
      {text}
    </pre>
  );
}

const RUN_BADGE: Record<string, { variant: "success" | "error" | "warning" | "info" | "neutral"; icon: React.ReactNode; label: string }> = {
  queued: { variant: "neutral", icon: <Clock size={12} />, label: "Queued" },
  running: { variant: "info", icon: <Spinner size="sm" />, label: "Running" },
  succeeded: { variant: "success", icon: <CircleCheck size={12} />, label: "Succeeded" },
  failed: { variant: "error", icon: <CircleX size={12} />, label: "Failed" },
  requires_review: { variant: "warning", icon: <TriangleAlert size={12} />, label: "Needs review" },
  cancelled: { variant: "neutral", icon: <CircleDashed size={12} />, label: "Cancelled" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const b = RUN_BADGE[status] ?? { variant: "neutral" as const, icon: <CircleDashed size={12} />, label: status };
  return (
    <Badge variant={b.variant} className="inline-flex items-center gap-1">
      {b.icon}
      {b.label}
    </Badge>
  );
}

const errorText = (e: unknown) => (e == null ? null : typeof e === "string" ? e : (e as any)?.message ?? JSON.stringify(e, null, 2));

export function RunDetail({ run, builder }: { run: FlowRun; builder: FlowBuilder }) {
  const results = runStepResults(run);
  const topError = errorText(run.error);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <RunStatusBadge status={run.status} />
        {run.is_test && <Badge variant="info">Test</Badge>}
        <span>{formatTime(run.createdAt)}</span>
        <span className="ml-auto font-mono">{run.id}</span>
      </div>
      {run.status === "requires_review" && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          The outcome is uncertain: a provider write (e.g. a row or payment link) may already have happened. Check the provider before
          running again — this run is never retried automatically.
        </p>
      )}
      {topError && <JsonBlock value={topError} className="rounded-md border border-error-border text-error" />}
      {results.length === 0 ? (
        !isTerminalRun(run.status) ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner size="sm" /> Waiting for actions to start…
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No action results recorded.</p>
        )
      ) : (
        <ol className="space-y-2">
          {results.map((r: any, i: number) => {
            const stepId = String(r.stepId ?? r.step_id ?? "");
            const step = builder.steps.find((s) => s._id === stepId);
            const name =
              r.name ?? step?.name ?? findEvent(builder.catalog, r.appKey ?? step?.appKey ?? null, r.key ?? step?.key ?? null, "action").event?.name ?? `Action ${i + 1}`;
            const output = r.output ?? r.result;
            const err = errorText(r.error);
            return (
              <li key={stepId || i} className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center gap-2 bg-surface-muted px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">
                    {i + 1}. {String(name)}
                  </span>
                  {r.status && <RunStatusBadge status={String(r.status)} />}
                </div>
                {err && <JsonBlock value={err} className="max-h-48 border-t border-border text-error" />}
                {output !== undefined && <JsonBlock value={output} className="max-h-60 border-t border-border" />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Polls a run until it reaches a terminal state. */
export function useRunPoller(flowId: string, runId: string | null) {
  const [run, setRun] = useState<FlowRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRun(null);
    setError(null);
    if (!runId) return;
    let stopped = false;
    let delay = 1500;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await flowsApi.run(flowId, runId);
        if (stopped) return;
        setRun(r);
        setError(null);
        delay = 1500;
        if (isTerminalRun(r.status)) return;
      } catch (err) {
        const e = toFlowError(err);
        if (stopped) return;
        setError(e.message);
        if (e.status === 404 || e.status === 403) return;
        delay = Math.min(delay * 2, 15000);
      }
      if (Date.now() - started < 15 * 60 * 1000) timer = setTimeout(tick, delay);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [flowId, runId]);

  return { run, error };
}

export function RunHistory({ builder }: { builder: FlowBuilder }) {
  const flowId = builder.flow!.id;
  const [runs, setRuns] = useState<FlowRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { run, error: detailError } = useRunPoller(flowId, selected);

  const load = useCallback(async () => {
    try {
      setRuns(await flowsApi.runs(flowId));
      setError(null);
    } catch (err) {
      setError(toFlowError(err).message);
      setRuns((r) => r ?? []);
    }
  }, [flowId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return (
      <div className="space-y-3">
        <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
          ← All runs
        </Button>
        {detailError && <p className="text-xs text-error">{detailError}</p>}
        {run ? <RunDetail run={run} builder={builder} /> : <Spinner />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Latest 50 executions</p>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={13} />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {runs === null ? (
        <Spinner />
      ) : runs.length === 0 ? (
        <EmptyState compact icon={<CircleAlert size={18} />} title="No runs yet" description="Runs appear here after a test or a live event." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {runs.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setSelected(r.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover">
                <RunStatusBadge status={r.status} />
                {r.is_test && <Badge variant="info">Test</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{formatTime(r.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
