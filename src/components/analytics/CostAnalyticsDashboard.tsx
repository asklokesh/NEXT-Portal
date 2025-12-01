'use client';

/**
 * Cost Analytics Dashboard
 * Infrastructure cost tracking, forecasting, and optimization recommendations
 */

import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Server,
  Cloud,
  Database,
  HardDrive,
  Cpu,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  InfrastructureCostMetrics,
  ServiceCost,
  TeamCost,
  CostForecast,
  CostAnomaly,
  CostOptimization,
} from '@/services/analytics/dora-metrics';

interface CostAnalyticsDashboardProps {
  metrics?: InfrastructureCostMetrics;
  className?: string;
}

// Sample data for demonstration
const SAMPLE_METRICS: InfrastructureCostMetrics = {
  totalCost: 125000,
  currency: 'USD',
  period: 'month',
  breakdown: {
    compute: 45000,
    storage: 25000,
    network: 15000,
    database: 30000,
    other: 10000,
  },
  byCloud: {
    aws: 75000,
    gcp: 35000,
    azure: 15000,
  },
  byEnvironment: {
    production: 85000,
    staging: 25000,
    development: 15000,
  },
  byService: [
    { serviceId: 'api-gateway', serviceName: 'API Gateway', cost: 18000, trend: 5.2 },
    { serviceId: 'user-service', serviceName: 'User Service', cost: 15000, trend: -2.1 },
    { serviceId: 'payment-service', serviceName: 'Payment Service', cost: 22000, trend: 12.5 },
    { serviceId: 'data-pipeline', serviceName: 'Data Pipeline', cost: 28000, trend: 8.3 },
    { serviceId: 'ml-inference', serviceName: 'ML Inference', cost: 12000, trend: 25.0 },
  ],
  byTeam: [
    { teamId: 'platform', teamName: 'Platform Team', cost: 45000, budget: 50000, variance: -10 },
    { teamId: 'backend', teamName: 'Backend Team', cost: 35000, budget: 30000, variance: 16.7 },
    { teamId: 'data', teamName: 'Data Team', cost: 32000, budget: 35000, variance: -8.6 },
    { teamId: 'ml', teamName: 'ML Team', cost: 13000, budget: 15000, variance: -13.3 },
  ],
  forecast: {
    nextMonth: 132000,
    nextQuarter: 405000,
    confidence: 0.85,
    trend: 'increasing',
    factors: [
      'ML inference workload growth',
      'New microservices deployment',
      'Seasonal traffic increase',
    ],
  },
  anomalies: [
    {
      id: 'anom-1',
      serviceId: 'payment-service',
      description: 'Unusual spike in compute costs',
      expectedCost: 18000,
      actualCost: 22000,
      variance: 22.2,
      severity: 'high',
      detectedAt: new Date().toISOString(),
      possibleCauses: ['Traffic spike', 'Inefficient queries', 'Resource leak'],
    },
    {
      id: 'anom-2',
      serviceId: 'ml-inference',
      description: 'Rapid growth in GPU costs',
      expectedCost: 9000,
      actualCost: 12000,
      variance: 33.3,
      severity: 'medium',
      detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      possibleCauses: ['Model scaling', 'Batch size increase'],
    },
  ],
  optimizations: [
    {
      id: 'opt-1',
      title: 'Right-size underutilized instances',
      description: 'Several instances are running at <20% CPU. Consider downsizing or using spot instances.',
      estimatedSavings: 8500,
      effort: 'medium',
      priority: 'high',
      affectedServices: ['api-gateway', 'user-service'],
      implementation: 'Update instance types in Terraform configuration',
    },
    {
      id: 'opt-2',
      title: 'Enable storage tiering',
      description: 'Move infrequently accessed data to cold storage tier.',
      estimatedSavings: 4200,
      effort: 'low',
      priority: 'medium',
      affectedServices: ['data-pipeline'],
      implementation: 'Configure S3 lifecycle policies for log buckets',
    },
    {
      id: 'opt-3',
      title: 'Use reserved instances for stable workloads',
      description: 'Production workloads have stable patterns. Reserved instances would reduce costs.',
      estimatedSavings: 15000,
      effort: 'low',
      priority: 'high',
      affectedServices: ['payment-service', 'api-gateway', 'user-service'],
      implementation: 'Purchase 1-year reserved instances for core services',
    },
    {
      id: 'opt-4',
      title: 'Implement auto-scaling for dev environments',
      description: 'Dev environments run 24/7 but are only used during business hours.',
      estimatedSavings: 3500,
      effort: 'medium',
      priority: 'low',
      affectedServices: [],
      implementation: 'Add scheduled scaling policies to reduce dev resources off-hours',
    },
  ],
  trends: [
    { date: '2024-01-01', cost: 105000 },
    { date: '2024-02-01', cost: 108000 },
    { date: '2024-03-01', cost: 112000 },
    { date: '2024-04-01', cost: 118000 },
    { date: '2024-05-01', cost: 122000 },
    { date: '2024-06-01', cost: 125000 },
  ],
};

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Cost Overview Card
function CostOverviewCard({
  title,
  value,
  trend,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  trend?: number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend > 0 ? 'text-red-600' : 'text-green-600'
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {formatPercentage(trend)}
          </div>
        )}
      </div>
      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}

// Cost Breakdown Chart (simplified bar chart)
function CostBreakdownChart({
  breakdown,
  title,
}: {
  breakdown: Record<string, number>;
  title: string;
}) {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const items = Object.entries(breakdown)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      percentage: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>

      {/* Stacked bar */}
      <div className="h-8 rounded-lg overflow-hidden flex mb-4">
        {items.map((item, index) => (
          <div
            key={item.name}
            className={cn(colors[index % colors.length], 'transition-all')}
            style={{ width: `${item.percentage}%` }}
            title={`${item.name}: ${formatCurrency(item.value)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', colors[index % colors.length])} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {item.name}: {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Service Cost Table
function ServiceCostTable({ services }: { services: ServiceCost[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost by Service</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {services.map((service) => (
              <tr key={service.serviceId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {service.serviceName}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                  {formatCurrency(service.cost)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-sm font-medium',
                      service.trend > 0 ? 'text-red-600' : 'text-green-600'
                    )}
                  >
                    {service.trend > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercentage(service.trend)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Team Budget Table
function TeamBudgetTable({ teams }: { teams: TeamCost[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Budget Tracking</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Team
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Budget
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Variance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {teams.map((team) => {
              const utilizationPct = (team.cost / team.budget) * 100;
              return (
                <tr key={team.teamId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {team.teamName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                    {formatCurrency(team.cost)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(team.budget)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        team.variance > 0 ? 'text-red-600' : 'text-green-600'
                      )}
                    >
                      {formatPercentage(team.variance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-32">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            utilizationPct > 100
                              ? 'bg-red-500'
                              : utilizationPct > 90
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          )}
                          style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{utilizationPct.toFixed(0)}% used</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Anomaly Card
function AnomalyCard({ anomaly }: { anomaly: CostAnomaly }) {
  const severityColors = {
    low: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    high: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  };

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 p-4',
        severityColors[anomaly.severity]
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn(
            'h-5 w-5 flex-shrink-0',
            anomaly.severity === 'high'
              ? 'text-red-600'
              : anomaly.severity === 'medium'
              ? 'text-yellow-600'
              : 'text-blue-600'
          )}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {anomaly.description}
            </h4>
            <span className="text-sm text-red-600 font-semibold">
              +{formatPercentage(anomaly.variance)}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Expected: {formatCurrency(anomaly.expectedCost)} → Actual: {formatCurrency(anomaly.actualCost)}
          </p>
          {anomaly.possibleCauses && anomaly.possibleCauses.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Possible causes:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {anomaly.possibleCauses.map((cause, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded"
                  >
                    {cause}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Optimization Card
function OptimizationCard({ optimization }: { optimization: CostOptimization }) {
  const effortColors = {
    low: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    high: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  const priorityColors = {
    low: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
    medium: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    high: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
          <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {optimization.title}
            </h4>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(optimization.estimatedSavings)}/mo
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {optimization.description}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className={cn('text-xs px-2 py-0.5 rounded', priorityColors[optimization.priority])}>
              {optimization.priority} priority
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded', effortColors[optimization.effort])}>
              {optimization.effort} effort
            </span>
          </div>
          {optimization.affectedServices && optimization.affectedServices.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {optimization.affectedServices.map((service) => (
                <span
                  key={service}
                  className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400"
                >
                  {service}
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="mt-3">
            View Implementation
          </Button>
        </div>
      </div>
    </div>
  );
}

// Forecast Card
function ForecastCard({ forecast, currentCost }: { forecast: CostForecast; currentCost: number }) {
  const monthlyChange = ((forecast.nextMonth - currentCost) / currentCost) * 100;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Forecast</h3>
        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
          {(forecast.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Next Month</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(forecast.nextMonth)}
            </p>
            <span
              className={cn(
                'text-sm font-medium',
                monthlyChange > 0 ? 'text-red-600' : 'text-green-600'
              )}
            >
              {formatPercentage(monthlyChange)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Next Quarter</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(forecast.nextQuarter)}
          </p>
        </div>
      </div>

      {forecast.factors && forecast.factors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Contributing factors:</p>
          <ul className="space-y-1">
            {forecast.factors.map((factor, index) => (
              <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CostAnalyticsDashboard({
  metrics = SAMPLE_METRICS,
  className,
}: CostAnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const totalOptimizationSavings = useMemo(() => {
    return metrics.optimizations.reduce((sum, opt) => sum + opt.estimatedSavings, 0);
  }, [metrics.optimizations]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cost Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track infrastructure costs, identify anomalies, and optimize spending
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CostOverviewCard
          title="Total Cost"
          value={formatCurrency(metrics.totalCost)}
          trend={8.5}
          icon={DollarSign}
          description="vs. last month"
        />
        <CostOverviewCard
          title="Compute Costs"
          value={formatCurrency(metrics.breakdown.compute)}
          trend={5.2}
          icon={Cpu}
        />
        <CostOverviewCard
          title="Potential Savings"
          value={formatCurrency(totalOptimizationSavings)}
          icon={Lightbulb}
          description={`${metrics.optimizations.length} recommendations`}
        />
        <CostOverviewCard
          title="Anomalies Detected"
          value={String(metrics.anomalies.length)}
          icon={AlertTriangle}
          description="Requires attention"
        />
      </div>

      {/* Cost Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CostBreakdownChart breakdown={metrics.breakdown} title="Cost by Category" />
        <CostBreakdownChart breakdown={metrics.byCloud} title="Cost by Cloud Provider" />
        <CostBreakdownChart breakdown={metrics.byEnvironment} title="Cost by Environment" />
      </div>

      {/* Forecast */}
      <ForecastCard forecast={metrics.forecast} currentCost={metrics.totalCost} />

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceCostTable services={metrics.byService} />
        <TeamBudgetTable teams={metrics.byTeam} />
      </div>

      {/* Anomalies */}
      {metrics.anomalies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cost Anomalies
          </h3>
          <div className="space-y-3">
            {metrics.anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* Optimization Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Optimization Recommendations
          </h3>
          <span className="text-sm text-green-600 font-medium">
            Total potential savings: {formatCurrency(totalOptimizationSavings)}/month
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metrics.optimizations.map((optimization) => (
            <OptimizationCard key={optimization.id} optimization={optimization} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CostAnalyticsDashboard;
