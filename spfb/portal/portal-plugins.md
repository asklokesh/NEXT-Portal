# Portal Plugin Development

**Comprehensive guide to developing, deploying, and managing plugins for Spotify Portal for Backstage Beta**

## Overview

Spotify Portal for Backstage Beta provides a powerful, extensible plugin architecture that enables organizations to customize and extend their developer portal to meet specific business requirements. Built on the proven Backstage plugin system, Portal offers enterprise-grade plugin management, development tools, and deployment capabilities.

## Plugin Ecosystem

### Plugin Categories

#### Core Portal Plugins
**Essential plugins that come pre-installed with Portal**
- **Software Catalog**: Entity management and service discovery
- **Software Templates**: Code scaffolding and project creation
- **TechDocs**: Documentation-as-code integration
- **Search**: Unified search across all Portal content
- **Authentication**: Enterprise authentication and SSO integration

#### Spotify Premium Plugins
**Enterprise-grade plugins developed by Spotify**
- **[Soundcheck](../plugins2/soundcheck.md)**: Tech health and quality management
- **[Insights](../plugins2/insights.md)**: Platform adoption analytics
- **[AiKA](../plugins2/aika.md)**: AI-powered knowledge assistant
- **[Skill Exchange](../plugins2/skill-exchange.md)**: Internal learning marketplace
- **[RBAC](../plugins2/rbac.md)**: Role-based access control

#### Community Plugins
**Open-source plugins from the Backstage community**
- **100+ verified plugins** with Portal compatibility
- **Automatic updates** with compatibility testing
- **Community support** and documentation
- **Enterprise validation** for security and compliance

#### Custom Enterprise Plugins
**Organization-specific plugins for unique requirements**
- **Internal tool integrations** and custom workflows
- **Legacy system connectors** and data synchronization
- **Compliance-specific features** and reporting
- **Industry-specific capabilities** and processes

## Plugin Development Framework

### Development Environment Setup

#### Prerequisites
```bash
# Required tools
node --version  # 18.x or higher
yarn --version  # 1.22.x or higher
git --version   # Latest stable

# Portal CLI installation
npm install -g @spotify/portal-cli

# Verify installation
portal-cli --version
```

#### Development Workspace
```bash
# Create new plugin workspace
portal-cli create plugin --name my-enterprise-plugin
cd my-enterprise-plugin

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Plugin Architecture

#### Frontend Plugin Structure
```typescript
// Plugin definition
import { createPlugin } from '@backstage/core-plugin-api';
import { MyPluginPage } from './components/MyPluginPage';

export const myEnterprisePlugin = createPlugin({
  id: 'my-enterprise-plugin',
  routes: {
    root: rootRouteRef,
  },
  externalRoutes: {
    catalogEntity: catalogEntityRouteRef,
  },
});

// Plugin page component
export const MyEnterprisePluginPage = myEnterprisePlugin.provide(
  createRoutableExtension({
    name: 'MyEnterprisePluginPage',
    component: () => import('./components/MyPluginPage').then(m => m.MyPluginPage),
    mountPoint: rootRouteRef,
  }),
);
```

#### Backend Plugin Structure
```typescript
// Backend plugin setup
import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export default createBackendPlugin({
  pluginId: 'my-enterprise-plugin',
  register(env) {
    env.registerInit({
      deps: {
        http: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        database: coreServices.database,
      },
      async init({ http, logger, config, database }) {
        const router = await createRouter({
          logger,
          config,
          database,
        });
        http.use(router);
      },
    });
  },
});
```

## Common Plugin Use Cases

### 1. External System Integration
**Connect Portal to enterprise systems and tools**

#### CMDB Integration Example
```typescript
// CMDB data provider
import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { ScmIntegrations } from '@backstage/integration';

export class CMDBEntityProvider implements EntityProvider {
  private readonly env: PluginEnvironment;
  private readonly integrations: ScmIntegrations;
  private readonly logger: Logger;
  private connection?: EntityProviderConnection;

  constructor(env: PluginEnvironment) {
    this.env = env;
    this.integrations = ScmIntegrations.fromConfig(env.config);
    this.logger = env.logger;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.run();
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not initialized');
    }

    this.logger.info('Discovering CMDB entities');
    
    // Fetch entities from CMDB
    const entities = await this.fetchCMDBEntities();
    
    // Transform to Backstage entities
    const backstageEntities = entities.map(this.transformEntity);
    
    // Apply mutations
    await this.connection.applyMutation({
      type: 'full',
      entities: backstageEntities.map(entity => ({
        entity,
        locationKey: 'cmdb-provider',
      })),
    });
  }

  private async fetchCMDBEntities() {
    // Implementation to fetch from CMDB API
    const response = await fetch(`${this.cmdbBaseUrl}/api/services`, {
      headers: {
        'Authorization': `Bearer ${this.cmdbToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  private transformEntity(cmdbEntity: any): Entity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: cmdbEntity.name,
        title: cmdbEntity.displayName,
        description: cmdbEntity.description,
        annotations: {
          'cmdb.company.com/id': cmdbEntity.id,
          'cmdb.company.com/environment': cmdbEntity.environment,
        },
        tags: cmdbEntity.tags,
      },
      spec: {
        type: 'service',
        lifecycle: cmdbEntity.lifecycle,
        owner: cmdbEntity.owner,
        system: cmdbEntity.system,
      },
    };
  }
}
```

### 2. Custom Scaffolder Actions
**Extend software templates with organization-specific actions**

#### Custom Template Action Example
```typescript
// Custom scaffolder action
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';

export const createCustomDeploymentAction = () => {
  return createTemplateAction<{
    serviceName: string;
    environment: string;
    region: string;
    resources: {
      cpu: string;
      memory: string;
      replicas: number;
    };
  }>({
    id: 'company:deployment:create',
    description: 'Creates deployment configuration for company infrastructure',
    schema: {
      input: z.object({
        serviceName: z.string().describe('Name of the service to deploy'),
        environment: z.enum(['dev', 'staging', 'prod']).describe('Target environment'),
        region: z.string().describe('AWS region for deployment'),
        resources: z.object({
          cpu: z.string().describe('CPU allocation (e.g., "500m")'),
          memory: z.string().describe('Memory allocation (e.g., "1Gi")'),
          replicas: z.number().min(1).describe('Number of replicas'),
        }),
      }),
    },
    async handler(ctx) {
      const { serviceName, environment, region, resources } = ctx.input;

      // Generate Kubernetes manifests
      const deploymentManifest = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: serviceName,
          namespace: environment,
          labels: {
            app: serviceName,
            environment: environment,
          },
        },
        spec: {
          replicas: resources.replicas,
          selector: {
            matchLabels: {
              app: serviceName,
            },
          },
          template: {
            metadata: {
              labels: {
                app: serviceName,
              },
            },
            spec: {
              containers: [{
                name: serviceName,
                image: `company-registry/${serviceName}:latest`,
                resources: {
                  requests: {
                    cpu: resources.cpu,
                    memory: resources.memory,
                  },
                  limits: {
                    cpu: resources.cpu,
                    memory: resources.memory,
                  },
                },
                ports: [{
                  containerPort: 8080,
                }],
              }],
            },
          },
        },
      };

      // Write manifest file
      await ctx.output('deployment.yaml', JSON.stringify(deploymentManifest, null, 2));

      // Create infrastructure using company APIs
      await this.createInfrastructure({
        serviceName,
        environment,
        region,
        manifest: deploymentManifest,
      });

      ctx.logger.info(`Deployment configuration created for ${serviceName} in ${environment}`);
    },
  });
};
```

### 3. Custom Entity Processing
**Add organization-specific entity processing and enrichment**

#### Entity Processor Example
```typescript
// Custom entity processor
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogProcessor, CatalogProcessorEmit, processingResult } from '@backstage/plugin-catalog-node';

export class CompanyEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'CompanyEntityProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Add company-specific annotations
    if (entity.kind === 'Component') {
      const annotations = entity.metadata.annotations || {};
      
      // Add cost center information
      if (!annotations['company.com/cost-center']) {
        const costCenter = await this.deriveCostCenter(entity);
        annotations['company.com/cost-center'] = costCenter;
      }
      
      // Add security classification
      if (!annotations['company.com/security-level']) {
        const securityLevel = await this.deriveSecurityLevel(entity);
        annotations['company.com/security-level'] = securityLevel;
      }
      
      // Add compliance tags
      const complianceTags = await this.deriveComplianceTags(entity);
      annotations['company.com/compliance'] = complianceTags.join(',');
      
      return {
        ...entity,
        metadata: {
          ...entity.metadata,
          annotations,
        },
      };
    }
    
    return entity;
  }

  async postProcessEntity(
    entity: Entity,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Emit additional entities based on company logic
    if (entity.kind === 'Component' && entity.spec?.type === 'service') {
      // Create monitoring entity
      const monitoringEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: `${entity.metadata.name}-monitoring`,
          title: `${entity.metadata.title} Monitoring`,
          annotations: {
            'company.com/parent-component': entity.metadata.name,
          },
        },
        spec: {
          type: 'monitoring-dashboard',
          owner: entity.spec.owner,
          dependsOn: [`component:${entity.metadata.name}`],
        },
      };
      
      emit(processingResult.entity(location, monitoringEntity));
    }
    
    return entity;
  }

  private async deriveCostCenter(entity: Entity): Promise<string> {
    // Logic to derive cost center from entity metadata
    const owner = entity.spec?.owner as string;
    const teamInfo = await this.fetchTeamInfo(owner);
    return teamInfo.costCenter;
  }

  private async deriveSecurityLevel(entity: Entity): Promise<string> {
    // Logic to determine security level
    const tags = entity.metadata.tags || [];
    if (tags.includes('pci') || tags.includes('payment')) {
      return 'high';
    }
    if (tags.includes('internal')) {
      return 'medium';
    }
    return 'low';
  }

  private async deriveComplianceTags(entity: Entity): Promise<string[]> {
    // Logic to determine compliance requirements
    const tags = [];
    const securityLevel = await this.deriveSecurityLevel(entity);
    
    if (securityLevel === 'high') {
      tags.push('sox-compliant', 'pci-compliant');
    }
    
    const owner = entity.spec?.owner as string;
    const teamInfo = await this.fetchTeamInfo(owner);
    if (teamInfo.region === 'eu') {
      tags.push('gdpr-compliant');
    }
    
    return tags;
  }

  private async fetchTeamInfo(owner: string) {
    // Fetch team information from company systems
    // This would integrate with your HR/org systems
    return {
      costCenter: 'CC-001',
      region: 'us',
      department: 'engineering',
    };
  }
}
```

## Enterprise Plugin Development

### Security Best Practices

#### Authentication & Authorization
```typescript
// Secure API endpoint with RBAC
import { getBearerTokenFromAuthorizationHeader } from '@backstage/plugin-auth-node';
import { NotAllowedError } from '@backstage/errors';

export async function createSecureRouter(options: RouterOptions): Promise<express.Router> {
  const { logger, config, identity, permissions } = options;
  const router = Router();

  // Middleware for authentication
  router.use(async (req, res, next) => {
    try {
      const token = getBearerTokenFromAuthorizationHeader(req.headers.authorization);
      const user = await identity.getIdentity({ request: req });
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      req.user = user;
      next();
    } catch (error) {
      logger.error('Authentication failed', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Protected endpoint with permission check
  router.get('/sensitive-data', async (req, res) => {
    const decision = await permissions.authorize(
      [{ permission: customPermissions.readSensitiveData }],
      { credentials: req.user }
    );
    
    if (decision[0].result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Insufficient permissions');
    }
    
    // Return sensitive data
    const data = await getSensitiveData();
    res.json(data);
  });

  return router;
}
```

#### Input Validation & Sanitization
```typescript
// Input validation with Zod
import { z } from 'zod';
import { InputError } from '@backstage/errors';

const createEntitySchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  owner: z.string().email(),
  metadata: z.record(z.string()).optional(),
});

router.post('/entities', async (req, res) => {
  try {
    const validatedData = createEntitySchema.parse(req.body);
    
    // Sanitize HTML content
    const sanitizedDescription = validator.escape(validatedData.description || '');
    
    // Create entity with validated data
    const entity = await createEntity({
      ...validatedData,
      description: sanitizedDescription,
    });
    
    res.status(201).json(entity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InputError(`Validation failed: ${error.message}`);
    }
    throw error;
  }
});
```

### Performance Optimization

#### Caching Strategy
```typescript
// Redis caching implementation
import Redis from 'ioredis';
import { CacheService } from '@backstage/backend-common';

export class PluginCacheService {
  private redis: Redis;
  private logger: Logger;

  constructor(options: { redis: Redis; logger: Logger }) {
    this.redis = options.redis;
    this.logger = options.logger;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}:`, error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for pattern ${pattern}:`, error);
    }
  }
}

// Usage in plugin
export class OptimizedDataService {
  private cache: PluginCacheService;
  private dataSource: DataSource;

  async getExpensiveData(id: string): Promise<any> {
    const cacheKey = `expensive-data:${id}`;
    
    // Try cache first
    let data = await this.cache.get(cacheKey);
    if (data) {
      return data;
    }
    
    // Fetch from source if not cached
    data = await this.dataSource.fetchData(id);
    
    // Cache for 1 hour
    await this.cache.set(cacheKey, data, 3600);
    
    return data;
  }
}
```

### Testing Framework

#### Unit Testing
```typescript
// Jest test setup
import { TestDatabaseId, TestDatabases } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { getVoidLogger } from '@backstage/backend-common';

describe('CustomEntityProcessor', () => {
  let processor: CustomEntityProcessor;
  let database: TestDatabaseId;

  beforeAll(async () => {
    database = await TestDatabases.create();
  });

  beforeEach(() => {
    const config = new ConfigReader({
      company: {
        apiUrl: 'https://api.company.com',
        apiKey: 'test-key',
      },
    });
    
    processor = new CustomEntityProcessor({
      config,
      logger: getVoidLogger(),
      database: database.get(),
    });
  });

  afterAll(async () => {
    await database.shutdown();
  });

  describe('preProcessEntity', () => {
    it('should add cost center annotation', async () => {
      const entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-service',
        },
        spec: {
          type: 'service',
          owner: 'team-a',
        },
      };

      const result = await processor.preProcessEntity(
        entity,
        { type: 'url', target: 'https://example.com' },
        jest.fn(),
      );

      expect(result.metadata.annotations).toHaveProperty('company.com/cost-center');
    });

    it('should derive security level correctly', async () => {
      const entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'payment-service',
          tags: ['pci', 'payment'],
        },
        spec: {
          type: 'service',
          owner: 'team-payments',
        },
      };

      const result = await processor.preProcessEntity(
        entity,
        { type: 'url', target: 'https://example.com' },
        jest.fn(),
      );

      expect(result.metadata.annotations?.['company.com/security-level']).toBe('high');
    });
  });
});
```

#### Integration Testing
```typescript
// Integration test with test containers
import { startTestBackend } from '@backstage/backend-test-utils';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import customPlugin from '../src/plugin';

describe('Custom Plugin Integration', () => {
  let backend: any;

  beforeAll(async () => {
    backend = await startTestBackend({
      extensionPoints: [catalogProcessingExtensionPoint],
      features: [customPlugin()],
    });
  });

  afterAll(async () => {
    await backend.stop();
  });

  it('should process entities correctly', async () => {
    const catalogApi = backend.get('catalog');
    
    // Add test entity
    await catalogApi.addLocation({
      type: 'url',
      target: 'https://github.com/company/test-repo/blob/main/catalog-info.yaml',
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify entity was processed
    const entities = await catalogApi.getEntities({
      filter: { 'metadata.name': 'test-service' },
    });

    expect(entities.items).toHaveLength(1);
    expect(entities.items[0].metadata.annotations).toHaveProperty(
      'company.com/cost-center'
    );
  });
});
```

## Plugin Deployment & Management

### Deployment Strategies

#### CI/CD Pipeline Integration
```yaml
# GitHub Actions workflow for plugin deployment
name: Deploy Custom Plugin

on:
  push:
    branches: [main]
    paths: ['plugins/custom-plugin/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Run tests
        run: yarn test plugins/custom-plugin
      
      - name: Run lint
        run: yarn lint plugins/custom-plugin
      
      - name: Build plugin
        run: yarn build plugins/custom-plugin

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security scan
        run: |
          yarn audit
          yarn snyk test

  deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to staging
        run: |
          portal-cli plugin deploy \
            --plugin custom-plugin \
            --environment staging \
            --token ${{ secrets.PORTAL_DEPLOY_TOKEN }}
      
      - name: Run integration tests
        run: |
          yarn test:integration plugins/custom-plugin
      
      - name: Deploy to production
        run: |
          portal-cli plugin deploy \
            --plugin custom-plugin \
            --environment production \
            --token ${{ secrets.PORTAL_DEPLOY_TOKEN }}
```

#### Blue-Green Deployment
```typescript
// Blue-green deployment configuration
const deploymentConfig = {
  strategy: 'blue-green',
  environments: {
    blue: {
      version: 'current',
      traffic: 100,
      healthCheck: '/health',
    },
    green: {
      version: 'new',
      traffic: 0,
      healthCheck: '/health',
    },
  },
  switchover: {
    healthCheckTimeout: 60000,
    trafficShiftSteps: [10, 25, 50, 100],
    rollbackOnError: true,
  },
};
```

### Monitoring & Observability

#### Plugin Metrics
```typescript
// Plugin metrics collection
import { metrics } from '@backstage/backend-common';

export class PluginMetrics {
  private static readonly requestCounter = metrics.createCounter({
    name: 'custom_plugin_requests_total',
    help: 'Total number of requests to custom plugin',
    labelNames: ['method', 'endpoint', 'status'],
  });

  private static readonly requestDuration = metrics.createHistogram({
    name: 'custom_plugin_request_duration_seconds',
    help: 'Duration of requests to custom plugin',
    labelNames: ['method', 'endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  static recordRequest(method: string, endpoint: string, status: number, duration: number) {
    this.requestCounter.inc({ method, endpoint, status: status.toString() });
    this.requestDuration.observe({ method, endpoint }, duration);
  }

  static middleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        PluginMetrics.recordRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration
        );
      });
      
      next();
    };
  }
}
```

#### Health Checks
```typescript
// Plugin health check implementation
import { HealthCheck } from '@backstage/backend-common';

export class PluginHealthCheck implements HealthCheck {
  constructor(
    private readonly database: DatabaseService,
    private readonly externalApi: ExternalApiService,
  ) {}

  async getHealth(): Promise<{ status: number; payload?: any }> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkExternalApi(),
      this.checkCacheConnectivity(),
    ]);

    const failures = checks
      .filter(result => result.status === 'rejected')
      .map(result => (result as PromiseRejectedResult).reason.message);

    if (failures.length > 0) {
      return {
        status: 503,
        payload: {
          status: 'unhealthy',
          failures,
        },
      };
    }

    return {
      status: 200,
      payload: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async checkDatabase(): Promise<void> {
    await this.database.query('SELECT 1');
  }

  private async checkExternalApi(): Promise<void> {
    const response = await this.externalApi.healthCheck();
    if (!response.ok) {
      throw new Error(`External API health check failed: ${response.statusText}`);
    }
  }

  private async checkCacheConnectivity(): Promise<void> {
    // Implement cache connectivity check
  }
}
```

## Documentation & Support

### Plugin Documentation Standards

#### README Template
```markdown
# Custom Enterprise Plugin

## Overview
Brief description of what the plugin does and its business value.

## Features
- Feature 1: Description
- Feature 2: Description
- Feature 3: Description

## Installation

### Prerequisites
- Portal version: v1.x.x or higher
- Required permissions: `custom.read`, `custom.write`
- External dependencies: List any external services

### Install from Portal Marketplace
```bash
portal-cli plugin install @company/custom-plugin
```

### Manual Installation
```bash
yarn add @company/custom-plugin
```

## Configuration

### Environment Variables
```bash
CUSTOM_PLUGIN_API_URL=https://api.company.com
CUSTOM_PLUGIN_API_KEY=your-api-key
```

### app-config.yaml
```yaml
customPlugin:
  enabled: true
  apiUrl: ${CUSTOM_PLUGIN_API_URL}
  apiKey: ${CUSTOM_PLUGIN_API_KEY}
  features:
    advancedMode: true
```

## Usage

### Basic Usage
Step-by-step guide for basic functionality.

### Advanced Usage
Examples of advanced features and configurations.

## API Reference

### Endpoints
- `GET /api/custom/entities` - List entities
- `POST /api/custom/entities` - Create entity
- `PUT /api/custom/entities/:id` - Update entity
- `DELETE /api/custom/entities/:id` - Delete entity

### Types
```typescript
interface CustomEntity {
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, any>;
}
```

## Troubleshooting

### Common Issues
1. **Authentication fails**: Check API key configuration
2. **Slow performance**: Enable caching in configuration
3. **Data not appearing**: Verify permissions and data source connectivity

### Debug Mode
```bash
DEBUG=custom-plugin:* yarn dev
```

## Contributing

### Development Setup
```bash
git clone https://github.com/company/portal-plugins
cd portal-plugins/custom-plugin
yarn install
yarn dev
```

### Running Tests
```bash
yarn test
yarn test:watch
yarn test:coverage
```

## Support

- **Internal Support**: #portal-support Slack channel
- **Documentation**: https://portal.company.com/docs/plugins/custom
- **Bug Reports**: https://github.com/company/portal-plugins/issues
```

### API Documentation
```yaml
# OpenAPI specification
openapi: 3.0.0
info:
  title: Custom Plugin API
  version: 1.0.0
  description: API for Custom Enterprise Plugin

paths:
  /api/custom/entities:
    get:
      summary: List entities
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of entities
          content:
            application/json:
              schema:
                type: object
                properties:
                  entities:
                    type: array
                    items:
                      $ref: '#/components/schemas/Entity'
                  total:
                    type: integer

components:
  schemas:
    Entity:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        metadata:
          type: object
```

## Next Steps

### Getting Started with Plugin Development
1. **[Plugin Development Tutorial](plugin-tutorial.md)** - Step-by-step tutorial for creating your first plugin
2. **[Plugin Templates](plugin-templates.md)** - Pre-built templates for common plugin patterns
3. **[Development Environment Setup](dev-setup.md)** - Complete development environment configuration
4. **[Testing Guide](testing-guide.md)** - Comprehensive testing strategies and examples

### Advanced Topics
1. **[Plugin Architecture Deep Dive](architecture.md)** - Detailed plugin architecture and design patterns
2. **[Performance Optimization](performance.md)** - Plugin performance optimization techniques
3. **[Security Best Practices](security.md)** - Security considerations for plugin development
4. **[Enterprise Integration Patterns](integration-patterns.md)** - Common enterprise integration patterns

### Support & Resources
- **[Plugin Marketplace](https://portal.company.com/marketplace)** - Browse available plugins
- **[Developer Community](https://community.portal.company.com)** - Connect with other plugin developers
- **[Office Hours](https://portal.company.com/office-hours)** - Weekly developer office hours
- **[Training Programs](https://portal.company.com/training)** - Comprehensive plugin development training

---

**Ready to start building?** Begin with our [Plugin Development Tutorial](plugin-tutorial.md) or explore our [Plugin Templates](plugin-templates.md) for quick starts.