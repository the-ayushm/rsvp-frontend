"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck } from "lucide-react";

const CSS = `
@keyframes apo-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes apo-rise { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes apo-spin { to { transform: rotate(360deg) } }
@keyframes apo-bar { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }
@keyframes apo-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
@keyframes apo-ring { 0% { transform: scale(.8); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes apo-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
.apo-backdrop { animation: apo-fade .2s ease-out both }
.apo-card { animation: apo-rise .35s cubic-bezier(.2,.9,.3,1.2) both }
.apo-spinner { background: conic-gradient(from 0deg, transparent 0 25%, var(--color-primary) 100%); animation: apo-spin 1s linear infinite;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 3px)); mask: radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 3px)) }
.apo-icon { animation: apo-float 2.4s ease-in-out infinite }
.apo-bar { animation: apo-bar 1.3s ease-in-out infinite }
.apo-pop { animation: apo-pop .45s cubic-bezier(.2,.9,.3,1.3) both }
.apo-ring { animation: apo-ring 1.4s ease-out infinite }
.apo-ring-2 { animation-delay: .45s }
@media (prefers-reduced-motion: reduce) { .apo-backdrop, .apo-card, .apo-spinner, .apo-icon, .apo-bar, .apo-pop, .apo-ring { animation-duration: 0s; animation-iteration-count: 1 } }
`;

interface AuthProgressOverlayProps {
  phase: "working" | "success";
  title: string;
  subtitle?: string;
}

/** Full-screen "signing you in" / "welcome" state shown over the page during sign-in. */
export default function AuthProgressOverlay({ phase, title, subtitle }: AuthProgressOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="apo-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[var(--color-overlay)] p-4 backdrop-blur-md"
    >
      <style>{CSS}</style>
      <div className="apo-card relative w-full max-w-[340px] overflow-hidden rounded-3xl border border-border bg-card px-8 pb-8 pt-9 text-center shadow-2xl">
        {/* Soft brand glow */}
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          {phase === "working" ? (
            <>
              <span className="apo-spinner absolute inset-0 rounded-full" />
              <span className="absolute inset-[6px] rounded-full bg-primary/10" />
              <ShieldCheck size={30} className="apo-icon relative text-primary" strokeWidth={1.8} />
            </>
          ) : (
            <>
              <span className="apo-ring absolute inset-0 rounded-full bg-success/30" />
              <span className="apo-ring apo-ring-2 absolute inset-0 rounded-full bg-success/20" />
              <span className="apo-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-success text-primary-foreground shadow-lg">
                <Check size={32} strokeWidth={3} />
              </span>
            </>
          )}
        </div>

        <p className="relative mt-6 font-display text-[19px] font-bold text-foreground">{title}</p>
        {subtitle && <p className="relative mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}

        <div className="relative mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
          {phase === "working" ? (
            <span className="apo-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary" />
          ) : (
            <span className="absolute inset-0 rounded-full bg-success" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
