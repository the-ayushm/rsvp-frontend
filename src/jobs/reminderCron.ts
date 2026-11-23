import cron from "node-cron";
import { ReminderService } from "../services/reminder.service";
import { MessageService } from "../services/message.service";
import { database } from "../lib/database";

/**
 * Background job that runs every minute: reminders + Wait for Response timeouts.
 */
export function initReminderCron() {
  console.log("⏰ Initializing Cron Jobs (Every 1 minute)");

  cron.schedule("* * * * *", async () => {
    try {
      const result = await ReminderService.runDueReminders();
      if (result.sent > 0) {
        console.log(`[ReminderCron] Processed ${result.sent} reminders.`);
      }
    } catch (err) {
      console.error("[ReminderCron] Error in execution:", err);
    }

    try {
      const timeoutResult =
        await MessageService.processWaitForResponseTimeouts(database);
      if (timeoutResult.processed > 0) {
        console.log(
          `[ReminderCron] Processed ${timeoutResult.processed} wait-for-response timeouts.`,
        );
      }
    } catch (err) {
      console.error("[ReminderCron] Wait-for-response timeout error:", err);
    }
  });
}
