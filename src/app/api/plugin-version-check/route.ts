/**
 * Plugin Version Check API
 * Checks if updates are available for installed plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafePrismaClient } from '@/lib/db/safe-client';

interface VersionCheckRequest {
  pluginName: string;
  currentVersion?: string;
}

interface VersionCheckResponse {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  changelog?: string;
  updateUrgency?: 'low' | 'medium' | 'high' | 'critical';
}

// Mock function to simulate checking NPM registry for latest version
async function getLatestVersionFromRegistry(pluginName: string): Promise<{
  version: string;
  releaseDate?: string;
  changelog?: string;
  updateUrgency?: 'low' | 'medium' | 'high' | 'critical';
}> {
  // In a real implementation, this would call NPM registry API
  // For now, simulate version checking with realistic mock data
  
  const mockVersionData = {
    '@backstage/plugin-catalog': {
      version: '1.15.2',
      releaseDate: '2024-01-15',
      changelog: 'Bug fixes and performance improvements',
      updateUrgency: 'medium' as const
    },
    '@backstage/plugin-techdocs': {
      version: '1.9.4',
      releaseDate: '2024-01-10',
      changelog: 'Security patches and new documentation features',
      updateUrgency: 'high' as const
    },
    '@backstage/plugin-kubernetes': {
      version: '0.11.3',
      releaseDate: '2024-01-20',
      changelog: 'Critical security fixes for cluster management',
      updateUrgency: 'critical' as const
    },
    // Default for unknown plugins
    default: {
      version: '1.0.1',
      releaseDate: new Date().toISOString().split('T')[0],
      changelog: 'Latest stable version with bug fixes',
      updateUrgency: 'low' as const
    }
  };

  return mockVersionData[pluginName as keyof typeof mockVersionData] || mockVersionData.default;
}

// Compare semantic versions (simplified)
function isNewerVersion(current: string, latest: string): boolean {
  const parseVersion = (v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '');
    return cleaned.split('.').map(n => parseInt(n) || 0);
  };
  
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    
    if (lat > curr) return true;
    if (lat < curr) return false;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { pluginName, currentVersion }: VersionCheckRequest = await request.json();
    
    if (!pluginName) {
      return NextResponse.json({
        success: false,
        error: 'Plugin name is required'
      }, { status: 400 });
    }
    
    // Get latest version from registry
    const latestVersionInfo = await getLatestVersionFromRegistry(pluginName);
    
    // If no current version provided, assume update is available
    if (!currentVersion) {
      return NextResponse.json({
        success: true,
        hasUpdate: true,
        currentVersion: 'unknown',
        latestVersion: latestVersionInfo.version,
        releaseDate: latestVersionInfo.releaseDate,
        changelog: latestVersionInfo.changelog,
        updateUrgency: latestVersionInfo.updateUrgency
      });
    }
    
    // Compare versions
    const hasUpdate = isNewerVersion(currentVersion, latestVersionInfo.version);
    
    const response: VersionCheckResponse = {
      hasUpdate,
      currentVersion,
      latestVersion: latestVersionInfo.version,
      releaseDate: latestVersionInfo.releaseDate,
      changelog: latestVersionInfo.changelog,
      updateUrgency: latestVersionInfo.updateUrgency
    };
    
    return NextResponse.json({
      success: true,
      ...response
    });
    
  } catch (error) {
    console.error('Version check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check plugin version'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'check-all';
    
    if (action === 'check-all') {
      // Check all installed plugins for updates
      const prisma = getSafePrismaClient();
      
      const plugins = await prisma.plugin.findMany({
        where: {
          isInstalled: true
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          updatedAt: true,
          versions: {
            where: {
              isCurrent: true
            },
            select: {
              version: true
            },
            take: 1
          }
        }
      });
      
      const versionChecks = await Promise.all(
        plugins.map(async (plugin) => {
          try {
            const currentVersion = plugin.versions[0]?.version || 'unknown';
            const latestVersionInfo = await getLatestVersionFromRegistry(plugin.name);
            const hasUpdate = currentVersion !== 'unknown' 
              ? isNewerVersion(currentVersion, latestVersionInfo.version)
              : true;
            
            return {
              pluginId: plugin.id,
              pluginName: plugin.name,
              displayName: plugin.displayName,
              currentVersion,
              latestVersion: latestVersionInfo.version,
              hasUpdate,
              releaseDate: latestVersionInfo.releaseDate,
              changelog: latestVersionInfo.changelog,
              updateUrgency: latestVersionInfo.updateUrgency,
              lastChecked: new Date().toISOString()
            };
          } catch (error) {
            console.error(`Failed to check version for ${plugin.name}:`, error);
            return {
              pluginId: plugin.id,
              pluginName: plugin.name,
              displayName: plugin.displayName,
              currentVersion: plugin.versions[0]?.version || 'unknown',
              latestVersion: 'unknown',
              hasUpdate: false,
              error: 'Version check failed',
              lastChecked: new Date().toISOString()
            };
          }
        })
      );
      
      const updatesAvailable = versionChecks.filter(check => check.hasUpdate).length;
      
      return NextResponse.json({
        success: true,
        totalPlugins: plugins.length,
        updatesAvailable,
        plugins: versionChecks
      });
    }
    
    // Single plugin check
    const pluginName = searchParams.get('pluginName');
    const currentVersion = searchParams.get('currentVersion');
    
    if (!pluginName) {
      return NextResponse.json({
        success: false,
        error: 'Plugin name is required'
      }, { status: 400 });
    }
    
    const latestVersionInfo = await getLatestVersionFromRegistry(pluginName);
    const hasUpdate = currentVersion 
      ? isNewerVersion(currentVersion, latestVersionInfo.version)
      : true;
    
    return NextResponse.json({
      success: true,
      hasUpdate,
      currentVersion: currentVersion || 'unknown',
      latestVersion: latestVersionInfo.version,
      releaseDate: latestVersionInfo.releaseDate,
      changelog: latestVersionInfo.changelog,
      updateUrgency: latestVersionInfo.updateUrgency
    });
    
  } catch (error) {
    console.error('Version check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check plugin versions'
    }, { status: 500 });
  }
}