"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Gauge, Loader2, PlayCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import Modal from "@/components/ui/Modal";
import { useEmbeddedSignup } from "@/features/onboarding/useEmbeddedSignup";
import { formatMessagingLimit, useWabaMessagingLimit } from "./MessagingLimit";

type Waba = {
  id: string;
  waba_id: string;
  name: string;
  status?: string;
  whatsapp_business_manager_messaging_limit?: string | null;
};

const SELECTED_KEY = "topbar_selected_waba";

// Attention styles for the pending state: a light sweep across "Apply now" and a soft pulse on "Pending".
const SHINE_CSS = `
@keyframes waba-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(260%) skewX(-20deg); } }
@keyframes waba-glow { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-primary) 45%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in oklab, var(--color-primary) 0%, transparent); } }
@keyframes waba-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--color-warning) 40%, transparent); } 50% { box-shadow: 0 0 0 5px color-mix(in oklab, var(--color-warning) 0%, transparent); } }
.waba-apply { animation: waba-glow 2.2s ease-in-out infinite; }
.waba-apply::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary-foreground) 55%, transparent), transparent); animation: waba-shine 2.6s ease-in-out infinite; pointer-events: none; }
.waba-pending { animation: waba-pulse 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .waba-apply, .waba-apply::after, .waba-pending { animation: none; } }
`;

const isActive = (w?: Waba | null) => String(w?.status ?? "").toLowerCase() === "active";

/** Same business name can appear on several WABAs, so add the last digits of the WABA ID. */
const wabaLabel = (w: Waba, all: Waba[]) =>
  all.filter((o) => o.name === w.name).length > 1 ? `${w.name} (…${w.waba_id.slice(-4)})` : w.name;

/**
 * Topbar summary of the user's WhatsApp Business Accounts: pick a WABA by name, see whether it is
 * active and its Meta messaging limit. When there is no active WABA, "Apply now" opens the signup popup.
 */
export function WabaStatus({ className }: { className?: string }) {
  const [wabas, setWabas] = useState<Waba[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get("/admin/waba");
      const list: Waba[] = Array.isArray(res.data?.data) ? res.data.data : [];
      setWabas(list);
      setSelectedId((prev) => {
        const saved = prev ?? localStorage.getItem(SELECTED_KEY);
        if (saved && list.some((w) => w.id === saved)) return saved;
        // Default to the first active account.
        return (list.find(isActive) ?? list[0])?.id ?? null;
      });
    } catch {
      setWabas([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => wabas?.find((w) => w.id === selectedId) ?? null, [wabas, selectedId]);
  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
  };

  const pending = !selected || !isActive(selected);
  const savedTier = selected?.whatsapp_business_manager_messaging_limit ?? null;
  // The WABA list only has a limit once it was fetched from Meta; otherwise fetch it now.
  const fetched = useWabaMessagingLimit(!pending && !savedTier ? selected?.waba_id : null);

  if (wabas === null) return null;

  const limit = !pending ? formatMessagingLimit(savedTier ?? fetched.limit) : null;
  const limitLoading = !pending && !limit && fetched.refreshing;
  const limitMissing = !pending && !limit && !fetched.refreshing;

  return (
    <>
      <div className={cn("items-center gap-2", className ?? "flex")}>
        <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-3.5 pr-1">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">WhatsApp API</span>

          {wabas.length > 1 && selected && (
            <label className="relative flex items-center">
              <span className="sr-only">WhatsApp Business Account</span>
              <select
                value={selected.id}
                onChange={(e) => select(e.target.value)}
                title={`${selected.name} · ${selected.waba_id}`}
                className="h-7 max-w-[11rem] cursor-pointer appearance-none truncate rounded-full bg-surface-muted pl-2.5 pr-7 text-xs font-semibold text-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary"
              >
                {wabas.map((w) => (
                  <option key={w.id} value={w.id}>
                    {wabaLabel(w, wabas)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 text-muted-foreground" />
            </label>
          )}
          {wabas.length === 1 && selected && (
            <span className="max-w-[11rem] truncate text-xs font-semibold text-foreground" title={selected.waba_id}>
              {selected.name}
            </span>
          )}

          {pending ? (
            <button
              type="button"
              onClick={() => setApplyOpen(true)}
              title="Apply for the WhatsApp Business API"
              className="waba-pending inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-bg px-3 text-sm font-bold text-warning transition hover:brightness-95"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
              </span>
              Pending
            </button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-success-bg px-3 text-sm font-bold text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Active
            </span>
          )}

          {limitLoading && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap pr-2.5 text-sm text-muted-foreground" title="Fetching the messaging limit from Meta">
              <Loader2 size={13} className="animate-spin" />
              Limit
            </span>
          )}
          {limitMissing && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap pr-2.5 text-sm text-muted-foreground"
              title={fetched.error ?? "Meta hasn't reported a messaging limit for this account yet"}
            >
              <Gauge size={13} />
              Limit —
            </span>
          )}
          {limit && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap pr-2.5 text-sm font-semibold text-foreground"
              title="Meta messaging limit (business-initiated conversations per 24h)"
            >
              <Gauge size={13} className="text-primary-text" />
              {limit}
              {limit !== "Unlimited" && limit !== "Untiered" && <span className="font-normal text-muted-foreground">/24h</span>}
            </span>
          )}
        </div>

        {pending && (
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            className="waba-apply relative inline-flex h-10 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-primary-hover px-5 text-sm font-bold text-primary-foreground shadow-md transition hover:-translate-y-px hover:shadow-lg"
          >
            <Sparkles size={16} />
            Apply now
          </button>
        )}
      </div>

      {pending && <style>{SHINE_CSS}</style>}
      {applyOpen && <ApplyForWhatsAppModal onClose={() => setApplyOpen(false)} />}
    </>
  );
}

/** "Apply for WhatsApp Business API" popup; mounted only while open so the Facebook SDK loads on demand. */
function ApplyForWhatsAppModal({ onClose }: { onClose: () => void }) {
  const { sdkReady, error, stage, launch, cancel } = useEmbeddedSignup();
  const busy = stage === "waiting_meta" || stage === "connecting";

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title="Apply for WhatsApp Business API"
      description="Click Continue with Facebook to apply for the WhatsApp Business API."
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {busy && stage === "waiting_meta" && (
            <button type="button" onClick={cancel} className="mr-auto text-sm text-muted-foreground underline">
              Cancel signup
            </button>
          )}
          <button
            type="button"
            onClick={launch}
            disabled={!sdkReady || busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(busy || !sdkReady) && !error && <Loader2 size={16} className="animate-spin" />}
            {stage === "waiting_meta"
              ? "Continue in Facebook…"
              : stage === "connecting"
                ? "Connecting…"
                : sdkReady
                  ? "Continue with Facebook"
                  : "Loading…"}
          </button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Requirements to apply</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>A registered business and a working website.</li>
            <li>A phone number that can receive an SMS or call for verification.</li>
            <li>Access to your business&apos;s Facebook / Meta Business account.</li>
          </ul>
          {stage === "waiting_meta" && (
            <p role="status" className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info">
              Complete the setup in the Facebook popup. We&apos;ll connect the account automatically.
            </p>
          )}
          {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-xs text-error">{error}</p>}
        </div>

        {/* Tutorial video placeholder */}
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-muted text-center">
          <PlayCircle size={40} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Video tutorial</p>
          <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-text">
            Coming soon
          </span>
        </div>
      </div>
    </Modal>
  );
}
