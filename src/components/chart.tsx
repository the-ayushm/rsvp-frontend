/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ChartDataset {
  data: number[];
  backgroundColor?: string[];
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface ContactPieChartProps {
  data: ChartData;
}

/** Shared motion keyframes/utility classes, scoped to this component tree. */
const PieAnimations = () => (
  <style jsx global>{`
    @keyframes pieFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pieLegendIn {
      from { opacity: 0; transform: translateX(-6px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .pie-fade-in {
      opacity: 0;
      animation: pieFadeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .pie-legend-in {
      opacity: 0;
      animation: pieLegendIn 0.4s ease-out forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .pie-fade-in, .pie-legend-in {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `}</style>
);

export function ContactPieChart({ data }: ContactPieChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const capitalizeFirst = (str: string) => {
    if (!str) return "Unknown";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const pieData =
    data?.labels?.map((label, i) => ({
      name: capitalizeFirst(label),
      value: data.datasets[0]?.data[i] ?? 0,
    })) || [];

  const filteredPieData = pieData.filter((item) => item.value > 0);

  const colors = data.datasets[0]?.backgroundColor || [
    "var(--color-primary, #25D366)",
    "var(--color-primary-hover, #20ba5a)",
    "var(--color-primary-dark, #1a9449)",
    "var(--color-primary-light, #e8f5e9)",
    "var(--color-info, #3b82f6)",
    "var(--color-warning, #f59e0b)",
  ];

  const total = filteredPieData.reduce((sum, item) => sum + item.value, 0);

  if (filteredPieData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-300">
        <PieAnimations />
        <p className="pie-fade-in">No data available</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4 pie-fade-in">
      <PieAnimations />

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={filteredPieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={40}
            labelLine={false}
            label={false}
            isAnimationActive={true}
            animationDuration={900}
            animationEasing="ease-out"
            animationBegin={100}
          >
            {filteredPieData.map((_, i) => (
              <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
            ))}
          </Pie>

          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              backgroundColor: isDark ? "#071423" : "#ffffff",
              border: isDark
                ? "1px solid rgba(148,163,184,0.18)"
                : "1px solid #e5e7eb",
              color: isDark ? "#e2e8f0" : "#0f172a",
            }}
            itemStyle={{ color: isDark ? "#e2e8f0" : "#0f172a" }}
            labelStyle={{
              color: isDark ? "#a5f3c4" : "var(--color-primary, #25D366)",
              fontWeight: 600,
            }}
            formatter={(value: any, name: any) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return [`${value} (${pct}%)`, name];
            }}
            animationDuration={200}
            animationEasing="ease-out"
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend — 2-column grid, clean and readable */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 px-2">
        {filteredPieData.map((item, i) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
          return (
            <div
              key={i}
              className="pie-legend-in flex items-center gap-2 min-w-0 transition-transform duration-200 hover:translate-x-0.5"
              style={{ animationDelay: `${0.6 + i * 0.07}s` }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span
                className="text-xs truncate"
                style={{ color: isDark ? "#cbd5e1" : "#374151" }}
                title={`${item.name}: ${item.value} (${pct}%)`}
              >
                {item.name}:{" "}
                <span className="font-semibold">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}