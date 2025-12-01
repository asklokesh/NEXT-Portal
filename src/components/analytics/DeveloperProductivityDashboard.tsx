'use client';

/**
 * Developer Productivity Dashboard
 * Track individual and team developer productivity metrics
 */

import React, { useState } from 'react';
import {
  Code,
  GitPullRequest,
  GitCommit,
  MessageSquare,
  Clock,
  Target,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Filter,
  BarChart3,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  DeveloperActivityMetrics,
  TeamProductivityMetrics,
  EngineeringKPIs,
} from '@/services/analytics/dora-metrics';

interface DeveloperProductivityDashboardProps {
  teamMetrics?: TeamProductivityMetrics;
  developerMetrics?: DeveloperActivityMetrics[];
  engineeringKPIs?: EngineeringKPIs;
  className?: string;
}

// Sample data for demonstration
const SAMPLE_DEVELOPERS: DeveloperActivityMetrics[] = [
  {
    developerId: 'dev-1',
    developerName: 'Alice Chen',
    period: 'month',
    commits: 87,
    pullRequestsOpened: 24,
    pullRequestsReviewed: 31,
    pullRequestsMerged: 22,
    codeReviewComments: 156,
    linesAdded: 4523,
    linesRemoved: 2341,
    avgPRSize: 245,
    avgTimeToFirstReview: 2.3,
    avgTimeToMerge: 18.5,
    reviewDepth: 4.2,
    collaborationScore: 92,
    focusTime: 78,
    meetingTime: 22,
  },
  {
    developerId: 'dev-2',
    developerName: 'Bob Martinez',
    period: 'month',
    commits: 65,
    pullRequestsOpened: 18,
    pullRequestsReviewed: 42,
    pullRequestsMerged: 16,
    codeReviewComments: 198,
    linesAdded: 3102,
    linesRemoved: 1876,
    avgPRSize: 198,
    avgTimeToFirstReview: 1.8,
    avgTimeToMerge: 15.2,
    reviewDepth: 5.1,
    collaborationScore: 95,
    focusTime: 72,
    meetingTime: 28,
  },
  {
    developerId: 'dev-3',
    developerName: 'Carol Williams',
    period: 'month',
    commits: 102,
    pullRequestsOpened: 28,
    pullRequestsReviewed: 19,
    pullRequestsMerged: 26,
    codeReviewComments: 87,
    linesAdded: 5891,
    linesRemoved: 3012,
    avgPRSize: 312,
    avgTimeToFirstReview: 3.1,
    avgTimeToMerge: 22.4,
    reviewDepth: 2.8,
    collaborationScore: 78,
    focusTime: 85,
    meetingTime: 15,
  },
  {
    developerId: 'dev-4',
    developerName: 'David Kim',
    period: 'month',
    commits: 54,
    pullRequestsOpened: 15,
    pullRequestsReviewed: 38,
    pullRequestsMerged: 14,
    codeReviewComments: 212,
    linesAdded: 2156,
    linesRemoved: 1543,
    avgPRSize: 156,
    avgTimeToFirstReview: 1.2,
    avgTimeToMerge: 12.8,
    reviewDepth: 5.8,
    collaborationScore: 98,
    focusTime: 68,
    meetingTime: 32,
  },
];

const SAMPLE_TEAM: TeamProductivityMetrics = {
  teamId: 'platform-team',
  teamName: 'Platform Team',
  period: 'month',
  totalCommits: 308,
  totalPRsOpened: 85,
  totalPRsMerged: 78,
  avgCycleTime: 18.2,
  avgReviewTime: 4.5,
  throughput: 78,
  velocity: 145,
  sprintCompletion: 87,
  bugEscapeRate: 3.2,
  techDebtRatio: 12,
  codeChurn: 18,
  testCoverage: 82,
  documentationCoverage: 68,
  memberCount: 4,
  activeContributors: 4,
};

const SAMPLE_KPIS: EngineeringKPIs = {
  velocity: { current: 145, target: 150, trend: 5.2 },
  quality: { current: 94, target: 95, trend: 1.8 },
  efficiency: { current: 78, target: 85, trend: -2.1 },
  collaboration: { current: 91, target: 90, trend: 3.5 },
  innovation: { current: 72, target: 80, trend: 8.2 },
};

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// KPI Gauge Component
function KPIGauge({
  label,
  current,
  target,
  trend,
  unit = '',
}: {
  label: string;
  current: number;
  target: number;
  trend: number;
  unit?: string;
}) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOnTrack = current >= target;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatNumber(current)}
          {unit}
        </span>
        <span className="text-sm text-gray-400">/ {target}{unit}</span>
      </div>
      <div className="mt-2">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isOnTrack ? 'bg-green-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Metric Card
function MetricCard({
  label,
  value,
  icon: Icon,
  subtext,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  subtext?: string;
  trend?: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            {trend !== undefined && (
              <span
                className={cn(
                  'text-xs font-medium',
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-xs text-gray-400">{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Developer Leaderboard
function DeveloperLeaderboard({
  developers,
  metric,
  title,
}: {
  developers: DeveloperActivityMetrics[];
  metric: keyof DeveloperActivityMetrics;
  title: string;
}) {
  const sorted = [...developers].sort((a, b) => {
    const aVal = a[metric] as number;
    const bVal = b[metric] as number;
    return bVal - aVal;
  });

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sorted.map((dev, index) => (
          <div
            key={dev.developerId}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{medals[index] || `#${index + 1}`}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {dev.developerName.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {dev.developerName}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatNumber(dev[metric] as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Developer Activity Chart (simplified)
function DeveloperActivityBar({ developer }: { developer: DeveloperActivityMetrics }) {
  const maxValue = Math.max(
    developer.commits,
    developer.pullRequestsOpened * 5,
    developer.pullRequestsReviewed * 5,
    developer.codeReviewComments / 3
  );

  const bars = [
    { label: 'Commits', value: developer.commits, color: 'bg-blue-500' },
    { label: 'PRs Opened', value: developer.pullRequestsOpened * 5, color: 'bg-green-500' },
    { label: 'Reviews', value: developer.pullRequestsReviewed * 5, color: 'bg-purple-500' },
    { label: 'Comments', value: developer.codeReviewComments / 3, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">{bar.label}</span>
          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
            <div
              className={cn(bar.color, 'h-full rounded transition-all')}
              style={{ width: `${(bar.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Developer Detail Card
function DeveloperDetailCard({ developer }: { developer: DeveloperActivityMetrics }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
          {developer.developerName.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {developer.developerName}
          </h3>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <GitCommit className="h-3 w-3" />
              {developer.commits} commits
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" />
              {developer.pullRequestsMerged} merged
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {developer.codeReviewComments} reviews
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <Award className="h-4 w-4 text-yellow-500" />
            <span className="font-bold text-gray-900 dark:text-white">
              {developer.collaborationScore}
            </span>
          </div>
          <span className="text-xs text-gray-500">Collab Score</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatHours(developer.avgTimeToMerge)}
          </p>
          <p className="text-xs text-gray-500">Avg Merge Time</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {developer.avgPRSize}
          </p>
          <p className="text-xs text-gray-500">Avg PR Size</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {developer.focusTime}%
          </p>
          <p className="text-xs text-gray-500">Focus Time</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {developer.reviewDepth.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500">Review Depth</p>
        </div>
      </div>

      <div className="mt-4">
        <DeveloperActivityBar developer={developer} />
      </div>
    </div>
  );
}

// Team Summary Card
function TeamSummaryCard({ team }: { team: TeamProductivityMetrics }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{team.teamName}</h3>
          <p className="text-sm text-gray-500">{team.memberCount} members • {team.activeContributors} active</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{team.totalCommits}</p>
          <p className="text-xs text-gray-500">Total Commits</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{team.totalPRsMerged}</p>
          <p className="text-xs text-gray-500">PRs Merged</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatHours(team.avgCycleTime)}</p>
          <p className="text-xs text-gray-500">Avg Cycle Time</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{team.sprintCompletion}%</p>
          <p className="text-xs text-gray-500">Sprint Completion</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="font-bold text-gray-900 dark:text-white">{team.testCoverage}%</span>
          </div>
          <p className="text-xs text-gray-500">Test Coverage</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="font-bold text-gray-900 dark:text-white">{team.techDebtRatio}%</span>
          </div>
          <p className="text-xs text-gray-500">Tech Debt</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="font-bold text-gray-900 dark:text-white">{team.bugEscapeRate}%</span>
          </div>
          <p className="text-xs text-gray-500">Bug Escape Rate</p>
        </div>
      </div>
    </div>
  );
}

export function DeveloperProductivityDashboard({
  teamMetrics = SAMPLE_TEAM,
  developerMetrics = SAMPLE_DEVELOPERS,
  engineeringKPIs = SAMPLE_KPIS,
  className,
}: DeveloperProductivityDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedView, setSelectedView] = useState<'team' | 'individual'>('team');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Developer Productivity
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track team and individual developer performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              onClick={() => setSelectedView('team')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-l-lg transition-colors',
                selectedView === 'team'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              )}
            >
              Team
            </button>
            <button
              onClick={() => setSelectedView('individual')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-r-lg transition-colors',
                selectedView === 'individual'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              )}
            >
              Individual
            </button>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>
      </div>

      {/* Engineering KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPIGauge
          label="Velocity"
          current={engineeringKPIs.velocity.current}
          target={engineeringKPIs.velocity.target}
          trend={engineeringKPIs.velocity.trend}
          unit=" pts"
        />
        <KPIGauge
          label="Quality"
          current={engineeringKPIs.quality.current}
          target={engineeringKPIs.quality.target}
          trend={engineeringKPIs.quality.trend}
          unit="%"
        />
        <KPIGauge
          label="Efficiency"
          current={engineeringKPIs.efficiency.current}
          target={engineeringKPIs.efficiency.target}
          trend={engineeringKPIs.efficiency.trend}
          unit="%"
        />
        <KPIGauge
          label="Collaboration"
          current={engineeringKPIs.collaboration.current}
          target={engineeringKPIs.collaboration.target}
          trend={engineeringKPIs.collaboration.trend}
          unit="%"
        />
        <KPIGauge
          label="Innovation"
          current={engineeringKPIs.innovation.current}
          target={engineeringKPIs.innovation.target}
          trend={engineeringKPIs.innovation.trend}
          unit="%"
        />
      </div>

      {/* Team Summary */}
      <TeamSummaryCard team={teamMetrics} />

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Total Commits"
          value={teamMetrics.totalCommits}
          icon={GitCommit}
          trend={12.5}
        />
        <MetricCard
          label="PRs Opened"
          value={teamMetrics.totalPRsOpened}
          icon={GitPullRequest}
          trend={8.2}
        />
        <MetricCard
          label="Throughput"
          value={`${teamMetrics.throughput} PRs`}
          icon={Zap}
          subtext="merged this period"
        />
        <MetricCard
          label="Avg Review Time"
          value={formatHours(teamMetrics.avgReviewTime)}
          icon={Clock}
          trend={-15.3}
        />
        <MetricCard
          label="Code Churn"
          value={`${teamMetrics.codeChurn}%`}
          icon={Activity}
          trend={-5.2}
        />
        <MetricCard
          label="Doc Coverage"
          value={`${teamMetrics.documentationCoverage}%`}
          icon={Code}
          trend={3.8}
        />
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DeveloperLeaderboard
          developers={developerMetrics}
          metric="commits"
          title="🚀 Most Commits"
        />
        <DeveloperLeaderboard
          developers={developerMetrics}
          metric="pullRequestsReviewed"
          title="👀 Top Reviewers"
        />
        <DeveloperLeaderboard
          developers={developerMetrics}
          metric="collaborationScore"
          title="🤝 Collaboration Leaders"
        />
      </div>

      {/* Individual Developer Cards */}
      {selectedView === 'individual' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Individual Performance
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {developerMetrics.map((developer) => (
              <DeveloperDetailCard key={developer.developerId} developer={developer} />
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-green-600" />
          Productivity Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Review turnaround improved 15%
              </p>
              <p className="text-sm text-gray-500">
                Average first review time decreased from 5.3h to 4.5h
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                PR size trending upward
              </p>
              <p className="text-sm text-gray-500">
                Consider breaking larger PRs into smaller, reviewable chunks
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Sprint completion rate at 87%
              </p>
              <p className="text-sm text-gray-500">
                Above team target of 85% for the third consecutive sprint
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                David Kim leads in code reviews
              </p>
              <p className="text-sm text-gray-500">
                Highest review depth score (5.8) and fastest first review time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeveloperProductivityDashboard;
