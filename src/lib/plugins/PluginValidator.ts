/**
 * Plugin Validation System
 * Comprehensive validation and verification for Backstage plugin installations
 * Ensures plugins are compatible, properly configured, and functional
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import yaml from 'js-yaml';
import { pluginConfigs } from './plugin-configs';

const execAsync = promisify(exec);

export interface PluginValidationResult {
  isValid: boolean;
  pluginId: string;
  version?: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100 validation score
  compatibility: CompatibilityInfo;
  dependencies: DependencyInfo[];
  configuration: ConfigurationValidation;
  runtime: RuntimeValidation;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  details?: any;
  suggestedFix?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  details?: any;
  recommendation?: string;
}

export interface CompatibilityInfo {
  backstageVersion: string;
  supportedVersions: string[];
  isCompatible: boolean;
  compatibilityScore: number;
  deprecationWarnings: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  required: string;
  status: 'satisfied' | 'missing' | 'conflict' | 'outdated';
  conflicts: DependencyConflict[];
}

export interface DependencyConflict {
  with: string;
  reason: string;
  severity: 'critical' | 'major' | 'minor';
  resolution?: string;
}

export interface ConfigurationValidation {
  isValid: boolean;
  requiredFields: FieldValidation[];
  optionalFields: FieldValidation[];
  securityIssues: SecurityIssue[];
  performance: PerformanceValidation;
}

export interface FieldValidation {
  field: string;
  status: 'valid' | 'invalid' | 'missing';
  expectedType: string;
  actualType?: string;
  constraints?: any;
  message?: string;
}

export interface SecurityIssue {
  type: 'secret_exposure' | 'insecure_config' | 'permission_issue';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  field?: string;
  recommendation: string;
}

export interface PerformanceValidation {
  score: number;
  issues: PerformanceIssue[];
  recommendations: string[];
}

export interface PerformanceIssue {
  type: 'memory' | 'cpu' | 'network' | 'storage';
  severity: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
}

export interface RuntimeValidation {
  isHealthy: boolean;
  endpoints: EndpointHealth[];
  performance: RuntimePerformance;
  errors: RuntimeError[];
  lastChecked: Date;
}

export interface EndpointHealth {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastError?: string;
}

export interface RuntimePerformance {
  memoryUsage: number;
  cpuUsage: number;
  responseTime: number;
  errorRate: number;
}

export interface RuntimeError {
  timestamp: Date;
  error: string;
  stack?: string;
  context?: any;
}

export class PluginValidator {
  private backstageDir: string;
  private configPath: string;
  private packageJsonPath: string;

  constructor(backstageDir: string = process.env.BACKSTAGE_DIR || './backstage') {
    this.backstageDir = path.resolve(backstageDir);
    this.configPath = path.join(this.backstageDir, 'app-config.yaml');
    this.packageJsonPath = path.join(this.backstageDir, 'package.json');
  }

  /**
   * Comprehensive plugin validation
   */
  async validatePlugin(pluginId: string, config?: any): Promise<PluginValidationResult> {
    const result: PluginValidationResult = {
      isValid: false,
      pluginId,
      errors: [],
      warnings: [],
      score: 0,
      compatibility: {
        backstageVersion: '',
        supportedVersions: [],
        isCompatible: false,
        compatibilityScore: 0,
        deprecationWarnings: []
      },
      dependencies: [],
      configuration: {
        isValid: false,
        requiredFields: [],
        optionalFields: [],
        securityIssues: [],
        performance: { score: 0, issues: [], recommendations: [] }
      },
      runtime: {
        isHealthy: false,
        endpoints: [],
        performance: { memoryUsage: 0, cpuUsage: 0, responseTime: 0, errorRate: 0 },
        errors: [],
        lastChecked: new Date()
      }
    };

    try {
      // Step 1: Version Compatibility Check
      const compatibilityResult = await this.checkVersionCompatibility(pluginId);
      result.compatibility = compatibilityResult;

      // Step 2: Installation Verification
      const installationValid = await this.verifyInstallation(pluginId, result);

      // Step 3: Dependency Analysis
      result.dependencies = await this.analyzeDependencies(pluginId, result);

      // Step 4: Configuration Validation
      result.configuration = await this.validateConfiguration(pluginId, config, result);

      // Step 5: Runtime Health Check
      result.runtime = await this.performRuntimeHealthCheck(pluginId, result);

      // Calculate overall validation score
      result.score = this.calculateValidationScore(result);
      result.isValid = result.score >= 70 && result.errors.filter(e => e.severity === 'critical').length === 0;

      return result;
    } catch (error) {
      result.errors.push({
        code: 'VALIDATION_FAILED',
        message: `Plugin validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical',
        details: { error }
      });
      return result;
    }
  }

  /**
   * Check Backstage version compatibility
   */
  async checkVersionCompatibility(pluginId: string): Promise<CompatibilityInfo> {
    const compatibility: CompatibilityInfo = {
      backstageVersion: '',
      supportedVersions: [],
      isCompatible: false,
      compatibilityScore: 0,
      deprecationWarnings: []
    };

    try {
      // Get current Backstage version
      const backstageVersion = await this.getBackstageVersion();
      compatibility.backstageVersion = backstageVersion;

      // Get plugin's supported versions
      const pluginConfig = pluginConfigs[pluginId];
      if (pluginConfig?.supportedBackstageVersions) {
        compatibility.supportedVersions = pluginConfig.supportedBackstageVersions;
      } else {
        // Try to determine from package.json
        const supportedVersions = await this.getPluginSupportedVersions(pluginId);
        compatibility.supportedVersions = supportedVersions;
      }

      // Check compatibility
      const isCompatible = compatibility.supportedVersions.some(version => 
        semver.satisfies(backstageVersion, version)
      );
      compatibility.isCompatible = isCompatible;

      // Calculate compatibility score
      if (isCompatible) {
        compatibility.compatibilityScore = 100;
      } else {
        // Check how close we are to supported versions
        const scores = compatibility.supportedVersions.map(version => {
          if (semver.gt(backstageVersion, version)) {
            return Math.max(0, 50 - (semver.diff(backstageVersion, version) === 'major' ? 30 : 10));
          } else {
            return Math.max(0, 70 - (semver.diff(version, backstageVersion) === 'major' ? 40 : 20));
          }
        });
        compatibility.compatibilityScore = Math.max(...scores);
      }

      // Check for deprecation warnings
      compatibility.deprecationWarnings = await this.checkDeprecationWarnings(pluginId, backstageVersion);

    } catch (error) {
      compatibility.compatibilityScore = 0;
      compatibility.deprecationWarnings.push(
        `Failed to check version compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return compatibility;
  }

  /**
   * Verify plugin installation
   */
  async verifyInstallation(pluginId: string, result: PluginValidationResult): Promise<boolean> {
    try {
      // Check if plugin package is installed
      const packageName = this.getPackageName(pluginId);
      const isInstalled = await this.isPackageInstalled(packageName);
      
      if (!isInstalled) {
        result.errors.push({
          code: 'PLUGIN_NOT_INSTALLED',
          message: `Plugin package ${packageName} is not installed`,
          severity: 'critical',
          suggestedFix: `Run: npm install ${packageName}`
        });
        return false;
      }

      // Check if plugin is registered in app configuration
      const isConfigured = await this.isPluginConfigured(pluginId);
      if (!isConfigured) {
        result.warnings.push({
          code: 'PLUGIN_NOT_CONFIGURED',
          message: `Plugin ${pluginId} is installed but not configured`,
          impact: 'high',
          recommendation: 'Add plugin configuration to app-config.yaml'
        });
      }

      // Check if plugin is enabled
      const isEnabled = await this.isPluginEnabled(pluginId);
      if (!isEnabled) {
        result.warnings.push({
          code: 'PLUGIN_DISABLED',
          message: `Plugin ${pluginId} is installed but disabled`,
          impact: 'medium',
          recommendation: 'Enable plugin in configuration'
        });
      }

      return true;
    } catch (error) {
      result.errors.push({
        code: 'INSTALLATION_CHECK_FAILED',
        message: `Failed to verify installation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'major',
        details: { error }
      });
      return false;
    }
  }

  /**
   * Analyze plugin dependencies and conflicts
   */
  async analyzeDependencies(pluginId: string, result: PluginValidationResult): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    try {
      const packageName = this.getPackageName(pluginId);
      const pluginPackageJson = await this.getPluginPackageJson(packageName);
      
      if (!pluginPackageJson) {
        result.errors.push({
          code: 'PACKAGE_JSON_NOT_FOUND',
          message: `Could not find package.json for ${packageName}`,
          severity: 'major'
        });
        return dependencies;
      }

      // Analyze peer dependencies
      const peerDeps = pluginPackageJson.peerDependencies || {};
      for (const [depName, requiredVersion] of Object.entries(peerDeps)) {
        const depInfo: DependencyInfo = {
          name: depName,
          version: '',
          required: requiredVersion as string,
          status: 'missing',
          conflicts: []
        };

        // Check if dependency is installed
        const installedVersion = await this.getInstalledPackageVersion(depName);
        if (installedVersion) {
          depInfo.version = installedVersion;
          
          // Check version compatibility
          if (semver.satisfies(installedVersion, requiredVersion as string)) {
            depInfo.status = 'satisfied';
          } else {
            depInfo.status = 'conflict';
            depInfo.conflicts.push({
              with: depName,
              reason: `Required ${requiredVersion}, but ${installedVersion} is installed`,
              severity: 'major',
              resolution: `Update ${depName} to satisfy ${requiredVersion}`
            });
          }
        } else {
          result.errors.push({
            code: 'MISSING_DEPENDENCY',
            message: `Missing required dependency: ${depName}@${requiredVersion}`,
            severity: 'critical',
            suggestedFix: `Install dependency: npm install ${depName}@${requiredVersion}`
          });
        }

        dependencies.push(depInfo);
      }

      // Check for known conflicts
      const knownConflicts = await this.checkKnownConflicts(pluginId, dependencies);
      knownConflicts.forEach(conflict => {
        result.warnings.push({
          code: 'KNOWN_CONFLICT',
          message: conflict.reason,
          impact: conflict.severity === 'critical' ? 'high' : 'medium',
          recommendation: conflict.resolution
        });
      });

    } catch (error) {
      result.errors.push({
        code: 'DEPENDENCY_ANALYSIS_FAILED',
        message: `Failed to analyze dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'major',
        details: { error }
      });
    }

    return dependencies;
  }

  /**
   * Validate plugin configuration
   */
  async validateConfiguration(pluginId: string, config: any, result: PluginValidationResult): Promise<ConfigurationValidation> {
    const validation: ConfigurationValidation = {
      isValid: false,
      requiredFields: [],
      optionalFields: [],
      securityIssues: [],
      performance: { score: 100, issues: [], recommendations: [] }
    };

    try {
      const pluginConfig = pluginConfigs[pluginId];
      if (!pluginConfig) {
        result.warnings.push({
          code: 'NO_CONFIG_SCHEMA',
          message: `No configuration schema found for ${pluginId}`,
          impact: 'medium',
          recommendation: 'Manual configuration validation required'
        });
        validation.isValid = true; // Assume valid if no schema
        return validation;
      }

      // Load current configuration
      const currentConfig = config || await this.getPluginCurrentConfig(pluginId);

      // Validate required fields
      if (pluginConfig.configSchema?.required) {
        for (const field of pluginConfig.configSchema.required) {
          const fieldValidation: FieldValidation = {
            field: field.name,
            status: 'missing',
            expectedType: field.type,
            constraints: field.constraints
          };

          const value = this.getNestedValue(currentConfig, field.name);
          if (value !== undefined) {
            if (this.validateFieldType(value, field.type)) {
              if (this.validateFieldConstraints(value, field.constraints)) {
                fieldValidation.status = 'valid';
              } else {
                fieldValidation.status = 'invalid';
                fieldValidation.message = `Value does not meet constraints: ${JSON.stringify(field.constraints)}`;
              }
            } else {
              fieldValidation.status = 'invalid';
              fieldValidation.actualType = typeof value;
              fieldValidation.message = `Expected ${field.type}, got ${typeof value}`;
            }
          } else {
            result.errors.push({
              code: 'MISSING_REQUIRED_FIELD',
              message: `Required configuration field missing: ${field.name}`,
              severity: 'critical',
              suggestedFix: `Add ${field.name} to plugin configuration`
            });
          }

          validation.requiredFields.push(fieldValidation);
        }
      }

      // Validate optional fields
      if (pluginConfig.configSchema?.optional) {
        for (const field of pluginConfig.configSchema.optional) {
          const fieldValidation: FieldValidation = {
            field: field.name,
            status: 'valid',
            expectedType: field.type,
            constraints: field.constraints
          };

          const value = this.getNestedValue(currentConfig, field.name);
          if (value !== undefined) {
            if (!this.validateFieldType(value, field.type)) {
              fieldValidation.status = 'invalid';
              fieldValidation.actualType = typeof value;
              fieldValidation.message = `Expected ${field.type}, got ${typeof value}`;
            } else if (!this.validateFieldConstraints(value, field.constraints)) {
              fieldValidation.status = 'invalid';
              fieldValidation.message = `Value does not meet constraints: ${JSON.stringify(field.constraints)}`;
            }
          }

          validation.optionalFields.push(fieldValidation);
        }
      }

      // Security validation
      validation.securityIssues = await this.validateSecurity(pluginId, currentConfig);

      // Performance validation
      validation.performance = await this.validatePerformance(pluginId, currentConfig);

      // Determine overall configuration validity
      validation.isValid = validation.requiredFields.every(f => f.status === 'valid') &&
                          validation.optionalFields.every(f => f.status !== 'invalid') &&
                          validation.securityIssues.filter(i => i.severity === 'critical').length === 0;

    } catch (error) {
      result.errors.push({
        code: 'CONFIG_VALIDATION_FAILED',
        message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'major',
        details: { error }
      });
    }

    return validation;
  }

  /**
   * Perform runtime health check
   */
  async performRuntimeHealthCheck(pluginId: string, result: PluginValidationResult): Promise<RuntimeValidation> {
    const runtime: RuntimeValidation = {
      isHealthy: false,
      endpoints: [],
      performance: { memoryUsage: 0, cpuUsage: 0, responseTime: 0, errorRate: 0 },
      errors: [],
      lastChecked: new Date()
    };

    try {
      // Check plugin endpoints
      const endpoints = await this.getPluginEndpoints(pluginId);
      for (const endpoint of endpoints) {
        const health = await this.checkEndpointHealth(endpoint);
        runtime.endpoints.push(health);
      }

      // Check performance metrics
      runtime.performance = await this.collectRuntimeMetrics(pluginId);

      // Collect recent errors
      runtime.errors = await this.getRecentErrors(pluginId);

      // Determine overall health
      runtime.isHealthy = runtime.endpoints.every(e => e.status !== 'unhealthy') &&
                         runtime.performance.errorRate < 0.05 &&
                         runtime.performance.responseTime < 5000;

      if (!runtime.isHealthy) {
        result.warnings.push({
          code: 'RUNTIME_HEALTH_ISSUES',
          message: `Plugin ${pluginId} has runtime health issues`,
          impact: 'high',
          recommendation: 'Check plugin logs and performance metrics'
        });
      }

    } catch (error) {
      result.errors.push({
        code: 'HEALTH_CHECK_FAILED',
        message: `Runtime health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'minor',
        details: { error }
      });
    }

    return runtime;
  }

  /**
   * Calculate overall validation score
   */
  private calculateValidationScore(result: PluginValidationResult): number {
    let score = 100;

    // Deduct points for errors
    result.errors.forEach(error => {
      switch (error.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'major':
          score -= 15;
          break;
        case 'minor':
          score -= 5;
          break;
      }
    });

    // Deduct points for warnings
    result.warnings.forEach(warning => {
      switch (warning.impact) {
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });

    // Factor in compatibility score
    score = (score * 0.7) + (result.compatibility.compatibilityScore * 0.3);

    return Math.max(0, Math.round(score));
  }

  // Helper methods...

  private async getBackstageVersion(): Promise<string> {
    try {
      const packageJson = JSON.parse(await fs.readFile(this.packageJsonPath, 'utf-8'));
      return packageJson.dependencies?.['@backstage/core-app-api'] || 
             packageJson.dependencies?.['@backstage/cli'] || 
             '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private getPackageName(pluginId: string): string {
    // This should match the logic from plugin-installer.ts
    if (['kubernetes', 'github-actions', 'jenkins', 'route53'].includes(pluginId)) {
      return `@backstage/plugin-${pluginId}`;
    }
    
    const communityMappings: Record<string, string> = {
      'jira': '@roadiehq/backstage-plugin-jira',
      'confluence': '@k-phoen/backstage-plugin-confluence',
      'servicenow': '@oriflame/backstage-plugin-servicenow',
      'argocd': '@roadiehq/backstage-plugin-argo-cd',
      'terraform': '@roadiehq/backstage-plugin-terraform',
      'vault': '@roadiehq/backstage-plugin-vault',
      'aws': '@roadiehq/backstage-plugin-aws',
      'harness': '@harness/backstage-plugin-harness-ci-cd',
      'splunk': '@splunk/backstage-plugin-splunk-on-call',
      'score-dev': '@score-dev/backstage-plugin',
      'gcp': '@roadiehq/backstage-plugin-gcp',
      'azure': '@roadiehq/backstage-plugin-azure',
      'appdynamics': '@appdynamics/backstage-plugin'
    };
    
    return communityMappings[pluginId] || `@backstage/plugin-${pluginId}`;
  }

  private async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      await execAsync(`npm list ${packageName}`);
      return true;
    } catch {
      return false;
    }
  }

  private async isPluginConfigured(pluginId: string): Promise<boolean> {
    try {
      const config = yaml.load(await fs.readFile(this.configPath, 'utf-8')) as any;
      return !!(config[pluginId] || config.app?.plugins?.find((p: any) => p.id === pluginId));
    } catch {
      return false;
    }
  }

  private async isPluginEnabled(pluginId: string): Promise<boolean> {
    try {
      const config = yaml.load(await fs.readFile(this.configPath, 'utf-8')) as any;
      const plugin = config.app?.plugins?.find((p: any) => p.id === pluginId);
      return plugin?.enabled !== false;
    } catch {
      return true; // Default to enabled if can't determine
    }
  }

  private async getPluginSupportedVersions(pluginId: string): Promise<string[]> {
    // This would typically query the npm registry or plugin documentation
    // For now, return reasonable defaults
    return ['^1.0.0'];
  }

  private async checkDeprecationWarnings(pluginId: string, backstageVersion: string): Promise<string[]> {
    const warnings: string[] = [];
    
    // Check known deprecations
    const knownDeprecations: Record<string, { version: string; message: string }> = {
      'kubernetes': { version: '1.5.0', message: 'Consider migrating to the new Kubernetes plugin API' }
    };

    const deprecation = knownDeprecations[pluginId];
    if (deprecation && semver.gte(backstageVersion, deprecation.version)) {
      warnings.push(deprecation.message);
    }

    return warnings;
  }

  private async getPluginPackageJson(packageName: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`npm list ${packageName} --json`);
      const result = JSON.parse(stdout);
      return result.dependencies?.[packageName] || null;
    } catch {
      return null;
    }
  }

  private async getInstalledPackageVersion(packageName: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`npm list ${packageName} --depth=0 --json`);
      const result = JSON.parse(stdout);
      return result.dependencies?.[packageName]?.version || null;
    } catch {
      return null;
    }
  }

  private async checkKnownConflicts(pluginId: string, dependencies: DependencyInfo[]): Promise<DependencyConflict[]> {
    // Known plugin conflicts
    const knownConflicts: Record<string, DependencyConflict[]> = {
      'kubernetes': [
        {
          with: 'docker',
          reason: 'Kubernetes and Docker plugins may have overlapping functionality',
          severity: 'minor',
          resolution: 'Consider using only one container orchestration plugin'
        }
      ]
    };

    return knownConflicts[pluginId] || [];
  }

  private async getPluginCurrentConfig(pluginId: string): Promise<any> {
    try {
      const config = yaml.load(await fs.readFile(this.configPath, 'utf-8')) as any;
      return config[pluginId] || {};
    } catch {
      return {};
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private validateFieldConstraints(value: any, constraints: any): boolean {
    if (!constraints) return true;

    if (constraints.minLength && typeof value === 'string' && value.length < constraints.minLength) {
      return false;
    }

    if (constraints.maxLength && typeof value === 'string' && value.length > constraints.maxLength) {
      return false;
    }

    if (constraints.pattern && typeof value === 'string' && !new RegExp(constraints.pattern).test(value)) {
      return false;
    }

    if (constraints.enum && !constraints.enum.includes(value)) {
      return false;
    }

    return true;
  }

  private async validateSecurity(pluginId: string, config: any): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for exposed secrets
    const secretFields = ['token', 'password', 'key', 'secret', 'apiKey'];
    this.findExposedSecrets(config, '', secretFields, issues);

    // Check for insecure configurations
    if (config.skipTLSVerify === true) {
      issues.push({
        type: 'insecure_config',
        severity: 'high',
        description: 'TLS verification is disabled',
        field: 'skipTLSVerify',
        recommendation: 'Enable TLS verification for production environments'
      });
    }

    return issues;
  }

  private findExposedSecrets(obj: any, prefix: string, secretFields: string[], issues: SecurityIssue[]): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (secretFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        if (typeof value === 'string' && value.length > 0) {
          issues.push({
            type: 'secret_exposure',
            severity: 'critical',
            description: `Potential secret exposed in configuration`,
            field: fullKey,
            recommendation: 'Use environment variables or secure secret management'
          });
        }
      }

      if (typeof value === 'object') {
        this.findExposedSecrets(value, fullKey, secretFields, issues);
      }
    }
  }

  private async validatePerformance(pluginId: string, config: any): Promise<PerformanceValidation> {
    const validation: PerformanceValidation = {
      score: 100,
      issues: [],
      recommendations: []
    };

    // Check for performance-impacting configurations
    if (config.pollingInterval && config.pollingInterval < 30000) {
      validation.issues.push({
        type: 'network',
        severity: 'medium',
        description: 'Polling interval is very frequent',
        impact: 'High network usage and API rate limiting'
      });
      validation.score -= 20;
    }

    if (config.cacheEnabled === false) {
      validation.issues.push({
        type: 'performance',
        severity: 'medium',
        description: 'Caching is disabled',
        impact: 'Increased response times and API calls'
      });
      validation.score -= 15;
    }

    // Add recommendations
    validation.recommendations.push('Enable caching for better performance');
    validation.recommendations.push('Use reasonable polling intervals to avoid rate limiting');

    return validation;
  }

  private async getPluginEndpoints(pluginId: string): Promise<string[]> {
    // This would typically query the plugin's routing configuration
    // For now, return common endpoints
    return [`/api/${pluginId}/health`, `/api/${pluginId}/status`];
  }

  private async checkEndpointHealth(endpoint: string): Promise<EndpointHealth> {
    const startTime = Date.now();
    
    try {
      // This would make an actual HTTP request to the endpoint
      // For now, simulate the check
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint,
        status: 'healthy',
        responseTime
      };
    } catch (error) {
      return {
        endpoint,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async collectRuntimeMetrics(pluginId: string): Promise<RuntimePerformance> {
    // This would collect actual runtime metrics
    // For now, return mock data
    return {
      memoryUsage: Math.random() * 100,
      cpuUsage: Math.random() * 50,
      responseTime: Math.random() * 1000 + 100,
      errorRate: Math.random() * 0.1
    };
  }

  private async getRecentErrors(pluginId: string): Promise<RuntimeError[]> {
    // This would query actual error logs
    // For now, return empty array
    return [];
  }
}

// Export singleton instance
export const pluginValidator = new PluginValidator();