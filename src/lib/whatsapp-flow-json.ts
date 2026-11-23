/**
 * Build Meta WhatsApp Flow JSON from our screen designer payload.
 * @see https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 * @see https://developers.facebook.com/docs/whatsapp/flows/reference/components
 */

export interface FlowScreenFieldOption {
  value: string;
  label: string;
}

export type FlowScreenFieldType =
  | "text"
  | "number"
  | "date"
  | "textarea"
  | "radio"
  | "dropdown"
  | "checkbox";

export interface FlowScreenField {
  id: string;
  label: string;
  type: FlowScreenFieldType;
  instructions?: string;
  required?: boolean;
  /** For textarea: max character length (default 600 per Meta). */
  maxLength?: number;
  /** For radio, dropdown, checkbox: list of options. Meta uses id + title. */
  options?: FlowScreenFieldOption[];
  /** For checkbox: min/max selected (Meta: min-selected-items, max-selected-items). */
  minSelected?: number;
  maxSelected?: number;
}

export interface FlowScreenConfig {
  screenTitle: string;
  largeHeading: string;
  textContent?: string;
  footerButtonLabel: string;
  fields: FlowScreenField[];
}

const DEFAULT_SCREEN_ID = "MAIN_SCREEN";

function toFlowName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 64) || "field";
}

/**
 * Build one form field component for Meta Flow JSON (Form children).
 */
function buildFormFieldComponent(f: FlowScreenField): Record<string, unknown> {
  const name = toFlowName(f.id || f.label);

  switch (f.type) {
    case "textarea": {
      return {
        type: "TextArea",
        name,
        label: (f.label || "Field").slice(0, 20),
        required: !!f.required,
        "max-length": String(f.maxLength ?? 600),
        ...(f.instructions?.trim() ? { "helper-text": f.instructions.slice(0, 80) } : {}),
      };
    }
    case "radio": {
      const options = f.options?.length ? f.options : [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
      return {
        type: "RadioButtonsGroup",
        name,
        label: (f.label || "Choose one").slice(0, 30),
        required: !!f.required,
        "data-source": options.map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
        ...(f.instructions?.trim() ? { description: f.instructions.slice(0, 300) } : {}),
      };
    }
    case "dropdown": {
      const options = f.options?.length ? f.options : [{ value: "option1", label: "Option 1" }, { value: "option2", label: "Option 2" }];
      return {
        type: "Dropdown",
        name,
        label: (f.label || "Select").slice(0, 20),
        required: !!f.required,
        "data-source": options.map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
        ...(f.instructions?.trim() ? { "helper-text": f.instructions.slice(0, 80) } : {}),
      };
    }
    case "checkbox": {
      const options = f.options?.length ? f.options : [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }];
      return {
        type: "CheckboxGroup",
        name,
        label: (f.label || "Select").slice(0, 30),
        required: !!f.required,
        "data-source": options.map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
        "min-selected-items": Math.max(0, f.minSelected ?? 0),
        "max-selected-items": Math.min(20, f.maxSelected ?? 20),
        ...(f.instructions?.trim() ? { description: f.instructions.slice(0, 300) } : {}),
      };
    }
    case "date":
      return {
        type: "DatePicker",
        name,
        label: (f.label || "Date").slice(0, 80),
        required: !!f.required,
        ...(f.instructions?.trim() ? { "helper-text": f.instructions.slice(0, 80) } : {}),
      };
    case "number":
      return {
        type: "TextInput",
        name,
        label: (f.label || "Field").slice(0, 80),
        required: !!f.required,
        "input-type": "number",
        "max-chars": "80",
        ...(f.instructions?.trim() ? { "helper-text": f.instructions.slice(0, 30) } : {}),
      };
    case "text":
    default:
      return {
        type: "TextInput",
        name,
        label: (f.label || "Field").slice(0, 80),
        required: !!f.required,
        "input-type": "text",
        "max-chars": "80",
        ...(f.instructions?.trim() ? { "helper-text": f.instructions.slice(0, 30) } : {}),
      };
  }
}

/**
 * Build Flow JSON (version 5.0) for a single-screen form with all supported field types.
 */
export function buildFlowJson(config: FlowScreenConfig, screenId: string = DEFAULT_SCREEN_ID): string {
  const children: object[] = [];

  children.push({
    type: "TextHeading",
    text: config.largeHeading.slice(0, 60),
  });

  if (config.textContent?.trim()) {
    children.push({
      type: "TextBody",
      text: config.textContent.slice(0, 1024),
    });
  }

  if (config.fields.length > 0) {
    const formFields = config.fields.map((f) => buildFormFieldComponent(f));
    children.push({
      type: "Form",
      name: "main_form",
      children: formFields,
    });
  }

  children.push({
    type: "Footer",
    label: (config.footerButtonLabel || "Complete").slice(0, 20),
    "on-click-action": {
      name: "complete",
      payload: {},
    },
  });

  const screen = {
    id: screenId,
    title: config.screenTitle.slice(0, 60),
    terminal: true,
    success: true,
    data: {},
    layout: {
      type: "SingleColumnLayout",
      children,
    },
  };

  const flow = {
    version: "5.0",
    screens: [screen],
  };

  return JSON.stringify(flow);
}
