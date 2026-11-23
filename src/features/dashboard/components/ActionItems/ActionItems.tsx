import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, CircleCheck, Info, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import type { ActionItem } from "../../utils/metrics";
import styles from "./ActionItems.module.css";

const ICONS = {
  error: <AlertOctagon size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};
const SEVERITY_LABEL = { error: "Critical", warning: "Warning", info: "Heads up" };

/** "Is anything broken or waiting on me?" — ordered by severity. */
export function ActionItems({ items, loading }: { items: ActionItem[]; loading: boolean }) {
  return (
    <Card className={styles.card}>
      <CardHeader
        icon={ListChecks}
        title="Needs attention"
        description={loading ? "Checking your workspace…" : items.length ? `${items.length} item${items.length === 1 ? "" : "s"} to review` : "Workspace health"}
      />
      {loading && !items.length ? (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={cn(styles.item, styles[item.severity])}>
                <span className={styles.icon} aria-hidden>
                  {ICONS[item.severity]}
                </span>
                <span className={styles.body}>
                  <span className={styles.title}>
                    <span className="sr-only">{SEVERITY_LABEL[item.severity]}: </span>
                    {item.title}
                  </span>
                  <span className={styles.description}>{item.description}</span>
                  <span className={styles.cta}>
                    {item.cta} <ArrowRight size={12} aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.clear}>
          <span className={styles.clearIcon} aria-hidden>
            <CircleCheck size={22} />
          </span>
          <p className={styles.clearTitle}>All clear</p>
          <p className={styles.clearText}>Numbers connected, templates approved and no failed campaigns.</p>
        </div>
      )}
    </Card>
  );
}
