// Edge-safe metrics module that provides only interfaces and dummy implementations
// This can be safely imported in middleware and other Edge Runtime contexts

export interface Metric {
 inc(labels?: Record<string, string>): void;
 observe(labels?: Record<string, string>, value?: number): void;
 set(labels?: Record<string, string>, value?: number): void;
 dec(labels?: Record<string, string>): void;
}

// Dummy implementations for Edge Runtime
const createDummyMetric = (): Metric => ({
 inc: () => {},
 observe: () => {},
 set: () => {},
 dec: () => {},
});

// Export dummy metrics
export const httpRequestDuration = createDummyMetric();
export const httpRequestTotal = createDummyMetric();
export const catalogEntitiesTotal = createDummyMetric();
export const templateExecutionsTotal = createDummyMetric();
export const activeUsersGauge = createDummyMetric();
export const cacheHits = createDummyMetric();
export const cacheMisses = createDummyMetric();
export const dbQueryDuration = createDummyMetric();
export const dbConnectionsActive = createDummyMetric();
export const errorTotal = createDummyMetric();
export const cloudCostGauge = createDummyMetric();
export const pageLoadDuration = createDummyMetric();

// Helper functions that do nothing in Edge Runtime
export function recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
 // No-op in Edge Runtime
}

export function recordCacheAccess(cacheType: string, hit: boolean) {
 // No-op in Edge Runtime
}

export function recordDbQuery(operation: string, table: string, duration: number) {
 // No-op in Edge Runtime
}

export function recordError(type: string, severity: 'low' | 'medium' | 'high' | 'critical') {
 // No-op in Edge Runtime
}