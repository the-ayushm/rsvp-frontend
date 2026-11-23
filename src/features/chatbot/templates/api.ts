/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/** Starter chatbot templates (WhatsApp flows), not Meta-approved message templates. */
export type ChatbotTemplateCategory = { id: string; name: string; template_count: number };
export type ChatbotTemplate = {
  id: string; name: string; description: string; category_id: string; category_name: string;
  tags: string[]; badge: string; highlights: string[]; use_cases: string[];
};
export type ChatbotTemplateDetail = ChatbotTemplate & { nodes: any[]; edges: any[] };
export type DemoChoice = { id: string; label: string };
export type DemoStep = {
  node_id: string | null; message: string; choices: DemoChoice[];
  awaiting_answer: boolean; completed: boolean; captured: Record<string, unknown>;
};
export type DemoInput = Record<string, never> | { node_id: string; choice_id: string } | { node_id: string; answer: string };
export type UseTemplateInput = { name?: string; customizations: { business_name: string; support_contact?: string } };

const BASE = "/admin/chatbot";
const str = (v: unknown) => (v == null ? "" : String(v));
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => (typeof x === "string" ? x : str((x as any)?.name ?? (x as any)?.label ?? (x as any)?.title))).filter(Boolean) : [];

async function call<T>(method: "get" | "post", path: string, body?: unknown): Promise<T> {
  const res = await soft7AxiosInstance.request({ method, url: `${BASE}${path}`, data: body });
  if (res.data?.success === false) throw new Error(res.data?.message || "Request failed.");
  return (res.data?.data ?? res.data) as T;
}

const toTemplate = (t: any): ChatbotTemplate => ({
  id: str(t?.id ?? t?.slug), name: str(t?.name) || "Untitled template", description: str(t?.description),
  category_id: str(t?.category_id ?? t?.category?.id ?? t?.category),
  category_name: str(t?.category_name ?? t?.category?.name),
  tags: strings(t?.tags), badge: str(t?.badge), highlights: strings(t?.highlights), use_cases: strings(t?.use_cases),
});

// Text-bearing keys in reading order; action/buttons are choices, not text.
const TEXT_KEYS = ["header", "title", "text", "body", "message", "content", "caption", "question", "prompt", "interactive", "footer"];

const PARAGRAPH = "\n\n";

/** Readable text from a demo message: a string, a list, or a WhatsApp-style object ({text:{body}}, interactive header/body/footer). */
export function messageText(v: any, depth = 0): string {
  if (v == null || depth > 5) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(x => messageText(x, depth + 1)).filter(Boolean).join(PARAGRAPH);
  if (typeof v === "object") {
    const parts: string[] = [];
    for (const key of TEXT_KEYS) {
      const t = messageText(v[key], depth + 1);
      if (t && !parts.includes(t)) parts.push(t);
    }
    return parts.join(PARAGRAPH);
  }
  return "";
}

const toChoice = (c: any): DemoChoice =>
  typeof c === "string" ? { id: c, label: c } : {
    id: str(c?.id ?? c?.choice_id ?? c?.reply?.id ?? c?.payload),
    label: str(c?.label ?? c?.title ?? c?.reply?.title ?? c?.text ?? c?.id),
  };

/** Buttons or list rows carried inside the message itself. */
const messageChoices = (m: any): any[] => {
  const src = m?.interactive ?? m;
  const action = src?.action ?? src;
  if (Array.isArray(action?.buttons)) return action.buttons;
  if (Array.isArray(action?.sections)) return action.sections.flatMap((s: any) => (Array.isArray(s?.rows) ? s.rows : []));
  for (const key of ["choices", "options", "rows"]) if (Array.isArray(src?.[key])) return src[key];
  return [];
};

const toStep = (d: any): DemoStep => ({
  node_id: d?.node_id == null ? null : str(d.node_id),
  message: messageText(d?.message ?? d?.messages ?? d?.text),
  choices: (Array.isArray(d?.choices) && d.choices.length ? d.choices : messageChoices(d?.message)).map(toChoice).filter((c: DemoChoice) => c.id && c.label),
  awaiting_answer: Boolean(d?.awaiting_answer),
  completed: Boolean(d?.completed),
  captured: d?.captured && typeof d.captured === "object" ? d.captured : {},
});

export const templateError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const m = error.response?.data?.message;
    if (typeof m === "string" && m) return m;
    if (!error.response) return "Couldn't reach the server. Check your connection and retry.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};

export const chatbotTemplatesApi = {
  categories: async (): Promise<ChatbotTemplateCategory[]> => {
    const d = await call<any>("get", "/templates/categories");
    return (Array.isArray(d) ? d : Array.isArray(d?.categories) ? d.categories : []).map((c: any) => ({
      id: str(c?.id ?? c?.slug), name: str(c?.name) || str(c?.id), template_count: Number(c?.template_count ?? 0) || 0,
    }));
  },
  list: async ({ category, search, signal }: { category?: string; search?: string; signal?: AbortSignal } = {}): Promise<ChatbotTemplate[]> => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const q = params.toString();
    const res = await soft7AxiosInstance.get(`${BASE}/templates${q ? `?${q}` : ""}`, { signal });
    const d = res.data?.data ?? res.data;
    return (Array.isArray(d) ? d : Array.isArray(d?.templates) ? d.templates : []).map(toTemplate);
  },
  get: async (templateId: string): Promise<ChatbotTemplateDetail> => {
    const d = await call<any>("get", `/templates/${encodeURIComponent(templateId)}`);
    const t = d?.template ?? d;
    const graph = t?.flow ?? t?.graph ?? t;
    return { ...toTemplate(t), nodes: Array.isArray(graph?.nodes) ? graph.nodes : [], edges: Array.isArray(graph?.edges) ? graph.edges : [] };
  },
  /** Simulates the conversation only: nothing is created or sent. */
  demo: async (templateId: string, input: DemoInput): Promise<DemoStep> =>
    toStep(await call<any>("post", `/templates/${encodeURIComponent(templateId)}/demo`, input)),
  /** Creates a private draft chatbot and uses one Chatbot plan slot. */
  use: async (templateId: string, input: UseTemplateInput): Promise<{ id: string }> => {
    const d = await call<any>("post", `/templates/${encodeURIComponent(templateId)}/use`, input);
    return { id: str(d?.id ?? d?.chatbot?.id) };
  },
};
