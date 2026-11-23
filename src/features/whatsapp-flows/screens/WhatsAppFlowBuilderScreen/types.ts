/**
 * WhatsApp Flow Builder — data types.
 * screens[].blocks[] with type, text (heading), label, required, options, etc.
 */

export type BlockType =
  | "heading"
  | "paragraph"
  | "text_input"
  | "number_input"
  | "radio"
  | "dropdown"
  | "checkbox"
  | "date"
  | "button";

export interface BlockOption {
  value: string;
  label: string;
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  /** Heading text, paragraph body, or field/button label */
  text?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: BlockOption[];
  maxLength?: number;
}

export interface FlowScreen {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  text_input: "Text Input",
  number_input: "Number Input",
  radio: "Radio",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  button: "Button",
};

/** Add Content dropdown groups */
export const ADD_CONTENT_GROUPS: { group: string; types: BlockType[] }[] = [
  { group: "Text", types: ["heading", "paragraph"] },
  { group: "Inputs", types: ["text_input", "number_input", "date"] },
  { group: "Selection", types: ["radio", "dropdown", "checkbox"] },
  { group: "Action", types: ["button"] },
];

const id = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function createBlock(type: BlockType): ContentBlock {
  const block: ContentBlock = { id: id(), type };
  switch (type) {
    case "heading":
      block.text = "Your Name";
      break;
    case "paragraph":
      block.text = "Paragraph text";
      block.placeholder = "Leave a comment (optional)";
      block.maxLength = 600;
      break;
    case "text_input":
      block.label = "Your Name";
      block.placeholder = "Enter text...";
      block.maxLength = 80;
      break;
    case "number_input":
      block.label = "Number";
      block.placeholder = "0";
      break;
    case "radio":
      block.label = "Choose one";
      block.options = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
      break;
    case "dropdown":
      block.label = "Select";
      block.options = [{ value: "opt1", label: "Option 1" }, { value: "opt2", label: "Option 2" }];
      break;
    case "checkbox":
      block.label = "Select options";
      block.options = [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }];
      break;
    case "date":
      block.label = "Date";
      break;
    case "button":
      block.label = "Continue";
      break;
  }
  return block;
}

export function createScreen(index: number, title?: string): FlowScreen {
  return {
    id: `screen_${Date.now()}`,
    title: title ?? `Screen ${index + 1}`,
    blocks: [],
  };
}

export function getBlockDisplayText(block: ContentBlock): string {
  if (block.type === "heading") return block.text ?? block.label ?? "Heading";
  const t = block.label ?? block.text ?? block.type;
  return t.length > 32 ? t.slice(0, 29) + "..." : t;
}
