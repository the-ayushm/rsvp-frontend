"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, CircleCheck, CircleX, Copy, Radio, RefreshCw, Square, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Checkbox, Modal, Spinner, Tabs } from "@/components/ui";
import { cn } from "@/lib/utils";
import { flowsApi, toFlowError } from "../api";
import { findEvent } from "../catalog";
import { isTerminalRun, newUUID, nextTestRequest, runStepResults } from "../steps";
import type { FlowRun } from "../types";
import type { FlowBuilder } from "../useFlowBuilder";
import type { FlowEvents } from "../useFlowEvents";
import { JsonBlock, RunDetail, RunHistory, RunStatusBadge, formatTime, useRunPoller } from "./RunViews";

type TestTab = "input" | "output" | "errors" | "history";

const errText = (e: unknown) => (e == null ? "" : typeof e === "string" ? e : (e as any)?.message ?? JSON.stringify(e, null, 2));

/**
 * Bottom panel of the side bar.
 * - Trigger selected: "Run Test" listens for a real webhook and captures it as the sample.
 * - Action selected: "Run Test" executes the saved flow against the selected sample (real writes).
 */
export default function TestResultsPanel({
  builder,
  events,
  onRun,
}: {
  builder: FlowBuilder;
  events: FlowEvents;
  onRun: (run: FlowRun | null) => void;
}) {
  const flow = builder.flow!;
  const step = builder.selectedStep;
  const isTrigger = step?.type === "trigger";
  const trigger = builder.triggerStep;
  const [tab, setTab] = useState<TestTab>("output");
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ message: string; network: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewAck, setReviewAck] = useState(false);
  const pending = useRef<{ eventId: string; requestId: string; pending: boolean } | null>(null);
  const inFlight = useRef(false);
  const { run, error: pollError } = useRunPoller(flow.id, runId);

  useEffect(() => {
    onRun(run);
  }, [run, onRun]);
  useEffect(() => {
    if (events.listening) setTab("input");
  }, [events.listening]);

  // Poll for events only while this panel is open.
  const stopListening = events.stopListening;
  useEffect(() => () => stopListening(), [stopListening]);

  const writeActions = flow.steps
    .filter((s) => s.type === "action")
    .map((s) => findEvent(builder.catalog, s.appKey, s.key, "action").event)
    .filter((e) => e?.write)
    .map((e) => e!.name);
  const running = !!run && !isTerminalRun(run.status);
  const stepResult = step && !isTrigger ? runStepResults(run).find((r: any) => String(r.stepId ?? r.step_id) === step._id) : null;

  const startRun = useCallback(
    async (retry: boolean) => {
      const eventId = events.selectedId;
      if (!eventId || inFlight.current) return;
      inFlight.current = true;
      // Retrying after a network failure reuses the request_id so the actions can't run twice.
      if (!retry) pending.current = null;
      const req = nextTestRequest(pending.current, eventId, newUUID);
      pending.current = req;
      setStarting(true);
      setStartError(null);
      try {
        const created = await flowsApi.startTestRun(flow.id, { event_id: req.eventId, request_id: req.requestId });
        pending.current = null;
        setReviewAck(false);
        setRunId(created.id);
        setTab("output");
      } catch (err) {
        const e = toFlowError(err);
        if (!e.isNetwork) pending.current = null;
        setStartError({ message: e.message, network: e.isNetwork });
        setTab("errors");
        if (e.status === 409) void builder.refetch();
      } finally {
        inFlight.current = false;
        setStarting(false);
      }
    },
    [builder, events.selectedId, flow.id],
  );

  const onRunTest = () => {
    if (isTrigger) {
      const automatic = !!findEvent(builder.catalog, trigger?.appKey ?? null, trigger?.key ?? null, "trigger").app?.automaticWebhook;
      if (automatic ? !builder.webhook?.ready : !flow.webhookConfigured) {
        return toast.error(automatic ? "Connect the webhook first (see Webhook above)." : "Save the webhook signing secret first.");
      }
      if (events.listening) return events.stopListening();
      return events.startListening();
    }
    if (builder.dirtyStepIds.length > 0) return toast.error("Wait for your changes to save before testing.");
    if (!events.selectedId) {
      setTab("input");
      return toast.error("Capture a test event on the trigger first (select the trigger → Run Test).");
    }
    if (run?.status === "requires_review" && !reviewAck) {
      setTab("output");
      return toast.error("Confirm you've checked the provider before running again.");
    }
    setConfirmOpen(true);
  };

  // Content per tab (also what "Copy" copies).
  let input: unknown = undefined;
  let output: unknown = undefined;
  let errors = "";
  if (isTrigger) {
    output = builder.sample?.payload;
    errors = events.error ?? "";
  } else {
    input = builder.sample?.payload;
    output = stepResult ? stepResult.output ?? stepResult.result : undefined;
    errors = [startError?.message, pollError, errText(stepResult?.error), errText(run?.error)].filter(Boolean).join("\n\n");
  }
  const copyText = tab === "output" ? output : tab === "errors" ? errors : tab === "input" ? input : undefined;

  const status: "idle" | "ok" | "error" | "busy" = starting || running || events.listening
    ? "busy"
    : errors
      ? "error"
      : (isTrigger ? builder.sample : run?.status === "succeeded")
        ? "ok"
        : "idle";
  const StatusIcon = status === "ok" ? CircleCheck : status === "error" ? CircleX : Circle;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {status === "busy" ? (
            <Spinner size="sm" />
          ) : (
            <StatusIcon
              size={16}
              className={cn(status === "ok" && "text-primary-text", status === "error" && "text-error", status === "idle" && "text-muted-foreground")}
            />
          )}
          Test Results
          {run && !isTrigger && <RunStatusBadge status={run.status} />}
        </h3>
        <div className="flex items-center gap-2">
          {startError?.network && pending.current && (
            <Button size="sm" variant="outline" leftIcon={<RefreshCw size={13} />} disabled={starting} onClick={() => void startRun(true)}>
              Retry same request
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            isLoading={starting}
            disabled={running}
            leftIcon={isTrigger ? events.listening ? <Square size={12} /> : <Radio size={14} /> : undefined}
            onClick={onRunTest}
          >
            {isTrigger ? (events.listening ? "Stop listening" : "Run Test") : running ? "Running…" : "Run Test"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4">
        <Tabs
          variant="line"
          className="min-w-0 flex-1"
          activeTab={tab}
          onChange={(id) => setTab(id as TestTab)}
          tabs={[
            { id: "input", label: "Input" },
            { id: "output", label: "Output" },
            { id: "errors", label: "Errors" },
            { id: "history", label: "History" },
          ]}
        />
        {tab !== "history" && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Copy size={14} />}
            disabled={copyText === undefined || copyText === ""}
            onClick={() =>
              navigator.clipboard
                .writeText(typeof copyText === "string" ? copyText : JSON.stringify(copyText, null, 2))
                .then(() => toast.success("Copied"))
            }
          >
            Copy
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border-t border-border bg-background">
        {tab === "input" && (
          <div className="space-y-3 p-3">
            {events.listening && (
              <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary-text" role="status">
                <Spinner size="sm" /> Listening for events… trigger it in{" "}
                {trigger?.appKey === "razorpay" ? "Razorpay" : "your Shopify store"}. Each new event appears below.
              </p>
            )}
            <SampleEvents events={events} />
            {!isTrigger && input !== undefined && <JsonBlock value={input} className="max-h-64 rounded-md border border-border" />}
          </div>
        )}
        {tab === "output" && (
          <div className="p-3">
            {isTrigger ? (
              output !== undefined ? (
                <JsonBlock value={output} className="rounded-md border border-border" />
              ) : (
                <Empty text="Run a test to capture a real event from the trigger" />
              )
            ) : run ? (
              <div className="space-y-3">
                {run.status === "requires_review" && (
                  <Checkbox checked={reviewAck} onChange={(e) => setReviewAck(e.target.checked)} label="I've checked the provider and want to run the test again" />
                )}
                <RunDetail run={run} builder={builder} />
              </div>
            ) : (
              <Empty text="Run a test to see the output data from this step" />
            )}
          </div>
        )}
        {tab === "errors" && (
          <div className="p-3">
            {errors ? (
              <JsonBlock value={errors} className="rounded-md border border-error-border text-error" />
            ) : (
              <Empty text="No errors" />
            )}
            {startError?.network && <p className="mt-2 text-xs text-muted-foreground">&quot;Retry same request&quot; can&apos;t run the actions twice.</p>}
          </div>
        )}
        {tab === "history" && (
          <div className="p-3">
            <RunHistory builder={builder} />
          </div>
        )}
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Run a real test?"
        description="Test runs execute every configured action against the selected event."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void startRun(false);
              }}
            >
              Run test
            </Button>
          </>
        }
      >
        {writeActions.length > 0 ? (
          <p className="flex items-start gap-2 text-sm text-warning">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            This will really write data: {writeActions.join(", ")}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">These actions only read data.</p>
        )}
      </Modal>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="flex h-full min-h-[80px] items-center justify-center p-4 text-center text-sm text-muted-foreground">{text}</p>;
}

function SampleEvents({ events }: { events: FlowEvents }) {
  if (events.events === null) return <p className="text-xs text-muted-foreground">Loading captured events…</p>;
  if (events.events.length === 0) return <p className="text-xs text-muted-foreground">No events captured yet. Select the trigger and click Run Test.</p>;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Captured events — pick the sample</p>
        <button type="button" onClick={() => void events.reload()} className="text-muted-foreground hover:text-foreground" aria-label="Refresh events">
          <RefreshCw size={12} />
        </button>
      </div>
      <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border bg-surface">
        {events.events.map((e) => {
          const selected = e.id === events.selectedId;
          return (
            <li key={e.id}>
              <label className={cn("flex cursor-pointer items-center gap-2 px-3 py-2 text-xs", selected ? "bg-primary/5" : "hover:bg-surface-hover")}>
                <input type="radio" name="sample-event" checked={selected} onChange={() => void events.select(e.id)} />
                <span className="font-mono text-foreground">{String(e.topic ?? "event")}</span>
                {events.newIds.has(e.id) && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary-text">New</span>
                )}
                <span className="ml-auto text-muted-foreground">{formatTime(e.createdAt ?? e.received_at)}</span>
                {selected && events.loadingDetail && <Spinner size="sm" />}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
