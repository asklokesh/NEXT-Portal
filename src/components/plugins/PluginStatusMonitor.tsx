'use client';

/**
 * Plugin Status Monitor Component
 * Real-time dashboard for monitoring plugin installation, health, and performance
 * Provides comprehensive visibility into plugin ecosystem status
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Settings, Info, Zap, Activity, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/Skeleton';
import { Alert } from '../ui/alert';
import { 
  backstageIntegration, 
  BackstagePluginInfo, 
  PluginHealthCheck, 
  PluginInstallationProgress 
} from '../../lib/plugins/BackstageIntegration';
import { 
  pluginValidator, 
  PluginValidationResult 
} from '../../lib/plugins/PluginValidator';

interface PluginStatus {
  plugin: BackstagePluginInfo;
  health?: PluginHealthCheck;
  validation?: PluginValidationResult;
  installation?: PluginInstallationProgress;
}

interface SystemMetrics {
  totalPlugins: number;
  healthyPlugins: number;
  unhealthyPlugins: number;
  installingPlugins: number;
  averageResponseTime: number;
  totalErrorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export const PluginStatusMonitor: React.FC = () => {
  const [pluginStatuses, setPluginStatuses] = useState<PluginStatus[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'installing'>('all');

  // Initialize real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const handlePluginStatusUpdate = (data: any) => {
      setPluginStatuses(prev => 
        prev.map(status => 
          status.plugin.name === data.pluginId 
            ? { ...status, health: data.health, validation: data.validation }
            : status
        )
      );
    };

    const handleInstallationProgress = (progress: PluginInstallationProgress) => {
      setPluginStatuses(prev => 
        prev.map(status => 
          status.plugin.name === progress.pluginId 
            ? { ...status, installation: progress }
            : status
        )
      );
    };

    const handleHealthCheckResult = (health: PluginHealthCheck) => {
      setPluginStatuses(prev => 
        prev.map(status => 
          status.plugin.name === health.pluginId 
            ? { ...status, health }
            : status
        )
      );
    };

    backstageIntegration.on('pluginStatusUpdate', handlePluginStatusUpdate);
    backstageIntegration.on('installationProgress', handleInstallationProgress);
    backstageIntegration.on('healthCheckResult', handleHealthCheckResult);

    return () => {
      backstageIntegration.off('pluginStatusUpdate', handlePluginStatusUpdate);
      backstageIntegration.off('installationProgress', handleInstallationProgress);
      backstageIntegration.off('healthCheckResult', handleHealthCheckResult);
    };
  }, [realTimeUpdates]);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setError(null);
      
      // Load installed plugins
      const plugins = await backstageIntegration.getInstalledPlugins();
      
      // Load health status for all plugins
      const healthStatuses = await backstageIntegration.getAllPluginHealthStatus();
      
      // Create plugin status objects
      const statuses: PluginStatus[] = await Promise.all(
        plugins.map(async (plugin) => {
          const health = healthStatuses.find(h => h.pluginId === plugin.name);
          
          // Perform validation for each plugin
          let validation: PluginValidationResult | undefined;
          try {
            validation = await pluginValidator.validatePlugin(plugin.name, plugin.configuration);
          } catch (validationError) {
            console.warn(`Validation failed for ${plugin.name}:`, validationError);
          }

          return {
            plugin,
            health,
            validation
          };
        })
      );

      setPluginStatuses(statuses);

      // Calculate system metrics
      const metrics = calculateSystemMetrics(statuses);
      setSystemMetrics(metrics);

    } catch (err) {
      console.error('Failed to load plugin data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plugin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  // Calculate system metrics
  const calculateSystemMetrics = (statuses: PluginStatus[]): SystemMetrics => {
    const totalPlugins = statuses.length;
    const healthyPlugins = statuses.filter(s => s.health?.status === 'healthy').length;
    const unhealthyPlugins = statuses.filter(s => s.health?.status === 'unhealthy').length;
    const installingPlugins = statuses.filter(s => s.plugin.installationStatus === 'installing').length;
    
    const healthyStatuses = statuses.filter(s => s.health);
    const averageResponseTime = healthyStatuses.length > 0 
      ? healthyStatuses.reduce((sum, s) => sum + (s.health?.responseTime || 0), 0) / healthyStatuses.length
      : 0;
    
    const totalErrorRate = healthyStatuses.length > 0
      ? healthyStatuses.reduce((sum, s) => sum + (s.health?.metrics.errorRate || 0), 0) / healthyStatuses.length
      : 0;

    const memoryUsage = healthyStatuses.length > 0
      ? healthyStatuses.reduce((sum, s) => sum + (s.health?.metrics.memoryUsage || 0), 0) / healthyStatuses.length
      : 0;

    const cpuUsage = healthyStatuses.length > 0
      ? healthyStatuses.reduce((sum, s) => sum + (s.health?.metrics.cpuUsage || 0), 0) / healthyStatuses.length
      : 0;

    return {
      totalPlugins,
      healthyPlugins,
      unhealthyPlugins,
      installingPlugins,
      averageResponseTime,
      totalErrorRate,
      memoryUsage,
      cpuUsage
    };
  };

  // Filter plugins based on current filter
  const filteredPlugins = useMemo(() => {
    switch (filter) {
      case 'healthy':
        return pluginStatuses.filter(s => s.health?.status === 'healthy');
      case 'unhealthy':
        return pluginStatuses.filter(s => s.health?.status === 'unhealthy');
      case 'installing':
        return pluginStatuses.filter(s => s.plugin.installationStatus === 'installing');
      default:
        return pluginStatuses;
    }
  }, [pluginStatuses, filter]);

  // Get status icon
  const getStatusIcon = (status?: PluginStatus) => {
    if (status?.plugin.installationStatus === 'installing') {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    switch (status?.health?.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status?: PluginStatus): string => {
    if (status?.plugin.installationStatus === 'installing') return 'blue';
    
    switch (status?.health?.status) {
      case 'healthy':
        return 'green';
      case 'unhealthy':
        return 'red';
      case 'degraded':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  // Render system metrics
  const renderSystemMetrics = () => {
    if (!systemMetrics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Plugins</p>
              <p className="text-2xl font-bold">{systemMetrics.totalPlugins}</p>
            </div>
            <Settings className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Healthy</p>
              <p className="text-2xl font-bold text-green-600">{systemMetrics.healthyPlugins}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Issues</p>
              <p className="text-2xl font-bold text-red-600">{systemMetrics.unhealthyPlugins}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response</p>
              <p className="text-2xl font-bold">{Math.round(systemMetrics.averageResponseTime)}ms</p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>
    );
  };

  // Render plugin card
  const renderPluginCard = (status: PluginStatus) => {
    const { plugin, health, validation, installation } = status;
    
    return (
      <Card key={plugin.name} className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {getStatusIcon(status)}
            <div>
              <h3 className="font-semibold">{plugin.name}</h3>
              <p className="text-sm text-gray-600">{plugin.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={`text-${getStatusColor(status)}-600`}>
              {plugin.version}
            </Badge>
            <Badge variant="outline">
              {plugin.pluginType}
            </Badge>
          </div>
        </div>

        {installation && installation.stage !== 'complete' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Installing</span>
              <span className="text-sm text-gray-600">{installation.progress}%</span>
            </div>
            <Progress value={installation.progress} className="h-2" />
            <p className="text-xs text-gray-600 mt-1">{installation.message}</p>
          </div>
        )}

        {health && (
          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <span className="text-gray-600">Response Time:</span>
              <span className="ml-2 font-medium">{health.responseTime}ms</span>
            </div>
            <div>
              <span className="text-gray-600">Error Rate:</span>
              <span className="ml-2 font-medium">{(health.metrics.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-gray-600">Memory:</span>
              <span className="ml-2 font-medium">{health.metrics.memoryUsage.toFixed(1)}MB</span>
            </div>
            <div>
              <span className="text-gray-600">CPU:</span>
              <span className="ml-2 font-medium">{health.metrics.cpuUsage.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {validation && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Validation Score</span>
              <span className={`text-sm font-bold ${
                validation.score >= 80 ? 'text-green-600' : 
                validation.score >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {validation.score}/100
              </span>
            </div>
            <Progress 
              value={validation.score} 
              className={`h-2 ${
                validation.score >= 80 ? 'bg-green-100' : 
                validation.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
              }`}
            />
            
            {validation.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-red-600 font-medium">
                  {validation.errors.length} error{validation.errors.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <Clock className="h-3 w-3" />
            <span>Updated {new Date(plugin.lastUpdated).toLocaleTimeString()}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedPlugin(plugin.name)}
          >
            Details
          </Button>
        </div>
      </Card>
    );
  };

  // Render detailed plugin view
  const renderPluginDetails = () => {
    const status = pluginStatuses.find(s => s.plugin.name === selectedPlugin);
    if (!status) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{status.plugin.name}</h2>
              <Button variant="outline" onClick={() => setSelectedPlugin(null)}>
                Close
              </Button>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Plugin Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Version:</span>
                      <span className="ml-2">{status.plugin.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2">{status.plugin.pluginType}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Author:</span>
                      <span className="ml-2">{status.plugin.author}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2">{status.plugin.installationStatus}</span>
                    </div>
                  </div>
                </Card>

                {status.plugin.dependencies.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Dependencies</h3>
                    <div className="space-y-2">
                      {status.plugin.dependencies.map((dep, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span>{dep}</span>
                          <Badge variant="outline">Required</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                {status.health ? (
                  <>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Performance Metrics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">Response Time</span>
                            <span className="text-sm font-medium">{status.health.responseTime}ms</span>
                          </div>
                          <Progress value={Math.min(status.health.responseTime / 10, 100)} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">Error Rate</span>
                            <span className="text-sm font-medium">{(status.health.metrics.errorRate * 100).toFixed(2)}%</span>
                          </div>
                          <Progress value={status.health.metrics.errorRate * 100} />
                        </div>
                      </div>
                    </Card>

                    {status.health.errors.length > 0 && (
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 text-red-600">Recent Errors</h3>
                        <div className="space-y-2">
                          {status.health.errors.map((error, index) => (
                            <Alert key={index} className="border-red-200">
                              <AlertTriangle className="h-4 w-4" />
                              <p className="text-sm">{error}</p>
                            </Alert>
                          ))}
                        </div>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="p-4">
                    <p className="text-gray-600">No health data available</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="validation" className="space-y-4">
                {status.validation ? (
                  <>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Validation Results</h3>
                      <div className="flex items-center justify-between mb-4">
                        <span>Overall Score</span>
                        <span className={`text-2xl font-bold ${
                          status.validation.score >= 80 ? 'text-green-600' : 
                          status.validation.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {status.validation.score}/100
                        </span>
                      </div>
                      <Progress value={status.validation.score} />
                    </Card>

                    {status.validation.errors.length > 0 && (
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 text-red-600">Validation Errors</h3>
                        <div className="space-y-3">
                          {status.validation.errors.map((error, index) => (
                            <Alert key={index} className="border-red-200">
                              <AlertTriangle className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{error.message}</p>
                                {error.suggestedFix && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    Fix: {error.suggestedFix}
                                  </p>
                                )}
                              </div>
                            </Alert>
                          ))}
                        </div>
                      </Card>
                    )}

                    {status.validation.warnings.length > 0 && (
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 text-yellow-600">Warnings</h3>
                        <div className="space-y-3">
                          {status.validation.warnings.map((warning, index) => (
                            <Alert key={index} className="border-yellow-200">
                              <Info className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{warning.message}</p>
                                {warning.recommendation && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    Recommendation: {warning.recommendation}
                                  </p>
                                )}
                              </div>
                            </Alert>
                          ))}
                        </div>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="p-4">
                    <p className="text-gray-600">No validation data available</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="logs">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Plugin Logs</h3>
                  <p className="text-gray-600">Log viewing functionality would be implemented here</p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200">
        <AlertTriangle className="h-4 w-4" />
        <div>
          <h3 className="font-medium">Failed to load plugin status</h3>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plugin Status Monitor</h1>
          <p className="text-gray-600">Monitor plugin health, performance, and installation status</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setRealTimeUpdates(!realTimeUpdates)}
            className={realTimeUpdates ? 'bg-green-50 border-green-200' : ''}
          >
            <Activity className="h-4 w-4 mr-2" />
            Real-time {realTimeUpdates ? 'On' : 'Off'}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Metrics */}
      {renderSystemMetrics()}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
        >
          All ({pluginStatuses.length})
        </Button>
        <Button
          variant={filter === 'healthy' ? 'default' : 'outline'}
          onClick={() => setFilter('healthy')}
          size="sm"
        >
          Healthy ({systemMetrics?.healthyPlugins || 0})
        </Button>
        <Button
          variant={filter === 'unhealthy' ? 'default' : 'outline'}
          onClick={() => setFilter('unhealthy')}
          size="sm"
        >
          Issues ({systemMetrics?.unhealthyPlugins || 0})
        </Button>
        <Button
          variant={filter === 'installing' ? 'default' : 'outline'}
          onClick={() => setFilter('installing')}
          size="sm"
        >
          Installing ({systemMetrics?.installingPlugins || 0})
        </Button>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlugins.map(renderPluginCard)}
      </div>

      {filteredPlugins.length === 0 && (
        <Card className="p-8 text-center">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'No plugins are currently installed' 
              : `No plugins match the "${filter}" filter`
            }
          </p>
        </Card>
      )}

      {/* Plugin Details Modal */}
      {selectedPlugin && renderPluginDetails()}
    </div>
  );
};