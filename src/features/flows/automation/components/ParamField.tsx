"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { IconButton, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MAX_CELLS, MAX_ROWS, insertToken, paramToText, parseParamInput, scalarMappingGroups, type MappingGroup } from "../steps";
import type { ParamDef } from "../types";
import MappingPicker from "./MappingPicker";
import SpreadsheetPicker from "./SpreadsheetPicker";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export default function ParamField({
  def,
  value,
  onChange,
  error,
  groups,
  disabled,
  appKey,
}: {
  def: ParamDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  groups: MappingGroup[];
  disabled?: boolean;
  appKey: string | null;
}) {
  const id = `param-${def.name}`;
  // Keep the raw text locally so partially typed numbers/JSON aren't lost.
  const [text, setText] = useState(() => paramToText(value));
  const [parseError, setParseError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const lastSent = useRef<unknown>(value);

  useEffect(() => {
    // External change (discard, server reload): resync the text.
    if (value !== lastSent.current) {
      setText(paramToText(value));
      setParseError(undefined);
      lastSent.current = value;
    }
  }, [value]);

  const commit = (next: string) => {
    setText(next);
    const parsed = parseParamInput(def, next);
    setParseError(parsed.error);
    if (!parsed.error) {
      lastSent.current = parsed.value;
      onChange(parsed.value);
    }
  };

  const insert = (token: string) => {
    const el = inputRef.current;
    const { text: next, caret } = insertToken(text, token, el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length);
    commit(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const shownError = parseError ?? error;
  const label = (
    <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
      {def.label}
      {def.required ? <span className="text-error">*</span> : <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
    </label>
  );
  const help = (
    <>
      {def.description && !shownError && <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>}
      {shownError && (
        <p className="mt-1 text-xs font-medium text-error" role="alert">
          {shownError}
        </p>
      )}
    </>
  );

  if (def.type === "values") {
    return (
      <div>
        {label}
        <RowsEditor value={value} onChange={onChange} groups={groups} disabled={disabled} />
        {help}
      </div>
    );
  }

  if (def.type === "boolean") {
    return (
      <div>
        <Select
          id={id}
          label={label}
          value={typeof value === "boolean" ? String(value) : ""}
          disabled={disabled}
          placeholder="Select…"
          options={[
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}
        />
        {help}
      </div>
    );
  }

  const multiline = def.type === "json" || def.type === "text";
  return (
    <div>
      {label}
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            id={id}
            ref={inputRef}
            rows={def.type === "json" ? 5 : 3}
            value={text}
            disabled={disabled}
            onChange={(e) => commit(e.target.value)}
            placeholder={def.placeholder}
            spellCheck={false}
            className={cn(inputClass, "h-auto py-2", def.type === "json" && "font-mono text-xs", shownError && "border-error")}
          />
        ) : (
          <input
            id={id}
            ref={inputRef}
            value={text}
            disabled={disabled}
            inputMode={def.type === "integer" || def.type === "number" ? "decimal" : undefined}
            onChange={(e) => commit(e.target.value)}
            placeholder={def.placeholder}
            className={cn(inputClass, shownError && "border-error")}
            aria-invalid={!!shownError}
          />
        )}
        <MappingPicker groups={def.type === "json" ? groups : scalarMappingGroups(groups)} onPick={insert} disabled={disabled} />
      </div>
      {appKey === "google-sheets" && def.name === "spreadsheet_id" && !disabled && (
        <SpreadsheetPicker onPick={(sheetId) => commit(sheetId)} />
      )}
      {help}
    </div>
  );
}

/** Grid editor for Google Sheets `values` (rows of primitive cells). */
function RowsEditor({
  value,
  onChange,
  groups,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  groups: MappingGroup[];
  disabled?: boolean;
}) {
  const rows: string[][] = Array.isArray(value) && value.every(Array.isArray)
    ? (value as unknown[][]).map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))))
    : [[""]];
  const width = Math.max(1, ...rows.map((r) => r.length));
  const [focus, setFocus] = useState<{ r: number; c: number; el: HTMLInputElement | null } | null>(null);

  const emit = (next: string[][]) => onChange(next);
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    next[r][c] = v;
    emit(next);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-border last:border-0">
                <td className="w-8 select-none bg-surface-muted px-2 text-center text-[11px] text-muted-foreground">{r + 1}</td>
                {Array.from({ length: width }).map((_, c) => (
                  <td key={c} className="min-w-[120px] border-l border-border p-0">
                    <input
                      value={row[c] ?? ""}
                      disabled={disabled}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      onFocus={(e) => setFocus({ r, c, el: e.currentTarget })}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className="h-9 w-full bg-transparent px-2 text-sm text-foreground outline-none focus:bg-primary/5"
                    />
                  </td>
                ))}
                <td className="w-9 border-l border-border p-0 text-center">
                  <IconButton
                    size="sm"
                    aria-label={`Remove row ${r + 1}`}
                    icon={<Minus size={13} />}
                    disabled={disabled || rows.length <= 1}
                    onClick={() => emit(rows.filter((_, i) => i !== r))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || rows.length >= MAX_ROWS}
          onClick={() => emit([...rows, Array(width).fill("")])}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          <Plus size={12} /> Row
        </button>
        <button
          type="button"
          disabled={disabled || width >= MAX_CELLS}
          onClick={() => emit(rows.map((row) => [...row, ...Array(width - row.length + 1).fill("")]))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          <Plus size={12} /> Column
        </button>
        <button
          type="button"
          disabled={disabled || width <= 1}
          onClick={() => emit(rows.map((row) => row.slice(0, width - 1)))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          <Minus size={12} /> Column
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {focus ? `Insert into row ${focus.r + 1}, column ${focus.c + 1}` : "Click a cell to insert a mapped value"}
          <MappingPicker
            groups={scalarMappingGroups(groups)}
            disabled={disabled || !focus}
            onPick={(token) => {
              if (!focus) return;
              const current = rows[focus.r]?.[focus.c] ?? "";
              const el = focus.el;
              const { text } = insertToken(current, token, el?.selectionStart ?? current.length, el?.selectionEnd ?? current.length);
              setCell(focus.r, focus.c, text);
            }}
          />
        </div>
      </div>
    </div>
  );
}
