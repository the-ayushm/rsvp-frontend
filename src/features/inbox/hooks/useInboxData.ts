/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { Contact, Message, MessagesPage, MessageTarget } from "../types/inbox.types";
import { DEBUG_INBOX, CONTACTS_PER_PAGE, MESSAGES_PER_PAGE } from "../constants";
import { getConsoleToken } from "../utils/auth.utils";
import {
  normalizePhone,
  removePlusPrefix,
  isSamePhoneValue,
  createStableContactId,
  belongsToSelectedContact,
} from "../utils/phone.utils";
import { buildInitials, mapContactsForSidebar } from "../utils/contact.utils";
import {
  extractMessageText,
  normalizeTemplateComponents,
  getMessageStableKey,
} from "../utils/message.utils";

import { mergeMessagePages, mergeLatestMessagePage } from "../utils/message-pages.utils";

interface UseInboxDataProps {
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  searchQuery: string;
  selectedTag: string | null;
  selectedPipelineStage: string | null;
  selectedAgentId: string | null;
  selectedReadFilter: "all" | "unread" | "read";
  urlPhone: string | null;
  urlName: string | null;
  urlContactId: string | null;
  urlPhoneNumberId: string | null;
  urlMessageId: string | null;
  urlWamid: string | null;
}

export function useInboxData({
  selectedContact,
  setSelectedContact,
  searchQuery,
  selectedTag,
  selectedPipelineStage,
  selectedAgentId,
  selectedReadFilter,
  urlPhone,
  urlName,
  urlContactId,
  urlPhoneNumberId,
  urlMessageId,
  urlWamid,
}: UseInboxDataProps) {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [isWindowOpenFromAPI, setIsWindowOpenFromAPI] = useState(true);

  const processedUrlRef = useRef<string | null>(null);
  const lastProcessedUrlKeyRef = useRef<string | null>(null);

  // ✅ Fetch phone numbers from ngrok API
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ["phone-numbers"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await soft7AxiosInstance.get(
        "/admin/waba/phone-numbers",
      );
      const data = response.data;
      if (DEBUG_INBOX) {
        console.log("Phone numbers RAW:", data);
      }

      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.data?.data)
          ? data.data.data
          : Array.isArray(data?.data?.phone_numbers)
            ? data.data.phone_numbers
            : Array.isArray(data?.data?.phoneNumbers)
              ? data.data.phoneNumbers
              : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.phone_numbers)
                  ? data.phone_numbers
                  : Array.isArray(data?.results)
                    ? data.results
                    : [];

      return rawList.map((pn: any) => ({
        ...pn,
        phoneNumberId:
          pn?.id ||
          pn?.phoneNumberId ||
          pn?.phone_number_id ||
          pn?.phone_number,
        displayPhone:
          pn?.display_phone_number || pn?.phone_number || pn?.number || pn?.id,
      }));
    },
  });

  // Find a phone record by internal UUID or Meta numeric ID
  const findSender = (value: string | null) =>
    value
      ? (phoneNumbers as any[]).find(
          (pn: any) =>
            String(pn.id) === String(value) ||
            String(pn.phoneNumberId) === String(value) ||
            String(pn.phone_number_id) === String(value),
        ) ?? null
      : null;

  useEffect(() => {
    if (phoneNumbers.length > 0) {
      const savedPhone =
        typeof window !== "undefined"
          ? localStorage.getItem("inbox_selected_phone")
          : null;

      // An inaccessible notification sender keeps the current number; the
      // target resolver reports it instead of opening another conversation.
      const matched = findSender(urlPhoneNumberId) || findSender(savedPhone);

      const targetPhone = String(
        matched?.id ||
          matched?.phoneNumberId ||
          phoneNumbers[0]?.id ||
          phoneNumbers[0]?.phoneNumberId ||
          "",
      );

      if (targetPhone && selectedPhone !== targetPhone) {
        setSelectedPhone(targetPhone);
        if (typeof window !== "undefined") {
          localStorage.setItem("inbox_selected_phone", targetPhone);
        }
      }
    } else {
      if (selectedPhone !== "") {
        setSelectedPhone("");
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("inbox_selected_phone");
      }
    }
  }, [phoneNumbers, urlPhoneNumberId]);

  const selectedPhoneMeta = React.useMemo(() => {
    if (
      !selectedPhone ||
      !Array.isArray(phoneNumbers) ||
      phoneNumbers.length === 0
    ) {
      return null;
    }
    return (
      (phoneNumbers as any[]).find((pn: any) => {
        const candidates = [
          pn?.phone_number_id,
          pn?.phoneNumberId,
          pn?.phoneNumber,
          pn?.id,
          pn?.phone_number,
        ].map((v) => String(v ?? ""));

        return candidates.includes(String(selectedPhone));
      }) ?? null
    );
  }, [phoneNumbers, selectedPhone]);

  // ✅ Fetch contact tags from ngrok API
  const { data: contactTags = [] } = useQuery({
    queryKey: ["contact-tags"],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/contacts/tags");
        const payload = res.data;
        const rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.data)
              ? payload.data.data
              : Array.isArray(payload?.results)
                ? payload.results
                : [];

        return rawList.map((t: any) => ({
          id: String(t?.id ?? t),
          name: t?.name ?? t?.label ?? String(t),
        }));
      } catch {
        return [];
      }
    },
  });

  const outboundPhoneNumberId = String(
    selectedPhoneMeta?.phone_number_id ||
      selectedPhoneMeta?.phoneNumberId ||
      selectedPhoneMeta?.id ||
      selectedPhoneMeta?.phone_number ||
      selectedPhone ||
      "",
  );

  // ✅ Fetch accepted team members for assign-to dropdown
  const { data: acceptedTeamMembers = [] } = useQuery({
    queryKey: ["accepted-team-members"],
    queryFn: async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/team/invites");
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        return list.filter((m: any) => {
          const inviteStatus = m.invite_status ?? m.status;
          return inviteStatus === "accepted" || !inviteStatus;
        });
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnMount: true,
    retry: false,
  });

  // ✅ Fetch pipeline stages from ngrok API
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ["pipeline-stages"],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/pipeline");
        const list = res.data?.data ?? res.data ?? [];
        return Array.isArray(list)
          ? list.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          : [];
      } catch {
        return [];
      }
    },
  });

  type ContactsPage = {
    contacts: Contact[];
    totalContacts: number;
    totalPages: number;
    currentPage: number;
  };
  const contactsQueryKey = [
    "contacts",
    selectedPhone,
    searchQuery,
    selectedTag,
    selectedPipelineStage,
    selectedAgentId,
    selectedReadFilter,
  ];
  const fetchContactsPage = async ({
    pageParam,
    signal,
  }: {
    pageParam: unknown;
    signal?: AbortSignal;
  }): Promise<ContactsPage> => {
    const token = getConsoleToken();

    if (!token) {
      throw new Error("Missing auth token for contacts fetch");
    }

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

    const extractPaginationInfo = (payload: any) => {
      const p =
        payload?.data?.pagination ||
        payload?.pagination ||
        payload?.meta?.pagination ||
        payload?.data?.meta?.pagination ||
        {};

      return {
        page: Number(p?.page ?? p?.current_page ?? 1) || 1,
        totalPages:
          Number(p?.total_pages ?? p?.totalPages ?? p?.last_page ?? 0) || 0,
        limit:
          Number(p?.limit ?? p?.per_page ?? CONTACTS_PER_PAGE) ||
          CONTACTS_PER_PAGE,
        total: Number(p?.total ?? p?.totalContacts ?? p?.count ?? 0) || 0,
      };
    };

    // Inbox tabs order by latest message time on the server, before pagination.
    // Without read_status (other filters) campaign-only contacts stay included.
    const withReadStatus = !selectedPipelineStage && !selectedAgentId && !selectedTag;
    const params = new URLSearchParams({
      page: String(pageParam),
      limit: String(CONTACTS_PER_PAGE),
      sortBy: withReadStatus ? "last_message_at" : "created_at",
      sortOrder: "desc",
    });

    params.append("read_status", selectedReadFilter);

    if (searchQuery.trim()) {
      params.append("search", searchQuery.trim());
    }
    if (selectedPipelineStage) {
      params.append("status", String(selectedPipelineStage));
    }
    if (selectedTag) {
      params.append("tag_ids", String(selectedTag));
      params.append("tags", String(selectedTag));
    }
    if (selectedAgentId && selectedAgentId !== "unassigned") {
      params.append("assigned_to", String(selectedAgentId));
    }
    if (selectedAgentId === "unassigned") {
      params.append("unassigned_only", "true");
    }

    const contactsRes = await soft7AxiosInstance.get(
      `/admin/contacts/${selectedPhone}?${params.toString()}`,
      { signal },
    );

    const contactsPayload = contactsRes.data;
    const pageItems = extractContacts(contactsPayload);
    const paginationInfo = extractPaginationInfo(contactsPayload);
    const mappedContacts = mapContactsForSidebar(pageItems, "contacts");

    return {
      contacts: mappedContacts,
      totalContacts: paginationInfo.total,
      totalPages: paginationInfo.totalPages || 1,
      currentPage: paginationInfo.page,
    };
  };

  // ✅ Fetch contacts with infinite scrolling
  const {
    data: contactsInfiniteData,
    isLoading: loadingContacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{
    contacts: Contact[];
    totalContacts: number;
    totalPages: number;
    currentPage: number;
  }>({
    queryKey: contactsQueryKey,
    initialPageParam: 1,
    // Fetch fresh results when the selected sender becomes available on open.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Keep the current list visible while a new filter / sender loads.
    placeholderData: keepPreviousData,
    queryFn: fetchContactsPage,
    getNextPageParam: (lastPage) => {
      if (lastPage.currentPage < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return undefined;
    },
    enabled: !!selectedPhone,
  });

  // Live refresh: poll only the first page (newest conversations) instead of
  // refetching every loaded page every 5s — the contacts endpoint is slow with
  // read_status, so re-downloading all pages stacked requests up. The next poll
  // starts only after the previous one finished.
  useVisiblePolling(
    async (signal) => {
      if (queryClient.isFetching({ queryKey: contactsQueryKey, exact: true })) return;
      const first = await fetchContactsPage({ pageParam: 1, signal });
      if (signal.aborted) return;
      queryClient.setQueryData<InfiniteData<ContactsPage>>(contactsQueryKey, (previous) =>
        previous && previous.pages.length > 0
          ? { ...previous, pages: [first, ...previous.pages.slice(1)] }
          : previous,
      );
    },
    {
      enabled: !!selectedPhone,
      scope: JSON.stringify(contactsQueryKey),
      interval: 5000,
      immediate: false,
    },
  );

  // Read/unread membership and totals come from the paginated API response.
  // Page 1 is refreshed on its own, so a conversation can shift into page 2;
  // keep the first occurrence of each contact.
  const contacts = React.useMemo(() => {
    const seen = new Set<string>();
    return (contactsInfiniteData?.pages.flatMap((p) => p.contacts) ?? []).filter((c) => {
      const key = String(c.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [contactsInfiniteData]);
  const totalContacts =
    contactsInfiniteData?.pages[0]?.totalContacts ?? 0;

  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  const urlKey = `${urlContactId || ""}_${urlPhone || ""}_${urlPhoneNumberId || ""}_${urlMessageId || ""}_${urlWamid || ""}`;

  const finishUrlTarget = (key: string) => {
    processedUrlRef.current = key;
    lastProcessedUrlKeyRef.current = key;
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  // Notification targets: resolve by contact ID within the event's business
  // number. A customer number alone is ambiguous across senders, and the
  // target need not be on the loaded contacts page.
  useEffect(() => {
    if (!urlContactId || lastProcessedUrlKeyRef.current === urlKey) return;
    if (!phoneNumbers.length) return;

    let targetSender = selectedPhone;
    if (urlPhoneNumberId) {
      const sender = findSender(urlPhoneNumberId);
      if (!sender) {
        finishUrlTarget(urlKey);
        toast.error("This conversation belongs to a WhatsApp number you can't access.");
        return;
      }
      targetSender = String(sender.id || sender.phoneNumberId);
    }
    // Wait for the sender switch so list, socket and message state match it.
    if (!targetSender || selectedPhone !== targetSender) return;

    lastProcessedUrlKeyRef.current = urlKey;
    let done = false;
    const controller = new AbortController();
    soft7AxiosInstance
      .get(`/admin/contacts/by-id/${encodeURIComponent(urlContactId)}`, { signal: controller.signal })
      .then((response) => {
        const payload = response.data;
        const raw = payload?.data?.contact ?? payload?.data ?? payload?.contact ?? payload;
        const [mapped] = raw && typeof raw === "object"
          ? mapContactsForSidebar([{ phone: urlPhone, ...raw }], "contacts")
          : [];
        done = true;
        if (!mapped) throw new Error("missing");
        const phone = urlPhone ? normalizePhone(urlPhone) : mapped.phone;
        setSelectedContact({ ...mapped, phone, phone_number_id: targetSender });
        setMessageTarget(urlMessageId || urlWamid ? { id: urlMessageId, wamid: urlWamid } : null);
        finishUrlTarget(urlKey);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        done = true;
        finishUrlTarget(urlKey);
        toast.error("This conversation is no longer available.");
      });
    return () => {
      controller.abort();
      // Retry when the effect re-runs before the request finished.
      if (!done && lastProcessedUrlKeyRef.current === urlKey) lastProcessedUrlKeyRef.current = null;
    };
  }, [urlKey, selectedPhone, phoneNumbers]);

  // Legacy links (contacts page) carry only a phone and name.
  useEffect(() => {
    if (!urlPhone && !urlContactId) {
      lastProcessedUrlKeyRef.current = null;
      return;
    }
    if (urlContactId) return;

    const currentUrlKey = urlKey;
    if (lastProcessedUrlKeyRef.current === currentUrlKey) return;

    const targetPhone = urlPhone || "";

    const loadedContacts: Contact[] = (contacts || []) as Contact[];
    const foundContact = loadedContacts.find((c: Contact) =>
      Boolean(targetPhone && c.phone && isSamePhoneValue(c.phone, targetPhone)),
    );

    if (foundContact) {
      setSelectedContact(foundContact);
      setMessageTarget(null);
      finishUrlTarget(currentUrlKey);
      return;
    }

    const phoneDigits = normalizePhone(targetPhone);
    const cleanPhone = removePlusPrefix(targetPhone);
    const nameToUse = urlName || cleanPhone || "Contact";

    const syntheticContact: Contact = {
      id: createStableContactId(`url-${phoneDigits}`),
      name: nameToUse,
      phone: cleanPhone,
      initials: buildInitials(nameToUse),
      unreadCount: 0,
      lastMessagePreview: null,
      lastMessageTime: new Date().toISOString(),
      rawContactId: null,
    };

    setSelectedContact(syntheticContact);
    setMessageTarget(null);
    finishUrlTarget(currentUrlKey);
  }, [urlKey, urlName, contacts]);

  const paginatedContacts = contacts || [];

  // ✅ Fetch messages from conversation API
  const messageQueryKey = [
    "messages", selectedContact?.id, selectedPhone,
    selectedContact?.phone, selectedContact?.country_code, "pages",
  ];
  const fetchMessagesPage = async ({ pageParam, signal }: { pageParam: unknown; signal: AbortSignal }): Promise<MessagesPage> => {
      if (!selectedContact || !selectedPhone) return { messages: [] };

      const token = getConsoleToken();
      if (!token) {
        throw new Error("Missing auth token for messages fetch");
      }

      const countryCode = String(selectedContact?.country_code || "").replace(
        /\D/g,
        "",
      );

      const phoneNumber = normalizePhone(selectedContact?.phone || "");

      let leadNumber = "";
      if (countryCode && phoneNumber) {
        if (phoneNumber.startsWith(countryCode)) {
          leadNumber = phoneNumber;
        } else {
          leadNumber = `${countryCode}${phoneNumber}`;
        }
      } else {
        leadNumber = phoneNumber;
      }

      const conversationPhoneId = String(
        selectedContact?.phone_number_id || selectedPhone || "",
      );

      const query = new URLSearchParams({
        phone_number_id: conversationPhoneId,
        leadNumber: leadNumber,
        page: String(pageParam),
        limit: String(MESSAGES_PER_PAGE),
        sortBy: "created_at",
        sortOrder: "desc",
      });

      const response = await soft7AxiosInstance.get(
        `/admin/messages/lead/conversations?${query.toString()}`,
        { signal },
      );

      const data = response.data;
      if (data?.data?.isWindowOpen !== undefined) {
        setIsWindowOpenFromAPI(data.data.isWindowOpen);
      }
      if (DEBUG_INBOX) {
        console.log("FRESH DATA FROM EXTERNAL API:", data);
      }

      let raw: any[] = [];
      if (Array.isArray(data?.data?.messages)) raw = data.data.messages;
      else if (Array.isArray(data?.messages)) raw = data.messages;
      else if (Array.isArray(data?.data?.data)) raw = data.data.data;
      else if (Array.isArray(data?.data)) raw = data.data;
      else if (Array.isArray(data)) raw = data;
      else raw = [];

      const phoneFilteredRaw = raw.filter((m: any) =>
        belongsToSelectedContact(m, selectedContact.phone),
      );

      const uniqueRaw: any[] = [];
      const seenKeys = new Set<string>();

      for (const msg of phoneFilteredRaw) {
        const key = String(
          msg?.wamid ||
            msg?.whatsappMessageId ||
            msg?.id ||
            msg?._id ||
            `${msg?.direction || ""}-${extractMessageText(msg)}-${msg?.createdAt || msg?.created_at || msg?.timestamp || ""}`,
        );

        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        uniqueRaw.push(msg);
      }

      const mapped = uniqueRaw.map((m: any) => {
        const resolvedType = String(
          m.type ||
            m.content?.type ||
            (m.content?.audio ? "audio" : "") ||
            (m.content?.video ? "video" : "") ||
            (m.content?.image ? "image" : "") ||
            (m.content?.document ? "document" : "") ||
            "text",
        ).toLowerCase();
        const textFromContent =
          typeof m?.content === "string"
            ? m.content.trim()
            : typeof m?.content?.text === "string"
              ? m.content.text.trim()
              : "";
        const normalizedComponents = normalizeTemplateComponents(
          m.templateComponents ||
            m.content?.template?.components ||
            m.content?.components ||
            [],
        );
        const isTemplateMessage = resolvedType === "template";

        const isReaction = resolvedType === "reaction";
        const reactionEmoji = isReaction
          ? m.content?.reaction?.emoji || m.reaction?.emoji || null
          : m.reactionEmoji || m.reaction?.emoji || null;
        const reactionMessageId = isReaction
          ? m.content?.reaction?.message_id || m.reaction?.message_id || null
          : m.reactionMessageId || m.reaction?.message_id || null;
        const extractedWamid =
          m.wamid ||
          m.whatsappMessageId ||
          m.content?.wamid ||
          m.content?.id ||
          m.content?.message_id ||
          m.whatsapp_message_id ||
          m.message_id ||
          null;

        return {
          id: m.id || m._id || extractedWamid,
          contactId: selectedContact?.id,
          text: isTemplateMessage
            ? ""
            : textFromContent || extractMessageText(m),
          direction:
            ["outbound", "outgoing"].includes(String(m.direction).trim().toLowerCase())
              ? "outgoing"
              : "incoming",
          status: String(m.status || m.message_status || "").trim().toLowerCase(),
          readAt: m.readAt || m.read_at || null,
          deliveredAt: m.deliveredAt || m.delivered_at || null,
          failedAt: m.failedAt || m.failed_at || null,
          createdAt:
            m.createdAt ||
            m.created_at ||
            m.timestamp ||
            new Date().toISOString(),
          type: resolvedType,
          content: m.content,
          mediaUrl:
            m.mediaUrl ||
            m.media_url ||
            m.content?.media_url ||
            m.content?.url ||
            m.content?.audio?.link ||
            m.content?.video?.link ||
            m.content?.image?.link ||
            m.content?.document?.link ||
            null,
          mediaType:
            m.mediaType ||
            m.media_type ||
            (m.content?.audio || resolvedType === "audio"
              ? "audio/mpeg"
              : null),
          messageType: resolvedType || null,
          whatsappMessageId: extractedWamid,
          isTemplate: isTemplateMessage,
          reactionEmoji,
          reactionMessageId,
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
                to: selectedContact?.phone || null,
                type: "template",
                template: {
                  name:
                    m.templateName ||
                    m.template_name ||
                    m.content?.template?.name ||
                    null,
                  language: {
                    code:
                      m.templateLanguage ||
                      m.template_language ||
                      m.content?.template?.language?.code ||
                      null,
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

      const cached = queryClient.getQueryData<InfiniteData<MessagesPage>>(messageQueryKey);
      const previousMessages = cached?.pages.flatMap((page) => page.messages) ?? [];
      const previousTextByKey = new Map<string, string>();
      for (const prev of previousMessages) {
        const prevKey = getMessageStableKey(prev);
        if (prevKey && prev.text?.trim()) {
          previousTextByKey.set(prevKey, prev.text);
        }
      }

      const recoveredMessages = mapped.map((msg: Message) => {
        if (msg.isTemplate) return msg;
        if (msg.text?.trim()) return msg;
        const key = getMessageStableKey(msg as any);
        if (!key) return msg;
        const recovered = previousTextByKey.get(key);
        if (!recovered) return msg;
        return { ...msg, text: recovered };
      });
      const pagination = data?.data?.pagination || data?.pagination ||
        data?.meta?.pagination || data?.data?.meta?.pagination || {};
      const page = Number(pageParam);
      const total = pagination.total ?? pagination.totalMessages ?? pagination.count;
      const totalPages = pagination.total_pages ?? pagination.totalPages ??
        pagination.last_page ?? (total != null ? Math.ceil(Number(total) / MESSAGES_PER_PAGE) : undefined);
      const hasMore = pagination.has_next ?? pagination.hasNextPage ??
        (totalPages != null ? page < Number(totalPages) : raw.length === MESSAGES_PER_PAGE);
      return {
        messages: recoveredMessages,
        nextPage: raw.length > 0 && hasMore ? page + 1 : undefined,
      };
  };

  const {
    data: messagesInfiniteData,
    isLoading: loadingMessages,
    isError: messagesError,
    refetch: refetchMessages,
    fetchNextPage: fetchOlderMessages,
    hasNextPage: hasOlderMessages,
    isFetchingNextPage: isFetchingOlderMessages,
  } = useInfiniteQuery<MessagesPage>({
    queryKey: messageQueryKey,
    initialPageParam: 1,
    enabled: Boolean(
      selectedContact?.id && selectedContact?.phone && selectedPhone,
    ),
    queryFn: fetchMessagesPage,
    getNextPageParam: (lastPage, pages) => {
      // Stop if a backend that ignores pagination repeats the same page.
      if (pages.length > 1 && lastPage.messages.length > 0) {
        const earlierKeys = new Set(pages.slice(0, -1).flatMap((page) =>
          page.messages.map((message) => getMessageStableKey(message))));
        if (lastPage.messages.every((message) => earlierKeys.has(getMessageStableKey(message)))) {
          return undefined;
        }
      }
      return lastPage.nextPage;
    },
    refetchOnWindowFocus: true,
    staleTime: 2000,
    gcTime: 1000 * 60 * 5,
  });

  useVisiblePolling(async signal => {
    if (queryClient.isFetching({ queryKey: messageQueryKey, exact: true })) return;
    const latest = await fetchMessagesPage({ pageParam: 1, signal });
    if (!signal.aborted) queryClient.setQueryData<InfiniteData<MessagesPage>>(
      messageQueryKey, previous => mergeLatestMessagePage(previous, latest),
    );
  }, {
    enabled: Boolean(selectedContact?.id && selectedContact?.phone && selectedPhone),
    scope: JSON.stringify(messageQueryKey), immediate: false,
  });

  const messages = React.useMemo(
    () => mergeMessagePages(messagesInfiniteData?.pages ?? []),
    [messagesInfiniteData],
  );

  return {
    phoneNumbers,
    selectedPhone,
    setSelectedPhone,
    selectedPhoneMeta,
    outboundPhoneNumberId,
    contactTags,
    acceptedTeamMembers,
    pipelineStages,
    contacts,
    totalContacts,
    paginatedContacts,
    loadingContacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    messages,
    loadingMessages,
    messagesError,
    refetchMessages,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlderMessages,
    isWindowOpenFromAPI,
    setIsWindowOpenFromAPI,
    processedUrlRef,
    messageTarget,
    setMessageTarget,
  };
}
