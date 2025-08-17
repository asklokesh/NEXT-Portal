'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GitBranch,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Package,
  Link,
  Zap,
  Shield,
  RefreshCw,
  Download,
  Upload,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  GitMerge,
  GitPullRequest,
  Layers,
  Network,
  Search,
  Filter,
  Eye,
  EyeOff,
  Settings,
  FileText,
  ChevronRight,
  ChevronDown,
  Hash,
  BarChart3,
  TrendingUp,
  Activity
} from 'lucide-react';
// Force graph will be implemented later
// import ForceGraph2D from 'react-force-graph-2d';

interface Dependency {
  id: string;
  name: string;
  version: string;
  versionRange?: string;
  type: 'hard' | 'soft' | 'peer' | 'dev' | 'optional';
  isInstalled: boolean;
  isCompatible: boolean;
  requiredBy: string[];
  conflicts?: string[];
  alternatives?: string[];
  metadata?: {
    description?: string;
    license?: string;
    repository?: string;
    homepage?: string;
  };
}

interface DependencyConflict {
  id: string;
  type: 'version' | 'missing' | 'circular' | 'incompatible';
  severity: 'critical' | 'high' | 'medium' | 'low';
  plugins: string[];
  description: string;
  resolution?: {
    type: 'upgrade' | 'downgrade' | 'install' | 'remove' | 'replace';
    action: string;
    targetVersion?: string;
    alternative?: string;
  };
}

interface DependencyNode {
  id: string;
  name: string;
  group: number;
  version?: string;
  type?: string;
  status?: string;
}

interface DependencyLink {
  source: string;
  target: string;
  type: string;
  strength?: number;
}

interface Props {
  pluginId?: string;
  showGraph?: boolean;
  onResolutionComplete?: () => void;
}

export function PluginDependencyResolver({ pluginId, showGraph = true, onResolutionComplete }: Props) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [conflicts, setConflicts] = useState<DependencyConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedDependency, setSelectedDependency] = useState<Dependency | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<DependencyConflict | null>(null);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionStrategy, setResolutionStrategy] = useState<'automatic' | 'manual'>('automatic');
  const [graphData, setGraphData] = useState<{ nodes: DependencyNode[]; links: DependencyLink[] }>({ nodes: [], links: [] });
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'tree'>('list');
  const [filterType, setFilterType] = useState<'all' | 'conflicts' | 'missing' | 'outdated'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (pluginId) {
      analyzeDependencies();
    } else {
      analyzeAllDependencies();
    }
  }, [pluginId]);

  const analyzeDependencies = async () => {
    setLoading(true);
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/plugins/dependencies?pluginId=${pluginId}`);
      if (response.ok) {
        const data = await response.json();
        setDependencies(data.dependencies || []);
        setConflicts(data.conflicts || []);
        
        // Build graph data
        if (showGraph && data.dependencies) {
          buildGraphData(data.dependencies);
        }
      }
    } catch (error) {
      console.error('Failed to analyze dependencies:', error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const analyzeAllDependencies = async () => {
    setLoading(true);
    setAnalyzing(true);
    try {
      const response = await fetch('/api/plugins/dependencies');
      if (response.ok) {
        const data = await response.json();
        setDependencies(data.dependencies || []);
        setConflicts(data.conflicts || []);
        
        if (showGraph && data.dependencies) {
          buildGraphData(data.dependencies);
        }
      }
    } catch (error) {
      console.error('Failed to analyze all dependencies:', error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const buildGraphData = (deps: Dependency[]) => {
    const nodes: DependencyNode[] = [];
    const links: DependencyLink[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Create nodes
    deps.forEach(dep => {
      const node: DependencyNode = {
        id: dep.id,
        name: dep.name,
        group: getNodeGroup(dep.type),
        version: dep.version,
        type: dep.type,
        status: dep.isCompatible ? 'compatible' : 'conflict'
      };
      nodes.push(node);
      nodeMap.set(dep.id, node);
    });

    // Create links
    deps.forEach(dep => {
      dep.requiredBy?.forEach(parentId => {
        if (nodeMap.has(parentId)) {
          links.push({
            source: parentId,
            target: dep.id,
            type: dep.type,
            strength: dep.type === 'hard' ? 1 : 0.5
          });
        }
      });
    });

    setGraphData({ nodes, links });
  };

  const getNodeGroup = (type: string): number => {
    switch (type) {
      case 'hard': return 1;
      case 'soft': return 2;
      case 'peer': return 3;
      case 'dev': return 4;
      case 'optional': return 5;
      default: return 6;
    }
  };

  const resolveDependencies = async (strategy: 'automatic' | 'manual' = 'automatic') => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/plugins/dependencies/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          strategy,
          conflicts: conflicts.map(c => ({
            id: c.id,
            resolution: c.resolution
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConflicts(data.remainingConflicts || []);
        if (onResolutionComplete) {
          onResolutionComplete();
        }
        await analyzeDependencies();
      }
    } catch (error) {
      console.error('Failed to resolve dependencies:', error);
    } finally {
      setAnalyzing(false);
      setShowResolutionDialog(false);
    }
  };

  const applyResolution = async (conflict: DependencyConflict) => {
    if (!conflict.resolution) return;

    try {
      const response = await fetch('/api/plugins/dependencies/apply-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: conflict.id,
          resolution: conflict.resolution
        })
      });

      if (response.ok) {
        await analyzeDependencies();
      }
    } catch (error) {
      console.error('Failed to apply resolution:', error);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const filteredDependencies = useMemo(() => {
    switch (filterType) {
      case 'conflicts':
        return dependencies.filter(d => !d.isCompatible || d.conflicts?.length > 0);
      case 'missing':
        return dependencies.filter(d => !d.isInstalled);
      case 'outdated':
        return dependencies.filter(d => d.isInstalled && !d.isCompatible);
      default:
        return dependencies;
    }
  }, [dependencies, filterType]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hard': return 'bg-red-100 text-red-800';
      case 'soft': return 'bg-blue-100 text-blue-800';
      case 'peer': return 'bg-purple-100 text-purple-800';
      case 'dev': return 'bg-gray-100 text-gray-800';
      case 'optional': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderDependencyTree = (deps: Dependency[], parentId?: string, level = 0) => {
    const childDeps = parentId 
      ? deps.filter(d => d.requiredBy.includes(parentId))
      : deps.filter(d => d.requiredBy.length === 0);

    return childDeps.map(dep => {
      const hasChildren = deps.some(d => d.requiredBy.includes(dep.id));
      const isExpanded = expandedNodes.has(dep.id);

      return (
        <div key={dep.id} style={{ marginLeft: `${level * 24}px` }}>
          <div className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2">
            {hasChildren && (
              <button
                onClick={() => toggleNode(dep.id)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{dep.name}</span>
            <Badge variant="outline" className="text-xs">
              {dep.version}
            </Badge>
            <Badge className={getTypeColor(dep.type)} variant="secondary">
              {dep.type}
            </Badge>
            {!dep.isCompatible && (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            {!dep.isInstalled && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>
              {renderDependencyTree(deps, dep.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dependency Resolver</h2>
          <p className="text-muted-foreground mt-1">
            Analyze and resolve plugin dependency conflicts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => analyzeDependencies()}
            disabled={analyzing}
            variant="outline"
          >
            {analyzing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Analyze
          </Button>
          {conflicts.length > 0 && (
            <Button
              onClick={() => setShowResolutionDialog(true)}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Resolve Conflicts ({conflicts.length})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Dependencies</p>
                <p className="text-2xl font-bold">{dependencies.length}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conflicts</p>
                <p className="text-2xl font-bold text-red-600">{conflicts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {dependencies.filter(d => !d.isInstalled).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compatible</p>
                <p className="text-2xl font-bold text-green-600">
                  {dependencies.filter(d => d.isCompatible && d.isInstalled).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900">Dependency Conflicts Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found that may affect plugin functionality.
            Click "Resolve Conflicts" to fix them automatically or review them individually below.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Dependency Analysis</CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="conflicts">Conflicts Only</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="outdated">Outdated</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="rounded-r-none"
                >
                  List
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('tree')}
                  className="rounded-none border-x"
                >
                  Tree
                </Button>
                {showGraph && (
                  <Button
                    size="sm"
                    variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                    onClick={() => setViewMode('graph')}
                    className="rounded-l-none"
                  >
                    Graph
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsContent value="list" className="mt-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredDependencies.map(dep => (
                    <div
                      key={dep.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDependency(dep)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{dep.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {dep.version}
                              </Badge>
                              <Badge className={getTypeColor(dep.type)} variant="secondary">
                                {dep.type}
                              </Badge>
                            </div>
                            {dep.versionRange && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Required: {dep.versionRange}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dep.isCompatible ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          )}
                          {!dep.isInstalled && (
                            <Badge variant="destructive">Not Installed</Badge>
                          )}
                        </div>
                      </div>
                      {dep.conflicts && dep.conflicts.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          Conflicts with: {dep.conflicts.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tree" className="mt-0">
              <ScrollArea className="h-[500px]">
                <div className="p-2">
                  {renderDependencyTree(filteredDependencies)}
                </div>
              </ScrollArea>
            </TabsContent>

            {showGraph && (
              <TabsContent value="graph" className="mt-0">
                <div className="h-[500px] border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">Interactive Dependency Graph</p>
                      <p className="text-sm text-gray-400 mt-2">Visual dependency graph coming soon</p>
                      <p className="text-xs text-gray-400 mt-1">Use Tree or List view for now</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Conflicts List */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Dependency Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conflicts.map(conflict => (
                <div
                  key={conflict.id}
                  className={`p-4 border rounded-lg ${getSeverityColor(conflict.severity)}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive" className="text-xs">
                          {conflict.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {conflict.type}
                        </Badge>
                      </div>
                      <p className="font-medium">{conflict.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Affects: {conflict.plugins.join(', ')}
                      </p>
                    </div>
                    {conflict.resolution && (
                      <Button
                        size="sm"
                        onClick={() => applyResolution(conflict)}
                        className="ml-4"
                      >
                        Apply Fix
                      </Button>
                    )}
                  </div>
                  {conflict.resolution && (
                    <div className="mt-3 p-2 bg-background rounded text-sm">
                      <p className="font-medium">Suggested Resolution:</p>
                      <p className="text-muted-foreground">{conflict.resolution.action}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolution Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Dependencies</DialogTitle>
            <DialogDescription>
              Choose how to resolve the detected dependency conflicts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="strategy"
                  value="automatic"
                  checked={resolutionStrategy === 'automatic'}
                  onChange={(e) => setResolutionStrategy(e.target.value as any)}
                />
                <div>
                  <p className="font-medium">Automatic Resolution</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically apply recommended fixes for all conflicts
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="strategy"
                  value="manual"
                  checked={resolutionStrategy === 'manual'}
                  onChange={(e) => setResolutionStrategy(e.target.value as any)}
                />
                <div>
                  <p className="font-medium">Manual Resolution</p>
                  <p className="text-sm text-muted-foreground">
                    Review and apply fixes individually for each conflict
                  </p>
                </div>
              </label>
            </div>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                A backup will be created before applying any resolutions. 
                You can rollback changes if needed.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => resolveDependencies(resolutionStrategy)}>
              Resolve Conflicts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PluginDependencyResolver;