/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Save,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
  Bold,
  Italic,
  Strikethrough,
} from "lucide-react";
import styles from "../create-template.module.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

// Meta WhatsApp API Validation Rules
const META_LIMITS = {
  IMAGE_SIZE_MB: 5,
  VIDEO_SIZE_MB: 16,
  DOCUMENT_SIZE_MB: 100,
  HEADER_TEXT_LENGTH: 60,
  BODY_TEXT_LENGTH: 1024,
  FOOTER_TEXT_LENGTH: 60,
  BUTTON_TEXT_LENGTH: 25,
};

export type ComponentType = "HEADER" | "BODY" | "FOOTER" | "BUTTONS";

export interface TemplateFormState {
  name: string;
  category: string;
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText: string;
  bodyText: string;
  footerText: string;
  buttons: {
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP";
    text: string;
    url?: string;
    phoneNumber?: string;
    otpType?: "COPY_CODE" | "ONE_TAP";
  }[];
  whatsappAccountId: string | null;
  whatsappPhoneNumberId?: string | null;
  headerHandle?: string;
  headerMediaUrl?: string; // preview (blob or relative path)
  headerStoredUrl?: string; // persistent URL stored for fixed header (used when sending)
  headerMode?: "fixed" | "dynamic"; // fixed = same media for all sends; dynamic = provide URL/media each send
  headerDocumentFilename?: string; // Custom/display filename for document/PDF headers
  bodyExamples?: Record<string, string>;
  headerExamples?: Record<string, string>;
  buttonExamples?: Record<number, string>; // index -> example full URL
  variableFormat: "positional" | "named"; // Type of variable: Number (positional) or Name (named)
  // Authentication template specific (only when category === "AUTHENTICATION")
  addSecurityRecommendation?: boolean;
  addExpiration?: boolean;
  expirationMinutes?: number;
  authButtonType?: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
  // Required for ONE_TAP and ZERO_TAP (Android app integration)
  authPackageName?: string;
  authSignatureHash?: string;
  authAutofillText?: string; // Button text for one-tap (default: "Autofill")
  authCopyCodeText?: string; // Button text for copy code fallback (default: "Copy Code")
  authZeroTapTermsAccepted?: boolean; // Required for ZERO_TAP
}

interface Props {
  initialData?: TemplateFormState;
  onSubmit: (data: TemplateFormState) => void;
  loading: boolean;
  mode: "CREATE" | "EDIT";
  readOnly?: boolean;
  renderPreview: (data: TemplateFormState) => React.ReactNode;
}

export default function TemplateForm({
  initialData,
  onSubmit,
  loading,
  mode,
  readOnly = false,
  renderPreview,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const headerBlobUrlRef = useRef<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(
    initialData || {
      name: "",
      category: "MARKETING",
      language: "en_US",
      headerType: "NONE",
      headerText: "",
      bodyText: "",
      footerText: "",
      buttons: [],
      whatsappAccountId: null,
      whatsappPhoneNumberId: null,
      bodyExamples: {},
      headerExamples: {},
      buttonExamples: {},
      variableFormat: "positional",
      addSecurityRecommendation: true,
      addExpiration: false,
      expirationMinutes: 10,
      authButtonType: "COPY_CODE",
      authAutofillText: "Autofill",
      authCopyCodeText: "Copy Code",
      authZeroTapTermsAccepted: false,
    },
  );

  const [uploadMode, setUploadMode] = useState<"UPLOAD" | "LIBRARY">("UPLOAD");
  const [mediaLibrary, setMediaLibrary] = useState<
    { id: number; name: string; url: string; type: string }[]
  >([]);
  const [searchMedia, setSearchMedia] = useState("");

  const fetchMediaLibrary = async () => {
    try {
      const res = await soft7AxiosInstance.get("/api/user/gallery/list");
      setMediaLibrary(await res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = () => {
    if (!form.name) {
      alert("Please fill in the template name");
      return;
    }

    // Authentication template: simplified validation
    if (form.category === "AUTHENTICATION") {
      if (
        (form.authButtonType === "ONE_TAP" ||
          form.authButtonType === "ZERO_TAP") &&
        (!form.authPackageName?.trim() || !form.authSignatureHash?.trim())
      ) {
        alert(
          "Package Name and Signature Hash are required for One-tap and Zero-tap templates.",
        );
        return;
      }
      if (
        form.authButtonType === "ZERO_TAP" &&
        !form.authZeroTapTermsAccepted
      ) {
        alert(
          "You must accept the Zero-tap terms to create a Zero-tap template.",
        );
        return;
      }
      onSubmit(form);
      return;
    }

    // Marketing/Utility: require body
    if (!form.bodyText) {
      alert("Please fill in all required fields (Name and Body)");
      return;
    }

    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType)) {
      if (!form.headerHandle) {
        alert(
          `Please upload your ${form.headerType.toLowerCase()} file and wait for 'Media Attached Successfully' before creating the template.`,
        );
        return;
      }
    }

    for (let i = 0; i < form.buttons.length; i++) {
      const btn = form.buttons[i];
      if (!btn.text) {
        alert(`Button ${i + 1}: Button text is required`);
        return;
      }
      if (btn.type === "URL") {
        if (!btn.url) {
          alert(`Button ${i + 1}: Website URL is required for URL buttons`);
          return;
        }
        if (!isValidUrl(btn.url)) {
          alert(
            `Button ${i + 1}: Invalid URL format. Must start with http:// or https://`,
          );
          return;
        }
        if (btn.url.includes("{{1}}") && !form.buttonExamples?.[i]) {
          alert(
            `Button ${i + 1}: Please provide an example for the dynamic URL`,
          );
          return;
        }
      }
      if (btn.type === "PHONE_NUMBER") {
        if (!btn.phoneNumber) {
          alert(`Button ${i + 1}: Phone number is required for phone buttons`);
          return;
        }
        if (!isValidPhoneNumber(btn.phoneNumber)) {
          alert(
            `Button ${i + 1}: Invalid phone number. Must start with + and include country code`,
          );
          return;
        }
      }
    }

    // Validate Examples for variables
    const bodyVars = getDetectedVariables(form.bodyText);
    const headerVars =
      form.headerType === "TEXT" ? getDetectedVariables(form.headerText) : [];
    const isNamed = (name: string) => isNaN(parseInt(name));

    const hasNamed = bodyVars.some(isNamed) || headerVars.some(isNamed);
    const hasPositional =
      bodyVars.some((v) => !isNamed(v)) || headerVars.some((v) => !isNamed(v));

    if (form.variableFormat === "positional" && hasNamed) {
      alert(
        "This template is set to 'Number' format, but you have used named variables like {{name}}. Please use {{1}}, {{2}} etc. or change the Variable Type to 'Name'.",
      );
      return;
    }

    if (form.variableFormat === "named" && hasPositional) {
      alert(
        "This template is set to 'Name' format, but you have used positional variables like {{1}}. Please use descriptive names like {{name}} or change the Variable Type to 'Number'.",
      );
      return;
    }

    // Meta Rule: Variables cannot be at the start or end of the text (punctuation alone does not count as words)
    const trimmedBody = form.bodyText.trim();
    if (/^[\W_]*\{\{[^}]+\}\}/.test(trimmedBody)) {
      alert(
        "Meta rule: Variables cannot be at the start of the Body. Please add words before the variable (e.g. 'Hello {{1}}').",
      );
      return;
    }
    if (/\{\{[^}]+\}[\s\W_]*$/.test(trimmedBody)) {
      alert(
        "Meta rule: Variables cannot be at the end of the Body. Punctuation like '!' or '.' alone is not allowed by Meta. Please add actual words after the variable (e.g. 'Order ID: {{2}}. Thank you for shopping with us.').",
      );
      return;
    }

    if (form.headerType === "TEXT" && form.headerText) {
      const trimmedHeader = form.headerText.trim();
      if (/^[\W_]*\{\{[^}]+\}\}/.test(trimmedHeader)) {
        alert(
          "Meta rule: Variables cannot be at the start of the Header text. Please add words before the variable.",
        );
        return;
      }
      if (/\{\{[^}]+\}[\s\W_]*$/.test(trimmedHeader)) {
        alert(
          "Meta rule: Variables cannot be at the end of the Header text. Please add actual words after the variable.",
        );
        return;
      }
    }

    // Validate Button variables (URL buttons only support positional {{1}})
    for (let i = 0; i < form.buttons.length; i++) {
      const btn = form.buttons[i];
      if (btn.type === "URL" && btn.url) {
        const btnVars = getDetectedVariables(btn.url);
        if (btnVars.length > 0) {
          if (btnVars.length > 1 || btnVars[0] !== "1") {
            alert(
              `Button ${i + 1}: URL buttons only support a single positional variable {{1}}.`,
            );
            return;
          }
          if (hasNamed) {
            alert(
              `Variable format mismatch: Template uses named variables, but URL buttons only support positional variables ({{1}}). Meta does not allow mixing formats.`,
            );
            return;
          }
        }
      }
      if (btn.type === "QUICK_REPLY" && btn.text) {
        if (getDetectedVariables(btn.text).length > 0) {
          alert(
            `Button ${i + 1}: Quick Reply buttons do not support variables.`,
          );
          return;
        }
      }
    }

    for (const v of bodyVars) {
      if (!form.bodyExamples?.[v]) {
        alert(`Please provide an example value for body variable {{${v}}}`);
        return;
      }
    }

    for (const v of headerVars) {
      if (!form.headerExamples?.[v]) {
        alert(`Please provide an example value for header variable {{${v}}}`);
        return;
      }
    }

    onSubmit(form);
  };
  const handleMediaSelect = async (mediaId: number) => {
    const activeNumber =
      accounts.find((a) => a.id === form.whatsappPhoneNumberId) ||
      accounts.find((a) => a.phone_number_id === form.whatsappPhoneNumberId) ||
      accounts.find((a) => a.waba_id === form.whatsappAccountId) ||
      accounts.find((a) => a.id === form.whatsappAccountId) ||
      accounts.find((a) => (a as any).phoneId === form.whatsappAccountId) ||
      (accounts.length > 0 ? accounts[0] : null);

    const accountId = form.whatsappAccountId || activeNumber?.id;
    if (!accountId) {
      alert("Please select a WhatsApp Account first.");
      return;
    }
    const media = mediaLibrary.find((m) => m.id === mediaId);
    const previewUrl = media?.url;
    setUploading(true);
    const formData = new FormData();
    formData.append("mediaId", mediaId.toString());
    formData.append("accountId", accountId.toString());

    try {
      const res = await soft7AxiosInstance.post(
        "/api/user/whatsapp/upload",
        formData,
      );
      const data = await res.data;
      if (data.handle) {
        const base =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL
            ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
            : "";
        const stored = previewUrl?.startsWith("http")
          ? previewUrl
          : base && previewUrl
            ? `${base}${previewUrl.startsWith("/") ? "" : "/"}${previewUrl}`
            : (previewUrl ?? undefined);
        setForm((f) => ({
          ...f,
          headerHandle: data.handle,
          headerMediaUrl: previewUrl,
          headerStoredUrl: stored || undefined,
          ...(f.headerType === "DOCUMENT"
            ? {
                headerDocumentFilename:
                  f.headerDocumentFilename || media?.name || "document.pdf",
              }
            : {}),
        }));
      } else {
        alert("Processing failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      alert("Processing failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const activeNumber =
      accounts.find((a) => a.id === form.whatsappPhoneNumberId) ||
      accounts.find((a) => a.phone_number_id === form.whatsappPhoneNumberId) ||
      accounts.find((a) => a.waba_id === form.whatsappAccountId) ||
      accounts.find((a) => a.id === form.whatsappAccountId) ||
      accounts.find((a) => (a as any).phoneId === form.whatsappAccountId) ||
      (accounts.length > 0 ? accounts[0] : null);

    const accountId = form.whatsappAccountId || activeNumber?.id;
    if (!file || !accountId) {
      if (!accountId)
        alert("Please select a WhatsApp Account first.");
      return;
    }

    const fileSizeMB = file.size / 1024 / 1024;
    let maxSize = 0;
    let fileTypeLabel = "";

    if (form.headerType === "IMAGE") {
      maxSize = META_LIMITS.IMAGE_SIZE_MB;
      fileTypeLabel = "Image";
    } else if (form.headerType === "VIDEO") {
      maxSize = META_LIMITS.VIDEO_SIZE_MB;
      fileTypeLabel = "Video";
    } else if (form.headerType === "DOCUMENT") {
      maxSize = META_LIMITS.DOCUMENT_SIZE_MB;
      fileTypeLabel = "Document";
    }

    if (fileSizeMB > maxSize) {
      alert(
        `${fileTypeLabel} file size exceeds Meta's limit of ${maxSize}MB. Your file is ${fileSizeMB.toFixed(2)}MB.`,
      );
      e.target.value = "";
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    if (headerBlobUrlRef.current) {
      URL.revokeObjectURL(headerBlobUrlRef.current);
    }
    headerBlobUrlRef.current = blobUrl;
    setForm((f) => ({
      ...f,
      headerMediaUrl: blobUrl,
      ...(f.headerType === "DOCUMENT"
        ? { headerDocumentFilename: f.headerDocumentFilename || file.name }
        : {}),
    }));

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    // Use active phone number ID, fallback to Meta test one if DB is empty
    const selectedPhoneId = activeNumber?.phone_number_id;
    if (!selectedPhoneId) {
      alert("Meta Phone Number ID is missing for this WhatsApp account.");
      return;
    }
    formData.append("phone_number_id", selectedPhoneId);
    formData.append("type", form.headerType);

    try {
      const res = await soft7AxiosInstance.post(
        "/admin/campaigns/upload-media",
        formData,
      );
      const data = await res.data;
      if (data.success) {
        const uploadedUrl = data?.data?.media_url;
        const metaHandle = data?.data?.handle;

        if (!uploadedUrl && !metaHandle) {
          throw new Error("API did not return a valid media URL or handle");
        }

        setForm((f) => ({
          ...f,
          headerStoredUrl: uploadedUrl,
          headerMediaUrl: blobUrl,
          headerHandle: metaHandle || undefined,
          ...(f.headerType === "DOCUMENT"
            ? { headerDocumentFilename: f.headerDocumentFilename || file.name }
            : {}),
        }));
      } else {
        alert(
          "Upload failed: " + (data.message || data.error || "Unknown error"),
        );
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload failed";
      console.error(error);
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      waba_id: string;
      phone_number_id?: string;
      display_phone_number?: string;
      verified_name?: string;
    }[]
  >([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const [wabaRes, phoneRes] = await Promise.allSettled([
          soft7AxiosInstance.get("/admin/waba"),
          soft7AxiosInstance.get("/admin/waba/phone-numbers"),
        ]);

        let wabaData: any[] = [];
        if (wabaRes.status === "fulfilled" && wabaRes.value.data?.data) {
          wabaData = wabaRes.value.data.data;
        }

        let phoneData: any[] = [];
        if (phoneRes.status === "fulfilled" && phoneRes.value.data?.data) {
          phoneData = phoneRes.value.data.data;
        }

        const formattedAccounts: {
          id: string;
          phoneId?: string;
          name: string;
          waba_id: string;
          phone_number_id?: string;
          display_phone_number?: string;
          verified_name?: string;
        }[] = [];

        if (phoneData.length > 0) {
          phoneData.forEach((phone: any) => {
            formattedAccounts.push({
              id: phone.waba_id || phone.id,
              phoneId: phone.id,
              name:
                phone.verified_name ||
                phone.display_phone_number ||
                "WhatsApp Account",
              waba_id: phone.waba_id,
              phone_number_id: phone.phone_number_id,
              display_phone_number: phone.display_phone_number,
              verified_name: phone.verified_name,
            });
          });
        } else if (wabaData.length > 0) {
          wabaData.forEach((acc: any) => {
            formattedAccounts.push({
              id: acc.id,
              name: acc.name,
              waba_id: acc.waba_id,
              phone_number_id: acc.meta_data?.phone_numbers?.data?.[0]?.id,
              display_phone_number:
                acc.meta_data?.phone_numbers?.data?.[0]?.display_phone_number,
              verified_name: acc.name,
            });
          });
        }

        setAccounts(formattedAccounts);
        if (formattedAccounts.length > 0) {
          setForm((f) => {
            const currentWaId = f.whatsappAccountId;
            const matched = currentWaId
              ? formattedAccounts.find(
                  (a) =>
                    a.id === currentWaId ||
                    a.phoneId === currentWaId ||
                    a.waba_id === currentWaId ||
                    a.phone_number_id === currentWaId,
                )
              : formattedAccounts[0];

            return {
              ...f,
              whatsappAccountId: currentWaId || matched?.id || formattedAccounts[0].id,
              whatsappPhoneNumberId:
                f.whatsappPhoneNumberId ||
                matched?.phone_number_id ||
                formattedAccounts[0].phone_number_id,
            };
          });
        }
      } catch (e) {
        console.error("Failed to fetch accounts", e);
      }
    };
    fetchAccounts();
  }, [mode]);

  useEffect(() => {
    if (!initialData) return;

    setForm((prev) => {
      const waId = initialData.whatsappAccountId || prev.whatsappAccountId;
      const matched =
        accounts.find(
          (a) =>
            a.id === waId ||
            (a as any).phoneId === waId ||
            a.waba_id === waId ||
            a.phone_number_id === waId,
        ) || (accounts.length > 0 ? accounts[0] : null);

      return {
        ...initialData,
        whatsappAccountId: matched ? matched.id : (waId || null),
        whatsappPhoneNumberId:
          initialData.whatsappPhoneNumberId ||
          matched?.phone_number_id ||
          prev.whatsappPhoneNumberId ||
          null,
        buttons: initialData.buttons ?? [],
        bodyExamples: initialData.bodyExamples ?? {},
        headerExamples: initialData.headerExamples ?? {},
        buttonExamples: initialData.buttonExamples ?? {},
        variableFormat: initialData.variableFormat ?? "positional",
      };
    });
  }, [initialData, accounts]);

  useEffect(() => {
    // Don't clear existing media when loading an existing template in EDIT mode
    if (mode === "EDIT") return;

    if (form.headerHandle || form.headerMediaUrl) {
      if (headerBlobUrlRef.current) {
        URL.revokeObjectURL(headerBlobUrlRef.current);
        headerBlobUrlRef.current = null;
      }

      setForm((f) => ({
        ...f,
        headerHandle: undefined,
        headerMediaUrl: undefined,
        headerStoredUrl: undefined,
      }));
    }
  }, [form.headerType, mode]);

  const applyFormatting = (formatType: "bold" | "italic" | "strikethrough") => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = form.bodyText.substring(start, end);

    let formattedText = "";
    let wrapper = "";

    switch (formatType) {
      case "bold":
        wrapper = "*";
        formattedText = `*${selectedText || "bold text"}*`;
        break;
      case "italic":
        wrapper = "_";
        formattedText = `_${selectedText || "italic text"}_`;
        break;
      case "strikethrough":
        wrapper = "~";
        formattedText = `~${selectedText || "strikethrough text"}~`;
        break;
    }

    const newText =
      form.bodyText.substring(0, start) +
      formattedText +
      form.bodyText.substring(end);
    setForm({ ...form, bodyText: newText });

    setTimeout(() => {
      textarea.focus();
      const newCursorPos =
        start + (selectedText ? formattedText.length : wrapper.length + 1);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const isValidUrl = (url: string): boolean => {
    const urlPattern = /^https?:\/\/.+/i;
    return urlPattern.test(url);
  };

  const isValidPhoneNumber = (phone: string): boolean => {
    const phonePattern = /^\+[1-9]\d{1,14}$/;
    return phonePattern.test(phone);
  };
  const isValidTemplateName = (name: string): boolean => {
    return /^[a-z0-9_]+$/.test(name);
  };
  const handleAddButton = () => {
    if (form.buttons.length >= 3) return;
    setForm({
      ...form,
      buttons: [...form.buttons, { type: "QUICK_REPLY", text: "" }],
    });
  };

  const getDetectedVariables = (text: string) => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    // Extract names and sort them
    const vars = Array.from(
      new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim())),
    ).sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
    return vars;
  };

  const bodyVars = getDetectedVariables(form.bodyText);
  const headerVars =
    form.headerType === "TEXT" ? getDetectedVariables(form.headerText) : [];

  return (
    <div className={styles.formLayout}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingTitle}>Submitting template...</p>
            <p className={styles.loadingText}>
              Please wait while we process your request
            </p>
          </div>
        </div>
      )}

      {/* Editor Side */}
      <div
        className={`${styles.editorSide} ${readOnly ? styles.readOnly : ""}`}
      >
        {/* Template Details Section */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Template Details</h2>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>
                Name <span className={styles.fieldRequired}>*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                  })
                }
                className={styles.fieldInput}
                placeholder="e.g. order_confirmation_v2"
                disabled={mode === "EDIT"}
              />
              <div className={styles.nameCheckStatus}>
                {!isValidTemplateName(form.name) && form.name && (
                  <p className={styles.validationError}>
                    Use lowercase letters, numbers, and underscores only
                  </p>
                )}
              </div>
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Category</label>
              <select
                value={form.category}
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm({
                    ...form,
                    category: cat,
                    ...(cat === "AUTHENTICATION"
                      ? {
                          bodyText: "{{1}} is your verification code.",
                          headerType: "NONE" as const,
                          headerText: "",
                          footerText: "",
                          buttons: [],
                          addSecurityRecommendation: true,
                          addExpiration: false,
                          expirationMinutes: 10,
                          authButtonType: "COPY_CODE" as const,
                          authZeroTapTermsAccepted: false,
                        }
                      : {}),
                  });
                }}
                className={styles.fieldSelect}
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className={styles.fieldSelect}
                disabled={mode === "EDIT"}
              >
                <option value="en_US">English (US)</option>
                <option value="en_GB">English (UK)</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>WhatsApp Account</label>
              {loading && accounts.length === 0 ? (
                <div className={styles.fieldHint}>Loading accounts...</div>
              ) : (
                <select
                  value={
                    accounts.find(
                      (a) =>
                        a.id === form.whatsappAccountId ||
                        a.waba_id === form.whatsappAccountId ||
                        (a as any).phoneId === form.whatsappAccountId,
                    )?.id ||
                    form.whatsappAccountId ||
                    ""
                  }
                  onChange={(e) => {
                    const selectedAcc = accounts.find(
                      (a) =>
                        a.waba_id === e.target.value || a.id === e.target.value,
                    );
                    if (selectedAcc) {
                      setForm({
                        ...form,
                        whatsappAccountId: selectedAcc.id,
                        whatsappPhoneNumberId: selectedAcc.phone_number_id,
                      });
                    }
                  }}
                  className={styles.fieldSelect}
                  disabled={mode === "EDIT"}
                >
                  <option value="" disabled>
                    Select an account
                  </option>
                  {accounts.map((acc) => {
                    const phone = acc.display_phone_number
                      ? ` (${acc.display_phone_number})`
                      : "";
                    const label =
                      (acc.verified_name || acc.name || "WhatsApp Account") +
                      phone;
                    return (
                      <option key={acc.id} value={acc.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Authentication Template Options - only when category is AUTHENTICATION */}
        {form.category === "AUTHENTICATION" && (
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>
              Authentication Options{" "}
              <span className={styles.sectionTitleOptional}>
                (OTP / Verification Code)
              </span>
            </h2>
            <p className={styles.fieldHint} style={{ marginBottom: "1rem" }}>
              Authentication templates send one-time passwords. The message uses
              fixed text: &quot;{`{{1}}`} is your verification code.&quot;
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.addSecurityRecommendation ?? true}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      addSecurityRecommendation: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-2 border-border-strong"
                />
                <span>
                  Add security disclaimer (&quot;For your security, do not share
                  this code.&quot;)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.addExpiration ?? false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      addExpiration: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-2 border-border-strong"
                />
                <span>Add expiration warning</span>
              </label>
              {form.addExpiration && (
                <div className="flex items-center gap-3 pl-7">
                  <label className="text-sm text-secondary-foreground">
                    Expires in (minutes):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.expirationMinutes ?? 10}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        expirationMinutes: parseInt(e.target.value) || 10,
                      })
                    }
                    className="w-20 border-2 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className={styles.fieldLabel}>Button Type</label>
                <select
                  value={form.authButtonType ?? "COPY_CODE"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      authButtonType: e.target.value as
                        | "COPY_CODE"
                        | "ONE_TAP"
                        | "ZERO_TAP",
                    })
                  }
                  className={styles.fieldSelect}
                  style={{ maxWidth: "320px" }}
                >
                  <option value="COPY_CODE">Copy Code (recommended)</option>
                  <option value="ONE_TAP">
                    One-tap autofill (Android only, requires app setup)
                  </option>
                  <option value="ZERO_TAP">
                    Zero-tap (Android only, code auto-delivered to app)
                  </option>
                </select>
                <p
                  className={styles.fieldHint}
                  style={{ marginTop: "0.25rem" }}
                >
                  Copy Code: User taps to copy OTP. One-tap: Opens app with
                  code. Zero-tap: Code auto-delivered without user interaction.
                </p>
              </div>

              {form.authButtonType === "COPY_CODE" && (
                <div className="p-3 bg-surface-muted dark:bg-surface-raised/50 rounded-lg border-2 border-border dark:border-border">
                  <label className={styles.fieldLabel}>Copy Code Button</label>
                  <input
                    type="text"
                    value="Copy Code"
                    readOnly
                    disabled
                    className={`${styles.fieldInput} opacity-75 cursor-not-allowed`}
                  />
                  <p
                    className={styles.fieldHint}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Meta only allows localized &quot;Copy code&quot; text.
                    Custom button text is not permitted.
                  </p>
                </div>
              )}

              {/* ONE_TAP and ZERO_TAP require Android app credentials */}
              {(form.authButtonType === "ONE_TAP" ||
                form.authButtonType === "ZERO_TAP") && (
                <div className="space-y-3 p-4 bg-warning-bg dark:bg-warning-bg/20 rounded-lg border-2 border-warning-border dark:border-warning-border">
                  <p className="text-sm font-medium text-warning dark:text-warning">
                    Android only — requires app signing key hash & package name
                  </p>
                  <div>
                    <label className={styles.fieldLabel}>
                      Package Name <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.authPackageName ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          authPackageName: e.target.value,
                        })
                      }
                      placeholder="com.example.myapp"
                      className={styles.fieldInput}
                    />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>
                      Signature Hash <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.authSignatureHash ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          authSignatureHash: e.target.value,
                        })
                      }
                      placeholder="K8aFAINcGX7"
                      className={styles.fieldInput}
                    />
                    <p className={styles.fieldHint}>
                      From{" "}
                      <a
                        href="https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates/autofill-button-authentication-templates#app-signing-key-hash"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] underline"
                      >
                        Meta docs
                      </a>
                    </p>
                  </div>
                  {form.authButtonType === "ONE_TAP" && (
                    <div>
                      <label className={styles.fieldLabel}>
                        Autofill Button Text
                      </label>
                      <input
                        type="text"
                        value={form.authAutofillText ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            authAutofillText: e.target.value,
                          })
                        }
                        placeholder="Autofill (default if empty)"
                        className={styles.fieldInput}
                        maxLength={25}
                      />
                    </div>
                  )}
                  {form.authButtonType === "ZERO_TAP" && (
                    <>
                      <div className="p-3 bg-surface-muted dark:bg-surface-raised/50 rounded-lg border-2 border-border dark:border-border">
                        <label className={styles.fieldLabel}>
                          Copy Code Button (fallback)
                        </label>
                        <input
                          type="text"
                          value="Copy Code"
                          readOnly
                          disabled
                          className={`${styles.fieldInput} opacity-75 cursor-not-allowed`}
                        />
                        <p
                          className={styles.fieldHint}
                          style={{ marginTop: "0.5rem" }}
                        >
                          Meta only allows localized &quot;Copy code&quot;.
                          Shown when zero-tap fails eligibility.
                        </p>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.authZeroTapTermsAccepted ?? false}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              authZeroTapTermsAccepted: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-border-strong"
                        />
                        <span>
                          I accept Zero-tap terms — code will be auto-delivered
                          to app when user chooses WhatsApp
                        </span>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {form.category !== "AUTHENTICATION" && (
          <>
            <div className={`${styles.formSection} ${styles.variableSection}`}>
              <div className={styles.variableHeading}>
                <div className={styles.variableLabelRow}>
                  <h2 className={styles.sectionTitle}>
                    Variable Configuration
                  </h2>
                  <div className={styles.variableHelp}>
                    <div className={styles.variableHelpIcon}>i</div>
                    <div className={styles.variableTooltip}>
                      Choose &apos;Number&apos; for positional variables like{" "}
                      {"{{1}}"}, {"{{2}}"}. Choose &apos;Name&apos; for
                      descriptive variables like {"{{name}}"}, {"{{order_id}}"}.
                    </div>
                  </div>
                </div>
              </div>
              <p className={styles.variableHint}>
                Choose how placeholders are written in your header and message
                body.
              </p>
              <div className={styles.variableControl}>
                <label className={styles.fieldLabel} htmlFor="variable-format">
                  Type of variable
                </label>
                <select
                  id="variable-format"
                  value={form.variableFormat}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      variableFormat: e.target.value as "positional" | "named",
                    })
                  }
                  className={styles.variableSelect}
                >
                  <option value="positional">Number ({"{{1}}, {{2}}"})</option>
                  <option value="named">Name ({"{{var_name}}"})</option>
                </select>
              </div>
            </div>

            {/* Header Section */}
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>
                Header{" "}
                <span className={styles.sectionTitleOptional}>(Optional)</span>
              </h2>
              <div className={styles.headerTypeButtons}>
                {["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, headerType: type as any })
                    }
                    className={`${styles.headerTypeButton} ${form.headerType === type ? styles.active : ""}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {form.headerType === "TEXT" && (
                <div style={{ marginTop: "1rem" }}>
                  <input
                    value={form.headerText}
                    onChange={(e) =>
                      setForm({ ...form, headerText: e.target.value })
                    }
                    className={styles.fieldInput}
                    placeholder="Header text..."
                    maxLength={META_LIMITS.HEADER_TEXT_LENGTH}
                  />
                  <div className={styles.charCounter}>
                    <span></span>
                    <div
                      className={`${styles.charCountText} ${form.headerText.length > META_LIMITS.HEADER_TEXT_LENGTH - 10 ? styles.charCountWarning : ""}`}
                    >
                      {form.headerText.length}/{META_LIMITS.HEADER_TEXT_LENGTH}
                    </div>
                    {headerVars.length > 0 && (
                      <div className="p-3 bg-surface dark:bg-surface rounded-lg border-2 border-border dark:border-border space-y-3">
                        <p className="text-xs font-bold text-[var(--color-primary-dark)] dark:text-info uppercase">
                          Header Variable Examples
                        </p>
                        {headerVars.map((v) => (
                          <div key={v} className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground font-medium">
                              Value for {"{{" + v + "}}"}
                            </label>
                            <input
                              value={form.headerExamples?.[v] || ""}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  headerExamples: {
                                    ...form.headerExamples,
                                    [v]: e.target.value,
                                  },
                                })
                              }
                              placeholder={`e.g. John`}
                              className="w-full border-2 rounded-md px-2 py-1 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(form.headerType === "IMAGE" ||
                form.headerType === "VIDEO" ||
                form.headerType === "DOCUMENT") && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label className="block text-sm font-medium text-secondary-foreground dark:text-secondary-foreground mb-2">
                      Header type
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="headerMode"
                          checked={(form.headerMode ?? "fixed") === "fixed"}
                          onChange={() =>
                            setForm({ ...form, headerMode: "fixed" })
                          }
                          className="rounded mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium">Fixed</span>
                          <p className="text-xs text-muted-foreground">
                            Same media for every send. Upload once at creation;
                            Meta uses it for all sends.
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="headerMode"
                          checked={form.headerMode === "dynamic"}
                          onChange={() =>
                            setForm({ ...form, headerMode: "dynamic" })
                          }
                          className="rounded mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium">Dynamic</span>
                          <p className="text-xs text-muted-foreground">
                            Different media per send. Provide URL or upload each
                            time you send.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className={styles.mediaUploadSection}>
                    <div className={styles.uploadTabs}>
                      <button
                        type="button"
                        onClick={() => setUploadMode("UPLOAD")}
                        className={`${styles.uploadTab} ${uploadMode === "UPLOAD" ? styles.active : ""}`}
                      >
                        Upload New
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode("LIBRARY");
                          fetchMediaLibrary();
                        }}
                        className={`${styles.uploadTab} ${uploadMode === "LIBRARY" ? styles.active : ""}`}
                      >
                        Select from Library
                      </button>
                    </div>

                    {uploading ? (
                      <div
                        className={`${styles.statusMessage} ${styles.statusUploading}`}
                      >
                        Processing Media... (This may take a moment)
                      </div>
                    ) : form.headerHandle || form.headerStoredUrl || form.headerMediaUrl ? (
                      <div
                        className={`${styles.statusMessage} ${styles.statusSuccess}`}
                      >
                        <span>Media Attached Successfully</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (headerBlobUrlRef.current) {
                              URL.revokeObjectURL(headerBlobUrlRef.current);
                              headerBlobUrlRef.current = null;
                            }
                            setForm({
                              ...form,
                              headerHandle: undefined,
                              headerMediaUrl: undefined,
                              headerStoredUrl: undefined,
                            });
                          }}
                          className={styles.removeButton}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        {uploadMode === "UPLOAD" && (
                          <div className={styles.uploadArea}>
                            <input
                              type="file"
                              className={styles.uploadInput}
                              accept={
                                form.headerType === "IMAGE"
                                  ? "image/*"
                                  : form.headerType === "VIDEO"
                                    ? "video/*"
                                    : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              }
                              onChange={handleFileUpload}
                            />
                            <div className={styles.uploadIcon}>
                              {form.headerType === "IMAGE" && (
                                <ImageIcon size={20} />
                              )}
                              {form.headerType === "VIDEO" && (
                                <Video size={20} />
                              )}
                              {form.headerType === "DOCUMENT" && (
                                <FileText size={20} />
                              )}
                            </div>
                            <div className={styles.uploadText}>
                              Click to upload {form.headerType.toLowerCase()}
                            </div>
                            <p className={styles.uploadHint}>
                              Max size:{" "}
                              {form.headerType === "IMAGE"
                                ? META_LIMITS.IMAGE_SIZE_MB
                                : form.headerType === "VIDEO"
                                  ? META_LIMITS.VIDEO_SIZE_MB
                                  : META_LIMITS.DOCUMENT_SIZE_MB}
                              MB
                            </p>
                            <p className={styles.uploadHint}>
                              File will be saved to Gallery
                            </p>
                          </div>
                        )}

                        {uploadMode === "LIBRARY" && (
                          <div>
                            <input
                              type="text"
                              placeholder="Search media..."
                              value={searchMedia}
                              onChange={(e) => setSearchMedia(e.target.value)}
                              className={styles.fieldInput}
                              style={{ marginBottom: "0.75rem" }}
                            />
                            <div className={styles.mediaLibrary}>
                              {mediaLibrary
                                .filter((m) => {
                                  const searchMatch = m.name
                                    .toLowerCase()
                                    .includes(searchMedia.toLowerCase());
                                  if (!searchMatch) return false;

                                  if (form.headerType === "IMAGE") {
                                    return m.type.startsWith("image/");
                                  } else if (form.headerType === "VIDEO") {
                                    return m.type.startsWith("video/");
                                  } else if (form.headerType === "DOCUMENT") {
                                    return (
                                      m.type === "application/pdf" ||
                                      m.type.includes("msword") ||
                                      m.type.includes("ms-excel") ||
                                      m.type.includes("ms-powerpoint") ||
                                      m.type.includes("officedocument")
                                    );
                                  }
                                  return false;
                                })
                                .map((m) => (
                                  <div
                                    key={m.id}
                                    onClick={() => handleMediaSelect(m.id)}
                                    className={styles.mediaItem}
                                  >
                                    {m.type.startsWith("image") ? (
                                      <div
                                        className={styles.mediaPreview}
                                        style={{
                                          backgroundImage: `url(${m.url})`,
                                        }}
                                      />
                                    ) : (
                                      <div className={styles.mediaPreview}>
                                        <div
                                          className={styles.mediaPlaceholder}
                                        >
                                          {m.type.split("/")[1]}
                                        </div>
                                      </div>
                                    )}
                                    <span className={styles.mediaName}>
                                      {m.name}
                                    </span>
                                  </div>
                                ))}
                              {mediaLibrary.length === 0 && (
                                <div
                                  style={{
                                    gridColumn: "1 / -1",
                                    textAlign: "center",
                                    padding: "1rem",
                                  }}
                                >
                                  <span className={styles.emptyState}>
                                    No media found
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!form.whatsappAccountId && (
                      <p className={styles.validationError}>
                        Select an account first
                      </p>
                    )}
                  </div>

                  {form.headerType === "DOCUMENT" && (
                    <div style={{ marginTop: "1rem" }}>
                      <label className={styles.fieldLabel}>
                        Document / PDF File Name{" "}
                        <span className={styles.sectionTitleOptional}>
                          (Optional, e.g. Wedding_Invitation.pdf)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={form.headerDocumentFilename || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            headerDocumentFilename: e.target.value,
                          })
                        }
                        placeholder="e.g. Wedding_Invitation.pdf"
                        className={styles.fieldInput}
                      />
                      <p
                        className={styles.fieldHint}
                        style={{ marginTop: "0.25rem" }}
                      >
                        Specify the filename to display on WhatsApp when the
                        recipient receives this document.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Body Section */}
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>
                Body <span className={styles.fieldRequired}>*</span>
              </h2>

              <div className={styles.formattingToolbar}>
                <button
                  type="button"
                  onClick={() => applyFormatting("bold")}
                  className={styles.formatButton}
                  title="Bold (*text*)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("italic")}
                  className={styles.formatButton}
                  title="Italic (_text_)"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("strikethrough")}
                  className={styles.formatButton}
                  title="Strikethrough (~text~)"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                <div className={styles.toolbarLabel}>WhatsApp Formatting</div>
              </div>

              <textarea
                ref={bodyTextareaRef}
                value={form.bodyText}
                onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                className={styles.fieldTextarea}
                placeholder="Hi {{1}}, your order #{{2}} has been shipped."
                maxLength={META_LIMITS.BODY_TEXT_LENGTH}
              />

              {bodyVars.length > 0 && (
                <div className="p-3 bg-surface dark:bg-surface rounded-lg border-2 border-border dark:border-border space-y-3">
                  <p className="text-xs font-bold text-[var(--color-primary-dark)] dark:text-info uppercase">
                    Body Variable Examples
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {bodyVars.map((v) => (
                      <div key={v} className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Value for {"{{" + v + "}}"}
                        </label>
                        <input
                          value={form.bodyExamples?.[v] || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              bodyExamples: {
                                ...form.bodyExamples,
                                [v]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Sample for {{${v}}}`}
                          className="w-full border-2 rounded-md px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.charCounter}>
                <p className={styles.fieldHint}>
                  Formatting: *bold* _italic_ ~strikethrough~ | Variables:{" "}
                  {"{{1}}"} {"{{2}}"}
                </p>
                <div
                  className={`${styles.charCountText} ${form.bodyText.length > META_LIMITS.BODY_TEXT_LENGTH - 50 ? styles.charCountWarning : ""}`}
                >
                  {form.bodyText.length}/{META_LIMITS.BODY_TEXT_LENGTH}
                </div>
              </div>
            </div>

            {/* Footer Section */}
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>
                Footer{" "}
                <span className={styles.sectionTitleOptional}>(Optional)</span>
              </h2>
              <input
                value={form.footerText}
                onChange={(e) =>
                  setForm({ ...form, footerText: e.target.value })
                }
                className={styles.fieldInput}
                placeholder="Footer text (e.g. Reply STOP to unsubscribe)"
                maxLength={META_LIMITS.FOOTER_TEXT_LENGTH}
              />
              {form.footerText && (
                <div className={styles.charCounter}>
                  <span></span>
                  <div
                    className={`${styles.charCountText} ${form.footerText.length > META_LIMITS.FOOTER_TEXT_LENGTH - 10 ? styles.charCountWarning : ""}`}
                  >
                    {form.footerText.length}/{META_LIMITS.FOOTER_TEXT_LENGTH}
                  </div>
                </div>
              )}
            </div>

            {/* Buttons Section */}
            <div className={styles.formSection}>
              <div className={styles.buttonsHeader}>
                <h2 className={styles.sectionTitle}>
                  Buttons{" "}
                  <span className={styles.sectionTitleOptional}>
                    (Optional, max 3)
                  </span>
                </h2>
                {form.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className={styles.addButton}
                  >
                    Add Button
                  </button>
                )}
              </div>
              {form.buttons.map((btn, idx) => (
                <div key={idx} className={styles.buttonItem}>
                  <div className={styles.buttonRow}>
                    <div className={styles.buttonField}>
                      <label className={styles.fieldLabel}>
                        Type of Action
                      </label>
                      <select
                        value={btn.type}
                        onChange={(e) => {
                          const newButtons = [...form.buttons];
                          newButtons[idx].type = e.target.value as any;
                          if (e.target.value === "QUICK_REPLY") {
                            delete newButtons[idx].url;
                            delete newButtons[idx].phoneNumber;
                          } else if (e.target.value === "URL") {
                            delete newButtons[idx].phoneNumber;
                          } else if (e.target.value === "PHONE_NUMBER") {
                            delete newButtons[idx].url;
                          }
                          setForm({ ...form, buttons: newButtons });
                        }}
                        className={styles.fieldSelect}
                      >
                        <option value="QUICK_REPLY">Quick Reply</option>
                        <option value="URL">Visit Website</option>
                        <option value="PHONE_NUMBER">Call Phone Number</option>
                      </select>
                    </div>
                    <div className={styles.buttonField}>
                      <label className={styles.fieldLabel}>
                        Button Text{" "}
                        <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        value={btn.text}
                        onChange={(e) => {
                          const newButtons = [...form.buttons];
                          newButtons[idx].text = e.target.value;
                          setForm({ ...form, buttons: newButtons });
                        }}
                        className={styles.fieldInput}
                        placeholder={`Button Text (max ${META_LIMITS.BUTTON_TEXT_LENGTH})`}
                        maxLength={META_LIMITS.BUTTON_TEXT_LENGTH}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newButtons = form.buttons.filter(
                          (_, i) => i !== idx,
                        );
                        setForm({ ...form, buttons: newButtons });
                      }}
                      className={styles.deleteButton}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {btn.type === "URL" && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <label className={styles.fieldLabel}>
                        Website URL{" "}
                        <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        value={btn.url || ""}
                        onChange={(e) => {
                          const newButtons = [...form.buttons];
                          newButtons[idx].url = e.target.value;
                          setForm({ ...form, buttons: newButtons });
                        }}
                        className={styles.fieldInput}
                        placeholder="https://example.com or https://example.com/{{1}}"
                        type="url"
                      />
                      <p className={styles.fieldHint}>
                        Must start with http:// or https://. Can include{" "}
                        {"{{1}}"} for dynamic URLs.
                      </p>
                      {btn.url && btn.url.includes("{{1}}") && (
                        <div className="p-3 bg-surface dark:bg-surface rounded-lg border-2 border-border dark:border-border space-y-3">
                          <label className="text-xs font-bold text-secondary-foreground dark:text-secondary-foreground dark:text-info uppercase block">
                            URL Example
                          </label>
                          <input
                            value={form.buttonExamples?.[idx] || ""}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                buttonExamples: {
                                  ...form.buttonExamples,
                                  [idx]: e.target.value,
                                },
                              });
                            }}
                            className="w-full border rounded px-3 py-2 text-sm bg-surface"
                            placeholder="Full sample URL (e.g. https://example.com/summer-sale)"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Provide a full URL with a sample value replaced.
                          </p>
                        </div>
                      )}
                      {btn.url && !isValidUrl(btn.url) && (
                        <p className={styles.validationError}>
                          ⚠ Invalid URL format. Must start with http:// or
                          https://
                        </p>
                      )}
                    </div>
                  )}

                  {btn.type === "PHONE_NUMBER" && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <label className={styles.fieldLabel}>
                        Phone Number{" "}
                        <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        value={btn.phoneNumber || ""}
                        onChange={(e) => {
                          const newButtons = [...form.buttons];
                          newButtons[idx].phoneNumber = e.target.value;
                          setForm({ ...form, buttons: newButtons });
                        }}
                        className={styles.fieldInput}
                        placeholder="+1234567890 (include country code)"
                        type="tel"
                      />
                      <p className={styles.fieldHint}>
                        Must include country code with + prefix (e.g., +1 for
                        US, +91 for India)
                      </p>
                      {btn.phoneNumber &&
                        !isValidPhoneNumber(btn.phoneNumber) && (
                          <p className={styles.validationError}>
                            ⚠ Invalid phone number. Must start with + and
                            country code
                          </p>
                        )}
                    </div>
                  )}
                </div>
              ))}
              {form.buttons.length === 0 && (
                <p className={styles.emptyState}>No buttons added.</p>
              )}
            </div>
          </>
        )}

        <div className={styles.submitSection}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-5 h-5" />
                {mode === "CREATE" ? "Create Template" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Side */}
      <div className={styles.previewSide}>{renderPreview(form)}</div>
    </div>
  );
}
