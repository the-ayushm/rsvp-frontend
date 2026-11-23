import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createImportPreviewForm, normalizeImportPreview, previewCellText } from "./import-preview";
import ImportPreviewDetails from "../components/ImportContacts/ImportPreviewDetails";

const data = {
  headers: ["me", "Phone Number", "Email"],
  preview: [{ me: "Test contact", "Phone Number": 919900000001, Email: "" }],
  total_rows: 2212, selected_phone_column: "Phone Number", detected_phone_column: "Phone Number",
  valid_count: 2201, importable_count: 2208, duplicate_count: 21, unique_count: 2187,
  duplicate_preview: [{ phone_number: "+919900000002", occurrences: 2, duplicate_rows: 1 }],
  needs_country_count: 7, invalid_count: 4,
  needs_country: [{ name: "Needs country", phone_number: "+91330000", country_code: null, is_valid: false }],
  normalized_preview: [{ name: "Test contact", phone_number: "+919900000001", country_code: "91", is_valid: true }],
  errors: [{ row: 141, status: "invalid", error: "Phone number must contain 4 to 15 digits", phone_number: 91 }],
};

test("uses backend counts without substituting valid count or sample lengths for importable count", () => {
  const result = normalizeImportPreview({ success: true, data });
  assert.deepEqual([result.totalRows, result.validCount, result.importableCount, result.invalidCount, result.duplicateCount, result.uniqueCount, result.needsCountryCount], [2212, 2201, 2208, 4, 21, 2187, 7]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.duplicates.length, 1);
  assert.deepEqual(result.headers, ["me", "Phone Number", "Email"]);
  assert.equal(normalizeImportPreview({ data: { ...data, needs_country_count: undefined } }).needsCountryCount, null);
});

test("preserves numeric phone text, normalized country codes and backend file row numbers", () => {
  const result = normalizeImportPreview({ success: true, data });
  assert.equal(previewCellText(result.rows[0]["Phone Number"]), "919900000001");
  assert.equal(result.normalizedContacts[0].phoneNumber, "+919900000001");
  assert.equal(result.normalizedContacts[0].countryCode, "91");
  assert.equal(result.needsCountry[0].countryCode, null);
  assert.equal(result.errors[0].row, 141);
  assert.equal(result.errors[0].phoneNumber, "91");
});

test("rejects failed or incomplete previews instead of claiming all local rows are valid", () => {
  assert.throws(() => normalizeImportPreview({ success: false, message: "Unknown phone column" }), /Unknown phone column/);
  assert.throws(() => normalizeImportPreview({ success: true, data: { total_rows: 2212 } }), /incomplete contact preview/);
  assert.throws(() => normalizeImportPreview({ data: { ...data, importable_count: 3000 } }), /inconsistent contact counts/);
});

test("zero importable rows are valid preview results and remain zero", () => {
  const result = normalizeImportPreview({ data: {
    ...data, valid_count: 0, importable_count: 0, invalid_count: 2212, duplicate_count: 0,
    unique_count: 0, needs_country_count: 0, preview: [],
  } });
  assert.equal(result.importableCount, 0);
  assert.equal(result.validCount, 0);
  assert.equal(result.uniqueCount, 0);
});

test("preview multipart form passes the file and exact selected headers with no literal quoting", () => {
  const file = new File(["me,Phone Number\nTest,919900000001"], "contacts.csv", { type: "text/csv" });
  const form = createImportPreviewForm(file, { phone: "Phone Number", name: "me" });
  assert.equal(form.get("file"), file);
  assert.equal(form.get("phone_column"), "Phone Number");
  assert.equal(form.get("name_column"), "me");
  assert.deepEqual([...form.keys()], ["file", "phone_column", "name_column"]);
  assert.throws(() => createImportPreviewForm(file, { phone: "", name: "me" }), /Map a phone number column/);
});

test("details render backend samples, duplicate counts and row errors", () => {
  const result = normalizeImportPreview({ success: true, data });
  const html = renderToStaticMarkup(React.createElement(ImportPreviewDetails, { preview: result }));
  for (const text of ["Importable Contacts", "2,208", "Invalid Contacts", "Duplicates", "21", "2,187", "File preview", "919900000001", "Duplicate examples", "Normalized contacts", "141", "Phone number must contain 4 to 15 digits"]) {
    assert.ok(html.includes(text), `Missing preview content: ${text}`);
  }
  assert.doesNotMatch(html, /Needs country|Country code|country code/);
});
