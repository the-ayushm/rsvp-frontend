/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from "bullmq";
import { database } from "../lib/database";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import connection from "@/lib/redisConnection";
import { getTemplateVariables } from "@/lib/template-utils";

// export const connection = new IORedis({
//     host: process.env.REDIS_URL || '127.0.0.1',
//     port: 6379,
//     maxRetriesPerRequest: null
// })

let worker: Worker | null = null;

console.log("🚀 Campaign Worker Started & Listening for Jobs...");

export const initCampaignWorker = () => {
  if (worker) return;

  worker = new Worker(
    "campaign-sending",
    async (job) => {
      const { campaignId } = job.data;

      const campaign = await database.campaign.findUnique({
        where: {
          id: campaignId,
        },
      });

      if (!campaign || !campaign.audienceData) {
        return;
      }

      const { contactIds } = campaign.audienceData as any;

      await database.campaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status: "sending",
        },
      });

      for (const contactId of contactIds) {
        const contact = await database.contact.findUnique({
          where: {
            id: contactId,
          },
        });

        if (!contact || !contact.phone) {
          continue;
        }

        try {
          const templateRecord = await database.whatsAppTemplate.findUnique({
            where: { id: parseInt(campaign.selectedTemplate as string) },
          });

          if (!templateRecord) {
            throw new Error(
              `Template with ID ${campaign.selectedTemplate} not found in DB`,
            );
          }

          const components = templateRecord.components as any[];
          const headerComponent = components?.find(
            (c) =>
              c.type === "HEADER" &&
              ["IMAGE", "VIDEO", "DOCUMENT"].includes(c.format),
          );
          // Fixed header: don't pass media - Meta uses approved example
          // Dynamic header: use campaign.headerMediaUrl (URL or media ID from upload)
          const headerMode = (templateRecord as any).headerMode;
          const headerImageUrl =
            headerMode === "dynamic" && headerComponent
              ? (campaign as any).headerMediaUrl || undefined
              : undefined;

          // Resolve template variables using campaign.variableMapping (same logic as execute route)
          const templateVariables = getTemplateVariables(
            (templateRecord.components as any[]) || [],
          );
          const variableMapping =
            (campaign as any).variableMapping as Record<
              string,
              { type: "field" | "static"; value: string }
            > || {};

          const parameters: string[] = templateVariables.map((v) => {
            const mapping = variableMapping[v.name];
            if (!mapping) return "";

            if (mapping.type === "static") {
              return mapping.value || "";
            }

            if (mapping.type === "field") {
              return String((contact as any)[mapping.value] || "");
            }

            return "";
          });

          await sendWhatsAppTemplate(
            contact.phone,
            templateRecord.name,
            templateRecord.language,
            campaign.userId,
            parameters,
            campaign.id,
            contact.id,
            headerImageUrl,
            (campaign as any).whatsappAccountId ?? undefined,
          );
          // const conv = await database.conversation.upsert({
          //     where: {
          //         userId_phone:{
          //             userId: campaign.userId, phone: contact.phone
          //         }
          //     },
          //     update: {},
          //     create:{
          //         phone: contact.phone,
          //         name: contact.name,
          //         userId: campaign.userId
          //     }
          // })

          // await database.message.create({
          //     data: {
          //         conversationId: conv.id,
          //         contactId: contact.id,
          //         content: `Template`,
          //         userId: campaign.userId,
          //         direction: "outbound",
          //         status: "sent",
          //         sentBy: "me",
          //         from: "system",
          //         text: `Hello System how are you`,
          //         senderId: "me",
          //         receiverId: contact.phone
          //     }
          // })

          await database.campaign.update({
            where: {
              id: campaignId,
            },
            data: {
              sentCount: {
                increment: 1,
              },
            },
          });

          await new Promise((res) => setTimeout(res, 500));
        } catch (error) {
          console.error("Error sending to: ", contact.phone, error);

          await database.campaign.update({
            where: {
              id: campaignId,
            },
            data: {
              failedCount: {
                increment: 1,
              },
            },
          });
        }
      }

      await database.campaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status: "completed",
        },
      });
    },
    { connection: connection as any, concurrency: 1 },
  );

  worker.on("active", (job) => {
    console.log(`[ACTIVE] Job ${job.id} started processing.`);
  });

  // 2. When progress is updated
  worker.on("progress", (job, progress) => {
    console.log(`[PROGRESS] Job ${job.id} is done.`);
  });

  // 3. When a job is COMPLETELY finished
  worker.on("completed", (job, result) => {
    console.log(`✅ [COMPLETED] Job ${job.id} finished!`);
  });

  // 4. When a job FAILS
  worker.on("failed", (job, err) => {
    console.error(`❌ [FAILED] Job ${job?.id} failed: ${err.message}`);
  });

  // 5. Error handling for the worker itself
  worker.on("error", (err) => {
    console.error(`🔥 [WORKER ERROR] ${err.message}`);
  });
};

initCampaignWorker();
