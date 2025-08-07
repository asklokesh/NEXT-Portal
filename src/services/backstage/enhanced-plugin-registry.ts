// Enhanced Backstage Plugin Registry Service
// Comprehensive integration with Backstage.io plugin registry and marketplace ecosystem
// Supports NPM registry, GitHub API, custom registries, and enterprise proxy configurations

import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import semver from 'semver';
import { createHash } from 'crypto';

// Enhanced plugin metadata schema with comprehensive registry support
export const EnhancedBackstagePluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  version: z.string(),
  latestVersion: z.string().optional(),
  author: z.string(),
  maintainers: z.array(z.string()).optional(),
  repository: z.string().optional(),
  homepage: z.string().optional(),
  npm: z.string().optional(),
  github: z.string().optional(),
  category: z.enum([
    'core',
    'ci-cd',
    'monitoring',
    'security',
    'infrastructure',
    'analytics',
    'documentation',
    'testing',
    'user-experience',
    'cost-management',
    'observability',
    'data',
    'productivity',
    'compliance',
    'development-tools',
    'ai-ml',
    'storage',
    'messaging'
  ]),
  subcategory: z.string().optional(),
  tags: z.array(z.string()),
  downloads: z.number().optional(),
  weeklyDownloads: z.number().optional(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  issues: z.number().optional(),
  lastUpdated: z.string().optional(),
  createdAt: z.string().optional(),
  installed: z.boolean().optional(),
  enabled: z.boolean().optional(),
  configurable: z.boolean().optional(),
  documentation: z.string().optional(),
  readme: z.string().optional(),
  changelog: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  peerDependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  configSchema: z.any().optional(),
  compatibility: z.object({
    backstageVersion: z.string().optional(),
    nodeVersion: z.string().optional(),
    npmVersion: z.string().optional(),
    platforms: z.array(z.string()).optional()
  }).optional(),
  permissions: z.array(z.string()).optional(),
  apiEndpoints: z.array(z.string()).optional(),
  frontendComponents: z.array(z.string()).optional(),
  backendServices: z.array(z.string()).optional(),
  license: z.string().optional(),
  security: z.object({
    vulnerabilities: z.number().optional(),
    lastScan: z.string().optional(),
    trusted: z.boolean().optional(),
    signature: z.string().optional()
  }).optional(),
  quality: z.object({
    score: z.number().optional(),
    coverage: z.number().optional(),
    maintainability: z.string().optional(),
    reliability: z.string().optional()
  }).optional(),
  popularity: z.object({
    score: z.number().optional(),
    trending: z.boolean().optional(),
    communityRating: z.number().optional(),
    endorsements: z.number().optional()
  }).optional(),
  registryMetadata: z.object({
    source: z.enum(['npm', 'github', 'backstage-official', 'community', 'enterprise']),
    verified: z.boolean().optional(),
    featured: z.boolean().optional(),
    deprecated: z.boolean().optional(),
    experimental: z.boolean().optional()
  }).optional()
});

export type EnhancedBackstagePlugin = z.infer<typeof EnhancedBackstagePluginSchema>;

// Registry configuration
export interface RegistryConfig {
  npm: {
    registry: string;
    timeout: number;
    rateLimit: number;
    token?: string;
  };
  github: {
    token?: string;
    baseUrl: string;
    timeout: number;
    rateLimit: number;
  };
  backstage: {
    officialRegistryUrl: string;
    communityRegistryUrl?: string;
  };
  enterprise: {
    registryUrl?: string;
    token?: string;
    proxy?: {
      host: string;
      port: number;
      auth?: { username: string; password: string };
    };
  };
  cache: {
    ttl: number;
    maxSize: number;
    persistToDisk: boolean;
  };
}

// Plugin discovery filters
export interface PluginDiscoveryFilters {
  category?: string;
  tags?: string[];
  author?: string;
  minStars?: number;
  minDownloads?: number;
  compatibility?: {
    backstageVersion?: string;
    nodeVersion?: string;
  };
  security?: {
    maxVulnerabilities?: number;
    requireTrusted?: boolean;
  };
  quality?: {
    minScore?: number;
    requireMaintained?: boolean;
  };
}

// Installation progress callback
export interface InstallationProgress {
  stage: 'downloading' | 'validating' | 'installing' | 'configuring' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: any;
  error?: Error;
}

// Plugin compatibility check result
export interface CompatibilityCheck {
  compatible: boolean;
  issues: {
    type: 'version' | 'dependency' | 'platform' | 'security';
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }[];
  recommendations: string[];
}

// Enhanced Plugin Registry Service
export class EnhancedPluginRegistryService {
  private config: RegistryConfig;
  private npmClient: AxiosInstance;
  private githubClient: Octokit;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private rateLimiters: Map<string, { requests: number; resetTime: number }> = new Map();

  constructor(config?: Partial<RegistryConfig>) {
    this.config = this.mergeConfig(config);
    this.initializeClients();
  }

  // 1. REGISTRY CLIENT INITIALIZATION
  private mergeConfig(userConfig?: Partial<RegistryConfig>): RegistryConfig {
    return {
      npm: {
        registry: 'https://registry.npmjs.org',
        timeout: 30000,
        rateLimit: 100, // requests per minute
        ...userConfig?.npm
      },
      github: {
        baseUrl: 'https://api.github.com',
        timeout: 30000,
        rateLimit: 60, // requests per hour for unauthenticated
        ...userConfig?.github
      },
      backstage: {
        officialRegistryUrl: 'https://backstage.io/api/plugins',
        ...userConfig?.backstage
      },
      enterprise: {
        ...userConfig?.enterprise
      },
      cache: {
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        persistToDisk: true,
        ...userConfig?.cache
      }
    };
  }

  private initializeClients(): void {
    // NPM Registry Client
    this.npmClient = axios.create({
      baseURL: this.config.npm.registry,
      timeout: this.config.npm.timeout,
      ...this.getProxyConfig()
    });

    // GitHub API Client
    this.githubClient = new Octokit({
      auth: this.config.github.token,
      baseUrl: this.config.github.baseUrl,
      request: {
        timeout: this.config.github.timeout,
        ...this.getProxyConfig()
      }
    });

    // Add rate limiting interceptors
    this.setupRateLimiting();
  }

  private getProxyConfig(): any {
    if (!this.config.enterprise.proxy) return {};
    
    const { host, port, auth } = this.config.enterprise.proxy;
    return {
      proxy: {
        host,
        port,
        auth: auth ? { username: auth.username, password: auth.password } : undefined
      }
    };
  }

  private setupRateLimiting(): void {
    // NPM rate limiting
    this.npmClient.interceptors.request.use(async (config) => {
      await this.checkRateLimit('npm', this.config.npm.rateLimit, 60000);
      return config;
    });

    // GitHub rate limiting
    this.githubClient.hook.before('request', async (options) => {
      const limit = this.config.github.token ? 5000 : 60;
      await this.checkRateLimit('github', limit, 3600000);
    });
  }

  private async checkRateLimit(service: string, limit: number, window: number): Promise<void> {
    const now = Date.now();
    const limiter = this.rateLimiters.get(service) || { requests: 0, resetTime: now + window };

    if (now > limiter.resetTime) {
      limiter.requests = 0;
      limiter.resetTime = now + window;
    }

    if (limiter.requests >= limit) {
      const waitTime = limiter.resetTime - now;
      throw new Error(`Rate limit exceeded for ${service}. Retry in ${Math.ceil(waitTime / 1000)}s`);
    }

    limiter.requests++;
    this.rateLimiters.set(service, limiter);
  }

  // 2. PLUGIN DISCOVERY ENGINE
  async discoverPlugins(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    const cacheKey = `discover-${JSON.stringify(filters)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const plugins = await Promise.allSettled([
      this.discoverFromNPM(filters),
      this.discoverFromGitHub(filters),
      this.discoverFromBackstageOfficial(filters),
      this.discoverFromCommunityRegistry(filters),
      this.discoverFromEnterpriseRegistry(filters)
    ]);

    const allPlugins = plugins
      .filter((result): result is PromiseFulfilledResult<EnhancedBackstagePlugin[]> => 
        result.status === 'fulfilled'
      )
      .flatMap(result => result.value);

    // Deduplicate and enrich
    const uniquePlugins = this.deduplicatePlugins(allPlugins);
    const enrichedPlugins = await this.enrichPluginMetadata(uniquePlugins);
    const rankedPlugins = this.rankPluginsByPopularity(enrichedPlugins);

    this.setCache(cacheKey, rankedPlugins);
    return rankedPlugins;
  }

  private async discoverFromNPM(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    try {
      const searchQuery = this.buildNPMSearchQuery(filters);
      const response = await this.npmClient.get(`/-/v1/search?text=${searchQuery}&size=250`);
      
      return await Promise.all(
        response.data.objects
          .filter((pkg: any) => pkg.package.name.includes('@backstage/plugin-'))
          .map((pkg: any) => this.convertNPMPackageToPlugin(pkg))
      );
    } catch (error) {
      console.warn('Failed to discover plugins from NPM:', error);
      return [];
    }
  }

  private async discoverFromGitHub(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    try {
      const query = this.buildGitHubSearchQuery(filters);
      const response = await this.githubClient.rest.search.repos({
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: 100
      });

      return await Promise.all(
        response.data.items.map(repo => this.convertGitHubRepoToPlugin(repo))
      );
    } catch (error) {
      console.warn('Failed to discover plugins from GitHub:', error);
      return [];
    }
  }

  private async discoverFromBackstageOfficial(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    try {
      const response = await axios.get(this.config.backstage.officialRegistryUrl, {
        timeout: this.config.npm.timeout,
        params: filters
      });
      return response.data.plugins || [];
    } catch (error) {
      console.warn('Failed to discover plugins from Backstage official registry:', error);
      return [];
    }
  }

  private async discoverFromCommunityRegistry(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    if (!this.config.backstage.communityRegistryUrl) return [];
    
    try {
      const response = await axios.get(this.config.backstage.communityRegistryUrl, {
        timeout: this.config.npm.timeout,
        params: filters
      });
      return response.data.plugins || [];
    } catch (error) {
      console.warn('Failed to discover plugins from community registry:', error);
      return [];
    }
  }

  private async discoverFromEnterpriseRegistry(filters?: PluginDiscoveryFilters): Promise<EnhancedBackstagePlugin[]> {
    if (!this.config.enterprise.registryUrl) return [];
    
    try {
      const response = await axios.get(this.config.enterprise.registryUrl, {
        timeout: this.config.npm.timeout,
        headers: this.config.enterprise.token ? {
          'Authorization': `Bearer ${this.config.enterprise.token}`
        } : {},
        params: filters
      });
      return response.data.plugins || [];
    } catch (error) {
      console.warn('Failed to discover plugins from enterprise registry:', error);
      return [];
    }
  }

  // 3. COMPATIBILITY VALIDATION SYSTEM
  async validateCompatibility(plugin: EnhancedBackstagePlugin, targetEnvironment?: {
    backstageVersion?: string;
    nodeVersion?: string;
    npmVersion?: string;
    platform?: string;
  }): Promise<CompatibilityCheck> {
    const issues: CompatibilityCheck['issues'] = [];
    const recommendations: string[] = [];

    // Check Backstage version compatibility
    if (plugin.compatibility?.backstageVersion && targetEnvironment?.backstageVersion) {
      if (!semver.satisfies(targetEnvironment.backstageVersion, plugin.compatibility.backstageVersion)) {
        issues.push({
          type: 'version',
          severity: 'error',
          message: `Backstage version ${targetEnvironment.backstageVersion} is not compatible with plugin requirement ${plugin.compatibility.backstageVersion}`,
          suggestion: `Upgrade Backstage to ${plugin.compatibility.backstageVersion}`
        });
      }
    }

    // Check Node.js version compatibility
    if (plugin.compatibility?.nodeVersion && targetEnvironment?.nodeVersion) {
      if (!semver.satisfies(targetEnvironment.nodeVersion, plugin.compatibility.nodeVersion)) {
        issues.push({
          type: 'version',
          severity: 'error',
          message: `Node.js version ${targetEnvironment.nodeVersion} is not compatible with plugin requirement ${plugin.compatibility.nodeVersion}`,
          suggestion: `Upgrade Node.js to ${plugin.compatibility.nodeVersion}`
        });
      }
    }

    // Check dependencies
    if (plugin.dependencies) {
      const depIssues = await this.validateDependencies(plugin.dependencies);
      issues.push(...depIssues);
    }

    // Check security vulnerabilities
    if (plugin.security?.vulnerabilities && plugin.security.vulnerabilities > 0) {
      issues.push({
        type: 'security',
        severity: plugin.security.vulnerabilities > 5 ? 'error' : 'warning',
        message: `Plugin has ${plugin.security.vulnerabilities} known security vulnerabilities`,
        suggestion: 'Review security report before installing'
      });
    }

    // Check if plugin is deprecated
    if (plugin.registryMetadata?.deprecated) {
      issues.push({
        type: 'dependency',
        severity: 'warning',
        message: 'This plugin is deprecated and may not receive updates',
        suggestion: 'Consider finding an alternative plugin'
      });
    }

    // Generate recommendations
    if (plugin.popularity?.score && plugin.popularity.score > 0.8) {
      recommendations.push('This is a highly popular plugin with good community support');
    }

    if (plugin.registryMetadata?.verified) {
      recommendations.push('This plugin is verified by the Backstage team');
    }

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      recommendations
    };
  }

  private async validateDependencies(dependencies: string[]): Promise<CompatibilityCheck['issues']> {
    const issues: CompatibilityCheck['issues'] = [];
    
    for (const dep of dependencies) {
      try {
        const response = await this.npmClient.get(`/${dep}`);
        const packageData = response.data;
        
        if (packageData.deprecated) {
          issues.push({
            type: 'dependency',
            severity: 'warning',
            message: `Dependency ${dep} is deprecated`,
            suggestion: 'Check if plugin has been updated to use alternatives'
          });
        }
      } catch (error) {
        issues.push({
          type: 'dependency',
          severity: 'error',
          message: `Dependency ${dep} not found in registry`,
          suggestion: 'Verify dependency name and availability'
        });
      }
    }

    return issues;
  }

  // 4. PLUGIN METADATA ENRICHMENT
  private async enrichPluginMetadata(plugins: EnhancedBackstagePlugin[]): Promise<EnhancedBackstagePlugin[]> {
    return await Promise.all(
      plugins.map(async (plugin) => {
        try {
          const [readmeContent, securityScan, qualityMetrics] = await Promise.allSettled([
            this.fetchReadmeContent(plugin),
            this.performSecurityScan(plugin),
            this.calculateQualityMetrics(plugin)
          ]);

          return {
            ...plugin,
            readme: readmeContent.status === 'fulfilled' ? readmeContent.value : undefined,
            security: securityScan.status === 'fulfilled' ? securityScan.value : plugin.security,
            quality: qualityMetrics.status === 'fulfilled' ? qualityMetrics.value : plugin.quality
          };
        } catch (error) {
          console.warn(`Failed to enrich metadata for plugin ${plugin.id}:`, error);
          return plugin;
        }
      })
    );
  }

  private async fetchReadmeContent(plugin: EnhancedBackstagePlugin): Promise<string | undefined> {
    if (!plugin.repository) return undefined;

    try {
      const repoMatch = plugin.repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) return undefined;

      const [, owner, repo] = repoMatch;
      const response = await this.githubClient.rest.repos.getReadme({
        owner,
        repo: repo.replace('.git', '')
      });

      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
    } catch (error) {
      console.warn(`Failed to fetch README for ${plugin.id}:`, error);
    }

    return undefined;
  }

  private async performSecurityScan(plugin: EnhancedBackstagePlugin): Promise<EnhancedBackstagePlugin['security']> {
    try {
      // Simulate security scan - in production, integrate with tools like Snyk, npm audit, etc.
      const response = await this.npmClient.get(`/${plugin.name}/latest`);
      const auditResponse = await axios.post('https://registry.npmjs.org/-/npm/v1/security/audits', {
        name: plugin.name,
        version: plugin.version
      }).catch(() => null);

      const vulnerabilities = auditResponse?.data?.vulnerabilities?.length || 0;
      
      return {
        vulnerabilities,
        lastScan: new Date().toISOString(),
        trusted: vulnerabilities === 0 && plugin.registryMetadata?.verified,
        signature: this.generatePluginSignature(plugin)
      };
    } catch (error) {
      return plugin.security;
    }
  }

  private async calculateQualityMetrics(plugin: EnhancedBackstagePlugin): Promise<EnhancedBackstagePlugin['quality']> {
    try {
      let score = 0;
      
      // Base score from popularity
      if (plugin.stars) score += Math.min(plugin.stars / 1000, 0.3);
      if (plugin.downloads) score += Math.min(plugin.downloads / 10000, 0.3);
      
      // Documentation quality
      if (plugin.readme && plugin.readme.length > 500) score += 0.2;
      if (plugin.documentation) score += 0.1;
      
      // Maintenance indicators
      const lastUpdate = plugin.lastUpdated ? new Date(plugin.lastUpdated) : null;
      if (lastUpdate && Date.now() - lastUpdate.getTime() < 90 * 24 * 60 * 60 * 1000) {
        score += 0.1; // Updated within 3 months
      }

      return {
        score: Math.min(score, 1),
        maintainability: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
        reliability: plugin.security?.vulnerabilities === 0 ? 'high' : 'medium'
      };
    } catch (error) {
      return plugin.quality;
    }
  }

  // 5. REGISTRY SYNCHRONIZATION
  async syncRegistries(): Promise<void> {
    const syncTasks = [
      this.syncNPMRegistry(),
      this.syncGitHubRegistry(),
      this.syncBackstageOfficial(),
      this.syncCommunityRegistry(),
      this.syncEnterpriseRegistry()
    ];

    const results = await Promise.allSettled(syncTasks);
    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      console.warn(`Registry sync completed with ${failures.length} failures`);
    }
  }

  private async syncNPMRegistry(): Promise<void> {
    // Implement incremental sync logic
    console.log('Syncing NPM registry...');
  }

  private async syncGitHubRegistry(): Promise<void> {
    // Implement GitHub repository sync
    console.log('Syncing GitHub registry...');
  }

  private async syncBackstageOfficial(): Promise<void> {
    // Sync with official Backstage registry
    console.log('Syncing Backstage official registry...');
  }

  private async syncCommunityRegistry(): Promise<void> {
    if (!this.config.backstage.communityRegistryUrl) return;
    console.log('Syncing community registry...');
  }

  private async syncEnterpriseRegistry(): Promise<void> {
    if (!this.config.enterprise.registryUrl) return;
    console.log('Syncing enterprise registry...');
  }

  // 6. INSTALLATION INTEGRATION
  async installPlugin(
    plugin: EnhancedBackstagePlugin,
    onProgress?: (progress: InstallationProgress) => void
  ): Promise<void> {
    const stages: InstallationProgress['stage'][] = [
      'downloading', 'validating', 'installing', 'configuring', 'verifying'
    ];

    try {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const progress = ((i + 1) / stages.length) * 100;

        onProgress?.({
          stage,
          progress,
          message: `${stage.charAt(0).toUpperCase() + stage.slice(1)} plugin...`,
          details: { plugin: plugin.name, stage }
        });

        await this.executeInstallationStage(plugin, stage);
      }

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Plugin installed successfully',
        details: { plugin: plugin.name }
      });

    } catch (error) {
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: error as Error
      });
      throw error;
    }
  }

  private async executeInstallationStage(
    plugin: EnhancedBackstagePlugin, 
    stage: InstallationProgress['stage']
  ): Promise<void> {
    switch (stage) {
      case 'downloading':
        await this.downloadPlugin(plugin);
        break;
      case 'validating':
        await this.validatePlugin(plugin);
        break;
      case 'installing':
        await this.installPluginFiles(plugin);
        break;
      case 'configuring':
        await this.configurePlugin(plugin);
        break;
      case 'verifying':
        await this.verifyInstallation(plugin);
        break;
    }
  }

  // Helper methods for plugin management
  private buildNPMSearchQuery(filters?: PluginDiscoveryFilters): string {
    let query = 'scope:backstage plugin';
    
    if (filters?.category) {
      query += ` keywords:${filters.category}`;
    }
    
    if (filters?.tags?.length) {
      query += ` ${filters.tags.map(tag => `keywords:${tag}`).join(' ')}`;
    }
    
    return encodeURIComponent(query);
  }

  private buildGitHubSearchQuery(filters?: PluginDiscoveryFilters): string {
    let query = 'backstage plugin in:readme,description';
    
    if (filters?.category) {
      query += ` ${filters.category}`;
    }
    
    if (filters?.minStars) {
      query += ` stars:>=${filters.minStars}`;
    }
    
    return query;
  }

  private async convertNPMPackageToPlugin(pkg: any): Promise<EnhancedBackstagePlugin> {
    const packageInfo = pkg.package;
    
    return {
      id: this.extractPluginId(packageInfo.name),
      name: packageInfo.name,
      title: this.formatPluginTitle(packageInfo.name),
      description: packageInfo.description || 'No description available',
      version: packageInfo.version,
      author: typeof packageInfo.author === 'object' ? packageInfo.author.name : packageInfo.author || 'Unknown',
      repository: packageInfo.links?.repository,
      homepage: packageInfo.links?.homepage,
      npm: packageInfo.links?.npm,
      category: this.categorizePlugin(packageInfo.name, packageInfo.keywords || []),
      tags: packageInfo.keywords || [],
      downloads: pkg.downloads?.weekly,
      weeklyDownloads: pkg.downloads?.weekly,
      stars: pkg.score?.detail?.popularity ? Math.round(pkg.score.detail.popularity * 1000) : 0,
      lastUpdated: packageInfo.date,
      license: packageInfo.license,
      dependencies: packageInfo.dependencies ? Object.keys(packageInfo.dependencies) : [],
      registryMetadata: {
        source: 'npm',
        verified: packageInfo.publisher?.username === 'backstage-service'
      }
    };
  }

  private async convertGitHubRepoToPlugin(repo: any): Promise<EnhancedBackstagePlugin> {
    return {
      id: this.extractPluginId(repo.name),
      name: repo.full_name,
      title: this.formatPluginTitle(repo.name),
      description: repo.description || 'No description available',
      version: '0.0.0', // Will be updated from package.json
      author: repo.owner.login,
      repository: repo.html_url,
      homepage: repo.homepage,
      github: repo.html_url,
      category: this.categorizePlugin(repo.name, repo.topics || []),
      tags: repo.topics || [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      issues: repo.open_issues_count,
      lastUpdated: repo.updated_at,
      createdAt: repo.created_at,
      license: repo.license?.name,
      registryMetadata: {
        source: 'github',
        verified: repo.owner.login === 'backstage'
      }
    };
  }

  private deduplicatePlugins(plugins: EnhancedBackstagePlugin[]): EnhancedBackstagePlugin[] {
    const seen = new Map<string, EnhancedBackstagePlugin>();
    
    for (const plugin of plugins) {
      const existing = seen.get(plugin.id);
      if (!existing || this.comparePluginPriority(plugin, existing) > 0) {
        seen.set(plugin.id, plugin);
      }
    }
    
    return Array.from(seen.values());
  }

  private comparePluginPriority(a: EnhancedBackstagePlugin, b: EnhancedBackstagePlugin): number {
    // Prioritize official sources
    const aOfficial = a.registryMetadata?.source === 'backstage-official' || a.registryMetadata?.verified;
    const bOfficial = b.registryMetadata?.source === 'backstage-official' || b.registryMetadata?.verified;
    
    if (aOfficial && !bOfficial) return 1;
    if (!aOfficial && bOfficial) return -1;
    
    // Then by popularity
    const aScore = (a.stars || 0) + (a.downloads || 0) / 100;
    const bScore = (b.stars || 0) + (b.downloads || 0) / 100;
    
    return aScore - bScore;
  }

  private rankPluginsByPopularity(plugins: EnhancedBackstagePlugin[]): EnhancedBackstagePlugin[] {
    return plugins.sort((a, b) => {
      const aScore = this.calculatePopularityScore(a);
      const bScore = this.calculatePopularityScore(b);
      return bScore - aScore;
    });
  }

  private calculatePopularityScore(plugin: EnhancedBackstagePlugin): number {
    let score = 0;
    
    if (plugin.stars) score += plugin.stars * 0.1;
    if (plugin.downloads) score += plugin.downloads * 0.01;
    if (plugin.registryMetadata?.verified) score += 100;
    if (plugin.registryMetadata?.featured) score += 200;
    if (plugin.quality?.score) score += plugin.quality.score * 50;
    
    return score;
  }

  private extractPluginId(packageName: string): string {
    return packageName
      .replace('@backstage/plugin-', '')
      .replace('@backstage/', '')
      .replace('backstage-plugin-', '')
      .replace('plugin-', '');
  }

  private formatPluginTitle(packageName: string): string {
    const id = this.extractPluginId(packageName);
    return id.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private categorizePlugin(name: string, keywords: string[]): EnhancedBackstagePlugin['category'] {
    const keywordStr = keywords.join(' ').toLowerCase();
    const nameStr = name.toLowerCase();

    const categoryMap: Array<[string[], EnhancedBackstagePlugin['category']]> = [
      [['github', 'gitlab', 'ci', 'cd', 'jenkins', 'actions'], 'ci-cd'],
      [['kubernetes', 'k8s', 'infrastructure', 'terraform', 'aws', 'gcp', 'azure'], 'infrastructure'],
      [['sonar', 'lighthouse', 'monitoring', 'prometheus', 'grafana'], 'monitoring'],
      [['security', 'vault', 'auth', 'rbac', 'permission'], 'security'],
      [['cost', 'budget', 'billing', 'financial'], 'cost-management'],
      [['docs', 'techdocs', 'documentation', 'wiki'], 'documentation'],
      [['analytics', 'insights', 'metrics', 'dashboard'], 'analytics'],
      [['test', 'testing', 'qa', 'quality'], 'testing'],
      [['catalog', 'scaffolder', 'template'], 'core'],
      [['ai', 'ml', 'machine-learning', 'artificial-intelligence'], 'ai-ml'],
      [['storage', 's3', 'gcs', 'blob'], 'storage'],
      [['message', 'queue', 'kafka', 'rabbitmq', 'sqs'], 'messaging']
    ];

    for (const [keywords, category] of categoryMap) {
      if (keywords.some(keyword => nameStr.includes(keyword) || keywordStr.includes(keyword))) {
        return category;
      }
    }
    
    return 'productivity';
  }

  private generatePluginSignature(plugin: EnhancedBackstagePlugin): string {
    const data = `${plugin.name}:${plugin.version}:${plugin.author}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  // Cache management
  private getFromCache(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    if (this.cache.size >= this.config.cache.maxSize) {
      // Simple LRU eviction
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cache.ttl
    });
  }

  // Stub methods for installation stages
  private async downloadPlugin(plugin: EnhancedBackstagePlugin): Promise<void> {
    // Implementation would download plugin package
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async validatePlugin(plugin: EnhancedBackstagePlugin): Promise<void> {
    // Implementation would validate plugin signature and integrity
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async installPluginFiles(plugin: EnhancedBackstagePlugin): Promise<void> {
    // Implementation would extract and install plugin files
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  private async configurePlugin(plugin: EnhancedBackstagePlugin): Promise<void> {
    // Implementation would set up plugin configuration
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  private async verifyInstallation(plugin: EnhancedBackstagePlugin): Promise<void> {
    // Implementation would verify plugin is working correctly
    await new Promise(resolve => setTimeout(resolve, 600));
  }
}

// Export singleton instance
let registryInstance: EnhancedPluginRegistryService | null = null;

export function getEnhancedPluginRegistry(config?: Partial<RegistryConfig>): EnhancedPluginRegistryService {
  if (!registryInstance) {
    registryInstance = new EnhancedPluginRegistryService(config);
  }
  return registryInstance;
}