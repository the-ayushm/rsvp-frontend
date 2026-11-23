/* eslint-disable @typescript-eslint/no-explicit-any */
import { Message } from "../types/inbox.types";

export const getMessageStableKey = (
  msg: Partial<Message> & Record<string, any>,
) => {
  const key = msg.whatsappMessageId || msg.id;
  return key != null ? String(key) : null;
};

/** Parse legacy messages stored as raw JSON (chatbot button payload bug) */
export function getButtonMessageContent(
  msg: Message,
): { text: string; buttons: string[] } | null {
  if (msg.type === "button" && Array.isArray(msg.buttons)) {
    return { text: msg.text || "", buttons: msg.buttons };
  }
  if (msg.text?.startsWith?.('{"type":"button"')) {
    try {
      const p = JSON.parse(msg.text);
      if (p.type === "button" && Array.isArray(p.buttons)) {
        return { text: p.text ?? "", buttons: p.buttons };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export const isMyMessage = (msg: Message): boolean => {
  return (
    msg.direction === "outgoing" ||
    msg.sentBy === "me" ||
    msg.sentBy === "campaign" ||
    msg.senderId === "me" ||
    msg.from === "me"
  );
};

export const cleanTemplateMetadata = (text: string): string => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(
      /^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?|Category|Status|Namespace|Template\s*ID):\s*[^\r\n]*(?:\r?\n|$))+/gim,
      "",
    )
    .replace(
      /^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?):\s*[^\s\n\r|]+(?:\s*\|\s*|\s*,\s*|\s+)?)+/gi,
      "",
    )
    .trim();
};

export const normalizeTemplateComponents = (components: any): any[] => {
  if (!Array.isArray(components)) return [];

  return components
    .map((component: any) => {
      const type = String(component?.type || "").toUpperCase();

      return {
        ...component,
        type,
        text: component?.text,
      };
    })
    .filter((component: any) => !!component.type);
};

export const extractMessageText = (message: any): string => {
  if (!message) return "";

  const directInteractive =
    message?.interactive ||
    message?.content?.interactive ||
    message?.message_data?.interactive;
  if (directInteractive) {
    const title =
      directInteractive.body?.text ||
      directInteractive.button_reply?.title ||
      directInteractive.list_reply?.title ||
      directInteractive.nfm_reply?.body ||
      "Interactive Response";
    if (title) return title;
  }

  const candidates = [
    message?.text,
    message?.body,
    message?.message,
    message?.content,
    message?.caption,
    message?.data,
    message?.payload,
    message?.message_data,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === "string") {
      const value = candidate.trim();
      if (!value) continue;

      if (
        (value.startsWith("{") && value.endsWith("}")) ||
        (value.startsWith("[") && value.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(value);
          const parsedText =
            parsed?.text?.body ||
            parsed?.text?.text ||
            parsed?.body ||
            parsed?.message?.body ||
            parsed?.message ||
            parsed?.content ||
            parsed?.caption;
          if (typeof parsedText === "string" && parsedText.trim()) {
            return parsedText.trim();
          }

          const parsedInteractive =
            parsed?.interactive || parsed?.content?.interactive;
          if (parsedInteractive) {
            const title =
              parsedInteractive.body?.text ||
              parsedInteractive.button_reply?.title ||
              parsedInteractive.list_reply?.title ||
              parsedInteractive.nfm_reply?.body ||
              "Interactive Response";
            if (title) return title;
          }
        } catch {
          return value;
        }
      }

      return value;
    }

    if (typeof candidate === "object") {
      if (candidate?.template) {
        const bodyComp = candidate.template.components?.find(
          (c: any) => String(c?.type || "").toUpperCase() === "BODY",
        );
        if (bodyComp?.text) return cleanTemplateMetadata(bodyComp.text);
      }

      const interactive = candidate?.interactive;
      if (interactive) {
        const title =
          interactive.body?.text ||
          interactive.button_reply?.title ||
          interactive.list_reply?.title ||
          interactive.nfm_reply?.body ||
          "Interactive Response";
        if (title) return title;
      }

      const nested =
        candidate?.text?.body ||
        candidate?.text?.text ||
        candidate?.body ||
        candidate?.message?.body ||
        candidate?.message ||
        candidate?.content ||
        candidate?.caption;

      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    }
  }

  return "";
};

export const getContactLastMessagePreview = (lastMessageInput: any): string => {
  if (!lastMessageInput) return "";

  let lastMessage = lastMessageInput;

  // Handle string input: could be a JSON stringified payload or plain text
  if (typeof lastMessage === "string") {
    const trimmed = lastMessage.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        lastMessage = JSON.parse(trimmed);
      } catch {
        return cleanTemplateMetadata(trimmed);
      }
    } else {
      return cleanTemplateMetadata(trimmed);
    }
  }

  if (!lastMessage || typeof lastMessage !== "object") {
    return cleanTemplateMetadata(String(lastMessage || ""));
  }

  // Parse inner content if it is stringified JSON
  let content = lastMessage?.content;
  if (typeof content === "string") {
    const trimmedContent = content.trim();
    if (
      (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) ||
      (trimmedContent.startsWith("[") && trimmedContent.endsWith("]"))
    ) {
      try {
        content = JSON.parse(trimmedContent);
      } catch {}
    }
  }

  // Determine type
  const type = String(
    lastMessage?.type ||
      lastMessage?.lastMessageType ||
      lastMessage?.message_type ||
      lastMessage?.messageType ||
      content?.type ||
      "",
  ).toLowerCase();

  switch (type) {
    case "template": {
      const templateName =
        lastMessage?.template?.name ||
        lastMessage?.template_name ||
        lastMessage?.templateName ||
        content?.template?.name ||
        content?.template_name ||
        content?.templateName ||
        lastMessage?.name;

      if (templateName) return String(templateName);

      const components =
        lastMessage?.template?.components || content?.template?.components;
      if (Array.isArray(components)) {
        const bodyComp = components.find(
          (c: any) => String(c?.type || "").toUpperCase() === "BODY",
        );
        if (bodyComp?.text) return cleanTemplateMetadata(bodyComp.text);
      }

      return "Template";
    }

    case "text": {
      const textVal =
        content?.text?.body ||
        content?.text?.text ||
        content?.text ||
        lastMessage?.text?.body ||
        lastMessage?.text?.text ||
        lastMessage?.text ||
        lastMessage?.body ||
        lastMessage?.message;

      if (typeof textVal === "string") {
        const trimmed = textVal.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            return getContactLastMessagePreview(JSON.parse(trimmed));
          } catch {}
        }
        return cleanTemplateMetadata(trimmed);
      }
      return "";
    }

    case "interactive": {
      let interactive =
        content?.interactive ||
        lastMessage?.interactive ||
        content?.message_data?.interactive ||
        lastMessage?.message_data?.interactive;

      if (typeof interactive === "string") {
        try {
          interactive = JSON.parse(interactive);
        } catch {}
      }

      const bodyText =
        interactive?.body?.text ||
        interactive?.button_reply?.title ||
        interactive?.list_reply?.title ||
        interactive?.nfm_reply?.body ||
        interactive?.header?.text;

      return bodyText ? String(bodyText).trim() : "Interactive message";
    }

    case "image": {
      const image = content?.image || lastMessage?.image;
      const caption =
        image?.caption || content?.caption || lastMessage?.caption;

      return caption ? String(caption).trim() : "📷 Photo";
    }

    case "video": {
      const video = content?.video || lastMessage?.video;
      const caption =
        video?.caption || content?.caption || lastMessage?.caption;

      return caption ? String(caption).trim() : "🎥 Video";
    }

    case "document": {
      const doc = content?.document || lastMessage?.document;
      const filename =
        doc?.filename ||
        doc?.name ||
        content?.filename ||
        lastMessage?.filename;

      return filename ? `📄 ${filename}` : "📄 Document";
    }

    case "audio":
      return "🎵 Audio";

    case "sticker":
      return "🎭 Sticker";

    case "location":
      return "📍 Location";

    case "contacts":
      return "👤 Contact";

    default: {
      if (content?.template || lastMessage?.template) {
        return getContactLastMessagePreview({
          type: "template",
          ...lastMessage,
          content,
        });
      }
      if (content?.interactive || lastMessage?.interactive) {
        return getContactLastMessagePreview({
          type: "interactive",
          ...lastMessage,
          content,
        });
      }
      if (content?.image || lastMessage?.image) {
        return getContactLastMessagePreview({
          type: "image",
          ...lastMessage,
          content,
        });
      }
      if (content?.video || lastMessage?.video) {
        return getContactLastMessagePreview({
          type: "video",
          ...lastMessage,
          content,
        });
      }
      if (content?.document || lastMessage?.document) {
        return getContactLastMessagePreview({
          type: "document",
          ...lastMessage,
          content,
        });
      }
      if (content?.audio || lastMessage?.audio) {
        return "🎵 Audio";
      }
      if (content?.sticker || lastMessage?.sticker) {
        return "🎭 Sticker";
      }
      if (content?.text || lastMessage?.text || lastMessage?.body) {
        return getContactLastMessagePreview({
          type: "text",
          ...lastMessage,
          content,
        });
      }

      const fallback = extractMessageText(lastMessage);
      if (fallback) {
        const trimmed = fallback.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            return getContactLastMessagePreview(JSON.parse(trimmed));
          } catch {}
        }
        return cleanTemplateMetadata(trimmed);
      }
      return "";
    }
  }
};

// Format preview text for media messages and raw JSON strings
export const formatPreviewText = (text: string): string => {
  if (!text) return text;

  if (typeof text === "string") {
    const trimmed = text.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const parsedPreview = getContactLastMessagePreview(parsed);
        if (parsedPreview) return parsedPreview;
      } catch {}
    }
  }

  // Replace media type placeholders with emoji indicators
  const mediaFormats: Record<string, string> = {
    "[IMAGE]": "📷 Photo",
    "[VIDEO]": "🎥 Video",
    "[AUDIO]": "🎵 Audio",
    "[DOCUMENT]": "📄 Document",
    "[STICKER]": "🎭 Sticker",
    "Sent a image": "📷 Photo",
    "Sent a video": "🎥 Video",
    "Sent a audio": "🎵 Audio",
    "Sent a document": "📄 Document",
    "Sent a sticker": "🎭 Sticker",
  };

  for (const [pattern, replacement] of Object.entries(mediaFormats)) {
    if (text.includes(pattern) || text === pattern) {
      return text.replace(pattern, replacement);
    }
  }

  const cleaned = cleanTemplateMetadata(text);
  return cleaned || "Template message";
};

export const getDateGroupLabel = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDate = new Date(date);
  msgDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return msgDate.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: msgDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

export const isFailed = (s?: string) => {
  const normalized = String(s || "")
    .trim()
    .toLowerCase();
  return normalized === "failed";
};

export const hasFailureSignal = (msg: Message) =>
  Boolean(
    msg.errorMessage ||
      msg.error ||
      msg.errorCode ||
      (msg as any).failedAt ||
      (msg as any).failed_at,
  );

export const getErrorMessage = (msg: Message) => {
  if (msg.errorMessage) return msg.errorMessage;
  if (msg.error) {
    try {
      const parsed = JSON.parse(msg.error);
      return (
        parsed?.message ||
        parsed?.error_user_msg ||
        parsed?.error_user_title ||
        msg.error
      );
    } catch {
      return msg.error;
    }
  }
  return "Message delivery failed";
};
