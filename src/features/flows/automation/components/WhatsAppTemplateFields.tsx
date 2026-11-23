"use client";
import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { IconButton, Select } from "@/components/ui";
import { flowsApi, toFlowError } from "../api";
import type { MappingGroup } from "../steps";
import type { FlowConnection, FlowTemplate, ParamDef } from "../types";
import ParamField from "./ParamField";

/** Use the server's field list, including named, media and button parameters. */
export const templateVariables = (template: FlowTemplate | undefined): string[] => template?.required_variables ?? [];

const partText = (t: FlowTemplate, type: string) => t.components?.find((p) => String(p.type).toUpperCase() === type)?.text;

/**
 * Template picker + variable inputs for the WhatsApp "Send template" action.
 * Owns the `template_id` and `variables` parameters.
 */
export default function WhatsAppTemplateFields({
  connection,
  templateId,
  variables,
  onChange,
  groups,
  disabled,
  error,
}: {
  connection: FlowConnection | undefined;
  templateId: string | undefined;
  variables: Record<string, string>;
  onChange: (patch: { template_id?: string; variables?: Record<string, string> }) => void;
  groups: MappingGroup[];
  disabled?: boolean;
  error?: string;
}) {
  const connectionId = connection?.id;
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!connectionId) {
      setTemplates(null);
      return;
    }
    let alive = true;
    setTemplates(null);
    setLoadError(null);
    flowsApi.templates(connectionId)
      .then((list) => {
        if (alive) setTemplates(list);
      })
      .catch((err) => {
        if (alive) {
          setLoadError(toFlowError(err).message);
          setTemplates([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [connectionId, reload]);

  const selected = templates?.find((t) => t.id === templateId);
  const keys = useMemo(() => templateVariables(selected), [selected]);
  const problem = selected?.supported === false ? selected.reason ?? "This template is not supported in automation." : null;
  const missingSaved = !!templateId && templates !== null && !selected;

  const pick = (id: string) => {
    const next = templates?.find((t) => t.id === id);
    // Keep values for variables the new template shares; drop the rest.
    const nextKeys = templateVariables(next);
    const kept = Object.fromEntries(Object.entries(variables).filter(([k]) => nextKeys.includes(k)));
    onChange({ template_id: id || undefined, variables: kept });
  };

  const setVar = (key: string, value: unknown) => {
    const next = { ...variables };
    if (value === undefined || value === "") delete next[key];
    else next[key] = String(value);
    onChange({ variables: next });
  };

  if (!connection) {
    return <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">Choose a WhatsApp number above to pick a template.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="wa-template" className="mb-2 flex items-center gap-1 text-sm font-medium text-foreground">
          Template <span className="text-error">*</span>
        </label>
        <div className="flex items-start gap-2.5">
          <Select
            id="wa-template"
            className="!h-11 !rounded-lg"
            wrapperClassName="min-w-0 flex-1"
            value={selected ? selected.id : ""}
            disabled={disabled || templates === null}
            placeholder={templates === null ? "Loading templates…" : templates.length ? "Select an approved template" : "No approved templates for this number"}
            options={(templates ?? []).map((t) => ({ value: t.id, label: `${t.name} · ${t.language}${t.category ? ` · ${t.category.toLowerCase()}` : ""}${t.supported === false ? ` — ${t.reason ?? "Unsupported"}` : ""}`, disabled: t.supported === false }))}
            onChange={(e) => pick(e.target.value)}
          />
          <IconButton
            variant="outlined"
            className="!h-11 !w-11 shrink-0 !rounded-lg"
            aria-label="Reload templates"
            title="Reload templates"
            icon={<RefreshCw size={17} className={templates === null ? "animate-spin" : undefined} />}
            disabled={disabled || templates === null}
            onClick={() => setReload((n) => n + 1)}
          />
        </div>
        {loadError ? (
          <p className="mt-1.5 text-xs text-error">{loadError}</p>
        ) : missingSaved ? (
          <p className="mt-1.5 text-xs text-error">The saved template is no longer approved for this number. Choose another.</p>
        ) : error && !selected ? (
          <p className="mt-1.5 text-xs text-error">{error}</p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Only approved templates of the selected number are listed.{" "}
            <Link href="/user/manage/templates" target="_blank" className="font-medium text-primary-text hover:underline">
              Manage templates
            </Link>
          </p>
        )}
      </div>

      {selected && (
        <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-foreground">
          <p className="mb-1.5 flex items-center gap-1.5 font-medium text-muted-foreground">
            <FileText size={13} /> Preview
          </p>
          {partText(selected, "HEADER") && <p className="mb-1 font-semibold">{partText(selected, "HEADER")}</p>}
          <p className="whitespace-pre-wrap leading-5">{partText(selected, "BODY") ?? "—"}</p>
          {partText(selected, "FOOTER") && <p className="mt-1 text-muted-foreground">{partText(selected, "FOOTER")}</p>}
        </div>
      )}

      {problem && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning" role="alert">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          {problem} Choose another template.
        </p>
      )}

      {!problem && keys.map((key) => {
        const [part, name, position] = key.split(".");
        const field = selected?.variable_fields?.find((item) => item.key === key);
        const def: ParamDef = {
          name: `wa-var-${key}`,
          label: key === "header.media_url" ? "Header media URL" : part === "button" ? `Button ${Number(name) + 1} {{${position}}}` : `${part === "header" ? "Header" : "Body"} {{${name}}}`,
          type: "string",
          required: true,
          description: field?.description ?? "Type a value or use { } to insert one from the trigger or an earlier step.",
        };
        return (
          <ParamField
            key={`${selected?.id}-${key}`}
            def={def}
            value={variables[key]}
            onChange={(v) => setVar(key, v)}
            error={variables[key] ? undefined : "Required"}
            groups={groups}
            disabled={disabled}
            appKey="whatsapp"
          />
        );
      })}
    </div>
  );
}
