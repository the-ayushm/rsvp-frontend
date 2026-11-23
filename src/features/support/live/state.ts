import type { ChatMessage, SupportMessage, SupportTicket } from "./types";

export const MESSAGE_MAX_LENGTH = 10_000;
export const SUBJECT_MAX_LENGTH = 255;

/** Compare numeric strings without converting to Number (avoids precision loss). */
export function compareSequence(a: string, b: string): number {
  try {
    const x = BigInt(a);
    const y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
  } catch {
    return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
  }
}

/** Returns the larger of two event cursors (either may be null). */
export function maxCursor(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return compareSequence(a, b) >= 0 ? a : b;
}

const sortMessages = (list: ChatMessage[]) =>
  list.sort((a, b) => {
    // Unsaved (optimistic) messages always sit after saved ones.
    if (a.sequence === null && b.sequence === null) return a.created_at.localeCompare(b.created_at);
    if (a.sequence === null) return 1;
    if (b.sequence === null) return -1;
    return compareSequence(a.sequence, b.sequence);
  });

/**
 * Merge saved messages (from history, POST responses or live events) into the
 * current list. Deduplicates by saved id and replaces optimistic copies that
 * share a client_message_id. Order of arrival does not matter.
 */
export function mergeMessages(current: ChatMessage[], incoming: SupportMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map<string, ChatMessage>();
  const optimisticByClientId = new Map<string, string>();

  for (const m of current) {
    byId.set(m.id, m);
    if (m.localStatus && m.client_message_id) optimisticByClientId.set(m.client_message_id, m.id);
  }

  for (const saved of incoming) {
    if (saved.client_message_id) {
      const localId = optimisticByClientId.get(saved.client_message_id);
      if (localId) {
        byId.delete(localId);
        optimisticByClientId.delete(saved.client_message_id);
      }
    }
    byId.set(saved.id, { ...saved, sequence: String(saved.sequence) });
  }

  return sortMessages(Array.from(byId.values()));
}

export function addOptimisticMessage(
  current: ChatMessage[],
  draft: { clientMessageId: string; ticketId: string; text: string; userId: string; userName?: string },
): ChatMessage[] {
  const localId = `local:${draft.clientMessageId}`;
  const without = current.filter((m) => m.id !== localId);
  return sortMessages([
    ...without,
    {
      id: localId,
      ticket_id: draft.ticketId,
      sequence: null,
      message: draft.text,
      user_id: draft.userId,
      user_name: draft.userName ?? null,
      sender_role: "user",
      client_message_id: draft.clientMessageId,
      created_at: new Date().toISOString(),
      localStatus: "sending",
    },
  ]);
}

export function markOptimisticFailed(current: ChatMessage[], clientMessageId: string, error: string): ChatMessage[] {
  return current.map((m) =>
    m.id === `local:${clientMessageId}` ? { ...m, localStatus: "failed", localError: error } : m,
  );
}

/**
 * Merge a (possibly partial) ticket summary into a full ticket. Fields that
 * are absent from the partial are kept, so contact details are not lost.
 */
export function mergeTicket<T extends SupportTicket>(full: T | undefined, partial: Partial<SupportTicket> & { id: string }): T {
  const next = { ...(full ?? {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) next[key] = value;
  }
  return next as T;
}

const ticketTime = (t: SupportTicket) => t.updated_at ?? t.created_at ?? "";

export function sortTickets(list: SupportTicket[]): SupportTicket[] {
  return [...list].sort((a, b) => ticketTime(b).localeCompare(ticketTime(a)));
}

/** Insert or merge a ticket summary and keep the list ordered by latest update. */
export function upsertTicket(list: SupportTicket[], partial: Partial<SupportTicket> & { id: string }): SupportTicket[] {
  const idx = list.findIndex((t) => t.id === partial.id);
  if (idx === -1) return sortTickets([...list, mergeTicket(undefined, partial)]);
  const next = [...list];
  next[idx] = mergeTicket(list[idx], partial);
  return sortTickets(next);
}

/** Merge a fresh page into the list without dropping tickets already loaded. */
export function mergeTicketPage(list: SupportTicket[], page: SupportTicket[]): SupportTicket[] {
  let next = list;
  for (const t of page) next = upsertTicket(next, t);
  return next;
}

export function validateMessage(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Message cannot be empty.";
  if (trimmed.length > MESSAGE_MAX_LENGTH) return `Message must be at most ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`;
  return null;
}

export function validateSubject(subject: string): string | null {
  if (subject === "") return null;
  const trimmed = subject.trim();
  if (!trimmed) return "Subject cannot be blank.";
  if (trimmed.length > SUBJECT_MAX_LENGTH) return `Subject must be at most ${SUBJECT_MAX_LENGTH} characters.`;
  return null;
}

export const isTicketClosed = (status: string | undefined) => status === "resolved" || status === "closed";

export function generateUUID(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // randomUUID needs a secure context; fall back to getRandomValues (RFC 4122 v4).
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Quote bare numeric `sequence`/cursor values so JSON.parse can't round them. */
export function stringifyBigNumbers(json: string): string {
  return json.replace(/"(sequence|next_cursor|previous_cursor|event_id|cursor)"\s*:\s*(-?\d+)/g, '"$1":"$2"');
}
