"use client";

import { PointerEvent as ReactPointerEvent, RefObject, useCallback, useState } from "react";

/** Draggable split for two panes inside `containerRef`; returns the first pane's size in %. */
export function useSplit(
  containerRef: RefObject<HTMLElement | null>,
  axis: "x" | "y",
  initial: number,
  min: number,
  max: number,
) {
  const [size, setSize] = useState(initial);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      const move = (ev: PointerEvent) => {
        const ratio = axis === "x" ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
        setSize(Math.min(max, Math.max(min, ratio * 100)));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [containerRef, axis, min, max],
  );

  return [size, onPointerDown] as const;
}
