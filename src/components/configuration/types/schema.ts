'use client';

import type { JSONSchema7 } from 'json-schema';

// Enhanced JSON Schema types for configuration generation
export interface ConfigurationSchema extends JSONSchema7 {
  'x-form-config'?: FormConfiguration;
  'x-backstage-config'?: BackstageConfiguration;
  'x-portal-config'?: PortalConfiguration;
}

export interface FormConfiguration {
  fieldType?: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 
             'code' | 'file' | 'color' | 'date' | 'time' | 'datetime' | 'url' | 'email' |
             'password' | 'range' | 'tags' | 'json' | 'yaml' | 'docker-image' |
             'kubernetes-resource' | 'api-endpoint' | 'entity-ref' | 'owner';
  widget?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
  grid?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  group?: string;
  order?: number;
  conditional?: ConditionalLogic;
  validation?: ValidationConfig;
  help?: {
    text?: string;
    link?: string;
    icon?: string;
  };
  placeholder?: string;
  autoFocus?: boolean;
  readonly?: boolean;
  hidden?: boolean;
}

export interface BackstageConfiguration {
  entityPath?: string;
  templateParameter?: boolean;
  scaffolderInput?: boolean;
  catalogProperty?: boolean;
  configSection?: string;
  environment?: ('development' | 'staging' | 'production')[];
}

export interface PortalConfiguration {
  category?: string;
  priority?: number;
  icon?: string;
  documentation?: string;
  examples?: ConfigurationExample[];
  presets?: ConfigurationPreset[];
  advanced?: boolean;
  experimental?: boolean;
}

export interface ConditionalLogic {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 
            'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' |
            'is_empty' | 'is_not_empty' | 'matches' | 'not_matches';
  value?: any;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional';
}

export interface ValidationConfig {
  async?: boolean;
  debounce?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  customValidation?: string;
  apiValidation?: {
    endpoint: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface ConfigurationExample {
  name: string;
  description: string;
  value: any;
  tags?: string[];
}

export interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  icon?: string;
  values: Record<string, any>;
  overrides?: Record<string, any>;
  environment?: string[];
}

// Form field state and metadata
export interface FormFieldState {
  id: string;
  name: string;
  value: any;
  error?: string;
  warning?: string;
  info?: string;
  touched: boolean;
  dirty: boolean;
  validating?: boolean;
  visible: boolean;
  disabled: boolean;
  required: boolean;
}

export interface FormGroupState {
  id: string;
  name: string;
  fields: FormFieldState[];
  collapsed?: boolean;
  visible: boolean;
  order: number;
}

export interface FormState {
  fields: Record<string, FormFieldState>;
  groups: Record<string, FormGroupState>;
  values: Record<string, any>;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: boolean;
  valid: boolean;
  validating: boolean;
  submitting: boolean;
}

// Configuration management types
export interface ConfigurationVersion {
  id: string;
  version: string;
  timestamp: Date;
  author: string;
  message: string;
  schema: ConfigurationSchema;
  values: Record<string, any>;
  environment?: string;
  tags?: string[];
}

export interface ConfigurationDiff {
  field: string;
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
  schemaChange?: boolean;
}

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon?: string;
  schema: ConfigurationSchema;
  defaultValues: Record<string, any>;
  examples?: ConfigurationExample[];
  documentation?: string;
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  popularity?: number;
  featured?: boolean;
}

// Plugin configuration discovery
export interface PluginConfigDiscovery {
  pluginId: string;
  name: string;
  version: string;
  configSchema?: ConfigurationSchema;
  configPath?: string;
  defaultConfig?: Record<string, any>;
  requiredConfig?: string[];
  optionalConfig?: string[];
  examples?: ConfigurationExample[];
  documentation?: string;
  dependencies?: string[];
}

// Wizard and multi-step form types
export interface WizardStep {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  fields: string[];
  validation?: 'none' | 'warnings' | 'errors';
  optional?: boolean;
  condition?: ConditionalLogic;
  helpContent?: string;
  estimatedTime?: number;
}

export interface WizardConfiguration {
  steps: WizardStep[];
  navigation: {
    allowSkip: boolean;
    allowBack: boolean;
    showProgress: boolean;
    showStepNumbers: boolean;
    confirmExit: boolean;
  };
  layout: {
    theme: 'default' | 'compact' | 'spacious';
    sidebar: boolean;
    breadcrumbs: boolean;
  };
}

// Real-time collaboration types
export interface CollaborationSession {
  sessionId: string;
  configurationId: string;
  participants: CollaborationParticipant[];
  cursors: Record<string, CollaborationCursor>;
  selections: Record<string, CollaborationSelection>;
  changes: CollaborationChange[];
  createdAt: Date;
  lastActivity: Date;
}

export interface CollaborationParticipant {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  online: boolean;
  lastSeen: Date;
  permissions: ('read' | 'write' | 'admin')[];
}

export interface CollaborationCursor {
  userId: string;
  fieldId: string;
  position: number;
  timestamp: Date;
}

export interface CollaborationSelection {
  userId: string;
  fieldId: string;
  start: number;
  end: number;
  timestamp: Date;
}

export interface CollaborationChange {
  id: string;
  userId: string;
  type: 'field_change' | 'field_add' | 'field_delete' | 'schema_change';
  fieldId?: string;
  path: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  applied: boolean;
  conflicted?: boolean;
}

// Import/Export types
export interface ConfigurationExport {
  format: 'json' | 'yaml' | 'typescript' | 'javascript' | 'backstage-yaml';
  schema: boolean;
  values: boolean;
  metadata: boolean;
  comments: boolean;
  validation: boolean;
  minified: boolean;
}

export interface ConfigurationImport {
  source: 'file' | 'url' | 'clipboard' | 'backstage-config' | 'plugin-config';
  format?: 'json' | 'yaml' | 'typescript' | 'javascript';
  autoDetect: boolean;
  mergeStrategy: 'replace' | 'merge' | 'merge-deep' | 'append';
  validateSchema: boolean;
  validateValues: boolean;
}

// Performance and monitoring
export interface FormPerformanceMetrics {
  renderTime: number;
  validationTime: number;
  fieldCount: number;
  memoryUsage: number;
  reRenderCount: number;
  asyncValidationCount: number;
  timestamp: Date;
}

export interface FieldInteractionMetrics {
  fieldId: string;
  focusTime: number;
  changeCount: number;
  validationErrors: number;
  helpViewed: boolean;
  completed: boolean;
}

// Accessibility features
export interface AccessibilityConfig {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusTrapping: boolean;
  announcements: boolean;
  largeText: boolean;
  colorBlindFriendly: boolean;
}

export interface FormAccessibilityState {
  focusedField?: string;
  announcedChanges: string[];
  keyboardMode: boolean;
  screenReaderActive: boolean;
}