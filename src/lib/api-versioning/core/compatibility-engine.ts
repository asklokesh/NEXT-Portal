/**
 * Compatibility Engine
 * 
 * Advanced backward compatibility checking and breaking change detection
 * that goes beyond basic version number comparison
 */

import { 
  CompatibilityMatrix, 
  CompatibilityStatus, 
  CompatibilityIssue, 
  APIEndpoint,
  COMPATIBILITY_LEVELS,
  IMPACT_LEVELS 
} from '../types';
import { SemanticVersionEngine } from './semantic-version';

export interface SchemaComparison {
  added: string[];
  removed: string[];
  modified: SchemaChange[];
  deprecated: string[];
}

export interface SchemaChange {
  field: string;
  type: 'type_change' | 'required_change' | 'constraint_change';
  from: any;
  to: any;
  breaking: boolean;
}

export class CompatibilityEngine {
  private schemaCache = new Map<string, any>();
  private compatibilityCache = new Map<string, CompatibilityStatus>();

  /**
   * Check compatibility between two API versions
   */
  async checkCompatibility(
    fromVersion: string,
    toVersion: string,
    endpoints?: APIEndpoint[]
  ): Promise<CompatibilityStatus> {
    const cacheKey = `${fromVersion}->${toVersion}`;
    
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey)!;
    }

    const issues: CompatibilityIssue[] = [];
    let compatible = true;

    // Check semantic version compatibility
    const semverCompatible = SemanticVersionEngine.isCompatible(fromVersion, toVersion);
    if (!semverCompatible) {
      compatible = false;
      issues.push({
        type: 'breaking',
        severity: 'critical',
        component: 'version',
        description: `Major version change from ${fromVersion} to ${toVersion}`,
        workaround: 'Use migration tools or update client code'
      });
    }

    // Check endpoint compatibility
    if (endpoints) {
      const endpointIssues = await this.checkEndpointCompatibility(fromVersion, toVersion, endpoints);
      issues.push(...endpointIssues);
      
      if (endpointIssues.some(issue => issue.severity === 'critical' || issue.severity === 'high')) {
        compatible = false;
      }
    }

    // Check schema compatibility
    const schemaIssues = await this.checkSchemaCompatibility(fromVersion, toVersion);
    issues.push(...schemaIssues);

    if (schemaIssues.some(issue => issue.type === 'breaking')) {
      compatible = false;
    }

    const status: CompatibilityStatus = {
      compatible,
      issues,
      confidence: this.calculateConfidence(issues),
      testCoverage: await this.calculateTestCoverage(fromVersion, toVersion)
    };

    this.compatibilityCache.set(cacheKey, status);
    return status;
  }

  /**
   * Generate comprehensive compatibility matrix
   */
  async generateCompatibilityMatrix(versions: string[]): Promise<CompatibilityMatrix> {
    const matrix: Record<string, Record<string, CompatibilityStatus>> = {};
    const testResults = [];

    for (const fromVersion of versions) {
      matrix[fromVersion] = {};
      
      for (const toVersion of versions) {
        if (fromVersion === toVersion) {
          matrix[fromVersion][toVersion] = {
            compatible: true,
            issues: [],
            confidence: 100,
            testCoverage: 100
          };
        } else {
          const status = await this.checkCompatibility(fromVersion, toVersion);
          matrix[fromVersion][toVersion] = status;
          
          // Run automated tests
          const testResult = await this.runCompatibilityTest(fromVersion, toVersion);
          testResults.push(testResult);
        }
      }
    }

    return {
      versions,
      compatibility: matrix,
      testResults,
      lastUpdated: new Date()
    };
  }

  /**
   * Check endpoint-level compatibility
   */
  private async checkEndpointCompatibility(
    fromVersion: string,
    toVersion: string,
    endpoints: APIEndpoint[]
  ): Promise<CompatibilityIssue[]> {
    const issues: CompatibilityIssue[] = [];
    
    const fromEndpoints = endpoints.filter(e => e.version === fromVersion);
    const toEndpoints = endpoints.filter(e => e.version === toVersion);

    // Check for removed endpoints
    for (const fromEndpoint of fromEndpoints) {
      const matchingEndpoint = toEndpoints.find(e => 
        e.path === fromEndpoint.path && e.method === fromEndpoint.method
      );

      if (!matchingEndpoint) {
        issues.push({
          type: 'breaking',
          severity: 'critical',
          component: `${fromEndpoint.method} ${fromEndpoint.path}`,
          description: 'Endpoint removed in new version',
          workaround: fromEndpoint.alternatives?.join(', ') || 'No alternatives available'
        });
      }
    }

    // Check for deprecated endpoints
    for (const endpoint of toEndpoints) {
      if (endpoint.deprecated) {
        issues.push({
          type: 'deprecated',
          severity: 'medium',
          component: `${endpoint.method} ${endpoint.path}`,
          description: 'Endpoint deprecated in new version',
          workaround: endpoint.alternatives?.join(', ') || 'Migration required'
        });
      }

      if (endpoint.sunset) {
        issues.push({
          type: 'breaking',
          severity: 'high',
          component: `${endpoint.method} ${endpoint.path}`,
          description: `Endpoint will be sunset on ${endpoint.sunset.toISOString()}`,
          workaround: endpoint.alternatives?.join(', ') || 'Migration required before sunset'
        });
      }
    }

    return issues;
  }

  /**
   * Check schema-level compatibility
   */
  private async checkSchemaCompatibility(
    fromVersion: string,
    toVersion: string
  ): Promise<CompatibilityIssue[]> {
    const issues: CompatibilityIssue[] = [];

    try {
      const fromSchema = await this.getSchema(fromVersion);
      const toSchema = await this.getSchema(toVersion);

      if (!fromSchema || !toSchema) {
        return issues;
      }

      const comparison = this.compareSchemas(fromSchema, toSchema);

      // Check for removed fields (breaking)
      for (const removed of comparison.removed) {
        issues.push({
          type: 'breaking',
          severity: 'critical',
          component: removed,
          description: `Field '${removed}' removed in new version`
        });
      }

      // Check for modified fields
      for (const change of comparison.modified) {
        if (change.breaking) {
          issues.push({
            type: 'breaking',
            severity: 'high',
            component: change.field,
            description: `Breaking change to field '${change.field}': ${change.type}`
          });
        } else {
          issues.push({
            type: 'changed',
            severity: 'medium',
            component: change.field,
            description: `Non-breaking change to field '${change.field}': ${change.type}`
          });
        }
      }

      // Check for deprecated fields
      for (const deprecated of comparison.deprecated) {
        issues.push({
          type: 'deprecated',
          severity: 'low',
          component: deprecated,
          description: `Field '${deprecated}' deprecated in new version`
        });
      }

    } catch (error) {
      issues.push({
        type: 'breaking',
        severity: 'high',
        component: 'schema',
        description: `Schema validation failed: ${error.message}`
      });
    }

    return issues;
  }

  /**
   * Compare two schemas for compatibility
   */
  private compareSchemas(fromSchema: any, toSchema: any): SchemaComparison {
    const comparison: SchemaComparison = {
      added: [],
      removed: [],
      modified: [],
      deprecated: []
    };

    const fromFields = this.extractFields(fromSchema);
    const toFields = this.extractFields(toSchema);

    // Find added fields
    for (const field of Object.keys(toFields)) {
      if (!(field in fromFields)) {
        comparison.added.push(field);
      }
    }

    // Find removed fields
    for (const field of Object.keys(fromFields)) {
      if (!(field in toFields)) {
        comparison.removed.push(field);
      }
    }

    // Find modified fields
    for (const field of Object.keys(fromFields)) {
      if (field in toFields) {
        const changes = this.compareFieldDefinitions(fromFields[field], toFields[field]);
        if (changes.length > 0) {
          comparison.modified.push(...changes.map(change => ({ ...change, field })));
        }

        // Check for deprecation
        if (toFields[field].deprecated && !fromFields[field].deprecated) {
          comparison.deprecated.push(field);
        }
      }
    }

    return comparison;
  }

  /**
   * Extract field definitions from schema
   */
  private extractFields(schema: any): Record<string, any> {
    const fields: Record<string, any> = {};

    if (schema.properties) {
      Object.assign(fields, schema.properties);
    }

    if (schema.definitions) {
      for (const [name, definition] of Object.entries(schema.definitions)) {
        if (typeof definition === 'object' && definition.properties) {
          for (const [fieldName, fieldDef] of Object.entries(definition.properties)) {
            fields[`${name}.${fieldName}`] = fieldDef;
          }
        }
      }
    }

    return fields;
  }

  /**
   * Compare field definitions for breaking changes
   */
  private compareFieldDefinitions(from: any, to: any): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Type changes
    if (from.type !== to.type) {
      changes.push({
        field: '',
        type: 'type_change',
        from: from.type,
        to: to.type,
        breaking: this.isBreakingTypeChange(from.type, to.type)
      });
    }

    // Required changes
    const fromRequired = from.required || false;
    const toRequired = to.required || false;
    
    if (fromRequired !== toRequired) {
      changes.push({
        field: '',
        type: 'required_change',
        from: fromRequired,
        to: toRequired,
        breaking: !fromRequired && toRequired // Making optional field required is breaking
      });
    }

    // Constraint changes
    if (this.hasConstraintChanges(from, to)) {
      const breaking = this.isBreakingConstraintChange(from, to);
      changes.push({
        field: '',
        type: 'constraint_change',
        from: this.extractConstraints(from),
        to: this.extractConstraints(to),
        breaking
      });
    }

    return changes;
  }

  /**
   * Check if type change is breaking
   */
  private isBreakingTypeChange(fromType: string, toType: string): boolean {
    const compatibleChanges = [
      ['integer', 'number'],
      ['string', 'string'],
      ['boolean', 'boolean']
    ];

    return !compatibleChanges.some(([from, to]) => 
      fromType === from && toType === to
    );
  }

  /**
   * Check for constraint changes
   */
  private hasConstraintChanges(from: any, to: any): boolean {
    const constraintKeys = ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'enum'];
    
    return constraintKeys.some(key => from[key] !== to[key]);
  }

  /**
   * Check if constraint change is breaking
   */
  private isBreakingConstraintChange(from: any, to: any): boolean {
    // More restrictive constraints are breaking
    if (from.minimum !== undefined && to.minimum !== undefined && to.minimum > from.minimum) return true;
    if (from.maximum !== undefined && to.maximum !== undefined && to.maximum < from.maximum) return true;
    if (from.minLength !== undefined && to.minLength !== undefined && to.minLength > from.minLength) return true;
    if (from.maxLength !== undefined && to.maxLength !== undefined && to.maxLength < from.maxLength) return true;
    
    // Enum constraint changes
    if (from.enum && to.enum) {
      const removedValues = from.enum.filter((val: any) => !to.enum.includes(val));
      return removedValues.length > 0;
    }

    return false;
  }

  /**
   * Extract constraints from field definition
   */
  private extractConstraints(field: any): Record<string, any> {
    const constraints: Record<string, any> = {};
    const constraintKeys = ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'enum'];
    
    for (const key of constraintKeys) {
      if (field[key] !== undefined) {
        constraints[key] = field[key];
      }
    }

    return constraints;
  }

  /**
   * Get schema for version
   */
  private async getSchema(version: string): Promise<any> {
    if (this.schemaCache.has(version)) {
      return this.schemaCache.get(version);
    }

    try {
      // In a real implementation, this would fetch from a schema registry
      const schema = await this.fetchSchemaFromRegistry(version);
      this.schemaCache.set(version, schema);
      return schema;
    } catch (error) {
      console.error(`Failed to fetch schema for version ${version}:`, error);
      return null;
    }
  }

  /**
   * Fetch schema from registry (mock implementation)
   */
  private async fetchSchemaFromRegistry(version: string): Promise<any> {
    // Mock implementation - in reality, this would fetch from a schema registry
    return {
      version,
      type: 'object',
      properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', format: 'email' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  /**
   * Calculate confidence score for compatibility analysis
   */
  private calculateConfidence(issues: CompatibilityIssue[]): number {
    if (issues.length === 0) return 100;

    const weights = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5
    };

    const totalPenalty = issues.reduce((sum, issue) => sum + weights[issue.severity], 0);
    return Math.max(0, 100 - totalPenalty);
  }

  /**
   * Calculate test coverage for version pair
   */
  private async calculateTestCoverage(fromVersion: string, toVersion: string): Promise<number> {
    // Mock implementation - in reality, this would check test coverage
    return 85;
  }

  /**
   * Run automated compatibility test
   */
  private async runCompatibilityTest(fromVersion: string, toVersion: string) {
    // Mock implementation - would run actual tests
    return {
      testId: `compat-${fromVersion}-${toVersion}`,
      fromVersion,
      toVersion,
      status: 'passed' as const,
      duration: Math.random() * 1000,
      errors: [],
      timestamp: new Date()
    };
  }
}

export default CompatibilityEngine;