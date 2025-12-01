'use client';

/**
 * Widget Renderer Component
 * Renders different widget types with their specific implementations
 */

import React, { Suspense, lazy, useMemo } from 'react';
import {
  BarChart3,
  Activity,
  AlertTriangle,
  GitBranch,
  FileText,
  Users,
  Box,
  CheckCircle,
  Clock,
  Code,
  Loader2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetConfig, WidgetType, WidgetInstance } from './types';
import { Button } from '@/components/ui/Button';

// Widget Loading Skeleton
function WidgetSkeleton() {
  return (
    <div className="animate-pulse h-full w-full">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
    </div>
  );
}

// Widget Error Boundary Fallback
function WidgetError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{error}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// Widget Header
interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  isEditing?: boolean;
  onEdit?: () => void;
}

function WidgetHeader({ title, subtitle, actions, isEditing, onEdit }: WidgetHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        {isEditing && (
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// Individual Widget Implementations

// Service Card Widget
function ServiceCardWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    name: 'user-service',
    description: 'User authentication and profile management',
    owner: 'platform-team',
    lifecycle: 'production',
    health: 'healthy',
  };

  const healthColors = {
    healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    degraded: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader title={config.title || 'Service'} />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-blue-500" />
          <span className="font-medium text-gray-900 dark:text-white">{data.name}</span>
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              healthColors[data.health as keyof typeof healthColors] || healthColors.healthy
            )}
          >
            {data.health}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{data.description}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {data.owner}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {data.lifecycle}
          </span>
        </div>
      </div>
    </div>
  );
}

// Stats Card Widget
function StatsCardWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    value: '99.9%',
    label: 'Uptime',
    trend: 0.5,
    trendLabel: 'vs last week',
  };

  const isPositive = data.trend >= 0;

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="text-3xl font-bold text-gray-900 dark:text-white">{data.value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.label}</div>
      {data.trend !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs mt-2',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>
            {isPositive ? '+' : ''}
            {data.trend}%
          </span>
          <span className="text-gray-400">{data.trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// Scorecard Widget
function ScorecardWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    score: 85,
    maxScore: 100,
    checks: [
      { name: 'Documentation', passed: true },
      { name: 'Code Owners', passed: true },
      { name: 'Test Coverage', passed: false },
      { name: 'Security Scan', passed: true },
    ],
  };

  const percentage = (data.score / data.maxScore) * 100;
  const passedChecks = data.checks.filter((c: { passed: boolean }) => c.passed).length;

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader
        title={config.title || 'Health Score'}
        subtitle={`${passedChecks}/${data.checks.length} checks passing`}
      />
      <div className="flex-1">
        {/* Score Circle */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 2.83} 283`}
                transform="rotate(-90 50 50)"
                className={cn(
                  percentage >= 80
                    ? 'text-green-500'
                    : percentage >= 60
                    ? 'text-yellow-500'
                    : 'text-red-500'
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.score}
              </span>
            </div>
          </div>
        </div>

        {/* Checks List */}
        <div className="space-y-2">
          {data.checks.slice(0, 4).map((check: { name: string; passed: boolean }, index: number) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{check.name}</span>
              {check.passed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Deployments Widget
function DeploymentsWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    deployments: [
      { id: '1', env: 'production', status: 'success', time: '2 hours ago', version: 'v2.1.0' },
      { id: '2', env: 'staging', status: 'success', time: '5 hours ago', version: 'v2.1.1' },
      { id: '3', env: 'development', status: 'failed', time: '1 day ago', version: 'v2.1.2' },
    ],
  };

  const statusColors = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader title={config.title || 'Recent Deployments'} />
      <div className="flex-1 overflow-y-auto space-y-3">
        {data.deployments.map((deploy: { id: string; env: string; status: string; time: string; version: string }) => (
          <div
            key={deploy.id}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {deploy.version}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{deploy.env}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  statusColors[deploy.status as keyof typeof statusColors]
                )}
              >
                {deploy.status}
              </span>
              <span className="text-xs text-gray-400">{deploy.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Incidents Widget
function IncidentsWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    incidents: [
      { id: '1', title: 'API Latency Spike', severity: 'warning', time: '30 min ago' },
      { id: '2', title: 'Database Connection Issues', severity: 'critical', time: '2 hours ago' },
    ],
    total: 2,
  };

  const severityColors = {
    info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  };

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader
        title={config.title || 'Active Incidents'}
        subtitle={`${data.total} open`}
      />
      <div className="flex-1 overflow-y-auto space-y-3">
        {data.incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <CheckCircle className="h-8 w-8 mb-2" />
            <span className="text-sm">No active incidents</span>
          </div>
        ) : (
          data.incidents.map((incident: { id: string; title: string; severity: string; time: string }) => (
            <div
              key={incident.id}
              className={cn(
                'p-3 rounded-lg border-l-4',
                severityColors[incident.severity as keyof typeof severityColors]
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      'h-4 w-4',
                      incident.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                    )}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {incident.title}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{incident.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Dependency Graph Widget
function DependencyGraphWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    nodes: [
      { id: 'user-service', type: 'service' },
      { id: 'auth-api', type: 'api' },
      { id: 'postgres', type: 'database' },
    ],
    edges: [
      { from: 'user-service', to: 'auth-api' },
      { from: 'user-service', to: 'postgres' },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader title={config.title || 'Dependencies'} />
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-center">
          <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.nodes.length} nodes, {data.edges.length} connections
          </p>
          <Button variant="outline" size="sm" className="mt-2">
            View Full Graph
          </Button>
        </div>
      </div>
    </div>
  );
}

// TechDocs Widget
function TechDocsWidget({ config }: { config: WidgetConfig }) {
  return (
    <div className="h-full flex flex-col">
      <WidgetHeader
        title={config.title || 'Documentation'}
        actions={
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-3 w-3" />
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
        <p className="text-gray-600 dark:text-gray-400">
          Technical documentation content will be rendered here from your TechDocs source.
        </p>
        <h4>Getting Started</h4>
        <p>This is a sample documentation section showing how TechDocs content appears in widgets.</p>
        <h4>API Reference</h4>
        <p>API documentation would be displayed here with code examples and endpoint details.</p>
      </div>
    </div>
  );
}

// Entity List Widget
function EntityListWidget({ config }: { config: WidgetConfig }) {
  const data = config.dataSource?.mockData || {
    entities: [
      { name: 'user-service', kind: 'Component', owner: 'platform-team' },
      { name: 'payment-api', kind: 'API', owner: 'payments-team' },
      { name: 'order-service', kind: 'Component', owner: 'commerce-team' },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <WidgetHeader title={config.title || 'Entities'} subtitle={`${data.entities.length} items`} />
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Kind</th>
              <th className="pb-2 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {data.entities.map((entity: { name: string; kind: string; owner: string }, index: number) => (
              <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-900 dark:text-white">{entity.name}</td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{entity.kind}</td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{entity.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Markdown Widget
function MarkdownWidget({ config }: { config: WidgetConfig }) {
  const content = config.settings?.content || '# Welcome\n\nAdd your markdown content here.';

  return (
    <div className="h-full flex flex-col">
      {config.title && <WidgetHeader title={config.title} />}
      <div className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}

// iFrame Widget
function IFrameWidget({ config }: { config: WidgetConfig }) {
  const url = config.settings?.url || '';

  if (!url) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Configure the URL in widget settings</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {config.title && <WidgetHeader title={config.title} />}
      <iframe
        src={url}
        className="flex-1 w-full border-0 rounded-lg"
        title={config.title || 'Embedded content'}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

// Placeholder Widget for unimplemented types
function PlaceholderWidget({ config, type }: { config: WidgetConfig; type: string }) {
  return (
    <div className="h-full flex flex-col">
      <WidgetHeader title={config.title || type} />
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-center">
          <Box className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Widget: {type}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

// Widget type to component mapping
const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType<{ config: WidgetConfig }>> = {
  'service-card': ServiceCardWidget,
  'entity-list': EntityListWidget,
  'dependency-graph': DependencyGraphWidget,
  'team-card': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'api-list': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'scorecard': ScorecardWidget,
  'metric-chart': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'stats-card': StatsCardWidget,
  'gauge': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'pie-chart': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'bar-chart': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'incidents': IncidentsWidget,
  'deployments': DeploymentsWidget,
  'pipeline-status': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'environment-status': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'resource-usage': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'tech-docs': TechDocsWidget,
  'api-docs': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'readme': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'changelog': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'github-activity': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'jira-issues': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'slack-channel': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'pagerduty': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'datadog': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'grafana': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'tabs': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'grid-container': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'accordion': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'divider': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'custom-component': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'iframe': IFrameWidget,
  'markdown': MarkdownWidget,
  'action-button': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
  'search-bar': PlaceholderWidget as React.ComponentType<{ config: WidgetConfig }>,
};

interface WidgetRendererProps {
  widget: WidgetInstance;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function WidgetRenderer({
  widget,
  isEditing = false,
  isSelected = false,
  onSelect,
  onEdit,
  className,
}: WidgetRendererProps) {
  const Component = WIDGET_COMPONENTS[widget.type] || PlaceholderWidget;

  return (
    <div
      className={cn(
        'h-full w-full p-4 bg-white dark:bg-gray-900 rounded-lg border',
        'transition-all duration-150',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700',
        isEditing && 'cursor-pointer hover:border-blue-400',
        className
      )}
      onClick={isEditing ? onSelect : undefined}
    >
      <Suspense fallback={<WidgetSkeleton />}>
        <Component config={widget.config} />
      </Suspense>
    </div>
  );
}

export default WidgetRenderer;
