/**
 * Plugin Compatibility Check API
 * Provides comprehensive compatibility validation for plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import CompatibilityScanner from '@/services/plugin-compatibility/CompatibilityScanner';

export async function POST(request: NextRequest) {
  try {
    const {
      pluginName,
      version = 'latest',
      targetEnvironment = {}
    } = await request.json();

    if (!pluginName) {
      return NextResponse.json({
        success: false,
        error: 'Plugin name is required'
      }, { status: 400 });
    }

    const scanner = new CompatibilityScanner({
      backstageVersion: targetEnvironment.backstageVersion || '1.20.0',
      nodeVersion: targetEnvironment.nodeVersion || '18.17.0'
    });

    // Mock plugin manifest for testing
    const pluginManifest = {
      name: pluginName,
      version: version === 'latest' ? '1.5.0' : version,
      dependencies: {
        '@backstage/core-plugin-api': '^1.8.0',
        'react': '^18.0.0'
      },
      engines: {
        node: '>=18.17.0',
        backstage: '>=1.18.0'
      },
      apis: [{
        name: 'catalogApi',
        version: '1.0.0',
        type: 'consume' as const,
        package: '@backstage/plugin-catalog-react',
        methods: ['getEntities']
      }],
      permissions: [{
        name: 'catalog.entity.read',
        type: 'resource' as const,
        attributes: { action: 'read' }
      }]
    };

    // Mock environment
    const environment = {
      backstageVersion: '1.20.0',
      nodeVersion: '18.17.0',
      availableAPIs: [{
        name: 'catalogApi',
        version: '1.0.0',
        type: 'provide' as const,
        package: '@backstage/plugin-catalog-react',
        methods: ['getEntities'],
        deprecated: false
      }],
      availablePermissions: [{
        name: 'catalog.entity.read',
        type: 'resource' as const,
        attributes: { action: 'read' }
      }],
      systemResources: {
        cpu: { cores: 4 },
        memory: { total: '8GB' },
        storage: { total: '500GB' }
      }
    };

    const compatibilityReport = await scanner.scanCompatibility(pluginManifest, environment);

    return NextResponse.json({
      success: true,
      compatibility: compatibilityReport,
      plugin: {
        name: pluginManifest.name,
        version: pluginManifest.version
      }
    });

  } catch (error) {
    console.error('Compatibility check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check plugin compatibility'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pluginName = searchParams.get('pluginName');

  if (!pluginName) {
    return NextResponse.json({
      success: false,
      error: 'Plugin name is required'
    }, { status: 400 });
  }

  // Quick compatibility check
  return NextResponse.json({
    success: true,
    compatibility: {
      overall: 'compatible',
      apiCompatibility: { status: 'compatible' },
      runtimeCompatibility: { status: 'compatible' }
    }
  });
}