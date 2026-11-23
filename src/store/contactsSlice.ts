import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactFilters {
  searchNamePhone: string;
  createdDate: string;
  reminderDate: string;
  assignedDate: string;
  source: string[];
  assigned_to: string[];
  tags: string[];
  optInStatus: "all" | string;
  duplicate: "all" | string;
  showUnassignedOnly: boolean;
  filterGroups: any[];
}

interface ContactsState {
  /** Debounced search query sent to the API */
  searchQuery: string;

  /** Current page for the paginated contacts table */
  currentPage: number;

  /** ID + name of the contact whose side-panel is open (null = closed) */
  selectedContactId: string | null;
  selectedContactName: string | null;

  /** Whether the contact details panel is in edit mode */
  isEditMode: boolean;

  /** IDs of rows selected via checkboxes */
  selectedIds: string[];

  // ── Modal / dropdown visibility ───────────────────────────────────────────
  showForm: boolean;
  showImport: boolean;
  showExport: boolean;
  /** When true the filter modal is open — this is also the signal that
   *  causes the tags RTK-Query hook to fire (skip: !showFilters) */
  showFilters: boolean;
  showCreateColumn: boolean;
  showColumnsDropdown: boolean;
  showMobileBulkActions: boolean;

  // ── Column selector ───────────────────────────────────────────────────────
  selectedColumns: string[];
  columnSearch: string;

  // ── Create-contact form ───────────────────────────────────────────────────
  selectedCountryCode: string;

  // ── Filters ───────────────────────────────────────────────────────────────
  filters: ContactFilters;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS = ["CREATED AT", "NAME", "PHONE NO", "SOURCE", "TAGS", "EMAIL", "STATUS", "ACTIONS"];

const DEFAULT_FILTERS: ContactFilters = {
  searchNamePhone: "",
  createdDate: "",
  reminderDate: "",
  assignedDate: "",
  source: [],
  assigned_to: [],
  tags: [],
  optInStatus: "all",
  duplicate: "all",
  showUnassignedOnly: false,
  filterGroups: [],
};

const initialState: ContactsState = {
  searchQuery: "",
  currentPage: 1,
  selectedContactId: null,
  selectedContactName: null,
  isEditMode: false,
  selectedIds: [],
  showForm: false,
  showImport: false,
  showExport: false,
  showFilters: false,
  showCreateColumn: false,
  showColumnsDropdown: false,
  showMobileBulkActions: false,
  selectedColumns: DEFAULT_COLUMNS,
  columnSearch: "",
  selectedCountryCode: "+91",
  filters: DEFAULT_FILTERS,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const contactsSlice = createSlice({
  name: "contacts",
  initialState,
  reducers: {
    /** Update the search query and reset to page 1 */
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
      state.currentPage = 1;
    },

    /** Change the current page */
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },

    /** Open the contact details side-panel */
    setSelectedContact(
      state,
      action: PayloadAction<{ id: string; name: string } | null>
    ) {
      state.selectedContactId = action.payload?.id ?? null;
      state.selectedContactName = action.payload?.name ?? null;
    },

    /** Toggle edit mode in the contact details panel */
    toggleEditMode(state) {
      state.isEditMode = !state.isEditMode;
    },

    setEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
    },

    // ── Row selection ────────────────────────────────────────────────────────

    toggleId(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter((v) => v !== id);
      } else {
        state.selectedIds.push(id);
      }
    },

    selectAllIds(state, action: PayloadAction<string[]>) {
      state.selectedIds = action.payload;
    },

    clearSelection(state) {
      state.selectedIds = [];
    },

    // ── Modal / dropdown visibility ──────────────────────────────────────────

    setShowForm(state, action: PayloadAction<boolean>) {
      state.showForm = action.payload;
    },

    setShowImport(state, action: PayloadAction<boolean>) {
      state.showImport = action.payload;
    },

    setShowExport(state, action: PayloadAction<boolean>) {
      state.showExport = action.payload;
    },

    /** Opening the filter modal also triggers the tags API call
     *  because useGetContactTagsQuery uses `skip: !showFilters` */
    setShowFilters(state, action: PayloadAction<boolean>) {
      state.showFilters = action.payload;
    },

    setShowCreateColumn(state, action: PayloadAction<boolean>) {
      state.showCreateColumn = action.payload;
    },

    setShowColumnsDropdown(state, action: PayloadAction<boolean>) {
      state.showColumnsDropdown = action.payload;
    },

    setShowMobileBulkActions(state, action: PayloadAction<boolean>) {
      state.showMobileBulkActions = action.payload;
    },

    // ── Column selector ──────────────────────────────────────────────────────

    toggleColumn(state, action: PayloadAction<string>) {
      const col = action.payload;
      if (state.selectedColumns.includes(col)) {
        state.selectedColumns = state.selectedColumns.filter((c) => c !== col);
      } else {
        state.selectedColumns.push(col);
      }
    },

    resetColumns(state) {
      state.selectedColumns = [];
    },

    setColumnSearch(state, action: PayloadAction<string>) {
      state.columnSearch = action.payload;
    },

    // ── Country code ─────────────────────────────────────────────────────────

    setSelectedCountryCode(state, action: PayloadAction<string>) {
      state.selectedCountryCode = action.payload;
    },

    // ── Filters ──────────────────────────────────────────────────────────────

    setFilterField<K extends keyof ContactFilters>(
      state: ContactsState,
      action: PayloadAction<{ key: K; value: ContactFilters[K] }>
    ) {
      (state.filters[action.payload.key] as ContactFilters[K]) =
        action.payload.value;
    },

    resetFilters(state) {
      state.filters = DEFAULT_FILTERS;
      state.showFilters = false;
    },

    // ── Full reset (on unmount) ───────────────────────────────────────────────

    resetContacts() {
      return initialState;
    },
  },
});

export const {
  setSearchQuery,
  setCurrentPage,
  setSelectedContact,
  toggleEditMode,
  setEditMode,
  toggleId,
  selectAllIds,
  clearSelection,
  setShowForm,
  setShowImport,
  setShowExport,
  setShowFilters,
  setShowCreateColumn,
  setShowColumnsDropdown,
  setShowMobileBulkActions,
  toggleColumn,
  resetColumns,
  setColumnSearch,
  setSelectedCountryCode,
  setFilterField,
  resetFilters,
  resetContacts,
} = contactsSlice.actions;

export default contactsSlice.reducer;
