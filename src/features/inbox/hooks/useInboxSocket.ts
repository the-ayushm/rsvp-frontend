import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { Contact, MessagesPage } from "../types/inbox.types";
import { isSamePhoneValue } from "../utils/phone.utils";
import { applyMessageStatus } from "../utils/message-pages.utils";
import { normalizeInboxMessage } from "@/lib/inbox-realtime";

interface UseInboxSocketProps {
  selectedContact: Contact | null;
  selectedPhone: string;
  senderIds: string[];
}

export function useInboxSocket({ selectedContact, selectedPhone, senderIds }: UseInboxSocketProps) {
  const queryClient = useQueryClient();

  useSocket({
    onConnect: () => {
      // Refresh after reconnecting so missed messages and receipts are recovered.
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts", selectedPhone] });
    },
    onNewMessage: (newMessage) => {
      const message = normalizeInboxMessage(newMessage);
      if (!message) return;
      if (message.phoneNumberId && !senderIds.includes(message.phoneNumberId)) return;
      const msgPhone = message.contactPhone;
      const isForCurrentContact = selectedContact && (
        (message.contactId && [selectedContact.id, selectedContact.rawContactId].some(id => String(id) === message.contactId)) ||
        (selectedContact.phone && msgPhone && isSamePhoneValue(selectedContact.phone, msgPhone))
      );
      if (isForCurrentContact) {
        void queryClient.invalidateQueries({
          queryKey: ["messages", selectedContact.id, selectedPhone],
        });
      }
      // Refresh counts and list membership from the backend.
      void queryClient.invalidateQueries({ queryKey: ["contacts", selectedPhone] });
    },
    onMessageStatusUpdate: ({ wamid, status }) => {
      // A receipt can refer to any loaded page or a cached conversation.
      queryClient.setQueriesData<InfiniteData<MessagesPage>>(
        { queryKey: ["messages"] },
        (data) => applyMessageStatus(data, wamid, status),
      );
      void queryClient.invalidateQueries({ queryKey: ["messages"], refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: ["contacts", selectedPhone] });
    },
  });
}
