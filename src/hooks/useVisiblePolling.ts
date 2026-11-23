"use client";

import { useEffect, useRef } from "react";

/** Sequential, abortable polling that does no work while the page is hidden. */
export function useVisiblePolling(
  callback: (signal: AbortSignal) => Promise<void>,
  { enabled = true, scope = "", interval = 5000, immediate = true } = {},
) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let request: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (stopped || request || document.visibilityState !== "visible" || !navigator.onLine) return;
      const controller = new AbortController();
      request = controller;
      try { await callbackRef.current(controller.signal); }
      catch { /* A later poll or socket event can recover a transient failure. */ }
      finally {
        request = undefined;
        if (!stopped && document.visibilityState === "visible" && navigator.onLine) timer = setTimeout(tick, interval);
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible" || !navigator.onLine) request?.abort();
      else void tick();
    };
    if (immediate) void tick();
    else timer = setTimeout(tick, interval);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      request?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [enabled, scope, interval, immediate]);
}
