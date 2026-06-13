/**
 * Environment Variable Validation and Secrets Management
 * Production-grade validation for all environment configurations
 */

import { z } from 'zod';

/** Normalize legacy/alias env vars before validation.
 *  Returns a normalized copy of the env object without mutating process.env.
 */
function normalizeProcessEnv(): Record<string, string> {
  // Start with a shallow copy; omit empty-string values so optional
  // url/email fields do not fail validation.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== '') {
      env[key] = value as string;
    }
  }

  if (!env.CORS_ORIGIN && env.CORS_ORIGINS) {
    env.CORS_ORIGIN = env.CORS_ORIGINS.split(',')[0]?.trim() ?? '';
  }

  if (env.REDIS_URL && !env.REDIS_HOST) {
    try {
      const url = new URL(env.REDIS_URL);
      env.REDIS_HOST = url.hostname;
      if (url.port) {
        env.REDIS_PORT = url.port;
      }
      if (url.password) {
        env.REDIS_PASSWORD = url.password;
      }
      if (url.protocol === 'rediss:' && !env.REDIS_TLS) {
        env.REDIS_TLS = 'true';
      }
    } catch {
      // Ignore malformed REDIS_URL; schema validation will surface issues elsewhere
    }
  }

  if (env.REDIS_TLS_ENABLED && !env.REDIS_TLS) {
    env.REDIS_TLS = env.REDIS_TLS_ENABLED;
  }

  if (env.GRAFANA_API_KEY && !env.GRAFANA_TOKEN) {
    env.GRAFANA_TOKEN = env.GRAFANA_API_KEY;
  }

  return env;
}

// Define the environment schema
const envSchema = z.object({
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database Configuration
  DATABASE_URL: z.string().url('Valid database URL required'),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z
    .string()
    .min(8, 'Database password must be at least 8 characters')
    .optional(),

  // Redis Configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  REDIS_DB: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  REDIS_SESSION_DB: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),

  // Authentication & Security
  NEXTAUTH_URL: z.string().url('Valid NextAuth URL required').optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters').optional(),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters').optional(),

  // OAuth Providers
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Backstage Configuration
  BACKSTAGE_BACKEND_URL: z.string().url('Valid Backstage backend URL required').optional(),
  BACKSTAGE_FRONTEND_URL: z.string().url('Valid Backstage frontend URL required').optional(),
  BACKSTAGE_TOKEN: z.string().optional(),

  // Stripe Configuration (required in production via validateEnvironment checks)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // External Services
  GRAFANA_URL: z.string().url().optional(),
  GRAFANA_API_KEY: z.string().optional(),
  GRAFANA_TOKEN: z.string().optional(),
  GRAFANA_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  PROMETHEUS_URL: z.string().url().optional(),
  ELASTICSEARCH_URL: z.string().url().optional(),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),

  // Cloud Provider Configuration
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GCP_CLIENT_EMAIL: z.string().email().optional(),
  GCP_PRIVATE_KEY: z.string().optional(),

  // Security Configuration
  CORS_ORIGIN: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  FORCE_HTTPS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Feature Flags
  FEATURE_PLUGINS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_MONITORING_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_ANALYTICS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  FEATURE_NOTIFICATIONS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Logging & Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  NEWRELIC_LICENSE_KEY: z.string().optional(),

  // Performance Configuration
  MAX_REQUEST_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('10485760'), // 10MB
  REQUEST_TIMEOUT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('30000'), // 30s
  CACHE_TTL: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('300'), // 5min

  // Development Only
  DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  MOCK_EXTERNAL_SERVICES: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

export type Environment = z.infer<typeof envSchema>;

// Environment validation results
export interface ValidationResult {
  success: boolean;
  data?: Environment;
  errors?: z.ZodError;
  warnings?: string[];
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const warnings: string[] = [];

  const normalizedEnv = normalizeProcessEnv();

  try {
    // Parse and validate the normalized copy (process.env is not mutated)
    const env = envSchema.parse(normalizedEnv);

    // Additional validation checks
    if (env.NODE_ENV === 'production') {
      // Production-specific validation
      const requiredInProduction = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
      ];

      const missing = requiredInProduction.filter((key) => !normalizedEnv[key]);
      if (missing.length > 0) {
        throw new z.ZodError([
          ...missing.map((key) => ({
            code: z.ZodIssueCode.invalid_type,
            expected: 'string',
            received: 'undefined',
            path: [key],
            message: `${key} is required in production`,
          })),
        ]);
      }

      // Security warnings for production
      if (!env.FORCE_HTTPS) {
        warnings.push('FORCE_HTTPS is not enabled in production');
      }

      if (!normalizedEnv.CORS_ORIGIN) {
        warnings.push('CORS_ORIGIN not configured - using default origins');
      }

      if (!normalizedEnv.SENTRY_DSN) {
        warnings.push('SENTRY_DSN not configured - error tracking disabled');
      }
    }

    // Development warnings
    if (env.NODE_ENV === 'development') {
      if (!normalizedEnv.NEXTAUTH_SECRET) {
        warnings.push('NEXTAUTH_SECRET not set - using default (insecure for production)');
      }
      if (!normalizedEnv.STRIPE_SECRET_KEY) {
        warnings.push('STRIPE_SECRET_KEY not set - billing features disabled in development');
      }
    }

    // General warnings
    if (!normalizedEnv.REDIS_HOST || normalizedEnv.REDIS_HOST === 'localhost') {
      if (env.NODE_ENV === 'production') {
        warnings.push('Using localhost Redis in production - consider external Redis');
      }
    }

    return {
      success: true,
      data: env,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: error as z.ZodError,
      warnings,
    };
  }
}

/**
 * Get validated environment or throw error
 */
export function getValidatedEnv(): Environment {
  const result = validateEnvironment();

  if (!result.success) {
    console.error('Environment validation failed:');
    result.errors?.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Invalid environment configuration');
  }

  if (result.warnings && result.warnings.length > 0) {
    console.warn('Environment warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`  ${warning}`);
    });
  }

  return result.data!;
}

/**
 * Secrets management utilities
 */
export class SecretsManager {
  private static instance: SecretsManager;
  private secrets: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Load secrets from various sources
   */
  async loadSecrets(): Promise<void> {
    // Load from environment variables
    this.loadFromEnv();

    // Load from external secret stores if configured
    if (process.env.AWS_REGION) {
      await this.loadFromAWSSecretsManager();
    }

    if (process.env.AZURE_TENANT_ID) {
      await this.loadFromAzureKeyVault();
    }

    if (process.env.GCP_PROJECT_ID) {
      await this.loadFromGCPSecretManager();
    }
  }

  private loadFromEnv(): void {
    const sensitiveKeys = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'REDIS_PASSWORD',
      'GITHUB_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'AWS_SECRET_ACCESS_KEY',
      'AZURE_CLIENT_SECRET',
      'GCP_PRIVATE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
    ];

    sensitiveKeys.forEach((key) => {
      if (process.env[key]) {
        this.secrets.set(key, process.env[key]!);
      }
    });
  }

  private async loadFromAWSSecretsManager(): Promise<void> {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

      const secretIds = process.env.AWS_SECRET_IDS?.split(',') || [];

      for (const secretId of secretIds) {
        try {
          const command = new GetSecretValueCommand({ SecretId: secretId.trim() });
          const result = await client.send(command);

          if (result.SecretString) {
            const secrets = JSON.parse(result.SecretString);
            Object.entries(secrets).forEach(([key, value]) => {
              this.secrets.set(key, value as string);
            });
          }
        } catch (error) {
          console.warn(`Failed to load secret ${secretId}:`, error);
        }
      }
    } catch (error) {
      console.warn('AWS Secrets Manager not available:', error);
    }
  }

  private async loadFromAzureKeyVault(): Promise<void> {
    try {
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = await import('@azure/identity');

      if (!process.env.AZURE_KEY_VAULT_URL) return;

      const credential = new DefaultAzureCredential();
      const client = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credential);

      const secretNames = process.env.AZURE_SECRET_NAMES?.split(',') || [];

      for (const secretName of secretNames) {
        try {
          const secret = await client.getSecret(secretName.trim());
          if (secret.value) {
            this.secrets.set(secretName.trim(), secret.value);
          }
        } catch (error) {
          console.warn(`Failed to load Azure secret ${secretName}:`, error);
        }
      }
    } catch (error) {
      console.warn('Azure Key Vault not available:', error);
    }
  }

  private async loadFromGCPSecretManager(): Promise<void> {
    try {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      const client = new SecretManagerServiceClient();

      const secretNames = process.env.GCP_SECRET_NAMES?.split(',') || [];

      for (const secretName of secretNames) {
        try {
          const name = `projects/${process.env.GCP_PROJECT_ID}/secrets/${secretName.trim()}/versions/latest`;
          const [version] = await client.accessSecretVersion({ name });

          if (version.payload?.data) {
            const secret = version.payload.data.toString();
            this.secrets.set(secretName.trim(), secret);
          }
        } catch (error) {
          console.warn(`Failed to load GCP secret ${secretName}:`, error);
        }
      }
    } catch (error) {
      console.warn('GCP Secret Manager not available:', error);
    }
  }

  /**
   * Get a secret value
   */
  getSecret(key: string): string | undefined {
    return this.secrets.get(key);
  }

  /**
   * Check if a secret exists
   */
  hasSecret(key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * Get all secret keys (for debugging - values not exposed)
   */
  getSecretKeys(): string[] {
    return Array.from(this.secrets.keys());
  }
}

/**
 * Initialize environment and secrets
 */
export async function initializeEnvironment(): Promise<Environment> {
  console.log('Initializing environment...');

  const env = getValidatedEnv();

  if (env.NODE_ENV === 'production' || process.env.ENABLE_SECRETS_MANAGER === 'true') {
    console.log('Loading secrets from external providers...');
    const secretsManager = SecretsManager.getInstance();
    await secretsManager.loadSecrets();
    console.log(`Loaded ${secretsManager.getSecretKeys().length} secrets`);
  }

  console.log(`Environment initialized for ${env.NODE_ENV}`);
  return env;
}

/**
 * Configuration helper functions
 */
export const config = {
  isProduction: () => process.env.NODE_ENV === 'production',
  isDevelopment: () => process.env.NODE_ENV === 'development',
  isTest: () => process.env.NODE_ENV === 'test',

  // Database
  getDatabaseUrl: () =>
    SecretsManager.getInstance().getSecret('DATABASE_URL') || process.env.DATABASE_URL,

  // Auth
  getJwtSecret: () =>
    SecretsManager.getInstance().getSecret('JWT_SECRET') || process.env.JWT_SECRET,
  getNextAuthSecret: () =>
    SecretsManager.getInstance().getSecret('NEXTAUTH_SECRET') || process.env.NEXTAUTH_SECRET,

  // External services
  getRedisConfig: () => {
    if (process.env.REDIS_URL) {
      try {
        const url = new URL(process.env.REDIS_URL);
        return {
          url: process.env.REDIS_URL,
          host: url.hostname,
          port: parseInt(url.port || '6379', 10),
          password:
            SecretsManager.getInstance().getSecret('REDIS_PASSWORD') ||
            url.password ||
            process.env.REDIS_PASSWORD,
          tls: url.protocol === 'rediss:' || process.env.REDIS_TLS === 'true',
        };
      } catch {
        // Fall through to host/port config
      }
    }

    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password:
        SecretsManager.getInstance().getSecret('REDIS_PASSWORD') || process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true',
    };
  },

  // Stripe
  getStripeConfig: () => ({
    secretKey:
      SecretsManager.getInstance().getSecret('STRIPE_SECRET_KEY') || process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret:
      SecretsManager.getInstance().getSecret('STRIPE_WEBHOOK_SECRET') ||
      process.env.STRIPE_WEBHOOK_SECRET,
  }),

  // Feature flags
  isFeatureEnabled: (feature: string) => {
    const envVar = `FEATURE_${feature.toUpperCase()}_ENABLED`;
    return process.env[envVar] === 'true';
  },
};

export default {
  validateEnvironment,
  getValidatedEnv,
  SecretsManager,
  initializeEnvironment,
  config,
};
