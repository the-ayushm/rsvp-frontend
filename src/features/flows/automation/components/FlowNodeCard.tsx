"use client";

import { createContext, memo, useContext } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, CircleCheck, CircleX, Ellipsis, Plus, Settings, Trash2, Workflow, Zap } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import AppIcon from "./AppIcon";

export interface FlowNodeData {
  stepId: string;
  /** Position on the canvas (the trigger, real or placeholder, is always 0). */
  index: number;
  isTrigger: boolean;
  /** "Add Trigger" placeholder shown while the flow has no trigger (not saved). */
  virtual: boolean;
  count: number;
  title: string | null;
  appLabel: string | null;
  appKey: string | null;
  chosen: boolean;
  complete: boolean;
  /** Unsaved edits, a missing connection, … */
  note: string | null;
  editable: boolean;
  canAdd: boolean;
}

export interface CanvasActions {
  select: (id: string) => void;
  /** Opens the Select App → Select trigger/action dialog */
  pick: (id: string) => void;
  move: (id: string, dir: -1 | 1) => void;
  insert: (index: number) => void;
  remove: (id: string) => void;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

function FlowNodeCard({ data, selected }: NodeProps<FlowNodeData>) {
  const actions = useContext(CanvasActionsContext)!;
  const { stepId, index, count, chosen, complete, editable } = data;
  const isTrigger = data.isTrigger;
  const kind = isTrigger ? "Trigger" : "Action";
  const accent = chosen;
  /** Menu "Configure": open the side panel (or the picker if nothing is chosen yet). */
  const open = () => (chosen || !editable ? actions.select(stepId) : actions.pick(stepId));
  /** Card button: reopen "Select App" so the app / trigger / action can be changed. */
  const choose = () => (editable ? actions.pick(stepId) : actions.select(stepId));
  const canUp = editable && index > 1;
  const canDown = editable && !isTrigger && index < count - 1;

  return (
    <div className="flex w-[356px] items-center justify-center">
      <div
        className={cn(
          "relative w-[356px] rounded-xl border bg-surface shadow-lg transition-all duration-200",
          accent
            ? selected
              ? "border-[var(--color-flow-trigger)]"
              : "border-[var(--color-flow-trigger-border)] hover:border-[var(--color-flow-trigger)]"
            : selected
              ? "border-primary"
              : "border-primary/40 hover:border-primary",
        )}
      >
        <Handle type="target" position={Position.Top} className="!invisible" />

        {isTrigger && (
          <span
            className={cn(
              "absolute -top-14 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-md",
              accent ? "bg-[var(--color-flow-trigger)]" : "bg-primary",
            )}
          >
            <Zap size={23} />
          </span>
        )}

        <div className="flex min-h-[92px] items-center gap-3 rounded-t-xl border-b border-border bg-surface-muted px-5 py-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center">
            {data.appKey ? (
              <AppIcon appKey={data.appKey} className="!h-11 !w-10" />
            ) : isTrigger ? (
              <Zap size={24} className="text-primary-text" />
            ) : (
              <Workflow size={24} className="text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-6 text-foreground">{chosen ? data.title : kind}</p>
            <p className="truncate text-xs text-muted-foreground">
              {kind}
              {data.appLabel ? ` · ${data.appLabel}` : ""}
            </p>
            {data.note && <p className="truncate text-[11px] font-medium text-warning">{data.note}</p>}
          </div>
          <span
            className={cn("flex rounded-md p-1 text-primary-foreground shadow-sm", complete ? "bg-primary" : "bg-error")}
            title={complete ? "Ready" : "Needs setup"}
          >
            {complete ? <CircleCheck size={16} /> : <CircleX size={16} />}
          </span>
          <Dropdown portal width="200px" className="nodrag" trigger={<IconButton aria-label="Open step menu" size="sm" icon={<Ellipsis size={16} />} />}>
            <DropdownItem icon={<Settings size={16} />} onSelect={open}>
              Configure {kind}
            </DropdownItem>
            {editable && chosen && (
              <DropdownItem icon={<Workflow size={16} />} onSelect={() => actions.pick(stepId)}>
                Change {kind}
              </DropdownItem>
            )}
            {editable && data.canAdd && (
              <>
                <DropdownSeparator />
                {!isTrigger && (
                  <DropdownItem icon={<ArrowUp size={16} />} onSelect={() => actions.insert(index)}>
                    Insert Parent Node
                  </DropdownItem>
                )}
                <DropdownItem icon={<ArrowDown size={16} />} onSelect={() => actions.insert(index + 1)}>
                  Insert Child Node
                </DropdownItem>
              </>
            )}
            {(canUp || canDown) && (
              <>
                <DropdownSeparator />
                {canUp && (
                  <DropdownItem icon={<ChevronUp size={16} />} onSelect={() => actions.move(stepId, -1)}>
                    Move Up
                  </DropdownItem>
                )}
                {canDown && (
                  <DropdownItem icon={<ChevronDown size={16} />} onSelect={() => actions.move(stepId, 1)}>
                    Move Down
                  </DropdownItem>
                )}
              </>
            )}
            {editable && !data.virtual && (
              <>
                <DropdownSeparator />
                <DropdownItem danger icon={<Trash2 size={16} />} onSelect={() => actions.remove(stepId)}>
                  Delete Node
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              choose();
            }}
            className={cn(
              "nodrag flex h-11 w-full items-center gap-3 rounded-lg border px-4 text-sm font-medium text-foreground shadow-xs transition-colors",
              accent
                ? "border-[var(--color-flow-trigger-border)] bg-[var(--color-flow-trigger-bg)] hover:bg-[var(--color-flow-trigger-hover)]"
                : "border-primary/30 bg-primary/10 hover:bg-primary/20",
            )}
          >
            {chosen ? (
              <Settings size={18} className="text-[var(--color-flow-trigger)]" />
            ) : (
              <Plus size={18} className="text-primary-text" />
            )}
            {chosen ? (complete ? "Configured" : "Configure") : `Add ${kind}`}
          </button>
        </div>

        <Handle type="source" position={Position.Bottom} className="!invisible" />

        {index === count - 1 && editable && data.canAdd && (
          <div className="absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center">
            <span className="h-8 w-0.5 bg-primary/40" />
            <button
              type="button"
              aria-label="Add step"
              onClick={() => actions.insert(count)}
              className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary-hover"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FlowNodeCard);
