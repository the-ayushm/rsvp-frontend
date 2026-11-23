/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  FileText,
  Send,
  Upload,
  Image as ImageIcon,
  Video,
  FolderOpen,
} from "lucide-react";
import FormattedText from "./FormattedText";
import { getTemplateVariables, TemplateVariable } from "@/lib/template-utils";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { uploadMedia, getUploadedMediaUrl } from "@/lib/media-upload";
import { MediaPickerModal } from "@/features/media/components/MediaPickerModal";
import { useQueryClient } from "@tanstack/react-query";

interface Template {
  id: number | string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: any[];
  headerMode?: "fixed" | "dynamic" | null;
}

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactPhone: string;
  contactName?: string;
  phoneNumberId: string;
  onSend: (
    templateId: number | string,
    variables: Record<string, string>,
    templateData?: any,
  ) => Promise<void>;
}

type HeaderMediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  if (!text || !variables) return text || "";
  return text.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
    const key = varName.trim();
    return variables[key] !== undefined && variables[key] !== ""
      ? variables[key]
      : `{{${key}}}`;
  });
}

function isFormValid(
  template: Template | null,
  variables: Record<string, string>,
): boolean {
  if (!template) return false;
  // All text variables must be filled
  const templateVars = getTemplateVariables(template.components || []);
  for (const v of templateVars) {
    const val = variables[v.name]?.trim();
    if (!val) return false;
  }
  // Media headers: fixed = no input needed; dynamic = user MUST provide URL or upload
  const headerComp = template.components?.find(
    (c) => c.type === "HEADER" && c.format !== "TEXT",
  );
  if (headerComp) {
    const headerMode = template.headerMode;
    if (headerMode === "fixed") return true; // Fixed header: Meta uses approved example
    const format = (headerComp.format || "").toUpperCase();
    if (format === "IMAGE" && !variables["headerImageUrl"]?.trim())
      return false;
    if (format === "VIDEO" && !variables["headerVideoUrl"]?.trim())
      return false;
    if (format === "DOCUMENT" && !variables["headerDocumentUrl"]?.trim())
      return false;
  }
  return true;
}

function TemplateHeaderImagePreview({ url }: { url?: string | null }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const trimmed = (url || "").trim().replace(/^["'`<\[]+|["'`>\]]+$/g, "");
  const isValidUrl =
    typeof trimmed === "string" &&
    (/^https?:\/\//i.test(trimmed) ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("/"));

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [trimmed]);

  if (!trimmed || !isValidUrl) {
    return (
      <div className="w-full h-36 bg-surface-hover dark:bg-surface-raised flex items-center justify-center text-muted-foreground dark:text-muted-foreground text-xs">
        <div className="text-center">
          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
          <span>Upload or enter image URL</span>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-36 bg-surface-hover dark:bg-surface-raised flex items-center justify-center text-muted-foreground dark:text-muted-foreground text-xs">
        <div className="text-center">
          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50 text-warning" />
          <span>Image not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-[120px] bg-surface-hover dark:bg-surface-raised overflow-hidden flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-hover/90 dark:bg-surface-raised/90 z-10 text-xs text-muted-foreground">
          Loading image...
        </div>
      )}
      <img
        key={trimmed}
        src={trimmed}
        alt="Template header"
        className={`w-full h-auto object-cover max-h-64 transition-opacity duration-150 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        referrerPolicy="no-referrer"
        onLoad={() => {
          setIsLoading(false);
          setHasError(false);
        }}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

export function TemplateSelectorModal({
  isOpen,
  onClose,
  contactPhone,
  contactName,
  phoneNumberId,
  onSend,
}: TemplateSelectorModalProps) {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [templateVars, setTemplateVars] = useState<TemplateVariable[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerType, setMediaPickerType] =
    useState<HeaderMediaType>("IMAGE");
  const [uploadingMediaModal, setUploadingMediaModal] = useState(false);
  const [headerPreviewUrls, setHeaderPreviewUrls] = useState<
    Record<HeaderMediaType, string>
  >({
    IMAGE: "",
    VIDEO: "",
    DOCUMENT: "",
  });
  const blobPreviewRef = useRef<Record<HeaderMediaType, string>>({
    IMAGE: "",
    VIDEO: "",
    DOCUMENT: "",
  });
  const headerImageFileRef = useRef<HTMLInputElement>(null);
  const headerVideoFileRef = useRef<HTMLInputElement>(null);
  const headerDocumentFileRef = useRef<HTMLInputElement>(null);

  const resolveHeaderPreviewUrl = (value?: string): string | null => {
    const trimmed = (value || "").trim().replace(/^["'`<\[]+|["'`>\]]+$/g, "");
    if (!trimmed) return null;
    if (
      /^https?:\/\//i.test(trimmed) ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:")
    )
      return trimmed;

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("wa_template_media_preview_map");
        const map = raw ? JSON.parse(raw) : {};
        const cached = map[trimmed];
        if (typeof cached === "string" && cached.trim()) {
          return cached;
        }
      } catch {
        return null;
      }
    }

    return null;
  };

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await soft7AxiosInstance.get("/admin/templates", {
        params: { status: "APPROVED", phoneNumberId },
      });

      const payload = res.data;
      const rawTemplates = payload?.data || [];

      const mappedTemplates = rawTemplates.map((template: any) => ({
        id: template.id || template.template_id,
        name: template.name,
        category: template.category || "UNCATEGORIZED",
        language: template.language || "en",
        status: template.status || "APPROVED",
        components: Array.isArray(template.components)
          ? template.components
          : [],
        headerMode: template.headerMode || null,
      }));

      setTemplates(mappedTemplates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    (Object.keys(blobPreviewRef.current) as HeaderMediaType[]).forEach(
      (key) => {
        const blobUrl = blobPreviewRef.current[key];
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobPreviewRef.current[key] = "";
        }
      },
    );
    setHeaderPreviewUrls({ IMAGE: "", VIDEO: "", DOCUMENT: "" });

    setSelectedTemplate(template);
    const vars = getTemplateVariables(template.components || []);
    setTemplateVars(vars);

    const initialVars: Record<string, string> = {};

    const headerComponent = template.components?.find(
      (c) => c.type === "HEADER" && c.format !== "TEXT",
    );
    if (headerComponent && template.headerMode !== "fixed") {
      // Dynamic header: user must provide URL or upload (header_handle from creation is invalid)
      const format = (headerComponent.format || "").toUpperCase();
      if (format === "IMAGE") initialVars["headerImageUrl"] = "";
      else if (format === "VIDEO") initialVars["headerVideoUrl"] = "";
      else if (format === "DOCUMENT") {
        initialVars["headerDocumentUrl"] = "";
        initialVars["headerDocumentFilename"] = "";
      }
    }

    vars.forEach((v) => {
      // Smart pre-fill: if variable is '1' or 'name', pre-fill with contact name
      if ((v.name === "1" || v.name.toLowerCase() === "name") && contactName) {
        initialVars[v.name] = contactName;
      } else {
        initialVars[v.name] = "";
      }
    });
    setVariables(initialVars);
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;

    setSending(true);
    try {
      await onSend(selectedTemplate.id, variables, selectedTemplate);
      onClose();
      setSelectedTemplate(null);
      setVariables({});
    } catch (error) {
      console.error("Error sending template:", error);
    } finally {
      setSending(false);
    }
  };

  const handleSelectMedia = (url: string, filename?: string) => {
    const varKey =
      mediaPickerType === "IMAGE"
        ? "headerImageUrl"
        : mediaPickerType === "VIDEO"
          ? "headerVideoUrl"
          : "headerDocumentUrl";

    setVariables((prev) => ({
      ...prev,
      [varKey]: url,
      ...(mediaPickerType === "DOCUMENT" && filename
        ? { headerDocumentFilename: filename }
        : {}),
    }));

    setHeaderPreviewUrls((prev) => ({
      ...prev,
      [mediaPickerType]: url,
    }));

    setMediaPickerOpen(false);
  };

  const handleUploadNewMedia = async (file: File) => {
    setUploadingMediaModal(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);

      const data = await uploadMedia(formData);
      const uploadedUrl = getUploadedMediaUrl(data);

      if (!uploadedUrl) {
        throw new Error("Failed to upload file");
      }

      const varKey =
        mediaPickerType === "IMAGE"
          ? "headerImageUrl"
          : mediaPickerType === "VIDEO"
            ? "headerVideoUrl"
            : "headerDocumentUrl";

      setVariables((prev) => ({
        ...prev,
        [varKey]: uploadedUrl,
        ...(mediaPickerType === "DOCUMENT"
          ? { headerDocumentFilename: prev.headerDocumentFilename || file.name }
          : {}),
      }));

      setHeaderPreviewUrls((prev) => ({
        ...prev,
        [mediaPickerType]: URL.createObjectURL(file),
      }));

      await queryClient.invalidateQueries({
        queryKey: ["uploaded-media-list"],
      });
      setMediaPickerOpen(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to upload media",
      );
    } finally {
      setUploadingMediaModal(false);
    }
  };

  const handleHeaderFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    headerType: "IMAGE" | "VIDEO" | "DOCUMENT",
    varKey: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeader(headerType);

    const objectUrl = URL.createObjectURL(file);
    if (blobPreviewRef.current[headerType]) {
      URL.revokeObjectURL(blobPreviewRef.current[headerType]);
    }
    blobPreviewRef.current[headerType] = objectUrl;
    setHeaderPreviewUrls((prev) => ({ ...prev, [headerType]: objectUrl }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phone_number_id", phoneNumberId || "762352490286897");
      formData.append("type", headerType);
      const res = await soft7AxiosInstance.post(
        "/admin/campaigns/upload-media",
        formData,
      );

      const data = res.data;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Upload failed");
      }

      const mediaId =
        data?.data?.media_url ||
        data?.data?.media_id ||
        data?.url ||
        data?.mediaUrl ||
        data?.id;

      let localPreviewUrl: string | null = null;
      try {
        const cacheForm = new FormData();
        cacheForm.append("file", file);
        const cacheRes = await fetch("/api/user/whatsapp/cache-media", {
          method: "POST",
          body: cacheForm,
        });
        const cacheData = await cacheRes.json();
        if (cacheRes.ok && cacheData?.url) {
          localPreviewUrl = cacheData.url;
        }
      } catch (cacheError) {
        console.error("Template media local cache failed:", cacheError);
      }

      if (localPreviewUrl) {
        setHeaderPreviewUrls((prev) => ({
          ...prev,
          [headerType]: localPreviewUrl,
        }));
      }

      if (mediaId) {
        if (typeof window !== "undefined" && localPreviewUrl) {
          const raw = localStorage.getItem("wa_template_media_preview_map");
          const map = raw ? JSON.parse(raw) : {};
          map[String(mediaId)] = localPreviewUrl;
          localStorage.setItem(
            "wa_template_media_preview_map",
            JSON.stringify(map),
          );
        }
        setVariables((v) => ({
          ...v,
          [varKey]: mediaId,
          ...(headerType === "DOCUMENT"
            ? { headerDocumentFilename: v.headerDocumentFilename || file.name }
            : {}),
        }));
      } else {
        throw new Error("API did not return a media ID");
      }
    } catch (err: any) {
      console.error("Header upload error:", err);
      const msg = err?.response?.data?.error || err?.message || "Upload failed";
      alert(msg);
    } finally {
      setUploadingHeader(null);
      e.target.value = "";
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface dark:bg-surface-raised rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border dark:border-border">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-border dark:border-border bg-surface dark:bg-surface-raised">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-lighter text-primary-text dark:bg-primary-light/40 dark:text-primary-text">
              <FileText size={20} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground dark:text-white">
                Send WhatsApp template
              </h2>
              <p className="text-xs text-secondary-foreground dark:text-secondary-foreground">
                Choose an approved template and review the message before
                sending.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:bg-surface-hover dark:text-muted-foreground dark:hover:bg-surface-raised transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Template List */}
          <div className="w-1/2 border-r border-border dark:border-border flex flex-col bg-surface-muted dark:bg-surface-raised">
            {/* Search */}
            <div className="px-4 py-3 border-b border-border dark:border-border bg-surface dark:bg-surface">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-muted-foreground"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-border dark:border-border rounded-lg bg-surface dark:bg-surface-active text-sm text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary"
                />
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground dark:text-secondary-foreground text-sm">
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground dark:text-secondary-foreground text-sm">
                  No approved templates found
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer border text-sm transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "bg-primary-lighter dark:bg-primary-light/30 border-primary/70 dark:border-primary text-primary-text dark:text-primary-text"
                        : "bg-surface dark:bg-surface-active border-border dark:border-border hover:bg-surface-muted dark:hover:bg-border-strong text-foreground dark:text-white"
                    }`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-[11px] text-muted-foreground dark:text-secondary-foreground mt-0.5">
                      {template.category} • {template.language}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Preview & Variables */}
          <div className="w-1/2 flex flex-col bg-surface dark:bg-surface-raised min-h-0">
            {/* Preview */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              <h3 className="text-sm font-semibold text-foreground dark:text-white">
                Preview
              </h3>
              {selectedTemplate ? (
                <>
                  <p className="text-xs text-secondary-foreground dark:text-secondary-foreground transition-opacity duration-200">
                    Sent to{" "}
                    <span className="font-medium text-secondary-foreground dark:text-foreground">
                      {contactPhone}
                    </span>{" "}
                    using{" "}
                    <span className="font-medium text-secondary-foreground dark:text-foreground">
                      {selectedTemplate.name}
                    </span>
                  </p>

                  <div className="max-w-md mx-auto">
                    <div className="rounded-2xl border border-primary-soft dark:border-primary-soft bg-surface dark:bg-surface-active shadow-sm overflow-hidden animate-in fade-in duration-200">
                      <div className="px-4 py-3 border-b border-primary-soft dark:border-primary-soft/40 bg-primary-lighter/80 dark:bg-primary-light/20 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground dark:text-white">
                            {selectedTemplate.name}
                          </p>
                          <p className="text-[11px] text-secondary-foreground dark:text-secondary-foreground">
                            {selectedTemplate.category} •{" "}
                            {selectedTemplate.language}
                          </p>
                        </div>
                        <span className="text-[11px] text-primary-text dark:text-primary-text">
                          Template
                        </span>
                      </div>

                      <div className="space-y-3">
                        {selectedTemplate.components?.map((component, idx) => {
                          // HEADER with IMAGE, VIDEO, or DOCUMENT
                          if (
                            component.type === "HEADER" &&
                            component.format !== "TEXT"
                          ) {
                            const format = (
                              component.format || ""
                            ).toUpperCase();
                            const rawSample =
                              component.example?.header_handle?.[0];
                            const validSampleUrl =
                              typeof rawSample === "string" &&
                              /^https?:\/\//i.test(rawSample.trim())
                                ? rawSample.trim()
                                : null;

                            const mediaUrl =
                              format === "IMAGE"
                                ? headerPreviewUrls.IMAGE ||
                                  resolveHeaderPreviewUrl(
                                    variables["headerImageUrl"],
                                  ) ||
                                  validSampleUrl
                                : format === "VIDEO"
                                  ? headerPreviewUrls.VIDEO ||
                                    resolveHeaderPreviewUrl(
                                      variables["headerVideoUrl"],
                                    ) ||
                                    validSampleUrl
                                  : format === "DOCUMENT"
                                    ? headerPreviewUrls.DOCUMENT ||
                                      resolveHeaderPreviewUrl(
                                        variables["headerDocumentUrl"],
                                      ) ||
                                      validSampleUrl
                                    : validSampleUrl;

                            if (format === "IMAGE") {
                              return (
                                <div key={idx} className="w-full">
                                  <TemplateHeaderImagePreview url={mediaUrl} />
                                </div>
                              );
                            }
                            if (format === "VIDEO") {
                              return (
                                <div
                                  key={idx}
                                  className="w-full bg-surface-hover dark:bg-surface-raised rounded-b-lg overflow-hidden min-h-32 flex items-center justify-center text-muted-foreground dark:text-muted-foreground text-xs"
                                >
                                  {mediaUrl && /^https?:\/\/|^blob:/i.test(mediaUrl) ? (
                                    <video
                                      src={mediaUrl}
                                      controls
                                      className="w-full h-auto max-h-48 object-cover"
                                    />
                                  ) : (
                                    <div className="text-center py-4">
                                      <Video className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                      Video
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (format === "DOCUMENT") {
                              return (
                                <div
                                  key={idx}
                                  className="w-full bg-surface-hover dark:bg-surface-raised rounded-b-lg p-4 flex items-center justify-center text-muted-foreground dark:text-muted-foreground text-xs"
                                >
                                  <div className="text-center">
                                    <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                    <span>
                                      {variables["headerDocumentFilename"] || "Document"}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }
                          const type = (component.type || "").toUpperCase();
                          // HEADER with TEXT
                          if (
                            type === "HEADER" &&
                            component.format === "TEXT"
                          ) {
                            return (
                              <div
                                key={idx}
                                className="px-4 pt-3 font-semibold text-foreground dark:text-white"
                              >
                                {substituteVariables(component.text || "", variables)}
                              </div>
                            );
                          }
                          if (type === "BODY") {
                            const bodyText = substituteVariables(
                              component.text || "",
                              variables,
                            );
                            return (
                              <div
                                key={idx}
                                className="px-4 text-sm text-foreground dark:text-foreground whitespace-pre-line"
                              >
                                <FormattedText text={bodyText} />
                              </div>
                            );
                          }
                          if (type === "FOOTER") {
                            return (
                              <div
                                key={idx}
                                className="px-4 pb-3 pt-1 text-[11px] text-muted-foreground dark:text-secondary-foreground"
                              >
                                {substituteVariables(component.text || "", variables)}
                              </div>
                            );
                          }
                          if (type === "BUTTONS") {
                            return (
                              <div
                                key={idx}
                                className="px-4 pb-3 mt-2 border-t border-border-subtle dark:border-border pt-3 space-y-2"
                              >
                                {component.buttons?.map(
                                  (btn: any, bidx: number) => (
                                    <button
                                      key={bidx}
                                      type="button"
                                      className="w-full text-sm font-medium text-primary-text dark:text-primary-text py-2 border border-primary-soft dark:border-primary-soft rounded-lg bg-primary-lighter/70 dark:bg-primary-light/30"
                                    >
                                      {substituteVariables(btn.text || "", variables)}
                                    </button>
                                  ),
                                )}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Variables */}
                  {(templateVars.length > 0 ||
                    selectedTemplate.components?.some(
                      (c) =>
                        c.type === "HEADER" &&
                        ["IMAGE", "VIDEO", "DOCUMENT"].includes(
                          (c.format || "").toUpperCase(),
                        ),
                    )) && (
                    <div className="mt-6 px-4 pb-4">
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-2">
                        Fill variables
                      </h3>
                      {selectedTemplate.components?.some(
                        (c) =>
                          c.type === "HEADER" &&
                          ["IMAGE", "VIDEO", "DOCUMENT"].includes(
                            (c.format || "").toUpperCase(),
                          ),
                      ) &&
                        selectedTemplate.headerMode === "dynamic" && (
                          <p className="text-xs text-warning dark:text-warning mb-2 bg-warning-bg dark:bg-warning-bg/20 px-2 py-1.5 rounded">
                            Dynamic header: Provide a public HTTPS URL or upload
                            a file for each send.
                          </p>
                        )}
                      <div className="space-y-3">
                        {selectedTemplate.components?.some(
                          (c) =>
                            c.type === "HEADER" &&
                            (c.format || "").toUpperCase() === "IMAGE",
                        ) &&
                          selectedTemplate.headerMode !== "fixed" && (
                            <div>
                              <label className="block text-xs font-medium text-secondary-foreground dark:text-secondary-foreground mb-1">
                                Header Image (URL or upload)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={variables["headerImageUrl"] || ""}
                                  onChange={(e) => {
                                    setVariables({
                                      ...variables,
                                      headerImageUrl: e.target.value,
                                    });
                                    setHeaderPreviewUrls((prev) => ({
                                      ...prev,
                                      IMAGE: e.target.value,
                                    }));
                                  }}
                                  className="flex-1 px-3 py-2 border border-info-border dark:border-info-border rounded-lg bg-info-bg/30 dark:bg-surface text-sm"
                                  placeholder="https://example.com/image.jpg"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMediaPickerType("IMAGE");
                                    setMediaPickerOpen(true);
                                  }}
                                  className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                                >
                                  <Upload size={14} />
                                  Upload
                                </button>
                              </div>
                            </div>
                          )}
                        {selectedTemplate.components?.some(
                          (c) =>
                            c.type === "HEADER" &&
                            (c.format || "").toUpperCase() === "VIDEO",
                        ) &&
                          selectedTemplate.headerMode !== "fixed" && (
                            <div>
                              <label className="block text-xs font-medium text-secondary-foreground dark:text-secondary-foreground mb-1">
                                Header Video (URL or upload)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={variables["headerVideoUrl"] || ""}
                                  onChange={(e) => {
                                    setVariables({
                                      ...variables,
                                      headerVideoUrl: e.target.value,
                                    });
                                    setHeaderPreviewUrls((prev) => ({
                                      ...prev,
                                      VIDEO: e.target.value,
                                    }));
                                  }}
                                  className="flex-1 px-3 py-2 border border-info-border dark:border-info-border rounded-lg bg-info-bg/30 dark:bg-surface text-sm"
                                  placeholder="https://example.com/video.mp4"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMediaPickerType("VIDEO");
                                    setMediaPickerOpen(true);
                                  }}
                                  className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                                >
                                  <Upload size={14} />
                                  Upload
                                </button>
                              </div>
                            </div>
                          )}
                        {selectedTemplate.components?.some(
                          (c) =>
                            c.type === "HEADER" &&
                            (c.format || "").toUpperCase() === "DOCUMENT",
                        ) &&
                          selectedTemplate.headerMode !== "fixed" && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-secondary-foreground dark:text-secondary-foreground mb-1">
                                  Header Document (URL or upload)
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={variables["headerDocumentUrl"] || ""}
                                    onChange={(e) => {
                                      setVariables({
                                        ...variables,
                                        headerDocumentUrl: e.target.value,
                                      });
                                      setHeaderPreviewUrls((prev) => ({
                                        ...prev,
                                        DOCUMENT: e.target.value,
                                      }));
                                    }}
                                    className="flex-1 px-3 py-2 border border-info-border dark:border-info-border rounded-lg bg-info-bg/30 dark:bg-surface text-sm"
                                    placeholder="https://example.com/document.pdf"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMediaPickerType("DOCUMENT");
                                      setMediaPickerOpen(true);
                                    }}
                                    className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                                  >
                                    <Upload size={14} />
                                    Upload
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-secondary-foreground dark:text-secondary-foreground mb-1">
                                  Document filename (optional)
                                </label>
                                <input
                                  type="text"
                                  value={
                                    variables["headerDocumentFilename"] || ""
                                  }
                                  onChange={(e) =>
                                    setVariables({
                                      ...variables,
                                      headerDocumentFilename: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 border border-border dark:border-border rounded-lg bg-surface dark:bg-surface text-sm"
                                  placeholder="document.pdf"
                                />
                              </div>
                            </>
                          )}
                        {templateVars.map((variable) => (
                          <div key={`${variable.component}:${variable.name}`}>
                            <label className="block text-xs font-medium text-secondary-foreground dark:text-secondary-foreground mb-1">
                              {variable.component === "HEADER"
                                ? "Header Variable"
                                : "Variable"}{" "}
                              {"{{"}
                              {variable.name}
                              {"}}"}
                            </label>
                            <input
                              type="text"
                              value={variables[variable.name] || ""}
                              onChange={(e) =>
                                setVariables({
                                  ...variables,
                                  [variable.name]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-border dark:border-border rounded-lg bg-surface dark:bg-surface text-sm text-foreground dark:text-foreground"
                              placeholder={`Enter value for {{${variable.name}}}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="max-w-md mx-auto">
                  <div className="rounded-2xl border border-border dark:border-border bg-surface-muted dark:bg-surface-active shadow-sm overflow-hidden min-h-70 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground dark:text-foreground">
                      Select a template to preview
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Send Button - Always visible, fixed at bottom */}
            <div className="p-5 border-t border-border dark:border-border bg-surface dark:bg-surface shrink-0">
              <button
                onClick={handleSend}
                disabled={
                  !selectedTemplate ||
                  sending ||
                  !isFormValid(selectedTemplate, variables)
                }
                className="w-full bg-primary hover:bg-primary-hover disabled:cursor-not-allowed text-primary-foreground py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Send Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleSelectMedia}
        onUploadNew={handleUploadNewMedia}
        uploadingMedia={uploadingMediaModal}
        mediaType={mediaPickerType}
      />
    </div>
  );
}
