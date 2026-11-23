"use client";
import { useEffect, useState } from "react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import {
  Key,
  Phone,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "react-hot-toast";

type ApiKey = {
  id: string;
  apiKey?: string;    // actual field returned by the API
  key?: string;
  api_key?: string;
  token?: string;
  key_prefix?: string;
  name?: string;
  created_at?: string;
  [k: string]: unknown;
};

type PhoneNumber = {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
  phone_number_id: string;
};

/** Resolve the actual key string from whichever field the API returns */
function resolveKey(apiKey: ApiKey): string {
  return (apiKey.apiKey ?? apiKey.key ?? apiKey.api_key ?? apiKey.token ?? "") as string;
}

/** Mask a key: show first 4 chars + dots + last 4 chars */
function maskKey(raw: string): string {
  if (!raw || raw.length <= 8) return raw ?? "";
  return raw.slice(0, 4) + "●".repeat(Math.min(raw.length - 8, 36)) + raw.slice(-4);
}

function qualityColor(rating: string) {
  switch (rating?.toUpperCase()) {
    case "GREEN":  return "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border-[rgba(var(--color-primary-rgb),0.3)]";
    case "YELLOW": return "bg-warning-bg text-warning border-warning-border";
    case "RED":    return "bg-error-bg text-error border-error-border";
    default:       return "bg-surface-hover text-muted-foreground border-border";
  }
}

export default function WhatsAppBusinessApiPage() {
  const [apiKeys, setApiKeys]         = useState<ApiKey[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [revealedId, setRevealedId]   = useState<string | null>(null);

  /* ── fetch data ─────────────────────────────────────────────────────────── */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, numsRes] = await Promise.allSettled([
        soft7AxiosInstance.get("/admin/api-keys"),
        soft7AxiosInstance.get("/admin/waba/phone-numbers"),
      ]);
      if (keysRes.status === "fulfilled" && keysRes.value.data?.success)
        setApiKeys(keysRes.value.data.data ?? []);
      if (numsRes.status === "fulfilled" && numsRes.value.data?.success)
        setPhoneNumbers(numsRes.value.data.data ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── generate api key ───────────────────────────────────────────────────── */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await soft7AxiosInstance.post("/admin/api-keys", {});
      if (res.data?.success) {
        toast.success("API key generated!");
        await fetchData();
      } else {
        toast.error(res.data?.message ?? "Failed to generate API key");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  /* ── copy ───────────────────────────────────────────────────────────────── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const hasKey = apiKeys.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-10 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page heading ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            WhatsApp Messaging API
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage your API key for WhatsApp messaging integration
          </p>
        </div>

        {/* ── Card 1: Generate API Key ─────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border shadow-xs p-6">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Generate API Key</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            You can only have one API key at a time. Delete your existing key to generate a new one.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground text-xs font-semibold rounded-lg transition-all shadow-xs"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Key className="w-3.5 h-3.5" />
            )}
            Generate API Key
          </button>
        </div>

        {/* ── Card 2: Your API Key (always visible, shows loading / empty / key) */}
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">

          {/* Card header */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
            <Key className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-bold text-foreground">Your API Key</h2>
            {!loading && hasKey && (
              <span className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border border-[rgba(var(--color-primary-rgb),0.3)]">
                Active
              </span>
            )}
          </div>

          <div className="px-6 py-5 space-y-5">
            <p className="text-xs text-muted-foreground -mt-1">
              Manage your current API key and associated phone numbers
            </p>

            {/* ── API Key row ──────────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Key className="w-3 h-3 text-primary" />
                Your API Key:
              </p>

              {loading ? (
                <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-border bg-muted/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading…</span>
                </div>
              ) : !hasKey ? (
                <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-dashed border-border bg-muted/40">
                  <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    No API key yet — click &quot;Generate API Key&quot; above.
                  </span>
                </div>
              ) : (
                <>
                  {apiKeys.map((apiKey) => {
                    const rawKey = resolveKey(apiKey);
                    return (
                    <div
                      key={apiKey.id}
                      className="flex items-center gap-2 h-11 px-4 rounded-xl border border-border bg-muted/40"
                    >
                      {/* Masked / revealed key */}
                      <code className="flex-1 text-xs font-mono text-foreground truncate select-all tracking-wide">
                        {revealedId === apiKey.id ? rawKey : maskKey(rawKey)}
                      </code>

                      {/* Eye toggle */}
                      <button
                        onClick={() =>
                          setRevealedId((v) => (v === apiKey.id ? null : apiKey.id))
                        }
                        title={revealedId === apiKey.id ? "Hide key" : "Show key"}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      >
                        {revealedId === apiKey.id ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(rawKey, apiKey.id)}
                        title="Copy API key"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      >
                        {copiedId === apiKey.id ? (
                          <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    );
                  })}

                </>
              )}
            </div>

            {/* ── Associated Phone Numbers ─────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold text-foreground">
                  Associated Phone Numbers:
                </p>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs py-2 px-4">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading numbers…
                </div>
              ) : phoneNumbers.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border bg-muted/40">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    No phone numbers associated yet.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {phoneNumbers.map((num) => (
                    <div
                      key={num.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40"
                    >
                      {/* Status dot */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          num.status === "active" ? "bg-[var(--color-primary)]" : "bg-disabled-foreground"
                        }`}
                      />

                      {/* Number + name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {num.display_phone_number}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-1 text-[10px] text-muted-foreground">
                          <span>{num.verified_name} ·</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(num.phone_number_id, `numid-${num.id}`)
                            }
                            title="Copy phone number ID"
                            aria-label="Copy phone number ID"
                            className="group inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <span className="font-mono">ID: {num.phone_number_id}</span>
                            {copiedId === `numid-${num.id}` ? (
                              <Check className="w-3 h-3 text-[var(--color-primary)]" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Quality badge */}
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${qualityColor(num.quality_rating)} shrink-0`}
                      >
                        {num.quality_rating}
                      </span>

                      {/* Shield verified */}
                      <span title="Verified" className="shrink-0">
                        <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
                      </span>

                      {/* Copy number */}
                      <button
                        onClick={() =>
                          handleCopy(num.display_phone_number, `num-${num.id}`)
                        }
                        title="Copy number"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      >
                        {copiedId === `num-${num.id}` ? (
                          <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
