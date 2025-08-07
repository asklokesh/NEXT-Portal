/**
 * Plugin Migration Service
 * Handles data migration between plugin versions with validation and rollback
 */

import { z } from 'zod';

interface MigrationPath {
  valid: boolean;
  reason?: string;
  suggestedPath?: string[];
  steps: MigrationStep[];
}

interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  script?: string;
  required: boolean;
  estimatedDuration: number;
}

interface MigrationResult {
  success: boolean;
  dataTransformed: number;
  errors: string[];
  warnings: string[];
  duration: number;
  rollbackPoint?: string;
}

interface MigrationScript {
  version: string;
  up: (data: any) => Promise<any>;
  down: (data: any) => Promise<any>;
  validate: (data: any) => boolean;
}

export class PluginMigrationService {
  private migrationScripts: Map<string, MigrationScript[]> = new Map();
  private migrationHistory: Map<string, Array<{timestamp: Date, migration: string, status: string}>> = new Map();
  private rollbackPoints: Map<string, any> = new Map();

  /**
   * Validate migration path between versions
   */
  async validateMigrationPath(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<MigrationPath> {
    const scripts = this.migrationScripts.get(pluginId) || [];
    const steps: MigrationStep[] = [];

    // Check if direct migration path exists
    const directScript = scripts.find(
      s => s.version === `${fromVersion}->${toVersion}`
    );

    if (directScript) {
      steps.push({
        fromVersion,
        toVersion,
        script: `${fromVersion}->${toVersion}`,
        required: true,
        estimatedDuration: 60000 // 1 minute estimate
      });

      return {
        valid: true,
        steps
      };
    }

    // Find multi-step migration path
    const path = this.findMigrationPath(pluginId, fromVersion, toVersion);
    
    if (!path) {
      return {
        valid: false,
        reason: `No migration path found from ${fromVersion} to ${toVersion}`,
        suggestedPath: this.suggestAlternativePath(pluginId, fromVersion, toVersion),
        steps: []
      };
    }

    // Build migration steps
    for (let i = 0; i < path.length - 1; i++) {
      steps.push({
        fromVersion: path[i],
        toVersion: path[i + 1],
        script: `${path[i]}->${path[i + 1]}`,
        required: true,
        estimatedDuration: 60000
      });
    }

    return {
      valid: true,
      steps
    };
  }

  /**
   * Execute migration between versions
   */
  async executeMigration(params: {
    pluginId: string;
    fromVersion: string;
    toVersion: string;
    migrationScript?: string;
    dryRun: boolean;
    rollbackOnError: boolean;
    dataMappings?: Record<string, any>;
  }): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let dataTransformed = 0;

    try {
      // Validate migration path
      const migrationPath = await this.validateMigrationPath(
        params.pluginId,
        params.fromVersion,
        params.toVersion
      );

      if (!migrationPath.valid) {
        return {
          success: false,
          dataTransformed: 0,
          errors: [migrationPath.reason || 'Invalid migration path'],
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      // Create rollback point if requested
      if (params.rollbackOnError) {
        const rollbackId = await this.createRollbackPoint(params.pluginId);
        console.log(`Created rollback point: ${rollbackId}`);
      }

      // Execute migration steps
      for (const step of migrationPath.steps) {
        if (params.dryRun) {
          console.log(`[DRY RUN] Would migrate from ${step.fromVersion} to ${step.toVersion}`);
          dataTransformed += await this.estimateDataTransformation(params.pluginId, step);
        } else {
          try {
            const stepResult = await this.executeMigrationStep(
              params.pluginId,
              step,
              params.dataMappings
            );
            dataTransformed += stepResult.recordsTransformed;
            
            if (stepResult.warnings.length > 0) {
              warnings.push(...stepResult.warnings);
            }
          } catch (error) {
            errors.push(`Migration step ${step.fromVersion}->${step.toVersion} failed: ${error}`);
            
            if (params.rollbackOnError) {
              await this.rollbackMigration(params.pluginId);
              return {
                success: false,
                dataTransformed,
                errors,
                warnings,
                duration: Date.now() - startTime,
                rollbackPoint: 'rolled-back'
              };
            }
            
            throw error;
          }
        }
      }

      // Validate migrated data
      if (!params.dryRun) {
        const validationResult = await this.validateMigratedData(
          params.pluginId,
          params.toVersion
        );

        if (!validationResult.valid) {
          errors.push(...validationResult.errors);
          if (params.rollbackOnError) {
            await this.rollbackMigration(params.pluginId);
          }
        }
      }

      // Record migration in history
      this.recordMigration(params.pluginId, {
        timestamp: new Date(),
        migration: `${params.fromVersion}->${params.toVersion}`,
        status: errors.length === 0 ? 'success' : 'failed'
      });

      return {
        success: errors.length === 0,
        dataTransformed,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        dataTransformed,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Create a rollback point before migration
   */
  private async createRollbackPoint(pluginId: string): Promise<string> {
    const rollbackId = `rollback_${Date.now()}`;
    
    // In production, this would create a database snapshot or backup
    const data = await this.getPluginData(pluginId);
    this.rollbackPoints.set(rollbackId, {
      pluginId,
      timestamp: new Date(),
      data
    });

    return rollbackId;
  }

  /**
   * Rollback migration to previous state
   */
  private async rollbackMigration(pluginId: string): Promise<void> {
    // Find most recent rollback point
    const rollbackPoint = Array.from(this.rollbackPoints.entries())
      .filter(([_, point]) => point.pluginId === pluginId)
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())[0];

    if (!rollbackPoint) {
      throw new Error('No rollback point available');
    }

    // Restore data from rollback point
    await this.restorePluginData(pluginId, rollbackPoint[1].data);
    
    // Clean up rollback point
    this.rollbackPoints.delete(rollbackPoint[0]);
  }

  /**
   * Execute a single migration step
   */
  private async executeMigrationStep(
    pluginId: string,
    step: MigrationStep,
    dataMappings?: Record<string, any>
  ): Promise<{recordsTransformed: number; warnings: string[]}> {
    const scripts = this.migrationScripts.get(pluginId) || [];
    const script = scripts.find(s => s.version === step.script);

    if (!script) {
      // Use default migration logic if no script provided
      return this.executeDefaultMigration(pluginId, step, dataMappings);
    }

    // Get plugin data
    const data = await this.getPluginData(pluginId);
    
    // Apply migration script
    const transformedData = await script.up(data);
    
    // Save transformed data
    await this.savePluginData(pluginId, transformedData);

    return {
      recordsTransformed: Array.isArray(transformedData) ? transformedData.length : 1,
      warnings: []
    };
  }

  /**
   * Execute default migration when no script is provided
   */
  private async executeDefaultMigration(
    pluginId: string,
    step: MigrationStep,
    dataMappings?: Record<string, any>
  ): Promise<{recordsTransformed: number; warnings: string[]}> {
    const warnings: string[] = [];
    const data = await this.getPluginData(pluginId);

    // Apply data mappings if provided
    if (dataMappings) {
      for (const [oldField, newField] of Object.entries(dataMappings)) {
        if (data[oldField] !== undefined) {
          data[newField] = data[oldField];
          delete data[oldField];
        } else {
          warnings.push(`Field ${oldField} not found in data`);
        }
      }
    }

    // Update version metadata
    data.version = step.toVersion;
    data.migratedAt = new Date();

    await this.savePluginData(pluginId, data);

    return {
      recordsTransformed: 1,
      warnings
    };
  }

  /**
   * Validate migrated data
   */
  private async validateMigratedData(
    pluginId: string,
    version: string
  ): Promise<{valid: boolean; errors: string[]}> {
    const errors: string[] = [];
    const data = await this.getPluginData(pluginId);

    // Basic validation
    if (!data.version || data.version !== version) {
      errors.push(`Version mismatch: expected ${version}, got ${data.version}`);
    }

    // Check required fields based on version
    const requiredFields = this.getRequiredFieldsForVersion(pluginId, version);
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Required field ${field} is missing`);
      }
    }

    // Run custom validation if available
    const scripts = this.migrationScripts.get(pluginId) || [];
    const validationScript = scripts.find(s => s.version === version);
    
    if (validationScript && validationScript.validate) {
      if (!validationScript.validate(data)) {
        errors.push('Custom validation failed');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Find migration path using graph traversal
   */
  private findMigrationPath(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): string[] | null {
    // Build version graph from available scripts
    const graph = this.buildVersionGraph(pluginId);
    
    // Use BFS to find shortest path
    const queue: string[][] = [[fromVersion]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === toVersion) {
        return path;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push([...path, neighbor]);
        }
      }
    }

    return null;
  }

  /**
   * Build version graph from migration scripts
   */
  private buildVersionGraph(pluginId: string): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const scripts = this.migrationScripts.get(pluginId) || [];

    for (const script of scripts) {
      const [from, to] = script.version.split('->');
      if (!graph.has(from)) {
        graph.set(from, []);
      }
      graph.get(from)!.push(to);
    }

    return graph;
  }

  /**
   * Suggest alternative migration paths
   */
  private suggestAlternativePath(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): string[] {
    // In production, implement more sophisticated path finding
    return [`Consider migrating to an intermediate version first`];
  }

  /**
   * Estimate data transformation for dry run
   */
  private async estimateDataTransformation(
    pluginId: string,
    step: MigrationStep
  ): Promise<number> {
    // In production, analyze actual data volume
    return Math.floor(Math.random() * 1000) + 100;
  }

  /**
   * Get plugin data (mock implementation)
   */
  private async getPluginData(pluginId: string): Promise<any> {
    // In production, fetch from database
    return {
      pluginId,
      version: '1.0.0',
      config: {},
      data: {}
    };
  }

  /**
   * Save plugin data (mock implementation)
   */
  private async savePluginData(pluginId: string, data: any): Promise<void> {
    // In production, save to database
    console.log(`Saving data for plugin ${pluginId}:`, data);
  }

  /**
   * Restore plugin data from backup
   */
  private async restorePluginData(pluginId: string, data: any): Promise<void> {
    await this.savePluginData(pluginId, data);
  }

  /**
   * Get required fields for version
   */
  private getRequiredFieldsForVersion(pluginId: string, version: string): string[] {
    // In production, this would be defined in plugin metadata
    return ['version', 'config'];
  }

  /**
   * Record migration in history
   */
  private recordMigration(
    pluginId: string,
    migration: {timestamp: Date; migration: string; status: string}
  ): void {
    if (!this.migrationHistory.has(pluginId)) {
      this.migrationHistory.set(pluginId, []);
    }
    this.migrationHistory.get(pluginId)!.push(migration);
  }
}