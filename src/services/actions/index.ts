/**
 * Self-Service Actions Service
 * Exports for triggerable actions in the portal
 */

export { ActionService, getActionService } from './ActionService';
export type {
  // Core types
  SelfServiceAction,
  ActionCategory,
  ActionContext,
  ActionTriggerType,
  ActionParameterType,
  ActionExecutionStatus,

  // Execution
  ActionExecutionConfig,
  ActionExecution,
  ActionExecutionResult,
  ActionExecutionLog,
  ActionResultLink,
  ActionResultArtifact,

  // Parameters
  ActionParameter,
  ActionParameterOption,

  // Validation & Limits
  ActionValidation,
  ActionPreCheck,
  ActionLimits,

  // Scheduling
  ActionSchedule,

  // UI
  ActionUIConfig,
  ActionMetadata,

  // Approvals
  ActionApprovalRequest,

  // Organization
  ActionGroup,
  QuickAction,
} from './types';
