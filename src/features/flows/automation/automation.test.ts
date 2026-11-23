/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { flowsApi, normalizeFlow, toFlowError, type FlowApiError } from "./api";
import { findEvent, normalizeCatalog } from "./catalog";
// Real GET /v1/admin/flows/apps response captured from the local API.
import appsResponse from "./__fixtures__/apps.response.json";
import { performMutation, singleFlight } from "./mutation";
import {
  flattenPayload,
  invalidStepReferences,
  isTerminalRun,
  mappingGroups,
  scalarMappingGroups,
  moveAction,
  normalizeShop,
  appendStepBody,
  nextTestRequest,
  parseParamInput,
  runOutputsByStep,
  toStepsPayload,
  validateParams,
  validateRows,
} from "./steps";
import type { AutomationFlow, FlowStep } from "./types";

const CATALOG = normalizeCatalog(appsResponse.data);

// ── Mock HTTP layer ─────────────────────────────────────────────────────────

interface Call {
  method: string;
  url: string;
  fullUrl: string;
  params: any;
  body: any;
  headers: Record<string, any>;
}
type Reply = { status: number; body?: any } | "network";
let calls: Call[] = [];
let replies: Reply[] = [];

const envelope = (data: unknown, message = "ok") => ({ success: true, message, data, meta: { timestamp: new Date().toISOString() } });

beforeEach(() => {
  calls = [];
  replies = [];
  soft7AxiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push({
      method: String(config.method).toUpperCase(),
      url: String(config.url),
      fullUrl: `${config.baseURL}${config.url}`,
      params: config.params,
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
      headers: { ...(config.headers as any) },
    });
    const reply = replies.shift() ?? { status: 200, body: envelope(null) };
    if (reply === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
    const response = { data: reply.body, status: reply.status, statusText: "", headers: {}, config };
    if (reply.status >= 400) throw new AxiosError(`HTTP ${reply.status}`, "ERR_BAD_RESPONSE", config, null, response);
    return response;
  };
});

const step = (id: string, extra: Partial<FlowStep> = {}): FlowStep => ({
  _id: id,
  flowId: "f1",
  appKey: "google-sheets",
  key: "appendRows",
  type: "action",
  connectionId: "c1",
  nextStepId: null,
  name: "Append",
  parameters: {},
  status: "complete",
  webhookPath: null,
  deletedAt: null,
  ...extra,
});

const flow = (revision = 3, steps: FlowStep[] = [step("t", { type: "trigger", appKey: "shopify", key: "new_order" }), step("a1")]): AutomationFlow =>
  normalizeFlow({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test",
    status: "draft",
    revision,
    webhookPath: "https://api.example.com/v1/webhook/flows/f1/tok",
    steps,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  });

// ── API client ──────────────────────────────────────────────────────────────

test("list uses /admin/flows on the /v1 base without duplicating /v1, caps limit, omits status for All", async () => {
  replies.push({ status: 200, body: envelope({ items: [{ _id: "f1", name: "A", status: "draft", revision: 1, steps: [] }], pagination: { page: 1, limit: 20, total: 1 }, counts: { all: 1, draft: 1 } }) });
  const res = await flowsApi.list({ page: 1, limit: 500, search: "  " });
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/admin/flows");
  assert.ok(!calls[0].fullUrl.includes("/v1/v1"));
  assert.equal(calls[0].params.limit, 100);
  assert.equal(calls[0].params.status, undefined);
  assert.equal(calls[0].params.search, undefined);
  assert.equal(res.items[0].id, "f1", "_id normalised to id");
  assert.deepEqual(res.counts, { all: 1, active: 0, inactive: 0, draft: 1 });
});

test("create sends only the name — no user_id/company_id ownership fields", async () => {
  replies.push({ status: 201, body: envelope({ id: "f-new", name: "Shopify new order to Google Sheets", status: "draft", revision: 1, steps: [step("t", { type: "trigger", status: "incomplete" }), step("a", { status: "incomplete" })], webhookPath: "https://x/hook" }) });
  const created = await flowsApi.create("Shopify new order to Google Sheets");
  assert.deepEqual(calls[0].body, { name: "Shopify new order to Google Sheets" });
  assert.equal(created.steps.length, 2);
  assert.equal(created.webhookPath, "https://x/hook");
});

test("saving the full step array preserves _ids, omits them for new steps and strips server-owned fields", async () => {
  const f = flow(4);
  const payload = toStepsPayload([...f.steps, { appKey: "razorpay", key: "createPaymentLink", connectionId: "rz", name: null, parameters: { amount_paise: 50000 } }]);
  replies.push({ status: 200, body: envelope({ ...f, revision: 5 }) });
  const saved = await flowsApi.saveSteps(f.id, f.revision, payload);
  const body = calls[0].body;
  assert.equal(calls[0].method, "PUT");
  assert.equal(body.revision, 4);
  assert.equal(body.steps[0]._id, "t");
  assert.equal(body.steps[2]._id, undefined, "new step has no _id");
  // The live API rejects PUT /steps without type ("first step must be the only trigger").
  assert.deepEqual(body.steps.map((x: any) => x.type), ["trigger", "action", "action"]);
  for (const s of body.steps) {
    for (const k of ["user_id", "company_id", "flowId", "nextStepId", "status", "webhookPath", "deletedAt"]) {
      assert.ok(!(k in s), `${k} must not be sent`);
    }
  }
  assert.equal(saved?.revision, 5);
});

test("step update, status, rename and webhook all carry the latest revision", async () => {
  const f = flow(7);
  replies.push({ status: 200, body: envelope(f) }, { status: 200, body: envelope(f) }, { status: 200, body: envelope(f) }, { status: 200, body: envelope({ webhookPath: "https://n", signing_secret_configured: true, revision: 8, topic: "orders/create" }) });
  await flowsApi.updateStep(f.id, "a1", 7, { appKey: "google-sheets", key: "appendRows", connectionId: "c1", name: "x", parameters: {} });
  await flowsApi.setStatus(f.id, "active", 7);
  await flowsApi.rename(f.id, "New", 7);
  const wh = await flowsApi.configureWebhook(f.id, { signing_secret: "s".repeat(16), revision: 7, rotate_token: true });
  assert.equal(calls[0].method, "PATCH");
  assert.match(calls[0].url, /\/admin\/flows\/.+\/steps\/a1$/);
  assert.equal(calls[0].body.revision, 7);
  assert.deepEqual(calls[1].body, { status: "active", revision: 7 });
  assert.deepEqual(calls[2].body, { name: "New", revision: 7 });
  assert.deepEqual(calls[3].body, { signing_secret: "s".repeat(16), revision: 7, rotate_token: true });
  assert.equal(wh.revision, 8);
});

test("endpoints that return a step instead of the flow yield null so the caller refetches", async () => {
  replies.push({ status: 201, body: envelope({ _id: "s-new", type: "action" }) });
  assert.equal(await flowsApi.addStep("f1", 3, {}), null);
  assert.deepEqual(calls[0].body, { revision: 3 }, "empty body adds an incomplete placeholder");
});

test("errors surface the server message and the right status", async () => {
  replies.push(
    { status: 409, body: { success: false, message: "Revision mismatch: flow is at revision 9" } },
    { status: 413, body: {} },
    { status: 503, body: { success: false, message: "Provider unavailable" } },
    "network",
    { status: 400, body: { success: false, message: "Trigger connection is required" } },
  );
  const errs: FlowApiError[] = [];
  for (let i = 0; i < 5; i++) errs.push(await flowsApi.get("f1").then(() => assert.fail("expected an error"), toFlowError));
  assert.equal(errs[0].status, 409);
  assert.equal(errs[0].message, "Revision mismatch: flow is at revision 9");
  assert.equal(errs[1].status, 413);
  assert.match(errs[1].message, /too large/i);
  assert.equal(errs[2].message, "Provider unavailable");
  assert.equal(errs[3].isNetwork, true);
  assert.equal(errs[4].message, "Trigger connection is required");
});

test("connections normalise _id, and Razorpay connection is created with appKey razorpay", async () => {
  replies.push({ status: 200, body: envelope([{ _id: "c1", appKey: "shopify", name: "Store", status: "active" }]) });
  replies.push({ status: 201, body: envelope({ id: "rz1", appKey: "razorpay", name: "Test", status: "active" }) });
  const list = await flowsApi.connections();
  assert.equal(list[0].id, "c1");
  const c = await flowsApi.createRazorpayConnection({ name: "Test", mode: "test", key_id: "rzp_test_x", key_secret: "secret" });
  assert.equal(calls[1].url, "/admin/flows/connections");
  assert.equal(calls[1].body.appKey, "razorpay");
  assert.equal(c.id, "rz1");
});

test("test run posts event_id + request_id", async () => {
  replies.push({ status: 202, body: envelope({ id: "run1", status: "queued" }) });
  const run = await flowsApi.startTestRun("f1", { event_id: "e1", request_id: "r1" });
  assert.deepEqual(calls[0].body, { event_id: "e1", request_id: "r1" });
  assert.equal(run.status, "queued");
});

// ── Stale saves & duplicate submissions ────────────────────────────────────

test("a stale save (409) refetches the latest flow and reports a conflict without losing input", async () => {
  const stale = flow(3);
  const latest = flow(5);
  let refetches = 0;
  replies.push({ status: 409, body: { success: false, message: "Flow was modified" } });
  const out = await performMutation(
    stale,
    (f) => flowsApi.updateStep(f.id, "a1", f.revision, { appKey: "google-sheets", key: "appendRows", connectionId: "c1", name: "x", parameters: { range: "A!A1:B" } }),
    async () => {
      refetches++;
      return latest;
    },
  );
  assert.equal(calls[0].body.revision, 3);
  assert.equal(out.error?.status, 409);
  assert.equal(refetches, 1);
  assert.equal(out.flow?.revision, 5);
  assert.match(out.conflict!, /unsaved edits are kept/);
});

test("editing an active flow (409) is reported, other errors don't refetch", async () => {
  let refetches = 0;
  replies.push({ status: 400, body: { success: false, message: "Step is incomplete" } });
  const out = await performMutation(flow(), (f) => flowsApi.setStatus(f.id, "active", f.revision), async () => {
    refetches++;
    return null;
  });
  assert.equal(out.error?.message, "Step is incomplete");
  assert.equal(out.conflict, null);
  assert.equal(refetches, 0);
});

test("singleFlight drops duplicate submissions while one is in flight", async () => {
  replies.push({ status: 201, body: envelope({ id: "f1", name: "A", status: "draft", revision: 1, steps: [] }) });
  const create = singleFlight((name: string) => flowsApi.create(name));
  const [a, b] = await Promise.all([create("A"), create("A")]);
  assert.equal(calls.length, 1);
  assert.equal(a?.id, "f1");
  assert.equal(b, undefined);
  assert.equal(create.isRunning(), false);
});

test("test-run request ids: network retry reuses the id, new click or new event gets a new one", () => {
  let n = 0;
  const id = () => `req-${++n}`;
  const first = nextTestRequest(null, "e1", id);
  const retry = nextTestRequest(first, "e1", id);
  assert.equal(retry.requestId, first.requestId);
  const otherEvent = nextTestRequest(first, "e2", id);
  assert.notEqual(otherEvent.requestId, first.requestId);
  const afterSuccess = nextTestRequest({ ...first, pending: false }, "e1", id);
  assert.notEqual(afterSuccess.requestId, first.requestId);
});

// ── Steps, params, mappings ────────────────────────────────────────────────

test("reordering never moves the trigger", () => {
  const s = ["T", "A", "B", "C"];
  assert.deepEqual(moveAction(s, 3, 1), ["T", "C", "A", "B"]);
  assert.equal(moveAction(s, 1, 0), s);
  assert.equal(moveAction(s, 0, 2), s);
});

test("parameter parsing keeps whole-value mappings and validates numbers/JSON", () => {
  const amount = findEvent(CATALOG, "razorpay", "createPaymentLink", "action").event!.parameters.find((p) => p.name === "amount_paise")!;
  assert.equal(amount.type, "integer");
  assert.deepEqual(parseParamInput(amount, "50000"), { value: 50000 });
  assert.deepEqual(parseParamInput(amount, "{{trigger.payload.payment.entity.amount}}"), { value: "{{trigger.payload.payment.entity.amount}}" });
  assert.ok(parseParamInput(amount, "12.5").error);
  assert.ok(parseParamInput(amount, "abc").error);
  assert.deepEqual(parseParamInput({ name: "x", label: "x", type: "json", required: false }, "[1,2]"), { value: [1, 2] });
  assert.deepEqual(parseParamInput(amount, ""), { value: undefined });
});

test("validation uses the backend schema: required, max, and row limits", () => {
  const ev = (app: string, key: string) => findEvent(CATALOG, app, key, "action").event;
  const link = ev("razorpay", "createPaymentLink");
  const missing = validateParams(link, {});
  assert.ok(missing.amount_paise && missing.description, "required fields from the schema");
  assert.equal(missing.customer_name, undefined, "optional fields are optional");
  assert.ok(validateParams(link, { amount_paise: 100_000_001, description: "x" }).amount_paise, "max from the schema");
  assert.deepEqual(validateParams(link, { amount_paise: 50000, description: "Order payment" }), {});
  assert.ok(validateParams(ev("google-sheets", "appendRows"), { spreadsheet_id: "s", range: "A!A1:C", values: [] }).values);

  assert.equal(validateRows([["a", 1, true, null]]), null);
  assert.ok(validateRows(Array.from({ length: 101 }, () => ["x"])));
  assert.ok(validateRows([Array.from({ length: 101 }, () => "x")]));
  assert.ok(validateRows([[{ nested: true }]]));
});

test("mappings may only reference earlier steps (ordered mappings)", () => {
  const steps = [step("t", { type: "trigger" }), step("s1"), step("s2"), step("s3")];
  const params = { spreadsheet_id: "{{steps.s1.spreadsheetId}}", values: [["{{steps.s3.id}}", "{{ steps.gone.x }}", "{{trigger.id}}"]] };
  assert.deepEqual(invalidStepReferences(steps, 2, params).sort(), ["gone", "s3"]);
  assert.deepEqual(invalidStepReferences(steps, 3, { a: "{{steps.s1.x}} and {{steps.s2.y}}" }), []);
  assert.deepEqual(invalidStepReferences(steps, 2, { a: "{{steps.s2.x}}" }), ["s2"], "a step can't map its own output");
});

test("mapping picker groups: trigger fields from the captured sample, then only earlier actions", () => {
  const steps = [step("t", { type: "trigger" }), step("s1", { key: "createSpreadsheet" }), step("s2"), step("s3")];
  const payload = { payment: { entity: { id: "pay_1", amount: 50000 } }, items: [{ sku: "A" }] };
  const groups = mappingGroups({
    steps,
    index: 3,
    samplePayload: payload,
    stepLabel: (s) => s.name ?? "",
    runOutputs: { s2: { updatedRange: "Order!A2:C2" } },
  });
  assert.deepEqual(groups.map((g) => g.id), ["trigger", "s1", "s2"]);
  const triggerTokens = groups[0].options.map((o) => o.token);
  assert.ok(!triggerTokens.includes("{{trigger.id}}"), "do not offer a root ID missing from the captured payload");
  assert.ok(triggerTokens.includes("{{trigger.payment.entity.amount}}"));
  assert.ok(triggerTokens.includes("{{trigger.items.0.sku}}"));
  assert.deepEqual(groups[1].options, [], "no frontend-invented outputs before a run");
  assert.match(groups[1].emptyHint!, /Run a test/);
  assert.deepEqual(groups[2].options.map((o) => o.token), ["{{steps.s2.updatedRange}}"], "fields come from the real test-run output");
});

test("flattenPayload stays bounded on huge payloads", () => {
  const big = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`k${i}`, i]));
  assert.equal(flattenPayload(big).length, 400);
});

test("contact and column pickers only offer supported paths and scalar cell values", () => {
  const payload = JSON.parse('{"customer":{"name":"Asha"},"items":[{"sku":"A"}],"constructor":"bad","$bad":"bad"}');
  const groups = mappingGroups({ steps: [step("t", { type: "trigger" })], index: 1, samplePayload: payload,
    sampleContact: { name: "Asha", phone: "+12025550123", shipping_phone: null }, stepLabel: () => "" });
  const contact = groups.find(group => group.id === "contact")!;
  assert.ok(contact.options.some(option => option.token === "{{contact.name}}"));
  assert.ok(contact.options.some(option => option.token === "{{contact.phone}}"));
  assert.ok(!contact.options.some(option => option.token === "{{contact.shipping_phone}}"));
  const columns = scalarMappingGroups(groups).flatMap(group => group.options);
  assert.ok(columns.some(option => option.token === "{{trigger.customer.name}}"));
  assert.ok(columns.some(option => option.token === "{{trigger.items.0.sku}}"));
  assert.ok(!columns.some(option => option.token === "{{trigger.customer}}" || option.token === "{{trigger.items}}"));
  assert.ok(!columns.some(option => option.token.includes("constructor") || option.token.includes("$bad")));
});

test("run states: requires_review is terminal (never auto-retried); outputs keyed by step", () => {
  for (const s of ["succeeded", "failed", "requires_review", "cancelled"]) assert.ok(isTerminalRun(s));
  for (const s of ["queued", "running"]) assert.ok(!isTerminalRun(s));
  assert.deepEqual(runOutputsByStep({ steps: [{ stepId: "s1", output: { spreadsheetId: "x" } }, { step_id: "s2", error: "boom" }] }), {
    s1: { spreadsheetId: "x" },
  });
});

// ── Catalog & connections ─────────────────────────────────────────────────

test("catalog is built only from the real GET /apps response", () => {
  assert.deepEqual(CATALOG.map((a) => a.key), ["shopify", "google-sheets", "razorpay"]);
  assert.equal(CATALOG[1].name, "Google Sheets");
  assert.equal(CATALOG[1].triggers.length, 0, "Google Sheets has actions only");
  assert.equal(findEvent(CATALOG, "shopify", "new_order", "trigger").event?.topic, "orders/create");
  assert.equal(findEvent(CATALOG, "razorpay", "payment_link_paid", "trigger").event?.topic, "payment_link.paid");

  const append = findEvent(CATALOG, "google-sheets", "appendRows", "action").event!;
  assert.equal(append.write, true);
  assert.deepEqual(append.parameters.map((p) => [p.name, p.type, p.required]), [
    ["spreadsheet_id", "string", true],
    ["range", "string", true],
    ["values", "values", true],
  ]);
  const list = findEvent(CATALOG, "shopify", "listOrders", "action").event!;
  assert.equal(list.write, false);
  assert.equal(list.parameters.find((p) => p.name === "limit")?.max, 50);
  assert.ok(list.parameters.every((p) => !p.required));
});

test("catalog has no built-in data: an empty or unknown response yields no apps", () => {
  assert.deepEqual(normalizeCatalog([]), []);
  assert.deepEqual(normalizeCatalog(null), []);
});

test("WhatsApp supplied by the API appears as an action app with template metadata", async () => {
  replies.push({ status: 200, body: envelope([...appsResponse.data, {
    appKey: "whatsapp", name: "WhatsApp", connection_api: null,
    templates_api: "/v1/admin/flows/connections/:connectionId/templates",
    triggers: [], actions: [{ key: "sendTemplate", name: "Send template", write: true,
      parameters: { to: { type: "string", required: true }, template_id: { type: "string", required: true }, contact_name: { type: "string", max: 255 }, contact_email: { type: "string", max: 255 }, variables: { type: "object" } },
    }],
  }]) });
  const catalog = normalizeCatalog(await flowsApi.apps());
  const whatsapp = catalog.filter((app) => app.actions.length).find((app) => app.key === "whatsapp");
  assert.equal(whatsapp?.name, "WhatsApp");
  assert.equal(whatsapp?.connectionApi, null);
  assert.equal(whatsapp?.templatesApi, "/v1/admin/flows/connections/:connectionId/templates");
  assert.equal(whatsapp?.triggers.length, 0);
  assert.ok(whatsapp?.actions[0].parameters.some(param => param.name === "contact_name" && !param.required && param.max === 255));
  assert.ok(whatsapp?.actions[0].parameters.some(param => param.name === "contact_email" && !param.required));
  assert.equal(findEvent(catalog, "whatsapp", "sendTemplate", "action").event?.parameters.find((param) => param.name === "variables")?.type, "json");
});

test("template choices use the selected sender and preserve server fields and unsupported reasons", async () => {
  replies.push({ status: 200, body: envelope([
    { id: "t1", name: "payment_link", language: "en", supported: true, required_variables: ["body.customer", "body.1", "button.0.1", "header.media_url"],
      variable_fields: [{ key: "header.media_url", type: "url", description: "Public HTTPS URL" }], },
    { id: "t2", name: "carousel", language: "en", supported: false, reason: "Unsupported component: CAROUSEL" },
  ]) });
  const templates = await flowsApi.templates("sender-id");
  assert.equal(calls[0].url, "/admin/flows/connections/sender-id/templates");
  assert.equal(calls[0].method, "GET");
  assert.deepEqual(templates[0].required_variables, ["body.customer", "body.1", "button.0.1", "header.media_url"]);
  assert.equal(templates[1].supported, false);
  assert.match(templates[1].reason!, /CAROUSEL/);
});

test("saving a WhatsApp action preserves dynamic recipient and prior payment-link mappings", async () => {
  const parameters = { to: "{{trigger.customer.phone}}", contact_name: "{{contact.name}}", contact_email: "{{trigger.email}}", template_id: "template-id", variables: { "body.1": "{{trigger.customer.first_name}}", "body.2": "{{steps.payment-step.short_url}}" } };
  replies.push({ status: 200, body: envelope(flow()) });
  await flowsApi.updateStep("f1", "send-step", 3, { appKey: "whatsapp", key: "sendTemplate", connectionId: "sender-id", parameters });
  assert.equal(calls[0].body.appKey, "whatsapp");
  assert.deepEqual(calls[0].body.parameters, parameters);
});

test("Shopify store input is normalised to a myshopify.com host", () => {
  assert.equal(normalizeShop("my-store"), "my-store.myshopify.com");
  assert.equal(normalizeShop("https://My-Store.myshopify.com/admin"), "my-store.myshopify.com");
  assert.equal(normalizeShop("evil.com"), null);
  assert.equal(normalizeShop(""), null);
});

// ── Automatic Shopify webhook ──────────────────────────────────────────────

test("Shopify is flagged for automatic webhook setup by the real /apps response", () => {
  const byKey = Object.fromEntries(CATALOG.map((a) => [a.key, a.automaticWebhook]));
  assert.deepEqual(byKey, { shopify: true, "google-sheets": false, razorpay: false });
  const cart = findEvent(CATALOG, "shopify", "updated_cart", "trigger").event;
  const order = findEvent(CATALOG, "shopify", "updated_order", "trigger").event;
  assert.equal(cart?.topic, "carts/update");
  assert.equal(order?.topic, "orders/updated", "cart update and order update are different triggers");
});

test("the first trigger is created with POST /steps and type trigger", async () => {
  replies.push({ status: 201, body: envelope({ id: "f1", name: "Cart", status: "draft", revision: 2, steps: [step("t", { type: "trigger", appKey: "shopify", key: "updated_cart" })] }) });
  const f = await flowsApi.addStep("f1", 1, appendStepBody("trigger", { appKey: "shopify", key: "updated_cart", connectionId: "c1", name: "Updated Cart", parameters: {} }));
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/admin/flows/f1/steps");
  assert.equal(calls[0].body.type, "trigger");
  assert.equal(calls[0].body.revision, 1);
  assert.equal(f?.steps[0].key, "updated_cart");
});

test("webhook subscribe sends an empty body — no secrets, client ids or URLs", async () => {
  replies.push({ status: 200, body: envelope({ subscribed: true, ready: true, topic: "carts/update", reused: false, signing_secret_configured: true, authentication: "shopify_app", revision: 4 }) });
  replies.push({ status: 200, body: envelope({ subscribed: true, ready: true, topic: "carts/update", authentication: "shopify_app" }) });
  replies.push({ status: 200, body: envelope({ removed: true }) });
  const sub = await flowsApi.subscribeWebhook("f1");
  const status = await flowsApi.webhookStatus("f1");
  await flowsApi.unsubscribeWebhook("f1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/admin/flows/f1/webhook/subscribe");
  assert.deepEqual(calls[0].body, {}, "no secrets, client ids or URLs are sent");
  assert.equal(sub.revision, 4);
  assert.equal(calls[1].url, "/admin/flows/f1/webhook/status");
  assert.equal(status.ready, true);
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].url, "/admin/flows/f1/webhook/subscription");
});

test("a Shopify permission error surfaces the server message for reconnect", async () => {
  replies.push({ status: 403, body: { success: false, message: "Shopify access token is missing the read_orders scope. Reconnect the store." } });
  const err = await flowsApi.subscribeWebhook("f1").then(() => assert.fail("expected an error"), toFlowError);
  assert.equal(err.status, 403);
  assert.match(err.message, /Reconnect the store/);
});

test("Shopify credential connection posts appKey shopify with shop + client credentials", async () => {
  replies.push({ status: 201, body: envelope({ id: "conn-1", appKey: "shopify", name: "My Shopify Store", status: "connected", shop_domain: "my-store.myshopify.com" }) });
  const c = await flowsApi.createShopifyConnection({ name: "My Shopify Store", shop: "my-store.myshopify.com", client_id: "cid", client_secret: "shh" });
  assert.equal(calls[0].url, "/admin/flows/connections");
  assert.deepEqual(calls[0].body, { appKey: "shopify", name: "My Shopify Store", shop: "my-store.myshopify.com", client_id: "cid", client_secret: "shh" });
  assert.equal(c.id, "conn-1");
});

test("flows without a trigger: actions can move from index 0, mappings skip the trigger by type", () => {
  const actionsOnly = [step("a1"), step("a2")];
  assert.deepEqual(moveAction(actionsOnly, 1, 0, 0).map((s) => s._id), ["a2", "a1"]);
  const withTrigger = [step("t", { type: "trigger" }), step("a1"), step("a2")];
  assert.equal(moveAction(withTrigger, 1, 0), withTrigger, "the trigger never moves");
  assert.deepEqual(invalidStepReferences(actionsOnly, 1, { x: "{{steps.a1.id}}" }), []);
  assert.deepEqual(toStepsPayload(withTrigger).map((s) => s.type), ["trigger", "action", "action"]);
});
