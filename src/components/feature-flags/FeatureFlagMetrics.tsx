/**
 * Feature Flag Metrics Component
 * Analytics and performance metrics visualization
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Activity, 
  AlertTriangle, 
  Clock,
  Users,
  Zap,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { FeatureFlag } from '@/lib/feature-flags/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface FeatureFlagMetricsProps {
  flags: FeatureFlag[];
  environment: string;
}

interface MetricsData {
  summary: {
    totalFlags: number;
    totalEvaluations: number;
    averageErrorRate: number;
    averageLatency: number;
  };
  trends: Record<string, {
    timestamps: string[];
    evaluations: number[];
    errorRates: number[];
    latencies: number[];
  }>;
  anomalies: Record<string, {
    hasAnomalies: boolean;
    anomalies: Array<{
      type: string;
      severity: string;
      description: string;
      timestamp: string;
      value: number;
    }>;
  }>;
}

export function FeatureFlagMetrics({ flags, environment }: FeatureFlagMetricsProps) {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);

  const timeRanges = {
    '1h': { label: '1 Hour', hours: 1 },
    '24h': { label: '24 Hours', hours: 24 },
    '7d': { label: '7 Days', hours: 168 },
    '30d': { label: '30 Days', hours: 720 }
  };

  useEffect(() => {
    // Select first 5 flags by default
    if (flags.length > 0 && selectedFlags.length === 0) {
      setSelectedFlags(flags.slice(0, 5).map(f => f.key));
    }
  }, [flags, selectedFlags]);

  const loadMetrics = async () => {
    if (selectedFlags.length === 0) return;

    try {
      setLoading(true);
      const range = timeRanges[selectedTimeRange as keyof typeof timeRanges];
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - range.hours * 60 * 60 * 1000);

      const params = new URLSearchParams({
        flagKeys: selectedFlags.join(','),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval: range.hours > 24 ? '1440' : '60' // 24h or 1h intervals
      });

      const response = await fetch(`/api/feature-flags/metrics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load metrics');
      }

      const result = await response.json();
      if (result.success) {
        setMetricsData(result.data);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [selectedFlags, selectedTimeRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatLatency = (latency: number) => {
    if (latency >= 1000) return (latency / 1000).toFixed(2) + 's';
    return latency.toFixed(0) + 'ms';
  };

  const getStatusColor = (value: number, type: 'error' | 'latency') => {
    if (type === 'error') {
      if (value > 5) return 'text-red-600';
      if (value > 1) return 'text-yellow-600';
      return 'text-green-600';
    } else {
      if (value > 500) return 'text-red-600';
      if (value > 200) return 'text-yellow-600';
      return 'text-green-600';
    }
  };

  if (loading && !metricsData) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Selected Flags</label>
              <Select
                value={selectedFlags[0] || ''}
                onValueChange={(value) => {
                  // This is a simplified selection - in reality you'd want multi-select
                  setSelectedFlags(value ? [value] : []);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select flags to analyze" />
                </SelectTrigger>
                <SelectContent>
                  {flags.map((flag) => (
                    <SelectItem key={flag.key} value={flag.key}>
                      {flag.name} ({flag.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeRanges).map(([key, range]) => (
                    <SelectItem key={key} value={key}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6">
              <Button 
                onClick={loadMetrics} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {metricsData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(metricsData.summary.totalEvaluations)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {timeRanges[selectedTimeRange as keyof typeof timeRanges].label.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(metricsData.summary.averageErrorRate, 'error')}`}>
                  {metricsData.summary.averageErrorRate.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Average across all flags
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(metricsData.summary.averageLatency, 'latency')}`}>
                  {formatLatency(metricsData.summary.averageLatency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flags Analyzed</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedFlags.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Of {flags.length} total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <Tabs defaultValue="trends" className="space-y-4">
            <TabsList>
              <TabsTrigger value="trends">Performance Trends</TabsTrigger>
              <TabsTrigger value="breakdown">Flag Breakdown</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-4">
              {selectedFlags.map((flagKey) => {
                const trendData = metricsData.trends[flagKey];
                if (!trendData) return null;

                const chartData = trendData.timestamps.map((timestamp, index) => ({
                  time: new Date(timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }),
                  evaluations: trendData.evaluations[index] || 0,
                  errorRate: trendData.errorRates[index] || 0,
                  latency: trendData.latencies[index] || 0
                }));

                return (
                  <Card key={flagKey}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Performance: {flags.find(f => f.key === flagKey)?.name}</span>
                        <Badge variant="outline">{flagKey}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Evaluations Chart */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Evaluations
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip />
                              <Line 
                                type="monotone" 
                                dataKey="evaluations" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Error Rate Chart */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Error Rate (%)
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip />
                              <Line 
                                type="monotone" 
                                dataKey="errorRate" 
                                stroke="#ef4444" 
                                strokeWidth={2} 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Flag Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedFlags.map((flagKey) => {
                      const flag = flags.find(f => f.key === flagKey);
                      if (!flag) return null;

                      return (
                        <div key={flagKey} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <div className="font-medium">{flag.name}</div>
                            <div className="text-sm text-muted-foreground">{flag.key}</div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-sm font-medium">Evaluations</div>
                              <div className="text-lg">1.2K</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-medium">Error Rate</div>
                              <div className="text-lg text-green-600">0.1%</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-medium">Latency</div>
                              <div className="text-lg text-green-600">45ms</div>
                            </div>
                            <Badge 
                              className={flag.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
                            >
                              {flag.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anomalies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Detected Anomalies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(metricsData.anomalies).map(([flagKey, anomalyData]) => {
                      if (!anomalyData.hasAnomalies) return null;

                      return (
                        <div key={flagKey} className="space-y-2">
                          <h4 className="font-medium">{flags.find(f => f.key === flagKey)?.name}</h4>
                          <div className="space-y-2">
                            {anomalyData.anomalies.map((anomaly, index) => (
                              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                                <div className={`p-1 rounded-full ${
                                  anomaly.severity === 'high' ? 'bg-red-100' :
                                  anomaly.severity === 'medium' ? 'bg-yellow-100' :
                                  'bg-blue-100'
                                }`}>
                                  <AlertTriangle className={`h-3 w-3 ${
                                    anomaly.severity === 'high' ? 'text-red-600' :
                                    anomaly.severity === 'medium' ? 'text-yellow-600' :
                                    'text-blue-600'
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{anomaly.type.replace('_', ' ').toUpperCase()}</span>
                                    <Badge variant={
                                      anomaly.severity === 'high' ? 'destructive' :
                                      anomaly.severity === 'medium' ? 'secondary' :
                                      'outline'
                                    }>
                                      {anomaly.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {anomaly.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(anomaly.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {Object.values(metricsData.anomalies).every(a => !a.hasAnomalies) && (
                      <div className="text-center py-8">
                        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                          <Zap className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-green-700">All Systems Normal</h3>
                        <p className="text-muted-foreground">
                          No anomalies detected in the selected time range
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}