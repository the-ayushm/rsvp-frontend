import Link from "next/link";
import { ArrowRight, ListPlus, UserCheck, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { DashboardMetrics, Trend } from "../../utils/metrics";
import { MiniStat } from "../MiniStat";
import { TrendBadge } from "../TrendBadge";
import styles from "./AudienceCard.module.css";

interface Props {
  metrics: DashboardMetrics | null;
  reachedTrend?: Trend | null;
  imported: { lists: number; contacts: number } | null;
  periodLabel: string;
}

/** "How big is my audience, and am I reaching it?" */
export function AudienceCard({ metrics: m, reachedTrend, imported, periodLabel }: Props) {
  const reach = m && m.contacts > 0 ? Math.min(100, Math.round((m.uniqueContacts / m.contacts) * 100)) : 0;
  return (
    <Card className={styles.card}>
      <CardHeader
        icon={Users}
        title="Audience"
        description="Contacts you can message on WhatsApp"
        action={
          <Link href="/user/contacts" className={styles.link}>
            Contacts <ArrowRight size={13} aria-hidden />
          </Link>
        }
      />

      <div className={styles.headline}>
        <span className={styles.total}>{m ? m.contacts.toLocaleString() : "—"}</span>
        <span className={styles.totalLabel}>total contacts</span>
      </div>

      <div className={styles.reach}>
        <div className={styles.reachTop}>
          <span>Reached {periodLabel.toLowerCase()}</span>
          <span className={styles.reachValue}>{m ? `${m.uniqueContacts.toLocaleString()} · ${reach}%` : "—"}</span>
        </div>
        <span className={styles.track} role="meter" aria-label="Share of contacts reached" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reach}>
          <span className={styles.fill} style={{ width: `${reach}%` }} />
        </span>
        {reachedTrend && <TrendBadge trend={reachedTrend} />}
      </div>

      <div className={styles.grid}>
        <MiniStat
          label="Imported"
          icon={<UserCheck size={13} />}
          value={imported ? imported.contacts : null}
          hint={imported ? `${imported.lists} list${imported.lists === 1 ? "" : "s"} · ${periodLabel.toLowerCase()}` : undefined}
          href="/user/contacts/lists"
        />
        <MiniStat label="Contact lists" icon={<ListPlus size={13} />} value={m ? m.contactLists : null} hint="Ready for campaigns" href="/user/contacts/lists" />
      </div>
    </Card>
  );
}
