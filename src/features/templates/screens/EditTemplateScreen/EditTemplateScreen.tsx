/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Image as ImageIcon, Video, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import TemplateForm, {
  TemplateFormState,
} from "@/features/templates/components/TemplateForm";
import FormattedText from "@/features/templates/components/FormattedText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import styles from "../../create-template.module.css";

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ phoneId: string; templateId: string }>;
}) {
  const router = useRouter();
  const { phoneId, templateId } = use(params);
  const queryClient = useQueryClient();

  const { data: initialData, isLoading: isFetching } = useQuery({
    queryKey: ["edit-templates", templateId],
    queryFn: async () => {
      const { data: response } = await soft7AxiosInstance.get(
        `/admin/templates/${templateId}`,
      );
      return response.data;
    },
    select: (data) => {
      const header = data.components?.find((c: any) => c.type === "HEADER");
      const body = data.components?.find((c: any) => c.type === "BODY");
      const footer = data.components?.find((c: any) => c.type === "FOOTER");
      const buttons = data.components?.find((c: any) => c.type === "BUTTONS");
      const isAuth = data.category === "AUTHENTICATION";

      let authButtonType: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP" = "COPY_CODE";
      const otpBtn =
        isAuth && buttons?.buttons?.length
          ? buttons.buttons.find((b: any) => b.type === "OTP")
          : null;
      if (otpBtn) {
        const ot = (otpBtn.otp_type || "").toUpperCase();
        authButtonType =
          ot === "ONE_TAP"
            ? "ONE_TAP"
            : ot === "ZERO_TAP"
              ? "ZERO_TAP"
              : "COPY_CODE";
      }

      const hasExpiration =
        isAuth &&
        (footer?.code_expiration_minutes != null ||
          footer?.text?.includes("expires"));
      const expirationMinutes =
        isAuth && footer?.code_expiration_minutes != null
          ? footer.code_expiration_minutes
          : 10;

      // Extract body variable examples from body.example.body_text
      // Backend stores them as 2D array: [["val1", "val2"]]
      const bodyExamples: Record<string, string> = {};
      const bodyTextExamples = body?.example?.body_text;
      if (Array.isArray(bodyTextExamples) && Array.isArray(bodyTextExamples[0])) {
        bodyTextExamples[0].forEach((val: string, idx: number) => {
          bodyExamples[String(idx + 1)] = val;
        });
      }
      const bodyNamedExamples = body?.example?.body_text_named_params;
      if (Array.isArray(bodyNamedExamples)) {
        bodyNamedExamples.forEach((item: any) => {
          if (item?.param_name && item?.example) {
            bodyExamples[item.param_name] = item.example;
          }
        });
      }

      // Extract header variable examples
      const headerExamples: Record<string, string> = {};
      const headerTextExamples = header?.example?.header_text;
      if (Array.isArray(headerTextExamples)) {
        headerTextExamples.forEach((val: string, idx: number) => {
          headerExamples[String(idx + 1)] = val;
        });
      }
      const headerNamedExamples = header?.example?.header_text_named_params;
      if (Array.isArray(headerNamedExamples)) {
        headerNamedExamples.forEach((item: any) => {
          if (item?.param_name && item?.example) {
            headerExamples[item.param_name] = item.example;
          }
        });
      }

      // Extract button URL variable examples
      const buttonExamples: Record<number, string> = {};
      buttons?.buttons?.forEach((b: any, idx: number) => {
        if (b.type === "URL" && b.example?.[0]) {
          buttonExamples[idx] = b.example[0];
        }
      });

      // Resolve the media URL for Live Preview
      // When synced/loaded, Meta returns the image URL in header.example.header_handle[0]
      const rawHandle = header?.example?.header_handle?.[0];
      const isHandleUrl =
        typeof rawHandle === "string" &&
        (rawHandle.startsWith("http://") || rawHandle.startsWith("https://"));

      const resolvedMediaUrl =
        data.headerMediaUrl ||
        data.header_media_url ||
        data.meta_data?.headerMediaUrl ||
        data.meta_data?.header_media_url ||
        (isHandleUrl ? rawHandle : undefined);

      return {
        name: data.name,
        category: data.category,
        language: data.language,
        headerType: header ? header.format : "NONE",
        headerText: header?.format === "TEXT" ? header.text : "",
        headerHandle: rawHandle,
        headerMediaUrl: resolvedMediaUrl,
        headerStoredUrl: resolvedMediaUrl,
        headerMode: data.headerMode || (header && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format) ? "fixed" : undefined),
        headerDocumentFilename: header?.filename,
        bodyText:
          body?.text || (isAuth ? "{{1}} is your verification code." : ""),
        bodyExamples,
        headerExamples,
        buttonExamples,
        footerText: footer?.text || "",
        buttons:
          buttons && !isAuth
            ? buttons.buttons.map((b: any) => ({
                type: b.type,
                text: b.text,
                url: b.url,
                phoneNumber: b.phone_number,
              }))
            : [],
        whatsappAccountId: data.whatsappAccountId || data.waba_id || phoneId || null,
        whatsappPhoneNumberId: data.whatsappPhoneNumberId || data.phone_number_id || phoneId || null,
        variableFormat: data.variableFormat || (body?.example?.body_text_named_params ? "named" : "positional"),
        addSecurityRecommendation: isAuth
          ? (body?.add_security_recommendation ?? true)
          : undefined,
        addExpiration: isAuth ? hasExpiration : undefined,
        expirationMinutes: isAuth ? expirationMinutes : undefined,
        authButtonType: isAuth ? authButtonType : undefined,
        authPackageName: isAuth ? otpBtn?.package_name : undefined,
        authSignatureHash: isAuth ? otpBtn?.signature_hash : undefined,
        authAutofillText: isAuth
          ? otpBtn?.autofill_text || "Autofill"
          : undefined,
        authCopyCodeText: isAuth ? otpBtn?.text || "Copy Code" : undefined,
        authZeroTapTermsAccepted: isAuth
          ? (otpBtn?.zero_tap_terms_accepted ?? false)
          : undefined,
      };
    },
  });

  const getDetectedVariables = (text: string) => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const unique = Array.from(
      new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())),
    );
    return unique.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const { data } = await soft7AxiosInstance.put(
        `/admin/templates/${templateId}`,
        updatedData,
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Template updated successfully!");
      queryClient.invalidateQueries({
        queryKey: ["edit-templates", templateId],
      });
      queryClient.invalidateQueries({ queryKey: ["get-templates"] });
      // Go back to the phone templates list
      router.push(`/user/manage/templates/phone/${phoneId}`);
    },
    onError: (error: any) => {
      let msg = "Failed to update template";
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
            msg = "Failed to update template";
          }
        }
      }

      toast.error(typeof msg === "string" ? msg : String(msg), {
        duration: 8000,
      });
    },
  });

  const handleSubmit = async (form: TemplateFormState) => {
    // Authentication template (per Meta Copy Code, One-tap, Zero-tap docs)
    if (form.category === "AUTHENTICATION") {
      const components: any[] = [
        {
          type: "BODY",
          add_security_recommendation: form.addSecurityRecommendation ?? true,
        },
      ];
      if (form.addExpiration) {
        const mins = Math.min(90, Math.max(1, form.expirationMinutes ?? 10));
        components.push({ type: "FOOTER", code_expiration_minutes: mins });
      }
      if (form.authButtonType === "COPY_CODE") {
        components.push({
          type: "BUTTONS",
          buttons: [
            {
              type: "OTP",
              otp_type: "COPY_CODE",
              text: form.authCopyCodeText || "Copy Code",
            },
          ],
        });
      } else if (form.authButtonType === "ONE_TAP") {
        components.push({
          type: "BUTTONS",
          buttons: [
            {
              type: "OTP",
              otp_type: "ONE_TAP",
              text: form.authCopyCodeText || "Copy Code",
              autofill_text: form.authAutofillText || "Autofill",
              package_name: form.authPackageName?.trim(),
              signature_hash: form.authSignatureHash?.trim(),
            },
          ],
        });
      } else if (form.authButtonType === "ZERO_TAP") {
        components.push({
          type: "BUTTONS",
          buttons: [
            {
              type: "OTP",
              otp_type: "zero_tap",
              text: form.authCopyCodeText || "Copy Code",
              autofill_text: form.authAutofillText || "Autofill",
              package_name: form.authPackageName?.trim(),
              signature_hash: form.authSignatureHash?.trim(),
              zero_tap_terms_accepted: form.authZeroTapTermsAccepted ?? false,
            },
          ],
        });
      }
      updateMutation?.mutate({ category: "AUTHENTICATION", components });
      return;
    }

    // Marketing/Utility template
    const components: any[] = [];
    if (form.headerType === "TEXT" && form.headerText) {
      const headerComp: any = {
        type: "HEADER",
        format: "TEXT",
        text: form.headerText,
      };
      const headerVars = getDetectedVariables(form.headerText);
      if (headerVars.length > 0) {
        if (form.variableFormat === "named") {
          headerComp.example = {
            header_text_named_params: headerVars.map((v) => ({
              param_name: v,
              example: form.headerExamples?.[v] || "sample",
            })),
          };
        } else {
          headerComp.example = {
            header_text: headerVars.map(
              (v) => form.headerExamples?.[v] || "sample",
            ),
          };
        }
      }
      components.push(headerComp);
    } else if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType) &&
      (form.headerHandle || form.headerStoredUrl || form.headerMediaUrl)
    ) {
      const mediaHandle =
        form.headerHandle || form.headerStoredUrl || form.headerMediaUrl;
      const mediaHeader: any = {
        type: "HEADER",
        format: form.headerType,
        example: { header_handle: [mediaHandle] },
      };
      if (form.headerType === "DOCUMENT" && form.headerDocumentFilename) {
        mediaHeader.filename = form.headerDocumentFilename.trim();
      }
      components.push(mediaHeader);
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
      components.push({ type: "FOOTER", text: form.footerText });
    }
    if (form.buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: form.buttons
          .map((b, idx) => {
            if (b.type === "QUICK_REPLY")
              return { type: "QUICK_REPLY", text: b.text };
            if (b.type === "URL") {
              const urlBtn: any = { type: "URL", text: b.text, url: b.url };
              if (b.url && /\{\{[^}]+\}\}/.test(b.url)) {
                urlBtn.example = [
                  form.buttonExamples?.[idx] ||
                    b.url.replace(/\{\{[^}]+\}\}/g, "sample"),
                ];
              }
              return urlBtn;
            }
            if (b.type === "PHONE_NUMBER")
              return {
                type: "PHONE_NUMBER",
                text: b.text,
                phone_number: b.phoneNumber,
              };
            return null;
          })
          .filter(Boolean),
      });
    }

    updateMutation?.mutate({
      category: form.category,
      components,
    });
  };

  if (isFetching) {
    return (
      <div className={styles.createPage}>
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingTitle}>Loading template...</p>
            <p className={styles.loadingText}>
              Please wait while we fetch your template data
            </p>
          </div>
        </div>
      </div>
    );
  }

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

    const handleUrl =
      typeof form.headerHandle === "string" &&
      (form.headerHandle.startsWith("http://") ||
        form.headerHandle.startsWith("https://"))
        ? form.headerHandle
        : undefined;
    const previewMediaUrl =
      form.headerMediaUrl || handleUrl || form.headerStoredUrl;

    return (
      <div className={styles.previewContainer}>
        <div className={styles.previewCard}>
          <h3 className={styles.previewTitle}>Live Preview</h3>

          {/* Phone Device Frame */}
          <div className={styles.phoneFrame}>
            {/* Notch */}
            <div className={styles.phoneNotch} />

            {/* Phone Screen */}
            <div className={styles.phoneScreen}>
              {/* WhatsApp Header */}
              <div className={styles.whatsappHeader}>
                <div className={styles.headerAvatar} />
                <div className={styles.headerName}>Business Name</div>
              </div>

              {/* Chat Area */}
              <div className={styles.chatArea}>
                {/* Message Bubble */}
                <div className={styles.messageBubble}>
                  {/* Header Media/Text - not used for AUTHENTICATION */}
                  {!isAuth && form.headerType !== "NONE" && (
                    <div className={styles.messageHeader}>
                      {form.headerType === "TEXT" ? (
                        <span className={styles.headerTextContent}>
                          {previewHeaderText}
                        </span>
                      ) : previewMediaUrl ? (
                        form.headerType === "IMAGE" ? (
                          <img
                            src={previewMediaUrl}
                            alt="Header"
                            referrerPolicy="no-referrer"
                            className={styles.headerMediaPreview}
                          />
                        ) : form.headerType === "VIDEO" ? (
                          <video
                            src={previewMediaUrl}
                            className={styles.headerMediaPreview}
                            controls
                          />
                        ) : (
                          <div className={styles.headerContent}>
                            <FileText size={32} />
                            <span className={styles.headerIconLabel}>
                              Document
                            </span>
                          </div>
                        )
                      ) : (
                        <div className={styles.headerContent}>
                          {form.headerType === "IMAGE" && (
                            <ImageIcon size={32} />
                          )}
                          {form.headerType === "VIDEO" && <Video size={32} />}
                          {form.headerType === "DOCUMENT" && (
                            <FileText size={32} />
                          )}
                          <span className={styles.headerIconLabel}>
                            {form.headerType}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Text */}
                  <div className={styles.messageBody}>
                    {previewBodyText ? (
                      <FormattedText text={previewBodyText} />
                    ) : (
                      <span className={styles.messagePlaceholder}>
                        Message body...
                      </span>
                    )}
                  </div>

                  {/* Footer Text */}
                  {authFooterText && (
                    <div className={styles.messageFooter}>{authFooterText}</div>
                  )}

                  {/* Template buttons preview */}
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

                  {/* Auth Button (Copy Code / Autofill) */}
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
          <button
            onClick={() =>
              router.push(`/user/manage/templates/phone/${phoneId}`)
            }
            className={styles.backButton}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className={styles.pageTitle}>Edit Template</h1>
        </div>
        <TemplateForm
          initialData={initialData}
          onSubmit={handleSubmit}
          loading={updateMutation?.isPending}
          mode="EDIT"
          renderPreview={renderPreview}
        />
      </div>
    </div>
  );
}
