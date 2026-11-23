"use client";

import { useMemo } from "react";
import { Info, TriangleAlert, X } from "lucide-react";
import { Alert, Button, IconButton } from "@/components/ui";
import { appName, findEvent } from "../catalog";
import { draftFromStep, invalidStepReferences, mappingGroups, runOutputsByStep, validateParams } from "../steps";
import type { FlowRun } from "../types";
import type { FlowBuilder } from "../useFlowBuilder";
import AppIcon from "./AppIcon";
import ConnectionField from "./ConnectionField";
import ParamField from "./ParamField";
import TriggerSetup from "./TriggerSetup";
import AutomaticWebhook from "./AutomaticWebhook";
import WhatsAppTemplateFields from "./WhatsAppTemplateFields";

/** Parameters rendered by WhatsAppTemplateFields instead of generic inputs. */
const TEMPLATE_PARAMS = ["template_id", "variables"];

/** Settings for a step whose app + trigger/action were chosen in the picker. */
export default function StepConfigPanel({
  builder,
  lastRun,
  onChangeStep,
  onClose,
}: {
  builder: FlowBuilder;
  lastRun: FlowRun | null;
  onChangeStep: () => void;
  onClose: () => void;
}) {
  const { selectedStep: step, steps, catalog, editable, busy } = builder;
  const index = step ? steps.findIndex((s) => s._id === step._id) : -1;
  const isTrigger = step?.type === "trigger";
  const actionNumber = steps.slice(0, Math.max(0, index) + 1).filter((s) => s.type === "action").length;
  const draft = step ? builder.draftFor(step._id) : null;
  const { app, event } = findEvent(catalog, draft?.appKey ?? null, draft?.key ?? null, isTrigger ? "trigger" : "action");
  const automaticWebhook = !!app?.automaticWebhook;

  const runOutputs = useMemo(() => runOutputsByStep(lastRun), [lastRun]);
  const groups = useMemo(
    () =>
      mappingGroups({
        steps,
        index,
        samplePayload: builder.sample?.payload,
        sampleContact: builder.sample?.contact,
        sampleTriggerId: (builder.sample?.resource_id ?? builder.sample?.external_id ?? null) as string | null,
        stepLabel: (s) => s.name || findEvent(catalog, s.appKey, s.key, "action").event?.name || "Action",
        knownOutputs: (s) => findEvent(catalog, s.appKey, s.key, "action").event?.outputs,
        runOutputs,
      }),
    [builder.sample, catalog, index, runOutputs, steps],
  );
  const errors = useMemo(() => validateParams(event, draft?.parameters ?? {}), [event, draft]);

  if (!step || !draft) return null;

  const badRefs = invalidStepReferences(steps, index, draft.parameters);
  const saved = draftFromStep(step);
  const identityChanged = isTrigger && !!step.appKey && (saved.appKey !== draft.appKey || saved.key !== draft.key || saved.connectionId !== draft.connectionId);
  const set = (patch: Parameters<FlowBuilder["setDraft"]>[1]) => builder.setDraft(step._id, patch);
  const locked = !editable;
  const whatsappTemplate = draft.appKey === "whatsapp" && draft.key === "sendTemplate";
  const fields = (event?.parameters ?? []).filter((def) => !(whatsappTemplate && TEMPLATE_PARAMS.includes(def.name)));
  const setParam = (name: string, v: unknown) => {
    const parameters = { ...draft.parameters };
    if (v === undefined) delete parameters[name];
    else parameters[name] = v;
    set({ parameters });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-14 items-center gap-2 border-b border-border px-5 py-3">
        <AppIcon appKey={draft.appKey} className="!h-7 !w-6" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground">{draft.name || event?.name || "Step"}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {isTrigger ? "Trigger" : `Action ${actionNumber}`} · {appName(catalog, draft.appKey)}
            {event?.topic ? ` · ${event.topic}` : ""}
          </p>
        </div>
        {editable && (
          <Button variant="ghost" size="sm" onClick={onChangeStep}>
            Change
          </Button>
        )}
        <IconButton aria-label="Close panel" size="sm" icon={<X size={16} />} onClick={onClose} />
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        {locked && <Alert variant="info" message="This flow is published. Unpublish it to change steps or webhook settings." />}

        <fieldset disabled={locked} className="space-y-7">
          {draft.appKey && (
            <ConnectionField
              builder={builder}
              appKey={draft.appKey}
              value={draft.connectionId}
              onChange={(connectionId) => {
                if (draft.appKey === "whatsapp" && connectionId !== draft.connectionId) {
                  const parameters = { ...draft.parameters };
                  delete parameters.template_id;
                  delete parameters.variables;
                  set({ connectionId, parameters });
                } else set({ connectionId });
              }}
              disabled={locked}
            />
          )}

          {identityChanged && (
            <p className="flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {automaticWebhook
                ? "The webhook will be re-registered automatically for the new trigger once it saves."
                : "Changing the trigger or its connection clears the webhook signing secret — enter it again below."}
            </p>
          )}

          {isTrigger && (automaticWebhook ? <AutomaticWebhook builder={builder} /> : <TriggerSetup builder={builder} />)}

          {!isTrigger && event && event.parameters.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Configuration</p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{"{ }"}</span> inserts trigger / earlier step values
                </p>
              </div>
              {event.write && (
                <p className="text-xs text-muted-foreground">
                  {draft.appKey === "whatsapp" ? "This action sends a real WhatsApp message, including in test runs." : `This action writes data in ${appName(catalog, draft.appKey)}.`}
                </p>
              )}
              {event.note && (
                <p className="flex items-start gap-1.5 rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs text-info">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  {event.note}
                </p>
              )}
              {fields.map((def) => (
                <ParamField
                  key={`${step._id}-${draft.key}-${def.name}`}
                  def={def}
                  value={draft.parameters[def.name]}
                  onChange={(v) => setParam(def.name, v)}
                  error={errors[def.name]}
                  groups={groups}
                  disabled={locked || busy === "delete"}
                  appKey={draft.appKey}
                />
              ))}
              {whatsappTemplate && (
                <WhatsAppTemplateFields
                  key={`${step._id}-${draft.connectionId ?? "none"}`}
                  connection={(builder.connections ?? []).find((c) => c.id === draft.connectionId)}
                  templateId={typeof draft.parameters.template_id === "string" ? draft.parameters.template_id : undefined}
                  variables={
                    draft.parameters.variables && typeof draft.parameters.variables === "object" && !Array.isArray(draft.parameters.variables)
                      ? (draft.parameters.variables as Record<string, string>)
                      : {}
                  }
                  onChange={(patch) => {
                    const parameters = { ...draft.parameters };
                    if ("template_id" in patch) {
                      if (patch.template_id) parameters.template_id = patch.template_id;
                      else delete parameters.template_id;
                    }
                    if (patch.variables) {
                      if (Object.keys(patch.variables).length) parameters.variables = patch.variables;
                      else delete parameters.variables;
                    }
                    set({ parameters });
                  }}
                  groups={groups}
                  disabled={locked || busy === "delete"}
                  error={errors.template_id}
                />
              )}
            </section>
          )}

          {!isTrigger && event && event.parameters.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No configuration needed for this step.</p>
          )}

          {badRefs.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-md border border-error-border bg-error-bg px-3 py-2 text-xs text-error" role="alert">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              Values can only come from the trigger or earlier actions. Remove references to steps that run later or were deleted.
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}
