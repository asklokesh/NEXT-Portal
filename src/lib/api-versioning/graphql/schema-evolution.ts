/**
 * GraphQL Schema Evolution Engine
 * 
 * Advanced GraphQL versioning with schema evolution, field-level versioning,
 * and automatic deprecation management
 */

import { 
  GraphQLVersioning, 
  FieldVersion, 
  TypeVersion, 
  DirectiveVersion,
  TypeChange,
  GRAPHQL_DIRECTIVES 
} from '../types';

export interface SchemaEvolutionPlan {
  fromVersion: string;
  toVersion: string;
  changes: SchemaChange[];
  migrations: SchemaMigration[];
  deprecations: SchemaDeprecation[];
  breaking: boolean;
}

export interface SchemaChange {
  type: 'field_added' | 'field_removed' | 'field_changed' | 'type_added' | 'type_removed' | 'type_changed';
  path: string;
  description: string;
  breaking: boolean;
  deprecation?: SchemaDeprecation;
}

export interface SchemaMigration {
  type: 'resolver' | 'data' | 'schema';
  description: string;
  automated: boolean;
  script?: string;
}

export interface SchemaDeprecation {
  reason: string;
  replacement?: string;
  removal?: string; // version when it will be removed
}

export interface GraphQLField {
  name: string;
  type: string;
  args?: Record<string, GraphQLArgument>;
  deprecated?: boolean;
  deprecationReason?: string;
  version?: FieldVersion;
}

export interface GraphQLArgument {
  type: string;
  defaultValue?: any;
  required: boolean;
  deprecated?: boolean;
}

export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  fields?: Record<string, GraphQLField>;
  interfaces?: string[];
  possibleTypes?: string[];
  enumValues?: string[];
  deprecated?: boolean;
  version?: TypeVersion;
}

export interface GraphQLSchema {
  version: string;
  types: Record<string, GraphQLType>;
  directives: Record<string, GraphQLDirective>;
  queries: Record<string, GraphQLField>;
  mutations: Record<string, GraphQLField>;
  subscriptions: Record<string, GraphQLField>;
}

export interface GraphQLDirective {
  name: string;
  locations: string[];
  args: Record<string, GraphQLArgument>;
  repeatable: boolean;
  version?: DirectiveVersion;
}

export class SchemaEvolutionEngine {
  private schemaRegistry: Map<string, GraphQLSchema> = new Map();
  private versioningMetadata: Map<string, GraphQLVersioning> = new Map();

  /**
   * Register a GraphQL schema version
   */
  registerSchema(version: string, schema: GraphQLSchema, versioning: GraphQLVersioning): void {
    this.schemaRegistry.set(version, schema);
    this.versioningMetadata.set(version, versioning);
  }

  /**
   * Evolve schema from one version to another
   */
  async evolveSchema(fromVersion: string, toVersion: string): Promise<SchemaEvolutionPlan> {
    const fromSchema = this.schemaRegistry.get(fromVersion);
    const toSchema = this.schemaRegistry.get(toVersion);

    if (!fromSchema || !toSchema) {
      throw new Error(`Schema not found for version ${fromVersion} or ${toVersion}`);
    }

    const changes = this.compareSchemas(fromSchema, toSchema);
    const migrations = this.generateSchemaMigrations(changes);
    const deprecations = this.extractDeprecations(changes);
    const breaking = changes.some(change => change.breaking);

    return {
      fromVersion,
      toVersion,
      changes,
      migrations,
      deprecations,
      breaking
    };
  }

  /**
   * Generate SDL with versioning directives
   */
  generateVersionedSDL(version: string): string {
    const schema = this.schemaRegistry.get(version);
    const versioning = this.versioningMetadata.get(version);

    if (!schema || !versioning) {
      throw new Error(`Schema or versioning metadata not found for version ${version}`);
    }

    let sdl = `# GraphQL Schema Version ${version}\n\n`;

    // Add custom directives
    sdl += this.generateVersioningDirectives();

    // Generate types with versioning information
    for (const [typeName, type] of Object.entries(schema.types)) {
      sdl += this.generateTypeSDL(type, versioning);
    }

    // Generate root types
    sdl += this.generateRootTypesSDL(schema, versioning);

    return sdl;
  }

  /**
   * Create versioned resolver map
   */
  createVersionedResolvers(version: string, baseResolvers: any): any {
    const schema = this.schemaRegistry.get(version);
    const versioning = this.versioningMetadata.get(version);

    if (!schema || !versioning) {
      return baseResolvers;
    }

    const versionedResolvers = { ...baseResolvers };

    // Add version-aware field resolvers
    for (const [typeName, type] of Object.entries(schema.types)) {
      if (type.fields && versionedResolvers[typeName]) {
        for (const [fieldName, field] of Object.entries(type.fields)) {
          const fieldVersion = versioning.fieldVersioning[`${typeName}.${fieldName}`];
          
          if (fieldVersion && (fieldVersion.deprecatedIn || fieldVersion.removedIn)) {
            versionedResolvers[typeName][fieldName] = this.createVersionAwareResolver(
              versionedResolvers[typeName][fieldName],
              fieldVersion,
              version
            );
          }
        }
      }
    }

    return versionedResolvers;
  }

  /**
   * Validate schema compatibility
   */
  validateCompatibility(fromVersion: string, toVersion: string): CompatibilityResult {
    const plan = this.evolveSchema(fromVersion, toVersion);
    const issues: CompatibilityIssue[] = [];

    // Check for breaking changes
    const breakingChanges = plan.changes.filter(change => change.breaking);
    for (const change of breakingChanges) {
      issues.push({
        type: 'breaking',
        severity: 'high',
        message: `Breaking change: ${change.description}`,
        path: change.path
      });
    }

    // Check for removed fields
    const removedFields = plan.changes.filter(change => change.type === 'field_removed');
    for (const change of removedFields) {
      issues.push({
        type: 'removal',
        severity: 'critical',
        message: `Field removed: ${change.path}`,
        path: change.path
      });
    }

    // Check for type changes
    const changedTypes = plan.changes.filter(change => change.type === 'type_changed');
    for (const change of changedTypes) {
      issues.push({
        type: 'type_change',
        severity: 'medium',
        message: `Type changed: ${change.path}`,
        path: change.path
      });
    }

    return {
      compatible: !plan.breaking,
      issues,
      confidence: this.calculateCompatibilityConfidence(issues)
    };
  }

  /**
   * Generate federation-compatible schema
   */
  generateFederatedSchema(version: string, serviceName: string): string {
    const schema = this.schemaRegistry.get(version);
    if (!schema) {
      throw new Error(`Schema not found for version ${version}`);
    }

    let sdl = `# Federated GraphQL Schema - ${serviceName} v${version}\n\n`;
    
    // Add federation directives
    sdl += `
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@requires", "@provides", "@external", "@tag", "@shareable"])
    `;

    // Generate types with federation directives
    for (const [typeName, type] of Object.entries(schema.types)) {
      if (type.kind === 'OBJECT' && this.isEntityType(type)) {
        sdl += this.generateFederatedTypeSDL(type, version);
      } else {
        sdl += this.generateTypeSDL(type);
      }
    }

    return sdl;
  }

  /**
   * Compare two schemas for differences
   */
  private compareSchemas(fromSchema: GraphQLSchema, toSchema: GraphQLSchema): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Compare types
    changes.push(...this.compareTypes(fromSchema.types, toSchema.types));

    // Compare queries
    changes.push(...this.compareFields('Query', fromSchema.queries, toSchema.queries));

    // Compare mutations
    changes.push(...this.compareMutations(fromSchema.mutations, toSchema.mutations));

    // Compare subscriptions
    changes.push(...this.compareFields('Subscription', fromSchema.subscriptions, toSchema.subscriptions));

    return changes;
  }

  /**
   * Compare types between schemas
   */
  private compareTypes(fromTypes: Record<string, GraphQLType>, toTypes: Record<string, GraphQLType>): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Find added types
    for (const typeName of Object.keys(toTypes)) {
      if (!(typeName in fromTypes)) {
        changes.push({
          type: 'type_added',
          path: typeName,
          description: `Type ${typeName} added`,
          breaking: false
        });
      }
    }

    // Find removed types
    for (const typeName of Object.keys(fromTypes)) {
      if (!(typeName in toTypes)) {
        changes.push({
          type: 'type_removed',
          path: typeName,
          description: `Type ${typeName} removed`,
          breaking: true
        });
      }
    }

    // Find changed types
    for (const typeName of Object.keys(fromTypes)) {
      if (typeName in toTypes) {
        const typeChanges = this.compareTypeDefinitions(
          typeName,
          fromTypes[typeName],
          toTypes[typeName]
        );
        changes.push(...typeChanges);
      }
    }

    return changes;
  }

  /**
   * Compare type definitions
   */
  private compareTypeDefinitions(
    typeName: string,
    fromType: GraphQLType,
    toType: GraphQLType
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Compare fields
    if (fromType.fields && toType.fields) {
      changes.push(...this.compareFields(typeName, fromType.fields, toType.fields));
    }

    // Compare interfaces (for object types)
    if (fromType.interfaces && toType.interfaces) {
      const removedInterfaces = fromType.interfaces.filter(i => !toType.interfaces!.includes(i));
      const addedInterfaces = toType.interfaces.filter(i => !fromType.interfaces!.includes(i));

      for (const iface of removedInterfaces) {
        changes.push({
          type: 'type_changed',
          path: `${typeName}.interfaces`,
          description: `Interface ${iface} removed from ${typeName}`,
          breaking: true
        });
      }

      for (const iface of addedInterfaces) {
        changes.push({
          type: 'type_changed',
          path: `${typeName}.interfaces`,
          description: `Interface ${iface} added to ${typeName}`,
          breaking: false
        });
      }
    }

    return changes;
  }

  /**
   * Compare fields between types
   */
  private compareFields(
    typeName: string,
    fromFields: Record<string, GraphQLField>,
    toFields: Record<string, GraphQLField>
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Find added fields
    for (const fieldName of Object.keys(toFields)) {
      if (!(fieldName in fromFields)) {
        changes.push({
          type: 'field_added',
          path: `${typeName}.${fieldName}`,
          description: `Field ${fieldName} added to ${typeName}`,
          breaking: false
        });
      }
    }

    // Find removed fields
    for (const fieldName of Object.keys(fromFields)) {
      if (!(fieldName in toFields)) {
        changes.push({
          type: 'field_removed',
          path: `${typeName}.${fieldName}`,
          description: `Field ${fieldName} removed from ${typeName}`,
          breaking: true
        });
      }
    }

    // Find changed fields
    for (const fieldName of Object.keys(fromFields)) {
      if (fieldName in toFields) {
        const fieldChanges = this.compareFieldDefinitions(
          `${typeName}.${fieldName}`,
          fromFields[fieldName],
          toFields[fieldName]
        );
        changes.push(...fieldChanges);
      }
    }

    return changes;
  }

  /**
   * Compare mutations with special handling for breaking changes
   */
  private compareMutations(
    fromMutations: Record<string, GraphQLField>,
    toMutations: Record<string, GraphQLField>
  ): SchemaChange[] {
    const changes = this.compareFields('Mutation', fromMutations, toMutations);

    // Mutations are more sensitive to breaking changes
    return changes.map(change => ({
      ...change,
      breaking: change.breaking || change.type === 'field_changed'
    }));
  }

  /**
   * Compare field definitions
   */
  private compareFieldDefinitions(
    fieldPath: string,
    fromField: GraphQLField,
    toField: GraphQLField
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Type changes
    if (fromField.type !== toField.type) {
      const breaking = this.isBreakingTypeChange(fromField.type, toField.type);
      changes.push({
        type: 'field_changed',
        path: fieldPath,
        description: `Field type changed from ${fromField.type} to ${toField.type}`,
        breaking
      });
    }

    // Argument changes
    if (fromField.args && toField.args) {
      const argChanges = this.compareArguments(fieldPath, fromField.args, toField.args);
      changes.push(...argChanges);
    }

    // Deprecation changes
    if (!fromField.deprecated && toField.deprecated) {
      changes.push({
        type: 'field_changed',
        path: fieldPath,
        description: `Field ${fieldPath} deprecated`,
        breaking: false,
        deprecation: {
          reason: toField.deprecationReason || 'Field deprecated',
          replacement: undefined
        }
      });
    }

    return changes;
  }

  /**
   * Compare field arguments
   */
  private compareArguments(
    fieldPath: string,
    fromArgs: Record<string, GraphQLArgument>,
    toArgs: Record<string, GraphQLArgument>
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Added arguments
    for (const argName of Object.keys(toArgs)) {
      if (!(argName in fromArgs)) {
        const breaking = toArgs[argName].required;
        changes.push({
          type: 'field_changed',
          path: `${fieldPath}(${argName})`,
          description: `Argument ${argName} added to ${fieldPath}`,
          breaking
        });
      }
    }

    // Removed arguments
    for (const argName of Object.keys(fromArgs)) {
      if (!(argName in toArgs)) {
        changes.push({
          type: 'field_changed',
          path: `${fieldPath}(${argName})`,
          description: `Argument ${argName} removed from ${fieldPath}`,
          breaking: true
        });
      }
    }

    // Changed arguments
    for (const argName of Object.keys(fromArgs)) {
      if (argName in toArgs) {
        const fromArg = fromArgs[argName];
        const toArg = toArgs[argName];

        if (fromArg.type !== toArg.type) {
          const breaking = this.isBreakingTypeChange(fromArg.type, toArg.type);
          changes.push({
            type: 'field_changed',
            path: `${fieldPath}(${argName})`,
            description: `Argument ${argName} type changed from ${fromArg.type} to ${toArg.type}`,
            breaking
          });
        }

        if (fromArg.required !== toArg.required) {
          const breaking = !fromArg.required && toArg.required;
          changes.push({
            type: 'field_changed',
            path: `${fieldPath}(${argName})`,
            description: `Argument ${argName} required status changed`,
            breaking
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if type change is breaking
   */
  private isBreakingTypeChange(fromType: string, toType: string): boolean {
    // Widening types (adding null, making list) is not breaking for responses
    // Narrowing types (removing null, making non-list) is breaking
    
    // Basic compatibility rules
    if (fromType === toType) return false;
    
    // Non-null to nullable is not breaking for return types
    if (fromType.endsWith('!') && toType === fromType.slice(0, -1)) return false;
    
    // Nullable to non-null is breaking for return types
    if (toType.endsWith('!') && fromType === toType.slice(0, -1)) return true;
    
    // Different base types are breaking
    return true;
  }

  /**
   * Generate schema migrations
   */
  private generateSchemaMigrations(changes: SchemaChange[]): SchemaMigration[] {
    const migrations: SchemaMigration[] = [];

    for (const change of changes) {
      if (change.breaking) {
        migrations.push({
          type: 'resolver',
          description: `Handle breaking change: ${change.description}`,
          automated: false,
          script: `// TODO: Implement resolver migration for ${change.path}`
        });
      }

      if (change.type === 'field_added') {
        migrations.push({
          type: 'resolver',
          description: `Add resolver for new field: ${change.path}`,
          automated: true,
          script: this.generateResolverScript(change.path)
        });
      }
    }

    return migrations;
  }

  /**
   * Extract deprecations from changes
   */
  private extractDeprecations(changes: SchemaChange[]): SchemaDeprecation[] {
    return changes
      .filter(change => change.deprecation)
      .map(change => change.deprecation!);
  }

  /**
   * Generate versioning directives
   */
  private generateVersioningDirectives(): string {
    return `
directive @${GRAPHQL_DIRECTIVES.VERSIONED}(introducedIn: String!, deprecatedIn: String, removedIn: String) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT
directive @${GRAPHQL_DIRECTIVES.DEPRECATED}(reason: String, replacement: String) on FIELD_DEFINITION | ENUM_VALUE
directive @${GRAPHQL_DIRECTIVES.SINCE}(version: String!) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT
directive @${GRAPHQL_DIRECTIVES.UNTIL}(version: String!) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT

`;
  }

  /**
   * Generate SDL for a type with versioning information
   */
  private generateTypeSDL(type: GraphQLType, versioning?: GraphQLVersioning): string {
    let sdl = '';

    const typeVersion = versioning?.typeVersioning[type.name];
    const versionDirective = typeVersion ? 
      ` @${GRAPHQL_DIRECTIVES.VERSIONED}(introducedIn: "${typeVersion.introducedIn}"${typeVersion.deprecatedIn ? `, deprecatedIn: "${typeVersion.deprecatedIn}"` : ''}${typeVersion.removedIn ? `, removedIn: "${typeVersion.removedIn}"` : ''})` : '';

    switch (type.kind) {
      case 'OBJECT':
        sdl += `type ${type.name}${versionDirective} {\n`;
        if (type.fields) {
          for (const [fieldName, field] of Object.entries(type.fields)) {
            sdl += this.generateFieldSDL(fieldName, field, `${type.name}.${fieldName}`, versioning);
          }
        }
        sdl += '}\n\n';
        break;

      case 'INTERFACE':
        sdl += `interface ${type.name}${versionDirective} {\n`;
        if (type.fields) {
          for (const [fieldName, field] of Object.entries(type.fields)) {
            sdl += this.generateFieldSDL(fieldName, field, `${type.name}.${fieldName}`, versioning);
          }
        }
        sdl += '}\n\n';
        break;

      case 'UNION':
        sdl += `union ${type.name}${versionDirective} = ${type.possibleTypes?.join(' | ')}\n\n`;
        break;

      case 'ENUM':
        sdl += `enum ${type.name}${versionDirective} {\n`;
        if (type.enumValues) {
          for (const value of type.enumValues) {
            sdl += `  ${value}\n`;
          }
        }
        sdl += '}\n\n';
        break;

      case 'INPUT_OBJECT':
        sdl += `input ${type.name}${versionDirective} {\n`;
        if (type.fields) {
          for (const [fieldName, field] of Object.entries(type.fields)) {
            sdl += this.generateFieldSDL(fieldName, field, `${type.name}.${fieldName}`, versioning);
          }
        }
        sdl += '}\n\n';
        break;
    }

    return sdl;
  }

  /**
   * Generate SDL for a field with versioning information
   */
  private generateFieldSDL(
    fieldName: string,
    field: GraphQLField,
    fieldPath: string,
    versioning?: GraphQLVersioning
  ): string {
    const fieldVersion = versioning?.fieldVersioning[fieldPath];
    const versionDirective = fieldVersion ?
      ` @${GRAPHQL_DIRECTIVES.VERSIONED}(introducedIn: "${fieldVersion.introducedIn}"${fieldVersion.deprecatedIn ? `, deprecatedIn: "${fieldVersion.deprecatedIn}"` : ''}${fieldVersion.removedIn ? `, removedIn: "${fieldVersion.removedIn}"` : ''})` : '';

    const deprecatedDirective = field.deprecated ?
      ` @deprecated(reason: "${field.deprecationReason || 'Field deprecated'}")` : '';

    const args = field.args ?
      `(${Object.entries(field.args).map(([name, arg]) => 
        `${name}: ${arg.type}${arg.defaultValue !== undefined ? ` = ${arg.defaultValue}` : ''}`
      ).join(', ')})` : '';

    return `  ${fieldName}${args}: ${field.type}${versionDirective}${deprecatedDirective}\n`;
  }

  /**
   * Generate root types SDL
   */
  private generateRootTypesSDL(schema: GraphQLSchema, versioning: GraphQLVersioning): string {
    let sdl = '';

    if (Object.keys(schema.queries).length > 0) {
      sdl += 'type Query {\n';
      for (const [queryName, query] of Object.entries(schema.queries)) {
        sdl += this.generateFieldSDL(queryName, query, `Query.${queryName}`, versioning);
      }
      sdl += '}\n\n';
    }

    if (Object.keys(schema.mutations).length > 0) {
      sdl += 'type Mutation {\n';
      for (const [mutationName, mutation] of Object.entries(schema.mutations)) {
        sdl += this.generateFieldSDL(mutationName, mutation, `Mutation.${mutationName}`, versioning);
      }
      sdl += '}\n\n';
    }

    if (Object.keys(schema.subscriptions).length > 0) {
      sdl += 'type Subscription {\n';
      for (const [subscriptionName, subscription] of Object.entries(schema.subscriptions)) {
        sdl += this.generateFieldSDL(subscriptionName, subscription, `Subscription.${subscriptionName}`, versioning);
      }
      sdl += '}\n\n';
    }

    return sdl;
  }

  /**
   * Check if type is an entity (for federation)
   */
  private isEntityType(type: GraphQLType): boolean {
    return type.fields && '@key' in (type.fields as any);
  }

  /**
   * Generate federated type SDL
   */
  private generateFederatedTypeSDL(type: GraphQLType, version: string): string {
    return this.generateTypeSDL(type);
  }

  /**
   * Create version-aware resolver
   */
  private createVersionAwareResolver(originalResolver: any, fieldVersion: FieldVersion, currentVersion: string): any {
    return async (parent: any, args: any, context: any, info: any) => {
      // Check if field is deprecated in current version
      if (fieldVersion.deprecatedIn && 
          this.isVersionAfter(currentVersion, fieldVersion.deprecatedIn)) {
        console.warn(`Field ${info.fieldName} is deprecated in version ${currentVersion}`);
      }

      // Check if field is removed in current version
      if (fieldVersion.removedIn && 
          this.isVersionAfter(currentVersion, fieldVersion.removedIn)) {
        throw new Error(`Field ${info.fieldName} was removed in version ${fieldVersion.removedIn}`);
      }

      return originalResolver ? originalResolver(parent, args, context, info) : null;
    };
  }

  /**
   * Check if one version is after another
   */
  private isVersionAfter(version1: string, version2: string): boolean {
    // Simple version comparison - in reality would use semantic versioning
    return version1 >= version2;
  }

  /**
   * Generate resolver script
   */
  private generateResolverScript(fieldPath: string): string {
    return `
// Auto-generated resolver for ${fieldPath}
async function ${fieldPath.replace(/\./g, '_')}Resolver(parent, args, context, info) {
  // TODO: Implement resolver logic for ${fieldPath}
  return null;
}
`;
  }

  /**
   * Calculate compatibility confidence
   */
  private calculateCompatibilityConfidence(issues: CompatibilityIssue[]): number {
    if (issues.length === 0) return 100;

    const weights = { critical: 40, high: 25, medium: 15, low: 5 };
    const penalty = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 5), 0);
    
    return Math.max(0, 100 - penalty);
  }
}

interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  confidence: number;
}

interface CompatibilityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  path: string;
}

export default SchemaEvolutionEngine;