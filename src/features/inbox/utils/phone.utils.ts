/* eslint-disable @typescript-eslint/no-explicit-any */

export const normalizePhone = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "");

export const removePlusPrefix = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/^\+/, "");

export const isSamePhoneValue = (left: unknown, right: unknown): boolean => {
  const leftDigits = normalizePhone(left);
  const rightDigits = normalizePhone(right);
  if (!leftDigits || !rightDigits) return false;
  return (
    leftDigits === rightDigits ||
    leftDigits.slice(-10) === rightDigits.slice(-10)
  );
};

export const normalizeLeadNumber = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  const digits = normalizePhone(raw);
  if (!digits) return "";
  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
};

export const getLast10Digits = (value: unknown): string =>
  normalizePhone(value).slice(-10);

export const createStableContactId = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 100000;
};

export const getMessagePhoneCandidates = (message: any): string[] => {
  const rawValues = [
    message?.to,
    message?.from,
    message?.phone,
    message?.phone_number,
    message?.to_phone,
    message?.from_phone,
    message?.recipient,
    message?.recipient_phone,
    message?.sender,
    message?.sender_phone,
    message?.contactPhone,
    message?.wa_id,
    message?.waId,
    message?.contact?.phone,
    message?.contact?.phone_number,
    message?.meta?.to,
    message?.meta?.from,
    message?.key?.remoteJid,
  ];

  return rawValues.map(normalizePhone).filter((p) => p.length > 0);
};

export const belongsToSelectedContact = (
  message: any,
  selectedPhone?: string | null,
): boolean => {
  const target = normalizePhone(selectedPhone);
  if (!target) return true;

  const targetLast10 = target.slice(-10);
  const candidates = getMessagePhoneCandidates(message);

  if (candidates.length === 0) return true;

  return candidates.some((candidate) => {
    const candidateLast10 = candidate.slice(-10);
    return (
      candidate === target ||
      candidateLast10 === targetLast10 ||
      candidate.endsWith(targetLast10) ||
      target.endsWith(candidateLast10)
    );
  });
};
