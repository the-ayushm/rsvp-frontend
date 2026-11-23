"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { extractInboxMessageRows, InboxMessageDeduplicator, MESSAGE_TOAST_CONTAINER_ID, normalizeInboxMessage } from "@/lib/inbox-realtime";
import { getStoredInboxUserId, inboxMessageBelongsToUser } from "@/lib/inbox-user-scope";
import { disconnectSocket } from "@/lib/socket-client";

export default function SocketNotificationListener() {
  const router = useRouter();
  const processed = useRef(new InboxMessageDeduplicator());
  const cursor = useRef<string | null>(null);
  const accountId = useRef<string | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  const syncAccount = useCallback(() => {
    const userId = getStoredInboxUserId();
    if (accountId.current !== userId) {
      accountId.current = userId;
      cursor.current = null;
      processed.current = new InboxMessageDeduplicator();
      toast.dismiss({ containerId: MESSAGE_TOAST_CONTAINER_ID });
    }
    return userId;
  }, []);

  const notify = useCallback((payload: unknown) => {
    const userId = syncAccount();
    const message = normalizeInboxMessage(payload);
    if (!message || message.direction !== "incoming" || !localStorage.getItem("console_access_token")) return;
    if (!inboxMessageBelongsToUser(payload, userId)) return;
    if (!processed.current.accept(message)) return;
    const toastId = message.phoneNumberId && message.id
      ? `${message.phoneNumberId}:${message.id}`
      : message.wamid || message.id;
    toast(
      <div className="flex items-start gap-3 p-1 min-w-60">
        <div className="rounded-xl bg-primary-light p-2.5 text-primary-text"><MessageSquare size={18} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{message.contactName}</p>
          {message.contactPhone && <p className="text-xs text-muted-foreground">{message.contactPhone}</p>}
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message.text}</p>
        </div>
      </div>,
      {
        containerId: MESSAGE_TOAST_CONTAINER_ID, toastId,
        onClick: () => {
          toast.dismiss({ id: toastId, containerId: MESSAGE_TOAST_CONTAINER_ID });
          if (getStoredInboxUserId() !== userId) return;
          const params = new URLSearchParams();
          // The inbox keeps this target while the sender and history load, then
          // scrolls to the message. It resolves by contact ID, never phone alone.
          if (message.contactId) params.set("contactId", message.contactId);
          if (message.id) params.set("messageId", message.id);
          if (message.wamid) params.set("wamid", message.wamid);
          if (message.contactPhone) params.set("phone", message.contactPhone);
          if (message.contactName) params.set("name", message.contactName);
          if (message.phoneNumberId) params.set("phoneNumberId", message.phoneNumberId);
          router.push(`/user/inbox?${params}`);
        },
      },
    );
  }, [router, syncAccount]);

  useSocket({ onNewMessage: notify });

  useEffect(() => () => {
    toast.dismiss({ containerId: MESSAGE_TOAST_CONTAINER_ID });
    disconnectSocket();
  }, []);

  // The first response seeds existing history. Later polls overlap the cursor so
  // messages sharing timestamps or arriving late are not missed or toasted twice.
  useVisiblePolling(async signal => {
    const userId = syncAccount();
    if (!userId || !localStorage.getItem("console_access_token")) return;
    const initial = cursor.current === null;
    const from = cursor.current ? new Date(Date.parse(cursor.current) - 10_000).toISOString() : null;
    let newest = cursor.current;
    const batches = new Set<string>();
    let complete = false;
    for (let page = 1; page <= 10; page++) {
      const { data } = await soft7AxiosInstance.get("/admin/messages", {
        signal, timeout: 15_000,
        params: { direction: "inbound", sort_by: "created_at", sort_order: "desc", limit: 50, page, ...(from ? { from_date: from } : {}) },
      });
      if (signal.aborted || data?.success === false || getStoredInboxUserId() !== userId) return;
      const rows = extractInboxMessageRows(data);
      const fingerprint = rows.map(normalizeInboxMessage).map(message => message?.wamid ?? message?.id ?? message?.createdAt).join("|");
      const batch = rows.filter(payload => inboxMessageBelongsToUser(payload, userId))
        .map(normalizeInboxMessage).filter(message => message !== null);
      if (batches.has(fingerprint)) { complete = true; break; }
      batches.add(fingerprint);
      for (const message of batch) {
        if (message.createdAt && (!newest || message.createdAt > newest)) newest = message.createdAt;
        if (initial) processed.current.accept(message);
        else notify(message);
      }
      const pagination = data?.data?.pagination ?? data?.pagination;
      const hasNext = pagination?.hasNextPage ?? pagination?.has_next ??
        (pagination?.total_pages != null ? page < Number(pagination.total_pages) : rows.length === 50);
      if (initial || !hasNext || rows.length === 0) { complete = true; break; }
    }
    if (complete) cursor.current = newest ?? new Date().toISOString();
  });

  useEffect(() => {
    // Clear an account's visible toasts when another tab changes the login.
    const changed = () => { syncAccount(); };
    window.addEventListener("storage", changed);
    window.addEventListener("focus", changed);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", changed);
    };
  }, [syncAccount]);

  useEffect(() => {
    const update = () => setThemeMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <ToastContainer containerId={MESSAGE_TOAST_CONTAINER_ID} position="top-right" autoClose={6000}
    newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme={themeMode} style={{ zIndex: 99999 }} />;
}
