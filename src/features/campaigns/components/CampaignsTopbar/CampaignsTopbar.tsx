"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function CampaignsTopbar({
  onSearch,
}: {
  onSearch?: (q: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="w-full flex flex-col gap-4 mb-6">
      {/* TITLE */}
      <div>
        <h1 className="page-title text-5xl text-white! text-dark-white! font-bold leading-tight">
          Campaigns
        </h1>
        <p className="text-2xl text-white">
          Manage and launch campaigns
        </p>
      </div>

      {/* SEARCH + BUTTON ROW */}
      <div className="w-full flex justify-end items-center gap-4">
        {/* SEARCH BOX */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
            size={18}
          />

          <input
            type="search"
            placeholder="Search campaigns..."
            className="
            w-full
            px-4 py-2
            rounded-xl
            border border-primary-soft
            bg-surface
            text-white
            placeholder-muted-foreground
            focus:outline-none
            focus:ring-0
          "
            style={{
              paddingLeft: "2.8rem",
            }} /* <-- HARD OVERRIDE (Fixes overlap 100%) */
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        {/* CREATE BUTTON */}
        <button
          onClick={() => router.push("/user/campaigns/create")}
          className="
  px-4 py-2
  rounded-lg
  font-semibold
  bg-[var(--color-success-light)]!
  text-[var(--color-success-dark)]!
  dark:text-[var(--color-success-dark)]!
  border border-primary-soft
  hover:bg-primary-soft!
  transition-none
"
        >
          Create Campaign
        </button>
      </div>
    </div>
  );
}
