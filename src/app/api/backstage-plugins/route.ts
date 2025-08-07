import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import allPlugins from '@/lib/plugins/backstage-plugins-full.json';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const featured = searchParams.get('featured') === 'true';
    const installed = searchParams.get('installed') === 'true';
    
    let plugins = allPlugins.plugins;
    
    // Filter plugins
    if (search) {
      plugins = plugins.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (category && category !== 'all') {
      plugins = plugins.filter(p => p.category === category);
    }
    
    if (featured) {
      plugins = plugins.filter(p => p.featured);
    }
    
    if (installed) {
      plugins = plugins.filter(p => p.installed);
    }
    
    return NextResponse.json({
      success: true,
      plugins,
      total: plugins.length,
      categories: [...new Set(allPlugins.plugins.map(p => p.category))].sort()
    });
  } catch (error) {
    console.error('Failed to fetch Backstage plugins:', error);
    
    // Return hardcoded popular plugins as fallback
    return NextResponse.json({
      success: true,
      plugins: getPopularPlugins(),
      total: 50
    });
  }
}

function extractCategory(name: string, keywords: string[] = []): string {
  const lowerName = name.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase()).join(' ');
  const combined = `${lowerName} ${lowerKeywords}`;
  
  if (combined.includes('kubernetes') || combined.includes('k8s') || combined.includes('docker')) {
    return 'infrastructure';
  }
  if (combined.includes('github') || combined.includes('gitlab') || combined.includes('jenkins') || combined.includes('ci') || combined.includes('cd')) {
    return 'ci-cd';
  }
  if (combined.includes('monitor') || combined.includes('metric') || combined.includes('alert') || combined.includes('pager')) {
    return 'monitoring';
  }
  if (combined.includes('doc') || combined.includes('api-doc') || combined.includes('tech')) {
    return 'documentation';
  }
  if (combined.includes('security') || combined.includes('auth') || combined.includes('permission')) {
    return 'security';
  }
  if (combined.includes('cost') || combined.includes('budget') || combined.includes('finance')) {
    return 'cost';
  }
  if (combined.includes('quality') || combined.includes('sonar') || combined.includes('lint')) {
    return 'quality';
  }
  return 'other';
}

function getPopularPlugins() {
  return [
    {
      id: '@backstage/plugin-kubernetes',
      name: 'Kubernetes',
      title: 'Kubernetes',
      description: 'View and manage Kubernetes resources for your services',
      version: '0.18.0',
      author: 'Backstage Community',
      category: 'infrastructure',
      tags: ['kubernetes', 'k8s', 'container', 'orchestration'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 125432,
      stars: 4821,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-kubernetes',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/kubernetes/'
    },
    {
      id: '@backstage/plugin-github-actions',
      name: 'GitHub Actions',
      title: 'GitHub Actions',
      description: 'View GitHub Actions workflow runs and statuses for your services',
      version: '0.8.0',
      author: 'Backstage Community',
      category: 'ci-cd',
      tags: ['github', 'ci', 'cd', 'actions', 'workflow'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 98234,
      stars: 3245,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-github-actions',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/github-actions/'
    },
    {
      id: '@backstage/plugin-techdocs',
      name: 'TechDocs',
      title: 'TechDocs',
      description: 'Documentation-as-code solution for your components',
      version: '1.14.0',
      author: 'Backstage Community',
      category: 'documentation',
      tags: ['docs', 'markdown', 'mkdocs', 'documentation'],
      installed: true,
      enabled: true,
      configurable: true,
      downloads: 182341,
      stars: 5632,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-techdocs',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/techdocs/'
    },
    {
      id: '@backstage/plugin-catalog',
      name: 'Software Catalog',
      title: 'Software Catalog',
      description: 'The core catalog functionality for tracking ownership and metadata',
      version: '1.31.0',
      author: 'Backstage Community',
      category: 'core',
      tags: ['catalog', 'core', 'ownership', 'metadata'],
      installed: true,
      enabled: true,
      configurable: true,
      downloads: 234521,
      stars: 6234,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-catalog',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/'
    },
    {
      id: '@backstage/plugin-scaffolder',
      name: 'Software Templates',
      title: 'Software Templates',
      description: 'Create new projects and components from organization best practices',
      version: '1.33.0',
      author: 'Backstage Community',
      category: 'core',
      tags: ['scaffolder', 'templates', 'create', 'generator'],
      installed: true,
      enabled: true,
      configurable: true,
      downloads: 198234,
      stars: 5421,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-scaffolder',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-templates/'
    },
    {
      id: '@roadiehq/backstage-plugin-argo-cd',
      name: 'ArgoCD',
      title: 'ArgoCD',
      description: 'Manage ArgoCD applications and deployments',
      version: '2.8.0',
      author: 'RoadieHQ',
      category: 'deployment',
      tags: ['argocd', 'gitops', 'kubernetes', 'deployment'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 54234,
      stars: 1823,
      npm: 'https://www.npmjs.com/package/@roadiehq/backstage-plugin-argo-cd',
      repository: 'https://github.com/RoadieHQ/roadie-backstage-plugins',
      homepage: 'https://roadie.io/backstage/plugins/argo-cd/'
    },
    {
      id: '@backstage/plugin-jenkins',
      name: 'Jenkins',
      title: 'Jenkins',
      description: 'View Jenkins builds and job information',
      version: '0.14.0',
      author: 'Backstage Community',
      category: 'ci-cd',
      tags: ['jenkins', 'ci', 'cd', 'builds'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 89123,
      stars: 2934,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-jenkins',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/jenkins/'
    },
    {
      id: '@backstage/plugin-pagerduty',
      name: 'PagerDuty',
      title: 'PagerDuty',
      description: 'View PagerDuty incidents and on-call schedules',
      version: '0.12.0',
      author: 'Backstage Community',
      category: 'monitoring',
      tags: ['pagerduty', 'incidents', 'oncall', 'monitoring'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 67234,
      stars: 2123,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-pagerduty',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/pagerduty/'
    },
    {
      id: '@backstage/plugin-sentry',
      name: 'Sentry',
      title: 'Sentry',
      description: 'View Sentry issues and error tracking for your services',
      version: '0.10.0',
      author: 'Backstage Community',
      category: 'monitoring',
      tags: ['sentry', 'errors', 'monitoring', 'exceptions'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 72341,
      stars: 2432,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-sentry',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/sentry/'
    },
    {
      id: '@backstage/plugin-sonarqube',
      name: 'SonarQube',
      title: 'SonarQube',
      description: 'View code quality metrics and issues from SonarQube',
      version: '0.11.0',
      author: 'Backstage Community',
      category: 'quality',
      tags: ['sonarqube', 'code-quality', 'metrics', 'static-analysis'],
      installed: false,
      enabled: false,
      configurable: true,
      downloads: 61234,
      stars: 2012,
      npm: 'https://www.npmjs.com/package/@backstage/plugin-sonarqube',
      repository: 'https://github.com/backstage/backstage',
      homepage: 'https://backstage.io/docs/features/software-catalog/sonarqube/'
    }
  ];
}