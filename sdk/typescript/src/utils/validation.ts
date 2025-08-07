import { z } from 'zod';
import { ClientConfig, AuthConfig } from '../types';

// Configuration validation schemas
const ClientConfigSchema = z.object({
  baseURL: z.string().url('Invalid base URL'),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
  timeout: z.number().min(1000, 'Timeout must be at least 1000ms').optional(),
  retries: z.number().min(0, 'Retries must be non-negative').max(10, 'Maximum 10 retries').optional(),
  retryDelay: z.number().min(100, 'Retry delay must be at least 100ms').optional(),
  circuitBreakerOptions: z.object({
    threshold: z.number().min(1, 'Threshold must be at least 1'),
    timeout: z.number().min(1000, 'Timeout must be at least 1000ms'),
    resetTimeout: z.number().min(1000, 'Reset timeout must be at least 1000ms'),
  }).optional(),
  rateLimit: z.object({
    requests: z.number().min(1, 'Requests must be at least 1'),
    window: z.number().min(1000, 'Window must be at least 1000ms'),
  }).optional(),
}).refine(
  (config) => config.apiKey || config.bearerToken,
  {
    message: 'Either apiKey or bearerToken must be provided',
    path: ['apiKey', 'bearerToken'],
  }
);

const AuthConfigSchema = z.object({
  baseURL: z.string().url('Invalid base URL'),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
  refreshToken: z.string().optional(),
  autoRefresh: z.boolean().optional(),
}).refine(
  (config) => config.apiKey || config.bearerToken,
  {
    message: 'Either apiKey or bearerToken must be provided',
    path: ['apiKey', 'bearerToken'],
  }
);

/**
 * Validate client configuration
 */
export function validateConfig(config: Partial<ClientConfig>): {
  valid: boolean;
  errors: string[];
  config?: ClientConfig;
} {
  try {
    const validatedConfig = ClientConfigSchema.parse(config);
    return {
      valid: true,
      errors: [],
      config: validatedConfig as ClientConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    
    return {
      valid: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate authentication configuration
 */
export function validateAuthConfig(config: Partial<AuthConfig>): {
  valid: boolean;
  errors: string[];
  config?: AuthConfig;
} {
  try {
    const validatedConfig = AuthConfigSchema.parse(config);
    return {
      valid: true,
      errors: [],
      config: validatedConfig as AuthConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    
    return {
      valid: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  // API key should be a non-empty string
  return typeof apiKey === 'string' && apiKey.length > 0;
}

/**
 * Validate Bearer token format
 */
export function validateBearerToken(token: string): boolean {
  // Bearer token should be a non-empty string
  // Optionally validate JWT format
  if (typeof token !== 'string' || token.length === 0) {
    return false;
  }

  // Check if it's a JWT (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length === 3) {
    // Try to decode the header to ensure it's valid base64
    try {
      atob(parts[0]);
      atob(parts[1]);
      return true;
    } catch {
      return false;
    }
  }

  // Accept any non-empty string as valid token
  return true;
}

/**
 * Validate URL format
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize configuration by removing sensitive information
 */
export function sanitizeConfig(config: ClientConfig): Partial<ClientConfig> {
  const sanitized = { ...config };
  
  // Remove or mask sensitive fields
  if (sanitized.apiKey) {
    sanitized.apiKey = maskSensitiveValue(sanitized.apiKey);
  }
  
  if (sanitized.bearerToken) {
    sanitized.bearerToken = maskSensitiveValue(sanitized.bearerToken);
  }
  
  return sanitized;
}

/**
 * Mask sensitive values for logging
 */
function maskSensitiveValue(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  
  return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}

/**
 * Check if configuration is for production environment
 */
export function isProductionConfig(config: ClientConfig): boolean {
  return (
    config.baseURL.includes('https://') &&
    !config.baseURL.includes('localhost') &&
    !config.baseURL.includes('127.0.0.1') &&
    !config.baseURL.includes('dev') &&
    !config.baseURL.includes('staging')
  );
}

/**
 * Get configuration recommendations based on environment
 */
export function getConfigRecommendations(config: ClientConfig): string[] {
  const recommendations: string[] = [];
  
  if (isProductionConfig(config)) {
    // Production recommendations
    if ((config.timeout || 0) < 30000) {
      recommendations.push('Consider increasing timeout to at least 30s for production');
    }
    
    if ((config.retries || 0) < 3) {
      recommendations.push('Consider increasing retries to at least 3 for production');
    }
    
    if (!config.circuitBreakerOptions) {
      recommendations.push('Consider enabling circuit breaker for production');
    }
    
    if (!config.rateLimit) {
      recommendations.push('Consider enabling rate limiting for production');
    }
  } else {
    // Development recommendations
    if ((config.timeout || 0) > 10000) {
      recommendations.push('Consider reducing timeout for faster development feedback');
    }
    
    if ((config.retries || 0) > 2) {
      recommendations.push('Consider reducing retries for faster development feedback');
    }
  }
  
  return recommendations;
}