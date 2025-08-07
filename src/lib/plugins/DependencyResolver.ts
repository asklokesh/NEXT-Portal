/**
 * Plugin Dependency Resolver
 * 
 * Comprehensive plugin dependency graph analysis and resolution system.
 * Handles version conflicts, circular dependencies, and installation ordering.
 */

import semver from 'semver';
import { Plugin, PluginDependency, DependencyGraph, ResolutionStrategy, ConflictResolution } from './types';

export interface DependencyNode {
  id: string;
  plugin: Plugin;
  dependencies: string[];
  dependents: string[];
  version: string;
  resolved: boolean;
  conflicts: DependencyConflict[];
}

export interface DependencyConflict {
  type: 'version' | 'circular' | 'missing' | 'incompatible';
  pluginId: string;
  conflictWith: string;
  requiredVersion?: string;
  availableVersion?: string;
  severity: 'critical' | 'warning' | 'info';
  suggestions: string[];
}

export interface ResolutionResult {
  resolved: boolean;
  installationOrder: string[];
  conflicts: DependencyConflict[];
  warnings: string[];
  strategy: ResolutionStrategy;
  performance: {
    resolutionTimeMs: number;
    graphComplexity: number;
    nodesProcessed: number;
  };
}

export interface DependencyMatrix {
  [pluginId: string]: {
    [dependencyId: string]: {
      version: string;
      constraint: string;
      optional: boolean;
      conflicts: string[];
    };
  };
}

export class DependencyResolver {
  private graph: Map<string, DependencyNode> = new Map();
  private matrix: DependencyMatrix = {};
  private resolutionCache: Map<string, ResolutionResult> = new Map();

  constructor(
    private plugins: Plugin[] = [],
    private strategy: ResolutionStrategy = 'strict'
  ) {
    this.buildGraph();
  }

  /**
   * Build dependency graph from plugins
   */
  private buildGraph(): void {
    // Initialize nodes
    for (const plugin of this.plugins) {
      const node: DependencyNode = {
        id: plugin.id,
        plugin,
        dependencies: plugin.dependencies?.map(d => d.id) || [],
        dependents: [],
        version: plugin.version,
        resolved: false,
        conflicts: []
      };
      this.graph.set(plugin.id, node);
    }

    // Build dependency relationships
    for (const [pluginId, node] of this.graph.entries()) {
      for (const depId of node.dependencies) {
        const depNode = this.graph.get(depId);
        if (depNode) {
          depNode.dependents.push(pluginId);
        }
      }
    }

    // Build compatibility matrix
    this.buildCompatibilityMatrix();
  }

  /**
   * Build compatibility matrix for efficient conflict detection
   */
  private buildCompatibilityMatrix(): void {
    for (const [pluginId, node] of this.graph.entries()) {
      this.matrix[pluginId] = {};
      
      for (const dependency of node.plugin.dependencies || []) {
        this.matrix[pluginId][dependency.id] = {
          version: dependency.version,
          constraint: dependency.versionConstraint || '^' + dependency.version,
          optional: dependency.optional || false,
          conflicts: []
        };
      }
    }
  }

  /**
   * Resolve all dependencies with conflict detection and resolution
   */
  async resolveDependencies(
    targetPlugins?: string[],
    options: {
      strategy?: ResolutionStrategy;
      autoInstall?: boolean;
      skipOptional?: boolean;
    } = {}
  ): Promise<ResolutionResult> {
    const startTime = Date.now();
    const { strategy = this.strategy, autoInstall = false, skipOptional = false } = options;
    
    const cacheKey = this.getCacheKey(targetPlugins || [], strategy, skipOptional);
    const cached = this.resolutionCache.get(cacheKey);
    if (cached && Date.now() - startTime < 1000) { // 1 second cache
      return cached;
    }

    // Reset resolution state
    for (const node of this.graph.values()) {
      node.resolved = false;
      node.conflicts = [];
    }

    const conflicts: DependencyConflict[] = [];
    const warnings: string[] = [];
    const processedNodes = new Set<string>();

    // Detect conflicts
    await this.detectConflicts(conflicts, warnings);

    // Resolve conflicts based on strategy
    const resolvedConflicts = await this.resolveConflicts(conflicts, strategy);
    
    // Calculate installation order
    const installationOrder = await this.calculateInstallationOrder(
      targetPlugins,
      skipOptional
    );

    // Validate resolution
    const resolved = conflicts.filter(c => c.severity === 'critical').length === 0;

    const result: ResolutionResult = {
      resolved,
      installationOrder,
      conflicts: resolvedConflicts,
      warnings,
      strategy,
      performance: {
        resolutionTimeMs: Date.now() - startTime,
        graphComplexity: this.calculateGraphComplexity(),
        nodesProcessed: processedNodes.size
      }
    };

    // Cache result
    this.resolutionCache.set(cacheKey, result);
    
    // Auto-install if requested and resolution is successful
    if (autoInstall && resolved) {
      await this.autoInstallDependencies(installationOrder);
    }

    return result;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId]);
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      const newPath = [...path, nodeId];

      const node = this.graph.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          dfs(depId, newPath);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Detect version conflicts
   */
  detectVersionConflicts(): DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];
    const versionMap = new Map<string, Set<string>>();

    // Collect all required versions
    for (const [pluginId, node] of this.graph.entries()) {
      for (const dependency of node.plugin.dependencies || []) {
        if (!versionMap.has(dependency.id)) {
          versionMap.set(dependency.id, new Set());
        }
        versionMap.get(dependency.id)!.add(dependency.version);
      }
    }

    // Check for conflicts
    for (const [depId, versions] of versionMap.entries()) {
      if (versions.size > 1) {
        const versionArray = Array.from(versions);
        const conflict: DependencyConflict = {
          type: 'version',
          pluginId: depId,
          conflictWith: versionArray.join(', '),
          severity: this.getConflictSeverity(versionArray),
          suggestions: this.generateVersionSuggestions(versionArray)
        };
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Calculate optimal installation order using topological sort
   */
  private async calculateInstallationOrder(
    targetPlugins?: string[],
    skipOptional: boolean = false
  ): Promise<string[]> {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];
    const processed = new Set<string>();

    // Initialize in-degrees
    for (const [pluginId, node] of this.graph.entries()) {
      const dependencies = skipOptional 
        ? node.dependencies.filter(depId => !this.isOptionalDependency(pluginId, depId))
        : node.dependencies;
      
      inDegree.set(pluginId, dependencies.length);
      
      if (dependencies.length === 0) {
        queue.push(pluginId);
      }
    }

    // Topological sort with priority handling
    while (queue.length > 0) {
      // Sort queue by priority (core plugins first, then by dependency count)
      queue.sort((a, b) => this.getInstallationPriority(b) - this.getInstallationPriority(a));
      
      const current = queue.shift()!;
      if (processed.has(current)) continue;
      
      result.push(current);
      processed.add(current);

      const node = this.graph.get(current);
      if (!node) continue;

      // Update in-degrees of dependents
      for (const dependent of node.dependents) {
        const currentInDegree = inDegree.get(dependent) || 0;
        const newInDegree = currentInDegree - 1;
        inDegree.set(dependent, newInDegree);

        if (newInDegree === 0 && !processed.has(dependent)) {
          queue.push(dependent);
        }
      }
    }

    // Filter by target plugins if specified
    if (targetPlugins && targetPlugins.length > 0) {
      const targetSet = new Set(targetPlugins);
      return result.filter(pluginId => targetSet.has(pluginId));
    }

    return result;
  }

  /**
   * Detect all types of conflicts
   */
  private async detectConflicts(
    conflicts: DependencyConflict[],
    warnings: string[]
  ): Promise<void> {
    // Circular dependencies
    const cycles = this.detectCircularDependencies();
    for (const cycle of cycles) {
      conflicts.push({
        type: 'circular',
        pluginId: cycle[0],
        conflictWith: cycle.slice(1).join(' -> '),
        severity: 'critical',
        suggestions: [
          'Break circular dependency by making one dependency optional',
          'Refactor plugins to remove circular references',
          'Use dependency injection pattern'
        ]
      });
    }

    // Version conflicts
    const versionConflicts = this.detectVersionConflicts();
    conflicts.push(...versionConflicts);

    // Missing dependencies
    for (const [pluginId, node] of this.graph.entries()) {
      for (const depId of node.dependencies) {
        if (!this.graph.has(depId)) {
          conflicts.push({
            type: 'missing',
            pluginId,
            conflictWith: depId,
            severity: this.isOptionalDependency(pluginId, depId) ? 'warning' : 'critical',
            suggestions: [
              `Install missing plugin: ${depId}`,
              'Mark dependency as optional if not critical',
              'Find alternative plugin that provides similar functionality'
            ]
          });
        }
      }
    }

    // Incompatibility conflicts
    await this.detectIncompatibilityConflicts(conflicts);
  }

  /**
   * Detect incompatibility conflicts based on plugin metadata
   */
  private async detectIncompatibilityConflicts(conflicts: DependencyConflict[]): Promise<void> {
    for (const [pluginId, node] of this.graph.entries()) {
      const plugin = node.plugin;
      
      // Check incompatible plugins
      if (plugin.incompatibleWith) {
        for (const incompatibleId of plugin.incompatibleWith) {
          if (this.graph.has(incompatibleId)) {
            conflicts.push({
              type: 'incompatible',
              pluginId,
              conflictWith: incompatibleId,
              severity: 'critical',
              suggestions: [
                `Remove either ${pluginId} or ${incompatibleId}`,
                'Find alternative plugins that are compatible',
                'Check if newer versions resolve the incompatibility'
              ]
            });
          }
        }
      }

      // Check version compatibility
      for (const dependency of plugin.dependencies || []) {
        const depNode = this.graph.get(dependency.id);
        if (depNode && dependency.versionConstraint) {
          if (!semver.satisfies(depNode.version, dependency.versionConstraint)) {
            conflicts.push({
              type: 'version',
              pluginId,
              conflictWith: dependency.id,
              requiredVersion: dependency.versionConstraint,
              availableVersion: depNode.version,
              severity: 'critical',
              suggestions: [
                `Update ${dependency.id} to satisfy constraint: ${dependency.versionConstraint}`,
                `Downgrade ${pluginId} to version compatible with ${depNode.version}`,
                'Check if there are compatible intermediate versions'
              ]
            });
          }
        }
      }
    }
  }

  /**
   * Resolve conflicts based on strategy
   */
  private async resolveConflicts(
    conflicts: DependencyConflict[],
    strategy: ResolutionStrategy
  ): Promise<DependencyConflict[]> {
    const resolvedConflicts: DependencyConflict[] = [];

    for (const conflict of conflicts) {
      let resolved = false;

      switch (strategy) {
        case 'strict':
          // Don't auto-resolve conflicts in strict mode
          break;

        case 'permissive':
          resolved = await this.attemptPermissiveResolution(conflict);
          break;

        case 'latest':
          resolved = await this.attemptLatestVersionResolution(conflict);
          break;

        case 'compatible':
          resolved = await this.attemptCompatibleResolution(conflict);
          break;
      }

      if (!resolved) {
        resolvedConflicts.push(conflict);
      }
    }

    return resolvedConflicts;
  }

  /**
   * Attempt permissive conflict resolution
   */
  private async attemptPermissiveResolution(conflict: DependencyConflict): Promise<boolean> {
    switch (conflict.type) {
      case 'version':
        // Try to find a compatible version range
        return this.resolveVersionConflictPermissive(conflict);
      
      case 'missing':
        // Mark as optional if severity is warning
        return conflict.severity === 'warning';
      
      case 'circular':
        // Attempt to break cycle by marking one dependency as optional
        return this.breakCircularDependency(conflict);
      
      default:
        return false;
    }
  }

  /**
   * Attempt latest version resolution
   */
  private async attemptLatestVersionResolution(conflict: DependencyConflict): Promise<boolean> {
    if (conflict.type === 'version' && conflict.availableVersion && conflict.requiredVersion) {
      // Use latest version that satisfies all constraints
      const plugin = this.graph.get(conflict.conflictWith);
      if (plugin) {
        // This would need integration with a package registry to find the actual latest version
        // For now, we simulate the resolution
        return true;
      }
    }
    return false;
  }

  /**
   * Attempt compatible resolution
   */
  private async attemptCompatibleResolution(conflict: DependencyConflict): Promise<boolean> {
    if (conflict.type === 'version') {
      return this.findCompatibleVersions(conflict);
    }
    return false;
  }

  /**
   * Auto-install dependencies in the correct order
   */
  private async autoInstallDependencies(installationOrder: string[]): Promise<void> {
    // This would integrate with the actual plugin installation system
    console.log('Auto-installing plugins in order:', installationOrder);
    
    for (const pluginId of installationOrder) {
      await this.installPlugin(pluginId);
    }
  }

  /**
   * Install individual plugin
   */
  private async installPlugin(pluginId: string): Promise<void> {
    // Placeholder for actual plugin installation logic
    const plugin = this.graph.get(pluginId)?.plugin;
    if (plugin) {
      console.log(`Installing plugin: ${plugin.name} (${plugin.version})`);
      // Actual installation would happen here
    }
  }

  /**
   * Helper methods
   */
  private getCacheKey(targetPlugins: string[], strategy: ResolutionStrategy, skipOptional: boolean): string {
    return `${targetPlugins.sort().join(',')}:${strategy}:${skipOptional}`;
  }

  private calculateGraphComplexity(): number {
    let complexity = 0;
    for (const node of this.graph.values()) {
      complexity += node.dependencies.length * node.dependents.length;
    }
    return complexity;
  }

  private getConflictSeverity(versions: string[]): 'critical' | 'warning' | 'info' {
    // Check if versions are compatible
    const majorVersions = versions.map(v => semver.major(v));
    const uniqueMajors = new Set(majorVersions);
    
    if (uniqueMajors.size > 1) {
      return 'critical';
    } else if (versions.length > 2) {
      return 'warning';
    }
    return 'info';
  }

  private generateVersionSuggestions(versions: string[]): string[] {
    const suggestions: string[] = [];
    
    // Find compatible range
    const sortedVersions = versions.sort(semver.compare);
    const latest = sortedVersions[sortedVersions.length - 1];
    const earliest = sortedVersions[0];
    
    suggestions.push(`Use latest version: ${latest}`);
    suggestions.push(`Use version range: >=${earliest} <${semver.major(latest) + 1}.0.0`);
    suggestions.push('Check plugin compatibility matrices');
    
    return suggestions;
  }

  private isOptionalDependency(pluginId: string, depId: string): boolean {
    const matrixEntry = this.matrix[pluginId]?.[depId];
    return matrixEntry?.optional || false;
  }

  private getInstallationPriority(pluginId: string): number {
    const node = this.graph.get(pluginId);
    if (!node) return 0;
    
    let priority = 0;
    
    // Core plugins get higher priority
    if (node.plugin.type === 'core') priority += 100;
    
    // Plugins with fewer dependencies get higher priority
    priority += (10 - node.dependencies.length);
    
    // Plugins with more dependents get higher priority
    priority += node.dependents.length;
    
    return priority;
  }

  private resolveVersionConflictPermissive(conflict: DependencyConflict): boolean {
    // Implement permissive version resolution logic
    return conflict.severity !== 'critical';
  }

  private breakCircularDependency(conflict: DependencyConflict): boolean {
    // Implement circular dependency breaking logic
    return false; // Would need more sophisticated implementation
  }

  private findCompatibleVersions(conflict: DependencyConflict): boolean {
    // Implement compatible version finding logic
    return true; // Simplified for now
  }

  /**
   * Public API methods
   */

  /**
   * Add plugin to graph
   */
  addPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
    this.buildGraph();
    this.resolutionCache.clear();
  }

  /**
   * Remove plugin from graph
   */
  removePlugin(pluginId: string): void {
    this.plugins = this.plugins.filter(p => p.id !== pluginId);
    this.graph.delete(pluginId);
    this.buildGraph();
    this.resolutionCache.clear();
  }

  /**
   * Get dependency graph visualization data
   */
  getGraphVisualization(): DependencyGraph {
    const nodes = Array.from(this.graph.values()).map(node => ({
      id: node.id,
      label: node.plugin.name,
      version: node.version,
      type: node.plugin.type || 'extension',
      resolved: node.resolved,
      conflicts: node.conflicts.length
    }));

    const edges: Array<{ source: string; target: string; type: string }> = [];
    for (const [pluginId, node] of this.graph.entries()) {
      for (const depId of node.dependencies) {
        edges.push({
          source: pluginId,
          target: depId,
          type: this.isOptionalDependency(pluginId, depId) ? 'optional' : 'required'
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Get resolution strategies available
   */
  getAvailableStrategies(): ResolutionStrategy[] {
    return ['strict', 'permissive', 'latest', 'compatible'];
  }

  /**
   * Clear resolution cache
   */
  clearCache(): void {
    this.resolutionCache.clear();
  }
}

export default DependencyResolver;