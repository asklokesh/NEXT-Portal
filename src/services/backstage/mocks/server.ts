/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// Setup mock server for Node.js environment (tests)
export const server = setupServer(...handlers);

// Enable API mocking for tests
export function enableMocking(): void {
 // Start the mock server
 server.listen({
 onUnhandledRequest: 'warn',
 });

 console.log('[MOCK] Mock Service Worker enabled for testing');
}

// Clean up after tests
export function disableMocking(): void {
 server.close();
}

// Reset handlers between tests
export function resetMocks(): void {
 server.resetHandlers();
}