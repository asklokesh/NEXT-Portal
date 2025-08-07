// Re-export types from MetadataSchemaManager for easier imports
export type {
  FieldType,
  ValidationRule,
  ConditionalRule,
  FieldDefinition,
  MetadataSchema,
  SchemaMigration,
} from '@/lib/metadata/MetadataSchemaManager';

// Additional types for UI components and API responses
export interface MetadataFormData {
  [fieldName: string]: any;
}

export interface MetadataValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors?: Record<string, string>;
}

export interface MetadataApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  message?: string;
}

export interface BulkMetadataUpdate {
  entityId: string;
  data: MetadataFormData;
}

export interface BulkUpdateResult {
  processed: number;
  failed: number;
  results: Array<{
    entityId: string;
    schemaId: string;
    schemaVersion: string;
    data: MetadataFormData;
    validation: MetadataValidationResult;
    backstageYaml?: any;
    updatedAt: string;
  }>;
  errors: Array<{
    entityId: string;
    error: string;
    validation?: string[];
  }>;
}

export interface MetadataEditorProps {
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  schemaId?: string;
  initialData?: MetadataFormData;
  onSave?: (data: MetadataFormData, backstageYaml?: any) => void;
  onCancel?: () => void;
  mode?: 'edit' | 'create' | 'bulk';
  readOnly?: boolean;
}

export interface FormBuilderProps {
  schema?: MetadataSchema;
  onSave?: (schema: MetadataSchema) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultProps: Partial<FieldDefinition>;
  supportedValidations: ValidationRule['type'][];
}

export interface SchemaLayoutSection {
  id: string;
  title: string;
  fields: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  columns?: number;
}

export interface SchemaLayout {
  sections: SchemaLayoutSection[];
}

// Backstage integration types
export interface BackstageEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
  };
  spec?: Record<string, any>;
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
}

export interface MetadataToBackstageMapping {
  path: string; // JSONPath to target location in Backstage entity
  transform?: (value: any, context: MetadataFormData) => any;
  condition?: (value: any, context: MetadataFormData) => boolean;
}

// Form validation types
export interface FormValidationError {
  field: string;
  message: string;
  type: 'required' | 'validation' | 'format' | 'custom';
}

export interface FormValidationResult {
  isValid: boolean;
  errors: FormValidationError[];
  warnings?: string[];
}

// Schema versioning types
export interface SchemaVersion {
  version: string;
  changes: Array<{
    type: 'added' | 'removed' | 'modified';
    field: string;
    description: string;
  }>;
  breaking: boolean;
  releasedAt: Date;
}

export interface SchemaMigrationStep {
  type: 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'transform_value';
  field: string;
  newField?: string;
  newType?: FieldType;
  transformation?: string;
  description: string;
}

// Search and filtering types
export interface SchemaSearchFilters {
  entityKind?: string;
  active?: boolean;
  version?: string;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  hasFields?: string[];
  query?: string; // Text search in name/description
}

export interface MetadataSearchResult {
  schema: MetadataSchema;
  score: number;
  matchedFields: string[];
}

// Export/Import types
export interface SchemaExportOptions {
  format: 'json' | 'yaml';
  includeData?: boolean;
  entities?: string[];
  compress?: boolean;
}

export interface SchemaImportResult {
  schema: MetadataSchema;
  warnings: string[];
  conflicts: Array<{
    field: string;
    message: string;
    resolution: 'skip' | 'overwrite' | 'merge';
  }>;
}

// Analytics and insights types
export interface MetadataUsageStats {
  schemaId: string;
  totalEntities: number;
  fieldUsage: Record<string, {
    populated: number;
    percentage: number;
    commonValues?: Array<{ value: any; count: number }>;
  }>;
  validationErrors: Record<string, number>;
  lastUpdated: Date;
}

export interface SchemaInsights {
  usage: MetadataUsageStats;
  recommendations: Array<{
    type: 'unused_field' | 'missing_validation' | 'common_value' | 'performance';
    field?: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    autoFixable: boolean;
  }>;
}

// Permissions and access types
export interface MetadataPermissions {
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canImport: boolean;
  fieldPermissions?: Record<string, {
    canView: boolean;
    canEdit: boolean;
  }>;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: MetadataPermissions;
  entityFilters?: {
    kinds?: string[];
    namespaces?: string[];
    labels?: Record<string, string>;
  };
}

// Workflow and automation types
export interface MetadataWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'schema_change' | 'entity_create' | 'entity_update' | 'validation_error';
    conditions?: Record<string, any>;
  };
  actions: Array<{
    type: 'notify' | 'validate' | 'transform' | 'webhook';
    config: Record<string, any>;
  }>;
  active: boolean;
}

// Template and preset types
export interface MetadataTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  entityKind: string;
  schema: Partial<MetadataSchema>;
  sampleData?: MetadataFormData;
  tags: string[];
}

export interface FieldPreset {
  id: string;
  name: string;
  description: string;
  field: Partial<FieldDefinition>;
  category: string;
  tags: string[];
}

// Integration types
export interface IntegrationConfig {
  type: 'backstage' | 'git' | 'database' | 'api';
  config: Record<string, any>;
  syncSettings?: {
    enabled: boolean;
    interval: number;
    lastSyncAt?: Date;
    conflicts: 'local_wins' | 'remote_wins' | 'manual';
  };
}

// UI state types
export interface FormBuilderState {
  schema: MetadataSchema;
  selectedField: string | null;
  draggedField: string | null;
  mode: 'design' | 'preview' | 'code';
  isDirty: boolean;
  validationErrors: Record<string, string>;
}

export interface MetadataEditorState {
  data: MetadataFormData;
  errors: Record<string, string>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  showAdvanced: boolean;
  previewMode: 'form' | 'yaml' | 'json';
}