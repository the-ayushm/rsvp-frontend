"use client";

import { usePathname, useRouter } from "next/navigation";
import { User, Users, Building2, CreditCard } from "lucide-react";
import { isTeamMemberUser } from "@/lib/permissions";
import { useEffect, useState } from "react";

const navigationItems = [
  { name: "Profile", href: "/user/settings/profile", icon: User },
  { name: "Team", href: "/user/settings/team", icon: Users },
  {
    name: "Organization",
    href: "/user/settings/organization",
    icon: Building2,
  },
  { name: "Billing", href: "/user/settings/billing", icon: CreditCard },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeam, setIsTeam] = useState(false);

  useEffect(() => {
    setIsTeam(isTeamMemberUser());
  }, []);

  const visibleItems = isTeam
    ? navigationItems.filter((item) => item.name === "Profile")
    : navigationItems;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation tabs */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5 border-b border-border bg-panel sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto">
          <nav className="flex flex-wrap items-center gap-3 sm:gap-3.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card hover:bg-muted text-foreground border-border shadow-2xs hover:border-border/80"
                  }`}
                >
                  <Icon
                    size={15}
                    strokeWidth={2.2}
                    className={isActive ? "text-white" : "text-primary shrink-0"}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto pt-8 pb-12">{children}</main>
    </div>
  );
}
