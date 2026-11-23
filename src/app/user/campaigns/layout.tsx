import type { ReactNode } from "react";
import CampaignsLayoutClient from "./CampaignsLayoutClient";

export default function CampaignsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CampaignsLayoutClient>{children}</CampaignsLayoutClient>;
}
