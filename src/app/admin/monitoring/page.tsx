'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Shield,
  Database,
  Gauge,
  BarChart3,
  AlertCircle,
  Users,
  Globe,
  Loader2
} from 'lucide-react';

interface HealthMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  threshold: {
    warning: number;
    critical: number;
  };
}

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  resolved: boolean;
  component: string;
}

interface PerformanceData {
  timestamp: string;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  memoryUsage: number;
  cpuUsage: number;
}

export default function MonitoringPage() {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Simulate real-time monitoring data
  useEffect(() => {
    const generateHealthMetrics = (): HealthMetric[] => [
      {
        id: 'response-time',
        name: 'Avg Response Time',
        value: Math.random() * 200 + 50,
        unit: 'ms',
        status: Math.random() > 0.8 ? 'warning' : 'healthy',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 200, critical: 500 }
      },
      {
        id: 'error-rate',
        name: 'Error Rate',
        value: Math.random() * 5,
        unit: '%',
        status: Math.random() > 0.9 ? 'critical' : 'healthy',
        trend: Math.random() > 0.3 ? 'down' : 'up',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 2, critical: 5 }
      },
      {
        id: 'memory-usage',
        name: 'Memory Usage',
        value: Math.random() * 40 + 60,
        unit: 'MB',
        status: 'healthy',
        trend: 'stable',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 150, critical: 200 }
      },
      {
        id: 'active-users',
        name: 'Active Users',
        value: Math.floor(Math.random() * 100 + 50),
        unit: 'users',
        status: 'healthy',
        trend: 'up',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 200, critical: 300 }
      },
      {
        id: 'database-connections',
        name: 'DB Connections',
        value: Math.floor(Math.random() * 20 + 5),
        unit: 'connections',
        status: 'healthy',
        trend: 'stable',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 50, critical: 80 }
      },
      {
        id: 'uptime',
        name: 'System Uptime',
        value: 99.9,
        unit: '%',
        status: 'healthy',
        trend: 'stable',
        lastUpdated: new Date().toISOString(),
        threshold: { warning: 99, critical: 95 }
      }
    ];

    const generateAlerts = (): SystemAlert[] => [
      {
        id: '1',
        severity: 'warning',
        message: 'High memory usage detected on main server',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: false,
        component: 'Server'
      },
      {
        id: '2',
        severity: 'info',
        message: 'Scheduled maintenance completed successfully',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        resolved: true,
        component: 'System'
      },
      {
        id: '3',
        severity: 'error',
        message: 'Database connection timeout - resolved',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        resolved: true,
        component: 'Database'
      }
    ];

    const loadData = () => {
      setHealthMetrics(generateHealthMetrics());
      setAlerts(generateAlerts());
      setLastRefresh(new Date());
    };

    // Initial load
    loadData();
    setLoading(false);

    // Auto-refresh every 30 seconds
    const interval = autoRefresh ? setInterval(loadData, 30000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMetricIcon = (id: string) => {
    switch (id) {
      case 'response-time':
        return <Clock className="w-6 h-6" />;
      case 'error-rate':
        return <AlertTriangle className="w-6 h-6" />;
      case 'memory-usage':
        return <Server className="w-6 h-6" />;
      case 'active-users':
        return <Users className="w-6 h-6" />;
      case 'database-connections':
        return <Database className="w-6 h-6" />;
      case 'uptime':
        return <Shield className="w-6 h-6" />;
      default:
        return <Gauge className="w-6 h-6" />;
    }
  };

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setLastRefresh(new Date());
      setLoading(false);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading monitoring data...</p>
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
            System Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time health and performance monitoring for NEXT Portal
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Auto-refresh:
            </label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <button
            onClick={refreshData}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Last Update Info */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Last updated: {lastRefresh.toLocaleString()}
        {autoRefresh && (
          <span className="ml-4 inline-flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Live updates enabled
          </span>
        )}
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {healthMetrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  metric.status === 'healthy' 
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : metric.status === 'warning'
                    ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}>
                  {getMetricIcon(metric.id)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {metric.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {metric.status}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(metric.status)}
                {getTrendIcon(metric.trend)}
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {metric.value.toFixed(metric.unit === '%' ? 1 : 0)}
                </span>
                <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">
                  {metric.unit}
                </span>
              </div>
            </div>

            {/* Threshold indicators */}
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Warning: {metric.threshold.warning}{metric.unit}</span>
              <span>•</span>
              <span>Critical: {metric.threshold.critical}{metric.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Recent Alerts
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {alerts.filter(a => !a.resolved).length} active
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                alert.resolved
                  ? 'border-gray-200 dark:border-gray-700 opacity-60'
                  : alert.severity === 'error'
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                  : alert.severity === 'warning'
                  ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
              }`}
            >
              <div className={`p-2 rounded-full ${
                alert.severity === 'error'
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                  : alert.severity === 'warning'
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              }`}>
                {alert.severity === 'error' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : alert.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {alert.message}
                  </h3>
                  {alert.resolved && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      Resolved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <span>{alert.component}</span>
                  <span>•</span>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Run System Health Check
            </button>
            <button className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              View Performance Logs
            </button>
            <button className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Export Monitoring Data
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">API Gateway</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cache Layer</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">File Storage</span>
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Resources
          </h3>
          <div className="space-y-3">
            <a
              href="/admin/logs"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View System Logs
            </a>
            <a
              href="/admin/performance"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Performance Analytics
            </a>
            <a
              href="/admin/alerts"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Alert Configuration
            </a>
            <a
              href="/docs/monitoring"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Monitoring Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}