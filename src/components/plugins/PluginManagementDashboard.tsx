'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity, Server, Database, Globe, Monitor, Terminal,
  Play, Square, RotateCcw, Trash2, Settings, Eye,
  Cpu, MemoryStick, HardDrive, Network, AlertTriangle,
  CheckCircle, Clock, TrendingUp, BarChart3, LineChart,
  RefreshCw, ExternalLink, Package, Container, Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'monitoring' | 'logs' | 'settings'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadInstances();
    
    if (autoRefresh) {
      const interval = setInterval(loadInstances, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
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
                const metricsResponse = await fetch(`/api/plugin-monitor?installId=${installation.installId}`);
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
              const versionResponse = await fetch(`/api/plugin-version-check?action=single&pluginName=${encodeURIComponent(installation.pluginId)}&currentVersion=${encodeURIComponent(installation.version || '1.0.0')}`);
              if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                installation.updateInfo = {
                  hasUpdate: versionData.hasUpdate,
                  latestVersion: versionData.latestVersion,
                  updateUrgency: versionData.updateUrgency,
                  changelog: versionData.changelog
                };
              }
            } catch (error) {
              console.error(`Failed to load version info for ${installation.installId}:`, error);
              // Set default - assume no update available on error
              installation.updateInfo = {
                hasUpdate: false,
                latestVersion: installation.version || '1.0.0'
              };
            }
            
            return installation;
          })
        );
        
        setInstances(instancesWithMetrics);
      }
    } catch (error) {
      console.error('Failed to load plugin instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceAction = async (installId: string, action: 'start' | 'stop' | 'restart' | 'delete' | 'update') => {
    try {
      // Find the plugin name for user feedback
      const plugin = instances.find(i => i.installId === installId);
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
            action: action === 'restart' ? 'restart' : action === 'stop' ? 'stop' : 'start'
          };
          break;
        case 'update':
          endpoint = `/api/plugin-actions`;
          method = 'POST';
          requestBody = {
            installId,
            action: 'update',
            version: 'latest' // Could be made configurable
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
      case 'running': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped': return <Square className="w-5 h-5 text-gray-500" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'building': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'deploying': return <Cloud className="w-5 h-5 text-purple-500 animate-pulse" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getHealthIcon = (health?: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedInstanceData = instances.find(i => i.installId === selectedInstance);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading plugin instances...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Plugin Management Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor and manage your Backstage plugin instances
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                autoRefresh
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>
            <button
              onClick={loadInstances}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[800px]">
        {/* Instance List */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Plugin Instances ({instances.length})
            </h3>
            
            {instances.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No plugin instances found</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
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
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedInstance === instance.installId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {instance.pluginName || instance.pluginId}
                        </span>
                        {instance.updateInfo?.hasUpdate && (
                          <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                            instance.updateInfo.updateUrgency === 'critical' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' 
                              : instance.updateInfo.updateUrgency === 'high'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            Update Available
                          </span>
                        )}
                      </div>
                      {getStatusIcon(instance.status)}
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="flex items-center">
                        <Package className="w-3 h-3 mr-1" />
                        {instance.pluginId}@{instance.version}
                      </div>
                      <div className="flex items-center">
                        {instance.environment === 'kubernetes' ? (
                          <Cloud className="w-3 h-3 mr-1" />
                        ) : (
                          <Container className="w-3 h-3 mr-1" />
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
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {selectedInstanceData.pluginName || selectedInstanceData.pluginId}
                    </h3>
                    {selectedInstanceData.updateInfo?.hasUpdate && (
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        selectedInstanceData.updateInfo.updateUrgency === 'critical' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' 
                          : selectedInstanceData.updateInfo.updateUrgency === 'high'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {selectedInstanceData.updateInfo.updateUrgency === 'critical' && '🚨 '}
                        Update to {selectedInstanceData.updateInfo.latestVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedInstanceData.pluginId}@{selectedInstanceData.version}
                    {selectedInstanceData.updateInfo?.hasUpdate && selectedInstanceData.updateInfo.latestVersion !== selectedInstanceData.version && (
                      <span className="text-gray-500 ml-2">
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
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open
                    </a>
                  )}
                  
                  {selectedInstanceData.status === 'running' ? (
                    <>
                      <button
                        onClick={() => handleInstanceAction(selectedInstanceData.installId, 'stop')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center"
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </button>
                      <button
                        onClick={() => handleInstanceAction(selectedInstanceData.installId, 'restart')}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 flex items-center"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restart
                      </button>
                    </>
                  ) : selectedInstanceData.status === 'stopped' && (
                    <button
                      onClick={() => handleInstanceAction(selectedInstanceData.installId, 'start')}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </button>
                  )}
                  
                  {/* Only show Update button if update is available */}
                  {selectedInstanceData.updateInfo?.hasUpdate && (
                    <button
                      onClick={() => handleInstanceAction(selectedInstanceData.installId, 'update')}
                      className={`px-3 py-1 text-white rounded text-sm hover:opacity-90 flex items-center ${
                        selectedInstanceData.updateInfo.updateUrgency === 'critical' 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : selectedInstanceData.updateInfo.updateUrgency === 'high'
                          ? 'bg-orange-600 hover:bg-orange-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      title={`Update available: ${selectedInstanceData.updateInfo.latestVersion}${selectedInstanceData.updateInfo.changelog ? ` - ${selectedInstanceData.updateInfo.changelog}` : ''}`}
                    >
                      <TrendingUp className="w-4 h-4 mr-1" />
                      Update to {selectedInstanceData.updateInfo.latestVersion}
                      {selectedInstanceData.updateInfo.updateUrgency === 'critical' && (
                        <span className="ml-1 text-xs">!</span>
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleInstanceAction(selectedInstanceData.installId, 'delete')}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="flex space-x-8">
                  {['overview', 'monitoring', 'logs', 'settings'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                              {selectedInstanceData.status}
                            </p>
                          </div>
                          {getStatusIcon(selectedInstanceData.status)}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Environment</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                              {selectedInstanceData.environment}
                            </p>
                          </div>
                          {selectedInstanceData.environment === 'kubernetes' ? (
                            <Cloud className="w-8 h-8 text-purple-500" />
                          ) : (
                            <Container className="w-8 h-8 text-blue-500" />
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Health</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                              {selectedInstanceData.metrics?.health?.overall || 'Unknown'}
                            </p>
                          </div>
                          {getHealthIcon(selectedInstanceData.metrics?.health?.overall)}
                        </div>
                      </div>
                    </div>

                    {/* Resource Metrics */}
                    {selectedInstanceData.metrics?.resources && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          Resource Usage
                        </h4>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                            <Cpu className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {selectedInstanceData.metrics.resources.totalCpu.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</p>
                          </div>
                          <div className="text-center">
                            <MemoryStick className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {formatBytes(selectedInstanceData.metrics.resources.totalMemory)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</p>
                          </div>
                          <div className="text-center">
                            <Network className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                              {formatBytes(selectedInstanceData.metrics.resources.networkIO.received + selectedInstanceData.metrics.resources.networkIO.transmitted)}
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
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          Service Health
                        </h4>
                        <div className="space-y-3">
                          {selectedInstanceData.metrics.services.map((service) => (
                            <div key={service.name} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded">
                              <div className="flex items-center">
                                {getHealthIcon(service.status)}
                                <span className="ml-3 font-medium text-gray-900 dark:text-gray-100">
                                  {service.name}
                                </span>
                              </div>
                              <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                                <div>{service.responseTime}ms</div>
                                <div className="text-xs">{new Date(service.lastCheck).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Container Metrics */}
                    {selectedInstanceData.metrics?.containers && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          Containers
                        </h4>
                        <div className="space-y-4">
                          {selectedInstanceData.metrics.containers.map((container) => (
                            <div key={container.id} className="p-4 bg-white dark:bg-gray-900 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {container.name}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  container.status === 'running' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {container.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">CPU:</span>
                                  <span className="ml-1 font-medium">{container.cpu.toFixed(1)}%</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                                  <span className="ml-1 font-medium">{container.memory.percentage.toFixed(1)}%</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Network RX:</span>
                                  <span className="ml-1 font-medium">{formatBytes(container.network.rx)}</span>
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
                    <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 h-96 overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-white font-semibold">Recent Logs</span>
                        <button
                          onClick={loadInstances}
                          className="text-gray-400 hover:text-white"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      {selectedInstanceData.metrics?.logs?.map((log, index) => (
                        <div key={index} className="mb-1">
                          <span className="text-gray-500">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span className={`ml-2 ${
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-yellow-400' :
                            log.level === 'debug' ? 'text-blue-400' :
                            'text-green-400'
                          }`}>
                            [{log.level.toUpperCase()}]
                          </span>
                          <span className="text-cyan-400 ml-2">{log.service}:</span>
                          <span className="ml-2">{log.message}</span>
                        </div>
                      )) || (
                        <div className="text-gray-500">No logs available</div>
                      )}
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
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Instance Settings
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Install ID
                          </label>
                          <input
                            type="text"
                            value={selectedInstanceData.installId}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Started At
                          </label>
                          <input
                            type="text"
                            value={new Date(selectedInstanceData.startedAt).toLocaleString()}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700"
                          />
                        </div>
                        {selectedInstanceData.namespace && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Kubernetes Namespace
                            </label>
                            <input
                              type="text"
                              value={selectedInstanceData.namespace}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700"
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-900 dark:text-gray-100">
                  Select a plugin instance
                </p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
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