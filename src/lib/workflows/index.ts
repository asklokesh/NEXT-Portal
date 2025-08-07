export { WorkflowEngine, getWorkflowEngine } from './workflow-engine';
export { WORKFLOW_TEMPLATES, createWorkflowFromTemplate, getAvailableTemplates } from './templates';

export type {
  WorkflowStep,
  WorkflowDefinition,
  WorkflowExecution,
  ApprovalRequest
} from './workflow-engine';