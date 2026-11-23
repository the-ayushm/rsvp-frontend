/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker, Job } from "bullmq";
import connection from "@/lib/redisConnection";
import { MessageService } from "../services/message.service";
import { database } from "@/lib/database";

// export const connection = new IORedis({
//     host: process.env.REDIS_URL || '127.0.0.1',
//     port: 6379,
//     maxRetriesPerRequest: null
// });

const WEBHOOK_QUEUE_NAME = "wa-webhook-queue";

/**
 * BullMQ Worker to process webhooks.
 * This runs in a separate process or alongside the app.
 */
export const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job: Job) => {
    const { internalId, payload } = job.data;
    const metaId = job.id; // Deterministic ID

    console.log(
      `[WebhookWorker] 🚀 Processing Job ${metaId} (Internal Log: ${internalId})...`,
    );

    try {
      // 1. Update internal log status to PROCESSING
      await database.incomingWebhook.update({
        where: { id: internalId },
        data: { status: "PROCESSING" },
      });

      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value) {
        console.warn(
          `[WebhookWorker] ⚠️ No value found in payload for Job ${metaId}`,
        );
        await database.incomingWebhook.update({
          where: { id: internalId },
          data: { status: "FAILED", error: "Empty payload value" },
        });
        return;
      }

      // 2. Handle Status Updates (sent, delivered, read, failed)
      if (value.statuses?.[0]) {
        const s = value.statuses[0];
        console.log(
          `[WebhookWorker] Handling Status Update: ${s.id} -> ${s.status}`,
        );
        await MessageService.handleStatusUpdate(s.id, s.status, {
          timestamp: s.timestamp,
          errorCode: s.errors?.[0]?.code,
          errorMessage: s.errors?.[0]?.message,
        });
      }

      // 3. Handle Incoming Messages (text, media, buttons)
      if (value.messages?.[0]) {
        const m = value.messages[0];
        const contact = value.contacts?.[0];
        const metadata = value.metadata;
        console.log(
          `[WebhookWorker] Handling Inbound Message from ${m.from} (Type: ${m.type})`,
        );
        await MessageService.handleInbound(m, contact, metadata);
      }

      // 4. Mark as PROCESSED
      await database.incomingWebhook.update({
        where: { id: internalId },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      console.log(`[WebhookWorker] ✅ Successfully processed Job ${metaId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[WebhookWorker] ❌ Error Job ${metaId}:`, error.message);

      // Mark internal log as FAILED but allow BullMQ to retry the job
      await database.incomingWebhook.update({
        where: { id: internalId },
        data: { status: "FAILED", error: error.message },
      });

      throw error; // Rethrow triggers retry
    }
  },
  {
    connection: connection as any,
    concurrency: parseInt(process.env.WEBHOOK_CONCURRENCY || "10"),
  },
);

webhookWorker.on("failed", (job, err) => {
  console.error(
    `[WebhookWorker] 🚨 Job ${job?.id} failed permanently after retries: ${err.message}`,
  );
});
