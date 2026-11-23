/**
 * Run chatbot flow in-process (no HTTP). Used by the webhook worker and by the run API.
 * 1. Resolve client (userId) from context
 * 2. Load active chatbot for that client
 * 3. Evaluate trigger node (e.g. keyword condition)
 * 4. Run flow from trigger → next nodes → build reply
 * 5. Return { reply } so caller can send via WhatsApp
 */

import type { JsonValue, JsonObject } from "@/lib/database/records";

export type DatabaseLike = {
  chatbot: { findFirst: (args: any) => Promise<any> };
  chatSession: {
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
};

export type RunFlowParams = {
  chatbotId: string;
  userId: number;
  message: string;
  sessionKey: string;
  /** When user taps an interactive button or list row, WhatsApp sends button_reply.id (e.g. btn_1) or list_reply.id (e.g. list_0). Pass it so we can match edge by sourceHandle. */
  interactiveButtonId?: string;
  /** When user taps a template CTA button (e.g. "Learn more"), WhatsApp sends type "button". Pass true so we resume the flow instead of requiring trigger match. */
  isTemplateButtonReply?: boolean;
};

function jObj(v: JsonValue | null | undefined): JsonObject {
  return (
    v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {}
  ) as JsonObject;
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
    const fn = new Function(
      "text",
      "includes",
      "equals",
      "startsWith",
      "endsWith",
      "length",
      `return (${expr});`,
    );
    return !!fn(
      api.text,
      api.includes,
      api.equals,
      api.startsWith,
      api.endsWith,
      api.length,
    );
  } catch {
    return false;
  }
}

async function runAINode(
  prompt: string,
  userMessage: string,
): Promise<{ reply: string; route?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { reply: `AI: ${userMessage}`, route: "" };
  const sys = `You are a helpful assistant. Respond ONLY with valid JSON: {"reply":"your response","route":"optional_route_label"}.`;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `${prompt}\n\nUser: ${userMessage}` },
        ],
        response_format: { type: "json_object" as const },
      }),
    });
    if (!resp.ok) return { reply: "AI unavailable.", route: "" };
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(raw);
      return {
        reply: s(parsed.reply, "Okay."),
        route: s(parsed.route, "").trim(),
      };
    } catch {
      return { reply: raw || "Okay.", route: "" };
    }
  } catch {
    return { reply: "AI error.", route: "" };
  }
}

/** Returns true if trigger conditions allow the flow to run (e.g. keyword match or "any message"). */
function triggerMatches(dataObj: JsonObject, userMsg: string): boolean {
  const triggerType = s(dataObj.triggerType, "any");
  if (triggerType === "any") return true;
  if (triggerType === "keyword") {
    const keywords = jArr(dataObj.keywords)
      .map((x) => s(x))
      .filter(Boolean);
    const matchingLogic = s(dataObj.matchingLogic, "contains");
    const msg = userMsg.trim().toLowerCase();
    const match = keywords.some((k) => {
      const kw = k.trim().toLowerCase();
      return matchingLogic === "exact" ? msg === kw : msg.includes(kw);
    });
    if (match) return true;
    if (dataObj.fallback) return true; // fallback trigger
    return false;
  }
  return true;
}

export async function runChatbotFlow(
  database: DatabaseLike,
  params: RunFlowParams,
): Promise<{ reply: string | object }> {
  const {
    chatbotId,
    userId,
    message,
    sessionKey,
    interactiveButtonId,
    isTemplateButtonReply,
  } = params;
  const userMsg = s(message).trim();

  const bot = await database.chatbot.findFirst({
    where: { id: chatbotId, userId },
    include: { nodes: true, edges: true },
  });

  if (!bot) return { reply: "" };

  const sessionKeyValue = s(sessionKey, "web-session");
  let session = await database.chatSession.findFirst({
    where: { chatbotId, userKey: sessionKeyValue },
  });

  if (!session) {
    session = await database.chatSession.create({
      data: {
        chatbotId,
        userKey: sessionKeyValue,
        lastNodeId: null,
        lastMessage: null,
      },
    });
  }

  const trigger = bot.nodes.find((n: any) => n.type === "trigger");
  const triggerData = trigger ? jObj(trigger.data) : {};

  // ─── INPUT TYPE FIRST (before session state) ─────────────────────────────────────
  // Classify by what the user sent: Text vs Template CTA (different metadata) vs Interactive.
  // This avoids linear bias and deploy-fail: button clicks always resume; only text can trigger global reset.
  const inputType: "text" | "template_button" | "interactive" =
    isTemplateButtonReply
      ? "template_button"
      : interactiveButtonId != null && interactiveButtonId !== ""
        ? "interactive"
        : "text";

  // Text: require trigger match; allow global reset (typing "Hi" restarts).
  if (inputType === "text") {
    if (!trigger || !triggerMatches(triggerData, userMsg)) return { reply: "" };
    if (session.lastNodeId) {
      await database.chatSession.update({
        where: { id: session.id },
        data: { lastNodeId: null, lastMessage: userMsg },
      });
      session = { ...session, lastNodeId: null };
    }
  }
  // Template button / Interactive: never require trigger match; never clear session for "restart".

  const isNewConversation = !session.lastNodeId;
  const isReturningToWaitingNode = !!session.lastNodeId;

  let currentNodeId: string | null = null;
  /** When user picks one option (interactive or template QR), keep session at that node so other options still work (Meta doesn't disable buttons). */
  let interactiveNodeIdToStayAt: string | null = null;
  let templateNodeIdToStayAt: string | null = null;
  if (isNewConversation) {
    if (!trigger) return { reply: "" };
    const outgoing = bot.edges.filter((e: any) => e.source === trigger.id);
    if (outgoing.length === 0) return { reply: "" };
    currentNodeId = outgoing[0].target;
  } else {
    currentNodeId = session.lastNodeId;
  }

  // ─── BRIDGE: Resume by input type (template vs interactive) so session is not dropped ───
  // Template Quick Reply: WhatsApp sends type "button" with button.text (e.g. "Learn more").
  // Find template node edge by label and jump to next node so Template → Interactive (or any) works.
  if (inputType === "template_button" && userMsg) {
    const templateEdge = bot.edges.find((e: any) => {
      const src = bot.nodes.find((n: any) => n.id === e.source);
      if (src?.type !== "template") return false;
      // If session is at a template, only match edges from that template (same as interactive).
      if (session.lastNodeId && e.source !== session.lastNodeId) return false;
      const handle = s(jObj(e.data).sourceHandle);
      if (!handle.startsWith("qr_")) return false;
      return s(e.label).toLowerCase().trim() === userMsg.toLowerCase().trim();
    });
    if (templateEdge) {
      const targetNode = bot.nodes.find(
        (n: any) => n.id === templateEdge.target,
      );
      currentNodeId = templateEdge.target;
      session = { ...session, lastNodeId: templateEdge.source };
      // When target is not another interactive, keep session at template so user can tap other QR buttons.
      if (targetNode?.type !== "interactive") {
        templateNodeIdToStayAt = templateEdge.source;
      }
      await database.chatSession.update({
        where: { id: session.id },
        data: { lastNodeId: templateEdge.source, lastMessage: userMsg },
      });
    }
  }

  // Interactive (reply buttons / list): only use an edge FROM the current session node (same interactive).
  // Never use an edge from another interactive (e.g. bottom "Option 1" with no node must not trigger first interactive's Option 1).
  // If session is not at an interactive, do not run the flow with "any" matching edge — return once to avoid wrong reply on retry/duplicate.
  if (
    inputType === "interactive" &&
    interactiveButtonId != null &&
    interactiveButtonId !== ""
  ) {
    const sourceNodeFromSession =
      session.lastNodeId &&
      bot.nodes.find((n: any) => n.id === session.lastNodeId);
    const isSessionAtInteractive =
      sourceNodeFromSession?.type === "interactive";
    if (!isSessionAtInteractive) {
      await database.chatSession.update({
        where: { id: session.id },
        data: { lastNodeId: null, lastMessage: userMsg },
      });
      return { reply: "" };
    }
    const handleMatch = (e: any) =>
      s(jObj(e.data).sourceHandle).toLowerCase().trim() ===
      interactiveButtonId.toLowerCase().trim();
    const edgeWithButton = bot.edges.find(
      (e: any) => e.source === session.lastNodeId && handleMatch(e),
    );
    if (edgeWithButton?.target) {
      const sourceNode = bot.nodes.find(
        (n: any) => n.id === edgeWithButton.source,
      );
      const targetNode = bot.nodes.find(
        (n: any) => n.id === edgeWithButton.target,
      );
      if (sourceNode?.type === "interactive") {
        currentNodeId = edgeWithButton.target;
        session = { ...session, lastNodeId: sourceNode.id };
        // When target is not another interactive, keep session at this interactive so user can tap Option 2/3 later (Meta doesn't disable buttons).
        if (targetNode?.type !== "interactive") {
          interactiveNodeIdToStayAt = sourceNode.id;
        }
        await database.chatSession.update({
          where: { id: session.id },
          data: { lastNodeId: sourceNode.id, lastMessage: userMsg },
        });
      }
    }
  }

  /** When user chose one option (interactive or template QR), we keep session at that node so they can tap other options. Resolve persisted lastNodeId accordingly. */
  function resolveLastNodeId(planned: string | null): string | null {
    const stayAt = interactiveNodeIdToStayAt ?? templateNodeIdToStayAt;
    if (stayAt == null) return planned;
    if (planned == null) return stayAt;
    const n = bot.nodes.find((x: any) => x.id === planned);
    return n?.type === "interactive" ? planned : stayAt;
  }

  const messages: string[] = [];
  const imagePayloads: any[] = [];
  let buttonPayload: any = null;
  const MAX_STEPS = 50;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (!currentNodeId) break;
    const node = bot.nodes.find((n: any) => n.id === currentNodeId);
    if (!node) break;

    const dataObj = jObj(node.data);
    const outgoing = bot.edges.filter((e: any) => e.source === currentNodeId);

    if (node.type === "trigger") {
      const triggerMsg = s(dataObj.text || dataObj.message || dataObj.label);
      if (triggerMsg && isNewConversation) messages.push(triggerMsg);
      if (outgoing.length === 0) break;
      currentNodeId = outgoing[0].target;
      continue;
    }

    if (node.type === "message") {
      const text = s(dataObj.text, "Hello");
      const images = jArr(dataObj.images);
      if (images.length > 0) {
        messages.push(text);
        images.forEach((img: any) => {
          const it = jObj(img);
          const url = s(it.url);
          if (url)
            imagePayloads.push({ type: "image", url, caption: s(it.caption) });
        });
      } else messages.push(text);
      if (outgoing.length === 0) {
        await database.chatSession.update({
          where: { id: session.id },
          data: { lastNodeId: resolveLastNodeId(null), lastMessage: userMsg },
        });
        break;
      }
      currentNodeId = outgoing[0].target;
      continue;
    }

    if (node.type === "image") {
      jArr(dataObj.images).forEach((img: any) => {
        const it = jObj(img);
        const url = s(it.url);
        if (url)
          imagePayloads.push({ type: "image", url, caption: s(it.caption) });
      });
      if (outgoing.length === 0) {
        await database.chatSession.update({
          where: { id: session.id },
          data: { lastNodeId: resolveLastNodeId(null), lastMessage: userMsg },
        });
        break;
      }
      currentNodeId = outgoing[0].target;
      continue;
    }

    if (node.type === "media") {
      const mediaType = s(dataObj.mediaType, "image");
      jArr(dataObj.mediaItems).forEach((item: any) => {
        const it = jObj(item);
        const url = s(it.url || it.link);
        const galleryMediaId =
          it.galleryMediaId != null ? Number(it.galleryMediaId) : null;
        if (url || galleryMediaId)
          imagePayloads.push({
            type: mediaType,
            url: url || undefined,
            galleryMediaId: galleryMediaId ?? undefined,
            caption: s(it.caption),
            filename: mediaType === "document" ? s(it.filename) : undefined,
          });
      });
      if (outgoing.length === 0) {
        await database.chatSession.update({
          where: { id: session.id },
          data: { lastNodeId: resolveLastNodeId(null), lastMessage: userMsg },
        });
        break;
      }
      currentNodeId = outgoing[0].target;
      continue;
    }

    if (node.type === "buttonMessage") {
      const text = s(dataObj.text, "Choose an option:");
      const buttons = jArr(dataObj.buttons)
        .map((x) => s(x))
        .filter(Boolean);
      if (isReturningToWaitingNode && session.lastNodeId === currentNodeId) {
        const matchedEdge = outgoing.find(
          (e: any) =>
            s(e.label).toLowerCase().trim() === userMsg.toLowerCase().trim(),
        );
        if (!matchedEdge) {
          messages.push("❌ Invalid selection.");
          buttonPayload = { type: "button", text, buttons };
          await database.chatSession.update({
            where: { id: session.id },
            data: {
              lastNodeId: resolveLastNodeId(currentNodeId),
              lastMessage: userMsg,
            },
          });
          break;
        }
        currentNodeId = matchedEdge.target;
        continue;
      }
      buttonPayload = { type: "button", text, buttons };
      await database.chatSession.update({
        where: { id: session.id },
        data: {
          lastNodeId: resolveLastNodeId(currentNodeId),
          lastMessage: userMsg,
        },
      });
      break;
    }

    if (node.type === "interactive") {
      const interactiveType = s(dataObj.interactiveType, "buttons");
      const bodyText = s(dataObj.text, "Choose an option:").slice(0, 1024);
      const headerType = s(dataObj.headerType, "text");
      const headerText = s(dataObj.header, "").trim().slice(0, 60);
      const footerText = s(dataObj.footer, "").trim().slice(0, 60);
      const headerMedia = jObj(dataObj.headerMedia);
      const ctaDisplayText = s(
        (dataObj as any).ctaDisplayText ?? (dataObj as any).display_text,
        "Open link",
      )
        .trim()
        .slice(0, 20);
      const ctaUrl = s((dataObj as any).ctaUrl ?? (dataObj as any).url, "")
        .trim()
        .slice(0, 2000);

      const carouselCards = jArr((dataObj as any).carouselCards).slice(0, 10);
      const carouselHeaderType = s(
        (dataObj as any).carouselHeaderType,
        "image",
      ).toLowerCase();
      const carouselButtonType = s(
        (dataObj as any).carouselButtonType,
        "cta_url",
      ).toLowerCase();
      const carouselQuickReplies = jArr((dataObj as any).carouselQuickReplies)
        .map((x) => s(x))
        .filter(Boolean)
        .slice(0, 3);

      const buildInteractivePayload = async (): Promise<any> => {
        const isList = interactiveType === "list";
        const isCtaUrl = interactiveType === "cta_url";
        const isCarousel = interactiveType === "carousel";
        const interactive: any = {
          type: isCarousel ? "carousel" : isCtaUrl ? "cta_url" : isList ? "list" : "button",
          body: { text: bodyText },
          action: {},
        };
        // IMPORTANT: For "carousel", Meta supports headers ONLY at card level (image/video).
        // Do not add a top-level interactive.header.
        if (!isCarousel) {
          // Header: text or media (image, video, document) per Meta API
          if (headerType === "text" && headerText) {
            interactive.header = { type: "text", text: headerText };
          } else if (
            (headerType === "image" ||
              headerType === "video" ||
              headerType === "document") &&
            (headerMedia?.url ||
              headerMedia?.link ||
              headerMedia?.previewUrl ||
              headerMedia?.galleryMediaId != null)
          ) {
            let mediaUrl: string | null = null;
            const urlOrLink = s(
              headerMedia?.url || headerMedia?.link || headerMedia?.previewUrl,
            );
            const galleryMediaId =
              headerMedia?.galleryMediaId != null
                ? Number(headerMedia.galleryMediaId)
                : null;
            if (urlOrLink && /^https?:\/\//i.test(urlOrLink)) {
              mediaUrl = urlOrLink;
            } else if (urlOrLink && urlOrLink.startsWith("/")) {
              const base =
                typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
                  ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
                  : "";
              mediaUrl = base ? `${base}${urlOrLink}` : urlOrLink;
            } else if (galleryMediaId && (database as any).media) {
              const media = await (database as any).media.findFirst({
                where: { id: galleryMediaId, userId },
              });
              if (media?.url) {
                const base =
                  typeof process !== "undefined" &&
                  process.env.NEXT_PUBLIC_APP_URL
                    ? process.env.NEXT_PUBLIC_APP_URL
                    : "";
                mediaUrl = media.url.startsWith("http")
                  ? media.url
                  : `${base.replace(/\/$/, "")}/${media.url.replace(/^\//, "")}`;
              }
            }
            if (mediaUrl) {
              const mediaKey =
                headerType === "image"
                  ? "image"
                  : headerType === "video"
                    ? "video"
                    : "document";
              interactive.header = {
                type: headerType,
                [mediaKey]: { link: mediaUrl },
              };
            }
          }
        }
        if (footerText && !isCarousel) interactive.footer = { text: footerText };

        if (isCarousel) {
          const headerTypeForCards =
            carouselHeaderType === "video" ? "video" : "image";
          const buttonTypeForCards =
            carouselButtonType === "quick_reply" ? "quick_reply" : "cta_url";
          const cards = (carouselCards || [])
            .map((raw: any, idx: number) => {
              const card = jObj(raw);
              let imgUrl = s(
                (card as any).imageUrl ||
                  (card as any).mediaUrl ||
                  (card as any).url,
              )
                .trim()
                .slice(0, 2000);
              if (imgUrl && imgUrl.startsWith("/")) {
                const base =
                  typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
                    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
                    : "";
                imgUrl = base ? `${base}${imgUrl}` : imgUrl;
              }
              const cardBody = s(
                (card as any).bodyText || (card as any).text || "",
              )
                .trim()
                .slice(0, 160);
              const btnText = s(
                (card as any).buttonText ||
                  (card as any).ctaDisplayText ||
                  "View",
              )
                .trim()
                .slice(0, 20);
              const targetUrl = s(
                (card as any).url || (card as any).ctaUrl || "",
              )
                .trim()
                .slice(0, 2000);
              if (!imgUrl) return null;
              if (buttonTypeForCards === "cta_url" && !targetUrl) return null;
              if (
                buttonTypeForCards === "quick_reply" &&
                carouselQuickReplies.length < 1
              )
                return null;
              const headerMediaKey =
                headerTypeForCards === "video" ? "video" : "image";
              // Per-card button set: each card has its own quick_reply ids (Meta style), or its own CTA URL.
              const action =
                buttonTypeForCards === "cta_url"
                  ? {
                      name: "cta_url",
                      parameters: {
                        display_text: btnText,
                        url: targetUrl,
                      },
                    }
                  : {
                      buttons: carouselQuickReplies.map((title, btnIdx) => ({
                        type: "quick_reply",
                        quick_reply: {
                          id: `card_${idx}_btn_${btnIdx}`.slice(0, 20),
                          title: title.slice(0, 20),
                        },
                      })),
                    };
              return {
                card_index: idx,
                type: "cta_url",
                header: {
                  type: headerTypeForCards,
                  [headerMediaKey]: { link: imgUrl },
                },
                body: cardBody ? { text: cardBody } : undefined,
                action,
              };
            })
            .filter(Boolean);
          interactive.action = { cards };
        } else if (isCtaUrl) {
          interactive.action = {
            name: "cta_url",
            parameters: {
              display_text: ctaDisplayText || "Open link",
              url: ctaUrl,
            },
          };
        } else if (isList) {
          const listButtonText = s(
            dataObj.listButtonText,
            "View options",
          ).slice(0, 20);
          const sectionTitle = s(dataObj.listSectionTitle, "Options").slice(
            0,
            24,
          );
          const rows = (jArr(dataObj.listItems) || [])
            .map((r: any, i: number) => {
              const row = typeof r === "object" ? r : {};
              return {
                id: `list_${i}`.trim().slice(0, 200),
                title: s(row.title, "Item").slice(0, 24),
                description: s(row.description, "").slice(0, 72),
              };
            })
            .filter((r: any) => r.title);
          interactive.action = {
            button: listButtonText,
            sections: [{ title: sectionTitle, rows }],
          };
        } else {
          const buttons = jArr(dataObj.buttons)
            .map((x) => s(x))
            .filter(Boolean)
            .slice(0, 3);
          interactive.action = {
            buttons: buttons.map((title, i) => ({
              type: "reply",
              reply: { id: `btn_${i}`.trim(), title: title.slice(0, 20) },
            })),
          };
        }
        return interactive;
      };

      // CTA URL requires a valid URL; if missing, degrade gracefully to plain text
      if (interactiveType === "cta_url" && !ctaUrl) {
        await database.chatSession.update({
          where: { id: session.id },
          data: {
            lastNodeId: resolveLastNodeId(null),
            lastMessage: userMsg,
          },
        });
        return { reply: bodyText };
      }

      // Carousel requires at least 2 valid cards; otherwise degrade to text
      if (interactiveType === "carousel") {
        const built = await buildInteractivePayload();
        const validCards = Array.isArray(built?.action?.cards)
          ? built.action.cards.filter((c: any) => !!c)
          : [];
        if (validCards.length < 2) {
          await database.chatSession.update({
            where: { id: session.id },
            data: {
              lastNodeId: resolveLastNodeId(null),
              lastMessage: userMsg,
            },
          });
          return { reply: bodyText };
        }
      }

      if (isReturningToWaitingNode && session.lastNodeId === currentNodeId) {
        const userChoice = userMsg.trim();
        let matchedEdge =
          interactiveButtonId != null && interactiveButtonId !== ""
            ? outgoing.find(
                (e: any) =>
                  s(jObj(e.data).sourceHandle).toLowerCase().trim() ===
                  s(interactiveButtonId).toLowerCase().trim(),
              )
            : null;
        if (!matchedEdge) {
          matchedEdge = outgoing.find(
            (e: any) =>
              s(e.label).toLowerCase().trim() === userChoice.toLowerCase(),
          );
        }
        if (!matchedEdge) {
          // No connected node or no matching option: don't re-send the same interactive (avoids repeating the same message for every selection)
          await database.chatSession.update({
            where: { id: session.id },
            data: { lastNodeId: null, lastMessage: userMsg },
          });
          return { reply: "" };
        }
        currentNodeId = matchedEdge.target;
        continue;
      }

      const interactivePayload = await buildInteractivePayload();
      await database.chatSession.update({
        where: { id: session.id },
        data: {
          lastNodeId:
            interactiveType === "cta_url" || interactiveType === "carousel"
              ? resolveLastNodeId(null)
              : resolveLastNodeId(currentNodeId),
          lastMessage: userMsg,
        },
      });
      // If we ran Media (or other nodes) before this Interactive in the same run, send them first in order
      const hasPendingBeforeInteractive =
        messages.length > 0 || imagePayloads.length > 0;
      if (hasPendingBeforeInteractive) {
        const items: Array<
          | { type: "text"; text: string }
          | { type: "media"; text: string; images: any[] }
          | { type: "interactive"; interactive: any }
        > = [];
        if (messages.length > 0)
          items.push({ type: "text", text: messages.join("\n\n") });
        if (imagePayloads.length > 0)
          items.push({ type: "media", text: "", images: imagePayloads });
        items.push({ type: "interactive", interactive: interactivePayload });
        return { reply: JSON.stringify({ type: "sequence", items }) };
      }
      return {
        reply: { type: "interactive", interactive: interactivePayload },
      };
    }

    if (node.type === "waitForResponse") {
      const optionalMsg = s(dataObj.optionalMessage, "").trim();
      if (optionalMsg) messages.push(optionalMsg);
      if (isReturningToWaitingNode && session.lastNodeId === currentNodeId) {
        if (outgoing.length === 0) break;
        // Timeout path: follow edge with sourceHandle "timeout"; reply path: sourceHandle "out". Fallback: by position (outgoing[0]=reply, outgoing[1]=timeout).
        const isTimeout = userMsg === "__TIMEOUT__";
        const wantHandle = isTimeout ? "timeout" : "out";
        const matched = outgoing.find(
          (e: any) => s(jObj(e.data).sourceHandle) === wantHandle,
        );
        const fallback = isTimeout ? (outgoing[1] ?? outgoing[0]) : outgoing[0];
        const chosen = matched ?? fallback;
        if (chosen) {
          currentNodeId = chosen.target;
          continue;
        }
        break;
      }
      if (outgoing.length === 0) break;
      await database.chatSession.update({
        where: { id: session.id },
        data: {
          lastNodeId: resolveLastNodeId(currentNodeId),
          lastMessage: userMsg,
        },
      });
      break;
    }

    if (node.type === "template") {
      const templateName = s(dataObj.templateName, "");
      const language = s(dataObj.language, "en");
      const variables =
        dataObj.variables && typeof dataObj.variables === "object"
          ? (dataObj.variables as Record<string, string>)
          : {};
      const hasButtonEdges = outgoing.some((e: any) =>
        s(jObj(e.data).sourceHandle).startsWith("qr_"),
      );
      const templatePayload = {
        type: "template" as const,
        templateName,
        language,
        variables,
      };
      if (isReturningToWaitingNode && session.lastNodeId === currentNodeId) {
        const matchedEdge = outgoing.find(
          (e: any) =>
            s(e.label).toLowerCase().trim() === userMsg.toLowerCase().trim(),
        );
        if (!matchedEdge) {
          await database.chatSession.update({
            where: { id: session.id },
            data: {
              lastNodeId: resolveLastNodeId(currentNodeId),
              lastMessage: userMsg,
            },
          });
          return { reply: JSON.stringify(templatePayload) };
        }
        currentNodeId = matchedEdge.target;
        continue;
      }
      if (!templateName) break;
      const outEdge = outgoing.find(
        (e: any) =>
          s(jObj(e.data).sourceHandle) === "out" || !jObj(e.data).sourceHandle,
      );
      const nextNodeId = outEdge?.target ?? outgoing[0]?.target;
      if (hasButtonEdges) {
        await database.chatSession.update({
          where: { id: session.id },
          data: {
            lastNodeId: resolveLastNodeId(currentNodeId),
            lastMessage: userMsg,
          },
        });
      } else if (nextNodeId) {
        await database.chatSession.update({
          where: { id: session.id },
          data: {
            lastNodeId: resolveLastNodeId(nextNodeId),
            lastMessage: userMsg,
          },
        });
      }
      // If we have pending messages/media from previous nodes (e.g. Message before Template), send them first in order
      const hasPending = messages.length > 0 || imagePayloads.length > 0;
      if (hasPending) {
        const items: Array<
          | { type: "text"; text: string }
          | { type: "media"; text: string; images: any[] }
          | typeof templatePayload
        > = [];
        if (messages.length > 0)
          items.push({ type: "text", text: messages.join("\n\n") });
        if (imagePayloads.length > 0)
          items.push({ type: "media", text: "", images: imagePayloads });
        items.push(templatePayload);
        return { reply: JSON.stringify({ type: "sequence", items }) };
      }
      return { reply: JSON.stringify(templatePayload) };
    }

    if (node.type === "condition") {
      const result = evalExpr(s(dataObj.expr, ""), userMsg);
      const branch = result ? "true" : "false";
      let matchedEdge = outgoing.find(
        (e: any) => s(jObj(e.data).branch) === branch,
      );
      if (!matchedEdge && outgoing.length > 0) matchedEdge = outgoing[0];
      if (!matchedEdge) break;
      currentNodeId = matchedEdge.target;
      continue;
    }

    if (node.type === "ai") {
      const { reply, route } = await runAINode(
        s(dataObj.prompt, "You are helpful."),
        userMsg,
      );
      messages.push(reply);
      if (route && outgoing.length > 0) {
        const matched = outgoing.find(
          (e: any) => s(e.label).trim().toLowerCase() === route.toLowerCase(),
        );
        if (matched) {
          currentNodeId = matched.target;
          continue;
        }
      }
      if (outgoing.length > 0) {
        currentNodeId = outgoing[0].target;
        continue;
      }
      await database.chatSession.update({
        where: { id: session.id },
        data: { lastNodeId: resolveLastNodeId(null), lastMessage: userMsg },
      });
      break;
    }

    if (node.type === "action") {
      messages.push(
        `✅ Action: ${s(dataObj.method, "POST")} ${s(dataObj.url)}`,
      );
      if (outgoing.length === 0) {
        await database.chatSession.update({
          where: { id: session.id },
          data: { lastNodeId: resolveLastNodeId(null), lastMessage: userMsg },
        });
        break;
      }
      currentNodeId = outgoing[0].target;
      continue;
    }

    break;
  }

  let reply: string | object;
  if (buttonPayload) {
    // Return object so MessageService can send proper Meta interactive message (not raw JSON text)
    reply = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: String(buttonPayload.text || "").slice(0, 1024) },
        action: {
          buttons: (buttonPayload.buttons || [])
            .slice(0, 3)
            .map((title: string, i: number) => ({
              type: "reply",
              reply: {
                id: `btn_${i}`.trim(),
                title: String(title).slice(0, 20),
              },
            })),
        },
      },
    };
  } else if (imagePayloads.length > 0)
    reply = JSON.stringify({
      type: "media",
      text: messages.join("\n\n"),
      images: imagePayloads,
    });
  else if (messages.length > 0) reply = messages.join("\n\n");
  else reply = "";

  return { reply };
}
