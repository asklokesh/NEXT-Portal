/**
 * Layout Engine for Service Topology Visualization
 * 
 * Provides advanced graph layout algorithms using D3.js force simulation
 * and custom algorithms for hierarchical and layered layouts.
 */

import * as d3 from 'd3';
import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  LayoutType,
  ArchitectureLayer,
  PerformanceConfig
} from '../types';

// =============================================
// LAYOUT ENGINE CONFIGURATION
// =============================================

interface LayoutConfig {
  algorithm: LayoutType;
  animate: boolean;
  performance: PerformanceConfig;
  options?: Record<string, unknown>;
}

interface LayoutConstraints {
  width: number;
  height: number;
  layers?: ArchitectureLayer[];
  preserveAspectRatio?: boolean;
  minNodeDistance?: number;
  maxNodeDistance?: number;
}

interface LayoutResult {
  nodes: ServiceTopologyNode[];
  edges: ServiceTopologyEdge[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  metadata: {
    algorithm: LayoutType;
    duration: number;
    iterations: number;
    converged: boolean;
  };
}

// =============================================
// LAYOUT ENGINE CLASS
// =============================================

export class LayoutEngine {
  private config: LayoutConfig;
  private simulation?: d3.Simulation<d3.SimulationNodeDatum, undefined>;
  private layerMap: Map<ArchitectureLayer, number>;
  
  constructor(config: LayoutConfig) {
    this.config = config;
    this.layerMap = new Map([
      [ArchitectureLayer.PRESENTATION, 0],
      [ArchitectureLayer.APPLICATION, 1],
      [ArchitectureLayer.BUSINESS, 2],
      [ArchitectureLayer.PERSISTENCE, 3],
      [ArchitectureLayer.DATABASE, 4],
      [ArchitectureLayer.INFRASTRUCTURE, 5],
      [ArchitectureLayer.NETWORK, 6],
      [ArchitectureLayer.SECURITY, 7],
      [ArchitectureLayer.MONITORING, 8]
    ]);
  }
  
  // =============================================
  // PUBLIC API
  // =============================================
  
  async calculateLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    const startTime = performance.now();
    
    try {
      let result: LayoutResult;
      
      switch (this.config.algorithm) {
        case 'hierarchical':
          result = await this.calculateHierarchicalLayout(nodes, edges, constraints);
          break;
        case 'force-directed':
          result = await this.calculateForceDirectedLayout(nodes, edges, constraints);
          break;
        case 'circular':
          result = await this.calculateCircularLayout(nodes, edges, constraints);
          break;
        case 'layered':
          result = await this.calculateLayeredLayout(nodes, edges, constraints);
          break;
        case 'grid':
          result = await this.calculateGridLayout(nodes, edges, constraints);
          break;
        case 'tree':
          result = await this.calculateTreeLayout(nodes, edges, constraints);
          break;
        case 'organic':
          result = await this.calculateOrganicLayout(nodes, edges, constraints);
          break;
        default:
          result = await this.calculateForceDirectedLayout(nodes, edges, constraints);
      }
      
      const duration = performance.now() - startTime;
      result.metadata.duration = duration;
      
      return result;
    } catch (error) {
      console.error('Layout calculation failed:', error);
      throw error;
    }
  }
  
  // =============================================
  // HIERARCHICAL LAYOUT
  // =============================================
  
  private async calculateHierarchicalLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    const { width, height } = constraints;
    
    // Create hierarchy from dependency relationships
    const hierarchy = this.buildHierarchy(nodes, edges);
    const root = d3.hierarchy(hierarchy);
    
    // Calculate tree layout
    const treeLayout = d3.tree<any>()
      .size([width - 100, height - 100])
      .separation((a, b) => {
        const aNode = a.data.node as ServiceTopologyNode;
        const bNode = b.data.node as ServiceTopologyNode;
        
        // Increase separation for different types
        const baseDistance = aNode.type === bNode.type ? 1 : 1.5;
        
        // Adjust for criticality
        const criticalityMultiplier = 
          (aNode.data.criticality === 'critical' || bNode.data.criticality === 'critical') ? 1.2 : 1;
        
        return baseDistance * criticalityMultiplier;
      });
    
    const treeData = treeLayout(root);
    
    // Map tree positions back to nodes
    const positionedNodes = nodes.map(node => {
      const treeNode = this.findNodeInTree(treeData, node.id);
      
      return {
        ...node,
        position: {
          x: treeNode ? treeNode.x + 50 : Math.random() * width,
          y: treeNode ? treeNode.y + 50 : Math.random() * height
        }
      };
    });
    
    // Calculate bounds
    const bounds = this.calculateBounds(positionedNodes);
    
    return {
      nodes: positionedNodes,
      edges,
      bounds,
      metadata: {
        algorithm: 'hierarchical',
        duration: 0,
        iterations: 1,
        converged: true
      }
    };
  }
  
  // =============================================
  // FORCE-DIRECTED LAYOUT
  // =============================================
  
  private async calculateForceDirectedLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    return new Promise((resolve, reject) => {
      const { width, height } = constraints;
      
      // Convert to D3 format
      const d3Nodes = nodes.map(node => ({
        ...node,
        x: node.position.x || Math.random() * width,
        y: node.position.y || Math.random() * height
      }));
      
      const d3Links = edges.map(edge => ({
        ...edge,
        source: edge.source,
        target: edge.target
      }));
      
      // Create simulation
      this.simulation = d3.forceSimulation(d3Nodes)
        .force('link', d3.forceLink(d3Links)
          .id((d: any) => d.id)
          .distance(this.calculateLinkDistance)
          .strength(this.calculateLinkStrength)
        )
        .force('charge', d3.forceManyBody()
          .strength(this.calculateChargeStrength)
          .distanceMax(300)
        )
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide()
          .radius(this.calculateCollisionRadius)
        )
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));
      
      // Add layer constraints if specified
      if (constraints.layers) {
        this.simulation.force('layer', this.createLayerForce(constraints.layers, height));
      }
      
      let iterations = 0;
      const maxIterations = this.config.performance.maxVisibleNodes > 200 ? 200 : 300;
      
      this.simulation
        .alpha(0.3)
        .alphaDecay(0.02)
        .on('tick', () => {
          iterations++;
        })
        .on('end', () => {
          const positionedNodes = d3Nodes.map(d3Node => {
            const originalNode = nodes.find(n => n.id === d3Node.id)!;
            return {
              ...originalNode,
              position: { x: d3Node.x || 0, y: d3Node.y || 0 }
            };
          });
          
          const bounds = this.calculateBounds(positionedNodes);
          
          resolve({
            nodes: positionedNodes,
            edges,
            bounds,
            metadata: {
              algorithm: 'force-directed',
              duration: 0,
              iterations,
              converged: this.simulation!.alpha() < this.simulation!.alphaMin()
            }
          });
        });
      
      // Set timeout to prevent infinite simulation
      setTimeout(() => {
        if (this.simulation) {
          this.simulation.stop();
        }
      }, 5000);
    });
  }
  
  // =============================================
  // CIRCULAR LAYOUT
  // =============================================
  
  private async calculateCircularLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    const { width, height } = constraints;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.4;
    
    // Group nodes by type for concentric circles
    const nodesByType = this.groupNodesByType(nodes);
    const types = Object.keys(nodesByType);
    
    let positionedNodes: ServiceTopologyNode[] = [];
    
    types.forEach((type, typeIndex) => {
      const typeNodes = nodesByType[type];
      const typeRadius = radius * (0.5 + (typeIndex * 0.3));
      const angleStep = (2 * Math.PI) / typeNodes.length;
      
      typeNodes.forEach((node, nodeIndex) => {
        const angle = nodeIndex * angleStep;
        const x = center.x + Math.cos(angle) * typeRadius;
        const y = center.y + Math.sin(angle) * typeRadius;
        
        positionedNodes.push({
          ...node,
          position: { x, y }
        });
      });
    });
    
    const bounds = this.calculateBounds(positionedNodes);
    
    return {
      nodes: positionedNodes,
      edges,
      bounds,
      metadata: {
        algorithm: 'circular',
        duration: 0,
        iterations: 1,
        converged: true
      }
    };
  }
  
  // =============================================
  // LAYERED LAYOUT
  // =============================================
  
  private async calculateLayeredLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    const { width, height, layers = [] } = constraints;
    
    // Group nodes by architecture layer
    const nodesByLayer = new Map<ArchitectureLayer, ServiceTopologyNode[]>();
    
    layers.forEach(layer => {
      nodesByLayer.set(layer, []);
    });
    
    nodes.forEach(node => {
      const layer = node.data.layer;
      if (nodesByLayer.has(layer)) {
        nodesByLayer.get(layer)!.push(node);
      } else {
        // Default to application layer if not specified
        if (!nodesByLayer.has(ArchitectureLayer.APPLICATION)) {
          nodesByLayer.set(ArchitectureLayer.APPLICATION, []);
        }
        nodesByLayer.get(ArchitectureLayer.APPLICATION)!.push(node);
      }
    });
    
    const layerHeight = height / (layers.length || 1);
    let positionedNodes: ServiceTopologyNode[] = [];
    
    Array.from(nodesByLayer.entries()).forEach(([layer, layerNodes], layerIndex) => {
      const y = layerIndex * layerHeight + layerHeight / 2;
      const nodesInLayer = layerNodes.length;
      
      if (nodesInLayer === 0) return;
      
      const nodeWidth = width / (nodesInLayer + 1);
      
      layerNodes.forEach((node, nodeIndex) => {
        const x = (nodeIndex + 1) * nodeWidth;
        
        positionedNodes.push({
          ...node,
          position: { x, y }
        });
      });
    });
    
    const bounds = this.calculateBounds(positionedNodes);
    
    return {
      nodes: positionedNodes,
      edges,
      bounds,
      metadata: {
        algorithm: 'layered',
        duration: 0,
        iterations: 1,
        converged: true
      }
    };
  }
  
  // =============================================
  // GRID LAYOUT
  // =============================================
  
  private async calculateGridLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    const { width, height } = constraints;
    const nodeCount = nodes.length;
    
    // Calculate optimal grid dimensions
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const rows = Math.ceil(nodeCount / cols);
    
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    
    const positionedNodes = nodes.map((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = col * cellWidth + cellWidth / 2;
      const y = row * cellHeight + cellHeight / 2;
      
      return {
        ...node,
        position: { x, y }
      };
    });
    
    const bounds = this.calculateBounds(positionedNodes);
    
    return {
      nodes: positionedNodes,
      edges,
      bounds,
      metadata: {
        algorithm: 'grid',
        duration: 0,
        iterations: 1,
        converged: true
      }
    };
  }
  
  // =============================================
  // TREE LAYOUT
  // =============================================
  
  private async calculateTreeLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set<string>();
    edges.forEach(edge => hasIncoming.add(edge.target));
    const rootNodes = nodes.filter(node => !hasIncoming.has(node.id));
    
    if (rootNodes.length === 0) {
      // Fallback to force-directed if no clear hierarchy
      return this.calculateForceDirectedLayout(nodes, edges, constraints);
    }
    
    // Use the first root node for tree layout
    const root = this.buildTreeFromNode(nodes, edges, rootNodes[0].id);
    
    const { width, height } = constraints;
    const treeLayout = d3.tree()
      .size([width - 100, height - 100]);
    
    const treeData = treeLayout(d3.hierarchy(root));
    
    const positionedNodes = nodes.map(node => {
      const treeNode = this.findNodeInTree(treeData, node.id);
      
      return {
        ...node,
        position: {
          x: treeNode ? treeNode.x + 50 : Math.random() * width,
          y: treeNode ? treeNode.y + 50 : Math.random() * height
        }
      };
    });
    
    const bounds = this.calculateBounds(positionedNodes);
    
    return {
      nodes: positionedNodes,
      edges,
      bounds,
      metadata: {
        algorithm: 'tree',
        duration: 0,
        iterations: 1,
        converged: true
      }
    };
  }
  
  // =============================================
  // ORGANIC LAYOUT
  // =============================================
  
  private async calculateOrganicLayout(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    constraints: LayoutConstraints
  ): Promise<LayoutResult> {
    // Organic layout is similar to force-directed but with different parameters
    // that create more natural, organic-looking clusters
    
    const { width, height } = constraints;
    
    return new Promise((resolve, reject) => {
      const d3Nodes = nodes.map(node => ({
        ...node,
        x: node.position.x || Math.random() * width,
        y: node.position.y || Math.random() * height
      }));
      
      const d3Links = edges.map(edge => ({
        ...edge,
        source: edge.source,
        target: edge.target
      }));
      
      // Create organic simulation with cluster-friendly forces
      this.simulation = d3.forceSimulation(d3Nodes)
        .force('link', d3.forceLink(d3Links)
          .id((d: any) => d.id)
          .distance(80)
          .strength(0.3)
        )
        .force('charge', d3.forceManyBody()
          .strength(-200)
          .distanceMax(200)
        )
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide()
          .radius((d: any) => this.getNodeRadius(d) + 20)
        )
        // Add clustering force based on node types
        .force('cluster', this.createClusteringForce(nodes));
      
      let iterations = 0;
      const maxIterations = 400;
      
      this.simulation
        .alpha(0.5)
        .alphaDecay(0.01)
        .on('end', () => {
          const positionedNodes = d3Nodes.map(d3Node => {
            const originalNode = nodes.find(n => n.id === d3Node.id)!;
            return {
              ...originalNode,
              position: { x: d3Node.x || 0, y: d3Node.y || 0 }
            };
          });
          
          const bounds = this.calculateBounds(positionedNodes);
          
          resolve({
            nodes: positionedNodes,
            edges,
            bounds,
            metadata: {
              algorithm: 'organic',
              duration: 0,
              iterations,
              converged: this.simulation!.alpha() < this.simulation!.alphaMin()
            }
          });
        });
      
      setTimeout(() => {
        if (this.simulation) {
          this.simulation.stop();
        }
      }, 8000);
    });
  }
  
  // =============================================
  // HELPER METHODS
  // =============================================
  
  private buildHierarchy(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[]
  ): any {
    // Build a simple hierarchy based on dependencies
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const children = new Map<string, string[]>();
    const parents = new Map<string, string>();
    
    edges.forEach(edge => {
      if (edge.data.relation === 'dependsOn') {
        if (!children.has(edge.target)) {
          children.set(edge.target, []);
        }
        children.get(edge.target)!.push(edge.source);
        parents.set(edge.source, edge.target);
      }
    });
    
    // Find root nodes (no parents)
    const roots = nodes.filter(n => !parents.has(n.id));
    
    const buildTree = (nodeId: string): any => {
      const node = nodeMap.get(nodeId);
      const nodeChildren = children.get(nodeId) || [];
      
      return {
        id: nodeId,
        node,
        children: nodeChildren.map(buildTree)
      };
    };
    
    return {
      id: 'root',
      children: roots.map(r => buildTree(r.id))
    };
  }
  
  private findNodeInTree(treeNode: any, nodeId: string): any {
    if (treeNode.data?.id === nodeId) return treeNode;
    if (treeNode.children) {
      for (const child of treeNode.children) {
        const found = this.findNodeInTree(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }
  
  private buildTreeFromNode(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[],
    rootId: string
  ): any {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const childrenMap = new Map<string, string[]>();
    
    edges.forEach(edge => {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    });
    
    const buildTree = (nodeId: string, visited = new Set<string>()): any => {
      if (visited.has(nodeId)) return null; // Prevent cycles
      visited.add(nodeId);
      
      const node = nodeMap.get(nodeId);
      const children = (childrenMap.get(nodeId) || [])
        .map(childId => buildTree(childId, new Set(visited)))
        .filter(Boolean);
      
      return {
        id: nodeId,
        node,
        children
      };
    };
    
    return buildTree(rootId);
  }
  
  private groupNodesByType(nodes: ServiceTopologyNode[]): Record<string, ServiceTopologyNode[]> {
    const groups: Record<string, ServiceTopologyNode[]> = {};
    
    nodes.forEach(node => {
      if (!groups[node.type]) {
        groups[node.type] = [];
      }
      groups[node.type].push(node);
    });
    
    return groups;
  }
  
  private calculateLinkDistance = (d: any): number => {
    const edge = d as ServiceTopologyEdge;
    const baseDistance = 100;
    
    // Adjust distance based on edge type
    const typeMultiplier = {
      'dependency': 1.2,
      'api-call': 1.0,
      'data-flow': 1.3,
      'ownership': 0.8,
      'group': 0.6
    }[edge.type] || 1.0;
    
    return baseDistance * typeMultiplier;
  };
  
  private calculateLinkStrength = (d: any): number => {
    const edge = d as ServiceTopologyEdge;
    const baseStrength = 0.5;
    
    // Stronger connections for ownership and grouping
    const typeMultiplier = {
      'dependency': 0.8,
      'api-call': 1.0,
      'data-flow': 0.9,
      'ownership': 1.2,
      'group': 1.5
    }[edge.type] || 1.0;
    
    return baseStrength * typeMultiplier;
  };
  
  private calculateChargeStrength = (d: any): number => {
    const node = d as ServiceTopologyNode;
    const baseStrength = -300;
    
    // More repulsion for critical services
    const criticalityMultiplier = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.2,
      'critical': 1.5
    }[node.data.criticality] || 1.0;
    
    return baseStrength * criticalityMultiplier;
  };
  
  private calculateCollisionRadius = (d: any): number => {
    const node = d as ServiceTopologyNode;
    const baseRadius = 30;
    
    const sizeMultiplier = {
      'small': 0.8,
      'medium': 1.0,
      'large': 1.3
    }[node.data.size] || 1.0;
    
    return baseRadius * sizeMultiplier;
  };
  
  private getNodeRadius = (node: ServiceTopologyNode): number => {
    const baseRadius = 20;
    const sizeMultiplier = {
      'small': 0.8,
      'medium': 1.0,
      'large': 1.3
    }[node.data.size] || 1.0;
    
    return baseRadius * sizeMultiplier;
  };
  
  private createLayerForce(layers: ArchitectureLayer[], height: number) {
    const layerHeight = height / layers.length;
    
    return (alpha: number) => {
      return (nodes: any[]) => {
        nodes.forEach((node: any) => {
          const serviceNode = node as ServiceTopologyNode;
          const layerIndex = this.layerMap.get(serviceNode.data.layer) || 0;
          const targetY = layerIndex * layerHeight + layerHeight / 2;
          
          node.vy += (targetY - node.y) * alpha * 0.1;
        });
      };
    };
  }
  
  private createClusteringForce(nodes: ServiceTopologyNode[]) {
    const clusters = new Map<string, { x: number; y: number; count: number }>();
    
    // Calculate cluster centers by node type
    nodes.forEach(node => {
      if (!clusters.has(node.type)) {
        clusters.set(node.type, { x: 0, y: 0, count: 0 });
      }
      const cluster = clusters.get(node.type)!;
      cluster.x += node.position.x;
      cluster.y += node.position.y;
      cluster.count++;
    });
    
    // Normalize cluster centers
    clusters.forEach(cluster => {
      cluster.x /= cluster.count;
      cluster.y /= cluster.count;
    });
    
    return (alpha: number) => {
      return (d3Nodes: any[]) => {
        d3Nodes.forEach((d3Node: any) => {
          const serviceNode = d3Node as ServiceTopologyNode;
          const cluster = clusters.get(serviceNode.type);
          
          if (cluster) {
            const dx = cluster.x - d3Node.x;
            const dy = cluster.y - d3Node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              const force = alpha * 0.02;
              d3Node.vx += dx * force;
              d3Node.vy += dy * force;
            }
          }
        });
      };
    };
  }
  
  private calculateBounds(nodes: ServiceTopologyNode[]) {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = nodes[0].position.x;
    let minY = nodes[0].position.y;
    let maxX = nodes[0].position.x;
    let maxY = nodes[0].position.y;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    });
    
    return { minX, minY, maxX, maxY };
  }
  
  // =============================================
  // CLEANUP
  // =============================================
  
  public destroy(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = undefined;
    }
  }
}