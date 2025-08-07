import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { withRateLimit } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/audit/service';

// API Version
const API_VERSION = 'v1';

// Query parameters schema
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  sort: z.enum(['name', 'popularity', 'updated', 'rating']).default('popularity'),
  order: z.enum(['asc', 'desc']).default('desc'),
  verified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  compatibility: z.string().optional(),
});

// Plugin response schema
const PluginResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }),
  category: z.string(),
  tags: z.array(z.string()),
  icon: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  documentation: z.string().url().optional(),
  license: z.string(),
  verified: z.boolean(),
  featured: z.boolean(),
  rating: z.object({
    average: z.number(),
    count: z.number(),
  }),
  downloads: z.number(),
  dependencies: z.array(z.object({
    name: z.string(),
    version: z.string(),
  })).optional(),
  compatibility: z.object({
    backstage: z.string(),
    node: z.string(),
    platform: z.array(z.string()),
  }),
  pricing: z.object({
    model: z.enum(['free', 'paid', 'freemium', 'subscription']),
    price: z.number().optional(),
    currency: z.string().optional(),
    billingPeriod: z.enum(['monthly', 'yearly', 'one-time']).optional(),
  }),
  metadata: z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    publishedAt: z.string().datetime(),
    lastChecked: z.string().datetime(),
  }),
});

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime(),
  requestId: z.string(),
});

/**
 * GET /api/marketplace/v1/plugins
 * List available plugins with filtering, sorting, and pagination
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = QuerySchema.parse(searchParams);

    // Build filter conditions
    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.tags) {
      const tags = query.tags.split(',');
      where.tags = { hasSome: tags };
    }

    if (query.verified !== undefined) {
      where.verified = query.verified;
    }

    if (query.featured !== undefined) {
      where.featured = query.featured;
    }

    if (query.minRating) {
      where.rating = { gte: query.minRating };
    }

    if (query.compatibility) {
      where.compatibility = { contains: query.compatibility };
    }

    // Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // Build sort options
    const orderBy: any = {};
    switch (query.sort) {
      case 'name':
        orderBy.name = query.order;
        break;
      case 'popularity':
        orderBy.downloads = query.order;
        break;
      case 'updated':
        orderBy.updatedAt = query.order;
        break;
      case 'rating':
        orderBy.rating = query.order;
        break;
    }

    // Fetch plugins from database
    const [plugins, total] = await Promise.all([
      prisma.plugin.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
        include: {
          author: true,
          ratings: {
            select: {
              rating: true,
            },
          },
        },
      }),
      prisma.plugin.count({ where }),
    ]);

    // Transform plugins to API response format
    const transformedPlugins = plugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.displayName || plugin.name,
      description: plugin.description,
      version: plugin.version,
      author: {
        name: plugin.author?.name || 'Unknown',
        email: plugin.author?.email,
        url: plugin.author?.url,
      },
      category: plugin.category,
      tags: plugin.tags || [],
      icon: plugin.icon,
      screenshots: plugin.screenshots || [],
      homepage: plugin.homepage,
      repository: plugin.repository,
      documentation: plugin.documentation,
      license: plugin.license || 'MIT',
      verified: plugin.verified || false,
      featured: plugin.featured || false,
      rating: {
        average: plugin.ratings.length > 0
          ? plugin.ratings.reduce((sum, r) => sum + r.rating, 0) / plugin.ratings.length
          : 0,
        count: plugin.ratings.length,
      },
      downloads: plugin.downloads || 0,
      dependencies: plugin.dependencies || [],
      compatibility: plugin.compatibility || {
        backstage: '^1.0.0',
        node: '>=18.0.0',
        platform: ['linux', 'darwin', 'win32'],
      },
      pricing: plugin.pricing || {
        model: 'free',
      },
      metadata: {
        createdAt: plugin.createdAt.toISOString(),
        updatedAt: plugin.updatedAt.toISOString(),
        publishedAt: plugin.publishedAt?.toISOString() || plugin.createdAt.toISOString(),
        lastChecked: new Date().toISOString(),
      },
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / query.limit);
    const hasNextPage = query.page < totalPages;
    const hasPrevPage = query.page > 1;

    // Create response
    const response = {
      data: transformedPlugins,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      links: {
        self: `/api/marketplace/v1/plugins?page=${query.page}&limit=${query.limit}`,
        first: `/api/marketplace/v1/plugins?page=1&limit=${query.limit}`,
        last: `/api/marketplace/v1/plugins?page=${totalPages}&limit=${query.limit}`,
        next: hasNextPage ? `/api/marketplace/v1/plugins?page=${query.page + 1}&limit=${query.limit}` : null,
        prev: hasPrevPage ? `/api/marketplace/v1/plugins?page=${query.page - 1}&limit=${query.limit}` : null,
      },
      metadata: {
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        requestId,
        responseTime: Date.now() - startTime,
      },
    };

    // Log API access
    await createAuditLog({
      action: 'marketplace.plugins.list',
      resource: 'marketplace',
      resourceId: null,
      userId: null,
      details: {
        query,
        resultCount: transformedPlugins.length,
        responseTime: Date.now() - startTime,
      },
      status: 'success',
    });

    // Set cache headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    headers.set('X-Request-Id', requestId);
    headers.set('X-API-Version', API_VERSION);
    headers.set('X-RateLimit-Limit', '1000');
    headers.set('X-RateLimit-Remaining', '999');
    headers.set('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());

    return new NextResponse(JSON.stringify(response, null, 2), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Marketplace API error:', error);

    const errorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    await createAuditLog({
      action: 'marketplace.plugins.list',
      resource: 'marketplace',
      resourceId: null,
      userId: null,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      status: 'error',
    });

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'X-Request-Id': requestId,
        'X-API-Version': API_VERSION,
      },
    });
  }
}

/**
 * POST /api/marketplace/v1/plugins
 * Submit a new plugin to the marketplace (requires authentication)
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // This endpoint would require authentication and authorization
    // For now, return a 501 Not Implemented
    return NextResponse.json(
      {
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Plugin submission is not yet implemented',
        },
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: 501,
        headers: {
          'X-Request-Id': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        timestamp: new Date().toISOString(),
        requestId,
      },
      {
        status: 500,
        headers: {
          'X-Request-Id': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  }
}