// Main SDK exports
export { BackstageClient } from './client/backstage-client';
export { HttpClient } from './client/http-client';
export { BackstageGraphQLClient } from './graphql/graphql-client';
export { BackstageWebSocketClient } from './websocket/websocket-client';
export { AuthManager } from './auth/auth-manager';

// Type exports
export * from './types';
export * from './types/api';
export * from './types/events';

// Utility exports
export { createBackstageClient } from './utils/factory';
export { validateConfig } from './utils/validation';
export { createMockClient } from './utils/testing';

// Default export
export { BackstageClient as default } from './client/backstage-client';