/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import, @typescript-eslint/no-redundant-type-constituents */
// Re-export Backstage types for convenience
export type {
 Entity,
 EntityMeta,
 EntityRelation,
 EntityStatus,
 EntityStatusItem,
 Component,
 ComponentEntityV1alpha1,
 ResourceEntityV1alpha1,
 SystemEntityV1alpha1,
 DomainEntityV1alpha1,
 ApiEntityV1alpha1,
 GroupEntityV1alpha1,
 UserEntityV1alpha1,
 LocationEntityV1alpha1,
 TemplateEntityV1beta3,
} from '@backstage/catalog-model';

// Custom types for our application
export interface ServiceEntity extends Entity {
 apiVersion: 'backstage.io/v1alpha1';
 kind: 'Component';
 metadata: EntityMeta & {
 name: string;
 namespace?: string;
 title?: string;
 description?: string;
 labels?: Record<string, string>;
 annotations?: Record<string, string>;
 tags?: string[];
 links?: Array<{
 url: string;
 title?: string;
 icon?: string;
 }>;
 };
 spec: {
 type: 'service' | 'website' | 'library' | 'documentation' | 'tool';
 lifecycle: 'experimental' | 'production' | 'deprecated';
 owner: string;
 system?: string;
 subcomponentOf?: string;
 providesApis?: string[];
 consumesApis?: string[];
 dependsOn?: string[];
 dependencyOf?: string[];
 };
 status?: EntityStatus;
 relations?: EntityRelation[];
}

export interface CatalogFilters {
 kind?: string | string[];
 type?: string | string[];
 owner?: string | string[];
 lifecycle?: string | string[];
 tag?: string[];
 ['metadata.name']?: string;
 ['metadata.namespace']?: string;
 ['spec.system']?: string;
}

export interface CatalogListResponse {
 items: Entity[];
 totalItems: number;
 pageInfo?: {
 nextCursor?: string;
 prevCursor?: string;
 };
}

export interface EntityHealth {
 status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
 message?: string;
 lastChecked?: string;
}

export interface EntityMetrics {
 cpu: number;
 memory: number;
 requestsPerSecond: number;
 errorRate: number;
 responseTime: number;
 activeConnections: number;
 uptime?: number;
}

export interface EntityDeployment {
 id: string;
 version: string;
 timestamp: string;
 status: 'success' | 'failed' | 'in_progress';
 author: string;
 message?: string;
}

export interface EntityIncident {
 id: string;
 title: string;
 severity: 'low' | 'medium' | 'high' | 'critical';
 status: 'open' | 'investigating' | 'resolved';
 timestamp: string;
 resolvedAt?: string;
 description?: string;
}

export interface EnrichedEntity extends ServiceEntity {
 health?: EntityHealth;
 metrics?: EntityMetrics;
 lastDeployment?: EntityDeployment;
 incidents?: EntityIncident[];
}