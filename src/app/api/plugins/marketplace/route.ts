/**
 * Plugin Marketplace API Route
 * Combines NPM registry data with database plugin state for complete marketplace view
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// Cache for marketplace data (5 minutes)
let marketplaceCache: any = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const featured = searchParams.get('featured') === 'true';
    const installed = searchParams.get('installed') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get marketplace data (NPM registry)
    let marketplacePlugins = [];
    const now = Date.now();
    
    if (marketplaceCache && (now - cacheTime) < CACHE_DURATION) {
      marketplacePlugins = marketplaceCache;
    } else {
      // Fetch fresh data from NPM registry (internal call)
      try {
        const registryResponse = await fetch(`http://localhost:4400/api/backstage-plugins-real?search=&category=all&featured=false&installed=false&limit=1000&offset=0`);
        if (registryResponse.ok) {
          const registryData = await registryResponse.json();
          marketplacePlugins = registryData.plugins || [];
          marketplaceCache = marketplacePlugins;
          cacheTime = now;
        } else {
          console.error('Registry API response not OK:', registryResponse.status);
        }
      } catch (fetchError) {
        console.error('Failed to fetch from registry API:', fetchError);
        // Return empty array if registry fails
        marketplacePlugins = [];
      }
    }
    
    // Get installed plugins from database with correct schema
    let installedPlugins = [];
    try {
      installedPlugins = await prisma.plugin.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          isInstalled: true,
          isEnabled: true,
          category: true,
          status: true,
          configurations: {
            where: { environment: 'production' },
            select: { config: true, isActive: true }
          }
        }
      });
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      // Continue with empty array if database fails
      installedPlugins = [];
    }
    
    // Create lookup map for installed plugins
    const installedMap = new Map(installedPlugins.map(p => [p.name, p]));
    
    // Merge marketplace data with database state
    const enrichedPlugins = marketplacePlugins.map(plugin => {
      const dbPlugin = installedMap.get(plugin.id);
      
      return {
        ...plugin,
        installed: dbPlugin?.isInstalled || false,
        enabled: dbPlugin?.isEnabled || false,
        dbStatus: dbPlugin?.status || null,
        hasConfiguration: dbPlugin?.configurations?.length > 0 || false,
        configurationActive: dbPlugin?.configurations?.[0]?.isActive || false
      };
    });
    
    // Apply filters
    let filtered = enrichedPlugins;
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchLower) ||
        p.title?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(searchLower)) ||
        p.author?.toLowerCase().includes(searchLower)
      );
    }
    
    // Category filter
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }
    
    // Featured filter
    if (featured) {
      filtered = filtered.filter(p => p.featured);
    }
    
    // Installed filter
    if (installed) {
      filtered = filtered.filter(p => p.installed);
    }
    
    // Get unique categories for response
    const categories = ['all', ...new Set(enrichedPlugins.map(p => p.category))].sort();
    
    // Apply pagination
    const total = filtered.length;
    const paginatedPlugins = filtered.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      plugins: paginatedPlugins,
      total,
      categories,
      installedCount: enrichedPlugins.filter(p => p.installed).length,
      enabledCount: enrichedPlugins.filter(p => p.installed && p.enabled).length,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
    
  } catch (error) {
    console.error('Failed to fetch marketplace plugins:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch plugins',
      plugins: [],
      total: 0,
      categories: ['all'],
      installedCount: 0,
      enabledCount: 0
    });
  }
}