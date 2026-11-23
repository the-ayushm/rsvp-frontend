"use client";

import { useCallback, useState } from "react";
import type { FlowScreen, ContentBlock, BlockType } from "./types";
import { createBlock } from "./types";
import { ContentBlockCard } from "./ContentBlockCard";
import { AddContentDropdown } from "./AddContentDropdown";

interface ContentBuilderProps {
  screen: FlowScreen | null;
  onScreenChange: (screen: FlowScreen) => void;
}

export function ContentBuilder({ screen, onScreenChange }: ContentBuilderProps) {
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

  const updateBlocks = useCallback(
    (blocks: ContentBlock[]) => {
      if (!screen) return;
      onScreenChange({ ...screen, blocks });
    },
    [screen, onScreenChange]
  );

  const addBlock = useCallback(
    (type: BlockType) => {
      if (!screen) return;
      updateBlocks([...screen.blocks, createBlock(type)]);
    },
    [screen, updateBlocks]
  );

  const removeBlock = useCallback(
    (index: number) => {
      if (!screen) return;
      updateBlocks(screen.blocks.filter((_, i) => i !== index));
    },
    [screen, updateBlocks]
  );

  const duplicateBlock = useCallback(
    (index: number) => {
      if (!screen) return;
      const b = screen.blocks[index];
      const copy: ContentBlock = {
        ...b,
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        options: b.options?.map((o) => ({ ...o })),
      };
      const next = [...screen.blocks];
      next.splice(index + 1, 0, copy);
      updateBlocks(next);
    },
    [screen, updateBlocks]
  );

  const updateBlock = useCallback(
    (index: number, patch: Partial<ContentBlock>) => {
      if (!screen) return;
      const next = screen.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
      updateBlocks(next);
    },
    [screen, updateBlocks]
  );

  const handleBlockDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.setData("application/block-index", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBlockDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDraggedBlockIndex(null);
    if (!screen) return;
    const from = Number(e.dataTransfer.getData("application/block-index"));
    if (Number.isNaN(from) || from === dropIndex) return;
    const next = [...screen.blocks];
    const [removed] = next.splice(from, 1);
    next.splice(dropIndex, 0, removed);
    updateBlocks(next);
  };

  if (!screen) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-muted dark:bg-background">
        <p className="text-sm text-muted-foreground">Select a screen or add one to edit content.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface-muted dark:bg-background">
      <div className="p-6 border-b border-border dark:border-border-subtle bg-surface dark:bg-surface">
        <h2 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">Edit Content</h2>
        <div>
          <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">Screen Title</label>
          <input
            value={screen.title}
            onChange={(e) => onScreenChange({ ...screen, title: e.target.value })}
            className="w-full px-4 py-2.5 text-sm rounded-md border border-border dark:border-border bg-surface dark:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-info"
            placeholder="e.g. Welcome to our form"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {screen.blocks.map((block, index) => (
          <ContentBlockCard
            key={block.id}
            block={block}
            index={index}
            isDragging={draggedBlockIndex === index}
            onDragStart={handleBlockDragStart}
            onDrop={handleBlockDrop}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
          />
        ))}
        <AddContentDropdown onAdd={addBlock} />
      </div>
    </div>
  );
}
