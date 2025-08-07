/**
 * Plugin Registry Integration System
 * 
 * Comprehensive plugin registry management with automated package scanning,
 * dependency resolution, compatibility validation, and quality assurance
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as semver from 'semver';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import * as tar from 'tar';
import * as yaml from 'yaml';
import { 
  PluginDefinition, 
  PluginCategory,
  PluginDependency,
  SecurityScanResult
} from '../types/plugin-types';
import { SecurityScanner } from './security-scanner';

export interface RegistryConfig {
  registries: PluginRegistrySource[];
  caching: CacheConfig;
  validation: ValidationConfig;
  publishing: PublishingConfig;
}

export interface PluginRegistrySource {
  name: string;
  type: 'npm' | 'docker' | 'git' | 'oci' | 'backstage-marketplace';
  url: string;
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
  };
  enabled: boolean;
  priority: number;
  scanFrequency: string; // cron expression
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // bytes
  storage: 'memory' | 'redis' | 'file';
  storageConfig?: any;
}

export interface ValidationConfig {
  schemaValidation: boolean;
  securityScanning: boolean;
  compatibilityChecks: boolean;
  qualityGates: QualityGate[];
}

export interface PublishingConfig {
  allowedPublishers: string[];
  requireApproval: boolean;
  autoPublish: boolean;
  versioningPolicy: 'strict' | 'flexible';
}

export interface QualityGate {
  name: string;
  type: 'security' | 'performance' | 'compatibility' | 'documentation' | 'testing';
  threshold: number;
  blocking: boolean;
  automated: boolean;
}

export interface PluginPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  author: string;
  maintainers: string[];
  repository: string;
  homepage: string;
  license: string;
  keywords: string[];
  
  // Technical metadata
  definition: PluginDefinition;
  manifest: PluginManifest;
  
  // Registry metadata
  registrySource: string;
  publishedAt: Date;
  updatedAt: Date;
  downloads: number;
  rating: number;
  reviewCount: number;
  
  // Validation status
  validated: boolean;
  validationResults: ValidationResult[];
  securityScan?: SecurityScanResult;
  
  // Quality metrics
  qualityScore: number;
  qualityMetrics: QualityMetrics;
  
  // Dependencies and compatibility
  dependencies: PluginDependency[];
  peerDependencies: PluginDependency[];
  backstageVersion: string;
  nodeVersion: string;
  
  // Distribution
  dist: {
    tarball: string;
    shasum: string;
    integrity: string;
    unpackedSize: number;
  };
}

export interface PluginManifest {
  apiVersion: string;
  kind: 'Plugin';
  metadata: {
    name: string;
    version: string;
    description: string;
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
  };
  spec: PluginDefinition;
}

export interface ValidationResult {
  validator: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  timestamp: Date;
}

export interface QualityMetrics {
  codeQuality: number;
  documentation: number;
  testCoverage: number;
  performance: number;
  security: number;
  maintenance: number;
  popularity: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  conflicts: DependencyConflict[];
}

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  type: 'plugin' | 'package';
}

export interface DependencyEdge {
  from: string;
  to: string;
  constraint: string;
  optional: boolean;
}

export interface DependencyConflict {
  package: string;
  requestedVersions: string[];
  resolvedVersion?: string;
  conflictType: 'version' | 'peer' | 'circular';
}

export interface RegistrySearchQuery {
  text?: string;
  category?: PluginCategory;
  author?: string;
  keywords?: string[];
  minRating?: number;
  compatibility?: {
    backstageVersion?: string;
    nodeVersion?: string;
  };
  sortBy?: 'relevance' | 'downloads' | 'updated' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface RegistrySearchResult {
  packages: PluginPackage[];
  total: number;
  facets: {
    categories: { [key: string]: number };
    authors: { [key: string]: number };
    keywords: { [key: string]: number };
  };
}

export class PluginRegistry extends EventEmitter {
  private logger: Logger;
  private config: RegistryConfig;
  private securityScanner: SecurityScanner;
  
  // Registry storage
  private packageCache: Map<string, PluginPackage> = new Map();
  private dependencyGraph: DependencyGraph = { nodes: [], edges: [], conflicts: [] };
  private searchIndex: Map<string, string[]> = new Map();
  
  // Background tasks
  private scanInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(logger: Logger, config: RegistryConfig, securityScanner: SecurityScanner) {
    super();
    this.logger = logger;
    this.config = config;
    this.securityScanner = securityScanner;
    
    this.initializeRegistry();
  }

  /**
   * Initialize registry system
   */
  private async initializeRegistry(): Promise<void> {
    this.logger.info('Initializing plugin registry system');
    
    try {
      // Load cached packages
      await this.loadCachedPackages();
      
      // Rebuild dependency graph
      await this.rebuildDependencyGraph();
      
      // Start background scanning
      this.startBackgroundScanning();
      
      // Start cache cleanup
      this.startCacheCleanup();
      
      this.logger.info('Plugin registry system initialized successfully');
      
    } catch (error) {
      this.logger.error(`Failed to initialize registry: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan all configured registries for plugins
   */
  async scanRegistries(): Promise<void> {
    this.logger.info('Starting registry scan');
    
    const scanPromises = this.config.registries
      .filter(registry => registry.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(registry => this.scanRegistry(registry));
    
    const results = await Promise.allSettled(scanPromises);
    
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        this.logger.info(`Successfully scanned registry: ${this.config.registries[index].name}`);
      } else {
        errorCount++;
        this.logger.error(`Failed to scan registry ${this.config.registries[index].name}: ${result.reason}`);
      }
    });
    
    this.logger.info(`Registry scan completed: ${successCount} successful, ${errorCount} failed`);
    this.emit('registries-scanned', { successCount, errorCount });
  }

  /**
   * Scan a single registry
   */
  private async scanRegistry(registry: PluginRegistrySource): Promise<void> {
    this.logger.info(`Scanning registry: ${registry.name}`);
    
    try {
      let packages: PluginPackage[] = [];
      
      switch (registry.type) {
        case 'npm':
          packages = await this.scanNpmRegistry(registry);
          break;
        case 'docker':
          packages = await this.scanDockerRegistry(registry);
          break;
        case 'git':
          packages = await this.scanGitRegistry(registry);
          break;
        case 'oci':
          packages = await this.scanOCIRegistry(registry);
          break;
        case 'backstage-marketplace':
          packages = await this.scanBackstageMarketplace(registry);
          break;
      }
      
      // Process discovered packages
      for (const pkg of packages) {
        await this.processPackage(pkg, registry);
      }
      
      this.logger.info(`Scanned ${packages.length} packages from registry: ${registry.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to scan registry ${registry.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan NPM registry for Backstage plugins
   */
  private async scanNpmRegistry(registry: PluginRegistrySource): Promise<PluginPackage[]> {
    const packages: PluginPackage[] = [];
    
    try {
      // Search for Backstage plugins
      const searchUrl = `${registry.url}/-/v1/search?text=keywords:backstage-plugin&size=250`;
      const response = await axios.get(searchUrl, this.getRegistryRequestConfig(registry));
      
      for (const npmPackage of response.data.objects) {
        try {
          const pkg = await this.convertNpmPackageToPlugin(npmPackage.package, registry);
          if (pkg) {
            packages.push(pkg);
          }
        } catch (error) {
          this.logger.warn(`Failed to process NPM package ${npmPackage.package.name}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to scan NPM registry: ${error.message}`);
    }
    
    return packages;
  }

  /**
   * Convert NPM package to plugin package
   */
  private async convertNpmPackageToPlugin(
    npmPackage: any,
    registry: PluginRegistrySource
  ): Promise<PluginPackage | null> {
    try {
      // Fetch detailed package information
      const detailUrl = `${registry.url}/${npmPackage.name}`;
      const detailResponse = await axios.get(detailUrl, this.getRegistryRequestConfig(registry));
      const packageData = detailResponse.data;
      
      // Extract latest version
      const latestVersion = packageData['dist-tags'].latest;
      const versionData = packageData.versions[latestVersion];
      
      // Check if it's a valid Backstage plugin
      if (!this.isBackstagePlugin(versionData)) {
        return null;
      }
      
      // Extract plugin definition
      const definition = await this.extractPluginDefinition(versionData, registry);
      if (!definition) {
        return null;
      }
      
      const pluginPackage: PluginPackage = {
        id: this.generatePackageId(npmPackage.name, latestVersion),
        name: npmPackage.name,
        version: latestVersion,
        description: versionData.description || '',
        category: this.inferCategory(versionData),
        author: this.extractAuthor(versionData),
        maintainers: this.extractMaintainers(versionData),
        repository: this.extractRepository(versionData),
        homepage: versionData.homepage || '',
        license: versionData.license || 'Unknown',
        keywords: versionData.keywords || [],
        
        definition,
        manifest: this.createManifest(definition),
        
        registrySource: registry.name,
        publishedAt: new Date(packageData.time[latestVersion]),
        updatedAt: new Date(packageData.time.modified),
        downloads: await this.getPackageDownloads(npmPackage.name),
        rating: 0, // Would be calculated from reviews
        reviewCount: 0,
        
        validated: false,
        validationResults: [],
        
        qualityScore: 0,
        qualityMetrics: {
          codeQuality: 0,
          documentation: 0,
          testCoverage: 0,
          performance: 0,
          security: 0,
          maintenance: 0,
          popularity: 0
        },
        
        dependencies: this.extractDependencies(versionData),
        peerDependencies: this.extractPeerDependencies(versionData),
        backstageVersion: this.extractBackstageVersion(versionData),
        nodeVersion: versionData.engines?.node || '>=14.0.0',
        
        dist: {
          tarball: versionData.dist.tarball,
          shasum: versionData.dist.shasum,
          integrity: versionData.dist.integrity || '',
          unpackedSize: versionData.dist.unpackedSize || 0
        }
      };
      
      return pluginPackage;
      
    } catch (error) {
      this.logger.warn(`Failed to convert NPM package ${npmPackage.name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Process and validate a plugin package
   */
  private async processPackage(pkg: PluginPackage, registry: PluginRegistrySource): Promise<void> {
    const packageKey = `${pkg.name}@${pkg.version}`;
    
    try {
      // Check if package already exists and is up to date
      const existingPackage = this.packageCache.get(packageKey);
      if (existingPackage && existingPackage.updatedAt >= pkg.updatedAt) {
        return;
      }
      
      // Validate package
      if (this.config.validation.schemaValidation) {
        await this.validatePackageSchema(pkg);
      }
      
      // Perform security scanning
      if (this.config.validation.securityScanning) {
        await this.performSecurityScan(pkg);
      }
      
      // Check compatibility
      if (this.config.validation.compatibilityChecks) {
        await this.checkCompatibility(pkg);
      }
      
      // Run quality gates
      await this.runQualityGates(pkg);
      
      // Calculate quality score
      pkg.qualityScore = this.calculateQualityScore(pkg);
      
      // Cache package
      this.packageCache.set(packageKey, pkg);
      
      // Update search index
      this.updateSearchIndex(pkg);
      
      // Update dependency graph
      this.updateDependencyGraph(pkg);
      
      this.emit('package-processed', { package: pkg, registry: registry.name });
      
    } catch (error) {
      this.logger.error(`Failed to process package ${packageKey}: ${error.message}`);
      this.emit('package-processing-failed', { package: pkg, error });
    }
  }

  /**
   * Search for plugins in the registry
   */
  async searchPlugins(query: RegistrySearchQuery): Promise<RegistrySearchResult> {
    const packages = Array.from(this.packageCache.values());
    let filteredPackages = packages;
    
    // Apply filters
    if (query.text) {
      filteredPackages = this.filterByText(filteredPackages, query.text);
    }
    
    if (query.category) {
      filteredPackages = filteredPackages.filter(pkg => pkg.category === query.category);
    }
    
    if (query.author) {
      filteredPackages = filteredPackages.filter(pkg => 
        pkg.author.toLowerCase().includes(query.author!.toLowerCase())
      );
    }
    
    if (query.keywords && query.keywords.length > 0) {
      filteredPackages = filteredPackages.filter(pkg =>
        query.keywords!.some(keyword => 
          pkg.keywords.some(pkgKeyword => 
            pkgKeyword.toLowerCase().includes(keyword.toLowerCase())
          )
        )
      );
    }
    
    if (query.minRating) {
      filteredPackages = filteredPackages.filter(pkg => pkg.rating >= query.minRating!);
    }
    
    if (query.compatibility?.backstageVersion) {
      filteredPackages = filteredPackages.filter(pkg =>
        semver.satisfies(query.compatibility!.backstageVersion!, pkg.backstageVersion)
      );
    }
    
    // Sort results
    filteredPackages = this.sortPackages(filteredPackages, query.sortBy, query.sortOrder);
    
    // Apply pagination
    const total = filteredPackages.length;
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginatedPackages = filteredPackages.slice(offset, offset + limit);
    
    // Generate facets
    const facets = this.generateFacets(packages);
    
    return {
      packages: paginatedPackages,
      total,
      facets
    };
  }

  /**
   * Get plugin package by name and version
   */
  async getPlugin(name: string, version?: string): Promise<PluginPackage | null> {
    if (version) {
      return this.packageCache.get(`${name}@${version}`) || null;
    }
    
    // Get latest version
    const packages = Array.from(this.packageCache.values())
      .filter(pkg => pkg.name === name)
      .sort((a, b) => semver.rcompare(a.version, b.version));
    
    return packages[0] || null;
  }

  /**
   * Get all versions of a plugin
   */
  async getPluginVersions(name: string): Promise<PluginPackage[]> {
    return Array.from(this.packageCache.values())
      .filter(pkg => pkg.name === name)
      .sort((a, b) => semver.rcompare(a.version, b.version));
  }

  /**
   * Resolve plugin dependencies
   */
  async resolveDependencies(
    pluginName: string,
    version?: string
  ): Promise<{ resolved: PluginPackage[]; conflicts: DependencyConflict[] }> {
    const plugin = await this.getPlugin(pluginName, version);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName}@${version || 'latest'} not found`);
    }
    
    const resolved: PluginPackage[] = [];
    const conflicts: DependencyConflict[] = [];
    const visited = new Set<string>();
    
    await this.resolveDependenciesRecursive(plugin, resolved, conflicts, visited);
    
    return { resolved, conflicts };
  }

  /**
   * Recursively resolve dependencies
   */
  private async resolveDependenciesRecursive(
    plugin: PluginPackage,
    resolved: PluginPackage[],
    conflicts: DependencyConflict[],
    visited: Set<string>
  ): Promise<void> {
    const pluginKey = `${plugin.name}@${plugin.version}`;
    
    if (visited.has(pluginKey)) {
      return; // Avoid circular dependencies
    }
    
    visited.add(pluginKey);
    resolved.push(plugin);
    
    // Process dependencies
    for (const dependency of plugin.dependencies) {
      const depPlugin = await this.resolveBestVersion(dependency.name, dependency.version);
      
      if (!depPlugin) {
        conflicts.push({
          package: dependency.name,
          requestedVersions: [dependency.version],
          conflictType: 'version'
        });
        continue;
      }
      
      await this.resolveDependenciesRecursive(depPlugin, resolved, conflicts, visited);
    }
  }

  /**
   * Resolve best matching version for a dependency
   */
  private async resolveBestVersion(name: string, versionConstraint: string): Promise<PluginPackage | null> {
    const packages = await this.getPluginVersions(name);
    
    for (const pkg of packages) {
      if (semver.satisfies(pkg.version, versionConstraint)) {
        return pkg;
      }
    }
    
    return null;
  }

  /**
   * Check plugin compatibility
   */
  private async checkCompatibility(pkg: PluginPackage): Promise<void> {
    const compatibilityChecks = [
      this.checkBackstageCompatibility(pkg),
      this.checkNodeCompatibility(pkg),
      this.checkDependencyCompatibility(pkg)
    ];
    
    const results = await Promise.allSettled(compatibilityChecks);
    
    results.forEach((result, index) => {
      const checkNames = ['backstage', 'node', 'dependencies'];
      
      if (result.status === 'fulfilled') {
        pkg.validationResults.push({
          validator: `compatibility-${checkNames[index]}`,
          status: 'passed',
          message: `${checkNames[index]} compatibility check passed`,
          timestamp: new Date()
        });
      } else {
        pkg.validationResults.push({
          validator: `compatibility-${checkNames[index]}`,
          status: 'failed',
          message: result.reason.message,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Additional helper methods would be implemented here for:
   * - scanDockerRegistry
   * - scanGitRegistry  
   * - scanOCIRegistry
   * - scanBackstageMarketplace
   * - validatePackageSchema
   * - performSecurityScan
   * - runQualityGates
   * - calculateQualityScore
   * - filterByText
   * - sortPackages
   * - generateFacets
   * - etc.
   */
  
  // Simplified helper methods for key functionality
  
  private isBackstagePlugin(versionData: any): boolean {
    return (
      versionData.keywords?.includes('backstage-plugin') ||
      versionData.keywords?.includes('backstage') ||
      versionData.name.includes('@backstage/') ||
      versionData.dependencies?.['@backstage/core'] ||
      versionData.peerDependencies?.['@backstage/core']
    );
  }

  private inferCategory(versionData: any): PluginCategory {
    const name = versionData.name.toLowerCase();
    const keywords = versionData.keywords?.join(' ').toLowerCase() || '';
    
    if (name.includes('frontend') || keywords.includes('frontend')) return PluginCategory.FRONTEND;
    if (name.includes('backend') || keywords.includes('backend')) return PluginCategory.BACKEND;
    if (name.includes('monitor') || keywords.includes('monitor')) return PluginCategory.MONITORING;
    if (name.includes('security') || keywords.includes('security')) return PluginCategory.SECURITY;
    if (name.includes('ci') || keywords.includes('ci-cd')) return PluginCategory.CI_CD;
    if (name.includes('docs') || keywords.includes('documentation')) return PluginCategory.DOCUMENTATION;
    
    return PluginCategory.INTEGRATION;
  }

  private extractAuthor(versionData: any): string {
    if (typeof versionData.author === 'string') {
      return versionData.author;
    } else if (versionData.author?.name) {
      return versionData.author.name;
    }
    return 'Unknown';
  }

  private extractRepository(versionData: any): string {
    if (typeof versionData.repository === 'string') {
      return versionData.repository;
    } else if (versionData.repository?.url) {
      return versionData.repository.url;
    }
    return '';
  }

  private generatePackageId(name: string, version: string): string {
    return crypto.createHash('sha256').update(`${name}@${version}`).digest('hex').slice(0, 16);
  }

  private getRegistryRequestConfig(registry: PluginRegistrySource): any {
    const config: any = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Plugin-Pipeline-Registry-Scanner/1.0.0'
      }
    };
    
    if (registry.credentials?.token) {
      config.headers.Authorization = `Bearer ${registry.credentials.token}`;
    } else if (registry.credentials?.username && registry.credentials?.password) {
      config.auth = {
        username: registry.credentials.username,
        password: registry.credentials.password
      };
    }
    
    return config;
  }

  private startBackgroundScanning(): void {
    // Start periodic registry scanning
    this.scanInterval = setInterval(async () => {
      try {
        await this.scanRegistries();
      } catch (error) {
        this.logger.error(`Background registry scan failed: ${error.message}`);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  private startCacheCleanup(): void {
    // Clean up cache periodically
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  private cleanupCache(): void {
    if (!this.config.caching.enabled || this.config.caching.maxSize <= 0) {
      return;
    }
    
    const currentSize = this.estimateCacheSize();
    if (currentSize > this.config.caching.maxSize) {
      // Remove oldest entries
      const packages = Array.from(this.packageCache.entries())
        .sort(([, a], [, b]) => a.updatedAt.getTime() - b.updatedAt.getTime());
      
      const toRemove = Math.floor(packages.length * 0.1); // Remove 10%
      for (let i = 0; i < toRemove; i++) {
        this.packageCache.delete(packages[i][0]);
      }
      
      this.logger.info(`Cleaned up cache, removed ${toRemove} packages`);
    }
  }

  private estimateCacheSize(): number {
    // Rough estimation of cache size in bytes
    return this.packageCache.size * 10000; // Assume 10KB per package
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    this.packageCache.clear();
    this.searchIndex.clear();
  }
}