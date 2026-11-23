"use client";

import { Copy } from "lucide-react";
import type { FlowScreen, ContentBlock } from "./types";

interface WhatsAppPreviewProps {
  screen: FlowScreen | null;
  onCopyJson: () => void;
}

const wa = {
  bg: "var(--color-surface-active)",
  card: "var(--bubble-in-bg)",
  border: "var(--color-border)",
  text: "var(--bubble-in-text)",
  muted: "var(--bubble-in-meta)",
  green: "var(--color-primary-text)",
};

export function WhatsAppPreview({ screen, onCopyJson }: WhatsAppPreviewProps) {
  const renderBlock = (block: ContentBlock) => {
    const label = block.label ?? block.text ?? block.type;
    switch (block.type) {
      case "heading":
        return (
          <h2 className="text-base font-semibold mb-1" style={{ color: wa.text }}>
            {block.text ?? block.label ?? "Heading"}
          </h2>
        );
      case "paragraph":
        return (
          <div className="mb-3">
            <p className="text-sm mb-1" style={{ color: wa.text }}>{block.label ?? block.text ?? ""}</p>
            <div
              className="px-2.5 py-2 rounded-lg text-sm min-h-[60px] border flex items-start"
              style={{ background: wa.card, borderColor: wa.border, color: wa.muted }}
            >
              {block.placeholder ?? "Leave a comment (optional)"}
            </div>
            {block.maxLength != null && (
              <span className="text-[10px]" style={{ color: wa.muted }}>0 / {block.maxLength}</span>
            )}
          </div>
        );
      case "text_input":
        return (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: wa.text }}>
              {label} {block.required && "*"}
            </label>
            <div
              className="px-2.5 py-2 rounded-lg text-sm min-h-[40px] border"
              style={{ background: wa.card, borderColor: wa.border, color: wa.muted }}
            >
              {block.placeholder ?? "Type here..."}
            </div>
            {block.maxLength != null && (
              <span className="text-[10px] block text-right mt-0.5" style={{ color: wa.muted }}>0 / {block.maxLength}</span>
            )}
          </div>
        );
      case "number_input":
        return (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: wa.text }}>
              {label} {block.required && "*"}
            </label>
            <div
              className="px-2.5 py-2 rounded-lg text-sm min-h-[40px] border"
              style={{ background: wa.card, borderColor: wa.border, color: wa.muted }}
            >
              0
            </div>
          </div>
        );
      case "radio":
        return (
          <div className="mb-3">
            <h2 className="text-base font-semibold mb-0.5" style={{ color: wa.text }}>{label}</h2>
            <p className="text-xs mb-2" style={{ color: wa.muted }}>Choose one</p>
            <div className="space-y-1.5">
              {(block.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm" style={{ color: wa.text }}>
                  <input type="radio" name={block.id} readOnly className="accent-emerald-600" />
                  {o.label || o.value}
                </label>
              ))}
            </div>
          </div>
        );
      case "dropdown":
        return (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: wa.text }}>{label}</label>
            <div
              className="px-2.5 py-2 rounded-lg text-sm border"
              style={{ background: wa.card, borderColor: wa.border, color: wa.muted }}
            >
              Select...
            </div>
          </div>
        );
      case "checkbox":
        return (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: wa.text }}>{label}</label>
            <div className="space-y-1.5">
              {(block.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm" style={{ color: wa.text }}>
                  <input type="checkbox" readOnly className="accent-emerald-600 rounded" />
                  {o.label || o.value}
                </label>
              ))}
            </div>
          </div>
        );
      case "date":
        return (
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: wa.text }}>{label}</label>
            <div
              className="px-2.5 py-2 rounded-lg text-sm border min-h-[40px]"
              style={{ background: wa.card, borderColor: wa.border, color: wa.muted }}
            >
              DD/MM/YYYY
            </div>
          </div>
        );
      case "button":
        return null;
      default:
        return null;
    }
  };

  const buttonBlock = screen?.blocks?.find((b) => b.type === "button");
  const contentBlocks = screen?.blocks?.filter((b) => b.type !== "button") ?? [];

  return (
    <div className="w-[380px] shrink-0 flex flex-col h-full min-h-0 bg-surface dark:bg-surface border border-border dark:border-border-subtle rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border dark:border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground dark:text-foreground">Preview</h2>
        <button
          type="button"
          onClick={onCopyJson}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-secondary-foreground dark:text-muted-foreground hover:bg-surface-hover dark:hover:bg-surface-raised rounded-md transition"
        >
          <Copy className="w-4 h-4" />
          Copy Flow JSON
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 flex justify-center">
        <div className="rounded-xl shadow-lg bg-[var(--neutral-800)] p-2 w-full max-w-[320px]">
          <div
            className="min-h-[420px] max-h-[520px] overflow-hidden rounded-xl flex flex-col"
            style={{ background: wa.bg }}
          >
            <div
              className="flex items-center justify-between px-3 py-2.5 shrink-0 border-b"
              style={{ background: wa.card, borderColor: wa.border }}
            >
              <span className="w-6 text-center text-secondary-foreground">✕</span>
              <span className="flex-1 text-center text-sm font-semibold truncate" style={{ color: wa.text }}>
                {screen?.title ?? "Screen title"}
              </span>
              <span className="w-6 text-center text-secondary-foreground">⋮</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3" style={{ background: wa.bg }}>
              {!screen ? (
                <p className="text-sm text-muted-foreground text-center py-8">Add a screen to preview</p>
              ) : contentBlocks.length === 0 && !buttonBlock ? (
                <p className="text-sm text-muted-foreground text-center py-8">Add content blocks</p>
              ) : (
                contentBlocks.map((block) => (
                  <div key={block.id}>{renderBlock(block)}</div>
                ))
              )}
            </div>
            <div
              className="p-3 border-t shrink-0"
              style={{ background: wa.card, borderColor: wa.border }}
            >
              {screen && (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white opacity-70"
                  style={{ background: wa.green }}
                >
                  {buttonBlock?.label ?? "Continue"}
                </button>
              )}
              <p className="text-[10px] text-center mt-1.5" style={{ color: wa.muted }}>
                Managed by the business. <span style={{ color: wa.green }}>Learn more</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
