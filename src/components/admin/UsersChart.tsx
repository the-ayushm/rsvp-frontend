// src/components/admin/UsersChart.tsx

'use client';

import { JSX, useMemo } from 'react';

interface UsersByPlan {
  plan: string;
  count: number;
}

interface UsersChartProps {
  data: UsersByPlan[];
}

const planColors: Record<string, string> = {
  FREE: '#3b82f6',
  STARTER: 'var(--color-primary, #25D366)',
  PROFESSIONAL: '#8b5cf6',
  ENTERPRISE: '#f59e0b',
};

export default function UsersChart({ data }: UsersChartProps) {
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0',
      color: planColors[item.plan] || '#6b7280',
    }));
  }, [data, total]);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pie Chart Visualization */}
      <div className="flex items-center justify-center">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {chartData.reduce((acc, item, index) => {
              const percentage = parseFloat(item.percentage);
              const previousPercentages = chartData
                .slice(0, index)
                .reduce((sum, prev) => sum + parseFloat(prev.percentage), 0);
              const strokeDasharray = `${percentage} ${100 - percentage}`;
              const strokeDashoffset = -previousPercentages;

              return [
                ...acc,
                <circle
                  key={item.plan}
                  cx="50"
                  cy="50"
                  r="15.915"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="31.831"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />,
              ];
            }, [] as JSX.Element[])}
          </svg>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {total}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">With Plans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {chartData.map((item) => (
          <div
            key={item.plan}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.plan}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {item.percentage}%
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}