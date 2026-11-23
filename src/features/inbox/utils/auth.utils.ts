export const getConsoleToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const candidateKeys = [
    "console_access_token",
    "access_token",
    "token",
    "auth_token",
  ];

  for (const key of candidateKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        const nested =
          parsed?.token ||
          parsed?.access_token ||
          parsed?.accessToken ||
          parsed?.data?.token ||
          parsed?.data?.access_token;
        if (typeof nested === "string" && nested.trim()) {
          return nested.trim().replace(/^Bearer\s+/i, "");
        }
      } catch {
        // Ignore invalid JSON and continue with raw parsing
      }
    }

    return trimmed
      .replace(/^"|"$/g, "")
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  return null;
};
