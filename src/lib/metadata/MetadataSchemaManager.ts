import { z } from 'zod';
import { validate } from 'jsonschema';

// Field types supported by the metadata system
export type FieldType = 
  | 'text' 
  | 'number' 
  | 'boolean' 
  | 'select' 
  | 'multi-select' 
  | 'date' 
  | 'json' 
  | 'url' 
  | 'email';

// Validation rule types
export type ValidationRule = {
  type: 'required' | 'pattern' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom';
  value?: string | number | boolean;
  message?: string;
  customFunction?: string; // JavaScript function as string
};

// Conditional field visibility
export type ConditionalRule = {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
};

// Field definition structure
export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  validation?: ValidationRule[];
  options?: { label: string; value: string }[]; // For select/multi-select
  conditional?: {
    show: ConditionalRule[];
    hide: ConditionalRule[];
  };
  backstageMapping?: {
    path: string; // JSONPath to Backstage entity field
    transform?: string; // JavaScript function as string
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Schema definition
export interface MetadataSchema {
  id: string;
  name: string;
  version: string;
  description?: string;
  entityKind?: string; // component, api, resource, etc.
  fields: FieldDefinition[];
  layout?: {
    sections: Array<{
      id: string;
      title: string;
      fields: string[];
      collapsible?: boolean;
      defaultExpanded?: boolean;
    }>;
  };
  created: Date;
  updated: Date;
  createdBy: string;
  active: boolean;
}

// Migration definition
export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  transformations: Array<{
    type: 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'transform_value';
    field: string;
    newField?: string;
    newType?: FieldType;
    transformation?: string; // JavaScript function as string
  }>;
}

// Field type registry with validation schemas
export class FieldTypeRegistry {
  private static fieldTypes: Record<FieldType, z.ZodType<any>> = {
    text: z.string(),
    number: z.number(),
    boolean: z.boolean(),
    select: z.string(),
    'multi-select': z.array(z.string()),
    date: z.string().datetime(),
    json: z.any(),
    url: z.string().url(),
    email: z.string().email(),
  };

  static getValidator(fieldType: FieldType): z.ZodType<any> {
    return this.fieldTypes[fieldType];
  }

  static getAllTypes(): FieldType[] {
    return Object.keys(this.fieldTypes) as FieldType[];
  }

  static registerCustomType(name: string, validator: z.ZodType<any>): void {
    this.fieldTypes[name as FieldType] = validator;
  }
}

// Main schema manager class
export class MetadataSchemaManager {
  private schemas: Map<string, MetadataSchema> = new Map();
  private migrations: Map<string, SchemaMigration[]> = new Map();

  // Schema CRUD operations
  async createSchema(schema: Omit<MetadataSchema, 'id' | 'created' | 'updated'>): Promise<MetadataSchema> {
    const id = this.generateId();
    const now = new Date();
    
    const newSchema: MetadataSchema = {
      ...schema,
      id,
      created: now,
      updated: now,
    };

    // Validate schema structure
    this.validateSchemaStructure(newSchema);

    this.schemas.set(id, newSchema);
    await this.persistSchema(newSchema);
    
    return newSchema;
  }

  async updateSchema(id: string, updates: Partial<MetadataSchema>): Promise<MetadataSchema> {
    const existing = this.schemas.get(id);
    if (!existing) {
      throw new Error(`Schema with id ${id} not found`);
    }

    // Create migration if version changed
    if (updates.version && updates.version !== existing.version) {
      await this.createMigration(existing, updates as MetadataSchema);
    }

    const updated: MetadataSchema = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updated: new Date(),
    };

    this.validateSchemaStructure(updated);
    this.schemas.set(id, updated);
    await this.persistSchema(updated);

    return updated;
  }

  async deleteSchema(id: string): Promise<boolean> {
    const schema = this.schemas.get(id);
    if (!schema) {
      return false;
    }

    // Mark as inactive instead of deleting
    schema.active = false;
    await this.persistSchema(schema);
    
    return true;
  }

  getSchema(id: string): MetadataSchema | undefined {
    return this.schemas.get(id);
  }

  getSchemaByName(name: string): MetadataSchema | undefined {
    return Array.from(this.schemas.values()).find(s => s.name === name && s.active);
  }

  getAllSchemas(): MetadataSchema[] {
    return Array.from(this.schemas.values()).filter(s => s.active);
  }

  getSchemasByEntityKind(kind: string): MetadataSchema[] {
    return this.getAllSchemas().filter(s => s.entityKind === kind);
  }

  // Field operations
  addField(schemaId: string, field: Omit<FieldDefinition, 'id'>): Promise<MetadataSchema> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }

    const newField: FieldDefinition = {
      ...field,
      id: this.generateId(),
    };

    schema.fields.push(newField);
    return this.updateSchema(schemaId, schema);
  }

  updateField(schemaId: string, fieldId: string, updates: Partial<FieldDefinition>): Promise<MetadataSchema> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }

    const fieldIndex = schema.fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) {
      throw new Error(`Field with id ${fieldId} not found`);
    }

    schema.fields[fieldIndex] = {
      ...schema.fields[fieldIndex],
      ...updates,
      id: fieldId, // Ensure ID doesn't change
    };

    return this.updateSchema(schemaId, schema);
  }

  removeField(schemaId: string, fieldId: string): Promise<MetadataSchema> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }

    schema.fields = schema.fields.filter(f => f.id !== fieldId);
    return this.updateSchema(schemaId, schema);
  }

  // Validation
  validateSchemaStructure(schema: MetadataSchema): void {
    // Check for duplicate field names
    const fieldNames = schema.fields.map(f => f.name);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate field names found: ${duplicates.join(', ')}`);
    }

    // Validate each field
    schema.fields.forEach(field => {
      this.validateField(field);
    });

    // Validate conditional rules
    schema.fields.forEach(field => {
      if (field.conditional) {
        this.validateConditionalRules(field.conditional, schema.fields);
      }
    });
  }

  validateField(field: FieldDefinition): void {
    // Validate field type
    if (!FieldTypeRegistry.getAllTypes().includes(field.type)) {
      throw new Error(`Invalid field type: ${field.type}`);
    }

    // Validate options for select fields
    if ((field.type === 'select' || field.type === 'multi-select') && !field.options?.length) {
      throw new Error(`Select field '${field.name}' must have options`);
    }

    // Validate validation rules
    field.validation?.forEach(rule => {
      this.validateValidationRule(rule, field.type);
    });
  }

  validateValidationRule(rule: ValidationRule, fieldType: FieldType): void {
    switch (rule.type) {
      case 'pattern':
        if (fieldType !== 'text' && fieldType !== 'email' && fieldType !== 'url') {
          throw new Error(`Pattern validation not supported for field type: ${fieldType}`);
        }
        if (!rule.value || typeof rule.value !== 'string') {
          throw new Error('Pattern validation requires a string value');
        }
        break;
      case 'min':
      case 'max':
        if (fieldType !== 'number' && fieldType !== 'date') {
          throw new Error(`${rule.type} validation not supported for field type: ${fieldType}`);
        }
        break;
      case 'minLength':
      case 'maxLength':
        if (fieldType !== 'text' && fieldType !== 'email' && fieldType !== 'url') {
          throw new Error(`${rule.type} validation not supported for field type: ${fieldType}`);
        }
        break;
    }
  }

  validateConditionalRules(conditional: FieldDefinition['conditional'], allFields: FieldDefinition[]): void {
    const fieldNames = allFields.map(f => f.name);
    
    [...(conditional?.show || []), ...(conditional?.hide || [])].forEach(rule => {
      if (!fieldNames.includes(rule.field)) {
        throw new Error(`Conditional rule references unknown field: ${rule.field}`);
      }
    });
  }

  // Validate data against schema
  validateData(schemaId: string, data: Record<string, any>): { valid: boolean; errors: string[] } {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }

    const errors: string[] = [];

    schema.fields.forEach(field => {
      const value = data[field.name];
      
      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${field.label}' is required`);
        return;
      }

      // Skip validation if field is empty and not required
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Type validation
      try {
        const validator = FieldTypeRegistry.getValidator(field.type);
        validator.parse(value);
      } catch (error) {
        errors.push(`Field '${field.label}' has invalid value: ${error.message}`);
        return;
      }

      // Custom validation rules
      field.validation?.forEach(rule => {
        const validationError = this.validateFieldValue(value, rule, field);
        if (validationError) {
          errors.push(validationError);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateFieldValue(value: any, rule: ValidationRule, field: FieldDefinition): string | null {
    switch (rule.type) {
      case 'pattern':
        if (typeof value === 'string' && rule.value) {
          const regex = new RegExp(rule.value as string);
          if (!regex.test(value)) {
            return rule.message || `Field '${field.label}' does not match required pattern`;
          }
        }
        break;
      case 'min':
        if (typeof value === 'number' && typeof rule.value === 'number' && value < rule.value) {
          return rule.message || `Field '${field.label}' must be at least ${rule.value}`;
        }
        break;
      case 'max':
        if (typeof value === 'number' && typeof rule.value === 'number' && value > rule.value) {
          return rule.message || `Field '${field.label}' must be at most ${rule.value}`;
        }
        break;
      case 'minLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length < rule.value) {
          return rule.message || `Field '${field.label}' must be at least ${rule.value} characters`;
        }
        break;
      case 'maxLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length > rule.value) {
          return rule.message || `Field '${field.label}' must be at most ${rule.value} characters`;
        }
        break;
      case 'custom':
        if (rule.customFunction) {
          try {
            // eslint-disable-next-line no-new-func
            const customValidator = new Function('value', 'field', rule.customFunction);
            const result = customValidator(value, field);
            if (result !== true) {
              return typeof result === 'string' ? result : rule.message || `Field '${field.label}' failed custom validation`;
            }
          } catch (error) {
            return `Custom validation error for field '${field.label}': ${error.message}`;
          }
        }
        break;
    }
    
    return null;
  }

  // Schema versioning and migration
  private async createMigration(oldSchema: MetadataSchema, newSchema: MetadataSchema): Promise<void> {
    const migration: SchemaMigration = {
      fromVersion: oldSchema.version,
      toVersion: newSchema.version,
      transformations: [],
    };

    // Compare fields and create transformations
    const oldFieldMap = new Map(oldSchema.fields.map(f => [f.name, f]));
    const newFieldMap = new Map(newSchema.fields.map(f => [f.name, f]));

    // Find removed fields
    oldFieldMap.forEach((field, name) => {
      if (!newFieldMap.has(name)) {
        migration.transformations.push({
          type: 'remove_field',
          field: name,
        });
      }
    });

    // Find added and modified fields
    newFieldMap.forEach((field, name) => {
      const oldField = oldFieldMap.get(name);
      if (!oldField) {
        migration.transformations.push({
          type: 'add_field',
          field: name,
        });
      } else if (oldField.type !== field.type) {
        migration.transformations.push({
          type: 'change_type',
          field: name,
          newType: field.type,
        });
      }
    });

    // Store migration
    if (!this.migrations.has(oldSchema.id)) {
      this.migrations.set(oldSchema.id, []);
    }
    this.migrations.get(oldSchema.id)!.push(migration);
  }

  async migrateData(schemaId: string, fromVersion: string, toVersion: string, data: Record<string, any>): Promise<Record<string, any>> {
    const migrations = this.migrations.get(schemaId) || [];
    let currentData = { ...data };

    // Find migration path
    const migrationPath = this.findMigrationPath(migrations, fromVersion, toVersion);
    
    for (const migration of migrationPath) {
      currentData = await this.applyMigration(migration, currentData);
    }

    return currentData;
  }

  private findMigrationPath(migrations: SchemaMigration[], fromVersion: string, toVersion: string): SchemaMigration[] {
    // Simple path finding - in production, you might want a more sophisticated algorithm
    const path: SchemaMigration[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const migration = migrations.find(m => m.fromVersion === currentVersion);
      if (!migration) {
        throw new Error(`No migration path found from ${fromVersion} to ${toVersion}`);
      }
      path.push(migration);
      currentVersion = migration.toVersion;
    }

    return path;
  }

  private async applyMigration(migration: SchemaMigration, data: Record<string, any>): Promise<Record<string, any>> {
    const result = { ...data };

    for (const transformation of migration.transformations) {
      switch (transformation.type) {
        case 'remove_field':
          delete result[transformation.field];
          break;
        case 'add_field':
          // Set default value if not present
          if (!(transformation.field in result)) {
            result[transformation.field] = null;
          }
          break;
        case 'rename_field':
          if (transformation.newField && transformation.field in result) {
            result[transformation.newField] = result[transformation.field];
            delete result[transformation.field];
          }
          break;
        case 'transform_value':
          if (transformation.transformation && transformation.field in result) {
            try {
              // eslint-disable-next-line no-new-func
              const transformFunction = new Function('value', transformation.transformation);
              result[transformation.field] = transformFunction(result[transformation.field]);
            } catch (error) {
              console.warn(`Failed to apply transformation for field ${transformation.field}:`, error);
            }
          }
          break;
      }
    }

    return result;
  }

  // Backstage integration
  generateBackstageYaml(schemaId: string, data: Record<string, any>): any {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }

    const backstageEntity: any = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: schema.entityKind || 'Component',
      metadata: {
        name: data.name || 'unnamed-entity',
        annotations: {},
      },
      spec: {},
    };

    // Map custom fields to Backstage entity structure
    schema.fields.forEach(field => {
      const value = data[field.name];
      if (value !== undefined && value !== null && value !== '') {
        if (field.backstageMapping) {
          this.setNestedValue(backstageEntity, field.backstageMapping.path, value);
        } else {
          // Default mapping to annotations
          backstageEntity.metadata.annotations[`custom.${field.name}`] = String(value);
        }
      }
    });

    return backstageEntity;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  // Persistence (override in production with actual storage)
  private async persistSchema(schema: MetadataSchema): Promise<void> {
    // In production, this would save to database
    console.log('Persisting schema:', schema.id);
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Export/Import schemas
  exportSchema(schemaId: string): string {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema with id ${schemaId} not found`);
    }
    return JSON.stringify(schema, null, 2);
  }

  importSchema(schemaJson: string): Promise<MetadataSchema> {
    try {
      const schema = JSON.parse(schemaJson) as MetadataSchema;
      
      // Generate new ID and timestamps
      const imported = {
        ...schema,
        id: this.generateId(),
        created: new Date(),
        updated: new Date(),
      };

      this.validateSchemaStructure(imported);
      this.schemas.set(imported.id, imported);
      
      return this.persistSchema(imported).then(() => imported);
    } catch (error) {
      throw new Error(`Failed to import schema: ${error.message}`);
    }
  }
}

// Singleton instance
export const metadataSchemaManager = new MetadataSchemaManager();