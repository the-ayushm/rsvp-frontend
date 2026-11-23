"use client";

import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useEffect, useState } from "react";

interface DashboardStats {
  campaigns_count: string;
  chatbot_count: string;
  contacts_count: string;
  contact_lists_count: string;
  sent_count: string;
  failed_count: string;
  delivered_count: string;
  received_count: string;
  total_count: string;
  message_template_count: string;
  unique_contacts_count: string;
  templates_count: string;
  total_messages: number;
}

interface LeadSourcesBreakdownProps {
  timeframe?: '7days' | '1month' | '6months' | '1year' | 'all';
  data?: DashboardStats | null;
  isLoading?: boolean;
}

const getSourceColor = (source: string): string => {
  const colorMap: Record<string, string> = {
    campaigns: "#E07A5F",
    contacts: "#C79224",
    messages: "#C85A32",
    templates: "#7B3754",
    chatbots: "#9D4EDD",
    delivered: "#5E8B75",
    failed: "#C0392B",
    received: "#739E82",
    sent: "#C85A32",
  };
  return colorMap[source.toLowerCase()] || "#766D64";
};

const getProgressBarColor = (rate: number): string => {
  if (rate > 50) return "#5E8B75"; // Sage
  if (rate > 25) return "#C79224"; // Mustard
  return "#C0392B"; // Warm Destructive
};

/** Shared motion keyframes/utility classes, scoped to this component tree. */
const BreakdownAnimations = () => (
  <style jsx global>{`
    @keyframes lsbFadeInUp {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes lsbFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes lsbGrowBar {
      from { width: 0%; }
    }
    @keyframes lsbPopIn {
      0% { opacity: 0; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }
    .lsb-fade-in-up {
      opacity: 0;
      animation: lsbFadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .lsb-fade-in {
      opacity: 0;
      animation: lsbFadeIn 0.4s ease-out forwards;
    }
    .lsb-pop-in {
      opacity: 0;
      animation: lsbPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .lsb-tab-panel {
      animation: lsbFadeIn 0.35s ease-out forwards;
    }
    .lsb-row {
      transition: background-color 0.25s ease, transform 0.25s ease;
    }
    .lsb-row:hover {
      transform: translateX(2px);
    }
    @media (prefers-reduced-motion: reduce) {
      .lsb-fade-in-up, .lsb-fade-in, .lsb-pop-in, .lsb-tab-panel {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `}</style>
);

export function LeadSourcesBreakdown({
  timeframe = '7days',
  data = null,
  isLoading: externalLoading = false,
}: LeadSourcesBreakdownProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'contacts'>('overview');

  const getTimeFrameLabel = (frame: string) => {
    switch (frame) {
      case '7days': return 'Last 7 Days';
      case '1month': return 'Last Month';
      case '6months': return 'Last 6 Months';
      case '1year': return 'Last Year';
      case 'all': return 'All Time';
      default: return frame;
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: result } = await soft7AxiosInstance.get(
        `/admin/users/stats?time_frame=${timeframe}`
      );

      if (result?.success && result?.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalLoading) return;

    // DashboardPage already fetches the same stats endpoint. Reuse that
    // response here so both sections always display the exact same API data.
    if (data) {
      setStats(data);
      setLoading(false);
      return;
    }

    fetchStats();
  }, [data, timeframe, externalLoading]);

  const isLoading = externalLoading || loading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <BreakdownAnimations />
        <div className="text-center lsb-fade-in">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[var(--border)] border-t-[var(--terracotta)] mb-3"></div>
          <p className="text-[var(--muted-foreground)] text-sm">
            Loading {getTimeFrameLabel(timeframe).toLowerCase()} data...
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center py-12">
        <BreakdownAnimations />
        <div className="text-center lsb-fade-in">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-[var(--muted-foreground)]">No data available</p>
        </div>
      </div>
    );
  }

  const sent = Number(stats.sent_count) || 0;
  const delivered = Number(stats.delivered_count) || 0;
  const failed = Number(stats.failed_count) || 0;
  const received = Number(stats.received_count) || 0;
  const totalCount = Number(stats.total_count) || 0;
  const totalMessages = Number(stats.total_messages) || 0;
  const contacts = Number(stats.contacts_count) || 0;
  const contactLists = Number(stats.contact_lists_count) || 0;
  const campaigns = Number(stats.campaigns_count) || 0;
  const templates = Number(stats.templates_count) || 0;
  const chatbots = Number(stats.chatbot_count) || 0;
  const uniqueContacts = Number(stats.unique_contacts_count) || 0;
  const messageTemplates = Number(stats.message_template_count) || 0;

  // total_count is the API's status-count denominator. Using sent_count
  // here produces impossible rates when sent_count is only one status subset.
  const deliveryRate = totalCount > 0
    ? Math.min(100, Math.round((delivered / totalCount) * 1000) / 10)
    : 0;
  const failRate = totalCount > 0
    ? Math.min(100, Math.round((failed / totalCount) * 1000) / 10)
    : 0;
  const receiveRate = totalCount > 0
    ? Math.min(100, Math.round((received / totalCount) * 1000) / 10)
    : 0;

  const messageRows = [
    { label: 'Total Messages', value: totalMessages, color: getSourceColor('messages'), rate: 100 },
    { label: 'Sent', value: sent, color: getSourceColor('sent'), rate: totalCount > 0 ? Math.round((sent / totalCount) * 1000) / 10 : 0 },
    { label: 'Delivered', value: delivered, color: getSourceColor('delivered'), rate: deliveryRate },
    { label: 'Received', value: received, color: getSourceColor('received'), rate: receiveRate },
    { label: 'Failed', value: failed, color: getSourceColor('failed'), rate: failRate },
  ];

  const contactRows = [
    { label: 'Total Contacts', value: contacts, color: getSourceColor('contacts'), rate: 100 },
    { label: 'Unique Contacts', value: uniqueContacts, color: '#C85A32', rate: contacts > 0 ? Math.min(100, Math.round((uniqueContacts / contacts) * 100)) : 0 },
    { label: 'Contact Lists', value: contactLists, color: '#7B3754', rate: 100 },
  ];

  const totalPlatform = (campaigns + templates + messageTemplates + chatbots) || 1;
  const platformRows = [
    { label: 'Campaigns', value: campaigns, color: getSourceColor('campaigns'), rate: Math.round((campaigns / totalPlatform) * 1000) / 10 },
    { label: 'Templates', value: templates, color: getSourceColor('templates'), rate: Math.round((templates / totalPlatform) * 1000) / 10 },
    { label: 'Message Templates', value: messageTemplates, color: '#C79224', rate: Math.round((messageTemplates / totalPlatform) * 1000) / 10 },
    { label: 'Chatbots', value: chatbots, color: getSourceColor('chatbots'), rate: Math.round((chatbots / totalPlatform) * 1000) / 10 },
  ];

  const renderTable = (rows: { label: string; value: number; color: string; rate: number }[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Metric</th>
            <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Count</th>
            <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="lsb-row lsb-fade-in-up border-b border-[var(--border)] hover:bg-[var(--paper-2)]/60"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              <td className="py-3.5 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-[var(--foreground)] font-medium text-sm">{row.label}</span>
                </div>
              </td>
              <td className="py-3.5 px-6">
                <span className="font-display text-[var(--foreground)] font-bold text-base md:text-lg">
                  {row.value.toLocaleString()}
                </span>
              </td>
              <td className="py-3.5 px-6">
                <div className="flex flex-col gap-1">
                  <div className="w-40 bg-[var(--paper-2)] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${row.rate}%`,
                        backgroundColor: getProgressBarColor(row.rate),
                        animation: `lsbGrowBar 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.06}s backwards`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">{row.rate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full">
      <BreakdownAnimations />

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'overview'
              ? 'border-[var(--terracotta)] text-[var(--terracotta)] font-semibold'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          🚀 Platform Overview
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'messages'
              ? 'border-[var(--terracotta)] text-[var(--terracotta)] font-semibold'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          💬 Message Breakdown
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'contacts'
              ? 'border-[var(--terracotta)] text-[var(--terracotta)] font-semibold'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          👥 Contact Breakdown
        </button>
      </div>

      {/* Timeframe indicator */}
      <div className="mb-4 text-right lsb-fade-in">
        <span className="text-xs text-[var(--muted-foreground)] bg-[var(--paper-2)] border border-[var(--border)] px-2.5 py-1 rounded-lg">
          Showing data for: {getTimeFrameLabel(timeframe)}
        </span>
      </div>

      {activeTab === 'overview' && (
        <div key="overview" className="lsb-tab-panel">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Campaigns', value: campaigns, icon: '🚀', color: 'bg-[var(--terracotta)]/10 border-[var(--terracotta)]/30', text: 'text-[var(--terracotta)]' },
              { label: 'Templates', value: templates, icon: '📄', color: 'bg-[var(--plum)]/10 border-[var(--plum)]/30', text: 'text-[var(--plum)]' },
              { label: 'Chatbots', value: chatbots, icon: '🤖', color: 'bg-[var(--sage)]/10 border-[var(--sage)]/30', text: 'text-[var(--sage)]' },
              { label: 'Msg Templates', value: messageTemplates, icon: '📋', color: 'bg-[var(--mustard)]/10 border-[var(--mustard)]/30', text: 'text-[var(--mustard)]' },
            ].map((item, i) => (
              <div
                key={i}
                className={`lsb-pop-in rounded-xl border p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-xs ${item.color}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className={`font-display text-2xl font-bold ${item.text}`}>{item.value.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {renderTable(platformRows)}
        </div>
      )}

      {activeTab === 'messages' && (
        <div key="messages" className="lsb-tab-panel">
          {/* Message summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total', value: totalMessages, icon: '💬', color: 'bg-[var(--card)] border-[var(--border)]', text: 'text-[var(--foreground)]' },
              { label: 'Delivered', value: delivered, icon: '✅', color: 'bg-[var(--sage)]/10 border-[var(--sage)]/30', text: 'text-[var(--sage)]' },
              { label: 'Received', value: received, icon: '📥', color: 'bg-[var(--mustard)]/10 border-[var(--mustard)]/30', text: 'text-[var(--mustard)]' },
              { label: 'Failed', value: failed, icon: '❌', color: 'bg-[var(--destructive)]/10 border-[var(--destructive)]/30', text: 'text-[var(--destructive)]' },
            ].map((item, i) => (
              <div
                key={i}
                className={`lsb-pop-in rounded-xl border p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-xs ${item.color}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className={`font-display text-2xl font-bold ${item.text}`}>{item.value.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {renderTable(messageRows)}

          {/* Delivery rate summary */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="lsb-fade-in-up" style={{ animationDelay: '0.35s' }}>
                <p className="font-display text-2xl font-bold text-[var(--sage)]">{deliveryRate}%</p>
                <p className="text-xs text-[var(--muted-foreground)]">Delivery Rate</p>
              </div>
              <div className="lsb-fade-in-up" style={{ animationDelay: '0.42s' }}>
                <p className="font-display text-2xl font-bold text-[var(--mustard)]">{receiveRate}%</p>
                <p className="text-xs text-[var(--muted-foreground)]">Receive Rate</p>
              </div>
              <div className="lsb-fade-in-up" style={{ animationDelay: '0.49s' }}>
                <p className="font-display text-2xl font-bold text-[var(--destructive)]">{failRate}%</p>
                <p className="text-xs text-[var(--muted-foreground)]">Failure Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div key="contacts" className="lsb-tab-panel">
          {/* Contact summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Contacts', value: contacts, icon: '👥', color: 'bg-[var(--mustard)]/10 border-[var(--mustard)]/30', text: 'text-[var(--mustard)]' },
              { label: 'Unique Contacts', value: uniqueContacts, icon: '👤', color: 'bg-[var(--terracotta)]/10 border-[var(--terracotta)]/30', text: 'text-[var(--terracotta)]' },
              { label: 'Contact Lists', value: contactLists, icon: '📋', color: 'bg-[var(--plum)]/10 border-[var(--plum)]/30', text: 'text-[var(--plum)]' },
            ].map((item, i) => (
              <div
                key={i}
                className={`lsb-pop-in rounded-xl border p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-xs ${item.color}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className={`font-display text-2xl font-bold ${item.text}`}>{item.value.toLocaleString()}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {renderTable(contactRows)}

          {/* Unique contact reach summary card */}
          <div className="mt-6 p-4 rounded-xl bg-[var(--paper-2)] border border-[var(--border)] flex items-center justify-between lsb-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div>
              <h4 className="font-semibold text-sm text-[var(--foreground)]">Unique Contact Reach</h4>
              <p className="text-xs text-[var(--muted-foreground)]">Ratio of unique contacts reached to total database contacts</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-[var(--terracotta)]">
                {contacts > 0 && contacts >= uniqueContacts
                  ? `${Math.round((uniqueContacts / contacts) * 100)}%`
                  : '100%'}
              </p>
              <p className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Reach Coverage</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}