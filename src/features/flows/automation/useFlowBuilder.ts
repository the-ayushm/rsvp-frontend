"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findEvent, normalizeCatalog } from "./catalog";
import { flowsApi, toFlowError, type FlowApiError } from "./api";
import { performMutation } from "./mutation";
import {
  draftDiffers,
  draftFromStep,
  invalidStepReferences,
  moveAction,
  toStepsPayload,
  validateParams,
  appendStepBody,
  triggerOf,
  type StepDraft,
} from "./steps";
import type { AppDef, AutomationFlow, FlowConnection, FlowEventDetail, WebhookStatus } from "./types";

export type BusyAction = "save" | "add" | "delete" | "move" | "status" | "rename" | "webhook" | null;
export type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 900;
const EMPTY_STEP: StepDraft = { appKey: null, key: null, connectionId: null, name: null, parameters: {} };

export function useFlowBuilder(flowId: string) {
  const [flow, setFlow] = useState<AutomationFlow | null>(null);
  const [loadError, setLoadError] = useState<FlowApiError | null>(null);
  // Apps, triggers, actions and parameter schemas all come from GET /flows/apps.
  const [catalog, setCatalog] = useState<AppDef[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [connections, setConnections] = useState<FlowConnection[] | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>({});
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [sample, setSample] = useState<FlowEventDetail | null>(null);
  const [webhook, setWebhook] = useState<WebhookStatus | null>(null);
  const [webhookError, setWebhookError] = useState<FlowApiError | null>(null);
  const webhookRef = useRef(webhook);
  webhookRef.current = webhook;

  const flowRef = useRef(flow);
  flowRef.current = flow;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  /** Mutations run one at a time, each against the latest revision. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  /** Drafts that hit an error are not autosaved again until edited. */
  const autosaveBlocked = useRef<Map<string, StepDraft>>(new Map());
  /** Draft objects currently being sent, so autosave doesn't send them twice. */
  const inFlight = useRef<Set<StepDraft>>(new Set());

  const refetch = useCallback(async () => {
    try {
      const next = await flowsApi.get(flowId);
      setFlow(next);
      setLoadError(null);
      return next;
    } catch (err) {
      const e = toFlowError(err);
      if (!flowRef.current || e.status === 404 || e.status === 403) setLoadError(e);
      return null;
    }
  }, [flowId]);

  const loadCatalog = useCallback(async () => {
    setCatalogState("loading");
    try {
      setCatalog(normalizeCatalog(await flowsApi.apps()));
      setCatalogState("ready");
      setCatalogError(null);
    } catch (err) {
      setCatalogState("error");
      setCatalogError(toFlowError(err).message);
    }
  }, []);

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await flowsApi.connections());
      setConnectionsError(null);
    } catch (err) {
      setConnectionsError(toFlowError(err).message);
      setConnections((c) => c ?? []);
    }
  }, []);

  useEffect(() => {
    void refetch();
    void refreshConnections();
    void loadCatalog();
  }, [refetch, refreshConnections, loadCatalog]);

  // Returning from an OAuth redirect/tab: pick up the new connection.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshConnections();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshConnections]);

  const mutate = useCallback(
    (kind: Exclude<BusyAction, null>, fn: (current: AutomationFlow) => Promise<AutomationFlow | null>) => {
      pending.current++;
      setBusy(kind);
      const run = queue.current.then(async (): Promise<FlowApiError | null> => {
        const current = flowRef.current;
        if (!current) return null;
        setBusy(kind);
        const outcome = await performMutation(current, fn, refetch);
        if (outcome.flow) {
          flowRef.current = outcome.flow;
          setFlow(outcome.flow);
        }
        if (outcome.conflict) setConflict(outcome.conflict);
        else if (!outcome.error) setConflict(null);
        return outcome.error;
      });
      queue.current = run.catch(() => undefined).finally(() => {
        pending.current--;
        if (pending.current === 0) setBusy(null);
      });
      return run;
    },
    [refetch],
  );

  const steps = useMemo(() => flow?.steps ?? [], [flow]);
  const selectedStep = steps.find((s) => s._id === selectedStepId) ?? null;
  const editable = flow?.status !== "active";

  const draftFor = useCallback(
    (stepId: string) => {
      const step = flowRef.current?.steps.find((s) => s._id === stepId);
      return drafts[stepId] ?? (step ? draftFromStep(step) : null);
    },
    [drafts],
  );

  const setDraft = useCallback((stepId: string, patch: Partial<StepDraft>) => {
    setDrafts((prev) => {
      const step = flowRef.current?.steps.find((s) => s._id === stepId);
      const base = prev[stepId] ?? (step ? draftFromStep(step) : null);
      if (!base) return prev;
      return { ...prev, [stepId]: { ...base, ...patch } };
    });
  }, []);

  const discardDraft = useCallback((stepId: string) => {
    autosaveBlocked.current.delete(stepId);
    setDrafts((prev) => {
      if (!(stepId in prev)) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }, []);

  const dirtyStepIds = useMemo(
    () =>
      Object.keys(drafts).filter((id) => {
        const step = steps.find((s) => s._id === id);
        return !step || draftDiffers(step, drafts[id]);
      }),
    [drafts, steps],
  );
  const orphanDraftIds = dirtyStepIds.filter((id) => !steps.some((s) => s._id === id));

  /** Saves the current draft of a step. Edits typed during the request are kept. */
  const saveStep = useCallback(
    async (stepId: string) => {
      const snapshot = draftsRef.current[stepId];
      if (!snapshot || inFlight.current.has(snapshot)) return null;
      inFlight.current.add(snapshot);
      setSaveState("saving");
      const err = await mutate("save", (f) => flowsApi.updateStep(f.id, stepId, f.revision, snapshot));
      inFlight.current.delete(snapshot);
      if (err) {
        autosaveBlocked.current.set(stepId, snapshot);
        setSaveState("error");
        setSaveError(err.message);
        return err;
      }
      setDrafts((prev) => {
        if (prev[stepId] !== snapshot) return prev; // edited meanwhile: keep the newer draft
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
      setSaveState("saved");
      setSaveError(null);
      return null;
    },
    [mutate],
  );

  // Autosave valid drafts after a short pause in typing.
  useEffect(() => {
    if (!editable) return;
    const ids = dirtyStepIds.filter((id) => {
      const step = steps.find((s) => s._id === id);
      const draft = drafts[id];
      if (!step || !draft || inFlight.current.has(draft)) return false;
      if (autosaveBlocked.current.get(id) === draft) return false;
      autosaveBlocked.current.delete(id);
      const index = steps.indexOf(step);
      const { event } = findEvent(catalog, draft.appKey, draft.key, step.type === "trigger" ? "trigger" : "action");
      return Object.keys(validateParams(event, draft.parameters)).length === 0 && invalidStepReferences(steps, index, draft.parameters).length === 0;
    });
    if (ids.length === 0) return;
    const t = setTimeout(() => ids.forEach((id) => void saveStep(id)), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [catalog, dirtyStepIds, drafts, editable, saveStep, steps]);

  /** Applies a choice from the app picker and saves it straight away. */
  const pickEvent = useCallback(
    (stepId: string, appKey: string, key: string) => {
      const index = flowRef.current?.steps.findIndex((s) => s._id === stepId) ?? -1;
      const current = draftsRef.current[stepId] ?? (index >= 0 ? draftFromStep(flowRef.current!.steps[index]) : EMPTY_STEP);
      const kind = index >= 0 && flowRef.current!.steps[index].type === "trigger" ? "trigger" : "action";
      const { event } = findEvent(catalogRef.current, appKey, key, kind);
      const sameApp = current.appKey === appKey;
      const appConnections = (connectionsRef.current ?? []).filter((c) => c.appKey === appKey);
      const connectionId = sameApp && current.connectionId ? current.connectionId : appConnections.length === 1 ? appConnections[0].id : null;
      const draft: StepDraft = {
        appKey,
        key,
        name: event?.name ?? current.name,
        connectionId,
        parameters: sameApp && current.key === key ? current.parameters : {},
      };
      setDrafts((prev) => ({ ...prev, [stepId]: draft }));
      draftsRef.current = { ...draftsRef.current, [stepId]: draft };
      setSelectedStepId(stepId);
      return saveStep(stepId);
    },
    [saveStep],
  );

  /**
   * Adds an action that is already chosen in the picker, at `position`
   * (1 … steps.length). No empty placeholder step is ever created: appending
   * uses POST /steps with the configured body, inserting uses PUT /steps.
   */
  const addAction = useCallback(
    async (position: number, appKey: string, key: string): Promise<FlowApiError | null> => {
      const { event } = findEvent(catalogRef.current, appKey, key, "action");
      const appConnections = (connectionsRef.current ?? []).filter((c) => c.appKey === appKey);
      const body: StepDraft = {
        appKey,
        key,
        name: event?.name ?? null,
        connectionId: appConnections.length === 1 ? appConnections[0].id : null,
        parameters: {},
      };
      const before = new Set(flowRef.current?.steps.map((s) => s._id));
      const err = await mutate("add", (f) => {
        if (position >= f.steps.length) return flowsApi.addStep(f.id, f.revision, appendStepBody("action", body));
        const at = Math.max(triggerOf(f.steps) ? 1 : 0, position);
        return flowsApi.saveSteps(f.id, f.revision, toStepsPayload([...f.steps.slice(0, at), body, ...f.steps.slice(at)]));
      });
      if (!err) {
        const added = flowRef.current?.steps.find((s) => !before.has(s._id));
        if (added) setSelectedStepId(added._id);
      }
      return err;
    },
    [mutate],
  );

  /** New flows have no steps: the first pick creates the trigger (POST /steps, type "trigger"). */
  const addTrigger = useCallback(
    async (appKey: string, key: string): Promise<FlowApiError | null> => {
      const { event } = findEvent(catalogRef.current, appKey, key, "trigger");
      const appConnections = (connectionsRef.current ?? []).filter((c) => c.appKey === appKey);
      const body: StepDraft = {
        appKey,
        key,
        name: event?.name ?? null,
        connectionId: appConnections.length === 1 ? appConnections[0].id : null,
        parameters: {},
      };
      const err = await mutate("add", (f) => flowsApi.addStep(f.id, f.revision, appendStepBody("trigger", body)));
      // The API places the trigger first, even when actions already exist.
      if (!err) setSelectedStepId(triggerOf(flowRef.current?.steps ?? [])?._id ?? null);
      return err;
    },
    [mutate],
  );

  // ── Automatic webhook (apps with automatic_webhook_setup, e.g. Shopify) ──
  const refreshWebhookStatus = useCallback(async () => {
    try {
      const status = await flowsApi.webhookStatus(flowId);
      setWebhook(status);
      setWebhookError(null);
      return status;
    } catch (err) {
      setWebhookError(toFlowError(err));
      return null;
    }
  }, [flowId]);

  /** Registers (or re-uses) the trigger's provider webhook. No secrets are sent. */
  const subscribeWebhook = useCallback(async () => {
    setWebhookError(null);
    const box: { result: WebhookStatus | null } = { result: null };
    const err = await mutate("webhook", async (f) => {
      box.result = await flowsApi.subscribeWebhook(f.id);
      return null; // refetch for the new revision / webhookPath
    });
    if (err) setWebhookError(err);
    else if (box.result) setWebhook({ ...box.result, ready: box.result.ready ?? box.result.subscribed });
    if (!err) void refreshWebhookStatus();
    return err;
  }, [mutate, refreshWebhookStatus]);

  const unsubscribeWebhook = useCallback(async () => {
    setWebhookError(null);
    const err = await mutate("webhook", async () => {
      await flowsApi.unsubscribeWebhook(flowId);
      return null;
    });
    if (err) setWebhookError(err);
    await refreshWebhookStatus();
    return err;
  }, [flowId, mutate, refreshWebhookStatus]);

  const deleteStep = useCallback(
    async (stepId: string) => {
      const isTrigger = flowRef.current?.steps.find((s) => s._id === stepId)?.type === "trigger";
      if (isTrigger && webhookRef.current?.subscribed) {
        // One webhook per flow, owned by the trigger: remove it with the trigger.
        try {
          await flowsApi.unsubscribeWebhook(flowId);
        } catch (e) {
          const fe = toFlowError(e);
          if (fe.isNetwork || (fe.status !== null && fe.status >= 500)) return fe;
        }
      }
      const err = await mutate("delete", (f) => flowsApi.deleteStep(f.id, stepId, f.revision));
      if (!err && isTrigger) {
        setWebhook(null);
        setWebhookError(null);
      }
      if (!err) {
        discardDraft(stepId);
        setSelectedStepId((cur) => (cur === stepId ? null : cur));
      }
      return err;
    },
    [discardDraft, flowId, mutate],
  );

  const moveStep = useCallback(
    (stepId: string, dir: -1 | 1) =>
      mutate("move", (f) => {
        const i = f.steps.findIndex((s) => s._id === stepId);
        const reordered = moveAction(f.steps, i, i + dir, triggerOf(f.steps) ? 1 : 0);
        if (reordered === f.steps) return Promise.resolve(f);
        return flowsApi.saveSteps(f.id, f.revision, toStepsPayload(reordered));
      }),
    [mutate],
  );

  const rename = useCallback((name: string) => mutate("rename", (f) => flowsApi.rename(f.id, name, f.revision)), [mutate]);

  const setStatus = useCallback(
    (status: "active" | "inactive") => mutate("status", (f) => flowsApi.setStatus(f.id, status, f.revision)),
    [mutate],
  );

  const configureWebhook = useCallback(
    (signingSecret: string, rotateToken: boolean) =>
      mutate("webhook", async (f) => {
        await flowsApi.configureWebhook(f.id, {
          signing_secret: signingSecret,
          revision: f.revision,
          ...(rotateToken ? { rotate_token: true } : {}),
        });
        return null; // refetch for the new revision / webhookPath
      }),
    [mutate],
  );

  return {
    flow,
    loadError,
    steps,
    triggerStep: triggerOf(steps),
    catalog,
    catalogState,
    catalogError,
    loadCatalog,
    connections,
    connectionsError,
    refreshConnections,
    setConnections,
    selectedStep,
    selectedStepId,
    setSelectedStepId,
    editable,
    busy,
    saveState,
    saveError,
    conflict,
    dismissConflict: () => setConflict(null),
    drafts,
    draftFor,
    setDraft,
    discardDraft,
    dirtyStepIds,
    orphanDraftIds,
    saveStep,
    pickEvent,
    addAction,
    addTrigger,
    webhook,
    webhookError,
    refreshWebhookStatus,
    subscribeWebhook,
    unsubscribeWebhook,
    deleteStep,
    moveStep,
    rename,
    setStatus,
    configureWebhook,
    refetch,
    sample,
    setSample,
  };
}

export type FlowBuilder = ReturnType<typeof useFlowBuilder>;
