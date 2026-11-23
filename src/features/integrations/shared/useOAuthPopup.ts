"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 2500;
const TIMEOUT_MS = 3 * 60 * 1000;

/**
 * idle      – nothing in progress
 * waiting   – popup open, polling for the saved connection
 * blocked   – the browser blocked the popup
 * timeout   – no connection within TIMEOUT_MS
 * cancelled – the user stopped waiting
 * error     – the start request failed
 */
export type ConnectPhase = "idle" | "waiting" | "blocked" | "timeout" | "cancelled" | "error";

export interface OAuthPopupAttempt {
  /** Asks the backend for the provider's authorization URL. */
  start: () => Promise<string | undefined>;
  /** Polled while waiting; resolve true once the new connection is saved. */
  isDone: () => Promise<boolean>;
  onDone?: () => void;
}

function openBlankPopup(name: string, label: string): Window | null {
  const w = 560;
  const h = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
  const popup = window.open("", name, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) return null;
  try {
    popup.document.title = label;
    popup.document.body.innerHTML = `<p style="font:14px system-ui,sans-serif;padding:32px;text-align:center">${label}</p>`;
  } catch {
    // A reused cross-origin window — it gets navigated below anyway.
  }
  return popup;
}

/**
 * Runs a provider OAuth consent in a popup and polls until the backend has
 * saved the connection. Used when the provider callback doesn't redirect back
 * to the dashboard. `popup.closed` isn't trusted: provider pages often set
 * Cross-Origin-Opener-Policy, which makes it read true while still open.
 */
export function useOAuthPopup({ name, provider, errorMessage }: { name: string; provider: string; errorMessage: (err: unknown) => string }) {
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);
  const lastRef = useRef<OAuthPopupAttempt | null>(null);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const closePopup = useCallback(() => {
    try {
      popupRef.current?.close();
    } catch {
      // Cross-origin-isolated popups can't always be closed from here.
    }
    popupRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const check = useCallback(
    async (token: number, attempt: OAuthPopupAttempt) => {
      try {
        const done = await attempt.isDone();
        if (!done || token !== tokenRef.current) return false;
        stop();
        closePopup();
        setPhase("idle");
        attempt.onDone?.();
        return true;
      } catch {
        return false; // Transient failure — keep trying until the deadline.
      }
    },
    [closePopup, stop],
  );

  const poll = useCallback(
    (attempt: OAuthPopupAttempt) => {
      stop();
      const token = tokenRef.current;
      const deadline = Date.now() + TIMEOUT_MS;
      const tick = async () => {
        if (token !== tokenRef.current || (await check(token, attempt))) return;
        if (token !== tokenRef.current) return;
        if (Date.now() >= deadline) {
          stop();
          setPhase("timeout");
          return;
        }
        timerRef.current = setTimeout(tick, POLL_MS);
      };
      timerRef.current = setTimeout(tick, POLL_MS);
    },
    [check, stop],
  );

  // Check right away when the user comes back from the provider window.
  useEffect(() => {
    if (phase !== "waiting") return;
    const onFocus = () => lastRef.current && void check(tokenRef.current, lastRef.current);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [phase, check]);

  /** Must be called directly from a click/submit handler so the popup isn't blocked. */
  const run = useCallback(
    (attempt: OAuthPopupAttempt) => {
      lastRef.current = attempt;
      setConnectError(null);
      stop();
      const popup = openBlankPopup(name, `Connecting to ${provider}…`);
      if (!popup) {
        setPhase("blocked");
        return;
      }
      popupRef.current = popup;
      setPhase("waiting");
      const token = tokenRef.current;

      attempt
        .start()
        .then((url) => {
          if (token !== tokenRef.current) return; // Cancelled meanwhile.
          if (!url || !/^https:\/\//i.test(url)) throw new Error(`The server didn't return a valid ${provider} authorization link.`);
          if (popup.closed) {
            setPhase("cancelled");
            return;
          }
          popup.location.href = url;
          popup.focus();
          poll(attempt);
        })
        .catch((err) => {
          if (token !== tokenRef.current) return;
          closePopup();
          setConnectError(errorMessage(err));
          setPhase("error");
        });
    },
    [closePopup, errorMessage, name, poll, provider, stop],
  );

  const retry = useCallback(() => {
    if (lastRef.current) run(lastRef.current);
  }, [run]);

  const cancel = useCallback(() => {
    stop();
    closePopup();
    setPhase("cancelled");
  }, [closePopup, stop]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setConnectError(null);
  }, []);

  return { phase, connectError, run, connect: retry, cancel, dismiss };
}
