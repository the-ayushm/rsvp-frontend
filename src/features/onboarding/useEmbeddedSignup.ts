"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { assertOnboardingAccepted, EmbeddedSignupCoordinator, signupAssetIds, type SignupStage } from "./embedded-signup";

declare global {
  interface Window {
    FB: { init: (options: Record<string, unknown>) => void; login: (callback: (response: unknown) => void, options: Record<string, unknown>) => void };
    fbAsyncInit: () => void;
  }
}

// const CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID || "1513662007019792";
const CONFIG_ID = '1618654559437264'
// const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "1456789056182846";
const APP_ID = '1308601121424514'

export function useEmbeddedSignup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<SignupStage>("idle");
  const coordinator = useRef<EmbeddedSignupCoordinator | null>(null);

  useEffect(() => {
    let connectedWabaId: string | null = null;
    const current = new EmbeddedSignupCoordinator({
      onboard: async payload => {
        const { data } = await soft7AxiosInstance.post("/admin/waba/onboard", payload, { timeout: 25000 });
        assertOnboardingAccepted(data);
        connectedWabaId = signupAssetIds({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: data?.data ?? data }).waba_id ?? payload.waba_id;
      },
      onStage: next => {
        setStage(next);
        if (next === "success") router.push(`/user/integrations/whatsapp${connectedWabaId ? `?waba_id=${encodeURIComponent(connectedWabaId)}` : ""}`);
      },
      onError: setError,
    });
    coordinator.current = current;
    const handleMessage = (event: MessageEvent) => current.receiveSession(event.origin, event.data);
    window.addEventListener("message", handleMessage);
    return () => {
      current.dispose();
      coordinator.current = null;
      window.removeEventListener("message", handleMessage);
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    const previousInit = window.fbAsyncInit;
    const failed = () => {
      if (!mounted) return;
      setLoading(false);
      setSdkReady(false);
      setError("Facebook could not load. Check your connection or browser blockers, then reload this page.");
    };
    const timer = setTimeout(failed, 15000);
    const initialize = () => {
      if (!mounted) return;
      try {
        window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: "v24.0" });
        clearTimeout(timer);
        setLoading(false);
        setSdkReady(true);
        setError(null);
      } catch { failed(); }
    };
    window.fbAsyncInit = initialize;
    let script = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
    if (window.FB) initialize();
    else {
      if (!script) {
        script = document.createElement("script");
        script.id = "facebook-jssdk";
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.crossOrigin = "anonymous";
        script.async = true;
        script.defer = true;
        script.addEventListener("error", failed);
        document.head.appendChild(script);
      } else script.addEventListener("error", failed);
    }
    return () => {
      mounted = false;
      clearTimeout(timer);
      script?.removeEventListener("error", failed);
      if (window.fbAsyncInit === initialize) window.fbAsyncInit = previousInit;
    };
  }, []);

  const launch = () => {
    if (stage === "waiting_meta" || stage === "connecting" || stage === "success") return;
    if (!sdkReady || !window.FB || !coordinator.current) {
      setError("Facebook is not ready. Please reload this page.");
      return;
    }
    const token = localStorage.getItem("console_access_token")?.replace(/^"|"$/g, "").trim();
    if (!token) {
      setError("Your dashboard session is missing. Please sign in again before connecting WhatsApp.");
      return;
    }
    setError(null);
    const current = coordinator.current;
    const attempt = current.start();
    try {
      // Meta's current Coexistence example still specifies sessionInfoVersion 3.
      // The v4 experience is selected by the Login for Business configuration.
      window.FB.login(response => current.receiveLogin(response, attempt), {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3", setup: {} },
      });
    } catch {
      current.fail("Facebook signup could not open. Allow popups for this site and try again.");
    }
  };

  return { loading, sdkReady, error, stage, launch, cancel: () => coordinator.current?.fail("Signup was cancelled. You can start again when ready.") };
}
