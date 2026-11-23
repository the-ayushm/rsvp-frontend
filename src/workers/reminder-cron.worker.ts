/**
 * Standalone Reminder Cron Worker
 *
 * Runs reminders + Wait for Response timeouts (every 1 min).
 * Run as a separate PM2 process - single starting point via ecosystem.config.cjs.
 */
import "dotenv/config";
import { initReminderCron } from "../jobs/reminderCron";

console.log("🔄 [ReminderCronWorker] Starting...");
initReminderCron();
console.log("✅ [ReminderCronWorker] Reminder cron is running (every 1 min)");
