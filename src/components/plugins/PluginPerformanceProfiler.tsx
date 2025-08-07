'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Cpu,
  Database,
  Globe,
  Memory,
  Play,
  Square,
  TrendingDown,
  TrendingUp,
  Zap,
  AlertTriangle,
  BarChart3,
  Clock,
  HardDrive,
  Network,
  Server,
  Gauge
} from 'lucide-react';

// Types
interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  points: MetricPoint[];
}

interface FlameGraphNode {
  name: string;
  value: number;
  children: FlameGraphNode[];
}

interface PerformanceData {
  metrics: MetricSeries[];
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    uptime: number;
    platform: string;
    arch: string;
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
  };
  network: {
    totalRequests: number;
    averageLatency: number;
    slowRequests: any[];
    errorRate: number;
    latencyPercentiles: Record<string, number>;
    requestsPerSecond: number;
    topEndpoints: Array<{url: string; count: number; averageLatency: number}>;
  };
  database: {
    totalQueries: number;
    averageDuration: number;
    slowQueries: any[];
    errorRate: number;
    queriesPerSecond: number;
    databaseBreakdown: Array<{database: string; count: number; averageDuration: number}>;
  };
  timestamp: number;
}

interface ProfilingData {
  cpu?: {
    samples: number;
    duration: number;
    flameGraph: FlameGraphNode;
    topFunctions: Array<{name: string; count: number; percentage: number}>;
  };
  memory?: {
    snapshots: Array<{
      timestamp: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    }>;
    leaks: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      trend: number;
    }>;
    trends: any;
    current: any;
    peak: any;
  };
}

// Flame Graph Component
const FlameGraph: React.FC<{data: FlameGraphNode; width?: number; height?: number}> = ({ 
  data, 
  width = 800, 
  height = 400 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<FlameGraphNode | null>(null);
  const [tooltip, setTooltip] = useState<{x: number; y: number; visible: boolean}>({ x: 0, y: 0, visible: false });

  const drawFlameGraph = useCallback((ctx: CanvasRenderingContext2D, node: FlameGraphNode, x: number, y: number, width: number, depth: number = 0) => {
    if (width < 1) return;

    // Color based on depth and value
    const hue = (depth * 30) % 360;
    const saturation = Math.min(70 + (node.value / 100), 100);
    const lightness = Math.max(40, 80 - (depth * 5));
    
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillRect(x, y, width, 20);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, 20);

    // Draw text if there's enough space
    if (width > 50) {
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      const text = node.name.length > 20 ? node.name.substring(0, 17) + '...' : node.name;
      ctx.fillText(text, x + 5, y + 10);
    }

    // Draw children
    let childX = x;
    const totalChildValue = node.children.reduce((sum, child) => sum + child.value, 0);
    
    node.children.forEach(child => {
      const childWidth = totalChildValue > 0 ? (child.value / totalChildValue) * width : 0;
      if (childWidth > 0) {
        drawFlameGraph(ctx, child, childX, y + 25, childWidth, depth + 1);
        childX += childWidth;
      }
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw flame graph
    drawFlameGraph(ctx, data, 0, 0, width);
  }, [data, width, height, drawFlameGraph]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setTooltip({ x: event.clientX, y: event.clientY, visible: true });
  };

  const handleMouseLeave = () => {
    setTooltip({ x: 0, y: 0, visible: false });
    setHoveredNode(null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-200 cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip.visible && hoveredNode && (
        <div
          className="absolute bg-black text-white p-2 rounded shadow-lg pointer-events-none z-10"
          style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          <div>Samples: {hoveredNode.value}</div>
        </div>
      )}
    </div>
  );
};

// Memory Timeline Chart
const MemoryTimeline: React.FC<{snapshots: any[]}> = ({ snapshots }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 600;
  const height = 200;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshots || snapshots.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Find min/max values
    const heapValues = snapshots.map(s => s.heapUsed);
    const minHeap = Math.min(...heapValues);
    const maxHeap = Math.max(...heapValues);
    const range = maxHeap - minHeap || 1;

    // Draw axes
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.moveTo(50, 20);
    ctx.lineTo(50, height - 30);
    ctx.stroke();

    // Draw line chart
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    snapshots.forEach((snapshot, index) => {
      const x = 50 + (index / (snapshots.length - 1)) * (width - 70);
      const y = height - 30 - ((snapshot.heapUsed - minHeap) / range) * (height - 50);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#3b82f6';
    snapshots.forEach((snapshot, index) => {
      const x = 50 + (index / (snapshots.length - 1)) * (width - 70);
      const y = height - 30 - ((snapshot.heapUsed - minHeap) / range) * (height - 50);
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Memory (bytes)', 0, 0);
    ctx.restore();

  }, [snapshots]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="border border-gray-200"
    />
  );
};

// Performance Recommendations Component
const PerformanceRecommendations: React.FC<{data: PerformanceData; profilingData?: ProfilingData}> = ({ 
  data, 
  profilingData 
}) => {
  const recommendations = useMemo(() => {
    const recs = [];

    // Memory recommendations
    if (data.system.memory.heapUsed / data.system.memory.heapTotal > 0.8) {
      recs.push({
        severity: 'high' as const,
        type: 'memory',
        title: 'High Memory Usage',
        description: 'Heap usage is above 80%. Consider optimizing memory allocation.',
        action: 'Review memory usage patterns and implement garbage collection strategies.'
      });
    }

    // CPU recommendations
    if (data.system.loadAverage[0] > 2) {
      recs.push({
        severity: 'medium' as const,
        type: 'cpu',
        title: 'High CPU Load',
        description: 'System load is high. This may affect plugin performance.',
        action: 'Optimize CPU-intensive operations or distribute load.'
      });
    }

    // Network recommendations
    if (data.network.errorRate > 5) {
      recs.push({
        severity: 'high' as const,
        type: 'network',
        title: 'High Error Rate',
        description: `Network error rate is ${data.network.errorRate.toFixed(1)}%.`,
        action: 'Investigate failed requests and implement retry mechanisms.'
      });
    }

    if (data.network.averageLatency > 1000) {
      recs.push({
        severity: 'medium' as const,
        type: 'network',
        title: 'High Latency',
        description: `Average network latency is ${data.network.averageLatency.toFixed(0)}ms.`,
        action: 'Consider caching, CDN, or optimizing API responses.'
      });
    }

    // Database recommendations
    if (data.database.errorRate > 2) {
      recs.push({
        severity: 'high' as const,
        type: 'database',
        title: 'Database Errors',
        description: `Database error rate is ${data.database.errorRate.toFixed(1)}%.`,
        action: 'Review database queries and connection pooling.'
      });
    }

    if (data.database.averageDuration > 200) {
      recs.push({
        severity: 'medium' as const,
        type: 'database',
        title: 'Slow Database Queries',
        description: `Average query time is ${data.database.averageDuration.toFixed(0)}ms.`,
        action: 'Add database indexes and optimize slow queries.'
      });
    }

    // Memory leak detection
    if (profilingData?.memory?.leaks && profilingData.memory.leaks.length > 0) {
      profilingData.memory.leaks.forEach(leak => {
        recs.push({
          severity: leak.severity,
          type: 'memory',
          title: 'Memory Leak Detected',
          description: leak.description,
          action: 'Review code for memory leaks and implement proper cleanup.'
        });
      });
    }

    return recs;
  }, [data, profilingData]);

  return (
    <div className="space-y-4">
      {recommendations.length === 0 ? (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            All performance metrics look good! No recommendations at this time.
          </AlertDescription>
        </Alert>
      ) : (
        recommendations.map((rec, index) => (
          <Alert key={index} variant={rec.severity === 'high' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">{rec.title}</div>
              <div className="text-sm mt-1">{rec.description}</div>
              <div className="text-sm mt-2 font-medium">Recommendation: {rec.action}</div>
            </AlertDescription>
          </Alert>
        ))
      )}
    </div>
  );
};

// Main Component
const PluginPerformanceProfiler: React.FC<{pluginId?: string}> = ({ pluginId = 'system' }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [profilingData, setProfilingData] = useState<ProfilingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/plugin-profiling?plugin=${pluginId}&action=metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [pluginId]);

  const startProfiling = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plugin-profiling?plugin=${pluginId}&action=start-profiling`);
      const result = await response.json();
      
      if (result.success) {
        setIsRunning(true);
        setError(null);
      } else {
        setError(result.error || 'Failed to start profiling');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start profiling');
    } finally {
      setLoading(false);
    }
  };

  const stopProfiling = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plugin-profiling?plugin=${pluginId}&action=stop-profiling`);
      const result = await response.json();
      
      if (result.success) {
        setIsRunning(false);
        setProfilingData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to stop profiling');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop profiling');
    } finally {
      setLoading(false);
    }
  };

  const runBenchmark = async (testType: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/plugin-profiling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'benchmark',
          pluginId,
          data: { testType }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Show benchmark results in a toast or modal
        console.log('Benchmark result:', result.data);
      } else {
        setError(result.error || 'Benchmark failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchMetrics, autoRefresh]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Plugin Performance Profiler</h2>
          <p className="text-muted-foreground">
            Real-time performance monitoring for {pluginId}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          {!isRunning ? (
            <Button onClick={startProfiling} disabled={loading}>
              <Play className="h-4 w-4 mr-2" />
              Start Profiling
            </Button>
          ) : (
            <Button onClick={stopProfiling} disabled={loading} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Stop Profiling
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Memory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.system.memory.heapUsed)}
            </div>
            <Progress 
              value={(data.system.memory.heapUsed / data.system.memory.heapTotal) * 100} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {((data.system.memory.heapUsed / data.system.memory.heapTotal) * 100).toFixed(1)}% of {formatBytes(data.system.memory.heapTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Load</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.system.loadAverage[0].toFixed(2)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              Load Average (1m, 5m, 15m): {data.system.loadAverage.map(l => l.toFixed(2)).join(', ')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Latency</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.network.averageLatency)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Globe className="h-3 w-3 mr-1" />
              {data.network.requestsPerSecond.toFixed(1)} req/s
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Performance</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.database.averageDuration)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Server className="h-3 w-3 mr-1" />
              {data.database.queriesPerSecond.toFixed(1)} queries/s
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="flame-graph">CPU Profile</TabsTrigger>
          <TabsTrigger value="memory">Memory Analysis</TabsTrigger>
          <TabsTrigger value="network">Network Analysis</TabsTrigger>
          <TabsTrigger value="database">Database Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
                <CardDescription>Current system performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="text-sm">{formatDuration(data.system.uptime * 1000)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Platform</span>
                  <span className="text-sm">{data.system.platform} ({data.system.arch})</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Free Memory</span>
                  <span className="text-sm">{formatBytes(data.system.freeMemory)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Memory</span>
                  <span className="text-sm">{formatBytes(data.system.totalMemory)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Run performance benchmarks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => runBenchmark('cpu')}
                  disabled={loading}
                  className="w-full"
                >
                  <Cpu className="h-4 w-4 mr-2" />
                  CPU Benchmark
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => runBenchmark('memory')}
                  disabled={loading}
                  className="w-full"
                >
                  <Memory className="h-4 w-4 mr-2" />
                  Memory Benchmark
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => runBenchmark('io')}
                  disabled={loading}
                  className="w-full"
                >
                  <HardDrive className="h-4 w-4 mr-2" />
                  I/O Benchmark
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="flame-graph" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CPU Flame Graph</CardTitle>
              <CardDescription>
                Visual representation of CPU usage by function calls
                {!profilingData?.cpu && " - Start profiling to collect data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profilingData?.cpu ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Samples:</span> {profilingData.cpu.samples}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {formatDuration(profilingData.cpu.duration)}
                    </div>
                    <div>
                      <span className="font-medium">Rate:</span> {(profilingData.cpu.samples / (profilingData.cpu.duration / 1000)).toFixed(0)} samples/sec
                    </div>
                  </div>
                  <FlameGraph data={profilingData.cpu.flameGraph} />
                  
                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">Top Functions</h4>
                    <div className="space-y-2">
                      {profilingData.cpu.topFunctions.slice(0, 10).map((func, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="font-mono truncate flex-1">{func.name}</span>
                          <span className="ml-2">{func.count} samples ({func.percentage.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No CPU profiling data available</p>
                  <p className="text-sm">Start profiling to collect CPU performance data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Memory Analysis</CardTitle>
              <CardDescription>Memory usage patterns and leak detection</CardDescription>
            </CardHeader>
            <CardContent>
              {profilingData?.memory ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatBytes(profilingData.memory.current.heapUsed)}</div>
                      <div className="text-sm text-muted-foreground">Current Heap</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatBytes(profilingData.memory.peak.heapUsed)}</div>
                      <div className="text-sm text-muted-foreground">Peak Heap</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatBytes(profilingData.memory.current.rss)}</div>
                      <div className="text-sm text-muted-foreground">RSS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{profilingData.memory.snapshots.length}</div>
                      <div className="text-sm text-muted-foreground">Snapshots</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4">Memory Timeline</h4>
                    <MemoryTimeline snapshots={profilingData.memory.snapshots} />
                  </div>

                  {profilingData.memory.leaks.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Memory Leak Detection</h4>
                      <div className="space-y-2">
                        {profilingData.memory.leaks.map((leak, index) => (
                          <Alert key={index} variant={leak.severity === 'high' ? 'destructive' : 'default'}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <Badge variant={leak.severity === 'high' ? 'destructive' : 'secondary'} className="mr-2">
                                {leak.severity.toUpperCase()}
                              </Badge>
                              {leak.description}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No memory profiling data available</p>
                  <p className="text-sm">Start profiling to collect memory usage data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Network Performance</CardTitle>
                <CardDescription>HTTP request analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{data.network.totalRequests}</div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data.network.errorRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                  </div>
                </div>
                
                {data.network.latencyPercentiles && (
                  <div>
                    <h4 className="font-semibold mb-2">Latency Percentiles</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(data.network.latencyPercentiles).map(([percentile, value]) => (
                        <div key={percentile} className="flex justify-between">
                          <span>{percentile}:</span>
                          <span>{formatDuration(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Endpoints</CardTitle>
                <CardDescription>Most frequently accessed endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.network.topEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="font-mono truncate flex-1" title={endpoint.url}>
                        {endpoint.url}
                      </span>
                      <div className="ml-2 text-right">
                        <div>{endpoint.count} requests</div>
                        <div className="text-muted-foreground">{formatDuration(endpoint.averageLatency)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Performance</CardTitle>
                <CardDescription>Query analysis and statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{data.database.totalQueries}</div>
                    <div className="text-sm text-muted-foreground">Total Queries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{data.database.errorRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Database Breakdown</h4>
                  <div className="space-y-2">
                    {data.database.databaseBreakdown.map((db, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{db.database}</span>
                        <div className="text-right">
                          <div>{db.count} queries</div>
                          <div className="text-muted-foreground">{formatDuration(db.averageDuration)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slow Queries</CardTitle>
                <CardDescription>Queries that may need optimization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.database.slowQueries.length > 0 ? (
                    data.database.slowQueries.map((query, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary">{formatDuration(query.duration)}</Badge>
                          <span className="text-muted-foreground">{query.database}</span>
                        </div>
                        <code className="text-xs break-all">{query.query}</code>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No slow queries detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Recommendations</CardTitle>
              <CardDescription>AI-powered optimization suggestions</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceRecommendations data={data} profilingData={profilingData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PluginPerformanceProfiler;