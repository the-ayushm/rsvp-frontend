"use client";

import { CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexToRgb, normalizeHex, rgbToHsl } from "@/theme/colors";
import Button from "../Button";
import styles from "./ColorPicker.module.css";

export interface ColorPickerProps {
  /** "#rrggbb" */
  value: string;
  onChange: (hex: string) => void;
  /** When provided, shows "Reset to default" */
  defaultValue?: string;
  label?: string;
  className?: string;
}

/** Any-color picker: preview + pencil (native picker) + HEX field + RGB/HSL. */
export default function ColorPicker({ value, onChange, defaultValue, label = "HEX", className }: ColorPickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const hexId = useId();
  const [draft, setDraft] = useState(value.toUpperCase());
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value.toUpperCase());
    setInvalid(false);
  }, [value]);

  const commit = (input: string) => {
    const hex = normalizeHex(input);
    setInvalid(!hex);
    if (hex && hex !== value.toLowerCase()) onChange(hex);
  };

  const openNative = () => {
    const el = nativeRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  };

  const rgb = hexToRgb(value);
  const hsl = rgb ? rgbToHsl(rgb) : null;
  const isDefault = defaultValue ? normalizeHex(defaultValue) === normalizeHex(value) : true;

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.row}>
        <button type="button" className={styles.swatchButton} onClick={openNative} aria-label="Open color picker">
          <span className={styles.swatch} style={{ backgroundColor: value } as CSSProperties} />
          <span className={styles.editBadge} aria-hidden>
            <Pencil size={11} />
          </span>
          <input
            ref={nativeRef}
            type="color"
            tabIndex={-1}
            aria-hidden
            className={styles.nativeInput}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </button>

        <div className={styles.hexWrap}>
          <label htmlFor={hexId} className={styles.hexLabel}>
            {label}
          </label>
          <input
            id={hexId}
            className={cn(styles.hexInput, invalid && styles.hexInvalid)}
            value={draft}
            maxLength={7}
            spellCheck={false}
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              setDraft(next);
              if (normalizeHex(next)) commit(next);
            }}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => e.key === "Enter" && commit(draft)}
          />
        </div>
      </div>

      {rgb && hsl && (
        <div className={styles.values}>
          <span>
            <b>RGB</b> {rgb.join(", ")}
          </span>
          <span>
            <b>HSL</b> {hsl[0]}°, {hsl[1]}%, {hsl[2]}%
          </span>
        </div>
      )}

      {defaultValue && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            disabled={isDefault}
            onClick={() => onChange(normalizeHex(defaultValue)!)}
          >
            Reset to default
          </Button>
        </div>
      )}
    </div>
  );
}

export { ColorPicker };
