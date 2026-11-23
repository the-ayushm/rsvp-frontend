"use client";

import { useState } from "react";
import { FileSpreadsheet, FolderOpen } from "lucide-react";
import toast from "react-hot-toast";
import { Button, EmptyState, Modal, Spinner } from "@/components/ui";
import { googleSheetsApi, googleSheetsErrorMessage, type GoogleSheetsSetup } from "@/features/integrations/google-sheets/api";
import { pickSpreadsheet } from "@/features/integrations/google-sheets/picker";

let setupCache: Promise<GoogleSheetsSetup> | null = null;

/** Picker settings (browser API key + project number) come from /setup. */
async function pickWithGoogle(): Promise<string | null> {
  setupCache ??= googleSheetsApi.setup().catch((err) => {
    setupCache = null;
    throw err;
  });
  const picked = await pickSpreadsheet(await setupCache);
  return picked?.id ?? null;
}

export default function SpreadsheetPicker({ onPick }: { onPick: (spreadsheetId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const openList = async () => {
    setOpen(true);
    setItems(null);
    setError(null);
    try {
      setItems((await googleSheetsApi.spreadsheets()).items);
    } catch (err) {
      setError(googleSheetsErrorMessage(err));
      setItems([]);
    }
  };

  const google = async () => {
    // Google Picker is its own dialog; our modal would sit on top of it and block clicks.
    const reopen = open;
    setOpen(false);
    setPicking(true);
    try {
      const id = await pickWithGoogle();
      if (id) onPick(id);
      else if (reopen) setOpen(true);
    } catch (err) {
      toast.error(googleSheetsErrorMessage(err));
    } finally {
      setPicking(false);
    }
  };

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" leftIcon={<FileSpreadsheet size={14} />} onClick={() => void openList()}>
          Choose spreadsheet
        </Button>
        <Button size="sm" variant="ghost" leftIcon={<FolderOpen size={14} />} isLoading={picking} onClick={() => void google()}>
          Pick from Google Drive
        </Button>
      </div>
      <Modal isOpen={open} onClose={() => setOpen(false)} size="md" title="Choose a spreadsheet" description="Spreadsheets this connection can access.">
        {items === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            title={error ? "Couldn't load spreadsheets" : "No spreadsheets available yet"}
            description={error ?? "With Google's drive.file permission, pick an existing spreadsheet from Google Drive to grant access to it."}
            action={
              <Button size="sm" leftIcon={<FolderOpen size={14} />} isLoading={picking} onClick={() => void google()}>
                Pick from Google Drive
              </Button>
            }
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {items.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-hover"
                >
                  <FileSpreadsheet size={16} className="shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.name}</span>
                  <span className="max-w-[40%] truncate font-mono text-[10px] text-muted-foreground">{s.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
