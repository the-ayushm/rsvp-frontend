"use client";

import type { ReactNode } from "react";
import { ExternalLink, Phone, Reply, Copy } from "lucide-react";
import FormattedText from "@/features/templates/components/FormattedText";
import styles from "../templates.module.css";

export interface TemplateCardButton {
  type: string;
  text: string;
}

interface TemplateCardProps {
  /** Media header (image / artwork / video placeholder). */
  media?: ReactNode;
  headerText?: string;
  body: string;
  footer?: string;
  buttons?: TemplateCardButton[];
  title: ReactNode;
  /** Badges shown under the title. */
  meta?: ReactNode;
  /** Primary CTA or action row shown at the bottom. */
  actions: ReactNode;
}

function ButtonIcon({ type }: { type: string }) {
  const size = 16;
  if (type === "PHONE_NUMBER") return <Phone size={size} />;
  if (type === "QUICK_REPLY") return <Reply size={size} />;
  if (type === "COPY_CODE" || type === "OTP") return <Copy size={size} />;
  return <ExternalLink size={size} />;
}

export default function TemplateCard({
  media,
  headerText,
  body,
  footer,
  buttons = [],
  title,
  meta,
  actions,
}: TemplateCardProps) {
  return (
    <div className="flex h-full flex-col items-center gap-3">
      {/* WhatsApp chat frame */}
      <div
        className={`${styles["whatsapp-preview"]} !min-h-0 flex w-full flex-1 flex-col gap-2 !rounded-2xl border border-border !p-3.5 shadow-sm transition-shadow hover:shadow-md`}
      >
        <div className="flex flex-1 flex-col rounded-xl bg-bubble-in p-2.5 shadow-sm">
          {media && <div className="mb-2.5 overflow-hidden rounded-lg">{media}</div>}
          {headerText && (
            <div className="mb-1.5 px-1 text-[15px] font-bold text-foreground">
              <FormattedText text={headerText} />
            </div>
          )}
          <div className="line-clamp-9 whitespace-pre-wrap break-words px-1 text-[14px] leading-relaxed text-foreground">
            <FormattedText text={body} />
          </div>
          {footer && (
            <div className="mt-1.5 px-1 text-xs text-muted-foreground">{footer}</div>
          )}
        </div>

        {buttons.map((btn, idx) => (
          <div
            key={idx}
            className="flex items-center justify-center gap-2 rounded-xl bg-bubble-in py-2.5 text-[15px] font-medium text-info shadow-sm"
          >
            <ButtonIcon type={btn.type} />
            <span className="truncate">{btn.text}</span>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-1.5 text-center">
        <h3 className="w-full truncate px-2 text-lg font-bold text-primary-text">{title}</h3>
        {meta && <div className="flex flex-wrap items-center justify-center gap-1.5">{meta}</div>}
      </div>

      {actions}
    </div>
  );
}
