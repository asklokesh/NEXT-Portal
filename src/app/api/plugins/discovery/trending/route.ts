import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { npmRegistryService } from '@/services/npmRegistry';

// GET /api/plugins/discovery/trending
export async function GET(request: NextRequest) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Search for popular Backstage plugins
    const searchResults = await npmRegistryService.searchBackstagePlugins('@backstage/plugin', {
      size: 20,
      popularity: 1.0, // High weight on popularity
      quality: 0.3,
      maintenance: 0.3
    });

    // Calculate trending score based on recent downloads and growth
    const trendingPlugins = await Promise.all(searchResults.map(async (result) => {
      const plugin = result.package;
      
      // Mock trending calculation (in production, you'd compare with historical data)
      const trendingScore = (plugin.popularity || 0) * 100 + 
                          (plugin.downloads || 0) / 1000 +
                          (plugin.stars || 0) / 10;

      return {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        downloads: {
          weekly: plugin.downloads || 0,
          monthly: (plugin.downloads || 0) * 4,
          yearly: (plugin.downloads || 0) * 52,
          growth: Math.round(Math.random() * 50) // Mock growth percentage
        },
        stars: plugin.stars,
        trendingScore,
        isBackstagePlugin: result.isBackstagePlugin
      };
    }));

    // Sort by trending score and take top 10
    trendingPlugins.sort((a, b) => b.trendingScore - a.trendingScore);
    const topTrending = trendingPlugins.slice(0, 10);

    return NextResponse.json(topTrending);
  } catch (error) {
    console.error('Failed to fetch trending plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending plugins' },
      { status: 500 }
    );
  }
}