import { getInboxMessageUserId } from "./inbox-user-scope";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (...values: unknown[]) => values.find(value => typeof value === "string" && value.trim()) as string | undefined;
const id = (...values: unknown[]) => {
  const value = values.find(value => (typeof value === "string" && value.trim()) || typeof value === "number");
  return value == null ? undefined : String(value);
};

export const MESSAGE_TOAST_CONTAINER_ID = "inbox-incoming-messages";

export interface LiveInboxMessage {
  id?: string;
  wamid?: string;
  userId?: string;
  contactId?: string;
  phoneNumberId?: string;
  contactPhone: string;
  contactName: string;
  direction: "incoming" | "outgoing" | "unknown";
  text: string;
  type: string;
  createdAt?: string;
  raw: Row;
}

export function normalizeInboxMessage(payload: unknown): LiveInboxMessage | null {
  const envelope = row(payload);
  const data = row(envelope.data);
  const message = row(envelope.message ?? data.message);
  const source = Object.keys(message).length ? message : Object.keys(data).length && !envelope.id && !envelope.wamid && !envelope.direction ? data : envelope;
  if (!Object.keys(source).length) return null;
  const content = row(source.content);
  const contact = row(source.contact);
  const explicitDirection = String(source.direction ?? "").trim().toLowerCase();
  const sentBy = String(source.sentBy ?? source.sent_by ?? "").toLowerCase();
  const direction = ["outgoing", "outbound"].includes(explicitDirection) ? "outgoing"
    : ["incoming", "inbound"].includes(explicitDirection) ? "incoming"
      : source.fromMe === true || ["me", "agent", "chatbot", "campaign"].includes(sentBy) ? "outgoing"
        : source.fromMe === false || sentBy === "customer" ? "incoming" : "unknown";
  const phone = text(source.contactPhone, source.contact_phone, contact.phone_number, contact.phone,
    direction === "outgoing" ? source.to_phone : source.from_phone,
    direction === "outgoing" ? source.to : source.from, source.phone_number, source.phone) ?? "";
  const interactive = row(source.interactive ?? content.interactive);
  const type = text(source.type, source.mediaType, source.media_type) ?? "text";
  const body = text(source.text, row(source.text).body, source.body, content.text, row(content.text).body,
    content.body, content.caption, row(interactive.body).text, row(interactive.button_reply).title,
    row(interactive.list_reply).title, row(interactive.nfm_reply).body, source.content)
    ?? (["image", "video", "audio", "document", "sticker"].includes(type.toLowerCase()) ? `[${type.toUpperCase()}]` : "Sent a message");
  const rawTime = source.createdAt ?? source.created_at ?? source.timestamp ?? source.sentAt ?? source.sent_at;
  const time = typeof rawTime === "number" || (typeof rawTime === "string" && /^\d+$/.test(rawTime))
    ? new Date(Number(rawTime) * (Number(rawTime) < 1e12 ? 1000 : 1)).getTime()
    : Date.parse(String(rawTime ?? ""));
  return {
    id: id(source.id, source._id),
    wamid: id(source.wamid, source.whatsappMessageId, source.whatsapp_message_id, source.message_id),
    userId: getInboxMessageUserId(payload) ?? undefined,
    contactId: id(source.contactId, source.contact_id, contact.id),
    // Internal business phone UUID; metaPhoneNumberId is the provider ID and is never used here.
    phoneNumberId: id(source.phoneNumberId, source.phone_number_id, source.waba_phone_number_id),
    contactPhone: phone,
    contactName: text(source.contactName, source.contact_name, source.profile_name, source.sender_name, contact.name, source.name) ?? (phone || "New contact"),
    direction, text: body, type,
    createdAt: Number.isFinite(time) ? new Date(time).toISOString() : undefined,
    raw: source,
  };
}

export function extractInboxMessageRows(payload: unknown): unknown[] {
  const root = row(payload), data = row(root.data);
  for (const candidate of [payload, root.data, data.messages, data.data, root.messages]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

/** Both transports may deliver the same message with different database IDs. */
export class InboxMessageDeduplicator {
  private seen = new Set<string>();
  constructor(private readonly capacity = 5000) {}
  accept(message: LiveInboxMessage): boolean {
    const aliases = [message.wamid && `wamid:${message.wamid}`, message.id && `id:${message.id}`].filter(Boolean) as string[];
    if (!aliases.length && message.createdAt && message.contactPhone) aliases.push(`${message.phoneNumberId}:${message.contactPhone}:${message.createdAt}:${message.text}`);
    if (!aliases.length) return false;
    const duplicate = aliases.some(key => this.seen.has(key));
    aliases.forEach(key => this.seen.add(key));
    while (this.seen.size > this.capacity) this.seen.delete(this.seen.values().next().value!);
    return !duplicate;
  }
}
