"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileSpreadsheet, FolderOpen, Link2, RefreshCw, Unplug, Workflow } from "lucide-react";
import toast from "react-hot-toast";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, Select, Spinner } from "@/components/ui";
import IntegrationIcon from "@/features/flows/components/builder/IntegrationIcon";
import {
  googleSheetsApi,
  googleSheetsErrorMessage,
  type GoogleSheetPreview,
  type GoogleSheetTab,
  type GoogleSpreadsheet,
} from "../../google-sheets/api";
import { pickSpreadsheet } from "../../google-sheets/picker";
import { useGoogleSheetsConnection } from "../../google-sheets/useGoogleSheetsConnection";
import ConnectProgress from "../../shared/ConnectProgress";

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export default function GoogleSheetsIntegrationScreen() {
  const gs = useGoogleSheetsConnection({ onConnected: () => toast.success("Google Sheets connected") });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Spreadsheet selection
  const [sheets, setSheets] = useState<GoogleSpreadsheet[] | null>(null);
  const [sheetsNext, setSheetsNext] = useState<string | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState<GoogleSpreadsheet | null>(null);

  // Worksheet + preview
  const [tabs, setTabs] = useState<GoogleSheetTab[] | null>(null);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [preview, setPreview] = useState<GoogleSheetPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const resetSelection = () => {
    setSheets(null);
    setSheetsNext(null);
    setSpreadsheet(null);
    setTabs(null);
    setTabId(null);
    setPreview(null);
  };

  const loadSpreadsheets = useCallback(async (pageToken?: string) => {
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const res = await googleSheetsApi.spreadsheets(pageToken);
      setSheets((prev) => {
        const base = pageToken ? prev ?? [] : [];
        const seen = new Set(base.map((s) => s.id));
        return [...base, ...res.items.filter((s) => !seen.has(s.id))];
      });
      setSheetsNext(res.nextPageToken);
    } catch (err) {
      setSheetsError(googleSheetsErrorMessage(err));
      setSheets((prev) => prev ?? []);
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gs.connected) void loadSpreadsheets();
    else resetSelection();
  }, [gs.connected, gs.status?.connection?.updated_at, loadSpreadsheets]);

  const loadPreview = useCallback(async (spreadsheetId: string, sheetId: number) => {
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      setPreview(await googleSheetsApi.preview(spreadsheetId, sheetId));
    } catch (err) {
      setPreviewError(googleSheetsErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const selectSpreadsheet = useCallback(
    async (s: GoogleSpreadsheet) => {
      setSpreadsheet(s);
      setTabs(null);
      setTabsError(null);
      setTabId(null);
      setPreview(null);
      setPreviewError(null);
      try {
        const res = await googleSheetsApi.tabs(s.id);
        setSpreadsheet((cur) => (cur?.id === s.id ? { ...cur, name: res.title || cur.name } : cur));
        setTabs(res.tabs);
        const first = res.tabs[0];
        if (first) {
          setTabId(first.sheetId);
          void loadPreview(s.id, first.sheetId);
        }
      } catch (err) {
        setTabsError(googleSheetsErrorMessage(err));
        setTabs([]);
      }
    },
    [loadPreview],
  );

  const openPicker = async () => {
    setPicking(true);
    try {
      const picked = await pickSpreadsheet(gs.setup);
      if (!picked) return;
      setSheets((prev) => (prev?.some((s) => s.id === picked.id) ? prev : [picked, ...(prev ?? [])]));
      await selectSpreadsheet(picked);
    } catch (err) {
      toast.error(googleSheetsErrorMessage(err));
    } finally {
      setPicking(false);
    }
  };

  const disconnect = async () => {
    try {
      await gs.disconnect();
      setConfirmDisconnect(false);
      toast.success("Google Sheets disconnected");
    } catch (err) {
      toast.error(googleSheetsErrorMessage(err));
    }
  };

  const notReady = gs.setup !== null && !gs.setup.ready;
  const pickerReady = Boolean(gs.setup?.picker?.ready);
  const waiting = gs.phase === "waiting";
  const since = formatDate(gs.status?.connection?.created_at);
  const refreshed = formatDate(gs.status?.connection?.updated_at);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Link href="/user/integrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Integrations
      </Link>

      <header className="flex items-start gap-4">
        <IntegrationIcon appId="google_sheets" className="!h-12 !w-10" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Google Sheets</h1>
            {!gs.loading && (
              <Badge variant={gs.connected ? "success" : "neutral"} dot>
                {gs.connected ? "Connected" : "Not connected"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect any Google account to read and write spreadsheets from your flow automations.
          </p>
        </div>
      </header>

      {notReady && (
        <Alert
          variant="warning"
          title="Google Sheets isn't configured on the server yet"
          message={gs.setup?.issue ?? "The platform administrator needs to finish the Google OAuth setup."}
        />
      )}
      {gs.setupError && <Alert variant="warning" message={`Couldn't check Google Sheets setup (${gs.setupError}). You can still try to connect.`} />}

      <Card>
        <CardHeader
          icon={Link2}
          title="Google account"
          description={
            gs.connected
              ? [since && `Connected ${since}`, refreshed && refreshed !== since && `last refreshed ${refreshed}`].filter(Boolean).join(" · ") ||
                "Your Google account is connected."
              : "You'll choose a Google account in a popup and approve access. We only get access to spreadsheets you pick."
          }
          action={
            gs.loading ? (
              <Spinner />
            ) : gs.connected ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" leftIcon={<FolderOpen size={14} />} isLoading={picking} disabled={!pickerReady || waiting} onClick={() => void openPicker()}>
                  Choose spreadsheet
                </Button>
                <Button size="sm" variant="outline" leftIcon={<RefreshCw size={14} />} disabled={waiting || notReady} onClick={gs.connect}>
                  Reconnect
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<Unplug size={14} />} disabled={waiting} onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button leftIcon={<FileSpreadsheet size={16} />} isLoading={waiting} disabled={notReady || !!gs.loadError} onClick={gs.connect}>
                Connect Google Sheets
              </Button>
            )
          }
        />
        <ConnectProgress state={gs} className="mt-4" />
        {gs.loadError && (
          <div className="mt-4 flex items-center gap-3">
            <p className="flex-1 text-xs text-error">{gs.loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void gs.refresh()}>
              Retry
            </Button>
          </div>
        )}
        {gs.connected && !pickerReady && gs.setup && (
          <p className="mt-4 text-xs text-warning">
            Google Picker isn&apos;t configured on the server (API key / project number), so new spreadsheets can&apos;t be picked yet.
            Previously authorized spreadsheets still work.
          </p>
        )}
      </Card>

      {gs.connected && (
        <Card>
          <CardHeader icon={FileSpreadsheet} title="Spreadsheet" description="Pick a spreadsheet and worksheet to check what your flows will read." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Select
                label="Spreadsheet"
                value={spreadsheet?.id ?? ""}
                disabled={sheets === null}
                placeholder={sheets === null ? "Loading spreadsheets…" : sheets.length ? "Select a spreadsheet" : "None yet — choose one from Google Drive"}
                options={(sheets ?? []).map((s) => ({ value: s.id, label: s.name }))}
                onChange={(e) => {
                  const s = sheets?.find((x) => x.id === e.target.value);
                  if (s) void selectSpreadsheet(s);
                }}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {sheetsError ? <span className="text-error">{sheetsError}</span> : <span>Only spreadsheets you&apos;ve picked are listed.</span>}
                {sheetsNext && (
                  <Button size="sm" variant="ghost" isLoading={sheetsLoading} onClick={() => void loadSpreadsheets(sheetsNext)}>
                    Load more
                  </Button>
                )}
                {spreadsheet?.webViewLink && (
                  <a href={spreadsheet.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    Open in Google Sheets <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <Select
                label="Worksheet"
                value={tabId === null ? "" : String(tabId)}
                disabled={!spreadsheet || tabs === null || tabs.length === 0}
                placeholder={!spreadsheet ? "Choose a spreadsheet first" : tabs === null ? "Loading worksheets…" : "Select a worksheet"}
                options={(tabs ?? []).map((t) => ({ value: String(t.sheetId), label: t.title }))}
                onChange={(e) => {
                  if (!spreadsheet || e.target.value === "") return;
                  const id = Number(e.target.value);
                  setTabId(id);
                  void loadPreview(spreadsheet.id, id);
                }}
              />
              {tabsError && <p className="mt-1.5 text-xs text-error">{tabsError}</p>}
            </div>
          </div>

          <div className="mt-5">
            {!spreadsheet ? (
              <EmptyState
                compact
                icon={<FileSpreadsheet size={22} />}
                title="No spreadsheet selected"
                description="Google only lets the app use spreadsheets you choose with Google Drive's picker."
                action={
                  <Button size="sm" leftIcon={<FolderOpen size={14} />} isLoading={picking} disabled={!pickerReady} onClick={() => void openPicker()}>
                    Choose spreadsheet
                  </Button>
                }
              />
            ) : previewLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : previewError ? (
              <p className="text-sm text-error">{previewError}</p>
            ) : preview ? (
              <PreviewTable preview={preview} />
            ) : null}
          </div>
        </Card>
      )}

      {gs.connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          <Workflow size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">This connection is now available in Google Sheets steps in your flows.</span>
          <Link href="/user/flows" className="font-medium text-primary-text hover:underline">
            Go to Flows
          </Link>
        </div>
      )}

      <Modal
        isOpen={confirmDisconnect}
        onClose={() => !gs.disconnecting && setConfirmDisconnect(false)}
        size="sm"
        title="Disconnect Google Sheets?"
        description="We'll revoke access and delete the stored Google credentials. Flow steps that use Google Sheets will fail until you reconnect."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)} disabled={gs.disconnecting}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={gs.disconnecting} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Your spreadsheets in Google Drive are not affected.</p>
      </Modal>
    </div>
  );
}

function PreviewTable({ preview }: { preview: GoogleSheetPreview }) {
  const { headers, sample_rows: rows } = preview;
  const width = Math.max(headers.length, ...rows.map((r) => r.length), 0);
  if (width === 0) return <EmptyState compact title="This worksheet is empty" description="Add a header row to use it in your flows." />;
  const cols = Array.from({ length: width }, (_, i) => i);
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {preview.title} · {headers.length} column{headers.length === 1 ? "" : "s"} · showing {rows.length} sample row{rows.length === 1 ? "" : "s"}
      </p>
      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-muted">
            <tr>
              {cols.map((i) => (
                <th key={i} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-foreground">
                  {headers[i] || <span className="text-muted-foreground">Column {i + 1}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={width} className="px-3 py-4 text-center text-muted-foreground">
                  Only a header row — no data yet.
                </td>
              </tr>
            ) : (
              rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {cols.map((i) => (
                    <td key={i} className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5 text-foreground" title={r[i] ?? ""}>
                      {r[i] ?? ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
