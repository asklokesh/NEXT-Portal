'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  Server,
  Database,
  Cpu,
  Memory,
  HardDrive,
  Zap,
  RefreshCw,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  message: string;
  lastCheck: string;
  consecutiveFailures: number;
  responseTime?: number;
  metrics?: Record<string, any>;
}

interface SystemAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  service: string;
  timestamp: string;
  actions: number;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  services: ServiceHealth[];
  alerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    alerts?: SystemAlert[];
  };
  automation: {
    enabled: boolean;
    activeResolutions: number;
    totalPatterns: number;
    resolutionHistory: number;
  };
  systemMetrics?: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    loadAverage: number[];
  };
}

export function ComprehensiveHealthDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detailed, setDetailed] = useState(false);

  const fetchHealthData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (detailed) params.append('detailed', 'true');
      
      const response = await fetch(`/api/monitoring/comprehensive-health?${params}`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('[HealthDashboard] Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  }, [detailed]);

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/comprehensive-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_alert', alertId })
      });
      
      if (response.ok) {
        await fetchHealthData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const toggleAutomation = async () => {
    try {
      const action = healthData?.automation.enabled ? 'disable_automation' : 'enable_automation';
      const response = await fetch('/api/monitoring/comprehensive-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (response.ok) {
        await fetchHealthData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to toggle automation:', err);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealthData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      case 'down':
        return 'bg-red-600';
      default:
        return 'bg-gray-400';
    }
  };

  const getSeverityBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    const mb = Math.round(bytes / 1024 / 1024);
    return `${mb} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading health data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load health data: {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHealthData}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!healthData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">
            Comprehensive monitoring and automated issue resolution
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailed(!detailed)}
          >
            {detailed ? 'Simple' : 'Detailed'} View
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
            {getStatusIcon(healthData.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{healthData.status}</div>
            <div className={`h-2 rounded-full mt-2 ${getStatusColor(healthData.status)}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(healthData.uptime)}</div>
            <p className="text-xs text-muted-foreground">
              Version {healthData.version}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.alerts.total}</div>
            <div className="flex space-x-1 mt-2">
              {healthData.alerts.critical > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {healthData.alerts.critical} Critical
                </Badge>
              )}
              {healthData.alerts.high > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {healthData.alerts.high} High
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                healthData.automation.enabled ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm">
                {healthData.automation.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {healthData.automation.activeResolutions} active
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutomation}
              className="mt-2"
            >
              <Settings className="h-3 w-3 mr-1" />
              {healthData.automation.enabled ? 'Disable' : 'Enable'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Services Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthData.services.map((service) => (
              <div key={service.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium capitalize">{service.name}</h4>
                  {getStatusIcon(service.status)}
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {service.message}
                </p>
                
                <div className="flex items-center justify-between text-xs">
                  <span>
                    Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                  </span>
                  {service.responseTime && (
                    <span>{service.responseTime}ms</span>
                  )}
                </div>
                
                {service.consecutiveFailures > 0 && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-xs">
                      {service.consecutiveFailures} failures
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {healthData.alerts.alerts && healthData.alerts.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthData.alerts.alerts.map((alert) => (
                <div key={alert.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{alert.title}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Service: {alert.service}</span>
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  
                  {alert.actions > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {alert.actions} automated actions available
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Metrics (Detailed View) */}
      {detailed && healthData.systemMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              System Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center mb-2">
                  <Memory className="h-4 w-4 mr-2" />
                  <span className="font-medium">Memory Usage</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Heap Used:</span>
                    <span>{formatMemory(healthData.systemMetrics.memory.heapUsed)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Heap Total:</span>
                    <span>{formatMemory(healthData.systemMetrics.memory.heapTotal)}</span>
                  </div>
                  <Progress 
                    value={(healthData.systemMetrics.memory.heapUsed / healthData.systemMetrics.memory.heapTotal) * 100}
                    className="h-2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Cpu className="h-4 w-4 mr-2" />
                  <span className="font-medium">System Info</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>Node: {healthData.systemMetrics.nodeVersion}</div>
                  <div>Platform: {healthData.systemMetrics.platform}</div>
                  <div>Arch: {healthData.systemMetrics.arch}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <HardDrive className="h-4 w-4 mr-2" />
                  <span className="font-medium">Load Average</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>1min: {healthData.systemMetrics.loadAverage[0]?.toFixed(2)}</div>
                  <div>5min: {healthData.systemMetrics.loadAverage[1]?.toFixed(2)}</div>
                  <div>15min: {healthData.systemMetrics.loadAverage[2]?.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}