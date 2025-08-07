/**
 * Core Visualization Engine
 * High-performance rendering engine supporting 10,000+ nodes
 */

import * as d3 from 'd3';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled';
import { 
  ServiceNode, 
  ServiceRelationship, 
  VisualizationConfig, 
  LayoutType, 
  RenderMode,
  PerformanceConfig,
  LevelOfDetail
} from '../types';

export class VisualizationEngine {
  private container: HTMLElement | null = null;
  private config: VisualizationConfig;
  private performanceConfig: PerformanceConfig;
  private nodes: Map<string, ServiceNode> = new Map();
  private edges: Map<string, ServiceRelationship> = new Map();
  private renderer: any = null;
  private worker: Worker | null = null;
  private rafId: number | null = null;
  private elk = new ELK();

  constructor(config: VisualizationConfig, performanceConfig: PerformanceConfig) {
    this.config = config;
    this.performanceConfig = performanceConfig;
    
    if (performanceConfig.workers && typeof Worker !== 'undefined') {
      this.initializeWorker();
    }
  }

  /**
   * Initialize the visualization in a container
   */
  public async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    
    switch (this.config.renderMode) {
      case RenderMode.WEBGL:
        await this.initializeWebGL();
        break;
      case RenderMode.CANVAS_2D:
        await this.initializeCanvas2D();
        break;
      case RenderMode.SVG:
        await this.initializeSVG();
        break;
      case RenderMode.WEBGPU:
        if (await this.checkWebGPUSupport()) {
          await this.initializeWebGPU();
        } else {
          console.warn('WebGPU not supported, falling back to WebGL');
          await this.initializeWebGL();
        }
        break;
    }
  }

  /**
   * Initialize WebGL renderer for high-performance 3D visualization
   */
  private async initializeWebGL(): Promise<void> {
    const graph = ForceGraph3D({ controlType: 'orbit' })(this.container!)
      .graphData({ nodes: [], links: [] })
      .backgroundColor('#000011')
      .nodeLabel('name')
      .nodeAutoColorBy('type')
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .onNodeClick(this.handleNodeClick.bind(this))
      .onNodeHover(this.handleNodeHover.bind(this))
      .enableNodeDrag(true)
      .enableNavigationControls(true)
      .showNavInfo(true);

    // Custom node geometry based on service type
    graph.nodeThreeObject((node: any) => {
      const geometry = this.getNodeGeometry(node);
      const material = this.getNodeMaterial(node);
      return new THREE.Mesh(geometry, material);
    });

    // Performance optimizations
    if (this.performanceConfig.levelOfDetail === LevelOfDetail.LOW) {
      graph.d3AlphaDecay(0.02);
      graph.d3VelocityDecay(0.3);
    }

    this.renderer = graph;
  }

  /**
   * Initialize Canvas 2D renderer for balanced performance
   */
  private async initializeCanvas2D(): Promise<void> {
    const width = this.container!.clientWidth;
    const height = this.container!.clientHeight;

    const canvas = d3.select(this.container!)
      .append('canvas')
      .attr('width', width)
      .attr('height', height);

    const context = canvas.node()!.getContext('2d')!;
    
    const simulation = forceSimulation()
      .force('link', forceLink().id((d: any) => d.id))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide().radius(30));

    this.renderer = { canvas, context, simulation };
    this.startCanvas2DRenderLoop();
  }

  /**
   * Initialize SVG renderer for high-quality vector graphics
   */
  private async initializeSVG(): Promise<void> {
    const width = this.container!.clientWidth;
    const height = this.container!.clientHeight;

    const svg = d3.select(this.container!)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        svg.select('.graph-container').attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const container = svg.append('g').attr('class', 'graph-container');

    // Add arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .enter().append('marker')
      .attr('id', d => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    this.renderer = { svg, container };
  }

  /**
   * Initialize WebGPU renderer for next-gen performance
   */
  private async initializeWebGPU(): Promise<void> {
    // WebGPU implementation would go here
    // This is a placeholder for future WebGPU support
    console.log('WebGPU renderer initialization');
    await this.initializeWebGL(); // Fallback to WebGL for now
  }

  /**
   * Check WebGPU support
   */
  private async checkWebGPUSupport(): Promise<boolean> {
    if (!navigator.gpu) return false;
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  /**
   * Update nodes and edges data
   */
  public async updateData(nodes: ServiceNode[], edges: ServiceRelationship[]): Promise<void> {
    // Apply performance limits
    if (nodes.length > this.performanceConfig.maxNodes) {
      console.warn(`Node count (${nodes.length}) exceeds max (${this.performanceConfig.maxNodes}). Applying sampling.`);
      nodes = this.sampleNodes(nodes, this.performanceConfig.maxNodes);
    }

    if (edges.length > this.performanceConfig.maxEdges) {
      console.warn(`Edge count (${edges.length}) exceeds max (${this.performanceConfig.maxEdges}). Applying filtering.`);
      edges = this.filterEdges(edges, this.performanceConfig.maxEdges);
    }

    this.nodes.clear();
    nodes.forEach(node => this.nodes.set(node.id, node));
    
    this.edges.clear();
    edges.forEach(edge => this.edges.set(edge.id, edge));

    await this.applyLayout();
    this.render();
  }

  /**
   * Apply layout algorithm
   */
  private async applyLayout(): Promise<void> {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());

    switch (this.config.layout) {
      case LayoutType.FORCE_DIRECTED:
        await this.applyForceDirectedLayout(nodes, edges);
        break;
      case LayoutType.HIERARCHICAL:
        await this.applyHierarchicalLayout(nodes, edges);
        break;
      case LayoutType.CIRCULAR:
        await this.applyCircularLayout(nodes);
        break;
      case LayoutType.GRID:
        await this.applyGridLayout(nodes);
        break;
      case LayoutType.LAYERED:
        await this.applyLayeredLayout(nodes, edges);
        break;
      case LayoutType.RADIAL:
        await this.applyRadialLayout(nodes, edges);
        break;
      case LayoutType.GEOGRAPHIC:
        await this.applyGeographicLayout(nodes);
        break;
    }
  }

  /**
   * Force-directed layout using D3
   */
  private async applyForceDirectedLayout(nodes: ServiceNode[], edges: ServiceRelationship[]): Promise<void> {
    if (this.performanceConfig.workers && this.worker) {
      // Offload to worker thread
      return new Promise((resolve) => {
        this.worker!.postMessage({
          type: 'layout',
          algorithm: 'force',
          nodes,
          edges
        });
        
        this.worker!.onmessage = (e) => {
          if (e.data.type === 'layout-complete') {
            this.updateNodePositions(e.data.positions);
            resolve();
          }
        };
      });
    }

    const simulation = forceSimulation(nodes as any)
      .force('link', forceLink(edges as any)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', forceManyBody().strength(-500))
      .force('center', forceCenter(0, 0))
      .force('collision', forceCollide().radius(50));

    // Run simulation
    simulation.stop();
    for (let i = 0; i < 300; ++i) simulation.tick();

    nodes.forEach((node: any) => {
      node.position = { x: node.x, y: node.y, z: 0 };
    });
  }

  /**
   * Hierarchical layout using Dagre
   */
  private async applyHierarchicalLayout(nodes: ServiceNode[], edges: ServiceRelationship[]): Promise<void> {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 50 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(node => {
      g.setNode(node.id, { width: 100, height: 50 });
    });

    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    nodes.forEach(node => {
      const pos = g.node(node.id);
      if (pos) {
        node.position = { x: pos.x, y: pos.y, z: 0 };
      }
    });
  }

  /**
   * Circular layout
   */
  private async applyCircularLayout(nodes: ServiceNode[]): Promise<void> {
    const radius = Math.min(this.container!.clientWidth, this.container!.clientHeight) / 3;
    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, i) => {
      const angle = i * angleStep;
      node.position = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z: 0
      };
    });
  }

  /**
   * Grid layout
   */
  private async applyGridLayout(nodes: ServiceNode[]): Promise<void> {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 150;

    nodes.forEach((node, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      node.position = {
        x: col * spacing - (cols * spacing) / 2,
        y: row * spacing - (Math.ceil(nodes.length / cols) * spacing) / 2,
        z: 0
      };
    });
  }

  /**
   * Layered layout using ELK
   */
  private async applyLayeredLayout(nodes: ServiceNode[], edges: ServiceRelationship[]): Promise<void> {
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '50',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100'
      },
      children: nodes.map(node => ({
        id: node.id,
        width: 100,
        height: 50
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target]
      }))
    };

    const layout = await this.elk.layout(graph);
    
    if (layout.children) {
      layout.children.forEach((child: any) => {
        const node = this.nodes.get(child.id);
        if (node) {
          node.position = { x: child.x || 0, y: child.y || 0, z: 0 };
        }
      });
    }
  }

  /**
   * Radial layout
   */
  private async applyRadialLayout(nodes: ServiceNode[], edges: ServiceRelationship[]): Promise<void> {
    // Find root nodes (nodes with no incoming edges)
    const roots = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );

    if (roots.length === 0) {
      // If no roots found, use the first node
      roots.push(nodes[0]);
    }

    const levels = this.calculateNodeLevels(nodes, edges, roots);
    const maxLevel = Math.max(...Array.from(levels.values()));

    levels.forEach((level, nodeId) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      const radius = level * 150;
      const nodesAtLevel = Array.from(levels.entries())
        .filter(([_, l]) => l === level)
        .map(([id]) => id);
      
      const angleStep = (2 * Math.PI) / nodesAtLevel.length;
      const index = nodesAtLevel.indexOf(nodeId);
      const angle = index * angleStep;

      node.position = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z: 0
      };
    });
  }

  /**
   * Geographic layout (for services with location data)
   */
  private async applyGeographicLayout(nodes: ServiceNode[]): Promise<void> {
    // This would use actual geographic coordinates if available
    // For now, we'll use a placeholder implementation
    await this.applyForceDirectedLayout(nodes, []);
  }

  /**
   * Calculate node levels for hierarchical layouts
   */
  private calculateNodeLevels(
    nodes: ServiceNode[], 
    edges: ServiceRelationship[], 
    roots: ServiceNode[]
  ): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ node: ServiceNode; level: number }> = [];

    // Initialize with root nodes
    roots.forEach(root => {
      queue.push({ node: root, level: 0 });
      visited.add(root.id);
    });

    while (queue.length > 0) {
      const { node, level } = queue.shift()!;
      levels.set(node.id, level);

      // Find children
      const children = edges
        .filter(edge => edge.source === node.id)
        .map(edge => nodes.find(n => n.id === edge.target))
        .filter(n => n && !visited.has(n.id)) as ServiceNode[];

      children.forEach(child => {
        queue.push({ node: child, level: level + 1 });
        visited.add(child.id);
      });
    }

    // Handle disconnected nodes
    nodes.forEach(node => {
      if (!levels.has(node.id)) {
        levels.set(node.id, 0);
      }
    });

    return levels;
  }

  /**
   * Render the visualization
   */
  private render(): void {
    switch (this.config.renderMode) {
      case RenderMode.WEBGL:
        this.renderWebGL();
        break;
      case RenderMode.CANVAS_2D:
        this.renderCanvas2D();
        break;
      case RenderMode.SVG:
        this.renderSVG();
        break;
    }
  }

  /**
   * Render using WebGL
   */
  private renderWebGL(): void {
    if (!this.renderer) return;

    const graphData = {
      nodes: Array.from(this.nodes.values()).map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        health: node.health.status,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        z: node.position?.z || 0
      })),
      links: Array.from(this.edges.values()).map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type
      }))
    };

    this.renderer.graphData(graphData);
  }

  /**
   * Render using Canvas 2D
   */
  private renderCanvas2D(): void {
    if (!this.renderer) return;

    const { context, canvas } = this.renderer;
    const width = canvas.node().width;
    const height = canvas.node().height;

    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);

    // Draw edges
    this.edges.forEach(edge => {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) return;

      context.beginPath();
      context.moveTo(source.position!.x, source.position!.y);
      context.lineTo(target.position!.x, target.position!.y);
      context.strokeStyle = '#666';
      context.stroke();
    });

    // Draw nodes
    this.nodes.forEach(node => {
      if (!node.position) return;

      context.beginPath();
      context.arc(node.position.x, node.position.y, 20, 0, 2 * Math.PI);
      context.fillStyle = this.getNodeColor(node);
      context.fill();
      context.strokeStyle = '#fff';
      context.stroke();

      // Draw label
      context.fillStyle = '#fff';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.fillText(node.name, node.position.x, node.position.y + 35);
    });

    context.restore();
  }

  /**
   * Render using SVG
   */
  private renderSVG(): void {
    if (!this.renderer) return;

    const { container } = this.renderer;

    // Clear existing content
    container.selectAll('*').remove();

    // Draw edges
    const edges = container.selectAll('.edge')
      .data(Array.from(this.edges.values()))
      .enter().append('line')
      .attr('class', 'edge')
      .attr('x1', (d: ServiceRelationship) => this.nodes.get(d.source)?.position?.x || 0)
      .attr('y1', (d: ServiceRelationship) => this.nodes.get(d.source)?.position?.y || 0)
      .attr('x2', (d: ServiceRelationship) => this.nodes.get(d.target)?.position?.x || 0)
      .attr('y2', (d: ServiceRelationship) => this.nodes.get(d.target)?.position?.y || 0)
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // Draw nodes
    const nodeGroups = container.selectAll('.node')
      .data(Array.from(this.nodes.values()))
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: ServiceNode) => `translate(${d.position?.x || 0},${d.position?.y || 0})`);

    nodeGroups.append('circle')
      .attr('r', 25)
      .attr('fill', (d: ServiceNode) => this.getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 40)
      .attr('fill', '#fff')
      .text((d: ServiceNode) => d.name);
  }

  /**
   * Get node color based on health status
   */
  private getNodeColor(node: ServiceNode): string {
    const colors = {
      healthy: '#4caf50',
      degraded: '#ff9800',
      unhealthy: '#f44336',
      unknown: '#9e9e9e',
      maintenance: '#2196f3'
    };
    return colors[node.health.status] || colors.unknown;
  }

  /**
   * Get node geometry for 3D rendering
   */
  private getNodeGeometry(node: any): THREE.BufferGeometry {
    const geometries = {
      api: new THREE.BoxGeometry(15, 15, 15),
      service: new THREE.SphereGeometry(10, 32, 16),
      database: new THREE.CylinderGeometry(10, 10, 15, 8),
      cache: new THREE.OctahedronGeometry(10),
      queue: new THREE.ConeGeometry(10, 15, 8),
      default: new THREE.BoxGeometry(10, 10, 10)
    };
    return geometries[node.type as keyof typeof geometries] || geometries.default;
  }

  /**
   * Get node material for 3D rendering
   */
  private getNodeMaterial(node: any): THREE.Material {
    const color = this.getNodeColor(node);
    return new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      shininess: 100
    });
  }

  /**
   * Handle node click events
   */
  private handleNodeClick(node: any): void {
    console.log('Node clicked:', node);
    // Emit event for external handlers
  }

  /**
   * Handle node hover events
   */
  private handleNodeHover(node: any): void {
    console.log('Node hovered:', node);
    // Update tooltip or highlight connections
  }

  /**
   * Sample nodes for performance
   */
  private sampleNodes(nodes: ServiceNode[], maxCount: number): ServiceNode[] {
    // Priority sampling: keep critical and unhealthy nodes
    const critical = nodes.filter(n => n.metadata.criticality === 'critical');
    const unhealthy = nodes.filter(n => n.health.status === 'unhealthy');
    const degraded = nodes.filter(n => n.health.status === 'degraded');
    
    const priority = new Set([...critical, ...unhealthy, ...degraded]);
    const remaining = nodes.filter(n => !priority.has(n));
    
    const sampled = Array.from(priority);
    const sampleCount = Math.min(maxCount - sampled.length, remaining.length);
    
    for (let i = 0; i < sampleCount; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      sampled.push(remaining[index]);
      remaining.splice(index, 1);
    }
    
    return sampled;
  }

  /**
   * Filter edges for performance
   */
  private filterEdges(edges: ServiceRelationship[], maxCount: number): ServiceRelationship[] {
    // Keep critical relationships
    const critical = edges.filter(e => e.metadata.criticality === 'critical');
    const remaining = edges.filter(e => e.metadata.criticality !== 'critical');
    
    const filtered = [...critical];
    const filterCount = Math.min(maxCount - filtered.length, remaining.length);
    
    // Sort by traffic volume and keep top edges
    remaining.sort((a, b) => (b.traffic?.volume || 0) - (a.traffic?.volume || 0));
    filtered.push(...remaining.slice(0, filterCount));
    
    return filtered;
  }

  /**
   * Update node positions
   */
  private updateNodePositions(positions: Map<string, { x: number; y: number; z: number }>): void {
    positions.forEach((pos, nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.position = pos;
      }
    });
  }

  /**
   * Initialize web worker for offloading computations
   */
  private initializeWorker(): void {
    const workerCode = `
      self.onmessage = function(e) {
        if (e.data.type === 'layout') {
          // Perform layout calculations
          const positions = new Map();
          // ... layout algorithm implementation
          self.postMessage({ type: 'layout-complete', positions });
        }
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  /**
   * Start Canvas 2D render loop
   */
  private startCanvas2DRenderLoop(): void {
    const animate = () => {
      this.renderCanvas2D();
      this.rafId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    if (this.worker) {
      this.worker.terminate();
    }
    
    if (this.renderer) {
      if (this.renderer._destructor) {
        this.renderer._destructor();
      }
      this.renderer = null;
    }
    
    this.nodes.clear();
    this.edges.clear();
  }
}