"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, RefreshCw, Settings, Unplug } from "lucide-react";
import toast from "react-hot-toast";
import { Button, IconButton, Input, Modal, Select } from "@/components/ui";
import { connectionSetupApi, flowsApi, toFlowError } from "../api";
import { normalizeShop } from "../steps";
import ShopifyConnectionsModal from "./ShopifyConnectionsModal";
import type { FlowConnection, ShopifySetup } from "../types";
import type { FlowBuilder } from "../useFlowBuilder";
import { useGoogleSheetsConnection } from "@/features/integrations/google-sheets/useGoogleSheetsConnection";
import ConnectProgress from "@/features/integrations/shared/ConnectProgress";

const APP_LABEL: Record<string, string> = { shopify: "Shopify", "google-sheets": "Google Sheets", razorpay: "Razorpay", whatsapp: "WhatsApp" };

/** Leaves for the provider's consent screen. The connection list refreshes on return. */
function goToAuthorization(url: string | undefined, hasUnsaved: boolean) {
  if (!url || !/^https:\/\//i.test(url)) {
    toast.error("The server didn't return a valid authorization link.");
    return;
  }
  if (hasUnsaved && !window.confirm("You have unsaved step changes. Leave to connect anyway? Unsaved changes will be lost.")) return;
  window.location.assign(url);
}

export default function ConnectionField({
  builder,
  appKey,
  value,
  onChange,
  disabled,
}: {
  builder: FlowBuilder;
  appKey: string;
  value: string | null;
  onChange: (connectionId: string | null) => void;
  disabled?: boolean;
}) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<FlowConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const all = builder.connections;
  const options = (all ?? []).filter((c) => c.appKey === appKey);
  const missing = !!value && all !== null && !options.some((c) => c.id === value);
  const selected = options.find((c) => c.id === value);
  const label = APP_LABEL[appKey] ?? appKey;
  const unhealthy = selected && selected.status && !["active", "connected", "ok"].includes(selected.status.toLowerCase());

  // Google connects in a popup, so unsaved step changes on this page are kept.
  const isGoogle = appKey === "google-sheets";
  const google = useGoogleSheetsConnection({
    enabled: isGoogle,
    onConnected: async (c) => {
      toast.success("Google Sheets connected");
      await builder.refreshConnections();
      if (c.connection?.id) onChange(c.connection.id);
    },
  });

  const disconnect = async () => {
    if (!disconnecting) return;
    setBusy(true);
    try {
      await flowsApi.deleteConnection(disconnecting.id);
      if (value === disconnecting.id) onChange(null);
      toast.success("Disconnected");
      setDisconnecting(null);
      await builder.refreshConnections();
    } catch (err) {
      toast.error(toFlowError(err).message);
    } finally {
      setBusy(false);
    }
  };

  // WhatsApp connections are the account's sender numbers, added on the WhatsApp integration page.
  const isWhatsApp = appKey === "whatsapp";
  const onAdd = () => {
    if (isGoogle) google.connect();
    else if (isWhatsApp) window.open("/user/integrations/whatsapp", "_blank", "noopener");
    else setConnecting(true);
  };

  // Most accounts have one sender number: preselect it.
  const onlyOption = isWhatsApp && !value && options.length === 1 ? options[0].id : null;
  useEffect(() => {
    if (onlyOption && !disabled) onChange(onlyOption);
  }, [onlyOption, disabled, onChange]);
  const googleWaiting = isGoogle && google.phase === "waiting";

  return (
    <div>
      <label htmlFor={`connection-${appKey}`} className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Settings size={17} className="text-muted-foreground" /> Connection
      </label>
      <div className="flex items-start gap-2.5">
        <Select
          id={`connection-${appKey}`}
          className="!h-11 !rounded-lg"
          wrapperClassName="min-w-0 flex-1"
          value={missing ? "" : value ?? ""}
          disabled={disabled || all === null}
          placeholder={
            all === null
              ? "Loading connections…"
              : options.length
                ? isWhatsApp
                  ? "Select a WhatsApp number"
                  : "Select a connection"
                : isWhatsApp
                  ? "No WhatsApp number yet — add one"
                  : `No ${label} connection yet — add one`
          }
          options={options.map((c) => ({
            value: c.id,
            label: `${c.name}${c.mode ? ` (${c.mode})` : ""}${c.status && !["active", "connected"].includes(c.status) ? ` · ${c.status}` : ""}`,
          }))}
          onChange={(e) => onChange(e.target.value || null)}
        />
        <IconButton
          variant="outlined"
          className="!h-11 !w-11 shrink-0 !rounded-lg"
          aria-label={`Add ${label} connection`}
          title={
            isGoogle
              ? options.length
                ? "Reconnect / switch Google account"
                : "Connect a Google account"
              : isWhatsApp
                ? "Add a WhatsApp number (opens in a new tab)"
                : `Add ${label} connection`
          }
          icon={busy || googleWaiting ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={19} />}
          disabled={disabled || busy || googleWaiting || (isGoogle && google.setup !== null && !google.setup.ready)}
          onClick={onAdd}
        />
      </div>
      {missing ? (
        <p className="mt-1.5 text-xs text-error">The saved connection no longer exists. Reconnect or choose another.</p>
      ) : (
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          {isWhatsApp ? "The WhatsApp number this message is sent from." : "Choose the connection to use for this step."}
          {isWhatsApp && (
            <button type="button" className="ml-1 font-medium text-primary-text hover:underline" onClick={() => void builder.refreshConnections()}>
              Refresh
            </button>
          )}
        </p>
      )}
      {unhealthy && <p className="mt-1 text-xs text-warning">This connection is {selected?.status}. Reconnect it if runs fail.</p>}
      {builder.connectionsError && <p className="mt-1 text-xs text-error">{builder.connectionsError}</p>}
      {isGoogle && (
        <>
          {google.setup && !google.setup.ready && (
            <p className="mt-1 text-xs text-warning">Google Sheets isn&apos;t configured on the server yet{google.setup.issue ? `: ${google.setup.issue}` : "."}</p>
          )}
          <ConnectProgress state={google} className="mt-2" />
          <Link
            href="/user/integrations/google-sheets"
            target="_blank"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage Google Sheets connection <ExternalLink size={11} />
          </Link>
        </>
      )}
      {appKey === "razorpay" && selected && !disabled && (
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-error" onClick={() => setDisconnecting(selected)}>
          <Unplug size={12} /> Disconnect this account
        </button>
      )}

      {appKey === "shopify" && (
        <ShopifyConnectionsModal
          open={connecting}
          onClose={() => setConnecting(false)}
          connections={options}
          selectedId={value}
          onSelect={(id) => onChange(id)}
          onCreated={async () => {
            await builder.refreshConnections();
          }}
        />
      )}
      {appKey === "razorpay" && (
        <RazorpayConnectModal
          open={connecting}
          onClose={() => setConnecting(false)}
          onCreated={async (c) => {
            await builder.refreshConnections();
            builder.setConnections((list) => (list && !list.some((x) => x.id === c.id) ? [...list, c] : list));
            onChange(c.id);
          }}
        />
      )}

      <Modal
        isOpen={!!disconnecting}
        onClose={() => !busy && setDisconnecting(null)}
        size="sm"
        title="Disconnect Razorpay?"
        description={`"${disconnecting?.name ?? ""}" will be removed. Steps using it will stop working until you choose another connection.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDisconnecting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={busy} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Your Razorpay account itself is not affected.</p>
      </Modal>
    </div>
  );
}

export function ShopifyConnectModal({ open, onClose, hasUnsaved }: { open: boolean; onClose: () => void; hasUnsaved: boolean }) {
  const [shop, setShop] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // GET /admin/shopify/setup: is the platform's Shopify app configured?
  const [setup, setSetup] = useState<ShopifySetup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setSetupError(null);
    connectionSetupApi
      .shopifySetup()
      .then(setSetup)
      .catch((err) => setSetupError(toFlowError(err).message));
  }, [open]);

  const notReady = setup !== null && !setup.ready;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (notReady) return;
    const host = normalizeShop(shop);
    if (!host) {
      setError("Enter your store as store-name or store-name.myshopify.com.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await connectionSetupApi.startShopifyOAuth({ shop: host, name: name.trim() || host });
      goToAuthorization(res?.authorization_url, hasUnsaved);
    } catch (err) {
      setError(toFlowError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="sm" title="Connect Shopify" description="You'll be sent to Shopify to approve access, then brought back here.">
      <form className="grid gap-4" onSubmit={submit}>
        <Input
          label="Store"
          placeholder="your-store.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
        <Input label="Connection name" placeholder="My store" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        {notReady && (
          <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning" role="alert">
            Shopify isn&apos;t available yet: {setup?.issue ?? "the platform administrator needs to finish the Shopify app setup."}
          </p>
        )}
        {setupError && <p className="text-xs text-muted-foreground">Couldn&apos;t check Shopify setup ({setupError}). You can still try to connect.</p>}
        {error && <p className="text-xs font-medium text-error">{error}</p>}
        {setup?.scopes && setup.scopes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            You&apos;ll be asked to allow: {setup.scopes.map((sc) => <code key={sc} className="mr-1">{sc}</code>)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={!shop.trim() || notReady}>
            Continue to Shopify
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RazorpayConnectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: FlowConnection) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"test" | "live">("test");
  const [keyId, setKeyId] = useState("");
  // The secret only ever lives in this component's state and is cleared on close.
  const [keySecret, setKeySecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setKeySecret("");
    setError(null);
    onClose();
  };

  const keyMismatch = keyId.trim() !== "" && !keyId.trim().startsWith(mode === "live" ? "rzp_live_" : "rzp_test_");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || keyMismatch) return;
    setBusy(true);
    setError(null);
    try {
      const created = await flowsApi.createRazorpayConnection({
        name: name.trim() || `Razorpay ${mode}`,
        mode,
        key_id: keyId.trim(),
        key_secret: keySecret,
      });
      setKeySecret("");
      toast.success("Razorpay connected");
      await onCreated(created);
      close();
    } catch (err) {
      setError(toFlowError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={close} size="sm" title="Add Razorpay account" description="Use your API key from Razorpay Dashboard → Account & Settings → API Keys.">
      <form className="grid gap-4" onSubmit={submit} autoComplete="off">
        <Input label="Connection name" placeholder="My Razorpay test account" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Select
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "test" | "live")}
          options={[
            { value: "test", label: "Test" },
            { value: "live", label: "Live" },
          ]}
        />
        <Input
          label="Key ID"
          placeholder={mode === "live" ? "rzp_live_…" : "rzp_test_…"}
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          error={keyMismatch ? `A ${mode} connection needs a key starting with ${mode === "live" ? "rzp_live_" : "rzp_test_"}.` : undefined}
          required
          spellCheck={false}
        />
        <Input
          label="Key secret"
          type="password"
          value={keySecret}
          onChange={(e) => setKeySecret(e.target.value)}
          required
          autoComplete="new-password"
          helperText="Sent once to the server; never stored in this browser."
        />
        {error && <p className="text-xs font-medium text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={!keyId.trim() || !keySecret || keyMismatch}>
            Connect
          </Button>
        </div>
      </form>
    </Modal>
  );
}
