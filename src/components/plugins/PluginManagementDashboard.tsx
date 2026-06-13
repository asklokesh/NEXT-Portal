'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Cpu,
  MemoryStick,
  Network,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Package,
  Container,
  Cloud,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface PluginInstance {
  installId: string;
  pluginId: string;
  pluginName: string;
  version: string;
  status: 'running' | 'stopped' | 'error' | 'building' | 'deploying';
  environment: 'local' | 'kubernetes';
  serviceUrl?: string;
  healthCheckUrl?: string;
  namespace?: string;
  startedAt: string;
  lastCheck: string;
  metrics?: PluginMetrics;
  updateInfo?: {
    hasUpdate: boolean;
    latestVersion: string;
    updateUrgency?: 'low' | 'medium' | 'high' | 'critical';
    changelog?: string;
  };
}

interface PluginMetrics {
  containers: ContainerMetrics[];
  services: ServiceMetrics[];
  resources: ResourceMetrics;
  health: HealthMetrics;
  logs: LogEntry[];
}

interface ContainerMetrics {
  id: string;
  name: string;
  status: string;
  uptime: string;
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
}

interface ServiceMetrics {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: string;
}

interface ResourceMetrics {
  totalCpu: number;
  totalMemory: number;
  networkIO: {
    received: number;
    transmitted: number;
  };
}

interface HealthMetrics {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: 'passing' | 'warning' | 'critical';
  message: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
}

export default function PluginManagementDashboard() {
  const [instances, setInstances] = useState<PluginInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'monitoring' | 'logs' | 'settings'>(
    'overview',
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadInstances();

    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      void loadInstances();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadInstances = async () => {
    try {
      // Load all plugin installations
      const response = await fetch('/api/plugin-installer?action=list');
      if (response.ok) {
        const data = await response.json();
        const installations = data.installations || [];

        // Load metrics and version info for each instance
        const instancesWithMetrics = await Promise.all(
          installations.map(async (installation: any) => {
            // Load metrics if running
            if (installation.status === 'running') {
              try {
                const metricsResponse = await fetch(
                  `/api/plugin-monitor?installId=${installation.installId}`,
                );
                if (metricsResponse.ok) {
                  const metricsData = await metricsResponse.json();
                  installation.metrics = metricsData.metrics;
                }
              } catch (error) {
                console.error(`Failed to load metrics for ${installation.installId}:`, error);
              }
            }

            // Load version check info - use single plugin endpoint
            try {
              const versionResponse = await fetch(
                `/api/plugin-version-check?action=single&pluginName=${encodeURIComponent(installation.pluginId)}&currentVersion=${encodeURIComponent(installation.version || '1.0.0')}`,
              );
              if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                installation.updateInfo = {
                  hasUpdate: versionData.hasUpdate,
                  latestVersion: versionData.latestVersion,
                  updateUrgency: versionData.updateUrgency,
                  changelog: versionData.changelog,
                };
              }
            } catch (error) {
              console.error(`Failed to load version info for ${installation.installId}:`, error);
              // Set default - assume no update available on error
              installation.updateInfo = {
                hasUpdate: false,
                latestVersion: installation.version || '1.0.0',
              };
            }

            return installation;
          }),
        );

        setInstances(instancesWithMetrics);
      }
    } catch (error) {
      console.error('Failed to load plugin instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceAction = async (
    installId: string,
    action: 'start' | 'stop' | 'restart' | 'delete' | 'update',
  ) => {
    try {
      // Find the plugin name for user feedback
      const plugin = instances.find((i) => i.installId === installId);
      const pluginName = plugin?.pluginName || 'Plugin';

      let endpoint = '';
      let method = 'POST';
      let requestBody: any = null;

      switch (action) {
        case 'delete':
          if (!confirm(`Are you sure you want to delete ${pluginName}?`)) {
            return;
          }
          endpoint = `/api/plugin-installer?installId=${installId}`;
          method = 'DELETE';
          break;
        case 'stop':
        case 'start':
        case 'restart':
          endpoint = `/api/plugin-actions`;
          method = 'POST';
          requestBody = {
            installId,
            action: action === 'restart' ? 'restart' : action === 'stop' ? 'stop' : 'start',
          };
          break;
        case 'update':
          endpoint = `/api/plugin-actions`;
          method = 'POST';
          requestBody = {
            installId,
            action: 'update',
            version: 'latest', // Could be made configurable
          };
          break;
        default:
          return;
      }

      const fetchOptions: RequestInit = { method };
      if (requestBody) {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = JSON.stringify(requestBody);
      }

      const response = await fetch(endpoint, fetchOptions);
      if (response.ok) {
        const data = await response.json();
        console.log(`${action} action successful:`, data.message);

        // Show success feedback to user
        if (data.message) {
          // You could add a toast notification here
          alert(`Success: ${data.message}`);
        }

        loadInstances(); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error(`Failed to ${action} plugin:`, errorData.error);
        alert(`Error: ${errorData.error || `Failed to ${action} ${pluginName}`}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} plugin:`, error);
      alert(`Error: Failed to ${action} plugin. Please check the console for details.`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'stopped':
        return <Square className="h-5 w-5 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'building':
        return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />;
      case 'deploying':
        return <Cloud className="h-5 w-5 animate-pulse text-purple-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getHealthIcon = (health?: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedInstanceData = instances.find((i) => i.installId === selectedInstance);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading plugin instances...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 p-6 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Plugin Management Dashboard
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Monitor and manage your Backstage plugin instances
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`rounded-lg border px-4 py-2 transition-colors ${
                autoRefresh
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>
            <button
              onClick={loadInstances}
              className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[800px]">
        {/* Instance List */}
        <div className="w-1/3 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Plugin Instances ({instances.length})
            </h3>

            {instances.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">No plugin instances found</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                  Install a plugin to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((instance) => (
                  <motion.div
                    key={instance.installId}
                    layoutId={`instance-${instance.installId}`}
                    onClick={() => setSelectedInstance(instance.installId)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      selectedInstance === instance.installId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {instance.pluginName || instance.pluginId}
                        </span>
                        {instance.updateInfo?.hasUpdate && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                              instance.updateInfo.updateUrgency === 'critical'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : instance.updateInfo.updateUrgency === 'high'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}
                          >
                            Update Available
                          </span>
                        )}
                      </div>
                      {getStatusIcon(instance.status)}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <Package className="mr-1 h-3 w-3" />
                        {instance.pluginId}@{instance.version}
                      </div>
                      <div className="flex items-center">
                        {instance.environment === 'kubernetes' ? (
                          <Cloud className="mr-1 h-3 w-3" />
                        ) : (
                          <Container className="mr-1 h-3 w-3" />
                        )}
                        {instance.environment}
                        {instance.namespace && ` (${instance.namespace})`}
                      </div>
                      {instance.metrics?.health && (
                        <div className="flex items-center">
                          {getHealthIcon(instance.metrics.health.overall)}
                          <span className="ml-1 capitalize">{instance.metrics.health.overall}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instance Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedInstanceData ? (
            <div className="p-6">
              {/* Instance Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {selectedInstanceData.pluginName || selectedInstanceData.pluginId}
                    </h3>
                    {selectedInstanceData.updateInfo?.hasUpdate && (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          selectedInstanceData.updateInfo.updateUrgency === 'critical'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : selectedInstanceData.updateInfo.updateUrgency === 'high'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}
                      >
                        {selectedInstanceData.updateInfo.updateUrgency === 'critical' && '🚨 '}
                        Update to {selectedInstanceData.updateInfo.latestVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedInstanceData.pluginId}@{selectedInstanceData.version}
                    {selectedInstanceData.updateInfo?.hasUpdate &&
                      selectedInstanceData.updateInfo.latestVersion !==
                        selectedInstanceData.version && (
                        <span className="ml-2 text-gray-500">
                          (Latest: {selectedInstanceData.updateInfo.latestVersion})
                        </span>
                      )}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedInstanceData.serviceUrl && (
                    <a
                      href={selectedInstanceData.serviceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Open
                    </a>
                  )}

                  {selectedInstanceData.status === 'running' ? (
                    <>
                      <button
                        onClick={() => handleInstanceAction(selectedInstanceData.installId, 'stop')}
                        className="flex items-center rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                      >
                        <Square className="mr-1 h-4 w-4" />
                        Stop
                      </button>
                      <button
                        onClick={() =>
                          handleInstanceAction(selectedInstanceData.installId, 'restart')
                        }
                        className="flex items-center rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700"
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Restart
                      </button>
                    </>
                  ) : (
                    selectedInstanceData.status === 'stopped' && (
                      <button
                        onClick={() =>
                          handleInstanceAction(selectedInstanceData.installId, 'start')
                        }
                        className="flex items-center rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                      >
                        <Play className="mr-1 h-4 w-4" />
                        Start
                      </button>
                    )
                  )}

                  {/* Only show Update button if update is available */}
                  {selectedInstanceData.updateInfo?.hasUpdate && (
                    <button
                      onClick={() => handleInstanceAction(selectedInstanceData.installId, 'update')}
                      className={`flex items-center rounded px-3 py-1 text-sm text-white hover:opacity-90 ${
                        selectedInstanceData.updateInfo.updateUrgency === 'critical'
                          ? 'bg-red-600 hover:bg-red-700'
                          : selectedInstanceData.updateInfo.updateUrgency === 'high'
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      title={`Update available: ${selectedInstanceData.updateInfo.latestVersion}${selectedInstanceData.updateInfo.changelog ? ` - ${selectedInstanceData.updateInfo.changelog}` : ''}`}
                    >
                      <TrendingUp className="mr-1 h-4 w-4" />
                      Update to {selectedInstanceData.updateInfo.latestVersion}
                      {selectedInstanceData.updateInfo.updateUrgency === 'critical' && (
                        <span className="ml-1 text-xs">!</span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleInstanceAction(selectedInstanceData.installId, 'delete')}
                    className="flex items-center rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                  {['overview', 'monitoring', 'logs', 'settings'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`border-b-2 px-1 py-2 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* Status Cards */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Status
                            </p>
                            <p className="text-2xl font-semibold capitalize text-gray-900 dark:text-gray-100">
                              {selectedInstanceData.status}
                            </p>
                          </div>
                          {getStatusIcon(selectedInstanceData.status)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Environment
                            </p>
                            <p className="text-2xl font-semibold capitalize text-gray-900 dark:text-gray-100">
                              {selectedInstanceData.environment}
                            </p>
                          </div>
                          {selectedInstanceData.environment === 'kubernetes' ? (
                            <Cloud className="h-8 w-8 text-purple-500" />
                          ) : (
                            <Container className="h-8 w-8 text-blue-500" />
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Health
                            </p>
                            <p className="text-2xl font-semibold capitalize text-gray-900 dark:text-gray-100">
                              {selectedInstanceData.metrics?.health?.overall || 'Unknown'}
                            </p>
                          </div>
                          {getHealthIcon(selectedInstanceData.metrics?.health?.overall)}
                        </div>
                      </div>
                    </div>

                    {/* Resource Metrics */}
                    {selectedInstanceData.metrics?.resources && (
                      <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
                        <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Resource Usage
                        </h4>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <Cpu className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {selectedInstanceData.metrics.resources.totalCpu.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</p>
                          </div>
                          <div className="text-center">
                            <MemoryStick className="mx-auto mb-2 h-8 w-8 text-green-500" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {formatBytes(selectedInstanceData.metrics.resources.totalMemory)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</p>
                          </div>
                          <div className="text-center">
                            <Network className="mx-auto mb-2 h-8 w-8 text-purple-500" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {formatBytes(
                                selectedInstanceData.metrics.resources.networkIO.received +
                                  selectedInstanceData.metrics.resources.networkIO.transmitted,
                              )}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Network I/O</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'monitoring' && (
                  <motion.div
                    key="monitoring"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* Service Health */}
                    {selectedInstanceData.metrics?.services && (
                      <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
                        <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Service Health
                        </h4>
                        <div className="space-y-3">
                          {selectedInstanceData.metrics.services.map((service) => (
                            <div
                              key={service.name}
                              className="flex items-center justify-between rounded bg-white p-3 dark:bg-gray-900"
                            >
                              <div className="flex items-center">
                                {getHealthIcon(service.status)}
                                <span className="ml-3 font-medium text-gray-900 dark:text-gray-100">
                                  {service.name}
                                </span>
                              </div>
                              <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                                <div>{service.responseTime}ms</div>
                                <div className="text-xs">
                                  {new Date(service.lastCheck).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Container Metrics */}
                    {selectedInstanceData.metrics?.containers && (
                      <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
                        <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Containers
                        </h4>
                        <div className="space-y-4">
                          {selectedInstanceData.metrics.containers.map((container) => (
                            <div
                              key={container.id}
                              className="rounded-lg bg-white p-4 dark:bg-gray-900"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {container.name}
                                </span>
                                <span
                                  className={`rounded px-2 py-1 text-xs font-medium ${
                                    container.status === 'running'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}
                                >
                                  {container.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                                  <span className="ml-1 font-medium">
                                    {container.cpu.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                                  <span className="ml-1 font-medium">
                                    {container.memory.percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Network RX:
                                  </span>
                                  <span className="ml-1 font-medium">
                                    {formatBytes(container.network.rx)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
                                  <span className="ml-1 font-medium">{container.uptime}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'logs' && (
                  <motion.div
                    key="logs"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="h-96 overflow-y-auto rounded-lg bg-black p-4 font-mono text-sm text-green-400">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="font-semibold text-white">Recent Logs</span>
                        <button onClick={loadInstances} className="text-gray-400 hover:text-white">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      {selectedInstanceData.metrics?.logs?.map((log, index) => (
                        <div key={index} className="mb-1">
                          <span className="text-gray-500">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span
                            className={`ml-2 ${
                              log.level === 'error'
                                ? 'text-red-400'
                                : log.level === 'warn'
                                  ? 'text-yellow-400'
                                  : log.level === 'debug'
                                    ? 'text-blue-400'
                                    : 'text-green-400'
                            }`}
                          >
                            [{log.level.toUpperCase()}]
                          </span>
                          <span className="ml-2 text-cyan-400">{log.service}:</span>
                          <span className="ml-2">{log.message}</span>
                        </div>
                      )) || <div className="text-gray-500">No logs available</div>}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
                      <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Instance Settings
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Install ID
                          </label>
                          <input
                            type="text"
                            value={selectedInstanceData.installId}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Started At
                          </label>
                          <input
                            type="text"
                            value={new Date(selectedInstanceData.startedAt).toLocaleString()}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                          />
                        </div>
                        {selectedInstanceData.namespace && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Kubernetes Namespace
                            </label>
                            <input
                              type="text"
                              value={selectedInstanceData.namespace}
                              readOnly
                              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Monitor className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                <p className="text-xl font-medium text-gray-900 dark:text-gray-100">
                  Select a plugin instance
                </p>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  Choose an instance from the list to view its details and metrics
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
