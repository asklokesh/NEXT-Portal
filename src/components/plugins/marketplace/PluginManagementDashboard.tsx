'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2,
  Update,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Shield,
  Zap,
  Download,
  Upload,
  RefreshCw,
  Filter,
  Search,
  MoreVertical,
  ExternalLink,
  FileText,
  Database,
  Terminal,
  Eye,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Archive,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface PluginStatus {
  id: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'updating';
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestCount: number;
  errorCount: number;
  lastError?: string;
  version: string;
  configHash: string;
  lastRestart: string;
  dependencies: {
    id: string;
    status: 'healthy' | 'unhealthy';
    latency: number;
  }[];
}

interface PluginAction {
  id: string;
  type: 'start' | 'stop' | 'restart' | 'update' | 'configure' | 'uninstall' | 'logs' | 'backup';
  label: string;
  icon: any;
  variant: 'primary' | 'secondary' | 'danger' | 'warning';
  disabled?: boolean;
  tooltip?: string;
}

interface ManagementFilters {
  status: string[];
  health: string[];
  category: string[];
  searchQuery: string;
}

const STATUS_COLORS = {
  running: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  stopped: 'text-gray-600 bg-gray-50 dark:bg-gray-700/20',
  error: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  starting: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  stopping: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  updating: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
};

const HEALTH_COLORS = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  critical: 'text-red-600',
  unknown: 'text-gray-600',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function PluginStatusCard({ 
  plugin, 
  status, 
  onAction,
  expanded,
  onToggleExpanded 
}: {
  plugin: BackstagePlugin;
  status: PluginStatus;
  onAction: (action: string, pluginId: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const actions: PluginAction[] = useMemo(() => {
    const baseActions: PluginAction[] = [
      { id: 'logs', type: 'logs', label: 'View Logs', icon: FileText, variant: 'secondary' },
      { id: 'configure', type: 'configure', label: 'Configure', icon: Settings, variant: 'secondary', disabled: !plugin.configurable },
      { id: 'backup', type: 'backup', label: 'Backup Config', icon: Archive, variant: 'secondary' },
    ];

    switch (status.status) {
      case 'running':
        return [
          { id: 'stop', type: 'stop', label: 'Stop', icon: Pause, variant: 'warning' },
          { id: 'restart', type: 'restart', label: 'Restart', icon: RotateCcw, variant: 'secondary' },
          ...baseActions,
          { id: 'update', type: 'update', label: 'Update', icon: Update, variant: 'primary' },
        ];
      
      case 'stopped':
        return [
          { id: 'start', type: 'start', label: 'Start', icon: Play, variant: 'primary' },
          ...baseActions,
          { id: 'uninstall', type: 'uninstall', label: 'Uninstall', icon: Trash2, variant: 'danger' },
        ];
      
      case 'error':
        return [
          { id: 'restart', type: 'restart', label: 'Restart', icon: RotateCcw, variant: 'primary' },
          { id: 'stop', type: 'stop', label: 'Force Stop', icon: Square, variant: 'danger' },
          ...baseActions,
        ];
      
      default:
        return baseActions;
    }
  }, [status.status, plugin.configurable]);

  const healthIcon = {
    healthy: CheckCircle,
    warning: AlertTriangle,
    critical: XCircle,
    unknown: AlertCircle,
  }[status.health];

  const HealthIcon = healthIcon;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                {plugin.title.charAt(0)}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {plugin.title}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>v{status.version}</span>
                <span>•</span>
                <span>{plugin.category}</span>
                <span>•</span>
                <span>Uptime: {formatUptime(status.uptime)}</span>
              </div>
            </div>
          </div>

          {/* Status and Health */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status.status]}`}>
              {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
            </span>
            <HealthIcon className={`w-5 h-5 ${HEALTH_COLORS[status.health]}`} />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">CPU</span>
              <Cpu className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {status.cpuUsage.toFixed(1)}%
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Memory</span>
              <MemoryStick className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatBytes(status.memoryUsage)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Requests</span>
              <Activity className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {status.requestCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Errors</span>
              <AlertTriangle className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {status.errorCount}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {actions.slice(0, 3).map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => onAction(action.type, plugin.id)}
                  disabled={action.disabled}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : action.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : action.variant === 'warning'
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={action.tooltip}
                >
                  <Icon className="w-3 h-3" />
                  {action.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {actions.length > 3 && (
              <div className="relative group">
                <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  {actions.slice(3).map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => onAction(action.type, plugin.id)}
                        disabled={action.disabled}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed first:rounded-t-lg last:rounded-b-lg"
                      >
                        <Icon className="w-4 h-4" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={onToggleExpanded}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {expanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Dependencies Status */}
            {status.dependencies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Dependencies
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {status.dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">{dep.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {dep.latency}ms
                        </span>
                        {dep.status === 'healthy' ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Error */}
            {status.lastError && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Last Error
                </h4>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {status.lastError}
                  </p>
                </div>
              </div>
            )}

            {/* Configuration Hash */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Configuration
              </h4>
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-sm text-gray-700 dark:text-gray-300">Config Hash</span>
                <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {status.configHash.slice(0, 8)}...
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PluginManagementDashboard() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ManagementFilters>({
    status: [],
    health: [],
    category: [],
    searchQuery: '',
  });
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  // Fetch installed plugins
  const { data: pluginsData, isLoading, error } = useQuery({
    queryKey: ['installed-plugins'],
    queryFn: async () => {
      const response = await fetch('/api/plugins?installed=true');
      if (!response.ok) throw new Error('Failed to fetch plugins');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch plugin statuses
  const { data: statusesData } = useQuery({
    queryKey: ['plugin-statuses'],
    queryFn: async () => {
      const response = await fetch('/api/plugins/status');
      if (!response.ok) throw new Error('Failed to fetch plugin statuses');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: !!pluginsData?.plugins,
  });

  const plugins = pluginsData?.plugins || [];
  const statuses: Record<string, PluginStatus> = statusesData?.statuses || {};

  // Mock plugin statuses for demo
  const mockStatuses = useMemo(() => {
    const mock: Record<string, PluginStatus> = {};
    plugins.forEach((plugin: BackstagePlugin) => {
      mock[plugin.id] = {
        id: plugin.id,
        status: Math.random() > 0.8 ? 'error' : Math.random() > 0.3 ? 'running' : 'stopped',
        health: Math.random() > 0.7 ? 'warning' : Math.random() > 0.1 ? 'healthy' : 'critical',
        uptime: Math.floor(Math.random() * 86400 * 30),
        memoryUsage: Math.floor(Math.random() * 1024 * 1024 * 500),
        cpuUsage: Math.random() * 100,
        requestCount: Math.floor(Math.random() * 10000),
        errorCount: Math.floor(Math.random() * 50),
        lastError: Math.random() > 0.7 ? 'Connection timeout to external service' : undefined,
        version: plugin.version,
        configHash: Math.random().toString(36).substring(2, 15),
        lastRestart: new Date(Date.now() - Math.random() * 86400 * 1000 * 7).toISOString(),
        dependencies: [
          { id: 'database', status: Math.random() > 0.2 ? 'healthy' : 'unhealthy', latency: Math.floor(Math.random() * 100) },
          { id: 'api-gateway', status: Math.random() > 0.1 ? 'healthy' : 'unhealthy', latency: Math.floor(Math.random() * 50) },
        ],
      };
    });
    return mock;
  }, [plugins]);

  const finalStatuses = Object.keys(statuses).length > 0 ? statuses : mockStatuses;

  // Plugin management actions
  const pluginActionMutation = useMutation({
    mutationFn: async ({ action, pluginId }: { action: string; pluginId: string }) => {
      const response = await fetch('/api/plugins/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pluginId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Action failed');
      }
      
      return response.json();
    },
    onSuccess: (data, { action, pluginId }) => {
      const plugin = plugins.find((p: BackstagePlugin) => p.id === pluginId);
      toast.success(`${plugin?.title || 'Plugin'} ${action} completed successfully`);
      queryClient.invalidateQueries({ queryKey: ['plugin-statuses'] });
    },
    onError: (error: any, { action, pluginId }) => {
      const plugin = plugins.find((p: BackstagePlugin) => p.id === pluginId);
      toast.error(`Failed to ${action} ${plugin?.title || 'plugin'}: ${error.message}`);
    },
  });

  const handlePluginAction = (action: string, pluginId: string) => {
    pluginActionMutation.mutate({ action, pluginId });
  };

  const toggleExpanded = (pluginId: string) => {
    setExpandedPlugins(prev => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  };

  // Filter plugins
  const filteredPlugins = plugins.filter((plugin: BackstagePlugin) => {
    const status = finalStatuses[plugin.id];
    if (!status) return false;

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!plugin.title.toLowerCase().includes(query) &&
          !plugin.description.toLowerCase().includes(query) &&
          !plugin.category.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(status.status)) {
      return false;
    }

    // Health filter
    if (filters.health.length > 0 && !filters.health.includes(status.health)) {
      return false;
    }

    // Category filter
    if (filters.category.length > 0 && !filters.category.includes(plugin.category)) {
      return false;
    }

    return true;
  });

  // Statistics
  const stats = useMemo(() => {
    const allStatuses = Object.values(finalStatuses);
    return {
      total: plugins.length,
      running: allStatuses.filter(s => s.status === 'running').length,
      stopped: allStatuses.filter(s => s.status === 'stopped').length,
      errors: allStatuses.filter(s => s.status === 'error').length,
      healthy: allStatuses.filter(s => s.health === 'healthy').length,
      warnings: allStatuses.filter(s => s.health === 'warning').length,
      critical: allStatuses.filter(s => s.health === 'critical').length,
    };
  }, [plugins, finalStatuses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading plugin management...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to load plugins
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Plugin Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and control your installed plugins
          </p>
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['plugin-statuses'] })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Plugins</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">
            {stats.running}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Running</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-600">
            {stats.stopped}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Stopped</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-red-600">
            {stats.errors}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Errors</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">
            {stats.healthy}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Healthy</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.warnings}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Warnings</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-red-600">
            {stats.critical}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Critical</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filters.status.join(',')}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value ? e.target.value.split(',') : [] }))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="error">Error</option>
          </select>

          <select
            value={filters.health.join(',')}
            onChange={(e) => setFilters(prev => ({ ...prev, health: e.target.value ? e.target.value.split(',') : [] }))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Health</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Plugin Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredPlugins.map((plugin: BackstagePlugin) => {
          const status = finalStatuses[plugin.id];
          if (!status) return null;

          return (
            <PluginStatusCard
              key={plugin.id}
              plugin={plugin}
              status={status}
              onAction={handlePluginAction}
              expanded={expandedPlugins.has(plugin.id)}
              onToggleExpanded={() => toggleExpanded(plugin.id)}
            />
          );
        })}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No plugins found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filters.searchQuery || filters.status.length > 0 || filters.health.length > 0
              ? 'Try adjusting your filters'
              : 'No plugins are currently installed'
            }
          </p>
        </div>
      )}
    </div>
  );
}