/**
 * API Integration Configuration Management
 * Centralized configuration for managing mock vs real API usage
 */

export interface ApiIntegrationConfig {
  cloudData: boolean;
  metrics: boolean;
  notifications: boolean;
  mlPredictions: boolean;
  kubernetes: boolean;
  backstage: boolean;
}

export interface ApiEndpointConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  healthCheckEndpoint: string;
  mockFallback: boolean;
}

export interface CloudProviderConfig {
  aws: {
    enabled: boolean;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    costExplorerEnabled: boolean;
  };
  gcp: {
    enabled: boolean;
    projectId?: string;
    serviceAccountPath?: string;
    billingEnabled: boolean;
  };
  azure: {
    enabled: boolean;
    subscriptionId?: string;
    clientId?: string;
    clientSecret?: string;
    costManagementEnabled: boolean;
  };
}

class ApiIntegrationManager {
  private config: ApiIntegrationConfig;
  private cloudConfig: CloudProviderConfig;

  constructor() {
    this.config = this.loadIntegrationConfig();
    this.cloudConfig = this.loadCloudConfig();
  }

  private loadIntegrationConfig(): ApiIntegrationConfig {
    return {
      cloudData: process.env.USE_MOCK_CLOUD_DATA !== 'false',
      metrics: process.env.USE_MOCK_METRICS !== 'false',
      notifications: process.env.USE_MOCK_NOTIFICATIONS !== 'false',
      mlPredictions: process.env.ENABLE_ML_PREDICTIONS === 'true',
      kubernetes: true, // Always try real first, fallback to mock
      backstage: true, // Always try real first, fallback to mock
    };
  }

  private loadCloudConfig(): CloudProviderConfig {
    return {
      aws: {
        enabled: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        costExplorerEnabled: !this.config.cloudData,
      },
      gcp: {
        enabled: !!(process.env.GCP_PROJECT_ID && process.env.GCP_SERVICE_ACCOUNT_KEY),
        projectId: process.env.GCP_PROJECT_ID,
        serviceAccountPath: process.env.GCP_SERVICE_ACCOUNT_KEY,
        billingEnabled: !this.config.cloudData,
      },
      azure: {
        enabled: !!(
          process.env.AZURE_CLIENT_ID && 
          process.env.AZURE_CLIENT_SECRET && 
          process.env.AZURE_SUBSCRIPTION_ID
        ),
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        costManagementEnabled: !this.config.cloudData,
      },
    };
  }

  /**
   * Check if we should use mock data for a specific service
   */
  shouldUseMockData(service: keyof ApiIntegrationConfig): boolean {
    return this.config[service] === true;
  }

  /**
   * Get cloud provider configuration
   */
  getCloudConfig(): CloudProviderConfig {
    return this.cloudConfig;
  }

  /**
   * Check if any cloud provider is properly configured
   */
  hasCloudProviderConfigured(): boolean {
    return this.cloudConfig.aws.enabled || 
           this.cloudConfig.gcp.enabled || 
           this.cloudConfig.azure.enabled;
  }

  /**
   * Get API endpoint configuration with fallback settings
   */
  getEndpointConfig(service: string): ApiEndpointConfig {
    const baseConfig = {
      timeout: 30000,
      retryAttempts: 3,
      healthCheckEndpoint: '/health',
      mockFallback: true,
    };

    switch (service) {
      case 'backstage':
        return {
          ...baseConfig,
          baseUrl: process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007',
          timeout: 15000,
        };
      
      case 'prometheus':
        return {
          ...baseConfig,
          baseUrl: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
          healthCheckEndpoint: '/-/healthy',
        };
      
      case 'grafana':
        return {
          ...baseConfig,
          baseUrl: process.env.GRAFANA_URL || 'http://grafana:3000',
          healthCheckEndpoint: '/api/health',
        };
      
      default:
        return {
          ...baseConfig,
          baseUrl: 'http://localhost:3000',
        };
    }
  }

  /**
   * Test connectivity to external services
   */
  async testConnectivity(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test Backstage connection
    try {
      const backstageConfig = this.getEndpointConfig('backstage');
      const response = await fetch(`${backstageConfig.baseUrl}/api/catalog/entities?limit=1`, {
        method: 'GET',
        timeout: backstageConfig.timeout,
      });
      results.backstage = response.ok;
    } catch {
      results.backstage = false;
    }

    // Test cloud providers
    results.aws = this.cloudConfig.aws.enabled;
    results.gcp = this.cloudConfig.gcp.enabled;
    results.azure = this.cloudConfig.azure.enabled;

    // Test monitoring systems
    if (process.env.PROMETHEUS_URL) {
      try {
        const prometheusConfig = this.getEndpointConfig('prometheus');
        const response = await fetch(`${prometheusConfig.baseUrl}${prometheusConfig.healthCheckEndpoint}`, {
          timeout: prometheusConfig.timeout,
        });
        results.prometheus = response.ok;
      } catch {
        results.prometheus = false;
      }
    }

    return results;
  }

  /**
   * Get environment-specific recommendations
   */
  getIntegrationRecommendations(): Array<{
    service: string;
    status: 'configured' | 'missing' | 'partial';
    message: string;
    action: string;
  }> {
    const recommendations = [];

    // Cloud provider recommendations
    if (!this.hasCloudProviderConfigured() && !this.config.cloudData) {
      recommendations.push({
        service: 'Cloud Providers',
        status: 'missing' as const,
        message: 'No cloud provider credentials configured',
        action: 'Set AWS_ACCESS_KEY_ID, GCP_PROJECT_ID, or AZURE_CLIENT_ID environment variables',
      });
    }

    // Backstage recommendation
    const backstageUrl = process.env.BACKSTAGE_BACKEND_URL;
    if (!backstageUrl || backstageUrl.includes('localhost')) {
      recommendations.push({
        service: 'Backstage',
        status: 'partial' as const,
        message: 'Using localhost Backstage backend',
        action: 'Configure BACKSTAGE_BACKEND_URL for production deployment',
      });
    }

    // Monitoring recommendations
    if (!process.env.PROMETHEUS_URL && !this.config.metrics) {
      recommendations.push({
        service: 'Monitoring',
        status: 'missing' as const,
        message: 'No monitoring system configured',
        action: 'Set PROMETHEUS_URL and GRAFANA_URL environment variables',
      });
    }

    // Notification recommendations
    if (!process.env.SLACK_BOT_TOKEN && !process.env.SMTP_HOST && !this.config.notifications) {
      recommendations.push({
        service: 'Notifications',
        status: 'missing' as const,
        message: 'No notification channels configured',
        action: 'Set SLACK_BOT_TOKEN or SMTP_HOST for notifications',
      });
    }

    return recommendations;
  }

  /**
   * Generate deployment readiness report
   */
  getDeploymentReadiness(): {
    ready: boolean;
    score: number;
    issues: Array<{
      severity: 'critical' | 'warning' | 'info';
      component: string;
      message: string;
    }>;
  } {
    const issues = [];
    let score = 100;

    // Critical issues
    if (!this.hasCloudProviderConfigured() && !this.config.cloudData) {
      issues.push({
        severity: 'critical' as const,
        component: 'Cloud Integration',
        message: 'No cloud provider configured - cost optimization will not function',
      });
      score -= 30;
    }

    if (!process.env.DATABASE_URL) {
      issues.push({
        severity: 'critical' as const,
        component: 'Database',
        message: 'DATABASE_URL not configured',
      });
      score -= 25;
    }

    // Warning issues
    if (!process.env.NEXTAUTH_SECRET) {
      issues.push({
        severity: 'warning' as const,
        component: 'Authentication',
        message: 'NEXTAUTH_SECRET should be configured for production',
      });
      score -= 15;
    }

    if (process.env.BACKSTAGE_BACKEND_URL?.includes('localhost')) {
      issues.push({
        severity: 'warning' as const,
        component: 'Backstage Integration',
        message: 'Using localhost Backstage backend - may not work in production',
      });
      score -= 10;
    }

    // Info issues
    if (this.config.mlPredictions && !process.env.ML_MODELS_PATH) {
      issues.push({
        severity: 'info' as const,
        component: 'ML Predictions',
        message: 'ML_MODELS_PATH not configured - predictions will use basic models',
      });
      score -= 5;
    }

    return {
      ready: score >= 70,
      score: Math.max(0, score),
      issues,
    };
  }
}

// Export singleton instance
export const apiIntegrationManager = new ApiIntegrationManager();

// Export utility functions
export function shouldUseMockData(service: keyof ApiIntegrationConfig): boolean {
  return apiIntegrationManager.shouldUseMockData(service);
}

export function getCloudConfig(): CloudProviderConfig {
  return apiIntegrationManager.getCloudConfig();
}

export async function checkIntegrationHealth(): Promise<Record<string, boolean>> {
  return apiIntegrationManager.testConnectivity();
}