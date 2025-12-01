'use client';

/**
 * Scorecard Details Component
 * Detailed view of all checks and their results
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Filter,
  Search,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  ScorecardResult,
  CheckResult,
  CheckCategory,
  CheckStatus,
} from '@/services/scorecards/types';

interface ScorecardDetailsProps {
  result: ScorecardResult;
  onRefresh?: () => void;
  onRemediationClick?: (checkId: string) => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  CheckStatus,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  pass: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: 'Passing',
  },
  fail: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    label: 'Failing',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    label: 'Warning',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    label: 'Error',
  },
  skipped: {
    icon: Info,
    color: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    label: 'Skipped',
  },
};

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  security: 'Security',
  reliability: 'Reliability',
  quality: 'Quality',
  documentation: 'Documentation',
  operations: 'Operations',
  compliance: 'Compliance',
  cost: 'Cost',
  performance: 'Performance',
  observability: 'Observability',
  custom: 'Custom',
};

interface CheckItemProps {
  check: CheckResult;
  onRemediationClick?: () => void;
}

function CheckItem({ check, onRemediationClick }: CheckItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[check.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden',
        check.status === 'fail' && 'border-red-200 dark:border-red-800'
      )}
    >
      {/* Check Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center justify-between w-full p-4 text-left',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
        )}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('h-5 w-5', statusConfig.color)} />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{check.checkName}</div>
            {check.message && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {check.message}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              statusConfig.bg,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
          <span className="text-sm text-gray-500">
            {check.score}/{check.maxScore}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
          <div className="pt-4 space-y-4">
            {/* Details */}
            {check.details && Object.keys(check.details).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Details
                </h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Evidence */}
            {check.evidence && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Evidence
                </h4>
                {check.evidence.type === 'link' && (
                  <a
                    href={check.evidence.data as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    {check.evidence.label || 'View'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {check.evidence.type === 'json' && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                      {JSON.stringify(check.evidence.data, null, 2)}
                    </pre>
                  </div>
                )}
                {check.evidence.type === 'text' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {check.evidence.data as string}
                  </p>
                )}
              </div>
            )}

            {/* Remediation */}
            {check.status === 'fail' && onRemediationClick && (
              <Button variant="outline" size="sm" onClick={onRemediationClick}>
                View Remediation Guide
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}

            {/* Evaluation Time */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Evaluated: {new Date(check.evaluatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScorecardDetails({
  result,
  onRefresh,
  onRemediationClick,
  className,
}: ScorecardDetailsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CheckCategory | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(CATEGORY_LABELS))
  );

  // Filter checks
  const filteredChecks = result.checkResults.filter((check) => {
    const matchesSearch =
      !searchQuery ||
      check.checkName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      check.message?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || check.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || check.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Group by category
  const checksByCategory = filteredChecks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<CheckCategory, CheckResult[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Calculate statistics
  const stats = {
    total: result.checkResults.length,
    passing: result.checkResults.filter((c) => c.status === 'pass').length,
    failing: result.checkResults.filter((c) => c.status === 'fail').length,
    warnings: result.checkResults.filter((c) => c.status === 'warning').length,
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Scorecard Results
            </h2>
            <span
              className={cn(
                'text-2xl font-bold',
                result.percentage >= 75
                  ? 'text-green-600'
                  : result.percentage >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              )}
            >
              {result.percentage}%
            </span>
            {result.trend && (
              <span
                className={cn(
                  'flex items-center gap-1 text-sm',
                  result.trend.direction === 'up'
                    ? 'text-green-600'
                    : result.trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-gray-500'
                )}
              >
                {result.trend.direction === 'up' ? (
                  <TrendingUp className="h-4 w-4" />
                ) : result.trend.direction === 'down' ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {result.trend.change}% from {result.trend.period}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.passing} of {stats.total} checks passing
          </p>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-evaluate
          </Button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Checks</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.passing}</div>
          <div className="text-sm text-green-600/70">Passing</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failing}</div>
          <div className="text-sm text-red-600/70">Failing</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
          <div className="text-sm text-yellow-600/70">Warnings</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search checks..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CheckStatus | 'all')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pass">Passing</option>
          <option value="fail">Failing</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="skipped">Skipped</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CheckCategory | 'all')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Check List by Category */}
      <div className="space-y-4">
        {Object.entries(checksByCategory).map(([category, checks]) => {
          const isExpanded = expandedCategories.has(category);
          const categoryPassed = checks.filter((c) => c.status === 'pass').length;

          return (
            <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {CATEGORY_LABELS[category as CheckCategory]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {categoryPassed}/{checks.length} passing
                  </span>
                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        categoryPassed === checks.length
                          ? 'bg-green-500'
                          : categoryPassed > 0
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      )}
                      style={{ width: `${(categoryPassed / checks.length) * 100}%` }}
                    />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="p-4 pt-0 space-y-3">
                  {checks.map((check) => (
                    <CheckItem
                      key={check.checkId}
                      check={check}
                      onRemediationClick={
                        onRemediationClick
                          ? () => onRemediationClick(check.checkId)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredChecks.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No checks match your filters</p>
          </div>
        )}
      </div>

      {/* Last Evaluated */}
      <div className="text-center text-sm text-gray-400">
        <Clock className="h-4 w-4 inline mr-1" />
        Last evaluated: {new Date(result.evaluatedAt).toLocaleString()}
      </div>
    </div>
  );
}

export default ScorecardDetails;
