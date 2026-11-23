/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIcon,
  Video,
  FileText,
  LayoutTemplate,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import TemplateForm, {
  TemplateFormState,
} from "@/features/templates/components/TemplateForm";
import FormattedText from "@/features/templates/components/FormattedText";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { TEMPLATE_DRAFT_STORAGE_KEY } from "@/features/templates/data/exampleTemplates";
import styles from "../../create-template.module.css";

export default function CreateTemplatePage({
  params,
}: {
  params: Promise<{ phoneId: string }>;
}) {
  const router = useRouter();
  const { phoneId } = use(params);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TemplateFormState | undefined>();

  // Prefill from an example template picked on the templates page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TEMPLATE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
      setDraft(JSON.parse(raw));
    } catch {}
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await soft7AxiosInstance.post(
        "/admin/templates/create",
        data,
      );
      return response.data;
    },

    onSuccess: () => {
      toast.success("Template created successfully!");
      queryClient.invalidateQueries({ queryKey: ["get-templates"] });
      router.push(`/user/manage/templates/phone/${phoneId}`);
    },

    onError: (error: any) => {
      let msg = "Failed to create template";
      const errData = error?.response?.data;

      if (errData) {
        if (typeof errData.error === "string") {
          msg = errData.error;
        } else if (typeof errData.error?.error_user_msg === "string") {
          msg = errData.error.error_user_msg;
        } else if (typeof errData.error?.message === "string") {
          msg = errData.error.message;
        } else if (typeof errData.error?.error?.error_user_msg === "string") {
          msg = errData.error.error.error_user_msg;
        } else if (typeof errData.error?.error?.message === "string") {
          msg = errData.error.error.message;
        } else if (typeof errData.message === "string") {
          msg = errData.message;
        } else if (typeof errData === "string") {
          msg = errData;
        } else {
          try {
            msg = JSON.stringify(errData.error || errData);
          } catch {
            msg = "Failed to create template";
          }
        }
      }

      toast.error(typeof msg === "string" ? msg : String(msg), {
        duration: 8000,
      });
    },
  });

  const getDetectedVariables = (text: string) => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return Array.from(
      new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim())),
    ).sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
  };

  const handleSubmit = async (form: TemplateFormState) => {
    if (!form.name) {
      return toast.error("Template name is required.");
    }

    if (!form.whatsappAccountId) {
      return toast.error("Please select a WhatsApp Account.");
    }

    let components: any[] = [];
    const isAuth = form.category === "AUTHENTICATION";

    if (isAuth) {
      components = [
        {
          type: "BODY",
          add_security_recommendation: form.addSecurityRecommendation ?? true,
        },
      ];

      if (form.addExpiration) {
        components.push({
          type: "FOOTER",
          code_expiration_minutes: Math.min(
            90,
            Math.max(1, form.expirationMinutes ?? 10),
          ),
        });
      }

      const isZero = form.authButtonType === "ZERO_TAP";
      const isOne = form.authButtonType === "ONE_TAP";

      const otpBtn: any = {
        type: "OTP",
        otp_type: isZero ? "zero_tap" : form.authButtonType,
        text: form.authCopyCodeText || "Copy Code",
      };

      if (isOne || isZero) {
        Object.assign(otpBtn, {
          autofill_text: form.authAutofillText || "Autofill",
          package_name: form.authPackageName?.trim(),
          signature_hash: form.authSignatureHash?.trim(),
        });

        if (isZero) {
          otpBtn.zero_tap_terms_accepted =
            form.authZeroTapTermsAccepted ?? false;
        }
      }

      components.push({
        type: "BUTTONS",
        buttons: [otpBtn],
      });
    } else {
      if (!form.bodyText) {
        return toast.error("Name and Body are required.");
      }

      if (form.headerType !== "NONE") {
        const header: any = {
          type: "HEADER",
          format: form.headerType,
        };

        if (form.headerType === "TEXT") {
          header.text = form.headerText;
          const headerVars = getDetectedVariables(form.headerText);
          if (headerVars.length > 0) {
            if (form.variableFormat === "named") {
              header.example = {
                header_text_named_params: headerVars.map((v) => ({
                  param_name: v,
                  example: form.headerExamples?.[v] || "sample",
                })),
              };
            } else {
              header.example = {
                header_text: headerVars.map(
                  (v) => form.headerExamples?.[v] || "sample",
                ),
              };
            }
          }
        } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType)) {
          if (!form.headerHandle) {
            return toast.error(
              `Please upload your ${form.headerType.toLowerCase()} file and wait for 'Media Attached Successfully' before submitting.`,
            );
          }

          if (form.headerType === "DOCUMENT" && form.headerDocumentFilename) {
            header.filename = form.headerDocumentFilename.trim();
          }

          header.example = {
            header_handle: [form.headerHandle],
          };
        }

        components.push(header);
      }

      const bodyVars = getDetectedVariables(form.bodyText);
      const bodyComp: any = {
        type: "BODY",
        text: form.bodyText,
      };

      if (bodyVars.length > 0) {
        if (form.variableFormat === "named") {
          bodyComp.example = {
            body_text_named_params: bodyVars.map((v) => ({
              param_name: v,
              example: form.bodyExamples?.[v] || "sample",
            })),
          };
        } else {
          bodyComp.example = {
            body_text: [
              bodyVars.map((v) => form.bodyExamples?.[v] || "sample"),
            ],
          };
        }
      }

      components.push(bodyComp);

      if (form.footerText) {
        components.push({
          type: "FOOTER",
          text: form.footerText,
        });
      }

      if (form.buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: form.buttons.map((b, idx) =>
            b.type === "URL"
              ? {
                  type: b.type,
                  text: b.text,
                  url: b.url,
                  ...(b.url && /\{\{[^}]+\}\}/.test(b.url)
                    ? {
                        example: [
                          form.buttonExamples?.[idx] ||
                            b.url.replace(/\{\{[^}]+\}\}/g, "sample"),
                        ],
                      }
                    : {}),
                }
              : b.type === "PHONE_NUMBER"
                ? {
                    type: b.type,
                    text: b.text,
                    phone_number: b.phoneNumber,
                  }
                : {
                    type: b.type,
                    text: b.text,
                  },
          ),
        });
      }
    }

    const headerMode =
      !isAuth && ["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType)
        ? form.headerMode || "fixed"
        : undefined;

    createMutation.mutate({
      name: form.name,
      category: form.category,
      language: form.language,
      components,
      waba_id: form.whatsappAccountId,
      headerMode,
      headerMediaUrl:
        headerMode === "fixed" && form.headerStoredUrl
          ? form.headerStoredUrl
          : undefined,
      headerDocumentFilename:
        form.headerType === "DOCUMENT" && form.headerDocumentFilename
          ? form.headerDocumentFilename.trim()
          : undefined,
    });
  };

  const replaceVariables = (
    text: string,
    examples?: Record<string, string>,
  ) => {
    if (!text) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const key = varName.trim();
      const val = examples?.[key];
      return val !== undefined && val !== "" ? val : match;
    });
  };

  const renderPreview = (form: TemplateFormState) => {
    const isAuth = form.category === "AUTHENTICATION";

    const previewBodyText = isAuth
      ? `${form.addSecurityRecommendation ? "For your security, do not share this code.\n\n" : ""}${form.bodyExamples?.["1"] || "{{1}}"} is your verification code.${form.addExpiration ? `\n\nThis code expires in ${form.expirationMinutes ?? 10} minutes.` : ""}`
      : replaceVariables(form.bodyText, form.bodyExamples);

    const previewHeaderText =
      form.headerType === "TEXT"
        ? replaceVariables(form.headerText, form.headerExamples)
        : form.headerText;

    const authFooterText = isAuth ? "" : form.footerText;

    return (
      <div className={styles.previewContainer}>
        <div className={styles.previewCard}>
          <h3 className={styles.previewTitle}>Live Preview</h3>

          <div className={styles.phoneFrame}>
            <div className={styles.phoneNotch} />

            <div className={styles.phoneScreen}>
              <div className={styles.whatsappHeader}>
                <div className={styles.headerAvatar} />
                <div className={styles.headerName}>Business Name</div>
              </div>

              <div className={styles.chatArea}>
                <div className={styles.messageBubble}>
                  {!isAuth && form.headerType !== "NONE" && (
                    <div className={styles.messageHeader}>
                      {form.headerType === "TEXT" ? (
                        <span className={styles.headerTextContent}>
                          {previewHeaderText}
                        </span>
                      ) : form.headerType === "DOCUMENT" ? (
                        <div
                          style={{
                            padding: "8px 10px",
                            background: "color-mix(in oklab, var(--color-text) 5%, transparent)",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "6px",
                              background: "var(--color-error)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--color-primary-foreground)",
                              fontWeight: "bold",
                              fontSize: "10px",
                              flexShrink: 0,
                            }}
                          >
                            PDF
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "var(--color-text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {form.headerDocumentFilename || "Document.pdf"}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                              Document • PDF
                            </div>
                          </div>
                        </div>
                      ) : form.headerMediaUrl ? (
                        form.headerType === "IMAGE" ? (
                          <img
                            src={form.headerMediaUrl}
                            alt="Header"
                            className={styles.headerMediaPreview}
                          />
                        ) : (
                          <video
                            src={form.headerMediaUrl}
                            className={styles.headerMediaPreview}
                            controls
                          />
                        )
                      ) : (
                        <div className={styles.headerContent}>
                          {form.headerType === "IMAGE" && (
                            <ImageIcon size={32} />
                          )}
                          {form.headerType === "VIDEO" && <Video size={32} />}

                          <span className={styles.headerIconLabel}>
                            {form.headerType}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.messageBody}>
                    {previewBodyText ? (
                      <FormattedText text={previewBodyText} />
                    ) : (
                      <span className={styles.messagePlaceholder}>
                        Message body...
                      </span>
                    )}
                  </div>

                  {authFooterText && (
                    <div className={styles.messageFooter}>{authFooterText}</div>
                  )}

                  {/* Template buttons - keep them inside the WhatsApp message bubble
                      so the live preview reflects the button text entered in the form. */}
                  {!isAuth && form.buttons.length > 0 && (
                    <div className={styles.buttonPreviewContainer}>
                      {form.buttons.map((button, index) => (
                        <div
                          key={`preview-button-${index}-${button.type}`}
                          className={styles.buttonPreview}
                        >
                          {button.text?.trim() || `Button ${index + 1}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {isAuth &&
                    (form.authButtonType === "COPY_CODE" ||
                      form.authButtonType === "ONE_TAP" ||
                      form.authButtonType === "ZERO_TAP") && (
                      <div className={styles.authButtonPreview}>
                        {form.authButtonType === "COPY_CODE"
                          ? "Copy Code"
                          : form.authButtonType === "ONE_TAP"
                            ? form.authAutofillText || "Autofill"
                            : "Copy Code"}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.createPage}>
      <div className={styles.createContainer}>
        <div className={styles.headerSection}>
          <div className={styles.headerCopy}>
            <button
              type="button"
              onClick={() =>
                router.push(`/user/manage/templates/phone/${phoneId}`)
              }
              className={styles.backButton}
              aria-label="Back to templates"
            >
              <ArrowLeft size={19} />
            </button>

            <div className={styles.headerIcon}>
              <LayoutTemplate size={22} />
            </div>

            <div className={styles.headerText}>
              <p className={styles.eyebrow}>WhatsApp Template Builder</p>
              <h1 className={styles.pageTitle}>Create Template</h1>
              <p className={styles.pageSubtitle}>
                Build an approved-ready WhatsApp message with a live preview.
              </p>
            </div>
          </div>

          <div className={styles.headerMeta}>
            <span className={styles.headerBadge}>
              <span className={styles.headerBadgeDot} />
              <Sparkles size={13} />
              New template
            </span>
            <span className={styles.headerBadge}>
              <CheckCircle2 size={13} />
              Live preview
            </span>
          </div>
        </div>

        <TemplateForm
          initialData={draft}
          onSubmit={handleSubmit}
          loading={createMutation.isPending}
          mode="CREATE"
          renderPreview={renderPreview}
        />
      </div>
    </div>
  );
}
