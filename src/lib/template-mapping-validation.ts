export type TemplateMapping = {
  key: string;
  value: string;
  source?: "manual" | "contact";
  contactField?: string;
  fallbackValue?: string;
};

export function hasTemplateValue(value: unknown): boolean {
  return (typeof value === "string" && value.trim().length > 0)
    || (typeof value === "number" && Number.isFinite(value))
    || typeof value === "boolean";
}

export function resolveContactField(contact: Record<string, unknown>, field: string): unknown {
  const path = field.replace(/^contact\./, "");
  // Custom column labels can contain dots; treat the label as a single key.
  if (path.startsWith("custom_fields.")) {
    const custom = contact.custom_fields;
    return custom && typeof custom === "object" ? (custom as Record<string, unknown>)[path.slice(14)] : undefined;
  }
  return path.split(".").reduce<unknown>((value, key) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, contact);
}

export function validateTemplateMappings(keys: string[], mappings: TemplateMapping[], contacts: Record<string, unknown>[]) {
  return keys.map(key => {
    const mapping = mappings.find(field => field.key === key);
    if (!mapping || (mapping.source === "contact" ? !mapping.contactField?.trim() : !hasTemplateValue(mapping.value))) {
      return { key, missing: contacts.length, blocking: true, message: `Variable {{${key}}}: ${mapping?.source === "contact" ? "select a contact field" : "enter a non-empty static value"}.` };
    }
    const missing = mapping.source === "contact"
      ? contacts.filter(contact => !hasTemplateValue(resolveContactField(contact, mapping.contactField!))).length : 0;
    return { key, missing, blocking: false, message: missing > 0 && hasTemplateValue(mapping.fallbackValue)
      ? `Variable {{${key}}}: ${missing} contact${missing === 1 ? "" : "s"} missing a value. Fallback will be used.` : "" };
  });
}
