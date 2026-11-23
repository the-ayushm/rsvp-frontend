"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ChartDataset {
  data: number[];
  backgroundColor?: string[];
}

export interface SourceChartData {
  labels: string[];
  datasets: ChartDataset[];
}

/** Fixed series order from the centralized chart tokens (never cycled by rank). */
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Unknown");

/** Donut of contacts by source channel, with a labelled legend. */
export function SourceDistributionChart({ data }: { data: SourceChartData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const colors = data.datasets[0]?.backgroundColor || SERIES;
  const rows = (data.labels || [])
    .map((label, i) => ({ name: capitalize(label), value: data.datasets[0]?.data[i] ?? 0, color: colors[i % colors.length] }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  if (rows.length === 0) return null;

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={0} isAnimationActive>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                boxShadow: "var(--elevation-md)",
                fontSize: 12,
              }}
              itemStyle={{ color: "var(--color-text)" }}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
            <span className="flex-1 truncate text-secondary-foreground">{r.name}</span>
            <span className="tabular-nums font-medium text-foreground">
              {total > 0 ? ((r.value / total) * 100).toFixed(1) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
