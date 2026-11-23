"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronRight } from "lucide-react";
import type { BlockType } from "./types";
import { ADD_CONTENT_GROUPS, BLOCK_TYPE_LABELS } from "./types";

interface AddContentDropdownProps {
  onAdd: (type: BlockType) => void;
  disabled?: boolean;
}

export function AddContentDropdown({ onAdd, disabled }: AddContentDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border dark:border-border text-muted-foreground hover:border-border-strong hover:text-secondary-foreground dark:hover:text-muted-foreground disabled:opacity-50 transition"
      >
        <Plus className="w-4 h-4" />
        Add Content
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 py-2 rounded-lg border border-border dark:border-border bg-surface dark:bg-surface shadow-lg z-20">
          {ADD_CONTENT_GROUPS.map(({ group, types }) => (
            <div key={group}>
              <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                {group}
              </p>
              {types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { onAdd(type); setOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-foreground dark:text-foreground hover:bg-surface-muted dark:hover:bg-surface-raised"
                >
                  {BLOCK_TYPE_LABELS[type]}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
