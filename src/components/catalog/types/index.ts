/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ReactNode } from 'react';

// Service types based on Backstage entity model
export interface ServiceMetadata {
 name: string;
 namespace?: string;
 uid?: string;
 title?: string;
 description?: string;
 labels?: Record<string, string>;
 annotations?: Record<string, string>;
 tags?: string[];
 links?: Array<{
 url: string;
 title?: string;
 icon?: string;
 type?: string;
 }>;
}

export interface ServiceSpec {
 type: 'service' | 'website' | 'library' | 'documentation' | 'tool';
 lifecycle: 'experimental' | 'production' | 'deprecated';
 owner: string;
 system?: string;
 domain?: string;
 dependsOn?: string[];
 providesApis?: string[];
 consumesApis?: string[];
 subcomponentOf?: string;
}

export interface ServiceStatus {
 health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
 incidents?: number;
 uptime?: number;
 lastDeployed?: Date;
 version?: string;
 metrics?: {
 responseTime?: number;
 errorRate?: number;
 throughput?: number;
 };
}

export interface ServiceEntity {
 apiVersion: string;
 kind: 'Component' | 'API' | 'System' | 'Domain' | 'Resource';
 metadata: ServiceMetadata;
 spec: ServiceSpec;
 status?: ServiceStatus;
 relations?: Array<{
 type: string;
 targetRef: string;
 target?: ServiceEntity;
 }>;
}

// View types
export type CatalogView = 'grid' | 'list' | 'graph' | 'map';

export interface CatalogFilters {
 search?: string;
 types?: string[];
 lifecycles?: string[];
 owners?: string[];
 systems?: string[];
 domains?: string[];
 tags?: string[];
 health?: string[];
 sortBy?: 'name' | 'owner' | 'lifecycle' | 'updated' | 'health';
 sortOrder?: 'asc' | 'desc';
}

export interface SavedSearch {
 id: string;
 name: string;
 description?: string;
 filters: CatalogFilters;
 view: CatalogView;
 createdAt: Date;
 createdBy: string;
 isPublic?: boolean;
}

// Graph types
export interface GraphNode {
 id: string;
 label: string;
 type: 'service' | 'api' | 'system' | 'domain';
 data: ServiceEntity;
 x?: number;
 y?: number;
}

export interface GraphEdge {
 id: string;
 source: string;
 target: string;
 type: 'depends-on' | 'provides' | 'consumes' | 'part-of';
 label?: string;
}

export interface GraphData {
 nodes: GraphNode[];
 edges: GraphEdge[];
}

// List view types
export interface TableColumn {
 id: string;
 label: string;
 accessor: string | ((item: ServiceEntity) => ReactNode);
 sortable?: boolean;
 width?: number;
 align?: 'left' | 'center' | 'right';
 sticky?: boolean;
}

export interface BulkOperation {
 id: string;
 label: string;
 icon?: ReactNode;
 action: (services: ServiceEntity[]) => Promise<void>;
 confirmationRequired?: boolean;
 confirmationMessage?: string;
}

// Performance types
export interface VirtualizationConfig {
 itemHeight: number;
 overscan: number;
 scrollDebounceMs: number;
 enableWindowScroll?: boolean;
}

// State management
export interface CatalogState {
 services: ServiceEntity[];
 loading: boolean;
 error: Error | null;
 filters: CatalogFilters;
 view: CatalogView;
 selectedServices: string[];
 expandedGroups: string[];
 graphLayout?: 'force' | 'hierarchical' | 'circular';
 virtualization: VirtualizationConfig;
}

// Event types
export interface CatalogEvent {
 type: 'filter' | 'search' | 'select' | 'view-change' | 'bulk-action';
 payload: any;
 timestamp: Date;
}

// Analytics
export interface CatalogAnalytics {
 totalServices: number;
 servicesByType: Record<string, number>;
 servicesByLifecycle: Record<string, number>;
 servicesByHealth: Record<string, number>;
 topOwners: Array<{ owner: string; count: number }>;
 orphanedServices: number;
 avgDependencies: number;
}