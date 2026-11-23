"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Shield,
  Key,
  Globe,
  BookOpen,
  Zap,
  AlertCircle,
  Music,
  Video,
  MapPin,
  Activity,
  FileArchive,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Tab = "overview" | "authentication" | "api-reference";

interface Endpoint {
  id: string;
  method: "POST" | "GET" | "PUT" | "DELETE";
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const endpoints: Endpoint[] = [
  // Status
  {
    id: "get-message-status",
    method: "GET",
    label: "Get Message Status",
    description: "Retrieve the delivery/read status of a sent message by its ID",
    icon: <Activity size={16} />,
    category: "STATUS",
  },
  // Text Messages
  {
    id: "send-text",
    method: "POST",
    label: "Send Text Message",
    description: "Send a simple text message to a WhatsApp number",
    icon: <MessageSquare size={16} />,
    category: "TEXT MESSAGES",
  },
  // Media Messages
  {
    id: "send-image-id",
    method: "POST",
    label: "Send Image Message",
    description: "Send an image message using a media ID",
    icon: <ImageIcon size={16} />,
    category: "MEDIA MESSAGES",
  },
  {
    id: "send-document",
    method: "POST",
    label: "Send Document Message",
    description: "Send a document/file using a media ID",
    icon: <FileArchive size={16} />,
    category: "MEDIA MESSAGES",
  },
  {
    id: "send-audio",
    method: "POST",
    label: "Send Audio Message",
    description: "Send an audio file using a media ID",
    icon: <Music size={16} />,
    category: "MEDIA MESSAGES",
  },
  {
    id: "send-video",
    method: "POST",
    label: "Send Video Message",
    description: "Send a video file using a media ID",
    icon: <Video size={16} />,
    category: "MEDIA MESSAGES",
  },
  // Template Messages
  {
    id: "send-template-text",
    method: "POST",
    label: "Send Template Message - Basic Text",
    description: "Send a plain-text pre-approved template message",
    icon: <FileText size={16} />,
    category: "TEMPLATE MESSAGES",
  },
  {
    id: "send-template-image",
    method: "POST",
    label: "Send Template Message - With Header Image",
    description: "Send a template message with an image header",
    icon: <ImageIcon size={16} />,
    category: "TEMPLATE MESSAGES",
  },
  {
    id: "send-template-video",
    method: "POST",
    label: "Send Template Message - With Header Video",
    description: "Send a template message with a video header",
    icon: <Video size={16} />,
    category: "TEMPLATE MESSAGES",
  },
  {
    id: "send-template-location",
    method: "POST",
    label: "Send Template Message - With Header Location",
    description: "Send a template message with a location header",
    icon: <MapPin size={16} />,
    category: "TEMPLATE MESSAGES",
  },
];

const METHOD_COLORS: Record<string, string> = {
  POST: "bg-primary text-primary-foreground",
  GET: "bg-success text-white",
  PUT: "bg-warning text-white",
  DELETE: "bg-destructive text-white",
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${METHOD_COLORS[method] ?? "bg-muted text-foreground"}`}
    >
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <div className="bg-muted dark:bg-muted/40 rounded-xl px-4 py-3 font-mono text-sm overflow-x-auto flex items-center justify-between gap-2 border border-border">
        <code className="text-primary-text font-semibold text-xs">{code}</code>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border p-5 shadow-xs ${className}`}>
      {children}
    </div>
  );
}

function EnvVar({
  name,
  description,
  example,
  link,
  linkLabel,
}: {
  name: string;
  description: string;
  example: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <SectionCard>
      <div className="mb-2">
        <span className="inline-block text-[11px] font-mono font-bold bg-muted text-foreground px-2 py-0.5 rounded-md border border-border">
          {name}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <CodeBlock code={example} />
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 ml-4 shrink-0"
          >
            {linkLabel ?? "Get it here"}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────
// Tab Content
// ─────────────────────────────────────────────
function OverviewContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">WhatsApp Messaging API</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Send WhatsApp messages including text, media, and templates through a REST API. Examples
          below use a generic domain — replace it with your own panel domain.
        </p>
      </div>

      {/* Base URL */}
      <SectionCard>
        <h2 className="text-base font-bold text-primary mb-1">Base URL</h2>
        <p className="text-xs text-muted-foreground mb-3">Example domain used throughout this documentation</p>
        <CodeBlock code="https://Subdomain.domain.com/v1/admin/api" />
      </SectionCard>

      {/* Postman Collection */}
      <SectionCard>
        <h2 className="text-base font-bold text-foreground mb-1">Postman Collection</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Import a Postman collection to test the API endpoints quickly
        </p>
        <div className="flex items-center justify-between bg-background rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">View Postman Collection</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Import this collection into Postman to get started quickly
            </p>
          </div>
          <a
            href="https://www.postman.com/your-workspace/whatsapp-messaging-api/collection/your-collection-id"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center px-4 py-2 !bg-primary hover:!bg-primary/90 !text-white text-xs font-bold rounded-xl transition-colors shadow-sm no-underline"
          >
            View Collection
          </a>
        </div>
      </SectionCard>

      {/* Environment Variables */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-1">Environment Variables</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Required variables for API authentication and configuration
        </p>
        <div className="space-y-4">
          <EnvVar
            name="BASE_URL"
            description="Your API base URL — used as the root for all endpoint calls"
            example="https://Subdomain.domain.com"
          />
          <EnvVar
            name="PHONE_NUMBER_ID"
            description="Your WhatsApp Business phone number ID — included in message request bodies"
            example="{{PHONE_NUMBER_ID}}"
            linkLabel="Get your Phone Number ID"
          />
        </div>
      </div>

      {/* Quick Start */}
      <SectionCard className="bg-gradient-to-br from-primary/10 to-success/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Quick Start</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              1. Obtain your API key from the developer settings panel.<br />
              2. Set the <code className="bg-muted px-1 rounded text-primary text-[11px]">BASE_URL</code>, <code className="bg-muted px-1 rounded text-primary text-[11px]">API_KEY</code>, and <code className="bg-muted px-1 rounded text-primary text-[11px]">PHONE_NUMBER_ID</code> environment variables.<br />
              3. Make your first POST request to send a text message.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AuthenticationContent() {
  const curlExample = `curl --request GET \\
  --url 'https://Subdomain.domain.com/api/v2/whatsapp-business/status/wamid.EXAMPLE' \\
  --header 'Authorization: Bearer your_api_key_here'`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Authentication</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          All API requests require authentication using a Bearer token in the Authorization header.
          You can also pass the key as a{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">token</code>{" "}
          or{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">access_token</code>{" "}
          query parameter.
        </p>
      </div>

      {/* Required Headers — table-style rows */}
      <SectionCard>
        <h2 className="text-sm font-bold text-foreground mb-4">Required Headers</h2>
        <div className="space-y-2">
          {[
            { key: "Authorization", value: "Bearer {{API_KEY}}" },
            { key: "Content-Type",  value: "application/json"  },
          ].map((h) => (
            <div
              key={h.key}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-background border border-border"
            >
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono font-semibold text-foreground">{h.key}</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary text-primary-foreground">
                  Required
                </span>
              </div>
              <code className="text-xs font-mono text-muted-foreground">{h.value}</code>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Example curl block */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">Example</h2>
          <CopyButton text={curlExample} />
        </div>
        <div className="bg-muted dark:bg-muted/40 rounded-xl border border-border px-4 py-3 font-mono text-xs text-primary-text overflow-x-auto whitespace-pre">
          {curlExample}
        </div>
      </SectionCard>

      {/* Security Notice */}
      <SectionCard className="border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Security Notice</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Never commit your API key to version control or share it publicly. Rotate your key
              immediately if you suspect it has been compromised.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Error Responses */}
      <SectionCard>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Error Responses</h2>
        </div>
        <div className="space-y-2">
          {[
            { code: "401", message: "Unauthorized — Invalid or missing API key" },
            { code: "403", message: "Forbidden — Insufficient permissions" },
            { code: "429", message: "Too Many Requests — Rate limit exceeded" },
          ].map((err) => (
            <div key={err.code} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-background border border-border">
              <span className="text-xs font-mono font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg">
                {err.code}
              </span>
              <span className="text-xs text-muted-foreground">{err.message}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ApiReferenceContent({ selectedEndpoint }: { selectedEndpoint: Endpoint }) {

  // ── Real endpoint paths (relative to BASE_URL) ──────────────────────────
  const endpointPaths: Record<string, string> = {
    "get-message-status":    "v1/api/messages/status/{{Message-id}}",
    "send-text":             "v1/api/messages/send",
    "send-image-id":         "v1/api/messages/send",
    "send-document":         "v1/api/messages/send",
    "send-audio":            "v1/api/messages/send",
    "send-video":            "v1/api/messages/send",
    "send-template-text":    "v1/api/messages/send",
    "send-template-image":   "v1/api/messages/send",
    "send-template-video":   "v1/api/messages/send",
    "send-template-location":"v1/api/messages/send",
  };

  // ── Real request bodies from Postman screenshots ─────────────────────────
  const bodyExamples: Record<string, string> = {
    "send-text": `{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "recipient_type": "individual",
  "type": "text",
  "text": {
    "body": "hii"
  }
}`,

    "send-image-id": `{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "image",
  "image": {
    "link": "{{document_url}}"
  }
}`,

    "send-document": `{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "document",
  "document": {
    "link": "{{document_url}}"
  }
}`,

    "send-audio": `{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "audio",
  "audio": {
    "link": "{{audio_url}}"
  }
}`,

    "send-video": `{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "video",
  "video": {
    "link": "{{video_url}}"
  }
}`,

    "send-template-text": `{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "stemp_06",
    "language": "en_US",
    "components": []
  }
}`,

    "send-template-image": `{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "crm_updtaes",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "link": "https://example.com/promo-image.jpg"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}`,

    "send-template-video": `{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "crm_updtaes",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "video",
            "video": {
              "link": "https://example.com/promo-image.jpg"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}`,

    "send-template-location": `{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "{{template_name}}",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "location",
            "location": {
              "latitude": "19.0760",
              "longitude": "72.8777",
              "name": "Mumbai",
              "address": "Mumbai, Maharashtra, India"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}`,
  };

  // ── cURL snippets matching Postman Code Snippet view ─────────────────────
  const curlExamples: Record<string, string> = {
    "get-message-status":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/status/{{Message-id}}' \\
--header 'Authorization: Bearer {{api_key}}' \\
--data ''`,

    "send-text":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "recipient_type": "individual",
  "type": "text",
  "text": {
    "body": "hii"
  }
}'`,

    "send-image-id":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "image",
  "image": {
    "link": "{{document_url}}"
  }
}'`,

    "send-document":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "document",
  "document": {
    "link": "{{document_url}}"
  }
}'`,

    "send-audio":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "audio",
  "audio": {
    "link": "{{audio_url}}"
  }
}'`,

    "send-video":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "messaging_product": "whatsapp",
  "phone_number_id": "{{phone_number_id}}",
  "to": "{country-code}{phone number}",
  "type": "video",
  "video": {
    "link": "{{video_url}}"
  }
}'`,

    "send-template-text":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "stemp_06",
    "language": "en_US",
    "components": []
  }
}
'`,

    "send-template-image":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "crm_updtaes",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "link": "https://example.com/promo-image.jpg"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}'`,

    "send-template-video":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "crm_updtaes",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "video",
            "video": {
              "link": "https://example.com/promo-image.jpg"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}'`,

    "send-template-location":
`curl --location --globoff '{{BASE_URL}}/v1/api/messages/send' \\
--header 'Authorization: Bearer {{api_key}}' \\
--header 'Content-Type: application/json' \\
--data '{
  "phone_number_id": "{{PHONE_NUMBER_ID}}",
  "to": "{country-code}{phone number}",
  "type": "template",
  "template": {
    "name": "{{template_name}}",
    "language": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "location",
            "location": {
              "latitude": "19.0760",
              "longitude": "72.8777",
              "name": "Mumbai",
              "address": "Mumbai, Maharashtra, India"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "User"
          },
          {
            "type": "text",
            "text": "32"
          },
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "5"
          }
        ]
      }
    ]
  }
}'`,
  };

  const relativePath = endpointPaths[selectedEndpoint.id] ?? "";
  const fullUrl = `https://Subdomain.domain.com/${relativePath}`;
  const body    = bodyExamples[selectedEndpoint.id] ?? "";
  const curl    = curlExamples[selectedEndpoint.id] ?? "";
  const isGet   = selectedEndpoint.method === "GET";

  const sampleResponse = isGet
    ? `{
  "id": "wamid.xxxxxxxxxxxxxxxxxxxx",
  "status": "delivered",
  "timestamp": "1716000000",
  "recipient_id": "{country-code}{phone number}"
}`
    : `{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "{country-code}{phone number}",
      "wa_id": "{country-code}{phone number}"
    }
  ],
  "messages": [
    {
      "id": "wamid.xxxxxxxxxxxxxxxxxxxx"
    }
  ]
}`;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <MethodBadge method={selectedEndpoint.method} />
          <h1 className="text-xl font-bold text-foreground">{selectedEndpoint.label}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{selectedEndpoint.description}</p>
      </div>

      {/* Endpoint URL */}
      <SectionCard>
        <h2 className="text-sm font-bold text-primary mb-2">Endpoint</h2>
        <CodeBlock code={fullUrl} />
      </SectionCard>

      {/* Headers */}
      <SectionCard>
        <h2 className="text-sm font-bold text-foreground mb-3">Required Headers</h2>
        <div className="space-y-2">
          {[
            { key: "Authorization", value: "Bearer {{api_key}}" },
            ...(!isGet ? [{ key: "Content-Type", value: "application/json" }] : []),
          ].map((h) => (
            <div key={h.key} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background border border-border">
              <code className="text-xs text-primary font-mono font-semibold">{h.key}</code>
              <span className="text-muted-foreground text-xs">→</span>
              <code className="text-xs text-success font-mono">{h.value}</code>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Request Body — hidden for GET */}
      {!isGet && body && (
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Body</h2>
              <span className="text-[10px] text-muted-foreground">raw (json)</span>
            </div>
            <CopyButton text={body} />
          </div>
          <div className="bg-muted dark:bg-muted/40 rounded-xl border border-border p-4 font-mono text-xs text-primary-text overflow-x-auto whitespace-pre">
            {body}
          </div>
        </SectionCard>
      )}

      {/* cURL Code Snippet */}
      {curl && (
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Code Snippet</h2>
              <span className="text-[10px] text-muted-foreground">cURL</span>
            </div>
            <CopyButton text={curl} />
          </div>
          <div className="bg-muted dark:bg-muted/40 rounded-xl border border-border p-4 font-mono text-xs text-primary-text overflow-x-auto whitespace-pre">
            {curl}
          </div>
        </SectionCard>
      )}

      {/* Sample Response */}
      <SectionCard>
        <h2 className="text-sm font-bold text-foreground mb-3">Sample Response</h2>
        <div className="bg-muted dark:bg-muted/40 rounded-xl border border-border p-4 font-mono text-xs text-primary-text overflow-x-auto whitespace-pre">
          {sampleResponse}
        </div>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Left Panel
// ─────────────────────────────────────────────
function DocSidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (ep: Endpoint) => void;
}) {
  const categories = Array.from(new Set(endpoints.map((e) => e.category)));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <aside className="w-64 shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <h2 className="text-base font-bold text-foreground">WhatsApp API</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Comprehensive API documentation</p>
      </div>

      {/* Endpoint Groups */}
      <nav className="flex-1 p-3 space-y-1">
        {categories.map((cat) => {
          const items = endpoints.filter((e) => e.category === cat);
          const isOpen = !collapsed[cat];
          return (
            <div key={cat}>
              <button
                onClick={() => toggle(cat)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors"
              >
                {cat}
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {isOpen && (
                <ul className="space-y-0.5 mt-1 mb-2">
                  {items.map((ep) => {
                    const isActive = ep.id === selectedId;
                    return (
                      <li key={ep.id}>
                        <button
                          onClick={() => onSelect(ep)}
                          className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <MethodBadge method={ep.method} />
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : ""}`}>
                              {ep.label}
                            </p>
                            <p className={`text-[10px] mt-0.5 leading-snug line-clamp-2 ${isActive ? "text-white/80" : "text-muted-foreground"}`}>
                              {ep.description}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function WhatsAppApiDocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BookOpen size={14} /> },
    { id: "authentication", label: "Authentication", icon: <Shield size={14} /> },
    { id: "api-reference", label: "API Reference", icon: <Zap size={14} /> },
  ];

  const handleEndpointSelect = (ep: Endpoint) => {
    setSelectedEndpoint(ep);
    setActiveTab("api-reference");
  };

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      {/* Left Doc Sidebar */}
      <DocSidebar selectedId={selectedEndpoint.id} onSelect={handleEndpointSelect} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Bar */}
        <div className="border-b border-border px-6 pt-4 pb-0 bg-background shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {activeTab === "overview" && <OverviewContent />}
            {activeTab === "authentication" && <AuthenticationContent />}
            {activeTab === "api-reference" && (
              <ApiReferenceContent selectedEndpoint={selectedEndpoint} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}