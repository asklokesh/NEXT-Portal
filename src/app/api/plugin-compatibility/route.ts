import { NextRequest, NextResponse } from 'next/server';

interface CompatibilityRequirement {
  name: string;
  version: string;
  required: boolean;
  current?: string;
  compatible: boolean;
  severity: 'error' | 'warning' | 'info';
  message?: string;
}

interface PluginCompatibility {
  pluginId: string;
  pluginName: string;
  version: string;
  overallCompatibility: 'compatible' | 'warning' | 'incompatible';
  compatibilityScore: number; // 0-100
  requirements: {
    backstage: CompatibilityRequirement;
    node: CompatibilityRequirement;
    react: CompatibilityRequirement;
    typescript?: CompatibilityRequirement;
  };
  peerDependencies: CompatibilityRequirement[];
  conflicts: {
    pluginId: string;
    pluginName: string;
    reason: string;
    severity: 'error' | 'warning';
    workaround?: string;
  }[];
  recommendations: {
    action: 'upgrade' | 'downgrade' | 'install' | 'uninstall' | 'configure';
    target: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  runtimeRequirements: {
    memory: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
    cpu: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
    disk: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
  };
  platformSupport: {
    os: string[];
    architecture: string[];
    containers: boolean;
    kubernetes: boolean;
  };
}

interface SystemInfo {
  backstageVersion: string;
  nodeVersion: string;
  reactVersion: string;
  typescriptVersion: string;
  platform: {
    os: string;
    architecture: string;
    memory: number;
    cpu: number;
    disk: number;
  };
  installedPlugins: string[];
}

// Mock system information
const MOCK_SYSTEM_INFO: SystemInfo = {
  backstageVersion: '1.20.3',
  nodeVersion: '18.19.0',
  reactVersion: '18.2.0',
  typescriptVersion: '5.2.2',
  platform: {
    os: 'linux',
    architecture: 'x64',
    memory: 16384, // MB
    cpu: 8, // cores
    disk: 102400 // MB
  },
  installedPlugins: [
    '@backstage/plugin-catalog',
    '@backstage/plugin-techdocs',
    '@backstage/plugin-kubernetes'
  ]
};

// Mock plugin compatibility data
const PLUGIN_COMPATIBILITY_DATA: Record<string, any> = {
  '@backstage/plugin-catalog': {
    requirements: {
      backstage: { min: '1.18.0', max: null, recommended: '1.20.0' },
      node: { min: '16.0.0', max: null, recommended: '18.0.0' },
      react: { min: '17.0.0', max: '18.9.9', recommended: '18.2.0' },
      typescript: { min: '4.8.0', max: null, recommended: '5.0.0' }
    },
    runtimeRequirements: {
      memory: { minimum: 128, recommended: 256 },
      cpu: { minimum: 1, recommended: 2 },
      disk: { minimum: 50, recommended: 100 }
    },
    platformSupport: {
      os: ['linux', 'darwin', 'win32'],
      architecture: ['x64', 'arm64'],
      containers: true,
      kubernetes: true
    },
    conflicts: [],
    peerDependencies: [
      { name: '@backstage/core-plugin-api', version: '^1.8.0', required: true },
      { name: '@backstage/catalog-model', version: '^1.4.0', required: true }
    ]
  },
  '@backstage/plugin-kubernetes': {
    requirements: {
      backstage: { min: '1.19.0', max: null, recommended: '1.20.0' },
      node: { min: '18.0.0', max: null, recommended: '18.0.0' },
      react: { min: '17.0.0', max: '18.9.9', recommended: '18.2.0' },
      typescript: { min: '4.9.0', max: null, recommended: '5.0.0' }
    },
    runtimeRequirements: {
      memory: { minimum: 256, recommended: 512 },
      cpu: { minimum: 2, recommended: 4 },
      disk: { minimum: 100, recommended: 200 }
    },
    platformSupport: {
      os: ['linux', 'darwin'],
      architecture: ['x64', 'arm64'],
      containers: true,
      kubernetes: true
    },
    conflicts: [
      {
        pluginId: '@backstage/plugin-jenkins',
        reason: 'Both plugins try to register the same CI/CD route handler',
        severity: 'warning',
        workaround: 'Configure different route prefixes in app-config.yaml'
      }
    ],
    peerDependencies: [
      { name: '@backstage/plugin-catalog', version: '^1.15.0', required: true },
      { name: '@kubernetes/client-node', version: '^0.20.0', required: true }
    ]
  },
  '@roadiehq/backstage-plugin-github-actions': {
    requirements: {
      backstage: { min: '1.18.0', max: null, recommended: '1.20.0' },
      node: { min: '16.0.0', max: null, recommended: '18.0.0' },
      react: { min: '17.0.0', max: '18.9.9', recommended: '18.2.0' }
    },
    runtimeRequirements: {
      memory: { minimum: 128, recommended: 256 },
      cpu: { minimum: 1, recommended: 2 },
      disk: { minimum: 50, recommended: 100 }
    },
    platformSupport: {
      os: ['linux', 'darwin', 'win32'],
      architecture: ['x64', 'arm64'],
      containers: true,
      kubernetes: true
    },
    conflicts: [],
    peerDependencies: [
      { name: '@backstage/plugin-catalog', version: '^1.15.0', required: true },
      { name: '@octokit/rest', version: '^20.0.0', required: true }
    ]
  },
  '@backstage/plugin-jenkins': {
    requirements: {
      backstage: { min: '1.18.0', max: null, recommended: '1.20.0' },
      node: { min: '16.0.0', max: null, recommended: '18.0.0' },
      react: { min: '17.0.0', max: '18.9.9', recommended: '18.2.0' }
    },
    runtimeRequirements: {
      memory: { minimum: 128, recommended: 256 },
      cpu: { minimum: 1, recommended: 2 },
      disk: { minimum: 50, recommended: 100 }
    },
    platformSupport: {
      os: ['linux', 'darwin', 'win32'],
      architecture: ['x64'],
      containers: true,
      kubernetes: true
    },
    conflicts: [
      {
        pluginId: '@backstage/plugin-kubernetes',
        reason: 'Both plugins try to register the same CI/CD route handler',
        severity: 'warning',
        workaround: 'Configure different route prefixes in app-config.yaml'
      }
    ],
    peerDependencies: [
      { name: '@backstage/plugin-catalog', version: '^1.15.0', required: true },
      { name: 'jenkins', version: '^1.0.0', required: true }
    ]
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginIds = searchParams.get('plugins')?.split(',') || [];
    const action = searchParams.get('action') || 'check';
    const systemInfo = searchParams.get('systemInfo') ? 
      JSON.parse(decodeURIComponent(searchParams.get('systemInfo')!)) : 
      MOCK_SYSTEM_INFO;

    if (action === 'system-info') {
      return NextResponse.json({
        success: true,
        systemInfo: MOCK_SYSTEM_INFO
      });
    }

    if (action === 'check' && pluginIds.length > 0) {
      const compatibilityResults: PluginCompatibility[] = [];

      for (const pluginId of pluginIds) {
        const pluginData = PLUGIN_COMPATIBILITY_DATA[pluginId];
        
        if (!pluginData) {
          // If no data available, create a basic compatibility check
          compatibilityResults.push({
            pluginId,
            pluginName: pluginId.split('/').pop() || pluginId,
            version: '1.0.0',
            overallCompatibility: 'warning',
            compatibilityScore: 50,
            requirements: {
              backstage: {
                name: 'Backstage',
                version: '>=1.18.0',
                required: true,
                current: systemInfo.backstageVersion,
                compatible: true,
                severity: 'info',
                message: 'No specific version requirements found'
              },
              node: {
                name: 'Node.js',
                version: '>=16.0.0',
                required: true,
                current: systemInfo.nodeVersion,
                compatible: true,
                severity: 'info'
              },
              react: {
                name: 'React',
                version: '>=17.0.0',
                required: true,
                current: systemInfo.reactVersion,
                compatible: true,
                severity: 'info'
              }
            },
            peerDependencies: [],
            conflicts: [],
            recommendations: [],
            runtimeRequirements: {
              memory: { minimum: 128, recommended: 256, current: systemInfo.platform.memory, compatible: true },
              cpu: { minimum: 1, recommended: 2, current: systemInfo.platform.cpu, compatible: true },
              disk: { minimum: 50, recommended: 100, current: systemInfo.platform.disk, compatible: true }
            },
            platformSupport: {
              os: ['linux', 'darwin', 'win32'],
              architecture: ['x64', 'arm64'],
              containers: true,
              kubernetes: true
            }
          });
          continue;
        }

        const compatibility = checkPluginCompatibility(pluginId, pluginData, systemInfo);
        compatibilityResults.push(compatibility);
      }

      // Check for cross-plugin conflicts
      const globalConflicts = checkGlobalConflicts(pluginIds, compatibilityResults);

      return NextResponse.json({
        success: true,
        compatibilityResults,
        globalConflicts,
        systemInfo,
        summary: {
          totalPlugins: compatibilityResults.length,
          compatiblePlugins: compatibilityResults.filter(p => p.overallCompatibility === 'compatible').length,
          warningPlugins: compatibilityResults.filter(p => p.overallCompatibility === 'warning').length,
          incompatiblePlugins: compatibilityResults.filter(p => p.overallCompatibility === 'incompatible').length,
          averageScore: compatibilityResults.reduce((sum, p) => sum + p.compatibilityScore, 0) / compatibilityResults.length
        }
      });
    }

    if (action === 'validate-system') {
      const systemValidation = validateSystemRequirements(systemInfo);
      
      return NextResponse.json({
        success: true,
        systemValidation
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing plugins parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('Error checking plugin compatibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pluginId, customRequirements, systemInfo } = await request.json();

    if (!pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID is required'
      }, { status: 400 });
    }

    // Simulate custom compatibility check
    const compatibility = checkPluginCompatibility(
      pluginId, 
      customRequirements || PLUGIN_COMPATIBILITY_DATA[pluginId], 
      systemInfo || MOCK_SYSTEM_INFO
    );

    return NextResponse.json({
      success: true,
      compatibility
    });

  } catch (error) {
    console.error('Error performing custom compatibility check:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

function checkPluginCompatibility(
  pluginId: string, 
  pluginData: any, 
  systemInfo: SystemInfo
): PluginCompatibility {
  const requirements = pluginData.requirements;
  const compatibilityChecks: CompatibilityRequirement[] = [];
  let compatibilityScore = 100;
  let overallSeverity: 'compatible' | 'warning' | 'incompatible' = 'compatible';

  // Check Backstage version
  const backstageCheck = checkVersionCompatibility(
    systemInfo.backstageVersion,
    requirements.backstage.min,
    requirements.backstage.max
  );
  
  const backstageReq: CompatibilityRequirement = {
    name: 'Backstage',
    version: `>=${requirements.backstage.min}${requirements.backstage.max ? ` <=${requirements.backstage.max}` : ''}`,
    required: true,
    current: systemInfo.backstageVersion,
    compatible: backstageCheck.compatible,
    severity: backstageCheck.compatible ? 'info' : 'error',
    message: backstageCheck.message
  };

  if (!backstageCheck.compatible) {
    compatibilityScore -= 40;
    overallSeverity = 'incompatible';
  }

  // Check Node.js version
  const nodeCheck = checkVersionCompatibility(
    systemInfo.nodeVersion,
    requirements.node.min,
    requirements.node.max
  );

  const nodeReq: CompatibilityRequirement = {
    name: 'Node.js',
    version: `>=${requirements.node.min}${requirements.node.max ? ` <=${requirements.node.max}` : ''}`,
    required: true,
    current: systemInfo.nodeVersion,
    compatible: nodeCheck.compatible,
    severity: nodeCheck.compatible ? 'info' : 'error',
    message: nodeCheck.message
  };

  if (!nodeCheck.compatible) {
    compatibilityScore -= 30;
    if (overallSeverity !== 'incompatible') overallSeverity = 'incompatible';
  }

  // Check React version
  const reactCheck = checkVersionCompatibility(
    systemInfo.reactVersion,
    requirements.react.min,
    requirements.react.max
  );

  const reactReq: CompatibilityRequirement = {
    name: 'React',
    version: `>=${requirements.react.min}${requirements.react.max ? ` <=${requirements.react.max}` : ''}`,
    required: true,
    current: systemInfo.reactVersion,
    compatible: reactCheck.compatible,
    severity: reactCheck.compatible ? 'info' : 'error',
    message: reactCheck.message
  };

  if (!reactCheck.compatible) {
    compatibilityScore -= 20;
    if (overallSeverity === 'compatible') overallSeverity = 'warning';
  }

  // Check TypeScript version if required
  let typescriptReq: CompatibilityRequirement | undefined;
  if (requirements.typescript) {
    const tsCheck = checkVersionCompatibility(
      systemInfo.typescriptVersion,
      requirements.typescript.min,
      requirements.typescript.max
    );

    typescriptReq = {
      name: 'TypeScript',
      version: `>=${requirements.typescript.min}${requirements.typescript.max ? ` <=${requirements.typescript.max}` : ''}`,
      required: false,
      current: systemInfo.typescriptVersion,
      compatible: tsCheck.compatible,
      severity: tsCheck.compatible ? 'info' : 'warning',
      message: tsCheck.message
    };

    if (!tsCheck.compatible) {
      compatibilityScore -= 10;
      if (overallSeverity === 'compatible') overallSeverity = 'warning';
    }
  }

  // Check peer dependencies
  const peerDependencies: CompatibilityRequirement[] = pluginData.peerDependencies.map((dep: any) => {
    const isInstalled = systemInfo.installedPlugins.includes(dep.name);
    return {
      name: dep.name,
      version: dep.version,
      required: dep.required,
      current: isInstalled ? 'installed' : 'not installed',
      compatible: !dep.required || isInstalled,
      severity: dep.required && !isInstalled ? 'error' : 'info',
      message: isInstalled ? 'Dependency satisfied' : dep.required ? 'Required dependency missing' : 'Optional dependency not installed'
    };
  });

  // Check runtime requirements
  const runtimeCompatible = checkRuntimeRequirements(pluginData.runtimeRequirements, systemInfo.platform);
  if (!runtimeCompatible.allPassed) {
    compatibilityScore -= 15;
    if (overallSeverity === 'compatible') overallSeverity = 'warning';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(pluginId, pluginData, systemInfo, {
    backstage: backstageCheck,
    node: nodeCheck,
    react: reactCheck,
    typescript: requirements.typescript ? checkVersionCompatibility(
      systemInfo.typescriptVersion,
      requirements.typescript.min,
      requirements.typescript.max
    ) : { compatible: true }
  });

  return {
    pluginId,
    pluginName: pluginId.split('/').pop()?.replace('plugin-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || pluginId,
    version: '1.0.0',
    overallCompatibility: overallSeverity,
    compatibilityScore: Math.max(0, compatibilityScore),
    requirements: {
      backstage: backstageReq,
      node: nodeReq,
      react: reactReq,
      typescript: typescriptReq
    },
    peerDependencies,
    conflicts: pluginData.conflicts || [],
    recommendations,
    runtimeRequirements: {
      memory: {
        minimum: pluginData.runtimeRequirements.memory.minimum,
        recommended: pluginData.runtimeRequirements.memory.recommended,
        current: systemInfo.platform.memory,
        compatible: systemInfo.platform.memory >= pluginData.runtimeRequirements.memory.minimum
      },
      cpu: {
        minimum: pluginData.runtimeRequirements.cpu.minimum,
        recommended: pluginData.runtimeRequirements.cpu.recommended,
        current: systemInfo.platform.cpu,
        compatible: systemInfo.platform.cpu >= pluginData.runtimeRequirements.cpu.minimum
      },
      disk: {
        minimum: pluginData.runtimeRequirements.disk.minimum,
        recommended: pluginData.runtimeRequirements.disk.recommended,
        current: systemInfo.platform.disk,
        compatible: systemInfo.platform.disk >= pluginData.runtimeRequirements.disk.minimum
      }
    },
    platformSupport: pluginData.platformSupport
  };
}

function checkVersionCompatibility(current: string, min: string, max?: string | null) {
  // Simplified version comparison - in reality would use semver
  const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10));
  
  const currentParts = parseVersion(current);
  const minParts = parseVersion(min);
  const maxParts = max ? parseVersion(max) : null;
  
  // Check minimum version
  for (let i = 0; i < Math.max(currentParts.length, minParts.length); i++) {
    const curr = currentParts[i] || 0;
    const minVal = minParts[i] || 0;
    
    if (curr < minVal) {
      return {
        compatible: false,
        message: `Current version ${current} is below minimum required ${min}`
      };
    } else if (curr > minVal) {
      break;
    }
  }
  
  // Check maximum version if specified
  if (maxParts) {
    for (let i = 0; i < Math.max(currentParts.length, maxParts.length); i++) {
      const curr = currentParts[i] || 0;
      const maxVal = maxParts[i] || 0;
      
      if (curr > maxVal) {
        return {
          compatible: false,
          message: `Current version ${current} exceeds maximum supported ${max}`
        };
      } else if (curr < maxVal) {
        break;
      }
    }
  }
  
  return {
    compatible: true,
    message: 'Version compatibility satisfied'
  };
}

function checkRuntimeRequirements(requirements: any, platform: any) {
  const checks = {
    memory: platform.memory >= requirements.memory.minimum,
    cpu: platform.cpu >= requirements.cpu.minimum,
    disk: platform.disk >= requirements.disk.minimum
  };
  
  return {
    allPassed: Object.values(checks).every(Boolean),
    checks
  };
}

function checkGlobalConflicts(pluginIds: string[], compatibilityResults: PluginCompatibility[]) {
  const conflicts = [];
  
  for (let i = 0; i < compatibilityResults.length; i++) {
    for (let j = i + 1; j < compatibilityResults.length; j++) {
      const plugin1 = compatibilityResults[i];
      const plugin2 = compatibilityResults[j];
      
      // Check if plugins have direct conflicts
      const conflict1 = plugin1.conflicts.find(c => c.pluginId === plugin2.pluginId);
      const conflict2 = plugin2.conflicts.find(c => c.pluginId === plugin1.pluginId);
      
      if (conflict1) {
        conflicts.push({
          plugins: [plugin1.pluginId, plugin2.pluginId],
          reason: conflict1.reason,
          severity: conflict1.severity,
          workaround: conflict1.workaround
        });
      } else if (conflict2) {
        conflicts.push({
          plugins: [plugin1.pluginId, plugin2.pluginId],
          reason: conflict2.reason,
          severity: conflict2.severity,
          workaround: conflict2.workaround
        });
      }
    }
  }
  
  return conflicts;
}

function generateRecommendations(pluginId: string, pluginData: any, systemInfo: SystemInfo, checks: any) {
  const recommendations = [];
  
  if (!checks.backstage.compatible) {
    recommendations.push({
      action: 'upgrade' as const,
      target: 'Backstage',
      reason: `Upgrade Backstage from ${systemInfo.backstageVersion} to ${pluginData.requirements.backstage.recommended}`,
      priority: 'high' as const
    });
  }
  
  if (!checks.node.compatible) {
    recommendations.push({
      action: 'upgrade' as const,
      target: 'Node.js',
      reason: `Upgrade Node.js from ${systemInfo.nodeVersion} to ${pluginData.requirements.node.recommended}`,
      priority: 'high' as const
    });
  }
  
  if (!checks.react.compatible) {
    recommendations.push({
      action: 'upgrade' as const,
      target: 'React',
      reason: `Update React from ${systemInfo.reactVersion} to ${pluginData.requirements.react.recommended}`,
      priority: 'medium' as const
    });
  }
  
  return recommendations;
}

function validateSystemRequirements(systemInfo: SystemInfo) {
  return {
    backstage: {
      current: systemInfo.backstageVersion,
      supported: true,
      message: 'Backstage version is supported'
    },
    node: {
      current: systemInfo.nodeVersion,
      supported: true,
      message: 'Node.js version is supported'
    },
    platform: {
      os: systemInfo.platform.os,
      architecture: systemInfo.platform.architecture,
      supported: true,
      message: 'Platform is supported'
    },
    resources: {
      memory: systemInfo.platform.memory,
      cpu: systemInfo.platform.cpu,
      disk: systemInfo.platform.disk,
      adequate: true,
      message: 'System resources are adequate'
    }
  };
}