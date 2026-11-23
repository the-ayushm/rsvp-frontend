/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";
 
import { useEffect, useState } from "react";
import { Search, Plug, CheckCircle, Settings, ArrowRight, Puzzle } from "lucide-react";
import { useRouter } from "next/navigation";
import "../../integrations.css";
import { googleSheetsApi } from "../../google-sheets/api";
import { shopifyApi } from "../../shopify/api";
import { flowsApi } from "@/features/flows/automation/api";
import { facebookApi } from "../../facebook/api";
type Integration = {
  path: any;
  id: string;
  name: string;
  description: string;
  connected: boolean;
  logo?: string;
  category?: "featured" | "flow";
  buttonType?: "connect" | "configure" | "setup";
  
};
 
// Featured: messaging and lead channels. Flows: apps used inside flow automations.
const initialIntegrations: Integration[] = [
  {
    id: "1",
    name: "WhatsApp Business",
    description:
      "Connect with customers on their favorite messaging app. Send updates, support messages, and more directly through WhatsApp.",
    connected: true,
    logo: "/whatsapp-logo.jpg",
    path: "/whatsapp",
    category: "featured",
  },
  {
    id: "facebook-lead-ads",
    name: "Facebook Lead Ads",
    description: "Connect your Facebook Pages and lead forms to import leads directly into your dashboard.",
    connected: false,
    logo: "/facebook-logo.jpg",
    path: "facebook",
    category: "featured",
  },
  {
    id: "facebook-messenger",
    name: "Facebook Messenger",
    description:
      "Chat with customers on Facebook Messenger directly from your dashboard for seamless support.",
    connected: false,
    logo: "/facebook-logo.jpg",
    path: "facebook?feature=messaging",
    category: "featured",
  },
  {
    id: "4",
    name: "Instagram",
    description:
      "Sync data and trigger automations based on successful interactions.",
    connected: false,
    logo: "/instagram-logo.jpg",
    path: "/",
    category: "featured",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description:
      "Connect any Google account to read and add spreadsheet rows from your flow automations.",
    connected: false,
    logo: "/google-sheet-logo.jpg",
    path: "google-sheets",
    category: "flow",
  },
  {
    id: "shopify",
    name: "Shopify",
    description:
      "Connect your Shopify stores to trigger flows and WhatsApp updates on orders, customers and checkouts.",
    connected: false,
    logo: "/shopify-logo.svg",
    path: "shopify",
    category: "flow",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    description:
      "Connect your Razorpay accounts to create payment links in flows and send them to customers on WhatsApp.",
    connected: false,
    logo: "/razorpay-logo.svg",
    path: "razorpay",
    category: "flow",
  },
];
 
const SECTIONS: { category: NonNullable<Integration["category"]>; title: string }[] = [
  { category: "featured", title: "Featured" },
  { category: "flow", title: "Flows" },
];

// --- Card Component ---
const IntegrationCard = ({ integration }: { integration: Integration }) => {
  const router = useRouter();
  const isConnected = integration.connected;
 
  const buttonText = integration.buttonType === "setup" 
    ? "Setup" 
    : integration.buttonType === "configure" 
    ? "Configure" 
    : "Connect";

  return (
    <div
      key={integration.id}
      className={`integration-card ${isConnected ? 'integration-card--connected' : ''}`}
    >
      {/* Status Badge (only when connected) */}
      {isConnected && (
        <div className="status-badge">
          <CheckCircle className="w-3 h-3" />
          Active
        </div>
      )}

      {/* Logo */}
      {integration.logo ? (
        <img
          src={integration.logo}
          alt={integration.name}
          className="integration-logo"
        />
      ) : (
        <div className="integration-logo-placeholder">
          <Plug className="w-6 h-6" />
        </div>
      )}
 
      {/* Title & Description */}
      <h2 className="integration-title">
        {integration.name}
      </h2>
      <p className="integration-description">
        {integration.description}
      </p>
 
      {/* Action Buttons */}
      <div className="integration-actions">
        <button  onClick={() => {
            if (integration.id === "1") {
              // WhatsApp - open embedded signup
              router.push("/user/signup-embedded");
            } else if (integration.id === "facebook-lead-ads") {
              router.push(`/user/integrations/facebook${isConnected ? "" : "?connect=1"}`);
            } else if (integration.id === "facebook-messenger") {
              router.push(`/user/integrations/facebook?feature=messaging${isConnected ? "" : "&connect=1"}`);
            } else if (["google-sheets", "shopify", "razorpay"].includes(integration.id)) {
              router.push(`/user/integrations/${integration.path}`);
            }
            // Other integrations can be handled here
          }} 
          className="btn-connect">
          <ArrowRight className="w-4 h-4" />
          {buttonText}
        </button>
        <button
          onClick={() => router.push(`/user/integrations/${integration.path}`)}
          className="btn-manage"
        >
          <Settings className="w-4 h-4" />
          Manage
        </button>
      </div>
    </div>
  );
};
 
// --- Main Page ---
export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [integrations, setIntegrations] = useState(initialIntegrations);

  // Live connection status for Google Sheets and Shopify (account owners only; others just see "Connect").
  useEffect(() => {
    let alive = true;
    ([["leads", "facebook-lead-ads"], ["messaging", "facebook-messenger"]] as const).forEach(([feature, id]) => {
      facebookApi.pages(feature).then((pages) => {
        const connected = pages.some((p) => p.status === "connected");
        if (alive) setIntegrations((list) => list.map((i) => i.id === id
          ? { ...i, connected, buttonType: connected ? "configure" : "connect" }
          : i));
      }).catch(() => undefined);
    });
    googleSheetsApi
      .connection()
      .then((c) => {
        if (alive) setIntegrations((list) => list.map((i) => (i.id === "google-sheets" ? { ...i, connected: c.connected, buttonType: c.connected ? "configure" : "connect" } : i)));
      })
      .catch(() => undefined);
    shopifyApi
      .connections()
      .then((list) => {
        const connected = list.some((c) => ["connected", "active"].includes(c.status.toLowerCase()));
        if (alive) setIntegrations((all) => all.map((i) => (i.id === "shopify" ? { ...i, connected, buttonType: connected ? "configure" : "connect" } : i)));
      })
      .catch(() => undefined);
    flowsApi
      .connections()
      .then((list) => {
        const connected = list.some((c) => c.appKey === "razorpay" && ["connected", "active"].includes(String(c.status).toLowerCase()));
        if (alive) setIntegrations((all) => all.map((i) => (i.id === "razorpay" ? { ...i, connected, buttonType: connected ? "configure" : "connect" } : i)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const [showConnected, setShowConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "featured" | "flows">("all");

  const filteredIntegrations = integrations.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConnected = !showConnected || i.connected;
    const matchesTab = activeTab === "all" || 
                       (activeTab === "featured" && i.category === "featured") ||
                       (activeTab === "flows" && i.category === "flow");
    
    return matchesSearch && matchesConnected && matchesTab;
  });

  return (
    <div className="integrations-page">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-accent shrink-0" />
          <span>App Marketplace</span>
        </h1>
      </header>

      {/* Search & Filters */}
      <div className="search-filter-container">
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-checkbox">
          <input
            type="checkbox"
            id="connected-filter"
            checked={showConnected}
            onChange={(e) => setShowConnected(e.target.checked)}
            className="checkbox-input"
          />
          <label htmlFor="connected-filter" className="checkbox-label">
            Show only Connected Apps (
            {integrations.filter((i) => i.connected).length})
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          onClick={() => setActiveTab("all")}
          className={`tab-button ${activeTab === "all" ? "tab-button--active" : ""}`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("featured")}
          className={`tab-button ${activeTab === "featured" ? "tab-button--active" : ""}`}
        >
          Featured
        </button>
        <button
          onClick={() => setActiveTab("flows")}
          className={`tab-button ${activeTab === "flows" ? "tab-button--active" : ""}`}
        >
          Flows
        </button>
      </div>

      {filteredIntegrations.length === 0 ? (
        <div className="integrations-grid">
          <div className="empty-state">
            <p className="empty-state-text">
              No integrations match your search or filter criteria. 😕
            </p>
            {(searchQuery || showConnected) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowConnected(false);
                }}
                className="clear-filters-btn"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        SECTIONS.map(({ category, title }) => {
          const items = filteredIntegrations.filter((i) => i.category === category);
          if (!items.length) return null;
          return (
            <section key={category} aria-labelledby={`integrations-${category}`} className="mb-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id={`integrations-${category}`} className="text-lg font-semibold text-foreground">{title}</h2>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length} app{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="integrations-grid">
                {items.map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
