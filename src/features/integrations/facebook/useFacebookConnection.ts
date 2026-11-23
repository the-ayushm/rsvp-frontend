"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { facebookApi, facebookError, isOAuthPending, type FacebookCandidatePage, type FacebookFeature, type FacebookPageConnection, type FacebookSetup } from "./api";
import type { ConnectPhase } from "../shared/useOAuthPopup";

/** Where the backend sends the browser back after Facebook login. */
export type OAuthReturn = "ready" | "failed" | null;

const POPUP_NAME = "soft7-facebook-oauth";
const CHANNEL = "soft7-facebook-oauth";
/** Set in the popup's own sessionStorage, so the return page knows it's the popup. */
const POPUP_FLAG = "soft7-facebook-oauth-popup";
const POLL_MS = 2500;
const TIMEOUT_MS = 10 * 60 * 1000;
/** After Facebook returns, how long to wait for a started/authorizing login to become ready. */
const PENDING_POLL_MS = 1500;
const PENDING_TIMEOUT_MS = 30 * 1000;

const readReturn = (): OAuthReturn => {
  const oauth = new URLSearchParams(window.location.search).get("oauth");
  return oauth === "ready" || oauth === "failed" ? oauth : null;
};

/** Removes oauth/connect from the URL so a reload doesn't replay the return. ?feature= picks the screen, so it stays. */
export const clearOAuthParams = () => {
  const url = new URL(window.location.href);
  ["oauth", "connect"].forEach(k => url.searchParams.delete(k));
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

const isLoginPopup = () => {
  try { return sessionStorage.getItem(POPUP_FLAG) === "1" || (!!window.opener && window.name === POPUP_NAME); }
  catch { return false; }
};

/** Centered popup, like WhatsApp Embedded Signup. Must open synchronously from a click. */
function openLoginPopup(): Window | null {
  const w = 600, h = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
  const popup = window.open("", POPUP_NAME, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) return null;
  try {
    popup.sessionStorage.setItem(POPUP_FLAG, "1");
    popup.document.title = "Connecting to Facebook…";
    popup.document.body.innerHTML =
      '<p style="font:14px system-ui,sans-serif;padding:32px;text-align:center">Opening Facebook login…</p>';
  } catch { /* A reused window that already left our origin. */ }
  return popup;
}

/**
 * Facebook Lead Ads: saved Page connections plus a popup OAuth login.
 * Connect → popup to Facebook → popup returns here with ?oauth=, tells this tab and closes
 * → pick one Page → POST /pages. Falls back to a full-page redirect if popups are blocked.
 */
export function useFacebookConnection(feature: FacebookFeature = "leads") {
  // Read after mount so server and client render the same first frame.
  const [popupReturn, setPopupReturn] = useState(false);
  const [setup, setSetup] = useState<FacebookSetup | null>(null);
  const [pages, setPages] = useState<FacebookPageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [redirecting, setRedirecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  /** Pages authorized in the current login; null when there's no login to pick from. */
  const [candidates, setCandidates] = useState<FacebookCandidatePage[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [oauthReturn, setOauthReturn] = useState<OAuthReturn>(null);
  const alive = useRef(true);
  const runId = useRef(0);
  const popup = useRef<Window | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    runId.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try { popup.current?.close(); } catch { /* Facebook may isolate the popup. */ }
    popup.current = null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await facebookApi.pages(feature);
      if (alive.current) { setPages(list); setLoadError(null); }
      return list;
    } catch (error) {
      if (alive.current) setLoadError(facebookError(error));
      return null;
    } finally { if (alive.current) setLoading(false); }
  }, [feature]);

  const loadCandidates = useCallback(async () => {
    const id = runId.current;
    const current = () => alive.current && id === runId.current;
    setLoadingCandidates(true); setConnectError(null);
    try {
      // The backend may still be exchanging the code: poll briefly while it's pending.
      const deadline = Date.now() + PENDING_TIMEOUT_MS;
      let result = await facebookApi.oauthPages(feature);
      while (current() && isOAuthPending(result.status) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, PENDING_POLL_MS));
        if (!current()) return;
        result = await facebookApi.oauthPages(feature);
      }
      if (!current()) return;
      if (result.status === "ready") setCandidates(result.pages);
      else {
        setCandidates(null);
        setConnectError(
          result.status === "failed" ? result.error || "Facebook login failed. Connect Facebook again."
          : isOAuthPending(result.status) ? "Facebook is taking too long to finish signing in. Connect Facebook again."
          // "none" right after a login usually means the browser dropped the session cookie.
          : "No Facebook login was found for this browser. Connect Facebook again. If this keeps happening, allow third-party cookies for this site.");
      }
    } catch (error) {
      if (current()) { setCandidates(null); setConnectError(facebookError(error)); }
    } finally { if (current()) setLoadingCandidates(false); }
  }, [feature]);

  /** Login finished in the popup (or the redirect): show the Page picker here. */
  const finish = useCallback((status: Exclude<OAuthReturn, null>) => {
    stop(); setPhase("idle"); setOauthReturn(status);
    if (status === "ready") void loadCandidates();
    else setConnectError("Facebook login was cancelled or failed. Connect Facebook again.");
  }, [stop, loadCandidates]);

  useEffect(() => {
    alive.current = true;
    const ret = readReturn();

    // Inside the popup: hand the result to the dashboard tab and close.
    if (ret && isLoginPopup()) {
      setPopupReturn(true);
      try { new BroadcastChannel(CHANNEL).postMessage({ status: ret, feature }); } catch { /* Polling covers it. */ }
      try { window.opener?.postMessage({ type: CHANNEL, status: ret, feature }, window.location.origin); } catch { /* Severed opener. */ }
      try { sessionStorage.removeItem(POPUP_FLAG); } catch { /* Ignore. */ }
      const close = setTimeout(() => window.close(), 300);
      return () => { alive.current = false; clearTimeout(close); };
    }

    void refresh();
    facebookApi.setup(feature).then(s => { if (alive.current) setSetup(s); }).catch(() => undefined);
    if (ret) finish(ret);

    const onResult = (status: unknown, from: unknown) => {
      if ((status === "ready" || status === "failed") && (from ?? "leads") === feature && popup.current) finish(status);
    };
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = e => onResult(e.data?.status, e.data?.feature); } catch { /* Unsupported. */ }
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === CHANNEL) onResult(e.data.status, e.data.feature);
    };
    window.addEventListener("message", onMessage);
    return () => {
      alive.current = false;
      channel?.close();
      window.removeEventListener("message", onMessage);
      stop();
    };
  }, [feature, refresh, finish, stop]);

  /** Full-page fallback when the browser blocks the popup. */
  const redirect = useCallback(async () => {
    setConnectError(null); setRedirecting(true);
    try {
      const { authorization_url } = await facebookApi.start(feature);
      window.location.assign(validLoginUrl(authorization_url));
    } catch (error) { setConnectError(facebookError(error)); setRedirecting(false); }
  }, [feature]);

  /** Must run directly from a click so the popup isn't blocked. */
  const connect = useCallback(() => {
    stop();
    setConnectError(null); setCandidates(null); setOauthReturn(null); setLoadingCandidates(false);
    const win = openLoginPopup();
    if (!win) { setPhase("blocked"); return; }
    popup.current = win;
    setPhase("waiting");
    const id = runId.current;
    facebookApi.start(feature).then(({ authorization_url }) => {
      if (id !== runId.current) return;
      if (win.closed) { stop(); setPhase("cancelled"); return; }
      win.location.href = validLoginUrl(authorization_url);
      win.focus();
      // Backup for browsers where Facebook's isolation drops the popup's message.
      const deadline = Date.now() + TIMEOUT_MS;
      const tick = async () => {
        if (id !== runId.current) return;
        try {
          const result = await facebookApi.oauthPages(feature);
          if (id !== runId.current) return;
          if (result.status === "ready") { stop(); setPhase("idle"); setOauthReturn("ready"); setCandidates(result.pages); return; }
          if (result.status === "failed") { stop(); setPhase("error"); setConnectError(result.error || "Facebook login failed. Try again."); return; }
        } catch { /* Retry transient errors until the deadline. */ }
        if (id !== runId.current) return;
        if (Date.now() >= deadline) { stop(); setPhase("timeout"); return; }
        timer.current = setTimeout(tick, POLL_MS);
      };
      timer.current = setTimeout(tick, POLL_MS);
    }).catch(error => {
      if (id !== runId.current) return;
      stop(); setConnectError(facebookError(error)); setPhase("error");
    });
  }, [feature, stop]);

  const cancel = useCallback(() => { stop(); setPhase("cancelled"); }, [stop]);

  const connectPage = useCallback(async (pageId: string) => {
    const page = await facebookApi.connectPage(pageId, feature);
    // The OAuth session is consumed; another Page needs a fresh login.
    setCandidates(null); setOauthReturn(null); clearOAuthParams();
    await refresh();
    return page;
  }, [feature, refresh]);

  const disconnect = useCallback(async (connectionId: string) => {
    await facebookApi.disconnect(connectionId, feature);
    await refresh();
  }, [feature, refresh]);

  const dismiss = useCallback(() => {
    if (popup.current) stop();
    runId.current++;
    setPhase("idle"); setCandidates(null); setConnectError(null); setOauthReturn(null); setLoadingCandidates(false); clearOAuthParams();
  }, [stop]);

  return {
    feature, setup, popupReturn, pages, loading, loadError, refresh,
    oauthReturn, candidates, loadingCandidates, loadCandidates,
    phase, redirecting, connectError, connect, cancel, redirect, connectPage, disconnect, dismiss,
  };
}

function validLoginUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !/(^|\.)facebook\.com$/.test(url.hostname)) {
    throw new Error("The server returned an invalid Facebook login link.");
  }
  return url.href;
}
