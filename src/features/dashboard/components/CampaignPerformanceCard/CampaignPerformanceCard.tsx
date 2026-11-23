import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Megaphone, Plus } from "lucide-react";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import type { CampaignSummary } from "../../types";
import { campaignDeliveryRate, isRunning, isScheduled, type CampaignPerformance } from "../../utils/metrics";
import { MiniStat } from "../MiniStat";
import styles from "./CampaignPerformanceCard.module.css";

function statusBadge(c: CampaignSummary): { label: string; variant: BadgeVariant } {
  if (c.status === "failed") return { label: "Failed", variant: "error" };
  if (c.status === "completed") return { label: "Completed", variant: "success" };
  if (c.status === "paused") return { label: "Paused", variant: "warning" };
  if (isRunning(c)) return { label: "Running", variant: "primary" };
  if (isScheduled(c)) return { label: "Scheduled", variant: "info" };
  return { label: c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "Draft", variant: "neutral" };
}

interface Props {
  performance: CampaignPerformance | null;
  total: number | null;
  loading: boolean;
  periodLabel: string;
}

/** "Are my broadcasts landing?" — period totals plus the latest campaigns. */
export function CampaignPerformanceCard({ performance: p, total, loading, periodLabel }: Props) {
  const router = useRouter();
  const attempted = p ? p.sent + p.failedMessages : 0;

  return (
    <Card className={styles.card}>
      <CardHeader
        icon={Megaphone}
        title="Campaign performance"
        description={`Campaigns created — ${periodLabel.toLowerCase()}`}
        action={
          <Button size="sm" onClick={() => router.push("/user/campaigns/create")} leftIcon={<Plus size={14} />}>
            New campaign
          </Button>
        }
      />

      <div className={styles.stats}>
        <MiniStat
          label="Campaigns"
          value={loading || !p ? null : p.inPeriod}
          hint={p ? (p.scheduled ? `${p.running} running · ${p.scheduled} queued` : `${p.running} running now`) : undefined}
        />
        <MiniStat
          label="Delivery rate"
          value={p ? `${p.deliveryRate}%` : null}
          tone={attempted > 0 && p && p.deliveryRate < 50 ? "warning" : "success"}
          hint={p ? `${p.delivered.toLocaleString()} of ${attempted.toLocaleString()} delivered` : undefined}
        />
        <MiniStat
          label="Read rate"
          value={p ? `${p.readRate}%` : null}
          hint={p ? `${p.read.toLocaleString()} read` : undefined}
        />
        <MiniStat
          label="Failed messages"
          value={loading || !p ? null : p.failedMessages}
          tone={p?.failedMessages ? "error" : "neutral"}
          hint={p ? `${p.failed} failed campaign${p.failed === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>Recent campaigns</h3>
        <Link href="/user/campaigns" className={styles.viewAll}>
          View all{total ? ` ${total.toLocaleString()}` : ""} <ArrowRight size={13} aria-hidden />
        </Link>
      </div>

      {loading && !p ? (
        <div className={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : p && p.recent.length ? (
        <ul className={styles.list}>
          {p.recent.map((c) => {
            const badge = statusBadge(c);
            const delivered = campaignDeliveryRate(c);
            return (
              <li key={c.id}>
                <Link href={`/user/campaigns/${c.id}/stats`} className={styles.row}>
                  <span className={styles.name}>
                    <span className={styles.nameText}>{c.name}</span>
                    <span className={styles.meta}>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })
                        : "—"}
                      {" · "}
                      {c.recipients.toLocaleString()} recipients
                    </span>
                  </span>
                  <span className={styles.progress}>
                    <span className={styles.progressTrack} aria-hidden>
                      <span className={styles.progressFill} style={{ width: `${delivered}%` }} />
                    </span>
                    <span className={styles.progressText}>
                      {delivered}% delivered{c.failed ? ` · ${c.failed.toLocaleString()} failed` : ""}
                    </span>
                  </span>
                  <Badge variant={badge.variant} size="sm" dot>
                    {badge.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={<Megaphone size={20} />}
          title="No campaigns yet"
          description="Broadcast an approved template to a contact list."
        />
      )}
    </Card>
  );
}
