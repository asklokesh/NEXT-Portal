import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { npmRegistryService } from '@/services/npmRegistry';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/plugins/discovery/featured
export async function GET(request: NextRequest) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First check if we have featured plugins in the database
    const featuredFromDb = await prisma.plugin.findMany({
      where: { isFeatured: true },
      take: 10
    });

    if (featuredFromDb.length > 0) {
      // Return featured plugins from database
      return NextResponse.json(featuredFromDb.map(plugin => ({
        name: plugin.name,
        version: plugin.latestVersion || 'latest',
        description: plugin.description,
        author: plugin.author,
        category: plugin.category.toLowerCase(),
        isBackstagePlugin: plugin.isBackstagePlugin
      })));
    }

    // Otherwise, return curated list of popular Backstage plugins
    const curatedPlugins = [
      '@backstage/plugin-kubernetes',
      '@backstage/plugin-github-actions',
      '@backstage/plugin-jenkins',
      '@backstage/plugin-sonarqube',
      '@backstage/plugin-tech-insights',
      '@backstage/plugin-cost-insights',
      '@backstage/plugin-security-insights',
      '@backstage/plugin-graphql-voyager',
      '@backstage/plugin-api-docs',
      '@backstage/plugin-lighthouse'
    ];

    const featuredPlugins = await Promise.all(curatedPlugins.map(async (pluginName) => {
      try {
        const metadata = await npmRegistryService.fetchPluginMetadata(pluginName);
        return {
          name: metadata.package.name,
          version: metadata.package.version,
          description: metadata.package.description,
          author: metadata.package.author,
          downloads: metadata.popularity.downloads,
          stars: metadata.popularity.stars,
          quality: metadata.quality.score,
          isBackstagePlugin: true
        };
      } catch (error) {
        console.error(`Failed to fetch metadata for ${pluginName}:`, error);
        return null;
      }
    }));

    // Filter out any failed fetches
    const validPlugins = featuredPlugins.filter(p => p !== null);

    return NextResponse.json(validPlugins);
  } catch (error) {
    console.error('Failed to fetch featured plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured plugins' },
      { status: 500 }
    );
  }
}