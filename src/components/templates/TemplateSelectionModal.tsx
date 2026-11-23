"use client";

import { useState } from "react";
import { Search, X, Check, MessageSquare, LayoutTemplate } from "lucide-react";

export type ApiTemplate = {
  id: string;
  name: string;
  category: string;
  components: any[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: ApiTemplate) => void;
  selectedTemplateId?: string;
  templates: ApiTemplate[];
};

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  UTILITY:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  AUTHENTICATION:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function getCategoryStyle(category: string) {
  return (
    CATEGORY_COLORS[category.toUpperCase()] ??
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="
          bg-white dark:bg-[#0d1117]
          w-full max-w-3xl rounded-2xl
          shadow-[0_25px_60px_rgba(0,0,0,0.35)]
          flex flex-col
          h-[82vh]
          border border-gray-200 dark:border-[#1f2937]
          overflow-hidden
        "
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(to right, var(--color-primary-dark), var(--color-primary))' }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 opacity-90" />
            Select Template
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="px-5 py-3 flex gap-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#111827]">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates…"
              className="
                w-full pl-9 pr-4 py-2 text-sm
                bg-white dark:bg-[#1c2635]
                border border-gray-200 dark:border-gray-700
                rounded-xl
                text-gray-800 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400
                transition
              "
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="
                appearance-none pl-3 pr-8 py-2 text-sm
                bg-white dark:bg-[#1c2635]
                border border-gray-200 dark:border-gray-700
                rounded-xl
                text-gray-800 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400
                transition cursor-pointer
              "
            >
              <option value="all">All</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Template Grid ── */}
        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-3 bg-white dark:bg-[#0d1117]">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600 gap-3">
              <MessageSquare className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">No templates found</p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <div
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className={`
                    group relative p-4 rounded-xl border-2 cursor-pointer
                    transition-all duration-150
                    ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-emerald-50 dark:bg-emerald-900/20 shadow-md shadow-emerald-100 dark:shadow-emerald-900/20"
                        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-50 dark:hover:border-emerald-700 dark:hover:shadow-emerald-900/10"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm truncate ${isSelected ? "text-gray-900" : "text-gray-800 dark:text-white"}`}>
                        {template.name}
                      </h3>
                      <span
                        className={`
                          inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${getCategoryStyle(template.category)}
                        `}
                      >
                        {template.category}
                      </span>
                    </div>

                    {isSelected ? (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    ) : (
                      <div className="shrink-0 w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-700 group-hover:border-emerald-400 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#111827] flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} found
          </span>
          <button
            onClick={onClose}
            className="
              px-5 py-2 text-sm font-semibold rounded-xl
              bg-white dark:bg-[#1c2635]
              border border-gray-200 dark:border-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
            "
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}