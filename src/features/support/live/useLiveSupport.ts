"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConsoleToken } from "@/features/inbox/utils/auth.utils";
import * as api from "./api";
import { SupportStream, type ParsedStreamEvent } from "./support-stream";
import {
  addOptimisticMessage,
  generateUUID,
  isTicketClosed,
  markOptimisticFailed,
  maxCursor,
  mergeMessages,
  mergeTicket,
  mergeTicketPage,
  sortTickets,
  upsertTicket,
  validateMessage,
  validateSubject,
} from "./state";
import type { ChatMessage, StreamStatus, SupportAdmin, SupportMessage, SupportTicket } from "./types";

export interface SupportSession {
  userId: string;
  userName: string;
}

/** Reads the logged-in dashboard user. Returns null when signed out. */
export function readSupportSession(): SupportSession | null {
  if (typeof window === "undefined") return null;
  if (!getConsoleToken()) return null;
  try {
    const user = JSON.parse(localStorage.getItem("user_data") || "null");
    const userId = user?.id ?? user?._id ?? user?.user_id;
    if (!userId) return null;
    return { userId: String(userId), userName: String(user?.name ?? user?.full_name ?? user?.email ?? "") };
  } catch {
    return null;
  }
}

interface HistoryState {
  loaded: boolean;
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  previousCursor: string | null;
  nextCursor: string | null;
  error: string | null;
}

const emptyHistory: HistoryState = {
  loaded: false,
  loading: false,
  loadingOlder: false,
  hasOlder: false,
  previousCursor: null,
  nextCursor: null,
  error: null,
};

const PAGE_SIZE = 20;

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}
const READY_WAIT_MS = 5000;

export function useLiveSupport(session: SupportSession | null, panelOpen: boolean) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsPage, setTicketsPage] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<SupportAdmin[] | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SupportTicket>>({});
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [history, setHistory] = useState<Record<string, HistoryState>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const historyRef = useRef(history);
  historyRef.current = history;
  const createKeyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountKey = session?.userId ?? null;

  const isOwn = useCallback((m: Pick<SupportMessage, "user_id" | "sender_role">) => {
    const me = sessionRef.current?.userId;
    return me ? m.user_id === me : m.sender_role === "user";
  }, []);

  const patchHistory = useCallback((ticketId: string, patch: Partial<HistoryState>) => {
    setHistory((prev) => ({ ...prev, [ticketId]: { ...(prev[ticketId] ?? emptyHistory), ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    setStatus("idle");
    setStatusDetail(null);
    setTickets([]);
    setTicketsTotal(0);
    setTicketsPage(0);
    setTicketsError(null);
    setAdmins(null);
    setSelectedId(null);
    setDetails({});
    setMessages({});
    setHistory({});
    setUnread({});
    setNotice(null);
    createKeyRef.current = null;
  }, []);

  const forgetTicket = useCallback((ticketId: string, reason?: string) => {
    setTickets((list) => list.filter((t) => t.id !== ticketId));
    setDetails((prev) => omitKey(prev, ticketId));
    setMessages((prev) => omitKey(prev, ticketId));
    setHistory((prev) => omitKey(prev, ticketId));
    setUnread((prev) => omitKey(prev, ticketId));
    if (selectedRef.current === ticketId) {
      setSelectedId(null);
      if (reason) setNotice(reason);
    }
  }, []);

  // ── Ticket list ──────────────────────────────────────────────────────────
  const loadTickets = useCallback(async (page: number) => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const res = await api.listTickets({ page, limit: PAGE_SIZE });
      setTickets((list) => (page === 1 ? sortTickets(res.items) : mergeTicketPage(list, res.items)));
      setTicketsTotal(res.pagination.total);
      setTicketsPage((p) => (page === 1 ? 1 : Math.max(p, page)));
    } catch (err) {
      setTicketsError(api.toSupportError(err).message);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  /** Re-reads page 1 and merges it, keeping pages that are already loaded. */
  const refreshTicketsHead = useCallback(async () => {
    try {
      const res = await api.listTickets({ page: 1, limit: PAGE_SIZE });
      setTickets((list) => mergeTicketPage(list, res.items));
      setTicketsTotal(res.pagination.total);
    } catch {
      // Live updates keep working; the next event or reconnect will retry.
    }
  }, []);

  const scheduleTicketsRefresh = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => void refreshTicketsHead(), 400);
  }, [refreshTicketsHead]);

  // ── Ticket detail + history ──────────────────────────────────────────────
  const refreshDetail = useCallback(
    async (ticketId: string) => {
      try {
        const ticket = await api.getTicket(ticketId);
        setDetails((prev) => ({ ...prev, [ticketId]: mergeTicket(prev[ticketId], ticket) }));
        setTickets((list) => upsertTicket(list, ticket));
        return ticket;
      } catch (err) {
        const e = api.toSupportError(err);
        if (e.status === 404 || e.status === 403) forgetTicket(ticketId, "That conversation is no longer available.");
        return null;
      }
    },
    [forgetTicket],
  );

  const loadLatestMessages = useCallback(
    async (ticketId: string) => {
      patchHistory(ticketId, { loading: true, error: null });
      try {
        const page = await api.listMessages(ticketId, { limit: 50 });
        setMessages((prev) => ({ ...prev, [ticketId]: mergeMessages(prev[ticketId] ?? [], page.items) }));
        const prevHistory = historyRef.current[ticketId];
        patchHistory(ticketId, {
          loaded: true,
          loading: false,
          hasOlder: page.has_more,
          previousCursor: prevHistory?.loaded ? prevHistory.previousCursor : page.previous_cursor,
          nextCursor: maxCursor(prevHistory?.nextCursor ?? null, page.next_cursor),
        });
      } catch (err) {
        const e = api.toSupportError(err);
        patchHistory(ticketId, { loading: false, error: e.message });
        if (e.status === 404 || e.status === 403) forgetTicket(ticketId, "That conversation is no longer available.");
      }
    },
    [forgetTicket, patchHistory],
  );

  /** Pull messages newer than the last cursor (used after a reconnect). */
  const catchUpMessages = useCallback(
    async (ticketId: string) => {
      const h = historyRef.current[ticketId];
      if (!h?.loaded) return;
      if (!h.nextCursor) return loadLatestMessages(ticketId);
      let after: string | null = h.nextCursor;
      try {
        for (let i = 0; i < 10 && after; i++) {
          const page = await api.listMessages(ticketId, { after, limit: 100 });
          setMessages((prev) => ({ ...prev, [ticketId]: mergeMessages(prev[ticketId] ?? [], page.items) }));
          after = page.next_cursor ?? after;
          patchHistory(ticketId, { nextCursor: after });
          if (!page.has_more) break;
        }
      } catch {
        // The stream replay covers the gap; this is only a safety net.
      }
    },
    [loadLatestMessages, patchHistory],
  );

  const loadOlder = useCallback(
    async (ticketId: string) => {
      const h = historyRef.current[ticketId];
      if (!h?.hasOlder || !h.previousCursor || h.loadingOlder) return;
      patchHistory(ticketId, { loadingOlder: true });
      try {
        const page = await api.listMessages(ticketId, { before: h.previousCursor, limit: 50 });
        setMessages((prev) => ({ ...prev, [ticketId]: mergeMessages(prev[ticketId] ?? [], page.items) }));
        patchHistory(ticketId, { loadingOlder: false, hasOlder: page.has_more, previousCursor: page.previous_cursor });
      } catch (err) {
        patchHistory(ticketId, { loadingOlder: false, error: api.toSupportError(err).message });
      }
    },
    [patchHistory],
  );

  // ── Live events ──────────────────────────────────────────────────────────
  const applyEvent = useCallback(
    (e: ParsedStreamEvent) => {
      const data = e.data ?? {};
      switch (e.event) {
        case "message.created": {
          const raw = data.message as SupportMessage | undefined;
          if (!raw?.id || !raw.ticket_id) return;
          const m: SupportMessage = { ...raw, sequence: String(raw.sequence) };
          const tid = m.ticket_id;
          setMessages((prev) => ({ ...prev, [tid]: mergeMessages(prev[tid] ?? [], [m]) }));
          if (historyRef.current[tid]?.loaded) {
            patchHistory(tid, { nextCursor: maxCursor(historyRef.current[tid]?.nextCursor ?? null, m.sequence) });
          }
          setTickets((list) => {
            if (!list.some((t) => t.id === tid)) {
              scheduleTicketsRefresh();
              return list;
            }
            return upsertTicket(list, { id: tid, updated_at: m.created_at });
          });
          const viewing =
            panelOpenRef.current &&
            selectedRef.current === tid &&
            (typeof document === "undefined" || document.visibilityState === "visible");
          if (!isOwn(m) && !viewing) {
            setUnread((prev) => ({ ...prev, [tid]: (prev[tid] ?? 0) + 1 }));
          }
          return;
        }
        case "ticket.created":
        case "ticket.updated":
        case "ticket.assigned":
        case "ticket.status_changed": {
          const t = data.ticket as (Partial<SupportTicket> & { id: string }) | undefined;
          if (!t?.id) return;
          setTickets((list) => upsertTicket(list, t));
          setDetails((prev) => (prev[t.id] ? { ...prev, [t.id]: mergeTicket(prev[t.id], t) } : prev));
          if (e.event === "ticket.created" || e.event === "ticket.status_changed") scheduleTicketsRefresh();
          return;
        }
        case "ticket.deleted": {
          const id = data.ticket_id as string | undefined;
          if (id) forgetTicket(id, "This conversation was removed by support.");
          return;
        }
        default:
          return;
      }
    },
    [forgetTicket, isOwn, patchHistory, scheduleTicketsRefresh],
  );
  const applyEventRef = useRef(applyEvent);
  applyEventRef.current = applyEvent;

  // One inbox stream per signed-in account. Recreated when the account changes;
  // closed on sign-out and on unmount so subscriptions never pile up.
  useEffect(() => {
    resetAll();
    if (!accountKey) return;

    let disposed = false;
    let releaseSnapshot!: () => void;
    const snapshotApplied = new Promise<void>((r) => (releaseSnapshot = r));
    let readyResolve!: () => void;
    const ready = new Promise<void>((r) => (readyResolve = r));

    const stream = new SupportStream({
      url: api.supportEventsUrl(),
      getToken: getConsoleToken,
      onStatus: (s, detail) => {
        if (disposed) return;
        setStatus(s);
        setStatusDetail(detail ?? null);
      },
      onReady: async ({ resumed }) => {
        readyResolve();
        if (resumed && !disposed) {
          // The server replays from Last-Event-ID; also re-sync as a safety net.
          void refreshTicketsHead();
          if (selectedRef.current) void catchUpMessages(selectedRef.current);
        }
      },
      // Events wait until the snapshot is applied, so nothing the snapshot
      // already covers is lost or re-ordered, and the cursor is advanced only
      // once the event is actually applied.
      onEvent: async (event) => {
        await snapshotApplied;
        if (!disposed) applyEventRef.current(event);
      },
      // There is no client-side token refresh endpoint; the stream re-reads
      // the stored token on reconnect (another tab or re-login may have updated it).
      refreshAuth: async () => undefined,
    }).start();

    void (async () => {
      await Promise.race([ready, new Promise((r) => setTimeout(r, READY_WAIT_MS))]);
      if (disposed) return;
      await loadTickets(1);
      releaseSnapshot();
    })();

    return () => {
      disposed = true;
      releaseSnapshot();
      stream.close();
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [accountKey, catchUpMessages, loadTickets, refreshTicketsHead, resetAll]);

  // Mark the open conversation as read.
  useEffect(() => {
    if (!panelOpen || !selectedId) return;
    setUnread((prev) => (prev[selectedId] ? { ...prev, [selectedId]: 0 } : prev));
  }, [panelOpen, selectedId, messages]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const openTicket = useCallback(
    (ticketId: string | null) => {
      setSelectedId(ticketId);
      setNotice(null);
      if (!ticketId) return;
      setUnread((prev) => ({ ...prev, [ticketId]: 0 }));
      void refreshDetail(ticketId);
      const h = historyRef.current[ticketId];
      if (!h?.loaded && !h?.loading) void loadLatestMessages(ticketId);
      else void catchUpMessages(ticketId);
    },
    [catchUpMessages, loadLatestMessages, refreshDetail],
  );

  const loadAdmins = useCallback(async () => {
    if (admins) return;
    try {
      setAdmins(await api.listAdmins());
    } catch {
      setAdmins([]);
    }
  }, [admins]);

  const startChat = useCallback(
    async (input: { message: string; subject?: string; adminId?: string }): Promise<string | null> => {
      const messageError = validateMessage(input.message);
      if (messageError) return messageError;
      const subject = input.subject ?? "";
      const subjectError = validateSubject(subject);
      if (subjectError) return subjectError;

      // Same content → same idempotency key, so a retry can't create a duplicate.
      const fingerprint = JSON.stringify([input.message.trim(), subject.trim(), input.adminId ?? ""]);
      if (createKeyRef.current?.fingerprint !== fingerprint) {
        createKeyRef.current = { key: generateUUID(), fingerprint };
      }
      try {
        const ticket = await api.createTicket({
          message: input.message,
          subject: subject.trim() || undefined,
          admin_id: input.adminId || undefined,
          channel: "live_chat",
          client_request_id: createKeyRef.current.key,
        });
        createKeyRef.current = null;
        setTickets((list) => upsertTicket(list, ticket));
        setTicketsTotal((n) => n + 1);
        setDetails((prev) => ({ ...prev, [ticket.id]: mergeTicket(prev[ticket.id], ticket) }));
        setSelectedId(ticket.id);
        setNotice(null);
        // Creation already saved the opening message; load it rather than re-send it.
        void loadLatestMessages(ticket.id);
        return null;
      } catch (err) {
        const e = api.toSupportError(err);
        if (e.status === 409) createKeyRef.current = null;
        return e.message;
      }
    },
    [loadLatestMessages],
  );

  const send = useCallback(
    async (ticketId: string, text: string, retryClientId?: string): Promise<string | null> => {
      const error = validateMessage(text);
      if (error) return error;
      const ticket = details[ticketId] ?? tickets.find((t) => t.id === ticketId);
      if (isTicketClosed(ticket?.status)) return "Reopen this conversation to send a message.";

      const clientId = retryClientId ?? generateUUID();
      const me = sessionRef.current;
      setMessages((prev) => ({
        ...prev,
        [ticketId]: addOptimisticMessage(prev[ticketId] ?? [], {
          clientMessageId: clientId,
          ticketId,
          text: text.trim(),
          userId: me?.userId ?? "",
          userName: me?.userName,
        }),
      }));
      try {
        const saved = await api.sendMessage(ticketId, text, clientId);
        setMessages((prev) => ({ ...prev, [ticketId]: mergeMessages(prev[ticketId] ?? [], [saved]) }));
        setTickets((list) => upsertTicket(list, { id: ticketId, updated_at: saved.created_at }));
        return null;
      } catch (err) {
        const e = api.toSupportError(err);
        setMessages((prev) => ({ ...prev, [ticketId]: markOptimisticFailed(prev[ticketId] ?? [], clientId, e.message) }));
        if (e.status === 409) void refreshDetail(ticketId);
        if (e.status === 404) forgetTicket(ticketId, "That conversation is no longer available.");
        return null;
      }
    },
    [details, forgetTicket, refreshDetail, tickets],
  );

  const retryMessage = useCallback(
    (m: ChatMessage) => {
      if (m.localStatus !== "failed" || !m.client_message_id) return;
      void send(m.ticket_id, m.message, m.client_message_id);
    },
    [send],
  );

  const discardMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => ({ ...prev, [m.ticket_id]: (prev[m.ticket_id] ?? []).filter((x) => x.id !== m.id) }));
  }, []);

  const changeStatus = useCallback(
    async (ticketId: string, next: "open" | "resolved" | "closed"): Promise<string | null> => {
      try {
        const ticket = await api.updateTicketStatus(ticketId, next);
        const merged = { ...(ticket ?? {}), id: ticketId, status: ticket?.status ?? next };
        setDetails((prev) => ({ ...prev, [ticketId]: mergeTicket(prev[ticketId], merged) }));
        setTickets((list) => upsertTicket(list, merged));
        return null;
      } catch (err) {
        const e = api.toSupportError(err);
        if (e.status === 409) void refreshDetail(ticketId);
        if (e.status === 404) forgetTicket(ticketId, "That conversation is no longer available.");
        return e.message;
      }
    },
    [forgetTicket, refreshDetail],
  );

  const selectedTicket = selectedId ? details[selectedId] ?? tickets.find((t) => t.id === selectedId) ?? null : null;
  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  return {
    status,
    statusDetail,
    tickets,
    ticketsTotal,
    ticketsLoading,
    ticketsError,
    hasMoreTickets: tickets.length < ticketsTotal,
    loadMoreTickets: () => loadTickets(ticketsPage + 1),
    reloadTickets: () => loadTickets(1),
    admins,
    loadAdmins,
    selectedId,
    selectedTicket,
    selectedMessages: selectedId ? messages[selectedId] ?? [] : [],
    selectedHistory: selectedId ? history[selectedId] ?? emptyHistory : emptyHistory,
    lastMessageFor: (ticketId: string) => messages[ticketId]?.[messages[ticketId].length - 1] ?? null,
    unread,
    totalUnread,
    notice,
    dismissNotice: () => setNotice(null),
    openTicket,
    loadOlder,
    reloadMessages: loadLatestMessages,
    startChat,
    send,
    retryMessage,
    discardMessage,
    changeStatus,
    isOwn,
  };
}

export type LiveSupport = ReturnType<typeof useLiveSupport>;
