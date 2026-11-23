import { database } from "@/lib/database";

export async function cleanupResolvedTickets(): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const result = await database.support_tickets.deleteMany({
      where: {
        status: "RESOLVED",
        resolvedAt: {
          lt: cutoff,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[CleanupJob] Deleted ${result.count} resolved ticket(s) older than 24h`);
    }
  } catch (error) {
    console.error("[CleanupJob] Failed to clean up resolved tickets:", error);
  }
}