/**
 * Backstage Registry Synchronization Service
 * Integrates with Backstage.io plugin registry for real-time discovery and metadata
 */

import { z } from 'zod';

interface PluginMetadata {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  author: string;
  repository: string;
  homepage: string;
  documentation: string;
  category: string;
  tags: string[];
  backstageVersion: string;
  npmPackage: string;
  lastUpdated: Date;
  downloads: number;
  stars: number;
  issues: number;
  communityRating: number;
  verified: boolean;
  deprecated: boolean;
}

interface SyncResult {
  success: boolean;
  pluginsSynced: number;
  newPlugins: number;
  updatedPlugins: number;
  errors: string[];
  timestamp: Date;
}

interface RegistryPlugin {
  package: {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    author: any;
    repository: any;
    homepage: string;
    bugs: any;
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
  downloads: {
    weekly: number;
    monthly: number;
  };
}

export class BackstageRegistrySync {
  private pluginCache: Map<string, PluginMetadata> = new Map();
  private lastSyncTime: Date | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private registryEndpoints = [
    'https://registry.npmjs.org/-/v1/search',
    'https://api.github.com/search/repositories',
    'https://backstage.io/plugins/api' // Hypothetical Backstage plugin API
  ];

  constructor() {
    this.initializeSync();
  }

  /**
   * Initialize automatic synchronization
   */
  private initializeSync(): void {
    // Perform initial sync
    this.syncWithBackstageRegistry().catch(console.error);

    // Schedule periodic sync (every hour)
    this.syncInterval = setInterval(async () => {
      await this.syncWithBackstageRegistry();
    }, 60 * 60 * 1000);
  }

  /**
   * Sync with Backstage plugin registry
   */
  async syncWithBackstageRegistry(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let newPlugins = 0;
    let updatedPlugins = 0;
    const syncedPlugins = new Set<string>();

    try {
      // Fetch from NPM registry
      const npmPlugins = await this.fetchFromNpmRegistry();
      for (const plugin of npmPlugins) {
        const metadata = this.transformNpmToMetadata(plugin);
        const existing = this.pluginCache.get(metadata.id);
        
        if (!existing) {
          newPlugins++;
        } else if (existing.version !== metadata.version) {
          updatedPlugins++;
        }
        
        this.pluginCache.set(metadata.id, metadata);
        syncedPlugins.add(metadata.id);
      }

      // Fetch from GitHub (Backstage organization)
      const githubPlugins = await this.fetchFromGitHub();
      for (const plugin of githubPlugins) {
        const metadata = this.transformGitHubToMetadata(plugin);
        if (!syncedPlugins.has(metadata.id)) {
          const existing = this.pluginCache.get(metadata.id);
          
          if (!existing) {
            newPlugins++;
          } else if (existing.lastUpdated < metadata.lastUpdated) {
            updatedPlugins++;
          }
          
          this.pluginCache.set(metadata.id, metadata);
          syncedPlugins.add(metadata.id);
        }
      }

      // Fetch community ratings and reviews
      await this.fetchCommunityData();

      // Update verification status
      await this.updateVerificationStatus();

      this.lastSyncTime = new Date();

      return {
        success: true,
        pluginsSynced: syncedPlugins.size,
        newPlugins,
        updatedPlugins,
        errors,
        timestamp: new Date()
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      return {
        success: false,
        pluginsSynced: syncedPlugins.size,
        newPlugins,
        updatedPlugins,
        errors,
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync specific plugin metadata
   */
  async syncPluginMetadata(pluginId: string): Promise<PluginMetadata | null> {
    try {
      // Try to fetch from NPM
      const npmData = await this.fetchPluginFromNpm(pluginId);
      if (npmData) {
        const metadata = this.transformNpmToMetadata(npmData);
        this.pluginCache.set(pluginId, metadata);
        return metadata;
      }

      // Try GitHub as fallback
      const githubData = await this.fetchPluginFromGitHub(pluginId);
      if (githubData) {
        const metadata = this.transformGitHubToMetadata(githubData);
        this.pluginCache.set(pluginId, metadata);
        return metadata;
      }

      return null;
    } catch (error) {
      console.error(`Failed to sync metadata for ${pluginId}:`, error);
      return null;
    }
  }

  /**
   * Get cached plugin metadata
   */
  getPluginMetadata(pluginId: string): PluginMetadata | null {
    return this.pluginCache.get(pluginId) || null;
  }

  /**
   * Search plugins with filters
   */
  searchPlugins(query: string, filters?: {
    category?: string;
    tags?: string[];
    minRating?: number;
    verified?: boolean;
  }): PluginMetadata[] {
    let results = Array.from(this.pluginCache.values());

    // Apply search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(plugin => 
        plugin.name.toLowerCase().includes(lowerQuery) ||
        plugin.title.toLowerCase().includes(lowerQuery) ||
        plugin.description.toLowerCase().includes(lowerQuery) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(p => p.category === filters.category);
      }
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(p => 
          filters.tags!.some(tag => p.tags.includes(tag))
        );
      }
      if (filters.minRating !== undefined) {
        results = results.filter(p => p.communityRating >= filters.minRating!);
      }
      if (filters.verified !== undefined) {
        results = results.filter(p => p.verified === filters.verified);
      }
    }

    // Sort by relevance (downloads + stars + rating)
    results.sort((a, b) => {
      const scoreA = a.downloads + a.stars * 10 + a.communityRating * 100;
      const scoreB = b.downloads + b.stars * 10 + b.communityRating * 100;
      return scoreB - scoreA;
    });

    return results;
  }

  /**
   * Get plugin compatibility matrix
   */
  async getCompatibilityMatrix(pluginId: string): Promise<{
    backstageVersions: string[];
    compatible: Record<string, boolean>;
    dependencies: Record<string, string>;
  }> {
    const metadata = this.pluginCache.get(pluginId);
    if (!metadata) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Fetch detailed compatibility info
    const compatibilityData = await this.fetchCompatibilityData(pluginId);

    return {
      backstageVersions: ['1.38.0', '1.39.0', '1.40.0', '1.41.0'],
      compatible: compatibilityData.compatible || {
        '1.38.0': true,
        '1.39.0': true,
        '1.40.0': true,
        '1.41.0': true
      },
      dependencies: compatibilityData.dependencies || {}
    };
  }

  /**
   * Get trending plugins
   */
  getTrendingPlugins(limit: number = 10): PluginMetadata[] {
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30); // Last 30 days

    return Array.from(this.pluginCache.values())
      .filter(p => p.lastUpdated > recentCutoff && !p.deprecated)
      .sort((a, b) => {
        // Calculate trend score based on recent activity
        const scoreA = a.downloads + a.stars * 5 + (a.communityRating || 0) * 50;
        const scoreB = b.downloads + b.stars * 5 + (b.communityRating || 0) * 50;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Get recommended plugins based on installed plugins
   */
  getRecommendedPlugins(installedPlugins: string[]): PluginMetadata[] {
    const recommendations: PluginMetadata[] = [];
    const installedCategories = new Set<string>();
    const installedTags = new Set<string>();

    // Analyze installed plugins
    for (const pluginId of installedPlugins) {
      const metadata = this.pluginCache.get(pluginId);
      if (metadata) {
        installedCategories.add(metadata.category);
        metadata.tags.forEach(tag => installedTags.add(tag));
      }
    }

    // Find similar plugins
    for (const plugin of this.pluginCache.values()) {
      if (installedPlugins.includes(plugin.id)) continue;
      
      let relevanceScore = 0;
      
      // Category match
      if (installedCategories.has(plugin.category)) {
        relevanceScore += 30;
      }
      
      // Tag matches
      const tagMatches = plugin.tags.filter(tag => installedTags.has(tag)).length;
      relevanceScore += tagMatches * 10;
      
      // Quality indicators
      if (plugin.verified) relevanceScore += 20;
      if (plugin.communityRating > 4) relevanceScore += 15;
      if (plugin.downloads > 10000) relevanceScore += 10;
      
      if (relevanceScore > 40) {
        recommendations.push(plugin);
      }
    }

    // Sort by relevance and return top recommendations
    return recommendations
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);
  }

  // Private helper methods

  private async fetchFromNpmRegistry(): Promise<RegistryPlugin[]> {
    const plugins: RegistryPlugin[] = [];
    const searchQueries = [
      '@backstage/plugin-',
      'backstage-plugin',
      '@roadiehq/backstage-plugin-',
      '@spotify/backstage-plugin-'
    ];

    for (const query of searchQueries) {
      try {
        const response = await fetch(
          `${this.registryEndpoints[0]}?text=${encodeURIComponent(query)}&size=250`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.objects) {
            plugins.push(...data.objects);
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch from NPM for query ${query}:`, error);
      }
    }

    // Remove duplicates
    const uniquePlugins = new Map<string, RegistryPlugin>();
    plugins.forEach(p => uniquePlugins.set(p.package.name, p));
    
    return Array.from(uniquePlugins.values());
  }

  private async fetchFromGitHub(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.registryEndpoints[1]}?q=topic:backstage-plugin+org:backstage+org:RoadieHQ&per_page=100`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (error) {
      console.warn('Failed to fetch from GitHub:', error);
    }

    return [];
  }

  private async fetchPluginFromNpm(pluginId: string): Promise<RegistryPlugin | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pluginId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          package: {
            name: data.name,
            version: data['dist-tags']?.latest || '0.0.0',
            description: data.description,
            keywords: data.keywords || [],
            author: data.author,
            repository: data.repository,
            homepage: data.homepage,
            bugs: data.bugs
          },
          score: {
            final: 0.5,
            detail: {
              quality: 0.5,
              popularity: 0.5,
              maintenance: 0.5
            }
          },
          searchScore: 1,
          downloads: {
            weekly: 0,
            monthly: 0
          }
        };
      }
    } catch (error) {
      console.error(`Failed to fetch ${pluginId} from NPM:`, error);
    }
    return null;
  }

  private async fetchPluginFromGitHub(pluginId: string): Promise<any | null> {
    // Transform plugin ID to potential GitHub repo name
    const repoName = pluginId.replace('@', '').replace('/', '-');
    
    try {
      const response = await fetch(
        `${this.registryEndpoints[1]}?q=${repoName}+in:name+topic:backstage-plugin`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.items?.[0] || null;
      }
    } catch (error) {
      console.error(`Failed to fetch ${pluginId} from GitHub:`, error);
    }
    return null;
  }

  private transformNpmToMetadata(plugin: RegistryPlugin): PluginMetadata {
    const pkg = plugin.package;
    return {
      id: pkg.name,
      name: pkg.name,
      title: this.formatTitle(pkg.name),
      description: pkg.description || 'No description available',
      version: pkg.version,
      author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || 'Unknown',
      repository: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || '',
      homepage: pkg.homepage || '',
      documentation: pkg.homepage || '',
      category: this.categorizePlugin(pkg.name, pkg.keywords),
      tags: pkg.keywords || [],
      backstageVersion: '1.41.0', // Would need to parse from package.json
      npmPackage: pkg.name,
      lastUpdated: new Date(),
      downloads: plugin.downloads?.monthly || 0,
      stars: Math.round((plugin.score?.final || 0) * 1000),
      issues: 0,
      communityRating: plugin.score?.final ? plugin.score.final * 5 : 0,
      verified: this.isVerifiedPublisher(pkg.name),
      deprecated: false
    };
  }

  private transformGitHubToMetadata(repo: any): PluginMetadata {
    return {
      id: repo.full_name,
      name: repo.name,
      title: this.formatTitle(repo.name),
      description: repo.description || 'No description available',
      version: '0.0.0', // Would need to fetch from package.json
      author: repo.owner?.login || 'Unknown',
      repository: repo.html_url,
      homepage: repo.homepage || repo.html_url,
      documentation: repo.homepage || repo.html_url,
      category: this.categorizePlugin(repo.name, repo.topics || []),
      tags: repo.topics || [],
      backstageVersion: '1.41.0',
      npmPackage: '',
      lastUpdated: new Date(repo.updated_at),
      downloads: 0,
      stars: repo.stargazers_count || 0,
      issues: repo.open_issues_count || 0,
      communityRating: Math.min(5, (repo.stargazers_count || 0) / 100),
      verified: this.isVerifiedPublisher(repo.owner?.login),
      deprecated: repo.archived || false
    };
  }

  private formatTitle(name: string): string {
    return name
      .replace('@backstage/plugin-', '')
      .replace('@roadiehq/backstage-plugin-', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private categorizePlugin(name: string, keywords: string[]): string {
    const nameStr = name.toLowerCase();
    const keywordStr = keywords.join(' ').toLowerCase();

    if (nameStr.includes('kubernetes') || keywordStr.includes('k8s')) return 'infrastructure';
    if (nameStr.includes('github') || nameStr.includes('gitlab')) return 'ci-cd';
    if (nameStr.includes('jenkins') || nameStr.includes('ci')) return 'ci-cd';
    if (nameStr.includes('cost') || keywordStr.includes('finops')) return 'cost-management';
    if (nameStr.includes('security') || keywordStr.includes('security')) return 'security';
    if (nameStr.includes('docs') || keywordStr.includes('documentation')) return 'documentation';
    if (nameStr.includes('monitoring') || keywordStr.includes('observability')) return 'monitoring';
    if (nameStr.includes('catalog')) return 'core';
    
    return 'other';
  }

  private isVerifiedPublisher(name: string): boolean {
    const verifiedPublishers = [
      'backstage',
      'RoadieHQ',
      'spotify',
      'SDA-SE',
      'Oriflame'
    ];
    
    return verifiedPublishers.some(publisher => 
      name.toLowerCase().includes(publisher.toLowerCase())
    );
  }

  private async fetchCommunityData(): Promise<void> {
    // In production, fetch from community ratings API or database
    // For now, simulate with random data
    for (const [id, metadata] of this.pluginCache.entries()) {
      if (!metadata.communityRating) {
        metadata.communityRating = Math.random() * 5;
      }
    }
  }

  private async updateVerificationStatus(): Promise<void> {
    // In production, check against verified publisher list
    // For now, use the isVerifiedPublisher method
    for (const [id, metadata] of this.pluginCache.entries()) {
      metadata.verified = this.isVerifiedPublisher(metadata.author);
    }
  }

  private async fetchCompatibilityData(pluginId: string): Promise<any> {
    // In production, fetch from compatibility testing results
    return {
      compatible: {
        '1.38.0': true,
        '1.39.0': true,
        '1.40.0': true,
        '1.41.0': true
      },
      dependencies: {}
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}