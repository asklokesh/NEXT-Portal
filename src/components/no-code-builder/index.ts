/**
 * No-Code Portal Builder Components
 * Visual page builder for creating custom portal pages without coding
 */

// Core Components
export { PageBuilder } from './PageBuilder';
export { WidgetLibrary, WIDGET_DEFINITIONS } from './WidgetLibrary';
export type { WidgetDefinition } from './WidgetLibrary';
export { WidgetRenderer } from './WidgetRenderer';
export { SortableWidget } from './SortableWidget';
export { WidgetConfigPanel } from './WidgetConfigPanel';
export { PageSettingsPanel } from './PageSettingsPanel';
export { BuilderToolbar } from './BuilderToolbar';

// Form Builder
export { FormBuilder } from './FormBuilder';

// Templates
export { TemplateGallery, PAGE_TEMPLATES } from './TemplateGallery';
export type { PageTemplate } from './TemplateGallery';

// Types - Widget Related
export type {
  Widget,
  WidgetType,
  WidgetConfig,
  WidgetPosition,
  WidgetSize,
  WidgetStyle,
  DataSourceConfig,
  TableColumn,
  QuickLink,
  ExtendedWidgetType,
  WidgetInstance,
  WidgetInstanceConfig,
} from './types';

// Types - Page Related
export type {
  PortalPage,
  PageLayout,
  LayoutBreakpoint,
  PageSettings,
  PagePermissions,
  PageMetadata,
  PageConfig,
  PageLayoutConfig,
} from './types';

// Types - Form Related
export type {
  FormSchema,
  FormField,
  FormFieldType,
  SelectOption,
  FieldValidation,
  FieldDependency,
  FormValidation,
  FormSubmitAction,
  FormConfig,
  FormFieldConfig,
  FormBuilderFieldType,
  FormFieldOption,
  FormFieldValidation,
  FormSubmitActionConfig,
} from './types';

// Types - Builder State
export type {
  BuilderState,
  BuilderHistoryEntry,
  BuilderHistory,
  BuilderAction,
  BuilderEvent,
  ViewportSize,
} from './types';

// Types - Widget Library/Config
export type {
  WidgetCategory,
  ConfigSchema,
  ConfigField,
  ConfigSection,
} from './types';
