"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Inbox, Link2, Unplug } from "lucide-react";
import toast from "react-hot-toast";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, Select, Spinner } from "@/components/ui";
import { facebookError, type FacebookFeature, type FacebookLeadForm, type FacebookPageConnection } from "../../facebook/api";
import { clearOAuthParams, useFacebookConnection } from "../../facebook/useFacebookConnection";
import ConnectProgress from "../../shared/ConnectProgress";
import LeadFormsPanel from "./LeadFormsPanel";
import LeadsPanel from "./LeadsPanel";

const FacebookMark = ({ size = "h-12 w-12" }: { size?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/facebook-logo.jpg" alt="" aria-hidden="true" className={`${size} shrink-0 rounded-lg border border-border object-contain p-1`} />
);

const COPY: Record<FacebookFeature, {
  title: string; subtitle: string; pagesDescription: string; emptyDescription: string; disconnectDescription: string;
}> = {
  leads: {
    title: "Facebook Lead Ads",
    subtitle: "Connect your Facebook Pages, choose lead forms, and import leads into your dashboard.",
    pagesDescription: "Pages connected to this account. Leads from enabled forms are imported automatically.",
    emptyDescription: "Sign in with Facebook, choose a Page you manage, then pick the lead forms to import.",
    disconnectDescription: "This stops new lead imports from this Page. Leads already saved stay available.",
  },
  messaging: {
    title: "Facebook Messenger",
    subtitle: "Connect a Facebook Page to receive and reply to Messenger chats from your dashboard.",
    pagesDescription: "Pages connected for Messenger. New messages to these Pages arrive in your dashboard.",
    emptyDescription: "Sign in with Facebook and choose the Page whose Messenger chats you want to handle here.",
    disconnectDescription: "This stops new Messenger chats from this Page reaching your dashboard.",
  },
};

function statusBadge(status: string) {
  if (status === "connected" || status === "active") return <Badge size="sm" variant="success">Connected</Badge>;
  if (status === "subscription_failed") return <Badge size="sm" variant="error">Webhook subscription failed</Badge>;
  if (status === "disconnected") return <Badge size="sm" variant="neutral">Disconnected</Badge>;
  return <Badge size="sm" variant="warning">{status.replace(/_/g, " ")}</Badge>;
}

/** Shown inside the login popup after Facebook sends it back; it closes itself. */
function PopupReturn() {
  const failed = new URLSearchParams(window.location.search).get("oauth") === "failed";
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm space-y-3 text-center" role="status">
        <CheckCircle2 size={36} className={`mx-auto ${failed ? "text-muted-foreground" : "text-success"}`} />
        <h1 className="text-lg font-semibold text-foreground">{failed ? "Facebook login didn't finish" : "Facebook login complete"}</h1>
        <p className="text-sm text-muted-foreground">Return to the dashboard window to {failed ? "try again" : "choose your Page"}. This window closes automatically.</p>
        <Button variant="outline" onClick={() => window.close()}>Close window</Button>
      </div>
    </div>
  );
}

/** One screen for both Meta apps; `feature` picks Lead Ads (App 1) or Messenger (App 2). */
export default function FacebookIntegrationScreen({ feature = "leads" }: { feature?: FacebookFeature }) {
  const fb = useFacebookConnection(feature);
  if (fb.popupReturn) return <PopupReturn />;
  return <FacebookIntegration key={feature} fb={fb} />;
}

function FacebookIntegration({ fb }: { fb: ReturnType<typeof useFacebookConnection> }) {
  const copy = COPY[fb.feature];
  const isLeads = fb.feature === "leads";
  const [showConnect, setShowConnect] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePageId, setActivePageId] = useState("");
  const [viewing, setViewing] = useState<FacebookLeadForm | null>(null);
  const [leadsReload, setLeadsReload] = useState(0);
  const [confirmDisconnect, setConfirmDisconnect] = useState<FacebookPageConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const activePage = fb.pages.find(p => p.id === activePageId) ?? null;
  const savedMetaIds = new Set(fb.pages.filter(p => p.status !== "disconnected").map(p => p.page_id));

  // ?connect=1 comes from the Integrations card; ?oauth= is the return from Facebook.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connect") === "1") setShowConnect(true);
  }, []);
  useEffect(() => { if (fb.oauthReturn) setShowConnect(true); }, [fb.oauthReturn]);

  // Preselect when Facebook shared exactly one Page.
  useEffect(() => {
    setSelected(fb.candidates?.length === 1 ? fb.candidates[0].page_id : "");
  }, [fb.candidates]);

  // Keep a valid Page selected for the forms panel.
  useEffect(() => {
    if (!fb.pages.some(p => p.id === activePageId)) {
      setActivePageId((fb.pages.find(p => p.status !== "disconnected") ?? fb.pages[0])?.id ?? "");
      setViewing(null);
    }
  }, [fb.pages, activePageId]);

  const closeConnect = () => {
    if (fb.phase === "waiting") fb.cancel();
    setShowConnect(false); setSelected("");
    fb.dismiss(); clearOAuthParams();
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const page = await fb.connectPage(selected);
      if (page.id) setActivePageId(page.id);
      toast.success(`${page.name || "Facebook Page"} connected`);
      setShowConnect(false); setSelected("");
    } catch (error) {
      toast.error(facebookError(error));
      // The login may have expired; re-read what can still be selected.
      await fb.loadCandidates();
    } finally { setSaving(false); }
  };

  const disconnect = async () => {
    if (!confirmDisconnect) return;
    setDisconnecting(true);
    try {
      await fb.disconnect(confirmDisconnect.id);
      if (viewing && confirmDisconnect.id === activePageId) setViewing(null);
      toast.success(`${confirmDisconnect.name} disconnected`);
      setConfirmDisconnect(null);
    } catch (error) { toast.error(facebookError(error)); }
    finally { setDisconnecting(false); }
  };

  const picking = fb.candidates !== null;
  const candidates = fb.candidates ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <Link href="/user/integrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft size={15} /> Integrations</Link>
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        {!isLeads && fb.pages.some(p => p.status === "connected") && (
          <Link href="/user/inbox/messenger" className="mt-3 inline-block"><Button size="sm">Open Messenger inbox</Button></Link>
        )}
      </header>

      {fb.setup && !fb.setup.ready && (
        <Alert variant="warning" title={`${copy.title} isn't set up yet`} message={fb.setup.issue || "Ask your administrator to finish the Facebook app configuration."} />
      )}

      {fb.loadError && <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{fb.loadError}</span><Button size="sm" variant="outline" onClick={() => void fb.refresh()}>Retry</Button></div>} />}

      <Card>
        <CardHeader icon={Link2} title="Facebook Pages"
          description={copy.pagesDescription}
          action={fb.loading ? <Spinner /> : fb.pages.length > 0 && <Button onClick={() => setShowConnect(true)} disabled={!!fb.loadError}>Connect another Page</Button>} />
        {!fb.loading && !fb.pages.length && !fb.loadError && (
          <EmptyState icon={<FacebookMark />} title="Connect your Facebook Page"
            description={copy.emptyDescription}
            action={<Button onClick={() => setShowConnect(true)}>Connect Facebook</Button>} />
        )}
        {fb.pages.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {fb.pages.map(page => (
              <li key={page.id} className="flex flex-wrap items-center gap-3 p-4">
                <FacebookMark size="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{page.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {statusBadge(page.status)}<span>Page ID {page.page_id}</span>
                  </div>
                  {page.error && <p className="mt-1 text-xs text-error">{page.error}</p>}
                </div>
                {!["connected", "active"].includes(page.status) && (
                  <Button size="sm" variant="outline" onClick={() => { setShowConnect(true); fb.connect(); }}>Reconnect</Button>
                )}
                {page.status !== "disconnected" && (
                  <Button size="sm" variant="ghost" leftIcon={<Unplug size={14} />} onClick={() => setConfirmDisconnect(page)}>Disconnect</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isLeads && fb.pages.length > 0 && (
        <Card>
          <CardHeader icon={FileText} title="Lead forms" description="Refresh forms from Facebook, then enable the ones to import." />
          <div className="mt-4 space-y-4">
            <div className="max-w-md">
              <Select label="Facebook Page" value={activePageId}
                options={fb.pages.map(p => ({ value: p.id, label: ["connected", "active"].includes(p.status) ? p.name : `${p.name} (${p.status.replace(/_/g, " ")})` }))}
                onChange={e => { setActivePageId(e.target.value); setViewing(null); }} />
            </div>
            {activePage && !["connected", "active"].includes(activePage.status) && (
              <Alert variant="warning" message="This Page isn't fully connected. Saved leads stay available; reconnect to import new ones." />
            )}
            {activePage && (
              <LeadFormsPanel key={activePage.id} page={activePage} viewingFormId={viewing?.id ?? null}
                onViewLeads={setViewing} onSynced={formId => { if (viewing?.id === formId) setLeadsReload(n => n + 1); }} />
            )}
          </div>
        </Card>
      )}

      {isLeads && viewing && (
        <Card>
          <CardHeader icon={Inbox} title={`Submitted leads · ${viewing.name}`} description="Newest first. New submissions appear automatically."
            action={<Button size="sm" variant="ghost" onClick={() => setViewing(null)}>Close</Button>} />
          <div className="mt-4"><LeadsPanel key={viewing.id} form={viewing} reloadKey={leadsReload} /></div>
        </Card>
      )}

      <Modal isOpen={showConnect} onClose={() => { if (!saving && !fb.redirecting) closeConnect(); }} closeOnOverlayClick={false} size="lg" title={`Connect ${copy.title}`}
        description={picking ? "Choose the Facebook Page to connect." : "A Facebook window opens to sign in and allow access. When you finish, choose the Page here."}
        footer={<div className="flex w-full gap-3">
          <Button className="flex-1" variant="outline" disabled={saving || fb.redirecting} onClick={closeConnect}>Cancel</Button>
          {picking && candidates.length > 0
            ? <Button className="flex-1" isLoading={saving} disabled={!selected} onClick={() => void save()}>Connect Page</Button>
            : <Button className="flex-1" isLoading={fb.phase === "waiting" || fb.redirecting} disabled={fb.loadingCandidates} onClick={fb.connect}>
                {fb.oauthReturn || fb.connectError || fb.phase !== "idle" ? "Connect Facebook again" : "Continue with Facebook"}
              </Button>}
        </div>}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-5">
            <FacebookMark />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{copy.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {picking ? "Signed in with Facebook." : savedMetaIds.size ? `${savedMetaIds.size} Page${savedMetaIds.size === 1 ? "" : "s"} connected` : "Not connected"}
              </p>
            </div>
          </div>

          {fb.loadingCandidates && <div className="flex justify-center py-6"><Spinner label="Loading your Facebook Pages" /></div>}
          {fb.phase === "idle" && fb.connectError && <Alert variant="error" message={fb.connectError} />}
          <ConnectProgress provider="Facebook" state={{ ...fb, refresh: fb.loadCandidates }} />
          {fb.phase === "blocked" && (
            <p className="text-xs text-muted-foreground">
              Can&apos;t allow popups?{" "}
              <button type="button" className="font-medium text-accent underline" disabled={fb.redirecting} onClick={() => void fb.redirect()}>
                Sign in on this page instead
              </button>
            </p>
          )}

          {picking && (
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="mb-2 text-sm font-medium text-foreground">Pages you authorized</legend>
              {!candidates.length && (
                <p className="text-sm text-muted-foreground">Facebook didn&apos;t share any Pages. Connect Facebook again and select the Page you want to use.</p>
              )}
              {candidates.map(page => (
                <label key={page.page_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected === page.page_id ? "border-accent bg-accent/5" : "border-border hover:border-foreground/30"}`}>
                  <input type="radio" name="facebook-page" className="mt-0.5 h-4 w-4 accent-accent"
                    checked={selected === page.page_id} onChange={() => setSelected(page.page_id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{page.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Page ID {page.page_id}{savedMetaIds.has(page.page_id) ? " · already connected, will refresh the connection" : ""}
                    </span>
                  </span>
                </label>
              ))}
              {candidates.length > 1 && (
                <p className="text-xs text-muted-foreground">One Page per sign-in. To add another, connect Facebook again afterwards.</p>
              )}
            </fieldset>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!confirmDisconnect} onClose={() => { if (!disconnecting) setConfirmDisconnect(null); }} title={`Disconnect ${confirmDisconnect?.name ?? "Page"}?`}
        description={copy.disconnectDescription}
        footer={<div className="flex justify-end gap-2">
          <Button variant="outline" disabled={disconnecting} onClick={() => setConfirmDisconnect(null)}>Cancel</Button>
          <Button variant="danger" isLoading={disconnecting} onClick={() => void disconnect()}>Disconnect</Button>
        </div>}>
        <p className="text-sm text-muted-foreground">To also remove this app&apos;s access in Facebook, open Business Integrations in your Facebook settings.</p>
      </Modal>
    </div>
  );
}
