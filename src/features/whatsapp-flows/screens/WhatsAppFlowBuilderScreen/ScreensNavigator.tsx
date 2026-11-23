"use client";

import { useState, useCallback } from "react";
import { GripVertical, X, Plus, Copy } from "lucide-react";
import type { FlowScreen } from "./types";
import { createScreen } from "./types";

interface ScreensNavigatorProps {
  screens: FlowScreen[];
  selectedIndex: number;
  onScreensChange: (screens: FlowScreen[]) => void;
  onSelectScreen: (index: number) => void;
}

export function ScreensNavigator({
  screens,
  selectedIndex,
  onScreensChange,
  onSelectScreen,
}: ScreensNavigatorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const updateTitles = useCallback((list: FlowScreen[]) => {
    return list.map((s, i) => ({ ...s, title: s.title.replace(/^Screen \d+/, `Screen ${i + 1}`) }));
  }, []);

  const handleAdd = useCallback(() => {
    const next = [...screens, createScreen(screens.length)];
    onScreensChange(updateTitles(next));
    onSelectScreen(screens.length);
  }, [screens, onScreensChange, onSelectScreen, updateTitles]);

  const handleDelete = useCallback(
    (index: number) => {
      const next = screens.filter((_, i) => i !== index);
      onScreensChange(updateTitles(next));
      if (selectedIndex >= next.length) onSelectScreen(Math.max(0, next.length - 1));
      else if (selectedIndex >= index) onSelectScreen(selectedIndex - 1);
      else onSelectScreen(selectedIndex);
    },
    [screens, selectedIndex, onScreensChange, onSelectScreen, updateTitles]
  );

  const handleDuplicate = useCallback(
    (index: number) => {
      const src = screens[index];
      if (!src) return;
      const copy: FlowScreen = {
        ...src,
        id: `screen_${Date.now()}`,
        title: `${src.title} (copy)`,
        blocks: src.blocks.map((b) => ({
          ...b,
          id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          options: b.options?.map((o) => ({ ...o })),
        })),
      };
      const next = [...screens];
      next.splice(index + 1, 0, copy);
      onScreensChange(updateTitles(next));
      onSelectScreen(index + 1);
    },
    [screens, onScreensChange, onSelectScreen, updateTitles]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/screen-index", String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDraggedIndex(null);
    const from = Number(e.dataTransfer.getData("application/screen-index"));
    if (Number.isNaN(from) || from === dropIndex) return;
    const next = [...screens];
    const [removed] = next.splice(from, 1);
    next.splice(dropIndex, 0, removed);
    onScreensChange(updateTitles(next));
    onSelectScreen(dropIndex);
  };

  return (
    <div className="w-[260px] shrink-0 flex flex-col bg-surface dark:bg-surface border border-border dark:border-border-subtle rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border dark:border-border-subtle">
        <h2 className="text-sm font-semibold text-foreground dark:text-foreground">Screens</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {screens.map((screen, index) => (
          <div
            key={screen.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={() => setDraggedIndex(null)}
            onClick={() => onSelectScreen(index)}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-md border cursor-grab active:cursor-grabbing
              transition-colors
              ${selectedIndex === index
                ? "bg-info-bg dark:bg-info-bg/30 border-info-border dark:border-info-border"
                : "bg-surface dark:bg-surface border-border dark:border-border hover:bg-surface-muted dark:hover:bg-surface-raised"
              }
              ${draggedIndex === index ? "opacity-50" : ""}
            `}
          >
            <span className="text-muted-foreground shrink-0 touch-none" onPointerDown={(e) => e.stopPropagation()}>
              <GripVertical className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0 text-sm font-medium text-foreground dark:text-foreground truncate">
              {screen.title}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDuplicate(index); }}
              className="p-1 rounded text-muted-foreground hover:text-[var(--color-primary)] hover:bg-info-bg dark:hover:bg-surface-active shrink-0"
              title="Duplicate screen"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
              className="p-1 rounded text-muted-foreground hover:text-error hover:bg-error-bg dark:hover:bg-error-bg/20 shrink-0"
              aria-label="Delete screen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[var(--color-primary)] dark:text-info hover:bg-info-bg dark:hover:bg-info-bg/30 rounded-md border border-dashed border-border-strong dark:border-border transition"
        >
          <Plus className="w-4 h-4" />
          Add Screen
        </button>
      </div>
    </div>
  );
}
