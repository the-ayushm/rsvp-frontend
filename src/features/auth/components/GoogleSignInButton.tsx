"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { GoogleFlow, loadGsi, toGoogleAuthError } from "@/features/auth/google";
import AuthProgressOverlay from "./AuthProgressOverlay";

interface GoogleSignInButtonProps {
  /** Starts a server flow (client_id + nonce + flow_token). */
  start: () => Promise<GoogleFlow>;
  /** Sends Google's ID token to the backend. Throw to show the error; a new flow is started either way. */
  onCredential: (credential: string, flowToken: string) => Promise<void>;
  text?: "continue_with" | "signup_with" | "signin_with";
  /** Google sign-in is switched off on the server; the caller can hide related UI. */
  onUnavailable?: () => void;
}

/**
 * Official Google Identity Services button. Each flow is single-use: after a sign-in attempt, a
 * failure or expiry, a new flow (new nonce) is started so the next click gets a fresh token.
 */
export default function GoogleSignInButton({ start, onCredential, text = "continue_with", onUnavailable }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<GoogleFlow | null>(null);
  const submittingRef = useRef(false);
  const latest = useRef({ start, onCredential, onUnavailable });
  latest.current = { start, onCredential, onUnavailable };

  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "hidden">("loading");
  const [busy, setBusy] = useState(false);

  // Start (or restart) a flow and point GIS at it.
  useEffect(() => {
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("loading");

    Promise.all([loadGsi(), latest.current.start()])
      .then(([gsi, flow]) => {
        if (cancelled) return;
        flowRef.current = flow;
        gsi.initialize({
          client_id: flow.client_id,
          nonce: flow.nonce,
          auto_select: false,
          // Chrome's built-in account chooser ("Sign in to … with google.com") instead of a popup window.
          // Browsers without FedCM fall back to the popup automatically.
          use_fedcm_for_button: true,
          button_auto_select: false,
          callback: async ({ credential }) => {
            const current = flowRef.current;
            if (!credential || !current || submittingRef.current) return;
            submittingRef.current = true;
            setBusy(true);
            try {
              await latest.current.onCredential(credential, current.flow_token);
            } catch {
              // The caller shows the error; start over with a new flow for the next try.
              setAttempt((a) => a + 1);
            } finally {
              submittingRef.current = false;
              setBusy(false);
            }
          },
        });
        setStatus("ready");
        // Refresh shortly before the flow expires so an idle page still works.
        const ms = new Date(flow.expires_at).getTime() - Date.now() - 30_000;
        expiryTimer = setTimeout(() => {
          if (!submittingRef.current) setAttempt((a) => a + 1);
        }, Math.max(ms, 15_000));
      })
      .catch((err) => {
        if (cancelled) return;
        const e = toGoogleAuthError(err);
        if (e.code === "GOOGLE_AUTH_NOT_CONFIGURED") {
          setStatus("hidden");
          latest.current.onUnavailable?.();
        } else {
          // Same id so repeated retries don't stack toasts.
          toast.error(e.message, { id: "google-start", duration: 6000 });
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(expiryTimer);
    };
  }, [attempt]);

  // Draw Google's button once the flow is ready (and when the label changes).
  useEffect(() => {
    const el = containerRef.current;
    const gsi = window.google?.accounts?.id;
    if (status !== "ready" || !el || !gsi) return;
    el.innerHTML = "";
    gsi.renderButton(el, {
      type: "standard",
      theme: document.documentElement.classList.contains("dark") ? "filled_black" : "outline",
      size: "large",
      shape: "rectangular",
      text,
      logo_alignment: "center",
      width: Math.min(Math.max(el.offsetWidth, 200), 400),
    });
  }, [status, text]);

  if (status === "hidden") return null;

  return (
    <div className="relative">
      {/* Fixed height so the form doesn't jump while Google loads. */}
      <div className="flex min-h-[44px] items-center justify-center">
        <div ref={containerRef} className={status === "ready" ? "flex w-full justify-center" : "hidden"} />
        {status === "loading" && <div className="h-11 w-full animate-pulse rounded-xl border border-border bg-muted" />}
        {status === "error" && (
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-[14px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw size={16} />
            Retry Google sign-in
          </button>
        )}
      </div>
      {busy && <AuthProgressOverlay phase="working" title="Signing you in…" subtitle="Verifying your Google account securely" />}
    </div>
  );
}
