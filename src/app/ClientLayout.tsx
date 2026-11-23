"use client";

import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { PlanCheckWrapper } from "@/components/PlanCheckWrapper";
import { TeamRouteGuard } from "@/components/TeamRouteGuard";
import SocketNotificationListener from "@/components/SocketNotificationListener";

// Auth pages render without the application shell
const AUTH_ROUTES = ["/", "/login", "/signup", "/auth", "/team/setup-password"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isAuthPage, setIsAuthPage] = useState(true);

  useEffect(() => {
    if (!pathname) return;
    setIsAuthPage(AUTH_ROUTES.includes(pathname));
    setIsReady(true);
  }, [pathname]);

  if (!isReady) return null;

  // Admin pages use their own layout
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <PlanCheckWrapper>
      {isAuthPage ? (
        children
      ) : (
        <AppShell>
          <TeamRouteGuard>{children}</TeamRouteGuard>
          <SocketNotificationListener />
        </AppShell>
      )}
    </PlanCheckWrapper>
  );
}
