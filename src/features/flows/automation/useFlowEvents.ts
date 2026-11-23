"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flowsApi, toFlowError } from "./api";
import type { FlowEvent, FlowEventDetail } from "./types";

const POLL_MS = 2500;
const LISTEN_TIMEOUT_MS = 10 * 60 * 1000;

/** Captured webhook samples + the "listen for test event" poller. */
export function useFlowEvents(flowId: string, onSample: (detail: FlowEventDetail | null) => void) {
  const [events, setEvents] = useState<FlowEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  /** Event ids that arrived while listening in this session. */
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set());
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const select = useCallback(
    async (eventId: string | null) => {
      setSelectedId(eventId);
      if (!eventId) return onSampleRef.current(null);
      setLoadingDetail(true);
      try {
        onSampleRef.current(await flowsApi.event(flowId, eventId));
      } catch (err) {
        setError(toFlowError(err).message);
      } finally {
        setLoadingDetail(false);
      }
    },
    [flowId],
  );

  const load = useCallback(async () => {
    try {
      const list = await flowsApi.events(flowId);
      setEvents(list);
      setError(null);
      return list;
    } catch (err) {
      setError(toFlowError(err).message);
      return null;
    }
  }, [flowId]);

  useEffect(() => {
    void load().then((list) => {
      list?.forEach((e) => knownIds.current.add(e.id));
      // Preload the latest sample so the mapping picker has fields straight away.
      if (list?.[0]) void select(list[0].id);
    });
  }, [load, select]);

  useEffect(() => {
    if (!listening) return;
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      const list = await load();
      // Every newly returned event id is a separate sample; keep listening and
      // select the newest one so repeated events (e.g. cart updates) all show up.
      const fresh = list?.filter((e) => !knownIds.current.has(e.id)) ?? [];
      list?.forEach((e) => knownIds.current.add(e.id));
      if (fresh.length > 0) {
        setNewIds((prev) => new Set([...prev, ...fresh.map((e) => e.id)]));
        void select(fresh[0].id);
      }
      if (Date.now() - started > LISTEN_TIMEOUT_MS) {
        setListening(false);
        if (knownIds.current.size === 0) {
          setError("No event arrived in 10 minutes. Check that the webhook is connected and trigger the event again.");
        }
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [listening, load, select]);

  return {
    events,
    error,
    listening,
    startListening: () => {
      setError(null);
      setListening(true);
    },
    stopListening: () => setListening(false),
    newIds,
    selectedId,
    select,
    loadingDetail,
    reload: load,
  };
}

export type FlowEvents = ReturnType<typeof useFlowEvents>;
