/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  addEdge,
  Connection,
  MarkerType,
  NodeProps,
  useReactFlow,
  useUpdateNodeInternals,
  useNodesInitialized,
  ReactFlowProvider,
  Handle,
  getSmoothStepPath,
  ConnectionLineType,
  Position,
} from "reactflow";
import { useRouter } from "next/navigation";
import "reactflow/dist/style.css";
import "./builder.css";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  ConfigProvider,
  Card,
  Tag,
  Typography,
  Space,
  Button,
  Form,
  Input,
  Select,
  Slider,
  Radio,
  Switch,
  theme,
  Drawer,
  Collapse,
  Divider,
  Modal,
  Spin,
} from "antd";

import {
  SaveOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  UndoOutlined,
  RedoOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  MessageOutlined,
  AppstoreOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  MinusOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  FullscreenOutlined,
  ApartmentOutlined,
  CloseOutlined,
  BookOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
  EditOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";

import { MediaPickerModal } from "@/features/media/components/MediaPickerModal";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
// Maps JSON data.key →  UI node type
const KEY_TO_TYPE: Record<string, string> = {
  "@whatsapp/on-message": "trigger",
  "@whatsapp/send-text-message": "message",
  "@whatsapp/send-button-message": "interactive",
  "@whatsapp/send-list-message": "listMessage",
  "@whatsapp/send-template-message": "template",
  "@whatsapp/send-media-message": "sendMedia",
  "@whatsapp/ask-question": "askQuestion",
  "@whatsapp/ask-location": "askLocation",
  "@whatsapp/send-cta-message": "ctaMessage",
  "@whatsapp/send-product-message": "productMessage",
  "@whatsapp/update-tag": "updateTag",
  "@whatsapp/update-column": "updateColumn",
  "@whatsapp/fetch-contact": "fetchContact",
  "@whatsapp/stop-chatbot": "stopChatbot",
  "@whatsapp/ai-agent": "ai",
  "@http/http-request": "action",
  "@condition/condition-action": "condition",
  "@whatsapp/delay": "delay",
};
console.log("Builder Loaded");
// Maps your UI node type → JSON data.key
const TYPE_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_TYPE).map(([k, v]) => [v, k]),
);

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: any[];
}

export const getTemplateButtons = (components: any[]) => {
  const buttonsComponent = components.find((c: any) => c.type === "BUTTONS");
  if (!buttonsComponent || !buttonsComponent.buttons) return [];
  return buttonsComponent.buttons.map((btn: any, index: number) => ({
    id: btn.id || `btn_${index}`,
    label: btn.text || "",
    type: btn.type || "quick_reply",
  }));
};

type ChatbotPhoneNumber = {
  id: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  status?: string;
};
type AIAssistant = {
  id: number | string | null;
  assistantId?: number | string | null;
  assistant_id?: number | string | null;
  uuid?: number | string | null;
  name: string;
  role?: string;
  status?: string;
  promptType?: string;
  predefinedPrompt?: string | null;
  customPrompt?: string | null;
  provider?: string;
  model?: string;
};

/** Normalize assistant IDs from all supported API field names. */
const normalizeAssistantId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (!normalized || normalized === "null" || normalized === "undefined") return "";
  return normalized;
};

const getAssistantId = (assistant: any): string =>
  normalizeAssistantId(
    assistant?.id ?? assistant?.assistantId ?? assistant?.assistant_id ?? assistant?.uuid,
  );

const normalizeAIAssistant = (assistant: any): AIAssistant | null => {
  if (!assistant || typeof assistant !== "object") return null;
  const id = getAssistantId(assistant);
  return {
    ...assistant,
    id: id || null,
    assistantId: id || null,
    name: String(assistant?.name ?? assistant?.title ?? "Unnamed Assistant"),
  };
};

const normalizePhoneNumbers = (payload: any): ChatbotPhoneNumber[] => {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data?.data)
      ? payload.data.data
      : Array.isArray(payload?.data?.phone_numbers)
        ? payload.data.phone_numbers
        : Array.isArray(payload?.data?.phoneNumbers)
          ? payload.data.phoneNumbers
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.phone_numbers)
              ? payload.phone_numbers
              : Array.isArray(payload?.results)
                ? payload.results
                : [];

  const unique = new Map<string, ChatbotPhoneNumber>();
  rawList.forEach((phone: any) => {
    const id = String(
      phone?.phone_number_id ?? phone?.phoneNumberId ?? phone?.id ?? "",
    ).trim();
    if (!id || unique.has(id)) return;

    unique.set(id, {
      id,
      displayPhoneNumber: String(
        phone?.display_phone_number ??
          phone?.displayPhoneNumber ??
          phone?.phone_number ??
          phone?.number ??
          id,
      ),
      verifiedName: phone?.verified_name ?? phone?.verifiedName,
      status: phone?.status,
    });
  });

  return Array.from(unique.values());
};

const extractApiList = (payload: any, keys: string[] = []): any[] => {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.data?.results,
    payload?.data?.items,
    payload?.results,
    payload?.items,
    ...keys.flatMap((key) => [
      payload?.[key],
      payload?.data?.[key],
      payload?.data?.data?.[key],
    ]),
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const normalizeTagOptions = (payload: any) =>
  extractApiList(payload, ["tags"])
    .map((tag: any) => {
      const id = String(tag?.id ?? tag?.tag_id ?? tag?.tagId ?? tag?.uuid ?? "").trim();
      const name = String(
        tag?.name ?? tag?.label ?? tag?.tag_name ?? tag?.tagName ?? "",
      ).trim();

      return id && name ? { id, name } : null;
    })
    .filter(Boolean);

const normalizeColumnOptions = (payload: any) =>
  extractApiList(payload, ["columns"])
    .map((column: any) => {
      const id = String(
        column?.id ??
          column?.column_id ??
          column?.columnId ??
          column?.uuid ??
          column?.key ??
          column?.name ??
          "",
      ).trim();

      const name = String(
        column?.name ??
          column?.label ??
          column?.display_name ??
          column?.displayName ??
          column?.column_name ??
          column?.columnName ??
          column?.key ??
          column?.id ??
          "",
      ).trim();

      return id && name ? { ...column, id, name, label: name } : null;
    })
    .filter(Boolean);

const DELAY_UNIT_TO_MS: Record<string, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

const DELAY_UNITS = ["seconds", "minutes", "hours", "days", "weeks"] as const;

const delayToMilliseconds = (value: any, unit: string): number => {
  const numericValue = Number(value);
  const multiplier = DELAY_UNIT_TO_MS[unit] || DELAY_UNIT_TO_MS.minutes;

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return Math.round(numericValue * multiplier);
};

const millisecondsToDelay = (milliseconds: any) => {
  const ms = Number(milliseconds);

  if (!Number.isFinite(ms) || ms < 0) {
    return { value: 1, unit: "minutes" };
  }

  // Pick the largest unit that represents the API value exactly.
  for (let i = DELAY_UNITS.length - 1; i >= 0; i -= 1) {
    const candidateUnit = DELAY_UNITS[i];
    const candidateMs = DELAY_UNIT_TO_MS[candidateUnit];

    if (ms >= candidateMs && ms % candidateMs === 0) {
      return {
        value: ms / candidateMs,
        unit: candidateUnit,
      };
    }
  }

  // Keep sub-minute values usable instead of rounding them to zero.
  return {
    value: Math.max(1, Math.ceil(ms / DELAY_UNIT_TO_MS.seconds)),
    unit: "seconds",
  };
};

function transformNodeFromApi(n: any) {
  // If node already has a UI-specific type, use it
  // If it's "action" or "trigger", derive from data.key
  let uiType = n.type;
  if (n.type === "action" || n.type === "trigger") {
    uiType = KEY_TO_TYPE[n.data?.key] ?? n.type;
  }

  // Transform data.attributes → flat data shape your UI components expect
  const attrs = n.data?.attributes || {};
  let uiData: any = { ...n.data, _key: n.data?.key };

  // Normalize the generic node output variable from all supported
  // locations used by older/newer chatbot flow payloads.
  const outputVariable = String(
    n.data?.variable ??
      n.data?.dataOut?.variable ??
      attrs?.variable ??
      "",
  ).trim();

  uiData = {
    ...uiData,
    variable: outputVariable,
    dataOut: {
      ...(n.data?.dataOut || {}),
      ...(outputVariable ? { variable: outputVariable } : {}),
    },
  };

  switch (uiType) {
    case "trigger":
      uiData = {
        ...uiData,
        label: n.data?.title || "On Message",
        messageType: attrs.type || "text",
        keywords: attrs.keywords || [],
        fuzzy: attrs.fuzzyMatching?.enabled || false,
        sensitivity: (attrs.fuzzyMatching?.threshold || 0.8) * 100,
       phoneNumberIds: attrs.receiverIds || [],
      };
      break;

    case "message":
      uiData = {
        ...uiData,
        label: n.data?.title || "Send Text Message",
        text: attrs.message?.text?.body || "",
        previewUrl: attrs.message?.text?.preview_url || false,
      };
      break;

    case "interactive": {
      const interactive = attrs.message?.interactive || {};
      const buttons = (interactive.action?.buttons || []).map(
        (b: any, index: number) => ({
          // React Flow handle IDs must be stable and unique per button.
          // Keep the backend ID when present; otherwise create a deterministic
          // fallback so reloading the chatbot does not break saved edges.
          id: String(b.reply?.id || b.id || `btn_${String(n.id)}_${index}`),
          label: b.reply?.title || b.title || "",
          type: "quick_reply",
        }),
      );
      const hType = interactive.header?.type || "none";
      uiData = {
        ...uiData,
        label: n.data?.title || "Send Button Message",
        headerType: hType,
        headerText: interactive.header?.text || "",
        headerMediaUrl:
          interactive.header?.[hType]?.link ||
          interactive.header?.[hType]?.url ||
          "",
        headerUrl:
          interactive.header?.[hType]?.link ||
          interactive.header?.[hType]?.url ||
          "",
        text: interactive.body?.text || "",
        footer: interactive.footer?.text || "",
        buttons: buttons.map((b: any) => b.label),
        _buttonIds: buttons,
        interactiveType: "buttons",
      };
      break;
    }
    case "listMessage": {
      const interactive = attrs.message?.interactive || {};
      const sections = (interactive.action?.sections || []).map((sec: any) => ({
        id: sec.title || `section_${Date.now()}`,
        title: sec.title || "",
        rows: (sec.rows || []).map((row: any) => ({
          id: row.id, // ← preserve original row.id as handle ID
          title: row.title || "",
          description: row.description || "",
        })),
      }));
      uiData = {
  ...uiData,
  label: n.data?.title || "Send List Message",
  headerType: "text",
  headerText: interactive.header?.text || "",
  text: interactive.body?.text || "",
        listButtonText: interactive.action?.button || "View Options",
        footer: interactive.footer?.text || "",
        sections: sections.length
          ? sections
          : [
              {
                id: "section_0",
                title: "",
                rows: [{ id: "row_0", title: "", description: "" }],
              },
            ],
        interactiveType: "list",
      };
      break;
    }

    case "askQuestion":
      uiData = {
        ...uiData,
        label: n.data?.title || "Ask Question",
        attributes: {
          message: attrs.message || {
            type: "text",
            text: { body: "", preview_url: false },
          },
          format: attrs.format || { type: "any" },
          timeout: attrs.timeout || {
            unit: "seconds",
            value: 60,
            continueOnTimeout: false,
          },
          variable: attrs.variable || "",
        },
      };
      break;

    case "askLocation":
      uiData = {
        ...uiData,
        label: n.data?.title || "Ask Location",
        message: attrs.message?.text?.body || "",
        variable: n.data?.variable || attrs.variable || "location", // ← top-level in API JSON
      };
      break;

    case "delay": {
      // API -> UI:
      // Backend stores the delay in milliseconds at attributes.delay.
      // Convert it back into the Value + Unit fields used by DelayNode.
      const storedDelay = Number(
        attrs.delay ??
          n.data?.delay ??
          delayToMilliseconds(
            n.data?.value ?? 1,
            n.data?.unit || "minutes",
          ),
      );

      const delayMs =
        Number.isFinite(storedDelay) && storedDelay >= 0
          ? Math.round(storedDelay)
          : 60000;

      const delayUi = millisecondsToDelay(delayMs);

      uiData = {
        ...uiData,
        label: n.data?.title || "Delay",
        delayType: "delay_for",
        value: delayUi.value,
        unit: delayUi.unit,
        delay: delayMs,
      };
      break;
    }
    case "condition":
      uiData = {
        ...uiData,
        label: n.data?.title || "Condition",
        operator: attrs.operator || "and",
        conditions: (attrs.conditions || []).map((c: any, i: number) => ({
          id: `cond_${i}`,
          field: c.field || "",
          comparator: c.comparator || "equals",
          value: c.value || "",
          threshold: c.threshold || 0.8,
        })),
      };
      break;

    case "action": // HTTP
      uiData = {
        ...uiData,
        label: n.data?.title || "HTTP",
        method: attrs.method || "GET",
        url: attrs.url || "",
        headers: attrs.headers || [{ key: "", value: "" }],
        params: attrs.params || [],
        body: attrs.body || "",
      };
      break;
      case "ai": {
        const assistantId = normalizeAssistantId(
          attrs.assistantId ?? attrs.assistant_id ?? attrs.assistant ??
            n.data?.assistantId ?? n.data?.assistant_id,
        );
        uiData = {
          ...uiData,
          label: n.data?.title || "AI Agent",
          stopKeywords: Array.isArray(attrs.stopKeywords)
            ? attrs.stopKeywords.map((keyword: any) => String(keyword).trim()).filter(Boolean)
            : ["/stop"],
          assistant: assistantId,
          timeoutValue: Number(attrs.timeout?.value ?? attrs.timeoutValue ?? 5) || 5,
          timeoutUnit: attrs.timeout?.unit ?? attrs.timeoutUnit ?? "minutes",
          welcomeMessage: attrs.welcomeMessage ?? "",
          timeoutMessage: attrs.timeoutMessage ?? "",
        };
        break;
      }
       case "sendMedia": {
      const msg = attrs.message || {};
      const mType = msg.type || "image";
      const mediaObj = msg[mType] || {};
      uiData = {
        ...uiData,
        label: n.data?.title || "Send Media Message",
        mediaType: String(mType).toLowerCase(),
        mediaUrl: mediaObj.link || mediaObj.url || "",
        caption: mediaObj.caption || "",
        documentFilename:
          mediaObj.filename ||
          mediaObj.file_name ||
          mediaObj.fileName ||
          "",
      };
      break;
    }
    case "ctaMessage": {
      const interactive = attrs.message?.interactive || {};
      const hType = interactive.header?.type || "none";
      uiData = {
        ...uiData,
        label: n.data?.title || "Send CTA Message",
        headerType: hType,
        headerText: interactive.header?.text || "",
        headerUrl: safeString(
          interactive.header?.[hType]?.link ??
            interactive.header?.[hType]?.url,
        ),
        text: safeString(interactive.body?.text),
        displayText: safeString(
          interactive.action?.parameters?.display_text,
        ),
        ctaUrl: safeString(interactive.action?.parameters?.url),
        footer: safeString(interactive.footer?.text),
        interactiveType: "cta_url",
      };
      break;
    }
    case "productMessage": {
      const interactive = attrs.message?.interactive || {};
      uiData = {
        ...uiData,
        label: n.data?.title || "Send Product Message",
        catalogId: interactive.action?.catalog_id || "",
        retailerId: interactive.action?.product_retailer_id || "",
        text: interactive.body?.text || "",
        footer: interactive.footer?.text || "",
        interactiveType: "product",
      };
      break;
    }
    case "updateTag":
      uiData = {
        ...uiData,
        label: n.data?.title || "Update Tag",
        tags: Array.isArray(attrs.tags)
          ? attrs.tags
              .map((tag: any) => String(tag?.id ?? tag?.tagId ?? tag).trim())
              .filter(Boolean)
          : Array.isArray(attrs.tagIds)
            ? attrs.tagIds.map((tag: any) => String(tag).trim()).filter(Boolean)
            : Array.isArray(n.data?.tags)
              ? n.data.tags
              : [],
      };
      break;

    case "updateColumn":
      uiData = {
        ...uiData,
        label: n.data?.title || "Update Columns",
        columnUpdates: Array.isArray(attrs.columnUpdates)
          ? attrs.columnUpdates
          : Array.isArray(attrs.columns)
            ? attrs.columns.map((entry: any, index: number) => ({
                id: String(entry?.id ?? `col_${index}`),
                column: String(
                  entry?.column ??
                    entry?.name ??
                    entry?.columnName ??
                    entry?.key ??
                    "",
                ),
                value: String(entry?.value ?? ""),
              }))
            : Array.isArray(n.data?.columnUpdates)
              ? n.data.columnUpdates
              : [],
      };
      break;

    default:
      uiData = { ...uiData, label: n.data?.title || uiType };
  }
  return {
    id: n.id,
    type: uiType,
    data: uiData,
    position: n.position ?? { x: 100, y: 100 },
    measured: n.measured,
    selected: false,
    dragging: false,
  };
}

function transformEdgeFromApi(e: any, nodes: any[]) {
  let sourceHandle = String(
    e.sourceHandle ||
      e.data?.sourceHandle ||
      e.data?.button_id ||
      e.data?.row_id ||
      "out",
  ).trim();

  const sourceNode = nodes.find((node: any) => node.id === e.source);

  // Older saved flows may contain btn_0 / btn_1, while the rendered
  // interactive node uses the real persisted button IDs. React Flow requires
  // an exact sourceHandle match, otherwise the edge exists but looks broken.
  if (
    (sourceNode?.type === "interactive" || sourceNode?.type === "buttonMessage") &&
    sourceHandle.startsWith("btn_")
  ) {
    const buttons = Array.isArray(sourceNode.data?._buttonIds)
      ? sourceNode.data._buttonIds
      : Array.isArray(sourceNode.data?.buttons)
        ? sourceNode.data.buttons.map((button: any, index: number) => ({
            id: typeof button === "object" ? button?.id : undefined,
            label: typeof button === "object" ? button?.label : button,
            index,
          }))
        : [];

    const exactButton = buttons.find(
      (button: any) => String(button?.id || "") === sourceHandle,
    );

    if (!exactButton) {
      const match = sourceHandle.match(/^btn_(\d+)$/);
      if (match) {
        const index = Number(match[1]);
        const buttonAtIndex = buttons[index];
        if (buttonAtIndex?.id) sourceHandle = String(buttonAtIndex.id);
      }
    }
  }

  // Older saved flows may also contain row_0 / row_1. Map those to the
  // actual row IDs rendered by the current list node.
  if (sourceNode?.type === "listMessage" && sourceHandle.startsWith("row_")) {
    const rows = (sourceNode.data?.sections || []).flatMap(
      (section: any) => section.rows || [],
    );

    const exactRow = rows.find(
      (row: any) => String(row?.id || "") === sourceHandle,
    );

    if (!exactRow) {
      const match = sourceHandle.match(/^row_(\d+)$/);
      if (match) {
        const index = Number(match[1]);
        const rowAtIndex = rows[index];
        if (rowAtIndex?.id) sourceHandle = String(rowAtIndex.id);
      }
    }
  }

  let branch: string | undefined;
  let style = {
    stroke: "var(--color-primary-hover)",
    strokeWidth: 2.5,
    strokeDasharray: "5 5" as const,
  };
  let label = e.label;

  if (sourceHandle === "default") sourceHandle = "out";

  if (sourceHandle.startsWith("condition-true-")) {
    sourceHandle = "true";
    branch = "true";
    label = label || "True";
    style = { stroke: "var(--color-success)", strokeWidth: 2, strokeDasharray: "5 5" };
  } else if (sourceHandle.startsWith("condition-false-")) {
    sourceHandle = "false";
    branch = "false";
    label = label || "False";
    style = { stroke: "var(--color-primary)", strokeWidth: 2, strokeDasharray: "5 5" };
  }

  const targetHandle = String(
    e.targetHandle || e.data?.targetHandle || "in",
  ).trim() || "in";

  return {
    id: e.id || `edge_${e.source}_${e.target}_${sourceHandle}_${targetHandle}`,
    source: e.source,
    target: e.target,
    sourceHandle,
    targetHandle,
    label,
    animated: e.animated ?? true,
    data: {
      ...(e.data || {}),
      sourceHandle,
      targetHandle,
      ...(sourceHandle.startsWith("btn_") ? { button_id: sourceHandle } : {}),
      ...(sourceHandle.startsWith("row_") ? { row_id: sourceHandle } : {}),
      ...(branch ? { branch } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed },
    style,
  };
}

function transformEdgesFromApi(edges: any[], nodes: any[]) {
  const seen = new Set<string>();

  return (Array.isArray(edges) ? edges : [])
    .map((edge: any) => transformEdgeFromApi(edge, nodes))
    .filter((edge: any) => {
      const key = [
        edge.source,
        edge.target,
        edge.sourceHandle || "out",
        edge.targetHandle || "in",
      ].join("::");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function transformNodeToApi(n: any) {
  const key = n.data?._key || TYPE_TO_KEY[n.type] || n.type;
  const data = n.data || {};
  let attributes: any = {};

  switch (n.type) {
    case "trigger":
      attributes = {
       receiverIds: Array.isArray(data.phoneNumberIds)
  ? data.phoneNumberIds
  : [],
        keywords: data.keywords || [],
        type: data.messageType || "text",
        fuzzyMatching: {
          enabled: data.fuzzy || false,
          threshold: (data.sensitivity || 80) / 100,
        },
      };
      break;

    case "message":
      attributes = {
        message: {
          type: "text",
          text: {
            body: data.text || "",
            preview_url: data.previewUrl || false,
          },
        },
      };
      break;

    case "interactive": {
      const btnIds = data._buttonIds || [];
      const buttons = (Array.isArray(data.buttons) ? data.buttons : []).map(
        (label: string, i: number) => ({
          type: "reply",
          reply: {
            id: btnIds[i]?.id || `btn_${Date.now()}_${i}`,
            title: label,
          },
        }),
      );
      const headerType = data.headerType || "none";
      let header: any = { type: headerType };
      if (headerType === "text") {
        header.text = data.headerText || "";
      } else if (["image", "video", "document"].includes(headerType)) {
        header[headerType] = { link: data.headerUrl || data.headerMediaUrl || "" };
      }

      attributes = {
        message: {
          type: "interactive",
          interactive: {
            type: "button",
            header,
            body: { text: data.text || "" },
            footer: { text: data.footer || "" },
            action: { buttons },
          },
        },
      };
      break;
    }

    case "listMessage": {
      const sections = (data.sections || []).map((sec: any) => ({
        title: sec.title || "",
        rows: (sec.rows || []).map((row: any) => ({
          id: row.id,
          title: row.title || "",
          description: row.description || "",
        })),
      }));
      attributes = {
  message: {
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: data.headerText || "" },
      body: { text: data.text || "" },
            footer: { text: data.footer || "" },
            action: {
              button: data.listButtonText || "View Options",
              sections,
            },
          },
        },
      };
      break;
    }

    case "askQuestion":
      attributes = data.attributes || {};
      break;

    case "askLocation":
      attributes = {
        message: {
          type: "location_request_message",
          text: { body: data.message || "" },
        },
        variable: data.variable || "location",
      };
      break;

    case "delay": {
      // UI -> API:
      // Persist the canonical delay duration as milliseconds.
      const storedDelay = Number(data.delay);

      const delayMs =
        Number.isFinite(storedDelay) && storedDelay >= 0
          ? Math.round(storedDelay)
          : delayToMilliseconds(
              data.value ?? 1,
              data.unit || "minutes",
            );

      attributes = {
        delay: delayMs,
      };
      break;
    }
    case "condition":
      attributes = {
        operator: data.operator || "and",
        conditions: (data.conditions || []).map((c: any) => ({
          field: c.field,
          comparator: c.comparator,
          value: c.value,
          threshold: c.threshold,
        })),
      };
      break;

    case "action":
      attributes = {
        url: data.url || "",
        method: data.method || "GET",
        headers: (data.headers || []).filter((h: any) => h.key),
        params: (data.params || []).filter((p: any) => p.key),
        body: data.body || "",
      };
      break;
      case "ai": {
        const assistantId = normalizeAssistantId(
          data.assistant ?? data.assistantId ?? data.attributes?.assistantId,
        );
        attributes = {
          assistantId: assistantId || null,
          stopKeywords: Array.isArray(data.stopKeywords)
            ? data.stopKeywords.map((keyword: any) => String(keyword).trim()).filter(Boolean)
            : ["/stop"],
          timeout: {
            value: Number(data.timeoutValue) || 5,
            unit: data.timeoutUnit || "minutes",
          },
          welcomeMessage: data.welcomeMessage ?? "",
          timeoutMessage: data.timeoutMessage ?? "",
        };
        break;
      }
      case "sendMedia": {
      const mType = data.mediaType || "image";
      const mediaPayload: any = { link: data.mediaUrl || "" };

      // WhatsApp document messages can carry the displayed filename.
      if (mType === "document" && data.documentFilename) {
        mediaPayload.filename = data.documentFilename;
      }

      // WhatsApp audio messages don't support captions.
      if (mType !== "audio" && data.caption) {
        mediaPayload.caption = data.caption;
      }
      attributes = {
        message: {
          type: mType,
          [mType]: mediaPayload,
        },
      };
      break;
    }
    case "ctaMessage": {
      const headerType = safeString(data.headerType, "none");
      let header: any = { type: headerType };
      if (headerType === "text") {
        header.text = safeString(data.headerText);
      } else if (["image", "video", "document"].includes(headerType)) {
        header[headerType] = { link: safeString(data.headerUrl) };
      }

      attributes = {
        message: {
          type: "interactive",
          interactive: {
            type: "cta_url",
            header,
            body: { text: safeString(data.text) },
            footer: { text: safeString(data.footer) },
            action: {
              name: "cta_url",
              parameters: {
                display_text: safeString(data.displayText),
                url: safeString(data.ctaUrl),
              },
            },
          },
        },
      };
      break;
    }
    case "productMessage":
      attributes = {
        message: {
          type: "interactive",
          interactive: {
            type: "product",
            body: { text: data.text || "" },
            footer: { text: data.footer || "" },
            action: {
              catalog_id: data.catalogId || "",
              product_retailer_id: data.retailerId || "",
            },
          },
        },
      };
      break;

    case "updateTag":
      attributes = {
        tags: Array.isArray(data.tags) ? data.tags : [],
      };
      break;

    case "updateColumn":
      attributes = {
        columnUpdates: Array.isArray(data.columnUpdates)
          ? data.columnUpdates
              .filter((entry: any) => entry?.column)
              .map((entry: any) => ({
                id: entry?.id || uuid(),
                column: entry?.column || "",
                value: entry?.value ?? "",
              }))
          : [],
      };
      break;

    default:
      attributes = data.attributes || {};
  }

  const outputVariable = String(
    data?.variable ??
      data?.dataOut?.variable ??
      attributes?.variable ??
      "",
  ).trim();

  // Delay API payload keeps the output variable in dataOut only.
  // Do not add dataOut.variable into attributes for @whatsapp/delay.
  if (outputVariable && n.type !== "delay") {
    attributes = {
      ...attributes,
      variable: outputVariable,
    };
  }

  return {
    id: n.id,
    type: n.type === "trigger" ? "trigger" : "action",
    position: n.position,
    deletable: false,
    data: {
      key,
      title: data.label || n.type,
      nextHandle: n.type !== "condition",
      type: n.type === "trigger" ? "trigger" : "action",
      dataOut: {
        ...(data.dataOut || {}),
        ...(outputVariable ? { variable: outputVariable } : {}),
      },
      ...(outputVariable ? { variable: outputVariable } : {}),
      attributes,
    },
    measured: n.measured,
    selected: false,
    dragging: false,
  };
}
function transformEdgeToApi(e: any) {
  let sourceHandle = e.sourceHandle || "out";

  if (sourceHandle === "true") {
    sourceHandle = `condition-true-${e.source}`;
  } else if (sourceHandle === "false") {
    sourceHandle = `condition-false-${e.source}`;
  } else if (sourceHandle === "out") {
    sourceHandle = "default";
  }
  // btn_xxx and row_xxx pass through unchanged ✅

  return {
    id: e.id,
    source: e.source,
    sourceHandle,
    target: e.target,
    animated: true,
    label: e.label, // ← label IS preserved ✅
    data: {
      ...(e.data || {}),
      sourceHandle,
      targetHandle: e.targetHandle || "in",
      ...(sourceHandle.startsWith("btn_") ? { button_id: sourceHandle } : {}),
      ...(sourceHandle.startsWith("row_") ? { row_id: sourceHandle } : {}),
    },
  };
}
const { Text } = Typography;

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Shared chatbot media upload logic.
 *
 * Send Media, Send Button and Send CTA all use the same upload contract:
 *   - take the WhatsApp phone_number_id from the Trigger node
 *   - send FormData(file, phone_number_id, uppercase type)
 *   - POST /admin/campaigns/upload-media
 *   - normalize the URL/ID returned by the API
 */
const BUILDER_MEDIA_UPLOAD_API = "/admin/campaigns/upload-media";

const getBuilderUploadType = (
  value: string,
): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" => {
  switch (value) {
    case "video":
      return "VIDEO";
    case "audio":
      return "AUDIO";
    case "document":
      return "DOCUMENT";
    default:
      return "IMAGE";
  }
};

const getBuilderPhoneNumberId = (rf: any): string => {
  const nodes = rf.getNodes();
  const triggerNode = nodes.find((node: any) => node.type === "trigger");
  const triggerIds = Array.isArray(triggerNode?.data?.phoneNumberIds)
    ? triggerNode.data.phoneNumberIds
    : [];

  return String(triggerIds[0] ?? "").trim();
};

const uploadBuilderMediaFile = async (
  rf: any,
  file: File,
  mediaType: string,
): Promise<{ url: string; filename: string } | null> => {
  try {
    const phoneNumberId = getBuilderPhoneNumberId(rf);

    if (!phoneNumberId) {
      toast.error(
        "Please select a WhatsApp Phone Number in the Trigger before uploading media.",
      );
      return null;
    }

    const expectedType = getBuilderUploadType(mediaType);
    const detectedType = file.type.startsWith("image/")
      ? "IMAGE"
      : file.type.startsWith("video/")
        ? "VIDEO"
        : file.type.startsWith("audio/")
          ? "AUDIO"
          : "DOCUMENT";

    if (detectedType !== expectedType) {
      toast.error(`Expected ${expectedType} but got ${detectedType}`);
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("phone_number_id", phoneNumberId);
    formData.append("type", expectedType);

    const response = await soft7AxiosInstance.post(
      BUILDER_MEDIA_UPLOAD_API,
      formData,
    );

    const responseData = response.data;

    if (!responseData?.success) {
      throw new Error(responseData?.message || "Upload failed");
    }

    const uploadedUrl =
      responseData?.data?.media_url ||
      responseData?.data?.media_id ||
      responseData?.data?.url ||
      responseData?.data?.link ||
      responseData?.url ||
      responseData?.mediaUrl ||
      responseData?.id;

    if (!uploadedUrl) {
      throw new Error("API did not return a valid media URL or ID");
    }

    return {
      url: String(uploadedUrl),
      filename: file.name,
    };
  } catch (err: any) {
    console.error("Builder media upload failed:", err);
    toast.error(
      err?.response?.data?.message || err?.message || "Upload failed",
    );
    return null;
  }
}


/**
 * Shared output-variable field used by every builder node.
 *
 * The value is kept in:
 *   - data.variable  -> UI/runtime friendly value
 *   - data.dataOut.variable -> generic node output metadata
 *
 * The API transformer below also mirrors it into attributes.variable when
 * a variable is configured, while preserving the existing node attributes.
 */
const NodeVariableField = ({ id, data, label = "Save Output As Variable" }: any) => {
  const rf = useReactFlow();

  const variable = String(
    data?.variable ??
      data?.dataOut?.variable ??
      data?.attributes?.variable ??
      "",
  );

  const updateVariable = (value: string) => {
    const nextValue = value.trimStart();

    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                variable: nextValue,
                dataOut: {
                  ...(node.data?.dataOut || {}),
                  variable: nextValue,
                },
                ...(node.data?.attributes
                  ? {
                      attributes: {
                        ...node.data.attributes,
                        variable: nextValue,
                      },
                    }
                  : {}),
              },
            }
          : node,
      ),
    );
  };

  return (
    <div
      className="nodrag nopan"
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: 8,
        padding: "10px 12px",
        border: "1px solid var(--color-border)",
        borderRadius: 9,
        background: "var(--color-surface)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <label
        htmlFor={`node-variable-${id}`}
        style={{
          display: "block",
          marginBottom: 5,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {label}
      </label>

      <input
        id={`node-variable-${id}`}
        value={variable}
        onChange={(e) => updateVariable(e.target.value)}
        placeholder="e.g. customer_name, email, api_response"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: 7,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          fontSize: 12,
          outline: "none",
          fontFamily: "var(--font-sans)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
        }}
      />

      <div
        style={{
          marginTop: 4,
          fontSize: 10.5,
          lineHeight: 1.45,
          color: "var(--color-text-muted)",
        }}
      >
        Reference later as{" "}
        <code
          style={{
            background: "var(--color-surface-muted)",
            padding: "1px 4px",
            borderRadius: 4,
            fontSize: 10.5,
          }}
        >
          {`{{nodeId.${variable || "variable"}}}`}
        </code>
      </div>
    </div>
  );
};

function AntNodeCard({ title, icon, children, selected, cardStyle }: any) {
  return (
    <div
      style={{
        width: cardStyle?.width || 260,
        background: "var(--color-surface)",
        borderRadius: 12,
        border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
        boxShadow: selected
          ? "var(--elevation-xs), 0 0 0 3px var(--color-primary-ring)"
          : "var(--elevation-sm)",
        overflow: "visible",
        ...(cardStyle || {}),
      }}
    >
      {/* Header - light gray, no gradient */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--color-surface-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--color-surface)",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--color-text-muted)", display: "flex" }}>
            {icon}
          </span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)" }}>
            {title}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}

/* Node Components - pass selected for card styling */
const TRIGGER_TYPE_LABELS: Record<string, string> = {
  keyword: "Keyword Match",
  any: "Any Message",
  webhook: "Webhook",
  button: "Button Click",
};
const TriggerNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "On Message");
  const [phoneNumbers, setPhoneNumbers] = useState<ChatbotPhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [phoneLoadError, setPhoneLoadError] = useState("");
  const phoneError =
  !data.phoneNumberIds?.length;
  const [keywords, setKeywords] = useState<string[]>(data.keywords || []);
  const [keywordInput, setKeywordInput] = useState("");
  const [isDirty, setIsDirty] = useState(true);
  const updateNodeData = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
    setIsDirty(true);
  };
  const fetchPhoneNumbers = useCallback(async () => {
    setLoadingPhones(true);
    setPhoneLoadError("");

    try {
      const response = await soft7AxiosInstance.get(
        "/admin/waba/phone-numbers",
      );
      const normalizedPhones = normalizePhoneNumbers(response.data);
      console.log("Normalized Phones", normalizedPhones);
      setPhoneNumbers(normalizedPhones);
      rf.setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== id) return node;
         const selectedIds = Array.isArray(node.data?.phoneNumberIds)
  ? node.data.phoneNumberIds.map((id: string | number) => String(id))
  : [];

const availableIds = new Set(
  normalizedPhones.map((phone) => String(phone.id))
);

const phoneNumberValid =
  selectedIds.length > 0 &&
  selectedIds.every((id: string) => availableIds.has(id));
          return {
            ...node,
            data: { ...node.data, phoneNumberValid },
          };
        }),
      );
    } catch (error) {
      console.error("Failed to fetch phone numbers:", error);
      setPhoneNumbers([]);
      setPhoneLoadError("Could not load WhatsApp phone numbers.");
    } finally {
      setLoadingPhones(false);
    }
  }, [id, rf]);

  useEffect(() => {
    fetchPhoneNumbers();
  }, [fetchPhoneNumbers]);

  const handleNameSave = () => {
    updateNodeData({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setKeywords([]);
    setKeywordInput("");
updateNodeData({
    phoneNumberIds: [],
      phoneNumberValid: false,
      messageType: "text",
      keywords: [],
      fuzzy: false,
      sensitivity: 80,
    });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  return (
    <div className="flow-node-inner">
      {/* Lightning icon above card */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 18, color: "var(--color-text)" }}>⚡</span>
      </div>

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {/* Editable title */}
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
              {nodeName}
            </span>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {isEditingName ? (
              /* Checkmark to confirm edit */
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              /* Edit pencil button */
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            {/* Delete button */}
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 10px" }}>
          {/* WhatsApp sender number */}
          <div style={{ marginBottom: 12 }} className="nodrag">
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: phoneError ? "var(--color-error)" : "var(--color-text)",
                display: "block",
                marginBottom: 4,
              }}
            >
              WhatsApp Phone Number <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <Select
    mode="multiple"
    style={{ width: "100%" }}
    placeholder="Select phone numbers"
    value={data.phoneNumberIds || []}
    loading={loadingPhones}
    getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
onChange={(values) => {
  const selectedIds = Array.from<string>(
    new Set(values.map((value: string | number) => String(value)))
  );

  const availableIds = new Set(
    phoneNumbers.map((phone) => String(phone.id))
  );

  const allValid =
    selectedIds.length > 0 &&
    selectedIds.every((id) => availableIds.has(id));

  updateNodeData({
    phoneNumberIds: selectedIds,
    phoneNumberValid: allValid,
  });
}}
    optionFilterProp="label"
    options={phoneNumbers.map((phone) => ({
        value: phone.id,
        label: `${phone.displayPhoneNumber}${
            phone.verifiedName
                ? ` — ${phone.verifiedName}`
                : ""
        }`,
    }))}
/>
            {phoneError && !loadingPhones && (
              <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>
                Select the WhatsApp number that should receive messages.
              </div>
            )}
            {phoneLoadError && (
              <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>
                {phoneLoadError}{" "}
                <button
                  type="button"
                  onClick={fetchPhoneNumbers}
                  style={{
                    border: 0,
                    padding: 0,
                    background: "transparent",
                    color: "var(--color-primary)",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Message Type */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Message Type
            </label>
            <select
              value={data.messageType || "text"}
              onChange={(e) => updateNodeData({ messageType: e.target.value })}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
                fontSize: 13,
                background: "var(--color-surface)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="text">Text</option>
              <option value="list_reply">List Reply</option>
              <option value="button_reply">Button Reply</option>
              <option value="template_reply">Template Button Reply</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Keywords */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Keywords
            </label>

            <div
              className="kw-input-area"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                minHeight: 40,
                alignItems: "center",
                cursor: "text",
              }}
              onClick={() => document.getElementById(`kw-input-${id}`)?.focus()}
            >
              {keywords.map((kw: string, i: number) => (
                <span
                  key={i}
                  className="kw-chip"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--color-surface-muted)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    color: "var(--color-text)",
                    fontWeight: 500,
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {kw}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = keywords.filter(
                        (_: string, idx: number) => idx !== i,
                      );
                      setKeywords(updated);
                      updateNodeData({ keywords: updated });
                    }}
                    className="kw-chip-remove-btn"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                      padding: 0,
                      fontSize: 13,
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                id={`kw-input-${id}`}
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const trimmed = keywordInput.trim().replace(/,$/, "");
                    if (trimmed && !keywords.includes(trimmed)) {
                      const updated = [...keywords, trimmed];
                      setKeywords(updated);
                      updateNodeData({ keywords: updated });
                    }
                    setKeywordInput("");
                  } else if (
                    e.key === "Backspace" &&
                    !keywordInput &&
                    keywords.length > 0
                  ) {
                    const updated = keywords.slice(0, -1);
                    setKeywords(updated);
                    updateNodeData({ keywords: updated });
                  }
                }}
                onBlur={() => {
                  const trimmed = keywordInput.trim().replace(/,$/, "");
                  if (trimmed && !keywords.includes(trimmed)) {
                    const updated = [...keywords, trimmed];
                    setKeywords(updated);
                    updateNodeData({ keywords: updated });
                  }
                  setKeywordInput("");
                }}
                placeholder={keywords.length === 0 ? "Add keyword..." : ""}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "transparent",
                  flex: 1,
                  minWidth: 80,
                  fontFamily: "var(--font-sans)",
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Press <strong>Enter</strong> or <strong>,</strong> to add a
              keyword.
            </div>
          </div>
          {/* Fuzzy Matching */}
          <div
            style={{
              border: "1px solid var(--color-surface-muted)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  Enable Fuzzy Matching
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                  Allow partial keyword matches with configurable sensitivity
                </div>
              </div>
              <Switch
                checked={data.fuzzy || false}
                onChange={(v) => updateNodeData({ fuzzy: v })}
                style={{ background: data.fuzzy ? "var(--color-primary)" : undefined }}
              />
            </div>
          </div>

          {/* Sensitivity Slider - only when fuzzy is on */}
          {data.fuzzy && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Match Sensitivity: {data.sensitivity || 80}%
              </label>
              <Slider
                min={0}
                max={100}
                value={data.sensitivity || 80}
                onChange={(v) => updateNodeData({ sensitivity: v })}
                trackStyle={{ background: "var(--color-primary)" }}
                handleStyle={{ borderColor: "var(--color-primary)" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                }}
              >
                <span>Exact Match</span>
                <span>Very Loose</span>
              </div>
            </div>
          )}


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "3px solid var(--color-surface)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          boxShadow: "0 0 0 2px var(--color-primary)",
        }}
      />
    </div>
  );
};

const TemplateNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(
    data.label || "Send Template Message",
  );
  const [recipientNumber, setRecipientNumber] = useState(
    data.recipientNumber || "",
  );
  const [phoneNumberId, setPhoneNumberId] = useState(data.phoneNumberId || "");
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [recipientError, setRecipientError] = useState(false);

  const buttons: Array<{ id: string; label: string; type: string }> =
    Array.isArray(data?.buttons) ? data.buttons : [];
  const quickReplyButtons = buttons.filter((b) => b.type === "quick_reply");

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "template",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  // Fetch phone numbers (already wired up in your TriggerNode - reusing same API)
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      setLoadingPhones(true);
      try {
        const response = await soft7AxiosInstance.get(
          "/admin/waba/phone-numbers",
        );
        if (response.data.success && response.data.data) {
          setPhoneNumbers(response.data.data);
        } else {
          setPhoneNumbers([]);
        }
      } catch (error) {
        console.error("Failed to fetch phone numbers:", error);
        setPhoneNumbers([]);
      } finally {
        setLoadingPhones(false);
      }
    };
    fetchPhoneNumbers();
  }, []);

  const baseY = 180; // start position for quick reply handles
  const gap = 28;

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            {/* Copy button */}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate node"
            />
            {/* Delete button */}
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Recipient Number */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: recipientError ? "var(--color-error)" : "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Recipient Number
            </label>
            <input
              value={recipientNumber}
              onChange={(e) => {
                const val = e.target.value;
                setRecipientNumber(val);
                setRecipientError(false);
                syncToNode({ recipientNumber: val });
              }}
              onBlur={() => {
                if (!recipientNumber.trim()) setRecipientError(true);
              }}
              placeholder="Enter recipient number"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${recipientError ? "var(--color-error)" : "var(--color-border)"}`,
                fontSize: 13,
                color: "var(--color-text)",
                background: "var(--color-surface)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "var(--font-sans)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
            />
            {recipientError && (
              <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>
                Recipient Number is required
              </div>
            )}
          </div>

          {/* Phone Number dropdown */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Phone Number
            </label>
            <select
              value={phoneNumberId}
              onChange={(e) => {
                setPhoneNumberId(e.target.value);
                syncToNode({ phoneNumberId: e.target.value });
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                background: "var(--color-surface)",
                color: "var(--color-text)",
                outline: "none",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="">
                {loadingPhones ? "Loading..." : "Select Phone Number"}
              </option>
              {phoneNumbers.map((phone) => (
                <option key={phone.id} value={phone.phone_number_id}>
                  {phone.display_phone_number}
                </option>
              ))}
            </select>
          </div>

          {/* Template info (if selected) */}
          {data?.templateName && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--color-surface)",
                borderRadius: 8,
                border: "1px solid var(--color-surface-muted)",
                marginBottom: 10,
              }}
            >
              <Text strong style={{ fontSize: 12, display: "block" }}>
                {data.templateName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {data.language || "en"}
              </Text>
            </div>
          )}

          {/* Quick reply button labels */}
          {quickReplyButtons.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {quickReplyButtons.map((btn) => (
                <div
                  key={btn.id}
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {btn.label}
                </div>
              ))}
            </div>
          )}
          <NodeVariableField id={id} data={data} />

        </div>
      </div>

      {/* Quick reply handles */}
      {quickReplyButtons.length > 0 ? (
        quickReplyButtons.map((btn, i) => (
          <Handle
            key={btn.id}
            id={btn.id}
            type="source"
            position={Position.Right}
            title={btn.label}
            className="flow-handle-antd"
            style={{
              background: "var(--color-text-muted)",
              border: "2px solid var(--color-surface)",
              top: baseY + i * gap,
            }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
        title="Output connection point — drag to connect"
          className="flow-handle-antd"
          style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
        />
      )}
    </div>
  );
};

const MessageNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Send Text Message");
  const [messageText, setMessageText] = useState(data.text || "");
  const [previewUrl, setPreviewUrl] = useState<boolean>(
    data.previewUrl ?? false,
  );
  const [isDirty, setIsDirty] = useState(true);

  const MAX_CHARS = 4096;

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setMessageText("");
    setPreviewUrl(false);
    syncToNode({
      text: "",
      previewUrl: false,
      message: { type: "text", text: { body: "", preview_url: false } },
    });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "message",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate node"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Message textarea */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              value={messageText}
              onChange={(e) => {
                const val = e.target.value.slice(0, MAX_CHARS);
                setMessageText(val);
                syncToNode({
                  text: val,
                  message: {
                    type: "text",
                    text: { body: val, preview_url: previewUrl },
                  },
                });
                setIsDirty(true);
              }}
              placeholder="Type your message..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color:
                  MAX_CHARS - messageText.length < 200 ? "var(--color-error)" : "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 4,
              }}
            >
              {MAX_CHARS - messageText.length}/{MAX_CHARS} characters remaining
            </div>
          </div>

          {/* Enable Link Preview toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "10px 12px",
              border: "1px solid var(--color-surface-muted)",
              borderRadius: 10,
              background: "var(--color-surface)",
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)" }}>
                Enable Link Preview
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                Show a preview card when the message contains a URL
              </div>
            </div>
            <Switch
              checked={previewUrl}
              onChange={(v) => {
                setPreviewUrl(v);
                syncToNode({
                  previewUrl: v,
                  message: {
                    type: "text",
                    text: { body: messageText, preview_url: v },
                  },
                });
                setIsDirty(true);
              }}
              style={{
                background: previewUrl ? "var(--color-primary)" : undefined,
                flexShrink: 0,
              }}
            />
          </div>

          {/* Variable hint */}
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-muted)",
              marginBottom: 14,
              padding: "8px 10px",
              background: "var(--color-surface)",
              borderRadius: 8,
              border: "1px solid var(--color-surface-muted)",
              lineHeight: 1.6,
            }}
          >
            Use{" "}
            <code
              style={{
                background: "var(--color-surface-muted)",
                padding: "1px 4px",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {"{{variable}}"}
            </code>{" "}
            to insert dynamic values from previous nodes.
          </div>


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};

const InteractiveNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(
    data.label || "Send Button Message",
  );

  const [headerType, setHeaderType] = useState(
    data.headerType && data.headerType !== "none" ? data.headerType : "text",
  );

  const [bodyText, setBodyText] = useState(data.text || "");
  const [buttons, setButtons] = useState<string[]>(
    Array.isArray(data.buttons) && data.buttons.length ? data.buttons : [""],
  );

  // Each button needs a stable source-handle ID so every button can branch
  // to a different node and the connections survive save/reload.
  const [buttonIds, setButtonIds] = useState<any[]>(() => {
    const savedIds = Array.isArray(data?._buttonIds) ? data._buttonIds : [];
    const labels =
      Array.isArray(data?.buttons) && data.buttons.length
        ? data.buttons
        : [""];

    return labels.map((label: string, index: number) => ({
      id: String(savedIds[index]?.id || `btn_${id}_${index}`),
      label: String(savedIds[index]?.label ?? label ?? ""),
      type: savedIds[index]?.type || "quick_reply",
    }));
  });

  const getButtonHandleId = useCallback(
    (index: number) => String(buttonIds[index]?.id || `btn_${id}_${index}`),
    [buttonIds, id],
  );

  const syncButtons = useCallback(
    (nextButtons: string[], nextButtonIds: any[]) => {
      setButtons(nextButtons);
      setButtonIds(nextButtonIds);

      rf.setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  buttons: nextButtons,
                  _buttonIds: nextButtonIds,
                },
              }
            : node,
        ),
      );

      requestAnimationFrame(() => updateNodeInternals(id));
    },
    [id, rf, updateNodeInternals],
  );

  const [footerText, setFooterText] = useState(data.footer || "");
  const [headerText, setHeaderText] = useState(data.headerText || "");

  /*
   * IMPORTANT:
   * Send CTA Message uses `headerUrl`.
   * Send Button Message historically used `headerMediaUrl`.
   *
   * Use the same `headerUrl` flow as CTA, while accepting the old
   * headerMediaUrl value so existing saved chatbot nodes keep working.
   */
  const [headerUrl, setHeaderUrl] = useState<string>(
    typeof data?.headerUrl === "string"
      ? data.headerUrl
      : typeof data?.headerMediaUrl === "string"
        ? data.headerMediaUrl
        : "",
  );

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [isDirty, setIsDirty] = useState(true);

  const BODY_MAX = 1024;
  const BTN_MAX = 20;
  const FOOTER_MAX = 60;
  const HEADER_TEXT_MAX = 60;

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...changes } }
          : node,
      ),
    );
  };

  /*
   * EXACT SAME upload flow as Send CTA Message.
   *
   * The important part is that the MediaPickerModal hands the File
   * directly to this handler. The shared upload helper then:
   *   1. Gets phone_number_id from Trigger
   *   2. Builds FormData(file, phone_number_id, type)
   *   3. POSTs to /admin/campaigns/upload-media
   *   4. Returns the uploaded URL/media ID
   */
  const handleMediaUpload = async (file: File) => {
    setUploadingMedia(true);

    try {
      const result = await uploadBuilderMediaFile(rf, file, headerType);

      if (!result) return;

      const nextUrl = String(result.url || "").trim();

      setHeaderUrl(nextUrl);

      /*
       * Keep BOTH keys synchronized:
       * - headerUrl      -> same field used by Send CTA
       * - headerMediaUrl -> existing Send Button API/UI compatibility
       */
      syncToNode({
        headerUrl: nextUrl,
        headerMediaUrl: nextUrl,
      });

      setIsDirty(true);

      toast.success(
        `${headerType.charAt(0).toUpperCase() + headerType.slice(1)} uploaded successfully 🚀`,
      );

      /*
       * Same behavior as the working CTA node:
       * close the picker only after the upload succeeded.
       */
      setMediaPickerOpen(false);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleLibrarySelect = (url: string) => {
    const nextUrl = String(url || "").trim();

    setHeaderUrl(nextUrl);

    syncToNode({
      headerUrl: nextUrl,
      headerMediaUrl: nextUrl,
    });

    setIsDirty(true);
    setMediaPickerOpen(false);
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) =>
      eds.filter((e) => e.source !== id && e.target !== id),
    );
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();

    const newId = uuid();

    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "interactive",
        data: { ...data, headerUrl, headerMediaUrl: headerUrl },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const addButton = () => {
    if (buttons.length >= 3) return;

    const updated = [...buttons, ""];
    const updatedIds = [
      ...buttonIds,
      {
        id: `btn_${id}_${uuid()}`,
        label: "",
        type: "quick_reply",
      },
    ];

    syncButtons(updated, updatedIds);
    setIsDirty(true);
  };

  const removeButton = (i: number) => {
    const updated = buttons.filter((_, idx) => idx !== i);
    const updatedIds = buttonIds.filter((_, idx) => idx !== i);

    syncButtons(updated, updatedIds);
    setIsDirty(true);
  };

  const updateButton = (i: number, val: string) => {
    const nextLabel = val.slice(0, BTN_MAX);
    const updated = buttons.map((b, idx) =>
      idx === i ? nextLabel : b,
    );
    const updatedIds = buttonIds.map((button, idx) =>
      idx === i ? { ...button, label: nextLabel } : button,
    );

    syncButtons(updated, updatedIds);
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "2px solid var(--color-surface)",
          top: "50%",
        }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected
            ? "1.5px solid var(--color-primary)"
            : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}

            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />

            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        <div style={{ padding: "14px 14px 12px" }}>
          {/* Header Type */}
          <div style={{ marginBottom: 14 }} className="nodrag nopan">
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Header Type
            </label>

            <select
              value={headerType}
              onChange={(e) => {
                const val = e.target.value;

                setHeaderType(val);
                setHeaderText("");
                setHeaderUrl("");
                setMediaPickerOpen(false);

                syncToNode({
                  headerType: val,
                  headerText: "",
                  headerUrl: "",
                  headerMediaUrl: "",
                });

                setIsDirty(true);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                background: "var(--color-surface)",
                color: "var(--color-text)",
                outline: "none",
                cursor: "pointer",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
            </select>
          </div>

          {/* Header Text */}
          {headerType === "text" && (
            <div style={{ marginBottom: 14 }} className="nodrag nopan">
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Header Text
              </label>

              <input
                value={headerText}
                onChange={(e) => {
                  const val = e.target.value.slice(0, HEADER_TEXT_MAX);
                  setHeaderText(val);
                  syncToNode({ headerText: val });
                  setIsDirty(true);
                }}
                placeholder="Enter header text"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "var(--color-surface)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--color-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--color-border)")
                }
              />

              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {HEADER_TEXT_MAX - headerText.length} characters left
              </div>
            </div>
          )}

          {/* Header Media - same flow as Send CTA Message */}
          {["image", "video", "document"].includes(headerType) && (
            <div
              style={{ marginBottom: 14 }}
              className="nodrag nopan"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {headerType === "image"
                  ? "Image"
                  : headerType === "video"
                    ? "Video"
                    : "Document"}
              </label>

              {headerUrl ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {headerType === "image" ? (
                      <img
                        src={headerUrl}
                        alt=""
                        style={{
                          width: 42,
                          height: 42,
                          objectFit: "cover",
                          borderRadius: 7,
                          border: "1px solid var(--color-border)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 7,
                          background: "var(--color-primary-light)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-primary)",
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {headerType === "video" ? "▶" : "▤"}
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        {headerType.charAt(0).toUpperCase() +
                          headerType.slice(1)}{" "}
                        selected
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 175,
                        }}
                      >
                        Ready to send
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={uploadingMedia}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      if (!uploadingMedia) {
                        setMediaPickerOpen(true);
                      }
                    }}
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      borderRadius: 7,
                      padding: "6px 9px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text)",
                      cursor: uploadingMedia ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingMedia}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!uploadingMedia) {
                      setMediaPickerOpen(true);
                    }
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px",
                    border: "2px dashed var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: uploadingMedia ? "not-allowed" : "pointer",
                  }}
                >
                  <UploadOutlined />

                  {uploadingMedia
                    ? "Uploading..."
                    : headerType === "document"
                      ? "Select or Upload PDF / Document"
                      : "Select or Upload Media"}
                </button>
              )}

              {/* Manual URL entry remains supported */}
              <textarea
                value={headerUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setHeaderUrl(val);

                  syncToNode({
                    headerUrl: val,
                    headerMediaUrl: val,
                  });

                  setIsDirty(true);
                }}
                placeholder={`Enter ${headerType} URL...`}
                rows={2}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "var(--color-surface)",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Body Text */}
          <div style={{ marginBottom: 14 }} className="nodrag nopan">
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Body Text
            </label>

            <textarea
              value={bodyText}
              onChange={(e) => {
                const val = e.target.value.slice(0, BODY_MAX);
                setBodyText(val);
                syncToNode({ text: val });
                setIsDirty(true);
              }}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                color: "var(--color-text)",
                background: "var(--color-surface)",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--color-primary)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--color-border)")
              }
            />

            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {BODY_MAX - bodyText.length} characters left
            </div>
          </div>

          {/* Buttons */}
          <div style={{ marginBottom: 14 }} className="nodrag nopan">
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Buttons
            </label>

            {buttons.map((button, index) => {
              const handleId = getButtonHandleId(index);

              return (
                <div
                  key={handleId}
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 7,
                    position: "relative",
                  }}
                >
                  <input
                    value={button}
                    onChange={(e) => updateButton(index, e.target.value)}
                    placeholder={`Button ${index + 1}`}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: 13,
                      color: "var(--color-text)",
                      background: "var(--color-surface)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />

                  {buttons.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeButton(index);
                      }}
                      style={{
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        borderRadius: 7,
                        padding: "0 9px",
                        cursor: "pointer",
                        color: "var(--color-error)",
                      }}
                    >
                      ×
                    </button>
                  )}

                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    isConnectable={true}
                    title={`Connect ${button || `Button ${index + 1}`}`}
                    className="flow-handle-antd interactive-button-handle"
                    style={{
                      right: -21,
                      top: "50%",
                      width: 12,
                      height: 12,
                      zIndex: 30,
                      background: "var(--color-primary)",
                      border: "2px solid var(--color-surface)",
                      boxShadow: "0 0 0 1px var(--color-border)",
                    }}
                  />
                </div>
              );
            })}

            {buttons.length < 3 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addButton();
                }}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  border: "1px dashed var(--color-border)",
                  background: "transparent",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                + Add Button
              </button>
            )}
          </div>

          {/* Footer Text */}
          <div style={{ marginBottom: 14 }} className="nodrag nopan">
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Footer Text
            </label>

            <input
              value={footerText}
              onChange={(e) => {
                const val = e.target.value.slice(0, FOOTER_MAX);
                setFooterText(val);
                syncToNode({ footer: val });
                setIsDirty(true);
              }}
              placeholder="Enter footer text"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                color: "var(--color-text)",
                background: "var(--color-surface)",
                outline: "none",
                boxSizing: "border-box",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>

          <NodeVariableField id={id} data={data} />
        </div>
      </div>

      {["image", "video", "document"].includes(headerType) &&
        mediaPickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="chatbot-media-picker-portal nodrag nopan"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <MediaPickerModal
              isOpen={true}
              onClose={() => setMediaPickerOpen(false)}
              onSelect={(url: string, filename?: string) => {
                handleLibrarySelect(url);
                void filename;
              }}
              /*
               * EXACT SAME callback pattern as Send CTA Message.
               * The modal supplies the selected File directly.
               */
              onUploadNew={async (file: File) => {
                await handleMediaUpload(file);
              }}
              uploadingMedia={uploadingMedia}
              mediaType={
                getBuilderUploadType(headerType) as
                  | "IMAGE"
                  | "VIDEO"
                  | "DOCUMENT"
              }
            />
          </div>,
          document.body,
        )}

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "2px solid var(--color-surface)",
        }}
      />
    </div>
  );
};

const ProductMessageNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(
    data.label || "Send Product Message",
  );
  const [catalogId, setCatalogId] = useState(data.catalogId || "");
  const [retailerId, setRetailerId] = useState(data.retailerId || "");
  const [bodyText, setBodyText] = useState(data.text || "");
  const [footerText, setFooterText] = useState(data.footer || "");
  const [bodyError, setBodyError] = useState(false);
  const [isDirty, setIsDirty] = useState(true);

  const BODY_MAX = 1024;
  const FOOTER_MAX = 60;

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setCatalogId("");
    setRetailerId("");
    setBodyText("");
    setFooterText("");
    setBodyError(false);
    syncToNode({ catalogId: "", retailerId: "", text: "", footer: "" });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "productMessage",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Catalog ID */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Catalog ID</label>
            <input
              value={catalogId}
              onChange={(e) => {
                setCatalogId(e.target.value);
                syncToNode({ catalogId: e.target.value });
                setIsDirty(true);
              }}
              placeholder="Enter catalog ID"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Product Retailer ID */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Product Retailer ID</label>
            <input
              value={retailerId}
              onChange={(e) => {
                setRetailerId(e.target.value);
                syncToNode({ retailerId: e.target.value });
                setIsDirty(true);
              }}
              placeholder="Enter product retailer ID"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Body Text */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                ...labelStyle,
                color: bodyError ? "var(--color-error)" : "var(--color-text)",
              }}
            >
              Body Text
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => {
                const val = e.target.value.slice(0, BODY_MAX);
                setBodyText(val);
                setBodyError(false);
                syncToNode({ text: val });
                setIsDirty(true);
              }}
              onBlur={() => {
                if (!bodyText.trim()) setBodyError(true);
              }}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                border: `1px solid ${bodyError ? "var(--color-error)" : "var(--color-border)"}`,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
            />
            {bodyError && (
              <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 2 }}>
                Body is required
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {BODY_MAX - bodyText.length} characters left
            </div>
          </div>

          {/* Footer Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Footer Text</label>
            <input
              value={footerText}
              onChange={(e) => {
                const val = e.target.value.slice(0, FOOTER_MAX);
                setFooterText(val);
                syncToNode({ footer: val });
                setIsDirty(true);
              }}
              placeholder="Enter footer text"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {FOOTER_MAX - footerText.length} characters left
            </div>
          </div>


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const AskLocationNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Ask Location");
  const [message, setMessage] = useState(data.message || "");
  const [messageError, setMessageError] = useState(false);
  const [isDirty, setIsDirty] = useState(true);

  const MSG_MAX = 1024;

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };
  const handleClearAll = () => {
    setMessage("");
    setMessageError(false);
    syncToNode({ message: "", variable: "location" });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "askLocation",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                ...labelStyle,
                color: messageError ? "var(--color-error)" : "var(--color-text)",
              }}
            >
              Location Request Message
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                const val = e.target.value.slice(0, MSG_MAX);
                setMessage(val);
                setMessageError(false);
                syncToNode({ message: val });
                setIsDirty(true);
              }}
              onBlur={() => {
                if (!message.trim()) setMessageError(true);
              }}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                border: `1px solid ${messageError ? "var(--color-error)" : "var(--color-border)"}`,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              Only {MSG_MAX}/{MSG_MAX} characters are allowed
            </div>
            {messageError && (
              <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 2 }}>
                Message is required
              </div>
            )}
          </div>

          
          <NodeVariableField id={id} data={data} label="Save Answer As Variable" />

          
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const UpdateTagNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [tags, setTags] = useState<any[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true);

      try {
        const response = await soft7AxiosInstance.get("/admin/contacts/tags");

        console.log("🏷️ Tags API Response:", response.data);

        setTags(normalizeTagOptions(response.data));
      } catch (error) {
        console.error("Failed to fetch tags:", error);
        setTags([]);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, []);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Update Tag");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    Array.isArray(data.tags) ? data.tags : [],
  );
  const [isDirty, setIsDirty] = useState(true);

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };
  const handleClearAll = () => {
    setSelectedTags([]);
    syncToNode({ tags: [] });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "updateTag",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          <div style={{ marginBottom: 14 }} className="nodrag">
            <label style={labelStyle}>Tags to Assign</label>

            <Select
              className="nodrag"
              mode="multiple"
              placeholder={
                loadingTags ? "Loading tags..." : "Select tags to assign..."
              }
              value={selectedTags}
              loading={loadingTags}
              getPopupContainer={(triggerNode) =>
                triggerNode.parentNode as HTMLElement
              }
              onChange={(v) => {
                const normalizedValues = v.map((value: string | number) =>
                  String(value),
                );
                setSelectedTags(normalizedValues);
                syncToNode({ tags: normalizedValues });
                setIsDirty(true);
              }}
              style={{ width: "100%" }}
              optionFilterProp="label"
              options={tags.map((tag) => ({
                label: tag.name,
                value: tag.id,
              }))}
            />

            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Select one or more tags to assign to the contact. The selected
              tags will be added to the contact existing tags.
            </div>
          </div>

                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const UpdateColumnNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Update Columns");
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
    const [isDirty, setIsDirty] = useState(true);
  const [columnUpdates, setColumnUpdates] = useState<
    Array<{ id: string; column: string; value: string }>
  >(
    Array.isArray(data.columnUpdates) && data.columnUpdates.length
      ? data.columnUpdates
      : [],
  );

  useEffect(() => {
    const fetchColumns = async () => {
      setLoadingColumns(true);
      try {
        const response = await soft7AxiosInstance.get("/admin/columns/");

        console.log("📋 Columns API Response:", response.data);

        setColumns(normalizeColumnOptions(response.data));
      } catch (error) {
        console.error("Failed to fetch columns:", error);
        setColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    };
    fetchColumns();
  }, []);

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setColumnUpdates([]);
    syncToNode({ columnUpdates: [] });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "updateColumn",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const addColumnUpdate = () => {
    const updated = [
      ...columnUpdates,
      { id: `col_${Date.now()}`, column: "", value: "" },
    ];
    setColumnUpdates(updated);
    syncToNode({ columnUpdates: updated });
    setIsDirty(true);
  };

  const removeColumnUpdate = (idx: number) => {
    const updated = columnUpdates.filter((_, i) => i !== idx);
    setColumnUpdates(updated);
    syncToNode({ columnUpdates: updated });
    setIsDirty(true);
  };

  const updateColumnEntry = (
    idx: number,
    field: "column" | "value",
    val: string,
  ) => {
    const updated = columnUpdates.map((c, i) =>
      i === idx ? { ...c, [field]: val } : c,
    );
    setColumnUpdates(updated);
    syncToNode({ columnUpdates: updated });
    setIsDirty(true);
  };

  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Column Updates Header Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
              Column Updates
            </span>
            <button
              onClick={addColumnUpdate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--color-text)",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
              }}
            >
              <PlusOutlined style={{ fontSize: 11 }} /> Add Column
            </button>
          </div>

          {/* Empty State */}
          {columnUpdates.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                border: "1px solid var(--color-surface-muted)",
                borderRadius: 10,
                background: "var(--color-surface)",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
                No column updates configured
              </div>
              <div style={{ fontSize: 11, color: "var(--color-border)" }}>
                Click `Add Column` to start updating columns
              </div>
            </div>
          )}

          {/* Column Update Entries */}
          {columnUpdates.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "12px 12px 10px",
                marginBottom: 10,
                background: "var(--color-surface)",
              }}
            >
              {/* Column Selector */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Column</label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, position: "relative" }}>
                    <button
                      onClick={() =>
                        setOpenDropdownIdx(openDropdownIdx === idx ? null : idx)
                      }
                      style={{
                        width: "100%",
                        padding: "8px 32px 8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        fontSize: 13,
                        color: entry.column ? "var(--color-text)" : "var(--color-text-muted)",
                        background: "var(--color-surface)",
                        outline: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        boxSizing: "border-box",
                        fontFamily: "var(--font-sans)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {entry.column ||
                          (loadingColumns ? "Loading..." : "Select a column")}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="2"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Dropdown */}
                    {openDropdownIdx === idx && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          boxShadow: "var(--elevation-md)",
                          zIndex: 9999,
                          maxHeight: 200,
                          overflowY: "auto",
                        }}
                      >
                        {columns.length === 0 ? (
                          <div
                            style={{
                              padding: "10px 12px",
                              fontSize: 13,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {loadingColumns ? "Loading..." : "No columns found"}
                          </div>
                        ) : (
                          columns.map((col) => (
                            <div
                              key={col.id || col.name}
                              onClick={() => {
                                updateColumnEntry(
                                  idx,
                                  "column",
                                  col.name || col.label || col.display_name || col.column_name || col.key || col.id,
                                );
                                setOpenDropdownIdx(null);
                              }}
                              style={{
                                padding: "9px 12px",
                                fontSize: 13,
                                color: "var(--color-text)",
                                cursor: "pointer",
                                borderBottom: "1px solid var(--color-surface-muted)",
                                background:
                                  entry.column ===
                                  (col.name || col.label || col.display_name || col.column_name || col.key || col.id)
                                    ? "var(--color-surface-muted)"
                                    : "var(--color-surface)",
                              }}
                              onMouseEnter={(e) =>
                                ((
                                  e.currentTarget as HTMLElement
                                ).style.background = "var(--color-surface-muted)")
                              }
                              onMouseLeave={(e) =>
                                ((
                                  e.currentTarget as HTMLElement
                                ).style.background =
                                  entry.column ===
                                  (col.name || col.label || col.display_name || col.column_name || col.key || col.id)
                                    ? "var(--color-surface-muted)"
                                    : "var(--color-surface)")
                              }
                            >
                              {col.name || col.label || col.display_name || col.column_name || col.key || col.id}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete row button */}
                  <button
                    onClick={() => removeColumnUpdate(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-error)",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>

              {/* Value */}
              <div>
                <label style={labelStyle}>Value</label>
                <textarea
                  value={entry.value}
                  onChange={(e) =>
                    updateColumnEntry(idx, "value", e.target.value)
                  }
                  placeholder="Enter the value to update the column with"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  Enter the value to set for the selected column. You can use
                  dynamic variables.
                </div>
              </div>
            </div>
          ))}


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const FetchContactNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Fetch Contact");
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  useEffect(() => {
    const fetchColumns = async () => {
      setLoadingColumns(true);
      try {
        const response = await soft7AxiosInstance.get("/admin/columns/");
        setColumns(normalizeColumnOptions(response.data));
      } catch (error) {
        console.error("Failed to fetch columns:", error);
        setColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    };
    fetchColumns();
  }, []);

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "fetchContact",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 340,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Description Section */}
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: 10,
              border: "1px solid var(--color-surface-muted)",
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "var(--color-text)",
                marginBottom: 6,
              }}
            >
              Fetch Contact
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              This action fetches the current contact and exposes all custom
              columns from Manage → Columns. You can reference values in later
              steps using the node variables (e.g. {`{{nodeId.columns.email}}`}
              ).
            </div>
          </div>

          {/* Available Columns */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 8,
              }}
            >
              Available Columns
            </div>

            {loadingColumns ? (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Loading columns...
              </div>
            ) : columns.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                No columns found
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {columns.map((col) => (
                  <span
                    key={col.id || col.name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 12px",
                      borderRadius: 20,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      fontSize: 12,
                      color: "var(--color-text)",
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {col.name || col.label || col.display_name || col.column_name || col.key || col.id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <NodeVariableField id={id} data={data} />

        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const StopChatbotNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Stop Chatbot");

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "stopChatbot",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: 10,
              border: "1px solid var(--color-surface-muted)",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              Stopping the session will reset the chatbot to its initial state.
            </div>
          </div>
          <NodeVariableField id={id} data={data} />

        </div>
      </div>

      {/* StopChatbot is a terminal node - no source handle needed */}
    </div>
  );
};

const MediaNode = ({ data, selected }: any) => {
  const mediaType = data?.mediaType || "image";
  const mediaItems =
    Array.isArray(data?.mediaItems) && data.mediaItems.length
      ? data.mediaItems
      : Array.isArray(data?.images) && data.images.length
        ? data.images
        : [{ url: "", caption: "" }];
  const firstItem = mediaItems[0];
  const hasPreview =
    firstItem && (firstItem.previewUrl || firstItem.url || firstItem.link);
  const isImage = mediaType === "image";
  const previewSrc =
    hasPreview && (firstItem.previewUrl || firstItem.url || firstItem.link);
  const displayName =
    firstItem?.name ||
    firstItem?.fileName ||
    (firstItem?.url || firstItem?.link ? "URL" : null);

  return (
    <div className="flow-node-inner">
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        data-theme="green"
      />
      <AntNodeCard
        title="Media"
        tagColor="green"
        icon={<PictureOutlined />}
        selected={selected}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {mediaType} · {mediaItems.length} item(s)
        </Text>
        {hasPreview && (
          <div style={{ marginTop: 8 }}>
            {isImage && previewSrc ? (
              <img
                src={previewSrc.startsWith("http") ? previewSrc : previewSrc}
                alt=""
                style={{
                  width: "100%",
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid var(--color-border-strong)",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                {displayName ? `📎 ${displayName}` : "Uploaded"}
              </Text>
            )}
          </div>
        )}
      </AntNodeCard>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        data-theme="green"
      />
    </div>
  );
};

const ButtonMessageNode = InteractiveNode;
const ListMessageNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Send List Message");
 const [headerType, setHeaderType] = useState("text");

// Legacy saved flows may have headerType stored as "none" or "" since
// List Message only ever supported a text header. Force-correct the
// underlying node data on mount so Save persists "text", not "none".
useEffect(() => {
  if (data.headerType !== "text") {
    syncToNode({ headerType: "text" });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
  const [bodyText, setBodyText] = useState(data.text || "");
  const [buttonText, setButtonText] = useState(
    data.listButtonText || "View Options",
  );
  const [footerText, setFooterText] = useState(data.footer || "");
  const [sections, setSections] = useState<
    Array<{
      id: string;
      title: string;
      rows: Array<{ id: string; title: string; description: string }>;
    }>
  >(
    Array.isArray(data.sections) && data.sections.length
      ? data.sections
      : [
          {
            id: "section_0",
            title: "",
            rows: [{ id: "row_0", title: "", description: "" }],
          },
        ],
  );
  const [isDirty, setIsDirty] = useState(true);

  const BODY_MAX = 1024;
  const BTN_MAX = 20;
  const SECTION_MAX = 24;
  const ROW_TITLE_MAX = 24;
  const ROW_DESC_MAX = 72;
  const FOOTER_MAX = 60;

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setHeaderType("text");
    setBodyText("");
    setButtonText("View Options");
    setFooterText("");
    setSections([
      {
        id: "section_0",
        title: "",
        rows: [{ id: "row_0", title: "", description: "" }],
      },
    ]);
    syncToNode({
      headerType: "text",
      text: "",
      listButtonText: "View Options",
      footer: "",
      sections: [
        {
          id: "section_0",
          title: "",
          rows: [{ id: "row_0", title: "", description: "" }],
        },
      ],
    });
    requestAnimationFrame(() => updateNodeInternals(id));
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "listMessage",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  // ── Section helpers ──
  const addRow = (sectionIdx: number) => {
    const updated = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec;
      return {
        ...sec,
        rows: [
          ...sec.rows,
          { id: `row_${Date.now()}`, title: "", description: "" },
        ],
      };
    });
    setSections(updated);
    syncToNode({ sections: updated });
    requestAnimationFrame(() => updateNodeInternals(id));
    setIsDirty(true);
  };

  const removeRow = (sectionIdx: number, rowIdx: number) => {
    const updated = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec;
      return { ...sec, rows: sec.rows.filter((_, ri) => ri !== rowIdx) };
    });
    setSections(updated);
    syncToNode({ sections: updated });
    requestAnimationFrame(() => updateNodeInternals(id));
    setIsDirty(true);
  };

  const updateRow = (
    sectionIdx: number,
    rowIdx: number,
    field: "title" | "description",
    val: string,
  ) => {
    const max = field === "title" ? ROW_TITLE_MAX : ROW_DESC_MAX;
    const updated = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec;
      return {
        ...sec,
        rows: sec.rows.map((row, ri) =>
          ri === rowIdx ? { ...row, [field]: val.slice(0, max) } : row,
        ),
      };
    });
    setSections(updated);
    syncToNode({ sections: updated });
    setIsDirty(true);
  };

  const addSection = () => {
    const updated = [
      ...sections,
      {
        id: `section_${Date.now()}`,
        title: "",
        rows: [{ id: `row_${Date.now()}`, title: "", description: "" }],
      },
    ];
    setSections(updated);
    syncToNode({ sections: updated });
    setIsDirty(true);
  };

  const removeSection = (sectionIdx: number) => {
    if (sections.length <= 1) return;
    const updated = sections.filter((_, si) => si !== sectionIdx);
    setSections(updated);
    syncToNode({ sections: updated });
    requestAnimationFrame(() => updateNodeInternals(id));
    setIsDirty(true);
  };

  const updateSectionTitle = (sectionIdx: number, val: string) => {
    const updated = sections.map((sec, si) =>
      si === sectionIdx ? { ...sec, title: val.slice(0, SECTION_MAX) } : sec,
    );
    setSections(updated);
    syncToNode({ sections: updated });
    setIsDirty(true);
  };

  // All row handles across all sections
  const allRows = sections.flatMap((sec, si) =>
    sec.rows.map((row, ri) => ({
      handleId: `list_${si}_${ri}`,
      label: row.title || `Row ${ri + 1}`,
    })),
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  const charHint = (left: number): React.CSSProperties => ({
    fontSize: 11,
    color: "var(--color-text-muted)",
    textAlign: "right",
    marginTop: 2,
  });

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      {/* Left input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Header Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Header Type</label>
            <div style={{ ...inputStyle, color: "var(--color-text-muted)", cursor: "default" }}>
  Text
</div>
          </div>

          {/* Body Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Body Text</label>
            <textarea
              value={bodyText}
              onChange={(e) => {
                const val = e.target.value.slice(0, BODY_MAX);
                setBodyText(val);
                syncToNode({ text: val });
                setIsDirty(true);
              }}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div style={charHint(BODY_MAX - bodyText.length)}>
              {BODY_MAX - bodyText.length} characters left
            </div>
          </div>

          {/* Button Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Button Text</label>
            <input
              value={buttonText}
             onChange={(e) => {
                const val = e.target.value.slice(0, BTN_MAX);
                setButtonText(val);
                syncToNode({ listButtonText: val });
                setIsDirty(true);
              }}
              placeholder="View Options"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div style={charHint(BTN_MAX - buttonText.length)}>
              {BTN_MAX - buttonText.length} characters left
            </div>
          </div>

          {/* Sections */}
          {sections.map((section, sectionIdx) => (
            <div
              key={section.id}
              className="list-section-card-inner"
              style={{
                border: "1px solid var(--color-surface-muted)",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 12,
                background: "var(--color-surface)",
              }}
            >
              {/* Section header row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}
                >
                  Section {sectionIdx + 1}
                </span>
                {sections.length > 1 && (
                  <button
                    onClick={() => removeSection(sectionIdx)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-error)",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 12 }} />
                  </button>
                )}
              </div>

              {/* Section Title */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Section Title</label>
                <input
                  value={section.title}
                  onChange={(e) =>
                    updateSectionTitle(sectionIdx, e.target.value)
                  }
                  placeholder="Section title"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <div style={charHint(SECTION_MAX - section.title.length)}>
                  {SECTION_MAX - section.title.length} characters left
                </div>
              </div>

              {/* Rows */}
              {section.rows.map((row, rowIdx) => (
                <div
                  key={row.id}
                  className="list-row-card-inner"
                  style={{
                    position: "relative",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginBottom: 8,
                    background: "var(--color-surface)",
                  }}
                >
                  {/* Row Title */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Row Title</label>
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <input
                        value={row.title}
                        onChange={(e) =>
                          updateRow(sectionIdx, rowIdx, "title", e.target.value)
                        }
                        placeholder="Row title"
                        style={{
                          ...inputStyle,
                          paddingRight: section.rows.length > 1 ? 32 : 10,
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "var(--color-primary)")
                        }
                        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                      />
                      {section.rows.length > 1 && (
                        <button
                          onClick={() => removeRow(sectionIdx, rowIdx)}
                          style={{
                            position: "absolute",
                            right: 8,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-error)",
                            padding: 2,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <DeleteOutlined style={{ fontSize: 12 }} />
                        </button>
                      )}

                      {/* Row output handle */}
                      <Handle
                        id={row.id}
        title="Output connection point — drag to connect"
                        type="source"
                        position={Position.Right}
                        style={{
                          position: "absolute",
                          right: -10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "var(--color-text-muted)",
                          border: "2px solid var(--color-surface)",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                        }}
                      />
                    </div>
                    <div style={charHint(ROW_TITLE_MAX - row.title.length)}>
                      {ROW_TITLE_MAX - row.title.length} characters left
                    </div>
                  </div>

                  {/* Row Description */}
                  <div>
                    <label style={labelStyle}>Row Description (Optional)</label>
                    <input
                      value={row.description}
                      onChange={(e) =>
                        updateRow(
                          sectionIdx,
                          rowIdx,
                          "description",
                          e.target.value,
                        )
                      }
                      placeholder="Row description"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                    />
                    <div
                      style={charHint(ROW_DESC_MAX - row.description.length)}
                    >
                      {ROW_DESC_MAX - row.description.length} characters left
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Row / Add Section buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {/* Add Row button */}
                <button
                  onClick={() => addRow(sectionIdx)}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--color-primary)",
                    background: "var(--color-primary)",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--color-primary-foreground)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--color-text)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--color-primary)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-primary)";
                  }}
                >
                  <PlusOutlined style={{ fontSize: 11 }} /> Add Row
                </button>

                {/* Add Section button */}
                {sectionIdx === sections.length - 1 && (
                  <button
                    onClick={addSection}
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--color-primary)",
                      background: "var(--color-primary)",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--color-primary-foreground)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--color-text)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--color-text)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--color-primary)";
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--color-primary)";
                    }}
                  >
                    <PlusOutlined style={{ fontSize: 11 }} /> Add Section
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Footer Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Footer Text</label>
            <input
              value={footerText}
              onChange={(e) => {
                const val = e.target.value.slice(0, FOOTER_MAX);
                setFooterText(val);
                syncToNode({ footer: val });
                setIsDirty(true);
              }}
              placeholder="Enter footer text"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div style={charHint(FOOTER_MAX - footerText.length)}>
              {FOOTER_MAX - footerText.length} characters left
            </div>
          </div>


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      {/* General output handle for the List Message node.
          Row-specific handles above remain unchanged and continue to
          support row branching. */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "2px solid var(--color-surface)",
        }}
      />
    </div>
  );
};
const SendMediaNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(
    data.label || "Send Media Message",
  );
  const [mediaType, setMediaType] = useState(data.mediaType || "image");
  const [mediaUrl, setMediaUrl] = useState(data.mediaUrl || "");
  const [caption, setCaption] = useState(data.caption || "");
  const [documentFilename, setDocumentFilename] = useState(
    data.documentFilename || "",
  );

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const CAPTION_MAX = 1024;

  // Same upload endpoint/response handling as Create Campaign.
  const MEDIA_UPLOAD_API = "/admin/campaigns/upload-media";

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...changes } }
          : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "sendMedia",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const uploadMediaFile = async (file: File): Promise<string | null> => {
    setUploadingMedia(true);
    try {
      const result = await uploadBuilderMediaFile(rf, file, mediaType);

      if (!result) return null;

      setMediaUrl(result.url);
      syncToNode({
        mediaUrl: result.url,
        ...(mediaType === "document" && !documentFilename
          ? { documentFilename: result.filename }
          : {}),
      });

      if (mediaType === "document" && !documentFilename) {
        setDocumentFilename(result.filename);
      }

      toast.success(
        `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully 🚀`,
      );

      return result.url;
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleAudioUpload = async (file: File) => {
    await uploadMediaFile(file);
  };

  const handleMediaTypeChange = (value: string) => {
    setMediaType(value);
    setMediaUrl("");
    setCaption("");
    setDocumentFilename("");

    syncToNode({
      mediaType: value,
      mediaUrl: "",
      caption: "",
      documentFilename: "",
    });
  };

  const handleLibrarySelect = (url: string, filename?: string) => {
    const nextUrl = String(url || "").trim();

    setMediaUrl(nextUrl);
    syncToNode({
      mediaUrl: nextUrl,
      ...(mediaType === "document" && filename
        ? { documentFilename: filename }
        : {}),
    });

    if (mediaType === "document" && filename) {
      setDocumentFilename(filename);
    }

    setMediaPickerOpen(false);
  };

  const showCaption = mediaType !== "audio";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  const isSavedAndClean = Boolean(mediaUrl.trim()) && !uploadingMedia;

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "2px solid var(--color-surface)",
        }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected
            ? "1.5px solid var(--color-primary)"
            : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}

            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />

            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Media Type */}
          <div style={{ marginBottom: 16 }} className="nodrag">
            <label style={labelStyle}>Media Type</label>
            <select
              value={mediaType}
              disabled={uploadingMedia}
              onChange={(e) => handleMediaTypeChange(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="document">Document</option>
            </select>
          </div>

          {/* Media picker / upload */}
          <div style={{ marginBottom: 16 }} className="nodrag">
            <label style={labelStyle}>
              {mediaType === "image"
                ? "Image"
                : mediaType === "video"
                  ? "Video"
                  : mediaType === "audio"
                    ? "Audio"
                    : "Document"}
            </label>

            {mediaUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: 10,
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  background: "var(--color-surface)",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {mediaType === "image" ? (
                    <img
                      src={mediaUrl}
                      alt=""
                      style={{
                        width: 42,
                        height: 42,
                        objectFit: "cover",
                        borderRadius: 7,
                        border: "1px solid var(--color-border)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 7,
                        background: "var(--color-primary-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-primary)",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {mediaType === "video"
                        ? "▶"
                        : mediaType === "audio"
                          ? "♫"
                          : "▤"}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-text)",
                      }}
                    >
                      {mediaType === "document" && documentFilename
                        ? documentFilename
                        : `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded`}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 190,
                      }}
                    >
                      Ready to send
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={uploadingMedia}
                  onClick={() => setMediaPickerOpen(true)}
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    borderRadius: 7,
                    padding: "6px 9px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-text)",
                    cursor: uploadingMedia ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  Change
                </button>
              </div>
            ) : mediaType === "audio" ? (
              <>
                <input
                  ref={(node) => {
                    audioInputRef.current = node;
                  }}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAudioUpload(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingMedia}
                  onClick={() => audioInputRef.current?.click()}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px",
                    border: "2px dashed var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: uploadingMedia ? "not-allowed" : "pointer",
                  }}
                >
                  <UploadOutlined />
                  {uploadingMedia ? "Uploading..." : "Select or Upload Audio"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => setMediaPickerOpen(true)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px",
                  border: "2px dashed var(--color-border)",
                  borderRadius: 10,
                  background: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: uploadingMedia ? "not-allowed" : "pointer",
                }}
              >
                <UploadOutlined />
                {uploadingMedia
                  ? "Uploading..."
                  : mediaType === "document"
                    ? "Select or Upload PDF / Document"
                    : "Select or Upload Media"}
              </button>
            )}

            {uploadingMedia && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 11,
                  color: "var(--color-primary)",
                  fontWeight: 600,
                }}
              >
                Uploading…
              </div>
            )}
          </div>

          {/* Keep manual URL entry available, matching the existing builder. */}
          <div style={{ marginBottom: 16 }} className="nodrag">
            <label style={labelStyle}>
              {mediaType === "image"
                ? "Image URL"
                : mediaType === "video"
                  ? "Video URL"
                  : mediaType === "audio"
                    ? "Audio URL"
                    : "Document URL"}
            </label>
            <textarea
              value={mediaUrl}
              onChange={(e) => {
                const value = e.target.value;
                setMediaUrl(value);
                syncToNode({ mediaUrl: value });
              }}
              placeholder={`Enter ${
                mediaType === "image"
                  ? "Image URL"
                  : mediaType === "video"
                    ? "Video URL"
                    : mediaType === "audio"
                      ? "Audio URL"
                      : "Document URL"
              }...`}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {mediaType === "document" && mediaUrl && (
            <div style={{ marginBottom: 14 }} className="nodrag">
              <label style={labelStyle}>Document File Name</label>
              <input
                value={documentFilename}
                onChange={(e) => {
                  const value = e.target.value;
                  setDocumentFilename(value);
                  syncToNode({ documentFilename: value });
                }}
                placeholder="e.g. invoice.pdf"
                style={inputStyle}
              />
            </div>
          )}

          {/* Caption - hidden for audio */}
          {showCaption && (
            <div style={{ marginBottom: 14 }} className="nodrag">
              <label style={labelStyle}>Caption (Optional)</label>
              <textarea
                value={caption}
                onChange={(e) => {
                  const value = e.target.value.slice(0, CAPTION_MAX);
                  setCaption(value);
                  syncToNode({ caption: value });
                }}
                rows={3}
                placeholder="Enter caption..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {CAPTION_MAX - caption.length} characters left
              </div>
            </div>
          )}

          <NodeVariableField id={id} data={data} />
        </div>
      </div>

      {/*
       * IMPORTANT: React Flow nodes are rendered inside elements that use
       * CSS transforms. A `position: fixed` modal rendered directly inside
       * the node therefore becomes fixed to the transformed node instead of
       * the browser viewport. That is why the picker appeared as a small
       * narrow modal in the Builder while the exact same picker was full-size
       * in Create Campaign.
       *
       * Render the picker through document.body so its fixed positioning,
       * width and backdrop behave exactly like the Campaign page.
       */}
      {mediaType !== "audio" &&
        mediaPickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="chatbot-media-picker-portal"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <MediaPickerModal
              isOpen={true}
              onClose={() => setMediaPickerOpen(false)}
              onSelect={(url: string, filename?: string) =>
                handleLibrarySelect(url, filename)
              }
              onUploadNew={async (file: File) => {
                await uploadMediaFile(file);
                setMediaPickerOpen(false);
              }}
              uploadingMedia={uploadingMedia}
              mediaType={getBuilderUploadType(mediaType) as any}
            />
          </div>,
          document.body,
        )}

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{
          background: "var(--color-text-muted)",
          border: "2px solid var(--color-surface)",
        }}
      />
    </div>
  );
};

const AskQuestionNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const attrs = data.attributes || {};

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Ask Question");
  const [messageBody, setMessageBody] = useState(
    attrs.message?.text?.body || data.message || "",
  );
  const [formatType, setFormatType] = useState(
    attrs.format?.type || data.responseFormat || "any",
  );
  const [validationMessage, setValidationMessage] = useState(
    attrs.format?.validationRules?.message || "",
  );
  const [retryCount, setRetryCount] = useState<number>(
    attrs.format?.validationRules?.retryCount ?? 1,
  );
  const [timeoutValue, setTimeoutValue] = useState<number>(
    attrs.timeout?.value ?? data.timeoutValue ?? 60,
  );
  const [timeoutUnit, setTimeoutUnit] = useState(
    attrs.timeout?.unit || data.timeoutUnit || "seconds",
  );
  const [continueOnTimeout, setContinueOnTimeout] = useState<boolean>(
    attrs.timeout?.continueOnTimeout ?? data.continueOnTimeout ?? false,
  );
  const [variable, setVariable] = useState(attrs.variable || "");
  const [isDirty, setIsDirty] = useState(true);

  const MSG_MAX = 1024;

  const buildAttributes = (overrides: Record<string, any> = {}) => {
    const fType = overrides.formatType ?? formatType;
    return {
      message: {
        type: "text",
        text: {
          body: overrides.messageBody ?? messageBody,
          preview_url: false,
        },
      },
      format: {
        type: fType,
        ...(fType !== "any"
          ? {
              validationRules: {
                message: overrides.validationMessage ?? validationMessage,
                retryCount: overrides.retryCount ?? retryCount,
              },
            }
          : {}),
      },
      timeout: {
        unit: overrides.timeoutUnit ?? timeoutUnit,
        value: overrides.timeoutValue ?? timeoutValue,
        continueOnTimeout: overrides.continueOnTimeout ?? continueOnTimeout,
      },
      variable: overrides.variable ?? variable,
    };
  };

  const syncToNode = (changes: any) =>
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setMessageBody("");
    setFormatType("any");
    setValidationMessage("");
    setRetryCount(1);
    setTimeoutValue(60);
    setTimeoutUnit("seconds");
    setContinueOnTimeout(false);
    setVariable("");
    syncToNode({
      attributes: {
        message: { type: "text", text: { body: "", preview_url: false } },
        format: { type: "any" },
        timeout: { unit: "seconds", value: 60, continueOnTimeout: false },
        variable: "",
      },
      variable: "",
      dataOut: {
        ...(data?.dataOut || {}),
        variable: "",
      },
    });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "askQuestion",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const showValidation = formatType !== "any";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* 1. Message → attributes.message.text.body */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              value={messageBody}
              onChange={(e) => {
                const val = e.target.value.slice(0, MSG_MAX);
                setMessageBody(val);
                syncToNode({
                  attributes: buildAttributes({ messageBody: val }),
                });
                setIsDirty(true);
              }}
              rows={3}
              placeholder="Type your question..."
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              Only {MSG_MAX}/{MSG_MAX} characters are allowed
            </div>
          </div>
          {/* 5. Variable → attributes.variable */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Save Answer As Variable</label>
            <input
              value={variable}
              onChange={(e) => {
                const val = e.target.value;
                setVariable(val);
                syncToNode({
                  variable: val,
                  dataOut: {
                    ...(data?.dataOut || {}),
                    variable: val,
                  },
                  attributes: buildAttributes({ variable: val }),
                });
              }}
              placeholder="e.g. photo, email, name"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Reference later as{" "}
              <code
                style={{
                  background: "var(--color-surface-muted)",
                  padding: "1px 5px",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {`{{nodeId.${variable || "variable"}}}`}
              </code>
            </div>
          </div>

          {/* 2. Response Format → attributes.format.type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Response Format</label>
            <select
              value={formatType}
              onChange={(e) => {
                const val = e.target.value;
                setFormatType(val);
                syncToNode({
                  attributes: buildAttributes({ formatType: val }),
                });
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="any">Any Response</option>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
              <option value="date">Date</option>
              <option value="regex">Regex</option>
              <option value="media">Media</option>
            </select>
          </div>

          {/* 3. Validation Rules → attributes.format.validationRules (hidden when any) */}
          {showValidation && (
            <div
              style={{
                border: "1px solid var(--color-surface-muted)",
                borderRadius: 10,
                padding: "12px",
                marginBottom: 14,
                background: "var(--color-surface)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 10,
                }}
              >
                Validation Rules
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Validation Message</label>
                <input
                  value={validationMessage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setValidationMessage(val);
                    syncToNode({
                      attributes: buildAttributes({ validationMessage: val }),
                    });
                  }}
                  placeholder="e.g. Please send a valid response"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Shown when the user sends an invalid response
                </div>
              </div>

              <div>
                <label style={labelStyle}>Retry Count</label>
                <input
                  type="number"
                  value={retryCount}
                  min={0}
                  max={10}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRetryCount(val);
                    syncToNode({
                      attributes: buildAttributes({ retryCount: val }),
                    });
                  }}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Max retries before moving on (0 = unlimited)
                </div>
              </div>
            </div>
          )}

          {/* 4. Timeout → attributes.timeout.value + unit */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Timeout Value</label>
              <input
                type="number"
                value={timeoutValue}
                min={1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTimeoutValue(val);
                  syncToNode({
                    attributes: buildAttributes({ timeoutValue: val }),
                  });
                }}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unit</label>
              <select
                value={timeoutUnit}
                onChange={(e) => {
                  const val = e.target.value;
                  setTimeoutUnit(val);
                  syncToNode({
                    attributes: buildAttributes({ timeoutUnit: val }),
                  });
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>
          </div>

          {/* 6. Continue on Timeout → attributes.timeout.continueOnTimeout */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              padding: "10px 12px",
              border: "1px solid var(--color-surface-muted)",
              borderRadius: 10,
              background: "var(--color-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>
                Continue on Timeout
              </span>
              <span
                title="When enabled, the flow continues even if no response is received within the timeout period"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "1px solid var(--color-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "var(--color-text-muted)",
                  cursor: "help",
                }}
              >
                ?
              </span>
            </div>
            <Switch
              checked={continueOnTimeout}
              onChange={(v) => {
                setContinueOnTimeout(v);
                syncToNode({
                  attributes: buildAttributes({ continueOnTimeout: v }),
                });
              }}
              style={{ background: continueOnTimeout ? "var(--color-primary)" : undefined }}
            />
          </div>

          
          
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)", top: "40%" }}
        title="When user replies"
      />
    </div>
  );
};
const WaitForResponseNode = ({ data, selected }: any) => (
  <div className="flow-node-inner">
    <Handle
      type="target"
      position={Position.Left}
      id="in"
        title="Incoming connection point — connect from another node"
      className="flow-handle-antd"
      style={{
        background: "var(--color-text-muted)",
        border: "2px solid var(--color-surface)",
        top: 22,
        width: 12,
        height: 12,
        borderRadius: "50%",
      }}
    />
    <AntNodeCard
      title="Wait for Response"
      tagColor="orange"
      icon={<ClockCircleOutlined />}
      selected={selected}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        {data?.timeoutMinutes
          ? `Wait up to ${data.timeoutMinutes} min`
          : "Flow pauses until user replies"}
      </Text>
      <NodeVariableField id={data?.id || "wait-for-response"} data={data} />
    </AntNodeCard>
    <Handle
      type="source"
      position={Position.Right}
      id="out"
      className="flow-handle-antd"
      data-theme="orange"
      style={{ top: "40%" }}
      title="When user replies"
    />
  </div>
);
/**
 * Safely normalize values coming from saved/API node data.
 * Older chatbot flows can contain null/undefined/non-string values.
 * Keeping these values as real strings prevents React/DOM string
 * conversion errors during CTA node rendering.
 */
const safeString = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const safeNodeData = (value: any): Record<string, any> =>
  value && typeof value === "object" ? value : {};


const AIAgentNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "AI Agent");
  const [stopKeywords, setStopKeywords] = useState<string[]>(
    Array.isArray(data.stopKeywords) && data.stopKeywords.length
      ? data.stopKeywords
      : ["/stop"],
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [assistant, setAssistant] = useState(
    normalizeAssistantId(data.assistant ?? data.assistantId),
  );
  const [assistants, setAssistants] = useState<AIAssistant[]>([]);
const [loadingAssistants, setLoadingAssistants] = useState(false);
const [assistantError, setAssistantError] = useState("");
const [assistantDropdownOpen, setAssistantDropdownOpen] = useState(false);

const assistantDropdownRef = useRef<HTMLDivElement | null>(null);
  const [timeoutValue, setTimeoutValue] = useState(data.timeoutValue || 5);
  const [timeoutUnit, setTimeoutUnit] = useState(data.timeoutUnit || "minutes");
  const [welcomeMessage, setWelcomeMessage] = useState(
    data.welcomeMessage || "",
  );
  const [timeoutMessage, setTimeoutMessage] = useState(
    data.timeoutMessage || "",
  );

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };
  useEffect(() => {
  let cancelled = false;

  const fetchAssistants = async () => {
    setLoadingAssistants(true);
    setAssistantError("");

    try {
      const response = await soft7AxiosInstance.get(
        "/admin/ai-assistant",
      );

      console.log("AI Assistants API Response:", response.data);

      const rawAssistantList = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.data?.data)
          ? response.data.data.data
          : Array.isArray(response.data?.assistants)
            ? response.data.assistants
            : [];

      const assistantList = rawAssistantList
        .map(normalizeAIAssistant)
        .filter((item: AIAssistant | null): item is AIAssistant => Boolean(item));

      if (!cancelled) {
        setAssistants(assistantList);
      }
    } catch (error: any) {
      console.error("Failed to fetch AI assistants:", error);

      if (!cancelled) {
        setAssistants([]);
        setAssistantError(
          error?.response?.data?.message ||
            "Failed to load AI assistants",
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingAssistants(false);
      }
    }
  };

  fetchAssistants();

  return () => {
    cancelled = true;
  };
}, []);
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      assistantDropdownRef.current &&
      !assistantDropdownRef.current.contains(event.target as Node)
    ) {
      setAssistantDropdownOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);
  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "ai",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const addKeyword = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || stopKeywords.includes(trimmed)) return;
    const updated = [...stopKeywords, trimmed];
    setStopKeywords(updated);
    syncToNode({ stopKeywords: updated });
  };

  const removeKeyword = (kw: string) => {
    const updated = stopKeywords.filter((k) => k !== kw);
    setStopKeywords(updated);
    syncToNode({ stopKeywords: updated });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      {/* Left input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Stop Agent Keywords */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Stop Agent Keywords</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                minHeight: 38,
                alignItems: "center",
              }}
            >
              {stopKeywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--color-surface-muted)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    color: "var(--color-text)",
                    fontWeight: 500,
                  }}
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                      padding: 0,
                      fontSize: 12,
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addKeyword(keywordInput);
                    setKeywordInput("");
                  }
                }}
                onBlur={() => {
                  if (keywordInput.trim()) {
                    addKeyword(keywordInput);
                    setKeywordInput("");
                  }
                }}
                placeholder="Add keyword..."
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "transparent",
                  flex: 1,
                  minWidth: 80,
                }}
              />
            </div>
          </div>
{/* Assistant */}
<div
  ref={assistantDropdownRef}
  className="ai-assistant-dropdown-wrapper"
  style={{
    marginBottom: 14,
    position: "relative",
  }}
>
  <label style={labelStyle}>Assistant</label>

  {/* Selected value */}
  <button
    type="button"
    className="ai-assistant-dropdown-trigger"
    disabled={loadingAssistants}
    onClick={(e) => {
      e.stopPropagation();

      if (!loadingAssistants) {
        setAssistantDropdownOpen((prev) => !prev);
      }
    }}
  >
    <span
      className={
        assistant
          ? "ai-assistant-selected-text"
          : "ai-assistant-placeholder"
      }
    >
      {loadingAssistants
        ? "Loading assistants..."
        : assistant
          ? (() => {
              const selected = assistants.find(
                (item) => getAssistantId(item) === normalizeAssistantId(assistant)
              );

              if (!selected) {
                return "Select an assistant";
              }

              return `${selected.name}${
                selected.provider ? ` — ${selected.provider}` : ""
              }${
                selected.model ? ` — ${selected.model}` : ""
              }`;
            })()
          : "Select an assistant"}
    </span>

    <span
      className={`ai-assistant-arrow ${
        assistantDropdownOpen ? "open" : ""
      }`}
    >
      ▾
    </span>
  </button>

  {/* Dropdown */}
  {assistantDropdownOpen && !loadingAssistants && (
    <div className="ai-assistant-dropdown-menu">
      {/* Placeholder */}
      <div
        className={`ai-assistant-option ${
          !assistant ? "selected" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();

          setAssistant("");

          syncToNode({
            assistant: "",
            assistantId: null,
          });

          setAssistantDropdownOpen(false);
        }}
      >
        Select an assistant
      </div>

      {/* Assistants */}
      {assistants.map((item) => {
        const itemId = getAssistantId(item);
        const isSelected =
          Boolean(itemId) && normalizeAssistantId(assistant) === itemId;

        return (
          <div
            key={itemId}
            className={`ai-assistant-option ${
              isSelected ? "selected" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();

              if (!itemId) {
                toast.error("This assistant does not have a valid ID.");
                return;
              }

              setAssistant(itemId);

              syncToNode({
                assistant: itemId,
                assistantId: itemId,
              });

              setAssistantDropdownOpen(false);
            }}
          >
            <div className="ai-assistant-option-name">
              {item.name}
            </div>

            {(item.provider || item.model) && (
              <div className="ai-assistant-option-meta">
                {item.provider || ""}
                {item.provider && item.model ? " — " : ""}
                {item.model || ""}
              </div>
            )}
          </div>
        );
      })}

      {assistants.length === 0 && (
        <div className="ai-assistant-empty">
          No assistants available
        </div>
      )}
    </div>
  )}

  {assistantError && (
    <div
      style={{
        fontSize: 11,
        color: "var(--color-error)",
        marginTop: 4,
      }}
    >
      {assistantError}
    </div>
  )}
</div>
          

          {/* Timeout Value + Unit side by side */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Timeout Value</label>
              <input
                type="number"
                value={timeoutValue}
                min={1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTimeoutValue(val);
                  syncToNode({ timeoutValue: val });
                }}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unit</label>
              <select
                value={timeoutUnit}
                onChange={(e) => {
                  setTimeoutUnit(e.target.value);
                  syncToNode({ timeoutUnit: e.target.value });
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>
          </div>

          {/* Welcome Message */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Welcome Message</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => {
                setWelcomeMessage(e.target.value);
                syncToNode({ welcomeMessage: e.target.value });
              }}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Timeout Message */}
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Timeout Message (Optional)</label>
            <textarea
              value={timeoutMessage}
              onChange={(e) => {
                setTimeoutMessage(e.target.value);
                syncToNode({ timeoutMessage: e.target.value });
              }}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Message shown when the timeout is reached
            </div>
          </div>
          <NodeVariableField id={id} data={data} />

        </div>
      </div>

      {/* Right output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};

const ConditionNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Condition");
  const [operator, setOperator] = useState(data.operator || "and");
  const [conditions, setConditions] = useState<
    Array<{
      id: string;
      field: string;
      comparator: string;
      value: string;
      threshold: number;
    }>
  >(
    Array.isArray(data.conditions) && data.conditions.length
      ? data.conditions
      : [
          {
            id: "cond_0",
            field: "",
            comparator: "equals",
            value: "",
            threshold: 0.8,
          },
        ],
  );
  const [isDirty, setIsDirty] = useState(true);

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleClearAll = () => {
    setOperator("and");
    setConditions([
      {
        id: "cond_0",
        field: "",
        comparator: "equals",
        value: "",
        threshold: 0.8,
      },
    ]);
    syncToNode({
      operator: "and",
      conditions: [
        { id: "cond_0", field: "", comparator: "equals", value: "", threshold: 0.8 },
      ],
      attributes: {
        operator: "and",
        conditions: [{ field: "", value: "", threshold: 0.8, comparator: "equals" }],
      },
    });
    setIsDirty(true);
  };

  const isSavedAndClean = !isDirty;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "condition",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const addCondition = () => {
    const updated = [
      ...conditions,
      {
        id: `cond_${Date.now()}`,
        field: "",
        comparator: "equals",
        value: "",
        threshold: 0.8,
      },
    ];
    setConditions(updated);
    syncToNode({ conditions: updated });
    setIsDirty(true);
  };

  const removeCondition = (idx: number) => {
    if (conditions.length <= 1) return;
    const updated = conditions.filter((_, i) => i !== idx);
    setConditions(updated);
    syncToNode({ conditions: updated });
    setIsDirty(true);
  };

  const updateCondition = (idx: number, field: string, val: any) => {
    const updated = conditions.map((c, i) =>
      i === idx ? { ...c, [field]: val } : c,
    );
    setConditions(updated);
    syncToNode({ conditions: updated });
    setIsDirty(true);
  };

  const showThreshold = (comp: string) => comp === "fuzzy_match";
  const noValueComparators = [
    "is_phone_number",
    "is_email",
    "is_empty",
    "is_not_empty",
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 340,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Operator: AND / OR */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Match</label>
            <select
              value={operator}
              onChange={(e) => {
                setOperator(e.target.value);
                syncToNode({ operator: e.target.value });
                setIsDirty(true);
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="and">All conditions (AND)</option>
              <option value="or">Any condition (OR)</option>
            </select>
          </div>

          {/* Condition rows */}
          {conditions.map((cond, idx) => (
            <div
              key={cond.id}
              style={{
                border: "1px solid var(--color-surface-muted)",
                borderRadius: 10,
                padding: "12px",
                marginBottom: 12,
                background: "var(--color-surface)",
                position: "relative",
              }}
            >
              {/* Remove condition button */}
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(idx)}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-error)",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <DeleteOutlined style={{ fontSize: 12 }} />
                </button>
              )}

              {/* Field */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>First value</label>
                <input
                  value={cond.field}
                  onChange={(e) =>
                    updateCondition(idx, "field", e.target.value)
                  }
                  placeholder="e.g. {{http_response.success}}"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>

              {/* Comparator */}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Condition</label>
                <select
                  value={cond.comparator}
                  onChange={(e) =>
                    updateCondition(idx, "comparator", e.target.value)
                  }
                  style={{ ...inputStyle, cursor: "pointer" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="not_contains">Not Contains</option>
                  <option value="starts_with">Starts With</option>
                  <option value="ends_with">Ends With</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="is_empty">Is Empty</option>
                  <option value="is_not_empty">Is Not Empty</option>
                  <option value="is_phone_number">Is Phone Number</option>
                  <option value="is_email">Is Email</option>
                  <option value="matches_regex">Matches Regex</option>
                  <option value="fuzzy_match">Fuzzy Match</option>
                </select>
              </div>

              {/* Value — hidden for no-value comparators */}
              {!noValueComparators.includes(cond.comparator) && (
                <div
                  style={{
                    marginBottom: showThreshold(cond.comparator) ? 10 : 0,
                  }}
                >
                  <label style={labelStyle}>Second value</label>
                  <input
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(idx, "value", e.target.value)
                    }
                    placeholder="Compare with value"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                  />
                </div>
              )}

              {/* Threshold slider — only for fuzzy_match */}
              {showThreshold(cond.comparator) && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>
                    Match Threshold: {Math.round((cond.threshold ?? 0.8) * 100)}
                    %
                  </label>
                  <Slider
                    min={0}
                    max={100}
                    value={Math.round((cond.threshold ?? 0.8) * 100)}
                    onChange={(v) => updateCondition(idx, "threshold", v / 100)}
                    trackStyle={{ background: "var(--color-primary)" }}
                    handleStyle={{ borderColor: "var(--color-primary)" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    <span>Exact</span>
                    <span>Very Loose</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Condition */}
          <button
            onClick={addCondition}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text)",
              fontSize: 13,
              fontWeight: 500,
              padding: "4px 0",
              marginBottom: 16,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--color-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--color-text)")
            }
          >
            <PlusOutlined style={{ fontSize: 12 }} /> Add Condition
          </button>

          {/* Outputs */}
          <div
            style={{
              border: "1px solid var(--color-surface-muted)",
              borderRadius: 10,
              overflow: "visible",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                background: "var(--color-surface)",
                borderBottom: "1px solid var(--color-surface-muted)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
                Outputs
              </span>
            </div>

            {/* True */}
            <div
              style={{
                position: "relative",
                padding: "10px 12px",
                borderBottom: "1px solid var(--color-surface-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500 }}>
                True
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="true"
        title="Output connection point — drag to connect"
                style={{
                  position: "absolute",
                  right: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--color-text-muted)",
                  border: "2px solid var(--color-surface)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                }}
              />
            </div>

            {/* False */}
            <div
              style={{
                position: "relative",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500 }}>
                False
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="false"
        title="Output connection point — drag to connect"
                style={{
                  position: "absolute",
                  right: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--color-error)",
                  border: "2px solid var(--color-surface)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                }}
              />
            </div>
          </div>


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>
    </div>
  );
};
const DelayNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "Delay");
  const initialDelay = millisecondsToDelay(
    data?.delay ?? data?.attributes?.delay ?? 60 * 1000,
  );
  const [delayType, setDelayType] = useState(data.delayType || "delay_for");
  const [value, setValue] = useState<number | string>(
    data.value ?? initialDelay.value,
  );
  const [unit, setUnit] = useState(
    data.unit || initialDelay.unit,
  );

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== id) return node;

        const nextValue =
          changes.value !== undefined
            ? Number(changes.value)
            : Number(node.data?.value ?? value);

        const nextUnit =
          changes.unit !== undefined
            ? String(changes.unit)
            : String(node.data?.unit ?? unit);

        const nextDelay =
          changes.delay !== undefined
            ? Math.max(0, Math.round(Number(changes.delay)))
            : delayToMilliseconds(nextValue, nextUnit);

        return {
          ...node,
          data: {
            ...node.data,
            ...changes,
            value: Number.isFinite(nextValue) ? nextValue : 1,
            unit: nextUnit,
            delay: nextDelay,
          },
        };
      }),
    );
  };

  const updateDelayValue = (nextValue: number) => {
    const duration = Number.isFinite(nextValue) ? Math.max(1, nextValue) : 1;
    setValue(duration);
    syncToNode({ value: duration });
  };

  const stepDelayValue = (direction: 1 | -1) => {
    const currentValue = Number(value);
    const duration = Number.isFinite(currentValue) ? Math.max(1, currentValue) : 1;
    updateDelayValue(duration + direction);
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "delay",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Delay Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Delay Type</label>
            <select
              value={delayType}
              onChange={(e) => {
                setDelayType(e.target.value);
                syncToNode({ delayType: e.target.value });
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="delay_for">Delay for</option>
            </select>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Choose how you want to configure the delay
            </div>
          </div>

          {/* Delay for: Value + Unit */}
          {delayType === "delay_for" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Value</label>
                <div className="delay-value-control nodrag nopan nowheel">
                  <input
                    type="text"
                    inputMode="decimal"
                    role="spinbutton"
                    aria-label="Delay duration"
                    aria-valuemin={1}
                    aria-valuenow={value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined}
                    value={value}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      if (!/^\d*(?:\.\d*)?$/.test(nextValue)) return;
                      setValue(nextValue);
                      const duration = Number(nextValue);
                      // Keep an empty/partial edit local so it never saves a zero delay.
                      if (nextValue !== "" && Number.isFinite(duration) && duration >= 1) {
                        syncToNode({ value: duration });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      if (!e.repeat) stepDelayValue(e.key === "ArrowUp" ? 1 : -1);
                    }}
                    style={{ ...inputStyle, paddingRight: 30 }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--color-border)";
                      updateDelayValue(Number(e.target.value));
                    }}
                  />
                  <div className="delay-value-arrows">
                    <button
                      type="button"
                      aria-label="Increase delay by 1"
                      title="Increase delay by 1"
                      onMouseDown={(e) => e.preventDefault()}
                      onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}
                      onClick={() => stepDelayValue(1)}
                    >
                      <UpOutlined />
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease delay by 1"
                      title="Decrease delay by 1"
                      disabled={Number(value) <= 1 || !Number.isFinite(Number(value))}
                      onMouseDown={(e) => e.preventDefault()}
                      onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}
                      onClick={() => stepDelayValue(-1)}
                    >
                      <DownOutlined />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Enter delay duration
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Unit</label>
                <select
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    syncToNode({ unit: e.target.value });
                  }}
                  style={{ ...inputStyle, cursor: "pointer" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Select time unit
                </div>
              </div>
            </div>
          )}

          <NodeVariableField id={id} data={data} />

        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};

const ActionNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(data.label || "HTTP");
  const [method, setMethod] = useState(data.method || "GET");
  const [url, setUrl] = useState(data.url || "");
  const [activeTab, setActiveTab] = useState<
    "headers" | "params" | "body" | "test"
  >("headers");
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    Array.isArray(data.headers) && data.headers.length
      ? data.headers
      : [{ key: "", value: "" }],
  );
  const [params, setParams] = useState<Array<{ key: string; value: string }>>(
    Array.isArray(data.params) && data.params.length
      ? data.params
      : [{ key: "", value: "" }],
  );
  const [body, setBody] = useState(data.body || "");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "action",
        data: { ...data },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  // Headers helpers
  const addHeader = () => {
    const updated = [...headers, { key: "", value: "" }];
    setHeaders(updated);
    syncToNode({ headers: updated });
  };
  const removeHeader = (i: number) => {
    const updated = headers.filter((_, idx) => idx !== i);
    setHeaders(updated);
    syncToNode({ headers: updated });
  };
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const updated = headers.map((h, idx) =>
      idx === i ? { ...h, [field]: val } : h,
    );
    setHeaders(updated);
    syncToNode({ headers: updated });
  };

  // Params helpers
  const addParam = () => {
    const updated = [...params, { key: "", value: "" }];
    setParams(updated);
    syncToNode({ params: updated });
  };
  const removeParam = (i: number) => {
    const updated = params.filter((_, idx) => idx !== i);
    setParams(updated);
    syncToNode({ params: updated });
  };
  const updateParam = (i: number, field: "key" | "value", val: string) => {
    const updated = params.map((p, idx) =>
      idx === i ? { ...p, [field]: val } : p,
    );
    setParams(updated);
    syncToNode({ params: updated });
  };

  const bodyAllowed = ["POST", "PUT", "PATCH"].includes(method);

  const runTest = async () => {
    if (!url.trim()) {
      setTestResponse("Please enter a URL first.");
      return;
    }
    setTestLoading(true);
    setTestResponse(null);
    try {
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim()) headersObj[h.key] = h.value;
      });

      let fetchUrl = url;
      if (params.length > 0) {
        const q = params
          .filter((p) => p.key.trim())
          .map(
            (p) =>
              `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`,
          )
          .join("&");
        if (q) fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + q;
      }

      const opts: RequestInit = { method, headers: headersObj };
      if (bodyAllowed && body.trim()) opts.body = body;

      const res = await fetch(fetchUrl, opts);
      const text = await res.text();
      setTestResponse(`Status: ${res.status}\n\n${text.slice(0, 500)}`);
    } catch (err: any) {
      setTestResponse(`Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  const tabs = ["headers", "params", "body", "test"] as const;
  const tabLabels: Record<string, string> = {
    headers: "Headers",
    params: "Params",
    body: "Body",
    test: "Test",
  };

  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 320,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* HTTP Method */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>HTTP Method</label>
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                syncToNode({ method: e.target.value });
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {/* URL */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>URL</label>
            <textarea
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                syncToNode({ url: e.target.value });
              }}
              rows={2}
              placeholder="https://api.example.com/endpoint"
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-surface-muted)",
              marginBottom: 14,
              gap: 0,
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? "var(--color-primary)" : "var(--color-text-muted)",
                  borderBottom:
                    activeTab === tab
                      ? "2px solid var(--color-primary)"
                      : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          {/* Tab Content */}

          {/* Headers Tab */}
          {activeTab === "headers" && (
            <div>
              {headers.map((h, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ position: "relative", marginBottom: 4 }}>
                    <input
                      value={h.key}
                      onChange={(e) => updateHeader(i, "key", e.target.value)}
                      placeholder="Header key"
                      style={{ ...inputStyle, paddingRight: 36 }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                    />
                    <button
                      onClick={() => removeHeader(i)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-error)",
                        padding: 2,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <DeleteOutlined style={{ fontSize: 13 }} />
                    </button>
                  </div>
                  <textarea
                    value={h.value}
                    onChange={(e) => updateHeader(i, "value", e.target.value)}
                    placeholder="Header value"
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                  />
                </div>
              ))}
              <button
                onClick={addHeader}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "4px 0",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--color-primary)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--color-text)")
                }
              >
                <PlusOutlined style={{ fontSize: 12 }} /> Add Header
              </button>
            </div>
          )}

          {/* Params Tab */}
          {activeTab === "params" && (
            <div>
              {params.map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ position: "relative", marginBottom: 4 }}>
                    <input
                      value={p.key}
                      onChange={(e) => updateParam(i, "key", e.target.value)}
                      placeholder="Parameter key"
                      style={{ ...inputStyle, paddingRight: 36 }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                    />
                    <button
                      onClick={() => removeParam(i)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-error)",
                        padding: 2,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <DeleteOutlined style={{ fontSize: 13 }} />
                    </button>
                  </div>
                  <textarea
                    value={p.value}
                    onChange={(e) => updateParam(i, "value", e.target.value)}
                    placeholder="Parameter value"
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                  />
                </div>
              ))}
              <button
                onClick={addParam}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "4px 0",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--color-primary)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--color-text)")
                }
              >
                <PlusOutlined style={{ fontSize: 12 }} /> Add Parameter
              </button>
            </div>
          )}

          {/* Body Tab */}
          {activeTab === "body" && (
            <div>
              {bodyAllowed ? (
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    syncToNode({ body: e.target.value });
                  }}
                  rows={5}
                  placeholder='{"key": "value"}'
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              ) : (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    background: "var(--color-surface)",
                    borderRadius: 8,
                    border: "1px solid var(--color-surface-muted)",
                  }}
                >
                  Body is only available for POST, PUT, and PATCH methods
                </div>
              )}
            </div>
          )}

          {/* Test Tab */}
          {activeTab === "test" && (
            <div>
              <button
                onClick={runTest}
                disabled={testLoading}
                style={{
                  width: "100%",
                  padding: "9px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  cursor: testLoading ? "not-allowed" : "pointer",
                  fontSize: 13,
                  color: "var(--color-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontWeight: 500,
                  marginBottom: 12,
                  opacity: testLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!testLoading) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-primary)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--color-border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                {testLoading ? "Running..." : "Run Test"}
              </button>

              <div
                style={{
                  padding: "12px",
                  background: "var(--color-surface)",
                  borderRadius: 8,
                  border: "1px solid var(--color-surface-muted)",
                  minHeight: 60,
                  fontSize: 12,
                  color: testResponse ? "var(--color-text)" : "var(--color-text-muted)",
                  fontFamily: testResponse ? "monospace" : "inherit",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {testResponse || 'Click "Test Request" to see the response'}
              </div>
            </div>
          )}

        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};
const DeleteableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: any) => {
  const { setEdges } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  // When multiple edges leave the SAME source handle, React Flow normally
  // gives every edge the exact same starting segment. That makes the lines
  // look like one connection until they are some distance away from the node.
  // `routingOffset` is calculated per source-handle group below and is used
  // here to fan the paths apart immediately after the handle.
  const routingOffset = Number(data?.routingOffset) || 0;
  const fanDistance = 34;

  const isHorizontalSource =
    sourcePosition === Position.Left || sourcePosition === Position.Right;

  const direction =
    sourcePosition === Position.Left
      ? -1
      : sourcePosition === Position.Right
        ? 1
        : 0;
  const verticalDirection =
    sourcePosition === Position.Top
      ? -1
      : sourcePosition === Position.Bottom
        ? 1
        : 0;

  // The first short segment is deliberately offset perpendicular to the
  // source handle. This is the important part: two outgoing connections
  // become visually separate right from the node instead of sharing a line.
  const fanX = isHorizontalSource
    ? sourceX + direction * fanDistance
    : sourceX + routingOffset;
  const fanY = isHorizontalSource
    ? sourceY + routingOffset
    : sourceY + verticalDirection * fanDistance;

  const [smoothPath, smoothLabelX, smoothLabelY] = getSmoothStepPath({
    sourceX: fanX,
    sourceY: fanY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
    offset: 18,
  });

  // `getSmoothStepPath()` returns a path beginning with `M ...`. We only need
  // its line/curve portion because the path must continue from our fan point.
  // Using the first `L` is more reliable than trying to parse React Flow's
  // generated coordinate formatting with a regular expression.
  const smoothBody = smoothPath.includes("L")
    ? smoothPath.slice(smoothPath.indexOf("L"))
    : `L ${targetX},${targetY}`;

  // Start at the real handle, fan out to the unique routing point, then
  // continue with React Flow's normal smooth-step routing.
  const edgePath = `M ${sourceX},${sourceY} L ${fanX},${fanY} ${smoothBody}`;

  const labelX = smoothLabelX;
  const labelY = smoothLabelY;

  const deleteEdge = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEdges((eds) => eds.filter((ed) => ed.id !== id));
  };

  return (
    <>
      {/* Wider transparent hit path makes edge hover/delete easy without changing the visual line. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        pointerEvents="stroke"
      />

      <path
        id={id}
        style={{ ...style, pointerEvents: "stroke" }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={label ? `Connection: ${label}` : "Chatbot connection"}
      />

      {label && (
        <text pointerEvents="none">
          <textPath
            href={`#${id}`}
            startOffset="50%"
            textAnchor="middle"
            style={{
              fontSize: 11,
              fontWeight: 600,
              fill: "var(--color-text-muted)",
              paintOrder: "stroke",
              stroke: "var(--color-surface)",
              strokeWidth: 4,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          >
            {label}
          </textPath>
        </text>
      )}

      {hovered && (
        <foreignObject
          width={30}
          height={30}
          x={labelX - 15}
          y={labelY - 15}
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{ overflow: "visible", pointerEvents: "all" }}
        >
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={deleteEdge}
            role="button"
            aria-label="Delete connection"
            title="Delete connection"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--color-text-muted)",
              fontWeight: 700,
              boxShadow: "var(--elevation-sm)",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ×
          </div>
        </foreignObject>
      )}
    </>
  );
};
const CTAMessageNode = ({ id, data, selected }: any) => {
  const rf = useReactFlow();

  const nodeData = safeNodeData(data);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(
    safeString(nodeData.label, "Send CTA Message"),
  );
  const [headerType, setHeaderType] = useState(() => {
    const value = safeString(nodeData.headerType, "text");
    return value === "none" || !value ? "text" : value;
  });
  const [headerText, setHeaderText] = useState(
    safeString(nodeData.headerText),
  );
  const [headerUrl, setHeaderUrl] = useState(
    safeString(nodeData.headerUrl),
  );
  const [bodyText, setBodyText] = useState(safeString(nodeData.text));
  const [displayText, setDisplayText] = useState(
    safeString(nodeData.displayText),
  );
  const [ctaUrl, setCtaUrl] = useState(safeString(nodeData.ctaUrl));
  const [footerText, setFooterText] = useState(
    safeString(nodeData.footer),
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Tracks whether any field changed since last successful Save
  const [isDirty, setIsDirty] = useState(true);

  const BODY_MAX = 1024;
  const HEADER_MAX = 60;
  const DISPLAY_MAX = 20;
  const FOOTER_MAX = 60;

  // Shared with Send Media and Send Button Message.
  const handleMediaUpload = async (file: File) => {
    setUploadingMedia(true);
    try {
      const result = await uploadBuilderMediaFile(rf, file, headerType);

      if (!result) return;

      setHeaderUrl(result.url);
      syncToNode({ headerUrl: result.url });
      setIsDirty(true);

      toast.success(
        `${headerType.charAt(0).toUpperCase() + headerType.slice(1)} uploaded successfully 🚀`,
      );
      setMediaPickerOpen(false);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleLibrarySelect = (url: string) => {
    const nextUrl = String(url || "").trim();
    setHeaderUrl(nextUrl);
    syncToNode({ headerUrl: nextUrl });
    setIsDirty(true);
    setMediaPickerOpen(false);
  };

  const syncToNode = (changes: any) => {
    rf.setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...changes } } : node,
      ),
    );
  };

  const handleNameSave = () => {
    syncToNode({ label: nodeName });
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
    rf.setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuid();
    rf.setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "ctaMessage",
        data: { ...nodeData },
        position: {
          x: (nds.find((n) => n.id === id)?.position.x || 0) + 30,
          y: (nds.find((n) => n.id === id)?.position.y || 0) + 30,
        },
      },
    ]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    fontSize: 13,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "var(--font-sans)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text)",
    display: "block",
    marginBottom: 6,
  };

  const urlLabel: Record<string, string> = {
    image: "Image URL",
    video: "Video URL",
    document: "Document URL",
  };
const isSavedAndClean = !isDirty;
  return (
    <div className="flow-node-inner" style={{ position: "relative" }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        title="Incoming connection point — connect from another node"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />

      <div
        style={{
          width: 300,
          background: "var(--color-surface)",
          borderRadius: 12,
          border: selected ? "1.5px solid var(--color-primary)" : "1px solid var(--color-border)",
          boxShadow: "var(--elevation-sm)",
          overflow: "visible",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface)",
            gap: 8,
          }}
        >
          {isEditingName ? (
            <Input
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              onPressEnter={handleNameSave}
              autoFocus
              size="small"
              style={{
                flex: 1,
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: 6,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "var(--color-text)",
              }}
            >
              {nodeName}
            </span>
          )}

          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {isEditingName ? (
              <Button
                size="small"
                type="text"
                onClick={handleNameSave}
                style={{
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "0 6px",
                }}
              >
                ✓
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
              />
            )}
            <Button
              size="small"
              type="text"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              }
              onClick={handleCopy}
              title="Duplicate"
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 14px 12px" }}>
          {/* Header Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Header Type</label>
            <select
              value={headerType}
              onChange={(e) => {
                const val = e.target.value;
                setHeaderType(val);
                setHeaderText("");
                setHeaderUrl("");
                setMediaPickerOpen(false);
                syncToNode({ headerType: val, headerText: "", headerUrl: "" });
                setIsDirty(true);
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
            </select>
          </div>

          {/* Conditional header field */}
          {headerType === "text" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Header Text</label>
              <input
                value={headerText}
                onChange={(e) => {
                  const val = e.target.value.slice(0, HEADER_MAX);
                  setHeaderText(val);
                  syncToNode({ headerText: val });
                  setIsDirty(true);
                }}
                placeholder="Enter header text"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {HEADER_MAX - headerText.length} characters left
              </div>
            </div>
          )}

          {/* Header media: use the exact same picker/upload flow as Send Media Message */}
          {["image", "video", "document"].includes(headerType) && (
            <div style={{ marginBottom: 14 }} className="nodrag">
              <label style={labelStyle}>
                {headerType === "image"
                  ? "Image"
                  : headerType === "video"
                    ? "Video"
                    : "Document"}
              </label>

              {headerUrl ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {headerType === "image" ? (
                      <img
                        src={headerUrl}
                        alt=""
                        style={{
                          width: 42,
                          height: 42,
                          objectFit: "cover",
                          borderRadius: 7,
                          border: "1px solid var(--color-border)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 7,
                          background: "var(--color-primary-light)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-primary)",
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {headerType === "video" ? "▶" : "▤"}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        {headerType.charAt(0).toUpperCase() +
                          headerType.slice(1)}{" "}
                        selected
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 175,
                        }}
                      >
                        Ready to send
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={uploadingMedia}
                    onClick={() => setMediaPickerOpen(true)}
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      borderRadius: 7,
                      padding: "6px 9px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text)",
                      cursor: uploadingMedia ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingMedia}
                  onClick={() => setMediaPickerOpen(true)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px",
                    border: "2px dashed var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: uploadingMedia ? "not-allowed" : "pointer",
                  }}
                >
                  <UploadOutlined />
                  {uploadingMedia
                    ? "Uploading..."
                    : headerType === "document"
                      ? "Select or Upload PDF / Document"
                      : "Select or Upload Media"}
                </button>
              )}

              {/* Manual URL is still supported */}
              <textarea
                value={headerUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setHeaderUrl(val);
                  syncToNode({ headerUrl: val });
                  setIsDirty(true);
                }}
                placeholder={`Enter ${headerType} URL...`}
                rows={2}
                style={{ ...inputStyle, marginTop: 8, resize: "vertical" }}
              />
            </div>
          )}

          {/* Body Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Body Text</label>
            <textarea
              value={bodyText}
              onChange={(e) => {
                const val = e.target.value.slice(0, BODY_MAX);
                setBodyText(val);
                syncToNode({ text: val });
                 setIsDirty(true); 
              }}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {BODY_MAX - bodyText.length} characters left
            </div>
          </div>

          {/* Display Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Display Text</label>
            <input
              value={displayText}
              onChange={(e) => {
                const val = e.target.value.slice(0, DISPLAY_MAX);
                setDisplayText(val);
                syncToNode({ displayText: val });
                 setIsDirty(true); 
              }}
              placeholder="Enter display text"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {DISPLAY_MAX - displayText.length} characters left
            </div>
          </div>

          {/* URL */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>URL</label>
            <input
              value={ctaUrl}
              onChange={(e) => {
                const val = e.target.value;
                setCtaUrl(val);
                syncToNode({ ctaUrl: val });
                 setIsDirty(true); 
              }}
              placeholder="Enter URL"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Footer Text */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Footer Text</label>
            <input
              value={footerText}
              onChange={(e) => {
                const val = e.target.value.slice(0, FOOTER_MAX);
                setFooterText(val);
                syncToNode({ footer: val });
                 setIsDirty(true); 
              }}
              placeholder="Enter footer text"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {FOOTER_MAX - footerText.length} characters left
            </div>
          </div>


          
                    <NodeVariableField id={id} data={data} />



        </div>
      </div>

      {["image", "video", "document"].includes(headerType) &&
        mediaPickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="chatbot-media-picker-portal"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <MediaPickerModal
              isOpen={true}
              onClose={() => setMediaPickerOpen(false)}
              onSelect={(url: string, filename?: string) => {
                handleLibrarySelect(url);
                void filename;
              }}
              onUploadNew={async (file: File) => {
                await handleMediaUpload(file);
              }}
              uploadingMedia={uploadingMedia}
              mediaType={getBuilderUploadType(headerType) as "IMAGE" | "VIDEO" | "DOCUMENT"}
            />
          </div>,
          document.body,
        )}


      <Handle
        type="source"
        position={Position.Right}
        id="out"
        title="Output connection point — drag to connect"
        className="flow-handle-antd"
        style={{ background: "var(--color-text-muted)", border: "2px solid var(--color-surface)" }}
      />
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  template: TemplateNode,
  message: MessageNode,
  interactive: InteractiveNode,
  buttonMessage: InteractiveNode,
  listMessage: ListMessageNode,
  sendMedia: SendMediaNode,
  askQuestion: AskQuestionNode,
  media: MediaNode,
  image: MediaNode,
  waitForResponse: WaitForResponseNode,
  ai: AIAgentNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  ctaMessage: CTAMessageNode,
  productMessage: ProductMessageNode,
  askLocation: AskLocationNode,
  updateTag: UpdateTagNode,
  updateColumn: UpdateColumnNode,
  fetchContact: FetchContactNode,
  stopChatbot: StopChatbotNode,
};

const edgeTypes = {
  deleteable: DeleteableEdge,
};
function canConnect(
  sourceType?: string,
  targetType?: string,
  sourceHandle?: string,
) {
  if (!sourceType || !targetType) return false;
  if (targetType === "trigger") return false;
  if (
    sourceType === "condition" &&
    !["true", "false"].includes(sourceHandle || "")
  )
    return false;
  if (
    (sourceType === "waitForResponse" || sourceType === "askQuestion") &&
    sourceHandle &&
    !["out", "timeout"].includes(sourceHandle)
  )
    return false;
  if (
    (sourceType === "buttonMessage" ||
      sourceType === "interactive" ||
      sourceType === "listMessage") &&
    sourceHandle &&
    sourceHandle !== "out" &&
    !sourceHandle.startsWith("btn_") &&
    !sourceHandle.startsWith("list_") &&
    !sourceHandle.startsWith("card_") &&
    !sourceHandle.startsWith("row_") &&
    // ← allow real API IDs: btn_1778387752823_edeeki, row_1781057781559_z6zdty
    !/^btn_\d+_/.test(sourceHandle) &&
    !/^row_\d+_/.test(sourceHandle)
  )
    return false;
  if (sourceType === "template" && sourceHandle && sourceHandle !== "out") {
    return sourceHandle.startsWith("qr_");
  }
  return true;
}

function branchToStyle(branch?: string, sourceHandle?: string) {
  const dashed = { strokeDasharray: "5 5" as const };
  if (sourceHandle === "timeout")
    return { stroke: "var(--color-warning)", strokeWidth: 2, ...dashed };
  if (branch === "true")
    return { stroke: "var(--color-success)", strokeWidth: 2, ...dashed };
  if (branch === "false")
    return { stroke: "var(--color-primary)", strokeWidth: 2, ...dashed };

  // Normal connections are intentionally solid. Dashed lines are reserved for
  // explicit branches/timeouts so large flows stay easy to follow.
  return { stroke: "var(--color-text-muted)", strokeWidth: 2.2 };
}

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  trigger: <ThunderboltOutlined />,
  message: <MessageOutlined />,
  template: <FileTextOutlined />,
  interactive: <AppstoreOutlined />,
  media: <PictureOutlined />,
  waitForResponse: <ClockCircleOutlined />,
  delay: <ClockCircleOutlined />,
  ai: <MessageOutlined />,
  condition: <ThunderboltOutlined />,
  action: <ThunderboltOutlined />,
};

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: "Trigger",
  message: "Message",
  template: "Template",
  interactive: "Interactive",
  media: "Media",
  waitForResponse: "Wait for Response",
  delay: "Delay",
  ai: "AI Response",
  condition: "Condition",
  action: "HTTP Request",
};

const nodeCategories = [
  {
    title: "Menu",
    count: 0,
    nodes: [],
  },
  {
    title: "Triggers",
    count: 1,
    nodes: [
      {
        type: "trigger",
        label: "On Message",
        icon: <InboxOutlined style={{ fontSize: 18 }} />,
      },
    ],
  },

  {
    title: "Actions",
    count: 14,
    nodes: [
      {
        type: "message",
        label: "Send Text Message",
        icon: <MessageOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "interactive",
        label: "Send Button Message",
        icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "listMessage",
        label: "Send List Message",
        icon: <FileTextOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "sendMedia",
        label: "Send Media Message",
        icon: <PictureOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "askQuestion",
        label: "Ask Question",
        icon: <MessageOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "ai",
        label: "AI Agent",
        icon: <ThunderboltOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "updateTag",
        label: "Update Tag",
        icon: <InboxOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "updateColumn",
        label: "Update Columns",
        icon: <InboxOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "stopChatbot",
        label: "Stop Chatbot",
        icon: <CloseOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "delay",
        label: "Delay",
        icon: <ClockCircleOutlined style={{ fontSize: 18 }} />,
      },

      /*
      {
        type: "template",
        label: "Send Template Message",
        icon: <FileTextOutlined style={{ fontSize: 18 }} />,
      },
      */

      {
        type: "ctaMessage",
        label: "Send CTA Message",
        icon: <ThunderboltOutlined style={{ fontSize: 18 }} />,
      },

      /*
      {
        type: "productMessage",
        label: "Send Product Message",
        icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
      },
      */

      {
        type: "askLocation",
        label: "Ask Location",
        icon: <InboxOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "action",
        label: "HTTP",
        icon: <ThunderboltOutlined style={{ fontSize: 18 }} />,
      },

      {
        type: "condition",
        label: "Condition",
        icon: <ThunderboltOutlined style={{ fontSize: 18 }} />,
      },
    ],
  },
];

/**
 * Create the default trigger used when a brand-new chatbot has no saved nodes.
 * Existing saved nodes are never changed.
 */
function createDefaultTriggerNode() {
  const id = uuid();

  return {
    id,
    type: "trigger",
    data: {
      _key: "@whatsapp/on-message",
      label: "On Message",
      triggerType: "any",
      messageType: "text",
      keywords: [],
      matchingLogic: "contains",
      fallback: false,
      fuzzy: false,
      sensitivity: 80,
      phoneNumberIds: [],
      phoneNumberValid: false,
      variable: "",
      dataOut: {
        variable: "",
      },
    },
    position: {
      x: 200,
      y: 200,
    },
  };
}

/** Nodes/edges in the API shape the chatbot flow endpoint expects (same as Save). */
export function buildApiGraph(nodes: any[], edges: any[]) {
  // Repair legacy handle IDs and remove duplicate persisted edges before saving.
  const normalizedEdges = transformEdgesFromApi(edges, nodes);

  const apiNodes = nodes.map((node) => {
    const mapped = transformNodeToApi(node);

    // Final guard: always send @whatsapp/delay as attributes.delay.
    if (mapped.data?.key === "@whatsapp/delay") {
      const uiDelay = Number(
        node.data?.delay ??
          node.data?.attributes?.delay ??
          delayToMilliseconds(
            node.data?.value ?? 1,
            node.data?.unit || "minutes",
          ),
      );

      mapped.data.attributes = {
        delay:
          Number.isFinite(uiDelay) && uiDelay >= 0
            ? Math.round(uiDelay)
            : 60000,
      };
    }

    return mapped;
  });

  return { nodes: apiNodes, edges: normalizedEdges.map(transformEdgeToApi), normalizedEdges };
}

/** A node's content without its position, so layout changes don't count as edits. */
const nodeSignature = ({ position, positionAbsolute, width, height, selected, dragging, ...rest }: any) =>
  JSON.stringify(rest);

export type BuilderTemplateHandle = {
  /** Current flow in API shape (what the user sees, including layout). */
  getGraph: () => { nodes: any[]; edges: any[] };
  /**
   * Nodes whose content differs from the original template: converted to buttons/lists here,
   * edited by the user, or newly added. Other nodes are unchanged apart from their position.
   */
  getChangedNodeIds: () => string[];
};

/** Rough card heights for nodes React Flow hasn't measured yet (builder cards are tall). */
function estimateNodeHeight(node: any): number {
  const data = node?.data ?? {};
  switch (node?.type) {
    case "trigger":
      return 420;
    case "interactive":
    case "buttonMessage":
      return 520 + (Array.isArray(data.buttons) ? data.buttons.length : 1) * 48;
    case "listMessage":
      return 520 + (data.sections ?? []).reduce((n: number, sec: any) => n + (sec.rows?.length ?? 1), 0) * 56;
    case "message":
      return 420;
    default:
      return 320;
  }
}

/**
 * Left-to-right layout: one column per step depth, a branch's chain of steps kept on one row and
 * menus centred on their branches. `measure` returns a node's measured size when available.
 */
function computeLeftToRightLayout(
  nodes: any[],
  edges: any[],
  measure: (id: string) => { width?: number | null; height?: number | null } | undefined,
): Map<string, { x: number; y: number }> {
  // Fallback width for unmeasured nodes; heights fall back to estimateNodeHeight.
  const NODE_WIDTH = 300;
  const H_GAP = 180;
  const V_GAP = 80;
  const MAX_SWEEPS = 8;

  const nodeIds = nodes.map((node) => node.id);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  nodeIds.forEach((id) => {
    incoming.set(id, []);
    outgoing.set(id, []);
  });

  const edgeOrder = new Map<string, number>();
  edges.forEach((edge, index) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    incoming.get(edge.target)!.push(edge.source);
    outgoing.get(edge.source)!.push(edge.target);
    if (!edgeOrder.has(edge.target)) edgeOrder.set(edge.target, index);
  });

  // DFS depth calculation with cycle protection. Chatbot flows should be DAGs,
  // but protecting cycles keeps auto-layout safe for imported/old data.
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();
  const getDepth = (id: string): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const parents = incoming.get(id) || [];
    const depth = parents.length
      ? Math.max(...parents.map((parentId) => getDepth(parentId) + 1))
      : 0;
    visiting.delete(id);
    depthMemo.set(id, depth);
    return depth;
  };

  nodeIds.forEach(getDepth);

  const levels = new Map<number, string[]>();
  nodeIds.forEach((id) => {
    const level = depthMemo.get(id) || 0;
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level)!.push(id);
  });

  // Start from the current visual order. This keeps unrelated nodes stable.
  levels.forEach((ids) => {
    ids.sort((a, b) => {
      const ay = Number(nodeById.get(a)?.position?.y ?? 0);
      const by = Number(nodeById.get(b)?.position?.y ?? 0);
      return ay - by;
    });
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const orderOf = () => {
    const result = new Map<string, number>();
    levels.forEach((ids) => ids.forEach((id, index) => result.set(id, index)));
    return result;
  };

  const barycenter = (id: string, related: Map<string, string[]>, order: Map<string, number>) => {
    const neighbours = related.get(id) || [];
    const positions = neighbours
      .map((neighbour) => order.get(neighbour))
      .filter((value): value is number => value !== undefined);
    if (!positions.length) return Number.POSITIVE_INFINITY;
    return positions.reduce((sum, value) => sum + value, 0) / positions.length;
  };

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep += 1) {
    // Forward sweep: children follow the vertical order of their parents.
    for (let i = 1; i < sortedLevels.length; i += 1) {
      const level = sortedLevels[i];
      const order = orderOf();
      levels.get(level)!.sort((a, b) => {
        const av = barycenter(a, incoming, order);
        const bv = barycenter(b, incoming, order);
        if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return av - bv || (edgeOrder.get(a) ?? 0) - (edgeOrder.get(b) ?? 0);
      });
    }

    // Backward sweep: parents follow the vertical order of their children.
    for (let i = sortedLevels.length - 2; i >= 0; i -= 1) {
      const level = sortedLevels[i];
      const order = orderOf();
      levels.get(level)!.sort((a, b) => {
        const av = barycenter(a, outgoing, order);
        const bv = barycenter(b, outgoing, order);
        if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return av - bv || (edgeOrder.get(a) ?? 0) - (edgeOrder.get(b) ?? 0);
      });
    }
  }

  const sizeOf = (id: string) => {
    const node = (measure(id) ?? nodeById.get(id)) as any;
    return {
      w: Number(node?.width) || NODE_WIDTH,
      h: Number(node?.height) || estimateNodeHeight(nodeById.get(id)),
    };
  };

  // Columns: each level starts after the widest card of the previous one.
  const columnX = new Map<number, number>();
  let nextX = 0;
  sortedLevels.forEach((level) => {
    columnX.set(level, nextX);
    const widest = Math.max(NODE_WIDTH, ...(levels.get(level) || []).map((id) => sizeOf(id).w));
    nextX += widest + H_GAP;
  });

  // Rows: stack a column in its sorted order, starting each card at its preferred top when there
  // is room and pushing it down otherwise. This keeps a branch's chain of steps on one row.
  const top = new Map<string, number>();
  const placeColumn = (ids: string[], preferred: (id: string) => number | undefined) => {
    let cursor = Number.NEGATIVE_INFINITY;
    ids.forEach((id) => {
      const want = preferred(id);
      const y = Math.max(want ?? cursor, cursor);
      top.set(id, Number.isFinite(y) ? y : 0);
      cursor = top.get(id)! + sizeOf(id).h + V_GAP;
    });
  };
  const centre = (id: string) => (top.get(id) ?? 0) + sizeOf(id).h / 2;
  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

  // Forward: children line up with their parents.
  sortedLevels.forEach((level, index) => {
    const ids = levels.get(level) || [];
    if (index === 0) {
      placeColumn(ids, () => undefined);
      return;
    }
    placeColumn(ids, (id) => {
      const parents = (incoming.get(id) || []).filter((p) => top.has(p));
      return parents.length ? average(parents.map(centre)) - sizeOf(id).h / 2 : undefined;
    });
  });

  // Backward: a parent with several children sits in the middle of them (e.g. a button menu).
  for (let i = sortedLevels.length - 2; i >= 0; i -= 1) {
    const ids = levels.get(sortedLevels[i]) || [];
    placeColumn(ids, (id) => {
      const children = (outgoing.get(id) || []).filter((c) => top.has(c));
      if (!children.length) return top.get(id);
      const first = Math.min(...children.map((c) => top.get(c)!));
      const last = Math.max(...children.map((c) => top.get(c)! + sizeOf(c).h));
      return (first + last) / 2 - sizeOf(id).h / 2;
    });
  }

  const positions = new Map<string, { x: number; y: number }>();
  sortedLevels.forEach((level) => {
    (levels.get(level) || []).forEach((id) => {
      positions.set(id, { x: columnX.get(level) ?? 0, y: top.get(id) ?? 0 });
    });
  });

  return positions;
}

/**
 * Template flows often branch a plain message by edge label and store top-down positions.
 * Turn those branches into real reply buttons (or a list for more than WhatsApp's 3 buttons),
 * then lay the flow out left to right so it reads like a chatbot conversation.
 */
function prepareTemplateFlow(nodes: any[], edges: any[]) {
  const edgeLabel = (e: any) => String(e?.label ?? e?.data?.label ?? "").trim();
  const handleFor = new Map<string, string>();

  const converted = nodes.map((node) => {
    if (node.type !== "message") return node;
    const branches = edges.filter(
      (e) => e.source === node.id && edgeLabel(e) && (!e.sourceHandle || e.sourceHandle === "out"),
    );
    if (branches.length < 2) return node;

    if (branches.length <= 3) {
      const buttonIds = branches.map((e, i) => ({
        id: `btn_${node.id}_${i}`,
        label: edgeLabel(e).slice(0, 20),
        type: "quick_reply",
      }));
      branches.forEach((e, i) => handleFor.set(e.id, buttonIds[i].id));
      return {
        ...node,
        type: "interactive",
        data: { ...node.data, buttons: buttonIds.map((b) => b.label), _buttonIds: buttonIds },
      };
    }

    const rows = branches.map((e, i) => ({
      id: `row_${node.id}_${i}`,
      title: edgeLabel(e).slice(0, 24),
      description: "",
    }));
    branches.forEach((e, i) => handleFor.set(e.id, rows[i].id));
    return {
      ...node,
      type: "listMessage",
      data: {
        ...node.data,
        listButtonText: node.data?.listButtonText || "View options",
        sections: [{ id: `section_${node.id}`, title: "Options", rows }],
      },
    };
  });

  const rewired = edges.map((e) => {
    const handle = handleFor.get(e.id);
    if (!handle) return e;
    return {
      ...e,
      sourceHandle: handle,
      // The button/row already shows the choice, so drop the duplicate edge label.
      label: undefined,
      data: {
        ...(e.data || {}),
        sourceHandle: handle,
        ...(handle.startsWith("btn_") ? { button_id: handle } : { row_id: handle }),
      },
    };
  });

  const positions = computeLeftToRightLayout(converted, rewired, () => undefined);
  return {
    nodes: converted.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })),
    edges: rewired,
    convertedIds: converted.filter((node, i) => node !== nodes[i]).map((node) => String(node.id)),
  };
}

/**
 * `templateMode`: used inside the template preview. Hides the bot name, phone numbers, publish and
 * save controls, fits its container instead of the viewport, and exposes the edited flow via `templateRef`.
 */
function BuilderCanvasInner({ bot, apiBase = "/api/user/chatbots", templateMode = false, templateRef }: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { token } = theme.useToken();

  // New chatbot: start with the default "On Message" trigger.
  // Existing chatbot nodes/edges are loaded exactly as before.
  const hasSavedNodes = Array.isArray(bot?.nodes) && bot.nodes.length > 0;
  const { nodes: initialNodes, edges: initialEdges, convertedIds: templateConvertedIds = [] } = useMemo((): {
    nodes: any[];
    edges: any[];
    convertedIds?: string[];
  } => {
    const baseNodes = hasSavedNodes
      ? bot.nodes.map(transformNodeFromApi)
      : [createDefaultTriggerNode()];
    const baseEdges = hasSavedNodes
      ? transformEdgesFromApi(bot.edges ?? [], baseNodes)
      : [];
    return templateMode && hasSavedNodes
      ? prepareTemplateFlow(baseNodes, baseEdges)
      : { nodes: baseNodes, edges: baseEdges };
    // Only the first value seeds the builder state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Editable chatbot name shown in the builder sidebar.
  const [botName, setBotName] = useState<string>(() =>
    String(bot?.name ?? "").trim(),
  );

  useEffect(() => {
    setBotName(String(bot?.name ?? "").trim());
  }, [bot?.id, bot?.name]);
  const [openSections, setOpenSections] = useState({
    Triggers: true,
    Actions: true,
    Settings: false,
  });
  const [searchTerm, setSearchTerm] = useState("");

  // WABA phone number selector (bot-level, multi-select)
  const [wabaPhoneNumbers, setWabaPhoneNumbers] = useState<
    ChatbotPhoneNumber[]
  >([]);
  const [loadingWabaPhones, setLoadingWabaPhones] = useState(false);
  const [wabaPhoneError, setWabaPhoneError] = useState("");
  const getSavedPhoneNumberIds = (
  bot: any,
  nodes: any[] = [],
): string[] => {
  // First: use chatbot-level phoneNumberIds
  const botIds = Array.isArray(bot?.phoneNumberIds)
    ? bot.phoneNumberIds
    : bot?.phoneNumberId
      ? [bot.phoneNumberId]
      : [];

  if (botIds.length > 0) {
    return Array.from(
      new Set(
        botIds
          .map((id: string | number) => String(id).trim())
          .filter(Boolean),
      ),
    );
  }

  // Fallback: get phone numbers from Trigger Node
  const triggerNode = nodes.find(
    (node: any) => node.type === "trigger",
  );

  const triggerIds = Array.isArray(
    triggerNode?.data?.phoneNumberIds,
  )
    ? triggerNode.data.phoneNumberIds
    : [];

  return Array.from(
    new Set(
      triggerIds
        .map((id: string | number) => String(id).trim())
        .filter(Boolean),
    ),
  );
};

const [selectedPhoneNumberIds, setSelectedPhoneNumberIds] =
  useState<string[]>(() =>
    getSavedPhoneNumberIds(bot, initialNodes),
  );

useEffect(() => {
  if (!bot?.id) return;

  const freshNodes = Array.isArray(bot.nodes)
    ? bot.nodes.map(transformNodeFromApi)
    : [];

  const ids = getSavedPhoneNumberIds(
    bot,
    freshNodes,
  );

  setSelectedPhoneNumberIds(ids);
}, [
  bot?.id,
  bot?.phoneNumberIds,
  bot?.phoneNumberId,
  bot?.nodes,
]);
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const [isPublished, setIsPublished] = useState<boolean>(bot?.published ?? false);
const [publishing, setPublishing] = useState(false);

const fetchWabaPhoneNumbers = useCallback(async () => {
  setLoadingWabaPhones(true);
  setWabaPhoneError("");

  try {
    const response = await soft7AxiosInstance.get(
      "/admin/waba/phone-numbers",
    );

    const normalized =
      normalizePhoneNumbers(response.data);

    console.log(
      "Normalized WABA phones:",
      normalized,
    );

    setWabaPhoneNumbers(normalized);

    // Keep already restored selected IDs.
    setSelectedPhoneNumberIds((prev) => {
      const availableIds = new Set(
        normalized.map((phone) =>
          String(phone.id).trim(),
        ),
      );

      const validIds = prev.filter((id) =>
        availableIds.has(String(id).trim()),
      );

      return validIds;
    });
  } catch (error) {
    console.error(
      "Failed to fetch WABA phone numbers:",
      error,
    );

    setWabaPhoneNumbers([]);
    setWabaPhoneError(
      "Could not load WhatsApp phone numbers.",
    );
  } finally {
    setLoadingWabaPhones(false);
  }
}, []);

  useEffect(() => {
    fetchWabaPhoneNumbers();
  }, [fetchWabaPhoneNumbers]);

  const [history, setHistory] = useState<any[]>(() => [
    { nodes: initialNodes, edges: initialEdges },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  useEffect(() => {
  if (!bot?.id || !Array.isArray(bot.nodes)) return;

  // Keep the default trigger for a newly created/empty chatbot.
  // If saved nodes exist, preserve the existing load behavior unchanged.
  const hasSavedNodes = bot.nodes.length > 0;
  const freshNodes = hasSavedNodes
    ? bot.nodes.map(transformNodeFromApi)
    : [createDefaultTriggerNode()];
  const freshEdges = hasSavedNodes
    ? transformEdgesFromApi(bot.edges ?? [], freshNodes)
    : [];

  setNodes(freshNodes);
  setEdges(freshEdges);
  setHistory([{ nodes: freshNodes, edges: freshEdges }]);
  setHistoryIndex(0);
}, [bot?.id, bot?.nodes, bot?.edges]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [galleryPickerForItem, setGalleryPickerForItem] = useState<
    number | "header" | string | null
  >(null);
  const [galleryList, setGalleryList] = useState<
    Array<{
      id: number;
      name: string;
      fileName: string;
      type: string;
      url: string;
    }>
  >([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [mediaUploadingIndex, setMediaUploadingIndex] = useState<number | null>(
    null,
  );
  const mediaFileInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {},
  );

  useEffect(() => {
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await soft7AxiosInstance.get(
          "/admin/templates?status=APPROVED",
        );
        const data = response.data;
        setTemplates(data.success && data.data ? data.data : []);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  // Sync templateId when loading flows with templateName+language but no templateId
  useEffect(() => {
    if (templates.length === 0) return;
    let changed = false;
    const newNodes = nodes.map((n) => {
      if (n.type !== "template") return n;
      const t = n.data?.templateId
        ? templates.find((x) => x.id === n.data.templateId)
        : n.data?.templateName && n.data?.language
          ? templates.find(
              (tpl) =>
                tpl.name === n.data.templateName &&
                tpl.language === (n.data.language || "en"),
            )
          : null;
      if (!t) return n;
      const updates: Record<string, any> = {};
      if (!n.data?.templateId) updates.templateId = t.id;
      const buttons = getTemplateButtons(t.components || []);
      if (
        buttons.length > 0 &&
        (!Array.isArray(n.data?.buttons) || n.data.buttons.length === 0)
      ) {
        updates.buttons = buttons;
      }
      if (Object.keys(updates).length === 0) return n;
      changed = true;
      return { ...n, data: { ...n.data, ...updates } };
    });
    if (changed) {
      setNodes(newNodes);
      queueMicrotask(() => {
        newNodes.forEach((n) => {
          if (n.type === "template" && n.data?.buttons?.length)
            updateNodeInternals(n.id);
        });
      });
    }
  }, [templates, nodes, updateNodeInternals]);

  const edgesWithStyle = useMemo(() => {
    // IMPORTANT: fan-out is calculated per SOURCE HANDLE, not just per node.
    // This keeps buttons/rows/condition outputs independent while also making
    // multiple connections from a single `out` handle visually separate.
    const sourceHandleCounts = new Map<string, number>();
    edges.forEach((edge) => {
      const handle = String(edge.sourceHandle || "out");
      const key = `${edge.source}::${handle}`;
      sourceHandleCounts.set(key, (sourceHandleCounts.get(key) || 0) + 1);
    });

    const sourceHandleOffsets = new Map<string, number>();
    return edges.map((e) => {
      const handle = String(e.sourceHandle || "out");
      const groupKey = `${e.source}::${handle}`;
      const count = sourceHandleCounts.get(groupKey) || 1;
      const index = sourceHandleOffsets.get(groupKey) || 0;
      sourceHandleOffsets.set(groupKey, index + 1);

      // For 2 edges: -11 / +11 px. For 3: -22 / 0 / +22 px, etc.
      // A larger separation prevents the first few pixels from looking like
      // a single shared connection.
      const routingOffset = (index - (count - 1) / 2) * 22;
      const edgeStyle = (e.style || {}) as Record<string, any>;

      return {
        ...e,
        type: "deleteable",
        data: {
          ...(e.data || {}),
          routingOffset,
        },
        style: {
          ...edgeStyle,
          stroke: edgeStyle.stroke ?? "var(--color-text-muted)",
          strokeWidth: edgeStyle.strokeWidth ?? 2.2,
          ...(edgeStyle.strokeDasharray
            ? { strokeDasharray: edgeStyle.strokeDasharray }
            : {}),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeStyle.stroke ?? "var(--color-text-muted)",
        },
      };
    });
  }, [edges]);
  const saveToHistory = useCallback(
    (newNodes: any[], newEdges: any[]) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push({ nodes: newNodes, edges: newEdges });
        if (next.length > 50) next.shift();
        return next;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex],
  );

  const getDefaultData = (type: string) => {
    switch (type) {
      case "message":
        return {
          text: "",
          previewUrl: false,
          message: {
            type: "text",
            text: { body: "", preview_url: false },
          },
        };
      case "listMessage":
        return {
          interactiveType: "list",
          headerType: "none",
          text: "",
          listButtonText: "View Options",
          footer: "",
          sections: [
            {
              id: "section_0",
              title: "",
              rows: [{ id: "row_0", title: "", description: "" }],
            },
          ],
        };
      case "sendMedia":
        return {
          mediaType: "image",
          mediaUrl: "",
          caption: "",
        };
        
      case "askQuestion":
        return {
          message: "",
          responseFormat: "any",
          timeoutValue: 60,
          timeoutUnit: "seconds",
          timeoutMessage: "",
          continueOnTimeout: false,
          variable: "",
          dataOut: { variable: "" },
        };
        
      case "delay":
        return {
          delayType: "delay_for",
          value: 1,
          unit: "minutes",
          delay: 60000,
        };
      case "ctaMessage":
        return {
          interactiveType: "cta_url",
          headerType: "none",
          headerText: "",
          headerUrl: "",
          text: "",
          displayText: "",
          ctaUrl: "",
          footer: "",
        };
      case "productMessage":
        return {
          interactiveType: "product",
          catalogId: "",
          retailerId: "",
          text: "",
          footer: "",
        };
      case "interactive":
        return {
          interactiveType: "buttons",
          headerType: "text",
          headerText: "",
          headerMediaUrl: "",
          header: "",
          headerMedia: null,
          text: "Choose an option:",
          footer: "",
          buttons: [""],
          listItems: [{ id: "row_1", title: "Item 1", description: "" }],
          listButtonText: "View options",
          listSectionTitle: "Options",
          ctaDisplayText: "Open link",
          ctaUrl: "https://example.com",
          carouselHeaderType: "image",
          carouselButtonType: "cta_url",
          carouselQuickReplies: ["Learn more", "Add to favorites"],
          carouselCards: [
            {
              id: "card_0",
              title: "Card 1",
              bodyText: "First card description",
              imageUrl: "https://example.com/image1.jpg",
              buttonText: "View",
              url: "https://example.com/1",
            },
            {
              id: "card_1",
              title: "Card 2",
              bodyText: "Second card description",
              imageUrl: "https://example.com/image2.jpg",
              buttonText: "View",
              url: "https://example.com/2",
            },
          ],
        };
      case "buttonMessage":
        return { text: "Choose:", buttons: [""] };
      case "media":
        return { mediaType: "image", mediaItems: [{ url: "", caption: "" }] };
      case "image":
        return { mediaType: "image", mediaItems: [{ url: "", caption: "" }] };
      case "waitForResponse":
        return { timeoutMinutes: 30, optionalMessage: "" };
      case "ai":
        return {
          stopKeywords: ["/stop"],
          assistant: "",
          timeoutValue: 5,
          timeoutUnit: "minutes",
          welcomeMessage: "",
          timeoutMessage: "",
        };

      case "condition":
        return {
          operator: "and",
          conditions: [
            {
              id: "cond_0",
              field: "",
              comparator: "equals",
              value: "",
              threshold: 0.8,
            },
          ],
          attributes: {
            operator: "and",
            conditions: [
              { field: "", value: "", threshold: 0.8, comparator: "equals" },
            ],
          },
        };
      case "askQuestion":
        return {
          attributes: {
            message: {
              type: "text",
              text: { body: "", preview_url: false },
            },
            format: {
              type: "any",
            },
            timeout: {
              unit: "seconds",
              value: 60,
              continueOnTimeout: false,
            },
            variable: "",
          },
        };
      case "updateColumn":
        return {
          columnUpdates: [],
        };

      case "updateTag":
        return {
          tags: [],
        };
      case "fetchContact":
        return {};

      case "stopChatbot":
        return {};
      case "trigger":
        return {
          triggerType: "any",
          keywords: [],
          matchingLogic: "contains",
          fallback: false,
        };
      default:
        return {};
    }
  };
  const addNode = (type: string, position?: any) => {
    // 🚫 Only one "On Message" trigger allowed per flow
    if (type === "trigger" && nodes.some((n) => n.type === "trigger")) {
      toast.error("Only one 'On Message' trigger is allowed per chatbot flow.");
      return;
    }

    const id = uuid();
    const defaultData = getDefaultData(type);

    // Give every Send Button Message button a persistent React Flow handle ID.
    const nodeData = {
      ...defaultData,
      ...(type === "interactive"
        ? {
            _buttonIds: (Array.isArray(defaultData?.buttons)
              ? defaultData.buttons
              : []
            ).map((label: string, index: number) => ({
              id: `btn_${id}_${index}`,
              label: String(label ?? ""),
              type: "quick_reply",
            })),
          }
        : {}),
      variable: defaultData?.variable ?? "",
      dataOut: {
        ...(defaultData?.dataOut || {}),
        variable: defaultData?.variable ?? "",
      },
    };

    const newNodes = [
      ...nodes,
      {
        id,
        type,
        data: nodeData,
        position: position ?? {
          x: 200 + Math.random() * 120,
          y: 200 + Math.random() * 120,
        },
      },
    ];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  };

  const deleteNode = useCallback(
    (id: string) => {
      const newNodes = nodes.filter((n) => n.id !== id);
      const newEdges = edges.filter((e) => e.source !== id && e.target !== id);
      setNodes(newNodes);
      setEdges(newEdges);
      if (selectedNodeId === id) setSelectedNodeId(null);
      saveToHistory(newNodes, newEdges);
    },
    [nodes, edges, selectedNodeId],
  );

  const wrapNode = useCallback(
    (Component: any) => (props: NodeProps) => {
      return (
        <div
          className={`flow-node-wrapper-antd ${props.selected ? "selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeId(props.id);
          }}
        >
          <Component {...props} />
        </div>
      );
    },
    [],
  );

  const nodeTypesWithDelete = useMemo(() => {
    const mapped: any = {};
    Object.keys(nodeTypes).forEach((k) => {
      mapped[k] = wrapNode((nodeTypes as any)[k]);
    });
    return mapped;
  }, [wrapNode]);

  const onConnect = useCallback(
    (conn: Connection) => {
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!canConnect(src?.type, tgt?.type, conn.sourceHandle ?? undefined))
        return;
      let data: any = {
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle || "in",
      };
      let label: string | undefined;
      if (src?.type === "buttonMessage")
        label =
          src.data.buttons?.[Number(conn.sourceHandle?.replace("btn_", ""))];
      if (src?.type === "interactive") {
        const carouselMatch = conn.sourceHandle?.match(
          /^card_(\d+)_btn_(\d+)$/,
        );
        if (carouselMatch) {
          const cardIdx = Number(carouselMatch[1]);
          const btnIdx = Number(carouselMatch[2]);
          const card = src.data.carouselCards?.[cardIdx];
          const cardTitle = (card?.title || `Card ${cardIdx + 1}`).toString();
          const btnTitle = src.data.carouselQuickReplies?.[btnIdx] ?? "";
          label = `${cardTitle} – ${btnTitle}`;
        } else if (conn.sourceHandle?.startsWith("btn_")) {
          // Try to find label from _buttonIds (real API IDs like btn_17783_xxx)
          const btnById = src.data._buttonIds?.find(
            (b: any) => b.id === conn.sourceHandle,
          );
          if (btnById) {
            label = btnById.label;
          } else {
            // Fallback: numeric index based (btn_0, btn_1)
            label =
              src.data.interactiveType === "carousel" &&
              src.data.carouselButtonType === "quick_reply"
                ? src.data.carouselQuickReplies?.[
                    Number(conn.sourceHandle.replace("btn_", ""))
                  ]
                : src.data.buttons?.[
                    Number(conn.sourceHandle.replace("btn_", ""))
                  ];
          }
        } else if (conn.sourceHandle?.startsWith("list_")) {
          const item =
            src.data.listItems?.[
              Number(conn.sourceHandle.replace("list_", ""))
            ];
          label = item?.title || item?.id;
        }
      }
      if (src?.type === "condition") {
        const h = conn.sourceHandle;
        if (h === "true" || h === "false") {
          data.branch = h;
          label = h === "true" ? "True" : "False";
        }
      }
      if (
        src?.type === "waitForResponse" &&
        (conn.sourceHandle === "out" || conn.sourceHandle === "timeout")
      ) {
        data.sourceHandle = conn.sourceHandle;
        label =
          conn.sourceHandle === "timeout" ? "On timeout" : "When user replies";
      }
      if (src?.type === "template" && conn.sourceHandle?.startsWith("qr_")) {
        const btn = src.data.buttons?.find(
          (b: any) => b.id === conn.sourceHandle,
        );
        label = btn?.label;
      }
      // Label for listMessage row handles (row_xxx IDs)
      if (
        src?.type === "listMessage" &&
        conn.sourceHandle?.startsWith("row_")
      ) {
        const allRows = (src.data.sections || []).flatMap(
          (sec: any) => sec.rows || [],
        );
        const row = allRows.find((r: any) => r.id === conn.sourceHandle);
        if (row) label = row.title;
      }
      const edge = {
        id: uuid(),
        source: conn.source!,
        target: conn.target!,
        sourceHandle: conn.sourceHandle || null,
        targetHandle: conn.targetHandle || "in",
        label,
        data,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: branchToStyle(data.branch, data.sourceHandle),
      };
      setEdges(addEdge(edge, edges));
      saveToHistory(nodes, addEdge(edge, edges));
    },
    [nodes, edges],
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: any, newConnection: Connection) => {
      const src = nodes.find((n) => n.id === newConnection.source);
      const tgt = nodes.find((n) => n.id === newConnection.target);
      if (
        !canConnect(
          src?.type,
          tgt?.type,
          newConnection.sourceHandle ?? undefined,
        )
      )
        return;
      let data: any = {
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle || "in",
      };
      let label: string | undefined;
      if (src?.type === "buttonMessage")
        label =
          src.data.buttons?.[
            Number(newConnection.sourceHandle?.replace("btn_", ""))
          ];
      if (src?.type === "interactive") {
        const carouselMatch = newConnection.sourceHandle?.match(
          /^card_(\d+)_btn_(\d+)$/,
        );
        if (carouselMatch) {
          const cardIdx = Number(carouselMatch[1]);
          const btnIdx = Number(carouselMatch[2]);
          const card = src.data.carouselCards?.[cardIdx];
          const cardTitle = (card?.title || `Card ${cardIdx + 1}`).toString();
          const btnTitle = src.data.carouselQuickReplies?.[btnIdx] ?? "";
          label = `${cardTitle} – ${btnTitle}`;
        } else if (newConnection.sourceHandle?.startsWith("btn_")) {
          const btnById = src.data._buttonIds?.find(
            (b: any) => b.id === newConnection.sourceHandle,
          );
          if (btnById) {
            label = btnById.label;
          } else {
            label =
              src.data.interactiveType === "carousel" &&
              src.data.carouselButtonType === "quick_reply"
                ? src.data.carouselQuickReplies?.[
                    Number(newConnection.sourceHandle.replace("btn_", ""))
                  ]
                : src.data.buttons?.[
                    Number(newConnection.sourceHandle.replace("btn_", ""))
                  ];
          }
        } else if (newConnection.sourceHandle?.startsWith("list_")) {
          const item =
            src.data.listItems?.[
              Number(newConnection.sourceHandle.replace("list_", ""))
            ];
          label = item?.title || item?.id;
        }
      }
      if (src?.type === "condition") {
        const h = newConnection.sourceHandle;
        if (h === "true" || h === "false") {
          data.branch = h;
          label = h === "true" ? "True" : "False";
        }
      }
      if (
        src?.type === "waitForResponse" &&
        (newConnection.sourceHandle === "out" ||
          newConnection.sourceHandle === "timeout")
      ) {
        data.sourceHandle = newConnection.sourceHandle;
        label =
          newConnection.sourceHandle === "timeout"
            ? "On timeout"
            : "When user replies";
      }
      if (
        src?.type === "template" &&
        newConnection.sourceHandle?.startsWith("qr_")
      ) {
        const btn = src.data.buttons?.find(
          (b: any) => b.id === newConnection.sourceHandle,
        );
        label = btn?.label;
      }
      // Label for listMessage row handles (row_xxx IDs)
      if (
        src?.type === "listMessage" &&
        newConnection.sourceHandle?.startsWith("row_")
      ) {
        const allRows = (src.data.sections || []).flatMap(
          (sec: any) => sec.rows || [],
        );
        const row = allRows.find(
          (r: any) => r.id === newConnection.sourceHandle,
        );
        if (row) label = row.title;
      }
      const newEdges = edges.map((edge) =>
        edge.id === oldEdge.id
          ? {
              ...edge,
              source: newConnection.source!,
              target: newConnection.target!,
              sourceHandle: newConnection.sourceHandle || null,
              targetHandle: newConnection.targetHandle || "in",
              label,
              data,
              style: branchToStyle(data.branch, data.sourceHandle),
            }
          : edge,
      );
      setEdges(newEdges);
      saveToHistory(nodes, newEdges);
    },
    [nodes, edges],
  );

  const onDragStart = (e: any, type: string) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: any) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = useCallback(
    (e: any) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type) return;
      addNode(
        type,
        reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      );
    },
    [reactFlowInstance, nodes, edges],
  );

  const save = async () => {
    const triggerNodes = nodes.filter((node) => node.type === "trigger");
    if (triggerNodes.length === 0) {
      toast.error("Add an 'On Message' trigger before saving the chatbot.");
      return;
    }

    // Validate WhatsApp phone numbers selected in every trigger node
const invalidPhoneTrigger = triggerNodes.find((node) => {
  const selectedIds = Array.isArray(node.data?.phoneNumberIds)
    ? node.data.phoneNumberIds
    : node.data?.phoneNumberId
      ? [node.data.phoneNumberId]
      : [];

  // Trigger must have at least one phone number
  if (selectedIds.length === 0) {
    return true;
  }

  // If phone list has already been loaded, make sure selected IDs exist
  if (wabaPhoneNumbers.length > 0) {
    const availableIds = new Set(
      wabaPhoneNumbers.map((phone) => String(phone.id)),
    );

    const allValid = selectedIds.every((id: string) =>
      availableIds.has(String(id)),
    );

    if (!allValid) {
      return true;
    }
  }

  return false;
});

if (invalidPhoneTrigger) {
  setSelectedNodeId(invalidPhoneTrigger.id);

  toast.error(
    "Select a valid WhatsApp phone number in the trigger node.",
  );

  return;
}

    // Bot-level WABA phone number(s) validation
    if (selectedPhoneNumberIds.length === 0) {
      setPhoneValidationError("Select at least one WhatsApp phone number.");
      toast.error(
        "Select at least one WhatsApp phone number for this chatbot.",
      );
      return;
    }
    setPhoneValidationError("");

    try {
      const graph = buildApiGraph(nodes, edges);
      setEdges(graph.normalizedEdges);

      const trimmedBotName = botName.trim();

      if (!trimmedBotName) {
        toast.error("Chatbot name cannot be empty.");
        return;
      }

      const apiNodes = graph.nodes;

      const payload = {
        name: trimmedBotName,
        phoneNumberIds: selectedPhoneNumberIds,
        nodes: apiNodes,
        edges: graph.edges,
      };

      console.log(
        "Builder save payload - delay nodes:",
        apiNodes
          .filter((node: any) => node.data?.key === "@whatsapp/delay")
          .map((node: any) => ({
            id: node.id,
            key: node.data.key,
            attributes: node.data.attributes,
            dataOut: node.data.dataOut,
          })),
      );

      const response = await soft7AxiosInstance.post(
        `/admin/chatbot/flow/${bot.id}`,
        payload,
      );

      if (response.data.success) {
        bot.name = trimmedBotName;
        toast.success("Chatbot saved successfully");
      } else {
        toast.error(response.data.message || "Error saving chatbot");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Error saving chatbot");
    }
  };
   const handlePublishToggle = async (checked: boolean) => {
    setPublishing(true);
    const loadingToast = toast.loading(
      checked ? "Publishing chatbot..." : "Unpublishing chatbot...",
    );

    try {
      const endpoint = checked
        ? `/admin/chatbot/${bot.id}/publish`
        : `/admin/chatbot/${bot.id}/unpublish`;

      const response = await soft7AxiosInstance.put(endpoint);

      toast.dismiss(loadingToast);

      if (response.data.success) {
        setIsPublished(checked);
        toast.success(
          checked
            ? "Chatbot published successfully! Your bot is now live."
            : "Chatbot unpublished successfully. Your bot is now in draft mode.",
        );
      } else {
        toast.error(response.data.message || "Failed to update publish state");
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error(err);
      const errorMessage =
        err?.response?.data?.message || "Failed to update publish state";

      if (
        errorMessage.toLowerCase().includes("already") ||
        errorMessage.toLowerCase().includes("published") ||
        err?.response?.status === 409
      ) {
        toast.error(
          "Cannot publish: Another chatbot is already published. Please unpublish it first.",
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setPublishing(false);
    }
  };
  const sendMessage = async (text: string, to: string) => {
    await fetch(
      "https://hostapi.soft7.in//v1/admin/messages/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "console_access_token",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          phone_number_id: "762352490286897",
          to: to,
          type: "text",
          text: { body: text },
        }),
      },
    );
  };

  const exportFlow = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatbot-flow.json";
    a.click();
  };

  const importFlow = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        saveToHistory(data.nodes || [], data.edges || []);
        toast.success("Flow imported");
      } catch {
        toast.error("Invalid file");
      }
    };
    reader.readAsText(file);
  };

  /*
   * Connection-safe auto layout.
   *
   * The previous layout only grouped nodes by depth and then used their current
   * array order. When two branches merged, that could put the children in the
   * opposite order from their parents and the SVG paths crossed each other.
   *
   * This version:
   *   1. Calculates a stable left-to-right layer for every node.
   *   2. Orders each layer by the average position of its connected parents.
   *   3. Runs forward/backward barycentric sweeps to reduce crossings.
   *   4. Uses generous horizontal/vertical gaps so routed edges have room.
   */
  const runAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const positions = computeLeftToRightLayout(nodes, edges, (id) => reactFlowInstance.getNode(id));

    const layouted = nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) || node.position,
    }));

    setNodes(layouted);
    saveToHistory(layouted, edges);
    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, minZoom: 0.35, maxZoom: 1 });
    });
  }, [nodes, edges, reactFlowInstance, saveToHistory]);

  // Template preview: templates come with their own (often top-down) positions, which tangle the
  // builder's left-to-right connections. Re-lay them out once the cards have real sizes.
  const nodesInitialized = useNodesInitialized();
  const templateLaidOutRef = useRef(false);
  useEffect(() => {
    if (!templateMode || !nodesInitialized || templateLaidOutRef.current) return;
    templateLaidOutRef.current = true;
    runAutoLayout();
  }, [templateMode, nodesInitialized, runAutoLayout]);

  // Template preview: let the parent read the edited flow. The baseline is taken once the nodes
  // have finished their mount-time syncing, so opening the preview alone never counts as an edit.
  const latestGraphRef = useRef({ nodes, edges });
  latestGraphRef.current = { nodes, edges };
  const templateBaselineRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!templateMode) return;
    const timer = window.setTimeout(() => {
      const { nodes: n, edges: e } = latestGraphRef.current;
      const g = buildApiGraph(n, e);
      templateBaselineRef.current = new Map(g.nodes.map((node: any) => [String(node.id), nodeSignature(node)]));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [templateMode]);
  useEffect(() => {
    if (!templateMode || !templateRef) return;
    const getGraph = () => {
      const { nodes: n, edges: e } = latestGraphRef.current;
      const g = buildApiGraph(n, e);
      return { nodes: g.nodes, edges: g.edges };
    };
    templateRef.current = {
      getGraph,
      getChangedNodeIds: () => {
        const baseline = templateBaselineRef.current;
        const changed = new Set(templateConvertedIds);
        for (const node of getGraph().nodes) {
          const id = String(node.id);
          if (!baseline || baseline.get(id) !== nodeSignature(node)) changed.add(id);
        }
        return [...changed];
      },
    } satisfies BuilderTemplateHandle;
    return () => {
      templateRef.current = null;
    };
    // templateConvertedIds is fixed for the builder's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateMode, templateRef]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const updateNode = useCallback(
    (changes: any) => {
      if (!selectedNode) return;
      const updatedNode = {
        ...selectedNode,
        data: { ...selectedNode.data, ...changes },
      };
      const newNodes = nodes.map((n) =>
        n.id === selectedNode.id ? updatedNode : n,
      );
      let newEdges = edges;
      if (updatedNode.type === "interactive") {
        const itype = updatedNode.data?.interactiveType || "buttons";
        const carouselBtnType =
          updatedNode.data?.carouselButtonType || "cta_url";
        // When carousel is using CTA URL, remove any quick-reply edges (btn_* or card_*)
        if (itype === "carousel" && carouselBtnType === "cta_url") {
          newEdges = edges.filter((e) => {
            if (e.source !== updatedNode.id) return true;
            const h = String(e.sourceHandle || "");
            return !h.startsWith("btn_") && !h.startsWith("card_");
          });
        }
        // CTA URL button has no output handle; remove any edge from this node's "out" handle
        if (itype === "cta_url") {
          newEdges = edges.filter((e) => {
            if (e.source !== updatedNode.id) return true;
            const h = String(e.sourceHandle || "out");
            return h !== "out";
          });
        }
      }
      setNodes(newNodes);
      setEdges(newEdges);
      saveToHistory(newNodes, newEdges);

      // When Drawer changes affect handles (buttons/listItems), notify React Flow for immediate visual feedback
      const handleAffectingKeys = [
        "buttons",
        "listItems",
        "interactiveType",
        "carouselCards",
        "carouselButtonType",
        "carouselQuickReplies",
        "templateId",
        "templateName",
      ];
      const affectsHandles = Object.keys(changes).some((k) =>
        handleAffectingKeys.includes(k),
      );
      if (affectsHandles) {
        requestAnimationFrame(() => updateNodeInternals(selectedNode.id));
      }
    },
    [selectedNode, nodes, edges, saveToHistory, updateNodeInternals],
  );

  const themeConfig = {
    token: {
      colorBgLayout: "var(--color-background)",
      colorPrimary: "var(--color-primary)",
      colorPrimaryHover: "color-mix(in oklch, var(--color-primary) 88%, black)",
      colorPrimaryActive: "color-mix(in oklch, var(--color-primary) 82%, black)",
      colorText: "var(--color-text)",
      colorTextSecondary: "var(--color-text-muted)",
      colorBorder: "var(--color-border)",
      colorBgContainer: "var(--color-surface)",
      colorBgElevated: "var(--color-surface)",
      colorFillAlter: "var(--color-surface-muted)",
      colorTextPlaceholder: "var(--color-text-muted)",
      colorError: "var(--color-error)",
      colorWarning: "var(--color-warning)",
      colorSuccess: "var(--color-success)",
      fontFamily: "var(--font-sans)",
      borderRadius: 12,
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <div
        className="builder-outer-wrapper"
        style={{
          width: "100%",
          height: templateMode ? "100%" : "100vh",
          display: "flex",
          flexDirection: "row",
          background: "var(--color-background)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 264,
            borderRight: "1px solid var(--sidebar-border)",
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            height: templateMode ? "100%" : "100vh",
            overflow: "hidden", // ← prevent the whole aside from scrolling
          }}
        >
          {/* ── FIXED TOP SECTION ── */}
          <div style={{ flexShrink: 0 }}>
            {templateMode && (
              <div
                style={{
                  padding: "14px 16px 6px",
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                Drag components onto the canvas or click a node to edit it. Your changes are used
                when you create the chatbot.
              </div>
            )}

            {!templateMode && (<>
            {/* Bot Name Input */}
            <div
              style={{
                padding: "16px 14px 0",
                background: "var(--color-surface)",
              }}
            >
              <Input
                value={botName}
                placeholder="Enter bot name"
                maxLength={100}
                onChange={(e) => setBotName(e.target.value)}
                onPressEnter={() => void save()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text)",
                  borderColor: "var(--color-border)",
                  background: "var(--input-bg)",
                  width: "100%",
                }}
              />
            </div>

            {/* WABA Phone Number Selector */}
            <div
              style={{
                padding: "10px 14px 0",
                background: "var(--color-surface)",
              }}
            >
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--color-text-muted)",
                  display: "block",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                WhatsApp Numbers
              </label>
              <Select
                mode="multiple"
                allowClear
                placeholder={
                  loadingWabaPhones
                    ? "Loading phone numbers..."
                    : "Select phone number(s)"
                }
                loading={loadingWabaPhones}
                value={selectedPhoneNumberIds}
              onChange={(values: string[]) => {
  const unique = Array.from(
    new Set(
      values
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );

  setSelectedPhoneNumberIds(unique);

  if (unique.length > 0) {
    setPhoneValidationError("");
  }
}}
                style={{ width: "100%" }}
                status={phoneValidationError ? "error" : undefined}
                notFoundContent={
                  loadingWabaPhones
                    ? "Loading..."
                    : wabaPhoneError || "No phone numbers found"
                }
                options={wabaPhoneNumbers.map((phone) => ({
                  label: phone.verifiedName
                    ? `${phone.displayPhoneNumber} — ${phone.verifiedName}`
                    : phone.displayPhoneNumber,
                 value: String(phone.id),
                }))}
              />
              {phoneValidationError && (
                <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>
                  {phoneValidationError}
                </div>
              )}
              {wabaPhoneError && !loadingWabaPhones && (
                <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>
                  {wabaPhoneError}{" "}
                  <button
                    type="button"
                    onClick={fetchWabaPhoneNumbers}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Draft Toggle + Save Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px 14px",
                background: "var(--color-surface)",
              }}
            >
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <Switch
    size="small"
    checked={isPublished}
    loading={publishing}
    onChange={handlePublishToggle}
    style={{ background: isPublished ? "var(--color-primary)" : undefined }}
  />
  <span
    style={{
      fontSize: 12,
      color: isPublished ? "var(--color-primary)" : "var(--color-text-muted)",
      fontWeight: 500,
    }}
  >
    Publish
  </span>
</div>
              <Button
                type="primary"
                onClick={save}
                style={{
                  background: "var(--color-primary)",
                  borderColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                  borderRadius: 8,
                  fontWeight: 600,
                  height: 32,
                  padding: "0 16px",
                  fontSize: 13,
                }}
              >
                Save
              </Button>
            </div>
            </>)}

            {/* Search */}
            <div
              style={{
                padding: "8px 10px 12px",
                borderBottom: "1px solid var(--border-light)",
                background: "var(--color-surface)",
              }}
            >
              <Input
                placeholder="Search components..."
                prefix={
                  <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                    ⌕
                  </span>
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  borderRadius: 8,
                  fontSize: 13,
                  background: "var(--color-surface-muted)",
                  borderColor: "var(--color-border)",
                }}
              />
            </div>
          </div>

          {/* ── SCROLLABLE NODE CATEGORIES ── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingBottom: 16,
            }}
          >
            {nodeCategories.map((cat) => {
              const isOpen =
                openSections[cat.title as keyof typeof openSections];
              const filtered = cat.nodes.filter((node) =>
                node.label.toLowerCase().includes(searchTerm.toLowerCase()),
              );
              if (filtered.length === 0 && searchTerm) return null;

              return (
                <div key={cat.title} style={{ marginBottom: 4 }}>
                  {/* Category header */}
                  <div
                    onClick={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [cat.title]: !prev[cat.title as keyof typeof prev],
                      }))
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px 8px",
                      cursor: "pointer",
                      userSelect: "none" as const,
                      background: "var(--color-surface)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase" as const,
                        }}
                      >
                        {cat.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-placeholder)",
                        }}
                      >
                        {cat.count}
                      </span>
                    </div>
                    <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                      {isOpen ? <MinusOutlined /> : <PlusOutlined />}
                    </span>
                  </div>

                  {/* Node list */}
                  {isOpen && (
                    <div style={{ padding: "0 8px 8px" }}>
                      {filtered.map((node) => {
                        const isTriggerUsed =
                          node.type === "trigger" &&
                          nodes.some((n) => n.type === "trigger");

                        return (
                          <div
                            key={node.label}
                            draggable={!isTriggerUsed}
                            onDragStart={(e) => {
                              if (isTriggerUsed) {
                                e.preventDefault();
                                return;
                              }
                              onDragStart(e, node.type);
                            }}
                            onClick={() => {
                              if (isTriggerUsed) {
                                toast.error(
                                  "Only one 'On Message' trigger is allowed per chatbot flow.",
                                );
                              }
                            }}
                            className="modern-sidebar-node"
                            style={{
                              marginBottom: 2,
                              opacity: isTriggerUsed ? 0.45 : 1,
                              cursor: isTriggerUsed ? "not-allowed" : "grab",
                            }}
                            onMouseEnter={(e) => {
                              if (isTriggerUsed) return;
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = "var(--color-surface-muted)";
                              el.style.borderColor = "var(--color-primary)";
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.background = "var(--sidebar-item-bg)";
                              el.style.borderColor = "var(--color-border)";
                            }}
                          >
                            <>
                              <div className="modern-sidebar-node-icon">
                                {node.icon}
                              </div>
                              <span className="modern-sidebar-node-label">
                                {node.label}
                                {isTriggerUsed && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--color-text-muted)",
                                      marginLeft: 6,
                                    }}
                                  >
                                    (already added)
                                  </span>
                                )}
                              </span>
                            </>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Canvas - takes remaining space */}
        <div
          ref={wrapperRef}
          className="builder-canvas-antd"
          style={{ flex: 1, minHeight: 0, height: templateMode ? "100%" : "100vh" }}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edgesWithStyle}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypesWithDelete}
            edgeTypes={edgeTypes}
            edgesUpdatable
            edgesFocusable
            fitView
            fitViewOptions={{ padding: 0.4, minZoom: 0.4, maxZoom: 0.7 }}
            minZoom={0.2}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
            style={{ width: "100%", height: "100%" }}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{
              stroke: "var(--color-text-muted)",
              strokeWidth: 2.2,
            }}
            defaultEdgeOptions={{
              type: "deleteable",
              animated: false,
              style: {
                stroke: "var(--color-text-muted)",
                strokeWidth: 2.2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "var(--color-text-muted)",
              },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--color-border)"
              gap={24}
              size={1.2}
            />
            <Panel position="top-left" style={{ marginTop: 12, marginLeft: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 8,
                  background: "color-mix(in oklch, var(--color-surface) 92%, transparent)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--elevation-sm)",
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  pointerEvents: "none",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--color-text-muted)",
                    boxShadow: "0 0 0 2px var(--color-surface), 0 0 0 3px var(--color-border)",
                    flexShrink: 0,
                  }}
                />
                <span>Drag from a connection point to create a link.</span>
                <span>Hover a link to delete it.</span>
              </div>
            </Panel>
            <Panel position="bottom-left">
              <div className="builder-canvas-toolbar">
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => reactFlowInstance.zoomIn()}
                  title="Zoom In"
                />
                <Button
                  icon={<MinusCircleOutlined />}
                  onClick={() => reactFlowInstance.zoomOut()}
                  title="Zoom Out"
                />
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() => reactFlowInstance.fitView({ padding: 0.2 })}
                  title="Fit View"
                />
                <Button
                  icon={<ApartmentOutlined />}
                  onClick={runAutoLayout}
                  title="Auto-Layout"
                />
              </div>
            </Panel>

            {nodes.length === 0 && (
              <Panel position="top-center">
                <div
                  style={{
                    position: "fixed",
                    top: "50%",
                    left: "calc(50% + 124px)",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                >
                  <Card
                    size="small"
                    style={{
                      width: 320,
                      borderRadius: 12,
                      pointerEvents: "auto",
                    }}
                  >
                    <Space
                      direction="vertical"
                      align="center"
                      style={{ width: "100%", padding: "28px 24px" }}
                    >
                      <FileTextOutlined
                        style={{
                          fontSize: 36,
                          color: token.colorTextQuaternary,
                        }}
                      />
                      <Text strong style={{ fontSize: 15 }}>
                        Start building your flow
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, textAlign: "center" }}
                      >
                        Drag nodes from the left panel onto the canvas
                      </Text>
                    </Space>
                  </Card>
                </div>
              </Panel>
            )}
          </ReactFlow>

        </div>
      <style jsx global>{`
        .flow-handle-antd {
          width: 12px !important;
          height: 12px !important;
          background: var(--color-text-muted) !important;
          border: 2px solid var(--color-surface) !important;
          box-shadow: 0 0 0 1px var(--color-border);
          transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
        }

        .flow-handle-antd:hover,
        .flow-handle-antd.react-flow__handle-connecting,
        .flow-handle-antd.react-flow__handle-valid {
          transform: scale(1.25);
          background: var(--color-primary) !important;
          box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 25%, transparent);
        }

        .interactive-button-handle {
          pointer-events: all !important;
          cursor: crosshair !important;
        }

        .react-flow__edge-path {
          transition: stroke-width 120ms ease, opacity 120ms ease;
        }

        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: 3px !important;
        }
      `}</style>
      </div>
    </ConfigProvider>
  );
}

export default function BuilderCanvas({ bot, ...rest }: any) {
  const demoBot = bot || { id: "demo", name: "Flow", nodes: [], edges: [] };
  return (
    <ReactFlowProvider>
      {/* Forward apiBase / templateMode / templateRef from the BuilderCanvas.tsx wrapper. */}
      <BuilderCanvasInner bot={demoBot} {...rest} />
    </ReactFlowProvider>
  );
}
