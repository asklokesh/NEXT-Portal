export { BackstageVersionManager, versionManager } from './version-manager';
export { BackstageApiAdapter, apiAdapter, ApiError } from './api-adapter';
export { useBackstageVersion, useApiCompat, useMigrationStatus } from './hooks';
export type { 
 BackstageVersion, 
 VersionMigration, 
 CompatibilityReport,
 ApiEndpoint
} from './version-manager';
export type {
 ApiRequest,
 ApiResponse
} from './api-adapter';
export type {
 VersionInfo
} from './hooks';