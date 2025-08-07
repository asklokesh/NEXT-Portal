import { NextRequest, NextResponse } from 'next/server';

interface PluginDependency {
  id: string;
  name: string;
  version: string;
  type: 'peer' | 'dev' | 'runtime' | 'optional';
  required: boolean;
  description?: string;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  dependencies: PluginDependency[];
  peerDependencies: PluginDependency[];
  devDependencies: PluginDependency[];
  backstageVersion?: string;
  nodeVersion?: string;
  conflicts?: string[];
  category: string;
}

interface DependencyResolution {
  pluginId: string;
  dependencies: PluginDependency[];
  conflicts: Array<{
    plugin: string;
    reason: string;
    severity: 'warning' | 'error';
  }>;
  recommendations: Array<{
    plugin: string;
    reason: string;
    type: 'install' | 'upgrade' | 'downgrade';
  }>;
  installOrder: string[];
  totalSize: number;
}

// Mock plugin dependency data
const PLUGIN_DEPENDENCIES: Record<string, PluginInfo> = {
  '@backstage/plugin-catalog': {
    id: '@backstage/plugin-catalog',
    name: 'Software Catalog',
    version: '1.15.0',
    category: 'core',
    backstageVersion: '^1.20.0',
    nodeVersion: '>=18.0.0',
    dependencies: [
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '^1.8.0',
        type: 'runtime',
        required: true,
        description: 'Core plugin API for Backstage'
      },
      {
        id: '@backstage/catalog-model',
        name: 'Catalog Model',
        version: '^1.4.3',
        type: 'runtime',
        required: true,
        description: 'Catalog data model and types'
      }
    ],
    peerDependencies: [
      {
        id: 'react',
        name: 'React',
        version: '^17.0.0 || ^18.0.0',
        type: 'peer',
        required: true,
        description: 'React library for UI components'
      }
    ],
    devDependencies: []
  },
  '@backstage/plugin-kubernetes': {
    id: '@backstage/plugin-kubernetes',
    name: 'Kubernetes',
    version: '0.11.0',
    category: 'infrastructure',
    backstageVersion: '^1.20.0',
    nodeVersion: '>=18.0.0',
    dependencies: [
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '^1.8.0',
        type: 'runtime',
        required: true
      },
      {
        id: '@kubernetes/client-node',
        name: 'Kubernetes Client',
        version: '^0.20.0',
        type: 'runtime',
        required: true,
        description: 'Official Kubernetes client for Node.js'
      }
    ],
    peerDependencies: [
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        version: '^1.15.0',
        type: 'peer',
        required: true,
        description: 'Required for entity annotations'
      }
    ],
    devDependencies: []
  },
  '@backstage/plugin-techdocs': {
    id: '@backstage/plugin-techdocs',
    name: 'TechDocs',
    version: '1.10.0',
    category: 'documentation',
    backstageVersion: '^1.20.0',
    nodeVersion: '>=18.0.0',
    dependencies: [
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '^1.8.0',
        type: 'runtime',
        required: true
      },
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        version: '^1.15.0',
        type: 'runtime',
        required: true,
        description: 'Required for entity integration'
      },
      {
        id: '@techdocs/cli',
        name: 'TechDocs CLI',
        version: '^1.8.0',
        type: 'dev',
        required: false,
        description: 'CLI tool for building documentation'
      }
    ],
    peerDependencies: [],
    devDependencies: []
  },
  '@roadiehq/backstage-plugin-github-actions': {
    id: '@roadiehq/backstage-plugin-github-actions',
    name: 'GitHub Actions',
    version: '2.3.2',
    category: 'ci-cd',
    backstageVersion: '^1.20.0',
    nodeVersion: '>=18.0.0',
    dependencies: [
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '^1.8.0',
        type: 'runtime',
        required: true
      },
      {
        id: '@octokit/rest',
        name: 'GitHub REST API',
        version: '^20.0.0',
        type: 'runtime',
        required: true,
        description: 'GitHub API client'
      }
    ],
    peerDependencies: [
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        version: '^1.15.0',
        type: 'peer',
        required: true,
        description: 'Required for GitHub repository annotations'
      }
    ],
    devDependencies: [],
    conflicts: ['@backstage/plugin-jenkins']
  },
  '@backstage/plugin-jenkins': {
    id: '@backstage/plugin-jenkins',
    name: 'Jenkins',
    version: '0.9.0',
    category: 'ci-cd',
    backstageVersion: '^1.20.0',
    nodeVersion: '>=18.0.0',
    dependencies: [
      {
        id: '@backstage/core-plugin-api',
        name: 'Core Plugin API',
        version: '^1.8.0',
        type: 'runtime',
        required: true
      },
      {
        id: 'jenkins',
        name: 'Jenkins API',
        version: '^1.0.0',
        type: 'runtime',
        required: true,
        description: 'Jenkins API client'
      }
    ],
    peerDependencies: [
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        version: '^1.15.0',
        type: 'peer',
        required: true
      }
    ],
    devDependencies: [],
    conflicts: ['@roadiehq/backstage-plugin-github-actions']
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginIds = searchParams.get('plugins')?.split(',') || [];
    const action = searchParams.get('action') || 'resolve';

    if (action === 'info' && pluginIds.length === 1) {
      const pluginId = pluginIds[0];
      const pluginInfo = PLUGIN_DEPENDENCIES[pluginId];
      
      if (!pluginInfo) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        plugin: pluginInfo
      });
    }

    if (action === 'resolve') {
      const resolutions: DependencyResolution[] = [];

      for (const pluginId of pluginIds) {
        const pluginInfo = PLUGIN_DEPENDENCIES[pluginId];
        if (!pluginInfo) continue;

        const resolution = await resolvePluginDependencies(pluginId, pluginInfo, pluginIds);
        resolutions.push(resolution);
      }

      // Check for conflicts between selected plugins
      const globalConflicts = checkGlobalConflicts(pluginIds);

      return NextResponse.json({
        success: true,
        resolutions,
        globalConflicts,
        summary: {
          totalPlugins: pluginIds.length,
          totalDependencies: resolutions.reduce((sum, r) => sum + r.dependencies.length, 0),
          totalConflicts: resolutions.reduce((sum, r) => sum + r.conflicts.length, 0) + globalConflicts.length,
          estimatedSize: resolutions.reduce((sum, r) => sum + r.totalSize, 0)
        }
      });
    }

    if (action === 'recommend') {
      const recommendations = generateRecommendations(pluginIds);
      
      return NextResponse.json({
        success: true,
        recommendations
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error resolving plugin dependencies:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { plugins, backstageVersion } = await request.json();

    if (!plugins || !Array.isArray(plugins)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid plugins array'
      }, { status: 400 });
    }

    // Validate compatibility with Backstage version
    const compatibilityCheck = checkBackstageCompatibility(plugins, backstageVersion);

    return NextResponse.json({
      success: true,
      compatibility: compatibilityCheck
    });

  } catch (error) {
    console.error('Error checking plugin compatibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function resolvePluginDependencies(
  pluginId: string, 
  pluginInfo: PluginInfo, 
  selectedPlugins: string[]
): Promise<DependencyResolution> {
  const allDependencies = [
    ...pluginInfo.dependencies,
    ...pluginInfo.peerDependencies,
    ...pluginInfo.devDependencies.filter(dep => dep.required)
  ];

  const conflicts: DependencyResolution['conflicts'] = [];
  const recommendations: DependencyResolution['recommendations'] = [];
  const installOrder: string[] = [];

  // Check for version conflicts
  for (const dep of allDependencies) {
    const conflictingPlugin = selectedPlugins.find(p => 
      PLUGIN_DEPENDENCIES[p]?.conflicts?.includes(dep.id)
    );
    
    if (conflictingPlugin) {
      conflicts.push({
        plugin: conflictingPlugin,
        reason: `Conflicts with dependency ${dep.name}`,
        severity: 'warning'
      });
    }
  }

  // Check direct conflicts
  if (pluginInfo.conflicts) {
    for (const conflict of pluginInfo.conflicts) {
      if (selectedPlugins.includes(conflict)) {
        conflicts.push({
          plugin: conflict,
          reason: 'Direct plugin conflict',
          severity: 'error'
        });
      }
    }
  }

  // Generate recommendations
  for (const dep of pluginInfo.peerDependencies) {
    if (!selectedPlugins.includes(dep.id)) {
      recommendations.push({
        plugin: dep.id,
        reason: `Required peer dependency for ${pluginInfo.name}`,
        type: 'install'
      });
    }
  }

  // Generate install order (topological sort simplified)
  installOrder.push(...allDependencies.map(d => d.id));
  installOrder.push(pluginId);

  return {
    pluginId,
    dependencies: allDependencies,
    conflicts,
    recommendations,
    installOrder: [...new Set(installOrder)], // Remove duplicates
    totalSize: Math.floor(Math.random() * 50 + 10) * 1024 * 1024 // Mock size in bytes
  };
}

function checkGlobalConflicts(pluginIds: string[]) {
  const conflicts = [];
  
  for (let i = 0; i < pluginIds.length; i++) {
    for (let j = i + 1; j < pluginIds.length; j++) {
      const plugin1 = PLUGIN_DEPENDENCIES[pluginIds[i]];
      const plugin2 = PLUGIN_DEPENDENCIES[pluginIds[j]];
      
      if (plugin1?.conflicts?.includes(pluginIds[j])) {
        conflicts.push({
          plugins: [pluginIds[i], pluginIds[j]],
          reason: 'Plugins have conflicting functionality',
          severity: 'error' as const
        });
      }
    }
  }
  
  return conflicts;
}

function generateRecommendations(pluginIds: string[]) {
  const recommendations = [];
  
  // Recommend complementary plugins
  const hasKubernetes = pluginIds.includes('@backstage/plugin-kubernetes');
  const hasCatalog = pluginIds.includes('@backstage/plugin-catalog');
  
  if (hasKubernetes && !hasCatalog) {
    recommendations.push({
      plugin: '@backstage/plugin-catalog',
      reason: 'Software Catalog works great with Kubernetes plugin for entity management',
      type: 'complement',
      priority: 'high'
    });
  }
  
  if (hasCatalog && !pluginIds.includes('@backstage/plugin-techdocs')) {
    recommendations.push({
      plugin: '@backstage/plugin-techdocs',
      reason: 'TechDocs integrates seamlessly with Software Catalog for documentation',
      type: 'complement',
      priority: 'medium'
    });
  }
  
  return recommendations;
}

function checkBackstageCompatibility(plugins: string[], backstageVersion: string) {
  const results = [];
  
  for (const pluginId of plugins) {
    const pluginInfo = PLUGIN_DEPENDENCIES[pluginId];
    if (!pluginInfo) continue;
    
    const isCompatible = checkVersionCompatibility(
      pluginInfo.backstageVersion || '*',
      backstageVersion
    );
    
    results.push({
      plugin: pluginId,
      compatible: isCompatible,
      requiredVersion: pluginInfo.backstageVersion,
      currentVersion: backstageVersion
    });
  }
  
  return results;
}

function checkVersionCompatibility(required: string, current: string): boolean {
  // Simplified version checking - in reality would use semver
  if (required === '*') return true;
  if (required.startsWith('^')) {
    const majorVersion = required.replace('^', '').split('.')[0];
    return current.startsWith(majorVersion);
  }
  return required === current;
}