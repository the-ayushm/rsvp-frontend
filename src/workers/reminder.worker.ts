/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { Worker } from "bullmq";
import { database } from "../lib/database";
import connection from "@/lib/redisConnection";
import { reminderQueue } from "@/lib/queue";
import { TemplateService } from "../services/template.service";
import { UserStatus } from "@/lib/database/records";

// export const connection = new IORedis({
//     host: process.env.REDIS_URL || '127.0.0.1',
//     port: 6379,
//     maxRetriesPerRequest: null
// });

let reminderWorker: Worker | null = null;

export const initReminderWorker = () => {
  if (reminderWorker) return;

  reminderWorker = new Worker(
    "reminder-queue",
    async (job) => {
      const { reminderId } = job.data;

      // 1. Fetch Reminder with Contact and User info
      const reminder = await database.contactReminder.findUnique({
        where: { id: reminderId },
        include: {
          contact: true,
          user: true,
        },
      });

      if (!reminder || !reminder.contact || (reminder.remainingCount ?? 0) <= 0)
        return;

      try {
        // 2. UPSERT Conversation based on unique [userId, phone]
        // We use the contact's phone and the user's ID
        const conv = await database.conversation.upsert({
          where: {
            userId_phone: {
              userId: reminder.userId,
              phone: reminder.contact.phone || "",
            },
          },
          update: {}, // No updates needed if it exists
          create: {
            userId: reminder.userId,
            phone: reminder.contact.phone || "",
            name: reminder.contact.name,
            contactId: reminder.contactId,
          },
        });

        const config = await database.whatsAppAccount.findFirst({
          where: {
            userId: reminder.userId,
          },
        });

        if (!config) throw new Error("No active WhatsApp account for reminder");

        // Meta requires template messages for automation reminders - use TemplateService
        const templateName = (reminder as any).templateName;
        const language = (reminder as any).language || "en";
        let variables: Record<string, string> = ((reminder as any).variables as Record<string, string>) || {};

        // Resolve {{1}} or "name" variable: use contact name when empty (common personalization)
        if ((!variables["1"] && !variables["name"]) || variables["1"] === "" || variables["name"] === "") {
          variables = { ...variables };
          if (!variables["1"]) variables["1"] = reminder.contact.name || "";
          if (!variables["name"]) variables["name"] = reminder.contact.name || "";
        }

        if (!templateName) {
          throw new Error("Reminder must use a WhatsApp template. Free-form messages are not allowed by Meta for automation.");
        }

        await TemplateService.sendTemplate(
          {
            userId: reminder.userId,
            contactId: reminder.contactId,
            templateName,
            language,
            variables,
            reminderId: reminder.id,
            sentBy: "reminder",
          },
          database,
        );

        // 4. Update Reminder state
        const updated = await database.contactReminder.update({
          where: { id: reminderId },
          data: {
            remainingCount: (reminder.remainingCount ?? 1) - 1,
            triggered: true,
            status:
              (reminder.remainingCount ?? 1) - 1 === 0
                ? UserStatus.COMPLETED
                : UserStatus.PENDING,
          },
        });

        // 5. Handle Repeated Logic (Recursion)
        if (
          updated.scheduleType === "repeated" &&
          (updated.remainingCount ?? 0) > 0
        ) {
          const nextDate = calculateNextRun(updated);
          const nextTs = nextDate.getTime();
          const delay = Math.max(0, nextDate.getTime() - Date.now());

          await reminderQueue.add(
            "process-reminder",
            { reminderId: updated.id },
            {
              delay,
              jobId: `reminder-${updated.id}-${nextTs}`,
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        }
        console.log("Completed");
        return { success: true, message: "WhatsApp triggered" };
      } catch (error) {
        console.error(`[REMINDER ERROR] ID: ${reminderId}`, error);
        throw error;
      }
    },
    { connection: connection as any, concurrency: 5 },
  );

  reminderWorker.on("active", (job) => {
    console.log(`[ACTIVE] Job ${job.id} started processing.`);
  });

  // 3. When a job is COMPLETELY finished
  reminderWorker.on("completed", (job, result) => {
    console.log(`✅ [COMPLETED] Job ${job.id} finished!`);
  });

  // 4. When a job FAILS
  reminderWorker.on("failed", (job, err) => {
    console.error(`❌ [FAILED] Job ${job?.id} failed: ${err.message}`);
  });

  // 5. Error handling for the worker itself
  reminderWorker.on("error", (err) => {
    console.error(`🔥 [WORKER ERROR] ${err.message}`);
  });
};

// --- Helper Functions ---

export function calculateNextRun(reminder: any) {
  let date = new Date();
  const [hour, minute] = (reminder.startTime || "00:00").split(":");
  date.setHours(parseInt(hour), parseInt(minute), 0, 0);

  // If the time today has passed, move to tomorrow
  if (date.getTime() <= Date.now()) {
    if (reminder.frequency === "daily") {
      date.setDate(date.getDate() + 1);
    } else if (reminder.frequency === "weekly" && reminder.selectedDays) {
      date.setDate(date.getDate() + 1);
      return getNextWeeklyDay(date, reminder.selectedDays as string[]);
    } else if (reminder.frequency === "monthly") {
      date.setMonth(date.getMonth() + 1);
    } else if (reminder.frequency === "yearly") {
      date.setFullYear(date.getFullYear() + 1);
    }
  }

  return date;
}

export function getNextWeeklyDay(startDate: Date, selectedDays: string[]) {
  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const targetDays = selectedDays.map((d) => dayMap[d]);
  let checkDate = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    if (targetDays.includes(checkDate.getDay())) return checkDate;
    checkDate.setDate(checkDate.getDate() + 1);
  }
  return checkDate;
}

initReminderWorker();
