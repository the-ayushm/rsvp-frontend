import { database as defaultDatabase } from "../lib/database";
import {
  getTemplateVariables,
  formatTemplateParameters,
  buildHeaderParamsFromStoredUrl,
} from "../lib/template-utils";

export interface SendTemplateOptions {
  userId: number;
  contactId: number;
  templateName: string;
  language: string;
  variables: Record<string, string>;
  reminderId?: number;
  /** When provided (e.g. chatbot), message is linked to this conversation and sentBy is used. */
  conversationId?: string;
  /** Origin of the send: "me" | "chatbot" | "campaign" | "reminder". Default "me". */
  sentBy?: string;
}

type DatabaseLike = typeof defaultDatabase;

/**
 * Sends a WhatsApp template message and records it in the unified Message table.
 * Use this from API routes, reminders, and chatbot (worker) so all template sends go through one place.
 * @param options - Template and recipient options; use conversationId + sentBy when sending from chatbot.
 * @param databaseInstance - Optional. Pass when calling from the worker so the same DB connection is used.
 */
export class TemplateService {
  static async sendTemplate(
    options: SendTemplateOptions,
    databaseInstance?: DatabaseLike,
  ) {
    const {
      userId,
      contactId,
      templateName,
      language,
      variables,
      reminderId,
      conversationId,
      sentBy,
    } = options;
    const db = databaseInstance ?? defaultDatabase;

    // 1. Get template and account details
    const template = await db.whatsAppTemplate.findFirst({
      where: {
        name: templateName,
        language: language,
        whatsappAccount: {
          userId: userId,
          isActive: true,
        },
      },
      include: { whatsappAccount: true },
    });

    if (!template) {
      throw new Error(
        `Template "${templateName}" (${language}) not found or account is inactive.`,
      );
    }

    const account = (template as any).whatsappAccount;

    // 2. Get contact details
    const contact = await db.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new Error("Contact not found.");
    }

    // 3. Build template message payload
    const components: any[] = [];
    const templateComponents = (template.components as any) || [];
    const templateVars = getTemplateVariables(templateComponents);
    const { header, body, buttons } = formatTemplateParameters(
      templateVars,
      variables,
      templateComponents,
    );

    // Fixed header: use stored media URL so we don't ask user to upload again
    // Dynamic header: variables must include headerImageUrl/headerVideoUrl/headerDocumentUrl
    const headerMode = (template as any).headerMode;
    const headerMediaUrl = (template as any).headerMediaUrl as string | null | undefined;
    const isFixedHeader = headerMode === "fixed";
    if (isFixedHeader && headerMediaUrl) {
      const fixedHeader = buildHeaderParamsFromStoredUrl(templateComponents, headerMediaUrl);
      if (fixedHeader.length > 0) {
        components.push({ type: "header", parameters: fixedHeader });
      }
    } else if (!isFixedHeader && header.length > 0) {
      components.push({ type: "header", parameters: header });
    }
    if (body.length > 0) {
      components.push({ type: "body", parameters: body });
    }
    if (buttons.length > 0) {
      components.push(...buttons);
    }

    const url = `https://graph.facebook.com/${account.apiVersion}/${account.phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: (contact.phone || "").replace(/\D/g, ""),
      type: "template",
      template: {
        name: template.name,
        language: {
          code: template.language,
        },
        components: components.length > 0 ? components : undefined,
      },
    };

    // 4. Send to Meta Graph API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const sendSuccess = response.ok;
    const errorData = !sendSuccess ? data.error : null;
    const whatsappMessageId = data.messages?.[0]?.id;

    // 5. Create Unified Message Record
    let actualConversationId: string | undefined = conversationId;
    if (!actualConversationId) {
      try {
        const conv = await (db.conversation as any).upsert({
          where: {
            userId_phone: {
              userId: userId,
              phone: contact.phone!,
            },
          },
          update: {
            lastMessage: `Template: ${template.name}`,
            lastMessageAt: new Date(),
          },
          create: {
            userId: userId,
            phone: contact.phone!,
            contactId: contact.id,
            lastMessage: `Template: ${template.name}`,
            lastMessageAt: new Date(),
          },
        });
        actualConversationId = conv.id;
      } catch (convErr) {
        console.error("[TemplateService] Conversation upsert failed:", convErr);
      }
    }

    const messageRecord = await db.message.create({
      data: {
        conversationId: actualConversationId || `fail_${Date.now()}`,
        contactId: contact.id,
        userId: userId,
        messageType: "template",
        whatsappMessageId: whatsappMessageId,
        direction: "outgoing",
        type: "template",
        status: sendSuccess ? "SEND" : "FAILED",
        sentAt: sendSuccess ? new Date() : null,
        failedAt: !sendSuccess ? new Date() : null,
        text: `Template: ${template.name}`,
        isTemplate: true,
        templateName: template.name,
        templateLanguage: template.language,
        templateComponents: (template.components as any) || null,
        templateParams: variables,
        sentBy: sentBy ?? "me",
        errorCode: errorData?.code?.toString(),
        errorMessage: errorData?.message,
        error: errorData ? JSON.stringify(errorData) : undefined,
        reminderId: reminderId,
      } as any,
    });

    // Wallet deduction happens when message is delivered (handleStatusUpdate), not on send.
    // Text/media are not charged; only template/campaign messages deduct on delivered.

    if (!sendSuccess) {
      throw new Error(
        errorData?.message || "Failed to send template message via Meta.",
      );
    }

    return messageRecord;
  }
}
