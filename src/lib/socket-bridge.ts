/* eslint-disable @typescript-eslint/no-explicit-any */
import IORedis from "ioredis";
import { Server as IOServer } from "socket.io";
import { emitScopedSocketEvent } from "./socket-event-scope";

const SOCKET_CHANNEL = "socket-events";

const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    if (times > 3) return null; // stop retrying after 3 attempts
    return Math.min(times * 500, 3000);
  },
  lazyConnect: true,
};

// Redis publisher (used by workers)
let publisher: IORedis | null = null;
let publisherErrorLogged = false;

function getPublisher(): IORedis {
  if (!publisher) {
    const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || "redis://localhost:6379";
    publisher = new IORedis(redisUrl, redisOptions);
    publisher.on("error", (err) => {
      if (!publisherErrorLogged) {
        console.warn("[SocketBridge] Redis publisher unavailable:", err.message);
        publisherErrorLogged = true;
      }
    });
    publisher.connect().catch(() => {});
    console.log("[SocketBridge] 📡 Publisher connecting to Redis...");
    publisher.on("error", (err) => {
      console.warn("[SocketBridge] Redis publisher error:", err.message);
    });
    console.log("[SocketBridge] 📡 Publisher connected to Redis");
  }
  return publisher;
}

/**
 * Publish a socket event via Redis (called from workers)
 */
export async function publishSocketEvent(event: string, data: any) {
  try {
    const message = JSON.stringify({ event, data });
    await getPublisher().publish(SOCKET_CHANNEL, message);
    console.log(
      `[SocketBridge] 📤 Published ${event}:`,
      typeof data === "object" && data?.id ? `id=${data.id}` : "",
    );
  } catch (error) {
    console.error("[SocketBridge] ❌ Failed to publish:", error);
  }
}

/**
 * Initialize Redis subscriber and forward events to Socket.IO
 * (called from main server process)
 */
let subscriberErrorLogged = false;

export function initSocketBridge(io: IOServer) {
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || "redis://localhost:6379";
  const subscriber = new IORedis(
    redisUrl,
    {
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 500, 3000);
      },
    },
  );

  subscriber.on("error", (err) => {
    if (!subscriberErrorLogged) {
      console.warn("[SocketBridge] Redis subscriber unavailable:", err.message, "(further errors suppressed)");
      subscriberErrorLogged = true;
    }
  });

  subscriber.subscribe(SOCKET_CHANNEL, (err, count) => {
    if (err) {
      console.error("[SocketBridge] ❌ Failed to subscribe:", err);
    } else {
      console.log(`[SocketBridge] 📡 Subscribed to ${count} channel(s)`);
    }
  });

  subscriber.on("message", (channel, message) => {
    if (channel === SOCKET_CHANNEL) {
      try {
        const { event, data } = JSON.parse(message);
        if (!emitScopedSocketEvent(io, event, data)) {
          console.warn(`[SocketBridge] Dropped ${event}: missing or conflicting user ID`);
        }
      } catch (error) {
        console.error("[SocketBridge] ❌ Failed to parse message:", error);
      }
    }
  });

  console.log("[SocketBridge] ✅ Socket bridge initialized");
}
