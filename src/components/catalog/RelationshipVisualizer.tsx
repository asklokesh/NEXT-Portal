'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Filter, 
  Download, 
  Settings, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  RotateCcw,
  Share2,
  FileText,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Network,
  Database,
  Code,
  Cpu,
  Cloud,
  GitBranch
} from 'lucide-react';

/**
 * Types for the relationship visualizer
 */
interface Entity {
  id: string;
  name: string;
  kind: string;
  namespace: string;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    labels?: Record<string, string>;
  };
  spec?: {
    type?: string;
    lifecycle?: string;
    owner?: string;
  };
}

interface Relationship {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  confidence: number;
  discoveryMethod: DiscoveryMethod;
  metadata: {
    evidence: Evidence[];
    strength: number;
    lastSeen?: Date;
    frequency?: number;
  };
  createdAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
  status: 'discovered' | 'confirmed' | 'rejected';
}

enum RelationshipType {
  DEPENDS_ON = 'dependsOn',
  PROVIDES_API = 'providesApi',
  CONSUMES_API = 'consumesApi',
  PART_OF = 'partOf',
  OWNS = 'owns',
  DEPLOYED_TO = 'deployedTo',
  STORES_DATA_IN = 'storesDataIn',
  TRIGGERS = 'triggers',
  SUBSCRIBES_TO = 'subscribesTo',
  IMPLEMENTS = 'implements'
}

enum DiscoveryMethod {
  CODE_ANALYSIS = 'code_analysis',
  API_TRACES = 'api_traces',
  DATABASE_SCHEMA = 'database_schema',
  SERVICE_MESH = 'service_mesh',
  CONFIGURATION = 'configuration',
  ML_PREDICTION = 'ml_prediction',
  NETWORK_ANALYSIS = 'network_analysis',
  DEPLOYMENT_MANIFEST = 'deployment_manifest'
}

interface Evidence {
  type: string;
  description: string;
  location?: string;
  confidence: number;
  data?: any;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  entity: Entity;
  type: string;
  size: number;
  color: string;
  highlighted: boolean;
  visible: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  relationship: Relationship;
  width: number;
  color: string;
  highlighted: boolean;
  visible: boolean;
}

interface FilterState {
  entityTypes: string[];
  relationshipTypes: RelationshipType[];
  discoveryMethods: DiscoveryMethod[];
  confidenceRange: [number, number];
  searchQuery: string;
  showConfirmedOnly: boolean;
  showUnconfirmedOnly: boolean;
  hideRejected: boolean;
}

interface VisualizationSettings {
  nodeSize: number;
  linkStrength: number;
  chargeStrength: number;
  centerForce: number;
  showLabels: boolean;
  showMetrics: boolean;
  layoutAlgorithm: 'force' | 'circular' | 'hierarchical' | 'grid';
  colorScheme: 'default' | 'confidence' | 'method' | 'type';
}

/**
 * Props for the RelationshipVisualizer component
 */
interface RelationshipVisualizerProps {
  entities: Entity[];
  relationships: Relationship[];
  onRelationshipConfirm?: (relationshipId: string) => void;
  onRelationshipReject?: (relationshipId: string) => void;
  onRelationshipEdit?: (relationship: Relationship) => void;
  onEntitySelect?: (entity: Entity) => void;
  onExportData?: (format: 'json' | 'csv' | 'graphml') => void;
  className?: string;
}

/**
 * Interactive relationship graph visualizer component
 */
export const RelationshipVisualizer: React.FC<RelationshipVisualizerProps> = ({
  entities,
  relationships,
  onRelationshipConfirm,
  onRelationshipReject,
  onRelationshipEdit,
  onEntitySelect,
  onExportData,
  className = ''
}) => {
  // State management
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    entityTypes: [],
    relationshipTypes: [],
    discoveryMethods: [],
    confidenceRange: [0, 1],
    searchQuery: '',
    showConfirmedOnly: false,
    showUnconfirmedOnly: false,
    hideRejected: true
  });
  const [settings, setSettings] = useState<VisualizationSettings>({
    nodeSize: 1,
    linkStrength: 0.5,
    chargeStrength: -300,
    centerForce: 0.1,
    showLabels: true,
    showMetrics: true,
    layoutAlgorithm: 'force',
    colorScheme: 'default'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // D3 refs
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Memoized data processing
  const filteredData = useMemo(() => {
    const filteredEntities = entities.filter(entity => {
      if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(entity.kind)) {
        return false;
      }
      
      if (filters.searchQuery && !entity.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });

    const filteredRelationships = relationships.filter(rel => {
      if (filters.relationshipTypes.length > 0 && !filters.relationshipTypes.includes(rel.type)) {
        return false;
      }
      
      if (filters.discoveryMethods.length > 0 && !filters.discoveryMethods.includes(rel.discoveryMethod)) {
        return false;
      }
      
      if (rel.confidence < filters.confidenceRange[0] || rel.confidence > filters.confidenceRange[1]) {
        return false;
      }
      
      if (filters.showConfirmedOnly && rel.status !== 'confirmed') {
        return false;
      }
      
      if (filters.showUnconfirmedOnly && rel.status === 'confirmed') {
        return false;
      }
      
      if (filters.hideRejected && rel.status === 'rejected') {
        return false;
      }
      
      return true;
    });

    return { entities: filteredEntities, relationships: filteredRelationships };
  }, [entities, relationships, filters]);

  // Convert data to D3 graph format
  const graphData = useMemo(() => {
    const entityMap = new Map(filteredData.entities.map(e => [e.id, e]));
    
    const nodes: GraphNode[] = filteredData.entities.map(entity => ({
      id: entity.id,
      entity,
      type: entity.kind,
      size: getNodeSize(entity, settings.nodeSize),
      color: getNodeColor(entity, settings.colorScheme),
      highlighted: entity.id === selectedEntity?.id,
      visible: true
    }));

    const links: GraphLink[] = filteredData.relationships
      .filter(rel => entityMap.has(rel.sourceEntity) && entityMap.has(rel.targetEntity))
      .map(relationship => ({
        id: relationship.id,
        source: relationship.sourceEntity,
        target: relationship.targetEntity,
        relationship,
        width: getLinkWidth(relationship),
        color: getLinkColor(relationship, settings.colorScheme),
        highlighted: relationship.id === selectedRelationship?.id,
        visible: true
      }));

    return { nodes, links };
  }, [filteredData, selectedEntity, selectedRelationship, settings]);

  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous content
    svg.selectAll('*').remove();

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        svg.select('.graph-container').attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Create container for graph elements
    const container = svg.append('g').attr('class', 'graph-container');

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .strength(settings.linkStrength)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(settings.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(settings.centerForce))
      .force('collision', d3.forceCollide().radius(d => d.size + 5));

    simulationRef.current = simulation;

    // Create arrow markers for directed relationships
    const defs = svg.append('defs');
    defs.selectAll('marker')
      .data(['arrow'])
      .enter()
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Create links
    const link = container.selectAll('.link')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.width)
      .attr('marker-end', 'url(#arrow)')
      .style('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => setHoveredLink(d))
      .on('mouseout', () => setHoveredLink(null))
      .on('click', (event, d) => setSelectedRelationship(d.relationship));

    // Create nodes
    const node = container.selectAll('.node')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.highlighted ? '#fff' : 'none')
      .attr('stroke-width', d => d.highlighted ? 3 : 0);

    // Add labels to nodes
    if (settings.showLabels) {
      node.append('text')
        .attr('dx', d => d.size + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', '#333')
        .text(d => d.entity.name);
    }

    // Add node event handlers
    node
      .on('mouseover', (event, d) => setHoveredNode(d))
      .on('mouseout', () => setHoveredNode(null))
      .on('click', (event, d) => {
        setSelectedEntity(d.entity);
        onEntitySelect?.(d.entity);
      });

    // Update simulation on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, settings, onEntitySelect]);

  // Filter update handlers
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<VisualizationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Utility functions
  const getNodeSize = (entity: Entity, sizeMultiplier: number): number => {
    const baseSize = 10;
    const relationshipCount = relationships.filter(r => 
      r.sourceEntity === entity.id || r.targetEntity === entity.id
    ).length;
    return Math.max(baseSize, baseSize + relationshipCount * 2) * sizeMultiplier;
  };

  const getNodeColor = (entity: Entity, colorScheme: string): string => {
    switch (colorScheme) {
      case 'type':
        const typeColors: Record<string, string> = {
          'Component': '#3b82f6',
          'API': '#10b981',
          'Resource': '#f59e0b',
          'System': '#8b5cf6',
          'Domain': '#ef4444'
        };
        return typeColors[entity.kind] || '#6b7280';
      case 'confidence':
        // This would require aggregating confidence scores for the entity
        return '#3b82f6';
      default:
        return '#3b82f6';
    }
  };

  const getLinkWidth = (relationship: Relationship): number => {
    return Math.max(1, relationship.confidence * 5);
  };

  const getLinkColor = (relationship: Relationship, colorScheme: string): string => {
    switch (colorScheme) {
      case 'confidence':
        const confidence = relationship.confidence;
        if (confidence >= 0.8) return '#10b981'; // Green for high confidence
        if (confidence >= 0.6) return '#f59e0b'; // Yellow for medium confidence
        return '#ef4444'; // Red for low confidence
      case 'method':
        const methodColors: Record<string, string> = {
          [DiscoveryMethod.CODE_ANALYSIS]: '#3b82f6',
          [DiscoveryMethod.API_TRACES]: '#10b981',
          [DiscoveryMethod.DATABASE_SCHEMA]: '#f59e0b',
          [DiscoveryMethod.SERVICE_MESH]: '#8b5cf6',
          [DiscoveryMethod.CONFIGURATION]: '#ef4444',
          [DiscoveryMethod.ML_PREDICTION]: '#06b6d4',
          [DiscoveryMethod.NETWORK_ANALYSIS]: '#84cc16',
          [DiscoveryMethod.DEPLOYMENT_MANIFEST]: '#f97316'
        };
        return methodColors[relationship.discoveryMethod] || '#6b7280';
      default:
        return relationship.status === 'confirmed' ? '#10b981' : 
               relationship.status === 'rejected' ? '#ef4444' : '#6b7280';
    }
  };

  const getDiscoveryMethodIcon = (method: DiscoveryMethod) => {
    const iconMap = {
      [DiscoveryMethod.CODE_ANALYSIS]: Code,
      [DiscoveryMethod.API_TRACES]: Network,
      [DiscoveryMethod.DATABASE_SCHEMA]: Database,
      [DiscoveryMethod.SERVICE_MESH]: Cpu,
      [DiscoveryMethod.CONFIGURATION]: Settings,
      [DiscoveryMethod.ML_PREDICTION]: GitBranch,
      [DiscoveryMethod.NETWORK_ANALYSIS]: Network,
      [DiscoveryMethod.DEPLOYMENT_MANIFEST]: Cloud
    };
    return iconMap[method] || Info;
  };

  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 1.5
      );
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.scaleBy, 0.67
      );
    }
  };

  const handleResetZoom = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'graphml') => {
    onExportData?.(format);
  };

  return (
    <TooltipProvider>
      <div className={`relationship-visualizer ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Relationship Graph</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>{graphData.nodes.length} entities</span>
              <Separator orientation="vertical" className="h-4" />
              <span>{graphData.links.length} relationships</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search entities..."
                value={filters.searchQuery}
                onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                className="pl-10 w-64"
              />
            </div>

            {/* Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Relationships</SheetTitle>
                  <SheetDescription>
                    Customize which entities and relationships are shown
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Entity Types */}
                  <div>
                    <Label className="text-sm font-medium">Entity Types</Label>
                    <div className="mt-2 space-y-2">
                      {Array.from(new Set(entities.map(e => e.kind))).map(kind => (
                        <div key={kind} className="flex items-center space-x-2">
                          <Checkbox
                            id={`entity-${kind}`}
                            checked={filters.entityTypes.includes(kind)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateFilters({ entityTypes: [...filters.entityTypes, kind] });
                              } else {
                                updateFilters({ entityTypes: filters.entityTypes.filter(t => t !== kind) });
                              }
                            }}
                          />
                          <Label htmlFor={`entity-${kind}`} className="text-sm">{kind}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Relationship Types */}
                  <div>
                    <Label className="text-sm font-medium">Relationship Types</Label>
                    <div className="mt-2 space-y-2">
                      {Object.values(RelationshipType).map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`rel-${type}`}
                            checked={filters.relationshipTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateFilters({ relationshipTypes: [...filters.relationshipTypes, type] });
                              } else {
                                updateFilters({ relationshipTypes: filters.relationshipTypes.filter(t => t !== type) });
                              }
                            }}
                          />
                          <Label htmlFor={`rel-${type}`} className="text-sm">{type}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Confidence Range */}
                  <div>
                    <Label className="text-sm font-medium">
                      Confidence Range: {(filters.confidenceRange[0] * 100).toFixed(0)}% - {(filters.confidenceRange[1] * 100).toFixed(0)}%
                    </Label>
                    <Slider
                      value={filters.confidenceRange}
                      onValueChange={(value) => updateFilters({ confidenceRange: value as [number, number] })}
                      max={1}
                      min={0}
                      step={0.1}
                      className="mt-2"
                    />
                  </div>

                  {/* Status Filters */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="confirmed-only"
                        checked={filters.showConfirmedOnly}
                        onCheckedChange={(checked) => updateFilters({ showConfirmedOnly: !!checked })}
                      />
                      <Label htmlFor="confirmed-only" className="text-sm">Show confirmed only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="unconfirmed-only"
                        checked={filters.showUnconfirmedOnly}
                        onCheckedChange={(checked) => updateFilters({ showUnconfirmedOnly: !!checked })}
                      />
                      <Label htmlFor="unconfirmed-only" className="text-sm">Show unconfirmed only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hide-rejected"
                        checked={filters.hideRejected}
                        onCheckedChange={(checked) => updateFilters({ hideRejected: !!checked })}
                      />
                      <Label htmlFor="hide-rejected" className="text-sm">Hide rejected</Label>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Settings */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Visualization Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Layout Algorithm</Label>
                    <Select
                      value={settings.layoutAlgorithm}
                      onValueChange={(value: any) => updateSettings({ layoutAlgorithm: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="force">Force-directed</SelectItem>
                        <SelectItem value="circular">Circular</SelectItem>
                        <SelectItem value="hierarchical">Hierarchical</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Color Scheme</Label>
                    <Select
                      value={settings.colorScheme}
                      onValueChange={(value: any) => updateSettings({ colorScheme: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="confidence">By Confidence</SelectItem>
                        <SelectItem value="method">By Discovery Method</SelectItem>
                        <SelectItem value="type">By Entity Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-labels"
                        checked={settings.showLabels}
                        onCheckedChange={(checked) => updateSettings({ showLabels: !!checked })}
                      />
                      <Label htmlFor="show-labels">Show labels</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-metrics"
                        checked={settings.showMetrics}
                        onCheckedChange={(checked) => updateSettings({ showMetrics: !!checked })}
                      />
                      <Label htmlFor="show-metrics">Show metrics</Label>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Controls */}
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleResetZoom}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset zoom</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle fullscreen</TooltipContent>
              </Tooltip>
            </div>

            {/* Export */}
            <Select onValueChange={handleExport}>
              <SelectTrigger className="w-32">
                <Download className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">Export JSON</SelectItem>
                <SelectItem value="csv">Export CSV</SelectItem>
                <SelectItem value="graphml">Export GraphML</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Graph Container */}
          <div className="flex-1 relative">
            <svg
              ref={svgRef}
              className="w-full h-full bg-gray-50"
              style={{ cursor: 'grab' }}
            />

            {/* Hover Tooltip */}
            {hoveredNode && (
              <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 border max-w-xs">
                <h4 className="font-semibold">{hoveredNode.entity.name}</h4>
                <p className="text-sm text-gray-600">{hoveredNode.entity.kind}</p>
                {hoveredNode.entity.metadata.description && (
                  <p className="text-sm mt-1">{hoveredNode.entity.metadata.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {hoveredNode.entity.metadata.tags?.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {hoveredLink && (
              <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 border max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{hoveredLink.relationship.type}</h4>
                  <Badge
                    variant={hoveredLink.relationship.status === 'confirmed' ? 'default' : 
                            hoveredLink.relationship.status === 'rejected' ? 'destructive' : 'secondary'}
                  >
                    {hoveredLink.relationship.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div>Confidence: {(hoveredLink.relationship.confidence * 100).toFixed(0)}%</div>
                  <div className="flex items-center">
                    Method: 
                    {React.createElement(getDiscoveryMethodIcon(hoveredLink.relationship.discoveryMethod), {
                      className: "h-4 w-4 ml-1 mr-1"
                    })}
                    {hoveredLink.relationship.discoveryMethod.replace('_', ' ')}
                  </div>
                  <div>Evidence: {hoveredLink.relationship.metadata.evidence.length} items</div>
                </div>
              </div>
            )}
          </div>

          {/* Side Panel */}
          {(selectedEntity || selectedRelationship) && (
            <div className="w-96 border-l bg-white overflow-hidden">
              <Tabs defaultValue={selectedEntity ? "entity" : "relationship"} className="h-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="entity" disabled={!selectedEntity}>Entity</TabsTrigger>
                  <TabsTrigger value="relationship" disabled={!selectedRelationship}>Relationship</TabsTrigger>
                </TabsList>

                {/* Entity Details */}
                {selectedEntity && (
                  <TabsContent value="entity" className="h-[calc(100%-40px)]">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedEntity.name}</h3>
                          <p className="text-sm text-gray-600">{selectedEntity.kind} • {selectedEntity.namespace}</p>
                        </div>

                        {selectedEntity.metadata.description && (
                          <div>
                            <Label className="text-sm font-medium">Description</Label>
                            <p className="text-sm mt-1">{selectedEntity.metadata.description}</p>
                          </div>
                        )}

                        {selectedEntity.metadata.tags && selectedEntity.metadata.tags.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Tags</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedEntity.metadata.tags.map(tag => (
                                <Badge key={tag} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedEntity.spec && (
                          <div>
                            <Label className="text-sm font-medium">Specification</Label>
                            <div className="space-y-1 mt-1 text-sm">
                              {selectedEntity.spec.type && <div>Type: {selectedEntity.spec.type}</div>}
                              {selectedEntity.spec.lifecycle && <div>Lifecycle: {selectedEntity.spec.lifecycle}</div>}
                              {selectedEntity.spec.owner && <div>Owner: {selectedEntity.spec.owner}</div>}
                            </div>
                          </div>
                        )}

                        {/* Related Relationships */}
                        <div>
                          <Label className="text-sm font-medium">Relationships</Label>
                          <div className="space-y-2 mt-2">
                            {relationships
                              .filter(rel => rel.sourceEntity === selectedEntity.id || rel.targetEntity === selectedEntity.id)
                              .map(rel => (
                                <div
                                  key={rel.id}
                                  className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                                  onClick={() => setSelectedRelationship(rel)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{rel.type}</span>
                                    <Badge
                                      variant={rel.status === 'confirmed' ? 'default' : 
                                              rel.status === 'rejected' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {rel.status}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {rel.sourceEntity === selectedEntity.id ? 'to' : 'from'} {
                                      rel.sourceEntity === selectedEntity.id ? rel.targetEntity : rel.sourceEntity
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Confidence: {(rel.confidence * 100).toFixed(0)}%
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}

                {/* Relationship Details */}
                {selectedRelationship && (
                  <TabsContent value="relationship" className="h-[calc(100%-40px)]">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{selectedRelationship.type}</h3>
                            <p className="text-sm text-gray-600">
                              {selectedRelationship.sourceEntity} → {selectedRelationship.targetEntity}
                            </p>
                          </div>
                          <Badge
                            variant={selectedRelationship.status === 'confirmed' ? 'default' : 
                                    selectedRelationship.status === 'rejected' ? 'destructive' : 'secondary'}
                          >
                            {selectedRelationship.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Confidence</Label>
                            <div className="text-2xl font-bold text-blue-600">
                              {(selectedRelationship.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Discovery Method</Label>
                            <div className="flex items-center mt-1">
                              {React.createElement(getDiscoveryMethodIcon(selectedRelationship.discoveryMethod), {
                                className: "h-4 w-4 mr-2"
                              })}
                              <span className="text-sm">{selectedRelationship.discoveryMethod.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Evidence ({selectedRelationship.metadata.evidence.length})</Label>
                          <div className="space-y-2 mt-2">
                            {selectedRelationship.metadata.evidence.map((evidence, index) => (
                              <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                                <div className="font-medium">{evidence.type}</div>
                                <div className="text-gray-600">{evidence.description}</div>
                                {evidence.location && (
                                  <div className="text-xs text-gray-500 mt-1">Location: {evidence.location}</div>
                                )}
                                <div className="text-xs text-blue-600">
                                  Confidence: {(evidence.confidence * 100).toFixed(0)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div>Created: {new Date(selectedRelationship.createdAt).toLocaleDateString()}</div>
                          {selectedRelationship.confirmedBy && (
                            <div>Confirmed by: {selectedRelationship.confirmedBy}</div>
                          )}
                          {selectedRelationship.metadata.frequency && (
                            <div>Frequency: {selectedRelationship.metadata.frequency}</div>
                          )}
                          {selectedRelationship.metadata.lastSeen && (
                            <div>Last seen: {new Date(selectedRelationship.metadata.lastSeen).toLocaleDateString()}</div>
                          )}
                        </div>

                        {/* Actions */}
                        {selectedRelationship.status === 'discovered' && (
                          <div className="flex space-x-2 pt-4 border-t">
                            <Button
                              size="sm"
                              onClick={() => onRelationshipConfirm?.(selectedRelationship.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRelationshipReject?.(selectedRelationship.id)}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRelationshipEdit?.(selectedRelationship)}
                            className="flex-1"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {settings.showMetrics && (
          <div className="border-t bg-gray-50 px-4 py-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>Entities: {graphData.nodes.length}</span>
                <span>Relationships: {graphData.links.length}</span>
                <span>
                  Confirmed: {relationships.filter(r => r.status === 'confirmed').length}
                </span>
                <span>
                  Avg Confidence: {(relationships.reduce((sum, r) => sum + r.confidence, 0) / relationships.length * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {hoveredNode && (
                  <span>Hovered: {hoveredNode.entity.name}</span>
                )}
                {selectedEntity && (
                  <span>Selected: {selectedEntity.name}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default RelationshipVisualizer;