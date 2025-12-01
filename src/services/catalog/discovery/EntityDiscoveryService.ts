/**
 * Entity Discovery Service
 * Search, explore, and discover entities in the software catalog
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  EntityKind,
  EntityRef,
  EntitySearchQuery,
  EntitySearchResults,
  EntityFilter,
  EntityFacets,
  EntityGraph,
  EntityGraphNode,
  EntityGraphEdge,
  EntityGraphQuery,
  ComponentEntity,
  ApiEntity,
  SystemEntity,
  GroupEntity,
  UserEntity,
  RelationType,
  LifecycleStage,
} from '../entity-types';

/**
 * Entity Discovery Service
 */
export class EntityDiscoveryService {
  private entities: Map<EntityRef, Entity> = new Map();
  private kindIndex: Map<EntityKind, Set<EntityRef>> = new Map();
  private ownerIndex: Map<EntityRef, Set<EntityRef>> = new Map();
  private systemIndex: Map<EntityRef, Set<EntityRef>> = new Map();
  private tagIndex: Map<string, Set<EntityRef>> = new Map();
  private relationIndex: Map<EntityRef, EntityGraphEdge[]> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  /**
   * Initialize with sample data
   */
  private initializeSampleData(): void {
    // Sample teams
    const teams: GroupEntity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: {
          name: 'platform-engineering',
          namespace: 'default',
          title: 'Platform Engineering',
          description: 'Platform team responsible for developer experience and infrastructure',
          tags: ['platform', 'infrastructure'],
        },
        spec: {
          type: 'team',
          profile: {
            displayName: 'Platform Engineering',
            email: 'platform@company.com',
          },
          slackChannel: '#platform-engineering',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: {
          name: 'payments-team',
          namespace: 'default',
          title: 'Payments Team',
          description: 'Team responsible for payment processing systems',
          tags: ['payments', 'fintech'],
        },
        spec: {
          type: 'team',
          profile: {
            displayName: 'Payments Team',
            email: 'payments@company.com',
          },
          slackChannel: '#payments',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: {
          name: 'frontend-team',
          namespace: 'default',
          title: 'Frontend Team',
          description: 'Team responsible for frontend applications',
          tags: ['frontend', 'ui'],
        },
        spec: {
          type: 'team',
          profile: {
            displayName: 'Frontend Team',
            email: 'frontend@company.com',
          },
          slackChannel: '#frontend',
        },
      },
    ];

    // Sample systems
    const systems: SystemEntity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'System',
        metadata: {
          name: 'payment-platform',
          namespace: 'default',
          title: 'Payment Platform',
          description: 'Core payment processing system',
          tags: ['payments', 'critical'],
        },
        spec: {
          owner: 'group:default/payments-team',
          techStack: ['Node.js', 'PostgreSQL', 'Redis', 'Kafka'],
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'System',
        metadata: {
          name: 'ecommerce-platform',
          namespace: 'default',
          title: 'E-Commerce Platform',
          description: 'Main e-commerce system',
          tags: ['ecommerce', 'customer-facing'],
        },
        spec: {
          owner: 'group:default/frontend-team',
          techStack: ['React', 'Next.js', 'GraphQL'],
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'System',
        metadata: {
          name: 'developer-portal',
          namespace: 'default',
          title: 'Developer Portal',
          description: 'Internal developer platform',
          tags: ['platform', 'internal'],
        },
        spec: {
          owner: 'group:default/platform-engineering',
          techStack: ['TypeScript', 'Next.js', 'PostgreSQL'],
        },
      },
    ];

    // Sample components
    const components: ComponentEntity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'payment-service',
          namespace: 'default',
          title: 'Payment Service',
          description: 'Core payment processing microservice',
          tags: ['payments', 'nodejs', 'tier-0'],
          links: [
            { url: 'https://github.com/company/payment-service', title: 'Repository', type: 'repository' },
            { url: 'https://grafana.company.com/d/payments', title: 'Dashboard', type: 'dashboard' },
          ],
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          tier: 'tier0',
          criticality: 'critical',
          providesApis: ['api:default/payment-api'],
          consumesApis: ['api:default/fraud-detection-api'],
          dependsOn: ['resource:default/payments-db', 'resource:default/payments-cache'],
          repository: 'https://github.com/company/payment-service',
          deployments: [
            { environment: 'production', cluster: 'prod-us-east', replicas: 5, status: 'healthy' },
            { environment: 'staging', cluster: 'staging', replicas: 2, status: 'healthy' },
          ],
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
          { type: 'providesApi', targetRef: 'api:default/payment-api' },
          { type: 'consumesApi', targetRef: 'api:default/fraud-detection-api' },
          { type: 'dependsOn', targetRef: 'resource:default/payments-db' },
          { type: 'dependsOn', targetRef: 'resource:default/payments-cache' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'checkout-frontend',
          namespace: 'default',
          title: 'Checkout Frontend',
          description: 'Customer-facing checkout experience',
          tags: ['frontend', 'react', 'customer-facing'],
          links: [
            { url: 'https://github.com/company/checkout-frontend', title: 'Repository', type: 'repository' },
          ],
        },
        spec: {
          type: 'website',
          lifecycle: 'production',
          owner: 'group:default/frontend-team',
          system: 'system:default/ecommerce-platform',
          tier: 'tier1',
          criticality: 'high',
          consumesApis: ['api:default/payment-api', 'api:default/cart-api'],
          repository: 'https://github.com/company/checkout-frontend',
          deployments: [
            { environment: 'production', replicas: 3, status: 'healthy' },
          ],
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/frontend-team' },
          { type: 'partOf', targetRef: 'system:default/ecommerce-platform' },
          { type: 'consumesApi', targetRef: 'api:default/payment-api' },
          { type: 'consumesApi', targetRef: 'api:default/cart-api' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'fraud-detection-service',
          namespace: 'default',
          title: 'Fraud Detection Service',
          description: 'ML-powered fraud detection',
          tags: ['ml', 'python', 'security'],
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          tier: 'tier1',
          criticality: 'high',
          providesApis: ['api:default/fraud-detection-api'],
          repository: 'https://github.com/company/fraud-detection',
          deployments: [
            { environment: 'production', replicas: 3, status: 'healthy' },
          ],
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
          { type: 'providesApi', targetRef: 'api:default/fraud-detection-api' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'user-service',
          namespace: 'default',
          title: 'User Service',
          description: 'User management and authentication',
          tags: ['auth', 'nodejs', 'core'],
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'group:default/platform-engineering',
          system: 'system:default/developer-portal',
          tier: 'tier0',
          criticality: 'critical',
          providesApis: ['api:default/user-api'],
          repository: 'https://github.com/company/user-service',
          deployments: [
            { environment: 'production', replicas: 5, status: 'healthy' },
            { environment: 'staging', replicas: 2, status: 'healthy' },
          ],
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/platform-engineering' },
          { type: 'partOf', targetRef: 'system:default/developer-portal' },
          { type: 'providesApi', targetRef: 'api:default/user-api' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'notification-worker',
          namespace: 'default',
          title: 'Notification Worker',
          description: 'Background job processor for notifications',
          tags: ['worker', 'nodejs', 'async'],
        },
        spec: {
          type: 'worker',
          lifecycle: 'production',
          owner: 'group:default/platform-engineering',
          tier: 'tier2',
          criticality: 'medium',
          dependsOn: ['resource:default/notifications-queue'],
          repository: 'https://github.com/company/notification-worker',
          deployments: [
            { environment: 'production', replicas: 2, status: 'healthy' },
          ],
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/platform-engineering' },
          { type: 'dependsOn', targetRef: 'resource:default/notifications-queue' },
        ],
      },
    ];

    // Sample APIs
    const apis: ApiEntity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'payment-api',
          namespace: 'default',
          title: 'Payment API',
          description: 'REST API for payment processing',
          tags: ['payments', 'rest'],
        },
        spec: {
          type: 'openapi',
          lifecycle: 'production',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          definition: 'openapi: 3.0.0',
          version: '2.3.0',
          servers: [
            { url: 'https://api.company.com/payments', environment: 'production' },
            { url: 'https://api.staging.company.com/payments', environment: 'staging' },
          ],
          authentication: { type: 'oauth2', scopes: ['payments:read', 'payments:write'] },
          rateLimit: { requestsPerMinute: 1000 },
          sla: { availability: 99.99, latencyP95: 100 },
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'fraud-detection-api',
          namespace: 'default',
          title: 'Fraud Detection API',
          description: 'API for fraud scoring',
          tags: ['ml', 'internal'],
        },
        spec: {
          type: 'grpc',
          lifecycle: 'production',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          definition: 'proto3',
          version: '1.5.0',
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'user-api',
          namespace: 'default',
          title: 'User API',
          description: 'User management API',
          tags: ['users', 'rest', 'core'],
        },
        spec: {
          type: 'openapi',
          lifecycle: 'production',
          owner: 'group:default/platform-engineering',
          system: 'system:default/developer-portal',
          definition: 'openapi: 3.0.0',
          version: '3.0.0',
          authentication: { type: 'jwt' },
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/platform-engineering' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'cart-api',
          namespace: 'default',
          title: 'Shopping Cart API',
          description: 'API for shopping cart management',
          tags: ['ecommerce', 'rest'],
        },
        spec: {
          type: 'openapi',
          lifecycle: 'production',
          owner: 'group:default/frontend-team',
          system: 'system:default/ecommerce-platform',
          definition: 'openapi: 3.0.0',
          version: '1.2.0',
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/frontend-team' },
          { type: 'partOf', targetRef: 'system:default/ecommerce-platform' },
        ],
      },
    ];

    // Sample resources
    const resources: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'payments-db',
          namespace: 'default',
          title: 'Payments Database',
          description: 'Primary PostgreSQL database for payments',
          tags: ['database', 'postgresql', 'critical'],
        },
        spec: {
          type: 'database',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          provider: 'aws',
          region: 'us-east-1',
          tier: 'db.r6g.xlarge',
          cost: { estimated: 850, currency: 'USD', period: 'monthly' },
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'payments-cache',
          namespace: 'default',
          title: 'Payments Cache',
          description: 'Redis cache for payment sessions',
          tags: ['cache', 'redis'],
        },
        spec: {
          type: 'cache',
          owner: 'group:default/payments-team',
          system: 'system:default/payment-platform',
          provider: 'aws',
          region: 'us-east-1',
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/payments-team' },
          { type: 'partOf', targetRef: 'system:default/payment-platform' },
        ],
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'notifications-queue',
          namespace: 'default',
          title: 'Notifications Queue',
          description: 'SQS queue for notification processing',
          tags: ['queue', 'sqs', 'async'],
        },
        spec: {
          type: 'queue',
          owner: 'group:default/platform-engineering',
          provider: 'aws',
          region: 'us-east-1',
        },
        relations: [
          { type: 'ownedBy', targetRef: 'group:default/platform-engineering' },
        ],
      },
    ];

    // Add all entities
    [...teams, ...systems, ...components, ...apis, ...resources].forEach((entity) => {
      this.addEntity(entity);
    });
  }

  /**
   * Generate entity ref from entity
   */
  private getEntityRef(entity: Entity): EntityRef {
    return `${entity.kind.toLowerCase()}:${entity.metadata.namespace}/${entity.metadata.name}`;
  }

  /**
   * Add entity to the catalog
   */
  addEntity(entity: Entity): void {
    const ref = this.getEntityRef(entity);
    this.entities.set(ref, entity);

    // Update kind index
    if (!this.kindIndex.has(entity.kind)) {
      this.kindIndex.set(entity.kind, new Set());
    }
    this.kindIndex.get(entity.kind)!.add(ref);

    // Update owner index
    const owner = (entity.spec as any).owner as string | undefined;
    if (owner) {
      if (!this.ownerIndex.has(owner)) {
        this.ownerIndex.set(owner, new Set());
      }
      this.ownerIndex.get(owner)!.add(ref);
    }

    // Update system index
    const system = (entity.spec as any).system as string | undefined;
    if (system) {
      if (!this.systemIndex.has(system)) {
        this.systemIndex.set(system, new Set());
      }
      this.systemIndex.get(system)!.add(ref);
    }

    // Update tag index
    entity.metadata.tags?.forEach((tag) => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(ref);
    });

    // Update relation index
    if (entity.relations) {
      const edges = entity.relations.map((rel) => ({
        source: ref,
        target: rel.targetRef,
        relationType: rel.type,
      }));
      this.relationIndex.set(ref, edges);
    }
  }

  /**
   * Get entity by ref
   */
  async getEntity(ref: EntityRef): Promise<Entity | undefined> {
    return this.entities.get(ref);
  }

  /**
   * Search entities
   */
  async search(query: EntitySearchQuery): Promise<EntitySearchResults> {
    let results = Array.from(this.entities.values());

    // Filter by kind
    if (query.kinds && query.kinds.length > 0) {
      results = results.filter((e) => query.kinds!.includes(e.kind));
    }

    // Apply filters
    if (query.filters && query.filters.length > 0) {
      results = this.applyFilters(results, query.filters);
    }

    // Text search
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter((e) =>
        e.metadata.name.toLowerCase().includes(searchText) ||
        e.metadata.title?.toLowerCase().includes(searchText) ||
        e.metadata.description?.toLowerCase().includes(searchText) ||
        e.metadata.tags?.some((t) => t.toLowerCase().includes(searchText))
      );
    }

    // Calculate facets before pagination
    const facets = query.facets ? this.calculateFacets(results, query.facets) : undefined;

    // Sort
    if (query.sortBy) {
      results = this.sortEntities(results, query.sortBy);
    }

    // Pagination
    const total = results.length;
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedResults,
      total,
      page,
      pageSize,
      facets,
    };
  }

  /**
   * Apply filters to entities
   */
  private applyFilters(entities: Entity[], filters: EntityFilter[]): Entity[] {
    return entities.filter((entity) => {
      return filters.every((filter) => {
        const value = this.getFieldValue(entity, filter.field);
        return this.evaluateFilter(value, filter.operator, filter.value);
      });
    });
  }

  /**
   * Get field value from entity using dot notation
   */
  private getFieldValue(entity: Entity, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = entity;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate filter condition
   */
  private evaluateFilter(value: unknown, operator: EntityFilter['operator'], filterValue: unknown): boolean {
    switch (operator) {
      case 'eq':
        return value === filterValue;
      case 'neq':
        return value !== filterValue;
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'nin':
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case 'contains':
        if (typeof value === 'string') {
          return value.toLowerCase().includes(String(filterValue).toLowerCase());
        }
        if (Array.isArray(value)) {
          return value.includes(filterValue);
        }
        return false;
      case 'startsWith':
        return typeof value === 'string' && value.startsWith(String(filterValue));
      case 'exists':
        return filterValue ? value !== undefined && value !== null : value === undefined || value === null;
      case 'gt':
        return typeof value === 'number' && typeof filterValue === 'number' && value > filterValue;
      case 'gte':
        return typeof value === 'number' && typeof filterValue === 'number' && value >= filterValue;
      case 'lt':
        return typeof value === 'number' && typeof filterValue === 'number' && value < filterValue;
      case 'lte':
        return typeof value === 'number' && typeof filterValue === 'number' && value <= filterValue;
      default:
        return true;
    }
  }

  /**
   * Sort entities
   */
  private sortEntities(entities: Entity[], sortBy: EntitySearchQuery['sortBy']): Entity[] {
    if (!sortBy) return entities;

    return [...entities].sort((a, b) => {
      const aValue = this.getFieldValue(a, sortBy.field);
      const bValue = this.getFieldValue(b, sortBy.field);

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortBy.direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Calculate facets
   */
  private calculateFacets(entities: Entity[], facetFields: string[]): EntityFacets {
    const facets: EntityFacets = {};

    facetFields.forEach((field) => {
      const counts = new Map<string, number>();

      entities.forEach((entity) => {
        let value: unknown;

        switch (field) {
          case 'kinds':
            value = entity.kind;
            break;
          case 'types':
            value = (entity.spec as any).type;
            break;
          case 'owners':
            value = (entity.spec as any).owner;
            break;
          case 'systems':
            value = (entity.spec as any).system;
            break;
          case 'lifecycles':
            value = (entity.spec as any).lifecycle;
            break;
          case 'tags':
            entity.metadata.tags?.forEach((tag) => {
              counts.set(tag, (counts.get(tag) || 0) + 1);
            });
            return;
          default:
            value = this.getFieldValue(entity, field);
        }

        if (value && typeof value === 'string') {
          counts.set(value, (counts.get(value) || 0) + 1);
        }
      });

      if (counts.size > 0) {
        facets[field] = Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);
      }
    });

    return facets;
  }

  /**
   * Get entity graph
   */
  async getEntityGraph(query: EntityGraphQuery): Promise<EntityGraph> {
    const visited = new Set<EntityRef>();
    const nodes: EntityGraphNode[] = [];
    const edges: EntityGraphEdge[] = [];

    const traverse = async (ref: EntityRef, depth: number): Promise<void> => {
      if (visited.has(ref) || depth > (query.maxDepth || 3)) {
        return;
      }
      visited.add(ref);

      const entity = await this.getEntity(ref);
      if (!entity) return;

      // Check kind filter
      if (query.includeKinds && !query.includeKinds.includes(entity.kind)) {
        return;
      }
      if (query.excludeKinds && query.excludeKinds.includes(entity.kind)) {
        return;
      }

      // Add node
      nodes.push({
        id: ref,
        kind: entity.kind,
        name: entity.metadata.name,
        title: entity.metadata.title,
        type: (entity.spec as any).type,
        owner: (entity.spec as any).owner,
        system: (entity.spec as any).system,
        lifecycle: (entity.spec as any).lifecycle,
      });

      // Get relations
      const entityEdges = this.relationIndex.get(ref) || [];

      for (const edge of entityEdges) {
        // Check relation type filter
        if (query.relationTypes && !query.relationTypes.includes(edge.relationType)) {
          continue;
        }

        // Check direction
        if (query.direction === 'outbound' && edge.source !== ref) continue;
        if (query.direction === 'inbound' && edge.target !== ref) continue;

        edges.push(edge);

        // Traverse to connected entity
        const nextRef = edge.source === ref ? edge.target : edge.source;
        await traverse(nextRef, depth + 1);
      }

      // Also check reverse relations (for bidirectional graph)
      if (query.direction !== 'outbound') {
        for (const [otherRef, otherEdges] of this.relationIndex.entries()) {
          for (const edge of otherEdges) {
            if (edge.target === ref && !visited.has(edge.source)) {
              if (!query.relationTypes || query.relationTypes.includes(edge.relationType)) {
                edges.push(edge);
                await traverse(edge.source, depth + 1);
              }
            }
          }
        }
      }
    };

    await traverse(query.rootRef, 0);

    // Calculate stats
    const byKind: Record<string, number> = {};
    const byRelationType: Record<string, number> = {};

    nodes.forEach((n) => {
      byKind[n.kind] = (byKind[n.kind] || 0) + 1;
    });

    edges.forEach((e) => {
      byRelationType[e.relationType] = (byRelationType[e.relationType] || 0) + 1;
    });

    return {
      nodes,
      edges: [...new Map(edges.map(e => [`${e.source}-${e.relationType}-${e.target}`, e])).values()],
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        byKind,
        byRelationType,
      },
    };
  }

  /**
   * Get entities by owner
   */
  async getEntitiesByOwner(ownerRef: EntityRef): Promise<Entity[]> {
    const refs = this.ownerIndex.get(ownerRef) || new Set();
    const entities: Entity[] = [];

    for (const ref of refs) {
      const entity = this.entities.get(ref);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Get entities by system
   */
  async getEntitiesBySystem(systemRef: EntityRef): Promise<Entity[]> {
    const refs = this.systemIndex.get(systemRef) || new Set();
    const entities: Entity[] = [];

    for (const ref of refs) {
      const entity = this.entities.get(ref);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Get entities by tag
   */
  async getEntitiesByTag(tag: string): Promise<Entity[]> {
    const refs = this.tagIndex.get(tag) || new Set();
    const entities: Entity[] = [];

    for (const ref of refs) {
      const entity = this.entities.get(ref);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Get all tags with counts
   */
  async getTags(): Promise<{ tag: string; count: number }[]> {
    return Array.from(this.tagIndex.entries())
      .map(([tag, refs]) => ({ tag, count: refs.size }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get catalog stats
   */
  async getStats(): Promise<{
    totalEntities: number;
    byKind: Record<string, number>;
    byLifecycle: Record<string, number>;
    byOwner: { owner: string; count: number }[];
  }> {
    const byKind: Record<string, number> = {};
    const byLifecycle: Record<string, number> = {};
    const ownerCounts = new Map<string, number>();

    for (const entity of this.entities.values()) {
      byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;

      const lifecycle = (entity.spec as any).lifecycle;
      if (lifecycle) {
        byLifecycle[lifecycle] = (byLifecycle[lifecycle] || 0) + 1;
      }

      const owner = (entity.spec as any).owner;
      if (owner) {
        ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
      }
    }

    return {
      totalEntities: this.entities.size,
      byKind,
      byLifecycle,
      byOwner: Array.from(ownerCounts.entries())
        .map(([owner, count]) => ({ owner, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }
}

// Singleton instance
let discoveryServiceInstance: EntityDiscoveryService | null = null;

export function getEntityDiscoveryService(): EntityDiscoveryService {
  if (!discoveryServiceInstance) {
    discoveryServiceInstance = new EntityDiscoveryService();
  }
  return discoveryServiceInstance;
}

export default EntityDiscoveryService;
