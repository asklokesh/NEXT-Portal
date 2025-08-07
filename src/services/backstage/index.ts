/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
// Main exports for the Backstage integration layer

// API Clients
export { catalogClient } from './clients/catalog.client';
export { scaffolderClient } from './clients/scaffolder.client';
export { techDocsClient } from './clients/techdocs.client';
export { authClient } from './clients/auth.client';

// Base API client utilities
export { BackstageApiClient, createBackstageClient, BackstageApiError } from './utils/api-client';

// WebSocket utilities
export { 
 BackstageWebSocketClient, 
 createBackstageWebSocket, 
 getBackstageWebSocket,
 useWebSocketConnection 
} from './utils/websocket';

// Error boundaries and handling
export {
 BackstageErrorBoundary,
 QueryErrorBoundary,
 ComponentErrorBoundary,
 PageErrorBoundary,
 BackstageApiError as ApiError,
 NetworkError,
 AuthenticationError,
 AuthorizationError,
 NotFoundError,
 ValidationError,
 RateLimitError,
 handleApiError,
 isRetryableError,
 getRetryDelay,
 setupGlobalErrorHandlers,
 createQueryClientWithErrorHandling,
} from './utils/error-boundary';

// React Hooks
export * from './hooks/useCatalog';
export * from './hooks/useScaffolder';
export * from './hooks/useAuth';

// Type definitions
export type * from './types/common';
export type * from './types/entities';
export type * from './types/templates';
export type * from './types/techdocs';
export type * from './types/auth';

// Type exports with specific names to avoid conflicts
export type {
 Entity,
 ComponentEntity,
 ApiEntity,
 SystemEntity,
 UserEntity,
 GroupEntity,
 EntityRef,
 CatalogQuery,
} from './types/entities';

export type {
 TemplateEntity,
 Task,
 TaskStatus,
 Action,
 ExecuteTemplateRequest,
 DryRunRequest,
} from './types/templates';

export type {
 TechDocsMetadata,
 TechDocsSearchResult,
 TechDocsEntityOptions,
} from './types/techdocs';

export type {
 UserInfo,
 SessionInfo,
 AuthorizeRequest,
 AuthorizeResponse,
 AllPermissionTypes,
 ApiKey,
} from './types/auth';

// Mock utilities (for development and testing)
export {
 initializeMocking,
 isMockingEnabled,
 createMockResponse,
 createMockError,
 generateMockId,
 createPaginatedMockResponse,
} from './mocks';

// Utility constants and helpers
export {
 stringifyEntityRef,
 parseEntityRef,
 isComponentEntity,
 isApiEntity,
 isSystemEntity,
 isUserEntity,
 isGroupEntity,
} from './types/entities';

export {
 validateTemplateParameters,
 getTemplateRef,
 isTaskCompleted,
 isTaskFailed,
 isTaskRunning,
 getTaskProgress,
} from './types/templates';

export {
 buildEntityRef,
 getTechDocsUrl,
 extractTechDocsRef,
 hasTechDocs,
 isDocumentationCached,
 isDocumentationPublished,
} from './types/techdocs';

export {
 createPermission,
 isAllowed,
 isDenied,
 isConditional,
 hasPermission,
 isMemberOfGroup,
 isSessionExpired,
 parseUserEntityRef,
 buildUserEntityRef,
 CATALOG_PERMISSIONS,
 SCAFFOLDER_PERMISSIONS,
 TECHDOCS_PERMISSIONS,
} from './types/auth';

// Version information
export const BACKSTAGE_INTEGRATION_VERSION = '1.0.0';

// Feature flags for conditional functionality
export const FEATURES = {
 WEBSOCKETS: true,
 CACHING: true,
 ERROR_BOUNDARIES: true,
 MOCKING: process.env.NODE_ENV === 'development',
 ANALYTICS: true,
} as const;