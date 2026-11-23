"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { PartyPopper } from "lucide-react";

const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

interface SubscriptionCelebrationProps {
  planName: string;
  onClose: () => void;
  /** Overrides for non-plan celebrations (e.g. an add-on purchase). */
  title?: string;
  message?: ReactNode;
  icon?: ReactNode;
  ctaLabel?: string;
}

export function SubscriptionCelebration({ planName, onClose, title, message, icon, ctaLabel }: SubscriptionCelebrationProps) {
  // Random values are generated once per celebration so pieces don't jump on re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.6 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 240,
        spin: 360 + Math.random() * 720,
        round: Math.random() > 0.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-celebration-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      <style>{`
        @keyframes subscription-confetti-fall {
          0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(var(--spin)); opacity: 0.9; }
        }
        @keyframes subscription-celebration-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .subscription-confetti-piece { display: none; }
          .subscription-celebration-card { animation: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="subscription-confetti-piece absolute top-0 block"
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                borderRadius: p.round ? "9999px" : "2px",
                backgroundColor: p.color,
                animation: `subscription-confetti-fall ${p.duration}s cubic-bezier(.25,.6,.45,1) ${p.delay}s forwards`,
                transform: "translate3d(0, -10vh, 0)",
                "--drift": `${p.drift}px`,
                "--spin": `${p.spin}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="subscription-celebration-card relative w-full max-w-md rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-2xl"
        style={{ animation: "subscription-celebration-pop 0.5s ease-out both" }}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon ?? <PartyPopper className="h-10 w-10" />}
        </div>
        <h2 id="subscription-celebration-title" className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
          {title ?? "Congratulations! 🎉"}
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">
          {message ?? (
            <>
              Your <span className="font-bold text-primary">{planName}</span> plan is now active.
              All features are unlocked — let&apos;s grow your business!
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-6 h-11 w-full rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          {ctaLabel ?? "Let’s Go"}
        </button>
      </div>
    </div>
  );
}
