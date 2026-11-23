import assert from "node:assert/strict";
import { test } from "node:test";
import { getCreatedCampaignId } from "./campaign-response";

test("uses the created campaign ID from the backend response", () => {
  const responses = [
    { success: true, campaign_id: "campaign-123" },
    { success: true, data: { campaign_id: "campaign-123" } },
    { success: true, data: { campaignId: "campaign-123" } },
    { success: true, data: { id: "campaign-123" } },
    { success: true, data: { _id: "campaign-123" } },
    { success: true, data: { campaign: { id: "campaign-123" } } },
    { success: true, campaign: { id: "campaign-123" } },
    { id: "campaign-123" },
  ];
  for (const response of responses) assert.equal(getCreatedCampaignId(response), "campaign-123");
  assert.equal(getCreatedCampaignId({ data: { id: 123 } }), "123");
  assert.equal(getCreatedCampaignId({ id: "request-id", data: { campaign_id: "campaign-123" } }), "campaign-123");
});

test("does not produce a stats destination for failed or malformed responses", () => {
  for (const response of [
    null, undefined, "OK", [], { success: true },
    { success: false, id: "campaign-123" },
    { data: { success: false, id: "campaign-123" } },
    { data: { id: {} } }, { id: true }, { id: "  " }, { id: 0 }, { id: NaN },
  ]) assert.equal(getCreatedCampaignId(response), null);
});
