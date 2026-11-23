// src/components/admin/RevenueChart.tsx

'use client';

import { DollarSign, TrendingUp } from 'lucide-react';

interface RevenueData {
  total: number;
  currency: string;
  change?: { change: string; changeType: 'increase' | 'decrease' } | null;
}

interface RevenueChartProps {
  data: RevenueData;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasRevenue = (data.total || 0) > 0;
  // Use real monthly data when provided; otherwise hide fake breakdown
  const monthlyData = (data as { monthly?: { month: string; amount: number }[] }).monthly || [];

  const maxAmount = monthlyData.length > 0 ? Math.max(...monthlyData.map((d) => d.amount)) : 0;

  return (
    <div className="space-y-6">
      {/* Total Revenue Display */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(data.total || 0)}
          </p>
          {data.change && (
            <div className="flex items-center mt-2">
              {data.change.changeType === 'increase' ? (
                <TrendingUp className="w-4 h-4 text-[var(--color-primary)] mr-1" />
              ) : (
                <TrendingUp className="w-4 h-4 text-red-500 mr-1 rotate-180" />
              )}
              <span
                className={`text-sm font-medium ${
                  data.change.changeType === 'increase'
                    ? 'text-[var(--color-primary)] dark:text-[var(--color-primary)]'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {data.change.change}
                {data.change.change !== 'New' && ' from last month'}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center">
          <DollarSign className="w-8 h-8 text-[var(--color-primary)] dark:text-[var(--color-primary)]" />
        </div>
      </div>

      {/* Bar Chart - only when we have revenue */}
      {monthlyData.length > 0 && (
      <div className="space-y-2">
        {monthlyData.map((item, index) => {
          const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          
          return (
            <div key={item.month} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{item.month}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${percentage}%`,
                    transitionDelay: `${index * 50}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Revenue from subscriptions (all payments via Razorpay are plan subscriptions) */}
      {hasRevenue && (
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Revenue by Source
        </p>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">Subscriptions (Razorpay)</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(data.total || 0)}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}