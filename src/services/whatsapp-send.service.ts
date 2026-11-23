/**
 * Central service for sending WhatsApp text and media.
 * Use from API routes, chatbot (worker), or any other feature so all sends go through one place.
 * Pass optional database when calling from the worker.
 */

import { database as defaultDatabase } from "../lib/database";

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

type DatabaseLike = typeof defaultDatabase;

export interface SendTextOptions {
  userId: number;
  toPhone: string;
  text: string;
  /** When provided, a Message record is created (conversation thread). */
  contactId?: number;
  conversationId?: string;
  /** Origin: "me" | "chatbot" | "business" | etc. Default "me". */
  sentBy?: string;
}

export interface SendMediaOptions {
  userId: number;
  toPhone: string;
  /** Optional text message sent first. */
  text?: string;
  /** Media items: image, document, video, audio. */
  images: Array<{
    type: string;
    url?: string;
    caption?: string;
    galleryMediaId?: number;
    filename?: string;
  }>;
  contactId?: number;
  conversationId?: string;
  sentBy?: string;
}

export interface SendResult {
  whatsappMessageId?: string;
  message?: { id: string; createdAt: Date; status: string; text: string };
}

/** Meta interactive payload: list (sections with rows) or button (up to 3 reply buttons). */
export interface SendInteractiveOptions {
  userId: number;
  toPhone: string;
  /** interactive object per Meta: { type: "list"|"button", header?, body, footer?, action } */
  interactive: Record<string, unknown>;
  contactId?: number;
  conversationId?: string;
  sentBy?: string;
}

/**
 * Options for sending a WhatsApp Flow (interactive type "flow").
 * @see https://developers.facebook.com/docs/whatsapp/flows/guides/sendingaflow
 */
export interface SendFlowOptions {
  userId: number;
  toPhone: string;
  /** Meta Flow ID (from Flows API create response) or flow name */
  flowId?: string;
  flowName?: string;
  /** Button label, e.g. "Book appointment" (max ~30 chars, no emoji) */
  flowCta: string;
  /** Optional header text */
  header?: string;
  /** Body text shown above the CTA */
  body?: string;
  /** Footer text */
  footer?: string;
  /** Flow token for your backend to identify the session; default "unused" */
  flowToken?: string;
  /** "navigate" (default) or "data_exchange" */
  flowAction?: "navigate" | "data_exchange";
  /** For navigate: screen id and optional data for first screen */
  flowActionPayload?: { screen?: string; data?: Record<string, unknown> };
  contactId?: number;
  conversationId?: string;
  sentBy?: string;
}

async function getAccount(db: DatabaseLike, userId: number) {
  const config = await db.whatsAppAccount.findFirst({
    where: { userId, isActive: true },
  });
  if (!config) throw new Error(`No active WhatsApp account for user ${userId}`);
  return config;
}

/**
 * Send a text message via WhatsApp. Optionally creates a Message record when contactId + conversationId are provided.
 */
export async function sendText(
  options: SendTextOptions,
  databaseInstance?: DatabaseLike,
): Promise<SendResult> {
  const { userId, toPhone, text, contactId, conversationId, sentBy } = options;
  const db = databaseInstance ?? defaultDatabase;

  const account = await getAccount(db, userId);
  const url = `https://graph.facebook.com/${account.apiVersion || "v22.0"}/${account.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone(toPhone),
      type: "text",
      text: { body: text },
    }),
  });

  const data = await response.json();
  const whatsappMessageId = data?.messages?.[0]?.id as string | undefined;
  const sendSuccess = response.ok;

  if (!sendSuccess) {
    console.error("[WhatsAppSendService.sendText] API error:", data);
    throw new Error(
      data?.error?.message || "Failed to send text via WhatsApp.",
    );
  }

  if (contactId != null && conversationId) {
    const message = await db.message.create({
      data: {
        conversationId,
        contactId,
        userId,
        text,
        content: text,
        direction: "outgoing",
        sentBy: sentBy ?? "me",
        status: "SEND",
        sentAt: new Date(),
        whatsappMessageId: whatsappMessageId ?? undefined,
      } as any,
    });
    return {
      whatsappMessageId,
      message: {
        id: String(message.id),
        createdAt: message.createdAt,
        status: message.status,
        text: message.text,
      },
    };
  }

  return { whatsappMessageId };
}

/**
 * Send text (optional) + one or more media items. Optionally creates a Message record when contactId + conversationId are provided.
 */
export async function sendMedia(
  options: SendMediaOptions,
  databaseInstance?: DatabaseLike,
): Promise<SendResult> {
  const { userId, toPhone, text, images, contactId, conversationId, sentBy } =
    options;
  const db = databaseInstance ?? defaultDatabase;

  const account = await getAccount(db, userId);
  const baseUrl = `https://graph.facebook.com/${account.apiVersion || "v22.0"}/${account.phoneNumberId}/messages`;
  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    "Content-Type": "application/json",
  };
  let firstId: string | undefined;

  if (text && text.trim()) {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone(toPhone),
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (res.ok) firstId = data?.messages?.[0]?.id;
    else
      console.error("[WhatsAppSendService.sendMedia] text send error:", data);
  }

  // Resolve gallery media IDs to public URLs; Meta expects either link (URL) or id (WhatsApp-uploaded media ID).
  // galleryMediaId is our app's Media table ID, not a WhatsApp media ID — always use link.
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const resolveMediaUrl = async (
    galleryMediaId: number,
  ): Promise<string | null> => {
    const media = await db.media.findFirst({
      where: { id: galleryMediaId, userId },
    });
    if (!media?.url) return null;
    const path = media.url.startsWith("/") ? media.url : `/${media.url}`;
    return appBaseUrl ? `${appBaseUrl}${path}` : null;
  };

  let firstSentMediaUrl: string | undefined;
  let firstSentMediaType: string | undefined;

  for (const img of images || []) {
    let mediaUrl = img.url;
    if (!mediaUrl && img.galleryMediaId != null) {
      mediaUrl =
        (await resolveMediaUrl(Number(img.galleryMediaId))) || undefined;
      if (!mediaUrl) {
        console.warn(
          "[WhatsAppSendService.sendMedia] Gallery media not found or no base URL:",
          img.galleryMediaId,
        );
        continue;
      }
    }
    // Meta link must be a full URL; normalize relative paths
    if (mediaUrl && mediaUrl.startsWith("/") && appBaseUrl)
      mediaUrl = `${appBaseUrl}${mediaUrl}`;
    const type = (img.type || "image").toLowerCase();
    const body: any = {
      messaging_product: "whatsapp",
      to: cleanPhone(toPhone),
      type,
    };
    if (type === "image") {
      body.image = mediaUrl
        ? { link: mediaUrl, caption: img.caption || undefined }
        : undefined;
    } else if (type === "document") {
      body.document = mediaUrl
        ? { link: mediaUrl, caption: img.caption, filename: img.filename }
        : undefined;
    } else if (type === "video" || type === "audio") {
      body[type] = mediaUrl
        ? { link: mediaUrl, caption: img.caption }
        : undefined;
    }
    if (!body.image && !body.document && !body.video && !body.audio) continue;
    const res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      if (!firstId) firstId = data?.messages?.[0]?.id;
      if (firstSentMediaUrl === undefined) {
        firstSentMediaUrl = mediaUrl;
        firstSentMediaType = type;
      }
    } else if (!res.ok)
      console.error("[WhatsAppSendService.sendMedia] media send error:", data);
  }

  if (contactId != null && conversationId) {
    const firstImg = images?.[0] as { caption?: string } | undefined;
    const displayText =
      text?.trim() ||
      firstImg?.caption ||
      (firstSentMediaUrl ? "" : "Media") ||
      "Media";
    const savedMediaUrl =
      firstSentMediaUrl ?? (images?.[0] as any)?.url ?? undefined;
    const savedMediaType =
      firstSentMediaType ?? (images?.[0] as any)?.type ?? "image";
    const message = await db.message.create({
      data: {
        conversationId,
        contactId,
        userId,
        text: displayText || "Media",
        content: displayText || "Media",
        direction: "outgoing",
        sentBy: sentBy ?? "me",
        status: "SEND",
        sentAt: new Date(),
        whatsappMessageId: firstId ?? undefined,
        mediaUrl: savedMediaUrl,
        mediaType: savedMediaType,
        messageType: savedMediaUrl ? savedMediaType || "image" : "text",
      } as any,
    });
    return {
      whatsappMessageId: firstId,
      message: {
        id: String(message.id),
        createdAt: message.createdAt,
        status: message.status,
        text: message.text,
      },
    };
  }

  return { whatsappMessageId: firstId };
}

/**
 * Send an interactive message (list or reply buttons) per Meta Cloud API.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#interactive-object
 */
export async function sendInteractive(
  options: SendInteractiveOptions,
  databaseInstance?: DatabaseLike,
): Promise<SendResult> {
  const { userId, toPhone, interactive, contactId, conversationId, sentBy } =
    options;
  const db = databaseInstance ?? defaultDatabase;

  const account = await getAccount(db, userId);
  const url = `https://graph.facebook.com/${account.apiVersion || "v22.0"}/${account.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone(toPhone),
      type: "interactive",
      interactive,
    }),
  });

  const data = await response.json();
  const whatsappMessageId = data?.messages?.[0]?.id as string | undefined;
  if (!response.ok) {
    console.error("[WhatsAppSendService.sendInteractive] API error:", data);
    throw new Error(
      data?.error?.message || "Failed to send interactive message.",
    );
  }

  const displayText = (interactive as any)?.body?.text || "Interactive message";
  const action = (interactive as any)?.action;
  const buttonTitles: string[] = (() => {
    const t = String((interactive as any)?.type || "");

    if (t === "button" && Array.isArray(action?.buttons)) {
      return action.buttons
        .map((b: any) => b?.reply?.title ?? b?.title ?? "")
        .filter(Boolean);
    }
    if (t === "cta_url") {
      const label =
        action?.parameters?.display_text ?? action?.parameters?.displayText;
      return label ? [String(label)] : [];
    }
    if (t === "carousel" && Array.isArray(action?.cards)) {
      return action.cards
        .map(
          (c: any) =>
            c?.action?.parameters?.display_text ||
            c?.action?.parameters?.displayText ||
            "",
        )
        .filter(Boolean)
        .map((s: any) => String(s));
    }
    return [];
  })();

  if (contactId != null && conversationId) {
    const message = await db.message.create({
      data: {
        conversationId,
        contactId,
        userId,
        text: displayText,
        content: displayText,
        direction: "outgoing",
        sentBy: sentBy ?? "me",
        status: "SEND",
        sentAt: new Date(),
        whatsappMessageId: whatsappMessageId ?? undefined,
        type: buttonTitles.length > 0 ? "button" : "text",
        messageType: buttonTitles.length > 0 ? "interactive" : "text",
        buttons: buttonTitles.length > 0 ? buttonTitles : undefined,
      } as any,
    });
    return {
      whatsappMessageId,
      message: {
        id: String(message.id),
        createdAt: message.createdAt,
        status: message.status,
        text: message.text,
      },
    };
  }
  return { whatsappMessageId };
}

/**
 * Send a WhatsApp Flow (interactive message with type "flow").
 * Uses flow_id or flow_name; the recipient taps the CTA to open the flow.
 */
export async function sendFlow(
  options: SendFlowOptions,
  databaseInstance?: DatabaseLike,
): Promise<SendResult> {
  const {
    userId,
    toPhone,
    flowId,
    flowName,
    flowCta,
    header,
    body,
    footer,
    flowToken,
    flowAction = "navigate",
    flowActionPayload,
    contactId,
    conversationId,
    sentBy,
  } = options;
  const db = databaseInstance ?? defaultDatabase;

  if (!flowId && !flowName) {
    throw new Error("sendFlow: flowId or flowName is required");
  }

  const account = await getAccount(db, userId);
  const url = `https://graph.facebook.com/${account.apiVersion || "v22.0"}/${account.phoneNumberId}/messages`;

  const actionParams: Record<string, unknown> = {
    flow_message_version: "3",
    flow_cta: flowCta.slice(0, 30),
  };
  if (flowId) actionParams.flow_id = flowId;
  if (flowName) actionParams.flow_name = flowName;
  if (flowToken != null) actionParams.flow_token = flowToken;
  if (flowAction) actionParams.flow_action = flowAction;
  if (flowActionPayload && flowAction === "navigate") {
    actionParams.flow_action_payload = flowActionPayload;
  }

  const interactive: Record<string, unknown> = {
    type: "flow",
    action: {
      name: "flow",
      parameters: actionParams,
    },
  };
  if (header) interactive.header = { type: "text", text: header.slice(0, 60) };
  if (body) interactive.body = { text: body.slice(0, 1024) };
  if (footer) interactive.footer = { text: footer.slice(0, 60) };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone(toPhone),
      type: "interactive",
      interactive,
    }),
  });

  const data = await response.json();
  const whatsappMessageId = data?.messages?.[0]?.id as string | undefined;
  if (!response.ok) {
    console.error("[WhatsAppSendService.sendFlow] API error:", data);
    throw new Error(
      data?.error?.message || "Failed to send flow message.",
    );
  }

  const displayText = (body || flowCta) as string;
  if (contactId != null && conversationId) {
    const message = await db.message.create({
      data: {
        conversationId,
        contactId,
        userId,
        text: displayText,
        content: displayText,
        direction: "outgoing",
        sentBy: sentBy ?? "me",
        status: "SEND",
        sentAt: new Date(),
        whatsappMessageId: whatsappMessageId ?? undefined,
        type: "button",
        messageType: "whatsapp-flow",
        buttons: [flowCta],
      } as any,
    });
    return {
      whatsappMessageId,
      message: {
        id: String(message.id),
        createdAt: message.createdAt,
        status: message.status,
        text: message.text,
      },
    };
  }
  return { whatsappMessageId };
}
