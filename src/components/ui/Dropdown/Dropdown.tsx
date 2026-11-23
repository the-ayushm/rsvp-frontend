"use client";

import Link from "next/link";
import {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./Dropdown.module.css";

const CloseContext = createContext<() => void>(() => {});

type TriggerProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
};

export interface DropdownProps {
  /** A single focusable element (button) that toggles the menu */
  trigger: ReactElement<TriggerProps>;
  children: ReactNode;
  align?: "start" | "end";
  side?: "bottom" | "top";
  width?: string;
  className?: string;
  menuClassName?: string;
  /** Controlled open state (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Render the menu in document.body with fixed positioning, so it isn't
   * clipped by scrolling/overflow containers such as tables. Flips above the
   * trigger when there isn't room below.
   */
  portal?: boolean;
}

const VIEWPORT_GAP = 8;

export default function Dropdown({
  trigger,
  children,
  align = "end",
  side = "bottom",
  width,
  className,
  menuClassName,
  open: controlledOpen,
  onOpenChange,
  portal = false,
}: DropdownProps) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [fixedPos, setFixedPos] = useState<CSSProperties | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Portal mode: place the menu next to the trigger using viewport coordinates.
  const place = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const { innerWidth: vw, innerHeight: vh } = window;
    const h = menu.offsetHeight;
    const w = menu.offsetWidth;
    const below = vh - anchor.bottom - VIEWPORT_GAP;
    const above = anchor.top - VIEWPORT_GAP;
    const openUp = side === "top" ? above >= h || above > below : below < h && above > below;
    let top = openUp ? anchor.top - h - 6 : anchor.bottom + 6;
    top = Math.max(VIEWPORT_GAP, Math.min(top, vh - h - VIEWPORT_GAP));
    let left = align === "end" ? anchor.right - w : anchor.left;
    left = Math.max(VIEWPORT_GAP, Math.min(left, vw - w - VIEWPORT_GAP));
    setFixedPos({ position: "fixed", top, left, right: "auto", bottom: "auto" });
  }, [align, side]);

  useLayoutEffect(() => {
    if (!portal || !open) {
      setFixedPos(null);
      return;
    }
    place();
    // Close on outer scroll (the anchor moved); reposition on resize.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [portal, open, place, close]);

  // Arrow-key navigation between items
  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    next?.focus();
  };

  const triggerEl = cloneElement(trigger, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(e);
      setOpen(!open);
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
  });

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      {triggerEl}
      {open &&
        (() => {
          const menu = (
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              onKeyDown={onMenuKeyDown}
              className={cn(styles.menu, !portal && styles[side], !portal && styles[align], menuClassName)}
              style={{
                ...(width ? { width } : null),
                // Hidden until measured so it doesn't flash at the wrong spot.
                ...(portal ? fixedPos ?? { position: "fixed", top: 0, left: 0, visibility: "hidden" } : null),
              }}
            >
              <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
            </div>
          );
          return portal && typeof document !== "undefined" ? createPortal(menu, document.body) : menu;
        })()}
    </div>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  className?: string;
}

export function DropdownItem({ children, icon, onSelect, href, danger, className }: DropdownItemProps) {
  const close = useContext(CloseContext);
  const cls = cn(styles.item, danger && styles.danger, className);
  if (href) {
    return (
      <Link href={href} role="menuitem" className={cls} onClick={close}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={cls}
      onClick={() => {
        onSelect?.();
        close();
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className={styles.separator} />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}

export { Dropdown };
