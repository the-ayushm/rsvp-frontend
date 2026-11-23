import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessagesPage } from "../types/inbox.types";
import { getMessageStableKey } from "./message.utils";

export function mergeMessagePages(pages: MessagesPage[]): Message[] {
  const unique = new Map<string, Message>();
  // Page 1 contains the newest server state when adjacent pages overlap.
  for (const page of pages) {
    for (const message of page.messages) {
      const key = getMessageStableKey(message) ||
        `${message.createdAt}:${message.direction}:${message.text}`;
      if (!unique.has(key)) unique.set(key, message);
    }
  }
  return [...unique.values()].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

export function appendMessageToPages(
  data: InfiniteData<MessagesPage> | undefined,
  message: Message,
): InfiniteData<MessagesPage> | undefined {
  if (!data?.pages?.length) return data;
  const key = getMessageStableKey(message);
  if (key && data.pages.some((page) =>
    page.messages.some((existing) => getMessageStableKey(existing) === key))) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page, index) => index === 0
      ? { ...page, messages: [...page.messages, message] }
      : page),
  };
}

/** Refresh the newest page without dropping older messages or their pagination. */
export function mergeLatestMessagePage(
  data: InfiniteData<MessagesPage> | undefined,
  latest: MessagesPage,
): InfiniteData<MessagesPage> | undefined {
  if (!data?.pages.length) return data;
  return {
    ...data,
    pages: data.pages.map((page, index) => index === 0
      ? { ...latest, messages: mergeMessagePages([latest, page]) }
      : page),
  };
}

export function applyMessageStatus(
  data: InfiniteData<MessagesPage> | undefined,
  wamid: string,
  status: string,
): InfiniteData<MessagesPage> | undefined {
  if (!data?.pages) return data;
  const normalized = status.trim().toLowerCase();
  const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) => {
        if (message.whatsappMessageId !== wamid && String(message.id) !== wamid) return message;
        // Delivery webhooks can arrive out of order; a read receipt stays read.
        const current = message.readAt ? "read" : (message.status || "").trim().toLowerCase();
        if (current === "read" && normalized !== "read") return message;
        if (rank[normalized] != null && (rank[current] ?? 0) > rank[normalized]) return message;
        return { ...message, status: normalized };
      }),
    })),
  };
}
