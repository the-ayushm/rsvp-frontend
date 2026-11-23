"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, MessageCircle, RefreshCw, Send } from "lucide-react";
import { Alert, Button, EmptyState, Spinner } from "@/components/ui";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { getSocket } from "@/lib/socket-client";
import {
  facebookApi, facebookError, isNotImplemented, messengerApi,
  type FacebookPageConnection, type MessengerConversation, type MessengerMessage,
} from "@/features/integrations/facebook/api";
import { PageSelector } from "../components/PageSelector";

// Messenger's text limit per message.
const MAX_TEXT = 2000;
const NEW_MESSAGE_EVENT = "facebook:message:new";
/** Remembers the last Page viewed, like the WhatsApp inbox remembers its number. */
const PAGE_STORAGE_KEY = "soft7:messenger-page";

const savedPageId = () => { try { return localStorage.getItem(PAGE_STORAGE_KEY) ?? ""; } catch { return ""; } };

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

const timeLabel = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

const MessengerLogo = ({ size = 24 }: { size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/messenger-logo.svg" alt="" aria-hidden="true" width={size} height={size} className="shrink-0" />
);

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";

function StatusIcon({ message }: { message: MessengerMessage }) {
  if (message.status === "sending") return <Clock size={12} aria-label="Sending" />;
  if (message.status === "failed") return <AlertCircle size={12} className="text-error" aria-label="Failed" />;
  if (message.status === "read") return <CheckCheck size={12} className="text-info" aria-label="Read" />;
  if (message.status === "delivered") return <CheckCheck size={12} aria-label="Delivered" />;
  return <Check size={12} aria-label="Sent" />;
}

/** Facebook Messenger inbox: one connected Page's conversations, messages and replies. */
export default function MessengerInboxScreen() {
  const [pages, setPages] = useState<FacebookPageConnection[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageId, setPageId] = useState("");
  const [conversations, setConversations] = useState<MessengerConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  /** The backend hasn't shipped the inbox endpoints yet. */
  const [unavailable, setUnavailable] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  /** Replies not yet confirmed by the server, keyed by client_request_id. */
  const [pending, setPending] = useState<MessengerMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const loadPages = useCallback(async () => {
    try {
      const list = (await facebookApi.pages("messaging")).filter(p => p.status !== "disconnected");
      setPages(list); setPagesError(null);
      setPageId(current => {
        if (list.some(p => p.id === current)) return current;
        const saved = savedPageId();
        return list.some(p => p.id === saved) ? saved : (list.find(p => p.status === "connected") ?? list[0])?.id ?? "";
      });
    } catch (error) { setPages([]); setPagesError(facebookError(error)); }
  }, []);

  useEffect(() => { void loadPages(); }, [loadPages]);
  useEffect(() => {
    if (pageId) try { localStorage.setItem(PAGE_STORAGE_KEY, pageId); } catch { /* Storage blocked. */ }
  }, [pageId]);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!pageId) return;
    if (!quiet) setLoadingConversations(true);
    try {
      const list = await messengerApi.conversations(pageId);
      list.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
      setConversations(list); setListError(null); setUnavailable(false);
    } catch (error) {
      if (isNotImplemented(error)) setUnavailable(true);
      else if (!quiet) setListError(facebookError(error));
    } finally { if (!quiet) setLoadingConversations(false); }
  }, [pageId]);

  const loadMessages = useCallback(async (conversationId: string, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    try {
      const list = await messengerApi.messages(conversationId);
      if (activeRef.current !== conversationId) return;
      list.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      setMessages(list); setThreadError(null);
      // Drop pending replies the server now returns.
      const confirmed = new Set(list.map(m => m.client_request_id).filter(Boolean));
      setPending(p => p.filter(m => !confirmed.has(m.client_request_id)));
    } catch (error) {
      if (activeRef.current === conversationId && !quiet) setThreadError(facebookError(error));
    } finally { if (!quiet && activeRef.current === conversationId) setLoadingMessages(false); }
  }, []);

  useEffect(() => {
    setConversations([]); setActiveId(null); setUnavailable(false); setListError(null);
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    setMessages([]); setPending([]); setThreadError(null); setDraft("");
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Fallback while the socket event isn't available, and after missed events.
  const live = !!pageId && !unavailable;
  useVisiblePolling(async () => { await loadConversations(true); }, { enabled: live, scope: pageId, interval: 15_000, immediate: false });
  useVisiblePolling(async () => { if (activeId) await loadMessages(activeId, true); },
    { enabled: live && !!activeId, scope: activeId ?? "", interval: 8_000, immediate: false });

  // Real-time: refresh on a new message, and after reconnecting to recover missed ones.
  useEffect(() => {
    if (!live) return;
    const socket = getSocket();
    const onNew = (payload: { page_connection_id?: string; conversation_id?: string } | undefined) => {
      if (payload?.page_connection_id && payload.page_connection_id !== pageId) return;
      void loadConversations(true);
      const open = activeRef.current;
      if (open && (!payload?.conversation_id || payload.conversation_id === open)) void loadMessages(open, true);
    };
    const onConnect = () => onNew(undefined);
    socket.on(NEW_MESSAGE_EVENT, onNew);
    socket.on("connect", onConnect);
    return () => { socket.off(NEW_MESSAGE_EVENT, onNew); socket.off("connect", onConnect); };
  }, [live, pageId, loadConversations, loadMessages]);

  const thread = useMemo(() => {
    const ids = new Set(messages.map(m => m.client_request_id).filter(Boolean));
    return [...messages, ...pending.filter(m => !ids.has(m.client_request_id))];
  }, [messages, pending]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, activeId]);

  const deliver = async (conversationId: string, item: MessengerMessage) => {
    const requestId = item.client_request_id as string;
    setPending(p => p.map(m => (m.client_request_id === requestId ? { ...m, status: "sending", error: null } : m)));
    try {
      const saved = await messengerApi.send(conversationId, item.text, requestId);
      if (activeRef.current !== conversationId) return;
      const confirmed: MessengerMessage = { ...saved, outgoing: true, client_request_id: requestId, text: saved.text || item.text,
        created_at: saved.created_at || item.created_at, status: saved.status === "received" ? "sent" : saved.status };
      setPending(p => p.filter(m => m.client_request_id !== requestId));
      setMessages(list => list.some(m => m.id && m.id === confirmed.id) ? list : [...list, confirmed]);
      void loadConversations(true);
    } catch (error) {
      setPending(p => p.map(m => (m.client_request_id === requestId ? { ...m, status: "failed", error: facebookError(error) } : m)));
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    const item: MessengerMessage = {
      id: "", client_request_id: newRequestId(), outgoing: true, text,
      created_at: new Date().toISOString(), status: "sending", error: null,
    };
    setPending(p => [...p, item]);
    setDraft("");
    void deliver(activeId, item);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  const active = conversations.find(c => c.id === activeId) ?? null;
  const connectHref = "/user/integrations/facebook?feature=messaging&connect=1";

  if (pages === null) {
    return <div className="flex h-full min-h-[60vh] items-center justify-center"><Spinner size="lg" label="Loading Messenger" /></div>;
  }

  if (!pages.length) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        {pagesError
          ? <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{pagesError}</span><Button size="sm" variant="outline" onClick={() => void loadPages()}>Retry</Button></div>} />
          : <EmptyState icon={<MessengerLogo size={40} />} title="Connect a Facebook Page"
              description="Connect the Facebook Page whose Messenger chats you want to receive and answer here."
              action={<Link href={connectHref}><Button>Connect Facebook Messenger</Button></Link>} />}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--layout-topbar-height))] min-h-[480px] overflow-hidden border-t border-border bg-background">
      {/* Conversations */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border bg-surface md:w-80`}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><MessengerLogo /> Messenger</h1>
            <Button size="sm" variant="ghost" aria-label="Refresh conversations" leftIcon={<RefreshCw size={14} />}
              isLoading={loadingConversations} onClick={() => void loadConversations()}>Refresh</Button>
          </div>
          <PageSelector pages={pages} selectedId={pageId} onSelect={setPageId} connectHref={connectHref} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {unavailable && (
            <div className="p-4">
              <Alert variant="info" title="Messenger inbox is coming soon"
                message="Your Page is connected and incoming messages are being saved. They'll appear here once the server's conversation API is live." />
            </div>
          )}
          {listError && <div className="p-4"><Alert variant="error" message={listError} /></div>}
          {loadingConversations && !conversations.length && <div className="flex justify-center py-10"><Spinner label="Loading conversations" /></div>}
          {!loadingConversations && !unavailable && !listError && !conversations.length && (
            <EmptyState compact icon={<MessageCircle size={22} />} title="No conversations yet"
              description="When someone messages your Page, the chat appears here." />
          )}
          <ul>
            {conversations.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-hover ${c.id === activeId ? "bg-primary-lighter" : ""}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-foreground">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm text-foreground ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeLabel(c.last_message_at)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{c.last_message || "No messages yet"}</span>
                      {c.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Thread */}
      <section className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState icon={<MessageCircle size={28} />} title="Select a conversation"
              description="Choose a chat on the left to read messages and reply." />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
              <button type="button" className="md:hidden" aria-label="Back to conversations" onClick={() => setActiveId(null)}><ArrowLeft size={18} /></button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold">{initials(active.name)}</span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{active.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><MessengerLogo size={12} /> Facebook Messenger</p>
              </div>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
              {loadingMessages && !thread.length && <div className="flex justify-center py-10"><Spinner label="Loading messages" /></div>}
              {threadError && <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{threadError}</span><Button size="sm" variant="outline" onClick={() => void loadMessages(active.id)}>Retry</Button></div>} />}
              {!loadingMessages && !threadError && !thread.length && <p className="py-10 text-center text-sm text-muted-foreground">No messages in this conversation yet.</p>}
              {thread.map(m => (
                <div key={m.client_request_id || m.id} className={`flex ${m.outgoing ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.outgoing ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.text || <em className="opacity-70">Unsupported message</em>}</p>
                    <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${m.outgoing ? "opacity-80" : "text-muted-foreground"}`}>
                      {timeLabel(m.created_at)}{m.outgoing && <StatusIcon message={m} />}
                    </p>
                  </div>
                  {m.status === "failed" && (
                    <div className="ml-2 flex max-w-[40%] flex-col items-start justify-center gap-1 text-xs text-error">
                      <span>{m.error || "Not sent."}</span>
                      <button type="button" className="font-medium underline" onClick={() => void deliver(active.id, m)}>Retry</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-surface p-3">
              <div className="flex items-end gap-2">
                <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, MAX_TEXT))} onKeyDown={onKeyDown}
                  rows={1} placeholder="Type a reply…" aria-label="Reply"
                  className="max-h-40 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
                <Button aria-label="Send" disabled={!draft.trim() || unavailable} onClick={send} leftIcon={<Send size={16} />}>Send</Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter to send · Shift+Enter for a new line · Facebook only allows replies within 24 hours of the customer&apos;s last message.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
