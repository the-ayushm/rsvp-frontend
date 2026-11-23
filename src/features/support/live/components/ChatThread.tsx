"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MoreVertical, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { MESSAGE_MAX_LENGTH, isTicketClosed } from "../state";
import type { ChatMessage } from "../types";
import type { LiveSupport } from "../useLiveSupport";
import { Avatar, StatusPill, clockTime, dayLabel } from "./ui";

export default function ChatThread({ support }: { support: LiveSupport }) {
  const ticket = support.selectedTicket;
  const messages = support.selectedMessages;
  const history = support.selectedHistory;
  const closed = isTicketClosed(ticket?.status);

  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstIdRef = useRef<string | null>(null);
  const prevHeightRef = useRef(0);
  const stickToBottom = useRef(true);

  const adminName = (id?: string | null) => (id ? support.admins?.find((a) => a.id === id)?.name : undefined);
  const assigned = adminName(ticket?.assigned_admin_id);

  useEffect(() => {
    void support.loadAdmins();
  }, [support.loadAdmins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the view pinned to the bottom for new messages, and keep the reading
  // position stable when older messages are prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const prepended = firstIdRef.current !== null && firstId !== firstIdRef.current && prevHeightRef.current > 0;
    const last = messages[messages.length - 1];

    if (prepended && !stickToBottom.current) {
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
    } else if (stickToBottom.current || (last && support.isOwn(last))) {
      el.scrollTop = el.scrollHeight;
    }
    firstIdRef.current = firstId;
    prevHeightRef.current = el.scrollHeight;
  }, [messages, support.isOwn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stickToBottom.current = true;
    firstIdRef.current = null;
    setDraft("");
    setMenuOpen(false);
  }, [support.selectedId]);

  // Auto-grow the composer up to ~5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  if (!ticket) return null;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 40 && history.hasOlder && !history.loadingOlder) void support.loadOlder(ticket.id);
  };

  const send = async () => {
    const text = draft;
    if (!text.trim() || closed) return;
    setDraft("");
    stickToBottom.current = true;
    const err = await support.send(ticket.id, text);
    if (err) {
      setDraft(text);
      toast.error(err);
    }
    inputRef.current?.focus();
  };

  const setStatus = async (next: "open" | "resolved" | "closed") => {
    setMenuOpen(false);
    setStatusBusy(true);
    const err = await support.changeStatus(ticket.id, next);
    setStatusBusy(false);
    if (err) toast.error(err);
    else if (next === "open") setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Conversation header */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{ticket.subject || "Support chat"}</p>
            <StatusPill status={ticket.status} />
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {assigned ? `Chatting with ${assigned}` : ticket.assigned_admin_id ? "Assigned to a team member" : "Waiting for the next available agent"}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Conversation actions"
            disabled={statusBusy}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
          >
            {statusBusy ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={16} />}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-lg">
                {closed ? (
                  <MenuItem icon={<RotateCcw size={14} />} label="Reopen chat" onClick={() => void setStatus("open")} />
                ) : (
                  <>
                    <MenuItem icon={<CheckCircle2 size={14} />} label="Mark as resolved" onClick={() => void setStatus("resolved")} />
                    <MenuItem icon={<XCircle size={14} />} label="Close chat" onClick={() => void setStatus("closed")} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {history.hasOlder && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={() => void support.loadOlder(ticket.id)}
              disabled={history.loadingOlder}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {history.loadingOlder && <Loader2 size={11} className="animate-spin" />}
              {history.loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {!history.loaded && history.loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={22} />
          </div>
        )}

        {history.error && messages.length === 0 && (
          <div className="mt-6 text-center text-sm text-error">
            <p>{history.error}</p>
            <button type="button" onClick={() => void support.reloadMessages(ticket.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const own = support.isOwn(m);
          const groupStart = newDay || !prev || prev.user_id !== m.user_id;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(m.created_at)}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <Bubble
                message={m}
                own={own}
                showSender={groupStart && !own}
                senderName={m.user_name || adminName(m.user_id) || "Support"}
                onRetry={() => support.retryMessage(m)}
                onDiscard={() => support.discardMessage(m)}
                spaced={groupStart}
              />
            </Fragment>
          );
        })}

        {history.loaded && !closed && messages.length > 0 && messages.every((m) => support.isOwn(m)) && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Thanks! A support agent will reply here shortly.
          </p>
        )}
      </div>

      {/* Composer */}
      {closed ? (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
          <p className="text-xs text-muted-foreground">
            This chat is {ticket.status}. Reopen it to continue the conversation.
          </p>
          <button
            type="button"
            disabled={statusBusy}
            onClick={() => void setStatus("open")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            <RotateCcw size={13} /> Reopen
          </button>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-border bg-surface px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message…"
            aria-label="Message"
            className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </form>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-hover">
      {icon}
      {label}
    </button>
  );
}

function Bubble({
  message,
  own,
  showSender,
  senderName,
  onRetry,
  onDiscard,
  spaced,
}: {
  message: ChatMessage;
  own: boolean;
  showSender: boolean;
  senderName: string;
  onRetry: () => void;
  onDiscard: () => void;
  spaced: boolean;
}) {
  const failed = message.localStatus === "failed";
  const sending = message.localStatus === "sending";
  return (
    <div className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${spaced ? "mt-3" : "mt-1"}`}>
      {!own && <div className="w-7 shrink-0">{showSender && <Avatar name={senderName} />}</div>}
      <div className={`flex max-w-[78%] flex-col ${own ? "items-end" : "items-start"}`}>
        {showSender && <span className="mb-0.5 ml-1 text-[11px] font-semibold text-muted-foreground">{senderName}</span>}
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-xs ${
            own
              ? `rounded-br-md bg-primary text-primary-foreground ${sending ? "opacity-70" : ""} ${failed ? "opacity-60" : ""}`
              : "rounded-bl-md border border-border bg-surface text-foreground"
          }`}
        >
          {message.message}
        </div>
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {sending && (
            <>
              <Loader2 size={10} className="animate-spin" /> Sending…
            </>
          )}
          {failed && (
            <span className="flex items-center gap-1 text-error">
              <AlertCircle size={11} />
              <span title={message.localError}>Not sent.</span>
              <button type="button" onClick={onRetry} className="font-bold underline">
                Retry
              </button>
              <span>·</span>
              <button type="button" onClick={onDiscard} className="underline">
                Delete
              </button>
            </span>
          )}
          {!sending && !failed && clockTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}
