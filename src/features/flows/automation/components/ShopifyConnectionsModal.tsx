"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Check } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import ShopifyConnectForm from "@/features/integrations/shopify/ShopifyConnectForm";
import type { FlowConnection } from "../types";

const storeOf = (c: FlowConnection) => String((c as any).shop_domain ?? (c as any).shop ?? "—");
const clientIdOf = (c: FlowConnection) => {
  const id = (c as any).client_id ?? (c as any).clientId;
  return id ? String(id) : "—";
};
/** Credential connections keep a server-side secret; OAuth ones don't have one. */
const secretLabel = (c: FlowConnection) => {
  const auth = String((c as any).authentication ?? "");
  if (auth === "oauth") return "OAuth";
  const saved = (c as any).client_secret_configured ?? (c as any).has_client_secret ?? (c as any).secret_saved;
  return saved === false ? "Missing" : "Saved";
};

/**
 * Shopify connections for a step: saved connections table plus the shared
 * connect form (OAuth in a popup, or app credentials). Connecting never leaves
 * the builder, so unsaved step changes are kept.
 */
export default function ShopifyConnectionsModal({
  open,
  onClose,
  connections,
  selectedId,
  onSelect,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  connections: FlowConnection[];
  selectedId: string | null;
  onSelect: (connectionId: string) => void;
  /** Called with the new connection's id once it's saved. */
  onCreated: (connectionId: string) => Promise<void>;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} size="lg" className="!max-w-[760px] !rounded-xl" title="Shopify connections" description="Choose a saved store or connect a new one.">
      <div className="space-y-6">
        <section>
          <p className="mb-2 text-sm font-medium text-foreground">Saved connections</p>
          {connections.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No Shopify connections yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Store</th>
                    <th className="px-3 py-2 font-medium">Client ID</th>
                    <th className="px-3 py-2 font-medium">Secret</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c) => {
                    const selected = c.id === selectedId;
                    const ok = ["connected", "active"].includes(String(c.status).toLowerCase());
                    return (
                      <tr key={c.id} className={cn("border-t border-border", selected && "bg-primary/5")}>
                        <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{storeOf(c)}</td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={clientIdOf(c)}>
                          {clientIdOf(c)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{secretLabel(c)}</td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ok ? "bg-primary/10 text-primary-text" : "bg-warning-bg text-warning")}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant={selected ? "outline" : "primary"}
                            leftIcon={selected ? <Check size={13} /> : undefined}
                            onClick={() => {
                              onSelect(c.id);
                              onClose();
                            }}
                          >
                            {selected ? "Selected" : "Select"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-border pt-5">
          <p className="text-sm font-medium text-foreground">Add a connection</p>
          {open && (
            <ShopifyConnectForm
              onCancel={onClose}
              onConnected={async (id) => {
                await onCreated(id);
                onSelect(id);
                onClose();
              }}
            />
          )}
        </section>
      </div>
    </Modal>
  );
}
