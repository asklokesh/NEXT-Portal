/**
 * Dependency Analyzer
 * 
 * Analyzes and constructs dependency graphs, detects circular dependencies,
 * and provides impact analysis for service relationships.
 */

import { EventEmitter } from 'events';
import {
  TransformedEntityData,
  EntityRelationship,
} from '../types';

interface DependencyNode {
  entityRef: string;
  entity: TransformedEntityData;
  dependencies: Set<string>;
  dependents: Set<string>;
  depth: number;
  criticality: number;
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: EntityRelationship[];
  roots: Set<string>;
  leaves: Set<string>;
  cycles: string[][];
  layers: string[][];
}

interface ImpactAnalysis {
  entityRef: string;
  directImpact: string[];
  indirectImpact: string[];
  impactRadius: number;
  criticalityScore: number;
  affectedServices: number;
}

export class DependencyAnalyzer extends EventEmitter {
  private graph: DependencyGraph;
  
  constructor() {
    super();
    this.graph = {
      nodes: new Map(),
      edges: [],
      roots: new Set(),
      leaves: new Set(),
      cycles: [],
      layers: [],
    };
  }

  /**
   * Build dependency graph from entities and relationships
   */
  buildGraph(entities: TransformedEntityData[], relationships: EntityRelationship[]): DependencyGraph {
    this.emit('graphBuildStarted', { entityCount: entities.length, relationshipCount: relationships.length });
    
    // Initialize nodes
    this.graph.nodes.clear();
    for (const entity of entities) {
      const node: DependencyNode = {
        entityRef: entity.entityRef,
        entity,
        dependencies: new Set(),
        dependents: new Set(),
        depth: 0,
        criticality: 0,
      };
      this.graph.nodes.set(entity.entityRef, node);
    }

    // Add edges and build dependency relationships
    this.graph.edges = relationships.filter(rel => 
      this.isDependencyRelationship(rel.type)
    );

    for (const relationship of this.graph.edges) {
      const sourceNode = this.graph.nodes.get(relationship.sourceRef);
      const targetNode = this.graph.nodes.get(relationship.targetRef);
      
      if (sourceNode && targetNode) {
        if (relationship.type === 'dependsOn') {
          sourceNode.dependencies.add(relationship.targetRef);
          targetNode.dependents.add(relationship.sourceRef);
        } else if (relationship.type === 'consumesApi') {
          sourceNode.dependencies.add(relationship.targetRef);
          targetNode.dependents.add(relationship.sourceRef);
        }
      }
    }

    // Calculate derived properties
    this.calculateDepth();
    this.findRootsAndLeaves();
    this.detectCycles();
    this.calculateCriticality();
    this.createLayers();

    this.emit('graphBuildCompleted', {
      nodes: this.graph.nodes.size,
      edges: this.graph.edges.length,
      roots: this.graph.roots.size,
      leaves: this.graph.leaves.size,
      cycles: this.graph.cycles.length,
    });

    return { ...this.graph };
  }

  /**
   * Perform impact analysis for a given entity
   */
  analyzeImpact(entityRef: string): ImpactAnalysis {
    const node = this.graph.nodes.get(entityRef);
    if (!node) {
      throw new Error(`Entity ${entityRef} not found in dependency graph`);
    }

    const directImpact = Array.from(node.dependents);
    const indirectImpact = this.findIndirectDependents(entityRef);
    const allImpacted = new Set([...directImpact, ...indirectImpact]);

    const analysis: ImpactAnalysis = {
      entityRef,
      directImpact,
      indirectImpact,
      impactRadius: Math.max(...Array.from(allImpacted).map(ref => 
        this.calculateDistance(entityRef, ref)
      )),
      criticalityScore: node.criticality,
      affectedServices: allImpacted.size,
    };

    this.emit('impactAnalysisCompleted', analysis);
    return analysis;
  }

  /**
   * Find path between two entities
   */
  findPath(sourceRef: string, targetRef: string): string[] | null {
    const visited = new Set<string>();
    const queue: { ref: string; path: string[] }[] = [{ ref: sourceRef, path: [sourceRef] }];

    while (queue.length > 0) {
      const { ref, path } = queue.shift()!;
      
      if (ref === targetRef) {
        return path;
      }
      
      if (visited.has(ref)) {
        continue;
      }
      
      visited.add(ref);
      
      const node = this.graph.nodes.get(ref);
      if (node) {
        for (const dependency of node.dependencies) {
          if (!visited.has(dependency)) {
            queue.push({ ref: dependency, path: [...path, dependency] });
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Find all paths between two entities (up to max depth)
   */
  findAllPaths(sourceRef: string, targetRef: string, maxDepth: number = 10): string[][] {
    const paths: string[][] = [];
    
    const findPathsRecursive = (currentRef: string, target: string, path: string[], visited: Set<string>, depth: number) => {
      if (depth > maxDepth) {
        return;
      }
      
      if (currentRef === target) {
        paths.push([...path]);
        return;
      }
      
      if (visited.has(currentRef)) {
        return;
      }
      
      visited.add(currentRef);
      
      const node = this.graph.nodes.get(currentRef);
      if (node) {
        for (const dependency of node.dependencies) {
          findPathsRecursive(dependency, target, [...path, dependency], new Set(visited), depth + 1);
        }
      }
      
      visited.delete(currentRef);
    };
    
    findPathsRecursive(sourceRef, targetRef, [sourceRef], new Set(), 0);
    return paths;
  }

  /**
   * Get strongly connected components (cycles)
   */
  getStronglyConnectedComponents(): string[][] {
    return this.graph.cycles;
  }

  /**
   * Get topological ordering
   */
  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];
    
    const visit = (nodeRef: string) => {
      if (visited.has(nodeRef)) {
        return;
      }
      
      visited.add(nodeRef);
      const node = this.graph.nodes.get(nodeRef);
      
      if (node) {
        for (const dependency of node.dependencies) {
          visit(dependency);
        }
      }
      
      stack.push(nodeRef);
    };
    
    for (const nodeRef of this.graph.nodes.keys()) {
      if (!visited.has(nodeRef)) {
        visit(nodeRef);
      }
    }
    
    return stack.reverse();
  }

  /**
   * Calculate metrics for the entire graph
   */
  calculateGraphMetrics(): {
    totalNodes: number;
    totalEdges: number;
    averageDependencies: number;
    averageDependents: number;
    maxDepth: number;
    cyclomaticComplexity: number;
    criticalNodes: string[];
  } {
    const nodes = Array.from(this.graph.nodes.values());
    
    const totalDependencies = nodes.reduce((sum, node) => sum + node.dependencies.size, 0);
    const totalDependents = nodes.reduce((sum, node) => sum + node.dependents.size, 0);
    
    const maxDepth = Math.max(...nodes.map(node => node.depth));
    
    // Nodes with high criticality (top 10%)
    const sortedByCriticality = nodes.sort((a, b) => b.criticality - a.criticality);
    const criticalNodeCount = Math.max(1, Math.floor(nodes.length * 0.1));
    const criticalNodes = sortedByCriticality
      .slice(0, criticalNodeCount)
      .map(node => node.entityRef);

    return {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.length,
      averageDependencies: totalDependencies / this.graph.nodes.size,
      averageDependents: totalDependents / this.graph.nodes.size,
      maxDepth,
      cyclomaticComplexity: this.graph.edges.length - this.graph.nodes.size + 2,
      criticalNodes,
    };
  }

  /**
   * Check if relationship type represents a dependency
   */
  private isDependencyRelationship(type: EntityRelationship['type']): boolean {
    return ['dependsOn', 'consumesApi', 'deployedOn'].includes(type);
  }

  /**
   * Calculate depth of each node from root nodes
   */
  private calculateDepth(): void {
    const visited = new Set<string>();
    
    const calculateDepthRecursive = (nodeRef: string, depth: number) => {
      if (visited.has(nodeRef)) {
        return;
      }
      
      visited.add(nodeRef);
      const node = this.graph.nodes.get(nodeRef);
      
      if (node) {
        node.depth = Math.max(node.depth, depth);
        
        for (const dependent of node.dependents) {
          calculateDepthRecursive(dependent, depth + 1);
        }
      }
    };
    
    // Start from nodes with no dependencies (roots)
    for (const node of this.graph.nodes.values()) {
      if (node.dependencies.size === 0) {
        calculateDepthRecursive(node.entityRef, 0);
      }
    }
  }

  /**
   * Find root and leaf nodes
   */
  private findRootsAndLeaves(): void {
    this.graph.roots.clear();
    this.graph.leaves.clear();
    
    for (const node of this.graph.nodes.values()) {
      if (node.dependencies.size === 0) {
        this.graph.roots.add(node.entityRef);
      }
      
      if (node.dependents.size === 0) {
        this.graph.leaves.add(node.entityRef);
      }
    }
  }

  /**
   * Detect cycles using Tarjan's algorithm
   */
  private detectCycles(): void {
    const index = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;
    
    this.graph.cycles = [];

    const strongConnect = (nodeRef: string) => {
      index.set(nodeRef, currentIndex);
      lowLink.set(nodeRef, currentIndex);
      currentIndex++;
      stack.push(nodeRef);
      onStack.add(nodeRef);

      const node = this.graph.nodes.get(nodeRef);
      if (node) {
        for (const dependency of node.dependencies) {
          if (!index.has(dependency)) {
            strongConnect(dependency);
            lowLink.set(nodeRef, Math.min(lowLink.get(nodeRef)!, lowLink.get(dependency)!));
          } else if (onStack.has(dependency)) {
            lowLink.set(nodeRef, Math.min(lowLink.get(nodeRef)!, index.get(dependency)!));
          }
        }
      }

      if (lowLink.get(nodeRef) === index.get(nodeRef)) {
        const component: string[] = [];
        let w: string;
        
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== nodeRef);

        if (component.length > 1) {
          this.graph.cycles.push(component);
        }
      }
    };

    for (const nodeRef of this.graph.nodes.keys()) {
      if (!index.has(nodeRef)) {
        strongConnect(nodeRef);
      }
    }
  }

  /**
   * Calculate criticality score for each node
   */
  private calculateCriticality(): void {
    for (const node of this.graph.nodes.values()) {
      // Base score on number of dependents
      let criticalityScore = node.dependents.size * 10;
      
      // Add bonus for depth (deeper nodes are more critical)
      criticalityScore += node.depth * 5;
      
      // Add penalty if part of a cycle
      const inCycle = this.graph.cycles.some(cycle => cycle.includes(node.entityRef));
      if (inCycle) {
        criticalityScore += 20;
      }
      
      // Add bonus for high fan-out (dependencies)
      criticalityScore += Math.min(node.dependencies.size * 2, 20);
      
      node.criticality = criticalityScore;
    }
  }

  /**
   * Create layered representation of the graph
   */
  private createLayers(): void {
    const maxDepth = Math.max(...Array.from(this.graph.nodes.values()).map(node => node.depth));
    this.graph.layers = Array.from({ length: maxDepth + 1 }, () => []);
    
    for (const node of this.graph.nodes.values()) {
      this.graph.layers[node.depth].push(node.entityRef);
    }
  }

  /**
   * Find indirect dependents recursively
   */
  private findIndirectDependents(entityRef: string, visited = new Set<string>()): string[] {
    if (visited.has(entityRef)) {
      return [];
    }
    
    visited.add(entityRef);
    const indirectDependents = new Set<string>();
    const node = this.graph.nodes.get(entityRef);
    
    if (node) {
      for (const dependent of node.dependents) {
        const subDependents = this.findIndirectDependents(dependent, new Set(visited));
        for (const subDependent of subDependents) {
          indirectDependents.add(subDependent);
        }
      }
    }
    
    return Array.from(indirectDependents);
  }

  /**
   * Calculate distance between two nodes
   */
  private calculateDistance(sourceRef: string, targetRef: string): number {
    const path = this.findPath(sourceRef, targetRef);
    return path ? path.length - 1 : Infinity;
  }
}

export default DependencyAnalyzer;