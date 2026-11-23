"use client";

import { usePathname } from "next/navigation";

export default function CampaignsLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStatsPage = pathname?.includes("/stats") ?? false;

  // Stats page needs overflow-y: auto to scroll the table - campaign-page-wrapper uses overflow:hidden
  if (isStatsPage) {
    return (
      <div className="campaign-stats-layout min-h-0 flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>
    );
  }

  return <div className="w-full min-h-full bg-background">{children}</div>;
}
