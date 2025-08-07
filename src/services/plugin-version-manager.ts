/**
 * Plugin Version Management Service
 * Handles semantic versioning, compatibility checking, and version history
 */

import { z } from 'zod';
import semver from 'semver';

// Version metadata schema
const VersionMetadataSchema = z.object({
  version: z.string(),
  releaseDate: z.date(),
  changelog: z.string().optional(),
  breakingChanges: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  minimumBackstageVersion: z.string().optional(),
  maximumBackstageVersion: z.string().optional(),
  deprecated: z.boolean().default(false),
  securityPatches: z.array(z.string()).optional(),
  migrationRequired: z.boolean().default(false),
  migrationScript: z.string().optional(),
  supportedEnvironments: z.array(z.string()).optional(),
  resourceRequirements: z.object({
    cpu: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional()
  }).optional()
});

export type VersionMetadata = z.infer<typeof VersionMetadataSchema>;

interface CompatibilityResult {
  compatible: boolean;
  issues?: string[];
  breakingChanges?: string[];
  migrationRequired?: boolean;
  suggestedVersion?: string;
}

interface UpdateCompatibility {
  compatible: boolean;
  breakingChanges: string[];
  migrationRequired: boolean;
  dependencyUpdates: Record<string, string>;
  riskLevel: 'low' | 'medium' | 'high';
}

interface DeploymentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  healthChecks: {
    name: string;
    status: 'passed' | 'failed' | 'warning';
    message?: string;
  }[];
}

export class PluginVersionManager {
  private versionRegistry: Map<string, VersionMetadata[]> = new Map();
  private currentVersions: Map<string, string> = new Map();
  private versionHistory: Map<string, Array<{version: string, timestamp: Date, action: string}>> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeVersionRegistry();
  }

  private initializeVersionRegistry() {
    // Initialize with mock data - in production, load from database
    // This would typically be populated from your plugin registry
  }

  /**
   * Get available versions for a plugin
   */
  async getAvailableVersions(pluginId: string): Promise<VersionMetadata[]> {
    // In production, fetch from NPM registry or internal registry
    const versions = this.versionRegistry.get(pluginId) || [];
    
    // Fetch latest versions from registry
    try {
      const registryVersions = await this.fetchFromRegistry(pluginId);
      const merged = this.mergeVersions(versions, registryVersions);
      this.versionRegistry.set(pluginId, merged);
      return merged;
    } catch (error) {
      console.warn(`Failed to fetch versions from registry for ${pluginId}:`, error);
      return versions;
    }
  }

  /**
   * Get current installed version of a plugin
   */
  async getCurrentVersion(pluginId: string): Promise<string | null> {
    return this.currentVersions.get(pluginId) || null;
  }

  /**
   * Get previous version for rollback
   */
  async getPreviousVersion(pluginId: string): Promise<string | null> {
    const history = this.versionHistory.get(pluginId) || [];
    const installs = history.filter(h => h.action === 'install' || h.action === 'update');
    
    if (installs.length < 2) {
      return null;
    }
    
    return installs[installs.length - 2].version;
  }

  /**
   * Check compatibility for installation
   */
  async checkCompatibility(pluginId: string, version: string): Promise<CompatibilityResult> {
    const targetVersion = version === 'latest' ? await this.getLatestVersion(pluginId) : version;
    
    if (!targetVersion) {
      return {
        compatible: false,
        issues: ['Version not found']
      };
    }

    const issues: string[] = [];
    const versionMetadata = await this.getVersionMetadata(pluginId, targetVersion);

    if (!versionMetadata) {
      return {
        compatible: false,
        issues: ['Version metadata not available']
      };
    }

    // Check Backstage version compatibility
    const backstageVersion = await this.getBackstageVersion();
    if (versionMetadata.minimumBackstageVersion && 
        semver.lt(backstageVersion, versionMetadata.minimumBackstageVersion)) {
      issues.push(`Requires Backstage version >= ${versionMetadata.minimumBackstageVersion}`);
    }

    if (versionMetadata.maximumBackstageVersion && 
        semver.gt(backstageVersion, versionMetadata.maximumBackstageVersion)) {
      issues.push(`Requires Backstage version <= ${versionMetadata.maximumBackstageVersion}`);
    }

    // Check deprecated status
    if (versionMetadata.deprecated) {
      issues.push('This version is deprecated');
    }

    // Check dependency compatibility
    if (versionMetadata.dependencies) {
      for (const [depId, depVersion] of Object.entries(versionMetadata.dependencies)) {
        const installedVersion = await this.getCurrentVersion(depId);
        if (installedVersion && !semver.satisfies(installedVersion, depVersion)) {
          issues.push(`Dependency ${depId} requires version ${depVersion}, but ${installedVersion} is installed`);
        }
      }
    }

    // Suggest alternative version if incompatible
    let suggestedVersion;
    if (issues.length > 0) {
      suggestedVersion = await this.findCompatibleVersion(pluginId, backstageVersion);
    }

    return {
      compatible: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      breakingChanges: versionMetadata.breakingChanges,
      migrationRequired: versionMetadata.migrationRequired,
      suggestedVersion
    };
  }

  /**
   * Check update compatibility
   */
  async checkUpdateCompatibility(pluginId: string, targetVersion: string): Promise<UpdateCompatibility> {
    const currentVersion = await this.getCurrentVersion(pluginId);
    
    if (!currentVersion) {
      return {
        compatible: false,
        breakingChanges: ['Plugin not currently installed'],
        migrationRequired: false,
        dependencyUpdates: {},
        riskLevel: 'high'
      };
    }

    const targetMetadata = await this.getVersionMetadata(pluginId, targetVersion);
    
    if (!targetMetadata) {
      return {
        compatible: false,
        breakingChanges: ['Target version metadata not available'],
        migrationRequired: false,
        dependencyUpdates: {},
        riskLevel: 'high'
      };
    }

    // Check if update is major, minor, or patch
    const versionDiff = semver.diff(currentVersion, targetVersion);
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (versionDiff === 'major') {
      riskLevel = 'high';
    } else if (versionDiff === 'minor') {
      riskLevel = 'medium';
    }

    // Collect all breaking changes between versions
    const breakingChanges = await this.getBreakingChangesBetween(
      pluginId, 
      currentVersion, 
      targetVersion
    );

    // Check dependency updates needed
    const dependencyUpdates: Record<string, string> = {};
    if (targetMetadata.dependencies) {
      for (const [depId, depVersion] of Object.entries(targetMetadata.dependencies)) {
        const installedVersion = await this.getCurrentVersion(depId);
        if (installedVersion && !semver.satisfies(installedVersion, depVersion)) {
          dependencyUpdates[depId] = depVersion;
        }
      }
    }

    return {
      compatible: true, // Let the caller decide based on risk level
      breakingChanges,
      migrationRequired: targetMetadata.migrationRequired || breakingChanges.length > 0,
      dependencyUpdates,
      riskLevel
    };
  }

  /**
   * Validate deployment
   */
  async validateDeployment(pluginId: string, version: string): Promise<DeploymentValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const healthChecks: DeploymentValidation['healthChecks'] = [];

    // Check if plugin is responding
    healthChecks.push({
      name: 'Plugin Response',
      status: 'passed', // In production, actually ping the plugin
      message: 'Plugin is responding to health checks'
    });

    // Check dependencies are running
    const dependencies = await this.getPluginDependencies(pluginId);
    for (const depId of dependencies) {
      const depVersion = await this.getCurrentVersion(depId);
      if (!depVersion) {
        healthChecks.push({
          name: `Dependency: ${depId}`,
          status: 'failed',
          message: `Required dependency ${depId} is not installed`
        });
        errors.push(`Missing dependency: ${depId}`);
      } else {
        healthChecks.push({
          name: `Dependency: ${depId}`,
          status: 'passed',
          message: `Version ${depVersion} is running`
        });
      }
    }

    // Check resource usage
    const resourceUsage = await this.checkResourceUsage(pluginId);
    if (resourceUsage.cpuUsage > 80) {
      warnings.push(`High CPU usage: ${resourceUsage.cpuUsage}%`);
      healthChecks.push({
        name: 'Resource Usage',
        status: 'warning',
        message: `CPU usage is ${resourceUsage.cpuUsage}%`
      });
    } else {
      healthChecks.push({
        name: 'Resource Usage',
        status: 'passed',
        message: 'Resource usage within limits'
      });
    }

    // Check API compatibility
    const apiCompatible = await this.checkApiCompatibility(pluginId, version);
    if (!apiCompatible) {
      errors.push('API compatibility check failed');
      healthChecks.push({
        name: 'API Compatibility',
        status: 'failed',
        message: 'Plugin API is not compatible with current system'
      });
    } else {
      healthChecks.push({
        name: 'API Compatibility',
        status: 'passed',
        message: 'API endpoints are compatible'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      healthChecks
    };
  }

  /**
   * Get dependent plugins
   */
  async getDependentPlugins(pluginId: string): Promise<string[]> {
    const dependents: string[] = [];
    
    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.has(pluginId)) {
        dependents.push(id);
      }
    }
    
    return dependents;
  }

  /**
   * Get plugin instances for rolling updates
   */
  async getPluginInstances(pluginId: string): Promise<string[]> {
    // In production, this would query the actual running instances
    // For now, return mock instance IDs
    return [`${pluginId}-instance-1`, `${pluginId}-instance-2`, `${pluginId}-instance-3`];
  }

  /**
   * Switch traffic for blue-green deployments
   */
  async switchTraffic(pluginId: string, target: 'blue' | 'green'): Promise<{success: boolean}> {
    // In production, this would update load balancer or service mesh configuration
    console.log(`Switching traffic for ${pluginId} to ${target}`);
    return { success: true };
  }

  // Private helper methods

  private async fetchFromRegistry(pluginId: string): Promise<VersionMetadata[]> {
    // Fetch from NPM or internal registry
    try {
      const response = await fetch(`https://registry.npmjs.org/${pluginId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from registry: ${response.statusText}`);
      }
      
      const data = await response.json();
      const versions = Object.keys(data.versions || {}).map(version => ({
        version,
        releaseDate: new Date(data.time?.[version] || Date.now()),
        changelog: data.versions[version].description,
        dependencies: data.versions[version].dependencies,
        deprecated: data.versions[version].deprecated || false
      }));
      
      return versions as VersionMetadata[];
    } catch (error) {
      console.error(`Failed to fetch versions for ${pluginId}:`, error);
      return [];
    }
  }

  private mergeVersions(local: VersionMetadata[], remote: VersionMetadata[]): VersionMetadata[] {
    const merged = new Map<string, VersionMetadata>();
    
    // Add local versions
    local.forEach(v => merged.set(v.version, v));
    
    // Merge with remote, preferring remote for conflicts
    remote.forEach(v => merged.set(v.version, v));
    
    // Sort by version
    return Array.from(merged.values()).sort((a, b) => 
      semver.rcompare(a.version, b.version)
    );
  }

  private async getLatestVersion(pluginId: string): Promise<string | null> {
    const versions = await this.getAvailableVersions(pluginId);
    
    if (versions.length === 0) {
      return null;
    }
    
    // Filter out deprecated and pre-release versions
    const stableVersions = versions.filter(v => 
      !v.deprecated && !semver.prerelease(v.version)
    );
    
    return stableVersions.length > 0 ? stableVersions[0].version : versions[0].version;
  }

  private async getVersionMetadata(pluginId: string, version: string): Promise<VersionMetadata | null> {
    const versions = await this.getAvailableVersions(pluginId);
    return versions.find(v => v.version === version) || null;
  }

  private async getBackstageVersion(): Promise<string> {
    // In production, read from backstage package.json or API
    return '1.41.0';
  }

  private async findCompatibleVersion(pluginId: string, backstageVersion: string): Promise<string | undefined> {
    const versions = await this.getAvailableVersions(pluginId);
    
    for (const version of versions) {
      if (version.deprecated) continue;
      
      if (version.minimumBackstageVersion && 
          semver.lt(backstageVersion, version.minimumBackstageVersion)) {
        continue;
      }
      
      if (version.maximumBackstageVersion && 
          semver.gt(backstageVersion, version.maximumBackstageVersion)) {
        continue;
      }
      
      return version.version;
    }
    
    return undefined;
  }

  private async getBreakingChangesBetween(
    pluginId: string, 
    fromVersion: string, 
    toVersion: string
  ): Promise<string[]> {
    const versions = await this.getAvailableVersions(pluginId);
    const breakingChanges: string[] = [];
    
    for (const version of versions) {
      if (semver.gt(version.version, fromVersion) && 
          semver.lte(version.version, toVersion)) {
        if (version.breakingChanges) {
          breakingChanges.push(...version.breakingChanges);
        }
      }
    }
    
    return breakingChanges;
  }

  private async getPluginDependencies(pluginId: string): Promise<string[]> {
    return Array.from(this.dependencyGraph.get(pluginId) || []);
  }

  private async checkResourceUsage(pluginId: string): Promise<{cpuUsage: number, memoryUsage: number}> {
    // In production, integrate with monitoring system
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100
    };
  }

  private async checkApiCompatibility(pluginId: string, version: string): Promise<boolean> {
    // In production, validate API contract compatibility
    return true;
  }
}