import assert from "node:assert/strict";
import { test } from "node:test";
import { getImportJobStats, getImportCountItems, getImportResultSummary, normalizeImportJobSnapshot } from "./import-job-stats";
import { isJobCompleted, waitForJob } from "@/lib/background-job";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

const counts = {
  valid_count: 1900, invalid_count: 90, needs_country_count: 10,
  duplicate_count: 150, created_count: 1700, updated_count: 210,
};

test("reads backend counts and omits country validation from displayed metrics", () => {
  const stats = getImportJobStats(counts);
  assert.deepEqual(getImportCountItems(stats).map(({ value }) => value), [1900, 90, 150, 1700, 210]);
  assert.equal(stats.needsCountry, 10);
  assert.ok(getImportCountItems(stats).every(({ label }) => !label.toLowerCase().includes("country")));
  assert.equal(stats.total, null);
  assert.equal(stats.successful, null);
  assert.equal(getImportResultSummary(stats), "1,700 created, 210 updated.");
});

test("supports wrapped status responses and nested counts", () => {
  for (const payload of [{ data: counts }, { data: { stats: counts } }, { data: { result: counts } }]) {
    assert.deepEqual(getImportJobStats(payload), getImportJobStats(counts));
  }
});

test("keeps previously reported counts through partial responses and respects explicit zeros", () => {
  const previous = getImportJobStats(counts);
  const next = getImportJobStats({ created_count: 0, invalid_count: 0 }, previous);
  assert.equal(next.created, 0);
  assert.equal(next.invalid, 0);
  assert.equal(next.updated, 210);
  assert.equal(next.valid, 1900);
  assert.equal(getImportJobStats({ successful_rows: 0 }).successful, 0);
  assert.equal(getImportResultSummary(getImportJobStats({ successful_rows: 0 })), "0 contacts imported.");
});

test("counts-only responses cannot be mistaken for completed jobs or a percentage", () => {
  const job = normalizeImportJobSnapshot(counts);
  assert.equal(job.status, "tracking");
  assert.equal(job.progress, null);
  assert.equal(isJobCompleted(job.status), false);
  assert.equal(normalizeImportJobSnapshot({ needs_country_count: 10 }).status, "tracking");
  assert.throws(() => normalizeImportJobSnapshot({ success: false, data: counts }), /Invalid job status/);
});

test("completed result supplies imported, failed, skipped, total and preserves the running counts", async () => {
  const original = soft7AxiosInstance.defaults.adapter;
  let requests = 0;
  let stats = getImportJobStats({});
  const states: string[] = [];
  soft7AxiosInstance.defaults.adapter = async (config) => {
    assert.equal(config.url, "/admin/contacts/import/test-job/status");
    return {
      config, status: 200, statusText: "OK", headers: {},
      data: ++requests === 1 ? counts : {
        success: true, data: {
          job_id: "test-job", status: "completed", progress_percentage: 100,
          estimated_remaining_seconds: 0,
          result: { list_id: "test-list", imported: 1980, failed: 20, skipped: 0, total: 2000 },
        },
      },
    };
  };
  try {
    const job = await waitForJob("/admin/contacts/import/test-job/status", {
      intervalMs: 0, normalizeStatus: normalizeImportJobSnapshot,
      onStatus: (snapshot) => {
        states.push(snapshot.status);
        stats = getImportJobStats(snapshot.raw, stats);
      },
    });
    assert.equal(job.status, "completed");
    assert.equal(job.progress, 100);
    assert.deepEqual(states, ["tracking", "completed"]);
    assert.deepEqual([stats.successful, stats.failed, stats.skipped, stats.total], [1980, 20, 0, 2000]);
    assert.equal(stats.valid, 1900);
    assert.equal(stats.created, 1700);
    assert.equal(getImportResultSummary(stats), "1,980 contacts imported. 1,700 created, 210 updated.");
  } finally {
    soft7AxiosInstance.defaults.adapter = original;
  }
});
