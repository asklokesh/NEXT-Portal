/**
 * Module Loading Error Handler
 * Comprehensive error handling for Webpack and module loading issues
 */

import { isClient, isEdgeRuntime, isDevelopment } from '../runtime/client-server-guards';

export interface ModuleError {
  type: 'webpack' | 'import' | 'runtime' | 'circular' | 'missing';
  message: string;
  stack?: string;
  moduleName?: string;
  environment: 'client' | 'server' | 'edge';
  timestamp: string;
}

export interface ModuleErrorContext {
  url?: string;
  userAgent?: string;
  component?: string;
  props?: any;
}

// Error tracking
const errorHistory: ModuleError[] = [];
const MAX_ERROR_HISTORY = 100;

// Error patterns for identification
const ERROR_PATTERNS = {
  webpack: [
    /cannot read properties of undefined \(reading 'call'\)/i,
    /options\.factory/i,
    /webpack_require/i,
    /__webpack_require__/i,
    /cannot resolve module/i,
    /module not found/i
  ],
  circular: [
    /circular dependency/i,
    /dependency cycle/i,
    /circular import/i
  ],
  runtime: [
    /runtime error/i,
    /execution error/i,
    /cannot access before initialization/i
  ],
  import: [
    /dynamic import/i,
    /import\(\)/i,
    /failed to import/i,
    /import error/i
  ],
  redis: [
    /redis/i,
    /ioredis/i,
    /redis-errors/i,
    /charcodeat/i
  ],
  edge: [
    /edge runtime/i,
    /edge-runtime-webpack/i,
    /middleware\.js/i
  ]
};

/**
 * Identify error type based on message and stack
 */
export function identifyErrorType(error: Error): ModuleError['type'] {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';
  
  for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message) || pattern.test(stack)) {
        return type as ModuleError['type'];
      }
    }
  }
  
  return 'runtime';
}

/**
 * Extract module name from error
 */
export function extractModuleName(error: Error): string | undefined {
  const message = error.message;
  const stack = error.stack || '';
  
  // Common patterns for module names
  const patterns = [
    /module ["']([^"']+)["']/i,
    /from ["']([^"']+)["']/i,
    /import\(["']([^"']+)["']\)/i,
    /require\(["']([^"']+)["']\)/i,
    /Cannot resolve module ["']([^"']+)["']/i,
    /\/([^\/\s]+\.(ts|js|tsx|jsx))/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern) || stack.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

/**
 * Create structured module error
 */
export function createModuleError(
  error: Error,
  context?: ModuleErrorContext
): ModuleError {
  return {
    type: identifyErrorType(error),
    message: error.message,
    stack: error.stack,
    moduleName: extractModuleName(error),
    environment: isClient ? 'client' : isEdgeRuntime ? 'edge' : 'server',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log and track module error
 */
export function handleModuleError(
  error: Error,
  context?: ModuleErrorContext
): void {
  const moduleError = createModuleError(error, context);
  
  // Add to history
  errorHistory.push(moduleError);
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift();
  }
  
  // Log based on environment
  if (isDevelopment) {
    console.group('🚫 Module Loading Error');
    console.error('Type:', moduleError.type);
    console.error('Environment:', moduleError.environment);
    console.error('Module:', moduleError.moduleName || 'unknown');
    console.error('Message:', moduleError.message);
    if (context) {
      console.error('Context:', context);
    }
    if (moduleError.stack) {
      console.error('Stack:', moduleError.stack);
    }
    console.groupEnd();
  } else {
    // Production logging (less verbose)
    console.error('Module Error:', {
      type: moduleError.type,
      module: moduleError.moduleName,
      environment: moduleError.environment,
      timestamp: moduleError.timestamp
    });
  }
  
  // Send to monitoring service in production
  if (!isDevelopment && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'exception', {
      description: `Module Error: ${moduleError.type} - ${moduleError.moduleName}`,
      fatal: false
    });
  }
}

/**
 * React Error Boundary for module loading errors
 */
export class ModuleErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<any> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    handleModuleError(error, {
      component: errorInfo.componentStack,
      props: this.props
    });
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return React.createElement(FallbackComponent, { error: this.state.error });
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
export function DefaultErrorFallback({ error }: { error?: Error }) {
  if (isDevelopment) {
    return React.createElement('div', {
      style: {
        padding: '20px',
        margin: '20px',
        border: '2px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0',
        fontFamily: 'monospace'
      }
    }, [
      React.createElement('h3', { key: 'title' }, '🚫 Module Loading Error'),
      React.createElement('p', { key: 'message' }, error?.message || 'Unknown module error'),
      React.createElement('details', { key: 'details' }, [
        React.createElement('summary', { key: 'summary' }, 'Stack Trace'),
        React.createElement('pre', { 
          key: 'stack',
          style: { fontSize: '12px', overflow: 'auto' }
        }, error?.stack || 'No stack trace available')
      ])
    ]);
  }

  return React.createElement('div', {
    style: {
      padding: '20px',
      textAlign: 'center' as const
    }
  }, 'Something went wrong. Please refresh the page.');
}

/**
 * Create safe dynamic import wrapper
 */
export function createSafeDynamicImport<T>(
  importFn: () => Promise<T>,
  moduleName: string,
  options: {
    retries?: number;
    retryDelay?: number;
    fallback?: T;
    onError?: (error: Error) => void;
  } = {}
) {
  const { retries = 3, retryDelay = 1000, fallback, onError } = options;
  
  return async (): Promise<T | null> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;
        
        handleModuleError(lastError, {
          component: moduleName,
          url: typeof window !== 'undefined' ? window.location.href : undefined
        });
        
        if (onError) {
          onError(lastError);
        }
        
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    console.error(`Failed to import ${moduleName} after ${retries} attempts`);
    return fallback || null;
  };
}

/**
 * Get error history for debugging
 */
export function getErrorHistory(): ModuleError[] {
  return [...errorHistory];
}

/**
 * Clear error history
 */
export function clearErrorHistory(): void {
  errorHistory.length = 0;
}

/**
 * Get error statistics
 */
export function getErrorStats() {
  const stats = {
    total: errorHistory.length,
    byType: {} as Record<string, number>,
    byEnvironment: {} as Record<string, number>,
    recentErrors: errorHistory.slice(-10)
  };
  
  for (const error of errorHistory) {
    stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    stats.byEnvironment[error.environment] = (stats.byEnvironment[error.environment] || 0) + 1;
  }
  
  return stats;
}

// Import React for JSX support
import React from 'react';

export default {
  handleModuleError,
  createModuleError,
  ModuleErrorBoundary,
  DefaultErrorFallback,
  createSafeDynamicImport,
  getErrorHistory,
  clearErrorHistory,
  getErrorStats,
};