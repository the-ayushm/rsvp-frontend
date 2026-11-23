/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import NotificationsItem from "./NotificationsItem";
import useSWR from "swr";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

interface NotificationItem {
  id: string;
  action: string;
  description: string;
  created_at: string;
  seen?: boolean;
}

interface NotificationsProps {
  cnt: React.Dispatch<React.SetStateAction<number>>;
}

const LOAD_MORE = 10;

const fetcher = (url: string) =>
  soft7AxiosInstance.get(url).then((res) => {
    return (res.data?.data || []) as NotificationItem[];
  });

const useNotifications = (
  cnt: React.Dispatch<React.SetStateAction<number>>
) => {
  const { data, error, isLoading, mutate } = useSWR<NotificationItem[]>(
    "/admin/activity/user/notify?time_frame=7days&role=user&type=contact&page=1&limit=0",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    cnt(data ? data.length : 0);
  }, [data, cnt]);

  return {
    notifications: data || [],
    isLoading,
    isError: error,
    mutate,
  };
};

export default function Notifications({ cnt }: NotificationsProps) {
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const { notifications, isLoading, mutate } = useNotifications(cnt);

  // ---- Infinite scroll observer ----
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < notifications.length) {
          setVisibleCount((prev) =>
            Math.min(prev + LOAD_MORE, notifications.length)
          );
        }
      },
      { rootMargin: "100px" }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [visibleCount, notifications.length]);

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;
    setIsMarkingRead(true);
    try {
      const payloadData = notifications.map((notif: any) => ({
        ...notif,
        seen: true,
      }));

      await soft7AxiosInstance.put("/admin/activity/user/notify?read=true", {
        data: payloadData,
      });
      await mutate();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const visible = notifications.slice(0, visibleCount);

  return (
    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-surface dark:bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden font-sans transition-all duration-200">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between bg-surface-active dark:bg-card">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-foreground dark:text-foreground">
            Notifications
          </h3>
          {notifications.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-accent/15 text-accent">
              {notifications.length}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingRead}
            className="text-xs font-semibold text-accent hover:text-accent/80 hover:bg-accent/10 px-2.5 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isMarkingRead ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            <span>{isMarkingRead ? "Marking..." : "Mark all as read"}</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-border bg-background">
        {isLoading && visible.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span>Loading notifications...</span>
          </div>
        ) : visible.length > 0 ? (
          <>
            {visible.map((msg: any) => (
              <NotificationsItem
                key={msg.id}
                id={msg.id}
                action={msg.action}
                datetime={msg.created_at}
                description={msg.description}
                read={msg.seen}
              />
            ))}

            {visibleCount < notifications.length && (
              <div
                ref={loaderRef}
                className="py-3 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading more…</span>
              </div>
            )}
          </>
        ) : (
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 mb-2 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Bell className="w-5 h-5 opacity-50" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              No notifications
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              You are all caught up!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
