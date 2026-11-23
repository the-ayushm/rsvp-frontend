"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCheck, MessageSquareReply, RefreshCw, Send } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Skeleton from "@/components/ui/Skeleton";
import { ActionItems } from "../../components/ActionItems";
import { ActivityFeed } from "../../components/ActivityFeed";
import { AudienceCard } from "../../components/AudienceCard";
import { AutomationCard } from "../../components/AutomationCard";
import { CampaignPerformanceCard } from "../../components/CampaignPerformanceCard";
import { ConversationHealthCard } from "../../components/ConversationHealthCard";
import { DeliveryHealth } from "../../components/Insights";
import { KpiCard, KpiCardSkeleton } from "../../components/KpiCard";
import { MessageActivityChart } from "../../components/MessageActivityChart";
import { QuickActions } from "../../components/QuickActions";
import { useDashboardData } from "../../hooks/useDashboardData";
import { TIME_FRAMES, TimeFrame, timeFrameLabel } from "../../types";
import {
  actionItems,
  campaignPerformance,
  computeTrends,
  conversationHealth,
  conversationQueue,
  deriveMetrics,
  formatCompact,
  importedInWindow,
  recentActivity,
} from "../../utils/metrics";
import styles from "./DashboardScreen.module.css";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Executive overview, top to bottom:
 *   1. headline KPIs with trends  — "how is messaging performing?"
 *   2. conversations + campaigns  — "who is waiting / are broadcasts landing?"
 *   3. attention, activity, actions — "what needs me, what happened, what next?"
 *   4. audience + automation      — "how big is my reach, what runs itself?"
 *   5. detailed analytics          — status breakdown for the period
 */
export function DashboardScreen() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("7days");
  const data = useDashboardData(timeFrame);
  const periodLabel = timeFrameLabel(timeFrame);

  const [firstName, setFirstName] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    setHour(new Date().getHours());
    try {
      const user = JSON.parse(localStorage.getItem("user_data") || "null");
      if (user?.name) setFirstName(String(user.name).split(" ")[0]);
    } catch {
      /* no stored profile */
    }
  }, []);

  const metrics = useMemo(() => (data.stats.data ? deriveMetrics(data.stats.data) : null), [data.stats.data]);
  const longer = useMemo(() => (data.compareStats.data ? deriveMetrics(data.compareStats.data) : null), [data.compareStats.data]);
  const trends = useMemo(() => (metrics ? computeTrends(timeFrame, metrics, longer) : null), [metrics, longer, timeFrame]);

  const health = useMemo(() => (data.conversations.data ? conversationHealth(data.conversations.data) : null), [data.conversations.data]);
  const queue = useMemo(() => (data.conversations.data ? conversationQueue(data.conversations.data) : []), [data.conversations.data]);
  const campaigns = data.campaigns.data?.items;
  const performance = useMemo(() => (campaigns ? campaignPerformance(campaigns, timeFrame) : null), [campaigns, timeFrame]);
  const imported = useMemo(
    () => (data.contactLists.data ? importedInWindow(data.contactLists.data, timeFrame) : null),
    [data.contactLists.data, timeFrame],
  );

  const alerts = useMemo(
    () =>
      actionItems({
        metrics,
        frameLabel: periodLabel,
        phoneNumbers: data.phoneNumbers.data,
        templates: data.templates.data,
        campaigns,
        plan: data.plan.data,
        conversations: health,
      }),
    [metrics, periodLabel, data.phoneNumbers.data, data.templates.data, campaigns, data.plan.data, health],
  );
  const alertsLoading = [data.stats, data.phoneNumbers, data.templates, data.campaigns, data.plan].some((q) => q.isLoading);

  const activity = useMemo(
    () =>
      recentActivity({
        campaigns,
        contactLists: data.contactLists.data,
        templates: data.templates.data,
        conversations: data.conversations.data,
        chatbots: data.chatbots.data,
      }),
    [campaigns, data.contactLists.data, data.templates.data, data.conversations.data, data.chatbots.data],
  );
  const activityLoading = [data.campaigns, data.contactLists, data.templates].some((q) => q.isLoading);

  const noNumbers = data.phoneNumbers.isSuccess && data.phoneNumbers.data.length === 0;
  const conversationsLoading = data.phoneNumbers.isLoading || (data.conversations.isLoading && !noNumbers);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>{hour === null ? "Overview" : `${greeting(hour)}${firstName ? `, ${firstName}` : ""}`}</p>
          <h1 className={styles.title}>Your WhatsApp business today</h1>
          <p className={styles.subtitle}>
            {periodLabel}
            {data.lastUpdated && (
              <>
                {" · "}Updated {data.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </>
            )}
          </p>
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            aria-label="Date range"
            value={timeFrame}
            onChange={setTimeFrame}
            options={TIME_FRAMES.map((t) => ({ value: t.value, label: t.short }))}
          />
          <IconButton
            aria-label="Refresh data"
            variant="outlined"
            disabled={data.isFetching}
            icon={<RefreshCw size={16} className={data.isFetching ? "animate-spin" : ""} />}
            onClick={data.refresh}
          />
        </div>
      </header>

      {data.stats.isError && !metrics && (
        <Alert
          variant="error"
          title="Unable to load message statistics"
          message={
            <span className="flex flex-wrap items-center gap-3">
              The other sections below load independently.
              <Button size="sm" variant="secondary" onClick={data.refresh}>
                Try again
              </Button>
            </span>
          }
          className="mb-4"
        />
      )}

      {/* 1 — Headline KPIs */}
      <section className={styles.kpis} aria-label="Key metrics">
        {!metrics ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Messages sent"
              value={formatCompact(metrics.totalMessages)}
              icon={<Send size={17} />}
              trend={trends?.messages}
              hint={`${metrics.sent.toLocaleString()} still in transit`}
            />
            <KpiCard
              label="Delivery rate"
              value={`${metrics.deliveryRate}%`}
              icon={<CheckCheck size={17} />}
              tone={metrics.statusTotal > 0 && metrics.deliveryRate < 50 ? "warning" : "success"}
              meter={{ value: metrics.deliveryRate, label: "delivery rate" }}
              trend={trends?.deliveryRate}
              hint={`${metrics.delivered.toLocaleString()} delivered`}
            />
            <KpiCard
              label="Replies received"
              value={formatCompact(metrics.received)}
              icon={<MessageSquareReply size={17} />}
              trend={trends?.received}
              hint={`${metrics.replyRate}% of message volume`}
            />
            <KpiCard
              label="Failed"
              value={formatCompact(metrics.failed)}
              icon={<AlertTriangle size={17} />}
              tone="error"
              meter={{ value: metrics.failureRate, label: "failure rate" }}
              trend={trends?.failureRate}
              hint={`${metrics.failureRate}% failure rate`}
            />
          </>
        )}
      </section>

      {/* 2 — Conversations + campaigns */}
      <div className={`${styles.grid} ${styles.split}`}>
        <ConversationHealthCard health={health} queue={queue} loading={conversationsLoading} noNumbers={noNumbers} />
        <CampaignPerformanceCard
          performance={performance}
          total={data.campaigns.data?.total ?? null}
          loading={data.campaigns.isLoading}
          periodLabel={periodLabel}
        />
      </div>

      {/* 3 — Attention · activity · actions */}
      <div className={`${styles.grid} ${styles.thirds}`}>
        <ActionItems items={alerts} loading={alertsLoading} />
        <ActivityFeed events={activity} loading={activityLoading} />
        <QuickActions />
      </div>

      {/* 4 — Audience + automation */}
      <div className={`${styles.grid} ${styles.halves}`}>
        <AudienceCard metrics={metrics} reachedTrend={trends?.reached} imported={imported} periodLabel={periodLabel} />
        <AutomationCard chatbots={data.chatbots.data} templates={data.templates.data} campaigns={campaigns} />
      </div>

      {/* 5 — Detailed analytics */}
      <h2 className={styles.sectionTitle}>Detailed analytics</h2>
      <div className={`${styles.grid} ${styles.wide}`}>
        <Card>
          <CardHeader icon={BarChart3} title="Message activity" description={`Volume by status — ${periodLabel.toLowerCase()}`} />
          <div className={styles.chartBox}>
            {metrics ? <MessageActivityChart metrics={metrics} /> : <Skeleton className="h-full w-full" />}
          </div>
        </Card>
        <Card>
          <CardHeader icon={CheckCheck} title="Delivery breakdown" description="How outbound messages landed" />
          {metrics ? <DeliveryHealth metrics={metrics} /> : <Skeleton className="h-48 w-full" />}
        </Card>
      </div>
    </div>
  );
}
