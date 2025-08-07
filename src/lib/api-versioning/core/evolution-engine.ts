/**
 * API Evolution Engine
 * 
 * Intelligent API evolution with automatic breaking change detection,
 * impact analysis, and upgrade path generation
 */

import { 
  APIVersion, 
  ChangelogEntry, 
  Migration, 
  MigrationStep,
  Risk,
  CHANGE_TYPES,
  IMPACT_LEVELS,
  MIGRATION_TYPES 
} from '../types';
import { SemanticVersionEngine } from './semantic-version';
import { CompatibilityEngine } from './compatibility-engine';

export interface EvolutionPlan {
  fromVersion: string;
  toVersion: string;
  strategy: 'direct' | 'incremental' | 'guided';
  migrations: Migration[];
  risks: Risk[];
  estimatedDuration: number;
  rollbackPlan: RollbackPlan;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  dataBackupRequired: boolean;
  estimatedTime: number;
  risks: Risk[];
}

export interface RollbackStep {
  title: string;
  description: string;
  command?: string;
  automated: boolean;
}

export interface ImpactAnalysis {
  affectedEndpoints: string[];
  affectedClients: ClientImpact[];
  dataChanges: DataChange[];
  configurationChanges: ConfigChange[];
  performanceImpact: PerformanceImpact;
}

export interface ClientImpact {
  clientId: string;
  version: string;
  breaking: boolean;
  affectedFeatures: string[];
  migrationRequired: boolean;
}

export interface DataChange {
  table: string;
  type: 'schema' | 'data' | 'index';
  description: string;
  reversible: boolean;
}

export interface ConfigChange {
  key: string;
  oldValue: any;
  newValue: any;
  required: boolean;
}

export interface PerformanceImpact {
  memoryUsage: 'increased' | 'decreased' | 'unchanged';
  cpuUsage: 'increased' | 'decreased' | 'unchanged';
  latency: 'increased' | 'decreased' | 'unchanged';
  throughput: 'increased' | 'decreased' | 'unchanged';
  estimatedChange: number; // percentage
}

export class EvolutionEngine {
  private compatibilityEngine: CompatibilityEngine;
  private migrationTemplates: Map<string, MigrationTemplate> = new Map();

  constructor() {
    this.compatibilityEngine = new CompatibilityEngine();
    this.initializeMigrationTemplates();
  }

  /**
   * Analyze API evolution between versions
   */
  async analyzeEvolution(
    fromVersion: APIVersion,
    toVersion: APIVersion,
    previousVersions?: APIVersion[]
  ): Promise<EvolutionPlan> {
    const isBreaking = SemanticVersionEngine.isBreakingChange(
      fromVersion.version, 
      toVersion.version
    );

    const migrations = await this.generateMigrations(fromVersion, toVersion);
    const risks = await this.assessRisks(fromVersion, toVersion, migrations);
    const rollbackPlan = await this.createRollbackPlan(fromVersion, toVersion);

    const strategy = this.determineEvolutionStrategy(
      fromVersion, 
      toVersion, 
      previousVersions || []
    );

    return {
      fromVersion: fromVersion.version.raw,
      toVersion: toVersion.version.raw,
      strategy,
      migrations,
      risks,
      estimatedDuration: this.calculateTotalDuration(migrations),
      rollbackPlan
    };
  }

  /**
   * Generate comprehensive impact analysis
   */
  async generateImpactAnalysis(
    fromVersion: APIVersion,
    toVersion: APIVersion
  ): Promise<ImpactAnalysis> {
    const breaking = toVersion.changelog.filter(entry => 
      entry.impact === IMPACT_LEVELS.BREAKING
    );

    const affectedEndpoints = this.extractAffectedEndpoints(toVersion.changelog);
    const affectedClients = await this.analyzeClientImpact(fromVersion, toVersion);
    const dataChanges = this.analyzeDataChanges(toVersion.changelog);
    const configurationChanges = this.analyzeConfigChanges(toVersion.changelog);
    const performanceImpact = await this.analyzePerformanceImpact(fromVersion, toVersion);

    return {
      affectedEndpoints,
      affectedClients,
      dataChanges,
      configurationChanges,
      performanceImpact
    };
  }

  /**
   * Generate automated migration scripts
   */
  async generateMigrationScripts(
    fromVersion: APIVersion,
    toVersion: APIVersion,
    language: 'typescript' | 'python' | 'bash' | 'sql' = 'typescript'
  ): Promise<Map<string, string>> {
    const scripts = new Map<string, string>();
    const migrations = await this.generateMigrations(fromVersion, toVersion);

    for (const migration of migrations) {
      const script = await this.generateMigrationScript(migration, language);
      scripts.set(migration.from + '->' + migration.to, script);
    }

    return scripts;
  }

  /**
   * Validate evolution plan
   */
  async validateEvolutionPlan(plan: EvolutionPlan): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let valid = true;

    // Check for missing migrations
    const criticalRisks = plan.risks.filter(r => r.level === 'critical');
    if (criticalRisks.length > 0) {
      valid = false;
      issues.push({
        type: 'critical_risk',
        message: `Critical risks detected: ${criticalRisks.map(r => r.description).join(', ')}`,
        severity: 'error'
      });
    }

    // Validate migration dependencies
    for (const migration of plan.migrations) {
      const dependencyIssues = await this.validateMigrationDependencies(migration);
      issues.push(...dependencyIssues);
      
      if (dependencyIssues.some(i => i.severity === 'error')) {
        valid = false;
      }
    }

    // Check rollback plan completeness
    if (!plan.rollbackPlan.steps.length) {
      issues.push({
        type: 'missing_rollback',
        message: 'Rollback plan is incomplete',
        severity: 'warning'
      });
    }

    return { valid, issues };
  }

  /**
   * Generate migrations between versions
   */
  private async generateMigrations(
    fromVersion: APIVersion,
    toVersion: APIVersion
  ): Promise<Migration[]> {
    const migrations: Migration[] = [];

    // Analyze changelog entries for migration needs
    const breakingChanges = toVersion.changelog.filter(entry => 
      entry.impact === IMPACT_LEVELS.BREAKING
    );

    const deprecatedChanges = toVersion.changelog.filter(entry => 
      entry.type === CHANGE_TYPES.DEPRECATED
    );

    const removedChanges = toVersion.changelog.filter(entry => 
      entry.type === CHANGE_TYPES.REMOVED
    );

    // Generate breaking change migrations
    for (const change of breakingChanges) {
      const migration = await this.generateBreakingChangeMigration(
        fromVersion.version.raw,
        toVersion.version.raw,
        change
      );
      migrations.push(migration);
    }

    // Generate removal migrations
    for (const change of removedChanges) {
      const migration = await this.generateRemovalMigration(
        fromVersion.version.raw,
        toVersion.version.raw,
        change
      );
      migrations.push(migration);
    }

    // Generate deprecation warnings
    for (const change of deprecatedChanges) {
      const migration = await this.generateDeprecationMigration(
        fromVersion.version.raw,
        toVersion.version.raw,
        change
      );
      migrations.push(migration);
    }

    return migrations;
  }

  /**
   * Generate migration for breaking changes
   */
  private async generateBreakingChangeMigration(
    fromVersion: string,
    toVersion: string,
    change: ChangelogEntry
  ): Promise<Migration> {
    const template = this.migrationTemplates.get('breaking_change');
    
    const steps: MigrationStep[] = [
      {
        title: 'Backup current configuration',
        description: 'Create backup before applying breaking changes',
        type: 'config',
        automated: true,
        command: 'npm run backup:config'
      },
      {
        title: `Update ${change.component}`,
        description: change.description,
        type: 'code',
        automated: false,
        validation: {
          type: 'schema',
          rule: 'validate_breaking_change',
          message: 'Breaking change validation failed'
        }
      },
      {
        title: 'Run migration tests',
        description: 'Verify migration completed successfully',
        type: 'code',
        automated: true,
        command: 'npm run test:migration'
      }
    ];

    const risks: Risk[] = [
      {
        level: 'high',
        description: `Breaking change to ${change.component} may affect existing clients`,
        mitigation: 'Use gradual rollout and monitor error rates'
      }
    ];

    return {
      from: fromVersion,
      to: toVersion,
      type: MIGRATION_TYPES.MANUAL,
      description: `Breaking change migration for ${change.component}`,
      steps,
      estimatedTime: 60,
      risks
    };
  }

  /**
   * Generate migration for removals
   */
  private async generateRemovalMigration(
    fromVersion: string,
    toVersion: string,
    change: ChangelogEntry
  ): Promise<Migration> {
    const steps: MigrationStep[] = [
      {
        title: `Remove references to ${change.component}`,
        description: 'Update code to remove deprecated component usage',
        type: 'code',
        automated: false
      },
      {
        title: 'Update documentation',
        description: 'Remove references from documentation',
        type: 'code',
        automated: true,
        command: 'npm run docs:update'
      }
    ];

    const risks: Risk[] = [
      {
        level: 'critical',
        description: `Removal of ${change.component} will break existing functionality`,
        mitigation: 'Ensure all references are updated before deployment'
      }
    ];

    return {
      from: fromVersion,
      to: toVersion,
      type: MIGRATION_TYPES.MANUAL,
      description: `Removal migration for ${change.component}`,
      steps,
      estimatedTime: 30,
      risks
    };
  }

  /**
   * Generate migration for deprecations
   */
  private async generateDeprecationMigration(
    fromVersion: string,
    toVersion: string,
    change: ChangelogEntry
  ): Promise<Migration> {
    const steps: MigrationStep[] = [
      {
        title: `Add deprecation warnings for ${change.component}`,
        description: 'Add runtime deprecation warnings',
        type: 'code',
        automated: true,
        command: 'npm run deprecation:add'
      },
      {
        title: 'Update client documentation',
        description: 'Document alternative approaches',
        type: 'code',
        automated: false
      }
    ];

    return {
      from: fromVersion,
      to: toVersion,
      type: MIGRATION_TYPES.AUTOMATIC,
      description: `Deprecation migration for ${change.component}`,
      steps,
      estimatedTime: 15,
      risks: []
    };
  }

  /**
   * Assess risks for evolution plan
   */
  private async assessRisks(
    fromVersion: APIVersion,
    toVersion: APIVersion,
    migrations: Migration[]
  ): Promise<Risk[]> {
    const risks: Risk[] = [];

    // Version jump risks
    const versionDiff = SemanticVersionEngine.compare(toVersion.version, fromVersion.version);
    if (versionDiff > 1) {
      risks.push({
        level: 'medium',
        description: 'Large version jump may introduce unexpected compatibility issues',
        mitigation: 'Test thoroughly in staging environment'
      });
    }

    // Breaking change risks
    const breakingChanges = toVersion.changelog.filter(c => c.impact === IMPACT_LEVELS.BREAKING);
    if (breakingChanges.length > 3) {
      risks.push({
        level: 'high',
        description: 'Multiple breaking changes increase migration complexity',
        mitigation: 'Consider incremental migration approach'
      });
    }

    // Migration risks
    const manualMigrations = migrations.filter(m => m.type === MIGRATION_TYPES.MANUAL);
    if (manualMigrations.length > 0) {
      risks.push({
        level: 'medium',
        description: 'Manual migration steps require human intervention',
        mitigation: 'Ensure proper documentation and training'
      });
    }

    return risks;
  }

  /**
   * Create rollback plan
   */
  private async createRollbackPlan(
    fromVersion: APIVersion,
    toVersion: APIVersion
  ): Promise<RollbackPlan> {
    const steps: RollbackStep[] = [
      {
        title: 'Stop application services',
        description: 'Gracefully stop all running services',
        command: 'npm run stop:all',
        automated: true
      },
      {
        title: 'Restore database backup',
        description: 'Restore database to previous version state',
        command: 'npm run db:restore',
        automated: true
      },
      {
        title: 'Deploy previous version',
        description: `Deploy version ${fromVersion.version.raw}`,
        command: `npm run deploy:version ${fromVersion.version.raw}`,
        automated: true
      },
      {
        title: 'Verify rollback',
        description: 'Run health checks to verify rollback success',
        command: 'npm run health:check',
        automated: true
      }
    ];

    return {
      steps,
      dataBackupRequired: true,
      estimatedTime: 30,
      risks: [
        {
          level: 'medium',
          description: 'Data loss possible during rollback',
          mitigation: 'Ensure complete backup before upgrade'
        }
      ]
    };
  }

  /**
   * Determine evolution strategy
   */
  private determineEvolutionStrategy(
    fromVersion: APIVersion,
    toVersion: APIVersion,
    previousVersions: APIVersion[]
  ): 'direct' | 'incremental' | 'guided' {
    const breakingChanges = toVersion.changelog.filter(c => 
      c.impact === IMPACT_LEVELS.BREAKING
    ).length;

    const versionGap = SemanticVersionEngine.compare(toVersion.version, fromVersion.version);

    // Direct upgrade for minor changes
    if (breakingChanges === 0 && versionGap === 1) {
      return 'direct';
    }

    // Incremental for major changes with intermediate versions
    if (breakingChanges > 2 || versionGap > 2) {
      const intermediateVersions = SemanticVersionEngine.getVersionsBetween(
        fromVersion.version,
        toVersion.version,
        previousVersions.map(v => v.version.raw)
      );

      if (intermediateVersions.length > 0) {
        return 'incremental';
      }
    }

    // Guided migration for complex cases
    return 'guided';
  }

  /**
   * Extract affected endpoints from changelog
   */
  private extractAffectedEndpoints(changelog: ChangelogEntry[]): string[] {
    return changelog
      .filter(entry => entry.component.includes('/api/'))
      .map(entry => entry.component);
  }

  /**
   * Analyze client impact
   */
  private async analyzeClientImpact(
    fromVersion: APIVersion,
    toVersion: APIVersion
  ): Promise<ClientImpact[]> {
    // Mock implementation - would query client registry
    return [
      {
        clientId: 'web-client',
        version: '1.0.0',
        breaking: true,
        affectedFeatures: ['authentication', 'catalog'],
        migrationRequired: true
      }
    ];
  }

  /**
   * Analyze data changes
   */
  private analyzeDataChanges(changelog: ChangelogEntry[]): DataChange[] {
    return changelog
      .filter(entry => entry.component.includes('database') || entry.component.includes('schema'))
      .map(entry => ({
        table: entry.component,
        type: 'schema' as const,
        description: entry.description,
        reversible: entry.type !== CHANGE_TYPES.REMOVED
      }));
  }

  /**
   * Analyze configuration changes
   */
  private analyzeConfigChanges(changelog: ChangelogEntry[]): ConfigChange[] {
    return changelog
      .filter(entry => entry.component.includes('config'))
      .map(entry => ({
        key: entry.component,
        oldValue: null,
        newValue: null,
        required: entry.impact === IMPACT_LEVELS.BREAKING
      }));
  }

  /**
   * Analyze performance impact
   */
  private async analyzePerformanceImpact(
    fromVersion: APIVersion,
    toVersion: APIVersion
  ): Promise<PerformanceImpact> {
    // Mock implementation - would analyze performance metrics
    return {
      memoryUsage: 'increased',
      cpuUsage: 'unchanged',
      latency: 'decreased',
      throughput: 'increased',
      estimatedChange: 5
    };
  }

  /**
   * Calculate total migration duration
   */
  private calculateTotalDuration(migrations: Migration[]): number {
    return migrations.reduce((total, migration) => total + migration.estimatedTime, 0);
  }

  /**
   * Generate migration script for specific language
   */
  private async generateMigrationScript(
    migration: Migration,
    language: string
  ): Promise<string> {
    switch (language) {
      case 'typescript':
        return this.generateTypeScriptMigrationScript(migration);
      case 'python':
        return this.generatePythonMigrationScript(migration);
      case 'bash':
        return this.generateBashMigrationScript(migration);
      case 'sql':
        return this.generateSQLMigrationScript(migration);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Generate TypeScript migration script
   */
  private generateTypeScriptMigrationScript(migration: Migration): string {
    return `
// Migration: ${migration.from} -> ${migration.to}
// Description: ${migration.description}

import { MigrationRunner } from '@/lib/api-versioning/migration';

export class Migration_${migration.from.replace(/\./g, '_')}_${migration.to.replace(/\./g, '_')} extends MigrationRunner {
  async up(): Promise<void> {
    ${migration.steps.map(step => `
    // ${step.title}
    ${step.automated && step.command ? 
      `await this.runCommand('${step.command}');` : 
      `// Manual step: ${step.description}`
    }
    `).join('\n')}
  }

  async down(): Promise<void> {
    // Rollback steps
    console.log('Rolling back migration ${migration.from} -> ${migration.to}');
  }
}`;
  }

  /**
   * Generate Python migration script
   */
  private generatePythonMigrationScript(migration: Migration): string {
    return `
# Migration: ${migration.from} -> ${migration.to}
# Description: ${migration.description}

import subprocess
from typing import List

class Migration:
    def __init__(self):
        self.from_version = "${migration.from}"
        self.to_version = "${migration.to}"
    
    def up(self) -> None:
        """Apply migration"""
        ${migration.steps.map(step => `
        # ${step.title}
        ${step.automated && step.command ? 
          `subprocess.run("${step.command}", shell=True, check=True)` : 
          `# Manual step: ${step.description}`
        }
        `).join('\n')}
    
    def down(self) -> None:
        """Rollback migration"""
        print(f"Rolling back migration {migration.from} -> {migration.to}")

if __name__ == "__main__":
    migration = Migration()
    migration.up()
`;
  }

  /**
   * Generate Bash migration script
   */
  private generateBashMigrationScript(migration: Migration): string {
    return `#!/bin/bash
# Migration: ${migration.from} -> ${migration.to}
# Description: ${migration.description}

set -e

echo "Starting migration ${migration.from} -> ${migration.to}"

${migration.steps.map(step => `
# ${step.title}
${step.automated && step.command ? step.command : `echo "Manual step: ${step.description}"`}
`).join('\n')}

echo "Migration completed successfully"
`;
  }

  /**
   * Generate SQL migration script
   */
  private generateSQLMigrationScript(migration: Migration): string {
    return `-- Migration: ${migration.from} -> ${migration.to}
-- Description: ${migration.description}

BEGIN;

${migration.steps.filter(step => step.type === 'data').map(step => `
-- ${step.title}
-- ${step.description}
-- Manual SQL changes required
`).join('\n')}

COMMIT;
`;
  }

  /**
   * Validate migration dependencies
   */
  private async validateMigrationDependencies(migration: Migration): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for circular dependencies
    // Check for missing prerequisites
    // Validate step ordering

    return issues;
  }

  /**
   * Initialize migration templates
   */
  private initializeMigrationTemplates(): void {
    // Initialize common migration templates
    this.migrationTemplates.set('breaking_change', {
      type: MIGRATION_TYPES.MANUAL,
      estimatedTime: 60,
      riskLevel: 'high'
    });

    this.migrationTemplates.set('deprecation', {
      type: MIGRATION_TYPES.AUTOMATIC,
      estimatedTime: 15,
      riskLevel: 'low'
    });
  }
}

interface MigrationTemplate {
  type: string;
  estimatedTime: number;
  riskLevel: string;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export default EvolutionEngine;