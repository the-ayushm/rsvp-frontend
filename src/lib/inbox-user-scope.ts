type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

export function normalizeInboxUserId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && !["0", "null", "undefined"].includes(id) ? id : null;
}

function uniqueId(values: unknown[]): string | null {
  if (!values.length) return null;
  const ids = values.map(normalizeInboxUserId);
  return ids.every(id => id !== null && id === ids[0]) ? ids[0] : null;
}

/** Missing, malformed, and conflicting owner fields must never authorize a message. */
export function getInboxMessageUserId(payload: unknown): string | null {
  const root = row(payload), data = row(root.data);
  const sources = [root, data, row(root.message), row(data.message)];
  return uniqueId(sources.flatMap(source => ["user_id", "userId", "owner_user_id"]
    .filter(key => Object.hasOwn(source, key)).map(key => source[key])));
}

export function getStoredInboxUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const user = row(JSON.parse(localStorage.getItem("user_data") || "null"));
    return uniqueId(["id", "user_id", "userId"].filter(key => Object.hasOwn(user, key)).map(key => user[key]));
  } catch { return null; }
}

export function inboxMessageBelongsToUser(payload: unknown, userId: unknown): boolean {
  const current = normalizeInboxUserId(userId);
  return current !== null && getInboxMessageUserId(payload) === current;
}
