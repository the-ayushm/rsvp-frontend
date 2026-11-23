import cron from "node-cron";
import { syncPendingTemplatesStatus } from "../lib/whatsapp-templates";

/**
 * Cron that checks status of templates submitted for approval (PENDING).
 * Only runs when there are PENDING templates in the DB.
 * Schedule: every 15 minutes (templates typically take hours to approve).
 */
export function initTemplateStatusCron() {
  console.log("⏰ [TemplateStatusCron] Initializing (every 15 min)");

  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await syncPendingTemplatesStatus();

      if (result.checked > 0) {
        console.log(
          `[TemplateStatusCron] Checked ${result.checked} pending templates, updated ${result.updated}`,
        );
        if (result.errors.length > 0) {
          console.error("[TemplateStatusCron] Errors:", result.errors);
        }
      }
    } catch (err) {
      console.error("[TemplateStatusCron] Error:", err);
    }
  });
}
