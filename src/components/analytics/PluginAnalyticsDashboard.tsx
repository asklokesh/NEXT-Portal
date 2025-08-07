'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  Cloud,
  Cpu,
  Database,
  DollarSign,
  Download,
  Filter,
  GitBranch,
  Globe,
  HardDrive,
  Info,
  Layers,
  LineChart,
  Loader2,
  MemoryStick,
  Package,
  PieChart,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  X,
  Zap,
  Bell,
  Eye,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Share2,
  Target,
  Gauge,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
  Sankey,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

import {
  getPluginMetricsService,
  type PluginMetrics,
  type AggregatedMetrics,
  type PluginAnomaly,
  type PluginInsight,
  type PluginTrend,
  type AlertRule,
  type PluginDependency,
} from '@/lib/analytics/plugin-metrics-service';

interface PluginAnalyticsDashboardProps {
  selectedPlugin?: string;
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
  view?: 'overview' | 'performance' | 'usage' | 'health' | 'costs' | 'insights';
}

const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  gray: '#6B7280',
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.purple,
  COLORS.pink,
  COLORS.indigo,
  COLORS.teal,
  COLORS.cyan,
];

export const PluginAnalyticsDashboard: React.FC<PluginAnalyticsDashboardProps> = ({
  selectedPlugin,
  timeRange = '24h',
  view = 'overview',
}) => {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState(view);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [selectedPluginId, setSelectedPluginId] = useState(selectedPlugin);
  const [showFilters, setShowFilters] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [showInsightDetails, setShowInsightDetails] = useState<PluginInsight | null>(null);
  
  // Metrics data
  const [pluginMetrics, setPluginMetrics] = useState<PluginMetrics[]>([]);
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<PluginAnomaly[]>([]);
  const [insights, setInsights] = useState<PluginInsight[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [dependencies, setDependencies] = useState<PluginDependency[]>([]);
  const [trends, setTrends] = useState<PluginTrend[]>([]);
  
  const metricsService = useMemo(() => getPluginMetricsService(), []);
  
  const loadMetricsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load metrics based on selection
      const metrics = selectedPluginId 
        ? metricsService.getHistoricalMetrics(selectedPluginId, selectedTimeRange)
        : metricsService.getLatestMetrics();
      
      setPluginMetrics(metrics);
      setAggregatedMetrics(metricsService.getAggregatedMetrics());
      setAnomalies(metricsService.getAnomalies());
      setInsights(metricsService.getInsights(selectedPluginId));
      setAlertRules(metricsService.getAlertRules());
      setDependencies(metricsService.getDependencyGraph(selectedPluginId));
      
      // Load trends for key metrics
      if (selectedPluginId) {
        const trendMetrics = ['activeUsers', 'avgResponseTime', 'errorRate', 'revenue'];
        const trendsData = trendMetrics.map(metric => 
          metricsService.getPluginTrends(selectedPluginId, metric, selectedTimeRange)
        );
        setTrends(trendsData);
      }
      
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [selectedPluginId, selectedTimeRange, metricsService]);
  
  useEffect(() => {
    loadMetricsData();
    
    // Subscribe to real-time updates
    const handleMetricsUpdate = () => {
      loadMetricsData();
    };
    
    metricsService.on('metrics-updated', handleMetricsUpdate);
    
    return () => {
      metricsService.off('metrics-updated', handleMetricsUpdate);
    };
  }, [loadMetricsData, metricsService]);
  
  const handleExportData = () => {
    const data = metricsService.exportMetrics(selectedPluginId, 'json');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plugin-metrics-${selectedTimeRange}-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Metrics exported successfully');
  };
  
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };
  
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(seconds / 60)}m`;
  };
  
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      {aggregatedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Total Plugins"
            value={aggregatedMetrics.totalPlugins}
            icon={<Package className="w-5 h-5" />}
            color="primary"
          />
          <MetricCard
            title="Active Users"
            value={formatNumber(aggregatedMetrics.totalActiveUsers)}
            icon={<Users className="w-5 h-5" />}
            color="success"
            trend={12.5}
          />
          <MetricCard
            title="API Calls"
            value={formatNumber(aggregatedMetrics.totalApiCalls)}
            icon={<Zap className="w-5 h-5" />}
            color="purple"
            trend={8.3}
          />
          <MetricCard
            title="Avg Response Time"
            value={`${aggregatedMetrics.avgResponseTime.toFixed(0)}ms`}
            icon={<Clock className="w-5 h-5" />}
            color="indigo"
            trend={-5.2}
          />
          <MetricCard
            title="Health Score"
            value={`${aggregatedMetrics.avgHealthScore.toFixed(0)}%`}
            icon={<Shield className="w-5 h-5" />}
            color={aggregatedMetrics.avgHealthScore > 80 ? 'success' : aggregatedMetrics.avgHealthScore > 60 ? 'warning' : 'danger'}
          />
        </div>
      )}
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plugin Usage Distribution */}
        <ChartCard title="Plugin Usage Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={pluginMetrics.slice(0, 8).map(p => ({
                  name: p.pluginName,
                  value: p.activeUsers,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pluginMetrics.slice(0, 8).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        </ChartCard>
        
        {/* Performance Overview */}
        <ChartCard title="Performance Overview">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={pluginMetrics.slice(0, 6).map(p => ({
              plugin: p.pluginName.replace(' Plugin', ''),
              performance: (100 - p.avgResponseTime / 10),
              reliability: p.availability,
              efficiency: p.cacheHitRate,
              scalability: (100 - p.cpuUsage),
              quality: (100 - p.errorRate * 10),
            }))}>
              <PolarGrid strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="plugin" fontSize={12} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} fontSize={10} />
              <Radar name="Performance" dataKey="performance" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.3} />
              <Radar name="Reliability" dataKey="reliability" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.3} />
              <Radar name="Efficiency" dataKey="efficiency" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.3} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Alerts and Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Critical Alerts</h3>
            <Bell className="w-5 h-5 text-red-500" />
          </div>
          <div className="space-y-3">
            {anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 5).map((anomaly, index) => (
              <AlertItem key={index} anomaly={anomaly} />
            ))}
            {anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length === 0 && (
              <p className="text-sm text-gray-500">No critical alerts</p>
            )}
          </div>
        </div>
        
        {/* Top Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Top Insights</h3>
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-3">
            {insights.slice(0, 5).map((insight, index) => (
              <InsightItem 
                key={index} 
                insight={insight} 
                onClick={() => setShowInsightDetails(insight)}
              />
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-gray-500">No insights available</p>
            )}
          </div>
        </div>
        
        {/* Health Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Plugin Health</h3>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-3">
            {pluginMetrics.slice(0, 5).map((plugin, index) => (
              <HealthStatusItem key={index} plugin={plugin} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderPerformanceTab = () => (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pluginMetrics.slice(0, 1).map(metric => (
          <React.Fragment key={metric.pluginId}>
            <MetricCard
              title="P50 Response"
              value={`${metric.p50ResponseTime.toFixed(0)}ms`}
              icon={<Gauge className="w-5 h-5" />}
              color="primary"
            />
            <MetricCard
              title="P95 Response"
              value={`${metric.p95ResponseTime.toFixed(0)}ms`}
              icon={<Gauge className="w-5 h-5" />}
              color="warning"
            />
            <MetricCard
              title="P99 Response"
              value={`${metric.p99ResponseTime.toFixed(0)}ms`}
              icon={<Gauge className="w-5 h-5" />}
              color="danger"
            />
            <MetricCard
              title="Throughput"
              value={`${formatNumber(metric.throughput)}/s`}
              icon={<Zap className="w-5 h-5" />}
              color="success"
            />
          </React.Fragment>
        ))}
      </div>
      
      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Distribution */}
        <ChartCard title="Response Time Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={pluginMetrics.map(p => ({
              name: p.pluginName.replace(' Plugin', ''),
              p50: p.p50ResponseTime,
              p95: p.p95ResponseTime,
              p99: p.p99ResponseTime,
              avg: p.avgResponseTime,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="p50" fill={COLORS.success} />
              <Bar dataKey="p95" fill={COLORS.warning} />
              <Bar dataKey="p99" fill={COLORS.danger} />
              <Line type="monotone" dataKey="avg" stroke={COLORS.primary} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        
        {/* Throughput vs Error Rate */}
        <ChartCard title="Throughput vs Error Rate">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="throughput" name="Throughput" unit="/s" fontSize={12} />
              <YAxis dataKey="errorRate" name="Error Rate" unit="%" fontSize={12} />
              <ZAxis dataKey="activeUsers" name="Active Users" range={[50, 400]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter
                name="Plugins"
                data={pluginMetrics.map(p => ({
                  throughput: p.throughput,
                  errorRate: p.errorRate,
                  activeUsers: p.activeUsers,
                  name: p.pluginName,
                }))}
                fill={COLORS.primary}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">Plugin Performance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plugin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  P99 Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Throughput
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cache Hit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pluginMetrics.map(plugin => (
                <tr key={plugin.pluginId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {plugin.pluginName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={plugin.avgResponseTime > 200 ? 'text-red-600' : plugin.avgResponseTime > 100 ? 'text-yellow-600' : 'text-green-600'}>
                      {plugin.avgResponseTime.toFixed(0)}ms
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={plugin.p99ResponseTime > 1000 ? 'text-red-600' : plugin.p99ResponseTime > 500 ? 'text-yellow-600' : 'text-green-600'}>
                      {plugin.p99ResponseTime.toFixed(0)}ms
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatNumber(plugin.throughput)}/s
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={plugin.errorRate > 5 ? 'text-red-600' : plugin.errorRate > 2 ? 'text-yellow-600' : 'text-green-600'}>
                      {plugin.errorRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={plugin.successRate < 95 ? 'text-red-600' : plugin.successRate < 99 ? 'text-yellow-600' : 'text-green-600'}>
                      {plugin.successRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={plugin.cacheHitRate < 60 ? 'text-red-600' : plugin.cacheHitRate < 80 ? 'text-yellow-600' : 'text-green-600'}>
                      {plugin.cacheHitRate.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  
  const renderHealthTab = () => (
    <div className="space-y-6">
      {/* Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {aggregatedMetrics && (
          <>
            <MetricCard
              title="Healthy Plugins"
              value={`${aggregatedMetrics.totalPlugins - aggregatedMetrics.criticalIssues - aggregatedMetrics.warnings}`}
              icon={<CheckCircle className="w-5 h-5" />}
              color="success"
            />
            <MetricCard
              title="Warnings"
              value={aggregatedMetrics.warnings}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="warning"
            />
            <MetricCard
              title="Critical Issues"
              value={aggregatedMetrics.criticalIssues}
              icon={<X className="w-5 h-5" />}
              color="danger"
            />
            <MetricCard
              title="Avg Health Score"
              value={`${aggregatedMetrics.avgHealthScore.toFixed(0)}%`}
              icon={<Shield className="w-5 h-5" />}
              color={aggregatedMetrics.avgHealthScore > 80 ? 'success' : 'warning'}
            />
          </>
        )}
      </div>
      
      {/* Resource Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Resource Utilization">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pluginMetrics.map(p => ({
              name: p.pluginName.replace(' Plugin', ''),
              cpu: p.cpuUsage,
              memory: p.memoryUsage,
              disk: p.diskUsage,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="cpu" fill={COLORS.primary} />
              <Bar dataKey="memory" fill={COLORS.warning} />
              <Bar dataKey="disk" fill={COLORS.success} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Availability & Uptime">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={pluginMetrics.map(p => ({
              name: p.pluginName.replace(' Plugin', ''),
              availability: p.availability,
              uptime: p.uptime / 3600, // Convert to hours
              restarts: p.restartCount * 10, // Scale for visibility
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis yAxisId="left" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="availability" fill={COLORS.success} />
              <Line yAxisId="right" type="monotone" dataKey="uptime" stroke={COLORS.primary} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="restarts" stroke={COLORS.danger} strokeWidth={2} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Anomaly Detection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Detected Anomalies</h3>
          <span className="text-sm text-gray-500">{anomalies.length} total</span>
        </div>
        <div className="space-y-4">
          {anomalies.map((anomaly, index) => (
            <AnomalyCard key={index} anomaly={anomaly} />
          ))}
        </div>
      </div>
    </div>
  );
  
  const renderCostsTab = () => (
    <div className="space-y-6">
      {/* Cost Overview */}
      {aggregatedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Cost"
            value={`$${aggregatedMetrics.totalCost.toFixed(0)}`}
            icon={<DollarSign className="w-5 h-5" />}
            color="primary"
            trend={-8.5}
          />
          <MetricCard
            title="Total Revenue"
            value={`$${aggregatedMetrics.totalRevenue.toFixed(0)}`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="success"
            trend={15.3}
          />
          <MetricCard
            title="ROI"
            value={`${((aggregatedMetrics.totalRevenue - aggregatedMetrics.totalCost) / aggregatedMetrics.totalCost * 100).toFixed(0)}%`}
            icon={<Target className="w-5 h-5" />}
            color="purple"
          />
          <MetricCard
            title="Cost per User"
            value={`$${(aggregatedMetrics.totalCost / aggregatedMetrics.totalActiveUsers).toFixed(2)}`}
            icon={<Users className="w-5 h-5" />}
            color="indigo"
          />
        </div>
      )}
      
      {/* Cost Analysis Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Cost Breakdown by Plugin">
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={pluginMetrics.map(p => ({
                name: p.pluginName,
                size: p.cost,
                revenue: p.revenue,
                roi: p.roi,
              }))}
              dataKey="size"
              stroke="#fff"
              fill={COLORS.primary}
            >
              <Tooltip
                content={({ payload }) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-2 rounded shadow-lg border">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-sm">Cost: ${data.size.toFixed(0)}</p>
                        <p className="text-sm">Revenue: ${data.revenue.toFixed(0)}</p>
                        <p className="text-sm">ROI: {data.roi.toFixed(0)}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Cost Efficiency">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cost" name="Cost" unit="$" fontSize={12} />
              <YAxis dataKey="efficiency" name="Efficiency" unit="%" fontSize={12} />
              <ZAxis dataKey="users" name="Users" range={[50, 400]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter
                name="Plugins"
                data={pluginMetrics.map(p => ({
                  cost: p.cost,
                  efficiency: (p.revenue / p.cost) * 100,
                  users: p.activeUsers,
                  name: p.pluginName,
                }))}
                fill={COLORS.purple}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Cost Optimization Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Cost Optimization Opportunities</h3>
          <DollarSign className="w-5 h-5 text-green-500" />
        </div>
        <div className="space-y-4">
          {insights
            .filter(i => i.type === 'optimization' && i.potentialSavings)
            .map((insight, index) => (
              <OptimizationCard key={index} insight={insight} />
            ))}
        </div>
      </div>
    </div>
  );
  
  const renderInsightsTab = () => (
    <div className="space-y-6">
      {/* Insights Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Insights"
          value={insights.length}
          icon={<Brain className="w-5 h-5" />}
          color="purple"
        />
        <MetricCard
          title="Optimizations"
          value={insights.filter(i => i.type === 'optimization').length}
          icon={<Target className="w-5 h-5" />}
          color="success"
        />
        <MetricCard
          title="Warnings"
          value={insights.filter(i => i.type === 'warning').length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="warning"
        />
        <MetricCard
          title="Predictions"
          value={insights.filter(i => i.type === 'prediction').length}
          icon={<TrendingUp className="w-5 h-5" />}
          color="primary"
        />
      </div>
      
      {/* Dependency Graph */}
      <ChartCard title="Plugin Dependencies">
        <div className="h-64 flex items-center justify-center text-gray-500">
          <GitBranch className="w-8 h-8 mr-2" />
          <span>Interactive dependency graph would be rendered here</span>
        </div>
      </ChartCard>
      
      {/* Insights List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI-Powered Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">AI-Powered Insights</h3>
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-3">
            {insights
              .filter(i => i.confidence > 0.7)
              .slice(0, 5)
              .map((insight, index) => (
                <InsightDetailCard key={index} insight={insight} />
              ))}
          </div>
        </div>
        
        {/* Predictive Analytics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Predictive Analytics</h3>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-3">
            {insights
              .filter(i => i.type === 'prediction')
              .slice(0, 5)
              .map((insight, index) => (
                <PredictionCard key={index} insight={insight} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Plugin Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive metrics and insights for your plugin ecosystem
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Plugin Selector */}
          <select
            value={selectedPluginId || 'all'}
            onChange={(e) => setSelectedPluginId(e.target.value === 'all' ? undefined : e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
          >
            <option value="all">All Plugins</option>
            {pluginMetrics.map(p => (
              <option key={p.pluginId} value={p.pluginId}>
                {p.pluginName}
              </option>
            ))}
          </select>
          
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          {/* Actions */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Filter className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowAlertConfig(!showAlertConfig)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Bell className="w-5 h-5" />
          </button>
          
          <button
            onClick={loadMetricsData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleExportData}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
      
      {/* View Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'performance', 'health', 'costs', 'insights'].map((tab) => (
            <button
              key={tab}
              onClick={() => setCurrentView(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                currentView === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentView === 'overview' && renderOverviewTab()}
          {currentView === 'performance' && renderPerformanceTab()}
          {currentView === 'health' && renderHealthTab()}
          {currentView === 'costs' && renderCostsTab()}
          {currentView === 'insights' && renderInsightsTab()}
        </motion.div>
      </AnimatePresence>
      
      {/* Insight Details Modal */}
      {showInsightDetails && (
        <InsightDetailsModal
          insight={showInsightDetails}
          onClose={() => setShowInsightDetails(null)}
        />
      )}
    </div>
  );
};

// Component Helpers

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'indigo';
  trend?: number;
}> = ({ title, value, icon, color, trend }) => {
  const colorClasses = {
    primary: 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300',
    success: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
    warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
    danger: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300',
    indigo: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </motion.div>
  );
};

const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
      {title}
    </h3>
    {children}
  </div>
);

const AlertItem: React.FC<{
  anomaly: PluginAnomaly;
}> = ({ anomaly }) => {
  const severityColors = {
    low: 'text-blue-600 bg-blue-100',
    medium: 'text-yellow-600 bg-yellow-100',
    high: 'text-orange-600 bg-orange-100',
    critical: 'text-red-600 bg-red-100',
  };
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className={`p-1 rounded ${severityColors[anomaly.severity]}`}>
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{anomaly.pluginId}</p>
        <p className="text-xs text-gray-500">{anomaly.description}</p>
      </div>
    </div>
  );
};

const InsightItem: React.FC<{
  insight: PluginInsight;
  onClick: () => void;
}> = ({ insight, onClick }) => {
  const typeIcons = {
    optimization: <Target className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    recommendation: <Info className="w-4 h-4" />,
    prediction: <TrendingUp className="w-4 h-4" />,
  };
  
  return (
    <div 
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
      onClick={onClick}
    >
      <div className="p-1 rounded bg-purple-100 text-purple-600">
        {typeIcons[insight.type]}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-gray-500">{insight.pluginId}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  );
};

const HealthStatusItem: React.FC<{
  plugin: PluginMetrics;
}> = ({ plugin }) => {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="flex items-center justify-between p-2">
      <span className="text-sm font-medium">{plugin.pluginName}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${getHealthColor(plugin.healthScore)}`}>
          {plugin.healthScore.toFixed(0)}%
        </span>
        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${plugin.healthScore >= 80 ? 'bg-green-500' : plugin.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${plugin.healthScore}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const AnomalyCard: React.FC<{
  anomaly: PluginAnomaly;
}> = ({ anomaly }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div className="flex items-start justify-between mb-2">
      <div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          anomaly.severity === 'critical' ? 'bg-red-100 text-red-800' :
          anomaly.severity === 'high' ? 'bg-orange-100 text-orange-800' :
          anomaly.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {anomaly.severity.toUpperCase()}
        </span>
      </div>
      <span className="text-xs text-gray-500">
        {new Date(anomaly.detectedAt).toLocaleTimeString()}
      </span>
    </div>
    <h4 className="font-medium text-sm mb-1">{anomaly.pluginId} - {anomaly.metric}</h4>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{anomaly.description}</p>
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <span className="text-gray-500">Expected:</span>
        <span className="ml-2 font-medium">{anomaly.expectedValue.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-gray-500">Actual:</span>
        <span className="ml-2 font-medium">{anomaly.actualValue.toFixed(2)}</span>
      </div>
    </div>
    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
      <span className="font-medium">Recommendation:</span> {anomaly.recommendation}
    </div>
  </div>
);

const OptimizationCard: React.FC<{
  insight: PluginInsight;
}> = ({ insight }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div className="flex items-start justify-between mb-2">
      <h4 className="font-medium">{insight.title}</h4>
      {insight.potentialSavings && (
        <span className="text-green-600 font-bold">
          ${insight.potentialSavings.toFixed(0)}
        </span>
      )}
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{insight.description}</p>
    <div className="flex items-center justify-between">
      <span className={`text-xs px-2 py-1 rounded-full ${
        insight.impact === 'high' ? 'bg-red-100 text-red-800' :
        insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
        'bg-blue-100 text-blue-800'
      }`}>
        {insight.impact} impact
      </span>
      <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
        Apply Optimization →
      </button>
    </div>
  </div>
);

const InsightDetailCard: React.FC<{
  insight: PluginInsight;
}> = ({ insight }) => (
  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
    <div className="flex items-start justify-between mb-2">
      <h4 className="text-sm font-medium">{insight.title}</h4>
      <span className="text-xs text-gray-500">
        {(insight.confidence * 100).toFixed(0)}% confidence
      </span>
    </div>
    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{insight.description}</p>
    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
      View Details →
    </button>
  </div>
);

const PredictionCard: React.FC<{
  insight: PluginInsight;
}> = ({ insight }) => (
  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <TrendingUp className="w-4 h-4 text-blue-600" />
      <h4 className="text-sm font-medium">{insight.title}</h4>
    </div>
    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{insight.description}</p>
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">
        Confidence: {(insight.confidence * 100).toFixed(0)}%
      </span>
      <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
        Prepare →
      </button>
    </div>
  </div>
);

const InsightDetailsModal: React.FC<{
  insight: PluginInsight;
  onClose: () => void;
}> = ({ insight, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{insight.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-gray-600 dark:text-gray-400">{insight.description}</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Suggested Action</h3>
            <p className="text-gray-600 dark:text-gray-400">{insight.suggestedAction}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Impact Level</h4>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {insight.impact.toUpperCase()}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Confidence Score</h4>
              <p className="text-lg font-bold mt-1">{(insight.confidence * 100).toFixed(0)}%</p>
            </div>
          </div>
          {insight.potentialSavings && (
            <div>
              <h4 className="text-sm font-medium text-gray-500">Potential Savings</h4>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ${insight.potentialSavings.toFixed(2)}
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Apply Recommendation
          </button>
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);

export default PluginAnalyticsDashboard;