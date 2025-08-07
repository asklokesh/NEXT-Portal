// Enhanced Plugin Registry API Routes
// Comprehensive API for Backstage plugin registry and marketplace integration

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnhancedPluginRegistry, PluginDiscoveryFilters, EnhancedBackstagePlugin } from '@/services/backstage/enhanced-plugin-registry';

// Request validation schemas
const DiscoveryFiltersSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  minStars: z.number().optional(),
  minDownloads: z.number().optional(),
  compatibility: z.object({
    backstageVersion: z.string().optional(),
    nodeVersion: z.string().optional(),
  }).optional(),
  security: z.object({
    maxVulnerabilities: z.number().optional(),
    requireTrusted: z.boolean().optional(),
  }).optional(),
  quality: z.object({
    minScore: z.number().optional(),
    requireMaintained: z.boolean().optional(),
  }).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(500).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.enum(['popularity', 'stars', 'downloads', 'updated', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

const InstallRequestSchema = z.object({
  pluginId: z.string(),
  version: z.string().optional(),
  configuration: z.record(z.any()).optional(),
  forceInstall: z.boolean().optional()
});

// Initialize registry with enterprise configuration
const getRegistry = () => {
  return getEnhancedPluginRegistry({
    npm: {
      registry: process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org',
      timeout: 30000,
      rateLimit: 100,
      token: process.env.NPM_TOKEN
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      baseUrl: 'https://api.github.com',
      timeout: 30000,
      rateLimit: process.env.GITHUB_TOKEN ? 5000 : 60
    },
    backstage: {
      officialRegistryUrl: process.env.BACKSTAGE_REGISTRY_URL || 'https://backstage.io/api/plugins',
      communityRegistryUrl: process.env.COMMUNITY_REGISTRY_URL
    },
    enterprise: {
      registryUrl: process.env.ENTERPRISE_REGISTRY_URL,
      token: process.env.ENTERPRISE_REGISTRY_TOKEN,
      proxy: process.env.PROXY_HOST ? {
        host: process.env.PROXY_HOST,
        port: parseInt(process.env.PROXY_PORT || '8080'),
        auth: process.env.PROXY_USERNAME ? {
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD || ''
        } : undefined
      } : undefined
    },
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '300000'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
      persistToDisk: process.env.CACHE_PERSIST === 'true'
    }
  });
};

// GET /api/plugins/registry - Discover and search plugins
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilters = {
      category: searchParams.get('category'),
      tags: searchParams.getAll('tags'),
      author: searchParams.get('author'),
      minStars: searchParams.get('minStars') ? parseInt(searchParams.get('minStars')!) : undefined,
      minDownloads: searchParams.get('minDownloads') ? parseInt(searchParams.get('minDownloads')!) : undefined,
      search: searchParams.get('search'),
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      sortBy: searchParams.get('sortBy') as any,
      sortOrder: searchParams.get('sortOrder') as any,
      compatibility: {
        backstageVersion: searchParams.get('backstageVersion'),
        nodeVersion: searchParams.get('nodeVersion'),
      },
      security: {
        maxVulnerabilities: searchParams.get('maxVulnerabilities') ? parseInt(searchParams.get('maxVulnerabilities')!) : undefined,
        requireTrusted: searchParams.get('requireTrusted') === 'true'
      },
      quality: {
        minScore: searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined,
        requireMaintained: searchParams.get('requireMaintained') === 'true'
      }
    };

    // Clean up undefined values
    const filters = Object.fromEntries(
      Object.entries(rawFilters).filter(([_, value]) => 
        value !== null && value !== undefined && value !== '' && 
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && Object.values(value).every(v => v === null || v === undefined))
      )
    ) as PluginDiscoveryFilters;

    // Validate filters
    const validatedFilters = DiscoveryFiltersSchema.parse(filters);

    const registry = getRegistry();
    let plugins = await registry.discoverPlugins(validatedFilters);

    // Apply search filter
    if (validatedFilters.search) {
      const searchTerm = validatedFilters.search.toLowerCase();
      plugins = plugins.filter(plugin => 
        plugin.name.toLowerCase().includes(searchTerm) ||
        plugin.title.toLowerCase().includes(searchTerm) ||
        plugin.description.toLowerCase().includes(searchTerm) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply sorting
    if (validatedFilters.sortBy) {
      plugins.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (validatedFilters.sortBy) {
          case 'popularity':
            aValue = (a.popularity?.score || 0);
            bValue = (b.popularity?.score || 0);
            break;
          case 'stars':
            aValue = a.stars || 0;
            bValue = b.stars || 0;
            break;
          case 'downloads':
            aValue = a.downloads || 0;
            bValue = b.downloads || 0;
            break;
          case 'updated':
            aValue = new Date(a.lastUpdated || 0);
            bValue = new Date(b.lastUpdated || 0);
            break;
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          default:
            return 0;
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return validatedFilters.sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    const total = plugins.length;
    const paginatedPlugins = plugins.slice(
      validatedFilters.offset || 0, 
      (validatedFilters.offset || 0) + (validatedFilters.limit || 50)
    );

    return NextResponse.json({
      success: true,
      data: {
        plugins: paginatedPlugins,
        pagination: {
          total,
          offset: validatedFilters.offset || 0,
          limit: validatedFilters.limit || 50,
          hasMore: total > (validatedFilters.offset || 0) + (validatedFilters.limit || 50)
        },
        filters: validatedFilters,
        categories: await getCategories(plugins),
        topTags: await getTopTags(plugins)
      }
    });

  } catch (error) {
    console.error('Plugin registry discovery error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to discover plugins'
    }, { status: 500 });
  }
}

// POST /api/plugins/registry - Install plugin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, version, configuration, forceInstall } = InstallRequestSchema.parse(body);

    const registry = getRegistry();
    
    // First discover the plugin to get its metadata
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => p.id === pluginId || p.name.includes(pluginId));
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found in registry`
      }, { status: 404 });
    }

    // Validate compatibility if not force installing
    if (!forceInstall) {
      const compatibilityCheck = await registry.validateCompatibility(plugin, {
        backstageVersion: process.env.BACKSTAGE_VERSION,
        nodeVersion: process.version,
        npmVersion: process.env.NPM_VERSION
      });

      if (!compatibilityCheck.compatible) {
        return NextResponse.json({
          success: false,
          error: 'Plugin is not compatible with current environment',
          compatibilityIssues: compatibilityCheck.issues,
          recommendations: compatibilityCheck.recommendations
        }, { status: 400 });
      }
    }

    // Install the plugin with progress tracking
    const installationId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const progressUpdates: any[] = [];
    
    // In a real implementation, you'd use WebSocket or Server-Sent Events for real-time updates
    await registry.installPlugin(plugin, (progress) => {
      progressUpdates.push({
        timestamp: new Date().toISOString(),
        ...progress
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        installationId,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          status: 'installed'
        },
        progress: progressUpdates
      }
    });

  } catch (error) {
    console.error('Plugin installation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to install plugin'
    }, { status: 500 });
  }
}

// PUT /api/plugins/registry - Sync registries
export async function PUT(request: NextRequest) {
  try {
    const registry = getRegistry();
    await registry.syncRegistries();

    return NextResponse.json({
      success: true,
      message: 'Registry synchronization initiated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registry sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync registries'
    }, { status: 500 });
  }
}

// Helper functions
async function getCategories(plugins: EnhancedBackstagePlugin[]): Promise<Array<{category: string, count: number}>> {
  const categoryCount = plugins.reduce((acc, plugin) => {
    acc[plugin.category] = (acc[plugin.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(categoryCount)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

async function getTopTags(plugins: EnhancedBackstagePlugin[]): Promise<Array<{tag: string, count: number}>> {
  const tagCount = plugins.reduce((acc, plugin) => {
    plugin.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 tags
}