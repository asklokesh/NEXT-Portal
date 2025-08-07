/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { setupWorker } from 'msw';

import { handlers } from './handlers';

// Setup mock service worker for browser environment
export const worker = setupWorker(...handlers);

// Start mocking in browser
export async function enableMocking(): Promise<void> {
 if (typeof window === 'undefined') {
 return;
 }

 const { worker } = await import('./browser');
 
 return worker.start({
 onUnhandledRequest: 'warn',
 serviceWorker: {
 url: '/mockServiceWorker.js',
 },
 });
}

// Enable mocking conditionally based on environment
export async function startMockingConditionally(): Promise<void> {
 // Only enable mocking in development or when explicitly requested
 const shouldMock = 
 process.env.NODE_ENV === 'development' && 
 process.env.NEXT_PUBLIC_ENABLE_MOCKING === 'true';

 if (shouldMock) {
 console.log('[MOCK] Enabling API mocking in development mode');
 await enableMocking();
 console.log('[MOCK] API mocking enabled');
 }
}