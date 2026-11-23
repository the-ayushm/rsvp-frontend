/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from "@/lib/database";
import { UserStatus } from "@/lib/database/records";
export interface MetaTemplate {
  name: string;
  components: any[];
  language: string;
  status: string;
  category: string;
  id: string;
}
function mapMetaStatusToEnum(status: string): UserStatus {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "ACTIVE"; // Map Meta APPROVED to your enum ACTIVE
    case "REJECTED":
      return "REJECTED";
    case "PENDING":
      return "PENDING"; // Submitted, awaiting Meta approval
    case "ARCHIVED":
    case "DELETED":
      return "INACTIVE";
    default:
      return "INACTIVE"; // fallback
  }
}

/**
 * Fetch a single template's status from Meta by template ID.
 */
async function fetchTemplateStatusFromMeta(
  metaTemplateId: string,
  accessToken: string,
  apiVersion: string = "v22.0",
): Promise<{ status: string; rejection_reason?: string; quality_score?: any } | null> {
  const url = `https://graph.facebook.com/${apiVersion}/${metaTemplateId}?fields=status,rejection_reason,quality_score`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error(`[TemplateStatusCron] Meta API error for ${metaTemplateId}:`, await response.text());
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`[TemplateStatusCron] Failed to fetch ${metaTemplateId}:`, error);
    return null;
  }
}

/**
 * Sync status of templates that are PENDING (submitted for approval).
 * Only runs when there are pending templates. Fetches each from Meta and updates DB.
 * Called by templateStatusCron.
 */
export async function syncPendingTemplatesStatus(): Promise<{
  checked: number;
  updated: number;
  errors: string[];
}> {
  const pendingTemplates = await database.whatsAppTemplate.findMany({
    where: {
      status: "PENDING",
      metaTemplateId: { not: null },
    },
    include: {
      whatsappAccount: true,
    },
  });

  if (pendingTemplates.length === 0) {
    return { checked: 0, updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: string[] = [];

  for (const template of pendingTemplates) {
    const account = template.whatsappAccount;
    if (!account?.accessToken || !template.metaTemplateId) continue;

    try {
      const metaData = await fetchTemplateStatusFromMeta(
        template.metaTemplateId,
        account.accessToken,
        account.apiVersion || "v22.0",
      );

      if (!metaData || !metaData.status) continue;

      const newStatus = mapMetaStatusToEnum(metaData.status);

      // Only update if status changed (e.g. PENDING -> ACTIVE or REJECTED)
      if (newStatus !== "PENDING" && newStatus !== template.status) {
        await database.whatsAppTemplate.update({
          where: { id: template.id },
          data: {
            status: newStatus,
            rejectionReason: metaData.rejection_reason ?? template.rejectionReason,
            qualityRating:
              metaData.quality_score?.score ?? template.qualityRating ?? "UNKNOWN",
          },
        });
        updated++;
        console.log(
          `[TemplateStatusCron] Template "${template.name}" ${template.status} -> ${newStatus}`,
        );
      }

      // Small delay to avoid rate limiting Meta API
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      const msg = `Template ${template.id} (${template.name}): ${e instanceof Error ? e.message : "Unknown error"}`;
      errors.push(msg);
      console.error(`[TemplateStatusCron]`, msg);
    }
  }

  return {
    checked: pendingTemplates.length,
    updated,
    errors,
  };
}
export async function fetchTemplatesFromMeta(
  wabaId: string,
  accessToken: string,
  apiVersion: string = "v22.0",
): Promise<MetaTemplate[]> {
  const fields =
    "name,components,language,status,category,id,rejection_reason,quality_score";
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=${fields}`;

  // Pagination handling might be needed for large numbers of templates,
  // but for now we'll fetch the first page. Meta usually returns a decent amount.
  // To be robust we should handle 'next' paging.

  let allTemplates: MetaTemplate[] = [];
  let nextUrl = url;

  try {
    while (nextUrl) {
      console.log(`[Meta Sync] Fetching: ${nextUrl}`);
      const response = await fetch(nextUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error fetching templates from Meta:", errorData);
        throw new Error(`Meta API Error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log(`[Meta Sync] Received ${data.data?.length} templates`);

      // Log a sample if there are templates
      if (data.data?.length > 0) {
        const sample = data.data.find((t: any) => t.status === "REJECTED");
        if (sample) {
          console.log(
            `[Meta Sync] Debug REJECTED Template:`,
            JSON.stringify(sample, null, 2),
          );
        }
      }

      allTemplates = [...allTemplates, ...data.data];

      // Check for pagination
      nextUrl = data.paging?.next || null;

      // Safety break to prevent infinite loops if something goes wrong with nextUrl
      if (allTemplates.length > 500) break;
    }
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    throw error;
  }

  return allTemplates;
}

export async function syncTemplatesForUser(userId: number) {
  // 1. Get Active WhatsApp Accounts
  const accounts = await database.whatsAppAccount.findMany({
    where: {
      userId: userId,
      isActive: true,
    },
  });

  if (accounts.length === 0) {
    throw new Error("No active WhatsApp accounts found for this user.");
  }

  const results = [];

  for (const account of accounts) {
    try {
      if (!account.wabaId) {
        console.warn(`Account ${account.id} missing WABA ID, skipping.`);
        continue;
      }

      const metaTemplates = await fetchTemplatesFromMeta(
        account.wabaId,
        account.accessToken,
        account.apiVersion || "v22.0",
      );

      // 2. Sync to DB
      // We will process each template.
      // The schema has a unique constraint on [whatsappAccountId, name].
      // Meta templates have a unique name per WABA mostly, but language is also a factor.
      // Wait, the schema `@@unique([whatsappAccountId, name])` assumes name is unique per account.
      // WhatsApp templates ARE unique by name within a WABA. Language is a variation of the same template name?
      // Actually, in Meta, "name" is the key. You can have multiple languages for the same "name".
      // If the schema constraint is (whatsappAccountId, name), then we store one row per *name*?
      // But the schema has a `language` string field.
      // If I have template "hello_world" in "en" and "es", I can only store one if the constraint is just on name.
      // Let's check the schema again.
      // `  @@unique([whatsappAccountId, name])` -> Yes.
      // This implies the current data model might not support multiple languages for the same template name properly if we want to store them as separate rows.
      // OR we just store the "default" one, or the first one we find.
      // For now, I will abide by the schema. I will update the existing record if it matches the name.

      let syncedCount = 0;

      for (const t of metaTemplates) {
        let rejectionReason =
          (t as any).rejection_reason || (t as any).reason || null;

        // Fallback: If REJECTED but no reason, fetch individual template node
        if (t.status === "REJECTED" && !rejectionReason) {
          try {
            const detailUrl = `https://graph.facebook.com/${account.apiVersion || "v22.0"}/${t.id}?fields=rejection_reason,status`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Bearer ${account.accessToken}` },
            });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              rejectionReason =
                detailData.rejection_reason || detailData.reason || null;
              console.log(
                `[Meta Sync] Individual fetch for ${t.name} (REJECTED): reason=${rejectionReason}`,
              );
            }
          } catch (detailErr) {
            console.error(
              `[Meta Sync] Failed to fetch individual details for ${t.name}:`,
              detailErr,
            );
          }
        }

        await database.whatsAppTemplate.upsert({
          where: {
            whatsappAccountId_name: {
              whatsappAccountId: account.id,
              name: t.name,
            },
          },
          update: {
            metaTemplateId: t.id,
            status: mapMetaStatusToEnum(t.status),
            category: t.category,
            language: t.language,
            components: t.components || [],
            qualityRating: (t as any).quality_score?.score || "UNKNOWN",
            rejectionReason: rejectionReason,
          },
          create: {
            whatsappAccountId: account.id,
            metaTemplateId: t.id,
            name: t.name,
            status: mapMetaStatusToEnum(t.status),
            category: t.category,
            language: t.language,
            isDefault: false,
            components: t.components || [],
            qualityRating: (t as any).quality_score?.score || "UNKNOWN",
            rejectionReason: rejectionReason,
          },
        });
        syncedCount++;
      }
      results.push({ accountId: account.id, synced: syncedCount });
    } catch (e) {
      console.error(`Error syncing for account ${account.id}:`, e);
      results.push({
        accountId: account.id,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return results;
}
