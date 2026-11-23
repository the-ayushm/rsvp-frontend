export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketChannel = "live_chat" | "ticket";

export interface SupportAdmin {
  id: string;
  name: string;
  email: string;
}

export interface SupportTicket {
  id: string;
  user_id?: string;
  company_id?: string;
  subject?: string;
  message?: string;
  channel?: TicketChannel;
  status: TicketStatus;
  assigned_admin_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  /** Kept as a string — sequences can exceed Number.MAX_SAFE_INTEGER. */
  sequence: string;
  message: string;
  user_id: string;
  user_name?: string | null;
  sender_role?: string | null;
  client_message_id?: string | null;
  created_at: string;
}

/** A message in the UI: either saved, or an optimistic local copy. */
export interface ChatMessage extends Omit<SupportMessage, "sequence"> {
  sequence: string | null;
  localStatus?: "sending" | "failed";
  localError?: string;
}

export interface MessagesPage {
  items: SupportMessage[];
  has_more: boolean;
  next_cursor: string | null;
  previous_cursor: string | null;
}

export interface TicketsPage {
  items: SupportTicket[];
  pagination: { page: number; limit: number; total: number };
}

export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "expired"
  | "denied";

export interface StreamEvent {
  event: string;
  data: string;
  id: string | null;
}
