/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { ReactNode } from "react";
import { AlertCircle, CornerDownLeft, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "../../types/inbox.types";
import {
  cleanTemplateMetadata,
  getButtonMessageContent,
  getErrorMessage,
  hasFailureSignal,
  isFailed,
  isMyMessage,
} from "../../utils/message.utils";
import { AudioPlayer } from "../AudioPlayer";
import { MessageStatus } from "../MessageStatus";
import { TemplateMessage } from "../TemplateMessage";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  msg: Message;
  reactionEmoji?: string | null;
  outboundPhoneNumberId: string;
  /** First bubble in a run from the same sender — gets the tail + spacing */
  isGroupStart?: boolean;
  /** Stable key used by MessageList to find this row (scrolling, viewed tracking). */
  messageKey?: string;
  /** Briefly emphasised when opened from a notification. */
  highlighted?: boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const isAudioMessage = (msg: Message) =>
  msg.messageType === "audio" ||
  msg.messageType === "voice" ||
  msg.type === "audio" ||
  msg.type === "voice" ||
  msg.mediaType?.startsWith("audio/") ||
  (typeof msg.mediaUrl === "string" &&
    (msg.mediaUrl.includes("audio") ||
      msg.mediaUrl.endsWith(".mp3") ||
      msg.mediaUrl.endsWith(".ogg") ||
      msg.mediaUrl.endsWith(".wav") ||
      msg.mediaUrl.endsWith(".m4a") ||
      msg.mediaUrl.endsWith(".aac") ||
      msg.mediaUrl.endsWith(".webm") ||
      msg.mediaUrl.includes("voice_")));

/** Parse the interactive payload from the various shapes the API returns. */
const getInteractiveData = (msg: Message, messageText: string) => {
  let inter =
    msg.content?.interactive || (msg as any).interactive || (msg as any).message_data?.interactive;
  if (!inter && typeof msg.content === "string") {
    try {
      const parsed = JSON.parse(msg.content);
      inter = parsed?.interactive || parsed?.content?.interactive || parsed;
    } catch {}
  }
  if (!inter && typeof (msg as any).message_data === "string") {
    try {
      const parsed = JSON.parse((msg as any).message_data);
      inter = parsed?.interactive || parsed?.content?.interactive;
    } catch {}
  }
  const header = inter?.header;
  return {
    headerText: header?.type === "text" ? header?.text : null,
    headerImageUrl:
      header?.type === "image" ? header?.image?.link || header?.image?.url || msg.mediaUrl : null,
    bodyText: inter?.body?.text || messageText || msg.text || "",
    footerText: inter?.footer?.text,
    buttonUrl: inter?.action?.parameters?.url || inter?.action?.url,
    buttonText:
      inter?.action?.parameters?.display_text ||
      inter?.action?.parameters?.title ||
      inter?.action?.display_text ||
      inter?.action?.button ||
      "Open",
    actionButtons: (Array.isArray(inter?.action?.buttons) ? inter.action.buttons : []) as any[],
    replyTitle: inter?.button_reply?.title || inter?.list_reply?.title,
  };
};

export const MessageBubble = ({
  msg,
  reactionEmoji,
  outboundPhoneNumberId,
  isGroupStart = true,
  messageKey,
  highlighted = false,
}: MessageBubbleProps) => {
  const rawText = typeof msg.text === "string" ? msg.text : msg.text == null ? "" : String(msg.text);
  const messageText = cleanTemplateMetadata(rawText);
  const isOutgoing = isMyMessage(msg);
  const failed = isOutgoing && isFailed(msg.status) && hasFailureSignal(msg);
  const isAudio = isAudioMessage(msg);
  const time = formatTime(msg.createdAt);

  const status = (
    <MessageStatus
      status={msg.status}
      direction={msg.direction}
      error={msg.errorMessage || msg.error || null}
      errorCode={msg.errorCode || null}
      readAt={msg.readAt}
      deliveredAt={msg.deliveredAt}
      failedAt={msg.failedAt}
    />
  );

  const meta = (block = false) => (
    <span className={cn(styles.meta, block && styles.metaBlock)}>
      <span className="time">{time}</span>
      {status}
    </span>
  );

  const failure = failed ? (
    <div className={styles.error} role="alert">
      <AlertCircle size={13} className="mt-px shrink-0" />
      <span>
        <strong>Not delivered</strong>
        {msg.errorCode ? ` (#${msg.errorCode})` : ""} · {getErrorMessage(msg)}
      </span>
    </div>
  ) : null;

  let content: ReactNode;

  if (msg.isTemplate && Array.isArray(msg.templateComponents) && msg.templateComponents.length > 0) {
    // ── WhatsApp template ──
    const hasRenderableParts = msg.templateComponents.some(
      (component: any) =>
        !!component?.text ||
        (Array.isArray(component?.buttons) && component.buttons.length > 0) ||
        !!component?.example?.header_handle?.length,
    );
    content = (
      <>
        <TemplateMessage
          components={msg.templateComponents}
          mediaUrl={msg.mediaUrl}
          phoneNumberId={outboundPhoneNumberId}
          templateName={msg.templateName}
          templateLanguage={msg.templateLanguage}
          contentPayload={msg.templateContent}
        />
        {!hasRenderableParts && <span className={styles.text}>{messageText || "Template message sent"}</span>}
        {failure}
        {meta(true)}
      </>
    );
  } else if (getButtonMessageContent(msg)) {
    // ── Text with quick-reply buttons ──
    const btnContent = getButtonMessageContent(msg)!;
    content = (
      <>
        <span className={styles.text}>{btnContent.text}</span>
        {failure}
        {meta()}
        <div className={styles.actions}>
          {btnContent.buttons.map((btn: string, i: number) => (
            <span key={i} className={styles.action}>
              <CornerDownLeft size={13} />
              {btn}
            </span>
          ))}
        </div>
      </>
    );
  } else if (msg.type === "interactive") {
    // ── Interactive (CTA URL / reply buttons / list replies) ──
    const data = getInteractiveData(msg, messageText);
    const isReplyOnly = data.replyTitle && !data.buttonUrl && data.actionButtons.length === 0;
    content = (
      <>
        {data.headerImageUrl && (
          <img
            src={data.headerImageUrl}
            alt="Message header"
            className={styles.headerImage}
            onClick={() => window.open(data.headerImageUrl, "_blank")}
          />
        )}
        {data.headerText && <div className={styles.headerText}>{data.headerText}</div>}
        {isReplyOnly ? (
          <span className={styles.reply}>
            <CornerDownLeft size={14} className="opacity-70" />
            {data.replyTitle}
          </span>
        ) : (
          data.bodyText && <span className={styles.text}>{data.bodyText}</span>
        )}
        {data.footerText && <div className={styles.footerText}>{data.footerText}</div>}
        {failure}
        {meta()}
        {(data.buttonUrl || data.actionButtons.length > 0) && (
          <div className={styles.actions}>
            {data.buttonUrl && (
              <a
                href={data.buttonUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={styles.action}
              >
                <ExternalLink size={14} />
                <span className="truncate">{data.buttonText}</span>
              </a>
            )}
            {data.actionButtons.map((btn: any, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={styles.action}
              >
                <CornerDownLeft size={13} />
                <span className="truncate">{btn?.reply?.title || btn?.title || btn?.text || "Option"}</span>
              </button>
            ))}
          </div>
        )}
      </>
    );
  } else {
    // ── Text / media ──
    const hasText = !!messageText && !messageText.startsWith("[");
    const isImage = msg.messageType === "image" || msg.mediaType?.startsWith("image/");
    const isVideo = msg.messageType === "video" || msg.mediaType?.startsWith("video/");
    const audioOnly = isAudio && !!msg.mediaUrl && !hasText;

    content = (
      <>
        {msg.mediaUrl &&
          (isImage ? (
            <span className={styles.media}>
              <img src={msg.mediaUrl} alt="Shared image" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
            </span>
          ) : isVideo ? (
            <span className={styles.media}>
              <video src={msg.mediaUrl} controls />
            </span>
          ) : isAudio ? (
            <AudioPlayer
              src={msg.mediaUrl}
              timestamp={new Date(msg.createdAt)
                .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
                .toLowerCase()}
              statusComponent={status}
            />
          ) : (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className={styles.document}>
              <span className={styles.documentIcon}>
                <FileText size={17} />
              </span>
              <span className="min-w-0">
                <span className={cn(styles.documentName, "block truncate")}>Document</span>
                <span className={cn(styles.documentHint, "block")}>Click to open</span>
              </span>
            </a>
          ))}
        {hasText ? (
          <span className={styles.text}>{messageText}</span>
        ) : !msg.mediaUrl ? (
          <span className={cn(styles.text, styles.placeholder)}>
            {isOutgoing ? "Message sent" : "Message received"}
          </span>
        ) : null}
        {failure}
        {!audioOnly && meta(!hasText && !!msg.mediaUrl)}
      </>
    );
  }

  return (
    <div
      className={cn(
        styles.row,
        isOutgoing ? styles.outgoing : styles.incoming,
        isGroupStart && styles.groupStart,
        isGroupStart && styles.tail,
        failed && styles.failed,
        reactionEmoji && styles.withReaction,
        highlighted && styles.highlighted,
      )}
      data-message-key={messageKey}
      data-incoming={isOutgoing ? undefined : "true"}
    >
      <div className={styles.bubble}>
        {content}
        {reactionEmoji && (
          <span className={styles.reaction} title="Reaction">
            {reactionEmoji}
          </span>
        )}
      </div>
    </div>
  );
};
