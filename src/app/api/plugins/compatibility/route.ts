/**
 * Plugin Compatibility API Route
 * 
 * Handles compatibility checking for Backstage plugins including version,
 * system requirements, and performance impact assessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompatibilityChecker } from '@/lib/plugins/CompatibilityChecker';
import { Plugin, SystemInfo, ApiResponse, CompatibilityReport } from '@/lib/plugins/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    
    if (!pluginId) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'pluginId parameter is required',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Mock system info - in production, this would be detected or stored
    const systemInfo: Partial<SystemInfo> = {
      nodeVersion: '18.17.0',
      npmVersion: '9.6.7',
      operatingSystem: 'darwin',
      architecture: 'arm64',
      availableMemory: 16384, // 16GB
      cpuCores: 10,
      backstageVersion: '1.15.0',
      installedPlugins: [
        '@backstage/plugin-catalog',
        '@backstage/plugin-scaffolder',
        '@backstage/core-components'
      ]
    };

    // Mock plugin data
    const mockPlugin: Plugin = {
      id: pluginId,
      name: pluginId.split('/').pop()?.replace('plugin-', '') || 'Unknown Plugin',
      version: '1.15.0',
      type: 'frontend',
      backstageVersion: '^1.15.0',
      requirements: {
        nodeVersion: '>=16.0.0',
        memory: 512,
        cpu: 2,
        operatingSystem: ['darwin', 'linux', 'win32'],
        architecture: ['x64', 'arm64']
      },
      dependencies: [
        { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
        { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
      ]
    };

    const checker = new CompatibilityChecker(systemInfo);
    const report = await checker.checkPluginCompatibility(mockPlugin);

    const response: ApiResponse<CompatibilityReport> = {
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Compatibility check error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plugins, systemInfo } = body;

    if (!Array.isArray(plugins)) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Invalid plugins data - expected array',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Use provided system info or default mock data
    const defaultSystemInfo: Partial<SystemInfo> = {
      nodeVersion: '18.17.0',
      npmVersion: '9.6.7',
      operatingSystem: 'darwin',
      architecture: 'arm64',
      availableMemory: 16384,
      cpuCores: 10,
      backstageVersion: '1.15.0',
      installedPlugins: []
    };

    const finalSystemInfo = { ...defaultSystemInfo, ...systemInfo };
    const checker = new CompatibilityChecker(finalSystemInfo);
    
    // Check compatibility for all plugins
    const reports = await checker.checkMultiplePlugins(plugins);
    
    // Generate overall summary
    const summary = {
      totalPlugins: plugins.length,
      compatible: reports.filter(r => r.compatible).length,
      withIssues: reports.filter(r => !r.compatible).length,
      criticalIssues: reports.reduce((sum, r) => 
        sum + r.issues.filter(i => i.severity === 'critical').length, 0
      ),
      warnings: reports.reduce((sum, r) => 
        sum + r.issues.filter(i => i.severity === 'warning').length, 0
      )
    };

    const response: ApiResponse = {
      success: true,
      data: {
        reports,
        summary,
        systemCompatibility: checker.getSystemCompatibilitySummary(),
        compatibilityMatrix: checker.getCompatibilityMatrix()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Batch compatibility check error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, systemInfo, rules } = body;

    if (!action) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Action parameter is required',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const checker = new CompatibilityChecker(systemInfo);
    let result;

    switch (action) {
      case 'update-system-info':
        if (!systemInfo) {
          throw new Error('systemInfo is required for update-system-info action');
        }
        checker.updateSystemInfo(systemInfo);
        result = { 
          message: 'System information updated successfully',
          updatedInfo: systemInfo
        };
        break;

      case 'add-compatibility-rule':
        if (!rules || !Array.isArray(rules)) {
          throw new Error('rules array is required for add-compatibility-rule action');
        }
        for (const rule of rules) {
          if (!rule.category || !rule.rule) {
            throw new Error('Each rule must have category and rule properties');
          }
          checker.addCompatibilityRule(rule.category, rule.rule);
        }
        result = { 
          message: `${rules.length} compatibility rule(s) added successfully`
        };
        break;

      case 'get-system-summary':
        result = checker.getSystemCompatibilitySummary();
        break;

      case 'get-compatibility-matrix':
        result = checker.getCompatibilityMatrix();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Compatibility update error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');
    const category = searchParams.get('category');

    if (!ruleId && !category) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Either ruleId or category parameter is required',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // In a real implementation, this would remove rules from storage
    // For now, we'll just return a success message
    let message;
    if (ruleId) {
      message = `Compatibility rule ${ruleId} removed successfully`;
    } else {
      message = `All compatibility rules in category ${category} removed successfully`;
    }

    const response: ApiResponse = {
      success: true,
      data: { message },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Compatibility rule deletion error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}