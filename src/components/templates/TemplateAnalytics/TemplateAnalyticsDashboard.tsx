'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 BarChart3,
 TrendingUp,
 Clock,
 Users,
 Package,
 CheckCircle,
 XCircle,
 AlertTriangle,
 Calendar,
 Download,
 Star,
 GitFork,
 Activity,
 PieChart,
 Filter,
 RefreshCw
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useTemplatePreferences } from '@/hooks/useTemplatePreferences';
import { cn } from '@/lib/utils';
import { useTemplates, useTasksByTemplate } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity, Task } from '@/services/backstage/types/templates';

interface TemplateAnalyticsDashboardProps {
 className?: string;
}

interface TemplateMetrics {
 templateRef: string;
 template: TemplateEntity;
 totalExecutions: number;
 successfulExecutions: number;
 failedExecutions: number;
 averageExecutionTime: number;
 lastUsed?: string;
 popularityScore: number;
 successRate: number;
 recentTasks: Task[];
}

interface MetricCardProps {
 title: string;
 value: string | number;
 subtitle?: string;
 icon: React.ReactNode;
 trend?: {
 value: number;
 positive: boolean;
 };
 color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({
 title,
 value,
 subtitle,
 icon,
 trend,
 color = 'blue',
}) => {
 const colorClasses = {
 blue: 'text-blue-600 bg-blue-50',
 green: 'text-green-600 bg-green-50',
 red: 'text-red-600 bg-red-50',
 yellow: 'text-yellow-600 bg-yellow-50',
 purple: 'text-purple-600 bg-purple-50',
 };

 return (
 <div className="bg-card rounded-lg border p-6">
 <div className="flex items-center justify-between mb-4">
 <div className={cn('p-2 rounded-lg', colorClasses[color])}>
 {icon}
 </div>
 {trend && (
 <div className={cn(
 'flex items-center gap-1 text-sm',
 trend.positive ? 'text-green-600' : 'text-red-600'
 )}>
 <TrendingUp className={cn('w-4 h-4', !trend.positive && 'rotate-180')} />
 {trend.positive ? '+' : ''}{trend.value}%
 </div>
 )}
 </div>
 
 <div className="space-y-1">
 <h3 className="text-2xl font-bold">{value}</h3>
 <p className="text-sm font-medium">{title}</p>
 {subtitle && (
 <p className="text-xs text-muted-foreground">{subtitle}</p>
 )}
 </div>
 </div>
 );
};

const TemplateRankingTable: React.FC<{
 metrics: TemplateMetrics[];
 sortBy: 'executions' | 'success_rate' | 'popularity';
}> = ({ metrics, sortBy }) => {
 const sortedMetrics = useMemo(() => {
 return [...metrics].sort((a, b) => {
 switch (sortBy) {
 case 'executions':
 return b.totalExecutions - a.totalExecutions;
 case 'success_rate':
 return b.successRate - a.successRate;
 case 'popularity':
 return b.popularityScore - a.popularityScore;
 default:
 return 0;
 }
 });
 }, [metrics, sortBy]);

 return (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b">
 <th className="text-left py-3 px-4 font-medium">Template</th>
 <th className="text-left py-3 px-4 font-medium">Executions</th>
 <th className="text-left py-3 px-4 font-medium">Success Rate</th>
 <th className="text-left py-3 px-4 font-medium">Avg. Time</th>
 <th className="text-left py-3 px-4 font-medium">Last Used</th>
 </tr>
 </thead>
 <tbody>
 {sortedMetrics.slice(0, 10).map((metric, index) => (
 <tr key={metric.templateRef} className="border-b hover:bg-accent/50">
 <td className="py-3 px-4">
 <div className="flex items-center gap-2">
 <span className={cn(
 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
 index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
 )}>
 {index + 1}
 </span>
 <div>
 <p className="font-medium">
 {metric.template.metadata.title || metric.template.metadata.name}
 </p>
 <p className="text-xs text-muted-foreground capitalize">
 {metric.template.spec.type}
 </p>
 </div>
 </div>
 </td>
 <td className="py-3 px-4">
 <div className="flex items-center gap-2">
 <span className="font-medium">{metric.totalExecutions}</span>
 <div className="flex gap-1">
 <div className="w-2 h-2 rounded-full bg-green-500" title="Successful" />
 <div className="w-2 h-2 rounded-full bg-red-500" title="Failed" />
 </div>
 </div>
 </td>
 <td className="py-3 px-4">
 <div className="flex items-center gap-2">
 <span className={cn(
 'font-medium',
 metric.successRate >= 90 ? 'text-green-600' :
 metric.successRate >= 70 ? 'text-yellow-600' : 'text-red-600'
 )}>
 {metric.successRate.toFixed(1)}%
 </span>
 <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
 <div 
 className={cn(
 'h-full transition-all',
 metric.successRate >= 90 ? 'bg-green-500' :
 metric.successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
 )}
 style={{ width: `${metric.successRate}%` }}
 />
 </div>
 </div>
 </td>
 <td className="py-3 px-4">
 <span className="text-sm">
 {Math.round(metric.averageExecutionTime / 1000)}s
 </span>
 </td>
 <td className="py-3 px-4">
 <span className="text-sm text-muted-foreground">
 {metric.lastUsed ? new Date(metric.lastUsed).toLocaleDateString() : 'Never'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
};

export const TemplateAnalyticsDashboard: React.FC<TemplateAnalyticsDashboardProps> = ({
 className,
}) => {
 const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
 const [sortBy, setSortBy] = useState<'executions' | 'success_rate' | 'popularity'>('executions');
 const [refreshing, setRefreshing] = useState(false);

 const { data: templates = [] } = useTemplates();
 const { getStats, recentlyUsed } = useTemplatePreferences();

 // Calculate metrics for each template
 const templateMetrics: TemplateMetrics[] = useMemo(() => {
 return templates.map(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const usage = recentlyUsed.find(u => u.templateRef === templateRef);
 
 // Mock data - in real implementation, this would come from analytics service
 const totalExecutions = usage?.usageCount || Math.floor(Math.random() * 50);
 const successfulExecutions = Math.floor(totalExecutions * (0.7 + Math.random() * 0.3));
 const failedExecutions = totalExecutions - successfulExecutions;
 const averageExecutionTime = 30000 + Math.random() * 120000; // 30s - 2.5min
 const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
 
 // Calculate popularity score based on usage and recency
 const popularityScore = totalExecutions * 
 (usage ? Math.max(0, 1 - (Date.now() - new Date(usage.lastUsed).getTime()) / (30 * 24 * 60 * 60 * 1000)) : 0);

 return {
 templateRef,
 template,
 totalExecutions,
 successfulExecutions,
 failedExecutions,
 averageExecutionTime,
 lastUsed: usage?.lastUsed,
 popularityScore,
 successRate,
 recentTasks: [], // Would be populated from real data
 };
 });
 }, [templates, recentlyUsed]);

 // Calculate overall statistics
 const overallStats = useMemo(() => {
 const totalTemplates = templates.length;
 const usedTemplates = templateMetrics.filter(m => m.totalExecutions > 0).length;
 const totalExecutions = templateMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
 const successfulExecutions = templateMetrics.reduce((sum, m) => sum + m.successfulExecutions, 0);
 const averageSuccessRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
 const averageExecutionTime = templateMetrics.length > 0 
 ? templateMetrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) / templateMetrics.length 
 : 0;

 return {
 totalTemplates,
 usedTemplates,
 totalExecutions,
 successfulExecutions,
 failedExecutions: totalExecutions - successfulExecutions,
 averageSuccessRate,
 averageExecutionTime,
 };
 }, [templates, templateMetrics]);

 const handleRefresh = async () => {
 setRefreshing(true);
 // In real implementation, this would refetch analytics data
 await new Promise(resolve => setTimeout(resolve, 1000));
 setRefreshing(false);
 };

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Template Analytics</h2>
 <p className="text-muted-foreground">
 Insights into template usage and performance
 </p>
 </div>

 <div className="flex items-center gap-2">
 <select
 value={timeRange}
 onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
 className="px-3 py-2 rounded-md border border-input bg-background text-sm"
 >
 <option value="7d">Last 7 days</option>
 <option value="30d">Last 30 days</option>
 <option value="90d">Last 90 days</option>
 <option value="1y">Last year</option>
 </select>

 <button
 onClick={handleRefresh}
 disabled={refreshing}
 className="flex items-center gap-1 px-3 py-2 rounded-md border border-input hover:bg-accent transition-colors disabled:opacity-50"
 >
 <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
 Refresh
 </button>
 </div>
 </div>

 {/* Overview metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MetricCard
 title="Total Templates"
 value={overallStats.totalTemplates}
 subtitle={`${overallStats.usedTemplates} actively used`}
 icon={<Package className="w-5 h-5" />}
 color="blue"
 />

 <MetricCard
 title="Total Executions"
 value={overallStats.totalExecutions.toLocaleString()}
 subtitle="Across all templates"
 icon={<Activity className="w-5 h-5" />}
 trend={{ value: 12.5, positive: true }}
 color="green"
 />

 <MetricCard
 title="Success Rate"
 value={`${overallStats.averageSuccessRate.toFixed(1)}%`}
 subtitle={`${overallStats.failedExecutions} failed executions`}
 icon={<CheckCircle className="w-5 h-5" />}
 trend={{ value: 5.2, positive: true }}
 color={overallStats.averageSuccessRate >= 90 ? 'green' : overallStats.averageSuccessRate >= 70 ? 'yellow' : 'red'}
 />

 <MetricCard
 title="Avg. Execution Time"
 value={`${Math.round(overallStats.averageExecutionTime / 1000)}s`}
 subtitle="From start to completion"
 icon={<Clock className="w-5 h-5" />}
 trend={{ value: 8.1, positive: false }}
 color="purple"
 />
 </div>

 {/* Template rankings */}
 <div className="bg-card rounded-lg border">
 <div className="flex items-center justify-between p-6 border-b">
 <h3 className="text-lg font-semibold">Template Rankings</h3>
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
 className="px-3 py-1 rounded border border-input bg-background text-sm"
 >
 <option value="executions">Most Used</option>
 <option value="success_rate">Highest Success Rate</option>
 <option value="popularity">Most Popular</option>
 </select>
 </div>

 <TemplateRankingTable 
 metrics={templateMetrics}
 sortBy={sortBy}
 />
 </div>

 {/* Usage trends and category breakdown */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Usage trends chart placeholder */}
 <div className="bg-card rounded-lg border p-6">
 <h3 className="text-lg font-semibold mb-4">Usage Trends</h3>
 <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
 <div className="text-center text-muted-foreground">
 <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>Chart visualization would go here</p>
 <p className="text-xs">Integration with charting library needed</p>
 </div>
 </div>
 </div>

 {/* Category breakdown */}
 <div className="bg-card rounded-lg border p-6">
 <h3 className="text-lg font-semibold mb-4">Templates by Category</h3>
 <div className="space-y-3">
 {Object.entries(
 templateMetrics.reduce((acc, metric) => {
 const type = metric.template.spec.type;
 acc[type] = (acc[type] || 0) + metric.totalExecutions;
 return acc;
 }, {} as Record<string, number>)
 ).map(([type, executions]) => (
 <div key={type} className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-primary" />
 <span className="capitalize font-medium">{type}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">{executions} executions</span>
 <div className="w-16 h-2 bg-muted rounded-full">
 <div 
 className="h-full bg-primary rounded-full"
 style={{
 width: `${(executions / Math.max(...Object.values(templateMetrics.reduce((acc, m) => {
 const t = m.template.spec.type;
 acc[t] = (acc[t] || 0) + m.totalExecutions;
 return acc;
 }, {} as Record<string, number>)))) * 100}%`
 }}
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Recent activity */}
 <div className="bg-card rounded-lg border">
 <div className="p-6 border-b">
 <h3 className="text-lg font-semibold">Recent Template Activity</h3>
 </div>
 <div className="p-6">
 {recentlyUsed.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No recent template activity</p>
 </div>
 ) : (
 <div className="space-y-3">
 {recentlyUsed.slice(0, 5).map(usage => {
 const template = templates.find(t => 
 `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === usage.templateRef
 );
 return (
 <div key={usage.templateRef} className="flex items-center justify-between py-2">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
 <Package className="w-4 h-4 text-primary" />
 </div>
 <div>
 <p className="font-medium">
 {template?.metadata.title || template?.metadata.name || 'Unknown Template'}
 </p>
 <p className="text-xs text-muted-foreground">
 Used {usage.usageCount} time{usage.usageCount !== 1 ? 's' : ''}
 </p>
 </div>
 </div>
 <span className="text-sm text-muted-foreground">
 {new Date(usage.lastUsed).toLocaleDateString()}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 );
};