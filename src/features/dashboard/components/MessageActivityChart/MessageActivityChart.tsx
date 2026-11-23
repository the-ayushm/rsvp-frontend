"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { useChartTheme } from "@/theme";
import { DashboardMetrics } from "../../utils/metrics";

interface MessageActivityChartProps {
  metrics: DashboardMetrics;
}

/**
 * Message volume by status. One brand hue encodes magnitude; only "Failed"
 * takes the reserved error color. Categories are named on the axis.
 */
export function MessageActivityChart({ metrics }: MessageActivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const theme = useChartTheme();

  const bars = [
    { label: "Total sent", value: metrics.totalMessages, color: theme.primary },
    { label: "Delivered", value: metrics.delivered, color: theme.primary },
    { label: "In transit", value: metrics.sent, color: theme.primary },
    { label: "Received", value: metrics.received, color: theme.primary },
    { label: "Failed", value: metrics.failed, color: theme.error },
  ];
  const signature = JSON.stringify([bars.map((b) => b.value), theme]);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const font = { family: getComputedStyle(document.body).fontFamily, size: 12 };

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: bars.map((b) => b.label),
        datasets: [
          {
            label: "Messages",
            data: bars.map((b) => b.value),
            backgroundColor: bars.map((b) => b.color),
            hoverBackgroundColor: bars.map((b) => b.color),
            borderRadius: 4,
            borderSkipped: "start",
            maxBarThickness: 44,
            categoryPercentage: 0.62,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.surface,
            titleColor: theme.text,
            bodyColor: theme.textMuted,
            borderColor: theme.border,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            titleFont: { ...font, weight: 600 },
            bodyFont: font,
            callbacks: { label: (ctx) => `${Number(ctx.parsed.y).toLocaleString()} messages` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: theme.textMuted, font },
          },
          y: {
            beginAtZero: true,
            grace: "10%",
            grid: { color: theme.grid },
            border: { display: false },
            ticks: {
              color: theme.textMuted,
              font: { ...font, size: 11 },
              maxTicksLimit: 5,
              callback: (v) => {
                const n = Number(v);
                return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n;
              },
            },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
    // `signature` captures every input the chart depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Message activity: ${bars.map((b) => `${b.label} ${b.value}`).join(", ")}`}
      />
    </div>
  );
}
