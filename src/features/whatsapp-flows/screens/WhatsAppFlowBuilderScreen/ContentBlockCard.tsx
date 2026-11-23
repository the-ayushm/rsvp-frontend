"use client";

import { useState } from "react";
import { GripVertical, Trash2, Copy, ChevronDown, ChevronRight, Settings, Plus, X } from "lucide-react";
import type { ContentBlock, BlockType } from "./types";
import { BLOCK_TYPE_LABELS, getBlockDisplayText } from "./types";

interface ContentBlockCardProps {
  block: ContentBlock;
  index: number;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onUpdate: (index: number, patch: Partial<ContentBlock>) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
}

export function ContentBlockCard({
  block,
  index,
  isDragging,
  onDragStart,
  onDrop,
  onUpdate,
  onRemove,
  onDuplicate,
}: ContentBlockCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => onDrop(e, index)}
      className={`rounded-md border bg-surface p-4 hover:bg-surface-muted dark:bg-surface/5 dark:hover:bg-surface-hover dark:border-border transition-colors ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="cursor-grab active:cursor-grabbing text-muted-foreground dark:text-muted-foreground shrink-0" title="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground dark:text-foreground truncate">
            {BLOCK_TYPE_LABELS[block.type]}
          </p>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
            {getBlockDisplayText(block)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDuplicate(index)}
          className="p-1.5 rounded text-muted-foreground hover:text-[var(--color-primary)] hover:bg-info-bg dark:hover:bg-surface-active shrink-0"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded text-muted-foreground hover:bg-surface-hover dark:hover:bg-surface-active shrink-0"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 rounded text-muted-foreground hover:text-error hover:bg-error-bg dark:hover:bg-error-bg/20 shrink-0"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded text-muted-foreground hover:bg-surface-hover dark:hover:bg-surface-active shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border dark:border-border space-y-3">
          {block.type === "heading" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Text</label>
              <input
                value={block.text ?? block.label ?? ""}
                onChange={(e) => onUpdate(index, { text: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                placeholder="Heading text"
              />
            </div>
          )}
          {block.type === "paragraph" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Text</label>
              <input
                value={block.label ?? block.text ?? ""}
                onChange={(e) => onUpdate(index, { label: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                placeholder="Paragraph content"
              />
            </div>
          )}
          {["text_input", "number_input", "radio", "dropdown", "checkbox", "date", "button"].includes(block.type) && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Label</label>
              <input
                value={block.label ?? ""}
                onChange={(e) => onUpdate(index, { label: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                placeholder="Label"
              />
            </div>
          )}
          {(block.type === "text_input" || block.type === "paragraph") && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Placeholder</label>
              <input
                value={block.placeholder ?? ""}
                onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                placeholder="Optional"
              />
            </div>
          )}
          {block.type === "paragraph" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Max length</label>
              <input
                type="number"
                min={1}
                max={4096}
                value={block.maxLength ?? 600}
                onChange={(e) => onUpdate(index, { maxLength: parseInt(e.target.value, 10) || 600 })}
                className="w-full px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
              />
            </div>
          )}
          {(block.type === "text_input" || block.type === "number_input" || block.type === "paragraph" || block.type === "date") && (
            <label className="flex items-center gap-2 text-sm text-secondary-foreground dark:text-secondary-foreground">
              <input
                type="checkbox"
                checked={!!block.required}
                onChange={(e) => onUpdate(index, { required: e.target.checked })}
                className="rounded border-border-strong"
              />
              Required
            </label>
          )}
          {(block.type === "radio" || block.type === "dropdown" || block.type === "checkbox") && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Options</label>
              {(block.options ?? []).map((opt, i) => (
                <div key={i} className="flex gap-2 mb-1 items-center">
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...(block.options ?? [])];
                      next[i] = { ...next[i], label: e.target.value, value: next[i].value || e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20) || `opt_${i}` };
                      onUpdate(index, { options: next });
                    }}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                    placeholder="Option label"
                  />
                  <input
                    value={opt.value}
                    onChange={(e) => {
                      const next = [...(block.options ?? [])];
                      next[i] = { ...next[i], value: e.target.value };
                      onUpdate(index, { options: next });
                    }}
                    className="w-24 px-2 py-2 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised"
                    placeholder="Value"
                    title="Value (for form submission)"
                  />
                  {(block.options?.length ?? 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = (block.options ?? []).filter((_, j) => j !== i);
                        onUpdate(index, { options: next });
                      }}
                      className="p-1.5 rounded text-muted-foreground hover:text-error hover:bg-error-bg dark:hover:bg-surface-active shrink-0"
                      title="Remove option"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const current = block.options ?? [];
                  const num = current.length + 1;
                  const next = [...current, { value: `opt${num}`, label: `Option ${num}` }];
                  onUpdate(index, { options: next });
                }}
                className="mt-1 flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-primary)] dark:text-info hover:bg-info-bg dark:hover:bg-info-bg/20 rounded-md border border-dashed border-border-strong dark:border-border"
              >
                <Plus className="w-4 h-4" />
                Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
