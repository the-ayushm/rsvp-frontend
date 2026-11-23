import { toFlowError, type FlowApiError } from "./api";
import type { AutomationFlow } from "./types";

export interface MutationOutcome {
  /** The flow to show afterwards (server response, or a fresh refetch). */
  flow: AutomationFlow | null;
  error: FlowApiError | null;
  /** Set when the save was rejected as stale (HTTP 409). */
  conflict: string | null;
}

/**
 * Runs one flow mutation against the latest revision.
 * - success → the server's flow replaces local state (refetched if the endpoint didn't return it)
 * - 409     → refetch the latest flow; the caller keeps its unsaved drafts for reconciliation
 * - 404     → refetch so removed steps disappear
 * Drafts are never touched here; that is what preserves editor input on failure.
 */
export async function performMutation(
  current: AutomationFlow,
  fn: (current: AutomationFlow) => Promise<AutomationFlow | null>,
  refetch: () => Promise<AutomationFlow | null>,
): Promise<MutationOutcome> {
  try {
    const next = await fn(current);
    return { flow: next ?? (await refetch()), error: null, conflict: null };
  } catch (err) {
    const error = toFlowError(err);
    if (error.status === 409) {
      const latest = await refetch();
      return {
        flow: latest,
        error,
        conflict: `${error.message} We loaded the latest version — your unsaved edits are kept, review them and save again.`,
      };
    }
    if (error.status === 404) return { flow: await refetch(), error, conflict: null };
    return { flow: null, error, conflict: null };
  }
}

/** Ignores calls while a previous one is still running (double-click / Enter+click). */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  let running = false;
  const wrapped = async (...args: A): Promise<R | undefined> => {
    if (running) return undefined;
    running = true;
    try {
      return await fn(...args);
    } finally {
      running = false;
    }
  };
  wrapped.isRunning = () => running;
  return wrapped;
}
