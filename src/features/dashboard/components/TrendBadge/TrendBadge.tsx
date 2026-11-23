import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend } from "../../utils/metrics";
import styles from "./TrendBadge.module.css";

/** ▲ 12% vs previous 23 days — colored by whether the change is good news. */
export function TrendBadge({ trend, className }: { trend: Trend; className?: string }) {
  const flat = Math.abs(trend.delta) < 0.1;
  const Icon = flat ? Minus : trend.delta > 0 ? ArrowUpRight : ArrowDownRight;
  // Very large swings read better as a multiple: +856% → 9.6×
  const value =
    trend.unit === "%" && trend.delta >= 200
      ? `${Math.round((trend.delta / 100 + 1) * 10) / 10}×`
      : `${trend.delta > 0 ? "+" : ""}${trend.delta}${trend.unit === "%" ? "%" : " pts"}`;
  return (
    <span className={cn(styles.root, className)} title={`${value} ${trend.label}${trend.unit === "%" ? " (per-day average)" : ""}`}>
      <span className={cn(styles.badge, flat ? styles.flat : trend.positive ? styles.up : styles.down)}>
        <Icon size={12} strokeWidth={2.5} aria-hidden />
        {flat ? "No change" : value}
      </span>
      <span className={styles.label}>{trend.label}</span>
    </span>
  );
}
