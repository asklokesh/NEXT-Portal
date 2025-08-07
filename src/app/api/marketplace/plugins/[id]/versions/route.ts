import { NextRequest, NextResponse } from 'next/server';

interface PluginVersion {
  version: string;
  publishedAt: string;
  compatibility: {
    backstage: string;
    node: string;
  };
  deprecated?: boolean;
  prerelease?: boolean;
  changelog?: string;
  downloads: number;
  size: number;
  dependencies: Record<string, string>;
}

// Mock version data
const getPluginVersions = (pluginId: string): PluginVersion[] => {
  return [
    {
      version: '0.6.15',
      publishedAt: '2024-01-15T10:00:00Z',
      compatibility: {
        backstage: '>=1.20.0',
        node: '>=18.0.0'
      },
      downloads: 45000,
      size: 2515456,
      dependencies: {
        '@backstage/core-plugin-api': '^1.5.0',
        '@backstage/catalog-model': '^1.3.0'
      },
      changelog: '### Features\n- Added support for workflow dispatch\n- Improved error handling\n\n### Bug Fixes\n- Fixed pagination issue'
    },
    {
      version: '0.6.14',
      publishedAt: '2024-01-10T10:00:00Z',
      compatibility: {
        backstage: '>=1.19.0',
        node: '>=18.0.0'
      },
      downloads: 38000,
      size: 2485456,
      dependencies: {
        '@backstage/core-plugin-api': '^1.4.0',
        '@backstage/catalog-model': '^1.3.0'
      },
      changelog: '### Features\n- Added artifact download support\n\n### Bug Fixes\n- Fixed memory leak in workflow monitoring'
    },
    {
      version: '0.6.13',
      publishedAt: '2024-01-05T10:00:00Z',
      compatibility: {
        backstage: '>=1.19.0',
        node: '>=16.0.0'
      },
      downloads: 32000,
      size: 2465456,
      dependencies: {
        '@backstage/core-plugin-api': '^1.4.0',
        '@backstage/catalog-model': '^1.2.0'
      },
      changelog: '### Bug Fixes\n- Fixed authentication issues\n- Improved performance'
    },
    {
      version: '0.7.0-beta.1',
      publishedAt: '2024-01-20T10:00:00Z',
      compatibility: {
        backstage: '>=1.21.0',
        node: '>=18.0.0'
      },
      prerelease: true,
      downloads: 1200,
      size: 2615456,
      dependencies: {
        '@backstage/core-plugin-api': '^1.6.0',
        '@backstage/catalog-model': '^1.4.0'
      },
      changelog: '### Breaking Changes\n- New API structure\n\n### Features\n- GitHub App authentication support\n- Advanced workflow analytics'
    }
  ];
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const { searchParams } = new URL(request.url);
    
    const includePrerelease = searchParams.get('includePrerelease') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let versions = getPluginVersions(pluginId);
    
    // Filter out prereleases if not requested
    if (!includePrerelease) {
      versions = versions.filter(v => !v.prerelease);
    }
    
    // Apply pagination
    const total = versions.length;
    versions = versions.slice(offset, offset + limit);
    
    return NextResponse.json({
      pluginId,
      versions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
    
  } catch (error) {
    console.error('Failed to fetch plugin versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin versions' },
      { status: 500 }
    );
  }
}