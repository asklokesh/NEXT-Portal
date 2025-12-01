/**
 * No-Code Portal Builder Types
 * Type definitions for the visual page builder
 */

// ============================================================================
// Widget Types
// ============================================================================

export interface Widget {
  id: string;
  type: WidgetType;
  title?: string;
  config: WidgetConfig;
  position: WidgetPosition;
  size: WidgetSize;
  style?: WidgetStyle;
}

export type WidgetType =
  | 'chart'
  | 'metric'
  | 'table'
  | 'text'
  | 'markdown'
  | 'catalog-list'
  | 'deployment-status'
  | 'incident-feed'
  | 'team-activity'
  | 'cost-overview'
  | 'health-grid'
  | 'alert-summary'
  | 'slo-dashboard'
  | 'dora-metrics'
  | 'pipeline-status'
  | 'iframe'
  | 'image'
  | 'video'
  | 'countdown'
  | 'announcement'
  | 'recent-items'
  | 'quick-links'
  | 'form'
  | 'custom';

export interface WidgetConfig {
  // Data source configuration
  dataSource?: DataSourceConfig;

  // Display options
  showTitle?: boolean;
  showRefresh?: boolean;
  refreshInterval?: number; // in seconds

  // Chart-specific
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'donut' | 'gauge';
  chartOptions?: Record<string, unknown>;

  // Metric-specific
  metricFormat?: 'number' | 'percentage' | 'currency' | 'duration';
  metricThresholds?: {
    warning?: number;
    critical?: number;
  };

  // Table-specific
  columns?: TableColumn[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;

  // Text/Markdown-specific
  content?: string;

  // Catalog-specific
  entityKind?: string;
  filters?: Record<string, unknown>;
  displayFields?: string[];

  // Custom HTML/iframe
  url?: string;
  html?: string;

  // Link configuration
  links?: QuickLink[];

  // Form configuration
  formSchema?: FormSchema;

  // Any additional config
  [key: string]: unknown;
}

export interface DataSourceConfig {
  type: 'api' | 'graphql' | 'static' | 'catalog' | 'metrics' | 'custom';
  endpoint?: string;
  query?: string;
  params?: Record<string, unknown>;
  transform?: string; // JSONPath or transformation function
  polling?: boolean;
  pollInterval?: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
}

// ============================================================================
// Table Types
// ============================================================================

export interface TableColumn {
  key: string;
  title: string;
  type: 'text' | 'number' | 'date' | 'status' | 'link' | 'avatar' | 'badge';
  sortable?: boolean;
  width?: number;
  format?: string;
  render?: string; // Custom render function name
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormSchema {
  fields: FormField[];
  submitAction?: FormSubmitAction;
  validation?: FormValidation;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  options?: SelectOption[];
  validation?: FieldValidation;
  dependsOn?: FieldDependency;
  helperText?: string;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'time'
  | 'file'
  | 'rich-text'
  | 'code'
  | 'json'
  | 'yaml'
  | 'entity-picker'
  | 'user-picker'
  | 'team-picker';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: string; // Custom validation function name
}

export interface FieldDependency {
  field: string;
  condition: 'equals' | 'not-equals' | 'contains' | 'not-empty';
  value?: unknown;
}

export interface FormValidation {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  customValidation?: string;
}

export interface FormSubmitAction {
  type: 'api' | 'webhook' | 'workflow' | 'email' | 'slack';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  transform?: string;
  successMessage?: string;
  errorMessage?: string;
  redirectUrl?: string;
}

// ============================================================================
// Quick Links Types
// ============================================================================

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  external?: boolean;
}

// ============================================================================
// Page/Dashboard Types
// ============================================================================

export interface PortalPage {
  id: string;
  name: string;
  slug: string;
  description?: string;
  layout: PageLayout;
  widgets: Widget[];
  settings: PageSettings;
  permissions?: PagePermissions;
  metadata: PageMetadata;
}

export interface PageLayout {
  type: 'grid' | 'freeform' | 'columns' | 'rows';
  columns?: number;
  rowHeight?: number;
  gap?: number;
  breakpoints?: LayoutBreakpoint[];
}

export interface LayoutBreakpoint {
  name: string;
  minWidth: number;
  columns: number;
}

export interface PageSettings {
  theme?: 'light' | 'dark' | 'system';
  backgroundColor?: string;
  backgroundImage?: string;
  headerVisible?: boolean;
  sidebarVisible?: boolean;
  maxWidth?: 'full' | 'xl' | 'lg' | 'md';
  refreshInterval?: number;
}

export interface PagePermissions {
  viewRoles?: string[];
  editRoles?: string[];
  isPublic?: boolean;
}

export interface PageMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
}

// ============================================================================
// Builder State Types
// ============================================================================

export interface BuilderState {
  page: PortalPage;
  selectedWidgetId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  history: BuilderHistoryEntry[];
  historyIndex: number;
  clipboard: Widget | null;
  previewMode: boolean;
}

export interface BuilderHistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  widgets: Widget[];
  settings: PageSettings;
}

// ============================================================================
// Widget Library Types
// ============================================================================

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  category: WidgetCategory;
  defaultConfig: Partial<WidgetConfig>;
  defaultSize: WidgetSize;
  configSchema: ConfigSchema;
  preview?: string; // Preview image URL
}

export type WidgetCategory =
  | 'data'
  | 'charts'
  | 'catalog'
  | 'monitoring'
  | 'deployment'
  | 'content'
  | 'navigation'
  | 'form'
  | 'embed';

export interface ConfigSchema {
  fields: ConfigField[];
  sections?: ConfigSection[];
}

export interface ConfigField {
  name: string;
  label: string;
  type: FormFieldType;
  defaultValue?: unknown;
  options?: SelectOption[];
  required?: boolean;
  helperText?: string;
  advanced?: boolean;
}

export interface ConfigSection {
  id: string;
  title: string;
  fields: string[];
  collapsed?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export type BuilderEvent =
  | { type: 'widget:add'; widget: Widget }
  | { type: 'widget:remove'; widgetId: string }
  | { type: 'widget:update'; widgetId: string; updates: Partial<Widget> }
  | { type: 'widget:move'; widgetId: string; position: WidgetPosition }
  | { type: 'widget:resize'; widgetId: string; size: WidgetSize }
  | { type: 'widget:select'; widgetId: string | null }
  | { type: 'widget:duplicate'; widgetId: string }
  | { type: 'page:update'; updates: Partial<PortalPage> }
  | { type: 'settings:update'; updates: Partial<PageSettings> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'preview:toggle' }
  | { type: 'publish' }
  | { type: 'save' };

// ============================================================================
// Extended Widget Types (for WidgetLibrary/WidgetRenderer compatibility)
// ============================================================================

export type ExtendedWidgetType =
  | 'service-card'
  | 'entity-list'
  | 'dependency-graph'
  | 'team-card'
  | 'api-list'
  | 'scorecard'
  | 'metric-chart'
  | 'stats-card'
  | 'gauge'
  | 'pie-chart'
  | 'bar-chart'
  | 'incidents'
  | 'deployments'
  | 'pipeline-status'
  | 'environment-status'
  | 'resource-usage'
  | 'tech-docs'
  | 'api-docs'
  | 'readme'
  | 'changelog'
  | 'github-activity'
  | 'jira-issues'
  | 'slack-channel'
  | 'pagerduty'
  | 'datadog'
  | 'grafana'
  | 'tabs'
  | 'grid-container'
  | 'accordion'
  | 'divider'
  | 'custom-component'
  | 'iframe'
  | 'markdown'
  | 'action-button'
  | 'search-bar';

// Widget instance for the new builder components
export interface WidgetInstance {
  id: string;
  type: ExtendedWidgetType;
  config: WidgetInstanceConfig;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WidgetInstanceConfig {
  title?: string;
  description?: string;
  visibility?: 'visible' | 'hidden' | 'conditional';
  style?: {
    backgroundColor?: string;
    borderRadius?: string;
    shadow?: string;
    padding?: string;
  };
  settings?: Record<string, unknown>;
  dataSource?: DataSourceConfig;
}

// ============================================================================
// Page Config Types (for PageSettingsPanel compatibility)
// ============================================================================

export interface PageConfig {
  id: string;
  name: string;
  path: string;
  description?: string;
  icon?: string;
  entityKind?: string;
  layout: PageLayoutConfig;
  widgets?: Array<{
    type: ExtendedWidgetType;
    position: { x: number; y: number; width: number; height: number };
  }>;
  theme?: 'light' | 'dark' | 'inherit';
  style?: {
    backgroundColor?: string;
    customCss?: string;
  };
  permissions?: {
    view?: string[];
    edit?: string[];
  };
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
  showInNavigation?: boolean;
  showInSearch?: boolean;
  status?: 'draft' | 'published' | 'archived';
}

export interface PageLayoutConfig {
  type: 'grid' | 'tabs' | 'sidebar' | 'full-width';
  columns?: number;
  gap?: string;
}

// ============================================================================
// Form Builder Types (for FormBuilder compatibility)
// ============================================================================

export interface FormConfig {
  id: string;
  name: string;
  description?: string;
  fields: FormFieldConfig[];
  submitAction: FormSubmitActionConfig;
  submitButtonText?: string;
  cancelButtonText?: string;
  showReset?: boolean;
  layout?: 'vertical' | 'horizontal' | 'inline';
}

export interface FormFieldConfig {
  id: string;
  name: string;
  type: FormBuilderFieldType;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  conditionalDisplay?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_empty';
    value?: unknown;
  };
  // Additional fields for specific types
  entityKind?: string;
  accept?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
}

export type FormBuilderFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'password'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'file'
  | 'entity-picker'
  | 'user-picker'
  | 'team-picker'
  | 'json'
  | 'yaml'
  | 'code';

export interface FormFieldOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: (value: unknown) => string | undefined;
}

export interface FormSubmitActionConfig {
  type: 'api' | 'webhook' | 'workflow' | 'custom';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
  onSuccess?: (response: unknown) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  redirectUrl?: string;
}

// ============================================================================
// Builder History Types
// ============================================================================

export interface BuilderHistory {
  entries: BuilderHistoryEntry[];
  currentIndex: number;
  maxEntries: number;
}

export interface BuilderAction {
  type: string;
  payload?: unknown;
  timestamp: Date;
}

// ============================================================================
// Viewport Types
// ============================================================================

export type ViewportSize = 'mobile' | 'tablet' | 'laptop' | 'desktop';
