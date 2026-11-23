/* eslint-disable @typescript-eslint/no-explicit-any */
import { Contact } from "../types/inbox.types";
import {
  removePlusPrefix,
  getLast10Digits,
  normalizeLeadNumber,
  isSamePhoneValue,
  createStableContactId,
} from "./phone.utils";
import {
  getContactLastMessagePreview,
  cleanTemplateMetadata,
} from "./message.utils";

export const isPhoneNumberName = (name?: string | null): boolean => {
  if (!name) return false;
  const cleaned = name.trim().replace(/[\s\-\(\)]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned);
};

/** Real contacts-table UUID, or null for synthetic sidebar entries (socket/URL-created). */
export const getBackendContactId = (contact: Contact): string | null =>
  contact.rawContactId ||
  (typeof contact.id === "string" && contact.id.length > 20 ? contact.id : null);

/** assigned_to stores users.id; team invite rows expose it as user_id (their own id is the invite id). */
export const getMemberUserId = (member: any): string | null =>
  member?.user_id ? String(member.user_id) : null;

export const buildInitials = (name?: string | null) => {
  if (!name) return "NA";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export const isReminderActive = (reminder: any) => {
  if (!reminder.startDate) return false;

  // Build reminder datetime
  const reminderDate = new Date(reminder.startDate);

  if (reminder.startTime) {
    const [hours, minutes] = reminder.startTime.split(":").map(Number);
    reminderDate.setHours(hours, minutes, 0, 0);
  } else {
    // If no time provided, assume end of day
    reminderDate.setHours(23, 59, 59, 999);
  }

  // Compare with now
  return reminderDate.getTime() > Date.now();
};

export const mapContactsForSidebar = (
  items: any[],
  idSeed: string,
): Contact[] => {
  const latestByPhone = new Map<string, { leadPhone: string; item: any }>();

  for (const item of items) {
    let rawPhone =
      item?.contact_phone ||
      item?.contactPhone ||
      item?.phone_number ||
      item?.phone ||
      item?.leadNumber ||
      item?.lead_number ||
      item?.contact_number;
    if (!rawPhone) {
      if (item?.direction === "inbound") {
        rawPhone = item?.from_phone || item?.from || item?.sender;
      } else if (item?.direction === "outbound") {
        rawPhone = item?.to_phone || item?.to || item?.recipient;
      } else {
        // Fallback if direction is unknown
        const toPh = String(item?.to_phone || item?.to || "").replace(
          /\D/g,
          "",
        );
        const seedDigits = String(idSeed || "").replace(/\D/g, "");
        if (seedDigits && toPh.endsWith(seedDigits.slice(-10))) {
          rawPhone = item?.from_phone || item?.from;
        } else {
          rawPhone =
            item?.to_phone || item?.to || item?.from_phone || item?.from;
        }
      }
    }

    const phoneKey = getLast10Digits(rawPhone);
    if (!phoneKey) continue;
    const leadPhone = normalizeLeadNumber(rawPhone);

    const current = latestByPhone.get(phoneKey);
    const incomingTime = new Date(
      item?.created_at ||
        item?.updated_at ||
        item?.createdAt ||
        item?.updatedAt ||
        0,
    ).getTime();
    const currentTime = new Date(
      current?.item?.created_at ||
        current?.item?.updated_at ||
        current?.item?.createdAt ||
        current?.item?.updatedAt ||
        0,
    ).getTime();

    if (!current || incomingTime >= currentTime) {
      const mergedItem = { ...item };
      // Preserve valid status/stage from older record if newer item has null/empty status
      const existingStatus =
        current?.item?.status ||
        current?.item?.stage ||
        current?.item?.pipelineStage ||
        current?.item?.pipeline_stage;
      const incomingStatus =
        item?.status ||
        item?.stage ||
        item?.pipelineStage ||
        item?.pipeline_stage;
      if (!incomingStatus && existingStatus) {
        mergedItem.status = existingStatus;
        mergedItem.stage = existingStatus;
      }
      const existingRawContactId =
        current?.item?.rawContactId || current?.item?.id;
      const incomingRawContactId = item?.rawContactId || item?.id;
      if (!incomingRawContactId && existingRawContactId) {
        mergedItem.rawContactId = existingRawContactId;
      }
      const existingEmail = current?.item?.email;
      const incomingEmail = item?.email;
      if (!incomingEmail && existingEmail) {
        mergedItem.email = existingEmail;
      }
      const existingAttrs =
        current?.item?.attributes || current?.item?.custom_fields;
      const incomingAttrs = item?.attributes || item?.custom_fields;
      if (!incomingAttrs && existingAttrs) {
        mergedItem.attributes = existingAttrs;
        mergedItem.custom_fields = existingAttrs;
      }
      latestByPhone.set(phoneKey, { leadPhone, item: mergedItem });
    } else {
      // Incoming item is older, but check if current record is missing status and incoming has status
      const existingStatus =
        current.item?.status ||
        current.item?.stage ||
        current.item?.pipelineStage ||
        current.item?.pipeline_stage;
      const incomingStatus =
        item?.status ||
        item?.stage ||
        item?.pipelineStage ||
        item?.pipeline_stage;
      if (!existingStatus && incomingStatus) {
        current.item.status = incomingStatus;
        current.item.stage = incomingStatus;
      }
      const existingRawContactId =
        current.item?.rawContactId || current.item?.id;
      const incomingRawContactId = item?.rawContactId || item?.id;
      if (!existingRawContactId && incomingRawContactId) {
        current.item.rawContactId = incomingRawContactId;
      }
      const existingEmail = current.item?.email;
      const incomingEmail = item?.email;
      if (!existingEmail && incomingEmail) {
        current.item.email = incomingEmail;
      }
      const existingAttrs =
        current.item?.attributes || current.item?.custom_fields;
      const incomingAttrs = item?.attributes || item?.custom_fields;
      if (!existingAttrs && incomingAttrs) {
        current.item.attributes = incomingAttrs;
        current.item.custom_fields = incomingAttrs;
      }
    }
  }

  return Array.from(latestByPhone.values()).map(
    ({ leadPhone, item }, index) => {
      const displayLeadPhone = removePlusPrefix(leadPhone);
      const fallbackName =
        item?.contact_name ||
        item?.contactName ||
        item?.name ||
        displayLeadPhone;
      const displayName = isSamePhoneValue(fallbackName, displayLeadPhone)
        ? displayLeadPhone
        : String(fallbackName || displayLeadPhone);

      // Use the real backend contact ID (UUID string) when available;
      // fall back to a synthetic stable hash only for conversation-sourced items.
      const realBackendId =
        (typeof item?.id === "string" && item.id.length > 20
          ? item.id
          : null) ||
        item?.rawContactId ||
        item?.contactId ||
        null;

      return {
        id:
          realBackendId ||
          createStableContactId(`${idSeed}-${leadPhone || "unknown"}-${index}`),
        name: displayName,
        phone: displayLeadPhone || null,
        country_code:
          item?.country_code || item?.last_message?.country_code || null,
        phone_number_id:
          item?.phone_number_id || item?.phoneNumberId || null,
        initials: buildInitials(displayName),
        lastMessagePreview:
          getContactLastMessagePreview(item?.last_message) ||
          getContactLastMessagePreview(item?.lastMessageContent) ||
          getContactLastMessagePreview(item?.last_message_content) ||
          getContactLastMessagePreview(item?.lastMessage) ||
          getContactLastMessagePreview({
            type: item?.lastMessageType || item?.type,
            content:
              item?.lastMessageContent ||
              item?.last_message_content ||
              item?.content,
          }) ||
          getContactLastMessagePreview(item?.lastMessagePreview) ||
          cleanTemplateMetadata(
            item?.lastMessageContent ||
              item?.last_message_content ||
              item?.lastMessagePreview ||
              "",
          ) ||
          null,
        // Both come from the latest message's created_at; receipts don't move it.
        lastMessageTime:
          item?.last_message?.timestamp ||
          item?.last_message_at ||
          item?.last_message?.sent_at ||
          item?.last_message?.created_at ||
          item?.created_at ||
          item?.updated_at ||
          item?.createdAt ||
          item?.updatedAt ||
          null,
        readStatus:
          item?.read_status === "read" || item?.read_status === "unread"
            ? item.read_status
            : null,
        unreadCount: Number(item?.unread_count ?? item?.unreadCount ?? 0),
        lastMessageWamid: item?.last_message?.wamid || null,
        tags: Array.isArray(item?.tags)
          ? item.tags.map((t: any) => String(t?.id ?? t))
          : Array.isArray(item?.tag_ids)
            ? item.tag_ids.map(String)
            : [],
        lastInboundAt: item?.lastInboundAt || item?.last_inbound_at || null,
        direction:
          item?.last_message?.direction ||
          item?.direction ||
          item?.lastMessageDirection,
        lastMessageStatus:
          item?.last_message?.status || item?.lastMessageStatus || item?.last_message_status,
        lastMessageReadAt: item?.last_message?.read_at || item?.last_message?.readAt || null,
        lastMessageDeliveredAt:
          item?.last_message?.delivered_at || item?.last_message?.deliveredAt || null,
        assigned_to: Array.isArray(item?.assigned_to)
          ? item.assigned_to
          : item?.assigned_to
            ? [item.assigned_to]
            : null,
        status:
          item?.status ||
          item?.stage ||
          item?.pipelineStage ||
          item?.pipeline_stage ||
          null,
        stage:
          item?.stage ||
          item?.status ||
          item?.pipelineStage ||
          item?.pipeline_stage ||
          null,
        rawContactId:
          (typeof item?.id === "string" && item.id.length > 20
            ? item.id
            : null) ||
          item?.rawContactId ||
          item?.contactId ||
          null,
        email: item?.email || null,
        attributes:
          typeof item?.attributes === "object" && item?.attributes !== null
            ? item.attributes
            : {},
        custom_fields:
          typeof item?.custom_fields === "object" &&
          item?.custom_fields !== null
            ? item.custom_fields
            : {},
      };
    },
  );
};
