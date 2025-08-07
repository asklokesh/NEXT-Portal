import semver from 'semver';
import crypto from 'crypto';

interface PluginDependency {
  pluginId: string;
  version: string;
  required: boolean;
  type: 'runtime' | 'build' | 'optional';
  scope?: 'frontend' | 'backend' | 'common';
}

interface PluginManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  dependencies: PluginDependency[];
  peerDependencies?: PluginDependency[];
  conflicts?: string[];
  provides?: string[];
  requires?: string[];
  hooks?: {
    preInstall?: string;
    postInstall?: string;
    preUninstall?: string;
    postUninstall?: string;
  };
  compatibility: {
    backstageVersion: string;
    nodeVersion?: string;
    npmVersion?: string;
  };
}

interface DependencyNode {
  plugin: PluginManifest;
  resolved: boolean;
  dependencies: Map<string, DependencyNode>;
  dependents: Set<string>;
  depth: number;
  path: string[];
}

interface ResolutionResult {
  success: boolean;
  installOrder: PluginManifest[];
  graph: Map<string, DependencyNode>;
  conflicts: ConflictInfo[];
  warnings: string[];
  totalSize: number;
  estimatedTime: number;
}

interface ConflictInfo {
  type: 'version' | 'incompatible' | 'circular' | 'missing';
  plugin1: string;
  plugin2?: string;
  message: string;
  resolution?: string;
}

interface PluginRegistry {
  getPlugin(id: string, version?: string): Promise<PluginManifest | null>;
  getVersions(id: string): Promise<string[]>;
  search(query: string): Promise<PluginManifest[]>;
}

export class DependencyResolver {
  private registry: PluginRegistry;
  private installedPlugins: Map<string, PluginManifest>;
  private cache: Map<string, PluginManifest>;
  private maxDepth: number = 10;

  constructor(registry: PluginRegistry) {
    this.registry = registry;
    this.installedPlugins = new Map();
    this.cache = new Map();
  }

  async resolve(
    pluginId: string,
    requestedVersion?: string,
    options: {
      allowPrerelease?: boolean;
      forceUpdate?: boolean;
      dryRun?: boolean;
      maxDepth?: number;
    } = {}
  ): Promise<ResolutionResult> {
    const result: ResolutionResult = {
      success: false,
      installOrder: [],
      graph: new Map(),
      conflicts: [],
      warnings: [],
      totalSize: 0,
      estimatedTime: 0
    };

    try {
      // Get the root plugin
      const rootPlugin = await this.getPluginWithVersion(pluginId, requestedVersion);
      if (!rootPlugin) {
        result.conflicts.push({
          type: 'missing',
          plugin1: pluginId,
          message: `Plugin ${pluginId} not found in registry`
        });
        return result;
      }

      // Check Backstage compatibility
      const compatibilityCheck = this.checkCompatibility(rootPlugin);
      if (!compatibilityCheck.compatible) {
        result.conflicts.push({
          type: 'incompatible',
          plugin1: pluginId,
          message: compatibilityCheck.message || 'Incompatible with current Backstage version'
        });
        return result;
      }

      // Build dependency graph
      const rootNode: DependencyNode = {
        plugin: rootPlugin,
        resolved: false,
        dependencies: new Map(),
        dependents: new Set(),
        depth: 0,
        path: [rootPlugin.id]
      };

      result.graph.set(rootPlugin.id, rootNode);

      // Resolve dependencies recursively
      await this.resolveDependencies(
        rootNode,
        result,
        options.maxDepth || this.maxDepth
      );

      // Check for conflicts
      this.detectConflicts(result);

      // Calculate install order using topological sort
      if (result.conflicts.length === 0) {
        result.installOrder = this.topologicalSort(result.graph);
        result.success = true;
      }

      // Calculate metrics
      result.totalSize = this.calculateTotalSize(result.installOrder);
      result.estimatedTime = this.estimateInstallTime(result.installOrder);

      // Add optimization suggestions
      this.addOptimizationSuggestions(result);

    } catch (error) {
      result.conflicts.push({
        type: 'missing',
        plugin1: pluginId,
        message: error instanceof Error ? error.message : 'Unknown error during resolution'
      });
    }

    return result;
  }

  private async resolveDependencies(
    node: DependencyNode,
    result: ResolutionResult,
    maxDepth: number
  ): Promise<void> {
    if (node.depth >= maxDepth) {
      result.warnings.push(
        `Maximum dependency depth reached for ${node.plugin.id}. Some transitive dependencies may not be resolved.`
      );
      return;
    }

    for (const dep of node.plugin.dependencies) {
      // Skip optional dependencies if they cause issues
      if (dep.type === 'optional') {
        try {
          await this.resolveSingleDependency(node, dep, result, maxDepth);
        } catch {
          result.warnings.push(
            `Optional dependency ${dep.pluginId} for ${node.plugin.id} could not be resolved`
          );
        }
      } else {
        await this.resolveSingleDependency(node, dep, result, maxDepth);
      }
    }

    node.resolved = true;
  }

  private async resolveSingleDependency(
    parentNode: DependencyNode,
    dependency: PluginDependency,
    result: ResolutionResult,
    maxDepth: number
  ): Promise<void> {
    const existingNode = result.graph.get(dependency.pluginId);

    if (existingNode) {
      // Check for circular dependency
      if (this.hasCircularDependency(existingNode, parentNode.plugin.id)) {
        result.conflicts.push({
          type: 'circular',
          plugin1: parentNode.plugin.id,
          plugin2: dependency.pluginId,
          message: `Circular dependency detected between ${parentNode.plugin.id} and ${dependency.pluginId}`
        });
        return;
      }

      // Check version compatibility
      if (!this.isVersionCompatible(existingNode.plugin.version, dependency.version)) {
        result.conflicts.push({
          type: 'version',
          plugin1: parentNode.plugin.id,
          plugin2: dependency.pluginId,
          message: `Version conflict: ${parentNode.plugin.id} requires ${dependency.pluginId}@${dependency.version}, but ${existingNode.plugin.version} is already required`,
          resolution: `Consider updating ${parentNode.plugin.id} or using a compatible version`
        });
        return;
      }

      // Add as dependent
      existingNode.dependents.add(parentNode.plugin.id);
      parentNode.dependencies.set(dependency.pluginId, existingNode);
    } else {
      // Fetch and add new dependency
      const depPlugin = await this.getPluginWithVersion(
        dependency.pluginId,
        dependency.version
      );

      if (!depPlugin) {
        if (dependency.required) {
          result.conflicts.push({
            type: 'missing',
            plugin1: parentNode.plugin.id,
            message: `Required dependency ${dependency.pluginId}@${dependency.version} not found`
          });
        } else {
          result.warnings.push(
            `Optional dependency ${dependency.pluginId}@${dependency.version} for ${parentNode.plugin.id} not found`
          );
        }
        return;
      }

      const depNode: DependencyNode = {
        plugin: depPlugin,
        resolved: false,
        dependencies: new Map(),
        dependents: new Set([parentNode.plugin.id]),
        depth: parentNode.depth + 1,
        path: [...parentNode.path, depPlugin.id]
      };

      result.graph.set(depPlugin.id, depNode);
      parentNode.dependencies.set(dependency.pluginId, depNode);

      // Recursively resolve its dependencies
      await this.resolveDependencies(depNode, result, maxDepth);
    }
  }

  private async getPluginWithVersion(
    pluginId: string,
    versionRange?: string
  ): Promise<PluginManifest | null> {
    const cacheKey = `${pluginId}@${versionRange || 'latest'}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const plugin = await this.registry.getPlugin(pluginId, versionRange);
    
    if (plugin) {
      this.cache.set(cacheKey, plugin);
    }

    return plugin;
  }

  private isVersionCompatible(installed: string, required: string): boolean {
    // Handle special cases
    if (required === '*' || required === 'latest') {
      return true;
    }

    // Check if installed version satisfies the required range
    return semver.satisfies(installed, required);
  }

  private hasCircularDependency(node: DependencyNode, targetId: string): boolean {
    if (node.plugin.id === targetId) {
      return true;
    }

    for (const dep of node.dependencies.values()) {
      if (this.hasCircularDependency(dep, targetId)) {
        return true;
      }
    }

    return false;
  }

  private detectConflicts(result: ResolutionResult): void {
    const plugins = Array.from(result.graph.values());

    // Check for conflicting plugins
    for (const node of plugins) {
      if (node.plugin.conflicts) {
        for (const conflictId of node.plugin.conflicts) {
          if (result.graph.has(conflictId)) {
            result.conflicts.push({
              type: 'incompatible',
              plugin1: node.plugin.id,
              plugin2: conflictId,
              message: `${node.plugin.id} conflicts with ${conflictId}`
            });
          }
        }
      }
    }

    // Check for duplicate providers
    const providers = new Map<string, string[]>();
    for (const node of plugins) {
      if (node.plugin.provides) {
        for (const capability of node.plugin.provides) {
          if (!providers.has(capability)) {
            providers.set(capability, []);
          }
          providers.get(capability)!.push(node.plugin.id);
        }
      }
    }

    // Report duplicate providers as warnings
    for (const [capability, pluginIds] of providers) {
      if (pluginIds.length > 1) {
        result.warnings.push(
          `Multiple plugins provide "${capability}": ${pluginIds.join(', ')}. This may cause conflicts.`
        );
      }
    }

    // Check all requirements are satisfied
    for (const node of plugins) {
      if (node.plugin.requires) {
        for (const requirement of node.plugin.requires) {
          if (!providers.has(requirement)) {
            result.conflicts.push({
              type: 'missing',
              plugin1: node.plugin.id,
              message: `${node.plugin.id} requires capability "${requirement}" which is not provided by any plugin`
            });
          }
        }
      }
    }
  }

  private topologicalSort(graph: Map<string, DependencyNode>): PluginManifest[] {
    const sorted: PluginManifest[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }

      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected at ${nodeId}`);
      }

      visiting.add(nodeId);
      const node = graph.get(nodeId);

      if (node) {
        // Visit dependencies first
        for (const dep of node.dependencies.values()) {
          visit(dep.plugin.id);
        }

        sorted.push(node.plugin);
        visited.add(nodeId);
      }

      visiting.delete(nodeId);
    };

    // Start with nodes that have no dependents (root nodes)
    for (const [nodeId, node] of graph) {
      if (node.dependents.size === 0) {
        visit(nodeId);
      }
    }

    // Visit any remaining nodes (in case of disconnected components)
    for (const nodeId of graph.keys()) {
      visit(nodeId);
    }

    return sorted;
  }

  private checkCompatibility(plugin: PluginManifest): {
    compatible: boolean;
    message?: string;
  } {
    // Check Backstage version compatibility
    const currentBackstageVersion = process.env.BACKSTAGE_VERSION || '1.20.0';
    
    if (!semver.satisfies(currentBackstageVersion, plugin.compatibility.backstageVersion)) {
      return {
        compatible: false,
        message: `Plugin requires Backstage ${plugin.compatibility.backstageVersion}, but current version is ${currentBackstageVersion}`
      };
    }

    // Check Node version if specified
    if (plugin.compatibility.nodeVersion) {
      const currentNodeVersion = process.version;
      if (!semver.satisfies(currentNodeVersion, plugin.compatibility.nodeVersion)) {
        return {
          compatible: false,
          message: `Plugin requires Node ${plugin.compatibility.nodeVersion}, but current version is ${currentNodeVersion}`
        };
      }
    }

    return { compatible: true };
  }

  private calculateTotalSize(plugins: PluginManifest[]): number {
    // Estimate based on number of plugins (in MB)
    // In production, this would fetch actual package sizes
    return plugins.length * 15; // Assume 15MB average per plugin
  }

  private estimateInstallTime(plugins: PluginManifest[]): number {
    // Estimate in seconds
    // Base time + time per plugin + network overhead
    const baseTime = 10;
    const timePerPlugin = 5;
    const networkOverhead = plugins.length * 2;
    
    return baseTime + (plugins.length * timePerPlugin) + networkOverhead;
  }

  private addOptimizationSuggestions(result: ResolutionResult): void {
    // Suggest optimizations based on the dependency graph
    const depths = Array.from(result.graph.values()).map(n => n.depth);
    const maxDepth = Math.max(...depths);

    if (maxDepth > 5) {
      result.warnings.push(
        `Deep dependency tree detected (depth: ${maxDepth}). Consider flattening dependencies for better performance.`
      );
    }

    // Check for heavy dependencies
    const heavyDependencies = result.installOrder.filter(p => 
      p.dependencies.length > 10
    );

    if (heavyDependencies.length > 0) {
      result.warnings.push(
        `Plugins with many dependencies detected: ${heavyDependencies.map(p => p.id).join(', ')}. This may increase install time.`
      );
    }

    // Suggest caching frequently used dependencies
    const dependencyCounts = new Map<string, number>();
    for (const node of result.graph.values()) {
      for (const dep of node.dependencies.keys()) {
        dependencyCounts.set(dep, (dependencyCounts.get(dep) || 0) + 1);
      }
    }

    const commonDeps = Array.from(dependencyCounts.entries())
      .filter(([_, count]) => count > 2)
      .map(([dep]) => dep);

    if (commonDeps.length > 0) {
      result.warnings.push(
        `Common dependencies detected: ${commonDeps.join(', ')}. Consider pre-installing these for faster plugin installation.`
      );
    }
  }

  async validateInstallation(plugins: PluginManifest[]): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if all plugins are compatible with currently installed plugins
    for (const plugin of plugins) {
      // Check conflicts with installed plugins
      for (const [installedId, installed] of this.installedPlugins) {
        if (plugin.conflicts?.includes(installedId)) {
          errors.push(
            `Cannot install ${plugin.id}: conflicts with installed plugin ${installedId}`
          );
        }

        // Check version conflicts
        if (installed.dependencies.some(d => 
          d.pluginId === plugin.id && 
          !this.isVersionCompatible(plugin.version, d.version)
        )) {
          errors.push(
            `Version conflict: ${installedId} requires ${plugin.id}@${installed.dependencies.find(d => d.pluginId === plugin.id)?.version}, but trying to install ${plugin.version}`
          );
        }
      }
    }

    // Validate all requirements will be met
    const allProvides = new Set<string>();
    
    // Add provides from installed plugins
    for (const installed of this.installedPlugins.values()) {
      installed.provides?.forEach(p => allProvides.add(p));
    }
    
    // Add provides from plugins to be installed
    for (const plugin of plugins) {
      plugin.provides?.forEach(p => allProvides.add(p));
    }

    // Check all requirements
    for (const plugin of plugins) {
      if (plugin.requires) {
        for (const req of plugin.requires) {
          if (!allProvides.has(req)) {
            errors.push(
              `${plugin.id} requires "${req}" which is not provided by any installed or installing plugin`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  setInstalledPlugins(plugins: PluginManifest[]): void {
    this.installedPlugins.clear();
    for (const plugin of plugins) {
      this.installedPlugins.set(plugin.id, plugin);
    }
  }

  async findUpgrades(): Promise<Map<string, {
    current: string;
    latest: string;
    compatible: string;
    breaking: boolean;
  }>> {
    const upgrades = new Map();

    for (const [pluginId, installed] of this.installedPlugins) {
      const versions = await this.registry.getVersions(pluginId);
      
      if (versions.length === 0) {
        continue;
      }

      const latest = versions[0]; // Assume sorted descending
      const compatible = versions.find(v => 
        semver.major(v) === semver.major(installed.version)
      ) || latest;

      if (semver.gt(latest, installed.version)) {
        upgrades.set(pluginId, {
          current: installed.version,
          latest,
          compatible,
          breaking: semver.major(latest) > semver.major(installed.version)
        });
      }
    }

    return upgrades;
  }
}

// Mock registry implementation for testing
export class MockPluginRegistry implements PluginRegistry {
  private plugins = new Map<string, PluginManifest[]>();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Add mock plugins
    this.addPlugin({
      id: 'catalog',
      version: '1.0.0',
      name: 'Catalog Plugin',
      description: 'Software catalog management',
      dependencies: [
        {
          pluginId: 'catalog-backend',
          version: '^1.0.0',
          required: true,
          type: 'runtime'
        }
      ],
      provides: ['catalog-api'],
      compatibility: {
        backstageVersion: '>=1.15.0'
      }
    });

    this.addPlugin({
      id: 'catalog-backend',
      version: '1.0.0',
      name: 'Catalog Backend',
      description: 'Backend for catalog plugin',
      dependencies: [
        {
          pluginId: 'database',
          version: '^2.0.0',
          required: true,
          type: 'runtime'
        }
      ],
      provides: ['catalog-backend-api'],
      compatibility: {
        backstageVersion: '>=1.15.0'
      }
    });

    this.addPlugin({
      id: 'database',
      version: '2.0.0',
      name: 'Database Plugin',
      description: 'Database connectivity',
      dependencies: [],
      provides: ['database-api'],
      compatibility: {
        backstageVersion: '>=1.10.0'
      }
    });
  }

  private addPlugin(manifest: PluginManifest): void {
    if (!this.plugins.has(manifest.id)) {
      this.plugins.set(manifest.id, []);
    }
    this.plugins.get(manifest.id)!.push(manifest);
  }

  async getPlugin(id: string, version?: string): Promise<PluginManifest | null> {
    const versions = this.plugins.get(id);
    if (!versions || versions.length === 0) {
      return null;
    }

    if (!version || version === 'latest') {
      return versions[0];
    }

    // Find best matching version
    return versions.find(v => semver.satisfies(v.version, version)) || null;
  }

  async getVersions(id: string): Promise<string[]> {
    const versions = this.plugins.get(id) || [];
    return versions.map(v => v.version).sort((a, b) => semver.rcompare(a, b));
  }

  async search(query: string): Promise<PluginManifest[]> {
    const results: PluginManifest[] = [];
    
    for (const versions of this.plugins.values()) {
      const latest = versions[0];
      if (
        latest.id.includes(query) ||
        latest.name.toLowerCase().includes(query.toLowerCase()) ||
        latest.description.toLowerCase().includes(query.toLowerCase())
      ) {
        results.push(latest);
      }
    }

    return results;
  }
}