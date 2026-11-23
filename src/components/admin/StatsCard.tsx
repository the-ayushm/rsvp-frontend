// src/components/admin/StatsCard.tsx

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'emerald' | 'pink' | 'cyan';
}

const colorClasses = {
  blue: { 
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20', 
    text: 'text-[var(--color-primary)] dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-700',
    icon: 'bg-blue-100 dark:bg-blue-900/50'
  },
  green: { 
    bg: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20', 
    text: 'text-[var(--color-primary)] dark:text-[var(--color-primary)]',
    border: 'border-[rgba(var(--color-primary-rgb),0.3)] dark:border-green-700',
    icon: 'bg-[var(--color-success-light)] dark:bg-green-900/50'
  },
  purple: { 
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20', 
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-700',
    icon: 'bg-[var(--color-primary-light)] dark:bg-purple-900/50'
  },
  orange: { 
    bg: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20', 
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-700',
    icon: 'bg-orange-100 dark:bg-orange-900/50'
  },
  indigo: { 
    bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20', 
    text: 'text-[var(--color-primary)] dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-700',
    icon: 'bg-indigo-100 dark:bg-indigo-900/50'
  },
  emerald: { 
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20', 
    text: 'text-[var(--color-primary)] dark:text-[var(--color-primary)]',
    border: 'border-[rgba(var(--color-primary-rgb),0.3)] dark:border-emerald-700',
    icon: 'bg-[var(--color-primary-light)] dark:bg-emerald-900/50'
  },
  pink: { 
    bg: 'bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/20', 
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-700',
    icon: 'bg-pink-100 dark:bg-pink-900/50'
  },
  cyan: { 
    bg: 'bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/20', 
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-700',
    icon: 'bg-cyan-100 dark:bg-cyan-900/50'
  },
};

export default function StatsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color = 'blue',
}: StatsCardProps) {
  const colors = colorClasses[color];
  
  return (
    <div className={`${colors.bg} ${colors.border} rounded-2xl border p-6 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm cursor-pointer`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-3">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change && (
            <div className="flex items-center mt-3">
              {changeType === 'increase' ? (
                <TrendingUp className="w-4 h-4 text-[var(--color-primary)] mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span
                className={`text-sm font-medium ${
                  changeType === 'increase'
                    ? 'text-[var(--color-primary)] dark:text-[var(--color-primary)]'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {change}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                vs last month
              </span>
            </div>
          )}
        </div>
        <div className={`${colors.icon} p-4 rounded-2xl`}>
          <Icon className={`w-8 h-8 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
}