"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { Alert, Badge, Button, EmptyState, Spinner, Switch } from "@/components/ui";
import { facebookApi, facebookError, type FacebookLeadForm, type FacebookPageConnection } from "../../facebook/api";

type SyncState = { running: boolean; error: string | null };

export default function LeadFormsPanel({ page, viewingFormId, onViewLeads, onSynced }: {
  page: FacebookPageConnection;
  viewingFormId: string | null;
  onViewLeads: (form: FacebookLeadForm) => void;
  onSynced: (formId: string) => void;
}) {
  const [forms, setForms] = useState<FacebookLeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [sync, setSync] = useState<Record<string, SyncState>>({});
  const loadRun = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  /** Saved forms; with fromFacebook, first pulls the latest Instant Forms. */
  const load = useCallback(async (fromFacebook = false) => {
    const run = ++loadRun.current;
    setError(null);
    if (fromFacebook) setRefreshing(true); else setLoading(true);
    try {
      if (fromFacebook) await facebookApi.refreshForms(page.id);
      let list = await facebookApi.forms(page.id);
      // A freshly connected Page has nothing saved yet: fetch from Facebook once.
      if (!fromFacebook && !list.length) {
        await facebookApi.refreshForms(page.id);
        list = await facebookApi.forms(page.id);
      }
      if (run === loadRun.current) setForms(list);
    } catch (err) {
      if (run === loadRun.current) setError(facebookError(err));
    } finally {
      if (run === loadRun.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page.id]);

  useEffect(() => {
    setForms([]); setSync({});
    void load();
    return () => { loadRun.current++; };
  }, [load]);

  const toggle = async (form: FacebookLeadForm, enabled: boolean) => {
    setToggling(form.id);
    try {
      const updated = await facebookApi.setFormEnabled(form.id, enabled);
      setForms(list => list.map(f => f.id === form.id ? { ...f, ...updated, id: form.id, enabled } : f));
      toast.success(enabled ? `Syncing enabled for ${form.name}` : `Syncing stopped for ${form.name}. Saved leads are kept.`);
    } catch (err) { toast.error(facebookError(err)); }
    finally { setToggling(null); }
  };

  const runSync = async (form: FacebookLeadForm) => {
    const update = (patch: SyncState) => { if (mounted.current) setSync(s => ({ ...s, [form.id]: patch })); };
    update({ running: true, error: null });
    try {
      const { imported } = await facebookApi.sync(form.id);
      update({ running: false, error: null });
      // Duplicates are skipped server-side, so re-syncing is safe.
      toast.success(imported == null ? `Leads synced from ${form.name}`
        : imported ? `${imported} new lead${imported === 1 ? "" : "s"} imported from ${form.name}` : `${form.name} is up to date`);
    } catch (err) {
      update({ running: false, error: facebookError(err) });
    } finally {
      onSynced(form.id);
    }
  };

  if (loading && !forms.length) return <div className="flex justify-center py-8"><Spinner label="Loading lead forms" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Enable the forms to import. New submissions on enabled forms arrive automatically.
        </p>
        <Button size="sm" variant="outline" leftIcon={<RefreshCw size={14} />} isLoading={refreshing} disabled={loading} onClick={() => void load(true)}>
          Refresh forms from Facebook
        </Button>
      </div>
      {error && <Alert variant="error" message={error} />}
      {!error && !forms.length && (
        <EmptyState compact icon={<FileText size={22} />} title="No Instant Forms on this Page"
          description="Create and publish an Instant Form for this Page in Meta Business Suite, then refresh forms." />
      )}
      {forms.length > 0 && <ul className="divide-y divide-border rounded-lg border border-border">
        {forms.map(form => {
          const state = sync[form.id];
          return (
            <li key={form.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{form.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {form.status && <Badge size="sm" variant={form.status === "ACTIVE" ? "success" : "neutral"}>{form.status.toLowerCase()}</Badge>}
                    {form.form_id && <span>Form ID {form.form_id}</span>}
                  </p>
                </div>
                <Switch checked={form.enabled} disabled={toggling === form.id || state?.running}
                  onCheckedChange={enabled => void toggle(form, enabled)} label={form.enabled ? "Syncing" : "Not syncing"} />
              </div>
              {form.questions.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Form questions ({form.questions.length})</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {form.questions.map((q, i) => <li key={`${q.key}-${i}`}>{q.label || q.key}{q.type && <span className="text-xs"> · {q.type.toLowerCase()}</span>}</li>)}
                  </ul>
                </details>
              )}
              {form.error && <Alert variant="warning" message={form.error} />}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" leftIcon={<RefreshCw size={14} />} isLoading={state?.running} disabled={!form.enabled}
                  onClick={() => void runSync(form)}>Sync existing leads</Button>
                <Button size="sm" variant={viewingFormId === form.id ? "secondary" : "outline"} onClick={() => onViewLeads(form)}>
                  View submitted leads
                </Button>
              </div>
              {state?.error && <Alert variant="error" message={state.error} />}
            </li>
          );
        })}
      </ul>}
    </div>
  );
}
