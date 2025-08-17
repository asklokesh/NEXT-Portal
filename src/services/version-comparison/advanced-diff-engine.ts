import { EventEmitter } from 'events';
import { prisma } from '@/lib/db/client';
import * as diff from 'diff';

interface VersionComparison {
  fromVersion: string;
  toVersion: string;
  pluginId: string;
  comparisonType: 'upgrade' | 'downgrade' | 'sidegrade';
  overallImpact: 'low' | 'medium' | 'high' | 'critical';
  breakingChanges: BreakingChange[];
  apiChanges: ApiChange[];
  configChanges: ConfigurationChange[];
  dependencyChanges: DependencyChange[];
  performanceChanges: PerformanceChange[];
  migrationPath: MigrationStep[];
  migrationComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedMigrationTime: number; // hours
  rollbackComplexity: 'easy' | 'moderate' | 'difficult';
  testingRequirements: TestingRequirement[];
  riskAssessment: VersionRiskAssessment;
}

interface BreakingChange {
  type: 'api_removal' | 'api_signature' | 'config_format' | 'dependency_major' | 'data_structure' | 'behavior';
  category: 'public_api' | 'configuration' | 'data_model' | 'behavior' | 'integration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  affectedComponents: string[];
  migrationGuide: string;
  codeExamples: {
    before: string;
    after: string;
    explanation?: string;
  };
  automationPossible: boolean;
  deprecationWarning?: {
    introducedIn: string;
    removedIn: string;
    warningPeriod: number; // versions
  };
}

interface ApiChange {
  endpoint?: string;
  method?: string;
  function?: string;
  class?: string;
  changeType: 'added' | 'removed' | 'modified' | 'deprecated';
  parameters?: ParameterChange[];
  returnType?: TypeChange;
  documentation?: string;
  examples?: { before?: string; after?: string };
}

interface ParameterChange {
  name: string;
  changeType: 'added' | 'removed' | 'modified' | 'type_changed';
  required: boolean;
  defaultValue?: any;
  newType?: string;
  oldType?: string;
}

interface TypeChange {
  from: string;
  to: string;
  isBreaking: boolean;
  migrationHint?: string;
}

interface ConfigurationChange {
  configKey: string;
  changeType: 'added' | 'removed' | 'modified' | 'deprecated' | 'moved';
  oldValue?: any;
  newValue?: any;
  newLocation?: string;
  isRequired: boolean;
  migrationScript?: string;
  validationRules?: string[];
}

interface DependencyChange {
  dependency: string;
  changeType: 'added' | 'removed' | 'upgraded' | 'downgraded';
  fromVersion?: string;
  toVersion?: string;
  reason: string;
  impact: 'low' | 'medium' | 'high';
  securityImplications?: SecurityImplication[];
  breakingChangesInDependency?: string[];
}

interface SecurityImplication {
  type: 'vulnerability_fix' | 'new_vulnerability' | 'permission_change' | 'security_enhancement';
  cveId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface PerformanceChange {
  metric: 'memory_usage' | 'cpu_usage' | 'startup_time' | 'response_time' | 'throughput';
  changeType: 'improvement' | 'regression' | 'no_change';
  percentageChange: number;
  absoluteChange: number;
  unit: string;
  benchmark: {
    environment: string;
    testCase: string;
    confidence: number;
  };
}

interface MigrationStep {
  step: number;
  title: string;
  description: string;
  type: 'code_change' | 'config_update' | 'data_migration' | 'dependency_update' | 'manual_verification';
  automatable: boolean;
  estimatedTime: number; // minutes
  prerequisites: string[];
  commands?: string[];
  codeChanges?: {
    file: string;
    changes: string;
  }[];
  validationSteps: string[];
  rollbackSteps: string[];
}

interface TestingRequirement {
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'compatibility';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedTime: number; // minutes
  automatable: boolean;
  testCases: string[];
}

interface VersionRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  rollbackPlan: RollbackStep[];
  recommendedApproach: 'immediate' | 'staged' | 'delayed' | 'skip_version';
}

interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
  impact: string;
}

interface RollbackStep {
  step: number;
  action: string;
  timeRequired: number; // minutes
  complexity: 'easy' | 'moderate' | 'difficult';
  dataLossRisk: boolean;
}

interface ChangelogAnalysis {
  pluginId: string;
  version: string;
  publishDate: Date;
  changelog: string;
  parsedChanges: ParsedChange[];
  sentiment: 'positive' | 'neutral' | 'negative';
  changelogQuality: 'excellent' | 'good' | 'fair' | 'poor';
  migrationGuidance: string;
}

interface ParsedChange {
  category: 'feature' | 'bugfix' | 'breaking' | 'deprecation' | 'security' | 'performance' | 'documentation';
  description: string;
  impact: 'low' | 'medium' | 'high';
  userFacing: boolean;
  developerFacing: boolean;
  references?: {
    issueNumbers: string[];
    pullRequests: string[];
    commitHashes: string[];
  };
}

export class AdvancedDiffEngine extends EventEmitter {
  private changelogCache: Map<string, ChangelogAnalysis[]> = new Map();
  private comparisonCache: Map<string, VersionComparison> = new Map();
  private migrationTemplates: Map<string, any> = new Map();
  private breakingChangePatterns: RegExp[] = [];
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize() {
    console.log('Initializing Advanced Diff Engine...');
    try {
      await this.loadMigrationTemplates();
      await this.initializeBreakingChangePatterns();
      await this.warmupCache();
      this.isInitialized = true;
      console.log('Advanced Diff Engine initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize diff engine:', error);
      this.emit('initialization_error', error);
    }
  }

  private async loadMigrationTemplates() {
    // Load common migration patterns and templates
    this.migrationTemplates.set('dependency_upgrade', {
      template: `
# Dependency Upgrade Migration
## From: {{fromVersion}}
## To: {{toVersion}}

### Steps:
1. Update package.json
2. Install new dependencies
3. Update import statements if needed
4. Run tests
5. Update configuration if required

### Code Changes:
{{#codeChanges}}
- {{file}}: {{description}}
{{/codeChanges}}
      `,
      estimatedTime: 30,
      complexity: 'simple'
    });

    this.migrationTemplates.set('breaking_api_change', {
      template: `
# API Breaking Change Migration
## Affected API: {{apiName}}
## Change Type: {{changeType}}

### Migration Steps:
1. Identify all usage of deprecated API
2. Update function calls/imports
3. Test functionality
4. Update error handling if needed

### Before:
\`\`\`typescript
{{beforeCode}}
\`\`\`

### After:
\`\`\`typescript
{{afterCode}}
\`\`\`
      `,
      estimatedTime: 60,
      complexity: 'moderate'
    });

    console.log('Migration templates loaded');
  }

  private async initializeBreakingChangePatterns() {
    this.breakingChangePatterns = [
      /BREAKING\s*CHANGE/i,
      /breaking\s*:/i,
      /removed\s+API/i,
      /no\s+longer\s+supported/i,
      /deprecated\s+and\s+removed/i,
      /incompatible\s+with/i,
      /major\s+version/i,
      /migration\s+required/i
    ];

    console.log('Breaking change patterns initialized');
  }

  private async warmupCache() {
    // Pre-load commonly compared plugin versions
    const popularPlugins = await prisma.plugin.findMany({
      orderBy: { downloadCount: 'desc' },
      take: 50,
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    let cacheCount = 0;
    for (const plugin of popularPlugins) {
      const analyses = await this.analyzeAllVersionChangelogs(plugin.id);
      this.changelogCache.set(plugin.id, analyses);
      cacheCount++;
    }

    console.log(`Warmed up cache with ${cacheCount} plugins`);
  }

  async compareVersions(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<VersionComparison> {
    if (!this.isInitialized) {
      throw new Error('Diff engine not initialized');
    }

    const cacheKey = `${pluginId}:${fromVersion}:${toVersion}`;
    
    if (this.comparisonCache.has(cacheKey)) {
      return this.comparisonCache.get(cacheKey)!;
    }

    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        versions: {
          where: {
            version: { in: [fromVersion, toVersion] }
          },
          include: {
            dependencies: true,
            vulnerabilities: true,
            performance: true
          }
        }
      }
    });

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const fromVersionData = plugin.versions.find(v => v.version === fromVersion);
    const toVersionData = plugin.versions.find(v => v.version === toVersion);

    if (!fromVersionData || !toVersionData) {
      throw new Error(`Version data not found for ${fromVersion} or ${toVersion}`);
    }

    const comparison = await this.performVersionComparison(
      plugin,
      fromVersionData,
      toVersionData
    );

    this.comparisonCache.set(cacheKey, comparison);
    return comparison;
  }

  private async performVersionComparison(
    plugin: any,
    fromVersion: any,
    toVersion: any
  ): Promise<VersionComparison> {
    const comparisonType = this.determineComparisonType(fromVersion.version, toVersion.version);
    
    // Analyze different aspects of the version change
    const [
      breakingChanges,
      apiChanges,
      configChanges,
      dependencyChanges,
      performanceChanges
    ] = await Promise.all([
      this.analyzeBreakingChanges(plugin, fromVersion, toVersion),
      this.analyzeApiChanges(plugin, fromVersion, toVersion),
      this.analyzeConfigChanges(plugin, fromVersion, toVersion),
      this.analyzeDependencyChanges(fromVersion, toVersion),
      this.analyzePerformanceChanges(fromVersion, toVersion)
    ]);

    const migrationPath = await this.generateMigrationPath(
      plugin,
      fromVersion,
      toVersion,
      breakingChanges,
      apiChanges,
      configChanges,
      dependencyChanges
    );

    const migrationComplexity = this.calculateMigrationComplexity(
      breakingChanges,
      apiChanges,
      configChanges,
      dependencyChanges
    );

    const estimatedMigrationTime = this.estimateMigrationTime(migrationPath);
    const rollbackComplexity = this.assessRollbackComplexity(migrationPath);
    const testingRequirements = this.generateTestingRequirements(breakingChanges, apiChanges);
    const riskAssessment = this.assessVersionRisk(
      breakingChanges,
      dependencyChanges,
      migrationComplexity
    );

    const overallImpact = this.calculateOverallImpact(
      breakingChanges,
      apiChanges,
      configChanges,
      dependencyChanges,
      performanceChanges
    );

    return {
      fromVersion: fromVersion.version,
      toVersion: toVersion.version,
      pluginId: plugin.id,
      comparisonType,
      overallImpact,
      breakingChanges,
      apiChanges,
      configChanges,
      dependencyChanges,
      performanceChanges,
      migrationPath,
      migrationComplexity,
      estimatedMigrationTime,
      rollbackComplexity,
      testingRequirements,
      riskAssessment
    };
  }

  private determineComparisonType(fromVersion: string, toVersion: string): 'upgrade' | 'downgrade' | 'sidegrade' {
    const fromParts = fromVersion.split('.').map(Number);
    const toParts = toVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(fromParts.length, toParts.length); i++) {
      const fromPart = fromParts[i] || 0;
      const toPart = toParts[i] || 0;

      if (toPart > fromPart) return 'upgrade';
      if (toPart < fromPart) return 'downgrade';
    }

    return 'sidegrade';
  }

  private async analyzeBreakingChanges(
    plugin: any,
    fromVersion: any,
    toVersion: any
  ): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];
    
    // Analyze changelog for breaking changes
    const changelogAnalysis = await this.analyzeChangelog(plugin.id, toVersion.version);
    const breakingChangelogItems = changelogAnalysis.parsedChanges.filter(
      change => change.category === 'breaking'
    );

    for (const change of breakingChangelogItems) {
      breakingChanges.push({
        type: this.categorizeBreakingChangeType(change.description),
        category: 'public_api',
        severity: change.impact as any,
        description: change.description,
        impact: this.describeBreakingChangeImpact(change.description),
        affectedComponents: this.extractAffectedComponents(change.description),
        migrationGuide: await this.generateMigrationGuide(change),
        codeExamples: await this.generateCodeExamples(change),
        automationPossible: this.assessAutomationPossibility(change),
        deprecationWarning: this.extractDeprecationInfo(change)
      });
    }

    // Analyze API changes for breaking changes
    const apiBreakingChanges = await this.findApiBreakingChanges(fromVersion, toVersion);
    breakingChanges.push(...apiBreakingChanges);

    return breakingChanges;
  }

  private categorizeBreakingChangeType(description: string): BreakingChange['type'] {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('remove') && lowerDesc.includes('api')) return 'api_removal';
    if (lowerDesc.includes('signature') || lowerDesc.includes('parameter')) return 'api_signature';
    if (lowerDesc.includes('config') || lowerDesc.includes('configuration')) return 'config_format';
    if (lowerDesc.includes('dependency') || lowerDesc.includes('version')) return 'dependency_major';
    if (lowerDesc.includes('data') || lowerDesc.includes('schema')) return 'data_structure';
    
    return 'behavior';
  }

  private describeBreakingChangeImpact(description: string): string {
    // Generate a more detailed impact description
    const impactTemplates = {
      'api_removal': 'Code using this API will no longer compile and must be updated',
      'api_signature': 'Function calls may need parameter adjustments',
      'config_format': 'Configuration files need to be updated to new format',
      'dependency_major': 'Dependency conflicts may arise requiring resolution',
      'data_structure': 'Data models or schemas need migration',
      'behavior': 'Application behavior may change requiring validation'
    };

    const type = this.categorizeBreakingChangeType(description);
    return impactTemplates[type] || 'Impact assessment required';
  }

  private extractAffectedComponents(description: string): string[] {
    // Extract component names from breaking change description
    const components: string[] = [];
    const componentPatterns = [
      /component\s+([a-zA-Z0-9_-]+)/gi,
      /module\s+([a-zA-Z0-9_-]+)/gi,
      /plugin\s+([a-zA-Z0-9_-]+)/gi,
      /service\s+([a-zA-Z0-9_-]+)/gi
    ];

    for (const pattern of componentPatterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        components.push(match[1]);
      }
    }

    return [...new Set(components)];
  }

  private async generateMigrationGuide(change: ParsedChange): Promise<string> {
    // Generate specific migration guidance based on change type
    const guides = {
      'breaking': `
1. Identify all code locations using the changed functionality
2. Update to use the new API/configuration format
3. Test thoroughly to ensure functionality is preserved
4. Consider gradual rollout if this is a significant change
      `,
      'deprecation': `
1. Plan migration timeline before deprecation deadline
2. Update code to use replacement functionality
3. Monitor for deprecation warnings
4. Test new implementation thoroughly
      `,
      'feature': 'Consider adopting this new feature to improve functionality',
      'bugfix': 'Verify that your code doesn\'t depend on the buggy behavior'
    };

    return guides[change.category as keyof typeof guides] || 'Review change and update accordingly';
  }

  private async generateCodeExamples(change: ParsedChange): Promise<BreakingChange['codeExamples']> {
    // Generate before/after code examples when possible
    // This would typically use AST analysis or pattern matching
    return {
      before: '// Before: Legacy code example would be shown here',
      after: '// After: Updated code example would be shown here',
      explanation: 'Code example analysis not available for this change'
    };
  }

  private assessAutomationPossibility(change: ParsedChange): boolean {
    // Assess whether the change can be automated with codemods or scripts
    const automatablePatterns = [
      /rename/i,
      /import\s+change/i,
      /configuration\s+key/i,
      /parameter\s+order/i
    ];

    return automatablePatterns.some(pattern => pattern.test(change.description));
  }

  private extractDeprecationInfo(change: ParsedChange): BreakingChange['deprecationWarning'] | undefined {
    const deprecationPattern = /deprecated\s+in\s+v?(\d+\.\d+\.\d+).*removed\s+in\s+v?(\d+\.\d+\.\d+)/i;
    const match = change.description.match(deprecationPattern);

    if (match) {
      return {
        introducedIn: match[1],
        removedIn: match[2],
        warningPeriod: this.calculateVersionDifference(match[1], match[2])
      };
    }

    return undefined;
  }

  private calculateVersionDifference(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    // Simplified version difference calculation
    const v1Major = v1Parts[0] || 0;
    const v2Major = v2Parts[0] || 0;

    if (v2Major > v1Major) {
      return (v2Major - v1Major) * 100; // Major versions
    }

    const v1Minor = v1Parts[1] || 0;
    const v2Minor = v2Parts[1] || 0;

    return Math.max(1, v2Minor - v1Minor);
  }

  private async findApiBreakingChanges(fromVersion: any, toVersion: any): Promise<BreakingChange[]> {
    // This would analyze actual API differences using AST parsing or schema comparison
    // For now, we'll return a simplified analysis
    const breakingChanges: BreakingChange[] = [];

    // Compare dependency major versions
    const fromDeps = fromVersion.dependencies || {};
    const toDeps = toVersion.dependencies || {};

    for (const [depName, toVersionStr] of Object.entries(toDeps)) {
      const fromVersionStr = fromDeps[depName];
      if (fromVersionStr && this.isMajorVersionChange(fromVersionStr as string, toVersionStr as string)) {
        breakingChanges.push({
          type: 'dependency_major',
          category: 'integration',
          severity: 'medium',
          description: `Major version upgrade of dependency: ${depName}`,
          impact: 'May introduce breaking changes from the dependency',
          affectedComponents: [depName],
          migrationGuide: `Review ${depName} changelog for breaking changes`,
          codeExamples: {
            before: `// Using ${depName}@${fromVersionStr}`,
            after: `// Using ${depName}@${toVersionStr}`
          },
          automationPossible: false
        });
      }
    }

    return breakingChanges;
  }

  private isMajorVersionChange(fromVersion: string, toVersion: string): boolean {
    const fromMajor = parseInt(fromVersion.split('.')[0] || '0');
    const toMajor = parseInt(toVersion.split('.')[0] || '0');
    return toMajor > fromMajor;
  }

  private async analyzeApiChanges(
    plugin: any,
    fromVersion: any,
    toVersion: any
  ): Promise<ApiChange[]> {
    // This would perform actual API analysis comparing interfaces, schemas, etc.
    // For now, returning a simplified analysis
    const apiChanges: ApiChange[] = [];

    // Analyze package.json changes for new/removed scripts or exports
    const fromPackage = fromVersion.packageJson || {};
    const toPackage = toVersion.packageJson || {};

    // Check for changes in main entry point
    if (fromPackage.main !== toPackage.main) {
      apiChanges.push({
        function: 'main entry point',
        changeType: 'modified',
        documentation: `Entry point changed from ${fromPackage.main} to ${toPackage.main}`
      });
    }

    // Check for changes in exports
    const fromExports = fromPackage.exports || {};
    const toExports = toPackage.exports || {};

    for (const exportPath of Object.keys(toExports)) {
      if (!fromExports[exportPath]) {
        apiChanges.push({
          endpoint: exportPath,
          changeType: 'added',
          documentation: 'New export added'
        });
      }
    }

    for (const exportPath of Object.keys(fromExports)) {
      if (!toExports[exportPath]) {
        apiChanges.push({
          endpoint: exportPath,
          changeType: 'removed',
          documentation: 'Export removed - breaking change'
        });
      }
    }

    return apiChanges;
  }

  private async analyzeConfigChanges(
    plugin: any,
    fromVersion: any,
    toVersion: any
  ): Promise<ConfigurationChange[]> {
    const configChanges: ConfigurationChange[] = [];
    
    // Compare configuration schemas if available
    const fromConfig = fromVersion.configSchema || {};
    const toConfig = toVersion.configSchema || {};

    // Check for new required configuration keys
    const fromRequired = fromConfig.required || [];
    const toRequired = toConfig.required || [];

    for (const requiredKey of toRequired) {
      if (!fromRequired.includes(requiredKey)) {
        configChanges.push({
          configKey: requiredKey,
          changeType: 'added',
          isRequired: true,
          migrationScript: `Add required configuration: ${requiredKey}`,
          validationRules: [`${requiredKey} must be provided`]
        });
      }
    }

    // Check for removed configuration keys
    for (const requiredKey of fromRequired) {
      if (!toRequired.includes(requiredKey)) {
        configChanges.push({
          configKey: requiredKey,
          changeType: 'removed',
          isRequired: false,
          migrationScript: `Remove obsolete configuration: ${requiredKey}`
        });
      }
    }

    return configChanges;
  }

  private async analyzeDependencyChanges(fromVersion: any, toVersion: any): Promise<DependencyChange[]> {
    const dependencyChanges: DependencyChange[] = [];
    
    const fromDeps = { ...(fromVersion.dependencies || {}), ...(fromVersion.devDependencies || {}) };
    const toDeps = { ...(toVersion.dependencies || {}), ...(toVersion.devDependencies || {}) };

    // Check for added dependencies
    for (const [depName, version] of Object.entries(toDeps)) {
      if (!fromDeps[depName]) {
        dependencyChanges.push({
          dependency: depName,
          changeType: 'added',
          toVersion: version as string,
          reason: 'New functionality or requirement',
          impact: 'low',
          securityImplications: await this.checkSecurityImplications(depName, version as string)
        });
      }
    }

    // Check for removed dependencies
    for (const [depName, version] of Object.entries(fromDeps)) {
      if (!toDeps[depName]) {
        dependencyChanges.push({
          dependency: depName,
          changeType: 'removed',
          fromVersion: version as string,
          reason: 'No longer needed or replaced',
          impact: 'medium'
        });
      }
    }

    // Check for version changes
    for (const [depName, toVersionStr] of Object.entries(toDeps)) {
      const fromVersionStr = fromDeps[depName];
      if (fromVersionStr && fromVersionStr !== toVersionStr) {
        const changeType = this.compareVersions(fromVersionStr as string, toVersionStr as string);
        dependencyChanges.push({
          dependency: depName,
          changeType,
          fromVersion: fromVersionStr as string,
          toVersion: toVersionStr as string,
          reason: 'Version update',
          impact: this.isMajorVersionChange(fromVersionStr as string, toVersionStr as string) ? 'high' : 'low',
          breakingChangesInDependency: await this.getBreakingChangesInDependency(
            depName,
            fromVersionStr as string,
            toVersionStr as string
          )
        });
      }
    }

    return dependencyChanges;
  }

  private compareVersions(version1: string, version2: string): 'upgraded' | 'downgraded' {
    // Simplified version comparison
    const v1Parts = version1.replace(/[^\d.]/g, '').split('.').map(Number);
    const v2Parts = version2.replace(/[^\d.]/g, '').split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v2Part > v1Part) return 'upgraded';
      if (v2Part < v1Part) return 'downgraded';
    }

    return 'upgraded'; // Default to upgraded if same
  }

  private async checkSecurityImplications(depName: string, version: string): Promise<SecurityImplication[]> {
    // This would check against vulnerability databases
    // For now, return empty array
    return [];
  }

  private async getBreakingChangesInDependency(
    depName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<string[]> {
    // This would fetch and analyze the dependency's changelog
    // For now, return empty array
    return [];
  }

  private async analyzePerformanceChanges(fromVersion: any, toVersion: any): Promise<PerformanceChange[]> {
    const performanceChanges: PerformanceChange[] = [];

    // Compare performance metrics if available
    const fromPerf = fromVersion.performance || [];
    const toPerf = toVersion.performance || [];

    if (fromPerf.length > 0 && toPerf.length > 0) {
      const latestFromPerf = fromPerf[fromPerf.length - 1];
      const latestToPerf = toPerf[toPerf.length - 1];

      const metrics = ['memoryUsage', 'cpuUsage', 'startupTime', 'responseTime'];
      
      for (const metric of metrics) {
        const fromValue = latestFromPerf[metric];
        const toValue = latestToPerf[metric];

        if (fromValue && toValue && fromValue !== toValue) {
          const percentageChange = ((toValue - fromValue) / fromValue) * 100;
          const changeType = toValue < fromValue ? 'improvement' : 'regression';

          performanceChanges.push({
            metric: metric as any,
            changeType: Math.abs(percentageChange) < 5 ? 'no_change' : changeType,
            percentageChange,
            absoluteChange: toValue - fromValue,
            unit: this.getMetricUnit(metric),
            benchmark: {
              environment: 'test',
              testCase: 'standard_benchmark',
              confidence: 0.8
            }
          });
        }
      }
    }

    return performanceChanges;
  }

  private getMetricUnit(metric: string): string {
    const units = {
      memoryUsage: 'MB',
      cpuUsage: '%',
      startupTime: 'ms',
      responseTime: 'ms',
      throughput: 'req/s'
    };
    return units[metric as keyof typeof units] || 'unit';
  }

  private async generateMigrationPath(
    plugin: any,
    fromVersion: any,
    toVersion: any,
    breakingChanges: BreakingChange[],
    apiChanges: ApiChange[],
    configChanges: ConfigurationChange[],
    dependencyChanges: DependencyChange[]
  ): Promise<MigrationStep[]> {
    const migrationSteps: MigrationStep[] = [];
    let stepNumber = 1;

    // Step 1: Backup current state
    migrationSteps.push({
      step: stepNumber++,
      title: 'Backup Current State',
      description: 'Create backup of current configuration and data',
      type: 'manual_verification',
      automatable: true,
      estimatedTime: 10,
      prerequisites: [],
      commands: [
        'cp -r ./config ./config.backup',
        'npm list --depth=0 > package-lock.backup.json'
      ],
      validationSteps: ['Verify backup files exist'],
      rollbackSteps: ['Restore from backup if needed']
    });

    // Step 2: Update dependencies
    if (dependencyChanges.length > 0) {
      migrationSteps.push({
        step: stepNumber++,
        title: 'Update Dependencies',
        description: 'Install and update plugin dependencies',
        type: 'dependency_update',
        automatable: true,
        estimatedTime: 20,
        prerequisites: ['Backup completed'],
        commands: ['npm install', 'npm audit fix --force'],
        validationSteps: ['npm ls', 'npm run build'],
        rollbackSteps: ['npm ci', 'Restore package-lock.json from backup']
      });
    }

    // Step 3: Update configuration
    if (configChanges.length > 0) {
      const configUpdateSteps = configChanges
        .filter(change => change.isRequired)
        .map(change => change.migrationScript || `Update ${change.configKey}`)
        .join(', ');

      migrationSteps.push({
        step: stepNumber++,
        title: 'Update Configuration',
        description: 'Apply required configuration changes',
        type: 'config_update',
        automatable: false,
        estimatedTime: 30,
        prerequisites: ['Dependencies updated'],
        codeChanges: configChanges.map(change => ({
          file: 'app-config.yaml',
          changes: `${change.configKey}: ${change.newValue || 'UPDATE_REQUIRED'}`
        })),
        validationSteps: ['Validate configuration schema'],
        rollbackSteps: ['Restore configuration from backup']
      });
    }

    // Step 4: Handle breaking changes
    if (breakingChanges.length > 0) {
      migrationSteps.push({
        step: stepNumber++,
        title: 'Address Breaking Changes',
        description: 'Update code to handle breaking changes',
        type: 'code_change',
        automatable: false,
        estimatedTime: breakingChanges.length * 45,
        prerequisites: ['Configuration updated'],
        validationSteps: ['Run test suite', 'Manual functional testing'],
        rollbackSteps: ['Revert code changes', 'Restore from backup']
      });
    }

    // Step 5: Final validation
    migrationSteps.push({
      step: stepNumber++,
      title: 'Final Validation',
      description: 'Comprehensive testing and validation',
      type: 'manual_verification',
      automatable: false,
      estimatedTime: 60,
      prerequisites: ['All changes applied'],
      validationSteps: [
        'Run full test suite',
        'Verify all functionality works',
        'Check for console errors',
        'Performance validation'
      ],
      rollbackSteps: ['Complete rollback to previous version']
    });

    return migrationSteps;
  }

  private calculateMigrationComplexity(
    breakingChanges: BreakingChange[],
    apiChanges: ApiChange[],
    configChanges: ConfigurationChange[],
    dependencyChanges: DependencyChange[]
  ): VersionComparison['migrationComplexity'] {
    let complexity = 0;

    // Weight different types of changes
    complexity += breakingChanges.filter(c => c.severity === 'critical').length * 4;
    complexity += breakingChanges.filter(c => c.severity === 'high').length * 3;
    complexity += breakingChanges.filter(c => c.severity === 'medium').length * 2;
    complexity += breakingChanges.filter(c => c.severity === 'low').length * 1;

    complexity += apiChanges.filter(c => c.changeType === 'removed').length * 3;
    complexity += apiChanges.filter(c => c.changeType === 'modified').length * 2;

    complexity += configChanges.filter(c => c.isRequired).length * 2;
    complexity += configChanges.length * 1;

    complexity += dependencyChanges.filter(c => c.impact === 'high').length * 3;
    complexity += dependencyChanges.filter(c => c.impact === 'medium').length * 2;

    if (complexity === 0) return 'simple';
    if (complexity <= 3) return 'simple';
    if (complexity <= 7) return 'moderate';
    if (complexity <= 15) return 'complex';
    return 'very_complex';
  }

  private estimateMigrationTime(migrationPath: MigrationStep[]): number {
    return migrationPath.reduce((total, step) => total + step.estimatedTime, 0) / 60; // Convert to hours
  }

  private assessRollbackComplexity(migrationPath: MigrationStep[]): 'easy' | 'moderate' | 'difficult' {
    const hasDataMigration = migrationPath.some(step => step.type === 'data_migration');
    const hasComplexCodeChanges = migrationPath.some(step => 
      step.type === 'code_change' && step.estimatedTime > 60
    );

    if (hasDataMigration) return 'difficult';
    if (hasComplexCodeChanges) return 'moderate';
    return 'easy';
  }

  private generateTestingRequirements(
    breakingChanges: BreakingChange[],
    apiChanges: ApiChange[]
  ): TestingRequirement[] {
    const requirements: TestingRequirement[] = [];

    // Always require unit tests
    requirements.push({
      type: 'unit',
      priority: 'high',
      description: 'Run unit test suite to verify functionality',
      estimatedTime: 30,
      automatable: true,
      testCases: ['All existing unit tests should pass']
    });

    // Integration tests for API changes
    if (apiChanges.length > 0) {
      requirements.push({
        type: 'integration',
        priority: 'high',
        description: 'Test API integrations and interfaces',
        estimatedTime: 45,
        automatable: true,
        testCases: ['API endpoint tests', 'Service integration tests']
      });
    }

    // E2E tests for breaking changes
    if (breakingChanges.some(c => c.severity === 'high' || c.severity === 'critical')) {
      requirements.push({
        type: 'e2e',
        priority: 'critical',
        description: 'End-to-end testing for critical changes',
        estimatedTime: 90,
        automatable: false,
        testCases: ['Complete user workflows', 'Critical business processes']
      });
    }

    return requirements;
  }

  private assessVersionRisk(
    breakingChanges: BreakingChange[],
    dependencyChanges: DependencyChange[],
    migrationComplexity: string
  ): VersionRiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // Assess breaking change risks
    const criticalBreaking = breakingChanges.filter(c => c.severity === 'critical').length;
    const highBreaking = breakingChanges.filter(c => c.severity === 'high').length;

    if (criticalBreaking > 0) {
      riskFactors.push({
        factor: `${criticalBreaking} critical breaking change(s)`,
        severity: 'critical',
        probability: 'high',
        impact: 'Application may fail to start or function correctly'
      });
    }

    if (highBreaking > 0) {
      riskFactors.push({
        factor: `${highBreaking} high-impact breaking change(s)`,
        severity: 'high',
        probability: 'high',
        impact: 'Significant functionality changes required'
      });
    }

    // Assess dependency risks
    const majorDependencyUpgrades = dependencyChanges.filter(c => 
      c.changeType === 'upgraded' && c.impact === 'high'
    ).length;

    if (majorDependencyUpgrades > 0) {
      riskFactors.push({
        factor: `${majorDependencyUpgrades} major dependency upgrade(s)`,
        severity: 'medium',
        probability: 'medium',
        impact: 'Potential compatibility issues with other plugins'
      });
    }

    // Assess migration complexity risk
    if (migrationComplexity === 'very_complex') {
      riskFactors.push({
        factor: 'Very complex migration required',
        severity: 'high',
        probability: 'high',
        impact: 'High risk of errors during migration process'
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);
    const mitigationStrategies = this.generateMitigationStrategies(riskFactors);
    const rollbackPlan = this.generateRollbackPlan(overallRisk);
    const recommendedApproach = this.recommendMigrationApproach(overallRisk, migrationComplexity);

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies,
      rollbackPlan,
      recommendedApproach
    };
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    if (riskFactors.some(r => r.severity === 'critical')) return 'critical';
    if (riskFactors.filter(r => r.severity === 'high').length > 1) return 'critical';
    if (riskFactors.some(r => r.severity === 'high')) return 'high';
    if (riskFactors.filter(r => r.severity === 'medium').length > 2) return 'high';
    if (riskFactors.some(r => r.severity === 'medium')) return 'medium';
    return 'low';
  }

  private generateMitigationStrategies(riskFactors: RiskFactor[]): string[] {
    const strategies: string[] = [
      'Test migration in development environment first',
      'Create comprehensive backup before starting migration',
      'Plan migration during low-usage periods'
    ];

    if (riskFactors.some(r => r.factor.includes('breaking'))) {
      strategies.push('Review all breaking changes and prepare code updates in advance');
    }

    if (riskFactors.some(r => r.factor.includes('dependency'))) {
      strategies.push('Test dependency compatibility in isolation');
    }

    return strategies;
  }

  private generateRollbackPlan(overallRisk: string): RollbackStep[] {
    const basePlan: RollbackStep[] = [
      {
        step: 1,
        action: 'Stop application services',
        timeRequired: 2,
        complexity: 'easy',
        dataLossRisk: false
      },
      {
        step: 2,
        action: 'Restore configuration from backup',
        timeRequired: 5,
        complexity: 'easy',
        dataLossRisk: false
      },
      {
        step: 3,
        action: 'Revert to previous plugin version',
        timeRequired: 10,
        complexity: 'moderate',
        dataLossRisk: false
      },
      {
        step: 4,
        action: 'Restart application services',
        timeRequired: 5,
        complexity: 'easy',
        dataLossRisk: false
      }
    ];

    if (overallRisk === 'high' || overallRisk === 'critical') {
      basePlan.push({
        step: 5,
        action: 'Restore data from backup if needed',
        timeRequired: 30,
        complexity: 'difficult',
        dataLossRisk: true
      });
    }

    return basePlan;
  }

  private recommendMigrationApproach(
    overallRisk: string,
    migrationComplexity: string
  ): VersionRiskAssessment['recommendedApproach'] {
    if (overallRisk === 'critical') return 'skip_version';
    if (overallRisk === 'high' && migrationComplexity === 'very_complex') return 'delayed';
    if (overallRisk === 'high') return 'staged';
    if (migrationComplexity === 'complex' || migrationComplexity === 'very_complex') return 'staged';
    return 'immediate';
  }

  private calculateOverallImpact(
    breakingChanges: BreakingChange[],
    apiChanges: ApiChange[],
    configChanges: ConfigurationChange[],
    dependencyChanges: DependencyChange[],
    performanceChanges: PerformanceChange[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    let impact = 0;

    // Breaking changes have the highest impact
    impact += breakingChanges.filter(c => c.severity === 'critical').length * 4;
    impact += breakingChanges.filter(c => c.severity === 'high').length * 3;
    impact += breakingChanges.filter(c => c.severity === 'medium').length * 2;
    impact += breakingChanges.filter(c => c.severity === 'low').length * 1;

    // API removals are significant
    impact += apiChanges.filter(c => c.changeType === 'removed').length * 2;

    // Required config changes
    impact += configChanges.filter(c => c.isRequired).length * 2;

    // High-impact dependency changes
    impact += dependencyChanges.filter(c => c.impact === 'high').length * 2;

    // Performance regressions
    impact += performanceChanges.filter(c => c.changeType === 'regression').length * 1;

    if (impact >= 10) return 'critical';
    if (impact >= 6) return 'high';
    if (impact >= 3) return 'medium';
    return 'low';
  }

  async analyzeChangelog(pluginId: string, version: string): Promise<ChangelogAnalysis> {
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        versions: {
          where: { version },
          take: 1
        }
      }
    });

    if (!plugin || !plugin.versions[0]) {
      throw new Error(`Plugin or version not found: ${pluginId}@${version}`);
    }

    const versionData = plugin.versions[0];
    const changelog = versionData.changelog || '';

    const parsedChanges = this.parseChangelog(changelog);
    const sentiment = this.analyzeSentiment(parsedChanges);
    const changelogQuality = this.assessChangelogQuality(changelog, parsedChanges);
    const migrationGuidance = this.generateMigrationGuidanceFromChangelog(parsedChanges);

    return {
      pluginId,
      version,
      publishDate: versionData.createdAt,
      changelog,
      parsedChanges,
      sentiment,
      changelogQuality,
      migrationGuidance
    };
  }

  private parseChangelog(changelog: string): ParsedChange[] {
    const changes: ParsedChange[] = [];
    const lines = changelog.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip headers and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine.length === 0) {
        continue;
      }

      const change = this.classifyChange(trimmedLine);
      if (change) {
        changes.push(change);
      }
    }

    return changes;
  }

  private classifyChange(line: string): ParsedChange | null {
    const lowerLine = line.toLowerCase();

    // Determine category
    let category: ParsedChange['category'] = 'feature';
    if (this.breakingChangePatterns.some(pattern => pattern.test(line))) {
      category = 'breaking';
    } else if (lowerLine.includes('deprecat')) {
      category = 'deprecation';
    } else if (lowerLine.includes('fix') || lowerLine.includes('bug')) {
      category = 'bugfix';
    } else if (lowerLine.includes('security') || lowerLine.includes('vulnerabilit')) {
      category = 'security';
    } else if (lowerLine.includes('performance') || lowerLine.includes('optimi')) {
      category = 'performance';
    } else if (lowerLine.includes('doc') || lowerLine.includes('readme')) {
      category = 'documentation';
    }

    // Determine impact
    let impact: ParsedChange['impact'] = 'low';
    if (category === 'breaking' || category === 'security') {
      impact = 'high';
    } else if (category === 'deprecation' || category === 'performance') {
      impact = 'medium';
    }

    // Check if user-facing vs developer-facing
    const userFacing = lowerLine.includes('ui') || lowerLine.includes('user') || 
                       lowerLine.includes('interface') || lowerLine.includes('display');
    const developerFacing = lowerLine.includes('api') || lowerLine.includes('config') ||
                           lowerLine.includes('develop') || lowerLine.includes('code');

    return {
      category,
      description: line.replace(/^[-*+]\s*/, '').trim(),
      impact,
      userFacing,
      developerFacing: developerFacing || (!userFacing && !developerFacing), // Default to developer-facing
      references: this.extractReferences(line)
    };
  }

  private extractReferences(line: string): ParsedChange['references'] {
    const issueNumbers = (line.match(/#(\d+)/g) || []).map(match => match.slice(1));
    const pullRequests = (line.match(/PR\s*#?(\d+)/gi) || []).map(match => match.replace(/PR\s*#?/i, ''));
    const commitHashes = (line.match(/([a-f0-9]{7,40})/g) || []);

    if (issueNumbers.length > 0 || pullRequests.length > 0 || commitHashes.length > 0) {
      return {
        issueNumbers,
        pullRequests,
        commitHashes
      };
    }

    return undefined;
  }

  private analyzeSentiment(changes: ParsedChange[]): 'positive' | 'neutral' | 'negative' {
    let positiveScore = 0;
    let negativeScore = 0;

    for (const change of changes) {
      if (change.category === 'feature' || change.category === 'performance') {
        positiveScore += change.impact === 'high' ? 3 : change.impact === 'medium' ? 2 : 1;
      } else if (change.category === 'breaking' || change.category === 'deprecation') {
        negativeScore += change.impact === 'high' ? 3 : change.impact === 'medium' ? 2 : 1;
      } else if (change.category === 'bugfix' || change.category === 'security') {
        positiveScore += 1; // Bug fixes and security improvements are positive
      }
    }

    const netScore = positiveScore - negativeScore;
    if (netScore > 2) return 'positive';
    if (netScore < -2) return 'negative';
    return 'neutral';
  }

  private assessChangelogQuality(changelog: string, parsedChanges: ParsedChange[]): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 0;

    // Length and detail
    if (changelog.length > 500) score += 2;
    else if (changelog.length > 200) score += 1;

    // Categorization
    const hasCategories = changelog.includes('### ') || changelog.includes('## ');
    if (hasCategories) score += 2;

    // Breaking changes highlighted
    const highlightsBreaking = this.breakingChangePatterns.some(pattern => pattern.test(changelog));
    if (highlightsBreaking) score += 2;

    // Migration guidance
    const hasMigrationGuidance = changelog.toLowerCase().includes('migrat') || 
                                 changelog.toLowerCase().includes('upgrad');
    if (hasMigrationGuidance) score += 2;

    // References to issues/PRs
    const hasReferences = parsedChanges.some(change => change.references);
    if (hasReferences) score += 1;

    if (score >= 7) return 'excellent';
    if (score >= 5) return 'good';
    if (score >= 3) return 'fair';
    return 'poor';
  }

  private generateMigrationGuidanceFromChangelog(changes: ParsedChange[]): string {
    const breakingChanges = changes.filter(c => c.category === 'breaking');
    const deprecations = changes.filter(c => c.category === 'deprecation');

    if (breakingChanges.length === 0 && deprecations.length === 0) {
      return 'This version should be a straightforward upgrade with no breaking changes.';
    }

    let guidance = 'Migration guidance:\n\n';

    if (breakingChanges.length > 0) {
      guidance += '**Breaking Changes:**\n';
      for (const change of breakingChanges) {
        guidance += `- ${change.description}\n`;
      }
      guidance += '\n';
    }

    if (deprecations.length > 0) {
      guidance += '**Deprecations:**\n';
      for (const change of deprecations) {
        guidance += `- ${change.description}\n`;
      }
      guidance += '\n';
    }

    guidance += 'Please review these changes carefully and update your code accordingly before upgrading.';

    return guidance;
  }

  private async analyzeAllVersionChangelogs(pluginId: string): Promise<ChangelogAnalysis[]> {
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 20 // Analyze last 20 versions
        }
      }
    });

    if (!plugin) {
      return [];
    }

    const analyses: ChangelogAnalysis[] = [];

    for (const version of plugin.versions) {
      if (version.changelog) {
        try {
          const analysis = await this.analyzeChangelog(pluginId, version.version);
          analyses.push(analysis);
        } catch (error) {
          console.error(`Failed to analyze changelog for ${pluginId}@${version.version}:`, error);
        }
      }
    }

    return analyses;
  }
}

// Export singleton instance
export const advancedDiffEngine = new AdvancedDiffEngine();