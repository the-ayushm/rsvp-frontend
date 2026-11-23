"use client";

import { FormEvent, useState } from "react";
import { Check, ChevronDown, Copy, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Checkbox, IconButton, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { findEvent } from "../catalog";
import { SIGNING_SECRET_MIN } from "../steps";
import type { FlowBuilder } from "../useFlowBuilder";

const isPublicHttps = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(u.hostname);
  } catch {
    return false;
  }
};

/** Webhook URL + signing secret for the trigger (POST /flows/:id/webhook). */
export default function TriggerSetup({ builder }: { builder: FlowBuilder }) {
  const flow = builder.flow!;
  const trigger = builder.triggerStep;
  const { event } = findEvent(builder.catalog, trigger?.appKey ?? null, trigger?.key ?? null, "trigger");
  const [webhookOpen, setWebhookOpen] = useState(true);
  const [secretOpen, setSecretOpen] = useState(!flow.webhookConfigured);
  const [copied, setCopied] = useState(false);
  const [secret, setSecret] = useState("");
  const [rotate, setRotate] = useState(false);
  const editable = builder.editable;
  const ready = !!(trigger?.appKey && trigger.key && trigger.connectionId);
  const triggerDirty = trigger ? builder.dirtyStepIds.includes(trigger._id) : false;
  const provider = trigger?.appKey === "razorpay" ? "Razorpay" : "Shopify";
  const url = flow.webhookPath ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it manually.");
    }
  };

  const saveSecret = async (e: FormEvent) => {
    e.preventDefault();
    if (secret.length < SIGNING_SECRET_MIN) return;
    if (rotate && !window.confirm(`Rotating creates a new webhook URL. The old URL stops working until you update it in ${provider}. Continue?`)) return;
    const err = await builder.configureWebhook(secret, rotate);
    if (err) {
      toast.error(err.message);
      return;
    }
    setSecret("");
    setRotate(false);
    toast.success(rotate ? "Signing secret saved and webhook URL rotated" : "Signing secret saved");
  };

  return (
    <section className="space-y-6">
      <div>
        <button
          type="button"
          className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"
          aria-expanded={webhookOpen}
          onClick={() => setWebhookOpen((v) => !v)}
        >
          <ChevronDown size={17} className={cn("transition", !webhookOpen && "-rotate-90")} /> Webhook
        </button>
        {webhookOpen && (
          <div className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3.5">
            {!ready ? (
              <p className="text-xs text-muted-foreground">Choose a connection to get this trigger&apos;s webhook URL.</p>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2.5">
                  <input
                    readOnly
                    value={url || "Not available yet"}
                    aria-label="Webhook URL"
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-xs text-foreground"
                  />
                  <IconButton
                    variant="outlined"
                    className="!h-11 !w-11 shrink-0 !rounded-lg"
                    aria-label={copied ? "Webhook URL copied" : "Copy webhook URL"}
                    disabled={!url}
                    icon={copied ? <Check size={18} /> : <Copy size={18} />}
                    onClick={() => void copy()}
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Add this URL in {provider} for the <span className="font-mono">{event?.topic ?? trigger.key}</span> event.
                </p>
                {url && !isPublicHttps(url) && (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                    {provider} can only deliver to a public HTTPS URL. Configure the backend&apos;s public origin/tunnel first.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {ready && (
        <div>
          <button
            type="button"
            className="mb-3 flex w-full items-center gap-2 text-sm font-medium text-foreground"
            aria-expanded={secretOpen}
            onClick={() => setSecretOpen((v) => !v)}
          >
            <ChevronDown size={17} className={cn("transition", !secretOpen && "-rotate-90")} />
            <KeyRound size={15} className="text-muted-foreground" /> Signing secret
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                flow.webhookConfigured ? "bg-primary/10 text-primary-text" : "bg-warning-bg text-warning",
              )}
            >
              {flow.webhookConfigured ? <ShieldCheck size={12} /> : <TriangleAlert size={12} />}
              {flow.webhookConfigured ? "Configured" : "Required"}
            </span>
          </button>
          {secretOpen && (
            <form onSubmit={saveSecret} className="space-y-3 rounded-lg border border-border bg-surface-muted/40 p-3.5">
              {triggerDirty && <p className="text-xs text-warning">Saving your trigger changes… the secret applies to the saved trigger.</p>}
              <Input
                type="password"
                autoComplete="new-password"
                className="!h-11 !rounded-lg"
                placeholder={flow.webhookConfigured ? "Enter a new secret to replace it" : `At least ${SIGNING_SECRET_MIN} characters`}
                value={secret}
                disabled={!editable || triggerDirty}
                onChange={(e) => setSecret(e.target.value)}
                error={secret && secret.length < SIGNING_SECRET_MIN ? `Must be at least ${SIGNING_SECRET_MIN} characters.` : undefined}
                helperText={
                  provider === "Shopify"
                    ? "Shopify admin → Settings → Notifications → Webhooks shows the store's signing secret (it can differ from the app secret)."
                    : "Enter exactly the same secret you set on the Razorpay webhook."
                }
              />
              {flow.webhookConfigured && (
                <Checkbox
                  checked={rotate}
                  disabled={!editable}
                  onChange={(e) => setRotate(e.target.checked)}
                  label="Also rotate the webhook URL (update it in the provider afterwards)"
                />
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={builder.busy === "webhook"}
                  disabled={!editable || triggerDirty || secret.length < SIGNING_SECRET_MIN}
                >
                  Save secret
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
