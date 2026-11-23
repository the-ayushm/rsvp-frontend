/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Copy,
  Check,
  Plus,
  Eye,
  RefreshCw,
  ShieldCheck,
  Edit,
  Trash2,
  FileText,
  Search,
  X,
  ArrowLeft,
  Phone,
  Filter,
  Loader2,
  MessageSquare,
  BadgeCheck,
  CheckCheck,
  ExternalLink,
  Reply,
  Globe,
  Layers,
  Calendar,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import FormattedText from "@/features/templates/components/FormattedText";
import TemplateCard from "@/features/templates/components/TemplateCard";
import {
  EXAMPLE_COLLECTIONS,
  EXAMPLE_INDUSTRIES,
  EXAMPLE_TEMPLATES,
  TEMPLATE_DRAFT_STORAGE_KEY,
  exampleToFormState,
  renderExampleBody,
  type ExampleCollection,
  type ExampleIndustry,
  type ExampleTemplate,
} from "@/features/templates/data/exampleTemplates";
import styles from "../../templates.module.css";

type TemplatesTab = "EXAMPLES" | "UTILITY" | "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const TEMPLATE_TABS: { value: TemplatesTab; label: string }[] = [
  { value: "EXAMPLES", label: "Example Template" },
  { value: "UTILITY", label: "Utility" },
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

/** Decorative stand-in for an example template's media header. */
function ExampleArt({ art }: { art: NonNullable<ExampleTemplate["art"]> }) {
  return (
    <div
      className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, var(--color-${art.tone}) 30%, var(--color-surface)), var(--color-${art.tone}))`,
      }}
    >
      <span className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-surface/25" />
      <span className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-surface/20" />
      <span className="absolute right-6 top-5 h-3 w-3 rounded-full bg-surface/60" />
      <div className="relative flex flex-col items-center gap-2">
        <span className="text-6xl drop-shadow-lg">{art.emoji}</span>
        <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-foreground shadow">
          {art.label}
        </span>
      </div>
    </div>
  );
}

/** Media header of a saved template, rendered for the card grid. */
function TemplateMedia({ header, metaData }: { header: any; metaData: any }) {
  const url = header?.example?.header_handle?.[0] || metaData?.headerMediaUrl || metaData?.header_media_url;
  if (header?.format === "IMAGE" && url) {
    return (
      <img
        src={url}
        alt="Header"
        className="aspect-[16/10] w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  if (header?.format === "VIDEO" && url) {
    return <video src={url} className="aspect-[16/10] w-full object-cover" muted />;
  }
  const label = header?.format === "VIDEO" ? "Video" : header?.format === "DOCUMENT" ? "Document" : "Image";
  return (
    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 bg-surface-active text-xs text-muted-foreground">
      <FileText size={28} />
      {label}
    </div>
  );
}

function parseJson(value: any, fallback: any) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export interface WhatsAppComponent {
  text: string;
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  buttons?: any[];
  example?: any;
}

export interface PhoneNumber {
  id: string;
  company_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status: string | null;
  quality_rating: string;
  status: string;
  messaging_limit_tier: number;
  capabilities: any;
  meta_data: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WhatsAppTemplate {
  id: string;
  company_id: string;
  waba_id: string;
  template_id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  rejection_reason: string | null;
  components: WhatsAppComponent[];
  meta_data: any;
  synced_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function getComponentTextWithExamples(
  component: any,
  metaDataOrComponents?: any,
  type: "BODY" | "HEADER" = "BODY",
): string {
  if (!component?.text) return "";

  const rawText: string = component.text;

  // Normalize metaDataComponents
  let metaDataComponents: any[] = [];
  if (Array.isArray(metaDataOrComponents)) {
    metaDataComponents = metaDataOrComponents;
  } else if (typeof metaDataOrComponents === "string") {
    try {
      const parsed = JSON.parse(metaDataOrComponents);
      if (Array.isArray(parsed)) metaDataComponents = parsed;
      else if (Array.isArray(parsed?.components)) metaDataComponents = parsed.components;
    } catch (_) {}
  } else if (metaDataOrComponents && typeof metaDataOrComponents === "object") {
    if (Array.isArray(metaDataOrComponents.components)) {
      metaDataComponents = metaDataOrComponents.components;
    } else if (typeof metaDataOrComponents.components === "string") {
      try {
        const parsed = JSON.parse(metaDataOrComponents.components);
        if (Array.isArray(parsed)) metaDataComponents = parsed;
      } catch (_) {}
    }
  }

  // Resolve example object from component or meta_data components
  let example = component.example;
  if (!example && Array.isArray(metaDataComponents)) {
    const metaComp = metaDataComponents.find((c: any) => c?.type === type);
    if (metaComp?.example) {
      example = metaComp.example;
    }
  }

  // Also check if component itself has example as string
  if (typeof example === "string") {
    try {
      example = JSON.parse(example);
    } catch (_) {}
  }

  // 1. Positional list: {{1}}, {{2}}
  const positionalArray: string[] = [];
  const rawPositional =
    type === "BODY"
      ? (example?.body_text || component?.body_text)
      : (example?.header_text || component?.header_text);

  if (Array.isArray(rawPositional)) {
    if (Array.isArray(rawPositional[0])) {
      rawPositional[0].forEach((v: any) => positionalArray.push(String(v ?? "")));
    } else {
      rawPositional.forEach((v: any) => positionalArray.push(String(v ?? "")));
    }
  }

  // 2. Named params: [{ param_name: "name", example: "Ayush" }]
  const rawNamed =
    type === "BODY"
      ? (example?.body_text_named_params || component?.body_text_named_params)
      : (example?.header_text_named_params || component?.header_text_named_params);

  const namedMap: Record<string, string> = {};
  if (Array.isArray(rawNamed)) {
    rawNamed.forEach((item: any) => {
      if (item?.param_name && item?.example != null) {
        namedMap[String(item.param_name).trim()] = String(item.example);
      }
    });
  }

  // Also check if component or example has direct key-value map
  if (example && typeof example === "object" && !Array.isArray(example)) {
    Object.entries(example).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "header_handle") {
        namedMap[k.trim()] = v;
      }
    });
  }
  if (component?.bodyExamples && typeof component.bodyExamples === "object") {
    Object.entries(component.bodyExamples).forEach(([k, v]) => {
      if (typeof v === "string") namedMap[k.trim()] = v;
    });
  }
  if (component?.headerExamples && typeof component.headerExamples === "object") {
    Object.entries(component.headerExamples).forEach(([k, v]) => {
      if (typeof v === "string") namedMap[k.trim()] = v;
    });
  }

  // Map positional array into namedMap indices "1", "2", etc.
  positionalArray.forEach((val, idx) => {
    if (val && !namedMap[String(idx + 1)]) {
      namedMap[String(idx + 1)] = val;
    }
  });

  // 3. Replace all {{variables}}
  return rawText.replace(/\{\{([^}]+)\}\}/g, (match: string, varName: string) => {
    const key = varName.trim();

    // Check namedMap
    if (namedMap[key] !== undefined && namedMap[key] !== "") {
      return namedMap[key];
    }

    // Check numeric index: {{1}} -> index 0
    const num = parseInt(key, 10);
    if (
      !isNaN(num) &&
      num > 0 &&
      positionalArray[num - 1] !== undefined &&
      positionalArray[num - 1] !== ""
    ) {
      return positionalArray[num - 1];
    }

    // Case-insensitive check on namedMap
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(namedMap)) {
      if (k.toLowerCase() === lower && v !== "") {
        return v;
      }
    }

    return match;
  });
}

export default function ManageTemplatePage() {
  const params = useParams();
  const phoneNumberId = params?.phoneId as string | undefined;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<TemplatesTab>("EXAMPLES");
  const [exampleFilter, setExampleFilter] = useState<ExampleCollection | ExampleIndustry>("TRENDING");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const router = useRouter();
  const showExamples = activeTab === "EXAMPLES" || activeTab === "UTILITY";
  const filterStatus = showExamples ? "ALL" : activeTab;
  const utilityExamples = useMemo(() => EXAMPLE_TEMPLATES.filter((t) => t.collections.includes("UTILITY")), []);

  const filteredExamples = useMemo(
    () =>
      EXAMPLE_TEMPLATES.filter(
        (t) =>
          t.collections.includes(exampleFilter as ExampleCollection) ||
          t.industries.includes(exampleFilter as ExampleIndustry),
      ),
    [exampleFilter],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: templates.length };
    templates.forEach((t) => {
      const s = t.status?.toUpperCase();
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [templates]);

  const handleUseExample = (example: ExampleTemplate) => {
    try {
      sessionStorage.setItem(
        TEMPLATE_DRAFT_STORAGE_KEY,
        JSON.stringify(exampleToFormState(example)),
      );
    } catch (_) {}
    router.push(`/user/manage/templates/phone/${phoneNumberId}/create`);
  };

  // Filtered templates based on search query and dropdowns
  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (filterCategory !== "ALL") {
      result = result.filter(t => t.category?.toUpperCase() === filterCategory);
    }
    if (filterStatus !== "ALL") {
      result = result.filter(t => t.status?.toUpperCase() === filterStatus);
    }

    const q = templateSearch.trim().toLowerCase();
    if (!q) return result;
    return result.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.language?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q)
    );
  }, [templates, templateSearch, filterCategory, filterStatus]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [templateSearch, filterCategory, filterStatus]);

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTemplates.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTemplates, currentPage, itemsPerPage]);

  // Fetch templates from API
  const fetchTemplates = async (wabaIdToUse?: string) => {
    const wabaId = wabaIdToUse || selectedPhone?.waba_id;
    if (!wabaId) return; // Wait until we have a wabaId

    setIsLoadingTemplates(true);
    try {
      const response = await soft7AxiosInstance.get(`/admin/templates?wabaId=${wabaId}`);
      const result = response.data;
      console.log("📋 Templates response:", result);
      if (result.success && result.data) {
        setTemplates(result.data);
        toast.success(`Loaded ${result.data.length} templates`);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Sync templates from Meta
  const syncTemplates = async (wabaIdToUse?: string) => {
    setIsSyncing(true);
    try {
      const wabaId = wabaIdToUse || selectedPhone?.waba_id || phoneNumbers[0]?.waba_id;
      if (!wabaId) {
        toast.error("No WhatsApp Business Account found. Please connect a phone number first.");
        return;
      }
      const response = await soft7AxiosInstance.post("/admin/templates/sync", {
        waba_id: wabaId,
      });
      const result = response.data;
      console.log("🔄 Sync response:", result);
      if (result.success) {
        toast.success(result.message || "Templates synced successfully!");
      } else {
        toast.error(result.message || "Failed to sync templates");
      }
    } catch (error: any) {
      console.error("Failed to sync templates:", error);
      toast.error(error?.message || "Failed to sync templates");
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync templates from Meta and refresh templates list
  const handleSyncTemplates = async (wabaIdToUse?: string) => {
    const wabaId = wabaIdToUse || selectedPhone?.waba_id || phoneNumbers[0]?.waba_id;
    await syncTemplates(wabaId);
    await fetchTemplates(wabaId);
  };

  // Fetch phone numbers for display and resolve the selected one
  const fetchPhoneNumbers = async () => {
    try {
      const response = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
      const result = response.data;
      if (result.success && result.data) {
        const numbers: PhoneNumber[] = result.data;
        setPhoneNumbers(numbers);
        const match = phoneNumberId
          ? numbers.find((p) => p.id === phoneNumberId) ?? numbers[0] ?? null
          : numbers[0] ?? null;
        setSelectedPhone(match);
        if (match?.waba_id && !isInitialSyncDone.current) {
          isInitialSyncDone.current = true;
          await handleSyncTemplates(match.waba_id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch phone numbers:", error);
    }
  };

  // Delete template
  const deleteTemplate = async (templateId: string) => {
    setDeletingId(templateId);
    try {
      const response = await soft7AxiosInstance.delete(`/admin/templates/${templateId}`);
      const result = response.data;
      if (result.success) {
        toast.success("Template deleted successfully");
        await fetchTemplates();
      } else {
        toast.error(result.message || "Failed to delete template");
      }
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      toast.error(error?.message || "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (text: string, field: string) => {
    if (navigator?.clipboard) navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED": return styles["badge-success"];
      case "PENDING":  return styles["badge-warning"];
      case "REJECTED": return styles["badge-danger"];
      default:         return styles["badge-info"];
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category?.toUpperCase()) {
      case "MARKETING":      return styles["badge-success"];
      case "UTILITY":        return styles["badge-info"];
      case "AUTHENTICATION": return styles["badge-warning"];
      default:               return styles["badge-info"];
    }
  };

  const isInitialSyncDone = useRef(false);

  // Load data on mount
  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  return (
    <div className={styles["templates-page"]}>
      <div className={styles["templates-container"]}>
        {/* Tabs bar: Example Template | All | Pending | Approved | Rejected | Create */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:px-6">
          <button
            onClick={() => router.push("/user/manage/templates")}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            {TEMPLATE_TABS.map((tab) => {
              const active = activeTab === tab.value;
              const count = tab.value === "EXAMPLES" ? undefined : tab.value === "UTILITY" ? utilityExamples.length : statusCounts[tab.value] ?? 0;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-semibold transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-surface text-muted-foreground hover:border-primary hover:text-primary-text"
                  }`}
                >
                  {tab.label}
                  {count !== undefined && (templates.length > 0 || tab.value === "UTILITY") && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        active ? "bg-white/25 text-primary-foreground" : "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[15px] font-bold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
            onClick={() => router.push(`/user/manage/templates/phone/${phoneNumberId}/create`)}
          >
            <Plus size={18} />
            Create New Template
          </button>
        </div>

        {showExamples ? (
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Filters sidebar */}
            {activeTab === "EXAMPLES" && (
            <aside className="w-full shrink-0 rounded-2xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-4 lg:w-60">
              <h3 className="mb-3 px-2 text-xl font-bold text-foreground">Filters</h3>
              <div className="flex flex-wrap gap-1 lg:flex-col">
                {EXAMPLE_COLLECTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setExampleFilter(c.value)}
                    className={`cursor-pointer rounded-xl px-4 py-2.5 text-left text-[15px] font-medium transition ${
                      exampleFilter === c.value
                        ? "bg-primary-lighter font-semibold text-primary-text"
                        : "text-secondary-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="my-4 border-t border-border" />

              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Industry
              </p>
              <div className="flex flex-wrap gap-1 lg:flex-col">
                {EXAMPLE_INDUSTRIES.map((ind) => (
                  <button
                    key={ind.value}
                    onClick={() => setExampleFilter(ind.value)}
                    className={`cursor-pointer rounded-xl px-4 py-2 text-left text-[15px] transition ${
                      exampleFilter === ind.value
                        ? "bg-primary-lighter font-semibold text-primary-text"
                        : "text-secondary-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
            </aside>
            )}

            {/* Example templates grid */}
            <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
              {(activeTab === "UTILITY" ? utilityExamples : filteredExamples).map((example) => (
                <TemplateCard
                  key={example.id}
                  media={example.headerType === "IMAGE" && example.art ? <ExampleArt art={example.art} /> : undefined}
                  headerText={example.headerType === "TEXT" ? example.headerText : undefined}
                  body={renderExampleBody(example)}
                  footer={example.footer}
                  buttons={example.buttons}
                  title={example.title}
                  actions={
                    <button
                      onClick={() => handleUseExample(example)}
                      className="cursor-pointer rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
                    >
                      Edit &amp; Use Template
                    </button>
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {/* Search, category filter & sync for saved templates */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className={styles["template-search-wrapper"]}>
                <Search className={styles["template-search-icon"]} />
                <input
                  id="manage-template-search-input"
                  type="text"
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className={styles["template-search-input"]}
                  aria-label="Search WhatsApp templates"
                />
                {templateSearch && (
                  <button
                    onClick={() => setTemplateSearch("")}
                    className={styles["template-search-clear"]}
                    aria-label="Clear search"
                  >
                    <X style={{ width: "0.875rem", height: "0.875rem" }} />
                  </button>
                )}
              </div>

              <div className={styles["toolbar-filters"]}>
                <Filter style={{ width: "1rem", height: "1rem", color: "var(--color-text-muted)", flexShrink: 0 }} />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={styles["toolbar-select"]}
                >
                  <option value="ALL">All Categories</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>

              <button
                onClick={() => handleSyncTemplates(selectedPhone?.waba_id)}
                disabled={isSyncing || isLoadingTemplates}
                className={`${styles["btn-primary"]} ml-auto`}
                title="Sync templates from Meta and refresh list"
              >
                <RefreshCw
                  className={isSyncing ? "animate-spin" : ""}
                  style={{ width: "1rem", height: "1rem" }}
                />
                {isSyncing ? "Syncing..." : "Sync Templates"}
              </button>
            </div>

            {isLoadingTemplates || isSyncing ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-16 text-muted-foreground">
                <RefreshCw className="animate-spin" style={{ width: "1.5rem", height: "1.5rem" }} />
                {isSyncing ? "Syncing templates from Meta..." : "Loading templates..."}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface py-16 text-center text-muted-foreground">
                <MessageSquare size={32} />
                <p>
                  {templateSearch
                    ? `No templates match "${templateSearch}"`
                    : activeTab === "ALL"
                      ? "No templates yet"
                      : `No ${activeTab.toLowerCase()} templates`}
                </p>
                <button
                  onClick={() => setActiveTab("EXAMPLES")}
                  className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
                >
                  Browse Example Templates
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {paginatedTemplates.map((template) => {
                  const comps: any[] = Array.isArray(parseJson(template.components, []))
                    ? parseJson(template.components, [])
                    : [];
                  const metaData = parseJson(template.meta_data, {});
                  const header = comps.find((c) => c.type === "HEADER");
                  const body = comps.find((c) => c.type === "BODY");
                  const footer = comps.find((c) => c.type === "FOOTER");
                  const buttons: any[] = comps.find((c) => c.type === "BUTTONS")?.buttons ?? [];

                  return (
                    <TemplateCard
                      key={template.id}
                      media={
                        header && header.format !== "TEXT" ? (
                          <TemplateMedia header={header} metaData={metaData} />
                        ) : undefined
                      }
                      headerText={
                        header?.format === "TEXT"
                          ? getComponentTextWithExamples(header, metaData, "HEADER")
                          : undefined
                      }
                      body={body ? getComponentTextWithExamples(body, metaData, "BODY") : ""}
                      footer={footer?.text}
                      buttons={buttons.map((b) => ({ type: b.type, text: b.text }))}
                      title={<span title={template.name}>{template.name}</span>}
                      meta={
                        <>
                          <span className={`${styles["badge"]} ${getStatusBadgeClass(template.status)}`}>
                            {template.status}
                          </span>
                          <span className={`${styles["badge"]} ${getCategoryBadgeClass(template.category)}`}>
                            {template.category}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            <Globe size={12} /> {template.language}
                          </span>
                        </>
                      }
                      actions={
                        <div className={styles["table-actions"]}>
                          <button
                            onClick={() => {
                              setPreviewTemplate(template);
                              setShowPreviewModal(true);
                            }}
                            className={styles["btn-icon"]}
                            title="Preview template"
                          >
                            <Eye style={{ width: "1rem", height: "1rem" }} />
                          </button>

                          <button
                            onClick={() =>
                              router.push(`/user/manage/templates/phone/${phoneNumberId}/${template.id}`)
                            }
                            className={styles["btn-icon"]}
                            title="Edit template"
                          >
                            <Edit style={{ width: "1rem", height: "1rem" }} />
                          </button>

                          <button
                            onClick={() =>
                              handleCopy(template.name, `name-${template.id}`)
                            }
                            className={`${styles["btn-icon"]} ${
                              copiedField === `name-${template.id}` ? styles["copied"] : ""
                            }`}
                            title="Copy template name"
                          >
                            {copiedField === `name-${template.id}` ? (
                              <Check style={{ width: "1rem", height: "1rem" }} />
                            ) : (
                              <Copy style={{ width: "1rem", height: "1rem" }} />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              toast(
                                (t) => (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    <span>Are you sure you want to delete this template?</span>
                                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                                      <button
                                        onClick={() => toast.dismiss(t.id)}
                                        style={{
                                          padding: "0.4rem 0.75rem",
                                          border: "1px solid var(--border-color)",
                                          borderRadius: "0.4rem",
                                          background: "var(--bg-primary)",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => {
                                          toast.dismiss(t.id);
                                          deleteTemplate(template.id);
                                        }}
                                        style={{
                                          padding: "0.4rem 0.75rem",
                                          border: "none",
                                          borderRadius: "0.4rem",
                                          background: "var(--color-error)",
                                          color: "var(--color-primary-foreground)",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ),
                                { duration: Infinity },
                              );
                            }}
                            disabled={deletingId === template.id}
                            className={`${styles["btn-icon"]} ${styles["btn-icon-danger"]}`}
                            title="Delete template"
                          >
                            {deletingId === template.id ? (
                              <Loader2 className="animate-spin" style={{ width: "1rem", height: "1rem" }} />
                            ) : (
                              <Trash2 style={{ width: "1rem", height: "1rem" }} />
                            )}
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.5rem",
                marginTop: "2rem",
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                borderRadius: "0.8rem",
              }}
            >
              <div
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
              >
                Showing{" "}
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>{" "}
                to{" "}
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredTemplates.length,
                  )}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {filteredTemplates.length}
                </span>{" "}
                templates
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      // Show current, first, last, and pages around current
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: "2rem",
                              height: "2rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "0.4rem",
                              border:
                                currentPage === pageNum
                                  ? "none"
                                  : "1px solid var(--border-color)",
                              background:
                                currentPage === pageNum
                                  ? "var(--color-primary)"
                                  : "var(--bg-primary)",
                              color:
                                currentPage === pageNum
                                  ? "var(--color-primary-foreground)"
                                  : "var(--text-primary)",
                              fontSize: "0.875rem",
                              fontWeight: currentPage === pageNum ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return (
                          <span
                            key={pageNum}
                            style={{
                              padding: "0 0.25rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    },
                  )}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "0.4rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreviewModal && previewTemplate && (() => {
        let comps = previewTemplate.components;
        if (typeof comps === "string") {
          try { comps = JSON.parse(comps); } catch { comps = []; }
        }
        if (!Array.isArray(comps)) comps = [];

        let metaData = previewTemplate.meta_data;
        if (typeof metaData === "string") {
          try { metaData = JSON.parse(metaData); } catch { metaData = {}; }
        }

        const header = comps.find((c: any) => c.type === "HEADER");
        const body = comps.find((c: any) => c.type === "BODY");
        const footer = comps.find((c: any) => c.type === "FOOTER");
        const buttonsComp = comps.find((c: any) => c.type === "BUTTONS");
        const buttons: any[] = buttonsComp?.buttons ?? [];
        const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString() : "—");

        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-lighter text-primary-text">
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-foreground">Template Preview</h2>
                    <p className="truncate text-xs text-muted-foreground">How customers will see this message on WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  aria-label="Close preview"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,320px)_1fr]">
                <div className="mx-auto w-full max-w-[320px]">
                  <div className="rounded-[2.25rem] bg-[#111b21] p-2.5 shadow-xl ring-1 ring-black/10">
                    <div className="overflow-hidden rounded-[1.75rem]">
                      <div className="flex items-center gap-2.5 bg-[#075e54] px-3.5 py-3 text-white">
                        <ArrowLeft size={16} className="opacity-90" />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                          {(previewTemplate.name || "B").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="flex items-center gap-1 text-[13px] font-semibold">
                            Business
                            <BadgeCheck size={13} className="text-[#25d366]" />
                          </div>
                          <div className="text-[10px] opacity-80">online</div>
                        </div>
                        <Phone size={15} className="opacity-90" />
                      </div>

                      <div className={`${styles["whatsapp-preview"]} !min-h-[380px] !rounded-none !p-3`}>
                        <div className="mx-auto mb-3 w-fit rounded-md bg-white/80 px-2.5 py-0.5 text-[10px] font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                          TODAY
                        </div>

                        <div className="relative max-w-[88%]">
                          <span className="absolute -left-1.5 top-0 h-3 w-3 bg-white [clip-path:polygon(100%_0,0_0,100%_100%)] dark:bg-[#202c33]" />
                          <div className={`rounded-lg rounded-tl-none bg-white p-1.5 shadow-sm dark:bg-[#202c33] ${buttons.length ? "rounded-b-none" : ""}`}>
                            {header && (
                            <div className="mb-1.5 overflow-hidden rounded-md">
                              {(() => {
                                if (header.format === "TEXT") {
                                  const headerText = getComponentTextWithExamples(
                                    header,
                                    metaData,
                                    "HEADER",
                                  );
                                  return (
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      <FormattedText text={headerText} />
                                    </div>
                                  );
                                }
                                if (header.format === "IMAGE") {
                                  const imageUrl =
                                    header.example?.header_handle?.[0] ||
                                    metaData?.headerMediaUrl ||
                                    metaData?.header_media_url;
                                  return imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt="Header"
                                      style={{
                                        width: "100%",
                                        maxHeight: "11rem",
                                        objectFit: "cover",
                                        borderRadius: "0.5rem",
                                      }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        backgroundColor: "var(--color-surface-active)",
                                        height: "8rem",
                                        borderRadius: "0.5rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--color-text-muted)",
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      <div style={{ textAlign: "center" }}>
                                        <svg
                                          style={{
                                            width: "2rem",
                                            height: "2rem",
                                            margin: "0 auto 0.25rem",
                                          }}
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        Image
                                      </div>
                                    </div>
                                  );
                                }
                                if (header.format === "VIDEO") {
                                  const videoUrl = header.example?.header_handle?.[0];
                                  return videoUrl ? (
                                    <video
                                      src={videoUrl}
                                      style={{
                                        width: "100%",
                                        maxHeight: "11rem",
                                        objectFit: "cover",
                                        borderRadius: "0.5rem",
                                      }}
                                      controls
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        backgroundColor: "var(--color-surface-active)",
                                        height: "8rem",
                                        borderRadius: "0.5rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--color-text-muted)",
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      <div style={{ textAlign: "center" }}>
                                        <svg
                                          style={{
                                            width: "2rem",
                                            height: "2rem",
                                            margin: "0 auto 0.25rem",
                                          }}
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                        </svg>
                                        Video
                                      </div>
                                    </div>
                                  );
                                }
                                if (header.format === "DOCUMENT") {
                                  const docUrl = header.example?.header_handle?.[0];
                                  const fileName = docUrl
                                    ? docUrl.split("/").pop()
                                    : (header.filename || "Document");
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "var(--color-surface-hover)",
                                        padding: "0.75rem",
                                        borderRadius: "0.5rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      <FileText
                                        style={{
                                          width: "1.25rem",
                                          height: "1.25rem",
                                          color: "var(--color-text-secondary)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          flex: 1,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {fileName}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                            <div className="px-1.5 pt-0.5">
                              {body && (
                                <div className="whitespace-pre-wrap text-[13px] leading-snug text-[#111b21] dark:text-[#e9edef]">
                                  <FormattedText
                                    text={getComponentTextWithExamples(body, metaData, "BODY")}
                                  />
                                </div>
                              )}
                              {footer && (
                                <div className="mt-1 text-[11px] text-[#667781] dark:text-[#8696a0]">{footer.text}</div>
                              )}
                              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">
                                Now <CheckCheck size={13} className="text-[#53bdeb]" />
                              </div>
                            </div>
                          </div>
                          {buttons.length > 0 && (
                            <div className="divide-y divide-black/5 overflow-hidden rounded-b-lg border-t border-black/5 bg-white shadow-sm dark:divide-white/5 dark:border-white/5 dark:bg-[#202c33]">
                              {buttons.map((btn: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#00a5f4]"
                                >
                                  {btn.type === "URL" && <ExternalLink size={13} />}
                                  {btn.type === "PHONE_NUMBER" && <Phone size={13} />}
                                  {btn.type === "QUICK_REPLY" && <Reply size={13} />}
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template name</p>
                    <h3 className="mt-1 break-all text-xl font-bold text-foreground">{previewTemplate.name}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`${styles["badge"]} ${getStatusBadgeClass(previewTemplate.status)}`}>
                        {previewTemplate.status}
                      </span>
                      <span className={`${styles["badge"]} ${getCategoryBadgeClass(previewTemplate.category)}`}>
                        {previewTemplate.category}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        <Globe size={12} /> {previewTemplate.language}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border bg-surface-muted/60">
                    {[
                      { icon: <Layers size={15} />, label: "Components", value: comps.map((c: any) => c.type.charAt(0) + c.type.slice(1).toLowerCase()).join(" · ") || "—" },
                      { icon: <Calendar size={15} />, label: "Created", value: fmtDate(previewTemplate.created_at) },
                      { icon: <RefreshCw size={15} />, label: "Last synced", value: fmtDate(previewTemplate.synced_at) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary-text ring-1 ring-border">
                          {row.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-muted-foreground">{row.label}</p>
                          <p className="truncate text-sm font-semibold text-foreground">{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex justify-end">
                    <button
                      onClick={() => setShowPreviewModal(false)}
                      className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
