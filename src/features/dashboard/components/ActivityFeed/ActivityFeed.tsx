import Link from "next/link";
import { Activity, Bot, CalendarClock, CircleX, FileText, Megaphone, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { relativeTime, type ActivityEvent } from "../../utils/metrics";
import styles from "./ActivityFeed.module.css";

const KIND: Record<ActivityEvent["kind"], { icon: React.ReactNode; tone: string }> = {
  campaign: { icon: <Megaphone size={14} />, tone: styles.primary },
  "campaign-failed": { icon: <CircleX size={14} />, tone: styles.error },
  "campaign-scheduled": { icon: <CalendarClock size={14} />, tone: styles.info },
  contacts: { icon: <Users size={14} />, tone: styles.neutral },
  template: { icon: <FileText size={14} />, tone: styles.neutral },
  message: { icon: <MessageCircle size={14} />, tone: styles.primary },
  chatbot: { icon: <Bot size={14} />, tone: styles.neutral },
};

/** "What happened recently?" — a compact, time-ordered feed. */
export function ActivityFeed({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  const now = Date.now();
  return (
    <Card className={styles.card}>
      <CardHeader icon={Activity} title="Recent activity" description="Across campaigns, contacts and chats" />
      {loading && !events.length ? (
        <div className={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : events.length ? (
        <ol className={styles.feed}>
          {events.map((e) => {
            const kind = KIND[e.kind];
            const inner = (
              <>
                <span className={cn(styles.dot, kind.tone)} aria-hidden>
                  {kind.icon}
                </span>
                <span className={styles.body}>
                  <span className={styles.title}>{e.title}</span>
                  {e.detail && <span className={styles.detail}>{e.detail}</span>}
                </span>
                <time className={styles.time} dateTime={new Date(e.at).toISOString()}>
                  {relativeTime(e.at, now)}
                </time>
              </>
            );
            return (
              <li key={e.id} className={styles.entry}>
                {e.href ? (
                  <Link href={e.href} className={styles.row}>
                    {inner}
                  </Link>
                ) : (
                  <div className={styles.row}>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState compact icon={<Activity size={20} />} title="No activity yet" description="Campaigns, imports and new chats will show up here." />
      )}
    </Card>
  );
}
