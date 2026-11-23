/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApi } from "@reduxjs/toolkit/query/react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosError, AxiosRequestConfig } from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhoneNumber {
  phoneNumberId: string;
  displayPhone: string;
  [key: string]: any;
}

export interface ContactTag {
  id: string;
  name: string;
}

export interface Contact {
  id: string | number;
  name: string;
  phone?: string | null;
  initials?: string;
  lastMessagePreview?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
  lastInboundAt?: string | null;
  direction?: string;
  lastMessageStatus?: string;
  tags?: string[];
}

export interface Message {
  id: number;
  contactId: string | number;
  text: string;
  sentBy?: string;
  direction?: string;
  status?: string;
  senderId?: string;
  receiverId?: string;
  seen?: boolean;
  createdAt: string;
  from?: string;
  type?: string;
  buttons?: string[];
  isTemplate?: boolean;
  templateComponents?: any;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateContent?: any;
  error?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  messageType?: string | null;
  whatsappMessageId?: string | null;
}

// ─── Query args ───────────────────────────────────────────────────────────────

export interface GetContactsArgs {
  selectedPhone: string;
}

export interface GetMessagesArgs {
  phoneNumberId: string;
  leadNumber: string;
  contactId: string | number;
}

// ─── Axios base-query (compatible with soft7AxiosInstance) ───────────────────

const axiosBaseQuery =
  (): BaseQueryFn<
    {
      url: string;
      method?: AxiosRequestConfig["method"];
      params?: any;
      data?: any;
    },
    unknown,
    { status?: number; message: string }
  > =>
  async ({ url, method = "GET", params, data }) => {
    try {
      const result = await soft7AxiosInstance({ url, method, params, data });
      return { data: result.data };
    } catch (err) {
      const error = err as AxiosError;
      return {
        error: {
          status: error.response?.status,
          message: error.message,
        },
      };
    }
  };

// ─── Normalisation helpers ────────────────────────────────────────────────────

const CONTACTS_PAGE_LIMIT = 20;

const normalizePhone = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "");

const removePlusPrefix = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/^\+/, "");

const normalizeLeadNumber = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  const digits = normalizePhone(raw);
  if (!digits) return "";
  return `+${digits}`;
};

const isSamePhoneValue = (left: unknown, right: unknown): boolean => {
  const l = normalizePhone(left);
  const r = normalizePhone(right);
  if (!l || !r) return false;
  return l === r || l.slice(-10) === r.slice(-10);
};

const buildInitials = (name?: string): string => {
  if (!name) return "NA";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

const createStableContactId = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 100000;
};

export const mapContactsForSidebar = (
  items: any[],
  idSeed: string,
): Contact[] => {
  const latestByPhone = new Map<string, { leadPhone: string; item: any }>();

  for (const item of items) {
    let rawPhone =
      item?.phone_number ||
      item?.phone ||
      item?.leadNumber ||
      item?.lead_number ||
      item?.contact_number;
    if (!rawPhone) {
      if (item?.direction === "inbound") {
        rawPhone = item?.from_phone || item?.from || item?.sender;
      } else if (item?.direction === "outbound") {
        rawPhone = item?.to_phone || item?.to || item?.recipient;
      } else {
        rawPhone = item?.to_phone || item?.to || item?.from_phone || item?.from;
      }
    }

    const phoneKey = normalizePhone(rawPhone).slice(-10);
    if (!phoneKey) continue;
    const leadPhone = normalizeLeadNumber(rawPhone);

    const current = latestByPhone.get(phoneKey);
    const incomingTime = new Date(
      item?.created_at ||
        item?.updated_at ||
        item?.createdAt ||
        item?.updatedAt ||
        0,
    ).getTime();
    const currentTime = new Date(
      current?.item?.created_at ||
        current?.item?.updated_at ||
        current?.item?.createdAt ||
        current?.item?.updatedAt ||
        0,
    ).getTime();

    if (!current || incomingTime >= currentTime) {
      latestByPhone.set(phoneKey, { leadPhone, item });
    }
  }

  return Array.from(latestByPhone.values()).map(
    ({ leadPhone, item }, index) => {
      const displayLeadPhone = removePlusPrefix(leadPhone);
      const fallbackName =
        item?.contact_name ||
        item?.contactName ||
        item?.name ||
        displayLeadPhone;
      const displayName = isSamePhoneValue(fallbackName, displayLeadPhone)
        ? displayLeadPhone
        : String(fallbackName || displayLeadPhone);

      return {
        id: createStableContactId(
          `${idSeed}-${leadPhone || "unknown"}-${index}`,
        ),
        name: displayName,
        phone: displayLeadPhone || null,
        initials: buildInitials(displayName),
        lastMessagePreview:
          cleanTemplateMetadata(
            item?.lastMessageContent ||
              item?.last_message_content ||
              item?.lastMessagePreview ||
              "",
          ) || null,
        lastMessageTime:
          item?.created_at ||
          item?.updated_at ||
          item?.createdAt ||
          item?.updatedAt ||
          null,
        unreadCount: item?.unreadCount || item?.unread_count || 0,
        tags: Array.isArray(item?.tags)
          ? item.tags.map((t: any) => String(t?.id ?? t))
          : Array.isArray(item?.tag_ids)
            ? item.tag_ids.map(String)
            : [],
        lastInboundAt: item?.lastInboundAt || item?.last_inbound_at || null,
        direction: item?.direction || item?.lastMessageDirection,
        lastMessageStatus:
          item?.lastMessageStatus || item?.last_message_status || item?.status,
      };
    },
  );
};

const cleanTemplateMetadata = (text: string): string => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?|Category|Status|Namespace|Template\s*ID):\s*[^\r\n]*(?:\r?\n|$))+/gim, "")
    .replace(/^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?):\s*[^\s\n\r|]+(?:\s*\|\s*|\s*,\s*|\s+)?)+/gi, "")
    .trim();
};

const getLast10Digits = (value: unknown): string =>
  normalizePhone(value).slice(-10);

// ─── RTK Query API ────────────────────────────────────────────────────────────

export const inboxApi = createApi({
  reducerPath: "inboxApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["PhoneNumbers", "ContactTags", "Contacts", "Messages"],

  endpoints: (builder) => ({
    // 1. Phone Numbers
    getPhoneNumbers: builder.query<PhoneNumber[], void>({
      query: () => ({ url: "/admin/waba/phone-numbers" }),
      providesTags: ["PhoneNumbers"],
      transformResponse: (raw: any): PhoneNumber[] => {
        const rawList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data?.data)
            ? raw.data.data
            : Array.isArray(raw?.data?.phone_numbers)
              ? raw.data.phone_numbers
              : Array.isArray(raw?.data?.phoneNumbers)
                ? raw.data.phoneNumbers
                : Array.isArray(raw?.data)
                  ? raw.data
                  : Array.isArray(raw?.phone_numbers)
                    ? raw.phone_numbers
                    : Array.isArray(raw?.results)
                      ? raw.results
                      : [];

        return rawList.map((pn: any) => ({
          ...pn,
          phoneNumberId:
            pn?.id ||
            pn?.phone_number_id ||
            pn?.phoneNumberId ||
            pn?.phone_number,
          displayPhone:
            pn?.display_phone_number ||
            pn?.phone_number ||
            pn?.number ||
            pn?.id,
        }));
      },
    }),

    // 2. Contact Tags
    getContactTags: builder.query<ContactTag[], void>({
      query: () => ({ url: "/admin/contacts/tags" }),
      providesTags: ["ContactTags"],
      transformResponse: (raw: any): ContactTag[] => {
        const rawList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.data?.data)
              ? raw.data.data
              : Array.isArray(raw?.results)
                ? raw.results
                : [];

        return rawList.map((t: any) => ({
          id: String(t?.id ?? t),
          name: t?.name ?? t?.label ?? String(t),
        }));
      },
    }),

    // 3. Contacts (all pages + conversation merge)
    getContacts: builder.query<Contact[], GetContactsArgs>({
      query: ({ selectedPhone }) => ({
        url: `/admin/contacts`,
        params: { page: 1, limit: CONTACTS_PAGE_LIMIT },
      }),
      providesTags: ["Contacts"],
      // Full logic happens in queryFn override via onQueryStarted — see inboxPage
      // transformResponse handles the basic shape
      transformResponse: (raw: any): Contact[] => {
        const extractContacts = (payload: any): any[] =>
          Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data?.contacts)
              ? payload.data.contacts
              : Array.isArray(payload?.data?.data)
                ? payload.data.data
                : Array.isArray(payload?.contacts)
                  ? payload.contacts
                  : [];

        return mapContactsForSidebar(extractContacts(raw), "contacts");
      },
    }),

    // 4. Messages for a specific contact
    getMessages: builder.query<Message[], GetMessagesArgs>({
      query: ({ phoneNumberId, leadNumber }) => ({
        url: "/admin/messages/lead/conversations",
        params: { phone_number_id: phoneNumberId, leadNumber },
      }),
      providesTags: (_result, _error, { contactId }) => [
        { type: "Messages", id: contactId },
      ],
      transformResponse: (
        raw: any,
        _meta,
        args: GetMessagesArgs,
      ): Message[] => {
        let rawArr: any[] = [];
        if (Array.isArray(raw?.data?.messages)) rawArr = raw.data.messages;
        else if (Array.isArray(raw?.messages)) rawArr = raw.messages;
        else if (Array.isArray(raw?.data?.data)) rawArr = raw.data.data;
        else if (Array.isArray(raw?.data)) rawArr = raw.data;
        else if (Array.isArray(raw)) rawArr = raw;

        // Deduplicate
        const seenKeys = new Set<string>();
        const unique: any[] = [];
        for (const msg of rawArr) {
          const key = String(
            msg?.wamid ||
              msg?.whatsappMessageId ||
              msg?.id ||
              msg?._id ||
              `${msg?.direction || ""}-${msg?.createdAt || ""}`,
          );
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          unique.push(msg);
        }

        return unique.map((m: any): Message => {
          const resolvedType = String(
            m.type || m.content?.type || "text",
          ).toLowerCase();
          const textFromContent =
            typeof m?.content === "string"
              ? m.content.trim()
              : typeof m?.content?.text === "string"
                ? m.content.text.trim()
                : "";
          const isTemplateMessage = resolvedType === "template";

          const normalizeComponents = (components: any): any[] => {
            if (!Array.isArray(components)) return [];
            return components
              .map((c: any) => ({
                ...c,
                type: String(c?.type || "").toUpperCase(),
                text: c?.text,
              }))
              .filter((c: any) => !!c.type);
          };

          const normalizedComponents = normalizeComponents(
            m.templateComponents ||
              m.content?.template?.components ||
              m.content?.components ||
              [],
          );

          const extractText = (message: any): string => {
            const candidates = [
              message?.text,
              message?.body,
              message?.message,
              message?.content,
              message?.caption,
            ];
            for (const c of candidates) {
              if (!c) continue;
              if (typeof c === "string" && c.trim()) return c.trim();
            }
            return "";
          };

          return {
            id: m.id || m._id,
            contactId: args.contactId,
            text: isTemplateMessage
              ? ""
              : cleanTemplateMetadata(textFromContent || extractText(m)),
            direction:
              m.direction === "outbound" || m.direction === "outgoing"
                ? "outgoing"
                : "incoming",
            status: m.status || "",
            createdAt:
              m.createdAt ||
              m.created_at ||
              m.timestamp ||
              new Date().toISOString(),
            type: resolvedType,
            mediaUrl:
              m.mediaUrl ||
              m.media_url ||
              m.content?.media_url ||
              m.content?.url ||
              null,
            mediaType: m.mediaType || m.media_type || null,
            messageType: resolvedType || null,
            whatsappMessageId: m.wamid || m.whatsappMessageId || null,
            isTemplate: isTemplateMessage,
            templateName:
              m.templateName ||
              m.template_name ||
              m.content?.template?.name ||
              null,
            templateLanguage:
              m.templateLanguage ||
              m.template_language ||
              m.content?.template?.language?.code ||
              null,
            templateComponents: isTemplateMessage ? normalizedComponents : [],
            templateContent: isTemplateMessage
              ? m.content || {
                  to: null,
                  type: "template",
                  template: {
                    name: m.templateName || m.template_name || null,
                    language: {
                      code: m.templateLanguage || m.template_language || null,
                    },
                    components: normalizedComponents,
                  },
                  recipient_type: "individual",
                  messaging_product: "whatsapp",
                }
              : null,
            error: m.error_message || m.error || null,
            errorCode: m.errorCode || m.error_code || null,
            errorMessage: m.error_message || m.errorMessage || null,
          };
        });
      },
    }),
  }),
});

export const {
  useGetPhoneNumbersQuery,
  useGetContactTagsQuery,
  useGetContactsQuery,
  useGetMessagesQuery,
} = inboxApi;
