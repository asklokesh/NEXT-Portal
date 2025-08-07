/**
 * Plugin Compatibility Checker
 * 
 * Comprehensive compatibility validation system for Backstage plugins.
 * Checks Backstage version compatibility, Node.js requirements, OS compatibility,
 * resource requirements, and performance impact assessment.
 */

import semver from 'semver';
import { Plugin, CompatibilityReport, CompatibilityRule, SystemRequirements } from './types';

export interface CompatibilityMatrix {
  backstageVersions: string[];
  nodeVersions: string[];
  operatingSystems: string[];
  pluginCompatibility: Map<string, Map<string, boolean>>;
  performanceMetrics: Map<string, PerformanceMetrics>;
}

export interface PerformanceMetrics {
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  bundleSize: number; // KB
  startupTime: number; // ms
  loadTime: number; // ms
  impactScore: number; // 1-10 scale
}

export interface CompatibilityIssue {
  type: 'version' | 'system' | 'resource' | 'performance' | 'plugin';
  severity: 'critical' | 'warning' | 'info';
  component: string;
  issue: string;
  currentValue?: string;
  requiredValue?: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface SystemInfo {
  nodeVersion: string;
  npmVersion: string;
  operatingSystem: string;
  architecture: string;
  availableMemory: number;
  cpuCores: number;
  backstageVersion: string;
  installedPlugins: string[];
}

export interface ResourceRequirement {
  minMemory: number;
  recommendedMemory: number;
  minCpu: number;
  recommendedCpu: number;
  diskSpace: number;
  networkBandwidth?: number;
}

export class CompatibilityChecker {
  private matrix: CompatibilityMatrix;
  private systemInfo: SystemInfo;
  private compatibilityRules: Map<string, CompatibilityRule[]> = new Map();

  constructor(systemInfo?: Partial<SystemInfo>) {
    this.systemInfo = this.initializeSystemInfo(systemInfo);
    this.matrix = this.initializeCompatibilityMatrix();
    this.loadCompatibilityRules();
  }

  /**
   * Initialize system information
   */
  private initializeSystemInfo(info?: Partial<SystemInfo>): SystemInfo {
    return {
      nodeVersion: info?.nodeVersion || process.version,
      npmVersion: info?.npmVersion || '9.0.0', // Default fallback
      operatingSystem: info?.operatingSystem || process.platform,
      architecture: info?.architecture || process.arch,
      availableMemory: info?.availableMemory || 8192, // Default 8GB
      cpuCores: info?.cpuCores || 4,
      backstageVersion: info?.backstageVersion || '1.0.0',
      installedPlugins: info?.installedPlugins || []
    };
  }

  /**
   * Initialize compatibility matrix
   */
  private initializeCompatibilityMatrix(): CompatibilityMatrix {
    return {
      backstageVersions: [
        '0.4.x', '1.0.x', '1.1.x', '1.2.x', '1.3.x', '1.4.x', '1.5.x',
        '1.6.x', '1.7.x', '1.8.x', '1.9.x', '1.10.x', '1.11.x', '1.12.x'
      ],
      nodeVersions: ['16.x', '18.x', '20.x', '21.x'],
      operatingSystems: ['linux', 'darwin', 'win32'],
      pluginCompatibility: new Map(),
      performanceMetrics: new Map()
    };
  }

  /**
   * Load compatibility rules from various sources
   */
  private loadCompatibilityRules(): void {
    // Backstage version compatibility rules
    this.compatibilityRules.set('backstage', [
      {
        id: 'backstage-major-version',
        name: 'Backstage Major Version',
        condition: (plugin: Plugin) => {
          const pluginBackstageVersion = plugin.backstageVersion || '1.0.0';
          const currentMajor = semver.major(this.systemInfo.backstageVersion);
          const requiredMajor = semver.major(pluginBackstageVersion);
          return currentMajor === requiredMajor;
        },
        severity: 'critical',
        message: 'Plugin requires different major version of Backstage'
      },
      {
        id: 'backstage-minor-version',
        name: 'Backstage Minor Version',
        condition: (plugin: Plugin) => {
          const pluginBackstageVersion = plugin.backstageVersion || '1.0.0';
          return semver.gte(this.systemInfo.backstageVersion, pluginBackstageVersion);
        },
        severity: 'warning',
        message: 'Plugin requires newer version of Backstage'
      }
    ]);

    // Node.js compatibility rules
    this.compatibilityRules.set('nodejs', [
      {
        id: 'node-minimum-version',
        name: 'Node.js Minimum Version',
        condition: (plugin: Plugin) => {
          const minNodeVersion = plugin.requirements?.nodeVersion || '16.0.0';
          return semver.gte(this.systemInfo.nodeVersion, minNodeVersion);
        },
        severity: 'critical',
        message: 'Plugin requires newer version of Node.js'
      },
      {
        id: 'node-lts-support',
        name: 'Node.js LTS Support',
        condition: (plugin: Plugin) => {
          const majorVersion = semver.major(this.systemInfo.nodeVersion);
          return [16, 18, 20].includes(majorVersion);
        },
        severity: 'warning',
        message: 'Consider using Node.js LTS version for better stability'
      }
    ]);

    // System requirements rules
    this.compatibilityRules.set('system', [
      {
        id: 'memory-requirement',
        name: 'Memory Requirement',
        condition: (plugin: Plugin) => {
          const requiredMemory = plugin.requirements?.memory || 512;
          return this.systemInfo.availableMemory >= requiredMemory;
        },
        severity: 'warning',
        message: 'Plugin may require more memory than available'
      },
      {
        id: 'cpu-requirement',
        name: 'CPU Requirement',
        condition: (plugin: Plugin) => {
          const requiredCores = plugin.requirements?.cpu || 1;
          return this.systemInfo.cpuCores >= requiredCores;
        },
        severity: 'warning',
        message: 'Plugin may require more CPU cores for optimal performance'
      }
    ]);
  }

  /**
   * Check comprehensive compatibility for a plugin
   */
  async checkPluginCompatibility(plugin: Plugin): Promise<CompatibilityReport> {
    const startTime = Date.now();
    const issues: CompatibilityIssue[] = [];
    const warnings: string[] = [];

    // Check Backstage version compatibility
    await this.checkBackstageCompatibility(plugin, issues);

    // Check Node.js compatibility
    await this.checkNodeJsCompatibility(plugin, issues);

    // Check system requirements
    await this.checkSystemRequirements(plugin, issues);

    // Check plugin-to-plugin compatibility
    await this.checkPluginInteroperability(plugin, issues);

    // Check operating system compatibility
    await this.checkOperatingSystemCompatibility(plugin, issues);

    // Assess performance impact
    const performanceAssessment = await this.assessPerformanceImpact(plugin);

    // Check resource requirements
    await this.checkResourceRequirements(plugin, issues);

    // Apply custom compatibility rules
    await this.applyCompatibilityRules(plugin, issues);

    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const compatible = criticalIssues.length === 0;

    return {
      pluginId: plugin.id,
      compatible,
      issues,
      warnings,
      performanceImpact: performanceAssessment,
      recommendations: this.generateRecommendations(plugin, issues),
      checkTime: Date.now() - startTime,
      systemInfo: { ...this.systemInfo }
    };
  }

  /**
   * Check Backstage version compatibility
   */
  private async checkBackstageCompatibility(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    const pluginBackstageVersion = plugin.backstageVersion;
    if (!pluginBackstageVersion) {
      issues.push({
        type: 'version',
        severity: 'warning',
        component: 'Backstage',
        issue: 'Plugin does not specify Backstage version requirement',
        suggestion: 'Contact plugin maintainer to clarify Backstage compatibility',
        autoFixable: false
      });
      return;
    }

    // Check if current Backstage version satisfies plugin requirements
    if (!semver.satisfies(this.systemInfo.backstageVersion, pluginBackstageVersion)) {
      const severity = this.getVersionIncompatibilitySeverity(
        this.systemInfo.backstageVersion,
        pluginBackstageVersion
      );

      issues.push({
        type: 'version',
        severity,
        component: 'Backstage',
        issue: 'Backstage version incompatibility',
        currentValue: this.systemInfo.backstageVersion,
        requiredValue: pluginBackstageVersion,
        suggestion: severity === 'critical' 
          ? `Upgrade Backstage to version ${pluginBackstageVersion}`
          : 'Plugin may work but compatibility is not guaranteed',
        autoFixable: false
      });
    }

    // Check for deprecated Backstage APIs
    await this.checkDeprecatedApis(plugin, issues);
  }

  /**
   * Check Node.js compatibility
   */
  private async checkNodeJsCompatibility(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    const requiredNodeVersion = plugin.requirements?.nodeVersion;
    if (!requiredNodeVersion) return;

    if (!semver.satisfies(this.systemInfo.nodeVersion, requiredNodeVersion)) {
      issues.push({
        type: 'system',
        severity: 'critical',
        component: 'Node.js',
        issue: 'Node.js version incompatibility',
        currentValue: this.systemInfo.nodeVersion,
        requiredValue: requiredNodeVersion,
        suggestion: `Upgrade Node.js to version ${requiredNodeVersion}`,
        autoFixable: false
      });
    }

    // Check for Node.js features used by plugin
    await this.checkNodeJsFeatures(plugin, issues);
  }

  /**
   * Check system requirements
   */
  private async checkSystemRequirements(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    const requirements = plugin.requirements;
    if (!requirements) return;

    // Memory check
    if (requirements.memory && this.systemInfo.availableMemory < requirements.memory) {
      issues.push({
        type: 'resource',
        severity: 'warning',
        component: 'Memory',
        issue: 'Insufficient memory for optimal performance',
        currentValue: `${this.systemInfo.availableMemory}MB`,
        requiredValue: `${requirements.memory}MB`,
        suggestion: 'Consider increasing available memory or closing other applications',
        autoFixable: false
      });
    }

    // CPU check
    if (requirements.cpu && this.systemInfo.cpuCores < requirements.cpu) {
      issues.push({
        type: 'resource',
        severity: 'warning',
        component: 'CPU',
        issue: 'Insufficient CPU cores for optimal performance',
        currentValue: `${this.systemInfo.cpuCores} cores`,
        requiredValue: `${requirements.cpu} cores`,
        suggestion: 'Plugin may run slower than expected',
        autoFixable: false
      });
    }
  }

  /**
   * Check plugin-to-plugin compatibility
   */
  private async checkPluginInteroperability(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    // Check for conflicting plugins
    if (plugin.incompatibleWith) {
      for (const incompatiblePluginId of plugin.incompatibleWith) {
        if (this.systemInfo.installedPlugins.includes(incompatiblePluginId)) {
          issues.push({
            type: 'plugin',
            severity: 'critical',
            component: 'Plugin Compatibility',
            issue: `Plugin conflicts with installed plugin: ${incompatiblePluginId}`,
            suggestion: `Remove ${incompatiblePluginId} before installing this plugin`,
            autoFixable: false
          });
        }
      }
    }

    // Check plugin dependencies compatibility
    if (plugin.dependencies) {
      for (const dependency of plugin.dependencies) {
        const isInstalled = this.systemInfo.installedPlugins.includes(dependency.id);
        if (!isInstalled && !dependency.optional) {
          issues.push({
            type: 'plugin',
            severity: 'critical',
            component: 'Dependencies',
            issue: `Required dependency not installed: ${dependency.id}`,
            suggestion: `Install ${dependency.id} before installing this plugin`,
            autoFixable: true
          });
        }
      }
    }
  }

  /**
   * Check operating system compatibility
   */
  private async checkOperatingSystemCompatibility(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    const supportedOS = plugin.requirements?.operatingSystem;
    if (!supportedOS) return;

    const currentOS = this.systemInfo.operatingSystem;
    if (!supportedOS.includes(currentOS)) {
      issues.push({
        type: 'system',
        severity: 'critical',
        component: 'Operating System',
        issue: `Plugin not supported on ${currentOS}`,
        currentValue: currentOS,
        requiredValue: supportedOS.join(' or '),
        suggestion: 'Use a supported operating system or find an alternative plugin',
        autoFixable: false
      });
    }
  }

  /**
   * Assess performance impact
   */
  private async assessPerformanceImpact(plugin: Plugin): Promise<PerformanceMetrics> {
    // This would integrate with actual performance monitoring
    // For now, we'll provide estimated metrics based on plugin metadata
    
    const baseMetrics: PerformanceMetrics = {
      memoryUsage: 50, // MB
      cpuUsage: 5, // percentage
      bundleSize: 100, // KB
      startupTime: 200, // ms
      loadTime: 100, // ms
      impactScore: 3 // 1-10 scale
    };

    // Adjust metrics based on plugin characteristics
    if (plugin.type === 'frontend') {
      baseMetrics.bundleSize += 200;
      baseMetrics.loadTime += 100;
    }

    if (plugin.type === 'backend') {
      baseMetrics.memoryUsage += 100;
      baseMetrics.cpuUsage += 10;
      baseMetrics.startupTime += 300;
    }

    // Check if plugin has heavy dependencies
    const heavyDependencies = ['react-virtualized', 'monaco-editor', 'three.js', 'd3'];
    const pluginDeps = plugin.dependencies?.map(d => d.id) || [];
    const hasHeavyDeps = heavyDependencies.some(dep => 
      pluginDeps.some(pluginDep => pluginDep.includes(dep))
    );

    if (hasHeavyDeps) {
      baseMetrics.bundleSize += 500;
      baseMetrics.loadTime += 300;
      baseMetrics.impactScore += 2;
    }

    // Store in performance metrics cache
    this.matrix.performanceMetrics.set(plugin.id, baseMetrics);

    return baseMetrics;
  }

  /**
   * Check resource requirements
   */
  private async checkResourceRequirements(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    const requirements = plugin.requirements;
    if (!requirements) return;

    // Check disk space requirements
    if (requirements.diskSpace) {
      // This would check actual available disk space
      // For now, we'll assume it's available
    }

    // Check network requirements
    if (requirements.networkAccess) {
      // This would check network connectivity and firewall rules
      // For now, we'll assume network is available
    }
  }

  /**
   * Apply custom compatibility rules
   */
  private async applyCompatibilityRules(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    for (const [category, rules] of this.compatibilityRules.entries()) {
      for (const rule of rules) {
        if (!rule.condition(plugin)) {
          issues.push({
            type: category === 'nodejs' ? 'system' : 'version',
            severity: rule.severity,
            component: rule.name,
            issue: rule.message,
            suggestion: this.generateRuleSuggestion(rule, plugin),
            autoFixable: false
          });
        }
      }
    }
  }

  /**
   * Check for deprecated Backstage APIs
   */
  private async checkDeprecatedApis(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    // This would analyze plugin code for deprecated API usage
    // For now, we'll check against known deprecated patterns
    
    const deprecatedApis = [
      '@backstage/core',
      '@backstage/core-components/alpha',
      '@backstage/theme'
    ];

    // This would require actual code analysis
    // For demonstration, we'll check plugin dependencies
    const pluginDeps = plugin.dependencies?.map(d => d.id) || [];
    for (const deprecatedApi of deprecatedApis) {
      if (pluginDeps.includes(deprecatedApi)) {
        issues.push({
          type: 'version',
          severity: 'warning',
          component: 'API Usage',
          issue: `Plugin uses deprecated API: ${deprecatedApi}`,
          suggestion: 'Update plugin to use current Backstage APIs',
          autoFixable: false
        });
      }
    }
  }

  /**
   * Check Node.js features used by plugin
   */
  private async checkNodeJsFeatures(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): Promise<void> {
    // Check for specific Node.js features that might not be available
    const nodeFeatures = plugin.requirements?.nodeFeatures || [];
    
    for (const feature of nodeFeatures) {
      if (!this.isNodeFeatureAvailable(feature)) {
        issues.push({
          type: 'system',
          severity: 'critical',
          component: 'Node.js Features',
          issue: `Plugin requires Node.js feature not available: ${feature}`,
          suggestion: `Upgrade Node.js or use a build with ${feature} support`,
          autoFixable: false
        });
      }
    }
  }

  /**
   * Helper methods
   */
  private getVersionIncompatibilitySeverity(
    current: string,
    required: string
  ): 'critical' | 'warning' | 'info' {
    const currentMajor = semver.major(current);
    const requiredMajor = semver.major(required);
    
    if (currentMajor !== requiredMajor) {
      return 'critical';
    }
    
    const currentMinor = semver.minor(current);
    const requiredMinor = semver.minor(required);
    
    if (Math.abs(currentMinor - requiredMinor) > 2) {
      return 'warning';
    }
    
    return 'info';
  }

  private generateRuleSuggestion(rule: CompatibilityRule, plugin: Plugin): string {
    switch (rule.id) {
      case 'backstage-major-version':
        return `Upgrade Backstage to version compatible with ${plugin.backstageVersion}`;
      case 'node-minimum-version':
        return `Upgrade Node.js to version ${plugin.requirements?.nodeVersion || '18.0.0'}`;
      default:
        return 'Review plugin requirements and system configuration';
    }
  }

  private generateRecommendations(
    plugin: Plugin,
    issues: CompatibilityIssue[]
  ): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warningIssues = issues.filter(i => i.severity === 'warning');
    
    if (criticalIssues.length > 0) {
      recommendations.push('Resolve critical compatibility issues before installation');
      recommendations.push('Consider using alternative plugins with better compatibility');
    }
    
    if (warningIssues.length > 0) {
      recommendations.push('Review warning issues for potential runtime problems');
      recommendations.push('Test plugin thoroughly in development environment');
    }
    
    const performanceMetrics = this.matrix.performanceMetrics.get(plugin.id);
    if (performanceMetrics && performanceMetrics.impactScore > 7) {
      recommendations.push('Plugin has high performance impact - monitor system resources');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Plugin appears to be fully compatible with your system');
    }
    
    return recommendations;
  }

  private isNodeFeatureAvailable(feature: string): boolean {
    // Check for specific Node.js features
    const nodeVersion = semver.parse(this.systemInfo.nodeVersion);
    if (!nodeVersion) return false;
    
    switch (feature) {
      case 'async_hooks':
        return nodeVersion.major >= 8;
      case 'worker_threads':
        return nodeVersion.major >= 10 || (nodeVersion.major === 10 && nodeVersion.minor >= 5);
      case 'import_meta':
        return nodeVersion.major >= 13 || (nodeVersion.major === 12 && nodeVersion.minor >= 20);
      default:
        return true; // Assume feature is available if not explicitly checked
    }
  }

  /**
   * Public API methods
   */

  /**
   * Batch check multiple plugins
   */
  async checkMultiplePlugins(plugins: Plugin[]): Promise<CompatibilityReport[]> {
    const reports: CompatibilityReport[] = [];
    
    for (const plugin of plugins) {
      const report = await this.checkPluginCompatibility(plugin);
      reports.push(report);
    }
    
    return reports;
  }

  /**
   * Update system information
   */
  updateSystemInfo(info: Partial<SystemInfo>): void {
    this.systemInfo = { ...this.systemInfo, ...info };
  }

  /**
   * Get compatibility matrix
   */
  getCompatibilityMatrix(): CompatibilityMatrix {
    return { ...this.matrix };
  }

  /**
   * Add custom compatibility rule
   */
  addCompatibilityRule(category: string, rule: CompatibilityRule): void {
    if (!this.compatibilityRules.has(category)) {
      this.compatibilityRules.set(category, []);
    }
    this.compatibilityRules.get(category)!.push(rule);
  }

  /**
   * Get system compatibility summary
   */
  getSystemCompatibilitySummary(): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    recommendations: string[];
  } {
    const issues: CompatibilityIssue[] = [];
    
    // Check overall system health
    if (semver.lt(this.systemInfo.nodeVersion, '16.0.0')) {
      issues.push({
        type: 'system',
        severity: 'critical',
        component: 'Node.js',
        issue: 'Node.js version is too old',
        currentValue: this.systemInfo.nodeVersion,
        requiredValue: '>=16.0.0',
        suggestion: 'Upgrade to Node.js 16 or later',
        autoFixable: false
      });
    }
    
    if (this.systemInfo.availableMemory < 4096) {
      issues.push({
        type: 'resource',
        severity: 'warning',
        component: 'Memory',
        issue: 'Low available memory',
        currentValue: `${this.systemInfo.availableMemory}MB`,
        requiredValue: '>=4096MB',
        suggestion: 'Consider increasing system memory for better performance',
        autoFixable: false
      });
    }
    
    return {
      compatible: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      recommendations: this.generateSystemRecommendations(issues)
    };
  }

  private generateSystemRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.some(i => i.component === 'Node.js')) {
      recommendations.push('Upgrade Node.js to the latest LTS version');
    }
    
    if (issues.some(i => i.component === 'Memory')) {
      recommendations.push('Increase system memory or close unnecessary applications');
    }
    
    if (issues.length === 0) {
      recommendations.push('System meets minimum requirements for plugin installation');
    }
    
    return recommendations;
  }
}

export default CompatibilityChecker;