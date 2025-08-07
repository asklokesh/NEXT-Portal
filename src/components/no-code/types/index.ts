/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { LucideIcon } from 'lucide-react';

// Field type definitions with icons and configurations
export interface FieldTypeDefinition {
 type: FieldType;
 label: string;
 description: string;
 icon: LucideIcon;
 category: 'basic' | 'backstage' | 'advanced';
 defaultConfig: Partial<FormField>;
 previewValue?: unknown;
}

// Base field types
export interface FieldPosition {
 x: number;
 y: number;
 width: number;
 height: number;
}

export interface FieldValidation {
 required?: boolean;
 pattern?: string;
 minLength?: number;
 maxLength?: number;
 min?: number;
 max?: number;
 custom?: string; // Custom validation function
}

export interface ConditionalLogic {
 field: string;
 operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater' | 'less';
 value: unknown;
 action: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

export interface FieldOption {
 label: string;
 value: string | number | boolean;
 description?: string;
}

// Base field configuration
export interface BaseField {
 id: string;
 type: FieldType;
 label: string;
 description?: string;
 placeholder?: string;
 defaultValue?: unknown;
 position: FieldPosition;
 validation?: FieldValidation;
 conditionalLogic?: ConditionalLogic[];
 backstageMapping?: string; // Maps to Backstage entity property
 required?: boolean;
 disabled?: boolean;
 hidden?: boolean;
}

// Specific field types
export interface StringField extends BaseField {
 type: 'string';
 multiline?: boolean;
 maxLength?: number;
}

export interface NumberField extends BaseField {
 type: 'number';
 min?: number;
 max?: number;
 step?: number;
}

export interface BooleanField extends BaseField {
 type: 'boolean';
 defaultValue?: boolean;
}

export interface SelectField extends BaseField {
 type: 'select';
 options: FieldOption[];
 multiple?: boolean;
}

export interface ArrayField extends BaseField {
 type: 'array';
 itemType: 'string' | 'number' | 'object';
 minItems?: number;
 maxItems?: number;
 itemSchema?: BackstageSchema;
}

export interface ObjectField extends BaseField {
 type: 'object';
 properties: Record<string, FormField>;
}

export interface TagsField extends BaseField {
 type: 'tags';
 suggestions?: string[];
}

export interface EntityRefField extends BaseField {
 type: 'entityRef';
 entityKind?: string;
 namespace?: string;
}

export interface UrlField extends BaseField {
 type: 'url';
 protocols?: string[];
}

export interface EmailField extends BaseField {
 type: 'email';
}

export interface LifecycleField extends BaseField {
 type: 'lifecycle';
 options: FieldOption[];
}

export interface OwnerField extends BaseField {
 type: 'owner';
 entityTypes: ('user' | 'group')[];
}

export type FormField = 
 | StringField 
 | NumberField 
 | BooleanField 
 | SelectField 
 | ArrayField 
 | ObjectField 
 | TagsField 
 | EntityRefField 
 | UrlField 
 | EmailField 
 | LifecycleField 
 | OwnerField;

export type FieldType = FormField['type'];

// Backstage-specific schemas
export interface BackstageMetadataSchema {
 name: FormField;
 title?: FormField;
 description?: FormField;
 labels?: FormField;
 annotations?: FormField;
 tags?: FormField;
 links?: FormField;
}

export interface BackstageEntitySchema {
 apiVersion: FormField;
 kind: FormField;
 metadata: BackstageMetadataSchema;
 spec: Record<string, FormField>;
 relations?: FormField;
}

export interface BackstageSchema {
 type: 'entity' | 'template' | 'custom';
 entityType?: 'Component' | 'API' | 'Resource' | 'System' | 'Domain' | 'User' | 'Group' | 'Location';
 fields: FormField[];
 schema: BackstageEntitySchema;
}

// Template-specific types
export interface TemplateParameter extends BaseField {
 'ui:field'?: string;
 'ui:widget'?: string;
 'ui:options'?: Record<string, unknown>;
 'ui:help'?: string;
}

export interface TemplateStep {
 id: string;
 name: string;
 action: string;
 input: Record<string, unknown>;
 if?: string;
}

export interface TemplateAction {
 id: string;
 name: string;
 description: string;
 schema?: {
 input?: Record<string, unknown>;
 output?: Record<string, unknown>;
 };
}

export interface TemplateSchema {
 name: string;
 title: string;
 description: string;
 tags: string[];
 parameters: TemplateParameter[];
 steps: TemplateStep[];
 output?: Record<string, unknown>;
}

// Form builder state
export interface FormBuilderState {
 fields: FormField[];
 selectedFieldId: string | null;
 canvasSize: { width: number; height: number };
 gridSize: number;
 snapToGrid: boolean;
 showGrid: boolean;
 zoom: number;
 mode: 'design' | 'preview' | 'code';
}

export interface TemplateBuilderState {
 template: TemplateSchema;
 selectedStepId: string | null;
 parameters: TemplateParameter[];
 steps: TemplateStep[];
 availableActions: TemplateAction[];
 mode: 'design' | 'preview' | 'code';
}

// Drag and drop types
export interface DragItem {
 type: 'FIELD' | 'PALETTE_ITEM';
 fieldType?: FieldType;
 fieldId?: string;
 field?: FormField;
}

export interface DropTarget {
 x: number;
 y: number;
 width?: number;
 height?: number;
}

// Export/Import types
export interface ExportOptions {
 format: 'yaml' | 'json';
 includeMetadata: boolean;
 minify: boolean;
}

export interface ImportResult {
 success: boolean;
 data?: BackstageSchema | TemplateSchema;
 errors?: string[];
 warnings?: string[];
}

// Validation types
export interface ValidationError {
 fieldId: string;
 fieldPath: string;
 message: string;
 severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
 valid: boolean;
 errors: ValidationError[];
 warnings: ValidationError[];
}

// Preview types
export interface PreviewData {
 yaml: string;
 json: Record<string, unknown>;
 backstageEntity?: Record<string, unknown>;
 templateEntity?: Record<string, unknown>;
}

// Accessibility types
export interface AccessibilityFeatures {
 keyboardNavigation: boolean;
 screenReaderSupport: boolean;
 highContrast: boolean;
 reducedMotion: boolean;
}

// Performance monitoring
export interface PerformanceMetrics {
 renderTime: number;
 dragLatency: number;
 validationTime: number;
 previewGenerationTime: number;
}

// Configuration
export interface NoCodeConfig {
 accessibility: AccessibilityFeatures;
 performance: {
 enableVirtualization: boolean;
 maxFields: number;
 debounceMs: number;
 };
 features: {
 enableCodeView: boolean;
 enableImportExport: boolean;
 enableTemplateDesigner: boolean;
 enableRealTimeValidation: boolean;
 };
}