import { cn } from "@/lib/utils";

export default function IntegrationIcon({ appId, icon, className }: { appId?: string; icon?: string; className?: string }) {
  if (appId === "shopify") {
    return (
      <svg viewBox="0 0 40 48" fill="none" aria-hidden="true" className={cn("h-10 w-9 shrink-0", className)}>
        <path d="m6 12 23-5 7 5 3 33-35 2 2-35Z" fill="var(--color-shopify)" />
        <path d="m29 7 2 39 8-1-3-33-7-5Z" fill="var(--color-shopify-side)" />
        <path d="M12 13c0-7 3-11 7-11s6 4 6 9m-9 1c0-7 2-10 5-10s5 3 5 9" stroke="var(--color-shopify)" strokeWidth="1.6" />
        <path d="M25 19c-2-1-4-1-6 0-2 1-3 3-3 5 0 5 6 5 5 8-1 2-4 1-7-1l-1 5c4 2 8 2 11-1 5-7-4-9-3-12 0-1 2-1 3 0l1-4Z" fill="var(--color-shopify-foreground)" />
      </svg>
    );
  }
  if (appId === "google_sheets") {
    return (
      <svg viewBox="0 0 40 48" fill="none" aria-hidden="true" className={cn("h-10 w-9 shrink-0", className)}>
        <path d="M5 1h21l11 11v32a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3Z" fill="var(--color-google-sheets)" />
        <path d="M26 1v9a2 2 0 0 0 2 2h9L26 1Z" fill="var(--color-google-sheets-fold)" />
        <path d="M12 23h16v15H12V23Zm0 5h16m-16 5h16m-8-10v15" stroke="var(--color-google-sheets-grid)" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center text-2xl", className)}>{icon}</span>;
}
