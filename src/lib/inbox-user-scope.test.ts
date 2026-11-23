import assert from "node:assert/strict";
import { test } from "node:test";
import { getInboxMessageUserId, inboxMessageBelongsToUser, normalizeInboxUserId } from "./inbox-user-scope";
import { normalizeInboxMessage } from "./inbox-realtime";
import { emitScopedSocketEvent } from "./socket-event-scope";

test("notifications require an exact owner match, including numeric and UUID user IDs", () => {
  assert.equal(inboxMessageBelongsToUser({ user_id: 123 }, "123"), true);
  assert.equal(inboxMessageBelongsToUser({ userId: " 123 " }, 123), true);
  assert.equal(inboxMessageBelongsToUser({ owner_user_id: "user-uuid-a" }, "user-uuid-a"), true);
  assert.equal(inboxMessageBelongsToUser({ user_id: "user-uuid-b" }, "user-uuid-a"), false);
  assert.equal(inboxMessageBelongsToUser({ user_id: 1234 }, 123), false);
});

test("ownerless, invalid, and conflicting IDs never authorize a notification", () => {
  for (const payload of [null, {}, { id: 123 }, { contact_id: 123 }, { user_id: null }, { user_id: "" }, { user_id: false }, { user_id: 0 }, { user_id: "0" }, { user_id: 123, userId: 456 }]) {
    assert.equal(inboxMessageBelongsToUser(payload, 123), false, JSON.stringify(payload));
    assert.equal(normalizeInboxMessage(payload)?.userId, undefined);
  }
  for (const current of [null, undefined, false, "", 0]) assert.equal(inboxMessageBelongsToUser({ user_id: 123 }, current), false);
  assert.equal(normalizeInboxUserId(Number.MAX_SAFE_INTEGER + 1), null);
});

test("nested socket envelopes resolve ownership and reject disagreements across envelope levels", () => {
  assert.equal(inboxMessageBelongsToUser({ data: { message: { user_id: 123 } } }, 123), true);
  assert.equal(inboxMessageBelongsToUser({ user_id: 123, data: { message: { userId: "123" } } }, 123), true);
  assert.equal(getInboxMessageUserId({ user_id: 123, data: { message: { user_id: 456 } } }), null);
  assert.equal(getInboxMessageUserId({ user_id: 123, data: { user_id: null } }), null);
});

test("foreign deliveries cannot consume the real owner's notification identity", () => {
  const foreign = { id: 1, wamid: "wamid.shared", direction: "inbound", user_id: "other" };
  assert.equal(inboxMessageBelongsToUser(foreign, "current"), false);
  assert.equal(inboxMessageBelongsToUser({ ...foreign, user_id: "current" }, "current"), true);
});

test("private events target one owner's room and never fall back to broadcast", () => {
  const deliveries: { room: string | null; event: string; data: unknown }[] = [];
  const server = {
    to: (room: string) => ({ emit: (event: string, data: unknown) => { deliveries.push({ room, event, data }); } }),
    emit: (event: string, data: unknown) => { deliveries.push({ room: null, event, data }); },
  } as unknown as Parameters<typeof emitScopedSocketEvent>[0];
  assert.equal(emitScopedSocketEvent(server, "new_message", { user_id: "123", text: "Private" }), true);
  assert.equal(emitScopedSocketEvent(server, "new_message", { userId: 456, text: "Other private" }), true);
  for (const event of ["new_message", "message_status_update"]) {
    assert.equal(emitScopedSocketEvent(server, event, {}), false);
    assert.equal(emitScopedSocketEvent(server, event, { user_id: 123, userId: 456 }), false);
  }
  assert.deepEqual(deliveries.map(item => item.room), ["user_123", "user_456"]);
  assert.equal(emitScopedSocketEvent(server, "message_status_update", { user_id: 123, wamid: "wamid.1", status: "read" }), true);
  assert.equal(deliveries.at(-1)?.room, "user_123");
});
