/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EventDef, FlowStep, ParamDef, RunStatus } from "./types";

export const MAX_STEPS = 20;
export const SIGNING_SECRET_MIN = 16;
export const MAX_ROWS = 100;
export const MAX_CELLS = 100;

/** What the client may send for a step. Ownership, links and status are server-owned. */
export interface StepPayload {
  _id?: string;
  /** Required by PUT /steps: the first step is the only trigger. */
  type?: "trigger" | "action";
  appKey: string | null;
  key: string | null;
  connectionId: string | null;
  name: string | null;
  parameters: Record<string, unknown>;
}

export interface StepDraft {
  appKey: string | null;
  key: string | null;
  connectionId: string | null;
  name: string | null;
  parameters: Record<string, unknown>;
}

export const draftFromStep = (s: FlowStep): StepDraft => ({
  appKey: s.appKey ?? null,
  key: s.key ?? null,
  connectionId: s.connectionId ?? null,
  name: s.name ?? null,
  parameters: { ...(s.parameters ?? {}) },
});

export function draftDiffers(step: FlowStep, draft: StepDraft): boolean {
  const base = draftFromStep(step);
  return (
    base.appKey !== draft.appKey ||
    base.key !== draft.key ||
    base.connectionId !== draft.connectionId ||
    (base.name ?? "") !== (draft.name ?? "") ||
    JSON.stringify(base.parameters) !== JSON.stringify(draft.parameters)
  );
}

/**
 * Serialises steps for PUT /steps. Existing steps keep their _id, genuinely
 * new ones omit it. `type` follows array order (the API rejects the array
 * without it). user_id / company_id / nextStepId / status / webhookPath are
 * never sent: the backend owns them.
 */
export function toStepsPayload(steps: (FlowStep | (StepDraft & { _id?: string }))[]): StepPayload[] {
  return steps.map((s) => {
    const out: StepPayload = {
      // Existing steps keep their type; steps inserted from the editor are actions
      // (a trigger is only ever added with POST /steps, which the API places first).
      type: (s as FlowStep).type === "trigger" ? "trigger" : "action",
      appKey: s.appKey ?? null,
      key: s.key ?? null,
      connectionId: s.connectionId ?? null,
      name: s.name ?? null,
      parameters: s.parameters ?? {},
    };
    if (s._id) out._id = s._id;
    return out;
  });
}

/** Moves an action within the array. Indexes below `min` (the trigger) never move. */
export function moveAction<T>(steps: T[], from: number, to: number, min = 1): T[] {
  if (from < min || to < min || from >= steps.length || to >= steps.length || from === to) return steps;
  const next = [...steps];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const canAddStep = (count: number) => count < MAX_STEPS;

// ── Parameters ──────────────────────────────────────────────────────────────

const WHOLE_TOKEN = /^\{\{\s*[^{}]+?\s*\}\}$/;
export const isWholeMapping = (v: unknown) => typeof v === "string" && WHOLE_TOKEN.test(v.trim());

/** Converts editor text into the parameter value the API expects. */
export function parseParamInput(def: ParamDef, raw: string): { value: unknown; error?: string } {
  const text = raw;
  if (text.trim() === "") return { value: undefined };
  // A whole-value mapping is sent as-is; the backend preserves its type.
  if (isWholeMapping(text) && def.type !== "string" && def.type !== "text") return { value: text.trim() };

  switch (def.type) {
    case "integer":
    case "number": {
      const n = Number(text.trim());
      if (!Number.isFinite(n)) return { value: text, error: "Enter a number or a {{mapping}}." };
      if (def.type === "integer" && !Number.isInteger(n)) return { value: text, error: "Enter a whole number." };
      return { value: n };
    }
    case "boolean":
      if (text === "true" || text === "false") return { value: text === "true" };
      return { value: text, error: "Choose true or false." };
    case "json":
    case "values":
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { value: text, error: "Enter valid JSON." };
      }
    default:
      return { value: text };
  }
}

export function paramToText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}


/** Inline checks driven only by the parameter schema from GET /apps (required, min, max). */
export function validateParams(event: EventDef | undefined, params: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!event) return errors;

  for (const def of event.parameters) {
    const v = params[def.name];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (empty) {
      if (def.required) errors[def.name] = `${def.label} is required.`;
      continue;
    }
    if ((def.type === "integer" || def.type === "number") && typeof v === "number") {
      if (def.min !== undefined && v < def.min) errors[def.name] = `Must be at least ${def.min.toLocaleString()}.`;
      if (def.max !== undefined && v > def.max) errors[def.name] = `Must be at most ${def.max.toLocaleString()}.`;
    }
    if (def.type === "values" && !isWholeMapping(v)) {
      const err = validateRows(v);
      if (err) errors[def.name] = err;
    }
  }

  return errors;
}

export function validateRows(v: unknown): string | null {
  if (!Array.isArray(v) || !v.every(Array.isArray)) return "Rows must be a list of rows, each a list of cells.";
  if (v.length === 0) return "Add at least one row.";
  if (v.length > MAX_ROWS) return `At most ${MAX_ROWS} rows.`;
  for (const row of v as unknown[][]) {
    if (row.length > MAX_CELLS) return `At most ${MAX_CELLS} cells per row.`;
    if (row.some((c) => c !== null && typeof c === "object")) return "Cells must be text, numbers or true/false.";
  }
  return null;
}

// ── Mapping ─────────────────────────────────────────────────────────────────

export interface MappingOption {
  token: string;
  label: string;
  preview?: string;
  valueType?: "string" | "number" | "boolean" | "null" | "object" | "array";
}

export interface MappingGroup {
  id: string;
  title: string;
  options: MappingOption[];
  /** Shown when the group has no fields yet (e.g. the step hasn't run). */
  emptyHint?: string;
}

const preview = (v: unknown) => {
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  return "{…}";
};

/** Flattens a captured payload into mapping paths (leaf and container values). */
export function flattenPayload(payload: unknown, prefix = "trigger.payload", maxEntries = 400, maxDepth = 8): MappingOption[] {
  const out: MappingOption[] = [];
  const walk = (value: unknown, path: string, depth: number) => {
    if (out.length >= maxEntries) return;
    if (path !== prefix) out.push({ token: `{{${path}}}`, label: path.slice(prefix.length + 1), preview: preview(value), valueType: value === null ? "null" : Array.isArray(value) ? "array" : typeof value as MappingOption["valueType"] });
    if (depth >= maxDepth || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.slice(0, 3).forEach((item, i) => walk(item, `${path}.${i}`, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9_-]+$/.test(k) || ["__proto__", "prototype", "constructor"].includes(k)) continue;
      walk(v, `${path}.${k}`, depth + 1);
    }
  };
  walk(payload, prefix, 0);
  return out;
}

/**
 * Mapping sources for the step at `index`: the trigger plus only the actions
 * that run *before* it (a step can't read the output of a later step).
 */
export function mappingGroups(opts: {
  steps: FlowStep[];
  index: number;
  samplePayload?: unknown;
  sampleContact?: Record<string, unknown>;
  sampleTriggerId?: string | null;
  stepLabel: (step: FlowStep, index: number) => string;
  /** Output field names declared by GET /apps, if any. */
  knownOutputs?: (step: FlowStep) => string[] | undefined;
  runOutputs?: Record<string, unknown>;
}): MappingGroup[] {
  const groups: MappingGroup[] = [];
  // Captured payload fields map as {{trigger.<field>}}.
  const trigger: MappingOption[] =
    opts.samplePayload !== undefined ? flattenPayload(opts.samplePayload, "trigger") : [];
  groups.push({ id: "trigger", title: "Trigger", options: trigger, emptyHint: trigger.length ? undefined : "Capture a trigger event to choose its fields." });
  if (opts.sampleContact) groups.push({ id: "contact", title: "Contact", options: flattenPayload(opts.sampleContact, "contact").filter(option => option.valueType !== "null") });

  for (let i = 0; i < opts.index && i < opts.steps.length; i++) {
    const step = opts.steps[i];
    if (step.type === "trigger") continue;
    const prefix = `steps.${step._id}`;
    const fromRun = opts.runOutputs?.[step._id];
    const options =
      fromRun !== undefined
        ? flattenPayload(fromRun, prefix, 150)
        : (opts.knownOutputs?.(step) ?? []).map((o) => ({ token: `{{${prefix}.${o}}}`, label: o }));
    groups.push({
      id: step._id,
      title: `${i + 1}. ${opts.stepLabel(step, i)}`,
      options,
      emptyHint: options.length ? undefined : "Run a test to see this step's output fields.",
    });
  }
  return groups;
}

/** A Sheet cell or text input cannot accept a mapped array/object. */
export function scalarMappingGroups(groups: MappingGroup[]): MappingGroup[] {
  return groups.map(group => ({ ...group, options: group.options.filter(option => option.valueType !== "array" && option.valueType !== "object") }));
}

const STEP_REF = /\{\{\s*steps\.([^.}\s]+)/g;

/** Mapped step ids that are not earlier steps (later, self, or deleted). */
export function invalidStepReferences(steps: FlowStep[], index: number, params: Record<string, unknown>): string[] {
  const earlier = new Set(steps.slice(0, Math.max(0, index)).filter((s) => s.type !== "trigger").map((s) => s._id));
  const bad = new Set<string>();
  const scan = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(STEP_REF)) if (!earlier.has(m[1])) bad.add(m[1]);
    } else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === "object") Object.values(v).forEach(scan);
  };
  scan(params);
  return [...bad];
}

/** Inserts a token at the caret, replacing any selection. */
export function insertToken(text: string, token: string, start = text.length, end = start) {
  const next = text.slice(0, start) + token + text.slice(end);
  return { text: next, caret: start + token.length };
}

// ── Runs ────────────────────────────────────────────────────────────────────

export const TERMINAL_RUN_STATES: RunStatus[] = ["succeeded", "failed", "requires_review", "cancelled"];
export const isTerminalRun = (status: string | undefined) => TERMINAL_RUN_STATES.includes(status as RunStatus);

/**
 * Keeps one request_id per intentional test. A retry after a network failure
 * (the server may have received it) reuses the id; anything else gets a new one.
 */
export function nextTestRequest(
  previous: { eventId: string; requestId: string; pending: boolean } | null,
  eventId: string,
  newId: () => string,
): { eventId: string; requestId: string; pending: boolean } {
  if (previous && previous.pending && previous.eventId === eventId) return previous;
  return { eventId, requestId: newId(), pending: true };
}

export function runStepResults(run: { steps?: any[]; results?: any[]; actions?: any[] } | null | undefined): any[] {
  if (!run) return [];
  return run.steps ?? run.results ?? run.actions ?? [];
}

/** Map of stepId → output from a run, for the mapping picker. */
export function runOutputsByStep(run: Parameters<typeof runStepResults>[0]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of runStepResults(run)) {
    const id = r?.stepId ?? r?.step_id;
    const value = r?.output ?? r?.result;
    if (id && value !== undefined) out[String(id)] = value;
  }
  return out;
}

export function newUUID(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The flow's trigger step, wherever it is (a flow may have none yet). */
export const triggerOf = (steps: FlowStep[]) => steps.find((s) => s.type === "trigger") ?? null;

/** Body for POST /steps (append). The API needs the step type. */
export const appendStepBody = (type: "trigger" | "action", draft: StepDraft) => ({ type, ...draft });

/** "my-store" or a store URL → "my-store.myshopify.com"; null when invalid. */
export function normalizeShop(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}
