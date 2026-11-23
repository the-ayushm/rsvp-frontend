import { asRecord } from "@/lib/background-job";

export interface PreviewContact {
  name: string;
  phoneNumber: string;
  countryCode: string | null;
  isValid: boolean | null;
}

export interface ContactImportPreview {
  totalRows: number;
  validCount: number;
  importableCount: number;
  invalidCount: number;
  duplicateCount: number;
  uniqueCount: number | null;
  needsCountryCount: number | null;
  selectedPhoneColumn: string | null;
  detectedPhoneColumn: string | null;
  headers: string[];
  rows: Record<string, unknown>[];
  normalizedContacts: PreviewContact[];
  needsCountry: PreviewContact[];
  duplicates: { phoneNumber: string; occurrences: number | null; duplicateRows: number | null }[];
  errors: { row: number | null; status: string; message: string; phoneNumber: string }[];
}

export const previewCellText = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const records = (value: unknown) => Array.isArray(value) ? value.map(asRecord) : [];
const contacts = (value: unknown): PreviewContact[] => records(value).map((raw) => ({
  name: typeof raw.name === "string" ? raw.name : "",
  phoneNumber: previewCellText(raw.phone_number),
  countryCode: raw.country_code === null || raw.country_code === undefined ? null : String(raw.country_code),
  isValid: typeof raw.is_valid === "boolean" ? raw.is_valid : null,
}));

export function normalizeImportPreview(payload: unknown): ContactImportPreview {
  const envelope = asRecord(payload);
  if (envelope.success === false) {
    throw new Error(typeof envelope.message === "string" ? envelope.message : "Could not generate the contact preview.");
  }
  const raw = asRecord(envelope.data ?? envelope);
  const requiredCount = (key: string): number => {
    const value = count(raw[key]);
    if (value === null) throw new Error("The server returned an incomplete contact preview. Please try again.");
    return value;
  };
  const result: ContactImportPreview = {
    totalRows: requiredCount("total_rows"), validCount: requiredCount("valid_count"),
    importableCount: requiredCount("importable_count"), invalidCount: requiredCount("invalid_count"),
    duplicateCount: requiredCount("duplicate_count"), uniqueCount: count(raw.unique_count),
    needsCountryCount: count(raw.needs_country_count),
    selectedPhoneColumn: typeof raw.selected_phone_column === "string" ? raw.selected_phone_column : null,
    detectedPhoneColumn: typeof raw.detected_phone_column === "string" ? raw.detected_phone_column : null,
    headers: Array.isArray(raw.headers) ? raw.headers.filter((header): header is string => typeof header === "string") : [],
    rows: records(raw.preview), normalizedContacts: contacts(raw.normalized_preview), needsCountry: contacts(raw.needs_country),
    duplicates: records(raw.duplicate_preview).map((duplicate) => ({
      phoneNumber: previewCellText(duplicate.phone_number),
      occurrences: count(duplicate.occurrences), duplicateRows: count(duplicate.duplicate_rows),
    })),
    errors: records(raw.errors).map((error) => ({
      row: count(error.row), status: typeof error.status === "string" ? error.status : "invalid",
      message: typeof error.error === "string" ? error.error : "Invalid contact",
      phoneNumber: previewCellText(error.phone_number),
    })),
  };
  if (result.importableCount > result.totalRows || result.validCount > result.totalRows) {
    throw new Error("The preview returned inconsistent contact counts. Please try again.");
  }
  return result;
}

export function createImportPreviewForm(
  file: File,
  columns: { phone: string; name: string },
): FormData {
  if (!columns.phone) throw new Error("Map a phone number column before generating the preview.");
  const form = new FormData();
  form.append("file", file);
  form.append("phone_column", columns.phone);
  form.append("name_column", columns.name);
  return form;
}
