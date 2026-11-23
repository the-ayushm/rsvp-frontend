import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { shopifyApi, shopifyErrorMessage } from "./api";

const originalAdapter = soft7AxiosInstance.defaults.adapter;
let calls: InternalAxiosRequestConfig[];
let result: unknown;

beforeEach(() => {
  calls = [];
  result = {};
  soft7AxiosInstance.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: { success: true, data: result }, status: 200, statusText: "OK", headers: {}, config };
  };
});

afterEach(() => {
  soft7AxiosInstance.defaults.adapter = originalAdapter;
});

test("store listing calls hostapi directly and retains JWT authentication", async () => {
  result = { connections: [{ _id: "store-1", shop_domain: "test.myshopify.com", status: "active" }] };
  const previous = soft7AxiosInstance.defaults.headers.common.Authorization;
  soft7AxiosInstance.defaults.headers.common.Authorization = "Bearer synthetic-test-token";
  try {
    const stores = await shopifyApi.connections();
    assert.equal(stores[0].id, "store-1");
    assert.equal(soft7AxiosInstance.getUri(calls[0]), "https://hostapi.soft7.in/v1/admin/shopify/connections");
    assert.equal(calls[0].headers.Authorization, "Bearer synthetic-test-token");
    assert.equal(calls[0].timeout, 20_000);
  } finally {
    if (previous === undefined) delete soft7AxiosInstance.defaults.headers.common.Authorization;
    else soft7AxiosInstance.defaults.headers.common.Authorization = previous;
  }
});

test("setup, app credentials and disconnect call hostapi directly", async () => {
  await shopifyApi.setup();
  const previousBaseURL = soft7AxiosInstance.defaults.baseURL;
  soft7AxiosInstance.defaults.baseURL = "/api";
  try {
    await shopifyApi.connectWithCredentials({ name: "Store", shop: "test.myshopify.com", client_id: "test", client_secret: "synthetic" });
  } finally {
    soft7AxiosInstance.defaults.baseURL = previousBaseURL;
  }
  await shopifyApi.disconnect("store/1");
  assert.deepEqual(calls.map((call) => soft7AxiosInstance.getUri(call)), [
    "https://hostapi.soft7.in/v1/admin/shopify/setup",
    "https://hostapi.soft7.in/v1/admin/flows/connections",
    "https://hostapi.soft7.in/v1/admin/shopify/connections/store%2F1",
  ]);
  assert.equal(JSON.parse(calls[1].data).appKey, "shopify");
  assert.equal(calls[1].url, "https://hostapi.soft7.in/v1/admin/flows/connections");
  assert.equal(calls[1].method, "post");
  assert.equal(calls[2].method, "delete");
});

test("OAuth start keeps credentials on the API origin for the callback cookie", async () => {
  await shopifyApi.startOAuth({ name: "Store", shop: "test.myshopify.com" });
  assert.equal(calls[0].baseURL, "https://hostapi.soft7.in/v1");
  assert.equal(calls[0].url, "/admin/shopify/oauth/start");
  assert.equal(calls[0].withCredentials, true);
});

test("failed requests remain failures and expose useful API and timeout errors", async () => {
  soft7AxiosInstance.defaults.adapter = async (config) => {
    throw new AxiosError("HTTP 403", "ERR_BAD_RESPONSE", config, null, {
      data: { message: "Only the account owner can manage Shopify connections." },
      status: 403, statusText: "Forbidden", headers: {}, config,
    });
  };
  await assert.rejects(shopifyApi.connections(), (error) => {
    assert.equal(shopifyErrorMessage(error), "Only the account owner can manage Shopify connections.");
    return true;
  });
  assert.match(shopifyErrorMessage(new AxiosError("Network Error", "ERR_NETWORK")), /reach the Shopify API/);
  assert.match(shopifyErrorMessage(new AxiosError("timeout", "ECONNABORTED")), /too long/);
});
