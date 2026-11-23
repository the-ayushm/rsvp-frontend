"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Ellipsis,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { flowsApi, toFlowError } from "../../automation/api";
import type { AutomationFlow, FlowListResult, FlowStatus } from "../../automation/types";

type Filter = "all" | FlowStatus;
const PAGE_SIZE = 20;

export function formatFlowDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StatusPill({ status }: { status: FlowStatus }) {
  const styles = {
    active: { cls: "border-primary/30 bg-primary/10 text-primary-text", icon: <CircleCheck size={14} />, label: "Active" },
    inactive: { cls: "border-border bg-surface-muted text-muted-foreground", icon: <CircleX size={14} />, label: "Inactive" },
    draft: { cls: "border-warning-border bg-warning-bg text-warning", icon: <CircleDashed size={14} />, label: "Draft" },
  }[status] ?? { cls: "border-border bg-surface-muted text-muted-foreground", icon: <CircleX size={14} />, label: status };
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-xs", styles.cls)}>
      {styles.icon}
      {styles.label}
    </span>
  );
}

export function CreateFlowModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against double-submit (Enter + click, or a fast double click).
  const inFlight = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
    }
  }, [isOpen]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      // New flows start with no steps; the trigger is chosen in the builder.
      const flow = await flowsApi.create(trimmed);
      router.push(`/user/flows/builder/${encodeURIComponent(flow.id)}`);
    } catch (err) {
      setError(toFlowError(err).message);
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      size="sm"
      title="Create New Flow"
      description="A flow starts with one Shopify or Razorpay trigger, followed by actions."
    >
      <form onSubmit={submit} className="grid gap-4">
        <Input
          label="Flow Name"
          placeholder="Shopify new order to Google Sheets"
          helperText="Give it a name you'll recognise later."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          error={error ?? undefined}
          autoFocus
        />
        <Button type="submit" fullWidth isLoading={saving} disabled={!name.trim() || saving} rightIcon={<ArrowRight size={16} />}>
          Create Flow
        </Button>
      </form>
    </Modal>
  );
}

function RenameFlowModal({
  flow,
  onClose,
  onRenamed,
  onStale,
}: {
  flow: AutomationFlow | null;
  onClose: () => void;
  onRenamed: (flow: AutomationFlow) => void;
  onStale: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (flow) {
      setName(flow.name);
      setError(null);
    }
  }, [flow]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!flow || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await flowsApi.rename(flow.id, name.trim(), flow.revision);
      onRenamed(updated ?? { ...flow, name: name.trim(), revision: flow.revision + 1 });
      onClose();
    } catch (err) {
      const e2 = toFlowError(err);
      setError(e2.message);
      if (e2.status === 409) onStale();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!flow} onClose={onClose} size="sm" title="Rename Flow">
      <form onSubmit={submit} className="grid gap-4">
        <Input label="Flow Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} error={error ?? undefined} autoFocus />
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={!name.trim() || name.trim() === flow?.name}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FlowsScreen() {
  const router = useRouter();
  const [result, setResult] = useState<FlowListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newestFirst, setNewestFirst] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<AutomationFlow | null>(null);
  const [deleting, setDeleting] = useState<AutomationFlow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    // Flows live only on the backend now; drop the old browser-only mock list.
    try {
      localStorage.removeItem("soft7:flows:mock");
    } catch {
      /* storage unavailable */
    }
    // /user/flows/create redirects here with ?new=1.
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") === "1") {
      setCreating(true);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  // Debounce search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await flowsApi.list({ page, limit: PAGE_SIZE, status: filter === "all" ? undefined : filter, search });
      if (seq === requestSeq.current) setResult(res);
    } catch (err) {
      if (seq === requestSeq.current) setLoadError(toFlowError(err).message);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const flows = useMemo(() => {
    const items = [...(result?.items ?? [])];
    items.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return newestFirst ? diff : -diff;
    });
    return items;
  }, [result, newestFirst]);

  const replaceFlow = (next: AutomationFlow) =>
    setResult((r) => (r ? { ...r, items: r.items.map((f) => (f.id === next.id ? { ...f, ...next } : f)) } : r));

  const toggleStatus = async (flow: AutomationFlow) => {
    if (busyId) return;
    const status = flow.status === "active" ? "inactive" : "active";
    setBusyId(flow.id);
    try {
      const updated = await flowsApi.setStatus(flow.id, status, flow.revision);
      if (updated) replaceFlow(updated);
      toast.success(status === "active" ? "Flow activated" : "Flow deactivated");
      void load();
    } catch (err) {
      const e = toFlowError(err);
      toast.error(e.status === 400 ? `${e.message} Open the flow to finish setup.` : e.message);
      if (e.status === 409 || e.status === 404) void load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      // Deactivate first, then remove any automatic webhook subscription
      // (e.g. Shopify) so the store stops sending events, then delete.
      let revision = deleting.revision;
      if (deleting.status === "active") {
        const inactive = await flowsApi.setStatus(deleting.id, "inactive", revision);
        revision = inactive?.revision ?? revision + 1;
      }
      try {
        await flowsApi.unsubscribeWebhook(deleting.id);
      } catch (err) {
        const e = toFlowError(err);
        // No subscription / not an automatic-webhook trigger: nothing to remove.
        if (e.isNetwork || (e.status !== null && e.status >= 500)) throw e;
      }
      await flowsApi.remove(deleting.id);
      toast.success("Flow deleted");
      setDeleting(null);
      void load();
    } catch (err) {
      const e = toFlowError(err);
      toast.error(e.message);
      if (e.status === 404) {
        setDeleting(null);
        void load();
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const counts = result?.counts ?? { all: 0, active: 0, inactive: 0, draft: 0 };
  const total = result?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFlows = counts.all > 0;

  return (
    <div className="space-y-5 py-6">
      <header className="flex flex-col items-start justify-between gap-4 px-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flows</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automate Shopify, Google Sheets, Razorpay and WhatsApp actions when events happen</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New Flow
        </Button>
      </header>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3 px-6 md:flex-row md:items-center md:justify-between">
        <Tabs
          variant="pills"
          className="w-auto"
          activeTab={filter}
          onChange={(id) => {
            setFilter(id as Filter);
            setPage(1);
          }}
          tabs={[
            { id: "all", label: "All Flows", count: counts.all },
            { id: "active", label: "Active", count: counts.active },
            { id: "inactive", label: "Inactive", count: counts.inactive },
            { id: "draft", label: "Draft", count: counts.draft },
          ]}
        />
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            wrapperClassName="w-full md:w-64"
            placeholder="Search flows..."
            leftIcon={<Search size={16} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search flows"
          />
          <Button variant="outline" size="sm" leftIcon={<Clock size={14} />} onClick={() => setNewestFirst((v) => !v)} className="shrink-0">
            {newestFirst ? "Newest" : "Oldest"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-6">
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          {loading && !result ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-3 py-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="ml-auto h-4 w-24" />
                </div>
              ))}
            </div>
          ) : loadError && !result ? (
            <EmptyState
              icon={<CircleX size={22} />}
              title="Couldn't load flows"
              description={loadError}
              action={
                <Button variant="outline" leftIcon={<RefreshCw size={14} />} onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          ) : flows.length === 0 ? (
            <EmptyState
              icon={<Workflow size={22} />}
              title={hasAnyFlows ? "No flows match" : "No flows yet"}
              description={
                hasAnyFlows
                  ? "Try a different search or filter."
                  : "Run actions automatically when a Shopify order arrives or a Razorpay payment is captured."
              }
              action={
                hasAnyFlows ? undefined : (
                  <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                    New Flow
                  </Button>
                )
              }
            />
          ) : (
            <div className={cn("relative w-full overflow-auto transition-opacity", loading && "opacity-60")}>
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-surface-muted">
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="h-10 px-3 font-medium">Name</th>
                    <th className="h-10 px-3 font-medium">Status</th>
                    <th className="h-10 px-3 font-medium">Steps</th>
                    <th className="h-10 px-3 font-medium">Created</th>
                    <th className="h-10 px-3 font-medium">Updated</th>
                    <th className="h-10 px-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((flow) => (
                    <tr
                      key={flow.id}
                      onClick={() => router.push(`/user/flows/builder/${encodeURIComponent(flow.id)}`)}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-3 py-3 font-medium text-foreground">{flow.name}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={flow.status} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{flow.steps?.length || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatFlowDate(flow.createdAt)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatFlowDate(flow.updatedAt)}</td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          portal
                          width="200px"
                          className="inline-block"
                          trigger={<IconButton aria-label="Flow options" size="sm" icon={<Ellipsis size={16} />} />}
                        >
                          <DropdownLabel>Options</DropdownLabel>
                          <DropdownSeparator />
                          <DropdownItem icon={<Pencil size={16} />} onSelect={() => setRenaming(flow)}>
                            Rename
                          </DropdownItem>
                          <DropdownItem icon={<SquarePen size={16} />} href={`/user/flows/builder/${encodeURIComponent(flow.id)}`}>
                            Edit
                          </DropdownItem>
                          <DropdownItem icon={<Power size={16} />} onSelect={() => void toggleStatus(flow)}>
                            {flow.status === "active" ? "Deactivate" : "Activate"}
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem danger icon={<Trash2 size={16} />} onSelect={() => setDeleting(flow)}>
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={PAGE_SIZE} showInfo />
        )}
      </div>

      <CreateFlowModal isOpen={creating} onClose={() => setCreating(false)} />
      <RenameFlowModal flow={renaming} onClose={() => setRenaming(null)} onRenamed={(f) => {
          replaceFlow(f);
          void load();
        }} onStale={() => void load()} />
      <Modal
        isOpen={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        size="sm"
        title="Delete flow?"
        description={`"${deleting?.name ?? ""}" and all of its steps will be permanently removed.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deleteBusy} onClick={() => void confirmDelete()}>
              Delete flow
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Any queued runs will be cancelled. Its webhook URL will stop accepting events. This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}
