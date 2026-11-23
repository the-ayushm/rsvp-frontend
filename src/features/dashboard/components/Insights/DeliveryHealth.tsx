import { CheckCheck, Clock3, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardMetrics } from "../../utils/metrics";
import styles from "./Insights.module.css";

/**
 * Status breakdown of outbound messages. Status colors are reserved for
 * state and always ship with an icon + label (never color alone).
 */
export function DeliveryHealth({ metrics }: { metrics: DashboardMetrics }) {
  const rows = [
    { key: "success", label: "Delivered", value: metrics.delivered, pct: metrics.deliveryRate, icon: <CheckCheck size={15} /> },
    { key: "pending", label: "In transit", value: metrics.sent, pct: metrics.inTransitRate, icon: <Clock3 size={15} /> },
    { key: "error", label: "Failed", value: metrics.failed, pct: metrics.failureRate, icon: <XCircle size={15} /> },
  ] as const;

  return (
    <div>
      <div className={styles.headline}>
        <span className={styles.headlineValue}>{metrics.deliveryRate}%</span>
        <span className={styles.headlineLabel}>delivery rate</span>
      </div>

      <div className={styles.stack} role="img" aria-label={rows.map((r) => `${r.label} ${r.pct}%`).join(", ")}>
        {rows.map((r) =>
          r.pct > 0 ? (
            <span key={r.key} className={cn(styles.segment, styles[r.key])} style={{ width: `${r.pct}%` }} title={`${r.label}: ${r.pct}%`} />
          ) : null,
        )}
      </div>

      <div className={styles.legend}>
        {rows.map((r) => (
          <div key={r.key} className={styles.legendRow}>
            <span className={cn(styles.legendIcon, styles[r.key])}>{r.icon}</span>
            <span className={styles.legendLabel}>{r.label}</span>
            <span className={styles.legendValue}>{r.value.toLocaleString()}</span>
            <span className={styles.legendPct}>{r.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
