/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { decodeJwt, jwtVerify } from "jose";
import { getUserAccessState } from "./lib/access";

//  Secret used to verify JWT
const ACCESS_SECRET = new TextEncoder().encode(
  process.env.ACCESS_TOKEN_SECRET || "access_secret",
);

const ADMIN_LOGIN_URL = "https://admin.soft7.in/";
const SUPERADMIN_LOGIN_URL = "https://superadmin.soft7.in/auth";

function normalizeRole(role: unknown) {
  return String(role ?? "").trim().replace(/[\s-]+/g, "_").toUpperCase();
}

function isSuperAdminRole(role: string) {
  return role === "SUPERADMIN" || role === "SUPER_ADMIN" || role === "MASTER_ADMIN";
}

//  Public routes that DON'T need authentication
const publicRoutes = ["/", "/auth", "/team/setup-password"];
const publicApiRoutes = [
  "/api/auth/login",
  "/api/auth/get-role",
  "/api/auth/refresh",
  "/api/auth/registration",
  "/api/user/subscription/webhook",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/user/webhooks/whatsapp",
  // Embedded signup: OAuth callback (Meta redirects here) + webhook (Meta sends events) — Do not remove these routes
  "/api/user/whatsapp/embedded-signup/callback",
  "/api/user/whatsapp/embedded-signup/webhook",
  "/api/user/whatsapp/embedded-signup/public-config",
];

// Routes accessible even when subscription is not active
const allowedUiWhenRestricted = ["/user/settings/billing"];
const allowedApiWhenRestricted = [
  "/api/user/subscription",
  "/api/user/subscription/webhook",
  "/api/user/subscription/create-order",
  "/api/user/subscription/verify",
  "/api/user/users",
  "/api/user/plans",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Versioned API requests use backend JWT/signature checks, including public
  // OAuth callbacks. A dashboard login redirect would prevent the API rewrite.
  if (pathname === "/v1" || pathname.startsWith("/v1/") || pathname === "/live") {
    return NextResponse.next();
  }

  // Facebook endpoints verify dashboard bearer tokens with the backend themselves.
  // The public OAuth callback authenticates its single-use, browser-bound state.
  if (pathname.startsWith("/api/integrations/facebook/")) {
    return NextResponse.next();
  }

  //  Allow public static media so Meta (and browsers) can fetch upload URLs without auth
  if (pathname.startsWith("/uploads")) {
    return NextResponse.next();
  }

  // Allow internal server-to-server endpoints (socket-emit from backend, event polling)
  if (pathname.startsWith("/internal/") || pathname.startsWith("/api/internal/")) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("accessToken")?.value;
  const externalAccessToken = request.cookies.get("consoleAccessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  console.log(
    "Middleware checking:",
    pathname,
    "Token exists:",
    !!accessToken || !!externalAccessToken,
  );

  //  Skip checks for static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (request.headers.get("accept")?.includes("text/x-component")) {
    return NextResponse.next();
  }

  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some((route) => pathname === route);

  let userPayload: any = null;
  let accessTokenInvalid = false;

  if (isPublicRoute && !accessToken && !externalAccessToken) {
    return NextResponse.next();
  }

  // ── Verify / decode token ──────────────────────────────────────────────────
  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
      userPayload = payload;
    } catch {
      accessTokenInvalid = true;
    }
  }

  if (!userPayload && externalAccessToken) {
    try {
      const decoded = decodeJwt(externalAccessToken);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        userPayload = null;
        accessTokenInvalid = true;
      } else {
        userPayload = decoded;
        accessTokenInvalid = false;
      }
    } catch {
      accessTokenInvalid = true;
    }
  }

  // In the userPayload section, replace the cross-role redirect logic with:

if (userPayload) {
  const role = normalizeRole(userPayload.role);
  const status = normalizeRole(userPayload.status);
  const allowedRoles = ["USER", "MEMBER", "VIEWER"];
  // 🚫 Block admins/superadmins — they belong on their own portals
  if (!allowedRoles.includes(role)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
      { error: "Access denied. You do not have permission to access this portal." },
      { status: 403 }
      );
    }
    // Clear stale cookies and send back to login
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("accessToken");
    response.cookies.delete("refreshToken");
    response.cookies.delete("consoleAccessToken");
    return response;
  }

  // ✅ Valid role — redirect away from public routes (login page etc.)
  if (isPublicRoute) {
    return NextResponse.redirect(new URL("/user/dashboard", request.url));
  }

  // Subscription check — only applies to account owners (USER role).
  // Team members (MEMBER/VIEWER) ride on the owner's plan, skip this check.
  if (role === "USER" && (pathname.startsWith("/user") || pathname.startsWith("/api/user"))) {
    const isExternalToken = !accessToken && !!externalAccessToken;
    if (!isExternalToken) {
      const accessState = getUserAccessState(userPayload);
      // ... keep all your existing CASE 1/2/3 logic unchanged
    }
  }

  return NextResponse.next();
}

  // ── Unauthenticated user ───────────────────────────────────────────────────
  if (!userPayload && !isPublicRoute) {
    if (refreshToken) return NextResponse.next();
    if (pathname.startsWith("/api"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclude /uploads so middleware never runs for media URLs (Meta fetches these for template/interactive headers)
  // Exclude /socket.io to allow WebSocket connections without middleware interference
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|public|uploads/|socket\\.io).*)",
    "/api/:path*",
    "/admin/:path*",
    "/user/:path*",
    "/master/:path*",
  ],
};
