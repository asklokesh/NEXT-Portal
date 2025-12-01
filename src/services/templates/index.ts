/**
 * Software Templates Service
 * Golden Paths & Template Engine
 */

export { TemplateEngine, getTemplateEngine } from './TemplateEngine';

export type {
  // Core Types
  SoftwareTemplate,
  TemplateCategory,
  TemplateType,
  TemplateMetadata,

  // Parameter Types
  TemplateParameter,
  ParameterType,
  ParameterUI,
  ParameterUIComponent,
  ParameterValidation,
  ParameterDependency,

  // Step Types
  TemplateStep,
  StepAction,
  StepActionConfig,
  ParameterSchema,

  // Output Types
  TemplateOutput,
  OutputType,

  // Requirement Types
  TemplateRequirement,
  RequirementType,

  // Golden Path Types
  GoldenPathConfig,
  GoldenPathFeature,
  GoldenPathPreset,

  // Execution Types
  TemplateExecution,
  ExecutionStatus,
  StepExecution,
  StepStatus,

  // Catalog Types
  TemplateCatalog,
  CategoryInfo,

  // API Types
  CreateTemplateRequest,
  ExecuteTemplateRequest,
  ExecuteTemplateResponse,
  DryRunResult,
  TemplateFilterOptions,
  TemplateListResponse,
} from './types';
