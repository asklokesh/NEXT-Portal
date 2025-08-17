'use client';

/**
 * Comprehensive Plugin Management Dashboard
 * 
 * Main dashboard that integrates all no-code plugin management features:
 * - Visual marketplace with 340+ plugins
 * - No-code configuration
 * - Automated installation & deployment
 * - Enterprise governance & approvals
 * - Real-time monitoring & health
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Settings,
  Shield,
  Monitor,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  GitBranch,
  Zap,
  Globe,
  Activity,
  BarChart3,
  Bell,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Download,
  Star,
  Heart,
  ExternalLink
} from 'lucide-react';
import { SpotifyPortalMarketplace } from '@/components/plugins/SpotifyPortalMarketplace';
import { NoCodeConfigurationManager } from '@/components/plugins/NoCodeConfigurationManager';

interface DashboardTab {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<any>;
}

interface PluginStats {
  total: number;
  installed: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  pending: number;
}

interface DeploymentMetrics {
  totalDeployments: number;
  activeDeployments: number;
  failedDeployments: number;
  averageUptime: number;
  totalRequests: number;
  errorRate: number;
}

export default function ComprehensivePluginManagement() {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [selectedTenant, setSelectedTenant] = useState('default');

  // Fetch dashboard overview data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['plugin-dashboard', selectedTenant],
    queryFn: async () => {
      const response = await fetch(`/api/plugins/comprehensive?action=dashboard&tenantId=${selectedTenant}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ['plugin-alerts', selectedTenant],
    queryFn: async () => {
      const response = await fetch(`/api/plugins/comprehensive?action=alerts&tenantId=${selectedTenant}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch deployments
  const { data: deploymentsData } = useQuery({
    queryKey: ['plugin-deployments', selectedTenant],
    queryFn: async () => {
      const response = await fetch(`/api/plugins/comprehensive?action=deployments&tenantId=${selectedTenant}`);
      if (!response.ok) throw new Error('Failed to fetch deployments');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const dashboard = dashboardData?.dashboard;
  const alerts = alertsData?.alerts || [];
  const deployments = deploymentsData?.deployments || [];

  const tabs: DashboardTab[] = [
    {
      id: 'marketplace',
      name: 'Plugin Marketplace',
      icon: Package,
      component: MarketplaceTab
    },
    {
      id: 'deployments',
      name: 'Deployments',
      icon: GitBranch,
      component: DeploymentsTab
    },
    {
      id: 'monitoring',
      name: 'Monitoring',
      icon: Monitor,
      component: MonitoringTab
    },
    {
      id: 'governance',
      name: 'Governance',
      icon: Shield,
      component: GovernanceTab
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: BarChart3,
      component: AnalyticsTab
    }
  ];

  const getPluginStats = (): PluginStats => {
    if (!dashboard) {
      return { total: 0, installed: 0, healthy: 0, degraded: 0, unhealthy: 0, pending: 0 };
    }

    return {
      total: dashboard.overview.totalPlugins,
      installed: dashboard.plugins.filter((p: any) => p.status !== 'unknown').length,
      healthy: dashboard.overview.healthyPlugins,
      degraded: dashboard.overview.degradedPlugins,
      unhealthy: dashboard.overview.unhealthyPlugins,
      pending: dashboard.overview.totalPlugins - dashboard.plugins.length
    };
  };

  const getDeploymentMetrics = (): DeploymentMetrics => {
    if (!deployments.length) {
      return {
        totalDeployments: 0,
        activeDeployments: 0,
        failedDeployments: 0,
        averageUptime: 0,
        totalRequests: 0,
        errorRate: 0
      };
    }

    const active = deployments.filter((d: any) => d.status === 'running').length;
    const failed = deployments.filter((d: any) => d.status === 'failed').length;
    const totalRequests = deployments.reduce((sum: number, d: any) => sum + (d.metrics?.requests || 0), 0);
    const totalErrors = deployments.reduce((sum: number, d: any) => sum + (d.metrics?.errors || 0), 0);

    return {
      totalDeployments: deployments.length,
      activeDeployments: active,
      failedDeployments: failed,
      averageUptime: deployments.reduce((sum: number, d: any) => sum + (d.uptime || 0), 0) / deployments.length,
      totalRequests,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    };
  };

  const pluginStats = getPluginStats();
  const deploymentMetrics = getDeploymentMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="w-12 h-12 animate-pulse text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Plugin Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing comprehensive plugin dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Plugin Management
                </h1>
              </div>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Tenant: {selectedTenant}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Active Alerts Indicator */}
              {alerts.length > 0 && (
                <div className="relative">
                  <Bell className="w-6 h-6 text-red-500" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      {alerts.length}
                    </span>
                  </div>
                </div>
              )}

              {/* System Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  pluginStats.unhealthy > 0 ? 'bg-red-500' :
                  pluginStats.degraded > 0 ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {pluginStats.unhealthy > 0 ? 'Degraded' :
                   pluginStats.degraded > 0 ? 'Warning' : 'Healthy'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {/* Plugin Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Plugins</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {pluginStats.total}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Healthy</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {pluginStats.healthy}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Degraded</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {pluginStats.degraded}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Deployments</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {deploymentMetrics.activeDeployments}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</span>
            </div>
            <div className="text-2xl font-bold text-indigo-600">
              {deploymentMetrics.averageUptime.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Alerts</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {alerts.length}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {tabs.map((tab) => {
              if (activeTab !== tab.id) return null;
              const Component = tab.component;
              return (
                <Component
                  key={tab.id}
                  tenantId={selectedTenant}
                  dashboard={dashboard}
                  alerts={alerts}
                  deployments={deployments}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab Components
function MarketplaceTab({ tenantId }: { tenantId: string }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Plugin Marketplace
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Discover, install, and manage 340+ Backstage plugins with no-code configuration
        </p>
      </div>
      <SpotifyPortalMarketplace tenantId={tenantId} />
    </div>
  );
}

function DeploymentsTab({ deployments }: { deployments: any[] }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Plugin Deployments
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage plugin deployments across environments
        </p>
      </div>

      <div className="space-y-4">
        {deployments.map((deployment) => (
          <div
            key={deployment.deploymentId}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  deployment.health === 'healthy' ? 'bg-green-500' :
                  deployment.health === 'degraded' ? 'bg-yellow-500' :
                  deployment.health === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {deployment.pluginId}
                </h3>
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                  {deployment.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20">
                  <PlayCircle className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-yellow-600 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                  <PauseCircle className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Replicas</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {deployment.replicas?.ready || 0}/{deployment.replicas?.desired || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">CPU</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {deployment.metrics?.cpu || 0}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Memory</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {deployment.metrics?.memory || 0}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Requests</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {deployment.metrics?.requests || 0}
                </div>
              </div>
            </div>
          </div>
        ))}

        {deployments.length === 0 && (
          <div className="text-center py-8">
            <GitBranch className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No deployments found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Deploy your first plugin to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonitoringTab({ dashboard, alerts }: { dashboard: any; alerts: any[] }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Real-Time Monitoring
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor plugin health, performance, and receive intelligent alerts
        </p>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
            Active Alerts ({alerts.length})
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                  alert.severity === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {alert.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Plugin: {alert.pluginId}</span>
                      <span>Tenant: {alert.tenantId}</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                      alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plugin Health Overview */}
      {dashboard?.plugins && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
            Plugin Health Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.plugins.map((plugin: any) => (
              <div
                key={`${plugin.pluginId}-${plugin.tenantId}`}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {plugin.pluginId}
                  </h4>
                  <div className={`w-3 h-3 rounded-full ${
                    plugin.status === 'healthy' ? 'bg-green-500' :
                    plugin.status === 'degraded' ? 'bg-yellow-500' :
                    plugin.status === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Response Time</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {plugin.responseTime?.current || 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Error Rate</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {plugin.errorRate || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Availability</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {plugin.availability || 0}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GovernanceTab({ tenantId }: { tenantId: string }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Enterprise Governance
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage approval workflows, security scanning, and compliance
        </p>
      </div>

      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Governance Dashboard
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Approval workflows and compliance features coming soon
        </p>
      </div>
    </div>
  );
}

function AnalyticsTab({ dashboard }: { dashboard: any }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Plugin Analytics
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Insights into plugin usage, performance trends, and optimization opportunities
        </p>
      </div>

      <div className="text-center py-8">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Analytics Dashboard
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Detailed analytics and insights coming soon
        </p>
      </div>
    </div>
  );
}