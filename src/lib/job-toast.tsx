import React from "react";
import { toast } from "react-toastify";
import { formatRemainingTime, type JobSnapshot } from "./background-job";

export const JOB_TOAST_CONTAINER_ID = "background-jobs";

interface JobMetric {
  label: string;
  value: number | null;
}

function JobMetrics({ metrics }: { metrics: readonly JobMetric[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {metrics.map(({ label, value }) => (
        <div key={label} className="flex justify-between gap-2">
          <dt>{label}</dt>
          <dd className="font-semibold tabular-nums shrink-0 whitespace-nowrap">{value === null ? "—" : value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function JobToastContent({ label, job, metrics }: { label: string; job?: JobSnapshot; metrics?: readonly JobMetric[] }) {
  return (
    <div className="space-y-2 text-sm" role="status">
      <p className="font-semibold break-words">{label}</p>
      <p className="capitalize">
        {job ? job.stage.replace(/[_-]/g, " ") : "Uploading file"}
        {job?.progress !== null && job?.progress !== undefined ? ` · ${Math.round(job.progress)}%` : ""}
      </p>
      {job?.status !== "tracking" && (
        <>
          <progress max={100} value={job?.progress ?? undefined} aria-label={`${label} progress`} className="w-full h-2 accent-primary" />
          <p className="text-xs">{formatRemainingTime(job?.estimatedRemainingSeconds ?? null)}</p>
        </>
      )}
      {metrics && <JobMetrics metrics={metrics} />}
    </div>
  );
}

export function createJobToast(label: string) {
  const options = { containerId: JOB_TOAST_CONTAINER_ID };
  const id = toast.loading(<JobToastContent label={label} />, {
    ...options, autoClose: false, closeButton: false, closeOnClick: false,
    draggable: false, hideProgressBar: true,
  });
  return {
    update: (job: JobSnapshot, metrics?: readonly JobMetric[]) => toast.update(id, { ...options, render: <JobToastContent label={label} job={job} metrics={metrics} /> }),
    reconnecting: () => toast.update(id, { ...options, render: `${label}: Connection interrupted. Rechecking progress...` }),
    complete: (message: string, metrics?: readonly JobMetric[]) => toast.update(id, {
      ...options,
      render: metrics ? <div className="space-y-2"><p>{message}</p><JobMetrics metrics={metrics} /></div> : message,
      type: "success", isLoading: false,
      autoClose: 5000, closeButton: true, hideProgressBar: false,
      pauseOnHover: false, pauseOnFocusLoss: false,
    }),
    fail: (message: string) => toast.update(id, {
      ...options, render: message, type: "error", isLoading: false,
      autoClose: false, closeButton: true,
    }),
    dismiss: () => toast.dismiss({ id, containerId: JOB_TOAST_CONTAINER_ID }),
  };
}
