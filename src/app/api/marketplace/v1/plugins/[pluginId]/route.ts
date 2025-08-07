import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { createAuditLog } from '@/lib/audit/service';

const API_VERSION = 'v1';

/**
 * GET /api/marketplace/v1/plugins/:pluginId
 * Get detailed information about a specific plugin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { pluginId } = params;

    // Fetch plugin details
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        author: true,
        ratings: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!plugin) {
      return NextResponse.json(
        {
          error: {
            code: 'PLUGIN_NOT_FOUND',
            message: `Plugin with ID '${pluginId}' not found`,
          },
          timestamp: new Date().toISOString(),
          requestId,
        },
        {
          status: 404,
          headers: {
            'X-Request-Id': requestId,
            'X-API-Version': API_VERSION,
          },
        }
      );
    }

    // Calculate rating statistics
    const ratingStats = plugin.ratings.reduce(
      (acc, rating) => {
        acc.total += rating.rating;
        acc.count += 1;
        acc.distribution[rating.rating] = (acc.distribution[rating.rating] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        count: 0,
        distribution: {} as Record<number, number>,
      }
    );

    const averageRating = ratingStats.count > 0 ? ratingStats.total / ratingStats.count : 0;

    // Transform plugin to detailed API response
    const response = {
      data: {
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName || plugin.name,
        description: plugin.description,
        longDescription: plugin.longDescription,
        version: plugin.version,
        author: {
          id: plugin.author?.id,
          name: plugin.author?.name || 'Unknown',
          email: plugin.author?.email,
          url: plugin.author?.url,
          verified: plugin.author?.verified || false,
        },
        category: plugin.category,
        tags: plugin.tags || [],
        icon: plugin.icon,
        banner: plugin.banner,
        screenshots: plugin.screenshots || [],
        videos: plugin.videos || [],
        homepage: plugin.homepage,
        repository: plugin.repository,
        documentation: plugin.documentation,
        changelog: plugin.changelog,
        license: plugin.license || 'MIT',
        verified: plugin.verified || false,
        featured: plugin.featured || false,
        rating: {
          average: averageRating,
          count: ratingStats.count,
          distribution: ratingStats.distribution,
          reviews: plugin.ratings.map(rating => ({
            id: rating.id,
            rating: rating.rating,
            title: rating.title,
            review: rating.review,
            user: rating.user,
            createdAt: rating.createdAt.toISOString(),
            helpful: rating.helpful || 0,
          })),
        },
        downloads: {
          total: plugin.downloads || 0,
          monthly: plugin.monthlyDownloads || 0,
          weekly: plugin.weeklyDownloads || 0,
          daily: plugin.dailyDownloads || 0,
        },
        versions: plugin.versions.map(version => ({
          version: version.version,
          releaseDate: version.releaseDate.toISOString(),
          changelog: version.changelog,
          compatibility: version.compatibility,
          deprecated: version.deprecated || false,
        })),
        dependencies: plugin.dependencies || [],
        peerDependencies: plugin.peerDependencies || [],
        compatibility: plugin.compatibility || {
          backstage: '^1.0.0',
          node: '>=18.0.0',
          platform: ['linux', 'darwin', 'win32'],
        },
        configuration: plugin.configuration || {},
        permissions: plugin.permissions || [],
        features: plugin.features || [],
        pricing: plugin.pricing || {
          model: 'free',
        },
        support: {
          email: plugin.supportEmail,
          url: plugin.supportUrl,
          documentation: plugin.documentation,
          issues: plugin.issuesUrl,
          forum: plugin.forumUrl,
        },
        metadata: {
          createdAt: plugin.createdAt.toISOString(),
          updatedAt: plugin.updatedAt.toISOString(),
          publishedAt: plugin.publishedAt?.toISOString() || plugin.createdAt.toISOString(),
          lastChecked: new Date().toISOString(),
          installCommand: `npm install @backstage/plugin-${plugin.name}`,
        },
        stats: {
          stars: plugin.stars || 0,
          forks: plugin.forks || 0,
          issues: plugin.openIssues || 0,
          contributors: plugin.contributors || 1,
          lastCommit: plugin.lastCommit?.toISOString(),
        },
      },
      links: {
        self: `/api/marketplace/v1/plugins/${pluginId}`,
        install: `/api/marketplace/v1/plugins/${pluginId}/install`,
        reviews: `/api/marketplace/v1/plugins/${pluginId}/reviews`,
        versions: `/api/marketplace/v1/plugins/${pluginId}/versions`,
        related: `/api/marketplace/v1/plugins/${pluginId}/related`,
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
      action: 'marketplace.plugin.view',
      resource: 'plugin',
      resourceId: pluginId,
      userId: null,
      details: {
        pluginName: plugin.name,
        responseTime: Date.now() - startTime,
      },
      status: 'success',
    });

    // Set cache headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    headers.set('X-Request-Id', requestId);
    headers.set('X-API-Version', API_VERSION);

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
 * PUT /api/marketplace/v1/plugins/:pluginId
 * Update plugin information (requires authentication)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  const requestId = crypto.randomUUID();

  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Plugin update is not yet implemented',
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
}

/**
 * DELETE /api/marketplace/v1/plugins/:pluginId
 * Remove a plugin from the marketplace (requires authentication)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  const requestId = crypto.randomUUID();

  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Plugin deletion is not yet implemented',
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
}