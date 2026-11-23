# Chatbot: Save & Incoming Message Flow

## 1. Saving the chatbot (builder)

**Yes, the chatbot is saved** when you click **Save** in the builder.

- **Frontend:** `BuilderCanvasInner` calls `PUT /api/chatbots/${bot.id}` with `{ name: bot.name, nodes, edges }`.
- **Backend:** `src/app/api/chatbots/[id]/route.ts` (PUT):
  - Verifies the chatbot belongs to the current user.
  - Replaces all nodes and edges in the DB (delete existing `ChatbotNode` / `ChatbotEdge`, then create new ones from the payload).
  - Node `data` (including media `mediaItems` with `galleryMediaId`, `previewUrl`, `caption`, `filename`, etc.) is stored as JSON on each `ChatbotNode`.

So the flow you build (trigger, message, template, media, condition, etc.) and all node settings are persisted.

---

## 2. How incoming messages run the chatbot (all in worker, no API call)

When a customer sends a WhatsApp message:

1. **Meta** sends the webhook to your app (e.g. `POST /api/webhook/whatsapp`).
2. The app enqueues the payload to **BullMQ** and returns 200.
3. The **webhook worker** (`src/workers/webhook.worker.ts`) processes the job and calls **MessageService.handleInbound()**.
4. **MessageService.handleInbound()**:
   - Normalizes the message, finds the **client** (`userId` from the WhatsApp account that received the message).
   - Finds or creates **contact** and **conversation**, then **saves the incoming message** to the DB and emits real-time events.
   - Finds the client’s **published** chatbot: `database.chatbot.findFirst({ where: { userId, published: true } })`.
   - If found, runs the flow **in-process** (no HTTP): **`runChatbotFlow(database, { chatbotId, userId, message, sessionKey: from })`** (`src/lib/chatbot/run-flow.ts`).
   - Flow: load bot (nodes, edges), resolve/create session by `sessionKey` (customer phone). For a **new conversation**, start at the **trigger** node and check trigger conditions (e.g. keyword); for a **returning** conversation, continue from the last waiting node. Run nodes (message, image, media, button, condition, AI, action) and build a **reply** (text or JSON for buttons/media).
   - If there is a **reply**, sends it via **`sendWhatsAppReply(database, userId, from, textToSend)`** (`src/lib/chatbot/send-reply.ts`).
   - **Stores the outbound chatbot reply** as a **Message** (conversationId, contactId, userId, text, direction: `outgoing`, sentBy: `chatbot`, status: `sent`, and optional `whatsappMessageId` from Meta). Also emits a real-time `new_message` event so the UI can update.

So: **incoming message → worker → handleInbound → save inbound message → find published chatbot → run flow in-process → send reply via WhatsApp → save outbound message.**

There is **no** call to `/api/chatbots/trigger` or `/api/chatbots/[id]/run` from the worker; everything runs inside the worker process.

---

## 3. Run API (for UI / testing only)

- **POST /api/chatbots/[id]/run** is used by the builder or other callers to run the same flow and get `{ reply }` (e.g. for testing). It calls **`runChatbotFlow(database, …)`** and returns the reply. It does **not** send WhatsApp or create Message records; it’s for simulation/preview.

---

## 4. What you need to configure

1. **Publish the chatbot**  
   Only bots with `published: true` are used for incoming messages. Publish the bot you want to respond.

2. **Environment variables** (see `.env.example`):
   - **`INTERNAL_CHATBOT_SECRET`** (optional)  
     Used by **POST /api/chatbots/[id]/run** for internal/cookie-less auth (e.g. when the run API is called with header `X-Internal-Chatbot-Auth` and body `userId`). Not required for the main flow (worker runs flow in-process).
   - **`APP_URL`**  
     Not used by the chatbot flow. Only needed if you have other features that call your app by URL.

3. **Webhook worker**  
   Ensure the BullMQ worker that processes the WhatsApp webhook queue is running (e.g. `npm run worker`), so **MessageService.handleInbound** runs and the chatbot flow and reply send happen there.

---

## 5. Current limits

- **One published chatbot per user**  
  The most recently updated **published** chatbot for the `userId` (from the WhatsApp account that received the message) is used.
- **Reply format**  
  When sending to WhatsApp, only the **text** part of the reply is sent (e.g. from `type: "media"` we send the `text` field). Full media/buttons could be added later in `sendWhatsAppReply`.
- **Session**  
  Session is keyed by `sessionKey` (customer phone), so each phone number has its own conversation state.

---

## 6. Quick checklist

- [ ] Chatbot built and **Save** used in the builder.
- [ ] Chatbot **published**.
- [ ] Webhook worker running so incoming messages are processed and the flow runs in the worker.
- [ ] Outbound chatbot replies are stored as **Message** with `sentBy: "chatbot"` and appear in conversation history.
