/* eslint-disable @typescript-eslint/no-explicit-any */

export type FlowStatus = "draft" | "active" | "inactive";
export type AppKey = "shopify" | "google-sheets" | "razorpay" | "whatsapp" | (string & {});
export type StepType = "trigger" | "action";

export interface FlowStep {
  _id: string;
  flowId?: string;
  appKey: AppKey | null;
  key: string | null;
  type: StepType;
  connectionId: string | null;
  nextStepId?: string | null;
  name: string | null;
  parameters: Record<string, any>;
  status?: "complete" | "incomplete" | string;
  webhookPath?: string | null;
  deletedAt?: string | null;
}

export interface AutomationFlow {
  id: string;
  _id?: string;
  name: string;
  status: FlowStatus;
  revision: number;
  webhookPath: string | null;
  webhookConfigured?: boolean;
  steps: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowListResult {
  items: AutomationFlow[];
  pagination: { page: number; limit: number; total: number };
  counts: { all: number; active: number; inactive: number; draft: number };
}

export interface FlowConnection {
  id: string;
  appKey: AppKey;
  name: string;
  status: string;
  mode?: string;
  /** WhatsApp connections are sender numbers; waba_id selects their templates. */
  waba_id?: string;
  display_phone_number?: string;
}

export type ParamType = "string" | "text" | "number" | "integer" | "boolean" | "values" | "json";

export interface ParamDef {
  name: string;
  label: string;
  type: ParamType;
  required: boolean;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface EventDef {
  key: string;
  name: string;
  description?: string;
  /** Provider topic for triggers, e.g. orders/create */
  topic?: string;
  parameters: ParamDef[];
  /** Known output fields, offered in the mapping picker for later steps. */
  outputs?: string[];
  /** Permission / caveat text shown in the editor. */
  note?: string;
  /** The action writes to the provider (creates/updates data). */
  write?: boolean;
}

export interface AppDef {
  key: AppKey;
  name: string;
  connectionApi?: string | null;
  templatesApi?: string;
  /** Backend registers the trigger's webhook itself (POST /webhook/subscribe). */
  automaticWebhook?: boolean;
  triggers: EventDef[];
  actions: EventDef[];
}

export interface FlowTemplate {
  id: string;
  name: string;
  language: string;
  category?: string;
  components?: { type: string; text?: string }[];
  supported: boolean;
  reason?: string;
  required_variables?: string[];
  variable_fields?: { key: string; type: "text" | "url"; description?: string }[];
}

export interface WebhookConfigResult {
  webhookPath: string;
  signing_secret_configured: boolean;
  revision: number;
  topic?: string;
}

export interface WebhookStatus {
  subscribed: boolean;
  ready: boolean;
  topic?: string | null;
  webhookPath?: string | null;
  subscription_id?: string | null;
  matching_subscriptions?: number;
  signing_secret_configured?: boolean;
  authentication?: string;
  reused?: boolean;
  revision?: number;
}

export interface ShopifySetup {
  ready: boolean;
  issue: string | null;
  scopes?: string[];
}

export interface FlowEvent {
  id: string;
  topic?: string;
  createdAt?: string;
  received_at?: string;
  [key: string]: any;
}

export interface FlowEventDetail extends FlowEvent {
  payload: unknown;
  contact?: Record<string, unknown>;
}

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "requires_review" | "cancelled";

export interface RunStepResult {
  stepId?: string;
  step_id?: string;
  name?: string;
  appKey?: string;
  key?: string;
  status?: string;
  output?: unknown;
  result?: unknown;
  error?: unknown;
  [key: string]: any;
}

export interface FlowRun {
  id: string;
  status: RunStatus | string;
  event_id?: string;
  is_test?: boolean;
  createdAt?: string;
  updatedAt?: string;
  error?: unknown;
  steps?: RunStepResult[];
  results?: RunStepResult[];
  [key: string]: any;
}
