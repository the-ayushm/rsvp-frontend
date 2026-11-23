import assert from "node:assert/strict";
import { test } from "node:test";
import { extractInboxMessageRows, InboxMessageDeduplicator, normalizeInboxMessage } from "./inbox-realtime";

test("socket and API message shapes resolve to the same identity and customer", () => {
  const socket = normalizeInboxMessage({ id: 42, whatsappMessageId: "wamid.live", userId: "owner", contactId: "contact", contactPhone: "+14155552671", contactName: "Customer", direction: "incoming", text: "Hello", createdAt: "2026-10-22T10:00:00Z" })!;
  const api = normalizeInboxMessage({ data: { message: { id: "42", wamid: "wamid.live", user_id: "owner", contact_id: "contact", from_phone: "+14155552671", profile_name: "Customer", direction: "inbound", content: { text: { body: "Hello" } }, created_at: "2026-10-22T10:00:00Z" } } })!;
  for (const key of ["id", "wamid", "userId", "contactId", "contactPhone", "contactName", "direction", "text", "createdAt"] as const) assert.equal(socket[key], api[key], key);
});

test("owner user IDs never become contact IDs and outbound messages stay outbound", () => {
  const message = normalizeInboxMessage({ id: 1, user_id: "owner", direction: "outbound", sentBy: "customer", to_phone: "+14155552671", from_phone: "+919876543210" })!;
  assert.equal(message.userId, "owner");
  assert.equal(message.contactId, undefined);
  assert.equal(message.direction, "outgoing");
  assert.equal(message.contactPhone, "+14155552671");
  assert.equal(normalizeInboxMessage({ id: 2, text: "Ambiguous" })?.direction, "unknown");
});

test("media and interactive messages have useful notification previews", () => {
  assert.equal(normalizeInboxMessage({ id: 1, direction: "incoming", type: "image" })?.text, "[IMAGE]");
  assert.equal(normalizeInboxMessage({ id: 2, direction: "incoming", content: { interactive: { button_reply: { title: "Confirm order" } } } })?.text, "Confirm order");
  assert.equal(normalizeInboxMessage({ id: 3, timestamp: 1_700_000_000 })?.createdAt, "2023-11-14T22:13:20.000Z");
});

test("backend message envelopes and paginated results are accepted", () => {
  const rows = [{ id: 1 }];
  for (const payload of [rows, { data: rows }, { data: { data: rows } }, { data: { messages: rows } }, { messages: rows }]) assert.equal(extractInboxMessageRows(payload), rows);
  assert.deepEqual(extractInboxMessageRows({ success: false }), []);
  assert.equal(normalizeInboxMessage(null), null);
});

test("socket delivery, polling, and enriched duplicates produce only one notification", () => {
  const dedup = new InboxMessageDeduplicator();
  const message = normalizeInboxMessage({ id: 1, direction: "incoming", text: "Hello" })!;
  assert.equal(dedup.accept(message), true);
  assert.equal(dedup.accept({ ...message, wamid: "wamid.live" }), false);
  assert.equal(dedup.accept({ ...message, id: "different-db-id", wamid: "wamid.live" }), false);
  assert.equal(dedup.accept({ ...message, id: "2", wamid: "wamid.other" }), true);
});

test("repeated messages with equal timestamps remain distinct and deduplication stays bounded", () => {
  const dedup = new InboxMessageDeduplicator(3);
  const message = normalizeInboxMessage({ id: 1, direction: "incoming", created_at: "2026-10-22T10:00:00Z", text: "Hello" })!;
  assert.equal(dedup.accept(message), true);
  assert.equal(dedup.accept({ ...message, id: "2" }), true);
  assert.equal(dedup.accept({ ...message, id: "3" }), true);
  assert.equal(dedup.accept({ ...message, id: "4" }), true);
  assert.equal(dedup.accept(message), true, "oldest IDs are evicted");
});
