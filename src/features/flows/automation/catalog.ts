/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AppDef, EventDef, ParamDef, ParamType } from "./types";

/**
 * The step catalog comes entirely from GET /v1/admin/flows/apps — nothing is
 * hard-coded in the frontend. Real response shape:
 *
 * [{ appKey, connection_api, triggers: [{ key, name, topic }],
 *    actions: [{ key, name, write, parameters: { order_id: { type, required, max } } }] }]
 */

const humanize = (s: string) =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const asList = (v: any): any[] => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.entries(v).map(([key, val]) => (val && typeof val === "object" ? { key, ...(val as object) } : { key }));
  return [];
};

function toParamType(raw: any): ParamType {
  const t = String(Array.isArray(raw?.type) ? raw.type.find((x: string) => x !== "null") : raw?.type ?? "string").toLowerCase();
  if (t === "rows" || (t === "array" && raw?.items?.type === "array")) return "values";
  if (t === "integer" || t === "int") return "integer";
  if (t === "number") return "number";
  if (t === "boolean" || t === "bool") return "boolean";
  if (t === "array" || t === "object" || t === "json") return "json";
  if (t === "text") return "text";
  return "string";
}

/** Parameters arrive as { name: { type, required, min, max, description } }. */
function parseParams(raw: any): ParamDef[] {
  if (!raw) return [];
  // JSON-schema style ({ properties, required }) is accepted too.
  if (raw.properties && typeof raw.properties === "object") {
    const required: string[] = Array.isArray(raw.required) ? raw.required : [];
    return Object.entries(raw.properties as Record<string, any>).map(([name, s]) => ({
      name,
      label: s?.title ?? s?.label ?? humanize(name),
      type: toParamType(s),
      required: required.includes(name) || s?.required === true,
      description: s?.description,
      placeholder: s?.placeholder,
      min: s?.min ?? s?.minimum,
      max: s?.max ?? s?.maximum,
    }));
  }
  return asList(raw)
    .map((f: any) => {
      const name = String(f.name ?? f.key ?? "");
      if (!name) return null;
      return {
        name,
        label: f.label ?? f.title ?? humanize(name),
        type: toParamType(f),
        required: f.required === true,
        description: f.description,
        placeholder: f.placeholder,
        min: f.min ?? f.minimum,
        max: f.max ?? f.maximum,
      } as ParamDef;
    })
    .filter(Boolean) as ParamDef[];
}

function parseEvent(raw: any): EventDef | null {
  const key = String(raw?.key ?? raw?.id ?? "");
  if (!key) return null;
  return {
    key,
    name: String(raw.name ?? raw.label ?? humanize(key)),
    description: raw.description,
    topic: raw.topic,
    write: raw.write === true,
    parameters: parseParams(raw.parameters ?? raw.params ?? raw.schema),
    outputs: Array.isArray(raw.outputs) ? raw.outputs.map(String) : undefined,
    note: raw.note,
  };
}

export function normalizeCatalog(raw: unknown): AppDef[] {
  const source = (raw as any)?.apps ?? (raw as any)?.items ?? raw;
  return asList(source)
    .map((a: any) => {
      const key = String(a.appKey ?? a.key ?? a.id ?? "");
      if (!key) return null;
      return {
        key,
        name: String(a.name ?? a.label ?? humanize(key)),
        connectionApi: a.connection_api,
        templatesApi: a.templates_api,
        automaticWebhook: a.automatic_webhook_setup === true,
        triggers: asList(a.triggers).map(parseEvent).filter(Boolean) as EventDef[],
        actions: asList(a.actions).map(parseEvent).filter(Boolean) as EventDef[],
      } as AppDef;
    })
    .filter(Boolean) as AppDef[];
}

export function findEvent(catalog: AppDef[], appKey: string | null, key: string | null, type: "trigger" | "action") {
  const app = catalog.find((a) => a.key === appKey);
  const event = app ? (type === "trigger" ? app.triggers : app.actions).find((e) => e.key === key) : undefined;
  return { app, event };
}

export const appName = (catalog: AppDef[], appKey: string | null) =>
  catalog.find((a) => a.key === appKey)?.name ?? (appKey ? humanize(appKey) : "");
