'use client';

/**
 * Action Execution Log Component
 * Display execution history and logs for self-service actions
 */

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  Terminal,
  ExternalLink,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  ActionExecution,
  ActionExecutionStatus,
  ActionExecutionLog as LogEntry,
} from '@/services/actions/types';

interface ActionExecutionLogProps {
  executions: ActionExecution[];
  onRetry?: (execution: ActionExecution) => void;
  onViewDetails?: (execution: ActionExecution) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  ActionExecutionStatus,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    label: 'Pending',
  },
  queued: {
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Queued',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Failed',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    label: 'Cancelled',
  },
  timed_out: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Timed Out',
  },
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
};

export function ActionExecutionLogView({
  executions,
  onRetry,
  onViewDetails,
  onRefresh,
  isLoading,
  className,
}: ActionExecutionLogProps) {
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ActionExecutionStatus | 'all'>('all');

  const toggleExecution = (id: string) => {
    setExpandedExecutions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredExecutions =
    statusFilter === 'all'
      ? executions
      : executions.filter((e) => e.status === statusFilter);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Execution History
        </h3>
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ActionExecutionStatus | 'all')}
              className="appearance-none pl-8 pr-8 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-0 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
            </select>
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>

      {/* Execution List */}
      <div className="space-y-2">
        {filteredExecutions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No executions found</p>
          </div>
        ) : (
          filteredExecutions.map((execution) => {
            const statusConfig = STATUS_CONFIG[execution.status];
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedExecutions.has(execution.id);

            return (
              <div
                key={execution.id}
                className={cn(
                  'rounded-lg border transition-colors',
                  execution.status === 'failed'
                    ? 'border-red-200 dark:border-red-800'
                    : execution.status === 'running'
                    ? 'border-blue-200 dark:border-blue-800'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                {/* Execution Header */}
                <button
                  onClick={() => toggleExecution(execution.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      statusConfig.bg
                    )}
                  >
                    <StatusIcon
                      className={cn(
                        'h-4 w-4',
                        statusConfig.color,
                        execution.status === 'running' && 'animate-spin'
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {execution.actionName}
                      </h4>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          statusConfig.bg,
                          statusConfig.color
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {execution.triggeredBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(execution.startedAt)}
                      </span>
                      {execution.duration && (
                        <span>{formatDuration(execution.duration)}</span>
                      )}
                      {execution.entityRef && (
                        <span className="truncate max-w-[150px]">{execution.entityRef}</span>
                      )}
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Parameters */}
                    {Object.keys(execution.parameters).length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Parameters
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <dl className="space-y-1 text-sm">
                            {Object.entries(execution.parameters).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">{key}</dt>
                                <dd className="text-gray-900 dark:text-white font-mono text-xs">
                                  {typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )}

                    {/* Result */}
                    {execution.result && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Result
                        </h5>
                        {execution.result.error ? (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                            <p className="text-sm text-red-700 dark:text-red-400">
                              <span className="font-medium">{execution.result.error.code}:</span>{' '}
                              {execution.result.error.message}
                            </p>
                          </div>
                        ) : execution.result.outputs &&
                          Object.keys(execution.result.outputs).length > 0 ? (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                            <dl className="space-y-1 text-sm">
                              {Object.entries(execution.result.outputs).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <dt className="text-green-700 dark:text-green-400">{key}</dt>
                                  <dd className="text-green-800 dark:text-green-300 font-mono text-xs">
                                    {String(value)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ) : (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                            <p className="text-sm text-green-700 dark:text-green-400">
                              {execution.result.message || 'Action completed successfully'}
                            </p>
                          </div>
                        )}

                        {/* Links */}
                        {execution.result.links && execution.result.links.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {execution.result.links.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                              >
                                {link.label}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logs */}
                    {execution.logs && execution.logs.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Logs
                        </h5>
                        <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                          <div className="space-y-1 font-mono text-xs">
                            {execution.logs.map((log, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <span className="text-gray-500 flex-shrink-0">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span
                                  className={cn(
                                    'uppercase w-12 flex-shrink-0',
                                    LOG_LEVEL_COLORS[log.level]
                                  )}
                                >
                                  [{log.level}]
                                </span>
                                <span className="text-gray-300">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      {execution.status === 'failed' && onRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRetry(execution)}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Retry
                        </Button>
                      )}
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(execution)}
                        >
                          View Details
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ActionExecutionLogView;
