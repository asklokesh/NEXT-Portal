import { prisma } from '@/lib/db/client';
import axios from 'axios';
import semver from 'semver';

export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription?: string;
  version: string;
  author: string;
  authorEmail?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  iconUrl?: string;
  screenshots: string[];
  repositoryUrl?: string;
  documentationUrl?: string;
  homepageUrl?: string;
  licenseType: string;
  licenseUrl?: string;
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price?: number;
    currency?: string;
    billingPeriod?: 'monthly' | 'yearly' | 'one-time';
  };
  compatibility: {
    backstageVersions: string[];
    nodeVersions: string[];
    platforms: string[];
  };
  requirements: {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    minimumRam?: string;
    minimumStorage?: string;
  };
  features: string[];
  changelog: ChangelogEntry[];
  support: {
    email?: string;
    url?: string;
    documentation?: string;
    community?: string;
  };
  metrics: {
    downloads: number;
    weeklyDownloads: number;
    monthlyDownloads: number;
    activeInstallations: number;
    rating: number;
    reviewCount: number;
    lastUpdated: Date;
  };
  security: {
    verified: boolean;
    scanResults?: SecurityScanResult;
    permissions: string[];
  };
  status: 'active' | 'deprecated' | 'archived' | 'beta' | 'alpha';
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  breaking: boolean;
}

export interface SecurityScanResult {
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastScanDate: Date;
  scanTool: string;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1-5 stars
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  version: string;
  verified: boolean; // User has actually installed the plugin
  helpful: number; // Helpful votes
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginInstallation {
  id: string;
  pluginId: string;
  pluginVersion: string;
  userId: string;
  tenantId?: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  config?: Record<string, any>;
  errorMessage?: string;
  installationLogs: string[];
  installedAt?: Date;
  lastUpdated: Date;
}

export interface MarketplaceFilter {
  category?: string;
  subcategory?: string;
  tags?: string[];
  pricing?: 'free' | 'paid' | 'freemium';
  compatibility?: {
    backstageVersion?: string;
    nodeVersion?: string;
  };
  rating?: number;
  verified?: boolean;
  status?: string[];
  search?: string;
}

export interface MarketplaceSort {
  field: 'name' | 'rating' | 'downloads' | 'lastUpdated' | 'created';
  direction: 'asc' | 'desc';
}

export class MarketplaceService {
  private static instance: MarketplaceService;

  static getInstance(): MarketplaceService {
    if (!MarketplaceService.instance) {
      MarketplaceService.instance = new MarketplaceService();
    }
    return MarketplaceService.instance;
  }

  /**
   * Get plugins with filtering and sorting
   */
  async getPlugins(
    filter?: MarketplaceFilter,
    sort?: MarketplaceSort,
    pagination?: { offset: number; limit: number }
  ): Promise<{ plugins: Plugin[]; total: number }> {
    try {
      // Build filter conditions
      const where: any = {};
      
      if (filter?.category) where.category = filter.category;
      if (filter?.subcategory) where.subcategory = filter.subcategory;
      if (filter?.pricing) where.pricing = { type: filter.pricing };
      if (filter?.verified !== undefined) where.security = { verified: filter.verified };
      if (filter?.status?.length) where.status = { in: filter.status };
      
      if (filter?.tags?.length) {
        where.tags = { hasSome: filter.tags };
      }
      
      if (filter?.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { displayName: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
          { tags: { has: filter.search } }
        ];
      }

      if (filter?.rating) {
        where.metrics = { rating: { gte: filter.rating } };
      }

      // Build sort options
      const orderBy: any = {};
      if (sort?.field) {
        if (sort.field === 'downloads') {
          orderBy.metrics = { downloads: sort.direction };
        } else if (sort.field === 'rating') {
          orderBy.metrics = { rating: sort.direction };
        } else if (sort.field === 'lastUpdated') {
          orderBy.updatedAt = sort.direction;
        } else {
          orderBy[sort.field] = sort.direction;
        }
      } else {
        orderBy.metrics = { rating: 'desc' }; // Default sort
      }

      // Execute query
      const plugins = await prisma.plugin?.findMany({
        where,
        orderBy,
        skip: pagination?.offset || 0,
        take: pagination?.limit || 20,
        include: {
          _count: {
            select: { reviews: true }
          }
        }
      }) as any[];

      const total = await prisma.plugin?.count({ where }) || 0;

      return { plugins: plugins || [], total };
    } catch (error) {
      console.error('Failed to get plugins:', error);
      return { plugins: [], total: 0 };
    }
  }

  /**
   * Get plugin by ID with detailed information
   */
  async getPlugin(pluginId: string): Promise<Plugin | null> {
    try {
      const plugin = await prisma.plugin?.findUnique({
        where: { id: pluginId },
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          _count: {
            select: { installations: true }
          }
        }
      });

      return plugin as Plugin | null;
    } catch (error) {
      console.error('Failed to get plugin:', error);
      return null;
    }
  }

  /**
   * Search plugins with advanced search capabilities
   */
  async searchPlugins(
    query: string,
    filters?: MarketplaceFilter,
    limit = 20
  ): Promise<Plugin[]> {
    try {
      const searchTerms = query.toLowerCase().split(' ');
      
      const where: any = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { longDescription: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: searchTerms } },
          { features: { hasSome: searchTerms } }
        ]
      };

      // Apply additional filters
      if (filters) {
        Object.assign(where, this.buildFilterConditions(filters));
      }

      const plugins = await prisma.plugin?.findMany({
        where,
        orderBy: [
          { metrics: { rating: 'desc' } },
          { metrics: { downloads: 'desc' } }
        ],
        take: limit
      }) as Plugin[];

      return plugins || [];
    } catch (error) {
      console.error('Failed to search plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin categories with counts
   */
  async getCategories(): Promise<Array<{ category: string; count: number; subcategories?: Array<{ name: string; count: number }> }>> {
    try {
      const categories = await prisma.plugin?.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } }
      }) as any[];

      const result = [];
      for (const cat of categories || []) {
        const subcategories = await prisma.plugin?.groupBy({
          by: ['subcategory'],
          where: { category: cat.category, subcategory: { not: null } },
          _count: { subcategory: true },
          orderBy: { _count: { subcategory: 'desc' } }
        }) as any[];

        result.push({
          category: cat.category,
          count: cat._count?.category || 0,
          subcategories: subcategories?.map((sub: any) => ({
            name: sub.subcategory,
            count: sub._count?.subcategory || 0
          })) || []
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
    try {
      // This is a simplified version - in production, you'd want to properly aggregate tags
      const plugins = await prisma.plugin?.findMany({
        select: { tags: true }
      }) as any[];

      const tagCounts: Record<string, number> = {};
      
      (plugins || []).forEach((plugin: any) => {
        if (plugin.tags) {
          plugin.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get popular tags:', error);
      return [];
    }
  }

  /**
   * Get plugin reviews
   */
  async getPluginReviews(
    pluginId: string,
    pagination?: { offset: number; limit: number }
  ): Promise<{ reviews: PluginReview[]; total: number }> {
    try {
      const reviews = await prisma.pluginReview?.findMany({
        where: { pluginId },
        orderBy: [
          { helpful: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: pagination?.offset || 0,
        take: pagination?.limit || 10,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }) as any[];

      const total = await prisma.pluginReview?.count({ where: { pluginId } }) || 0;

      return { reviews: reviews || [], total };
    } catch (error) {
      console.error('Failed to get plugin reviews:', error);
      return { reviews: [], total: 0 };
    }
  }

  /**
   * Add plugin review
   */
  async addReview(review: Omit<PluginReview, 'id' | 'createdAt' | 'updatedAt' | 'helpful'>): Promise<PluginReview | null> {
    try {
      // Check if user already reviewed this plugin
      const existingReview = await prisma.pluginReview?.findFirst({
        where: {
          pluginId: review.pluginId,
          userId: review.userId
        }
      });

      if (existingReview) {
        // Update existing review
        const updatedReview = await prisma.pluginReview?.update({
          where: { id: existingReview.id },
          data: {
            ...review,
            updatedAt: new Date()
          }
        }) as PluginReview;

        await this.updatePluginRating(review.pluginId);
        return updatedReview;
      } else {
        // Create new review
        const newReview = await prisma.pluginReview?.create({
          data: {
            ...review,
            helpful: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }) as PluginReview;

        await this.updatePluginRating(review.pluginId);
        return newReview;
      }
    } catch (error) {
      console.error('Failed to add review:', error);
      return null;
    }
  }

  /**
   * Install plugin
   */
  async installPlugin(
    pluginId: string,
    version: string,
    userId: string,
    tenantId?: string,
    config?: Record<string, any>
  ): Promise<PluginInstallation | null> {
    try {
      // Check if plugin exists
      const plugin = await this.getPlugin(pluginId);
      if (!plugin) {
        throw new Error('Plugin not found');
      }

      // Check version compatibility
      if (!this.isVersionCompatible(version, plugin.compatibility.backstageVersions)) {
        throw new Error('Plugin version is not compatible with current Backstage version');
      }

      // Create installation record
      const installation = await prisma.pluginInstallation?.create({
        data: {
          pluginId,
          pluginVersion: version,
          userId,
          tenantId,
          status: 'installing',
          config: config ? JSON.stringify(config) : null,
          installationLogs: [],
          lastUpdated: new Date()
        }
      }) as PluginInstallation;

      // Start installation process (async)
      this.processPluginInstallation(installation.id).catch(error => {
        console.error('Plugin installation failed:', error);
      });

      return installation;
    } catch (error) {
      console.error('Failed to start plugin installation:', error);
      return null;
    }
  }

  /**
   * Get user's plugin installations
   */
  async getUserInstallations(userId: string, tenantId?: string): Promise<PluginInstallation[]> {
    try {
      const where: any = { userId };
      if (tenantId) where.tenantId = tenantId;

      const installations = await prisma.pluginInstallation?.findMany({
        where,
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              displayName: true,
              version: true,
              iconUrl: true
            }
          }
        },
        orderBy: { lastUpdated: 'desc' }
      }) as any[];

      return installations || [];
    } catch (error) {
      console.error('Failed to get user installations:', error);
      return [];
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(installationId: string, userId: string): Promise<boolean> {
    try {
      const installation = await prisma.pluginInstallation?.findFirst({
        where: {
          id: installationId,
          userId
        }
      });

      if (!installation) {
        throw new Error('Installation not found');
      }

      // Update status to uninstalling
      await prisma.pluginInstallation?.update({
        where: { id: installationId },
        data: {
          status: 'uninstalling',
          lastUpdated: new Date()
        }
      });

      // Process uninstallation (async)
      this.processPluginUninstallation(installationId).catch(error => {
        console.error('Plugin uninstallation failed:', error);
      });

      return true;
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      return false;
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<{
    totalPlugins: number;
    totalDownloads: number;
    totalReviews: number;
    averageRating: number;
    pluginsByCategory: Array<{ category: string; count: number }>;
    topPlugins: Plugin[];
    recentPlugins: Plugin[];
  }> {
    try {
      const [totalPlugins, totalReviews, pluginsByCategory, topPlugins, recentPlugins] = await Promise.all([
        prisma.plugin?.count(),
        prisma.pluginReview?.count(),
        this.getCategories(),
        this.getPlugins(undefined, { field: 'downloads', direction: 'desc' }, { offset: 0, limit: 5 }),
        this.getPlugins(undefined, { field: 'created', direction: 'desc' }, { offset: 0, limit: 5 })
      ]);

      // Calculate total downloads and average rating
      const plugins = await prisma.plugin?.findMany({
        select: { metrics: true }
      }) as any[];

      const totalDownloads = plugins?.reduce((sum, p) => sum + (p.metrics?.downloads || 0), 0) || 0;
      const averageRating = plugins?.length
        ? plugins.reduce((sum, p) => sum + (p.metrics?.rating || 0), 0) / plugins.length
        : 0;

      return {
        totalPlugins: totalPlugins || 0,
        totalDownloads,
        totalReviews: totalReviews || 0,
        averageRating,
        pluginsByCategory: pluginsByCategory.map(c => ({ category: c.category, count: c.count })),
        topPlugins: topPlugins.plugins,
        recentPlugins: recentPlugins.plugins
      };
    } catch (error) {
      console.error('Failed to get marketplace stats:', error);
      return {
        totalPlugins: 0,
        totalDownloads: 0,
        totalReviews: 0,
        averageRating: 0,
        pluginsByCategory: [],
        topPlugins: [],
        recentPlugins: []
      };
    }
  }

  /**
   * Private helper methods
   */
  
  private buildFilterConditions(filters: MarketplaceFilter): any {
    const conditions: any = {};
    
    if (filters.category) conditions.category = filters.category;
    if (filters.subcategory) conditions.subcategory = filters.subcategory;
    if (filters.pricing) conditions.pricing = { type: filters.pricing };
    if (filters.verified !== undefined) conditions.security = { verified: filters.verified };
    if (filters.status?.length) conditions.status = { in: filters.status };
    if (filters.tags?.length) conditions.tags = { hasSome: filters.tags };
    if (filters.rating) conditions.metrics = { rating: { gte: filters.rating } };

    return conditions;
  }

  private isVersionCompatible(version: string, compatibleVersions: string[]): boolean {
    try {
      return compatibleVersions.some(compatibleRange => 
        semver.satisfies(version, compatibleRange)
      );
    } catch (error) {
      console.error('Error checking version compatibility:', error);
      return false;
    }
  }

  private async updatePluginRating(pluginId: string): Promise<void> {
    try {
      const reviews = await prisma.pluginReview?.findMany({
        where: { pluginId },
        select: { rating: true }
      }) as any[];

      if (reviews && reviews.length > 0) {
        const averageRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
        
        await prisma.plugin?.update({
          where: { id: pluginId },
          data: {
            metrics: {
              update: {
                rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
                reviewCount: reviews.length
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to update plugin rating:', error);
    }
  }

  private async processPluginInstallation(installationId: string): Promise<void> {
    try {
      const installation = await prisma.pluginInstallation?.findUnique({
        where: { id: installationId },
        include: { plugin: true }
      }) as any;

      if (!installation) return;

      const logs: string[] = ['Starting plugin installation...'];
      
      // Simulate installation steps
      logs.push('Downloading plugin package...');
      await this.sleep(2000);
      
      logs.push('Verifying plugin integrity...');
      await this.sleep(1000);
      
      logs.push('Installing dependencies...');
      await this.sleep(3000);
      
      logs.push('Configuring plugin...');
      await this.sleep(1500);
      
      logs.push('Registering plugin with Backstage...');
      await this.sleep(1000);
      
      logs.push('Installation completed successfully!');

      // Update installation record
      await prisma.pluginInstallation?.update({
        where: { id: installationId },
        data: {
          status: 'installed',
          installedAt: new Date(),
          lastUpdated: new Date(),
          installationLogs: logs
        }
      });

      // Update plugin metrics
      await prisma.plugin?.update({
        where: { id: installation.pluginId },
        data: {
          metrics: {
            update: {
              downloads: { increment: 1 },
              activeInstallations: { increment: 1 }
            }
          }
        }
      });

    } catch (error) {
      console.error('Plugin installation process failed:', error);
      
      await prisma.pluginInstallation?.update({
        where: { id: installationId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Installation failed',
          lastUpdated: new Date()
        }
      });
    }
  }

  private async processPluginUninstallation(installationId: string): Promise<void> {
    try {
      await this.sleep(2000); // Simulate uninstallation time
      
      const installation = await prisma.pluginInstallation?.findUnique({
        where: { id: installationId }
      });

      if (installation) {
        // Remove installation record
        await prisma.pluginInstallation?.delete({
          where: { id: installationId }
        });

        // Update plugin metrics
        await prisma.plugin?.update({
          where: { id: installation.pluginId },
          data: {
            metrics: {
              update: {
                activeInstallations: { decrement: 1 }
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Plugin uninstallation process failed:', error);
      
      await prisma.pluginInstallation?.update({
        where: { id: installationId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Uninstallation failed',
          lastUpdated: new Date()
        }
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const marketplaceService = MarketplaceService.getInstance();