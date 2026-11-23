/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo } from "react";
import { BellRing, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Checkbox from "@/components/ui/Checkbox";
import { ContactItemProps } from "../../types/inbox.types";
import { isPhoneNumberName } from "../../utils/contact.utils";
import { formatPreviewText } from "../../utils/message.utils";
import { MessageStatus } from "../MessageStatus";
import styles from "./ConversationItem.module.css";

interface ConversationItemProps extends ContactItemProps {
  contactTags?: any[];
  /** Backend contact id used for bulk selection; null when the contact can't be assigned. */
  selectionId?: string | null;
  isChecked?: boolean;
  onToggleCheck?: (selectionId: string) => void;
}

/** WhatsApp-style list timestamp: time today, "Yesterday", weekday, or date. */
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (days <= 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

const MAX_TAGS = 2;

export const ConversationItem = memo(function ConversationItem({
  contact,
  isSelected,
  onClick,
  reminders = [],
  contactTags = [],
  selectionId = null,
  isChecked = false,
  onToggleCheck,
}: ConversationItemProps) {
  // Inbox state comes from the API, not from the last message's receipt or direction.
  const unread = contact.readStatus
    ? contact.readStatus === "unread"
    : (contact.unreadCount ?? 0) > 0;
  const direction = String(contact.direction || "").toLowerCase();
  const lastWasOutgoing = direction === "outbound" || direction === "outgoing";
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  const tagNames = tags.map((tid: any) => {
    const tagObj = (contactTags as any[]).find((t) => String(t.id) === String(tid));
    return tagObj?.name || String(tid);
  });

  return (
    <div className={cn(styles.row, isSelected && styles.selected, isChecked && styles.checked)}>
      {onToggleCheck && (
        <label
          className={styles.check}
          title={selectionId ? undefined : "This chat isn't saved as a contact yet and can't be assigned"}
        >
          <Checkbox
            checked={isChecked}
            disabled={!selectionId}
            onChange={() => selectionId && onToggleCheck(selectionId)}
            aria-label={`Select chat with ${contact.name}`}
          />
        </label>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-current={isSelected ? "true" : undefined}
        className={cn(styles.item, onToggleCheck && styles.withCheck, unread && styles.unread, "contact-item")}
      >
        <Avatar
          size="lg"
          name={contact.name}
          fallback={isPhoneNumberName(contact.name) ? <User size={20} /> : undefined}
        />

        <span className={styles.body}>
          <span className={styles.line}>
            <span className={styles.name}>{contact.name}</span>
            {contact.lastMessageTime && <span className={styles.time}>{formatListTime(contact.lastMessageTime)}</span>}
          </span>

          <span className={styles.line}>
            <span className={styles.preview}>
              {lastWasOutgoing && contact.lastMessagePreview && (
                <MessageStatus
                  status={contact.lastMessageStatus}
                  direction="outgoing"
                  readAt={contact.lastMessageReadAt}
                  deliveredAt={contact.lastMessageDeliveredAt}
                />
              )}
              <span>
                {contact.lastMessagePreview ? formatPreviewText(contact.lastMessagePreview) : contact.phone || ""}
              </span>
            </span>
            {reminders.length > 0 && (
              <span
                className={styles.reminderDot}
                title={`${reminders.length} scheduled reminder${reminders.length > 1 ? "s" : ""}`}
              >
                <BellRing size={13} />
              </span>
            )}
            {unread && (contact.unreadCount ?? 0) > 0 && (
              <span className={styles.badge} aria-label={`${contact.unreadCount} unread messages`}>
                {(contact.unreadCount ?? 0) > 99 ? "99+" : contact.unreadCount}
              </span>
            )}
          </span>

          {tagNames.length > 0 && (
            <span className={styles.tags}>
              {tagNames.slice(0, MAX_TAGS).map((name, i) => (
                <span key={`${name}-${i}`} className={styles.tag}>
                  {name}
                </span>
              ))}
              {tagNames.length > MAX_TAGS && <span className={styles.tag}>+{tagNames.length - MAX_TAGS}</span>}
            </span>
          )}
        </span>
      </button>
    </div>
  );
});
