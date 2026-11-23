/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Layout,
  CornerUpRight,
  Smartphone,
} from "lucide-react";
import "../../whatsapp-flows.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useRouter } from "next/navigation";
// --- TYPES ---
// Meta WhatsApp Flows: TextInput, TextArea, RadioButtonsGroup, Dropdown, CheckboxGroup, DatePicker
type FieldType =
  | "text"
  | "number"
  | "date"
  | "textarea"
  | "radio"
  | "dropdown"
  | "checkbox";

interface FieldOption {
  value: string;
  label: string;
}

interface Field {
  id: string;
  label: string;
  type: FieldType;
  instructions: string;
  required: boolean;
  maxLength?: number;
  options?: FieldOption[];
  minSelected?: number;
  maxSelected?: number;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  textarea: "Text area (long)",
  radio: "Radio (single choice)",
  dropdown: "Dropdown",
  checkbox: "Checkbox (multi)",
};

interface Notification {
  message: string;
  type: "success" | "error" | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- COMPONENTS ---

const NotificationToast = ({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) => {
  if (!notification.type) return null;

  const isSuccess = notification.type === "success";
  const icon = isSuccess ? (
    <CheckCircle className="w-5 h-5 text-primary-text" />
  ) : (
    <XCircle className="w-5 h-5 text-error" />
  );
  const colorClass = isSuccess
    ? "bg-surface border-primary dark:bg-surface-hover dark:border-primary-soft"
    : "bg-error-bg border-error-border dark:bg-error-bg/20 dark:border-error-border";

  return (
    <div
      className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl flex items-center space-x-3 border ${colorClass} z-50`}
    >
      {icon}
      <p
        className={`text-sm font-medium ${isSuccess ? "text-primary-text dark:text-primary-text" : "text-error dark:text-error"}`}
      >
        {notification.message}
      </p>
      <button
        onClick={onClose}
        className="p-1 rounded-full text-muted-foreground hover:bg-surface-active dark:hover:bg-surface-active"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

const InputGroup = ({
  label,
  value,
  onChange,
  placeholder,
  instructions,
  maxChars,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  placeholder?: string;
  instructions?: string;
  maxChars?: number;
  type?: "text" | "textarea";
}) => {
  const charCount = value.length;
  const isOverLimit = maxChars !== undefined && charCount > maxChars;
  const InputComponent = type === "textarea" ? "textarea" : "input";

  return (
    <div>
      <div className="flex justify-between items-end">
        <label className="block text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
          {label}
        </label>
        {maxChars !== undefined && (
          <span
            className={`text-xs ${isOverLimit ? "text-error font-semibold" : "text-muted-foreground dark:text-muted-foreground"}`}
          >
            {charCount}/{maxChars}
          </span>
        )}
      </div>
      <InputComponent
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxChars}
        rows={type === "textarea" ? 3 : undefined}
        className={`w-full border ${isOverLimit ? "border-error" : "border-border-strong dark:border-border"} px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition ${type === "textarea" ? "resize-none" : ""} bg-surface dark:bg-surface-raised text-foreground dark:text-foreground`}
      />
      {instructions && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
          {instructions}
        </p>
      )}
    </div>
  );
};

const FieldListItem = ({
  field,
  index,
  onDelete,
  onUpdate,
}: {
  field: Field;
  index: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, upd: Partial<Field>) => void;
}) => {
  const needsOptions =
    field.type === "radio" ||
    field.type === "dropdown" ||
    field.type === "checkbox";
  const options = field.options?.length
    ? field.options
    : [{ value: "", label: "" }];

  return (
    <div className="p-4 bg-surface dark:bg-surface-raised rounded-lg border border-border dark:border-border space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-mono text-xs text-muted-foreground dark:text-muted-foreground shrink-0">
            {index + 1}.
          </span>
          <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdate(field.id, { label: e.target.value })}
              placeholder="Field label"
              className="w-full border border-border-strong dark:border-border rounded-md px-2 py-1.5 text-sm bg-surface dark:bg-surface-raised"
            />
            <select
              value={field.type}
              onChange={(e) =>
                onUpdate(field.id, { type: e.target.value as FieldType })
              }
              className="w-full border border-border-strong dark:border-border rounded-md px-2 py-1.5 text-sm bg-surface dark:bg-surface-raised"
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1 text-xs text-secondary-foreground dark:text-muted-foreground">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) =>
                onUpdate(field.id, { required: e.target.checked })
              }
              className="rounded"
            />
            Required
          </label>
          <button
            type="button"
            onClick={() => onDelete(field.id)}
            className="p-1.5 text-error hover:bg-error-bg dark:hover:bg-error-bg/20 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {field.type === "textarea" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground dark:text-muted-foreground">
            Max length
          </label>
          <input
            type="number"
            min={1}
            max={4096}
            value={field.maxLength ?? 600}
            onChange={(e) =>
              onUpdate(field.id, {
                maxLength: parseInt(e.target.value, 10) || 600,
              })
            }
            className="w-20 border border-border-strong dark:border-border rounded-md px-2 py-1 text-sm"
          />
        </div>
      )}
      {needsOptions && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-secondary-foreground dark:text-muted-foreground">
            Options (id / label)
          </span>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={opt.value}
                onChange={(e) => {
                  const next = [...(field.options || [])];
                  if (!next[i]) next[i] = { value: "", label: "" };
                  next[i] = { ...next[i], value: e.target.value };
                  onUpdate(field.id, { options: next });
                }}
                placeholder="value"
                className="flex-1 border border-border-strong dark:border-border rounded-md px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={opt.label}
                onChange={(e) => {
                  const next = [...(field.options || [])];
                  if (!next[i]) next[i] = { value: "", label: "" };
                  next[i] = { ...next[i], label: e.target.value };
                  onUpdate(field.id, { options: next });
                }}
                placeholder="label"
                className="flex-1 border border-border-strong dark:border-border rounded-md px-2 py-1 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onUpdate(field.id, {
                options: [...(field.options || []), { value: "", label: "" }],
              })
            }
            className="text-xs text-[var(--color-primary)] dark:text-primary-text hover:underline"
          >
            + Add option
          </button>
        </div>
      )}
      {field.instructions !== undefined && (
        <input
          type="text"
          value={field.instructions}
          onChange={(e) => onUpdate(field.id, { instructions: e.target.value })}
          placeholder="Helper text (optional)"
          className="w-full border border-border-strong dark:border-border rounded-md px-2 py-1 text-sm"
        />
      )}
    </div>
  );
};

/** WhatsApp-style live preview: matches in-app flow UI (X, title "1 of 2", radio, textarea with counter, gray Continue, green Learn more) */
const ScreenPreview = ({
  screenTitle,
  largeHeading,
  textContent,
  footerButtonLabel,
  fields,
  currentScreenIndex = 1,
  totalScreens = 1,
}: {
  screenTitle: string;
  largeHeading: string;
  textContent: string;
  footerButtonLabel: string;
  fields: Field[];
  currentScreenIndex?: number;
  totalScreens?: number;
}) => (
  <div className="w-full whatsapp-flow-preview-wrap">
    <div className="whatsapp-flow-preview-label">
      <Smartphone className="w-4 h-4" />
      <span>As seen in WhatsApp</span>
      <span className="whatsapp-flow-preview-badge">Live</span>
    </div>
    <div className="whatsapp-flow-phone">
      <div className="whatsapp-flow-phone-screen">
        {/* Reference UI: X, title "Feedback 1 of 2", three dots */}
        <div className="wa-flow-header wa-flow-header-ref">
          <span className="wa-flow-header-close">✕</span>
          <span className="wa-flow-header-title">
            {screenTitle || "Screen title"}
            {totalScreens > 1
              ? ` ${currentScreenIndex} of ${totalScreens}`
              : ""}
          </span>
          <span className="wa-flow-header-menu">⋮</span>
        </div>
        <div className="wa-flow-content">
          <h1 className="wa-flow-heading">{largeHeading || "Heading"}</h1>
          {textContent ? <p className="wa-flow-body">{textContent}</p> : null}
          <div className="wa-flow-fields">
            {fields.map((field) => (
              <div key={field.id} className="wa-flow-field">
                <label className="wa-flow-field-label">
                  {field.label || "Field"}
                  {field.required && (
                    <span className="wa-flow-required"> *</span>
                  )}
                </label>
                {field.type === "radio" && (
                  <div className="wa-flow-radio-group">
                    <span className="wa-flow-choose-hint">Choose one</span>
                    {(field.options?.length
                      ? field.options
                      : [
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" },
                        ]
                    ).map((opt) => (
                      <label
                        key={opt.value || opt.label}
                        className="wa-flow-radio-option"
                      >
                        <input
                          type="radio"
                          name={field.id}
                          readOnly
                          className="wa-flow-radio-input"
                        />
                        <span>{opt.label || opt.value || "Option"}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.type === "dropdown" && (
                  <div className="wa-flow-input wa-flow-dropdown">
                    {(field.options?.length
                      ? field.options
                      : [{ value: "", label: "Select..." }])[0]?.label ||
                      "Select..."}
                  </div>
                )}
                {field.type === "checkbox" && (
                  <div className="wa-flow-checkbox-group">
                    {(field.options?.length
                      ? field.options
                      : [
                          { value: "a", label: "Option A" },
                          { value: "b", label: "Option B" },
                        ]
                    ).map((opt) => (
                      <label
                        key={opt.value || opt.label}
                        className="wa-flow-checkbox-option"
                      >
                        <input
                          type="checkbox"
                          readOnly
                          className="wa-flow-checkbox-input"
                        />
                        <span>{opt.label || opt.value || "Option"}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.type === "textarea" && (
                  <>
                    <div className="wa-flow-textarea">
                      Leave a comment (optional)
                    </div>
                    <span className="wa-flow-char-count">
                      0 / {field.maxLength ?? 600}
                    </span>
                  </>
                )}
                {(field.type === "text" ||
                  field.type === "number" ||
                  field.type === "date") && (
                  <div className="wa-flow-input">
                    {field.type === "number"
                      ? "0"
                      : field.type === "date"
                        ? "DD/MM/YYYY"
                        : "Type here..."}
                  </div>
                )}
                {field.instructions ? (
                  <span className="wa-flow-helper">{field.instructions}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {/* Gray Continue when incomplete; green "Learn more" link */}
        <div className="wa-flow-footer">
          <button
            type="button"
            className="wa-flow-cta wa-flow-cta-disabled"
            disabled
          >
            {footerButtonLabel || "Continue"}
          </button>
          <p className="wa-flow-disclaimer">
            Managed by the business.{" "}
            <span className="wa-flow-learn-more">Learn more</span>
          </p>
        </div>
      </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---
export default function ScreenDesignerPage() {
  const searchParams = useSearchParams();
  const selectedBusiness = searchParams.get("businessId");

  const [screenTitle, setScreenTitle] = useState("Welcome to our form");
  const [largeHeading, setLargeHeading] = useState("Your Name");
  const [textContent, setTextContent] = useState(
    "Managed by the business. Learn more",
  );
  const [footerButtonLabel, setFooterButtonLabel] = useState("Continue");

  const [fields, setFields] = useState<Field[]>([
    {
      id: generateId(),
      label: "Your Name",
      type: "text",
      instructions: "",
      required: true,
    },
  ]);
  const [notification, setNotification] = useState<Notification>({
    message: "",
    type: null,
  });

  const addField = (type: FieldType = "text") => {
    const label =
      type === "radio"
        ? "Would you recommend us?"
        : type === "textarea"
          ? "Comments"
          : `Field ${fields.length + 1}`;
    const base: Field = {
      id: generateId(),
      label,
      type,
      instructions: "",
      required: false,
    };
    if (type === "radio" || type === "dropdown")
      base.options = [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ];
    if (type === "checkbox")
      base.options = [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ];
    if (type === "textarea") base.maxLength = 600;
    setFields([...fields, base]);
  };
  const deleteField = (id: string) =>
    setFields(fields.filter((f) => f.id !== id));
  const updateField = (id: string, upd: Partial<Field>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...upd } : f)));
  const router = useRouter();
  const handlePublishScreen = async () => {
    if (!screenTitle.trim() || !largeHeading.trim() || fields.length === 0) {
      setNotification({
        message: "Screen Title, Heading, and at least one field are required.",
        type: "error",
      });
      setTimeout(() => setNotification({ message: "", type: null }), 4000);
      return;
    }

    try {
      await soft7AxiosInstance.post("/api/user/whatsapp-flows/create", {
        businessId: selectedBusiness,
        name: `Flow - ${screenTitle}`,
        flowId: Math.random().toString(36).substring(2, 10),
        categories: "OTHER",
        publish: false,
        validation: JSON.stringify({
          screenTitle,
          largeHeading,
          textContent,
          footerButtonLabel,
          fields,
        }),
      });

      setNotification({
        message: `Flow '${screenTitle}' saved successfully!`,
        type: "success",
      });
      setTimeout(() => setNotification({ message: "", type: null }), 4000);
    } catch (error) {
      console.error(error);
      setNotification({
        message: "Failed to connect to the server",
        type: "error",
      });
      setTimeout(() => setNotification({ message: "", type: null }), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-surface font-sans relative flex">
      <NotificationToast
        notification={notification}
        onClose={() => setNotification({ message: "", type: null })}
      />

      <div className="w-full grid lg:grid-cols-3">
        <div className="lg:col-span-2 border-r border-border dark:border-border bg-surface dark:bg-surface-raised flex flex-col">
          {/* Header */}
          <header className="bg-surface dark:bg-surface-raised border-b border-border dark:border-border px-8 py-6 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center space-x-4">
              {/* ← Back Button */}
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 px-4 py-2 "
              >
                <CornerUpRight className="w-4 h-4 rotate-180" />
                <span>Back</span>
              </button>

              <h1 className="text-4xl font-extrabold text-foreground dark:text-foreground tracking-tight flex items-center">
                <Layout className="w-8 h-8 mr-3 text-foreground dark:text-foreground" />
                Screen Designer
              </h1>
            </div>

            <button
              onClick={handlePublishScreen}
              className="px-6 py-3 bg-primary hover:bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg flex items-center space-x-2 transition"
            >
              <CornerUpRight className="w-5 h-5" />
              <span>Publish Screen</span>
            </button>
          </header>

          {/* Scrollable Content */}
          <div className="p-8 space-y-8 flex-1">
            {/* Screen Config */}
            <div className="bg-surface dark:bg-surface-raised p-6 rounded-2xl shadow-xl border-t-4 border-primary space-y-5">
              <InputGroup
                label="Screen Title"
                value={screenTitle}
                onChange={(e) => setScreenTitle(e.target.value)}
                maxChars={60}
              />
              <InputGroup
                label="Large Heading"
                value={largeHeading}
                onChange={(e) => setLargeHeading(e.target.value)}
                maxChars={20}
              />
              <InputGroup
                label="Text Content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                maxChars={80}
                type="textarea"
              />
            </div>

            {/* Fields */}
            <div className="bg-surface dark:bg-surface-raised p-6 rounded-2xl shadow-xl border-t-4 border-border-strong">
              <h2 className="text-xl font-bold text-foreground dark:text-foreground mb-4">
                Fields ({fields.length})
              </h2>
              <div className="space-y-3">
                {fields.map((field, i) => (
                  <FieldListItem
                    key={field.id}
                    field={field}
                    index={i}
                    onDelete={deleteField}
                    onUpdate={updateField}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => addField(t)}
                    className="px-3 py-2 bg-primary-lighter dark:bg-primary-light/20 text-[var(--color-primary)] dark:text-primary-text rounded-lg border border-primary-soft dark:border-primary-soft text-sm font-medium hover:bg-primary-light dark:hover:bg-primary-light/30 transition"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />{" "}
                    {FIELD_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Button */}
            <div className="bg-surface dark:bg-surface-raised p-6 rounded-2xl shadow-xl border-t-4 border-primary mb-8">
              <InputGroup
                label="Footer Button Label"
                value={footerButtonLabel}
                onChange={(e) => setFooterButtonLabel(e.target.value)}
                maxChars={20}
              />
            </div>
          </div>
        </div>

        {/* Preview – sticky WhatsApp-style live preview */}
        <div className="lg:col-span-1 p-6 lg:p-8 bg-surface-muted dark:bg-surface lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground mb-3 flex items-center">
            <Smartphone className="w-5 h-5 mr-2 text-primary-text" />
            Live preview
          </h2>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
            How your form will look when customers open it in WhatsApp.
          </p>
          <ScreenPreview
            screenTitle={screenTitle}
            largeHeading={largeHeading}
            textContent={textContent}
            footerButtonLabel={footerButtonLabel}
            fields={fields}
            currentScreenIndex={1}
            totalScreens={1}
          />
        </div>
      </div>
    </div>
  );
}
