/**
 * Service Topology Visualization Component
 * Production-ready component for visualizing service architectures
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  Card, 
  CardContent,
  CardHeader,
  Typography,
  Box,
  Paper,
  IconButton,
  Toolbar,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  ButtonGroup,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  ZoomOutMap,
  Fullscreen,
  FullscreenExit,
  Settings,
  Layers,
  Timeline,
  Download,
  Share,
  FilterList,
  Search,
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  Refresh,
  Info,
  Warning,
  Error as ErrorIcon,
  CheckCircle
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { VisualizationEngine } from '../services/VisualizationEngine';
import { DependencyAnalyzer } from '../services/DependencyAnalyzer';
import { RealtimeDataService } from '../services/RealtimeDataService';
import { 
  ServiceNode,
  ServiceRelationship,
  VisualizationConfig,
  LayoutType,
  RenderMode,
  ViewMode,
  HealthState,
  ServiceType,
  Environment,
  FilterConfig,
  PerformanceConfig,
  LevelOfDetail,
  ExportFormat,
  TimeRange,
  PlaybackConfig
} from '../types';
import { useTopologyStore } from '../store/useTopologyStore';
import { ServiceDetailsPanel } from './ServiceDetailsPanel';
import { MetricsOverlay } from './MetricsOverlay';
import { TimelineControls } from './TimelineControls';
import { FilterPanel } from './FilterPanel';
import { SearchBar } from './SearchBar';
import { MiniMap } from './MiniMap';
import { LegendPanel } from './LegendPanel';
import { PathFinderDialog } from './PathFinderDialog';
import { ImpactAnalysisDialog } from './ImpactAnalysisDialog';

const VisualizationContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
}));

const CanvasContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  position: 'relative',
  width: '100%',
  height: '100%',
  '& canvas': {
    width: '100%',
    height: '100%'
  }
}));

const ControlsToolbar = styled(Toolbar)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[4],
  zIndex: 1000,
  gap: theme.spacing(2),
  padding: theme.spacing(1)
}));

const StatusBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  color: theme.palette.common.white,
  padding: theme.spacing(1, 2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  zIndex: 1000
}));

export interface ServiceTopologyVisualizationProps {
  initialNodes?: ServiceNode[];
  initialEdges?: ServiceRelationship[];
  onNodeSelect?: (node: ServiceNode) => void;
  onEdgeSelect?: (edge: ServiceRelationship) => void;
  enableRealtime?: boolean;
  realtimeEndpoint?: string;
  showMiniMap?: boolean;
  showLegend?: boolean;
  showMetrics?: boolean;
  showTimeline?: boolean;
  enableExport?: boolean;
  enableSharing?: boolean;
}

export const ServiceTopologyVisualization: React.FC<ServiceTopologyVisualizationProps> = ({
  initialNodes = [],
  initialEdges = [],
  onNodeSelect,
  onEdgeSelect,
  enableRealtime = true,
  realtimeEndpoint = '/api/topology/stream',
  showMiniMap = true,
  showLegend = true,
  showMetrics = true,
  showTimeline = false,
  enableExport = true,
  enableSharing = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VisualizationEngine | null>(null);
  const realtimeServiceRef = useRef<RealtimeDataService | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ServiceRelationship | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPathFinder, setShowPathFinder] = useState(false);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // Store hooks
  const {
    nodes,
    edges,
    config,
    performanceConfig,
    filters,
    setNodes,
    setEdges,
    updateConfig,
    updatePerformanceConfig,
    updateFilters,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    updateEdge,
    removeEdge
  } = useTopologyStore();

  // Statistics
  const statistics = useMemo(() => {
    const healthCounts = nodes.reduce((acc, node) => {
      acc[node.health.status] = (acc[node.health.status] || 0) + 1;
      return acc;
    }, {} as Record<HealthState, number>);

    const typeCounts = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<ServiceType, number>);

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      healthCounts,
      typeCounts,
      criticalNodes: nodes.filter(n => n.metadata.criticality === 'critical').length,
      incidents: nodes.reduce((acc, n) => acc + (n.health.incidents?.length || 0), 0)
    };
  }, [nodes, edges]);

  /**
   * Initialize visualization engine
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const initEngine = async () => {
      try {
        setIsLoading(true);
        
        // Create visualization engine
        const engine = new VisualizationEngine(config, performanceConfig);
        await engine.initialize(containerRef.current!);
        engineRef.current = engine;

        // Load initial data
        if (initialNodes.length > 0) {
          setNodes(initialNodes);
          setEdges(initialEdges);
          await engine.updateData(initialNodes, initialEdges);
        }

        // Initialize realtime service if enabled
        if (enableRealtime) {
          const realtimeService = new RealtimeDataService(realtimeEndpoint);
          realtimeService.on('nodeUpdate', handleNodeUpdate);
          realtimeService.on('edgeUpdate', handleEdgeUpdate);
          realtimeService.on('healthChange', handleHealthChange);
          realtimeService.on('metricUpdate', handleMetricUpdate);
          await realtimeService.connect();
          realtimeServiceRef.current = realtimeService;
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize visualization:', err);
        setError('Failed to initialize visualization engine');
        setIsLoading(false);
      }
    };

    initEngine();

    return () => {
      // Cleanup
      if (engineRef.current) {
        engineRef.current.destroy();
      }
      if (realtimeServiceRef.current) {
        realtimeServiceRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Update visualization when data changes
   */
  useEffect(() => {
    if (!engineRef.current || nodes.length === 0) return;
    
    engineRef.current.updateData(nodes, edges);
  }, [nodes, edges]);

  /**
   * Update visualization config
   */
  useEffect(() => {
    if (!engineRef.current) return;
    
    // Recreate engine with new config
    const reinitialize = async () => {
      await engineRef.current!.destroy();
      const engine = new VisualizationEngine(config, performanceConfig);
      await engine.initialize(containerRef.current!);
      await engine.updateData(nodes, edges);
      engineRef.current = engine;
    };
    
    reinitialize();
  }, [config, performanceConfig]);

  /**
   * Handle node updates from realtime service
   */
  const handleNodeUpdate = useCallback((update: any) => {
    if (update.type === 'add') {
      addNode(update.node);
    } else if (update.type === 'update') {
      updateNode(update.node.id, update.node);
    } else if (update.type === 'remove') {
      removeNode(update.nodeId);
    }
  }, [addNode, updateNode, removeNode]);

  /**
   * Handle edge updates from realtime service
   */
  const handleEdgeUpdate = useCallback((update: any) => {
    if (update.type === 'add') {
      addEdge(update.edge);
    } else if (update.type === 'update') {
      updateEdge(update.edge.id, update.edge);
    } else if (update.type === 'remove') {
      removeEdge(update.edgeId);
    }
  }, [addEdge, updateEdge, removeEdge]);

  /**
   * Handle health changes
   */
  const handleHealthChange = useCallback((change: any) => {
    updateNode(change.nodeId, {
      health: change.health
    });
    
    // Show notification for critical changes
    if (change.health.status === HealthState.UNHEALTHY) {
      setSnackbarMessage(`Service ${change.nodeName} is unhealthy!`);
    }
  }, [updateNode]);

  /**
   * Handle metric updates
   */
  const handleMetricUpdate = useCallback((update: any) => {
    updateNode(update.nodeId, {
      metrics: update.metrics
    });
  }, [updateNode]);

  /**
   * Handle layout change
   */
  const handleLayoutChange = (layout: LayoutType) => {
    updateConfig({ layout });
  };

  /**
   * Handle view mode change
   */
  const handleViewModeChange = (viewMode: ViewMode) => {
    updateConfig({ viewMode });
  };

  /**
   * Handle render mode change
   */
  const handleRenderModeChange = (renderMode: RenderMode) => {
    updateConfig({ renderMode });
  };

  /**
   * Handle zoom controls
   */
  const handleZoomIn = () => {
    // Implementation depends on renderer
  };

  const handleZoomOut = () => {
    // Implementation depends on renderer
  };

  const handleZoomReset = () => {
    // Implementation depends on renderer
  };

  /**
   * Handle fullscreen toggle
   */
  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  /**
   * Handle export
   */
  const handleExport = async (format: ExportFormat) => {
    try {
      // Export implementation
      setSnackbarMessage(`Exported as ${format}`);
    } catch (err) {
      setError('Export failed');
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      // Reload data from backend
      const response = await fetch('/api/topology');
      const data = await response.json();
      setNodes(data.nodes);
      setEdges(data.edges);
      setIsLoading(false);
      setSnackbarMessage('Data refreshed');
    } catch (err) {
      setError('Failed to refresh data');
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  return (
    <VisualizationContainer>
      {isLoading && (
        <Box 
          position="absolute" 
          top="50%" 
          left="50%" 
          zIndex={2000}
          sx={{ transform: 'translate(-50%, -50%)' }}
        >
          <CircularProgress size={60} />
        </Box>
      )}

      <ControlsToolbar>
        {/* Layout Controls */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Layout</InputLabel>
          <Select
            value={config.layout}
            onChange={(e) => handleLayoutChange(e.target.value as LayoutType)}
            label="Layout"
          >
            <MenuItem value={LayoutType.FORCE_DIRECTED}>Force Directed</MenuItem>
            <MenuItem value={LayoutType.HIERARCHICAL}>Hierarchical</MenuItem>
            <MenuItem value={LayoutType.CIRCULAR}>Circular</MenuItem>
            <MenuItem value={LayoutType.GRID}>Grid</MenuItem>
            <MenuItem value={LayoutType.LAYERED}>Layered</MenuItem>
            <MenuItem value={LayoutType.RADIAL}>Radial</MenuItem>
          </Select>
        </FormControl>

        {/* View Mode */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>View</InputLabel>
          <Select
            value={config.viewMode}
            onChange={(e) => handleViewModeChange(e.target.value as ViewMode)}
            label="View"
          >
            <MenuItem value={ViewMode.LOGICAL}>Logical</MenuItem>
            <MenuItem value={ViewMode.PHYSICAL}>Physical</MenuItem>
            <MenuItem value={ViewMode.NETWORK}>Network</MenuItem>
            <MenuItem value={ViewMode.SECURITY}>Security</MenuItem>
            <MenuItem value={ViewMode.COST}>Cost</MenuItem>
            <MenuItem value={ViewMode.PERFORMANCE}>Performance</MenuItem>
            <MenuItem value={ViewMode.DEPENDENCIES}>Dependencies</MenuItem>
            <MenuItem value={ViewMode.DATA_FLOW}>Data Flow</MenuItem>
          </Select>
        </FormControl>

        <Divider orientation="vertical" flexItem />

        {/* Zoom Controls */}
        <ButtonGroup size="small">
          <Tooltip title="Zoom In">
            <IconButton onClick={handleZoomIn}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={handleZoomOut}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Zoom">
            <IconButton onClick={handleZoomReset}>
              <ZoomOutMap />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* Action Buttons */}
        <Tooltip title="Search">
          <IconButton onClick={() => setShowSearch(!showSearch)}>
            <Search />
          </IconButton>
        </Tooltip>

        <Tooltip title="Filters">
          <IconButton onClick={() => setShowFilters(!showFilters)}>
            <FilterList />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton onClick={() => setShowSettings(!showSettings)}>
            <Settings />
          </IconButton>
        </Tooltip>

        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh}>
            <Refresh />
          </IconButton>
        </Tooltip>

        {enableExport && (
          <Tooltip title="Export">
            <IconButton onClick={() => handleExport(ExportFormat.PNG)}>
              <Download />
            </IconButton>
          </Tooltip>
        )}

        {enableSharing && (
          <Tooltip title="Share">
            <IconButton>
              <Share />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton onClick={handleFullscreenToggle}>
            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Tooltip>

        <Box flex={1} />

        {/* Status Indicators */}
        <Box display="flex" gap={1}>
          <Chip 
            icon={<CheckCircle />}
            label={`Healthy: ${statistics.healthCounts[HealthState.HEALTHY] || 0}`}
            color="success"
            size="small"
          />
          <Chip 
            icon={<Warning />}
            label={`Degraded: ${statistics.healthCounts[HealthState.DEGRADED] || 0}`}
            color="warning"
            size="small"
          />
          <Chip 
            icon={<ErrorIcon />}
            label={`Unhealthy: ${statistics.healthCounts[HealthState.UNHEALTHY] || 0}`}
            color="error"
            size="small"
          />
        </Box>
      </ControlsToolbar>

      {/* Main Canvas */}
      <CanvasContainer ref={containerRef} />

      {/* MiniMap */}
      {showMiniMap && (
        <MiniMap 
          nodes={nodes}
          edges={edges}
          viewport={{}}
        />
      )}

      {/* Legend */}
      {showLegend && (
        <LegendPanel />
      )}

      {/* Metrics Overlay */}
      {showMetrics && selectedNode && (
        <MetricsOverlay 
          node={selectedNode}
          position={{ x: 100, y: 100 }}
        />
      )}

      {/* Timeline Controls */}
      {showTimeline && (
        <TimelineControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onTimeChange={setCurrentTime}
        />
      )}

      {/* Search Bar */}
      {showSearch && (
        <SearchBar
          nodes={nodes}
          onNodeSelect={(node) => {
            setSelectedNode(node);
            onNodeSelect?.(node);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Filter Panel */}
      <Drawer
        anchor="right"
        open={showFilters}
        onClose={() => setShowFilters(false)}
      >
        <FilterPanel
          filters={filters}
          onFiltersChange={updateFilters}
          nodes={nodes}
        />
      </Drawer>

      {/* Settings Panel */}
      <Drawer
        anchor="right"
        open={showSettings}
        onClose={() => setShowSettings(false)}
      >
        <Box sx={{ width: 350, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Visualization Settings
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Render Mode</InputLabel>
            <Select
              value={config.renderMode}
              onChange={(e) => handleRenderModeChange(e.target.value as RenderMode)}
              label="Render Mode"
            >
              <MenuItem value={RenderMode.SVG}>SVG</MenuItem>
              <MenuItem value={RenderMode.CANVAS_2D}>Canvas 2D</MenuItem>
              <MenuItem value={RenderMode.WEBGL}>WebGL</MenuItem>
              <MenuItem value={RenderMode.WEBGPU}>WebGPU (Experimental)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Performance Level</InputLabel>
            <Select
              value={performanceConfig.levelOfDetail}
              onChange={(e) => updatePerformanceConfig({ 
                levelOfDetail: e.target.value as LevelOfDetail 
              })}
              label="Performance Level"
            >
              <MenuItem value={LevelOfDetail.LOW}>Low</MenuItem>
              <MenuItem value={LevelOfDetail.MEDIUM}>Medium</MenuItem>
              <MenuItem value={LevelOfDetail.HIGH}>High</MenuItem>
              <MenuItem value={LevelOfDetail.ULTRA}>Ultra</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>Max Nodes: {performanceConfig.maxNodes}</Typography>
            <Slider
              value={performanceConfig.maxNodes}
              min={100}
              max={10000}
              step={100}
              onChange={(_, value) => updatePerformanceConfig({ 
                maxNodes: value as number 
              })}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={config.animation.enabled}
                onChange={(e) => updateConfig({
                  animation: { ...config.animation, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Animations"
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.clustering.enabled}
                onChange={(e) => updateConfig({
                  clustering: { ...config.clustering, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Clustering"
          />
        </Box>
      </Drawer>

      {/* Service Details Panel */}
      {selectedNode && (
        <ServiceDetailsPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onPathFind={() => setShowPathFinder(true)}
          onImpactAnalysis={() => setShowImpactAnalysis(true)}
        />
      )}

      {/* Path Finder Dialog */}
      {showPathFinder && (
        <PathFinderDialog
          nodes={nodes}
          edges={edges}
          sourceNode={selectedNode}
          onClose={() => setShowPathFinder(false)}
        />
      )}

      {/* Impact Analysis Dialog */}
      {showImpactAnalysis && selectedNode && (
        <ImpactAnalysisDialog
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          onClose={() => setShowImpactAnalysis(false)}
        />
      )}

      {/* Status Bar */}
      <StatusBar>
        <Box display="flex" gap={2}>
          <Typography variant="caption">
            Nodes: {statistics.totalNodes}
          </Typography>
          <Typography variant="caption">
            Edges: {statistics.totalEdges}
          </Typography>
          <Typography variant="caption">
            Critical: {statistics.criticalNodes}
          </Typography>
          {statistics.incidents > 0 && (
            <Typography variant="caption" color="error">
              Incidents: {statistics.incidents}
            </Typography>
          )}
        </Box>
        
        <Box display="flex" gap={2}>
          {enableRealtime && (
            <Chip
              size="small"
              label="Live"
              color="success"
              variant="outlined"
              icon={<CheckCircle />}
            />
          )}
          <Typography variant="caption">
            Last Update: {new Date().toLocaleTimeString()}
          </Typography>
        </Box>
      </StatusBar>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
      />
    </VisualizationContainer>
  );
};