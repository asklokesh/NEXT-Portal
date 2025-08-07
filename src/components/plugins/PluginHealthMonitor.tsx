'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Clock, MemoryStick, Cpu, Zap, TrendingUp, TrendingDown,
  Play, Square, RotateCcw, Settings, Eye, AlertCircle,
  Calendar, Filter, Search, Download, Bell, Shield,
  BarChart3, LineChart, PieChart, Monitor, Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PluginHealthMetric {
  timestamp: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface PluginHealthData {
  pluginId: string;
  pluginName: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'updating';
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  uptime: number;
  lastCheck: string;
  version: string;
  metrics: {
    responseTime: PluginHealthMetric[];
    memoryUsage: PluginHealthMetric[];
    errorRate: PluginHealthMetric[];
    requestCount: PluginHealthMetric[];
    cpuUsage: PluginHealthMetric[];
  };
  dependencies: {
    id: string;
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    lastChecked: string;
  }[];
  errors: {
    timestamp: string;
    level: 'error' | 'warning' | 'info';
    message: string;
    stack?: string;
  }[];
  configuration: {
    enabled: boolean;
    autoRestart: boolean;
    healthCheckInterval: number;
    maxMemoryUsage: number;
    maxResponseTime: number;
  };
}

interface PluginHealthSummary {
  totalPlugins: number;
  healthyPlugins: number;
  warningPlugins: number;
  criticalPlugins: number;
  averageUptime: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
}

interface PluginHealthMonitorProps {
  className?: string;
}

export default function PluginHealthMonitor({ className = '' }: PluginHealthMonitorProps) {
  const [loading, setLoading] = useState(true);
  const [plugins, setPlugins] = useState<PluginHealthData[]>([]);
  const [summary, setSummary] = useState<PluginHealthSummary | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginHealthData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHealthData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [statusFilter, healthFilter]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (healthFilter !== 'all') params.set('health', healthFilter);
      
      const [pluginsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/plugin-health?${params}`),
        fetch('/api/plugin-health?action=summary')
      ]);
      
      const pluginsData = await pluginsResponse.json();
      const summaryData = await summaryResponse.json();
      
      if (pluginsData.success) {
        setPlugins(pluginsData.plugins);
      }
      
      if (summaryData.success) {
        setSummary(summaryData.summary);
      }
    } catch (error) {
      console.error('Error fetching plugin health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePluginAction = async (pluginId: string, action: string) => {
    setActionLoading(prev => new Set(prev).add(pluginId));
    
    try {
      const response = await fetch('/api/plugin-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pluginId, action }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh plugin data after action
        setTimeout(fetchHealthData, 1000);
      }
    } catch (error) {
      console.error('Error performing plugin action:', error);
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4 text-green-500" />;
      case 'stopped': return <Square className="w-4 h-4 text-gray-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'starting': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'updating': return <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatUptime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getLatestMetricValue = (metrics: PluginHealthMetric[]) => {
    return metrics.length > 0 ? metrics[metrics.length - 1].value : 0;
  };

  const getMetricTrend = (metrics: PluginHealthMetric[]) => {
    if (metrics.length < 2) return 'stable';
    const current = metrics[metrics.length - 1].value;
    const previous = metrics[metrics.length - 2].value;
    if (current > previous * 1.1) return 'up';
    if (current < previous * 0.9) return 'down';
    return 'stable';
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = !searchQuery || 
      plugin.pluginName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.pluginId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading && plugins.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <Activity className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Plugin Health Monitor
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Collecting health metrics from all plugins...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Activity className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Plugin Health Monitor</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                Live
              </span>
            </div>
            <p className="text-xl text-green-100">
              Real-time monitoring and management of plugin health and performance
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchHealthData}
              disabled={loading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center transition-colors"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 flex items-center transition-colors">
              <Download className="w-5 h-5 mr-2" />
              Export Report
            </button>
          </div>
        </div>
        
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.healthyPlugins}</div>
                  <div className="text-sm text-green-100">Healthy</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.warningPlugins}</div>
                  <div className="text-sm text-green-100">Warning</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.criticalPlugins}</div>
                  <div className="text-sm text-green-100">Critical</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{Math.round(summary.averageResponseTime)}ms</div>
                  <div className="text-sm text-green-100">Avg Response</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
              <option value="error">Error</option>
            </select>
            
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Health</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plugin Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPlugins.map((plugin) => {
          const responseTime = getLatestMetricValue(plugin.metrics.responseTime);
          const memoryUsage = getLatestMetricValue(plugin.metrics.memoryUsage);
          const errorRate = getLatestMetricValue(plugin.metrics.errorRate);
          const cpuUsage = getLatestMetricValue(plugin.metrics.cpuUsage);
          
          return (
            <motion.div
              key={plugin.pluginId}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              {/* Plugin Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {getHealthIcon(plugin.health)}
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {plugin.pluginName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      v{plugin.version}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {getStatusIcon(plugin.status)}
                  <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {plugin.status}
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Response Time</span>
                    {getMetricTrend(plugin.metrics.responseTime) === 'up' && (
                      <TrendingUp className="w-3 h-3 text-red-500" />
                    )}
                    {getMetricTrend(plugin.metrics.responseTime) === 'down' && (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {Math.round(responseTime)}ms
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Memory</span>
                    <MemoryStick className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatBytes(memoryUsage * 1024 * 1024)}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">CPU Usage</span>
                    <Cpu className="w-3 h-3 text-orange-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {Math.round(cpuUsage)}%
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Error Rate</span>
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {errorRate.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Uptime and Last Check */}
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Uptime: {formatUptime(plugin.uptime)}
                </span>
                <span>
                  Last check: {new Date(plugin.lastCheck).toLocaleTimeString()}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePluginAction(plugin.pluginId, 'restart')}
                  disabled={actionLoading.has(plugin.pluginId)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center"
                >
                  {actionLoading.has(plugin.pluginId) ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restart
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedPlugin(plugin)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Details
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Plugin Detail Modal */}
      {selectedPlugin && (
        <PluginDetailModal
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onAction={handlePluginAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

// Plugin Detail Modal Component
const PluginDetailModal = ({ plugin, onClose, onAction, actionLoading }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {plugin.pluginName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {plugin.pluginId} • v{plugin.version}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
        <div className="space-y-6">
          {/* Status and Health Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                {/* Status icon here */}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                {plugin.status}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Health</span>
                {/* Health icon here */}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                {plugin.health}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Uptime</span>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {/* Uptime calculation here */}
                24h 12m
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Last Check</span>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Just now
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onAction(plugin.pluginId, 'restart')}
              disabled={actionLoading.has(plugin.pluginId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </button>
            <button
              onClick={() => onAction(plugin.pluginId, 'stop')}
              disabled={actionLoading.has(plugin.pluginId)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </button>
            <button
              onClick={() => onAction(plugin.pluginId, 'health-check')}
              disabled={actionLoading.has(plugin.pluginId)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
            >
              <Activity className="w-4 h-4 mr-2" />
              Health Check
            </button>
          </div>

          {/* Error Log */}
          {plugin.errors && plugin.errors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Recent Errors
              </h3>
              <div className="space-y-2">
                {plugin.errors.map((error: any, index: number) => (
                  <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-red-900 dark:text-red-100">
                          {error.message}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {new Date(error.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  </div>
);