"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Info, Link2, RefreshCw, Unplug } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Modal, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { findEvent } from "../catalog";
import type { FlowBuilder } from "../useFlowBuilder";
import ShopifyConnectionsModal from "./ShopifyConnectionsModal";

/** Errors that mean the store connection must be re-authorised. */
const needsReconnect = (status: number | null, message: string) =>
  status === 401 || status === 403 || /scope|permission|access denied|re-?authori[sz]|reconnect|token/i.test(message);

/**
 * Trigger webhook for apps the backend registers automatically (Shopify).
 * Once the trigger is saved with a connection, the webhook is registered via
 * POST /webhook/subscribe — the customer never pastes a URL or secret.
 */
export default function AutomaticWebhook({ builder }: { builder: FlowBuilder }) {
  const flow = builder.flow!;
  const trigger = builder.triggerStep;
  const { app, event } = findEvent(builder.catalog, trigger?.appKey ?? null, trigger?.key ?? null, "trigger");
  const status = builder.webhook;
  const error = builder.webhookError;
  const [checking, setChecking] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saved = !!(trigger?.appKey && trigger.key && trigger.connectionId);
  const dirty = trigger ? builder.dirtyStepIds.includes(trigger._id) : false;
  const identity = saved && trigger ? `${trigger.appKey}|${trigger.key}|${trigger.connectionId}|${flow.webhookPath ?? ""}` : null;
  const busy = builder.busy === "webhook";
  const ready = !!status?.ready;
  const topicMatches = !status?.topic || !event?.topic || status.topic === event.topic;

  // Load the status whenever the saved trigger (or its public URL) changes.
  useEffect(() => {
    if (!identity) return;
    void builder.refreshWebhookStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  // Registration happens only when the user clicks "Connect webhook" — one
  // webhook per flow (the trigger's); adding or editing actions never subscribes.

  if (!saved) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3.5 text-xs text-muted-foreground">
        Choose a {app?.name ?? "store"} connection above — the webhook is then registered automatically.
      </p>
    );
  }

  const check = async () => {
    setChecking(true);
    await builder.refreshWebhookStatus();
    setChecking(false);
  };

  const register = async () => {
    const err = await builder.subscribeWebhook();
    if (err) toast.error(err.message);
    else toast.success("Webhook connected");
  };

  const remove = async () => {
    setConfirmRemove(false);
    const err = await builder.unsubscribeWebhook();
    if (err) toast.error(err.message);
    else toast.success("Webhook subscription removed");
  };

  const showReconnect = !!error && needsReconnect(error.status, error.message);

  return (
    <section className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Link2 size={16} className="text-muted-foreground" /> Webhook
      </p>

      <div
        className={cn(
          "space-y-2.5 rounded-lg border p-3.5",
          ready && topicMatches ? "border-primary/30 bg-primary/5" : error ? "border-error-border bg-error-bg" : "border-border bg-surface-muted/40",
        )}
      >
        <div className="flex items-center gap-2">
          {busy || (!status && !error) ? (
            <Spinner size="sm" />
          ) : ready && topicMatches ? (
            <CircleCheck size={16} className="text-primary-text" />
          ) : (
            <CircleX size={16} className={error ? "text-error" : "text-muted-foreground"} />
          )}
          <p className="text-sm font-semibold text-foreground">
            {busy ? "Connecting webhook…" : !status && !error ? "Checking webhook…" : ready && topicMatches ? "Webhook connected" : "Webhook not connected"}
          </p>
          {(status?.topic || event?.topic) && (
            <span className="ml-auto rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{event?.topic ?? status?.topic}</span>
          )}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          {ready && topicMatches
            ? `${app?.name ?? "The store"} sends ${event?.name ?? "matching"} events here automatically — nothing to set up in ${app?.name ?? "the store"}.`
            : "Click Connect webhook — we register it in your store using the selected connection and verify deliveries with its app secret. No URL or extra secret needed."}
        </p>

        {error && (
          <p className="text-xs font-medium text-error" role="alert">
            {error.message}
          </p>
        )}
        {!builder.editable && !ready && (
          <p className="text-xs text-muted-foreground">Unpublish the flow to change its webhook.</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {(!ready || !topicMatches) && (
            <Button size="sm" isLoading={busy} disabled={!builder.editable || dirty} onClick={() => void register()}>
              {error ? "Try again" : "Connect webhook"}
            </Button>
          )}
          {showReconnect && (
            <Button size="sm" variant="outline" onClick={() => setReconnectOpen(true)}>
              Reconnect {app?.name ?? "store"}
            </Button>
          )}
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={13} />} isLoading={checking} onClick={() => void check()}>
            Check status
          </Button>
          {ready && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Unplug size={13} />}
              disabled={!builder.editable || busy}
              title={builder.editable ? undefined : "Unpublish first"}
              onClick={() => setConfirmRemove(true)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          To test, trigger a real {event?.name?.toLowerCase() ?? "event"} in your store (e.g.{" "}
          {event?.topic === "carts/update" ? "add a product to the cart in your Online Store" : "place a test order"}), then click Run Test
          below. Shopify&apos;s &ldquo;Send test&rdquo; under Settings → Notifications only tests manually created webhooks.
        </span>
      </p>

      <ShopifyConnectionsModal
        open={reconnectOpen}
        onClose={() => setReconnectOpen(false)}
        connections={(builder.connections ?? []).filter((c) => c.appKey === trigger?.appKey)}
        selectedId={trigger?.connectionId ?? null}
        onSelect={(id) => trigger && builder.setDraft(trigger._id, { connectionId: id })}
        onCreated={async () => {
          await builder.refreshConnections();
        }}
      />

      <Modal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        size="sm"
        title="Remove the webhook?"
        description={`${app?.name ?? "The store"} will stop sending ${event?.name ?? ""} events to this flow until you connect it again.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Captured sample events are kept.</p>
      </Modal>
    </section>
  );
}
