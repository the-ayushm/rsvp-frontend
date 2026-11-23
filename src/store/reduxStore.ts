import { configureStore } from "@reduxjs/toolkit";
import { inboxApi } from "./inboxApi";
import inboxReducer from "./inboxSlice";
import { contactsApi } from "./contactsApi";
import contactsReducer from "./contactsSlice";

// ─── Redux Store ──────────────────────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    /** Inbox UI state (selectedPhone, selectedContact, filters, etc.) */
    inbox: inboxReducer,

    /** RTK Query cache for all inbox API endpoints */
    [inboxApi.reducerPath]: inboxApi.reducer,

    /** Contacts UI state (search, pagination, modals, column visibility, etc.) */
    contacts: contactsReducer,

    /** RTK Query cache for contacts API endpoints (lazy — fire only when needed) */
    [contactsApi.reducerPath]: contactsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(inboxApi.middleware)
      .concat(contactsApi.middleware),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
