/**
 * Meta WhatsApp Flows API client.
 * @see https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi/
 */

const DEFAULT_GRAPH_VERSION = "v22.0";
const BASE_URL = "https://graph.facebook.com";

export const FLOW_CATEGORIES = [
  "OTHER",
  "SURVEY",
  "CUSTOMER_SUPPORT",
  "CONTACT_US",
  "LEAD_GENERATION",
  "APPOINTMENT_BOOKING",
  "SIGN_IN",
  "SIGN_UP",
] as const;
export type FlowCategory = (typeof FLOW_CATEGORIES)[number];

export interface CreateFlowParams {
  name: string;
  categories: FlowCategory[] | string[];
  flow_json: string;
  publish?: boolean;
  endpoint_uri?: string;
}

export interface CreateFlowResponse {
  id?: string;
  success?: boolean;
  validation_errors?: Array<{
    error: string;
    error_type?: string;
    message: string;
    line_start?: number;
    line_end?: number;
    column_start?: number;
    column_end?: number;
    pointers?: Array<{ path: string }>;
  }>;
}

export interface MetaFlowItem {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED" | "BLOCKED" | "THROTTLED";
  categories: string[];
  validation_errors?: unknown[];
}

export interface ListFlowsResponse {
  data: MetaFlowItem[];
  paging?: { cursors: { before: string; after: string } };
}

/**
 * Create a new Flow via Meta Flows API.
 * New flows are created in DRAFT by default unless publish: true.
 */
export async function createFlow(
  wabaId: string,
  accessToken: string,
  params: CreateFlowParams,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<CreateFlowResponse> {
  const url = `${BASE_URL}/${apiVersion}/${wabaId}/flows`;
  const body: Record<string, unknown> = {
    name: params.name,
    categories: Array.isArray(params.categories) ? params.categories : [params.categories],
    flow_json: params.flow_json,
  };
  if (params.publish === true) body.publish = true;
  if (params.endpoint_uri) body.endpoint_uri = params.endpoint_uri;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // Surface full error payload so we can see validation_errors from Meta
    const msg =
      (data?.error && typeof data.error === "object"
        ? JSON.stringify(data.error)
        : data?.error?.message) || `Flows API error: ${res.status}`;
    throw new Error(msg);
  }
  return data as CreateFlowResponse;
}

/**
 * Publish a draft Flow. Once published, the flow cannot be deleted (only deprecated).
 */
export async function publishFlow(
  metaFlowId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}/publish`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Publish flow failed: ${res.status}`);
  }
  return data as { success: boolean };
}

/**
 * Update flow metadata (name, categories, endpoint_uri).
 */
export async function updateFlowMetadata(
  metaFlowId: string,
  accessToken: string,
  updates: { name?: string; categories?: string[]; endpoint_uri?: string },
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Update flow failed: ${res.status}`);
  }
  return data as { success: boolean };
}

/**
 * Update Flow JSON for a draft flow (form-data with file).
 */
export async function updateFlowJson(
  metaFlowId: string,
  accessToken: string,
  flowJson: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<{ success: boolean; validation_errors?: unknown[] }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}/assets`;
  const form = new FormData();
  form.append("name", "flow.json");
  form.append("asset_type", "FLOW_JSON");
  form.append("file", new Blob([flowJson], { type: "application/json" }), "flow.json");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Update flow JSON failed: ${res.status}`);
  }
  return data as { success: boolean; validation_errors?: unknown[] };
}

/**
 * Deprecate a published Flow. Cannot be undone.
 */
export async function deprecateFlow(
  metaFlowId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}/deprecate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Deprecate flow failed: ${res.status}`);
  }
  return data as { success: boolean };
}

/**
 * Delete a draft Flow (only DRAFT can be deleted).
 */
export async function deleteFlow(
  metaFlowId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Delete flow failed: ${res.status}`);
  }
  return data as { success: boolean };
}

/**
 * List all Flows for a WABA.
 */
export async function listFlows(
  wabaId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<ListFlowsResponse> {
  const url = `${BASE_URL}/${apiVersion}/${wabaId}/flows`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `List flows failed: ${res.status}`);
  }
  return data as ListFlowsResponse;
}

/**
 * Get a single Flow's details.
 */
export async function getFlow(
  metaFlowId: string,
  accessToken: string,
  apiVersion: string = DEFAULT_GRAPH_VERSION
): Promise<MetaFlowItem & { json_version?: string; endpoint_uri?: string; preview?: { preview_url: string; expires_at: string } }> {
  const url = `${BASE_URL}/${apiVersion}/${metaFlowId}?fields=id,name,status,categories,validation_errors,json_version,endpoint_uri,preview`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Get flow failed: ${res.status}`);
  }
  return data;
}
