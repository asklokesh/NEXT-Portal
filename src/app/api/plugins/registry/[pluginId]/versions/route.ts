// Plugin Version Management API
// Handles plugin version discovery, comparison, and upgrade paths

import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedPluginRegistry } from '@/services/backstage/enhanced-plugin-registry';
import semver from 'semver';
import axios from 'axios';

interface PluginVersion {
  version: string;
  publishedAt: string;
  deprecated?: boolean;
  securityVulnerabilities?: number;
  compatibilityScore?: number;
  changelogUrl?: string;
  releaseNotes?: string;
  breaking?: boolean;
}

// GET /api/plugins/registry/[pluginId]/versions - Get all available versions
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const { searchParams } = new URL(request.url);
    const includePrerelease = searchParams.get('prerelease') === 'true';
    const includeDeprecated = searchParams.get('deprecated') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const registry = getEnhancedPluginRegistry();
    
    // Find the plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Fetch version information from NPM registry
    const versions = await fetchPluginVersions(plugin.name, {
      includePrerelease,
      includeDeprecated,
      limit
    });

    // Analyze versions for compatibility and security
    const analyzedVersions = await analyzeVersions(versions, plugin);

    // Find upgrade path if current version is available
    const currentVersion = plugin.version;
    const upgradePath = generateUpgradePath(currentVersion, analyzedVersions);

    return NextResponse.json({
      success: true,
      data: {
        plugin: {
          id: plugin.id,
          name: plugin.name,
          currentVersion
        },
        versions: analyzedVersions,
        upgradePath,
        recommendations: generateVersionRecommendations(analyzedVersions, currentVersion),
        metadata: {
          total: analyzedVersions.length,
          latest: analyzedVersions[0]?.version,
          latestStable: analyzedVersions.find(v => !v.version.includes('-'))?.version,
          retrievedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error(`Version fetch error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch versions'
    }, { status: 500 });
  }
}

// POST /api/plugins/registry/[pluginId]/versions/compare - Compare two versions
export async function POST(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const body = await request.json();
    const { fromVersion, toVersion } = body;

    if (!fromVersion || !toVersion) {
      return NextResponse.json({
        success: false,
        error: 'Both fromVersion and toVersion are required'
      }, { status: 400 });
    }

    const registry = getEnhancedPluginRegistry();
    
    // Find the plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Perform version comparison
    const comparison = await compareVersions(plugin.name, fromVersion, toVersion);

    return NextResponse.json({
      success: true,
      data: {
        plugin: {
          id: plugin.id,
          name: plugin.name
        },
        fromVersion,
        toVersion,
        comparison,
        comparedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`Version comparison error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare versions'
    }, { status: 500 });
  }
}

// Helper functions

async function fetchPluginVersions(
  packageName: string, 
  options: { includePrerelease: boolean; includeDeprecated: boolean; limit: number }
): Promise<PluginVersion[]> {
  try {
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${packageName}`, {
      timeout: 30000
    });

    const packageData = response.data;
    const versions: PluginVersion[] = [];

    // Process all versions
    for (const [version, versionData] of Object.entries(packageData.versions as Record<string, any>)) {
      // Skip prerelease versions if not requested
      if (!options.includePrerelease && semver.prerelease(version)) {
        continue;
      }

      // Skip deprecated versions if not requested
      if (!options.includeDeprecated && versionData.deprecated) {
        continue;
      }

      versions.push({
        version,
        publishedAt: packageData.time?.[version] || new Date().toISOString(),
        deprecated: versionData.deprecated || false,
        securityVulnerabilities: 0, // Would be populated by security scan
        changelogUrl: versionData.repository?.url ? 
          `${versionData.repository.url.replace('.git', '')}/blob/main/CHANGELOG.md` : 
          undefined
      });
    }

    // Sort versions by semver (latest first)
    versions.sort((a, b) => semver.rcompare(a.version, b.version));

    // Apply limit
    return versions.slice(0, options.limit);

  } catch (error) {
    console.error('Error fetching plugin versions:', error);
    return [];
  }
}

async function analyzeVersions(versions: PluginVersion[], plugin: any): Promise<PluginVersion[]> {
  const registry = getEnhancedPluginRegistry();

  return Promise.all(versions.map(async (version) => {
    try {
      // Create a temporary plugin object for this version
      const versionPlugin = { ...plugin, version: version.version };
      
      // Check compatibility
      const compatibilityCheck = await registry.validateCompatibility(versionPlugin, {
        backstageVersion: process.env.BACKSTAGE_VERSION || '1.20.0',
        nodeVersion: process.version
      });

      // Calculate compatibility score
      const compatibilityScore = compatibilityCheck.compatible ? 
        1 - (compatibilityCheck.issues.length * 0.1) : 0;

      // Check for breaking changes (simplified)
      const breaking = await hasBreakingChanges(plugin.name, version.version);

      return {
        ...version,
        compatibilityScore,
        breaking
      };
    } catch (error) {
      console.warn(`Failed to analyze version ${version.version}:`, error);
      return version;
    }
  }));
}

async function hasBreakingChanges(packageName: string, version: string): Promise<boolean> {
  try {
    // In a real implementation, this would parse changelog or analyze API differences
    // For now, we'll use semver major version changes as a proxy
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    const response = await axios.get(`${npmRegistryUrl}/${packageName}/${version}`, {
      timeout: 10000
    });

    const packageData = response.data;
    
    // Check if this is a major version bump
    const previousVersions = Object.keys(packageData.versions || {})
      .filter(v => semver.lt(v, version))
      .sort(semver.rcompare);

    if (previousVersions.length > 0) {
      const previousMajor = semver.major(previousVersions[0]);
      const currentMajor = semver.major(version);
      return currentMajor > previousMajor;
    }

    return false;
  } catch (error) {
    return false; // Conservative approach
  }
}

function generateUpgradePath(currentVersion: string, versions: PluginVersion[]): any {
  if (!currentVersion) return null;

  const upgradableVersions = versions.filter(v => 
    semver.gt(v.version, currentVersion) && !v.deprecated
  );

  if (upgradableVersions.length === 0) {
    return {
      canUpgrade: false,
      reason: 'No newer versions available or all newer versions are deprecated'
    };
  }

  // Find the best upgrade targets
  const latest = upgradableVersions[0];
  const latestStable = upgradableVersions.find(v => !semver.prerelease(v.version));
  const nextMinor = upgradableVersions.find(v => 
    semver.major(v.version) === semver.major(currentVersion) &&
    semver.minor(v.version) > semver.minor(currentVersion)
  );
  const nextPatch = upgradableVersions.find(v => 
    semver.major(v.version) === semver.major(currentVersion) &&
    semver.minor(v.version) === semver.minor(currentVersion) &&
    semver.patch(v.version) > semver.patch(currentVersion)
  );

  return {
    canUpgrade: true,
    currentVersion,
    targets: {
      latest,
      latestStable,
      nextMinor,
      nextPatch
    },
    recommendations: {
      safest: nextPatch || nextMinor || latestStable,
      recommended: latestStable || latest,
      bleeding: latest
    }
  };
}

function generateVersionRecommendations(versions: PluginVersion[], currentVersion?: string): any {
  const recommendations = [];

  const latestStable = versions.find(v => !semver.prerelease(v.version) && !v.deprecated);
  const highestCompatibility = versions.reduce((best, current) => 
    (!best || (current.compatibilityScore || 0) > (best.compatibilityScore || 0)) ? current : best
  );

  if (latestStable) {
    recommendations.push({
      type: 'stable',
      version: latestStable.version,
      reason: 'Latest stable version with good compatibility',
      priority: 'high'
    });
  }

  if (highestCompatibility && highestCompatibility !== latestStable) {
    recommendations.push({
      type: 'compatibility',
      version: highestCompatibility.version,
      reason: `Best compatibility score (${(highestCompatibility.compatibilityScore || 0).toFixed(2)})`,
      priority: 'medium'
    });
  }

  // Warn about deprecated current version
  if (currentVersion) {
    const current = versions.find(v => v.version === currentVersion);
    if (current?.deprecated) {
      recommendations.push({
        type: 'upgrade-required',
        version: latestStable?.version || versions[0]?.version,
        reason: 'Current version is deprecated',
        priority: 'critical'
      });
    }
  }

  return recommendations;
}

async function compareVersions(packageName: string, fromVersion: string, toVersion: string): Promise<any> {
  try {
    const npmRegistryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
    
    // Fetch both versions
    const [fromResponse, toResponse] = await Promise.all([
      axios.get(`${npmRegistryUrl}/${packageName}/${fromVersion}`, { timeout: 10000 }),
      axios.get(`${npmRegistryUrl}/${packageName}/${toVersion}`, { timeout: 10000 })
    ]);

    const fromData = fromResponse.data;
    const toData = toResponse.data;

    // Compare versions
    const versionComparison = semver.compare(fromVersion, toVersion);
    const isUpgrade = versionComparison < 0;
    const isDowngrade = versionComparison > 0;
    const isSame = versionComparison === 0;

    // Analyze differences
    const differences = {
      dependencies: compareDependencies(fromData.dependencies || {}, toData.dependencies || {}),
      peerDependencies: compareDependencies(fromData.peerDependencies || {}, toData.peerDependencies || {}),
      size: {
        from: estimatePackageSize(fromData),
        to: estimatePackageSize(toData),
        change: estimatePackageSize(toData) - estimatePackageSize(fromData)
      },
      compatibility: {
        fromBackstageVersion: fromData.peerDependencies?.['@backstage/core-plugin-api'],
        toBackstageVersion: toData.peerDependencies?.['@backstage/core-plugin-api'],
        breaking: semver.major(toVersion) > semver.major(fromVersion)
      }
    };

    // Generate migration notes
    const migrationNotes = generateMigrationNotes(fromVersion, toVersion, differences);

    return {
      type: isSame ? 'same' : isUpgrade ? 'upgrade' : 'downgrade',
      semverDiff: semver.diff(fromVersion, toVersion),
      differences,
      migrationNotes,
      risks: assessUpgradeRisks(differences),
      recommendations: generateUpgradeRecommendations(differences, isUpgrade)
    };

  } catch (error) {
    throw new Error(`Failed to compare versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function compareDependencies(from: Record<string, string>, to: Record<string, string>): any {
  const added = [];
  const removed = [];
  const changed = [];

  const allDeps = new Set([...Object.keys(from), ...Object.keys(to)]);

  for (const dep of allDeps) {
    if (!(dep in from) && dep in to) {
      added.push({ name: dep, version: to[dep] });
    } else if (dep in from && !(dep in to)) {
      removed.push({ name: dep, version: from[dep] });
    } else if (from[dep] !== to[dep]) {
      changed.push({ name: dep, from: from[dep], to: to[dep] });
    }
  }

  return { added, removed, changed };
}

function estimatePackageSize(packageData: any): number {
  // Rough estimation based on dependencies count
  const depCount = Object.keys(packageData.dependencies || {}).length;
  const peerDepCount = Object.keys(packageData.peerDependencies || {}).length;
  
  // Base size + dependency overhead
  return 1 + (depCount * 0.1) + (peerDepCount * 0.05);
}

function generateMigrationNotes(fromVersion: string, toVersion: string, differences: any): string[] {
  const notes = [];

  if (differences.compatibility.breaking) {
    notes.push(`⚠️  This is a major version upgrade (${semver.major(fromVersion)} → ${semver.major(toVersion)}) and may contain breaking changes`);
  }

  if (differences.dependencies.added.length > 0) {
    notes.push(`📦 ${differences.dependencies.added.length} new dependencies will be added`);
  }

  if (differences.dependencies.removed.length > 0) {
    notes.push(`🗑️  ${differences.dependencies.removed.length} dependencies will be removed`);
  }

  if (differences.compatibility.fromBackstageVersion !== differences.compatibility.toBackstageVersion) {
    notes.push(`🔧 Backstage version compatibility changed: ${differences.compatibility.fromBackstageVersion} → ${differences.compatibility.toBackstageVersion}`);
  }

  if (differences.size.change > 0.5) {
    notes.push(`📈 Package size will increase by ~${Math.round(differences.size.change * 100)}%`);
  } else if (differences.size.change < -0.5) {
    notes.push(`📉 Package size will decrease by ~${Math.round(Math.abs(differences.size.change) * 100)}%`);
  }

  return notes;
}

function assessUpgradeRisks(differences: any): Array<{type: string, level: string, description: string}> {
  const risks = [];

  if (differences.compatibility.breaking) {
    risks.push({
      type: 'breaking-changes',
      level: 'high',
      description: 'Major version upgrade may introduce breaking changes'
    });
  }

  if (differences.dependencies.removed.length > 0) {
    risks.push({
      type: 'dependency-removal',
      level: 'medium',
      description: `${differences.dependencies.removed.length} dependencies will be removed`
    });
  }

  if (differences.size.change > 1) {
    risks.push({
      type: 'bundle-size',
      level: 'low',
      description: 'Significant increase in package size'
    });
  }

  return risks;
}

function generateUpgradeRecommendations(differences: any, isUpgrade: boolean): string[] {
  const recommendations = [];

  if (!isUpgrade) {
    recommendations.push('Consider if downgrading is necessary - you may lose features and security fixes');
    return recommendations;
  }

  recommendations.push('Review the changelog for detailed changes');

  if (differences.compatibility.breaking) {
    recommendations.push('Test thoroughly in a development environment before applying to production');
    recommendations.push('Review migration guide if available');
  }

  if (differences.dependencies.added.length > 0) {
    recommendations.push('Verify that new dependencies are compatible with your environment');
  }

  recommendations.push('Create a backup of your current configuration');
  recommendations.push('Monitor the application after upgrade for any issues');

  return recommendations;
}