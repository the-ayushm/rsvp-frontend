/* eslint-disable @next/next/no-img-element */
// src/components/admin/RecentActivity.tsx

import { formatDistanceToNow } from 'date-fns';
import { Activity, User, Trash2, Edit, Eye } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface RecentActivityProps {
  logs: ActivityLog[];
  loading?: boolean;
}

const SCROLL_HEIGHT = 'min(400px, 50vh)';

export default function RecentActivity({ logs, loading }: RecentActivityProps) {
  if (loading) {
    return (
      <div className="overflow-y-auto pr-1" style={{ maxHeight: SCROLL_HEIGHT }}>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-start space-x-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="overflow-y-auto pr-1" style={{ maxHeight: SCROLL_HEIGHT }}>
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pr-1" style={{ maxHeight: SCROLL_HEIGHT }}>
    <div className="space-y-4">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
        >
          {/* Admin Avatar */}
          <div className="flex-shrink-0">
            {log.admin.avatar ? (
              <img
                src={log.admin.avatar}
                alt={log.admin.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Activity Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {log.admin.name}
              </span>
              {getActionIcon(log.action)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {log.description}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}

function getActionIcon(action: string) {
  const iconProps = { className: 'w-4 h-4' };

  switch (action) {
    case 'LOGIN':
      return <Activity {...iconProps} className="w-4 h-4 text-[var(--color-primary)]" />;
    case 'LOGOUT':
      return <Activity {...iconProps} className="w-4 h-4 text-gray-500" />;
    case 'DELETE_USER':
      return <Trash2 {...iconProps} className="w-4 h-4 text-red-500" />;
    case 'UPDATE_USER':
      return <Edit {...iconProps} className="w-4 h-4 text-[var(--color-primary)]" />;
    case 'VIEW_USERS':
      return <Eye {...iconProps} className="w-4 h-4 text-[var(--color-primary)]" />;
    default:
      return <Activity {...iconProps} className="w-4 h-4 text-gray-500" />;
  }
}