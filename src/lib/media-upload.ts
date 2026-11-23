import { isAxiosError, type AxiosProgressEvent } from "axios";
import { soft7AxiosInstance } from "./axiosInstance";
import { asRecord, waitForJob, type JobSnapshot } from "./background-job";
import { createJobToast } from "./job-toast";

export interface UploadedMedia {
  id?: string;
  name?: string;
  original_name?: string;
  firebase_url?: string;
  firebaseUrl?: string;
  media_url?: string;
  url?: string;
  size?: string;
  mimetype?: string;
  created_at?: string;
  [key: string]: unknown;
}

export const getUploadedMediaUrl = (media: UploadedMedia): string =>
  media.firebase_url || media.firebaseUrl || media.media_url || media.url || "";

export async function uploadMedia(
  formData: FormData,
  options: {
    signal?: AbortSignal;
    onStatus?: (job: JobSnapshot) => void;
    onUploadProgress?: (event: AxiosProgressEvent) => void;
    pollIntervalMs?: number;
  } = {},
): Promise<UploadedMedia> {
  const file = formData.get("file");
  const label = typeof File !== "undefined" && file instanceof File ? `Upload: ${file.name}` : "Media upload";
  const notification = createJobToast(label);
  const onStatus = (job: JobSnapshot) => {
    notification.update(job);
    options.onStatus?.(job);
  };
  try {
    const response = await soft7AxiosInstance.post("/admin/image-upload/upload", formData, {
      signal: options.signal,
      timeout: 0,
      onUploadProgress: (event) => {
        options.onUploadProgress?.(event);
        const progress = event.total ? Math.min(100, Math.round(event.loaded / event.total * 100)) : null;
        onStatus({
          status: "uploading", stage: event.total && event.loaded >= event.total ? "processing" : "uploading",
          progress, estimatedRemainingSeconds: null, result: null, errorMessage: null, raw: {},
        });
      },
    });
    const envelope = asRecord(response.data);
    if (envelope.success === false) throw new Error(typeof envelope.message === "string" ? envelope.message : "Upload failed.");
    const data = asRecord(envelope.data ?? envelope.file ?? envelope);
    const jobId = data.job_id ?? envelope.job_id;
    let result = data;
    if (typeof jobId === "string" && jobId) {
      onStatus({
        status: "queued", stage: "queued", progress: null,
        estimatedRemainingSeconds: null, result: null, errorMessage: null, raw: data,
      });
      const completed = await waitForJob(`/admin/image-upload/jobs/${encodeURIComponent(jobId)}`, {
        signal: options.signal, intervalMs: options.pollIntervalMs, onStatus,
        onRetry: notification.reconnecting,
      });
      result = asRecord(completed.result);
    }
    const media = result as UploadedMedia;
    if (!getUploadedMediaUrl(media)) throw new Error("Upload completed without a media URL. Please refresh the gallery to check the result.");
    notification.complete(`${label}: Completed successfully.`);
    return media;
  } catch (error) {
    if (options.signal?.aborted) {
      notification.dismiss();
    } else {
      const message = isAxiosError(error) && error.response?.status === 413
        ? "The server rejected the file size (413). Its upload limit must be increased."
        : isAxiosError(error) && typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : error instanceof Error ? error.message : "Upload failed. Please try again.";
      notification.fail(`${label}: ${message}`);
    }
    throw error;
  }
}
