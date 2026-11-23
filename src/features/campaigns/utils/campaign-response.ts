function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function getCreatedCampaignId(response: unknown): string | null {
  const root = record(response);
  const data = record(root?.data);
  if (!root || root.success === false || data?.success === false) return null;

  // Prefer the campaign record over an envelope's generic id.
  for (const item of [record(data?.campaign), record(root.campaign), data, root]) {
    for (const candidate of [item?.campaign_id, item?.campaignId, item?.id, item?._id]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      if (typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0) return String(candidate);
    }
  }
  return null;
}
