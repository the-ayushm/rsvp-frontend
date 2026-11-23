import { asRecord, normalizeJobSnapshot, type JobSnapshot } from "@/lib/background-job";

export interface ImportJobStats {
  total: number | null;
  processed: number | null;
  successful: number | null;
  failed: number | null;
  skipped: number | null;
  valid: number | null;
  invalid: number | null;
  needsCountry: number | null;
  duplicates: number | null;
  created: number | null;
  updated: number | null;
}

const fields: Record<keyof ImportJobStats, readonly string[]> = {
  total: ["total_rows", "total"], processed: ["processed_rows", "processed"],
  successful: ["successful_rows", "imported"], failed: ["failed_rows", "failed"], skipped: ["skipped_rows", "skipped"],
  valid: ["valid_count"], invalid: ["invalid_count"], needsCountry: ["needs_country_count"],
  duplicates: ["duplicate_count"], created: ["created_count"], updated: ["updated_count"],
};

export function getImportJobStats(payload: unknown, previous?: ImportJobStats): ImportJobStats {
  const envelope = asRecord(payload);
  const raw = asRecord(envelope.data ?? envelope);
  const result = asRecord(raw.result);
  const sources = [raw, asRecord(raw.stats), asRecord(raw.counts), result, asRecord(result.stats)];
  const stats = {} as ImportJobStats;
  for (const [key, names] of Object.entries(fields) as [keyof ImportJobStats, readonly string[]][]) {
    const value = sources.flatMap((source) => names.map((field) => source[field])).find(
      (count) => typeof count === "number" && Number.isFinite(count) && count >= 0,
    );
    stats[key] = typeof value === "number" ? value : previous?.[key] ?? null;
  }
  return stats;
}

export function getImportCountItems(stats: ImportJobStats) {
  return [
    { label: "Valid", value: stats.valid },
    { label: "Invalid", value: stats.invalid },
    { label: "Duplicates", value: stats.duplicates },
    { label: "Created", value: stats.created },
    { label: "Updated", value: stats.updated },
  ];
}

export function getImportResultSummary(stats: ImportJobStats): string {
  const writes = [
    stats.created !== null ? `${stats.created.toLocaleString()} created` : null,
    stats.updated !== null ? `${stats.updated.toLocaleString()} updated` : null,
  ].filter(Boolean);
  const imported = stats.successful !== null ? `${stats.successful.toLocaleString()} contacts imported.` : "";
  return [imported, writes.length ? `${writes.join(", ")}.` : ""].filter(Boolean).join(" ") || "Review the import counts below.";
}

// A counts-only response reports no lifecycle state. Continue tracking without
// inferring completion or progress from categories that may overlap.
export function normalizeImportJobSnapshot(payload: unknown): JobSnapshot {
  const envelope = asRecord(payload);
  const raw = asRecord(envelope.data ?? envelope);
  if (typeof raw.status === "string" || typeof raw.bull_job_state === "string") {
    return normalizeJobSnapshot(payload);
  }
  if (!Object.values(getImportJobStats(raw)).some((value) => value !== null)) {
    throw new Error("The import status response did not include job status or import counts.");
  }
  return normalizeJobSnapshot({
    ...envelope,
    data: { ...raw, status: "tracking", stage: "Import counts", progress: null },
  });
}
