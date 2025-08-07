/**
 * Security Configuration Management System
 * 
 * Centralized configuration management for the security scanning and vulnerability
 * management system. Handles security policies, scanning configurations, compliance
 * frameworks, and integration settings.
 * 
 * Features:
 * - Hierarchical configuration management
 * - Environment-specific security settings
 * - Dynamic policy updates
 * - Secure credential management
 * - Compliance framework configurations
 */

import { Logger } from '@backstage/backend-common';

export interface SecurityConfig {
  scanning: ScanningConfig;
  threat: ThreatDetectionConfig;
  compliance: ComplianceConfig;
  policies: PolicyConfig;
  integrations: IntegrationConfig;
  remediation: RemediationConfig;
  analytics: AnalyticsConfig;
  notifications: NotificationConfig;
}

export interface ScanningConfig {
  enabled: boolean;
  scanners: {
    sast: SASTConfig;
    dast: DASTConfig;
    sca: SCAConfig;
    infrastructure: InfrastructureConfig;
    container: ContainerConfig;
    secrets: SecretsConfig;
  };
  scheduling: SchedulingConfig;
  thresholds: SecurityThresholds;
}

export interface SASTConfig {
  enabled: boolean;
  tools: string[];
  languages: string[];
  rulesets: string[];
  excludePaths: string[];
  timeout: number;
  parallelism: number;
}

export interface DASTConfig {
  enabled: boolean;
  tools: string[];
  targetUrls: string[];
  authConfig: AuthConfig;
  scanDepth: number;
  timeout: number;
  userAgent: string;
}

export interface SCAConfig {
  enabled: boolean;
  tools: string[];
  packageManagers: string[];
  vulnerabilityDbs: string[];
  licenseCheck: boolean;
  timeout: number;
}

export interface InfrastructureConfig {
  enabled: boolean;
  providers: string[];
  regions: string[];
  services: string[];
  policies: string[];
  timeout: number;
}

export interface ContainerConfig {
  enabled: boolean;
  tools: string[];
  registries: string[];
  baseImages: string[];
  policies: string[];
  timeout: number;
}

export interface SecretsConfig {
  enabled: boolean;
  tools: string[];
  patterns: string[];
  excludePaths: string[];
  entropy: boolean;
  timeout: number;
}

export interface ThreatDetectionConfig {
  enabled: boolean;
  realtime: boolean;
  sources: string[];
  rules: ThreatRule[];
  ml: MLConfig;
  correlation: CorrelationConfig;
}

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: any[];
  actions: string[];
  enabled: boolean;
}

export interface MLConfig {
  enabled: boolean;
  models: string[];
  trainingData: string;
  threshold: number;
  retraining: boolean;
}

export interface CorrelationConfig {
  enabled: boolean;
  windowSize: number;
  rules: string[];
  threshold: number;
}

export interface ComplianceConfig {
  frameworks: ComplianceFramework[];
  reporting: ReportingConfig;
  automation: AutomationConfig;
}

export interface ComplianceFramework {
  name: string;
  version: string;
  controls: Control[];
  enabled: boolean;
}

export interface Control {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  automated: boolean;
  tests: string[];
}

export interface PolicyConfig {
  engine: string;
  policies: Policy[];
  enforcement: EnforcementConfig;
  exceptions: Exception[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: 'security' | 'compliance' | 'quality' | 'operational';
  rules: PolicyRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  version: string;
}

export interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
}

export interface IntegrationConfig {
  tools: ToolIntegration[];
  apis: APIIntegration[];
  webhooks: WebhookConfig[];
  credentials: CredentialConfig;
}

export interface ToolIntegration {
  name: string;
  type: 'scanner' | 'siem' | 'ticketing' | 'notification';
  endpoint: string;
  authentication: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface RemediationConfig {
  enabled: boolean;
  automatic: boolean;
  strategies: RemediationStrategy[];
  approval: ApprovalConfig;
  rollback: RollbackConfig;
}

export interface RemediationStrategy {
  vulnerability: string;
  severity: string;
  actions: string[];
  priority: number;
  automated: boolean;
}

export interface AnalyticsConfig {
  enabled: boolean;
  metrics: string[];
  dashboards: string[];
  retention: number;
  aggregation: AggregationConfig;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  rules: NotificationRule[];
  templates: NotificationTemplate[];
}

export interface NotificationChannel {
  name: string;
  type: 'email' | 'slack' | 'teams' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

export interface NotificationRule {
  trigger: string;
  severity: string[];
  channels: string[];
  template: string;
  throttle: number;
}

export interface NotificationTemplate {
  name: string;
  format: 'text' | 'html' | 'markdown';
  subject: string;
  body: string;
}

// Additional interfaces
export interface SchedulingConfig {
  cron: string;
  timezone: string;
  parallel: boolean;
  maxConcurrency: number;
  retries: number;
}

export interface SecurityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
  failBuild: boolean;
}

export interface AuthConfig {
  type: 'basic' | 'oauth' | 'session' | 'token';
  credentials: Record<string, string>;
  headers: Record<string, string>;
}

export interface ReportingConfig {
  formats: string[];
  schedule: string;
  recipients: string[];
  retention: number;
}

export interface AutomationConfig {
  enabled: boolean;
  continuous: boolean;
  triggers: string[];
  actions: string[];
}

export interface EnforcementConfig {
  mode: 'monitor' | 'block' | 'warn';
  exemptions: boolean;
  escalation: boolean;
}

export interface Exception {
  id: string;
  policy: string;
  resource: string;
  reason: string;
  expiry: Date;
  approved: boolean;
}

export interface APIIntegration {
  name: string;
  url: string;
  authentication: string;
  rateLimit: number;
  timeout: number;
}

export interface WebhookConfig {
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

export interface CredentialConfig {
  vault: string;
  encryption: string;
  rotation: boolean;
  expiry: number;
}

export interface ApprovalConfig {
  required: boolean;
  reviewers: string[];
  timeout: number;
  escalation: string[];
}

export interface RollbackConfig {
  enabled: boolean;
  automatic: boolean;
  conditions: string[];
  timeout: number;
}

export interface AggregationConfig {
  interval: string;
  functions: string[];
  dimensions: string[];
  retention: number;
}

/**
 * Security Configuration Manager
 * 
 * Manages loading, validation, and updates of security configuration.
 * Supports environment-specific overrides and dynamic updates.
 */
export class SecurityConfigManager {
  private config: SecurityConfig | null = null;
  private logger: Logger;
  private watchers: Map<string, () => void> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Load security configuration from environment and files
   */
  async loadConfig(): Promise<SecurityConfig> {
    try {
      this.logger.info('Loading security configuration');

      // Load base configuration
      const baseConfig = this.getBaseConfig();
      
      // Apply environment overrides
      const envConfig = this.getEnvironmentConfig();
      
      // Merge configurations
      this.config = this.mergeConfigs(baseConfig, envConfig);
      
      // Validate configuration
      await this.validateConfig(this.config);
      
      this.logger.info('Security configuration loaded successfully');
      return this.config;
    } catch (error) {
      this.logger.error('Failed to load security configuration', error);
      throw error;
    }
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    if (!this.config) {
      throw new Error('Security configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Update security configuration dynamically
   */
  async updateConfig(updates: Partial<SecurityConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    try {
      const updatedConfig = this.mergeConfigs(this.config, updates);
      await this.validateConfig(updatedConfig);
      
      this.config = updatedConfig;
      
      // Notify watchers
      this.notifyWatchers();
      
      this.logger.info('Security configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update security configuration', error);
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(key: string, callback: () => void): void {
    this.watchers.set(key, callback);
  }

  /**
   * Stop watching configuration changes
   */
  unwatch(key: string): void {
    this.watchers.delete(key);
  }

  /**
   * Get scanning configuration for specific scanner
   */
  getScannerConfig(scannerType: keyof ScanningConfig['scanners']): any {
    return this.getConfig().scanning.scanners[scannerType];
  }

  /**
   * Get policies by type
   */
  getPoliciesByType(type: Policy['type']): Policy[] {
    return this.getConfig().policies.policies.filter(p => p.type === type);
  }

  /**
   * Get active compliance frameworks
   */
  getActiveFrameworks(): ComplianceFramework[] {
    return this.getConfig().compliance.frameworks.filter(f => f.enabled);
  }

  /**
   * Get tool integration configuration
   */
  getToolConfig(toolName: string): ToolIntegration | undefined {
    return this.getConfig().integrations.tools.find(t => t.name === toolName);
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    const config = this.getConfig();
    const parts = feature.split('.');
    
    let current: any = config;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    
    return current === true;
  }

  /**
   * Get base configuration with defaults
   */
  private getBaseConfig(): SecurityConfig {
    return {
      scanning: {
        enabled: true,
        scanners: {
          sast: {
            enabled: true,
            tools: ['semgrep', 'codeql', 'sonarqube'],
            languages: ['javascript', 'typescript', 'python', 'java', 'go'],
            rulesets: ['security', 'quality', 'maintainability'],
            excludePaths: ['node_modules', 'build', 'dist'],
            timeout: 1800,
            parallelism: 4
          },
          dast: {
            enabled: true,
            tools: ['owasp-zap', 'burp'],
            targetUrls: [],
            authConfig: { type: 'basic', credentials: {}, headers: {} },
            scanDepth: 5,
            timeout: 3600,
            userAgent: 'SecurityScanner/1.0'
          },
          sca: {
            enabled: true,
            tools: ['snyk', 'trivy', 'npm-audit'],
            packageManagers: ['npm', 'yarn', 'pip', 'maven', 'gradle'],
            vulnerabilityDbs: ['nvd', 'github-advisory'],
            licenseCheck: true,
            timeout: 900
          },
          infrastructure: {
            enabled: true,
            providers: ['aws', 'azure', 'gcp'],
            regions: ['us-east-1', 'us-west-2'],
            services: ['compute', 'storage', 'network', 'database'],
            policies: ['cis', 'nist'],
            timeout: 1200
          },
          container: {
            enabled: true,
            tools: ['trivy', 'clair', 'twistlock'],
            registries: ['docker.io', 'gcr.io'],
            baseImages: ['alpine', 'ubuntu', 'debian'],
            policies: ['dockerfile-best-practices', 'cve-scanning'],
            timeout: 600
          },
          secrets: {
            enabled: true,
            tools: ['truffhehog', 'gitleaks', 'detect-secrets'],
            patterns: ['api-keys', 'passwords', 'certificates'],
            excludePaths: ['test', 'mock'],
            entropy: true,
            timeout: 300
          }
        },
        scheduling: {
          cron: '0 2 * * *',
          timezone: 'UTC',
          parallel: true,
          maxConcurrency: 5,
          retries: 3
        },
        thresholds: {
          critical: 0,
          high: 5,
          medium: 20,
          low: 50,
          failBuild: true
        }
      },
      threat: {
        enabled: true,
        realtime: true,
        sources: ['logs', 'metrics', 'events', 'network'],
        rules: [],
        ml: {
          enabled: true,
          models: ['anomaly-detection', 'threat-classification'],
          trainingData: '/data/training',
          threshold: 0.8,
          retraining: true
        },
        correlation: {
          enabled: true,
          windowSize: 300,
          rules: ['brute-force', 'data-exfiltration', 'privilege-escalation'],
          threshold: 0.7
        }
      },
      compliance: {
        frameworks: [
          {
            name: 'SOC2',
            version: '2017',
            controls: [],
            enabled: true
          },
          {
            name: 'ISO27001',
            version: '2013',
            controls: [],
            enabled: true
          },
          {
            name: 'PCI-DSS',
            version: '4.0',
            controls: [],
            enabled: false
          }
        ],
        reporting: {
          formats: ['pdf', 'html', 'json'],
          schedule: '0 0 1 * *',
          recipients: [],
          retention: 365
        },
        automation: {
          enabled: true,
          continuous: true,
          triggers: ['code-commit', 'deployment', 'schedule'],
          actions: ['scan', 'assess', 'report']
        }
      },
      policies: {
        engine: 'opa',
        policies: [],
        enforcement: {
          mode: 'warn',
          exemptions: true,
          escalation: true
        },
        exceptions: []
      },
      integrations: {
        tools: [],
        apis: [],
        webhooks: [],
        credentials: {
          vault: 'hashicorp-vault',
          encryption: 'aes-256-gcm',
          rotation: true,
          expiry: 90
        }
      },
      remediation: {
        enabled: true,
        automatic: false,
        strategies: [],
        approval: {
          required: true,
          reviewers: [],
          timeout: 86400,
          escalation: []
        },
        rollback: {
          enabled: true,
          automatic: true,
          conditions: ['test-failure', 'error-rate-spike'],
          timeout: 300
        }
      },
      analytics: {
        enabled: true,
        metrics: ['vulnerability-count', 'scan-coverage', 'remediation-time'],
        dashboards: ['security-overview', 'compliance-status', 'threat-landscape'],
        retention: 365,
        aggregation: {
          interval: '1h',
          functions: ['count', 'avg', 'max', 'min'],
          dimensions: ['severity', 'category', 'source'],
          retention: 90
        }
      },
      notifications: {
        channels: [],
        rules: [],
        templates: []
      }
    };
  }

  /**
   * Get environment-specific configuration overrides
   */
  private getEnvironmentConfig(): Partial<SecurityConfig> {
    const env = process.env.NODE_ENV || 'development';
    
    // Environment-specific overrides
    switch (env) {
      case 'production':
        return {
          scanning: {
            thresholds: {
              critical: 0,
              high: 2,
              medium: 10,
              low: 25,
              failBuild: true
            }
          },
          policies: {
            enforcement: {
              mode: 'block',
              exemptions: false,
              escalation: true
            }
          }
        };
      case 'staging':
        return {
          policies: {
            enforcement: {
              mode: 'warn',
              exemptions: true,
              escalation: false
            }
          }
        };
      default:
        return {
          scanning: {
            thresholds: {
              critical: 10,
              high: 25,
              medium: 50,
              low: 100,
              failBuild: false
            }
          }
        };
    }
  }

  /**
   * Merge configuration objects recursively
   */
  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Validate security configuration
   */
  private async validateConfig(config: SecurityConfig): Promise<void> {
    // Validate required fields
    if (!config.scanning) {
      throw new Error('Scanning configuration is required');
    }
    
    if (!config.threat) {
      throw new Error('Threat detection configuration is required');
    }
    
    if (!config.policies) {
      throw new Error('Policy configuration is required');
    }

    // Validate scanner configurations
    for (const [scannerType, scannerConfig] of Object.entries(config.scanning.scanners)) {
      if (scannerConfig.enabled && !scannerConfig.tools?.length) {
        throw new Error(`No tools configured for enabled scanner: ${scannerType}`);
      }
    }

    // Validate policy engine
    if (!['opa', 'cedar', 'custom'].includes(config.policies.engine)) {
      throw new Error(`Invalid policy engine: ${config.policies.engine}`);
    }

    // Validate notification channels
    for (const channel of config.notifications.channels) {
      if (!['email', 'slack', 'teams', 'webhook'].includes(channel.type)) {
        throw new Error(`Invalid notification channel type: ${channel.type}`);
      }
    }

    this.logger.debug('Security configuration validation passed');
  }

  /**
   * Notify configuration watchers
   */
  private notifyWatchers(): void {
    for (const [key, callback] of this.watchers) {
      try {
        callback();
      } catch (error) {
        this.logger.error(`Failed to notify config watcher ${key}`, error);
      }
    }
  }
}

/**
 * Global security configuration instance
 */
export const securityConfigManager = new SecurityConfigManager(
  require('@backstage/backend-common').getVoidLogger()
);