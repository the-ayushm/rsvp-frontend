import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Message, MessageTarget } from "../../types/inbox.types";
import { getDateGroupLabel, isMyMessage } from "../../utils/message.utils";
import { MessageBubble } from "../MessageBubble";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  outboundPhoneNumberId: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  loadingMessages: boolean;
  messagesError: boolean;
  hasOlderMessages: boolean;
  isFetchingOlderMessages: boolean;
  fetchOlderMessages: () => Promise<unknown>;
  refetchMessages: () => Promise<unknown>;
  /** Notification target to scroll to and highlight instead of the latest message. */
  target?: MessageTarget | null;
  onTargetSettled?: (found: boolean) => void;
  /** Called with the last incoming message actually seen in a visible document. */
  onIncomingViewed?: (message: Message) => void;
}

const keyOf = (msg: Message) => String(msg.whatsappMessageId || msg.id);
// Older pages to load while looking for a notification target.
const MAX_TARGET_PAGES = 10;

const findTarget = (messages: Message[], target?: MessageTarget | null) => {
  if (!target) return -1;
  const byId = target.id ? messages.findIndex((m) => String(m.id) === target.id) : -1;
  if (byId >= 0 || !target.wamid) return byId;
  return messages.findIndex((m) => m.whatsappMessageId === target.wamid);
};

type Item =
  | { type: "date"; label: string }
  | { type: "message"; msg: Message; reactionEmoji?: string | null; isGroupStart: boolean };

export const MessageList = ({
  messages,
  outboundPhoneNumberId,
  messagesEndRef,
  loadingMessages,
  messagesError,
  hasOlderMessages,
  isFetchingOlderMessages,
  fetchOlderMessages,
  refetchMessages,
  target = null,
  onTargetSettled,
  onIncomingViewed,
}: MessageListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const nearBottom = useRef(true);
  const previousLatestKey = useRef<string | number | null>(null);
  const pendingRequest = useRef(false);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const latest = messages.at(-1);
  const latestKey = latest?.whatsappMessageId || latest?.id || null;

  const targetKey = target ? `${target.id ?? ""}|${target.wamid ?? ""}` : null;
  const targetIndex = findTarget(messages, target);
  const settledTarget = useRef<string | null>(null);
  const targetLoads = useRef(0);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const targetPending = useRef(false);
  targetPending.current = targetKey !== null && settledTarget.current !== targetKey;
  const onViewedRef = useRef(onIncomingViewed);
  onViewedRef.current = onIncomingViewed;
  const visibleKeys = useRef(new Set<string>());
  const lastViewedKey = useRef<string | null>(null);

  // Report the newest incoming message currently on screen, only while the tab
  // is visible and not before a notification target has been scrolled to.
  const reportViewed = useCallback(() => {
    if (document.visibilityState !== "visible" || targetPending.current) return;
    const list = messagesRef.current;
    let best = -1;
    list.forEach((m, i) => {
      if (!isMyMessage(m) && visibleKeys.current.has(keyOf(m))) best = i;
    });
    if (best < 0) return;
    // Reactions render as overlays, so they're seen with the message before them.
    while (best + 1 < list.length && list[best + 1].type === "reaction" && !isMyMessage(list[best + 1])) best++;
    const previous = lastViewedKey.current ? list.findIndex((m) => keyOf(m) === lastViewedKey.current) : -1;
    if (best <= previous) return;
    lastViewedKey.current = keyOf(list[best]);
    onViewedRef.current?.(list[best]);
  }, []);

  useEffect(() => {
    const root = listRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const visible = visibleKeys.current;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.messageKey;
        if (!key) continue;
        // Tall bubbles may never reach the ratio; half the pane also counts.
        const seen = entry.isIntersecting && (entry.intersectionRatio >= 0.6 ||
          entry.intersectionRect.height >= (entry.rootBounds?.height ?? Infinity) * 0.5);
        if (seen) visible.add(key);
        else visible.delete(key);
      }
      reportViewed();
    }, { root, threshold: [0, 0.6, 1] });
    root.querySelectorAll<HTMLElement>('[data-incoming="true"]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      visible.clear();
    };
  }, [messages, reportViewed]);

  useEffect(() => {
    document.addEventListener("visibilitychange", reportViewed);
    window.addEventListener("focus", reportViewed);
    return () => {
      document.removeEventListener("visibilitychange", reportViewed);
      window.removeEventListener("focus", reportViewed);
    };
  }, [reportViewed]);

  useEffect(() => {
    if (!highlightKey) return;
    const timer = setTimeout(() => setHighlightKey(null), 2400);
    return () => clearTimeout(timer);
  }, [highlightKey]);

  const loadOlder = useCallback(() => {
    const list = listRef.current;
    if (!list || loadingMessages || !hasOlderMessages || isFetchingOlderMessages || pendingRequest.current) return;
    anchor.current = { height: list.scrollHeight, top: list.scrollTop };
    pendingRequest.current = true;
    void fetchOlderMessages()
      .catch(() => { /* The retry control uses the query's error state. */ })
      .finally(() => { pendingRequest.current = false; });
  }, [loadingMessages, hasOlderMessages, isFetchingOlderMessages, fetchOlderMessages]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || loadingMessages) return;
    if (targetKey && settledTarget.current !== targetKey) {
      if (isFetchingOlderMessages) return;
      if (targetIndex >= 0) {
        const key = keyOf(messages[targetIndex]);
        const row = list.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(key)}"]`);
        if (row) {
          // Centre within the list only; scrollIntoView would also scroll the page.
          const rowRect = row.getBoundingClientRect();
          const listRect = list.getBoundingClientRect();
          list.scrollTop += rowRect.top - listRect.top - (list.clientHeight - rowRect.height) / 2;
        }
        anchor.current = null;
        initialized.current = true;
        settledTarget.current = targetKey;
        targetPending.current = false;
        previousLatestKey.current = latestKey;
        setHighlightKey(key);
        onTargetSettled?.(true);
        reportViewed();
        return;
      }
      if (hasOlderMessages && targetLoads.current < MAX_TARGET_PAGES) {
        if (!pendingRequest.current) {
          targetLoads.current++;
          pendingRequest.current = true;
          void fetchOlderMessages()
            .catch(() => { /* Bounded by MAX_TARGET_PAGES. */ })
            .finally(() => { pendingRequest.current = false; });
        }
        return;
      }
      // Not in history: show the latest messages as usual.
      settledTarget.current = targetKey;
      targetPending.current = false;
      initialized.current = false;
      anchor.current = null;
      onTargetSettled?.(false);
    }
    if (anchor.current) {
      if (isFetchingOlderMessages) return;
      list.scrollTop = anchor.current.top + list.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (!initialized.current || (latestKey !== previousLatestKey.current && nearBottom.current)) {
      list.scrollTop = list.scrollHeight;
      initialized.current = messages.length > 0;
    }
    previousLatestKey.current = latestKey;
  }, [messages, loadingMessages, isFetchingOlderMessages, latestKey, targetKey, targetIndex,
    hasOlderMessages, fetchOlderMessages, onTargetSettled, reportViewed]);

  // Reactions are rendered as overlays on their target message
  const reactionMap = new Map<string, string>();
  messages.forEach((m, idx) => {
    if (m.type === "reaction" && m.reactionEmoji) {
      if (m.reactionMessageId) reactionMap.set(String(m.reactionMessageId), m.reactionEmoji);
      // Fallback: attach to the closest preceding non-reaction message
      for (let j = idx - 1; j >= 0; j--) {
        if (messages[j].type !== "reaction") {
          if (messages[j].whatsappMessageId) reactionMap.set(String(messages[j].whatsappMessageId), m.reactionEmoji);
          if (messages[j].id) reactionMap.set(String(messages[j].id), m.reactionEmoji);
          break;
        }
      }
    }
  });

  const items: Item[] = [];
  let lastDateLabel: string | null = null;
  let lastSenderOutgoing: boolean | null = null;
  for (const msg of messages) {
    if (msg.type === "reaction") continue;
    const dateLabel = getDateGroupLabel(new Date(msg.createdAt));
    if (dateLabel !== lastDateLabel) {
      items.push({ type: "date", label: dateLabel });
      lastDateLabel = dateLabel;
      lastSenderOutgoing = null;
    }
    const outgoing = isMyMessage(msg);
    items.push({
      type: "message",
      msg,
      isGroupStart: outgoing !== lastSenderOutgoing,
      reactionEmoji:
        (msg.whatsappMessageId && reactionMap.get(String(msg.whatsappMessageId))) ||
        (msg.id && reactionMap.get(String(msg.id))) ||
        msg.reactionEmoji ||
        null,
    });
    lastSenderOutgoing = outgoing;
  }

  return (
    <div
      ref={listRef}
      className={styles.list}
      role="log"
      aria-live="polite"
      aria-label="Messages"
      aria-busy={loadingMessages || isFetchingOlderMessages}
      onScroll={(event) => {
        const list = event.currentTarget;
        nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        if (initialized.current && list.scrollTop < 120) loadOlder();
      }}
    >
      {!loadingMessages && (hasOlderMessages || isFetchingOlderMessages) && (
        <div className={styles.history}>
          {isFetchingOlderMessages ? (
            <Spinner size="sm" label="Loading earlier messages" />
          ) : (
            <Button size="sm" variant="ghost" onClick={loadOlder}>
              {messagesError ? "Retry earlier messages" : "Load earlier messages"}
            </Button>
          )}
        </div>
      )}
      {loadingMessages && (
        <div className={styles.empty}><Spinner label="Loading messages" /></div>
      )}
      {!loadingMessages && messagesError && items.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyCard} role="alert">
            <p>Could not load messages.</p>
            <Button size="sm" variant="ghost" onClick={() => { void refetchMessages(); }}>Retry</Button>
          </div>
        </div>
      )}
      {!loadingMessages && !messagesError && items.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyCard}>No messages yet. Start the conversation below.</p>
        </div>
      )}
      {items.map((item, i) =>
        item.type === "date" ? (
          <div key={`date-${i}-${item.label}`} className={styles.date}>
            <span className={styles.datePill}>{item.label}</span>
          </div>
        ) : (
          <MessageBubble
            key={keyOf(item.msg)}
            messageKey={keyOf(item.msg)}
            highlighted={highlightKey === keyOf(item.msg)}
            msg={item.msg}
            reactionEmoji={item.reactionEmoji}
            outboundPhoneNumberId={outboundPhoneNumberId}
            isGroupStart={item.isGroupStart}
          />
        ),
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
