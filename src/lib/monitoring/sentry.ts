import * as Sentry from '@sentry/nextjs';
import { CaptureContext, SeverityLevel } from '@sentry/types';

// Initialize Sentry
export function initSentry() {
 const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
 
 if (!SENTRY_DSN) {
 console.log('Sentry DSN not configured, error tracking disabled');
 return;
 }

 Sentry.init({
 dsn: SENTRY_DSN,
 environment: process.env.NODE_ENV || 'development',
 
 // Performance Monitoring
 tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
 
 // Session Replay
 replaysSessionSampleRate: 0.1,
 replaysOnErrorSampleRate: 1.0,
 
 // Release tracking
 release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',
 
 // Integrations
 integrations: [
 new Sentry.BrowserTracing({
 // Navigation transactions
 routingInstrumentation: Sentry.nextRouterInstrumentation,
 
 // Trace fetch requests
 traceFetch: true,
 
 // Trace XHR requests
 traceXHR: true,
 
 // Custom transaction names
 beforeNavigate: (context) => {
 return {
 ...context,
 name: formatTransactionName(context.name),
 };
 },
 }),
 new Sentry.Replay({
 maskAllText: false,
 blockAllMedia: false,
 
 // Privacy options
 maskTextContent: false,
 maskInputOptions: {
 password: true,
 creditCard: true,
 },
 }),
 ],
 
 // Filtering
 ignoreErrors: [
 // Browser errors
 'ResizeObserver loop limit exceeded',
 'Non-Error promise rejection captured',
 
 // Network errors
 'NetworkError',
 'Failed to fetch',
 'Load failed',
 
 // User errors
 'AbortError',
 'cancelled',
 ],
 
 // Before send hook
 beforeSend: (event, hint) => {
 // Filter out certain errors
 if (event.exception?.values?.[0]?.value?.includes('Script error')) {
 return null;
 }
 
 // Add user context
 const user = getUserContext();
 if (user) {
 event.user = user;
 }
 
 // Add custom context
 event.contexts = {
 ...event.contexts,
 app: {
 version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
 build: process.env.NEXT_PUBLIC_BUILD_ID || 'development',
 },
 };
 
 return event;
 },
 
 // Breadcrumbs
 beforeBreadcrumb: (breadcrumb) => {
 // Filter out noisy breadcrumbs
 if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
 return null;
 }
 
 return breadcrumb;
 },
 });
}

// Format transaction names for better grouping
function formatTransactionName(name: string): string {
 // Remove dynamic segments
 return name
 .replace(/\[([^\]]+)\]/g, ':$1')
 .replace(/\d+/g, ':id');
}

// Get user context
function getUserContext(): Sentry.User | null {
 // This should be implemented based on your auth system
 if (typeof window !== 'undefined') {
 const userStr = localStorage.getItem('user');
 if (userStr) {
 try {
 const user = JSON.parse(userStr);
 return {
 id: user.id,
 email: user.email,
 username: user.name,
 };
 } catch (e) {
 // Invalid user data
 }
 }
 }
 return null;
}

// Custom error boundary
export function captureException(
 error: Error | string,
 context?: CaptureContext,
 level: SeverityLevel = 'error'
) {
 console.error(error);
 
 if (typeof error === 'string') {
 Sentry.captureMessage(error, level);
 } else {
 Sentry.captureException(error, {
 ...context,
 level,
 });
 }
}

// Capture custom events
export function captureEvent(
 message: string,
 level: SeverityLevel = 'info',
 extra?: Record<string, any>
) {
 Sentry.captureMessage(message, {
 level,
 extra,
 });
}

// Performance monitoring
export function startTransaction(name: string, op: string = 'navigation') {
 return Sentry.startTransaction({
 name,
 op,
 });
}

// Add breadcrumb
export function addBreadcrumb(
 message: string,
 category: string = 'custom',
 data?: Record<string, any>
) {
 Sentry.addBreadcrumb({
 message,
 category,
 data,
 timestamp: Date.now() / 1000,
 });
}

// Set user context
export function setUserContext(user: { id: string; email: string; name?: string }) {
 Sentry.setUser({
 id: user.id,
 email: user.email,
 username: user.name,
 });
}

// Clear user context
export function clearUserContext() {
 Sentry.setUser(null);
}

// Custom error class for better tracking
export class ApplicationError extends Error {
 public readonly code: string;
 public readonly statusCode: number;
 public readonly isOperational: boolean;

 constructor(
 message: string,
 code: string = 'APPLICATION_ERROR',
 statusCode: number = 500,
 isOperational: boolean = true
 ) {
 super(message);
 this.name = 'ApplicationError';
 this.code = code;
 this.statusCode = statusCode;
 this.isOperational = isOperational;
 
 // Capture stack trace
 Error.captureStackTrace(this, this.constructor);
 
 // Report to Sentry if not operational
 if (!isOperational) {
 captureException(this, {
 tags: {
 error_code: code,
 error_type: 'application',
 },
 extra: {
 statusCode,
 isOperational,
 },
 });
 }
 }
}

// API error class
export class APIError extends ApplicationError {
 public readonly endpoint: string;
 public readonly method: string;

 constructor(
 message: string,
 endpoint: string,
 method: string = 'GET',
 statusCode: number = 500
 ) {
 super(message, 'API_ERROR', statusCode);
 this.endpoint = endpoint;
 this.method = method;
 
 captureException(this, {
 tags: {
 error_type: 'api',
 endpoint,
 method,
 },
 });
 }
}

// Validation error class
export class ValidationError extends ApplicationError {
 public readonly field?: string;
 public readonly value?: any;

 constructor(message: string, field?: string, value?: any) {
 super(message, 'VALIDATION_ERROR', 400);
 this.field = field;
 this.value = value;
 }
}

// Performance monitoring helpers
export const performance = {
 // Measure API call duration
 async measureAPI<T>(
 name: string,
 operation: () => Promise<T>
 ): Promise<T> {
 const transaction = startTransaction(name, 'api');
 
 try {
 const result = await operation();
 transaction.setStatus('ok');
 return result;
 } catch (error) {
 transaction.setStatus('internal_error');
 throw error;
 } finally {
 transaction.finish();
 }
 },
 
 // Measure component render time
 measureRender(componentName: string): () => void {
 const span = Sentry.getCurrentHub()
 .getScope()
 ?.getTransaction()
 ?.startChild({
 op: 'react.render',
 description: componentName,
 });
 
 return () => {
 span?.finish();
 };
 },
};