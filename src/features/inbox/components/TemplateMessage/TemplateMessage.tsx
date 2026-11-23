/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React from "react";
import { ExternalLink, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./TemplateMessage.module.css";

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  example?: {
    header_handle?: string[];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
    parameters?: any[];
  }>;
  parameters?: Array<{
    type?: string;
    text?: string;
    image?: {
      id?: string;
      link?: string;
    };
  }>;
}

interface TemplateMessageProps {
  components: TemplateComponent[];
  className?: string;
  mediaUrl?: string | null;
  phoneNumberId?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  contentPayload?: any;
}

export const TemplateMessage: React.FC<TemplateMessageProps> = ({
  components,
  className = "",
  mediaUrl,
  phoneNumberId,
  templateName,
  templateLanguage,
  contentPayload,
}) => {
  if (!components || !Array.isArray(components)) {
    return null;
  }

  const normalized = components.map((component) => ({
    ...component,
    type: String(component.type || "").toUpperCase(),
  }));

  const headerComponent = normalized.find((c) => c.type === "HEADER");
  const bodyComponent = normalized.find((c) => c.type === "BODY");
  const footerComponent = normalized.find((c) => c.type === "FOOTER");
  const buttonsComponent = normalized.find((c) => c.type === "BUTTONS");

  const getReplacedText = (text: string, parameters: any[]) => {
    if (!text) return "";
    if (!parameters || parameters.length === 0) return text;
    let replaced = text;
    parameters.forEach((param, index) => {
      const val = typeof param === "object" ? param?.text || "" : String(param);
      const placeholder = `{{${index + 1}}}`;
      replaced = replaced.split(placeholder).join(val);
    });
    return replaced;
  };

  const bodyText = bodyComponent?.text || "";
  const bodyParameters =
    bodyComponent?.parameters
      ?.map((p) => p?.text)
      .filter((value): value is string => Boolean(value && String(value).trim())) || [];

  const resolvedBodyText = bodyText
    ? getReplacedText(bodyText, bodyComponent?.parameters || [])
    : "";

  const headerParameterLines =
    headerComponent?.parameters
      ?.map((param) => {
        const paramType = String(param?.type || "").toLowerCase();
        if (paramType === "image") {
          const imageId = param?.image?.id ? `id: ${param.image.id}` : "";
          const imageLink = param?.image?.link ? `link: ${param.image.link}` : "";
          return [imageId, imageLink].filter(Boolean).join(" | ") || "image";
        }
        return param?.text?.trim() || "";
      })
      .filter((value): value is string => Boolean(value && value.trim())) || [];

  const footerText =
    footerComponent?.text ||
    footerComponent?.parameters
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join(" | ");

  const headerText =
    headerComponent?.text ||
    headerComponent?.parameters
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join(" | ");

  const resolvedHeaderText = headerComponent?.text
    ? getReplacedText(headerComponent.text, headerComponent.parameters || [])
    : headerText;

  const headerImageUrl =
    ((headerComponent?.format || "").toUpperCase() === "IMAGE" ||
      headerComponent?.parameters?.some((p) => p?.image?.link || p?.image?.id)) &&
    (headerComponent?.parameters?.find((p) => p?.image?.link)?.image?.link ||
      headerComponent?.parameters?.find((p) => p?.image?.id)?.image?.id ||
      headerComponent?.example?.header_handle?.[0] ||
      mediaUrl);

  const hasHeaderImageParam =
    !!headerComponent?.parameters?.some((p) => p?.image?.link || p?.image?.id);

  const cachedHeaderImageUrl = React.useMemo(() => {
    if (!headerImageUrl || typeof window === "undefined") return null;
    if (/^https?:\/\//i.test(headerImageUrl)) return null;

    try {
      const raw = localStorage.getItem("wa_template_media_preview_map");
      const map = raw ? JSON.parse(raw) : {};
      const cached = map[String(headerImageUrl)];
      return typeof cached === "string" && cached.trim() ? cached : null;
    } catch {
      return null;
    }
  }, [headerImageUrl]);

  const resolvedHeaderImageUrl = (() => {
    if (!headerImageUrl) return null;
    if (/^https?:\/\//i.test(headerImageUrl)) return headerImageUrl;
    if (cachedHeaderImageUrl) return cachedHeaderImageUrl;
    if (headerImageUrl === mediaUrl) return headerImageUrl;
    if (hasHeaderImageParam && phoneNumberId) {
      return `/api/user/whatsapp/media/${encodeURIComponent(headerImageUrl)}?phoneNumberId=${encodeURIComponent(phoneNumberId)}`;
    }
    return null;
  })();

const cleanTemplateMetadata = (text: string): string => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?|Category|Status|Namespace|Template\s*ID):\s*[^\r\n]*(?:\r?\n|$))+/gim, "")
    .replace(/^(?:\s*(?:Template(?:\s*Name)?|Language(?:\s*Code)?):\s*[^\s\n\r|]+(?:\s*\|\s*|\s*,\s*|\s+)?)+/gi, "")
    .trim();
};

  return (
    <div className={cn(styles.message, className)}>
      {/* Header - Image or Text */}
      {headerComponent && (
        <div>
          {resolvedHeaderImageUrl ? (
            <img
              src={resolvedHeaderImageUrl}
              alt="Template header"
              className={styles.headerImage}
              onClick={() => window.open(resolvedHeaderImageUrl, "_blank")}
            />
          ) : resolvedHeaderText ? (
            <div className={styles.headerText}>{cleanTemplateMetadata(resolvedHeaderText)}</div>
          ) : null}

          {!headerImageUrl && !resolvedHeaderText && headerParameterLines.length > 0 ? (
            <div className={styles.body}>
              {headerParameterLines.map((value, index) => (
                <div key={`${value}-${index}`}>{cleanTemplateMetadata(value)}</div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Body */}
      {resolvedBodyText && (
        <div className={styles.body}>
          {cleanTemplateMetadata(resolvedBodyText)}
        </div>
      )}

      {!resolvedBodyText && bodyParameters.length > 0 ? (
        <div className={styles.body}>
          {bodyParameters.map((value, index) => (
            <div key={`${value}-${index}`}>{cleanTemplateMetadata(value)}</div>
          ))}
        </div>
      ) : null}

      {/* Footer */}
      {footerText && (
        <div className={styles.footer}>
          {cleanTemplateMetadata(footerText)}
        </div>
      )}

      {/* Buttons */}
      {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
        <div className={styles.buttons}>
          {buttonsComponent.buttons.map((button, index) => {
            const resolvedButtonUrl = button.type === "URL" && button.url
              ? getReplacedText(button.url, button.parameters || [])
              : button.url || button.phone_number || "#";

            return (
              <a
                key={index}
                href={resolvedButtonUrl}
                className={styles.button}
                target={button.type === "URL" ? "_blank" : undefined}
                rel={button.type === "URL" ? "noopener noreferrer" : undefined}
              >
                {button.type === "PHONE_NUMBER" && <Phone size={14} />}
                {button.type === "URL" && <ExternalLink size={14} />}
                {button.text}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};