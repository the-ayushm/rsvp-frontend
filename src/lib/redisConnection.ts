import "dotenv/config";
import Redis from "ioredis";

// Use placeholder during build when env is not set (build doesn't connect)
const redisUrl =
  process.env.REDIS_URL || "redis://localhost:6379";

let redisErrorLogged = false;

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  keepAlive: 1000,
  connectTimeout: 10000,
  retryStrategy: () => null, // Don't retry if connection fails (e.g. during build)
});

connection.on("error", (err) => {
  if (!redisErrorLogged) {
    console.warn("[Redis] Connection unavailable:", err.message, "(further errors suppressed)");
    redisErrorLogged = true;
  }
  console.warn("[Redis] Connection error (is Redis running?):", err.message);
});

export default connection;
