/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { MessageSquare, Workflow, X } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SegmentedControl, Spinner } from "@/components/ui";
import type { BuilderTemplateHandle } from "@/features/chatbot/components/builder/BuilderCanvasInner";
import type { ChatbotTemplate, ChatbotTemplateDetail } from "./api";
import TemplateDemoChat from "./TemplateDemoChat";

const BuilderCanvas = dynamic(() => import("@/features/chatbot/components/builder/BuilderCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner label="Loading flow builder" />
    </div>
  ),
});

export type EditorMode = "flow" | "demo";
/** The flow as shown in the editor, plus which nodes differ in content from the original template. */
export type EditedGraph = { nodes: any[]; edges: any[]; changedNodeIds: string[] } | null;

interface TemplateEditorModalProps {
  template: ChatbotTemplate;
  detail: ChatbotTemplateDetail | null;
  detailError: string | null;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onClose: () => void;
  /** Called with the flow as shown in the editor (null if the builder never loaded). */
  onUse: (graph: EditedGraph) => void;
}

/** Full-screen template preview using the real chatbot builder, so the flow can be edited before use. */
export default function TemplateEditorModal({
  template, detail, detailError, mode, onModeChange, onClose, onUse,
}: TemplateEditorModalProps) {
  const builderRef = useRef<BuilderTemplateHandle | null>(null);

  // The builder edits a copy; nothing is saved until "Use template".
  const bot = useMemo(
    () => (detail ? { name: detail.name, nodes: structuredClone(detail.nodes), edges: structuredClone(detail.edges) } : null),
    [detail],
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const use = () => {
    const handle = builderRef.current;
    onUse(handle ? { ...handle.getGraph(), changedNodeIds: handle.getChangedNodeIds() } : null);
  };

  return (
    // z-index stays below antd popups (1000+) so the builder's dropdowns and drawers render on top.
    <div role="dialog" aria-modal="true" aria-labelledby="template-editor-title" className="fixed inset-0 z-[900] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">
            <X size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="template-editor-title" className="truncate text-lg font-semibold text-foreground">{template.name}</h2>
              {template.category_name && <Badge size="sm" variant="neutral">{template.category_name}</Badge>}
            </div>
            {template.description && <p className="truncate text-xs text-muted-foreground">{template.description}</p>}
          </div>
          <SegmentedControl<EditorMode> value={mode} onChange={onModeChange} size="sm" aria-label="Preview mode"
            options={[{ value: "flow", label: "Edit flow", icon: <Workflow size={14} /> }, { value: "demo", label: "Try demo", icon: <MessageSquare size={14} /> }]} />
          <Button onClick={use} disabled={!detail}>Use template</Button>
        </header>

        <div className="relative min-h-0 flex-1">
          {/* Keep the builder mounted while on the demo tab so edits aren't lost. */}
          <div className={`absolute inset-0 ${mode === "flow" ? "" : "invisible"}`}>
            {detailError ? (
              <div className="p-6"><Alert variant="error" message={detailError} /></div>
            ) : !bot ? (
              <div className="flex h-full items-center justify-center"><Spinner label="Loading flow" /></div>
            ) : bot.nodes.length ? (
              <BuilderCanvas bot={bot} templateMode templateRef={builderRef} />
            ) : (
              <EmptyState icon={<Workflow size={22} />} title="This template has no flow to preview" />
            )}
          </div>
          {mode === "demo" && (
            <div className="absolute inset-0 overflow-auto bg-background p-4 sm:p-6">
              <div className="mx-auto max-w-2xl">
                <TemplateDemoChat key={template.id} templateId={template.id} />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  The demo runs the original template. Your edits apply to the chatbot you create.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
