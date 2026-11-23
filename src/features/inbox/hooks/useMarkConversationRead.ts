import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { Contact, Message } from "../types/inbox.types";
import axios from "axios";
import toast from "react-hot-toast";

interface UseMarkConversationReadProps {
  selectedContact: Contact | null;
  selectedPhone: string;
  /** Last incoming message rendered and visible to the user (from MessageList). */
  viewedMessage: Message | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marks incoming messages viewed in the CRM, through the given message only, so
 * later arrivals stay unread. Customer read receipts never clear this state.
 */
export function useMarkConversationRead({
  selectedContact,
  selectedPhone,
  viewedMessage,
}: UseMarkConversationReadProps) {
  const queryClient = useQueryClient();
  const lastMarked = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());

  const unreadCount = selectedContact?.unreadCount ?? 0;
  const messageId =
    (viewedMessage && UUID.test(String(viewedMessage.id)) ? String(viewedMessage.id) : null) ||
    viewedMessage?.whatsappMessageId ||
    (unreadCount > 0 ? selectedContact?.lastMessageWamid : null) ||
    null;
  const phoneNumberId = selectedContact?.phone_number_id || selectedPhone;
  const contactId = selectedContact?.id;
  const backendContactId =
    typeof contactId === "string" && contactId.length > 20
      ? contactId
      : selectedContact?.rawContactId || null;

  useEffect(() => {
    if (!contactId || !phoneNumberId) return;
    if (!messageId && !backendContactId) {
      return;
    }

    const markTargetKey = messageId || backendContactId || String(contactId);
    const conversationKey = `${phoneNumberId}:${contactId}`;
    const requestKey = `${phoneNumberId}:${markTargetKey}`;

    const markRead = () => {
      if (
        document.visibilityState !== "visible" ||
        lastMarked.current.get(conversationKey) === markTargetKey ||
        pending.current.has(requestKey)
      ) {
        return;
      }

      pending.current.add(requestKey);
      const markPayload: { phone_number_id: string; message_id?: string; contact_id?: string } = {
        phone_number_id: phoneNumberId,
      };
      if (messageId) {
        markPayload.message_id = messageId;
      } else if (backendContactId) {
        markPayload.contact_id = backendContactId;
      }

      void soft7AxiosInstance
        .post("/admin/messages/mark-read", markPayload)
        .then((response) => {
          if (response.data?.success === false) {
            throw new Error("The backend could not mark this conversation as read.");
          }
          lastMarked.current.set(conversationKey, markTargetKey);
          void queryClient.invalidateQueries({
            queryKey: ["contacts", selectedPhone],
          });
        })
        .catch((error: unknown) => {
          // Leave the conversation unread; the next focus or visibility change retries.
          const backendMessage = axios.isAxiosError(error)
            ? error.response?.data?.message
            : undefined;
          toast.error(
            typeof backendMessage === "string"
              ? `Could not mark as read: ${backendMessage}`
              : "Could not mark this conversation as read. Please try again.",
            { id: `mark-read-${contactId}` },
          );
        })
        .finally(() => {
          pending.current.delete(requestKey);
        });
    };

    markRead();
    document.addEventListener("visibilitychange", markRead);
    window.addEventListener("focus", markRead);
    return () => {
      document.removeEventListener("visibilitychange", markRead);
      window.removeEventListener("focus", markRead);
    };
  }, [contactId, phoneNumberId, messageId, selectedPhone, queryClient]);
}
