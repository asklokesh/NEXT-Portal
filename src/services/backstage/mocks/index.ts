/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
// Export everything for easy importing
export * from './handlers';
export * from './server';
export * from './browser';

// Utility functions for mock management
export function createMockResponse<T>(data: T, delay = 100) {
 return new Promise<T>((resolve) => {
 setTimeout(() => resolve(data), delay);
 });
}

export function createMockError(
 message: string, 
 status: number = 500, 
 delay = 100
): Promise<never> {
 return new Promise((_, reject) => {
 setTimeout(() => {
 const error = new Error(message) as any;
 error.status = status;
 reject(error);
 }, delay);
 });
}

// Mock data utilities
export function generateMockId(): string {
 return `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createPaginatedMockResponse<T>(
 items: T[],
 page: number = 1,
 pageSize: number = 20
) {
 const start = (page - 1) * pageSize;
 const end = start + pageSize;
 const paginatedItems = items.slice(start, end);

 return {
 items: paginatedItems,
 total: items.length,
 page,
 pageSize,
 hasMore: end < items.length,
 totalPages: Math.ceil(items.length / pageSize),
 };
}

// Environment detection
export function isMockingEnabled(): boolean {
 if (typeof window !== 'undefined') {
 // Browser environment
 return process.env.NODE_ENV === 'development' && 
 process.env.NEXT_PUBLIC_ENABLE_MOCKING === 'true';
 } else {
 // Node.js environment (tests)
 return process.env.NODE_ENV === 'test' || 
 process.env.ENABLE_API_MOCKING === 'true';
 }
}

// Initialize mocking based on environment
export async function initializeMocking(): Promise<void> {
 if (!isMockingEnabled()) {
 return;
 }

 if (typeof window !== 'undefined') {
 // Browser environment
 const { startMockingConditionally } = await import('./browser');
 await startMockingConditionally();
 } else {
 // Node.js environment
 const { enableMocking } = await import('./server');
 enableMocking();
 }
}