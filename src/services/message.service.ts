/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TransactionClient } from "../lib/database";
import fs from "node:fs";
import path from "node:path";
import { database } from "../lib/database";
import { WalletService } from "./wallet.service";
import { publishSocketEvent } from "../lib/socket-bridge";
import { runChatbotFlow } from "../lib/chatbot/run-flow";
import { TemplateService } from "./template.service";
import { sendText, sendMedia, sendInteractive } from "./whatsapp-send.service";


/**
 * Normalizes a phone number by removing non-numeric characters
 * and ensuring it doesn't have a leading + or 00.
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  return `+${digits}`;
}

// Lazy-load socket only if available (Next.js runtime); not used in BullMQ worker
let getSocketIO: (() => unknown) | null = null;
import("../lib/socket")
  .then((m) => {
    getSocketIO = m.getIO;
  })
  .catch(() => {});

export class MessageService {
  /**
   * Updates the status of a message and triggers wallet deduction if needed.
   */
  static async handleStatusUpdate(wamid: string, status: string, details: any) {
    const { timestamp, errorCode, errorMessage } = details;

    return await database.transaction(async (tx: TransactionClient) => {
      // 1. Find message and campaign
      const message = await tx.message.findUnique({
        where: { whatsappMessageId: wamid },
        select: {
          id: true,
          userId: true,
          campaignId: true,
          reminderId: true,
          status: true,
          isTemplate: true,
          ...({ deliveredAt: true } as any),
        },
      });

      if (!message) {
        console.warn(
          `[MessageService] Message ${wamid} not found in database.`,
        );
        return null;
      }

      // 2. Map webhook status (lowercase) to UserStatus (uppercase) and timestamp fields
      const statusDate = timestamp
        ? new Date(parseInt(timestamp) * 1000)
        : new Date();

      const statusMap: Record<string, string> = {
        sent: "SEND",
        delivered: "DELIVERED",
        read: "READ",
        failed: "FAILED",
      };

      const databaseStatus = statusMap[status];

      if (!databaseStatus) {
        console.warn(`[MessageService] Unknown status received: ${status}`);
        return null;
      }

      const updateData: any = {
        status: databaseStatus as any,
        errorCode: errorCode?.toString(),
        errorMessage: errorMessage,
        updatedAt: new Date(),
      };

      if (status === "sent") (updateData as any).sentAt = statusDate;
      if (status === "delivered") (updateData as any).deliveredAt = statusDate;
      if (status === "read") {
        (updateData as any).readAt = statusDate;
        if (!(message as any).deliveredAt) {
          (updateData as any).deliveredAt = statusDate;
        }
      }
      if (status === "failed") (updateData as any).failedAt = statusDate;

      const updatedMsg = await tx.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // 3. Update Campaign Stats if applicable
      if (message.campaignId) {
        const updateData: any = {};
        // If status is 'read', we should also ensure 'delivered' is accounted for if not already
        if (status === "delivered") {
          updateData.deliveredCount = { increment: 1 };
        } else if (status === "read") {
          updateData.readCount = { increment: 1 };
          // Check if previous status was NOT delivered/read to avoid double counting
          // or missing delivery count if they arrive out of order
          if (message.status !== "DELIVERED" && message.status !== "READ") {
            updateData.deliveredCount = { increment: 1 };
          }
        } else if (status === "failed") {
          updateData.failedCount = { increment: 1 };
        }

        if (Object.keys(updateData).length > 0) {
          await tx.campaign.update({
            where: { id: message.campaignId },
            data: updateData,
          });
        }
      }

      // 4. Wallet deduction only when message is delivered and is chargeable (template or campaign).
      // No charge for plain text/media; only templates and campaign messages deduct on delivered.
      const isChargeable =
        (message as any).isTemplate === true ||
        (message as any).campaignId != null;
      if (status === "delivered" && isChargeable) {
        const COST = 1.0;
        try {
          await WalletService.deductWallet(message.userId, COST, wamid);
        } catch (e: any) {
          console.error(
            `[MessageService] Wallet deduction failed but continuing status update:`,
            e.message,
          );
        }
      }

      // 5. Update Reminder Status if applicable
      if ((message as any).reminderId) {
        if (status === "delivered" || status === "read") {
          await tx.contactReminder.update({
            where: { id: (message as any).reminderId },
            data: { delivered: true },
          });
        }
      }

      // Emit Socket update via Redis bridge
      await publishSocketEvent("message_status_update", { wamid, status, userId: message.userId });

      return updatedMsg;
    });
  }

  /**
   * Handles inbound messages from customers.
   */
  static async handleInbound(message: any, contactMeta: any, metadata: any) {
    const phoneNumberId = metadata.phone_number_id;
    const rawFrom = message.from;
    const from = normalizePhone(rawFrom); // Normalize the incoming phone number
    const name = contactMeta?.profile?.name || from;
    let text = "";
    let mediaUrl = null;
    let mediaType = null;
    let caption = null; // New

    if (message.type === "text") {
      text = message.text?.body || "";
    } else if (message.type === "button") {
      text = message.button?.text || "";
    } else if (message.type === "interactive") {
      text =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "Interactive Response";
    } else if (
      ["image", "video", "audio", "document", "sticker"].includes(message.type)
    ) {
      const media = message[message.type];
      const waMediaId = media.id; // WhatsApp internal ID
      mediaType = message.type;
      caption = media.caption || null;
      text = caption || `Sent a ${message.type}`;

      // Download media from WhatsApp and save locally
      try {
        const waAccount = await database.whatsAppAccount.findFirst({
          where: { phoneNumberId },
        });

        if (waAccount?.accessToken) {
          const accessToken = waAccount.accessToken;

          // Step 1: Get media URL from WhatsApp
          const mediaInfoRes = await fetch(
            `https://graph.facebook.com/v21.0/${waMediaId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
          const mediaInfo = await mediaInfoRes.json();

          if (mediaInfo.url) {
            // Step 2: Download media content
            const mediaRes = await fetch(mediaInfo.url, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());

            // Step 3: Save to local uploads
            const uploadsDir = path.join(process.cwd(), "public", "uploads");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Generate filename with proper extension
            const mimeType =
              media.mime_type ||
              mediaInfo.mime_type ||
              "application/octet-stream";
            const ext = mimeType.split("/")[1]?.split(";")[0] || "bin";
            const uniqueFileName = `${Date.now()}_incoming_${message.id?.slice(-8) || "msg"}.${ext}`;
            const localFilePath = path.join(uploadsDir, uniqueFileName);

            fs.writeFileSync(localFilePath, mediaBuffer);
            mediaUrl = `/uploads/${uniqueFileName}`;

            console.log(`[MessageService] Media saved: ${mediaUrl}`);
          }
        }
      } catch (downloadError) {
        console.error(
          "[MessageService] Failed to download media:",
          downloadError,
        );
        // Keep mediaUrl as null if download fails - message will still be saved with text placeholder
      }
    }

    const waAccount = await database.whatsAppAccount.findFirst({
      where: { phoneNumberId },
    });

    if (!waAccount) return;

    const userId = waAccount.userId;

    // Contact Lookup with normalization (Digits only vs +prefix)
    let contact = await database.contact.findFirst({
      where: {
        userId,
        OR: [{ phone: from }, { phone: `+${from}` }],
      },
    });

    if (!contact) {
      contact = await database.contact.create({
        data: { userId, phone: from, name },
      });
    }

    // Conversation – First try to find existing by userId+contactId or userId+phone
    // We have TWO unique constraints: @@unique([userId, phone]) and @@unique([userId, contactId])
    const phoneKey = normalizePhone(contact.phone || from);
    let conversation;

    // First, check if a conversation exists for this contact (by contactId)
    conversation = await database.conversation.findFirst({
      where: {
        userId,
        OR: [{ contactId: contact.id }, { phone: phoneKey }],
      },
    });

    if (conversation) {
      // Update existing conversation
      conversation = await database.conversation.update({
        where: { id: conversation.id },
        data: {
          lastInboundAt: new Date(),
          contactId: contact.id,
          phone: phoneKey, // Ensure phone is normalized
          name: name ?? undefined,
        },
      });
    } else {
      // Create new conversation
      try {
        conversation = await database.conversation.create({
          data: {
            userId,
            phone: phoneKey,
            name,
            contactId: contact.id,
            lastInboundAt: new Date(),
          },
        });
      } catch (err: any) {
        // Race condition: another job created it between our lookup and create
        if (err?.code === "23505") {
          conversation = await database.conversation.findFirst({
            where: {
              userId,
              OR: [{ contactId: contact.id }, { phone: phoneKey }],
            },
          });
          if (conversation) {
            conversation = await database.conversation.update({
              where: { id: conversation.id },
              data: {
                lastInboundAt: new Date(),
                contactId: contact.id,
                name: name ?? undefined,
              },
            });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // Save Message
    const savedMsg = await database.message.create({
      data: {
        userId,
        contactId: contact.id,
        conversationId: conversation.id,
        text,
        content: text,
        mediaUrl,
        mediaType,
        caption,
        sentBy: "customer",
        direction: "incoming",
        status: "SEND",
        sentAt: message.timestamp
          ? new Date(parseInt(message.timestamp) * 1000)
          : new Date(),
        whatsappMessageId: message.id,
        type: message.type,
      },
    });

    // Emit via Redis bridge for real-time update
    await publishSocketEvent("new_message", {
      id: savedMsg.id,
      contactId: contact.id,
      userId,
      text,
      direction: "incoming",
      status: "sent",
      createdAt:
        savedMsg.createdAt?.toISOString?.() || new Date().toISOString(),
      whatsappMessageId: message.id,
      mediaUrl,
      mediaType,
      contactName: name,
      contactPhone: from,
    });

    // Run chatbot flow in-process (no API call): find client's active chatbot for this WhatsApp account, run flow, send reply
    try {
      const bot = await database.chatbot.findFirst({
        where: {
          userId,
          published: true,
          OR: [
            { whatsappAccountId: waAccount.id },
            { whatsappAccountId: null },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
      if (bot) {
        const interactiveButtonId =
          message.type === "interactive"
            ? (message.interactive?.button_reply?.id ??
              message.interactive?.list_reply?.id)
            : undefined;
        const isTemplateButtonReply = message.type === "button";
        const { reply } = await runChatbotFlow(database, {
          chatbotId: bot.id,
          userId,
          message: text,
          sessionKey: from,
          interactiveButtonId,
          isTemplateButtonReply,
        });
        if (
          reply != null &&
          (typeof reply === "string" ? reply.trim() : true)
        ) {
          await MessageService.sendChatbotReply(database, {
            userId,
            toPhone: from,
            contactId: contact.id,
            conversationId: conversation.id,
            contactName: name,
            reply,
          });
        }
      }
    } catch (e) {
      console.error("[MessageService] Chatbot flow error:", e);
    }

    return savedMsg;
  }

  /**
   * Sends a flow reply (template / media / text) and emits new_message. Used by handleInbound and timeout processor.
   */
  static async sendChatbotReply(
    database: any,
    params: {
      userId: number;
      toPhone: string;
      contactId: number;
      conversationId: string;
      contactName: string;
      reply: string | object;
    },
  ): Promise<void> {
    const { userId, toPhone, contactId, conversationId, contactName, reply } =
      params;
    let parsed: any = null;
    if (typeof reply === "string") {
      try {
        parsed = JSON.parse(reply);
      } catch {
        parsed = null;
      }
    } else {
      parsed = reply;
    }

    // Send multiple replies in order (e.g. text then template when flow has Message → Template)
    if (parsed && parsed.type === "sequence" && Array.isArray(parsed.items)) {
      for (let i = 0; i < parsed.items.length; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 600));
        }
        await MessageService.sendChatbotReply(database, {
          ...params,
          reply:
            typeof parsed.items[i] === "object"
              ? parsed.items[i]
              : String(parsed.items[i]),
        });
      }
      return;
    }

    if (parsed && parsed.type === "template") {
      const { templateName, language, variables } = parsed;
      if (templateName) {
        const messageRecord = await TemplateService.sendTemplate(
          {
            userId,
            contactId,
            conversationId,
            templateName: String(templateName),
            language: String(language || "en"),
            variables:
              variables && typeof variables === "object" ? variables : {},
            sentBy: "chatbot",
          },
          database,
        );
        await publishSocketEvent("new_message", {
          id: messageRecord.id,
          contactId,
          userId,
          text: messageRecord.text,
          direction: "outgoing",
          status: messageRecord.status,
          sentBy: "chatbot",
          createdAt:
            messageRecord.createdAt?.toISOString?.() ??
            new Date().toISOString(),
          whatsappMessageId: (messageRecord as any).whatsappMessageId,
          contactName,
          contactPhone: toPhone,
        });
      }
    } else if (parsed && parsed.type === "button" && parsed.text != null && Array.isArray(parsed.buttons)) {
      // Convert simplified { type: "button", text, buttons } to Meta interactive format
      const interactive = {
        type: "button",
        body: { text: String(parsed.text).slice(0, 1024) },
        action: {
          buttons: parsed.buttons.slice(0, 3).map((title: string, i: number) => ({
            type: "reply",
            reply: { id: `btn_${i}`.trim(), title: String(title).slice(0, 20) },
          })),
        },
      };
      const result = await sendInteractive(
        {
          userId,
          toPhone,
          interactive,
          contactId,
          conversationId,
          sentBy: "chatbot",
        },
        database,
      );
      if (result.message) {
        await publishSocketEvent("new_message", {
          id: result.message.id,
          contactId,
          userId,
          text: result.message.text,
          direction: "outgoing",
          status: result.message.status,
          sentBy: "chatbot",
          createdAt:
            result.message.createdAt?.toISOString?.() ??
            new Date().toISOString(),
          whatsappMessageId: result.whatsappMessageId,
          contactName,
          contactPhone: toPhone,
        });
      }
    } else if (parsed && parsed.type === "interactive" && parsed.interactive) {
      const result = await sendInteractive(
        {
          userId,
          toPhone,
          interactive: parsed.interactive,
          contactId,
          conversationId,
          sentBy: "chatbot",
        },
        database,
      );
      if (result.message) {
        await publishSocketEvent("new_message", {
          id: result.message.id,
          contactId,
          userId,
          text: result.message.text,
          direction: "outgoing",
          status: result.message.status,
          sentBy: "chatbot",
          createdAt:
            result.message.createdAt?.toISOString?.() ??
            new Date().toISOString(),
          whatsappMessageId: result.whatsappMessageId,
          contactName,
          contactPhone: toPhone,
        });
      }
    } else if (
      parsed &&
      parsed.type === "media" &&
      Array.isArray(parsed.images) &&
      parsed.images.length > 0
    ) {
      const result = await sendMedia(
        {
          userId,
          toPhone,
          text: parsed.text || "",
          images: parsed.images,
          contactId,
          conversationId,
          sentBy: "chatbot",
        },
        database,
      );
      if (result.message) {
        await publishSocketEvent("new_message", {
          id: result.message.id,
          contactId,
          userId,
          text: result.message.text,
          direction: "outgoing",
          status: result.message.status,
          sentBy: "chatbot",
          createdAt:
            result.message.createdAt?.toISOString?.() ??
            new Date().toISOString(),
          whatsappMessageId: result.whatsappMessageId,
          contactName,
          contactPhone: toPhone,
        });
      }
    } else {
      let textToSend: string;
      if (typeof reply === "string") textToSend = reply;
      else if (parsed?.type === "media" && parsed?.text != null)
        textToSend = parsed.text;
      else if (parsed?.text != null) textToSend = parsed.text;
      else textToSend = String(reply ?? "");
      if (textToSend.trim()) {
        const result = await sendText(
          {
            userId,
            toPhone,
            text: textToSend,
            contactId,
            conversationId,
            sentBy: "chatbot",
          },
          database,
        );
        if (result.message) {
          await publishSocketEvent("new_message", {
            id: result.message.id,
            contactId,
            userId,
            text: result.message.text,
            direction: "outgoing",
            status: result.message.status,
            sentBy: "chatbot",
            createdAt:
              result.message.createdAt?.toISOString?.() ??
              new Date().toISOString(),
            whatsappMessageId: result.whatsappMessageId,
            contactName,
            contactPhone: toPhone,
          });
        }
      }
    }
  }

  /**
   * Finds sessions stuck at a Wait for Response node past their timeout, runs the timeout path, and sends the next message.
   * Call from a cron (e.g. every minute). Uses session.updatedAt as "wait started" time.
   */
  static async processWaitForResponseTimeouts(
    database: any,
  ): Promise<{ processed: number }> {
    const sessions = await database.chatSession.findMany({
      where: { lastNodeId: { not: null } },
      include: { chatbot: { include: { nodes: true } } },
    });
    let processed = 0;
    const now = Date.now();

    for (const session of sessions) {
      if (!session.chatbot?.userId) continue;
      const node = session.chatbot?.nodes?.find(
        (n: any) => n.id === session.lastNodeId,
      );
      if (!node || node.type !== "waitForResponse") continue;

      const dataObj =
        node.data && typeof node.data === "object" ? node.data : {};
      const timeoutMinutes = Number(dataObj.timeoutMinutes) || 30;
      const waitStartedAt = session.updatedAt
        ? new Date(session.updatedAt).getTime()
        : now;
      if (now - waitStartedAt < timeoutMinutes * 60 * 1000) continue;

      try {
        const { reply } = await runChatbotFlow(database, {
          chatbotId: session.chatbotId,
          userId: session.chatbot.userId,
          message: "__TIMEOUT__",
          sessionKey: session.userKey,
        });
        if (reply == null || (typeof reply === "string" && !reply.trim()))
          continue;

        const phone = normalizePhone(session.userKey);
        const conversation = await database.conversation.findFirst({
          where: {
            userId: session.chatbot.userId,
            OR: [{ phone }, { phone: session.userKey }],
          },
        });
        if (!conversation) continue;

        const contact = await database.contact.findUnique({
          where: { id: conversation.contactId },
        });
        const contactName = contact?.name ?? session.userKey;

        await MessageService.sendChatbotReply(database, {
          userId: session.chatbot.userId,
          toPhone: session.userKey,
          contactId: conversation.contactId,
          conversationId: conversation.id,
          contactName: contactName as string,
          reply,
        });
        processed++;
      } catch (e) {
        console.error(
          "[MessageService] Wait-for-response timeout error for session",
          session.id,
          e,
        );
      }
    }
    return { processed };
  }
}
