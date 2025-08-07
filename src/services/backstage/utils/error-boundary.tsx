/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { QueryClient } from '@tanstack/react-query';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

import { getErrorMessage } from '@/lib/utils';

// Error types
export class BackstageApiError extends Error {
 public readonly status: number;
 public readonly code: string;
 public readonly details?: Record<string, unknown>;
 public readonly timestamp: Date;

 constructor(
 message: string,
 status: number = 500,
 code: string = 'UNKNOWN_ERROR',
 details?: Record<string, unknown>
 ) {
 super(message);
 this.name = 'BackstageApiError';
 this.status = status;
 this.code = code;
 this.details = details;
 this.timestamp = new Date();
 }

 toJSON() {
 return {
 name: this.name,
 message: this.message,
 status: this.status,
 code: this.code,
 details: this.details,
 timestamp: this.timestamp.toISOString(),
 stack: this.stack,
 };
 }
}

export class NetworkError extends BackstageApiError {
 constructor(message: string = 'Network request failed') {
 super(message, 0, 'NETWORK_ERROR');
 }
}

export class AuthenticationError extends BackstageApiError {
 constructor(message: string = 'Authentication required') {
 super(message, 401, 'AUTHENTICATION_ERROR');
 }
}

export class AuthorizationError extends BackstageApiError {
 constructor(message: string = 'Insufficient permissions') {
 super(message, 403, 'AUTHORIZATION_ERROR');
 }
}

export class NotFoundError extends BackstageApiError {
 constructor(message: string = 'Resource not found') {
 super(message, 404, 'NOT_FOUND_ERROR');
 }
}

export class ValidationError extends BackstageApiError {
 constructor(message: string, details?: Record<string, unknown>) {
 super(message, 400, 'VALIDATION_ERROR', details);
 }
}

export class RateLimitError extends BackstageApiError {
 public readonly retryAfter?: number;

 constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
 super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
 this.retryAfter = retryAfter;
 }
}

// Error boundary props
interface ErrorBoundaryProps {
 children: ReactNode;
 fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
 onError?: (error: Error, errorInfo: ErrorInfo) => void;
 enableRetry?: boolean;
 retryText?: string;
 level?: 'page' | 'component' | 'query';
 context?: string;
}

interface ErrorBoundaryState {
 hasError: boolean;
 error: Error | null;
 errorInfo: ErrorInfo | null;
 retryCount: number;
}

// Main error boundary component
export class BackstageErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 private retryTimeoutId: NodeJS.Timeout | null = null;

 constructor(props: ErrorBoundaryProps) {
 super(props);
 this.state = {
 hasError: false,
 error: null,
 errorInfo: null,
 retryCount: 0,
 };
 }

 static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
 return {
 hasError: true,
 error,
 };
 }

 componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 this.setState({ errorInfo });

 // Log error details
 console.error('BackstageErrorBoundary caught an error:', {
 error: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack,
 context: this.props.context,
 level: this.props.level,
 retryCount: this.state.retryCount,
 });

 // Call custom error handler
 this.props.onError?.(error, errorInfo);

 // Report to error tracking service
 this.reportError(error, errorInfo);
 }

 componentWillUnmount() {
 if (this.retryTimeoutId) {
 clearTimeout(this.retryTimeoutId);
 }
 }

 private reportError = (error: Error, errorInfo: ErrorInfo) => {
 // In a real app, you'd send this to your error tracking service
 const errorReport = {
 message: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack,
 context: this.props.context,
 level: this.props.level,
 timestamp: new Date().toISOString(),
 userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
 url: typeof window !== 'undefined' ? window.location.href : 'unknown',
 };

 // You could send this to Sentry, LogRocket, etc.
 console.error('Error Report:', errorReport);
 };

 private handleRetry = () => {
 this.setState(prevState => ({
 hasError: false,
 error: null,
 errorInfo: null,
 retryCount: prevState.retryCount + 1,
 }));
 };

 private renderFallback = (): ReactNode => {
 const { error, errorInfo, retryCount } = this.state;
 const { fallback, enableRetry = true, retryText = 'Try Again', level = 'component' } = this.props;

 if (fallback && error && errorInfo) {
 return fallback(error, errorInfo);
 }

 const isApiError = error instanceof BackstageApiError;
 const shouldShowRetry = enableRetry && retryCount < 3;

 return (
 <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
 <div className="flex items-start space-x-3">
 <div className="flex-shrink-0">
 <svg
 className="h-5 w-5 text-destructive"
 viewBox="0 0 20 20"
 fill="currentColor"
 >
 <path
 fillRule="evenodd"
 d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
 clipRule="evenodd"
 />
 </svg>
 </div>
 <div className="flex-1">
 <h3 className="text-sm font-medium text-destructive">
 {level === 'page' ? 'Page Error' : level === 'query' ? 'Data Loading Error' : 'Component Error'}
 </h3>
 <div className="mt-2 text-sm text-muted-foreground">
 {isApiError ? (
 <div>
 <p className="font-medium">{error.message}</p>
 {error instanceof BackstageApiError && (
 <div className="mt-1 space-y-1 text-xs">
 <p>Status: {error.status}</p>
 <p>Code: {error.code}</p>
 {error.details && (
 <p>Details: {JSON.stringify(error.details, null, 2)}</p>
 )}
 </div>
 )}
 </div>
 ) : (
 <p>{getErrorMessage(error)}</p>
 )}
 {retryCount > 0 && (
 <p className="mt-1 text-xs">Retry attempt: {retryCount}</p>
 )}
 </div>
 {shouldShowRetry && (
 <div className="mt-4">
 <button
 type="button"
 onClick={this.handleRetry}
 className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
 >
 {retryText}
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 };

 render() {
 if (this.state.hasError) {
 return this.renderFallback();
 }

 return this.props.children;
 }
}

// Specialized error boundaries
export const QueryErrorBoundary: React.FC<{
 children: ReactNode;
 onError?: (error: Error) => void;
}> = ({ children, onError }) => (
 <BackstageErrorBoundary
 level="query"
 context="TanStack Query"
 onError={onError}
 enableRetry={true}
 >
 {children}
 </BackstageErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{
 children: ReactNode;
 componentName?: string;
 onError?: (error: Error) => void;
}> = ({ children, componentName, onError }) => (
 <BackstageErrorBoundary
 level="component"
 context={componentName}
 onError={onError}
 enableRetry={true}
 >
 {children}
 </BackstageErrorBoundary>
);

export const PageErrorBoundary: React.FC<{
 children: ReactNode;
 onError?: (error: Error) => void;
}> = ({ children, onError }) => (
 <BackstageErrorBoundary
 level="page"
 context="Page"
 onError={onError}
 enableRetry={true}
 fallback={(error, errorInfo) => (
 <div className="min-h-screen flex items-center justify-center bg-background">
 <div className="max-w-md w-full">
 <div className="text-center">
 <h1 className="text-2xl font-bold text-foreground mb-4">
 Something went wrong
 </h1>
 <p className="text-muted-foreground mb-6">
 We encountered an unexpected error. Please try refreshing the page.
 </p>
 <button
 onClick={() => window.location.reload()}
 className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
 >
 Refresh Page
 </button>
 {process.env.NODE_ENV === 'development' && (
 <details className="mt-6 text-left">
 <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
 Error Details (Development)
 </summary>
 <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
 {error.stack}
 </pre>
 </details>
 )}
 </div>
 </div>
 </div>
 )}
 >
 {children}
 </BackstageErrorBoundary>
);

// Error handling utilities
export function handleApiError(error: unknown): BackstageApiError {
 if (error instanceof BackstageApiError) {
 return error;
 }

 if (error instanceof Error) {
 // Convert specific error types
 if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
 return new NetworkError(error.message);
 }
 
 if (error.message.includes('401') || error.message.includes('Unauthorized')) {
 return new AuthenticationError(error.message);
 }
 
 if (error.message.includes('403') || error.message.includes('Forbidden')) {
 return new AuthorizationError(error.message);
 }
 
 if (error.message.includes('404') || error.message.includes('Not Found')) {
 return new NotFoundError(error.message);
 }

 return new BackstageApiError(error.message);
 }

 return new BackstageApiError('An unknown error occurred');
}

export function isRetryableError(error: BackstageApiError): boolean {
 // Don't retry client errors (4xx) except for rate limiting
 if (error.status >= 400 && error.status < 500 && error.status !== 429) {
 return false;
 }
 
 // Don't retry authentication/authorization errors
 if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
 return false;
 }
 
 // Don't retry validation errors
 if (error instanceof ValidationError) {
 return false;
 }
 
 // Retry network errors, server errors, and rate limits
 return (
 error instanceof NetworkError ||
 error.status >= 500 ||
 error.status === 429 ||
 error.status === 0
 );
}

export function getRetryDelay(attempt: number, error?: BackstageApiError): number {
 // Rate limit errors might specify retry-after
 if (error instanceof RateLimitError && error.retryAfter) {
 return error.retryAfter * 1000;
 }
 
 // Exponential backoff with jitter
 const baseDelay = 1000; // 1 second
 const maxDelay = 30000; // 30 seconds
 const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
 const jitter = Math.random() * 1000; // Up to 1 second of jitter
 
 return Math.min(exponentialDelay + jitter, maxDelay);
}

// Global error handler setup
export function setupGlobalErrorHandlers(): void {
 // Handle unhandled promise rejections
 if (typeof window !== 'undefined') {
 window.addEventListener('unhandledrejection', (event) => {
 console.error('Unhandled promise rejection:', event.reason);
 
 // Don't prevent default if it's a BackstageApiError - let it bubble up
 if (!(event.reason instanceof BackstageApiError)) {
 event.preventDefault();
 }
 });

 // Handle global errors
 window.addEventListener('error', (event) => {
 console.error('Global error:', event.error);
 });
 }
}

// Query client error handling
export function createQueryClientWithErrorHandling(): QueryClient {
 return new QueryClient({
 defaultOptions: {
 queries: {
 retry: (failureCount, error) => {
 const backstageError = handleApiError(error);
 
 // Don't retry if we've reached max attempts
 if (failureCount >= 3) return false;
 
 // Check if error is retryable
 return isRetryableError(backstageError);
 },
 retryDelay: (attemptIndex, error) => {
 const backstageError = handleApiError(error);
 return getRetryDelay(attemptIndex + 1, backstageError);
 },
 throwOnError: (error) => {
 const backstageError = handleApiError(error);
 
 // Don't throw on authentication errors in development
 if (process.env.NODE_ENV === 'development' && 
 backstageError instanceof AuthenticationError) {
 return false;
 }
 
 return true;
 },
 },
 mutations: {
 retry: (failureCount, error) => {
 const backstageError = handleApiError(error);
 
 // Generally don't retry mutations, except for network errors
 if (failureCount >= 1) return false;
 
 return backstageError instanceof NetworkError;
 },
 throwOnError: true,
 },
 },
 });
}