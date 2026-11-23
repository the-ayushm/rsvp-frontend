/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Contact {
  id: string | number;
  name: string;
  phone?: string | null;
  country_code?: string | null;
  initials?: string;
  lastMessagePreview?: string | null;
  lastMessageTime?: string | null;
  lastMessageWamid?: string | null;
  /** CRM inbox state of incoming messages; never derived from delivery receipts. */
  readStatus?: "read" | "unread" | null;
  unreadCount?: number;
  /** When the customer last sent a message; used for 24h service window. */
  lastInboundAt?: string | null;
  direction?: string;
  lastMessageStatus?: string;
  lastMessageReadAt?: string | null;
  lastMessageDeliveredAt?: string | null;
  tags?: string[];
  assigned_to?: string[] | null;
  status?: string | null;
  stage?: string | null;
  email?: string | null;
  rawContactId?: string | null;
  phone_number_id?: string | null;
  attributes?: Record<string, any>;
  custom_fields?: Record<string, any>;
}

export interface Message {
  id: number;
  contactId: string | number;
  text: string;
  sentBy?: string;
  direction?: string;
  status?: string;
  senderId?: string;
  readAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
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
  reactionEmoji?: string | null;
  reactionMessageId?: string | null;
  content?: {
    interactive?: {
      type?: string;
      body?: {
        text?: string;
      };
      action?: {
        name?: string;
        parameters?: {
          url?: string;
          display_text?: string;
        };
      };
      button_reply?: {
        id?: string;
        title?: string;
      };
      list_reply?: {
        id?: string;
        title?: string;
      };
      nfm_reply?: {
        body?: string;
      };
    };
  };
}

export interface ContactItemProps {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
  reminders?: any[];
}

export interface MessageFormInputs {
  message: string;
}

/** Message a notification asked to show; `id` is the database UUID, `wamid` the fallback. */
export interface MessageTarget {
  id: string | null;
  wamid: string | null;
}

export interface MessagesPage {
  messages: Message[];
  nextPage?: number;
}
