import assert from "node:assert/strict";
import { test } from "node:test";
import { countCampaignPhoneNumbers, getCampaignErrorMessage, getPreviewRecipientCount, mergeContactSelection } from "./campaign-validation";

test("bulk selection includes every available contact and allows adding more without duplicates", () => {
  const candidates = Array.from({ length: 2279 }, (_, index) => String(index));
  const selected = mergeContactSelection(["other", "0"], candidates);
  assert.equal(selected.length, 2280);
  assert.equal(candidates.length, 2279);
  assert.deepEqual(selected.slice(0, 3), ["other", "0", "1"]);
  assert.equal(mergeContactSelection(selected, ["extra"]).length, 2281);
  assert.deepEqual(mergeContactSelection(selected, candidates), selected);
});

test("counts duplicate numbers across recipient sources only once", () => {
  assert.equal(countCampaignPhoneNumbers(["+44 7738-261461", "447738261461", "", "+919876543210"]), 2);
});

test("uses backend recipient totals and refuses to infer totals from paginated rows", () => {
  assert.equal(getPreviewRecipientCount({ data: { total_recipients: "2279", contacts: [{}] } }), 2279);
  assert.equal(getPreviewRecipientCount({ count: 0 }), 0);
  for (const payload of [{ contacts: [{}] }, { total: null }, { total: "" }, { total: -1 }, { total: 1.5 }]) {
    assert.throws(() => getPreviewRecipientCount(payload), /Unable to verify/);
  }
});

test("shows backend field validation details instead of a generic request error", () => {
  assert.equal(getCampaignErrorMessage({ response: { data: { message: "Validation failed", errors: { "contact_filters.contactNumber": ["Maximum 150 numbers allowed."] } } } }), "Maximum 150 numbers allowed.");
  assert.equal(getCampaignErrorMessage({ response: { data: { validation_errors: [{ field: "phone_number_id", message: "Choose an active sender." }] } } }), "Choose an active sender.");
  assert.equal(getCampaignErrorMessage({ response: { data: { detail: [{ loc: ["body", "contacts"], msg: "Too many recipients.", type: "value_error" }] } } }), "Too many recipients.");
  assert.equal(getCampaignErrorMessage({ response: { data: { error: { message: "Sender unavailable." } } } }), "Sender unavailable.");
  assert.equal(getCampaignErrorMessage({ response: { data: { message: ["Maximum 150 numbers allowed.", "Choose an active sender."] } } }), "Maximum 150 numbers allowed. Choose an active sender.");
  assert.equal(getCampaignErrorMessage(new Error("Network Error")), "Network Error");
  assert.match(getCampaignErrorMessage(null), /Failed to create campaign/);
});
