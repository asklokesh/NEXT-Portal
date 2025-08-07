import { NextRequest, NextResponse } from 'next/server';

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  latestVersion: string;
  versions: PluginVersion[];
  author: {
    name: string;
    email?: string;
    url?: string;
    verified: boolean;
  };
  maintainers?: Array<{
    name: string;
    email?: string;
  }>;
  downloads: {
    total: number;
    monthly: number;
    weekly: number;
    daily: number;
  };
  stats: {
    stars: number;
    forks: number;
    issues: number;
    rating: number;
    reviews: number;
  };
  tags: string[];
  keywords: string[];
  compatibility: {
    backstage: string;
    node: string;
    npm?: string;
    yarn?: string;
  };
  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  size: {
    unpacked: number;
    gzipped: number;
  };
  files: string[];
  license: string;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  documentation?: string;
  bugs?: {
    url?: string;
    email?: string;
  };
  funding?: Array<{
    type: string;
    url: string;
  }>;
  publishedAt: string;
  lastUpdated: string;
  installed?: boolean;
  installedVersion?: string;
  featured?: boolean;
  trending?: boolean;
  verified?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
  securityScore?: number;
  securityVulnerabilities?: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    fixedIn?: string;
  }>;
  screenshots?: string[];
  icon?: string;
  readme?: string;
  changelog?: string;
  federation?: {
    enabled: boolean;
    sharedWith: string[];
    importedFrom?: string;
  };
}

interface PluginVersion {
  version: string;
  publishedAt: string;
  compatibility: {
    backstage: string;
    node: string;
  };
  deprecated?: boolean;
  prerelease?: boolean;
  changelog?: string;
}

// In-memory storage for demo
const pluginsDatabase = new Map<string, Plugin>();
const reviewsDatabase = new Map<string, PluginReview[]>();
const installationsDatabase = new Map<string, PluginInstallation[]>();

interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  version: string;
  verified: boolean;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

interface PluginInstallation {
  id: string;
  pluginId: string;
  pluginVersion: string;
  userId: string;
  tenantId?: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  config?: Record<string, any>;
  errorMessage?: string;
  installationLogs: string[];
  installedAt?: string;
  lastUpdated: string;
}

// Initialize with sample data
const initializeSamplePlugins = () => {
  const samplePlugins: Plugin[] = [
    {
      id: 'github-actions',
      name: '@backstage/plugin-github-actions',
      displayName: 'GitHub Actions',
      description: 'View and manage GitHub Actions workflows directly from Backstage',
      category: 'ci-cd',
      version: '0.6.15',
      latestVersion: '0.6.15',
      versions: [
        { version: '0.6.15', publishedAt: '2024-01-15', compatibility: { backstage: '>=1.20.0', node: '>=18.0.0' } },
        { version: '0.6.14', publishedAt: '2024-01-10', compatibility: { backstage: '>=1.19.0', node: '>=18.0.0' } },
        { version: '0.6.13', publishedAt: '2024-01-05', compatibility: { backstage: '>=1.19.0', node: '>=16.0.0' } }
      ],
      author: { name: 'Spotify', verified: true },
      downloads: { total: 245000, monthly: 45000, weekly: 12000, daily: 1800 },
      stats: { stars: 1250, forks: 89, issues: 23, rating: 4.8, reviews: 342 },
      tags: ['github', 'ci-cd', 'workflows', 'automation'],
      keywords: ['backstage', 'plugin', 'github', 'actions', 'ci', 'cd'],
      compatibility: { backstage: '>=1.20.0', node: '>=18.0.0' },
      dependencies: {
        '@backstage/core-plugin-api': '^1.5.0',
        '@backstage/catalog-model': '^1.3.0',
        '@octokit/rest': '^19.0.0'
      },
      size: { unpacked: 2515456, gzipped: 524288 },
      files: ['dist', 'src', 'package.json', 'README.md'],
      license: 'Apache-2.0',
      repository: { type: 'git', url: 'https://github.com/backstage/backstage' },
      homepage: 'https://backstage.io/plugins/github-actions',
      publishedAt: '2024-01-15T10:00:00Z',
      lastUpdated: '2024-01-15T10:00:00Z',
      featured: true,
      verified: true,
      securityScore: 95,
      icon: '🎬'
    },
    {
      id: 'kubernetes',
      name: '@backstage/plugin-kubernetes',
      displayName: 'Kubernetes',
      description: 'Visualize and manage Kubernetes resources for your services',
      category: 'infrastructure',
      version: '0.11.8',
      latestVersion: '0.11.8',
      versions: [
        { version: '0.11.8', publishedAt: '2024-01-20', compatibility: { backstage: '>=1.18.0', node: '>=16.0.0' } },
        { version: '0.11.7', publishedAt: '2024-01-15', compatibility: { backstage: '>=1.18.0', node: '>=16.0.0' } }
      ],
      author: { name: 'Spotify', verified: true },
      downloads: { total: 189000, monthly: 38000, weekly: 9500, daily: 1400 },
      stats: { stars: 982, forks: 145, issues: 34, rating: 4.7, reviews: 278 },
      tags: ['kubernetes', 'k8s', 'containers', 'orchestration'],
      keywords: ['backstage', 'plugin', 'kubernetes', 'k8s', 'containers'],
      compatibility: { backstage: '>=1.18.0', node: '>=16.0.0' },
      dependencies: {
        '@backstage/core-plugin-api': '^1.5.0',
        '@kubernetes/client-node': '^0.18.0'
      },
      size: { unpacked: 3248128, gzipped: 687104 },
      files: ['dist', 'src', 'package.json', 'README.md'],
      license: 'Apache-2.0',
      repository: { type: 'git', url: 'https://github.com/backstage/backstage' },
      publishedAt: '2024-01-20T10:00:00Z',
      lastUpdated: '2024-01-20T10:00:00Z',
      trending: true,
      verified: true,
      securityScore: 92,
      icon: '☸️'
    }
  ];

  samplePlugins.forEach(plugin => {
    pluginsDatabase.set(plugin.id, plugin);
  });

  // Initialize sample reviews
  const sampleReviews: PluginReview[] = [
    {
      id: 'review-1',
      pluginId: 'github-actions',
      userId: 'user-1',
      userName: 'John Developer',
      userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      rating: 5,
      title: 'Excellent integration with GitHub',
      content: 'This plugin seamlessly integrates with our GitHub workflows. The UI is intuitive and provides all the information we need.',
      pros: ['Great UI', 'Easy setup', 'Real-time updates'],
      cons: ['Could use more filtering options'],
      version: '0.6.15',
      verified: true,
      helpful: 12,
      createdAt: '2024-01-16T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z'
    },
    {
      id: 'review-2',
      pluginId: 'github-actions',
      userId: 'user-2',
      userName: 'Sarah Admin',
      rating: 4,
      title: 'Good but needs more features',
      content: 'Works well for basic workflow monitoring. Would love to see more advanced analytics and deployment insights.',
      pros: ['Stable', 'Good documentation'],
      cons: ['Limited analytics', 'No deployment tracking'],
      version: '0.6.14',
      verified: true,
      helpful: 8,
      createdAt: '2024-01-14T15:30:00Z',
      updatedAt: '2024-01-14T15:30:00Z'
    },
    {
      id: 'review-3',
      pluginId: 'kubernetes',
      userId: 'user-3',
      userName: 'Mike DevOps',
      rating: 5,
      title: 'Perfect for K8s management',
      content: 'This is exactly what we needed for managing our Kubernetes deployments. The resource visualization is fantastic.',
      pros: ['Great visualization', 'Real-time monitoring', 'Multi-cluster support'],
      cons: [],
      version: '0.11.8',
      verified: true,
      helpful: 15,
      createdAt: '2024-01-21T09:15:00Z',
      updatedAt: '2024-01-21T09:15:00Z'
    }
  ];

  sampleReviews.forEach(review => {
    const pluginReviews = reviewsDatabase.get(review.pluginId) || [];
    pluginReviews.push(review);
    reviewsDatabase.set(review.pluginId, pluginReviews);
  });

  // Initialize sample installations
  const sampleInstallations: PluginInstallation[] = [
    {
      id: 'install-1',
      pluginId: 'github-actions',
      pluginVersion: '0.6.15',
      userId: 'user-1',
      tenantId: 'tenant-1',
      status: 'installed',
      config: { showAllWorkflows: true, maxWorkflows: 50 },
      installationLogs: [
        'Starting installation...',
        'Downloading plugin package...',
        'Installing dependencies...',
        'Configuring plugin...',
        'Installation completed successfully!'
      ],
      installedAt: '2024-01-16T11:00:00Z',
      lastUpdated: '2024-01-16T11:05:00Z'
    },
    {
      id: 'install-2',
      pluginId: 'kubernetes',
      pluginVersion: '0.11.8',
      userId: 'user-3',
      status: 'installed',
      installationLogs: [
        'Starting installation...',
        'Verifying Kubernetes access...',
        'Installing plugin...',
        'Installation completed!'
      ],
      installedAt: '2024-01-21T10:00:00Z',
      lastUpdated: '2024-01-21T10:03:00Z'
    }
  ];

  sampleInstallations.forEach(installation => {
    const userInstalls = installationsDatabase.get(installation.userId) || [];
    userInstalls.push(installation);
    installationsDatabase.set(installation.userId, userInstalls);
  });
};

initializeSamplePlugins();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'featured';
    const featured = searchParams.get('featured') === 'true';
    const verified = searchParams.get('verified') === 'true';
    const trending = searchParams.get('trending') === 'true';
    const installed = searchParams.get('installed') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let plugins = Array.from(pluginsDatabase.values());

    // Apply filters
    if (category && category !== 'all') {
      plugins = plugins.filter(p => p.category === category);
    }

    if (search) {
      const query = search.toLowerCase();
      plugins = plugins.filter(p =>
        p.displayName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query)) ||
        p.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    if (featured) {
      plugins = plugins.filter(p => p.featured);
    }

    if (verified) {
      plugins = plugins.filter(p => p.verified);
    }

    if (trending) {
      plugins = plugins.filter(p => p.trending);
    }

    if (installed) {
      plugins = plugins.filter(p => p.installed);
    }

    // Apply sorting
    switch (sort) {
      case 'downloads':
        plugins.sort((a, b) => b.downloads.total - a.downloads.total);
        break;
      case 'stars':
        plugins.sort((a, b) => b.stats.stars - a.stats.stars);
        break;
      case 'rating':
        plugins.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case 'recent':
        plugins.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        break;
      case 'name':
        plugins.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'featured':
      default:
        plugins.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.downloads.total - a.downloads.total;
        });
    }

    // Apply pagination
    const total = plugins.length;
    plugins = plugins.slice(offset, offset + limit);

    return NextResponse.json({
      plugins,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });

  } catch (error) {
    console.error('Failed to fetch plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const action = data.action;

    if (action === 'install') {
      // Handle plugin installation
      const { pluginId, version, userId, tenantId, config } = data;

      if (!pluginId || !version || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields: pluginId, version, userId' },
          { status: 400 }
        );
      }

      const plugin = pluginsDatabase.get(pluginId);
      if (!plugin) {
        return NextResponse.json(
          { error: 'Plugin not found' },
          { status: 404 }
        );
      }

      // Create installation record
      const installation: PluginInstallation = {
        id: `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pluginId,
        pluginVersion: version,
        userId,
        tenantId,
        status: 'installing',
        config,
        installationLogs: ['Starting installation...'],
        lastUpdated: new Date().toISOString()
      };

      // Add to user installations
      const userInstalls = installationsDatabase.get(userId) || [];
      userInstalls.push(installation);
      installationsDatabase.set(userId, userInstalls);

      // Simulate installation process
      setTimeout(() => {
        installation.status = 'installed';
        installation.installedAt = new Date().toISOString();
        installation.installationLogs = [
          'Starting installation...',
          'Downloading plugin package...',
          'Installing dependencies...',
          'Configuring plugin...',
          'Installation completed successfully!'
        ];
        installation.lastUpdated = new Date().toISOString();

        // Update plugin download count
        plugin.downloads.total += 1;
        plugin.downloads.monthly += 1;
        plugin.downloads.weekly += 1;
        plugin.downloads.daily += 1;
        pluginsDatabase.set(pluginId, plugin);
      }, 3000);

      return NextResponse.json({
        message: 'Installation started',
        installation
      }, { status: 201 });

    } else if (action === 'review') {
      // Handle plugin review
      const { pluginId, userId, userName, rating, title, content, pros, cons, version } = data;

      if (!pluginId || !userId || !rating || !title || !content) {
        return NextResponse.json(
          { error: 'Missing required fields for review' },
          { status: 400 }
        );
      }

      const review: PluginReview = {
        id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pluginId,
        userId,
        userName: userName || 'Anonymous User',
        rating,
        title,
        content,
        pros: pros || [],
        cons: cons || [],
        version,
        verified: false, // In production, check if user has installed the plugin
        helpful: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add review
      const pluginReviews = reviewsDatabase.get(pluginId) || [];
      pluginReviews.push(review);
      reviewsDatabase.set(pluginId, pluginReviews);

      // Update plugin rating and review count
      const plugin = pluginsDatabase.get(pluginId);
      if (plugin) {
        const allReviews = pluginReviews;
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        plugin.stats.rating = Math.round(avgRating * 10) / 10;
        plugin.stats.reviews = allReviews.length;
        pluginsDatabase.set(pluginId, plugin);
      }

      return NextResponse.json({
        message: 'Review added successfully',
        review
      }, { status: 201 });

    } else {
      // Handle plugin publishing (existing functionality)
      const plugin = data;

      // Validate required fields
      if (!plugin.id || !plugin.name || !plugin.displayName) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Generate additional metadata
      plugin.publishedAt = new Date().toISOString();
      plugin.lastUpdated = new Date().toISOString();
      plugin.downloads = plugin.downloads || { total: 0, monthly: 0, weekly: 0, daily: 0 };
      plugin.stats = plugin.stats || { stars: 0, forks: 0, issues: 0, rating: 0, reviews: 0 };

      // Store plugin
      pluginsDatabase.set(plugin.id, plugin);

      return NextResponse.json({
        message: 'Plugin published successfully',
        plugin
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Failed to process request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}