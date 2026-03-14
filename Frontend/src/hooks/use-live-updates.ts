"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "@/store/ui-store";

export interface LiveQueryLike {
  isFetching: boolean;
  isStale?: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
}

interface SmartPollingOptions {
  queries: LiveQueryLike[];
  enabled?: boolean;
  intervalMs?: number;
  pauseWhenHidden?: boolean;
}

interface WebSocketLiveOptions {
  url?: string | null;
  enabled?: boolean;
  onMessage?: (payload: unknown) => void;
}

function maxUpdatedAt(queries: LiveQueryLike[]): number {
  return queries.reduce((acc, query) => Math.max(acc, query.dataUpdatedAt || 0), 0);
}

export function useSmartPolling({
  queries,
  enabled = true,
  intervalMs = 15_000,
  pauseWhenHidden = true,
}: SmartPollingOptions) {
  const setLastLiveSyncAt = useUiStore((state) => state.setLastLiveSyncAt);
  const [lastManualSyncAt, setLastManualSyncAt] = useState<number>(0);
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : !document.hidden
  );

  const anyFetching = queries.some((query) => query.isFetching);
  const hasStaleData = queries.some((query) => query.isStale);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVisibilityChange = () => setIsTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!enabled || !queries.length) return undefined;
    const shouldPause = pauseWhenHidden && !isTabVisible;
    if (shouldPause) return undefined;

    const timer = window.setInterval(async () => {
      if (anyFetching || !navigator.onLine) return;
      await Promise.allSettled(queries.map((query) => query.refetch()));
      const syncedAt = Date.now();
      setLastManualSyncAt(syncedAt);
      setLastLiveSyncAt(syncedAt);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, queries, intervalMs, pauseWhenHidden, isTabVisible, anyFetching, setLastLiveSyncAt]);

  const lastSyncAt = useMemo(
    () => Math.max(lastManualSyncAt, maxUpdatedAt(queries)),
    [lastManualSyncAt, queries]
  );

  const liveStatus = useMemo(
    () => ({
      isLive: enabled && (!pauseWhenHidden || isTabVisible),
      isRefreshing: anyFetching,
      hasStaleData,
      lastSyncAt,
    }),
    [enabled, pauseWhenHidden, isTabVisible, anyFetching, hasStaleData, lastSyncAt]
  );

  return liveStatus;
}

export function useWebSocketLive({
  url,
  enabled = false,
  onMessage,
}: WebSocketLiveOptions) {
  useEffect(() => {
    if (!enabled || !url) return undefined;
    if (typeof window === "undefined" || !("WebSocket" in window)) return undefined;

    const socket = new window.WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        onMessage?.(payload);
      } catch {
        onMessage?.(event.data);
      }
    };

    return () => socket.close();
  }, [url, enabled, onMessage]);
}
