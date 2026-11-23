/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from "bullmq";
import connection from "./redisConnection";

// export const connection = new IORedis({
//     host: process.env.REDIS_URL || '127.0.0.1',
//     port: 6379,
//     maxRetriesPerRequest: null
// })

export const campaignQueue = new Queue("campaign-sending", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
  },
});

export const reminderQueue = new Queue("reminder-queue", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
  },
});

export const webhookQueue = new Queue("wa-webhook-queue", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 10s, 20s...
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueWebhook(
  metaId: string,
  internalId: number,
  payload: any,
) {
  // Deterministic Job ID for strict idempotency at the queue level
  const jobId = metaId;

  try {
    await webhookQueue.add(
      "process-webhook",
      { internalId, payload },
      { jobId }, // BullMQ will ignore duplicates with the same jobId
    );
    console.log(
      `[WebhookQueue] Enqueued Job: ${jobId} (Internal: ${internalId})`,
    );
  } catch (error: any) {
    console.error(
      `[WebhookQueue] Failed to enqueue Job ${jobId}:`,
      error.message,
    );
    throw error;
  }
}
