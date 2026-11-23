import assert from "node:assert/strict";
import { test } from "node:test";
import { assertOnboardingAccepted, EmbeddedSignupCoordinator, META_CODE_WAIT_MS, META_FINISH_EVENTS, META_SESSION_WAIT_MS, parseSignupSession, signupAssetIds, signupErrorMessage, type OnboardPayload, type SignupStage } from "./embedded-signup";

const origin = "https://www.facebook.com";
const session = (event = "FINISH", data: Record<string, unknown> = { waba_id: "123456", phone_number_id: "654321" }) => ({ type: "WA_EMBEDDED_SIGNUP" as const, event, data });
const login = { authResponse: { code: "test-single-use-code" } };
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function harness(onboard?: (payload: OnboardPayload) => Promise<void>) {
  const payloads: OnboardPayload[] = [];
  const stages: SignupStage[] = [];
  const errors: string[] = [];
  const timers = new Set<{ callback: () => void; delay: number }>();
  const coordinator = new EmbeddedSignupCoordinator({
    onboard: async payload => { payloads.push(payload); await onboard?.(payload); },
    onStage: value => stages.push(value),
    onError: message => errors.push(message),
    schedule: (callback, delay) => {
      const timer = { callback, delay };
      timers.add(timer);
      return () => { timers.delete(timer); };
    },
  });
  const tick = (delay: number) => {
    for (const timer of [...timers]) if (timer.delay === delay) { timers.delete(timer); timer.callback(); }
  };
  return { coordinator, payloads, stages, errors, timers, tick };
}

test("accepts JSON and object messages from HTTPS Facebook hosts only", () => {
  assert.equal(parseSignupSession(origin, JSON.stringify(session()))?.event, "FINISH");
  assert.equal(parseSignupSession("https://business.facebook.com", session())?.data.waba_id, "123456");
  for (const candidate of ["https://evilfacebook.com", "https://facebook.com.evil.test", "http://www.facebook.com", "null"]) {
    assert.equal(parseSignupSession(candidate, session()), null);
  }
  for (const value of [null, [], "not JSON", { type: "OTHER", event: "FINISH" }]) assert.equal(parseSignupSession(origin, value), null);
});

test("supports every documented completion event, including WABA-only coexistence", async () => {
  for (const event of META_FINISH_EVENTS) {
    const h = harness();
    const attempt = h.coordinator.start();
    h.coordinator.receiveSession(origin, session(event, { waba_id: "123456" }));
    h.coordinator.receiveLogin(login, attempt);
    await settle();
    assert.deepEqual(h.payloads, [{ code: login.authResponse.code, state: null, waba_id: "123456", phone_number_id: null }]);
    assert.equal(h.stages.at(-1), "success");
  }
});

test("joins code-first callbacks with delayed session data and submits once", async () => {
  const h = harness();
  const attempt = h.coordinator.start();
  h.coordinator.receiveLogin(login, attempt);
  await settle();
  assert.equal(h.payloads.length, 0);
  h.coordinator.receiveSession(origin, JSON.stringify(session()));
  h.coordinator.receiveLogin(login, attempt);
  h.coordinator.receiveSession(origin, session());
  h.tick(META_SESSION_WAIT_MS);
  await settle();
  assert.equal(h.payloads.length, 1);
  assert.equal(h.payloads[0].phone_number_id, "654321");
});

test("sends the code promptly for server resolution when Meta omits session data", async () => {
  const h = harness();
  h.coordinator.receiveLogin(login, h.coordinator.start());
  h.tick(META_SESSION_WAIT_MS);
  await settle();
  assert.deepEqual(h.payloads, [{ code: login.authResponse.code, state: null, waba_id: null, phone_number_id: null }]);
  h.coordinator.receiveSession(origin, session());
  await settle();
  assert.equal(h.payloads.length, 1);
});

test("does not guess among multiple WABAs or accept rounded numeric IDs", () => {
  assert.deepEqual(signupAssetIds(session("FINISH", { waba_ids: ["123", "456"] })), { waba_id: null, phone_number_id: null });
  assert.equal(signupAssetIds(session("FINISH", { waba_ids: ["123"] })).waba_id, "123");
  assert.equal(signupAssetIds(session("FINISH", { waba_id: 9007199254740992 })).waba_id, null);
});

test("cancellation stops pending submission and ignores stale callbacks", async () => {
  const h = harness();
  const attempt = h.coordinator.start();
  h.coordinator.receiveLogin(login, attempt);
  h.coordinator.receiveSession(origin, session("CANCEL", { current_step: "PHONE_NUMBER_SETUP" }));
  h.tick(META_SESSION_WAIT_MS);
  h.coordinator.receiveLogin(login, attempt);
  await settle();
  assert.equal(h.payloads.length, 0);
  assert.equal(h.stages.at(-1), "error");
  const nextAttempt = h.coordinator.start();
  h.coordinator.receiveLogin(login, attempt);
  assert.equal(h.timers.size, 0);
  h.coordinator.receiveSession(origin, session());
  h.coordinator.receiveLogin(login, nextAttempt);
  await settle();
  assert.equal(h.payloads.length, 1);
});

test("late popup cancellation does not overwrite a completed signup", async () => {
  const h = harness();
  const attempt = h.coordinator.start();
  h.coordinator.receiveSession(origin, session());
  h.coordinator.receiveSession(origin, session("CANCEL"));
  h.coordinator.receiveLogin(login, attempt);
  await settle();
  assert.equal(h.stages.at(-1), "success");
  assert.deepEqual(h.errors, []);
});

test("missing authorization codes and Meta error messages remain visible", () => {
  const h = harness();
  h.coordinator.start();
  h.coordinator.receiveSession(origin, session());
  h.tick(META_CODE_WAIT_MS);
  assert.match(h.errors[0], /authorization code/);
  h.coordinator.start();
  h.coordinator.receiveSession(origin, session("CANCEL", { error_message: "Number not eligible" }));
  assert.equal(h.errors.at(-1), "Number not eligible");
});

test("failed backend requests are not reported as success or replayed automatically", async () => {
  const h = harness(async () => { throw { isAxiosError: true, code: "ECONNABORTED" }; });
  const attempt = h.coordinator.start();
  h.coordinator.receiveSession(origin, session());
  h.coordinator.receiveLogin(login, attempt);
  await settle();
  h.coordinator.receiveLogin(login, attempt);
  h.coordinator.receiveSession(origin, session());
  h.tick(META_SESSION_WAIT_MS);
  await settle();
  assert.equal(h.stages.at(-1), "error");
  assert.equal(h.payloads.length, 1);
  assert.match(h.errors[0], /may still have completed/);
});

test("HTTP success alone is insufficient when the backend rejects onboarding", () => {
  assert.doesNotThrow(() => assertOnboardingAccepted({ success: true }));
  assert.doesNotThrow(() => assertOnboardingAccepted({ data: { waba_id: "123456" } }));
  for (const response of [null, "OK", {}, { success: false, message: "Token expired" }, { success: true, data: { success: false, message: "Register failed" } }]) {
    assert.throws(() => assertOnboardingAccepted(response));
  }
  assert.equal(signupErrorMessage({ response: { data: { success: false, message: "Token expired" } } }), "Token expired");
  assert.equal(signupErrorMessage({ response: { data: { errors: { code: ["Authorization expired"] } } } }), "Authorization expired");
});

test("unmount cancels timers and ignores responses from a disposed attempt", async () => {
  const h = harness();
  const attempt = h.coordinator.start();
  h.coordinator.receiveLogin(login, attempt);
  h.coordinator.dispose();
  h.tick(META_SESSION_WAIT_MS);
  h.coordinator.receiveSession(origin, session());
  await settle();
  assert.equal(h.payloads.length, 0);
});
