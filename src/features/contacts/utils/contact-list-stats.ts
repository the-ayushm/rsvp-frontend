export interface ContactValidationIssue {
  row?: number | string | null;
  name?: string | null;
  phone_number?: string | number | null;
  country_code?: string | null;
  status?: string | null;
  error?: string | null;
  reason?: string | null;
  message?: string | null;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  file_name?: string | null;
  file_headers?: string[] | null;
  total_contacts?: number | null;
  valid_contacts?: number | null;
  invalid_contacts?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  country_code?: string | null;
  total_rows?: number | null;
  valid_count?: number | null;
  invalid_count?: number | null;
  importable_count?: number | null;
  duplicate_count?: number | null;
  unique_count?: number | null;
  needs_country_count?: number | null;
  imported_contacts?: number | null;
  import_failed_contacts?: number | null;
  invalid_phone_numbers?: number | null;
  created_count?: number | null;
  updated_count?: number | null;
  detected_phone_column?: string | null;
  selected_phone_column?: string | null;
  duplicate_preview?: {
    phone_number: string;
    occurrences: number;
    duplicate_rows: number;
  }[] | null;
  needs_country_preview?: ContactValidationIssue[] | null;
  errors?: ContactValidationIssue[] | null;
}

const count = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function getContactListStats(list: ContactList) {
  return {
    total: count(list.total_rows ?? list.total_contacts),
    valid: count(list.valid_count ?? list.valid_contacts),
    invalid: count(list.invalid_count ?? list.invalid_contacts),
    importable: count(list.importable_count),
    duplicates: count(list.duplicate_count),
    unique: count(list.unique_count),
    needsCountry: count(list.needs_country_count),
    imported: count(list.imported_contacts),
    failed: count(list.import_failed_contacts),
    invalidPhones: count(list.invalid_phone_numbers),
    created: count(list.created_count),
    updated: count(list.updated_count),
  };
}

export const formatListCount = (value: number | null) =>
  value === null ? '—' : value.toLocaleString();
