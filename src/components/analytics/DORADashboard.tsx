'use client';

/**
 * DORA Metrics Dashboard
 * Visual dashboard for DevOps Research and Assessment metrics
 */

import React, { useState, useMemo } from 'react';
import {
  Rocket,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  ChevronDown,
  Award,
  Target,
  Activity,
  BarChart3,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  DORAMetrics,
  PerformanceLevel,
  MetricTrend,
  MetricPeriod,
  DORAInsight,
} from '@/services/analytics/dora-metrics/types';

interface DORADashboardProps {
  metrics: DORAMetrics;
  insights?: DORAInsight[];
  onPeriodChange?: (period: MetricPeriod) => void;
  onDrillDown?: (metric: string) => void;
  className?: string;
}

const PERFORMANCE_COLORS: Record<PerformanceLevel, { bg: string; text: string; border: string }> = {
  elite: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500',
  },
  high: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-500',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-500',
  },
  low: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500',
  },
};

const METRIC_CONFIG = {
  deploymentFrequency: {
    title: 'Deployment Frequency',
    description: 'How often code is deployed to production',
    icon: Rocket,
    goodDirection: 'higher',
    benchmarks: {
      elite: '≥1/day',
      high: '1-7/week',
      medium: '1-4/month',
      low: '<1/month',
    },
  },
  leadTimeForChanges: {
    title: 'Lead Time for Changes',
    description: 'Time from commit to production',
    icon: Clock,
    goodDirection: 'lower',
    benchmarks: {
      elite: '<1 hour',
      high: '<1 day',
      medium: '1-7 days',
      low: '>7 days',
    },
  },
  meanTimeToRecovery: {
    title: 'Mean Time to Recovery',
    description: 'Time to recover from incidents',
    icon: AlertTriangle,
    goodDirection: 'lower',
    benchmarks: {
      elite: '<1 hour',
      high: '<1 hour',
      medium: '1-24 hours',
      low: '>24 hours',
    },
  },
  changeFailureRate: {
    title: 'Change Failure Rate',
    description: 'Percentage of deployments causing failures',
    icon: XCircle,
    goodDirection: 'lower',
    benchmarks: {
      elite: '≤5%',
      high: '5-15%',
      medium: '15-30%',
      low: '>30%',
    },
  },
};

const TrendIndicator = ({ trend }: { trend: MetricTrend }) => {
  const Icon =
    trend.direction === 'improving'
      ? TrendingUp
      : trend.direction === 'declining'
      ? TrendingDown
      : Minus;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        trend.direction === 'improving' && 'text-green-600 dark:text-green-400',
        trend.direction === 'declining' && 'text-red-600 dark:text-red-400',
        trend.direction === 'stable' && 'text-gray-500 dark:text-gray-400'
      )}
    >
      <Icon className="h-3 w-3" />
      <span>
        {trend.percentageChange > 0 ? '+' : ''}
        {trend.percentageChange}%
      </span>
    </div>
  );
};

const MetricCard = ({
  metricKey,
  value,
  unit,
  level,
  trend,
  onClick,
}: {
  metricKey: keyof typeof METRIC_CONFIG;
  value: number;
  unit?: string;
  level: PerformanceLevel;
  trend: MetricTrend;
  onClick?: () => void;
}) => {
  const config = METRIC_CONFIG[metricKey];
  const colors = PERFORMANCE_COLORS[level];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 p-5 transition-all cursor-pointer hover:shadow-lg',
        colors.border,
        'bg-white dark:bg-gray-900'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.text)} />
        </div>
        <span
          className={cn(
            'px-2 py-1 text-xs font-semibold rounded-full uppercase',
            colors.bg,
            colors.text
          )}
        >
          {level}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
          {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white">{config.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <TrendIndicator trend={trend} />
        <span className="text-xs text-gray-400">vs {trend.comparedTo}</span>
      </div>
    </div>
  );
};

const PerformanceSummary = ({ level }: { level: PerformanceLevel }) => {
  const colors = PERFORMANCE_COLORS[level];
  const summaries: Record<PerformanceLevel, { title: string; description: string }> = {
    elite: {
      title: 'Elite Performer',
      description: 'Your team is performing at the highest level of software delivery performance.',
    },
    high: {
      title: 'High Performer',
      description: 'Your team has strong delivery capabilities with room for optimization.',
    },
    medium: {
      title: 'Medium Performer',
      description:
        'Your team has opportunities to improve delivery speed and reliability.',
    },
    low: {
      title: 'Needs Improvement',
      description:
        'Focus on foundational improvements to increase delivery performance.',
    },
  };

  const summary = summaries[level];

  return (
    <div className={cn('rounded-xl p-6', colors.bg)}>
      <div className="flex items-center gap-3 mb-2">
        <Award className={cn('h-6 w-6', colors.text)} />
        <h2 className={cn('text-xl font-bold', colors.text)}>{summary.title}</h2>
      </div>
      <p className={cn('text-sm', colors.text)}>{summary.description}</p>
    </div>
  );
};

const InsightCard = ({ insight }: { insight: DORAInsight }) => {
  const severityColors = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const severityIcons = {
    info: Info,
    warning: AlertTriangle,
    critical: XCircle,
  };

  const SeverityIcon = severityIcons[insight.severity];

  return (
    <div className={cn('rounded-lg border p-4', severityColors[insight.severity])}>
      <div className="flex items-start gap-3">
        <SeverityIcon
          className={cn(
            'h-5 w-5 flex-shrink-0 mt-0.5',
            insight.severity === 'info' && 'text-blue-600',
            insight.severity === 'warning' && 'text-yellow-600',
            insight.severity === 'critical' && 'text-red-600'
          )}
        />
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{insight.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{insight.description}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            <strong>Recommendation:</strong> {insight.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
};

const MiniSparkline = ({ data }: { data: { value: number }[] }) => {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;

  const points = data
    .slice(-14) // Last 14 points
    .map((d, i, arr) => {
      const x = (i / (arr.length - 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 50" className="w-full h-12">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-500"
      />
    </svg>
  );
};

export function DORADashboard({
  metrics,
  insights = [],
  onPeriodChange,
  onDrillDown,
  className,
}: DORADashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<MetricPeriod>('month');
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const handlePeriodChange = (period: MetricPeriod) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">DORA Metrics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            DevOps Research and Assessment performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {(['week', 'month', 'quarter'] as MetricPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                  selectedPeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                {period}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBenchmarks(!showBenchmarks)}
          >
            <Target className="h-4 w-4 mr-2" />
            Benchmarks
          </Button>
        </div>
      </div>

      {/* Overall Performance */}
      <PerformanceSummary level={metrics.overallPerformance} />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="deploymentFrequency"
          value={metrics.deploymentFrequency.value}
          unit={metrics.deploymentFrequency.unit.replace('_', '/')}
          level={metrics.deploymentFrequency.performanceLevel}
          trend={metrics.deploymentFrequency.trend}
          onClick={() => onDrillDown?.('deploymentFrequency')}
        />
        <MetricCard
          metricKey="leadTimeForChanges"
          value={metrics.leadTimeForChanges.value}
          unit={metrics.leadTimeForChanges.unit}
          level={metrics.leadTimeForChanges.performanceLevel}
          trend={metrics.leadTimeForChanges.trend}
          onClick={() => onDrillDown?.('leadTimeForChanges')}
        />
        <MetricCard
          metricKey="meanTimeToRecovery"
          value={metrics.meanTimeToRecovery.value}
          unit={metrics.meanTimeToRecovery.unit}
          level={metrics.meanTimeToRecovery.performanceLevel}
          trend={metrics.meanTimeToRecovery.trend}
          onClick={() => onDrillDown?.('meanTimeToRecovery')}
        />
        <MetricCard
          metricKey="changeFailureRate"
          value={metrics.changeFailureRate.value}
          unit="%"
          level={metrics.changeFailureRate.performanceLevel}
          trend={metrics.changeFailureRate.trend}
          onClick={() => onDrillDown?.('changeFailureRate')}
        />
      </div>

      {/* Benchmarks Panel */}
      {showBenchmarks && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            DORA Performance Benchmarks (2023)
          </h3>
          <div className="grid grid-cols-5 gap-4">
            <div></div>
            {(['elite', 'high', 'medium', 'low'] as PerformanceLevel[]).map((level) => {
              const colors = PERFORMANCE_COLORS[level];
              return (
                <div
                  key={level}
                  className={cn(
                    'text-center py-2 px-3 rounded-lg font-medium capitalize',
                    colors.bg,
                    colors.text
                  )}
                >
                  {level}
                </div>
              );
            })}
            {Object.entries(METRIC_CONFIG).map(([key, config]) => (
              <React.Fragment key={key}>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  {config.title}
                </div>
                {(['elite', 'high', 'medium', 'low'] as PerformanceLevel[]).map((level) => (
                  <div
                    key={`${key}-${level}`}
                    className="text-sm text-gray-600 dark:text-gray-400 text-center"
                  >
                    {config.benchmarks[level]}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployment Frequency Trend */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Deployment Trend</h3>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <MiniSparkline data={metrics.deploymentFrequency.history} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Last {metrics.deploymentFrequency.history.length} data points
          </p>
        </div>

        {/* Lead Time Trend */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Lead Time Trend</h3>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </div>
          <MiniSparkline data={metrics.leadTimeForChanges.history} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Last {metrics.leadTimeForChanges.history.length} data points
          </p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Insights & Recommendations
          </h3>
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      {metrics.deploymentFrequency.breakdown && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Deployment Frequency by Team
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.deploymentFrequency.breakdown.byTeam || {}).map(
              ([team, value]) => (
                <div key={team} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-40 truncate">
                    {team.replace(/-/g, ' ')}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (value / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                    {value}/week
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <p className="text-xs text-gray-400 text-center">
        Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}

export default DORADashboard;
