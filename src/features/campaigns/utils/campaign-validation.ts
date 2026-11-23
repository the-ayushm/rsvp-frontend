export const CAMPAIGN_CONTACT_GUIDANCE = "Choose contacts or contact lists for this campaign.";

export function mergeContactSelection(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming])];
}

export function countCampaignPhoneNumbers(numbers: string[]): number {
  return new Set(numbers.map(phone => phone.replace(/\D/g, "")).filter(Boolean)).size;
}

export function getPreviewRecipientCount(response: unknown): number {
  const root = response as Record<string, unknown> | null;
  const payload = (root?.data ?? root) as Record<string, unknown> | null;
  const count = payload?.total_recipients ?? payload?.total_contacts ?? payload?.total ?? payload?.count;
  if ((typeof count === "number" || (typeof count === "string" && count.trim())) && Number.isSafeInteger(Number(count)) && Number(count) >= 0) {
    return Number(count);
  }
  // A preview can be paginated; its visible rows are not a reliable audience total.
  throw new Error("Unable to verify the audience size. Please retry before continuing.");
}

function validationMessages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(validationMessages);
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  if (item.message || item.msg) return validationMessages(item.message ?? item.msg);
  return Object.values(item).flatMap(validationMessages);
}

export function getCampaignErrorMessage(error: unknown): string {
  const exception = error as { response?: { data?: Record<string, unknown> }; message?: string } | null;
  const data = exception?.response?.data;
  const nested = data?.error && typeof data.error === "object" ? data.error as Record<string, unknown> : undefined;
  const details = validationMessages(data?.errors ?? data?.validation_errors ?? nested?.errors ?? nested?.details ?? data?.detail ?? (Array.isArray(data?.message) ? data.message : undefined));
  if (details.length) return [...new Set(details)].join(" ");
  const messages = [data?.message, nested?.message, data?.error, exception?.message];
  return messages.find((message): message is string => typeof message === "string" && Boolean(message.trim()))
    || "Failed to create campaign. Please try again.";
}
