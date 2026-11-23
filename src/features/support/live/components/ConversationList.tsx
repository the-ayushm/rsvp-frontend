"use client";

import { ChevronRight, Loader2, MessageCirclePlus, MessagesSquare, RefreshCw } from "lucide-react";
import type { LiveSupport } from "../useLiveSupport";
import { StatusPill, relativeTime } from "./ui";

interface Props {
  support: LiveSupport;
  userName: string;
  onNewChat: () => void;
}

export default function ConversationList({ support, userName, onNewChat }: Props) {
  const firstName = userName.split(/[\s@]/)[0] || "there";
  const { tickets, ticketsLoading, ticketsError } = support;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <p className="text-base font-bold text-foreground">Hi {firstName} 👋</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Chat with your support team. They&apos;ll reply right here, live.
        </p>
        <button
          type="button"
          onClick={onNewChat}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.99]"
        >
          <MessageCirclePlus size={17} />
          Start a new chat
        </button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your conversations</h4>
          {ticketsLoading && tickets.length > 0 && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        </div>

        {ticketsError && tickets.length === 0 ? (
          <div className="rounded-xl border border-error-border bg-error-bg p-3 text-sm text-error">
            <p>{ticketsError}</p>
            <button type="button" onClick={support.reloadTickets} className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline">
              <RefreshCw size={12} /> Try again
            </button>
          </div>
        ) : ticketsLoading && tickets.length === 0 ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-xl bg-surface-active/60" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <MessagesSquare size={26} className="text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground">Start a chat and it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tickets.map((t) => {
              const last = support.lastMessageFor(t.id);
              const preview = last?.message ?? t.message ?? "";
              const unread = support.unread[t.id] ?? 0;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => support.openTicket(t.id)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"} text-foreground`}>
                          {t.subject || preview.split("\n")[0] || "Support chat"}
                        </p>
                        <StatusPill status={t.status} />
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{relativeTime(last?.created_at ?? t.updated_at ?? t.created_at)}</span>
                      {unread > 0 ? (
                        <span className="min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : (
                        <ChevronRight size={14} className="text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {support.hasMoreTickets && tickets.length > 0 && (
          <button
            type="button"
            disabled={ticketsLoading}
            onClick={() => void support.loadMoreTickets()}
            className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-60"
          >
            {ticketsLoading ? "Loading…" : "Show older conversations"}
          </button>
        )}
      </div>
    </div>
  );
}
