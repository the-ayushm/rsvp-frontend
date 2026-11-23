/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Search, X, Check, MessageSquare, LayoutTemplate } from "lucide-react";

export type ApiTemplate = {
  language: string;
  id: string;
  name: string;
  category: string;
  status: string;
  components: any[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: ApiTemplate) => void;
  selectedTemplateId?: string;
  templates: ApiTemplate[];
};

// Warm Editorial category badge styles
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MARKETING:      { bg: "var(--color-primary-light)", text: "var(--color-primary-text)", border: "var(--color-primary-soft)" },
  UTILITY:        { bg: "var(--color-info-bg)", text: "var(--color-info)", border: "var(--color-info-border)" },
  AUTHENTICATION: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", border: "var(--color-warning-border)" },
};

function getCategoryStyle(category: string) {
  return (
    CATEGORY_COLORS[category.toUpperCase()] ?? {
      bg: "rgba(var(--color-primary-rgb), 0.12)",
      text: "var(--color-primary-text)",
      border: "rgba(var(--color-primary-rgb), 0.25)",
    }
  );
}

export default function TemplateSelectionModal({
  isOpen,
  onClose,
  onSelect,
  selectedTemplateId,
  templates,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const filteredTemplates = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      filterCategory === "all" ||
      t.category.toLowerCase() === filterCategory.toLowerCase();
    return matchSearch && matchCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: "var(--color-surface-muted)", opacity: 1 }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ backgroundColor: "var(--color-surface-active)" }}
        >
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-foreground m-0">
              Select Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-theme-main hover:bg-black/5 transition cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div
          className="flex gap-3 px-6 py-3.5 border-b border-border"
          style={{ backgroundColor: "var(--color-surface-muted)" }}
        >
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-surface border border-black/15 rounded-xl text-foreground font-medium placeholder:text-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition shadow-2xs"
            />
          </div>

          {/* Category Filter */}
          <div className="relative shrink-0">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 text-xs bg-surface border border-black/15 rounded-xl text-foreground font-semibold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 cursor-pointer pr-9 appearance-none shadow-2xs"
            >
              <option value="all">All Categories</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Template Grid ── */}
        <div
          className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 auto-rows-max"
          style={{ backgroundColor: "var(--color-surface-muted)" }}
        >
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-40" />
              <p className="text-xs font-semibold m-0">No templates found matching your search</p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              const catStyle = getCategoryStyle(template.category);
              return (
                <div
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 border shadow-xs ${
 isSelected
 ? "border-primary bg-primary-light ring-1 ring-accent"
 : "border-black/10 bg-surface hover:border-accent/50 hover:shadow-sm"
 }`}
                >
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-bold truncate m-0 mb-1.5"
                      style={{
                        color: "var(--color-text)",
                        fontFamily: "var(--font-sans), 'Inter', system-ui, sans-serif",
                      }}
                    >
                      {template.name}
                    </h3>
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: catStyle.bg,
                        color: catStyle.text,
                        border: `1px solid ${catStyle.border}`,
                        fontFamily: "var(--font-sans), 'Inter', system-ui, sans-serif",
                      }}
                    >
                      {template.category}
                    </span>
                  </div>

                  {/* Selection Indicator Circle */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-accent text-primary-foreground shadow-sm"
                        : "border border-black/20 text-transparent"
                    }`}
                    style={isSelected ? { backgroundColor: "var(--color-primary)" } : {}}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between px-6 py-3.5 border-t border-border"
          style={{ backgroundColor: "var(--color-surface-active)" }}
        >
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredTemplates.length} templates found
          </span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs h-8 px-3 text-[0.8125rem]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
