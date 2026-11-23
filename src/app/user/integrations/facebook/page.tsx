"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FacebookIntegrationScreen from "@/features/integrations/screens/FacebookIntegrationScreen/FacebookIntegrationScreen";

// Facebook returns both apps here; ?feature=messaging means the Messenger (App 2) login.
function FacebookRoute() {
  const feature = useSearchParams().get("feature") === "messaging" ? "messaging" : "leads";
  return <FacebookIntegrationScreen key={feature} feature={feature} />;
}

export default function Page() {
  return <Suspense fallback={null}><FacebookRoute /></Suspense>;
}
