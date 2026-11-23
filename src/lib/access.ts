export type AccessState =
  | "NEW_USER"           // No trial & no subscription ever started
  | "FREE_TRIAL_ACTIVE"
  | "FREE_TRIAL_EXPIRED"
  | "SUBSCRIPTION_ACTIVE"
  | "SUBSCRIPTION_EXPIRED";

export function getUserAccessState(user: {
  trialEndAt?: string | Date | null;
  subscriptionEnd?: string | Date | null;
}): AccessState {
  const now = new Date();

  // ── Active subscription takes highest priority ─────────────────────────────
  if (user.subscriptionEnd && new Date(user.subscriptionEnd) > now) {
    return "SUBSCRIPTION_ACTIVE";
  }

  // ── Active free trial ──────────────────────────────────────────────────────
  if (user.trialEndAt && new Date(user.trialEndAt) > now) {
    return "FREE_TRIAL_ACTIVE";
  }

  // ── Expired subscription ───────────────────────────────────────────────────
  if (user.subscriptionEnd) {
    return "SUBSCRIPTION_EXPIRED";
  }

  // ── Expired free trial ─────────────────────────────────────────────────────
  if (user.trialEndAt) {
    return "FREE_TRIAL_EXPIRED";
  }

  // ── Neither trial nor subscription exists → brand new user ────────────────
  return "NEW_USER";
}