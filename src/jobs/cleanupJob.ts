import cron from "node-cron";
import { cleanupResolvedTickets } from "../lib/cleanupTickets";

/**
 * Hourly cron job: deletes RESOLVED support tickets whose resolvedAt is > 24h ago.
 * Schedule: "0 * * * *" → top of every hour.
 */
export function initCleanupJob() {
  console.log("🧹 [CleanupJob] Initializing ticket cleanup cron (every 1 hour)");

  cron.schedule("0 * * * *", async () => {
    console.log("[CleanupJob] Running resolved ticket cleanup...");
    await cleanupResolvedTickets();
  });
}
