"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, ArrowRight, LogOut, RefreshCw } from "lucide-react";
import {
  isTeamMemberUser,
  isRoutePermitted,
  getFirstPermittedRoute,
} from "@/lib/permissions";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

export function TeamRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeam, setIsTeam] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get("/admin/team/my-permissions");
      const perms = res.data?.data?.permissions;
      if (Array.isArray(perms)) {
        const lower = perms.map((p: string) => String(p).toLowerCase().trim());
        setPermissions(lower);
        localStorage.setItem("permissions", JSON.stringify(lower));
      } else {
        setPermissions([]);
        localStorage.setItem("permissions", JSON.stringify([]));
      }
    } catch {
      // If network fails, fallback to localStorage if available
      const saved = localStorage.getItem("permissions");
      if (saved !== null) {
        try {
          const parsed = JSON.parse(saved);
          setPermissions(Array.isArray(parsed) ? parsed : []);
        } catch {
          setPermissions([]);
        }
      } else {
        setPermissions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isTeamMember = isTeamMemberUser();
    setIsTeam(isTeamMember);

    if (!isTeamMember) {
      setLoading(false);
      return;
    }

    // Try reading immediate cached permissions for zero-flicker experience
    const saved = localStorage.getItem("permissions");
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPermissions(parsed);
          setLoading(false);
        }
      } catch {
        /* ignore */
      }
    }

    // Sync latest permissions from server
    fetchPermissions();

    const handleFocus = () => fetchPermissions();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchPermissions]);

  const handleLogout = () => {
    localStorage.removeItem("console_access_token");
    localStorage.removeItem("permissions");
    localStorage.removeItem("user_data");
    localStorage.removeItem("company_id");
    document.cookie = "consoleAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = "/";
  };

  // For non-team members (owners, admins), allow everything
  if (!isTeam) {
    return <>{children}</>;
  }

  // Still initializing and no cached permissions available yet
  if (loading && permissions === null) {
    return (
      <div className="flex h-[70vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  const { allowed, requiredKey, label, reason } = isRoutePermitted(
    pathname || "",
    permissions,
    true
  );

  if (allowed) {
    return <>{children}</>;
  }

  const firstPermitted = getFirstPermittedRoute(permissions || []);
  const hasNoPerms = !permissions || permissions.length === 0;

  return (
    <div className="flex min-h-[75vh] w-full items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 sm:p-10 shadow-lg text-center animate-fadeIn">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
          <ShieldAlert className="h-8 w-8 stroke-[2.2]" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2">
          {reason === "owner_only" ? "Restricted Section" : "Access Denied"}
        </h2>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
          {reason === "owner_only" ? (
            "This settings section is restricted to organization administrators and owners."
          ) : hasNoPerms ? (
            "You do not have access to any pages because no navigation permissions have been assigned to your account. Please ask your administrator to grant you permissions."
          ) : (
            <>
              You do not have permission to access{" "}
              <strong className="text-foreground">{label || requiredKey || "this page"}</strong>.
              Please contact your administrator if you need access.
            </>
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {firstPermitted && (
            <button
              onClick={() => router.push(firstPermitted)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs hover:opacity-90 transition shadow-xs"
            >
              Go to Permitted Page
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition"
          >
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
