import { isAxiosError } from "axios";
import { soft7AxiosInstance } from "./axiosInstance";

export interface JobSnapshot {
  status: string;
  stage: string;
  progress: number | null;
  estimatedRemainingSeconds: number | null;
  result: unknown;
  errorMessage: string | null;
  raw: Record<string, unknown>;
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export function normalizeJobSnapshot(payload: unknown): JobSnapshot {
  const envelope = asRecord(payload);
  const raw = envelope.data !== undefined ? asRecord(envelope.data) : envelope;
  const bullStatus = typeof raw.bull_job_state === "string" ? raw.bull_job_state.toLowerCase() : "";
  const states: Record<string, string> = {
    active: "processing", waiting: "queued", delayed: "queued", paused: "queued",
    completed: "completed", failed: "failed",
  };
  const status = states[bullStatus] || (typeof raw.status === "string" ? raw.status.toLowerCase() : "");
  if (!status || envelope.success === false) {
    throw new Error(typeof envelope.message === "string" ? envelope.message : "Invalid job status response.");
  }
  const progress = raw.progress_percentage ?? raw.progress;
  const remaining = raw.estimated_remaining_seconds;
  const error = raw.error_message ?? raw.error ?? raw.message;
  return {
    status,
    stage: typeof raw.stage === "string" ? raw.stage : status,
    progress: typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null,
    estimatedRemainingSeconds: typeof remaining === "number" && Number.isFinite(remaining) && remaining >= 0 ? remaining : null,
    result: raw.result,
    errorMessage: typeof error === "string" ? error : null,
    raw,
  };
}

export const isJobCompleted = (status: string) => status === "completed" || status === "done";
export const isJobFailed = (status: string) => ["failed", "error", "cancelled", "canceled"].includes(status);

export function formatRemainingTime(seconds: number | null): string {
  if (seconds === null) return "Estimating time remaining...";
  if (seconds <= 0) return "Finishing up...";
  const rounded = Math.ceil(seconds);
  if (rounded < 60) return `About ${rounded}s remaining`;
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `About ${minutes}m${remainder ? ` ${remainder}s` : ""} remaining`;
}

function waitForNextPoll(delay: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason ?? new DOMException("Tracking stopped", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Sequential requests prevent overlapping polls when a status response is slow.
// Job duration has no timeout; each status request can retry transient failures.
export async function waitForJob(
  endpoint: string,
  options: {
    signal?: AbortSignal;
    intervalMs?: number;
    onStatus?: (job: JobSnapshot) => void;
    onRetry?: () => void;
    normalizeStatus?: (payload: unknown) => JobSnapshot;
  } = {},
): Promise<JobSnapshot> {
  while (true) {
    options.signal?.throwIfAborted();
    let response;
    try {
      response = await soft7AxiosInstance.get(endpoint, { signal: options.signal, timeout: 15000 });
    } catch (error) {
      options.signal?.throwIfAborted();
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (!isAxiosError(error) || (status && status < 500 && status !== 408 && status !== 429)) throw error;
      options.onRetry?.();
      await waitForNextPoll(options.intervalMs ?? 2000, options.signal);
      continue;
    }
    options.signal?.throwIfAborted();
    const job = (options.normalizeStatus ?? normalizeJobSnapshot)(response.data);
    options.onStatus?.(job);
    if (isJobFailed(job.status)) throw new Error(job.errorMessage || "The job failed. Please try again.");
    if (isJobCompleted(job.status)) return job;
    await waitForNextPoll(options.intervalMs ?? 2000, options.signal);
  }
}
