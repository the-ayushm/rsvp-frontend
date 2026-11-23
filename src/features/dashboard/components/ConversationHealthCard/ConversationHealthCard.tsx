import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock4, Inbox, MailWarning, MessagesSquare, Reply } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import type { ConversationSummary } from "../../types";
import { relativeTime, type ConversationHealth } from "../../utils/metrics";
import { MiniStat } from "../MiniStat";
import styles from "./ConversationHealthCard.module.css";

interface Props {
  health: ConversationHealth | null;
  queue: ConversationSummary[];
  loading: boolean;
  noNumbers: boolean;
}

/** "Who is waiting for us right now?" — live state of the shared inbox. */
export function ConversationHealthCard({ health, queue, loading, noNumbers }: Props) {
  const router = useRouter();
  const v = (n: number | undefined) => (loading || !health ? null : n);
  const now = Date.now();

  return (
    <Card className={styles.card}>
      <CardHeader
        icon={MessagesSquare}
        title="Conversations"
        description="Latest 100 chats per number"
        action={
          <Button size="sm" variant="secondary" onClick={() => router.push("/user/inbox")} leftIcon={<Inbox size={14} />}>
            Open inbox
          </Button>
        }
      />
      {noNumbers ? (
        <EmptyState
          compact
          icon={<MessagesSquare size={20} />}
          title="No WhatsApp number connected"
          description="Connect a number to start receiving conversations."
          action={
            <Button size="sm" onClick={() => router.push("/user/integrations/whatsapp")}>
              Connect number
            </Button>
          }
        />
      ) : (
        <>
          <div className={styles.grid}>
            <MiniStat
              label="Unread"
              icon={<MailWarning size={13} />}
              tone={health?.unread ? "primary" : "neutral"}
              value={v(health?.unread)}
              hint={health ? `${health.unreadMessages.toLocaleString()} unread messages` : undefined}
              href="/user/inbox"
            />
            <MiniStat
              label="Awaiting reply"
              icon={<Reply size={13} />}
              tone={health?.awaitingReply ? "warning" : "neutral"}
              value={v(health?.awaitingReply)}
              hint="Customer wrote last"
              href="/user/inbox"
            />
            <MiniStat
              label="Waiting > 1 hour"
              icon={<Clock4 size={13} />}
              tone={health?.waitingLong ? "error" : "neutral"}
              value={v(health?.waitingLong)}
              hint={health?.waitingLong ? "Needs attention" : "All caught up"}
            />
            <MiniStat
              label="Active today"
              icon={<MessagesSquare size={13} />}
              tone="success"
              value={v(health?.activeToday)}
              hint="Messages in last 24h"
            />
          </div>

          <h3 className={styles.queueTitle}>Waiting on you</h3>
          {queue.length ? (
            <ul className={styles.queue}>
              {queue.map((c) => (
                <li key={`${c.phoneNumberId}-${c.id}`}>
                  <Link
                    href={`/user/inbox?contactId=${encodeURIComponent(c.id)}&phone=${encodeURIComponent(c.phone)}&name=${encodeURIComponent(c.name)}`}
                    className={styles.chat}
                  >
                    <Avatar name={c.name} size="sm" />
                    <span className={styles.chatBody}>
                      <span className={styles.chatName}>{c.name}</span>
                      <span className={styles.chatMeta}>
                        {c.lastDirection === "inbound" ? "Customer wrote last" : "Unread messages"}
                      </span>
                    </span>
                    <span className={styles.chatSide}>
                      {c.lastMessageAt && <time className={styles.chatTime}>{relativeTime(new Date(c.lastMessageAt).getTime(), now)}</time>}
                      {c.unread > 0 && (
                        <span className={styles.unread} aria-label={`${c.unread} unread`}>
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.queueEmpty}>{loading ? "Loading chats…" : "No one is waiting — inbox zero."}</p>
          )}
        </>
      )}
    </Card>
  );
}
