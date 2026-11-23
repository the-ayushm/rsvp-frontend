import { PointerEvent } from "react";
import { GripHorizontal, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1px divider with a grip chip; the transparent ::before widens the hit area. */
export default function ResizeHandle({
  axis,
  onPointerDown,
  className,
}: {
  axis: "x" | "y";
  onPointerDown: (e: PointerEvent) => void;
  className?: string;
}) {
  const vertical = axis === "x";
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      className={cn(
        "relative shrink-0 bg-border before:absolute before:content-['']",
        vertical
          ? "w-px cursor-col-resize before:inset-y-0 before:-left-1.5 before:-right-1.5"
          : "h-px cursor-row-resize before:inset-x-0 before:-top-1.5 before:-bottom-1.5",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-surface-muted text-muted-foreground",
          vertical ? "h-5 w-3.5" : "h-3.5 w-5",
        )}
      >
        {vertical ? <GripVertical size={10} /> : <GripHorizontal size={10} />}
      </span>
    </div>
  );
}
