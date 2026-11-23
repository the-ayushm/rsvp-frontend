/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { AlertCircle, Check, CheckCheck, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFailed } from "../../utils/message.utils";
import styles from "./MessageStatus.module.css";

interface MessageStatusProps {
  status?: string;
  direction?: string;
  error?: string | null;
  errorCode?: string | null;
  readAt?: any;
  deliveredAt?: any;
  failedAt?: any;
}

const PENDING = new Set(["pending", "queued", "sending", "accepted"]);

/** Delivery ticks for outgoing messages: pending · sent · delivered · read · failed */
export const MessageStatus = ({
  status,
  direction,
  error,
  errorCode,
  readAt,
  deliveredAt,
  failedAt,
}: MessageStatusProps) => {
  if (direction !== "outgoing") return null;

  const normalized = String(status || "").trim().toLowerCase();
  const isRead = normalized === "read" || !!readAt;
  const isDelivered = normalized === "delivered" || !!deliveredAt || isRead;

  if (isRead) {
    return (
      <span className={cn(styles.status, styles.read)} title="Read" aria-label="Read">
        <CheckCheck size={15} />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className={cn(styles.status, styles.delivered)} title="Delivered" aria-label="Delivered">
        <CheckCheck size={15} />
      </span>
    );
  }
  if (isFailed(status) && (error || errorCode || failedAt)) {
    return (
      <span
        className={cn(styles.status, styles.failed)}
        title={error || "Message delivery failed"}
        aria-label="Failed to deliver"
      >
        <AlertCircle size={14} />
      </span>
    );
  }
  if (PENDING.has(normalized)) {
    return (
      <span className={cn(styles.status, styles.pending)} title="Sending" aria-label="Sending">
        <Clock3 size={13} />
      </span>
    );
  }
  return (
    <span className={cn(styles.status, styles.sent)} title="Sent" aria-label="Sent">
      <Check size={15} />
    </span>
  );
};
