"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ExternalLink, Info, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Input, Tabs } from "@/components/ui";
import ConnectProgress from "../shared/ConnectProgress";
import { useOAuthPopup } from "../shared/useOAuthPopup";
import { normalizeShopDomain, shopifyApi, shopifyErrorMessage, type ShopifySetupInfo } from "./api";

type Mode = "oauth" | "credentials";

/** id → updated_at for one store, to tell a new/re-authorized connection from an existing one. */
async function snapshot(shop: string) {
  const list = await shopifyApi.connections();
  return new Map(list.filter((c) => c.shop_domain === shop).map((c) => [c.id, c.updated_at ?? c.created_at ?? ""]));
}

/**
 * Connect a Shopify store, either with OAuth (consent in a popup — the page and
 * any unsaved work stay put) or with an installed app's Client ID / secret.
 */
export default function ShopifyConnectForm({
  onConnected,
  onCancel,
  defaultMode = "oauth",
}: {
  onConnected: (connectionId: string) => void | Promise<void>;
  onCancel?: () => void;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [name, setName] = useState("");
  const [shop, setShop] = useState("");
  const [clientId, setClientId] = useState("");
  // The secret only ever lives in this form's state and is cleared after submitting.
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<ShopifySetupInfo | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const connectedIdRef = useRef<string | null>(null);

  const oauth = useOAuthPopup({ name: "soft7-shopify-oauth", provider: "Shopify", errorMessage: shopifyErrorMessage });

  useEffect(() => {
    shopifyApi
      .setup()
      .then(setSetup)
      .catch((err) => setSetupError(shopifyErrorMessage(err)));
  }, []);

  const host = normalizeShopDomain(shop);
  const shopError = shop.trim() && !host ? "Use your store's myshopify.com domain, e.g. my-store.myshopify.com." : undefined;
  const oauthUnavailable = setup !== null && !setup.ready;
  const waiting = oauth.phase === "waiting";

  const reset = () => {
    setName("");
    setShop("");
    setClientId("");
    setClientSecret("");
  };

  const submitOAuth = (e: FormEvent) => {
    e.preventDefault();
    if (!host || oauthUnavailable || waiting) return;
    setError(null);
    const label = name.trim() || host;
    let before = new Map<string, string>();
    // Runs synchronously inside the submit handler so the popup isn't blocked.
    oauth.run({
      start: async () => {
        before = await snapshot(host);
        return (await shopifyApi.startOAuth({ shop: host, name: label }))?.authorization_url;
      },
      isDone: async () => {
        const list = await shopifyApi.connections();
        const hit = list.find(
          (c) =>
            c.shop_domain === host &&
            ["connected", "active"].includes(c.status.toLowerCase()) &&
            (!before.has(c.id) || before.get(c.id) !== (c.updated_at ?? c.created_at ?? "")),
        );
        connectedIdRef.current = hit?.id ?? null;
        return Boolean(hit);
      },
      onDone: () => {
        toast.success(`${host} connected`);
        reset();
        if (connectedIdRef.current) void onConnected(connectedIdRef.current);
      },
    });
  };

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !host || !clientId.trim() || !clientSecret) return;
    setBusy(true);
    setError(null);
    try {
      const created = await shopifyApi.connectWithCredentials({
        name: name.trim() || host,
        shop: host,
        client_id: clientId.trim(),
        client_secret: clientSecret,
      });
      toast.success(`${host} connected`);
      reset();
      await onConnected(created.id);
    } catch (err) {
      setClientSecret("");
      setError(shopifyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const storeFields = (
    <>
      <Input
        label="Store domain"
        placeholder="my-store.myshopify.com"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        error={shopError}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <Input label="Connection name" placeholder="My Shopify store" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
    </>
  );

  return (
    <div className="space-y-4">
      <Tabs
        variant="pills"
        className="w-auto"
        activeTab={mode}
        onChange={(id) => {
          setMode(id as Mode);
          setError(null);
        }}
        tabs={[
          { id: "oauth", label: "Connect with Shopify" },
          { id: "credentials", label: "App credentials" },
        ]}
      />

      {mode === "oauth" ? (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitOAuth}>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Sign in to Shopify in a popup and approve access. This page updates by itself when the store is connected.
          </p>
          {oauthUnavailable && (
            <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning sm:col-span-2" role="alert">
              Shopify OAuth isn&apos;t available yet: {setup?.issue ?? "the platform's Shopify app isn't configured."} You can still connect with
              app credentials.
            </p>
          )}
          {setupError && (
            <p className="text-xs text-muted-foreground sm:col-span-2">Couldn&apos;t check Shopify setup ({setupError}). You can still try to connect.</p>
          )}
          {storeFields}
          {setup?.scopes && setup.scopes.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              You&apos;ll be asked to allow:{" "}
              {setup.scopes.map((sc) => (
                <code key={sc} className="mr-1">
                  {sc}
                </code>
              ))}
            </p>
          )}
          <ConnectProgress state={oauth} provider="Shopify" className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            {onCancel && (
              <Button variant="outline" type="button" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" isLoading={waiting} disabled={!host || oauthUnavailable} rightIcon={<ExternalLink size={14} />}>
              Continue to Shopify
            </Button>
          </div>
        </form>
      ) : (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitCredentials} autoComplete="off">
          <p className="flex items-start gap-1.5 rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs text-info sm:col-span-2">
            <Info size={13} className="mt-0.5 shrink-0" />
            Use the Client ID and secret of a Shopify app installed on this store, in the same Shopify organization. The secret is sent once to the
            server, which manages access tokens — it is never stored in this browser.
          </p>
          {storeFields}
          <Input label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} spellCheck={false} required />
          <Input
            label="Client secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="new-password"
            required
            leftIcon={<KeyRound size={15} />}
          />
          {error && (
            <p className="text-xs font-medium text-error sm:col-span-2" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            {onCancel && (
              <Button variant="outline" type="button" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" isLoading={busy} disabled={!host || !clientId.trim() || !clientSecret}>
              Save and connect
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
