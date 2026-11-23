import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./MiniStat.module.css";

export interface MiniStatProps {
  label: string;
  value: number | string | null | undefined;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "error";
  href?: string;
}

/** Compact labelled figure used inside dashboard panels. */
export function MiniStat({ label, value, hint, icon, tone = "neutral", href }: MiniStatProps) {
  const body = (
    <>
      <span className={styles.label}>
        {icon && <span className={cn(styles.icon, styles[tone])}>{icon}</span>}
        {label}
      </span>
      {value === null || value === undefined ? (
        <Skeleton className="mt-1 h-6 w-14" />
      ) : (
        <span className={styles.value}>{typeof value === "number" ? value.toLocaleString() : value}</span>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cn(styles.stat, styles.link)}>
      {body}
    </Link>
  ) : (
    <div className={styles.stat}>{body}</div>
  );
}
