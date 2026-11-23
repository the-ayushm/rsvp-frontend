/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from "@/lib/database";
import type { JsonValue, JsonObject } from "@/lib/database/records";

/* ------------------------------- Helpers ------------------------------- */
function jObj(v: JsonValue | null | undefined): JsonObject {
  return (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {}) as JsonObject;
}

function jArr(v: JsonValue | null | undefined): JsonValue[] {
  return Array.isArray(v) ? (v as JsonValue[]) : [];
}

function s(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def;
}

function isDigitsOnly(x: string) {
  return /^[0-9]+$/.test((x || "").trim());
}

function includes(hay: string, needle: string) {
  return (hay || "").toLowerCase().includes((needle || "").toLowerCase());
}

function evalExpr(expr: string, text: string): boolean {
  const t = (text || "").trim();
  if (isDigitsOnly(expr)) return t === expr.trim();

  const api = {
    text: t,
    includes: (s2: string) => includes(t, s2),
    equals: (s2: string) => t.toLowerCase() === s2.toLowerCase(),
    startsWith: (s2: string) => t.toLowerCase().startsWith(s2.toLowerCase()),
    endsWith: (s2: string) => t.toLowerCase().endsWith(s2.toLowerCase()),
    length: t.length,
  };

  try {
    const fn = new Function("text", "includes", "equals", "startsWith", "endsWith", "length", `return (${expr});`);
    return !!fn(api.text, api.includes, api.equals, api.startsWith, api.endsWith, api.length);
  } catch (err) {
    console.error("Expression evaluation error:", err);
    return false;
  }
}

async function runAINode(prompt: string, userMessage: string): Promise<{ reply: string; route?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { reply: `AI: ${userMessage}`, route: "" };

  const sys = `You are a helpful assistant. Respond ONLY with valid JSON: {"reply":"...","route":"..."}`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: `${prompt}\n\nUser message: ${userMessage}` }],
        response_format: { type: "json_object" },
      }),
    });
    const data = await resp.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    return { reply: s(parsed.reply, "Okay."), route: s(parsed.route, "").trim() };
  } catch (err) {
    return { reply: "AI error occurred.", route: "" };
  }
}

/* --------------------------- Core Engine -------------------------- */
export async function runChatbotFlow(chatbotId: string, userMsg: string, sessionKey: string) {
  const bot = await database.chatbot.findUnique({
    where: { id: chatbotId },
    include: { nodes: true, edges: true },
  });

  if (!bot) throw new Error("Chatbot not found");

  const sessionKeyValue = s(sessionKey, "web-session");
  let session = await database.chatSession.findFirst({
    where: { chatbotId, userKey: sessionKeyValue },
  });

  if (!session) {
    session = await database.chatSession.create({
      data: { chatbotId, userKey: sessionKeyValue, lastNodeId: null, lastMessage: null },
    });
  }

  let currentNodeId: string | null = session.lastNodeId || null;
  const isNewConversation = !session.lastNodeId;
  const isReturningToWaitingNode = !!session.lastNodeId;

  if (isNewConversation) {
    const trigger = bot.nodes.find((n) => n.type === "trigger");
    if (!trigger) throw new Error("No trigger node found");
    currentNodeId = trigger.id;
  }

  const messages: string[] = [];
  const imagePayloads: any[] = [];
  let buttonPayload: any = null;
  const MAX_STEPS = 50;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (!currentNodeId) break;
    const node = bot.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const dataObj = jObj(node.data);
    const outgoing = bot.edges.filter((e) => e.source === currentNodeId);

    // --- TRIGGER ---
    if (node.type === "trigger") {
      const triggerMsg = s(dataObj.text || dataObj.message || dataObj.label);
      if (triggerMsg && isNewConversation) messages.push(triggerMsg);
      if (outgoing.length === 0) break;
      currentNodeId = outgoing[0].target;
      continue;
    }

    // --- MESSAGE ---
    if (node.type === "message") {
      messages.push(s(dataObj.text, "Hello"));
      jArr(dataObj.images).forEach((img: any) => {
        const i = jObj(img);
        if (i.url) imagePayloads.push({ type: "image", url: i.url, caption: i.caption });
      });
      if (outgoing.length === 0) {
        await database.chatSession.update({ where: { id: session.id }, data: { lastNodeId: null, lastMessage: userMsg } });
        break;
      }
      currentNodeId = outgoing[0].target;
      continue;
    }

    // --- BUTTONS ---
    if (node.type === "buttonMessage") {
      const text = s(dataObj.text, "Choose an option:");
      const buttons = jArr(dataObj.buttons).map((x) => s(x)).filter(Boolean);

      if (isReturningToWaitingNode && session.lastNodeId === currentNodeId) {
        const match = outgoing.find((e) => s(e.label).toLowerCase().trim() === userMsg.toLowerCase().trim());
        if (!match) {
          buttonPayload = { type: "button", text, buttons }; // Reshow buttons
          break;
        }
        currentNodeId = match.target;
        continue;
      } else {
        buttonPayload = { type: "button", text, buttons };
        await database.chatSession.update({ where: { id: session.id }, data: { lastNodeId: currentNodeId, lastMessage: userMsg } });
        break;
      }
    }

    // --- AI ---
    if (node.type === "ai") {
      const { reply, route } = await runAINode(s(dataObj.prompt), userMsg);
      messages.push(reply);
      const safeRoute = s(route).toLowerCase().trim();
      const match = outgoing.find((e) => s(e.label).toLowerCase().trim() === safeRoute);
      currentNodeId = match ? match.target : (outgoing[0]?.target || null);
      if (!currentNodeId) {
        await database.chatSession.update({ where: { id: session.id }, data: { lastNodeId: null, lastMessage: userMsg } });
      }
      continue;
    }

    // --- CONDITION ---
    if (node.type === "condition") {
      const res = evalExpr(s(dataObj.expr), userMsg);
      const branch = res ? "true" : "false";
      const match = outgoing.find((e) => s(jObj(e.data).branch) === branch) || outgoing[0];
      currentNodeId = match?.target || null;
      continue;
    }

    if (node.type === "image") {
  jArr(dataObj.images).forEach((img: any) => {
    const i = jObj(img);
    if (i.url) imagePayloads.push({ type: "image", url: i.url, caption: i.caption });
  });
  
  if (outgoing.length === 0) {
    await database.chatSession.update({ where: { id: session.id }, data: { lastNodeId: null, lastMessage: userMsg } });
    break;
  }
  currentNodeId = outgoing[0].target;
  continue;
}

    break;
  }

  // Construct standard reply for both UI and WhatsApp
  let fullReply: any = messages.join("\n\n");
if (buttonPayload) {
  fullReply = buttonPayload;
} else if (imagePayloads.length > 0) {
  fullReply = { 
    type: "media", 
    text: messages.join("\n\n"), 
    images: imagePayloads 
  };
} else {
  fullReply = { 
    type: "text", 
    text: messages.join("\n\n") || "No response defined." 
  };
}
  return { fullReply, messages, imagePayloads, buttonPayload };
}