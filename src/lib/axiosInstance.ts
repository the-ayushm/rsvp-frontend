import axios from "axios";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "https://hostapi.soft7.in/v1")
  .replace(/([^:]\/)\/+/g, "$1")
  .replace(/\/+$/, "");
// Shared client for the configured backend API.
export const soft7AxiosInstance = axios.create({
  baseURL: BASE_URL,
});



// Attach the dashboard token to backend requests.
soft7AxiosInstance.interceptors.request.use((config) => {
  let token = typeof window !== "undefined"
    ? localStorage.getItem("console_access_token")
    : null;

  // Strip surrounding quotes if present
  if (token && token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1);
  }

  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    // Large uploads must wait for the server response without a client timeout.
    config.timeout = 0;
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete("Content-Type");
    } else {
      delete config.headers["Content-Type"];
    }
  }

  return config;
});

// ── 401 guard ────────────────────────────────────────────────────────────────
// Only wipe the session and redirect when a token truly doesn't exist or has
// been rejected on a session-critical call.  Non-critical endpoints (reminders,
// notifications, search …) should NOT cause a full logout — they simply return
// an empty result and the UI continues to work.
//
// A single redirect flag prevents the race-condition where multiple in-flight
// requests all try to redirect at the same time.
let _isRedirectingToAuth = false;

soft7AxiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Check whether a valid token exists right now.
      const token = localStorage.getItem("console_access_token");
      const hasCookieToken =
        document.cookie.includes("consoleAccessToken=") ||
        document.cookie.includes("accessToken=");

      // Only redirect when the token is genuinely absent (not just a transient
      // backend rejection of an optional endpoint).
      if (!token && !hasCookieToken && !_isRedirectingToAuth && !window.location.pathname.startsWith("/auth")) {
        _isRedirectingToAuth = true;
        window.location.href = "/auth";
      }
      // If the token exists, the 401 is from an optional endpoint — swallow it.
    }
    return Promise.reject(error);
  }
);
