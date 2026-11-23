import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Skeleton from "@/components/ui/Skeleton";
import type { Trend } from "../../utils/metrics";
import { TrendBadge } from "../TrendBadge";
import styles from "./KpiCard.module.css";

export interface KpiCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  /** Secondary line under the value */
  hint?: ReactNode;
  /** Change vs. the previous period */
  trend?: Trend | null;
  /** Optional 0–100 meter with its label, e.g. a delivery rate */
  meter?: { value: number; label: string };
  tone?: "primary" | "success" | "warning" | "error";
}

/** Headline number tile: label, figure, and how it is moving. */
export function KpiCard({ label, value, icon, hint, trend, meter, tone = "primary" }: KpiCardProps) {
  return (
    <div className={cn(styles.card, styles[`tone-${tone}`])}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      </div>
      <p className={styles.value}>{value}</p>
      {meter && (
        <span
          className={styles.meter}
          role="meter"
          aria-label={meter.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meter.value}
        >
          <span className={styles.meterFill} style={{ width: `${Math.max(meter.value, meter.value > 0 ? 2 : 0)}%` }} />
        </span>
      )}
      <div className={styles.footer}>{trend ? <TrendBadge trend={trend} /> : hint}</div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden>
      <div className={styles.top}>
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-9 w-9" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
