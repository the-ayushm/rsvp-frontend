/**
 * Standalone Template Status Worker

* Runs the template status cron (checks PENDING templates from Meta every 15 min).
 * Run as a separate PM2 process - no need to change the main app.
 */
import "dotenv/config";
import { initTemplateStatusCron } from "../jobs/templateStatusCron";

console.log("🔄 [TemplateStatusWorker] Starting...");
initTemplateStatusCron();
console.log("✅ [TemplateStatusWorker] Template status cron is running (every 15 min)");
