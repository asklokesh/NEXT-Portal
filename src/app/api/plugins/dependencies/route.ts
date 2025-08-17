import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    // Mock dependency data
    const mockDependencies = [
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        version: '1.15.0',
        type: 'direct',
        status: 'compatible',
        required: true,
        dependencies: [
          { name: 'react', version: '^18.0.0', type: 'peer', status: 'compatible' },
          { name: '@backstage/core-components', version: '^0.13.0', type: 'direct', status: 'compatible' },
          { name: '@backstage/catalog-model', version: '^1.4.0', type: 'direct', status: 'compatible' }
        ]
      },
      {
        id: '@backstage/plugin-techdocs',
        name: 'TechDocs',
        version: '1.9.3',
        type: 'direct',
        status: 'compatible',
        required: false,
        dependencies: [
          { name: '@backstage/plugin-catalog', version: '^1.15.0', type: 'peer', status: 'compatible' },
          { name: '@backstage/core-components', version: '^0.13.0', type: 'direct', status: 'compatible' },
          { name: '@backstage/plugin-search-common', version: '^1.2.0', type: 'direct', status: 'compatible' }
        ]
      },
      {
        id: '@backstage/plugin-kubernetes',
        name: 'Kubernetes',
        version: '0.11.2',
        type: 'direct',
        status: 'warning',
        required: false,
        dependencies: [
          { name: '@backstage/plugin-catalog', version: '^1.15.0', type: 'peer', status: 'compatible' },
          { name: 'kubernetes-client', version: '^0.18.0', type: 'direct', status: 'warning' },
          { name: '@backstage/config', version: '^1.1.0', type: 'direct', status: 'compatible' }
        ],
        issues: [
          {
            type: 'version-mismatch',
            message: 'kubernetes-client version may have compatibility issues',
            severity: 'warning'
          }
        ]
      }
    ];

    if (pluginId) {
      const plugin = mockDependencies.find(d => d.id === pluginId);
      if (!plugin) {
        return NextResponse.json(
          { error: 'Plugin not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(plugin);
    }

    // Return dependency analysis
    const conflictAnalysis = {
      totalPlugins: mockDependencies.length,
      conflicts: mockDependencies.filter(p => p.status === 'conflict').length,
      warnings: mockDependencies.filter(p => p.status === 'warning').length,
      compatible: mockDependencies.filter(p => p.status === 'compatible').length,
      resolutionStrategies: [
        {
          type: 'automatic',
          description: 'Update conflicting dependencies to compatible versions',
          applicable: true
        },
        {
          type: 'manual',
          description: 'Manually resolve version conflicts',
          applicable: true
        },
        {
          type: 'alternative',
          description: 'Find alternative plugins with fewer conflicts',
          applicable: false
        }
      ]
    };

    return NextResponse.json({
      dependencies: mockDependencies,
      analysis: conflictAnalysis,
      graph: {
        nodes: mockDependencies.map(dep => ({
          id: dep.id,
          name: dep.name,
          type: dep.type,
          status: dep.status
        })),
        links: mockDependencies.flatMap(dep => 
          dep.dependencies?.map(subDep => ({
            source: dep.id,
            target: subDep.name,
            type: subDep.type
          })) || []
        )
      }
    });

  } catch (error) {
    console.error('Dependencies check failed:', error);
    return NextResponse.json(
      { error: 'Failed to get dependency data' },
      { status: 500 }
    );
  }
}