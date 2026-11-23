"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Plus, RefreshCw, Unplug, Workflow } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Spinner } from "@/components/ui";
import { flowsApi, toFlowError } from "@/features/flows/automation/api";
import AppIcon from "@/features/flows/automation/components/AppIcon";
import { RazorpayConnectModal } from "@/features/flows/automation/components/ConnectionField";
import type { FlowConnection } from "@/features/flows/automation/types";

const isHealthy = (c: FlowConnection) => ["connected", "active"].includes(String(c.status).toLowerCase());

/** Razorpay accounts (API keys) used by Razorpay actions in flows. */
export default function RazorpayIntegrationScreen() {
  const [accounts, setAccounts] = useState<FlowConnection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FlowConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      setAccounts((await flowsApi.connections()).filter((c) => c.appKey === "razorpay"));
    } catch (err) {
      setLoadError(toFlowError(err).message);
      setAccounts((prev) => prev ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await flowsApi.deleteConnection(removing.id);
      toast.success(`${removing.name} disconnected`);
      setRemoving(null);
      await load();
    } catch (err) {
      toast.error(toFlowError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const connectedCount = accounts?.filter(isHealthy).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Link href="/user/integrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Integrations
      </Link>

      <header className="flex items-start gap-4">
        <AppIcon appKey="razorpay" className="!h-12 !w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Razorpay</h1>
            {accounts !== null && (
              <Badge variant={connectedCount ? "success" : "neutral"} dot>
                {connectedCount ? `${connectedCount} account${connectedCount === 1 ? "" : "s"} connected` : "Not connected"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Razorpay accounts to create and look up payment links in flows, and send them to customers on WhatsApp.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader
          icon={CreditCard}
          title="Connected accounts"
          description="Every account here can be used as a connection in Razorpay steps of your flows."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />} onClick={() => void load()} disabled={refreshing}>
                Refresh
              </Button>
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>
                Add account
              </Button>
            </div>
          }
        />

        <div className="mt-4">
          {accounts === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : loadError && accounts.length === 0 ? (
            <EmptyState
              compact
              title="Couldn't load Razorpay connections"
              description={loadError}
              action={
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          ) : accounts.length === 0 ? (
            <EmptyState
              compact
              icon={<CreditCard size={22} />}
              title="No Razorpay accounts connected"
              description="Add an account with its API key to use Razorpay actions in flows."
              action={
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>
                  Add account
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className={`border-t border-border ${a.id === highlight ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2 font-medium text-foreground">{a.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={a.mode === "live" ? "success" : "neutral"} size="sm">
                          {a.mode === "live" ? "Live" : "Test"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={isHealthy(a) ? "success" : "warning"} size="sm">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" leftIcon={<Unplug size={13} />} onClick={() => setRemoving(a)}>
                          Disconnect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loadError && accounts !== null && accounts.length > 0 && <p className="mt-2 text-xs text-error">{loadError}</p>}
        </div>
      </Card>

      {connectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          <Workflow size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">Use a connected account in Razorpay steps of your flows.</span>
          <Link href="/user/flows" className="font-medium text-primary-text hover:underline">
            Go to Flows
          </Link>
        </div>
      )}

      <RazorpayConnectModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={async (c) => {
          setHighlight(c.id);
          await load();
        }}
      />

      <Modal
        isOpen={!!removing}
        onClose={() => !busy && setRemoving(null)}
        size="sm"
        title={`Disconnect ${removing?.name ?? "account"}?`}
        description="We'll delete the stored API key. Flows using this account will stop working until you choose another connection."
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
        <p className="text-sm text-muted-foreground">Your Razorpay account itself is not affected.</p>
      </Modal>
    </div>
  );
}
