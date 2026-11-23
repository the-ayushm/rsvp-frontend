import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
}

const variantClasses = {
  success: 'admin-badge-success',
  warning: 'admin-badge-warning',
  danger: 'admin-badge-danger',
  info: 'admin-badge-info',
  default: 'admin-badge-default',
};

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={cn(
        'admin-badge',
        variantClasses[variant],
        size === 'sm' && 'px-2 py-0.5 text-xs'
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'default', label: 'Inactive' },
    pending: { variant: 'warning', label: 'Pending' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'danger', label: 'Failed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    draft: { variant: 'default', label: 'Draft' },
    paused: { variant: 'warning', label: 'Paused' },
    running: { variant: 'info', label: 'Running' },
    expired: { variant: 'danger', label: 'Expired' },
    online: { variant: 'success', label: 'Online' },
    offline: { variant: 'default', label: 'Offline' },
    sent: { variant: 'info', label: 'Sent' },
    delivered: { variant: 'success', label: 'Delivered' },
    read: { variant: 'success', label: 'Read' },
  };

  const config = statusConfig[status.toLowerCase()] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default Badge;
