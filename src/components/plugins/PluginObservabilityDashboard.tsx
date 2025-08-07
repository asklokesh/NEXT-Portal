'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Clock, MemoryStick, Cpu, Zap, TrendingUp, TrendingDown,
  Play, Square, Settings, Eye, AlertCircle, Calendar,
  Filter, Search, Download, Bell, Shield, BarChart3,
  LineChart, PieChart, Monitor, Server, Network, Database,
  Cloud, Layers, GitBranch, Target, Gauge, MapPin,
  Compass, Share2, ExternalLink, Code, Terminal,
  FileText, Workflow, Sparkles, Radio, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart as RechartsLineChart,
  AreaChart,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Area,
  Bar,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from 'recharts';

// Types for observability data
interface TraceSpan {
  id: string;
  parentId?: string;
  operationName: string;
  startTime: string;
  duration: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: SpanLog[];
}

interface SpanLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, any>;
}

interface TraceData {
  id: string;
  timestamp: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  spans: TraceSpan[];
  tags: Record<string, any>;
}

interface MetricData {
  timestamp: string;
  value: number;
  labels: Record<string, string>;
}

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  traceId?: string;
  spanId?: string;
  pluginId: string;
  labels: Record<string, string>;
  fields: Record<string, any>;
}

interface Alert {
  id: string;
  type: 'slo_breach' | 'error_rate' | 'latency' | 'availability' | 'resource_usage';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  pluginId: string;
  threshold?: number;
  currentValue?: number;
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
}

interface SLOMetrics {
  availability: {
    target: number;
    current: number;
    errorBudget: number;
    errorBudgetRemaining: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  latency: {
    target: number;
    p50: number;
    p95: number;
    p99: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  errorRate: {
    target: number;
    current: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

interface ServiceDependency {
  name: string;
  type: 'http' | 'grpc' | 'database' | 'cache' | 'queue';
  endpoint: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastChecked: string;
}

interface PluginObservabilityData {
  pluginId: string;
  pluginName: string;
  serviceMesh?: {
    istioEnabled: boolean;
    linkerdEnabled: boolean;
    consulConnectEnabled: boolean;
  };
  traces: TraceData[];
  metrics: {
    requests: MetricData[];
    responseTime: MetricData[];
    errorRate: MetricData[];
    memory: MetricData[];
    cpu: MetricData[];
    diskIO: MetricData[];
    networkIO: MetricData[];
  };
  logs: LogEntry[];
  alerts: Alert[];
  slo: SLOMetrics;
  dependencies: ServiceDependency[];
}

interface ServiceMapNode {
  id: string;
  type: 'frontend' | 'gateway' | 'service' | 'database' | 'cache';
  health: 'healthy' | 'warning' | 'critical';
}

interface ServiceMapEdge {
  source: string;
  target: string;
  requests: number;
  errors: number;
}

interface ServiceMap {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}

interface PluginObservabilityDashboardProps {
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function PluginObservabilityDashboard({ className = '' }: PluginObservabilityDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [plugins, setPlugins] = useState<PluginObservabilityData[]>([]);
  const [serviceMap, setServiceMap] = useState<ServiceMap | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch observability data
  const fetchObservabilityData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [pluginsResponse, serviceMapResponse] = await Promise.all([
        fetch('/api/plugin-observability'),
        fetch('/api/plugin-observability?action=service-map')
      ]);
      
      const pluginsData = await pluginsResponse.json();
      const serviceMapData = await serviceMapResponse.json();
      
      if (pluginsData.success) {
        setPlugins(pluginsData.plugins || []);
        if (!selectedPlugin && pluginsData.plugins?.length > 0) {
          setSelectedPlugin(pluginsData.plugins[0].pluginId);
        }
      }
      
      if (serviceMapData.success) {
        setServiceMap(serviceMapData.serviceMap);
      }
    } catch (error) {
      console.error('Error fetching observability data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPlugin]);

  // Auto-refresh setup
  useEffect(() => {
    fetchObservabilityData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchObservabilityData, 30000);
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    }
  }, [fetchObservabilityData, autoRefresh]);

  // Get current plugin data
  const currentPlugin = useMemo(() => {
    return plugins.find(p => p.pluginId === selectedPlugin) || null;
  }, [plugins, selectedPlugin]);

  // Chart data transformations
  const transformMetricsForChart = useCallback((metrics: MetricData[], dataKey: string = 'value') => {
    return metrics.slice(-50).map((metric, index) => ({
      timestamp: new Date(metric.timestamp).toLocaleTimeString(),
      [dataKey]: metric.value,
      fullTimestamp: metric.timestamp,
    }));
  }, []);

  // Status icon helper
  const getStatusIcon = (status: string, size: string = 'w-5 h-5') => {
    switch (status) {
      case 'healthy':
      case 'success':
      case 'ok':
        return <CheckCircle className={`${size} text-green-500`} />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className={`${size} text-yellow-500`} />;
      case 'critical':
      case 'error':
      case 'unhealthy':
        return <XCircle className={`${size} text-red-500`} />;
      default:
        return <AlertCircle className={`${size} text-gray-500`} />;
    }
  };

  // Trace visualization component
  const TraceVisualization = ({ trace }: { trace: TraceData }) => {
    const maxDuration = Math.max(...trace.spans.map(s => s.duration));
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Trace: {trace.id}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            {trace.duration}ms
            {getStatusIcon(trace.status, 'w-4 h-4')}
          </div>
        </div>
        
        <div className="space-y-1">
          {trace.spans.map((span, index) => (
            <div
              key={span.id}
              className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
              style={{ marginLeft: `${(span.parentId ? 20 : 0)}px` }}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {span.operationName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {span.duration}ms
                    </span>
                    {getStatusIcon(span.status, 'w-4 h-4')}
                  </div>
                </div>
                <div className="mt-1">
                  <div
                    className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(span.duration / maxDuration) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Service map visualization
  const ServiceMapVisualization = ({ serviceMap }: { serviceMap: ServiceMap }) => {
    const nodePositions = useMemo(() => {
      const positions: Record<string, { x: number; y: number }> = {};
      serviceMap.nodes.forEach((node, index) => {
        const angle = (index / serviceMap.nodes.length) * 2 * Math.PI;
        positions[node.id] = {
          x: 200 + Math.cos(angle) * 150,
          y: 200 + Math.sin(angle) * 150,
        };
      });
      return positions;
    }, [serviceMap]);

    return (
      <div className="relative bg-gray-50 dark:bg-gray-800 rounded-lg p-6 min-h-[400px]">
        <svg width="100%" height="400" viewBox="0 0 400 400">
          {/* Edges */}
          {serviceMap.edges.map((edge, index) => {
            const source = nodePositions[edge.source];
            const target = nodePositions[edge.target];
            if (!source || !target) return null;

            return (
              <g key={index}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#94A3B8"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={(source.x + target.x) / 2}
                  y={(source.y + target.y) / 2}
                  textAnchor="middle"
                  className="text-xs fill-gray-600 dark:fill-gray-400"
                >
                  {edge.requests}
                </text>
              </g>
            );
          })}
          
          {/* Nodes */}
          {serviceMap.nodes.map((node) => {
            const position = nodePositions[node.id];
            if (!position) return null;

            const color = node.health === 'healthy' ? '#10B981' : 
                         node.health === 'warning' ? '#F59E0B' : '#EF4444';

            return (
              <g key={node.id}>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r="20"
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  x={position.x}
                  y={position.y + 35}
                  textAnchor="middle"
                  className="text-sm font-medium fill-gray-900 dark:fill-gray-100"
                >
                  {node.id}
                </text>
              </g>
            );
          })}
          
          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#94A3B8"
              />
            </marker>
          </defs>
        </svg>
      </div>
    );
  };

  if (loading && plugins.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <Activity className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Plugin Observability
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing distributed tracing and metrics collection...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Compass className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Plugin Observability</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                <Radio className="w-4 h-4 inline mr-1" />
                Live
              </span>
            </div>
            <p className="text-xl text-purple-100">
              Distributed tracing, metrics, and service mesh monitoring
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={fetchObservabilityData}
              disabled={loading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center transition-colors"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                autoRefresh
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              <Wifi className="w-5 h-5 mr-2" />
              Auto Refresh
            </button>
            
            <button className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 flex items-center transition-colors">
              <Download className="w-5 h-5 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Plugin Selector */}
        <div className="flex items-center gap-4">
          <select
            value={selectedPlugin}
            onChange={(e) => setSelectedPlugin(e.target.value)}
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70"
          >
            {plugins.map((plugin) => (
              <option key={plugin.pluginId} value={plugin.pluginId} className="text-gray-900">
                {plugin.pluginName}
              </option>
            ))}
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
          >
            <option value="15m" className="text-gray-900">Last 15 minutes</option>
            <option value="1h" className="text-gray-900">Last hour</option>
            <option value="6h" className="text-gray-900">Last 6 hours</option>
            <option value="24h" className="text-gray-900">Last 24 hours</option>
            <option value="7d" className="text-gray-900">Last 7 days</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'traces', label: 'Distributed Traces', icon: GitBranch },
            { id: 'metrics', label: 'Metrics', icon: LineChart },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'slo', label: 'SLO/SLA', icon: Target },
            { id: 'service-map', label: 'Service Map', icon: Network },
            { id: 'dependencies', label: 'Dependencies', icon: Share2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-6 py-4 font-medium text-sm border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && currentPlugin && (
            <div className="space-y-6">
              {/* SLO Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Availability SLO
                    </h3>
                    {getStatusIcon(currentPlugin.slo.availability.status)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Current</span>
                      <span className="font-medium">{currentPlugin.slo.availability.current}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Target</span>
                      <span className="font-medium">{currentPlugin.slo.availability.target}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Error Budget</span>
                      <span className="font-medium">{currentPlugin.slo.availability.errorBudgetRemaining}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Latency SLO
                    </h3>
                    {getStatusIcon(currentPlugin.slo.latency.status)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">P50</span>
                      <span className="font-medium">{currentPlugin.slo.latency.p50}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">P95</span>
                      <span className="font-medium">{currentPlugin.slo.latency.p95}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">P99</span>
                      <span className="font-medium">{currentPlugin.slo.latency.p99}ms</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Error Rate SLO
                    </h3>
                    {getStatusIcon(currentPlugin.slo.errorRate.status)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Current</span>
                      <span className="font-medium">{currentPlugin.slo.errorRate.current}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Target</span>
                      <span className="font-medium">{currentPlugin.slo.errorRate.target}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Response Time
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={transformMetricsForChart(currentPlugin.metrics.responseTime)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Request Rate
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={transformMetricsForChart(currentPlugin.metrics.requests)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Error Rate
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={transformMetricsForChart(currentPlugin.metrics.errorRate)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Resource Usage
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        data={transformMetricsForChart(currentPlugin.metrics.memory, 'memory')}
                      />
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        data={transformMetricsForChart(currentPlugin.metrics.cpu, 'cpu')}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'traces' && currentPlugin && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Distributed Traces
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search traces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {currentPlugin.traces.slice(0, 10).map((trace) => (
                    <div
                      key={trace.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedTrace(trace)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(trace.status)}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {trace.id}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {trace.spans.length} spans • {trace.duration}ms
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(trace.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTrace && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <TraceVisualization trace={selectedTrace} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'service-map' && serviceMap && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Service Dependency Map
              </h3>
              <ServiceMapVisualization serviceMap={serviceMap} />
            </div>
          )}

          {activeTab === 'logs' && currentPlugin && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Log Explorer
                </h3>
                <div className="flex gap-2">
                  <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                    <option value="all">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {currentPlugin.logs.slice(0, 50).map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm font-mono ${
                      log.level === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                        : log.level === 'warn'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                        : 'bg-gray-50 dark:bg-gray-700 border-l-4 border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.level === 'error'
                              ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                              : log.level === 'warn'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'
                          }`}>
                            {log.level.toUpperCase()}
                          </span>
                          {log.traceId && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 rounded text-xs">
                              {log.traceId}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-900 dark:text-gray-100">
                          {log.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'alerts' && currentPlugin && (
            <div className="space-y-4">
              {currentPlugin.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-6 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {alert.severity === 'critical' ? (
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      ) : alert.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {alert.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {alert.description}
                        </p>
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.status === 'firing'
                          ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          : 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dependencies' && currentPlugin && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Service Dependencies
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentPlugin.dependencies.map((dep) => (
                  <div
                    key={dep.name}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {dep.type === 'database' && <Database className="w-5 h-5 text-blue-500" />}
                        {dep.type === 'cache' && <MemoryStick className="w-5 h-5 text-green-500" />}
                        {dep.type === 'http' && <Cloud className="w-5 h-5 text-purple-500" />}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {dep.name}
                        </span>
                      </div>
                      {getStatusIcon(dep.health)}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Latency</span>
                        <span className="font-medium">{dep.latency}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Error Rate</span>
                        <span className="font-medium">{dep.errorRate}%</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {dep.endpoint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}