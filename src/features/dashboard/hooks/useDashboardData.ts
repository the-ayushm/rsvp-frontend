"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  fetchCampaigns,
  fetchChatbots,
  fetchContactLists,
  fetchConversations,
  fetchPhoneNumbers,
  fetchPlan,
  fetchStats,
  fetchTemplates,
} from "../services/dashboardApi";
import type { TimeFrame } from "../types";
import { comparisonFrame } from "../utils/metrics";

const REFRESH_MS = 5 * 60 * 1000;
const common = { staleTime: 60 * 1000, refetchInterval: REFRESH_MS, retry: 1 } as const;

/**
 * Every data source behind the dashboard. Each resource loads (and fails)
 * independently, so one slow or broken endpoint never blanks the whole page.
 */
export function useDashboardData(timeFrame: TimeFrame) {
  const queryClient = useQueryClient();
  const compareFrame = comparisonFrame(timeFrame);

  const stats = useQuery({ queryKey: ["dashboard", "stats", timeFrame], queryFn: () => fetchStats(timeFrame), ...common });
  const compareStats = useQuery({
    queryKey: ["dashboard", "stats", compareFrame],
    queryFn: () => fetchStats(compareFrame!),
    enabled: compareFrame !== null,
    ...common,
  });

  const [campaigns, phoneNumbers, templates, plan, chatbots, contactLists] = useQueries({
    queries: [
      { queryKey: ["dashboard", "campaigns"], queryFn: fetchCampaigns, ...common },
      { queryKey: ["dashboard", "phone-numbers"], queryFn: fetchPhoneNumbers, ...common },
      { queryKey: ["dashboard", "templates"], queryFn: fetchTemplates, ...common },
      { queryKey: ["dashboard", "plan"], queryFn: fetchPlan, ...common },
      { queryKey: ["dashboard", "chatbots"], queryFn: fetchChatbots, ...common },
      { queryKey: ["dashboard", "contact-lists"], queryFn: fetchContactLists, ...common },
    ],
  });

  const phoneIds = useMemo(() => (phoneNumbers.data ?? []).map((p) => p.id).filter(Boolean), [phoneNumbers.data]);
  const conversations = useQuery({
    queryKey: ["dashboard", "conversations", phoneIds],
    queryFn: () => fetchConversations(phoneIds),
    enabled: phoneIds.length > 0,
    ...common,
  });

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["dashboard"] }), [queryClient]);

  const isFetching = [stats, compareStats, campaigns, phoneNumbers, templates, plan, chatbots, contactLists, conversations].some(
    (q) => q.isFetching,
  );

  return {
    stats,
    compareStats,
    compareFrame,
    campaigns,
    phoneNumbers,
    templates,
    plan,
    chatbots,
    contactLists,
    conversations,
    refresh,
    isFetching,
    lastUpdated: stats.dataUpdatedAt ? new Date(stats.dataUpdatedAt) : null,
  };
}
