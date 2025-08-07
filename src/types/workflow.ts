export interface WorkflowDefinition {
 id: string;
 name: string;
 description?: string;
 category: 'approval' | 'automation' | 'notification' | 'deployment' | 'custom';
 triggers: WorkflowTrigger[];
 steps: WorkflowStep[];
 conditions?: WorkflowCondition[];
 metadata: {
 createdBy: string;
 createdAt: Date;
 updatedAt: Date;
 version: number;
 tags: string[];
 };
 status: 'draft' | 'active' | 'paused' | 'archived';
}

export interface WorkflowTrigger {
 id: string;
 type: 'manual' | 'event' | 'schedule' | 'webhook' | 'entity_change';
 configuration: {
 eventType?: string;
 entityKind?: string;
 schedule?: string; // cron expression
 webhookUrl?: string;
 conditions?: WorkflowCondition[];
 };
}

export interface WorkflowStep {
 id: string;
 name: string;
 type: 'approval' | 'action' | 'notification' | 'condition' | 'parallel' | 'wait';
 configuration: StepConfiguration;
 onSuccess?: string[]; // next step IDs
 onFailure?: string[]; // fallback step IDs
 timeout?: number; // in seconds
 retryPolicy?: {
 maxAttempts: number;
 delaySeconds: number;
 };
}

export type StepConfiguration = 
 | ApprovalStepConfig
 | ActionStepConfig
 | NotificationStepConfig
 | ConditionStepConfig
 | ParallelStepConfig
 | WaitStepConfig;

export interface ApprovalStepConfig {
 type: 'approval';
 approvers: Approver[];
 approvalType: 'all' | 'any' | 'threshold';
 threshold?: number;
 expiresIn?: number; // hours
 escalation?: {
 after: number; // hours
 to: Approver[];
 };
 template?: {
 title: string;
 description: string;
 fields?: ApprovalField[];
 };
}

export interface Approver {
 type: 'user' | 'group' | 'role' | 'owner';
 value: string;
}

export interface ApprovalField {
 id: string;
 label: string;
 type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
 required: boolean;
 options?: string[];
 defaultValue?: any;
}

export interface ActionStepConfig {
 type: 'action';
 actionType: 'api_call' | 'script' | 'backstage_action' | 'custom';
 apiCall?: {
 method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
 url: string;
 headers?: Record<string, string>;
 body?: any;
 authentication?: {
 type: 'none' | 'basic' | 'bearer' | 'oauth2';
 credentials?: any;
 };
 };
 script?: {
 language: 'javascript' | 'python' | 'bash';
 code: string;
 };
 backstageAction?: {
 type: 'create_entity' | 'update_entity' | 'delete_entity' | 'run_template';
 parameters: Record<string, any>;
 };
}

export interface NotificationStepConfig {
 type: 'notification';
 channels: ('email' | 'slack' | 'teams' | 'webhook' | 'in_app')[];
 recipients: Approver[];
 template: {
 subject?: string;
 body: string;
 priority?: 'low' | 'medium' | 'high' | 'urgent';
 };
}

export interface ConditionStepConfig {
 type: 'condition';
 conditions: WorkflowCondition[];
 operator: 'and' | 'or';
}

export interface ParallelStepConfig {
 type: 'parallel';
 branches: WorkflowBranch[];
 waitForAll: boolean;
}

export interface WaitStepConfig {
 type: 'wait';
 duration: number; // seconds
 until?: {
 type: 'time' | 'condition';
 value: string | WorkflowCondition;
 };
}

export interface WorkflowBranch {
 id: string;
 name: string;
 steps: string[]; // step IDs
}

export interface WorkflowCondition {
 field: string;
 operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in';
 value: any;
}

export interface WorkflowExecution {
 id: string;
 workflowId: string;
 workflowVersion: number;
 status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
 startedAt: Date;
 completedAt?: Date;
 triggeredBy: {
 type: 'user' | 'system' | 'schedule' | 'event';
 id: string;
 name: string;
 };
 context: Record<string, any>;
 currentStep?: string;
 stepExecutions: StepExecution[];
 error?: {
 message: string;
 stepId: string;
 timestamp: Date;
 };
}

export interface StepExecution {
 stepId: string;
 status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval';
 startedAt?: Date;
 completedAt?: Date;
 input?: Record<string, any>;
 output?: Record<string, any>;
 error?: string;
 approvals?: ApprovalRecord[];
}

export interface ApprovalRecord {
 approverId: string;
 approverName: string;
 decision: 'approved' | 'rejected' | 'pending';
 timestamp?: Date;
 comment?: string;
 fields?: Record<string, any>;
}

export interface WorkflowTemplate {
 id: string;
 name: string;
 description: string;
 category: string;
 icon?: string;
 definition: Partial<WorkflowDefinition>;
 parameters?: WorkflowParameter[];
 examples?: WorkflowExample[];
}

export interface WorkflowParameter {
 id: string;
 name: string;
 description?: string;
 type: 'string' | 'number' | 'boolean' | 'array' | 'object';
 required: boolean;
 defaultValue?: any;
 validation?: {
 pattern?: string;
 min?: number;
 max?: number;
 enum?: any[];
 };
}

export interface WorkflowExample {
 name: string;
 description: string;
 parameters: Record<string, any>;
}