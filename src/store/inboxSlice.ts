import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Contact } from "./inboxApi";

// ─── State shape ──────────────────────────────────────────────────────────────

interface InboxState {
  /** Currently selected WhatsApp phone number ID */
  selectedPhone: string;

  /** Currently open contact/conversation */
  selectedContact: Contact | null;

  /** Sidebar search query */
  searchQuery: string;

  /** Active conversation filter label (e.g. "All", "Unread") */
  activeFilter: string;

  /** Tag filter applied in sidebar */
  selectedTag: string | null;

  /** Phone numbers selected for filtering */
  filterPhoneNumbers: string[];

  /** Active right-panel icon (CRM / Order Date / Group / Tag / Schedule) */
  activeIcon: string;

  /** Current pagination page for the contacts sidebar */
  currentPage: number;

  /** Whether mobile sidebar is open */
  isMobileSidebarOpen: boolean;
}

const initialState: InboxState = {
  selectedPhone: "",
  selectedContact: null,
  searchQuery: "",
  activeFilter: "All",
  selectedTag: null,
  filterPhoneNumbers: [],
  activeIcon: "CRM",
  currentPage: 1,
  isMobileSidebarOpen: true,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const inboxSlice = createSlice({
  name: "inbox",
  initialState,
  reducers: {
    /** Set the active WhatsApp phone number */
    setSelectedPhone(state, action: PayloadAction<string>) {
      state.selectedPhone = action.payload;
      // Reset contact when phone changes
      state.selectedContact = null;
      state.currentPage = 1;
    },

    /** Set the selected contact (and reset unread count) */
    setSelectedContact(state, action: PayloadAction<Contact | null>) {
      if (action.payload) {
        state.selectedContact = { ...action.payload, unreadCount: 0 };
      } else {
        state.selectedContact = null;
      }
    },

    /** Update unread count on an existing contact in the selected slot */
    clearContactUnread(state) {
      if (state.selectedContact) {
        state.selectedContact = { ...state.selectedContact, unreadCount: 0 };
      }
    },

    /** Set search query and reset to page 1 */
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
      state.currentPage = 1;
    },

    /** Set the active filter tab */
    setActiveFilter(state, action: PayloadAction<string>) {
      state.activeFilter = action.payload;
      state.currentPage = 1;
    },

    /** Set the selected tag filter */
    setSelectedTag(state, action: PayloadAction<string | null>) {
      state.selectedTag = action.payload;
    },

    /** Set phone number filter list */
    setFilterPhoneNumbers(state, action: PayloadAction<string[]>) {
      state.filterPhoneNumbers = action.payload;
    },

    /** Set active right-panel icon */
    setActiveIcon(state, action: PayloadAction<string>) {
      state.activeIcon = action.payload;
    },

    /** Set pagination page */
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },

    /** Toggle mobile sidebar */
    setIsMobileSidebarOpen(state, action: PayloadAction<boolean>) {
      state.isMobileSidebarOpen = action.payload;
    },

    /** Reset entire inbox state (e.g. on unmount / navigation away) */
    resetInbox() {
      return initialState;
    },
  },
});

export const {
  setSelectedPhone,
  setSelectedContact,
  clearContactUnread,
  setSearchQuery,
  setActiveFilter,
  setSelectedTag,
  setFilterPhoneNumbers,
  setActiveIcon,
  setCurrentPage,
  setIsMobileSidebarOpen,
  resetInbox,
} = inboxSlice.actions;

export default inboxSlice.reducer;
