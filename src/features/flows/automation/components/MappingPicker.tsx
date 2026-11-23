"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Braces, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MappingGroup } from "../steps";

/** "{ }" button that inserts {{trigger…}} / {{steps…}} tokens. */
export default function MappingPicker({
  groups,
  onPick,
  disabled,
  hint,
}: {
  groups: MappingGroup[];
  onPick: (token: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Rendered in a portal with fixed positioning so scroll containers and the
  // test panel can't clip it; opens upward when there isn't room below.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 4;
      const below = window.innerHeight - r.bottom - gap - 8;
      const above = r.top - gap - 8;
      const up = below < 340 && above > below;
      const right = Math.max(8, window.innerWidth - r.right);
      setPos(
        up
          ? { position: "fixed", right, bottom: window.innerHeight - r.top + gap, maxHeight: above }
          : { position: "fixed", right, top: r.bottom + gap, maxHeight: below },
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.token.toLowerCase().includes(q)) }))
        .filter((g) => g.options.length > 0 || (!q && g.emptyHint)),
    [groups, q],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault() /* keep the input's caret */}
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert mapped value"
        aria-expanded={open}
        title="Insert a value from the trigger or an earlier step"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:border-primary/50 hover:text-primary-text disabled:opacity-50"
      >
        <Braces size={15} />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          style={pos}
          className="z-[60] flex w-[min(340px,80vw)] flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3">
            <Search size={14} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-72 min-h-0 overflow-y-auto p-1">
            {hint && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{hint}</p>}
            {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matching fields.</p>}
            {filtered.map((g) => (
              <div key={g.id} className="mb-1">
                <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.title}</p>
                {g.options.length === 0 && g.emptyHint && <p className="px-2 pb-1 text-[11px] text-muted-foreground">{g.emptyHint}</p>}
                {g.options.map((o) => (
                  <button
                    key={o.token}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(o.token);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-hover")}
                  >
                    <span className="min-w-0 truncate font-mono text-xs text-foreground">{o.label}</span>
                    {o.preview !== undefined && <span className="max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground">{o.preview}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
