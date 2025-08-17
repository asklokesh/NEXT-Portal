import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    const sort = searchParams.get('sort') || 'popularity';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Mock plugin data for development
    const mockPlugins = [
      {
        id: '@backstage/plugin-catalog',
        name: 'Software Catalog',
        description: 'Centralized catalog of all your software components, services, websites, and resources',
        version: '1.15.0',
        downloads: 125000,
        category: 'Core',
        tags: ['catalog', 'components', 'services'],
        author: 'Backstage Team',
        license: 'Apache-2.0',
        repository: 'https://github.com/backstage/backstage',
        homepage: 'https://backstage.io',
        lastUpdate: '2024-01-15',
        stars: 23500,
        quality: 95,
        maintenance: 98,
        popularity: 92,
        security: {
          hasVulnerabilities: false,
          lastAudit: '2024-01-10'
        }
      },
      {
        id: '@backstage/plugin-techdocs',
        name: 'TechDocs',
        description: 'Technical documentation platform built into Backstage',
        version: '1.9.3',
        downloads: 95000,
        category: 'Documentation',
        tags: ['docs', 'markdown', 'technical-writing'],
        author: 'Backstage Team',
        license: 'Apache-2.0',
        repository: 'https://github.com/backstage/backstage',
        homepage: 'https://backstage.io',
        lastUpdate: '2024-01-12',
        stars: 23500,
        quality: 92,
        maintenance: 95,
        popularity: 88,
        security: {
          hasVulnerabilities: false,
          lastAudit: '2024-01-08'
        }
      },
      {
        id: '@backstage/plugin-kubernetes',
        name: 'Kubernetes',
        description: 'View and manage your Kubernetes clusters and workloads',
        version: '0.11.2',
        downloads: 78000,
        category: 'Infrastructure',
        tags: ['kubernetes', 'k8s', 'containers', 'orchestration'],
        author: 'Backstage Team',
        license: 'Apache-2.0',
        repository: 'https://github.com/backstage/backstage',
        homepage: 'https://backstage.io',
        lastUpdate: '2024-01-05',
        stars: 23500,
        quality: 89,
        maintenance: 92,
        popularity: 85,
        security: {
          hasVulnerabilities: false,
          lastAudit: '2024-01-03'
        }
      },
      {
        id: '@backstage/plugin-github-actions',
        name: 'GitHub Actions',
        description: 'View and manage GitHub Actions workflows and runs',
        version: '0.6.8',
        downloads: 65000,
        category: 'CI/CD',
        tags: ['github', 'actions', 'ci', 'cd', 'workflows'],
        author: 'Backstage Team',
        license: 'Apache-2.0',
        repository: 'https://github.com/backstage/backstage',
        homepage: 'https://backstage.io',
        lastUpdate: '2024-01-08',
        stars: 23500,
        quality: 87,
        maintenance: 90,
        popularity: 82,
        security: {
          hasVulnerabilities: false,
          lastAudit: '2024-01-05'
        }
      },
      {
        id: '@backstage/plugin-scaffolder',
        name: 'Software Templates',
        description: 'Create new software components using templates',
        version: '1.18.0',
        downloads: 85000,
        category: 'Developer Tools',
        tags: ['scaffolding', 'templates', 'code-generation'],
        author: 'Backstage Team',
        license: 'Apache-2.0',
        repository: 'https://github.com/backstage/backstage',
        homepage: 'https://backstage.io',
        lastUpdate: '2024-01-14',
        stars: 23500,
        quality: 93,
        maintenance: 96,
        popularity: 90,
        security: {
          hasVulnerabilities: false,
          lastAudit: '2024-01-12'
        }
      }
    ];

    // Filter by query
    let filteredPlugins = mockPlugins;
    if (query) {
      filteredPlugins = mockPlugins.filter(plugin =>
        plugin.name.toLowerCase().includes(query.toLowerCase()) ||
        plugin.description.toLowerCase().includes(query.toLowerCase()) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Filter by category
    if (category && category !== 'all') {
      filteredPlugins = filteredPlugins.filter(plugin =>
        plugin.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort plugins
    switch (sort) {
      case 'downloads':
        filteredPlugins.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'stars':
        filteredPlugins.sort((a, b) => b.stars - a.stars);
        break;
      case 'updated':
        filteredPlugins.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());
        break;
      case 'name':
        filteredPlugins.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default: // popularity
        filteredPlugins.sort((a, b) => b.popularity - a.popularity);
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPlugins = filteredPlugins.slice(startIndex, endIndex);

    return NextResponse.json({
      plugins: paginatedPlugins,
      total: filteredPlugins.length,
      page,
      limit,
      totalPages: Math.ceil(filteredPlugins.length / limit),
      hasMore: endIndex < filteredPlugins.length
    });

  } catch (error) {
    console.error('Plugin search failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search plugins',
        plugins: [],
        total: 0 
      },
      { status: 500 }
    );
  }
}