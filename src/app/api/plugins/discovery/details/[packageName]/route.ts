import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { npmRegistryService } from '@/services/npmRegistry';

// GET /api/plugins/discovery/details/[packageName]
export async function GET(
  request: NextRequest,
  { params }: { params: { packageName: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packageName } = params;
    const decodedPackageName = decodeURIComponent(packageName);
    
    // Get version from query params if specified
    const searchParams = request.nextUrl.searchParams;
    const version = searchParams.get('version') || undefined;

    // Fetch detailed plugin metadata
    const metadata = await npmRegistryService.fetchPluginMetadata(decodedPackageName, version);

    // Transform metadata for frontend
    const pluginDetails = {
      name: metadata.package.name,
      version: metadata.package.version,
      description: metadata.package.description,
      author: metadata.package.author,
      maintainers: metadata.package.maintainers,
      repository: metadata.package.repository,
      homepage: metadata.package.homepage,
      license: metadata.license.license,
      keywords: metadata.package.keywords,
      dependencies: metadata.dependencies.direct,
      devDependencies: metadata.dependencies.dev,
      peerDependencies: metadata.dependencies.peer,
      publishedAt: metadata.lastPublished?.toISOString(),
      downloads: metadata.popularity.downloads,
      stars: metadata.popularity.stars,
      issues: metadata.popularity.issues,
      quality: metadata.quality.score / 100,
      securityScore: metadata.security.score,
      vulnerabilities: metadata.security.vulnerabilities,
      versions: metadata.versions,
      latestVersion: metadata.latestVersion,
      backstageCompatibility: metadata.backstageCompatibility,
      totalDependencies: metadata.dependencies.totalDependencies,
      outdatedDependencies: metadata.dependencies.outdatedDependencies,
      conflictingDependencies: metadata.dependencies.conflictingDependencies,
      missingPeerDependencies: metadata.dependencies.missingPeerDependencies,
      licenseDetails: {
        ...metadata.license,
        compatibilityNote: metadata.license.isCompatible 
          ? 'This license is compatible with commercial use.'
          : 'This license may have restrictions. Please review carefully.'
      },
      qualityMetrics: metadata.quality,
      lastModified: metadata.lastModified?.toISOString()
    };

    return NextResponse.json(pluginDetails);
  } catch (error) {
    console.error('Failed to fetch plugin details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin details' },
      { status: 500 }
    );
  }
}