"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { Alert, Button, EmptyState, Spinner } from "@/components/ui";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { facebookApi, facebookError, type FacebookLead, type FacebookLeadForm } from "../../facebook/api";

const label = (name: string) => name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

/** Saved leads for one form, newest first. Answers render as plain text. */
export default function LeadsPanel({ form, reloadKey }: { form: FacebookLeadForm; reloadKey: number }) {
  const [leads, setLeads] = useState<FacebookLead[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const loadFirst = useCallback(async () => {
    const id = ++run.current;
    setLoading(true); setError(null);
    try {
      const result = await facebookApi.leads(form.id);
      if (id !== run.current) return;
      setLeads(result.leads); setPage(1); setHasMore(result.hasMore);
    } catch (err) {
      if (id === run.current) setError(facebookError(err));
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, [form.id]);

  useEffect(() => {
    setLeads([]); setPage(1); setHasMore(false);
    void loadFirst();
    return () => { run.current++; };
  }, [loadFirst, reloadKey]);

  // Webhook leads arrive on their own; merge the newest page in place.
  useVisiblePolling(async () => {
    const id = run.current;
    const result = await facebookApi.leads(form.id);
    if (id !== run.current) return;
    setLeads(current => {
      const known = new Set(current.map(l => l.lead_id));
      const fresh = result.leads.filter(l => !known.has(l.lead_id));
      return fresh.length ? [...fresh, ...current] : current;
    });
  }, { enabled: !loading && !error, scope: form.id, interval: 10_000, immediate: false });

  const loadOlder = async () => {
    if (!hasMore) return;
    const id = run.current;
    setLoadingMore(true);
    try {
      const result = await facebookApi.leads(form.id, page + 1);
      if (id !== run.current) return;
      setLeads(current => {
        const known = new Set(current.map(l => l.lead_id));
        return [...current, ...result.leads.filter(l => !known.has(l.lead_id))];
      });
      setPage(result.page); setHasMore(result.hasMore);
    } catch (err) { setError(facebookError(err)); }
    finally { setLoadingMore(false); }
  };

  // Keep every submitted field, in first-seen order.
  const columns = useMemo(() => {
    const names: string[] = [];
    for (const lead of leads) for (const f of lead.field_data) if (!names.includes(f.name)) names.push(f.name);
    return names;
  }, [leads]);

  if (loading) return <div className="flex justify-center py-8"><Spinner label="Loading leads" /></div>;

  return (
    <div className="space-y-3">
      {error && <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadFirst()}>Retry</Button></div>} />}
      {!error && !leads.length && (
        <EmptyState compact icon={<Inbox size={22} />} title="No leads saved yet"
          description={form.enabled ? "Sync existing leads, or wait for a new submission." : "Enable syncing for this form, then sync existing leads."} />
      )}
      {leads.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="whitespace-nowrap p-3 font-medium">Submitted</th>
                {columns.map(name => <th key={name} className="whitespace-nowrap p-3 font-medium">{label(name)}</th>)}
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.lead_id} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {lead.submitted_at ? new Date(lead.submitted_at).toLocaleString() : "—"}
                  </td>
                  {columns.map(name => (
                    <td key={name} className="p-3">{lead.field_data.find(f => f.name === name)?.values.join(", ") || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <div className="flex justify-center">
          <Button size="sm" variant="outline" isLoading={loadingMore} onClick={() => void loadOlder()}>Load more leads</Button>
        </div>
      )}
    </div>
  );
}
