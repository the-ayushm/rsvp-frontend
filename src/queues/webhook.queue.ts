import { Queue } from "bullmq";
import IORedis from "ioredis";

let webhookRedisErrorLogged = false;

const connection = new IORedis(process.env.UPSTASH_REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 500, 3000);
    },
});

connection.on("error", (err) => {
    if (!webhookRedisErrorLogged) {
        console.warn("[WebhookQueue] Redis unavailable:", err.message, "(further errors suppressed)");
        webhookRedisErrorLogged = true;
    }
});
connection.on("error", (err) => {
    console.warn("[WebhookQueue] Redis connection error:", err.message);
});

export const WEBHOOK_QUEUE_NAME = "wa-webhook-queue";

// Create the queue
export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
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

/**
 * Enqueue a webhook for asynchronous processing.
 * @param metaId Unique ID from Meta (message_id or status_id)
 * @param internalId Database ID from IncomingWebhook table
 * @param payload Raw webhook payload
 */
export async function enqueueWebhook(metaId: string, internalId: number, payload: any) {
    // Deterministic Job ID for strict idempotency at the queue level
    const jobId = metaId;

    try {
        await webhookQueue.add(
            "process-webhook",
            { internalId, payload },
            { jobId } // BullMQ will ignore duplicates with the same jobId
        );
        console.log(`[WebhookQueue] Enqueued Job: ${jobId} (Internal: ${internalId})`);
    } catch (error: any) {
        console.error(`[WebhookQueue] Failed to enqueue Job ${jobId}:`, error.message);
        throw error;
    }
}
