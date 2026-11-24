"use client";

import { usePathname } from "next/navigation";
import React, { Suspense } from "react";
import { AppShell } from "@/components/shell";
import { DoveKnotMark } from "@/components/brand/DoveKnotLogo";
import { PlanCheckWrapper } from "@/components/PlanCheckWrapper";
import { TeamRouteGuard } from "@/components/TeamRouteGuard";
import SocketNotificationListener from "@/components/SocketNotificationListener";

// Auth pages render without the application shell
const AUTH_ROUTES = ["/", "/login", "/signup", "/auth", "/team/setup-password"];

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" aria-label="Loading DoveKnot">
      <DoveKnotMark className="h-12 w-12 animate-pulse" priority />
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  // Admin pages use their own layout
  if (pathname.startsWith("/admin")) {
    return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
  }

  return (
    <PlanCheckWrapper>
      {isAuthPage ? (
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      ) : (
        <AppShell>
          <Suspense fallback={<RouteFallback />}>
            <TeamRouteGuard>{children}</TeamRouteGuard>
          </Suspense>
          <SocketNotificationListener />
        </AppShell>
      )}
    </PlanCheckWrapper>
  );
}
