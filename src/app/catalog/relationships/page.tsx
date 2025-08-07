'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';
import {
  Network,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  Activity,
  Play,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { 
  DependencyGraph, 
  GraphFilter, 
  GraphLayout, 
  GraphAnalytics,
  GraphMetrics,
  GraphNode,
} from '@/lib/catalog-graph/types';

// Dynamically import the dependency graph component
const DependencyGraph = dynamic(
  () => import('@/components/catalog/DependencyGraph').then(mod => mod.DependencyGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading graph visualization...</p>
        </div>
      </div>
    ),
  }
);

interface HealthSummary {
  overallScore: number;
  totalNodes: number;
  healthCounts: Record<string, number>;
  criticalAlerts: number;
  trendingDown: string[];
  topIssues: Array<{ nodeId: string; issue: string; severity: string }>;
}

interface SmartFilter {
  name: string;
  description: string;
  filter: Partial<GraphFilter>;
  count: number;
}

const ServiceRelationshipsPage = () => {
  const router = useRouter();

  // State management
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [filteredGraph, setFilteredGraph] = useState<DependencyGraph | null>(null);
  const [analytics, setAnalytics] = useState<GraphAnalytics | null>(null);
  const [metrics, setMetrics] = useState<GraphMetrics | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedView, setSelectedView] = useState<'graph' | 'analytics' | 'health'>('graph');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<any>(null);

  // Filter state
  const [filter, setFilter] = useState<GraphFilter>({
    nodeTypes: [],
    edgeTypes: [],
    owners: [],
    systems: [],
    lifecycles: [],
    healthRange: { min: 0, max: 100 },
    searchQuery: '',
    showOrphans: true,
  });

  // Smart filters
  const [smartFilters, setSmartFilters] = useState<SmartFilter[]>([]);
  const [activeSmartFilter, setActiveSmartFilter] = useState<string | null>(null);

  // Load initial graph data
  useEffect(() => {
    loadGraphData();
  }, []);

  // Apply filters when filter state changes
  useEffect(() => {
    if (graph) {
      applyFilters();
    }
  }, [graph, filter]);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load graph with metrics and health data
      const response = await fetch('/api/catalog-graph/graph?includeMetrics=true&includeHealth=true&applyLayout=true');
      if (!response.ok) {
        throw new Error('Failed to load graph data');
      }

      const data = await response.json();
      setGraph(data.graph);
      setAnalytics(data.analytics);
      setMetrics(data.metrics);
      setHealthSummary(data.health?.summary);

      // Generate smart filters
      generateSmartFilters(data.graph);
    } catch (err) {
      console.error('Error loading graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    if (!graph) return;
    setFilteredGraph(graph); // Simplified for demo
  };

  const generateSmartFilters = (graphData: DependencyGraph) => {
    const filters: SmartFilter[] = [];

    // Critical services
    const criticalNodes = graphData.nodes.filter(node => node.isOnCriticalPath);
    if (criticalNodes.length > 0) {
      filters.push({
        name: 'Critical Services',
        description: 'Services on critical paths',
        filter: { searchQuery: 'critical' },
        count: criticalNodes.length,
      });
    }

    // Unhealthy services
    const unhealthyNodes = graphData.nodes.filter(node => node.health < 70);
    if (unhealthyNodes.length > 0) {
      filters.push({
        name: 'Unhealthy Services',
        description: 'Services with health issues',
        filter: { healthRange: { min: 0, max: 69 } },
        count: unhealthyNodes.length,
      });
    }

    setSmartFilters(filters);
  };

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    setSelectedNode(node);
    
    // Perform impact analysis
    if (graph) {
      try {
        const response = await fetch('/api/catalog-graph/analysis?type=impact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graph: graph,
            nodeId: node.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setImpactAnalysis(data.analysis);
        }
      } catch (error) {
        console.error('Error performing impact analysis:', error);
      }
    }
  }, [graph]);

  const handleExport = async (format: string) => {
    if (!filteredGraph && !graph) return;

    try {
      const response = await fetch('/api/catalog-graph/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: filteredGraph || graph,
          options: {
            format,
            includeMetadata: true,
            resolution: { width: 1920, height: 1080 },
            quality: 'high',
          },
          analytics,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `catalog-graph-${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting graph:', error);
    }
  };

  const toggleMonitoring = async () => {
    try {
      const action = isMonitoring ? 'stop-monitoring' : 'start-monitoring';
      const response = await fetch(`/api/catalog-graph/health?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph }),
      });

      if (response.ok) {
        setIsMonitoring(!isMonitoring);
        if (!isMonitoring && graph) {
          // Reload health data
          const healthResponse = await fetch('/api/catalog-graph/health?action=summary');
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            setHealthSummary(healthData.data);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error);
    }
  };

  const applySmartFilter = (smartFilter: SmartFilter) => {
    setFilter(prevFilter => ({
      ...prevFilter,
      ...smartFilter.filter,
    }));
    setActiveSmartFilter(smartFilter.name);
  };

  const clearFilters = () => {
    setFilter({
      nodeTypes: [],
      edgeTypes: [],
      owners: [],
      systems: [],
      lifecycles: [],
      healthRange: { min: 0, max: 100 },
      searchQuery: '',
      showOrphans: true,
    });
    setActiveSmartFilter(null);
  };

  // Get available filter options
  const filterOptions = useMemo(() => {
    if (!graph) return { nodeTypes: [], owners: [], systems: [], lifecycles: [] };

    return {
      nodeTypes: [...new Set(graph.nodes.map(n => n.type))],
      owners: [...new Set(graph.nodes.map(n => n.owner))].filter(Boolean),
      systems: [...new Set(graph.nodes.map(n => n.entity.spec?.system))].filter(Boolean),
      lifecycles: [...new Set(graph.nodes.map(n => n.lifecycle))],
    };
  }, [graph]);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const currentGraph = filteredGraph || graph;
    if (!currentGraph) return null;

    return {
      totalNodes: currentGraph.nodes.length,
      totalEdges: currentGraph.edges.length,
      density: currentGraph.edges.length / (currentGraph.nodes.length * (currentGraph.nodes.length - 1) || 1),
      criticalNodes: currentGraph.nodes.filter(n => n.isOnCriticalPath).length,
      healthyNodes: currentGraph.nodes.filter(n => n.health >= 90).length,
      unhealthyNodes: currentGraph.nodes.filter(n => n.health < 70).length,
    };
  }, [filteredGraph, graph]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Service Dependencies</h2>
          <p className="text-muted-foreground">Building graph from catalog data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load catalog relationships: {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadGraphData}
              className="ml-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/catalog')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Catalog
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Network className="h-6 w-6" />
                  Service Dependencies
                </h1>
                <p className="text-muted-foreground mt-1">
                  Visualize and analyze relationships between your services
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Monitoring toggle */}
              <div className="flex items-center gap-2">
                <Switch 
                  checked={isMonitoring}
                  onCheckedChange={toggleMonitoring}
                />
                <Label className="text-sm">
                  {isMonitoring ? 'Monitoring' : 'Monitor Health'}
                </Label>
              </div>

              {/* Refresh */}
              <Button variant="outline" size="sm" onClick={loadGraphData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              {/* Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('svg')}>
                    Export as SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Quick stats */}
            {derivedMetrics && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Graph Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Services</span>
                    <span className="font-medium">{derivedMetrics.totalNodes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dependencies</span>
                    <span className="font-medium">{derivedMetrics.totalEdges}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Density</span>
                    <span className="font-medium">{(derivedMetrics.density * 100).toFixed(1)}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Critical</span>
                    <Badge variant="destructive" className="text-xs">
                      {derivedMetrics.criticalNodes}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Healthy</span>
                    <Badge variant="default" className="text-xs">
                      {derivedMetrics.healthyNodes}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Issues</span>
                    <Badge variant="secondary" className="text-xs">
                      {derivedMetrics.unhealthyNodes}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health summary */}
            {healthSummary && isMonitoring && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Health Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overall Score</span>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {healthSummary.overallScore.toFixed(0)}%
                      </div>
                      <Progress 
                        value={healthSummary.overallScore} 
                        className="w-16 h-2 mt-1"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>{healthSummary.healthCounts.healthy || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      <span>{healthSummary.healthCounts.degraded || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span>{healthSummary.healthCounts.unhealthy || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>{healthSummary.healthCounts.unknown || 0}</span>
                    </div>
                  </div>
                  {healthSummary.criticalAlerts > 0 && (
                    <>
                      <Separator />
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {healthSummary.criticalAlerts} critical alerts require attention
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Smart filters */}
            {smartFilters.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Smart Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {smartFilters.map((smartFilter) => (
                    <Button
                      key={smartFilter.name}
                      variant={activeSmartFilter === smartFilter.name ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start text-xs h-8"
                      onClick={() => applySmartFilter(smartFilter)}
                    >
                      <span className="flex-1 text-left">{smartFilter.name}</span>
                      <Badge variant="secondary" className="text-xs ml-2">
                        {smartFilter.count}
                      </Badge>
                    </Button>
                  ))}
                  {activeSmartFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Filters</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              {showFilters && (
                <CardContent className="space-y-4">
                  {/* Search */}
                  <div className="space-y-2">
                    <Label className="text-xs">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search services..."
                        value={filter.searchQuery}
                        onChange={(e) => setFilter(prev => ({
                          ...prev,
                          searchQuery: e.target.value
                        }))}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>

                  {/* Node types */}
                  <div className="space-y-2">
                    <Label className="text-xs">Types</Label>
                    <Select
                      value={filter.nodeTypes.join(',')}
                      onValueChange={(value) => setFilter(prev => ({
                        ...prev,
                        nodeTypes: value ? value.split(',') : []
                      }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        {filterOptions.nodeTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Health range */}
                  <div className="space-y-2">
                    <Label className="text-xs">Health Score</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        min="0"
                        max="100"
                        value={filter.healthRange.min}
                        onChange={(e) => setFilter(prev => ({
                          ...prev,
                          healthRange: { ...prev.healthRange, min: parseInt(e.target.value) || 0 }
                        }))}
                        className="h-9"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        min="0"
                        max="100"
                        value={filter.healthRange.max}
                        onChange={(e) => setFilter(prev => ({
                          ...prev,
                          healthRange: { ...prev.healthRange, max: parseInt(e.target.value) || 100 }
                        }))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Show orphans */}
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Isolated Services</Label>
                    <Switch
                      checked={filter.showOrphans}
                      onCheckedChange={(checked) => setFilter(prev => ({
                        ...prev,
                        showOrphans: checked
                      }))}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Selected node info */}
            {selectedNode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Selected Service
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium text-sm">{selectedNode.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedNode.entity.metadata.description || 'No description'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <div>{selectedNode.type}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Owner:</span>
                      <div>{selectedNode.owner}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Health:</span>
                      <div className="flex items-center gap-1">
                        {selectedNode.health >= 90 ? 
                          <CheckCircle className="h-3 w-3 text-green-500" /> :
                          selectedNode.health >= 70 ?
                            <AlertTriangle className="h-3 w-3 text-yellow-500" /> :
                            <AlertCircle className="h-3 w-3 text-red-500" />
                        }
                        {selectedNode.health.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impact:</span>
                      <div>{selectedNode.impactScore.toFixed(1)}</div>
                    </div>
                  </div>
                  {selectedNode.isOnCriticalPath && (
                    <Alert>
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        On critical path
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="text-xs">
                    <div className="text-muted-foreground mb-1">Dependencies:</div>
                    <div>{selectedNode.dependencies.length} services</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground mb-1">Dependents:</div>
                    <div>{selectedNode.dependents.length} services</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="graph">Graph View</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="health">Health Monitor</TabsTrigger>
              </TabsList>

              <TabsContent value="graph" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="h-[700px]">
                      {graph && (
                        <DependencyGraph
                          entities={graph.nodes.map(n => n.entity)}
                          onEntityClick={handleNodeClick}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                {analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Most Connected Services</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.mostConnected.slice(0, 5).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.id}</span>
                              <span className="font-medium">{item.connections}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Most Critical Services</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.mostCritical.slice(0, 5).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.id}</span>
                              <span className="font-medium">{item.score.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {analytics.circularDependencies.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Circular Dependencies
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analytics.circularDependencies.slice(0, 3).map((cycle, index) => (
                              <div key={index} className="text-sm">
                                {cycle.join(' → ')}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">System Clusters</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.clusters.slice(0, 5).map((cluster) => (
                            <div key={cluster.id} className="flex justify-between text-sm">
                              <span>{cluster.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {cluster.nodes.length}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                {!isMonitoring ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Health Monitoring Disabled</h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Enable health monitoring to track service health metrics and receive alerts
                      </p>
                      <Button onClick={toggleMonitoring}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Monitoring
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {healthSummary && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Overall Health</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold mb-2">
                              {healthSummary.overallScore.toFixed(0)}%
                            </div>
                            <Progress value={healthSummary.overallScore} />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Active Alerts</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold mb-2">
                              {healthSummary.criticalAlerts}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Critical issues requiring attention
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Trending Down</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold mb-2">
                              {healthSummary.trendingDown.length}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Services with declining health
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {healthSummary && healthSummary.topIssues.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Top Issues</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {healthSummary.topIssues.map((issue, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div>
                                  <div className="font-medium">{issue.nodeId}</div>
                                  <div className="text-muted-foreground text-xs">{issue.issue}</div>
                                </div>
                                <Badge 
                                  variant={
                                    issue.severity === 'critical' ? 'destructive' : 
                                    issue.severity === 'error' ? 'destructive' :
                                    issue.severity === 'warning' ? 'secondary' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {issue.severity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceRelationshipsPage;