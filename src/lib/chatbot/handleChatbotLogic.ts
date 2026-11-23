/* eslint-disable @typescript-eslint/no-explicit-any */
import { runChatbotFlow } from "../chatbot-engine";
import { database } from "../database";
import { sendWhatsAppBotReply } from "../whatsapp";

export async function handleChatbotLogic(
  userId: number,
  incomingText: string,
  phone: string,
  contactId: number,
  conversationId: string,
  waAccount: any
) {
  // 1. Fetch all published bots for this user
  console.log("Chatbot is working")
  const publishedBots = await database.chatbot.findMany({
    where: { userId, published: true },
    include: { nodes: true },
  });

  let botToRun = null;
  let isTriggerMatch = false;
  const normalizedInput = incomingText.toLowerCase().trim();

  console.log(`[Bot Engine] Processing: "${normalizedInput}"`);

  // --- STEP 1: Check for DIRECT TRIGGER MATCH (High Priority) ---
  // This allows keywords like "Interested" to interrupt any other flow.
  botToRun = publishedBots.find((bot) => {
    const triggerNode = bot.nodes.find((n) => n.type === "trigger");
    if (!triggerNode) return false;

    const data = triggerNode.data as any;
    const triggerValue = (
      data?.text ||
      data?.message ||
      data?.label ||
      data?.keyword ||
      ""
    ).toLowerCase().trim();

    return triggerValue !== "" && triggerValue === normalizedInput;
  });

  if (botToRun) {
    isTriggerMatch = true;
    console.log(`🎯 Trigger Match: ${botToRun.name}`);
  }

  // --- STEP 2: Check for ONGOING SESSION (Medium Priority) ---
  if (!botToRun) {
    const session = await database.chatSession.findFirst({
      where: {
        userKey: phone,
        lastNodeId: { not: null },
        chatbot: { userId, published: true },
      },
      include: { chatbot: true },
    });

    if (session) {
      botToRun = session.chatbot;
      console.log(`🔄 Continuing Session: ${botToRun.name}`);
    }
  }

  // --- STEP 3: DEFAULT FALLBACK (Low Priority) ---
  // Only triggers if no keyword matched, no session is active, AND the bot hasn't spoken yet.
  if (!botToRun) {
    const totalBotMessages = await database.message.count({
      where: { conversationId, sentBy: "bot" },
    });

    if (totalBotMessages === 0) {
      botToRun = publishedBots.find((bot) => {
        const triggerNode = bot.nodes.find((n) => n.type === "trigger");
        const data = triggerNode?.data as any;
        const triggerValue = (data?.text || data?.label || "").toLowerCase().trim();
        return triggerValue === "default";
      });

      if (botToRun) {
        isTriggerMatch = true;
        console.log(`🏠 Initial Message. Starting Default Bot: ${botToRun.name}`);
      }
    } else {
      console.log(`🤫 Bot already active in history. Ignoring non-trigger input.`);
    }
  }

  // --- STEP 4: EXECUTION ---
  if (botToRun) {
    // If we are starting a NEW bot (Trigger or Default), wipe previous session state
    if (isTriggerMatch) {
      await database.chatSession.deleteMany({
        where: { userKey: phone },
      });
    }

    try {
      const botResponse = await runChatbotFlow(botToRun.id, incomingText, phone);

      // Determine content and types for DB storage
      let replyType = "text";
      let replyContent = botResponse.messages.join("\n\n");
      let buttonsData = null;

      if (botResponse.buttonPayload) {
        replyType = "button";
        replyContent = botResponse.buttonPayload.text || replyContent;
        buttonsData = botResponse.buttonPayload.buttons;
      } else if (botResponse.imagePayloads && botResponse.imagePayloads.length > 0) {
        replyType = "image";
      }

      // Save Bot Message to Database
      await database.message.create({
        data: {
          contactId,
          conversationId,
          userId,
          content: replyContent,
          text: replyContent,
          sentBy: "bot",
          from: "system",
          direction: "outgoing",
          type: replyType,
          messageType: replyType,
          buttons: buttonsData,
          mediaUrl: botResponse.imagePayloads?.[0]?.url || null,
          mediaType: botResponse.imagePayloads?.[0]?.mimeType || null,
          status: "PENDING",
        },
      });

      // Send via WhatsApp API
      await sendWhatsAppBotReply(
        phone,
        botResponse,
        waAccount.accessToken,
        waAccount.phoneNumberId
      );

    } catch (error) {
      console.error(`❌ Bot Execution Error (${botToRun.name}):`, error);
    }
  }
}