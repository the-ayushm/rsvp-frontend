/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";
 
import { useState } from "react";
import { Search, Plug, CheckCircle, Settings, ArrowRight, Puzzle } from "lucide-react";
import { useRouter } from "next/navigation";
import "./integrations.css";
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
    id: "3",
    name: "Facebook Messenger",
    description:
      "Chat with customers on Facebook Messenger directly from your dashboard for seamless support.",
    connected: false,
    logo: "/facebook-logo.jpg",
    path: "/",
    category: "flow",
  },
  {
    id: "4",
    name: "Instagram",
    description:
      "Sync data and trigger automations based on successful interactions.",
    connected: false,
    logo: "/instagram-logo.jpg",
    path: "/",
    category: "flow",
  },
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
  const [integrations] = useState(initialIntegrations);
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

      {/* Integrations Grid */}
      <div className="integrations-grid">
        {filteredIntegrations.length === 0 ? (
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
        ) : (
          filteredIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))
        )}
      </div>
    </div>
  );
} 