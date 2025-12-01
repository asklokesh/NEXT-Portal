'use client';

/**
 * Scorecard Card Component
 * Displays a service's health score with visual indicators
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Trophy,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScorecardResult, ScorecardLevel, CheckCategory } from '@/services/scorecards/types';

interface ScorecardCardProps {
  result: ScorecardResult;
  levels?: ScorecardLevel[];
  showChecks?: boolean;
  showTrend?: boolean;
  onViewDetails?: () => void;
  className?: string;
}

const CATEGORY_COLORS: Record<CheckCategory, { bg: string; text: string }> = {
  security: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  reliability: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  quality: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  documentation: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  operations: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  compliance: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  cost: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  performance: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' },
  observability: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  custom: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
};

const LEVEL_ICONS: Record<string, React.ElementType> = {
  bronze: Shield,
  silver: Shield,
  gold: Star,
  platinum: Trophy,
};

export function ScorecardCard({
  result,
  levels = [],
  showChecks = true,
  showTrend = true,
  onViewDetails,
  className,
}: ScorecardCardProps) {
  const passedChecks = result.checkResults.filter((c) => c.status === 'pass').length;
  const totalChecks = result.checkResults.length;
  const failedChecks = result.checkResults.filter((c) => c.status === 'fail').length;
  const warningChecks = result.checkResults.filter((c) => c.status === 'warning').length;

  const currentLevel = levels.find((l) => l.id === result.level);
  const LevelIcon = currentLevel ? LEVEL_ICONS[currentLevel.id] || Shield : Shield;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreRingColor = (percentage: number) => {
    if (percentage >= 90) return 'stroke-green-500';
    if (percentage >= 75) return 'stroke-blue-500';
    if (percentage >= 50) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  // Group checks by category
  const checksByCategory = result.checkResults.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<CheckCategory, typeof result.checkResults>);

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700',
        'shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      {/* Header with Score Circle */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          {/* Score Circle */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${result.percentage * 2.51} 251`}
                  className={getScoreRingColor(result.percentage)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-2xl font-bold', getScoreColor(result.percentage))}>
                  {result.percentage}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={cn('text-lg font-semibold', getScoreColor(result.percentage))}>
                  {result.score}/{result.maxScore}
                </span>
                {showTrend && result.trend && (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-sm',
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
                    {Math.abs(result.trend.change)}%
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {passedChecks} of {totalChecks} checks passing
              </div>
            </div>
          </div>

          {/* Level Badge */}
          {currentLevel && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${currentLevel.color}20` }}
            >
              <LevelIcon className="h-4 w-4" style={{ color: currentLevel.color }} />
              <span className="text-sm font-medium" style={{ color: currentLevel.color }}>
                {currentLevel.name}
              </span>
            </div>
          )}
        </div>

        {/* Check Summary */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">{passedChecks} passed</span>
          </div>
          {failedChecks > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">{failedChecks} failed</span>
            </div>
          )}
          {warningChecks > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">{warningChecks} warnings</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {showChecks && Object.keys(checksByCategory).length > 0 && (
        <div className="px-6 pb-4 space-y-3">
          {Object.entries(checksByCategory).map(([category, checks]) => {
            const categoryColors = CATEGORY_COLORS[category as CheckCategory];
            const categoryPassed = checks.filter((c) => c.status === 'pass').length;
            const categoryPercentage = Math.round((categoryPassed / checks.length) * 100);

            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium capitalize',
                      categoryColors.bg,
                      categoryColors.text
                    )}
                  >
                    {category}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {categoryPassed}/{checks.length}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      categoryPercentage >= 75
                        ? 'bg-green-500'
                        : categoryPercentage >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${categoryPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Details */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="flex items-center justify-center gap-1 w-full py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700 transition-colors"
        >
          View Details
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default ScorecardCard;
