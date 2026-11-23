import { CreditCard, MessageCircle, Workflow, Zap } from "lucide-react";
import IntegrationIcon from "../../components/builder/IntegrationIcon";
import { cn } from "@/lib/utils";

/** Icon for an appKey from the automation API (google-sheets, shopify, razorpay, whatsapp). */
export default function AppIcon({ appKey, trigger, className }: { appKey: string | null; trigger?: boolean; className?: string }) {
  if (appKey === "shopify") return <IntegrationIcon appId="shopify" className={cn("!h-8 !w-7", className)} />;
  if (appKey === "google-sheets") return <IntegrationIcon appId="google_sheets" className={cn("!h-8 !w-7", className)} />;
  if (appKey === "whatsapp") {
    return (
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground", className)} aria-hidden>
        <MessageCircle size={16} />
      </span>
    );
  }
  if (appKey === "razorpay") {
    return (
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-info-border bg-info-bg text-info", className)} aria-hidden>
        <CreditCard size={16} />
      </span>
    );
  }
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-muted-foreground", className)} aria-hidden>
      {trigger ? <Zap size={16} /> : <Workflow size={16} />}
    </span>
  );
}
