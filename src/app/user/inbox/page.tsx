"use client";

import React, { Suspense } from "react";
import Spinner from "@/components/ui/Spinner";
import { InboxScreen } from "@/features/inbox";

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-background">
          <Spinner size="lg" label="Loading inbox" />
        </div>
      }
    >
      <InboxScreen />
    </Suspense>
  );
}
