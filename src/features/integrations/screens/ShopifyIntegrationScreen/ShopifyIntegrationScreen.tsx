"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, RefreshCw, Store, Unplug, Workflow } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Spinner } from "@/components/ui";
import IntegrationIcon from "@/features/flows/components/builder/IntegrationIcon";
import { shopifyApi, shopifyErrorMessage, type ShopifyStore } from "../../shopify/api";
import ShopifyConnectForm from "../../shopify/ShopifyConnectForm";

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

const isHealthy = (s: ShopifyStore) => ["connected", "active"].includes(s.status.toLowerCase());

export default function ShopifyIntegrationScreen() {
  const [stores, setStores] = useState<ShopifyStore[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ShopifyStore | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const list = await shopifyApi.connections();
      setStores(list);
      return list;
    } catch (err) {
      setLoadError(shopifyErrorMessage(err));
      setStores((prev) => prev ?? []);
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onConnected = async (id: string) => {
    setAdding(false);
    setHighlight(id);
    await load();
  };

  const disconnect = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await shopifyApi.disconnect(removing.id);
      toast.success(`${removing.shop_domain} disconnected`);
      setRemoving(null);
      await load();
    } catch (err) {
      toast.error(shopifyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const connectedCount = stores?.filter(isHealthy).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Link href="/user/integrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Integrations
      </Link>

      <header className="flex items-start gap-4">
        <IntegrationIcon appId="shopify" className="!h-12 !w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Shopify</h1>
            {stores !== null && (
              <Badge variant={loadError ? "warning" : connectedCount ? "success" : "neutral"} dot>
                {loadError ? "Status unavailable" : connectedCount ? `${connectedCount} store${connectedCount === 1 ? "" : "s"} connected` : "Not connected"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Shopify stores to trigger flows on orders, customers and checkouts, and send WhatsApp updates automatically.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader
          icon={Store}
          title="Connected stores"
          description="Every store here can be used as a connection in your flows."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />} onClick={() => void load()} disabled={refreshing}>
                Refresh
              </Button>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>
                Connect a store
              </Button>
            </div>
          }
        />

        <div className="mt-4">
          {stores === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : loadError && stores.length === 0 ? (
            <EmptyState
              compact
              title="Couldn't load Shopify connections"
              description={loadError}
              action={
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          ) : stores.length === 0 ? (
            <EmptyState
              compact
              icon={<Store size={22} />}
              title="No Shopify stores connected"
              description="Connect a store to start automating Shopify events."
              action={
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>
                  Connect a store
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Store</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Webhooks</th>
                    <th className="px-3 py-2 font-medium">Connected</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id} className={`border-t border-border ${s.id === highlight ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2 font-medium text-foreground">{s.name}</td>
                      <td className="px-3 py-2">
                        <a
                          href={`https://${s.shop_domain}/admin`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          {s.shop_domain} <ExternalLink size={11} />
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={isHealthy(s) ? "success" : "warning"} size="sm">
                          {s.status}
                        </Badge>
                        {s.subscription_issue && <p className="mt-1 max-w-[220px] text-[11px] text-warning">{s.subscription_issue}</p>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.subscribed_topics?.length ? `${s.subscribed_topics.length} active` : "Set up from a flow"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(s.created_at) ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" leftIcon={<Unplug size={13} />} onClick={() => setRemoving(s)}>
                          Disconnect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loadError && stores !== null && stores.length > 0 && <p className="mt-2 text-xs text-error">{loadError}</p>}
        </div>
      </Card>

      {connectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          <Workflow size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">Use a connected store as the trigger or an action in Shopify steps of your flows.</span>
          <Link href="/user/flows" className="font-medium text-primary-text hover:underline">
            Go to Flows
          </Link>
        </div>
      )}

      <Modal
        isOpen={adding}
        onClose={() => setAdding(false)}
        size="lg"
        className="!max-w-[680px]"
        title="Connect a Shopify store"
        description="Approve access in Shopify, or use the credentials of an app installed on the store."
      >
        <ShopifyConnectForm onConnected={onConnected} onCancel={() => setAdding(false)} />
      </Modal>

      <Modal
        isOpen={!!removing}
        onClose={() => !busy && setRemoving(null)}
        size="sm"
        title={`Disconnect ${removing?.shop_domain ?? "store"}?`}
        description="We'll remove this store's webhooks and stored credentials. Flows using it will stop running until you connect it again."
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={busy} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Your Shopify store and its data are not affected.</p>
      </Modal>
    </div>
  );
}
