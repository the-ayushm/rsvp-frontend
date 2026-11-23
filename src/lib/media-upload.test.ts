import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { soft7AxiosInstance } from "./axiosInstance";
import { uploadMedia } from "./media-upload";
import { formatRemainingTime, normalizeJobSnapshot, waitForJob } from "./background-job";
import { toast } from "react-toastify";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement } from "react";
import { createJobToast, JOB_TOAST_CONTAINER_ID } from "./job-toast";

const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config, data, status: 200, statusText: "OK", headers: {},
});
const withAdapter = async (adapter: AxiosAdapter, run: () => Promise<void>) => {
  const original = soft7AxiosInstance.defaults.adapter;
  soft7AxiosInstance.defaults.adapter = adapter;
  try { await run(); } finally { soft7AxiosInstance.defaults.adapter = original; }
};
const uploadBody = () => {
  const body = new FormData();
  body.append("file", new File(["synthetic video"], "example.mp4", { type: "video/mp4" }));
  return body;
};

test("queued media waits for completion, even when processing reports 100%, then returns result", async () => {
  const requests: string[] = [];
  const statuses: string[] = [];
  let poll = 0;
  const media = { id: "test-job", firebase_url: "https://example.invalid/video.mp4", name: "Test video" };
  await withAdapter(async (config) => {
    requests.push(config.url!);
    if (config.method === "post") {
      assert.equal(config.timeout, 0);
      return response(config, { success: true, data: { job_id: "test-job" } });
    }
    poll++;
    return response(config, { success: true, data: {
      job_id: "test-job", status: poll === 3 ? "completed" : "processing",
      stage: poll === 3 ? "completed" : "firebase_upload", progress: 100,
      estimated_remaining_seconds: poll === 3 ? 0 : 7,
      result: poll === 3 ? media : null,
    } });
  }, async () => {
    assert.deepEqual(await uploadMedia(uploadBody(), {
      pollIntervalMs: 0, onStatus: (job) => statuses.push(job.status),
    }), media);
  });
  assert.deepEqual(statuses, ["queued", "processing", "processing", "completed"]);
  assert.equal(requests[0], "/admin/image-upload/upload");
  assert.deepEqual(requests.slice(1), Array(3).fill("/admin/image-upload/jobs/test-job"));
});

test("existing synchronous upload response shapes do not start polling", async () => {
  const media = { firebase_url: "https://example.invalid/file.pdf" };
  for (const payload of [{ data: media }, { file: media }, media]) {
    await withAdapter(async (config) => {
      assert.equal(config.method, "post");
      return response(config, payload);
    }, async () => { assert.deepEqual(await uploadMedia(uploadBody()), media); });
  }
});

test("failed jobs reject with the backend error and incomplete results cannot become success", async () => {
  for (const data of [
    { status: "failed", error_message: "Storage unavailable" },
    { status: "completed", progress: 100, result: null },
  ]) {
    await withAdapter(async (config) => response(config, config.method === "post"
      ? { data: { job_id: "test-job" } } : { data }), async () => {
      await assert.rejects(uploadMedia(uploadBody(), { pollIntervalMs: 0 }),
        data.status === "failed" ? /Storage unavailable/ : /without a media URL/);
    });
  }
});

test("temporary status failures retry while permanent authorization failures stop", async () => {
  let calls = 0;
  let retries = 0;
  await withAdapter(async (config) => {
    if (++calls === 1) throw new AxiosError("Unavailable", "ERR_BAD_RESPONSE", config, undefined,
      { ...response(config, {}), status: 503 });
    return response(config, { data: { status: "completed" } });
  }, async () => {
    await waitForJob("/test/jobs/job", { intervalMs: 0, onRetry: () => retries++ });
  });
  assert.equal(calls, 2);
  assert.equal(retries, 1);
  calls = 0;
  await withAdapter(async (config) => {
    calls++;
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined,
      { ...response(config, {}), status: 401 });
  }, async () => { await assert.rejects(waitForJob("/test/jobs/job"), /Unauthorized/); });
  assert.equal(calls, 1);
});

test("slow status requests never overlap", async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  await withAdapter(async (config) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return response(config, { data: { status: ++calls === 3 ? "completed" : "queued" } });
  }, async () => { await waitForJob("/test/jobs/job", { intervalMs: 0 }); });
  assert.equal(maximum, 1);
  assert.equal(calls, 3);
});

test("aborting tracking prevents any later polls", async () => {
  const controller = new AbortController();
  let calls = 0;
  await withAdapter(async (config) => {
    calls++;
    return response(config, { data: { status: "processing" } });
  }, async () => {
    await assert.rejects(waitForJob("/test/jobs/job", {
      signal: controller.signal, onStatus: () => controller.abort(),
    }), /abort/i);
  });
  assert.equal(calls, 1);
});

test("import jobs use Bull state, percentage and backend estimates without treating null as zero", () => {
  const job = normalizeJobSnapshot({ data: {
    bull_job_state: "active", status: "queued", progress_percentage: 42,
    estimated_remaining_seconds: 81, total_rows: 100,
  } });
  assert.equal(job.status, "processing");
  assert.equal(job.progress, 42);
  assert.equal(job.estimatedRemainingSeconds, 81);
  assert.equal(formatRemainingTime(81), "About 1m 21s remaining");
  assert.equal(formatRemainingTime(null), "Estimating time remaining...");
  assert.equal(formatRemainingTime(0), "Finishing up...");
  assert.equal(normalizeJobSnapshot({ data: { status: "queued", estimated_remaining_seconds: null } }).estimatedRemainingSeconds, null);
  assert.throws(() => normalizeJobSnapshot({ success: false, message: "Job missing" }), /Job missing/);
});

test("Toastify stays visible at 100% processing, shows backend ETA and closes only on success", (t) => {
  const loading = t.mock.method(toast, "loading", () => "test-toast");
  const update = t.mock.method(toast, "update", () => {});
  const notification = createJobToast("Test upload");
  const initialOptions = loading.mock.calls[0].arguments[1];
  assert.equal(initialOptions?.autoClose, false);
  assert.equal(initialOptions?.closeButton, false);
  assert.equal(initialOptions?.containerId, JOB_TOAST_CONTAINER_ID);
  notification.update(normalizeJobSnapshot({ data: {
    status: "processing", stage: "firebase_upload", progress: 100,
    estimated_remaining_seconds: 81,
  } }));
  const progressContent = update.mock.calls[0].arguments[1]?.render;
  assert.ok(isValidElement(progressContent));
  assert.match(renderToStaticMarkup(progressContent), /About 1m 21s remaining/);
  assert.equal(update.mock.calls[0].arguments[1]?.progress, undefined, "Toastify's controlled bar must not auto-close at 100%");
  notification.complete("Upload completed");
  assert.equal(update.mock.calls[1].arguments[1]?.isLoading, false);
  assert.equal(update.mock.calls[1].arguments[1]?.autoClose, 5000);
  notification.fail("Storage error");
  assert.equal(update.mock.calls[2].arguments[1]?.autoClose, false);
  assert.equal(update.mock.calls[2].arguments[1]?.closeButton, true);
});
