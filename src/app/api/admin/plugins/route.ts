import { NextRequest, NextResponse } from 'next/server';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  installed: boolean;
  category: string;
  author: string;
  description: string;
  dependencies?: string[];
  configurable: boolean;
  permissions?: string[];
  lastUpdated?: string;
  status: 'active' | 'inactive' | 'error' | 'updating';
  downloads?: number;
  rating?: number;
  size?: string;
  repository?: string;
  license?: string;
}

interface PluginStats {
  total: number;
  enabled: number;
  disabled: number;
  configurable: number;
  core: number;
  community: number;
  updates_available: number;
}

// Mock data for development
const mockPlugins: PluginInfo[] = [
  {
    id: '@backstage/plugin-catalog',
    name: 'Software Catalog',
    version: '1.22.0',
    enabled: true,
    installed: true,
    category: 'core',
    author: 'Backstage',
    description: 'Core catalog functionality for managing software components, services, and APIs',
    permissions: ['catalog.read', 'catalog.write'],
    configurable: true,
    lastUpdated: '2024-01-15',
    status: 'active',
    downloads: 125000,
    rating: 4.8,
    size: '2.3 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-kubernetes',
    name: 'Kubernetes',
    version: '0.18.0',
    enabled: true,
    installed: true,
    category: 'infrastructure',
    author: 'Backstage',
    description: 'Kubernetes resource management and monitoring integration',
    dependencies: ['@backstage/plugin-catalog'],
    permissions: ['kubernetes.read'],
    configurable: true,
    lastUpdated: '2024-01-10',
    status: 'active',
    downloads: 85000,
    rating: 4.6,
    size: '1.8 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-github-actions',
    name: 'GitHub Actions',
    version: '0.8.0',
    enabled: false,
    installed: true,
    category: 'ci-cd',
    author: 'Backstage',
    description: 'GitHub Actions integration for CI/CD pipeline monitoring',
    permissions: ['github.read'],
    configurable: true,
    lastUpdated: '2024-01-08',
    status: 'inactive',
    downloads: 92000,
    rating: 4.5,
    size: '1.2 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-techdocs',
    name: 'TechDocs',
    version: '1.10.0',
    enabled: true,
    installed: true,
    category: 'documentation',
    author: 'Backstage',
    description: 'Documentation platform with docs-as-code philosophy',
    permissions: ['techdocs.read', 'techdocs.write'],
    configurable: true,
    lastUpdated: '2024-01-12',
    status: 'active',
    downloads: 78000,
    rating: 4.7,
    size: '3.1 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-cost-insights',
    name: 'Cost Insights',
    version: '0.12.0',
    enabled: true,
    installed: true,
    category: 'monitoring',
    author: 'Backstage',
    description: 'Cloud cost monitoring and optimization insights',
    permissions: ['cost-insights.read'],
    configurable: true,
    lastUpdated: '2024-01-05',
    status: 'active',
    downloads: 45000,
    rating: 4.3,
    size: '1.9 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-scaffolder',
    name: 'Scaffolder',
    version: '1.19.0',
    enabled: true,
    installed: true,
    category: 'core',
    author: 'Backstage',
    description: 'Software template scaffolding and project generation',
    permissions: ['scaffolder.read', 'scaffolder.write'],
    configurable: true,
    lastUpdated: '2024-01-14',
    status: 'active',
    downloads: 110000,
    rating: 4.9,
    size: '2.7 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-jenkins',
    name: 'Jenkins',
    version: '0.9.0',
    enabled: false,
    installed: true,
    category: 'ci-cd',
    author: 'Backstage',
    description: 'Jenkins CI/CD integration and build monitoring',
    permissions: ['jenkins.read'],
    configurable: true,
    lastUpdated: '2024-01-03',
    status: 'inactive',
    downloads: 67000,
    rating: 4.2,
    size: '1.5 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  },
  {
    id: '@backstage/plugin-search',
    name: 'Search',
    version: '1.4.0',
    enabled: true,
    installed: true,
    category: 'core',
    author: 'Backstage',
    description: 'Global search functionality across all platform resources',
    permissions: ['search.read'],
    configurable: true,
    lastUpdated: '2024-01-11',
    status: 'active',
    downloads: 98000,
    rating: 4.6,
    size: '1.6 MB',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0'
  }
];

function calculateStats(plugins: PluginInfo[]): PluginStats {
  return {
    total: plugins.length,
    enabled: plugins.filter(p => p.enabled).length,
    disabled: plugins.filter(p => !p.enabled).length,
    configurable: plugins.filter(p => p.configurable).length,
    core: plugins.filter(p => p.category === 'core').length,
    community: plugins.filter(p => p.category !== 'core').length,
    updates_available: Math.floor(Math.random() * 5) + 1 // Mock data
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');

    let filteredPlugins = [...mockPlugins];

    // Filter by category
    if (category && category !== 'all') {
      filteredPlugins = filteredPlugins.filter(plugin => plugin.category === category);
    }

    // Filter by enabled status
    if (enabled === 'true') {
      filteredPlugins = filteredPlugins.filter(plugin => plugin.enabled);
    } else if (enabled === 'false') {
      filteredPlugins = filteredPlugins.filter(plugin => !plugin.enabled);
    }

    // Filter by search term
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredPlugins = filteredPlugins.filter(plugin =>
        plugin.name.toLowerCase().includes(searchTerm) ||
        plugin.description.toLowerCase().includes(searchTerm) ||
        plugin.author.toLowerCase().includes(searchTerm)
      );
    }

    const stats = calculateStats(mockPlugins);

    return NextResponse.json({
      plugins: filteredPlugins,
      stats,
      categories: ['core', 'infrastructure', 'ci-cd', 'documentation', 'monitoring', 'security'],
      total: filteredPlugins.length
    });
  } catch (error) {
    console.error('Error fetching plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pluginId, config } = body;

    if (!action || !pluginId) {
      return NextResponse.json(
        { error: 'Missing required fields: action and pluginId' },
        { status: 400 }
      );
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    switch (action) {
      case 'enable':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} enabled successfully`,
          plugin: mockPlugins.find(p => p.id === pluginId)
        });

      case 'disable':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} disabled successfully`,
          plugin: mockPlugins.find(p => p.id === pluginId)
        });

      case 'install':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} installation started`,
          taskId: `install-${Date.now()}`
        });

      case 'uninstall':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} uninstalled successfully`
        });

      case 'configure':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} configured successfully`,
          config
        });

      case 'update':
        return NextResponse.json({
          success: true,
          message: `Plugin ${pluginId} update started`,
          taskId: `update-${Date.now()}`
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling plugin action:', error);
    return NextResponse.json(
      { error: 'Failed to process plugin action' },
      { status: 500 }
    );
  }
}