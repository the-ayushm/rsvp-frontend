"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ReactFlow, { Background, BackgroundVariant, MiniMap, ReactFlowProvider, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Check, CircleCheckBig, CircleX, Map as MapIcon, Maximize2, Minimize2, Pencil, Scan, X, Zap, ZapOff } from "lucide-react";
import { Alert, Button, EmptyState, IconButton, Modal, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import ResizeHandle from "../../components/builder/ResizeHandle";
import { useSplit } from "../../components/builder/useSplit";
import FlowNodeCard, { CanvasActions, CanvasActionsContext, type FlowNodeData } from "../../automation/components/FlowNodeCard";
import StepConfigPanel from "../../automation/components/StepConfigPanel";
import StepPickerModal from "../../automation/components/StepPickerModal";
import TestResultsPanel from "../../automation/components/TestResultsPanel";
import { appName, findEvent } from "../../automation/catalog";
import { MAX_STEPS } from "../../automation/steps";
import { useFlowBuilder } from "../../automation/useFlowBuilder";
import { useFlowEvents } from "../../automation/useFlowEvents";
import type { FlowRun, FlowStatus } from "../../automation/types";

const nodeTypes = { flowNode: FlowNodeCard };
/** New flows have no steps: this card stands in for the trigger until one is picked. */
const NEW_TRIGGER = "__new_trigger__";
const NODE_GAP = 240;
const FIT = { padding: 0.3, maxZoom: 1, duration: 200 };

function StatusPill({ status }: { status: FlowStatus }) {
  const live = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        live ? "border-primary/30 bg-primary/10 text-primary-text" : "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {live ? <Zap size={12} /> : <ZapOff size={12} />}
      {live ? "Live" : status === "draft" ? "Draft" : "Inactive"}
    </span>
  );
}

export default function FlowBuilderScreen() {
  const params = useParams();
  const flowId = decodeURIComponent(String(params?.id ?? ""));
  return (
    <ReactFlowProvider>
      <Builder key={flowId} flowId={flowId} />
    </ReactFlowProvider>
  );
}

function Builder({ flowId }: { flowId: string }) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const builder = useFlowBuilder(flowId);
  const events = useFlowEvents(flowId, builder.setSample);
  const [pickerId, setPickerId] = useState<string | null>(null);
  /** Position for a new action chosen in the picker (nothing is created until a pick). */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [lastRun, setLastRun] = useState<FlowRun | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const onRun = useCallback((run: FlowRun | null) => {
    if (run) setLastRun(run);
  }, []);

  const bodyRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Canvas keeps ~60% — the side bar stays compact but can be dragged wider.
  const [canvasSize, startCanvasResize] = useSplit(bodyRef, "x", 60, 35, 75);
  const [configSize, startConfigResize] = useSplit(sideRef, "y", 62, 25, 85);

  const { flow, steps, catalog, editable } = builder;
  const selected = builder.selectedStep;
  const selectedDraft = selected ? builder.draftFor(selected._id) : null;
  // The side panel opens once the step has an app + trigger/action chosen.
  const panelOpen = !!(selected && selectedDraft?.appKey && selectedDraft.key);
  const pickerStep = steps.find((s) => s._id === pickerId) ?? null;
  const pickerIsTrigger = pickerId === NEW_TRIGGER || pickerStep?.type === "trigger";

  const hasTrigger = steps[0]?.type === "trigger";
  /** Canvas order: the trigger (or an "Add Trigger" placeholder) first, then actions. */
  const offset = hasTrigger ? 0 : 1;

  const actions = useMemo<CanvasActions>(
    () => ({
      select: (id) => (id === NEW_TRIGGER ? setPickerId(NEW_TRIGGER) : builder.setSelectedStepId(id)),
      pick: (id) => {
        if (id !== NEW_TRIGGER) builder.setSelectedStepId(id);
        setPickerId(id);
      },
      move: (id, dir) => void builder.moveStep(id, dir).then((err) => err && err.status !== 409 && toast.error(err.message)),
      insert: (position) => {
        setPickerId(null);
        setInsertAt(Math.max(0, position - offset));
      },
      remove: (id) => setDeleting(id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builder.setSelectedStepId, builder.moveStep, offset],
  );

  const rfNodes = useMemo(() => {
    const count = steps.length + offset;
    const nodes = steps.map((step, i) => {
      const index = i + offset;
      const isTrigger = step.type === "trigger";
      const draft = builder.drafts[step._id] ?? step;
      const { event } = findEvent(catalog, draft.appKey, draft.key, isTrigger ? "trigger" : "action");
      const missingConnection =
        !!draft.connectionId && builder.connections !== null && !builder.connections.some((c) => c.id === draft.connectionId);
      const data: FlowNodeData = {
        stepId: step._id,
        index,
        isTrigger,
        virtual: false,
        count,
        title: draft.name || event?.name || null,
        appKey: draft.appKey,
        appLabel: draft.appKey ? appName(catalog, draft.appKey) : null,
        chosen: !!(draft.appKey && draft.key),
        complete: step.status === "complete",
        note: missingConnection ? "Connection missing" : builder.dirtyStepIds.includes(step._id) ? "Saving…" : null,
        editable,
        canAdd: steps.length < MAX_STEPS,
      };
      return { id: step._id, type: "flowNode", position: { x: 0, y: index * NODE_GAP }, data, selected: step._id === builder.selectedStepId };
    });
    if (!hasTrigger) {
      const data: FlowNodeData = {
        stepId: NEW_TRIGGER,
        index: 0,
        isTrigger: true,
        virtual: true,
        count,
        title: null,
        appKey: null,
        appLabel: null,
        chosen: false,
        complete: false,
        note: null,
        editable,
        // Actions are added after a trigger exists, unless some remain from before.
        canAdd: steps.length > 0 && steps.length < MAX_STEPS,
      };
      nodes.unshift({ id: NEW_TRIGGER, type: "flowNode", position: { x: 0, y: 0 }, data, selected: false });
    }
    return nodes;
  }, [builder.connections, builder.dirtyStepIds, builder.drafts, builder.selectedStepId, catalog, editable, steps, offset, hasTrigger]);

  const rfEdges = useMemo(
    () =>
      rfNodes.slice(1).map((node, i) => ({
        id: `edge-${rfNodes[i].id}-${node.id}`,
        source: rfNodes[i].id,
        target: node.id,
        type: "straight",
        markerEnd: "flow-arrow",
        style: { stroke: "var(--color-flow-trigger)", strokeWidth: 2 },
      })),
    [rfNodes],
  );

  useEffect(() => {
    if (!flow) return;
    const t = setTimeout(() => fitView(FIT), 50);
    return () => clearTimeout(t);
  }, [steps.length, !!flow, fitView, panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flow || !canvasRef.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => fitView(FIT), 80);
    });
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [!!flow, fitView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === canvasRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (builder.loadError && !flow) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CircleX size={22} />}
          title={builder.loadError.status === 404 ? "Flow not found" : "Couldn't load this flow"}
          description={builder.loadError.message}
          action={
            <Button variant="outline" onClick={() => router.push("/user/flows")}>
              Back to flows
            </Button>
          }
        />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const active = flow.status === "active";

  const togglePublish = async () => {
    if (!active) {
      if (builder.dirtyStepIds.length > 0) return toast.error("Wait for your changes to save, then publish.");
      const incomplete = steps.find((s) => s.status !== "complete");
      const actionCount = steps.filter((s) => s.type === "action").length;
      if (!hasTrigger) {
        toast.error("Add a trigger first");
        setPickerId(NEW_TRIGGER);
        return;
      }
      const triggerApp = findEvent(catalog, steps[0].appKey, steps[0].key, "trigger").app;
      if (triggerApp?.automaticWebhook && !builder.webhook?.ready) {
        toast.error("Connect the trigger's webhook before publishing");
        builder.setSelectedStepId(steps[0]._id);
        return;
      }
      if (incomplete || actionCount < 1) {
        toast.error(actionCount < 1 ? "Add at least one action before publishing" : "Finish configuring every step first");
        if (incomplete) {
          builder.setSelectedStepId(incomplete._id);
          if (!incomplete.appKey || !incomplete.key) setPickerId(incomplete._id);
        }
        return;
      }
    }
    const err = await builder.setStatus(active ? "inactive" : "active");
    if (err) toast.error(err.message);
    else toast.success(active ? "Flow unpublished" : "Flow published — matching events now run the actions");
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || name === flow.name) return setEditingName(false);
    const err = await builder.rename(name);
    if (err) toast.error(err.message);
    else setEditingName(false);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const err = await builder.deleteStep(deleting);
    if (err) toast.error(err.message);
    else toast.success("Step removed");
    setDeleting(null);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void canvasRef.current?.requestFullscreen();
  };

  const saveLabel =
    builder.dirtyStepIds.length > 0 || builder.saveState === "saving"
      ? "Saving…"
      : builder.saveState === "error"
        ? "Not saved"
        : builder.saveState === "saved"
          ? "All changes saved"
          : "";

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="flex flex-col md:h-full md:min-h-[560px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton aria-label="Back to flows" icon={<ArrowLeft size={18} />} onClick={() => router.push("/user/flows")} />
            <div className="min-w-0">
              {editingName ? (
                <form onSubmit={saveName} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameDraft}
                    maxLength={120}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditingName(false)}
                    aria-label="Flow name"
                    className="h-8 w-64 max-w-full rounded-md border border-border bg-surface px-2 text-base font-semibold text-foreground focus:border-primary focus:outline-none"
                  />
                  <IconButton type="submit" size="sm" aria-label="Save name" icon={<Check size={15} />} />
                  <IconButton size="sm" aria-label="Cancel" icon={<X size={15} />} onClick={() => setEditingName(false)} />
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="truncate text-lg font-semibold text-foreground">{flow.name}</h1>
                  <IconButton
                    size="sm"
                    aria-label="Rename flow"
                    icon={<Pencil size={13} />}
                    onClick={() => {
                      setNameDraft(flow.name);
                      setEditingName(true);
                    }}
                  />
                  <StatusPill status={flow.status} />
                </div>
              )}
              <p className="text-sm text-muted-foreground">Edit your automation flow and publish when ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-xs", builder.saveState === "error" ? "text-error" : "text-muted-foreground")} aria-live="polite" title={builder.saveError ?? undefined}>
              {saveLabel}
            </span>
            <Button
              size="sm"
              variant={active ? "outline" : "primary"}
              isLoading={builder.busy === "status"}
              leftIcon={active ? <ZapOff size={14} /> : <CircleCheckBig size={14} />}
              onClick={() => void togglePublish()}
            >
              {active ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </header>

        {(builder.conflict || builder.orphanDraftIds.length > 0 || builder.catalogState === "error" || builder.saveState === "error") && (
          <div className="space-y-2 px-4 pt-3 md:px-6">
            {builder.catalogState === "error" && (
              <Alert
                variant="error"
                title="Couldn't load apps"
                message={
                  <span>
                    {builder.catalogError}{" "}
                    <button type="button" className="font-semibold underline" onClick={() => void builder.loadCatalog()}>
                      Retry
                    </button>
                  </span>
                }
              />
            )}
            {builder.conflict && <Alert variant="warning" title="This flow was changed" message={builder.conflict} onClose={builder.dismissConflict} />}
            {!builder.conflict && builder.saveState === "error" && builder.saveError && (
              <Alert variant="error" title="Couldn't save" message={`${builder.saveError} Your edits are kept — fix the step and it will save again.`} />
            )}
            {builder.orphanDraftIds.length > 0 && (
              <Alert
                variant="warning"
                message="A step you were editing was removed elsewhere, so its unsaved changes can't be applied."
                onClose={() => builder.orphanDraftIds.forEach(builder.discardDraft)}
              />
            )}
          </div>
        )}

        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col md:flex-row" style={{ "--canvas": `${canvasSize}%` } as CSSProperties}>
          <div
            ref={canvasRef}
            className={cn("relative h-[60vh] shrink-0 bg-surface md:h-auto", panelOpen ? "md:basis-[var(--canvas)]" : "md:flex-1")}
          >
            <svg className="absolute h-0 w-0" aria-hidden>
              <defs>
                <marker id="flow-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M2,2 L10,6 L2,10 L4,6 Z" style={{ fill: "var(--color-flow-trigger)", stroke: "var(--color-flow-trigger)", strokeWidth: 0.5 }} />
                </marker>
              </defs>
            </svg>

            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => {
                const data = node.data as FlowNodeData;
                if (node.id === NEW_TRIGGER) return editable ? actions.pick(NEW_TRIGGER) : undefined;
                if (data.chosen || !editable) builder.setSelectedStepId(node.id);
                else actions.pick(node.id);
              }}
              onPaneClick={() => builder.setSelectedStepId(null)}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={FIT}
              minZoom={0.3}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1.6}
                color="color-mix(in oklab, var(--color-primary) 45%, transparent)"
              />
              {showMinimap && (
                <MiniMap
                  pannable
                  zoomable
                  nodeColor="var(--color-flow-trigger)"
                  maskColor="color-mix(in oklab, var(--color-background) 70%, transparent)"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6 }}
                />
              )}
            </ReactFlow>

            {builder.catalogState === "loading" && (
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
                <Spinner size="sm" /> Loading apps…
              </div>
            )}

            <div className="absolute right-4 top-4 z-10 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className={cn("bg-surface", showMinimap && "border-primary text-primary-text")}
                leftIcon={<MapIcon size={14} />}
                onClick={() => setShowMinimap((v) => !v)}
              >
                Minimap
              </Button>
              <Button variant="outline" size="sm" className="bg-surface" leftIcon={<Scan size={14} />} onClick={() => fitView(FIT)}>
                Fit View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden bg-surface sm:inline-flex"
                leftIcon={fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                onClick={toggleFullscreen}
              >
                {fullscreen ? "Exit" : "Fullscreen"}
              </Button>
            </div>
          </div>

          {panelOpen && (
            <>
              <ResizeHandle axis="x" onPointerDown={startCanvasResize} className="hidden md:block" />
              <div
                ref={sideRef}
                className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-surface md:border-t-0"
                style={{ "--config": `${configSize}%` } as CSSProperties}
              >
                <div className="min-h-[320px] overflow-hidden md:min-h-0 md:shrink-0 md:basis-[var(--config)]">
                  <StepConfigPanel
                    key={selected!._id}
                    builder={builder}
                    lastRun={lastRun}
                    onChangeStep={() => setPickerId(selected!._id)}
                    onClose={() => builder.setSelectedStepId(null)}
                  />
                </div>
                <ResizeHandle axis="y" onPointerDown={startConfigResize} className="hidden md:block" />
                <div className="h-[340px] border-t border-border md:h-auto md:min-h-0 md:flex-1 md:border-t-0">
                  <TestResultsPanel builder={builder} events={events} onRun={onRun} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <StepPickerModal
        open={!!pickerStep || pickerId === NEW_TRIGGER || insertAt !== null}
        kind={insertAt === null && pickerIsTrigger ? "trigger" : "action"}
        catalog={catalog}
        initialAppKey={null}
        onRefresh={() => void builder.loadCatalog()}
        loading={builder.catalogState === "loading"}
        onClose={() => {
          setPickerId(null);
          setInsertAt(null);
        }}
        onPick={(app, event) => {
          const position = insertAt;
          const id = pickerId;
          setPickerId(null);
          setInsertAt(null);
          const done =
            position !== null
              ? builder.addAction(position, app.key, event.key)
              : id === NEW_TRIGGER
                ? builder.addTrigger(app.key, event.key)
                : builder.pickEvent(id!, app.key, event.key);
          void done.then((err) => {
            if (err && err.status !== 409) toast.error(err.message);
          });
        }}
      />

      <Modal
        isOpen={!!deleting}
        onClose={() => builder.busy !== "delete" && setDeleting(null)}
        size="sm"
        title={steps.find((s) => s._id === deleting)?.type === "trigger" ? "Delete the trigger?" : "Delete this step?"}
        description={
          steps.find((s) => s._id === deleting)?.type === "trigger"
            ? "Its webhook is removed too, so events stop arriving. Add a new trigger to use this flow again."
            : "The steps before and after it will be linked together. Values mapped from this step's output will stop working."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={builder.busy === "delete"}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={builder.busy === "delete"} onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">This can&apos;t be undone.</p>
      </Modal>
    </CanvasActionsContext.Provider>
  );
}
