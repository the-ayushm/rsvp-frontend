import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BroadcastContact = {
  id: string;
  name: string;
  phone: string;
  phone_number?: string;
  country_code?: string | null;
};

export type ImportedContact = {
  name: string;
  phone: string;
};

type BroadcastStore = {
  selectedContacts: BroadcastContact[];
  setSelectedContacts: (contacts: BroadcastContact[]) => void;
  clearSelectedContacts: () => void;

  /** Contacts imported from a CSV/Excel file, to be pre-loaded into a new broadcast */
  importedContacts: ImportedContact[];
  setImportedContacts: (contacts: ImportedContact[]) => void;
  clearImportedContacts: () => void;

  /** The list name associated with the import, shown as context on the campaign page */
  importedListName: string;
  setImportedListName: (name: string) => void;
};

export const useBroadcastStore = create<BroadcastStore>()(
  persist(
    (set) => ({
      selectedContacts: [],
      setSelectedContacts: (contacts) => set({ selectedContacts: contacts }),
      clearSelectedContacts: () => set({ selectedContacts: [] }),

      importedContacts: [],
      setImportedContacts: (contacts) => set({ importedContacts: contacts }),
      clearImportedContacts: () => set({ importedContacts: [], importedListName: "" }),

      importedListName: "",
      setImportedListName: (name) => set({ importedListName: name }),
    }),
    {
      name: "broadcast-import-handoff",
      partialize: (state) => ({
        selectedContacts: state.selectedContacts,
        importedContacts: state.importedContacts,
        importedListName: state.importedListName,
      }),
    },
  ),
);
