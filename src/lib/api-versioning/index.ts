/**
 * Enterprise API Versioning System
 * 
 * A comprehensive API versioning solution that surpasses Backstage's basic approach
 * with semantic versioning, automatic backward compatibility, and zero-downtime deployments.
 */

export * from './core/semantic-version';
export * from './core/compatibility-engine';
export * from './core/evolution-engine';
export * from './core/deprecation-manager';

export * from './rest/content-negotiation';
export * from './rest/version-middleware';
export * from './rest/route-versioning';

export * from './graphql/schema-evolution';
export * from './graphql/version-resolver';
export * from './graphql/federation-versioning';

export * from './testing/contract-testing';
export * from './testing/compatibility-matrix';
export * from './testing/version-validator';

export * from './deployment/zero-downtime';
export * from './deployment/canary-versioning';
export * from './deployment/rollback-manager';

export * from './analytics/version-tracking';
export * from './analytics/usage-metrics';
export * from './analytics/compatibility-insights';

export * from './documentation/auto-versioning';
export * from './documentation/changelog-generator';
export * from './documentation/migration-guides';

export * from './client/sdk-generator';
export * from './client/version-negotiator';
export * from './client/auto-updater';

export * from './types';
export * from './constants';