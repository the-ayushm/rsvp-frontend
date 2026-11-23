import assert from "node:assert/strict";
import { test } from "node:test";
import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessagesPage } from "../types/inbox.types";
import { appendMessageToPages, applyMessageStatus, mergeMessagePages, mergeLatestMessagePage } from "./message-pages.utils";

const message = (id: number, status = "sent"): Message => ({
  id,
  contactId: "contact",
  whatsappMessageId: `wamid.${id}`,
  createdAt: new Date(1_700_000_000_000 + id * 1000).toISOString(),
  direction: "outgoing",
  status,
  text: `Message ${id}`,
});

const history = (): InfiniteData<MessagesPage> => ({
  pages: [
    { messages: [message(4), message(3)], nextPage: 2 },
    { messages: [message(2), message(1)] },
  ],
  pageParams: [1, 2],
});

test("newest-first API pages render oldest to newest without losing earlier messages", () => {
  assert.deepEqual(mergeMessagePages(history().pages).map((item) => item.id), [1, 2, 3, 4]);
});

test("overlapping pages do not duplicate bubbles or overwrite the newest server status", () => {
  const merged = mergeMessagePages([
    { messages: [message(3, "read"), message(2, "read")] },
    { messages: [message(2, "sent"), message(1)] },
  ]);
  assert.deepEqual(merged.map((item) => item.id), [1, 2, 3]);
  assert.equal(merged[1].status, "read");
});

test("sending appends to the newest page while preserving older history and pagination", () => {
  const original = history();
  const updated = appendMessageToPages(original, message(5))!;
  assert.deepEqual(mergeMessagePages(updated.pages).map((item) => item.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(updated.pageParams, [1, 2]);
  assert.equal(updated.pages[0].nextPage, 2);
  assert.equal(original.pages[0].messages.length, 2);
  assert.equal(appendMessageToPages(original, message(1)), original);
  assert.equal(appendMessageToPages(undefined, message(1)), undefined);
});

test("backend read receipts update a message on an older page without changing other messages", () => {
  const original = history();
  const updated = applyMessageStatus(original, "wamid.1", " READ ")!;
  assert.equal(updated.pages[1].messages[1].status, "read");
  assert.equal(updated.pages[0].messages[0].status, "sent");
  assert.equal(original.pages[1].messages[1].status, "sent");
});

test("late delivered receipts do not regress blue read ticks", () => {
  const read = applyMessageStatus(history(), "wamid.1", "read")!;
  const lateDelivery = applyMessageStatus(read, "wamid.1", "delivered")!;
  assert.equal(lateDelivery.pages[1].messages[1].status, "read");
});

test("backend delivery failures still update a previously sent message", () => {
  const failed = applyMessageStatus(history(), "wamid.1", "failed")!;
  assert.equal(failed.pages[1].messages[1].status, "failed");
});

test("live first-page refresh preserves history and picks up new messages and newer receipts", () => {
  const original = history();
  const updated = mergeLatestMessagePage(original, { messages: [message(5), message(4, "read")], nextPage: 2 })!;
  assert.deepEqual(mergeMessagePages(updated.pages).map(item => item.id), [1, 2, 3, 4, 5]);
  assert.equal(mergeMessagePages(updated.pages).find(item => item.id === 4)?.status, "read");
  assert.equal(updated.pages[1], original.pages[1]);
  assert.deepEqual(updated.pageParams, [1, 2]);
  assert.equal(original.pages[0].messages.length, 2);
});
