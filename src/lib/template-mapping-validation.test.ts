import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTemplateMappings, resolveContactField } from "./template-mapping-validation";

test("requires every placeholder and rejects blank static values", () => {
  const results = validateTemplateMappings(["1", "2"], [{ key: "1", value: " \t\n" }], [{}]);
  assert.ok(results.every(result => result.blocking));
  assert.equal(results[1].key, "2");
});

test("allows missing contact values without a fallback", () => {
  const contacts = [{ email: "a@example.com" }, { email: " " }, {}, { email: null }];
  const mapping = { key: "email", value: "", source: "contact" as const, contactField: "contact.email" };
  for (const fallbackValue of [undefined, "", " "]) {
    const [result] = validateTemplateMappings(["email"], [{ ...mapping, fallbackValue }], contacts);
    assert.equal(result.missing, 3);
    assert.equal(result.blocking, false);
    assert.equal(result.message, "");
  }
  const [valid] = validateTemplateMappings(["email"], [{ ...mapping, fallbackValue: "Guest" }], contacts);
  assert.equal(valid.blocking, false);
  assert.equal(valid.missing, 3);
  assert.match(valid.message, /Fallback will be used/);
});

test("resolves custom labels containing dots and accepts zero and false", () => {
  assert.equal(resolveContactField({ custom_fields: { "order.total": 0 } }, "contact.custom_fields.order.total"), 0);
  for (const value of [0, false, " Alice "]) {
    const [result] = validateTemplateMappings(["1"], [{ key: "1", value: "", source: "contact", contactField: "contact.name" }], [{ name: value }]);
    assert.equal(result.blocking, false);
    assert.equal(result.missing, 0);
  }
});
