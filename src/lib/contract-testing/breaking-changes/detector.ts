import { PactContract, OpenAPISpec, BreakingChange, Warning, CompatibilityResult } from '../types';
import { CompatibilityChecker } from '../core/compatibility-checker';
import { SemanticVersionManager } from '../versioning/semantic-version';
import { Logger } from 'winston';

export interface BreakingChangeDetectorOptions {
  checkLevel: 'strict' | 'moderate' | 'lenient';
  ignoreOptionalFields?: boolean;
  ignoreAdditionalProperties?: boolean;
  ignoreHeaderChanges?: boolean;
  customRules?: BreakingChangeRule[];
  versioningStrategy?: 'semantic' | 'calendar' | 'sequential';
}

export interface BreakingChangeRule {
  id: string;
  name: string;
  description: string;
  severity: 'major' | 'minor' | 'patch';
  category: 'request' | 'response' | 'endpoint' | 'schema';
  detector: (oldContract: any, newContract: any, context: DetectionContext) => BreakingChangeResult[];
}

export interface BreakingChangeResult {
  type: BreakingChange['type'];
  severity: BreakingChange['severity'];
  description: string;
  path: string;
  oldValue?: any;
  newValue?: any;
  recommendation?: string;
  autoFixable?: boolean;
  fixSuggestion?: string;
}

export interface DetectionContext {
  contractPair: {
    old: PactContract | OpenAPISpec;
    new: PactContract | OpenAPISpec;
  };
  options: BreakingChangeDetectorOptions;
  logger: Logger;
}

export interface ChangeImpactAnalysis {
  breakingChanges: BreakingChange[];
  warnings: Warning[];
  impactScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedConsumers: string[];
  migrationComplexity: 'simple' | 'moderate' | 'complex' | 'major-refactor';
  estimatedMigrationTime: string;
  recommendations: string[];
}

export class BreakingChangeDetector {
  private logger: Logger;
  private compatibilityChecker: CompatibilityChecker;
  private versionManager: SemanticVersionManager;
  private defaultRules: BreakingChangeRule[];

  constructor(logger: Logger) {
    this.logger = logger;
    this.compatibilityChecker = new CompatibilityChecker(logger);
    this.versionManager = new SemanticVersionManager();
    this.defaultRules = this.initializeDefaultRules();
  }

  /**
   * Detect breaking changes between two Pact contracts
   */
  async detectPactBreakingChanges(
    oldContract: PactContract,
    newContract: PactContract,
    options: BreakingChangeDetectorOptions = { checkLevel: 'moderate' }
  ): Promise<CompatibilityResult> {
    this.logger.info('Detecting breaking changes in Pact contracts', {
      oldConsumer: oldContract.consumer.name,
      oldProvider: oldContract.provider.name,
      newConsumer: newContract.consumer.name,
      newProvider: newContract.provider.name,
      checkLevel: options.checkLevel
    });

    const context: DetectionContext = {
      contractPair: { old: oldContract, new: newContract },
      options,
      logger: this.logger
    };

    const breakingChanges: BreakingChange[] = [];
    const warnings: Warning[] = [];

    // Run compatibility check first
    const compatibilityResult = await this.compatibilityChecker.checkPactCompatibility(
      oldContract,
      newContract,
      {
        strictMode: options.checkLevel === 'strict',
        ignoreOptionalFields: options.ignoreOptionalFields,
        checkResponseHeaders: !options.ignoreHeaderChanges
      }
    );

    breakingChanges.push(...compatibilityResult.breakingChanges);
    warnings.push(...compatibilityResult.warnings);

    // Apply detection rules
    const rules = [...this.defaultRules, ...(options.customRules || [])];
    const ruleResults = await this.applyDetectionRules(rules, context);
    
    breakingChanges.push(...ruleResults.breakingChanges);
    warnings.push(...ruleResults.warnings);

    // Calculate enhanced compatibility score
    const compatibilityScore = this.calculateEnhancedCompatibilityScore(breakingChanges, warnings, options);

    const result: CompatibilityResult = {
      isCompatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      compatibilityScore
    };

    this.logger.info('Breaking change detection completed', {
      isCompatible: result.isCompatible,
      breakingChanges: breakingChanges.length,
      warnings: warnings.length,
      score: compatibilityScore
    });

    return result;
  }

  /**
   * Detect breaking changes between OpenAPI specifications
   */
  async detectOpenAPIBreakingChanges(
    oldSpec: OpenAPISpec,
    newSpec: OpenAPISpec,
    options: BreakingChangeDetectorOptions = { checkLevel: 'moderate' }
  ): Promise<CompatibilityResult> {
    this.logger.info('Detecting breaking changes in OpenAPI specifications', {
      oldTitle: oldSpec.info.title,
      oldVersion: oldSpec.info.version,
      newTitle: newSpec.info.title,
      newVersion: newSpec.info.version,
      checkLevel: options.checkLevel
    });

    const context: DetectionContext = {
      contractPair: { old: oldSpec, new: newSpec },
      options,
      logger: this.logger
    };

    const breakingChanges: BreakingChange[] = [];
    const warnings: Warning[] = [];

    // Run OpenAPI compatibility check
    const compatibilityResult = await this.compatibilityChecker.checkOpenAPICompatibility(
      oldSpec,
      newSpec,
      {
        strictMode: options.checkLevel === 'strict',
        validateExamples: true,
        validateSecurity: true
      }
    );

    breakingChanges.push(...compatibilityResult.breakingChanges);
    warnings.push(...compatibilityResult.warnings);

    // Apply OpenAPI-specific rules
    const openApiRules = this.getOpenAPISpecificRules();
    const ruleResults = await this.applyDetectionRules(openApiRules, context);
    
    breakingChanges.push(...ruleResults.breakingChanges);
    warnings.push(...ruleResults.warnings);

    const compatibilityScore = this.calculateEnhancedCompatibilityScore(breakingChanges, warnings, options);

    return {
      isCompatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      compatibilityScore
    };
  }

  /**
   * Analyze impact of breaking changes
   */
  analyzeChangeImpact(
    breakingChanges: BreakingChange[],
    warnings: Warning[],
    affectedConsumers: string[] = []
  ): ChangeImpactAnalysis {
    const impactScore = this.calculateImpactScore(breakingChanges, warnings);
    const riskLevel = this.determineRiskLevel(impactScore, breakingChanges);
    const migrationComplexity = this.assessMigrationComplexity(breakingChanges);
    const estimatedTime = this.estimateMigrationTime(migrationComplexity, breakingChanges.length);
    const recommendations = this.generateRecommendations(breakingChanges, warnings, riskLevel);

    return {
      breakingChanges,
      warnings,
      impactScore,
      riskLevel,
      affectedConsumers,
      migrationComplexity,
      estimatedMigrationTime: estimatedTime,
      recommendations
    };
  }

  /**
   * Generate breaking change report
   */
  generateBreakingChangeReport(
    result: CompatibilityResult,
    impact: ChangeImpactAnalysis
  ): string {
    const report = [];
    
    report.push('# Breaking Change Analysis Report');
    report.push('');
    report.push(`**Analysis Date**: ${new Date().toISOString()}`);
    report.push(`**Compatibility Score**: ${result.compatibilityScore}%`);
    report.push(`**Risk Level**: ${impact.riskLevel.toUpperCase()}`);
    report.push(`**Migration Complexity**: ${impact.migrationComplexity}`);
    report.push(`**Estimated Migration Time**: ${impact.estimatedMigrationTime}`);
    report.push('');

    // Executive Summary
    report.push('## Executive Summary');
    report.push('');
    if (result.isCompatible) {
      report.push('✅ **COMPATIBLE**: No breaking changes detected.');
    } else {
      report.push('❌ **INCOMPATIBLE**: Breaking changes detected that require attention.');
      report.push(`- **Breaking Changes**: ${result.breakingChanges.length}`);
      report.push(`- **Warnings**: ${result.warnings.length}`);
      if (impact.affectedConsumers.length > 0) {
        report.push(`- **Affected Consumers**: ${impact.affectedConsumers.join(', ')}`);
      }
    }
    report.push('');

    // Breaking Changes
    if (result.breakingChanges.length > 0) {
      report.push('## Breaking Changes');
      report.push('');
      
      // Group by severity
      const groupedByType = this.groupBreakingChangesByType(result.breakingChanges);
      
      Object.entries(groupedByType).forEach(([type, changes]) => {
        report.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} Changes`);
        report.push('');
        
        changes.forEach((change, index) => {
          report.push(`#### ${index + 1}. ${change.description}`);
          report.push(`- **Severity**: ${change.severity.toUpperCase()}`);
          report.push(`- **Path**: \`${change.path}\``);
          
          if (change.oldValue !== undefined && change.newValue !== undefined) {
            report.push(`- **Before**: \`${JSON.stringify(change.oldValue)}\``);
            report.push(`- **After**: \`${JSON.stringify(change.newValue)}\``);
          }
          
          // Add recommendation if available
          const recommendation = this.getChangeRecommendation(change);
          if (recommendation) {
            report.push(`- **Recommendation**: ${recommendation}`);
          }
          
          report.push('');
        });
      });
    }

    // Warnings
    if (result.warnings.length > 0) {
      report.push('## Warnings');
      report.push('');
      
      result.warnings.forEach((warning, index) => {
        report.push(`### ${index + 1}. ${warning.description}`);
        report.push(`- **Type**: ${warning.type}`);
        report.push(`- **Path**: \`${warning.path}\``);
        if (warning.recommendation) {
          report.push(`- **Recommendation**: ${warning.recommendation}`);
        }
        report.push('');
      });
    }

    // Impact Analysis
    report.push('## Impact Analysis');
    report.push('');
    report.push(`**Impact Score**: ${impact.impactScore}/100`);
    report.push(`**Risk Assessment**: ${impact.riskLevel}`);
    report.push('');

    // Migration Strategy
    if (!result.isCompatible) {
      report.push('## Migration Strategy');
      report.push('');
      report.push(`**Complexity Level**: ${impact.migrationComplexity}`);
      report.push(`**Estimated Time**: ${impact.estimatedMigrationTime}`);
      report.push('');
      
      if (impact.recommendations.length > 0) {
        report.push('### Recommendations');
        report.push('');
        impact.recommendations.forEach((rec, index) => {
          report.push(`${index + 1}. ${rec}`);
        });
        report.push('');
      }
    }

    // Next Steps
    report.push('## Next Steps');
    report.push('');
    if (result.isCompatible) {
      report.push('✅ No action required - changes are backward compatible.');
      if (result.warnings.length > 0) {
        report.push('⚠️ Review warnings to ensure they align with your intended changes.');
      }
    } else {
      report.push('⚠️ **Action Required**: Breaking changes must be addressed before release.');
      report.push('');
      report.push('1. Review all breaking changes listed above');
      report.push('2. Plan migration strategy for affected consumers');
      report.push('3. Consider implementing backward compatibility measures');
      report.push('4. Update API documentation and versioning');
      report.push('5. Coordinate with consuming teams for migration');
    }

    return report.join('\n');
  }

  /**
   * Get automated fix suggestions for breaking changes
   */
  getAutomatedFixSuggestions(breakingChanges: BreakingChange[]): {
    autoFixable: BreakingChange[];
    manualFix: BreakingChange[];
    suggestions: { change: BreakingChange; fix: string }[];
  } {
    const autoFixable: BreakingChange[] = [];
    const manualFix: BreakingChange[] = [];
    const suggestions: { change: BreakingChange; fix: string }[] = [];

    breakingChanges.forEach(change => {
      const fixSuggestion = this.generateFixSuggestion(change);
      
      if (fixSuggestion.autoFixable) {
        autoFixable.push(change);
      } else {
        manualFix.push(change);
      }

      if (fixSuggestion.suggestion) {
        suggestions.push({
          change,
          fix: fixSuggestion.suggestion
        });
      }
    });

    return { autoFixable, manualFix, suggestions };
  }

  private initializeDefaultRules(): BreakingChangeRule[] {
    return [
      {
        id: 'endpoint-removal',
        name: 'Endpoint Removal Detection',
        description: 'Detects when API endpoints are removed',
        severity: 'major',
        category: 'endpoint',
        detector: this.detectEndpointRemovals.bind(this)
      },
      {
        id: 'method-removal',
        name: 'HTTP Method Removal Detection',
        description: 'Detects when HTTP methods are removed from endpoints',
        severity: 'major',
        category: 'endpoint',
        detector: this.detectMethodRemovals.bind(this)
      },
      {
        id: 'required-field-addition',
        name: 'Required Field Addition Detection',
        description: 'Detects when required fields are added to requests',
        severity: 'major',
        category: 'request',
        detector: this.detectRequiredFieldAdditions.bind(this)
      },
      {
        id: 'response-field-removal',
        name: 'Response Field Removal Detection',
        description: 'Detects when fields are removed from responses',
        severity: 'minor',
        category: 'response',
        detector: this.detectResponseFieldRemovals.bind(this)
      },
      {
        id: 'status-code-changes',
        name: 'Status Code Changes Detection',
        description: 'Detects when response status codes change',
        severity: 'major',
        category: 'response',
        detector: this.detectStatusCodeChanges.bind(this)
      },
      {
        id: 'data-type-changes',
        name: 'Data Type Changes Detection',
        description: 'Detects when data types of fields change',
        severity: 'major',
        category: 'schema',
        detector: this.detectDataTypeChanges.bind(this)
      }
    ];
  }

  private getOpenAPISpecificRules(): BreakingChangeRule[] {
    return [
      {
        id: 'schema-property-removal',
        name: 'Schema Property Removal',
        description: 'Detects when properties are removed from schemas',
        severity: 'major',
        category: 'schema',
        detector: this.detectSchemaPropertyRemovals.bind(this)
      },
      {
        id: 'enum-value-removal',
        name: 'Enum Value Removal',
        description: 'Detects when enum values are removed',
        severity: 'major',
        category: 'schema',
        detector: this.detectEnumValueRemovals.bind(this)
      },
      {
        id: 'security-requirement-addition',
        name: 'Security Requirement Addition',
        description: 'Detects when new security requirements are added',
        severity: 'major',
        category: 'endpoint',
        detector: this.detectSecurityRequirementAdditions.bind(this)
      }
    ];
  }

  private async applyDetectionRules(
    rules: BreakingChangeRule[],
    context: DetectionContext
  ): Promise<{ breakingChanges: BreakingChange[]; warnings: Warning[] }> {
    const breakingChanges: BreakingChange[] = [];
    const warnings: Warning[] = [];

    for (const rule of rules) {
      try {
        const results = rule.detector(context.contractPair.old, context.contractPair.new, context);
        
        results.forEach(result => {
          if (result.severity === 'major' || result.severity === 'minor') {
            breakingChanges.push({
              type: result.type,
              severity: result.severity,
              description: result.description,
              path: result.path,
              oldValue: result.oldValue,
              newValue: result.newValue
            });
          } else {
            warnings.push({
              type: result.type as any,
              description: result.description,
              path: result.path,
              recommendation: result.recommendation
            });
          }
        });
      } catch (error) {
        this.logger.error('Detection rule failed', {
          rule: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { breakingChanges, warnings };
  }

  // Detection rule implementations
  private detectEndpointRemovals(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    if ('interactions' in oldContract && 'interactions' in newContract) {
      // Pact contracts
      const oldEndpoints = new Set(
        oldContract.interactions.map((i: any) => `${i.request.method} ${i.request.path}`)
      );
      const newEndpoints = new Set(
        newContract.interactions.map((i: any) => `${i.request.method} ${i.request.path}`)
      );

      oldEndpoints.forEach(endpoint => {
        if (!newEndpoints.has(endpoint)) {
          results.push({
            type: 'endpoint',
            severity: 'major',
            description: `Endpoint removed: ${endpoint}`,
            path: endpoint,
            recommendation: 'Consider deprecating instead of removing, or provide migration path',
            autoFixable: false
          });
        }
      });
    } else if ('paths' in oldContract && 'paths' in newContract) {
      // OpenAPI specs
      Object.keys(oldContract.paths).forEach(path => {
        if (!newContract.paths[path]) {
          results.push({
            type: 'endpoint',
            severity: 'major',
            description: `Path removed: ${path}`,
            path,
            recommendation: 'Consider deprecating instead of removing, or provide migration path',
            autoFixable: false
          });
        }
      });
    }

    return results;
  }

  private detectMethodRemovals(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    if ('paths' in oldContract && 'paths' in newContract) {
      Object.entries(oldContract.paths).forEach(([path, oldPathItem]: [string, any]) => {
        const newPathItem = newContract.paths[path];
        if (!newPathItem) return; // Path removal handled by another rule

        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        methods.forEach(method => {
          if (oldPathItem[method] && !newPathItem[method]) {
            results.push({
              type: 'endpoint',
              severity: 'major',
              description: `HTTP method removed: ${method.toUpperCase()} ${path}`,
              path: `${path}.${method}`,
              recommendation: 'Consider deprecating the method instead of removing it',
              autoFixable: false
            });
          }
        });
      });
    }

    return results;
  }

  private detectRequiredFieldAdditions(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    // This would need more sophisticated implementation based on the contract structure
    // For now, return empty array
    return results;
  }

  private detectResponseFieldRemovals(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    // This would need more sophisticated implementation based on the contract structure
    // For now, return empty array
    return results;
  }

  private detectStatusCodeChanges(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    if ('interactions' in oldContract && 'interactions' in newContract) {
      // Group interactions by endpoint for comparison
      const oldInteractionMap = new Map();
      const newInteractionMap = new Map();

      oldContract.interactions.forEach((interaction: any) => {
        const key = `${interaction.request.method} ${interaction.request.path}`;
        oldInteractionMap.set(key, interaction);
      });

      newContract.interactions.forEach((interaction: any) => {
        const key = `${interaction.request.method} ${interaction.request.path}`;
        newInteractionMap.set(key, interaction);
      });

      oldInteractionMap.forEach((oldInteraction, key) => {
        const newInteraction = newInteractionMap.get(key);
        if (newInteraction && oldInteraction.response.status !== newInteraction.response.status) {
          results.push({
            type: 'response',
            severity: 'major',
            description: `Status code changed for ${key}`,
            path: `${key}.response.status`,
            oldValue: oldInteraction.response.status,
            newValue: newInteraction.response.status,
            recommendation: 'Status code changes can break client error handling',
            autoFixable: false
          });
        }
      });
    }

    return results;
  }

  private detectDataTypeChanges(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    // This would require deep schema comparison
    // Implementation depends on the specific contract format
    return results;
  }

  private detectSchemaPropertyRemovals(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    if ('components' in oldContract && 'components' in newContract) {
      const oldSchemas = oldContract.components?.schemas || {};
      const newSchemas = newContract.components?.schemas || {};

      Object.entries(oldSchemas).forEach(([schemaName, oldSchema]: [string, any]) => {
        const newSchema = newSchemas[schemaName];
        if (!newSchema) return; // Schema removal handled elsewhere

        const oldProperties = oldSchema.properties || {};
        const newProperties = newSchema.properties || {};

        Object.keys(oldProperties).forEach(propName => {
          if (!newProperties[propName]) {
            results.push({
              type: 'schema',
              severity: 'major',
              description: `Property '${propName}' removed from schema '${schemaName}'`,
              path: `components.schemas.${schemaName}.properties.${propName}`,
              oldValue: oldProperties[propName],
              recommendation: 'Consider deprecating properties instead of removing them',
              autoFixable: false
            });
          }
        });
      });
    }

    return results;
  }

  private detectEnumValueRemovals(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    // This would require deep schema traversal to find enum definitions
    // Implementation would be more complex in practice
    return results;
  }

  private detectSecurityRequirementAdditions(oldContract: any, newContract: any, context: DetectionContext): BreakingChangeResult[] {
    const results: BreakingChangeResult[] = [];
    
    if ('paths' in oldContract && 'paths' in newContract) {
      Object.entries(newContract.paths).forEach(([path, newPathItem]: [string, any]) => {
        const oldPathItem = oldContract.paths[path];
        if (!oldPathItem) return;

        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        methods.forEach(method => {
          const oldOperation = oldPathItem[method];
          const newOperation = newPathItem[method];
          
          if (oldOperation && newOperation) {
            const oldSecurity = oldOperation.security || [];
            const newSecurity = newOperation.security || [];
            
            if (oldSecurity.length === 0 && newSecurity.length > 0) {
              results.push({
                type: 'endpoint',
                severity: 'major',
                description: `Security requirements added to ${method.toUpperCase()} ${path}`,
                path: `${path}.${method}.security`,
                newValue: newSecurity,
                recommendation: 'Adding security requirements will break existing clients',
                autoFixable: false
              });
            }
          }
        });
      });
    }

    return results;
  }

  private calculateEnhancedCompatibilityScore(
    breakingChanges: BreakingChange[],
    warnings: Warning[],
    options: BreakingChangeDetectorOptions
  ): number {
    let score = 100;

    // Weight penalties based on check level
    const severityWeights = {
      strict: { major: 30, minor: 15, patch: 5 },
      moderate: { major: 25, minor: 10, patch: 3 },
      lenient: { major: 20, minor: 8, patch: 2 }
    };

    const weights = severityWeights[options.checkLevel];

    breakingChanges.forEach(change => {
      score -= weights[change.severity];
    });

    // Penalty for warnings (lighter)
    warnings.forEach(() => {
      score -= 1;
    });

    return Math.max(0, Math.min(100, score));
  }

  private calculateImpactScore(breakingChanges: BreakingChange[], warnings: Warning[]): number {
    let score = 0;

    breakingChanges.forEach(change => {
      switch (change.severity) {
        case 'major':
          score += 10;
          break;
        case 'minor':
          score += 5;
          break;
        case 'patch':
          score += 2;
          break;
      }
    });

    warnings.forEach(() => {
      score += 1;
    });

    return Math.min(100, score);
  }

  private determineRiskLevel(impactScore: number, breakingChanges: BreakingChange[]): 'low' | 'medium' | 'high' | 'critical' {
    const hasMajorChanges = breakingChanges.some(c => c.severity === 'major');
    
    if (impactScore >= 50 || (hasMajorChanges && breakingChanges.length >= 5)) {
      return 'critical';
    } else if (impactScore >= 25 || hasMajorChanges) {
      return 'high';
    } else if (impactScore >= 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private assessMigrationComplexity(breakingChanges: BreakingChange[]): 'simple' | 'moderate' | 'complex' | 'major-refactor' {
    const majorChanges = breakingChanges.filter(c => c.severity === 'major').length;
    const totalChanges = breakingChanges.length;

    if (majorChanges >= 10 || totalChanges >= 20) {
      return 'major-refactor';
    } else if (majorChanges >= 5 || totalChanges >= 10) {
      return 'complex';
    } else if (majorChanges >= 2 || totalChanges >= 5) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  private estimateMigrationTime(complexity: string, changeCount: number): string {
    const baseTime = {
      'simple': 1,
      'moderate': 3,
      'complex': 7,
      'major-refactor': 14
    }[complexity] || 1;

    const additionalTime = Math.ceil(changeCount / 5);
    const totalDays = baseTime + additionalTime;

    if (totalDays <= 1) {
      return '1 day';
    } else if (totalDays <= 7) {
      return `${totalDays} days`;
    } else {
      const weeks = Math.ceil(totalDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''}`;
    }
  }

  private generateRecommendations(
    breakingChanges: BreakingChange[],
    warnings: Warning[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Consider implementing a versioning strategy (e.g., API v2)');
      recommendations.push('Plan a phased rollout with backward compatibility period');
      recommendations.push('Notify all consuming teams well in advance');
    }

    if (breakingChanges.some(c => c.type === 'endpoint')) {
      recommendations.push('Use deprecation headers before removing endpoints');
      recommendations.push('Provide migration documentation for affected endpoints');
    }

    if (breakingChanges.some(c => c.type === 'schema')) {
      recommendations.push('Consider additive-only changes where possible');
      recommendations.push('Use optional fields and default values for new requirements');
    }

    if (warnings.length > 5) {
      recommendations.push('Review warnings to ensure they align with intended changes');
    }

    return recommendations;
  }

  private getChangeRecommendation(change: BreakingChange): string | undefined {
    const recommendations = {
      'endpoint': 'Use API versioning or deprecation strategy',
      'request': 'Make new fields optional with sensible defaults',
      'response': 'Ensure backward compatibility or provide migration guide',
      'schema': 'Use additive-only changes where possible'
    };

    return recommendations[change.type];
  }

  private generateFixSuggestion(change: BreakingChange): { autoFixable: boolean; suggestion?: string } {
    switch (change.type) {
      case 'request':
        if (change.description.includes('required')) {
          return {
            autoFixable: true,
            suggestion: 'Make the field optional and add a default value'
          };
        }
        break;
      case 'response':
        if (change.description.includes('removed')) {
          return {
            autoFixable: false,
            suggestion: 'Re-add the field or mark it as deprecated'
          };
        }
        break;
      case 'endpoint':
        return {
          autoFixable: false,
          suggestion: 'Add deprecation notice and maintain endpoint for transition period'
        };
    }

    return { autoFixable: false };
  }

  private groupBreakingChangesByType(breakingChanges: BreakingChange[]): Record<string, BreakingChange[]> {
    return breakingChanges.reduce((groups, change) => {
      const type = change.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(change);
      return groups;
    }, {} as Record<string, BreakingChange[]>);
  }
}