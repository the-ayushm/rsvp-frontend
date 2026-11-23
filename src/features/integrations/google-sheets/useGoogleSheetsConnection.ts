"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { googleSheetsApi, googleSheetsErrorMessage, type GoogleSheetsConnection, type GoogleSheetsSetup } from "./api";
import type { ConnectPhase } from "../shared/useOAuthPopup";

export type { ConnectPhase };

const POLL_MS = 2500;
const TIMEOUT_MS = 3 * 60 * 1000;
const POPUP_NAME = "soft7-google-sheets-oauth";

/** Changes whenever a (re)connection is saved, so Reconnect can be detected too. */
const signature = (c: GoogleSheetsConnection | null) =>
  c?.connected && c.connection ? `${c.connection.id}:${c.connection.updated_at ?? c.connection.created_at ?? ""}` : null;

function openBlankPopup(): Window | null {
  const w = 520;
  const h = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
  const popup = window.open("", POPUP_NAME, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) return null;
  try {
    popup.document.title = "Connecting to Google…";
    popup.document.body.innerHTML =
      '<p style="font:14px system-ui,sans-serif;padding:32px;text-align:center">Connecting to Google…</p>';
  } catch {
    // A reused cross-origin window — it gets navigated below anyway.
  }
  return popup;
}

export function useGoogleSheetsConnection({
  onConnected,
  enabled = true,
}: { onConnected?: (c: GoogleSheetsConnection) => void; enabled?: boolean } = {}) {
  const [setup, setSetup] = useState<GoogleSheetsSetup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [status, setStatus] = useState<GoogleSheetsConnection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const statusRef = useRef<GoogleSheetsConnection | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  statusRef.current = status;

  const stopPolling = useCallback(() => {
    attemptRef.current += 1;
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

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const c = await googleSheetsApi.connection();
      setStatus(c);
      return c;
    } catch (err) {
      setLoadError(googleSheetsErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    googleSheetsApi
      .setup()
      .then(setSetup)
      .catch((err) => setSetupError(googleSheetsErrorMessage(err)));
    void refresh();
    return () => {
      attemptRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, refresh]);

  /** One /connection check for the current attempt. Returns true once a new connection is saved. */
  const check = useCallback(
    async (attempt: number, baseline: string | null) => {
      try {
        const c = await googleSheetsApi.connection();
        if (attempt !== attemptRef.current) return false;
        const sig = signature(c);
        if (!sig || sig === baseline) return false;
        stopPolling();
        closePopup();
        setStatus(c);
        setPhase("idle");
        onConnectedRef.current?.(c);
        return true;
      } catch {
        return false; // Transient failure — keep trying until the deadline.
      }
    },
    [closePopup, stopPolling],
  );

  const startPolling = useCallback(
    (baseline: string | null) => {
      stopPolling();
      const attempt = attemptRef.current;
      const deadline = Date.now() + TIMEOUT_MS;
      const tick = async () => {
        if (attempt !== attemptRef.current || (await check(attempt, baseline))) return;
        if (attempt !== attemptRef.current) return;
        if (Date.now() >= deadline) {
          stopPolling();
          setPhase("timeout");
          return;
        }
        timerRef.current = setTimeout(tick, POLL_MS);
      };
      timerRef.current = setTimeout(tick, POLL_MS);
    },
    [check, stopPolling],
  );

  const baselineRef = useRef<string | null>(null);

  // Check right away when the user comes back from the Google window.
  useEffect(() => {
    if (phase !== "waiting") return;
    const onFocus = () => void check(attemptRef.current, baselineRef.current);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [phase, check]);

  /** Must be called directly from a click handler so the popup isn't blocked. */
  const connect = useCallback(() => {
    setConnectError(null);
    stopPolling();
    const popup = openBlankPopup();
    if (!popup) {
      setPhase("blocked");
      return;
    }
    popupRef.current = popup;
    const baseline = signature(statusRef.current);
    baselineRef.current = baseline;
    setPhase("waiting");
    const attempt = attemptRef.current;

    googleSheetsApi
      .startOAuth()
      .then((res) => {
        if (attempt !== attemptRef.current) return; // Cancelled meanwhile.
        const url = res?.authorization_url;
        if (!url || !/^https:\/\//i.test(url)) throw new Error("The server didn't return a valid Google authorization link.");
        if (popup.closed) {
          // Closed during the start request — treat as a cancel.
          setPhase("cancelled");
          return;
        }
        popup.location.href = url;
        popup.focus();
        startPolling(baseline);
      })
      .catch((err) => {
        if (attempt !== attemptRef.current) return;
        closePopup();
        setConnectError(googleSheetsErrorMessage(err));
        setPhase("error");
      });
  }, [closePopup, startPolling, stopPolling]);

  const cancel = useCallback(() => {
    stopPolling();
    closePopup();
    setPhase("cancelled");
  }, [closePopup, stopPolling]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setConnectError(null);
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const res = await googleSheetsApi.disconnect();
      setStatus({ connected: Boolean(res?.connected), connection: null });
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return {
    setup,
    setupError,
    status,
    connected: Boolean(status?.connected),
    loading,
    loadError,
    refresh,
    phase,
    connectError,
    connect,
    cancel,
    dismiss,
    disconnect,
    disconnecting,
  };
}

export type GoogleSheetsConnectionState = ReturnType<typeof useGoogleSheetsConnection>;
