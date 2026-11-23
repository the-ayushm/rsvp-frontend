"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Play, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { ScreensNavigator } from "./ScreensNavigator";
import { ContentBuilder } from "./ContentBuilder";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { exportFlowJSON } from "./export-flow-json";
import type { FlowScreen, ContentBlock } from "./types";
import { createScreen } from "./types";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface WhatsAppAccount {
  id: number;
  name: string | null;
  phoneNumber: string | null;
  wabaId: string | null;
}

export default function FlowBuilderPage() {
  const searchParams = useSearchParams();
  const flowIdFromUrl = searchParams.get("flowId");
  const businessIdFromUrl = searchParams.get("businessId");
  const initialNameFromUrl = searchParams.get("name") || "Flow Builder";
  const [flowName, setFlowName] = useState(initialNameFromUrl);
  const [screens, setScreens] = useState<FlowScreen[]>(() => [
    createScreen(0, "Screen 1"),
  ]);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const [savedFlowId, setSavedFlowId] = useState<number | null>(
    flowIdFromUrl ? parseInt(flowIdFromUrl, 10) : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(businessIdFromUrl);

  const selectedScreen = screens[selectedScreenIndex] ?? null;

  // When editing an existing flow, fetch its JSON and hydrate screens.
  useEffect(() => {
    if (!flowIdFromUrl) return;
    const id = parseInt(flowIdFromUrl, 10);
    if (Number.isNaN(id)) return;

    const fetchExisting = async () => {
      try {
        const res = await soft7AxiosInstance.get(`/api/user/whatsapp-flows/${id}`);
        const data = await res.data;
        const rawJson = data.flowJson || data.flow_json;
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson) as { screens?: any[] };
        const first = parsed.screens?.[0];
        if (!first || !first.layout || !Array.isArray(first.layout.children)) return;

        const blocks: ContentBlock[] = [];
        for (const child of first.layout.children as any[]) {
          if (child.type === "TextHeading") {
            blocks.push({
              id: `b_heading_${Date.now()}`,
              type: "heading",
              text: child.text ?? "",
            });
          } else if (child.type === "Form" && Array.isArray(child.children)) {
            for (const field of child.children as any[]) {
              if (field.type === "TextInput") {
                blocks.push({
                  id: field.name || `b_text_${Date.now()}`,
                  type: field["input-type"] === "number" ? "number_input" : "text_input",
                  label: field.label ?? "",
                  placeholder: field["helper-text"] ?? "",
                  required: !!field.required,
                  maxLength: typeof field["max-chars"] === "number" ? field["max-chars"] : undefined,
                });
              }
            }
          }
        }

        if (blocks.length > 0) {
          setScreens([
            {
              id: first.id || `screen_${Date.now()}`,
              title: first.title || flowName,
              blocks,
            },
          ]);
          setSelectedScreenIndex(0);
        }
      } catch (e) {
        console.error("Failed to hydrate flow into builder", e);
      }
    };

    fetchExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowIdFromUrl]);

  // If user opened builder directly from sidebar (no businessId in URL),
  // fall back to the first active WhatsApp account's WABA ID.
  useEffect(() => {
    if (businessIdFromUrl) return; // URL already defines businessId

    const fetchAccounts = async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
        const data = res.data;

        // Extract the array from various possible response shapes (same logic as inbox)
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.data?.data)
            ? data.data.data
            : Array.isArray(data?.data?.phone_numbers)
              ? data.data.phone_numbers
              : Array.isArray(data?.data?.phoneNumbers)
                ? data.data.phoneNumbers
                : Array.isArray(data?.data)
                  ? data.data
                  : Array.isArray(data?.phone_numbers)
                    ? data.phone_numbers
                    : Array.isArray(data?.results)
                      ? data.results
                      : [];

        // Map to the WhatsAppAccount shape expected by this component
        const mapped: WhatsAppAccount[] = rawList.map((pn: any, idx: number) => ({
          id: pn.id || idx,
          name: pn.verified_name || pn.display_phone_number || pn.phone_number || null,
          phoneNumber: pn.display_phone_number || pn.phone_number || pn.number || null,
          wabaId: String(pn.waba_id || pn.wabaId || pn.id || ""),
        }));

        setAccounts(mapped);
        if (!selectedBusiness && mapped.length > 0) {
          setSelectedBusiness(mapped[0].wabaId || null);
        }
      } catch (error) {
        console.error("Failed to fetch WhatsApp accounts for Flow Builder:", error);
      }
    };

    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessIdFromUrl]);

  const handleScreensChange = useCallback((next: FlowScreen[]) => {
    setScreens(next);
  }, []);

  const handleScreenChange = useCallback(
    (updated: FlowScreen) => {
      setScreens((prev) => {
        const next = [...prev];
        if (next[selectedScreenIndex]) next[selectedScreenIndex] = updated;
        return next;
      });
    },
    [selectedScreenIndex],
  );

  const handleCopyJson = useCallback(() => {
    const json = exportFlowJSON(screens, flowName);
    navigator.clipboard
      .writeText(json)
      .then(() => toast.success("Flow JSON copied to clipboard"));
  }, [screens, flowName]);

  const handleSaveDraft = useCallback(async () => {
    if (!flowName.trim()) {
      toast.error("Enter a flow name");
      return;
    }
    const flowJson = exportFlowJSON(screens, flowName);
    setIsSaving(true);
    try {
      if (savedFlowId != null) {
        await soft7AxiosInstance.patch(`/api/user/whatsapp-flows/${savedFlowId}`, {
          flow_json: flowJson,
        });
        toast.success("Draft updated");
      } else {
        const res = await soft7AxiosInstance.post("/api/user/whatsapp-flows/create", {
          businessId: selectedBusiness,
          name: flowName.trim(),
          flow_json: flowJson,
          categories: ["OTHER"],
          publish: false,
        });
        const created = res.data as { id: number };
        setSavedFlowId(created.id);
        toast.success("Draft saved");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (
              err as {
                response?: {
                  data?: { error?: string; validation_errors?: unknown };
                };
              }
            ).response?.data?.error
          : null;
      toast.error(msg || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }, [flowName, screens, savedFlowId, selectedBusiness]);

  const handleTestFlow = useCallback(() => {
    toast("Test flow (connect to your backend when ready)");
  }, []);

  const handlePublishFlow = useCallback(async () => {
    if (savedFlowId == null) {
      toast.error("Save draft first, then publish");
      return;
    }
    setIsPublishing(true);
    try {
      await soft7AxiosInstance.post(
        `/api/user/whatsapp-flows/${savedFlowId}/publish`,
      );
      toast.success("Flow published");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : null;
      toast.error(msg || "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }, [savedFlowId]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Toolbar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border dark:border-border-subtle bg-surface dark:bg-surface">
        <div className="flex items-center gap-4">
          <Link
            href="/user/manage/whatsapp-flows"
            className="flex items-center gap-2 text-sm font-medium text-secondary-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="text-base font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground dark:text-foreground min-w-[180px]"
            placeholder="Flow name"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-secondary-foreground dark:text-muted-foreground hover:bg-surface-hover dark:hover:bg-surface-raised rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={handleTestFlow}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-secondary-foreground dark:text-muted-foreground hover:bg-surface-hover dark:hover:bg-surface-raised rounded-lg transition"
          >
            <Play className="w-4 h-4" />
            Test Flow
          </button>
          <button
            type="button"
            onClick={handlePublishFlow}
            disabled={isPublishing || savedFlowId == null}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isPublishing ? "Publishing…" : "Publish Flow"}
          </button>
        </div>
      </header>

      {/* 3-column layout: Left 260px, Center flex, Right 380px */}
      <div className="flex-1 flex min-h-0 gap-0">
        <ScreensNavigator
          screens={screens}
          selectedIndex={selectedScreenIndex}
          onScreensChange={handleScreensChange}
          onSelectScreen={setSelectedScreenIndex}
        />
        <ContentBuilder
          screen={selectedScreen}
          onScreenChange={handleScreenChange}
        />
        <WhatsAppPreview screen={selectedScreen} onCopyJson={handleCopyJson} />
      </div>
    </div>
  );
}
