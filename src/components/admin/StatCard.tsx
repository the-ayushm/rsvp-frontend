import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'red' | 'yellow';
}

const colorClasses = {
  blue: 'bg-admin-blue',
  green: 'bg-admin-green',
  purple: 'bg-admin-purple',
  orange: 'bg-admin-orange',
  pink: 'bg-admin-pink',
  cyan: 'bg-admin-cyan',
  red: 'bg-admin-red',
  yellow: 'bg-admin-yellow',
};

export function StatCard({ title, value, change, icon, color }: StatCardProps) {
  return (
    <div className="admin-stat-card">
      <div className="pr-16">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        {change && (
          <p className="mt-2 text-sm">
            <span
              className={cn(
                'font-medium',
                change.value >= 0 ? 'text-admin-green' : 'text-admin-red'
              )}
            >
              {change.value >= 0 ? '↗' : '↘'} {Math.abs(change.value)}%
            </span>
            <span className="text-muted-foreground ml-1">{change.label}</span>
          </p>
        )}
      </div>
      <div className={cn('admin-stat-icon', colorClasses[color])}>{icon}</div>
    </div>
  );
}

export default StatCard;
