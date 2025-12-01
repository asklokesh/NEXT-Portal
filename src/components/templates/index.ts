/**
 * Software Templates Components
 * UI components for browsing, configuring, and executing software templates
 */

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

// New Template Components
export { TemplateCard } from './TemplateCard';
export { TemplateList } from './TemplateList';
export { TemplateWizard } from './TemplateWizard';
export { TemplateExecutionView } from './TemplateExecutionView';

// Existing exports
export * from './types';
export * from './TemplateManagement';
export * from './TemplateBuilder/StepWizard';
export * from './TemplateBuilder/ParameterBuilder';
export * from './TemplateBuilder/FileEditor';
export * from './TemplatePreview/LivePreview';
export * from './TemplateMarketplace/TemplateGrid';

// Re-export service types
export type {
  SoftwareTemplate,
  TemplateCategory,
  TemplateParameter,
  TemplateStep,
  TemplateExecution,
  TemplateStepExecution,
  GoldenPathConfig,
  GoldenPathFeature,
} from '@/services/templates/types';