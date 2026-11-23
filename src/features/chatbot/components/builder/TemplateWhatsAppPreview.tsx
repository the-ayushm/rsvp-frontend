/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import FormattedText from "@/features/templates/components/FormattedText";

interface TemplateWhatsAppPreviewProps {
  components: any[];
  variables?: Record<string, string>;
  className?: string;
}

/** Substitute {{varName}} with variable values */
function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  if (!text || !variables) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
    const key = varName.trim();
    return variables[key] ?? `{{${key}}}`;
  });
}

/** WhatsApp-style template preview with variable substitution */
export function TemplateWhatsAppPreview({
  components,
  variables = {},
  className = "",
}: TemplateWhatsAppPreviewProps) {
  if (!components || !Array.isArray(components)) return null;

  return (
    <div className={`template-whatsapp-preview ${className}`}>
      <div className="twp-bubble">
        {components.map((component: any, idx: number) => {
          if (component.type === "HEADER") {
            if (component.format === "TEXT" && component.text) {
              const text = substituteVariables(component.text, variables);
              return (
                <div key={idx} className="twp-header-text">
                  {text}
                </div>
              );
            }
            if (
              component.format === "IMAGE" &&
              component.example?.header_handle?.[0]
            ) {
              return (
                <div key={idx} className="twp-header-media">
                  <img
                    src={component.example.header_handle[0]}
                    alt="Header"
                    className="twp-header-img"
                  />
                </div>
              );
            }
            if (
              component.format === "IMAGE" ||
              component.format === "VIDEO" ||
              component.format === "DOCUMENT"
            ) {
              return (
                <div key={idx} className="twp-header-media twp-placeholder">
                  {component.format === "IMAGE" && "🖼️ Image"}
                  {component.format === "VIDEO" && "🎬 Video"}
                  {component.format === "DOCUMENT" && "📄 Document"}
                </div>
              );
            }
            return null;
          }
          if (component.type === "BODY" && component.text) {
            const text = substituteVariables(component.text, variables);
            return (
              <div key={idx} className="twp-body">
                <FormattedText text={text} />
              </div>
            );
          }
          if (component.type === "FOOTER" && component.text) {
            const text = substituteVariables(component.text, variables);
            return (
              <div key={idx} className="twp-footer">
                {text}
              </div>
            );
          }
          if (component.type === "BUTTONS" && component.buttons?.length) {
            return (
              <div key={idx} className="twp-buttons">
                {component.buttons.map((btn: any, bidx: number) => (
                  <div key={bidx} className="twp-btn">
                    {btn.type === "PHONE_NUMBER" && "📞 "}
                    {btn.type === "URL" && "🔗 "}
                    {btn.text}
                  </div>
                ))}
              </div>
            );
          }
          return null;
        })}
        <div className="twp-time">Now</div>
      </div>
    </div>
  );
}
