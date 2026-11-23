/**
 * Convert screens + blocks into WhatsApp Flow JSON (Meta Flows API).
 */

import type { FlowScreen, ContentBlock } from "./types";

// Field / component names: allow letters, digits and underscores.
function toFieldSlug(s: string): string {
  const base = s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+/, "");
  return (base || "FIELD").slice(0, 40);
}

// Screen IDs: Meta validation requires only alphabets and underscores and uniqueness.
// Generate IDs like SCREEN_A, SCREEN_B, ..., SCREEN_Z, SCREEN_AA, SCREEN_AB, ...
function toScreenId(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let n = index;
  let suffix = "";
  do {
    suffix = letters[n % 26] + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `SCREEN_${suffix}`;
}

function blockToMetaComponent(
  block: ContentBlock,
  fieldName?: string
): { kind: "heading" | "body" | "form" | "button"; payload: object } | null {
  switch (block.type) {
    case "heading":
      return { kind: "heading", payload: { type: "TextHeading", text: (block.text ?? block.label ?? "Heading").slice(0, 60) } };
    case "paragraph":
      return {
        kind: "form",
        payload: {
          type: "TextArea",
          name: fieldName || "FIELD",
          label: (block.label ?? "Comment").slice(0, 20),
          required: !!block.required,
          "max-length": block.maxLength ?? 600,
          ...(block.placeholder ? { "helper-text": block.placeholder.slice(0, 80) } : {}),
        },
      };
    case "button":
      return { kind: "button", payload: {} };
    case "text_input":
      return {
        kind: "form",
        payload: {
          type: "TextInput",
          name: fieldName || "FIELD",
          label: (block.label ?? "Text").slice(0, 80),
          required: !!block.required,
          "input-type": "text",
          "max-chars": block.maxLength ?? 80,
          ...(block.placeholder ? { "helper-text": block.placeholder.slice(0, 30) } : {}),
        },
      };
    case "number_input":
      return {
        kind: "form",
        payload: {
          type: "TextInput",
          name: fieldName || "FIELD",
          label: (block.label ?? "Number").slice(0, 80),
          required: !!block.required,
          "input-type": "number",
          "max-chars": 80,
          ...(block.placeholder ? { "helper-text": block.placeholder.slice(0, 30) } : {}),
        },
      };
    case "radio":
      return {
        kind: "form",
        payload: {
          type: "RadioButtonsGroup",
          name: fieldName || "FIELD",
          label: (block.label ?? "Choose one").slice(0, 30),
          required: !!block.required,
          "data-source": (block.options ?? []).map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
        },
      };
    case "dropdown":
      return {
        kind: "form",
        payload: {
          type: "Dropdown",
          name: fieldName || "FIELD",
          label: (block.label ?? "Select").slice(0, 20),
          required: !!block.required,
          "data-source": (block.options ?? []).map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
        },
      };
    case "checkbox":
      return {
        kind: "form",
        payload: {
          type: "CheckboxGroup",
          name: fieldName || "FIELD",
          label: (block.label ?? "Select").slice(0, 30),
          required: !!block.required,
          "data-source": (block.options ?? []).map((o) => ({ id: o.value.slice(0, 20), title: o.label.slice(0, 30) })),
          "min-selected-items": 0,
          "max-selected-items": 20,
        },
      };
    case "date":
      return {
        kind: "form",
        payload: {
          type: "DatePicker",
          name: fieldName || "FIELD",
          label: (block.label ?? "Date").slice(0, 80),
          required: !!block.required,
        },
      };
    default:
      return null;
  }
}

export function exportFlowJSON(screens: FlowScreen[], flowName: string = "My Flow"): string {
  const effectiveScreens = screens.length > 0 ? screens : [];

  const screenPayloads = effectiveScreens.map((screen, i) => {
    const screenId = toScreenId(i);
    const children: object[] = [];
    const formFields: object[] = [];
    let buttonLabel = "Continue";
    let fieldCounter = 0;

    for (const block of screen.blocks) {
      // Generate stable-ish field IDs: SCREENID_LABEL_RANDOM
      const baseLabel = block.label ?? block.text ?? block.type;
      const slug = toFieldSlug(baseLabel || "FIELD");
      const randomSuffix = Math.floor(Math.random() * 100000).toString();
      const fieldName = `${screenId}_${slug}_${randomSuffix}`.slice(0, 64);

      const result = blockToMetaComponent(
        block,
        ["heading", "button"].includes(block.type) ? undefined : fieldName
      );
      if (!result) continue;
      if (result.kind === "button") {
        buttonLabel = block.label ?? "Continue";
        continue;
      }
      if (result.kind === "heading" || result.kind === "body") children.push(result.payload);
      if (result.kind === "form") formFields.push(result.payload);
    }

    if (formFields.length) children.push({ type: "Form", name: "main_form", children: formFields });
    const isLast = i === effectiveScreens.length - 1;
    children.push({
      type: "Footer",
      label: buttonLabel.slice(0, 20),
      "on-click-action": isLast
        ? { name: "complete", payload: {} }
        : {
            name: "navigate",
            next: { type: "screen", name: toScreenId(i + 1) },
            payload: {},
          },
    });

    return {
      id: screenId,
      title: screen.title.slice(0, 60),
      terminal: false, // will be overridden for the last screen below
      data: {},
      layout: { type: "SingleColumnLayout", children },
    };
  });

  const flow = {
    version: "7.3",
    routing_model:
      screenPayloads.length > 0
        ? Object.fromEntries(
            screenPayloads.map((_, index) => {
              const id = toScreenId(index);
              const isLast = index === screenPayloads.length - 1;
              return [id, isLast ? [] : [toScreenId(index + 1)]];
            })
          )
        : undefined,
    screens: screenPayloads.length
      ? screenPayloads.map((s, index) => ({
          ...s,
          id: toScreenId(index),
          terminal: index === screenPayloads.length - 1,
          ...(index === screenPayloads.length - 1 ? { success: true } : {}),
        }))
      : [
          {
            id: "MAIN_SCREEN",
            title: flowName.slice(0, 60),
            terminal: true,
            success: true,
            data: {},
            layout: {
              type: "SingleColumnLayout",
              children: [
                { type: "TextHeading", text: "Welcome" },
                { type: "Footer", label: "Continue", "on-click-action": { name: "complete", payload: {} } },
              ],
            },
          },
        ],
  };

  return JSON.stringify(flow, null, 2);
}
