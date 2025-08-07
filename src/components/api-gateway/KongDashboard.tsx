'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Monitor,
  Network,
  Shield,
  Settings,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

interface NodeInfo {
  hostname: string;
  node_id: string;
  version: string;
  lua_version: string;
}

interface NodeStatus {
  database: { reachable: boolean };
  server: {
    connections_accepted: number;
    connections_active: number;
    connections_handled: number;
    connections_reading: number;
    connections_waiting: number;
    connections_writing: number;
    total_requests: number;
  };
}

interface ServiceInfo {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  path?: string;
  tags: string[];
}

interface RouteInfo {
  id: string;
  name: string;
  protocols: string[];
  methods: string[];
  paths?: string[];
  service: { id: string };
  tags: string[];
}

interface PluginInfo {
  id: string;
  name: string;
  enabled: boolean;
  protocols: string[];
  tags: string[];
}

interface ConsumerInfo {
  id: string;
  username: string;
  custom_id?: string;
  tags: string[];
}

interface GatewayMetrics {
  requestRate: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  statusCodeDistribution: Record<string, number>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  topConsumers: Array<{ consumer: string; count: number }>;
}

export function KongDashboard() {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [consumers, setConsumers] = useState<ConsumerInfo[]>([]);
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      const [
        nodeInfoResponse,
        nodeStatusResponse,
        servicesResponse,
        routesResponse,
        pluginsResponse,
        consumersResponse,
        metricsResponse
      ] = await Promise.all([
        fetch('/api/kong/admin/node-info'),
        fetch('/api/kong/admin/node-status'),
        fetch('/api/kong/admin/services'),
        fetch('/api/kong/admin/routes'),
        fetch('/api/kong/admin/plugins'),
        fetch('/api/kong/admin/consumers'),
        fetch('/api/kong/admin/metrics')
      ]);

      if (!nodeInfoResponse.ok) throw new Error('Failed to fetch node info');
      if (!nodeStatusResponse.ok) throw new Error('Failed to fetch node status');

      const [
        nodeInfoData,
        nodeStatusData,
        servicesData,
        routesData,
        pluginsData,
        consumersData,
        metricsData
      ] = await Promise.all([
        nodeInfoResponse.json(),
        nodeStatusResponse.json(),
        servicesResponse.ok ? servicesResponse.json() : { data: [] },
        routesResponse.ok ? routesResponse.json() : { data: [] },
        pluginsResponse.ok ? pluginsResponse.json() : { data: [] },
        consumersResponse.ok ? consumersResponse.json() : { data: [] },
        metricsResponse.ok ? metricsResponse.json() : null
      ]);

      setNodeInfo(nodeInfoData);
      setNodeStatus(nodeStatusData);
      setServices(servicesData.data || []);
      setRoutes(routesData.data || []);
      setPlugins(pluginsData.data || []);
      setConsumers(consumersData.data || []);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600';
  const getStatusIcon = (status: boolean) => status ? CheckCircle : AlertTriangle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kong API Gateway</h1>
          <p className="text-gray-600 mt-1">Manage your API gateway configuration and monitor performance</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline" size="sm">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Node Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {React.createElement(
                getStatusIcon(nodeStatus?.database.reachable ?? false),
                { className: `h-4 w-4 ${getStatusColor(nodeStatus?.database.reachable ?? false)}` }
              )}
              <span className="text-sm">
                {nodeStatus?.database.reachable ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Version: {nodeInfo?.version}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nodeStatus?.server.connections_active || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {nodeStatus?.server.connections_accepted || 0} accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nodeStatus?.server.total_requests?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.requestRate.toFixed(1) || 0} req/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.errorRate.toFixed(2) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {metrics?.avgResponseTime?.toFixed(0) || 0}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="consumers">Consumers</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Services Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Services
                </CardTitle>
                <CardDescription>
                  {services.length} services configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {services.slice(0, 5).map(service => (
                    <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{service.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {service.protocol}://{service.host}:{service.port}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        {service.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {services.length > 5 && (
                    <p className="text-sm text-gray-500">
                      And {services.length - 5} more services...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Plugins Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Plugins
                </CardTitle>
                <CardDescription>
                  {plugins.filter(p => p.enabled).length} of {plugins.length} plugins enabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plugins.slice(0, 5).map(plugin => (
                    <div key={plugin.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center">
                        <span className="font-medium">{plugin.name}</span>
                        {plugin.enabled ? (
                          <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500 ml-2" />
                        )}
                      </div>
                      <div className="flex space-x-1">
                        {plugin.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {plugins.length > 5 && (
                    <p className="text-sm text-gray-500">
                      And {plugins.length - 5} more plugins...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Manage upstream services and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Protocol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Host
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Port
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {services.map(service => (
                      <tr key={service.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {service.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {service.protocol.toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {service.host}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {service.port}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {service.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Routes</CardTitle>
              <CardDescription>
                Configure routing rules for incoming requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Methods
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paths
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Protocols
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map(route => {
                      const service = services.find(s => s.id === route.service.id);
                      return (
                        <tr key={route.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {route.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {route.methods.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {route.paths?.join(', ') || 'Any'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {route.protocols.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {service?.name || route.service.id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plugins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plugins</CardTitle>
              <CardDescription>
                Configure plugins for authentication, security, and traffic management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {plugins.map(plugin => (
                  <div key={plugin.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          plugin.enabled ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        <div>
                          <h3 className="font-medium">{plugin.name}</h3>
                          <p className="text-sm text-gray-500">
                            Protocols: {plugin.protocols.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        {plugin.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Consumers
              </CardTitle>
              <CardDescription>
                Manage API consumers and their credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custom ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {consumers.map(consumer => (
                      <tr key={consumer.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {consumer.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {consumer.custom_id || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {consumer.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                      <Clock className="w-4 h-4 mr-2" />
                      Response Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.avgResponseTime.toFixed(0)}ms
                    </div>
                    <p className="text-xs text-gray-500">
                      95th percentile: {metrics.p95ResponseTime.toFixed(0)}ms
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Request Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.requestRate.toFixed(1)}
                    </div>
                    <p className="text-xs text-gray-500">requests per minute</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Error Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.errorRate.toFixed(2)}%
                    </div>
                    <p className="text-xs text-gray-500">of total requests</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Endpoints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.topEndpoints.slice(0, 10).map((endpoint, index) => (
                        <div key={endpoint.endpoint} className="flex justify-between items-center">
                          <span className="text-sm font-mono">{endpoint.endpoint}</span>
                          <Badge variant="secondary">{endpoint.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Status Code Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(metrics.statusCodeDistribution)
                        .sort(([, a], [, b]) => b - a)
                        .map(([code, count]) => (
                          <div key={code} className="flex justify-between items-center">
                            <span className={`text-sm font-mono ${
                              code.startsWith('2') ? 'text-green-600' :
                              code.startsWith('4') ? 'text-yellow-600' :
                              code.startsWith('5') ? 'text-red-600' : ''
                            }`}>
                              {code}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}