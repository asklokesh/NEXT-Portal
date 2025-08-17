'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity,
  Database,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Server,
  Gauge
} from 'lucide-react';

interface DatabaseMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  trend?: 'up' | 'down' | 'stable';
}

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'critical';
  score: number;
  metrics: {
    connectionUtilization: number;
    queryLatency: number;
    errorRate: number;
    cacheHitRatio: number;
    replicationLag?: number;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  executionPlan?: any;
}

interface IndexUsageStat {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
}

interface DashboardData {
  health: DatabaseHealth;
  metrics: {
    connectionUtilization: number | null;
    cacheHitRatio: number | null;
    avgQueryTime: number | null;
    replicationLag: number | null;
    transactionsPerSecond: number | null;
  };
  slowQueries: SlowQuery[];
  indexUsage: IndexUsageStat[];
}

export default function DatabasePerformanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData();
    
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/database/dashboard');
      const dashboardData = await response.json();
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-500">Loading database performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Performance</h1>
          <p className="text-gray-600">
            Real-time monitoring and analytics for enterprise database operations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Badge>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
        </div>
      </div>

      {/* Health Status */}
      <Card className={`border-2 ${getHealthStatusColor(data.health.status)}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            {getHealthStatusIcon(data.health.status)}
            Database Health
          </CardTitle>
          <div className="text-2xl font-bold">
            {data.health.score}/100
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">Overall Health Score</span>
            <Progress value={data.health.score} className="w-32" />
          </div>
          
          {data.health.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Current Issues:</h4>
              {data.health.issues.slice(0, 3).map((issue, index) => (
                <Alert key={index} className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      issue.severity === 'critical' ? 'bg-red-500' :
                      issue.severity === 'high' ? 'bg-orange-500' :
                      issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    {issue.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Pool</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.metrics.connectionUtilization?.toFixed(1) || '0'}%
            </div>
            <Progress value={data.metrics.connectionUtilization || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Connection utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.metrics.cacheHitRatio?.toFixed(1) || '0'}%
            </div>
            <Progress value={data.metrics.cacheHitRatio || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Buffer cache efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.metrics.avgQueryTime ? formatDuration(data.metrics.avgQueryTime) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Average execution time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions/sec</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.metrics.transactionsPerSecond?.toFixed(0) || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Committed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replication Lag</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.metrics.replicationLag ? formatDuration(data.metrics.replicationLag) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Read replica delay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="indexes">Index Usage</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Query Analysis</CardTitle>
              <CardDescription>
                Queries with execution time exceeding performance thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.slowQueries.length > 0 ? (
                <div className="space-y-4">
                  {data.slowQueries.map((query, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={query.duration > 10000 ? 'destructive' : 'secondary'}>
                          {formatDuration(query.duration)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(query.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {query.query.length > 200 ? 
                          `${query.query.substring(0, 200)}...` : 
                          query.query
                        }
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No slow queries detected in the current monitoring period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Index Usage Statistics</CardTitle>
              <CardDescription>
                Database index performance and utilization metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.indexUsage.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Table
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Index
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Scans
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Tuples Read
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Efficiency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.indexUsage.slice(0, 20).map((stat, index) => {
                        const efficiency = stat.idx_tup_read > 0 ? 
                          (stat.idx_tup_fetch / stat.idx_tup_read * 100) : 0;
                        
                        return (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {stat.tablename}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                              {stat.indexname}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {stat.idx_scan.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {stat.idx_tup_read.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Badge variant={efficiency > 80 ? 'default' : efficiency > 50 ? 'secondary' : 'destructive'}>
                                {efficiency.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No index usage statistics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Historical database performance metrics and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Metrics */}
                <div className="space-y-4">
                  <h3 className="font-medium">Connection Pool</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Utilization</span>
                      <span className="text-sm font-medium">
                        {data.health.metrics.connectionUtilization.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={data.health.metrics.connectionUtilization} />
                  </div>
                </div>

                {/* Query Performance */}
                <div className="space-y-4">
                  <h3 className="font-medium">Query Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Latency</span>
                      <span className="text-sm font-medium">
                        {formatDuration(data.health.metrics.queryLatency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Error Rate</span>
                      <span className="text-sm font-medium">
                        {data.health.metrics.errorRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cache Performance */}
                <div className="space-y-4">
                  <h3 className="font-medium">Cache Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Hit Ratio</span>
                      <span className="text-sm font-medium">
                        {data.health.metrics.cacheHitRatio.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={data.health.metrics.cacheHitRatio} />
                  </div>
                </div>

                {/* Replication Status */}
                {data.health.metrics.replicationLag !== undefined && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Replication</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Lag</span>
                        <span className="text-sm font-medium">
                          {formatDuration(data.health.metrics.replicationLag)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}