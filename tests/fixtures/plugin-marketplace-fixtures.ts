/**
 * Plugin Marketplace Test Fixtures
 * Comprehensive mock data for testing plugin marketplace functionality
 */

export interface PluginFixture {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  author: string;
  tags: string[];
  icon: string;
  screenshots: string[];
  documentation: string;
  repository: string;
  license: string;
  backstageVersion: string;
  dependencies: Record<string, string>;
  configuration: PluginConfigSchema;
  installation: InstallationConfig;
  metadata: PluginMetadata;
}

export interface PluginConfigSchema {
  properties: Record<string, any>;
  required: string[];
  additionalProperties: boolean;
}

export interface InstallationConfig {
  type: 'docker' | 'kubernetes' | 'npm';
  image?: string;
  chart?: string;
  package?: string;
  environment: Record<string, string>;
  resources?: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
}

export interface PluginMetadata {
  downloads: number;
  rating: number;
  reviews: number;
  lastUpdated: string;
  size: string;
  security: {
    vulnerabilities: number;
    securityScore: number;
    lastScan: string;
  };
  compatibility: {
    backstageVersions: string[];
    nodeVersions: string[];
    platforms: string[];
  };
}

// Core plugin fixtures
export const CORE_PLUGINS: PluginFixture[] = [
  {
    id: 'plugin-catalog-browser',
    name: '@backstage/plugin-catalog',
    displayName: 'Service Catalog Browser',
    description: 'Browse and manage your service catalog with advanced filtering and search capabilities',
    version: '1.2.3',
    category: 'catalog',
    author: 'Backstage Team',
    tags: ['catalog', 'services', 'microservices', 'documentation'],
    icon: 'https://example.com/icons/catalog.svg',
    screenshots: [
      'https://example.com/screenshots/catalog-1.png',
      'https://example.com/screenshots/catalog-2.png'
    ],
    documentation: 'https://backstage.io/docs/features/catalog',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0',
    backstageVersion: '>=1.35.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      '@backstage/plugin-catalog-react': '^1.12.0',
      '@backstage/catalog-model': '^1.6.0'
    },
    configuration: {
      properties: {
        title: {
          type: 'string',
          description: 'Display title for the catalog'
        },
        showFilters: {
          type: 'boolean',
          description: 'Show advanced filter options',
          default: true
        },
        defaultView: {
          type: 'string',
          enum: ['list', 'cards', 'table'],
          default: 'cards'
        }
      },
      required: ['title'],
      additionalProperties: false
    },
    installation: {
      type: 'npm',
      package: '@backstage/plugin-catalog',
      environment: {
        CATALOG_API_URL: '${BACKSTAGE_BACKEND_URL}/catalog'
      }
    },
    metadata: {
      downloads: 50000,
      rating: 4.8,
      reviews: 245,
      lastUpdated: '2024-01-15T10:00:00Z',
      size: '2.4 MB',
      security: {
        vulnerabilities: 0,
        securityScore: 95,
        lastScan: '2024-01-15T08:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.35.0', '1.36.0', '1.37.0', '1.38.0'],
        nodeVersions: ['18.x', '20.x'],
        platforms: ['linux', 'darwin', 'win32']
      }
    }
  },
  {
    id: 'plugin-kubernetes-monitor',
    name: '@backstage/plugin-kubernetes',
    displayName: 'Kubernetes Cluster Monitor',
    description: 'Monitor and manage Kubernetes clusters, pods, and deployments',
    version: '0.18.5',
    category: 'infrastructure',
    author: 'Backstage Team',
    tags: ['kubernetes', 'infrastructure', 'monitoring', 'devops'],
    icon: 'https://example.com/icons/kubernetes.svg',
    screenshots: [
      'https://example.com/screenshots/k8s-1.png',
      'https://example.com/screenshots/k8s-2.png',
      'https://example.com/screenshots/k8s-3.png'
    ],
    documentation: 'https://backstage.io/docs/features/kubernetes',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0',
    backstageVersion: '>=1.35.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      '@kubernetes/client-node': '^0.20.0',
      'lodash': '^4.17.21'
    },
    configuration: {
      properties: {
        clusterLocatorMethods: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['config', 'gke', 'serviceAccount'] },
              clusters: { type: 'array' }
            }
          }
        },
        customResources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              group: { type: 'string' },
              apiVersion: { type: 'string' },
              plural: { type: 'string' }
            }
          }
        }
      },
      required: ['clusterLocatorMethods'],
      additionalProperties: false
    },
    installation: {
      type: 'kubernetes',
      chart: 'backstage-k8s-plugin',
      environment: {
        KUBERNETES_SERVICE_ACCOUNT_TOKEN: '${K8S_SA_TOKEN}',
        CLUSTER_NAME: '${CLUSTER_NAME}'
      },
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' }
      }
    },
    metadata: {
      downloads: 25000,
      rating: 4.6,
      reviews: 180,
      lastUpdated: '2024-01-10T14:30:00Z',
      size: '5.2 MB',
      security: {
        vulnerabilities: 1,
        securityScore: 88,
        lastScan: '2024-01-10T12:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.35.0', '1.36.0', '1.37.0'],
        nodeVersions: ['18.x', '20.x'],
        platforms: ['linux', 'darwin']
      }
    }
  },
  {
    id: 'plugin-tech-docs',
    name: '@backstage/plugin-techdocs',
    displayName: 'Technical Documentation',
    description: 'Create, manage, and browse technical documentation with MkDocs integration',
    version: '1.10.2',
    category: 'documentation',
    author: 'Backstage Team',
    tags: ['documentation', 'mkdocs', 'markdown', 'wiki'],
    icon: 'https://example.com/icons/techdocs.svg',
    screenshots: [
      'https://example.com/screenshots/techdocs-1.png',
      'https://example.com/screenshots/techdocs-2.png'
    ],
    documentation: 'https://backstage.io/docs/features/techdocs',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0',
    backstageVersion: '>=1.35.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      '@backstage/plugin-techdocs-react': '^1.2.0',
      '@backstage/integration': '^1.9.0'
    },
    configuration: {
      properties: {
        builder: {
          type: 'string',
          enum: ['local', 'external'],
          description: 'How to build documentation'
        },
        generator: {
          type: 'object',
          properties: {
            runIn: { type: 'string', enum: ['docker', 'local'] }
          }
        },
        publisher: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['local', 'googleGcs', 'awsS3'] }
          }
        }
      },
      required: ['builder'],
      additionalProperties: false
    },
    installation: {
      type: 'docker',
      image: 'backstage/techdocs:latest',
      environment: {
        TECHDOCS_BUILDER_TYPE: 'external',
        TECHDOCS_PUBLISHER_TYPE: 'local'
      },
      resources: {
        requests: { cpu: '200m', memory: '256Mi' },
        limits: { cpu: '1000m', memory: '1Gi' }
      }
    },
    metadata: {
      downloads: 35000,
      rating: 4.7,
      reviews: 320,
      lastUpdated: '2024-01-12T09:15:00Z',
      size: '8.1 MB',
      security: {
        vulnerabilities: 0,
        securityScore: 92,
        lastScan: '2024-01-12T06:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.35.0', '1.36.0', '1.37.0', '1.38.0', '1.39.0'],
        nodeVersions: ['18.x', '20.x'],
        platforms: ['linux', 'darwin', 'win32']
      }
    }
  }
];

// Community plugin fixtures
export const COMMUNITY_PLUGINS: PluginFixture[] = [
  {
    id: 'plugin-jenkins-ci',
    name: '@backstage/plugin-jenkins',
    displayName: 'Jenkins CI/CD Integration',
    description: 'View Jenkins builds, pipelines, and deployment status directly in Backstage',
    version: '0.5.8',
    category: 'ci-cd',
    author: 'Community',
    tags: ['jenkins', 'ci-cd', 'builds', 'deployments'],
    icon: 'https://example.com/icons/jenkins.svg',
    screenshots: [
      'https://example.com/screenshots/jenkins-1.png'
    ],
    documentation: 'https://github.com/backstage/backstage/tree/master/plugins/jenkins',
    repository: 'https://github.com/backstage/backstage',
    license: 'Apache-2.0',
    backstageVersion: '>=1.35.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      'jenkins': '^0.28.0'
    },
    configuration: {
      properties: {
        baseUrl: {
          type: 'string',
          description: 'Jenkins server URL'
        },
        username: {
          type: 'string',
          description: 'Jenkins username'
        },
        apiKey: {
          type: 'string',
          description: 'Jenkins API key'
        }
      },
      required: ['baseUrl', 'username', 'apiKey'],
      additionalProperties: false
    },
    installation: {
      type: 'npm',
      package: '@backstage/plugin-jenkins',
      environment: {
        JENKINS_BASE_URL: '${JENKINS_URL}',
        JENKINS_USERNAME: '${JENKINS_USER}',
        JENKINS_API_KEY: '${JENKINS_TOKEN}'
      }
    },
    metadata: {
      downloads: 15000,
      rating: 4.2,
      reviews: 85,
      lastUpdated: '2024-01-08T16:20:00Z',
      size: '1.8 MB',
      security: {
        vulnerabilities: 2,
        securityScore: 78,
        lastScan: '2024-01-08T14:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.35.0', '1.36.0'],
        nodeVersions: ['18.x'],
        platforms: ['linux', 'darwin']
      }
    }
  },
  {
    id: 'plugin-security-scanner',
    name: '@community/plugin-security-insights',
    displayName: 'Security Vulnerability Scanner',
    description: 'Scan repositories for security vulnerabilities and compliance issues',
    version: '2.1.0',
    category: 'security',
    author: 'Security Community',
    tags: ['security', 'vulnerabilities', 'compliance', 'scanning'],
    icon: 'https://example.com/icons/security.svg',
    screenshots: [
      'https://example.com/screenshots/security-1.png',
      'https://example.com/screenshots/security-2.png'
    ],
    documentation: 'https://github.com/security-community/backstage-security-plugin',
    repository: 'https://github.com/security-community/backstage-security-plugin',
    license: 'MIT',
    backstageVersion: '>=1.36.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      'snyk': '^1.1200.0',
      'semver': '^7.5.0'
    },
    configuration: {
      properties: {
        scanners: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['snyk', 'npm-audit', 'trivy']
          }
        },
        schedule: {
          type: 'string',
          description: 'Cron schedule for automated scans'
        },
        thresholds: {
          type: 'object',
          properties: {
            critical: { type: 'number' },
            high: { type: 'number' },
            medium: { type: 'number' }
          }
        }
      },
      required: ['scanners'],
      additionalProperties: false
    },
    installation: {
      type: 'kubernetes',
      chart: 'security-scanner-plugin',
      environment: {
        SNYK_TOKEN: '${SNYK_API_TOKEN}',
        SCAN_SCHEDULE: '0 2 * * *'
      },
      resources: {
        requests: { cpu: '200m', memory: '512Mi' },
        limits: { cpu: '1000m', memory: '2Gi' }
      }
    },
    metadata: {
      downloads: 8500,
      rating: 4.5,
      reviews: 42,
      lastUpdated: '2024-01-05T11:45:00Z',
      size: '12.3 MB',
      security: {
        vulnerabilities: 0,
        securityScore: 96,
        lastScan: '2024-01-05T10:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.36.0', '1.37.0', '1.38.0'],
        nodeVersions: ['18.x', '20.x'],
        platforms: ['linux']
      }
    }
  }
];

// Test plugin fixtures with edge cases
export const TEST_PLUGINS: PluginFixture[] = [
  {
    id: 'plugin-test-outdated',
    name: '@test/plugin-outdated',
    displayName: 'Outdated Test Plugin',
    description: 'Plugin with outdated dependencies for compatibility testing',
    version: '0.1.0',
    category: 'testing',
    author: 'Test Team',
    tags: ['test', 'outdated', 'compatibility'],
    icon: 'https://example.com/icons/test.svg',
    screenshots: [],
    documentation: 'https://example.com/docs/test-plugin',
    repository: 'https://github.com/test/outdated-plugin',
    license: 'MIT',
    backstageVersion: '>=1.30.0',
    dependencies: {
      '@backstage/core-components': '^0.10.0', // Outdated version
      'react': '^16.14.0' // Outdated React version
    },
    configuration: {
      properties: {
        enabled: {
          type: 'boolean',
          default: false
        }
      },
      required: [],
      additionalProperties: true
    },
    installation: {
      type: 'npm',
      package: '@test/plugin-outdated',
      environment: {}
    },
    metadata: {
      downloads: 100,
      rating: 2.1,
      reviews: 5,
      lastUpdated: '2023-06-01T10:00:00Z',
      size: '500 KB',
      security: {
        vulnerabilities: 15,
        securityScore: 25,
        lastScan: '2023-12-01T10:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.30.0', '1.31.0'],
        nodeVersions: ['16.x'],
        platforms: ['linux']
      }
    }
  },
  {
    id: 'plugin-test-large',
    name: '@test/plugin-large',
    displayName: 'Large Test Plugin',
    description: 'Plugin with large size for performance testing',
    version: '1.0.0',
    category: 'testing',
    author: 'Test Team',
    tags: ['test', 'large', 'performance'],
    icon: 'https://example.com/icons/large.svg',
    screenshots: Array(20).fill('https://example.com/screenshots/large-plugin.png'),
    documentation: 'https://example.com/docs/large-plugin',
    repository: 'https://github.com/test/large-plugin',
    license: 'Apache-2.0',
    backstageVersion: '>=1.38.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0',
      'lodash': '^4.17.21',
      'moment': '^2.29.0',
      'chart.js': '^4.4.0',
      'd3': '^7.8.0'
    },
    configuration: {
      properties: {
        dataSize: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'xlarge'],
          default: 'large'
        },
        cacheSize: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          default: 500
        }
      },
      required: ['dataSize'],
      additionalProperties: false
    },
    installation: {
      type: 'kubernetes',
      chart: 'large-test-plugin',
      environment: {
        DATA_SIZE: 'large',
        MEMORY_LIMIT: '4Gi'
      },
      resources: {
        requests: { cpu: '500m', memory: '1Gi' },
        limits: { cpu: '2000m', memory: '4Gi' }
      }
    },
    metadata: {
      downloads: 1000,
      rating: 3.8,
      reviews: 25,
      lastUpdated: '2024-01-01T00:00:00Z',
      size: '150 MB',
      security: {
        vulnerabilities: 3,
        securityScore: 72,
        lastScan: '2024-01-01T00:00:00Z'
      },
      compatibility: {
        backstageVersions: ['1.38.0', '1.39.0'],
        nodeVersions: ['20.x'],
        platforms: ['linux', 'darwin']
      }
    }
  }
];

// Plugin categories for testing
export const PLUGIN_CATEGORIES = [
  'catalog',
  'infrastructure',
  'documentation',
  'ci-cd',
  'monitoring',
  'security',
  'analytics',
  'collaboration',
  'testing',
  'productivity'
];

// Search filters for testing
export const SEARCH_FILTERS = {
  categories: PLUGIN_CATEGORIES,
  tags: [
    'backstage', 'kubernetes', 'jenkins', 'security', 'monitoring',
    'documentation', 'ci-cd', 'catalog', 'microservices', 'devops',
    'compliance', 'scanning', 'builds', 'deployments', 'wiki'
  ],
  ratings: [1, 2, 3, 4, 5],
  compatibility: {
    backstageVersions: ['1.35.0', '1.36.0', '1.37.0', '1.38.0', '1.39.0', '1.40.0'],
    nodeVersions: ['16.x', '18.x', '20.x'],
    platforms: ['linux', 'darwin', 'win32']
  }
};

// Combined fixture collection
export const ALL_PLUGINS: PluginFixture[] = [
  ...CORE_PLUGINS,
  ...COMMUNITY_PLUGINS,
  ...TEST_PLUGINS
];

// Helper functions for test data generation
export function generateRandomPlugin(overrides?: Partial<PluginFixture>): PluginFixture {
  const id = `plugin-${Math.random().toString(36).substring(7)}`;
  const categories = PLUGIN_CATEGORIES;
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  return {
    id,
    name: `@test/${id}`,
    displayName: `Test Plugin ${id}`,
    description: `Generated test plugin for ${category} functionality`,
    version: `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    category,
    author: 'Test Generator',
    tags: [category, 'test', 'generated'],
    icon: `https://example.com/icons/${id}.svg`,
    screenshots: [`https://example.com/screenshots/${id}.png`],
    documentation: `https://example.com/docs/${id}`,
    repository: `https://github.com/test/${id}`,
    license: 'MIT',
    backstageVersion: '>=1.35.0',
    dependencies: {
      '@backstage/core-components': '^0.14.0'
    },
    configuration: {
      properties: {
        enabled: { type: 'boolean', default: true }
      },
      required: [],
      additionalProperties: false
    },
    installation: {
      type: 'npm',
      package: `@test/${id}`,
      environment: {}
    },
    metadata: {
      downloads: Math.floor(Math.random() * 10000),
      rating: Math.round((Math.random() * 4 + 1) * 10) / 10,
      reviews: Math.floor(Math.random() * 100),
      lastUpdated: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      size: `${Math.round(Math.random() * 10 * 10) / 10} MB`,
      security: {
        vulnerabilities: Math.floor(Math.random() * 5),
        securityScore: Math.floor(Math.random() * 40 + 60),
        lastScan: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      compatibility: {
        backstageVersions: ['1.35.0', '1.36.0', '1.37.0'],
        nodeVersions: ['18.x', '20.x'],
        platforms: ['linux', 'darwin']
      }
    },
    ...overrides
  };
}

export function createPluginCollection(count: number): PluginFixture[] {
  return Array.from({ length: count }, () => generateRandomPlugin());
}

// Export default collection
export default ALL_PLUGINS;