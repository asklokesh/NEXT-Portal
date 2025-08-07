import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface WorkflowDesign {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  triggers: WorkflowTrigger[];
  metadata: WorkflowMetadata;
  canvas: CanvasSettings;
  validation: ValidationResult;
  execution: ExecutionHistory[];
  created: string;
  updated: string;
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  size: Size;
  data: NodeData;
  style: NodeStyle;
  ports: NodePort[];
  constraints: NodeConstraints;
  status?: NodeStatus;
}

type NodeType = 
  | 'plugin-install'
  | 'plugin-configure'
  | 'plugin-enable'
  | 'plugin-disable'
  | 'plugin-update'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'merge'
  | 'delay'
  | 'webhook'
  | 'notification'
  | 'approval'
  | 'script'
  | 'database'
  | 'api-call'
  | 'file-operation'
  | 'data-transform'
  | 'validation'
  | 'rollback'
  | 'start'
  | 'end'
  | 'error-handler';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface NodeData {
  label: string;
  description?: string;
  config: Record<string, any>;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
  errorHandling?: ErrorHandling;
  retry?: RetryConfig;
  timeout?: number;
  environment?: string[];
  permissions?: string[];
}

interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

interface ErrorHandling {
  strategy: 'ignore' | 'retry' | 'rollback' | 'fail' | 'branch';
  maxRetries?: number;
  retryDelay?: number;
  fallbackNode?: string;
  rollbackNodes?: string[];
}

interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay?: number;
  retryOn?: string[];
}

interface NodeStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  textColor: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  opacity: number;
  shadow: boolean;
  icon?: string;
  theme: 'default' | 'success' | 'warning' | 'error' | 'info';
}

interface NodePort {
  id: string;
  type: 'input' | 'output' | 'error';
  position: 'top' | 'right' | 'bottom' | 'left';
  offset: number;
  dataType: string;
  required: boolean;
  multiple: boolean;
  label?: string;
}

interface NodeConstraints {
  minInputs: number;
  maxInputs: number;
  minOutputs: number;
  maxOutputs: number;
  allowedPrevious?: NodeType[];
  allowedNext?: NodeType[];
  requiredAfter?: NodeType[];
  exclusiveWith?: NodeType[];
}

interface NodeStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  startTime?: string;
  endTime?: string;
  duration?: number;
  progress?: number;
  message?: string;
  error?: string;
  outputs?: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
  type: EdgeType;
  condition?: EdgeCondition;
  data?: EdgeData;
  style: EdgeStyle;
}

type EdgeType = 
  | 'default'
  | 'conditional'
  | 'error'
  | 'loop-back'
  | 'parallel-fork'
  | 'parallel-join'
  | 'data-flow'
  | 'control-flow';

interface EdgeCondition {
  expression: string;
  variables: string[];
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'regex';
  value: any;
  caseSensitive?: boolean;
}

interface EdgeData {
  label?: string;
  weight?: number;
  priority?: number;
  dataMapping?: DataMapping[];
}

interface DataMapping {
  sourceField: string;
  targetField: string;
  transform?: DataTransform;
}

interface DataTransform {
  type: 'map' | 'filter' | 'reduce' | 'format' | 'validate' | 'custom';
  function: string;
  parameters?: Record<string, any>;
}

interface EdgeStyle {
  strokeColor: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerEnd: 'arrow' | 'circle' | 'diamond' | 'none';
  animated: boolean;
  curvature: number;
}

interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  scope: 'global' | 'local' | 'input' | 'output';
  value?: any;
  defaultValue?: any;
  description?: string;
  validation?: VariableValidation;
  sensitive: boolean;
}

interface VariableValidation {
  required: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
  custom?: string;
}

interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  enabled: boolean;
  config: TriggerConfig;
  schedule?: CronSchedule;
  conditions?: TriggerCondition[];
}

type TriggerType = 
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'event'
  | 'file-watch'
  | 'api-endpoint'
  | 'plugin-event'
  | 'system-event'
  | 'dependency-change';

interface TriggerConfig {
  parameters?: Record<string, any>;
  headers?: Record<string, string>;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  retries?: number;
}

interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2';
  credentials?: Record<string, string>;
}

interface RateLimitConfig {
  enabled: boolean;
  requests: number;
  window: number;
}

interface CronSchedule {
  expression: string;
  timezone: string;
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
}

interface TriggerCondition {
  field: string;
  operator: string;
  value: any;
  required: boolean;
}

interface WorkflowMetadata {
  author: string;
  tags: string[];
  category: string;
  version: string;
  changelog?: ChangelogEntry[];
  documentation?: string;
  examples?: WorkflowExample[];
  permissions: string[];
  environments: string[];
  dependencies: WorkflowDependency[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
  breaking: boolean;
}

interface WorkflowExample {
  name: string;
  description: string;
  inputs: Record<string, any>;
  expectedOutputs: Record<string, any>;
}

interface WorkflowDependency {
  type: 'plugin' | 'service' | 'external';
  name: string;
  version?: string;
  required: boolean;
  description?: string;
}

interface CanvasSettings {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
  theme: 'light' | 'dark' | 'auto';
  minimap: boolean;
  toolbar: boolean;
  ruler: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: ValidationCoverage;
}

interface ValidationError {
  id: string;
  type: 'syntax' | 'logic' | 'data' | 'security' | 'performance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  edgeId?: string;
  suggestion?: string;
}

interface ValidationWarning {
  id: string;
  message: string;
  nodeId?: string;
  recommendation?: string;
}

interface ValidationCoverage {
  nodesCovered: number;
  totalNodes: number;
  edgesCovered: number;
  totalEdges: number;
  pathsCovered: number;
  totalPaths: number;
  percentage: number;
}

interface ExecutionHistory {
  id: string;
  workflowId: string;
  version: string;
  trigger: ExecutionTrigger;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  nodeExecutions: NodeExecution[];
  errors?: ExecutionError[];
  metrics: ExecutionMetrics;
}

interface ExecutionTrigger {
  type: TriggerType;
  userId?: string;
  source: string;
  parameters: Record<string, any>;
}

interface ExecutionStatus {
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  message?: string;
  progress: number;
  currentNode?: string;
}

interface NodeExecution {
  nodeId: string;
  status: NodeStatus;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  logs: ExecutionLog[];
}

interface ExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data?: any;
}

interface ExecutionError {
  nodeId?: string;
  error: string;
  stack?: string;
  code?: string;
  recoverable: boolean;
}

interface ExecutionMetrics {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  averageNodeDuration: number;
  longestPath: string[];
  bottleneckNodes: string[];
  resourceUsage: ResourceUsage;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Partial<WorkflowDesign>;
  parameters: TemplateParameter[];
  examples: WorkflowExample[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
}

interface TemplateParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: VariableValidation;
}

// Storage
const workflows = new Map<string, WorkflowDesign>();
const templates = new Map<string, WorkflowTemplate>();
const executions = new Map<string, ExecutionHistory>();

// Initialize sample templates
const initializeTemplates = () => {
  const sampleTemplates: WorkflowTemplate[] = [
    {
      id: 'plugin-deployment',
      name: 'Plugin Deployment Pipeline',
      description: 'Complete plugin deployment with testing and rollback',
      category: 'deployment',
      workflow: {
        name: 'Plugin Deployment Pipeline',
        description: 'Automated plugin deployment with validation',
        nodes: [
          {
            id: 'start',
            type: 'start',
            position: { x: 100, y: 100 },
            size: { width: 120, height: 60 },
            data: {
              label: 'Start',
              config: {}
            },
            style: {
              backgroundColor: '#e8f5e8',
              borderColor: '#4caf50',
              borderWidth: 2,
              borderRadius: 8,
              textColor: '#2e7d32',
              fontSize: 14,
              fontWeight: 'bold',
              opacity: 1,
              shadow: true,
              theme: 'success'
            },
            ports: [
              {
                id: 'out',
                type: 'output',
                position: 'right',
                offset: 0.5,
                dataType: 'trigger',
                required: false,
                multiple: false
              }
            ],
            constraints: {
              minInputs: 0,
              maxInputs: 0,
              minOutputs: 1,
              maxOutputs: 1
            }
          },
          {
            id: 'validate',
            type: 'validation',
            position: { x: 300, y: 100 },
            size: { width: 140, height: 80 },
            data: {
              label: 'Validate Plugin',
              description: 'Validate plugin configuration and dependencies',
              config: {
                checks: ['syntax', 'dependencies', 'security', 'compatibility'],
                stopOnError: true
              }
            },
            style: {
              backgroundColor: '#fff3e0',
              borderColor: '#ff9800',
              borderWidth: 2,
              borderRadius: 8,
              textColor: '#e65100',
              fontSize: 12,
              fontWeight: 'normal',
              opacity: 1,
              shadow: true,
              theme: 'warning'
            },
            ports: [
              {
                id: 'in',
                type: 'input',
                position: 'left',
                offset: 0.5,
                dataType: 'trigger',
                required: true,
                multiple: false
              },
              {
                id: 'out-success',
                type: 'output',
                position: 'right',
                offset: 0.3,
                dataType: 'validation-result',
                required: false,
                multiple: false,
                label: 'Valid'
              },
              {
                id: 'out-error',
                type: 'error',
                position: 'bottom',
                offset: 0.5,
                dataType: 'error',
                required: false,
                multiple: false,
                label: 'Invalid'
              }
            ],
            constraints: {
              minInputs: 1,
              maxInputs: 1,
              minOutputs: 1,
              maxOutputs: 2
            }
          }
        ],
        edges: [
          {
            id: 'start-validate',
            source: 'start',
            target: 'validate',
            sourcePort: 'out',
            targetPort: 'in',
            type: 'default',
            style: {
              strokeColor: '#666',
              strokeWidth: 2,
              markerEnd: 'arrow',
              animated: false,
              curvature: 0.2
            }
          }
        ]
      },
      parameters: [
        {
          name: 'pluginId',
          type: 'string',
          description: 'ID of the plugin to deploy',
          required: true,
          validation: {
            required: true,
            pattern: '^@[a-z0-9-]+/[a-z0-9-]+$'
          }
        },
        {
          name: 'environment',
          type: 'string',
          description: 'Target deployment environment',
          required: true,
          defaultValue: 'staging',
          validation: {
            required: true,
            enum: ['development', 'staging', 'production']
          }
        }
      ],
      examples: [
        {
          name: 'Deploy Catalog Plugin',
          description: 'Deploy the Backstage catalog plugin to staging',
          inputs: {
            pluginId: '@backstage/plugin-catalog',
            environment: 'staging'
          },
          expectedOutputs: {
            deploymentId: 'deploy-123',
            status: 'success',
            url: 'https://staging.backstage.example.com'
          }
        }
      ],
      tags: ['deployment', 'automation', 'ci-cd'],
      difficulty: 'intermediate',
      estimatedDuration: 600 // 10 minutes
    },
    {
      id: 'plugin-health-check',
      name: 'Plugin Health Monitoring',
      description: 'Continuous health monitoring with automated alerts',
      category: 'monitoring',
      workflow: {
        name: 'Plugin Health Check',
        description: 'Monitor plugin health and send alerts'
      },
      parameters: [
        {
          name: 'checkInterval',
          type: 'number',
          description: 'Health check interval in seconds',
          required: false,
          defaultValue: 60
        }
      ],
      examples: [],
      tags: ['monitoring', 'health-check', 'alerts'],
      difficulty: 'beginner',
      estimatedDuration: 300
    }
  ];

  sampleTemplates.forEach(template => {
    templates.set(template.id, template);
  });
};

// Initialize templates
initializeTemplates();

// Validate workflow design
const validateWorkflow = (workflow: WorkflowDesign): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for start node
  const startNodes = workflow.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      id: 'no-start-node',
      type: 'logic',
      severity: 'error',
      message: 'Workflow must have at least one start node'
    });
  } else if (startNodes.length > 1) {
    warnings.push({
      id: 'multiple-start-nodes',
      message: 'Multiple start nodes detected, only one will be used'
    });
  }

  // Check for end nodes
  const endNodes = workflow.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    warnings.push({
      id: 'no-end-node',
      message: 'Consider adding an end node for clarity'
    });
  }

  // Check for disconnected nodes
  const connectedNodes = new Set<string>();
  workflow.edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  workflow.nodes.forEach(node => {
    if (!connectedNodes.has(node.id) && node.type !== 'start') {
      warnings.push({
        id: `disconnected-${node.id}`,
        message: `Node "${node.data.label}" is not connected to the workflow`,
        nodeId: node.id,
        recommendation: 'Connect this node or remove it'
      });
    }
  });

  // Check for circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingEdges = workflow.edges.filter(e => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of workflow.nodes) {
    if (hasCycle(node.id)) {
      errors.push({
        id: 'circular-dependency',
        type: 'logic',
        severity: 'error',
        message: 'Circular dependency detected in workflow',
        suggestion: 'Remove circular references or add proper loop constructs'
      });
      break;
    }
  }

  // Calculate coverage
  const coverage: ValidationCoverage = {
    nodesCovered: connectedNodes.size,
    totalNodes: workflow.nodes.length,
    edgesCovered: workflow.edges.length,
    totalEdges: workflow.edges.length,
    pathsCovered: 0, // Would need path analysis
    totalPaths: 0,
    percentage: connectedNodes.size / workflow.nodes.length * 100
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverage
  };
};

// Execute workflow (simulation)
const executeWorkflow = async (
  workflowId: string,
  inputs: Record<string, any>,
  trigger: ExecutionTrigger
): Promise<ExecutionHistory> => {
  const workflow = workflows.get(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const executionId = crypto.randomBytes(16).toString('hex');
  const startTime = new Date().toISOString();

  const execution: ExecutionHistory = {
    id: executionId,
    workflowId,
    version: workflow.version,
    trigger,
    status: {
      state: 'running',
      progress: 0,
      currentNode: 'start'
    },
    startTime,
    inputs,
    nodeExecutions: [],
    metrics: {
      totalNodes: workflow.nodes.length,
      completedNodes: 0,
      failedNodes: 0,
      skippedNodes: 0,
      averageNodeDuration: 0,
      longestPath: [],
      bottleneckNodes: [],
      resourceUsage: {
        cpu: 0,
        memory: 0,
        network: 0,
        storage: 0
      }
    }
  };

  // Simulate workflow execution
  const startNodes = workflow.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    execution.status.state = 'failed';
    execution.errors = [{
      error: 'No start node found',
      recoverable: false
    }];
    return execution;
  }

  // Execute nodes in topological order (simplified simulation)
  for (const node of workflow.nodes) {
    const nodeStart = Date.now();
    
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      status: {
        state: 'running',
        startTime: new Date().toISOString()
      },
      inputs: node.id === startNodes[0].id ? inputs : {},
      logs: []
    };

    // Simulate node processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    const duration = Date.now() - nodeStart;
    nodeExecution.status = {
      state: Math.random() > 0.1 ? 'completed' : 'failed',
      startTime: nodeExecution.status.startTime,
      endTime: new Date().toISOString(),
      duration,
      progress: 100,
      outputs: node.type === 'end' ? { result: 'success' } : { processed: true }
    };

    nodeExecution.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Node ${node.data.label} ${nodeExecution.status.state}`
    });

    execution.nodeExecutions.push(nodeExecution);

    if (nodeExecution.status.state === 'completed') {
      execution.metrics.completedNodes++;
    } else {
      execution.metrics.failedNodes++;
    }

    execution.status.progress = (execution.metrics.completedNodes / workflow.nodes.length) * 100;
  }

  execution.status.state = execution.metrics.failedNodes > 0 ? 'failed' : 'completed';
  execution.endTime = new Date().toISOString();
  execution.duration = Date.now() - new Date(startTime).getTime();
  execution.outputs = { executionId, status: execution.status.state };

  executions.set(executionId, execution);
  return execution;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const workflow: WorkflowDesign = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name || 'New Workflow',
          description: body.description || '',
          version: '1.0.0',
          nodes: body.nodes || [],
          edges: body.edges || [],
          variables: body.variables || [],
          triggers: body.triggers || [],
          metadata: body.metadata || {
            author: 'system',
            tags: [],
            category: 'general',
            version: '1.0.0',
            permissions: [],
            environments: ['development'],
            dependencies: []
          },
          canvas: body.canvas || {
            width: 2000,
            height: 1500,
            zoom: 1,
            panX: 0,
            panY: 0,
            gridSize: 20,
            showGrid: true,
            snapToGrid: true,
            theme: 'light',
            minimap: true,
            toolbar: true,
            ruler: false
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [],
            coverage: {
              nodesCovered: 0,
              totalNodes: 0,
              edgesCovered: 0,
              totalEdges: 0,
              pathsCovered: 0,
              totalPaths: 0,
              percentage: 0
            }
          },
          execution: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        workflows.set(workflow.id, workflow);

        return NextResponse.json({
          success: true,
          workflow
        });
      }

      case 'update': {
        const { id, ...updates } = body;
        const workflow = workflows.get(id);

        if (!workflow) {
          return NextResponse.json({
            success: false,
            error: 'Workflow not found'
          }, { status: 404 });
        }

        Object.assign(workflow, updates, {
          updated: new Date().toISOString()
        });

        // Re-validate workflow
        workflow.validation = validateWorkflow(workflow);

        return NextResponse.json({
          success: true,
          workflow
        });
      }

      case 'validate': {
        const { id } = body;
        const workflow = workflows.get(id);

        if (!workflow) {
          return NextResponse.json({
            success: false,
            error: 'Workflow not found'
          }, { status: 404 });
        }

        const validation = validateWorkflow(workflow);
        workflow.validation = validation;

        return NextResponse.json({
          success: true,
          validation
        });
      }

      case 'execute': {
        const { id, inputs, trigger } = body;
        
        const executionTrigger: ExecutionTrigger = trigger || {
          type: 'manual',
          source: 'api',
          parameters: {}
        };

        const execution = await executeWorkflow(id, inputs || {}, executionTrigger);

        return NextResponse.json({
          success: true,
          execution
        });
      }

      case 'clone': {
        const { id, name } = body;
        const original = workflows.get(id);

        if (!original) {
          return NextResponse.json({
            success: false,
            error: 'Workflow not found'
          }, { status: 404 });
        }

        const cloned: WorkflowDesign = {
          ...JSON.parse(JSON.stringify(original)),
          id: crypto.randomBytes(8).toString('hex'),
          name: name || `${original.name} (Copy)`,
          execution: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        workflows.set(cloned.id, cloned);

        return NextResponse.json({
          success: true,
          workflow: cloned
        });
      }

      case 'delete': {
        const { id } = body;

        if (!workflows.delete(id)) {
          return NextResponse.json({
            success: false,
            error: 'Workflow not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Workflow deleted'
        });
      }

      case 'create_template': {
        const template: WorkflowTemplate = {
          id: crypto.randomBytes(8).toString('hex'),
          name: body.name,
          description: body.description,
          category: body.category || 'general',
          workflow: body.workflow,
          parameters: body.parameters || [],
          examples: body.examples || [],
          tags: body.tags || [],
          difficulty: body.difficulty || 'beginner',
          estimatedDuration: body.estimatedDuration || 300
        };

        templates.set(template.id, template);

        return NextResponse.json({
          success: true,
          template
        });
      }

      case 'from_template': {
        const { templateId, parameters } = body;
        const template = templates.get(templateId);

        if (!template) {
          return NextResponse.json({
            success: false,
            error: 'Template not found'
          }, { status: 404 });
        }

        const workflow: WorkflowDesign = {
          id: crypto.randomBytes(8).toString('hex'),
          name: template.name,
          description: template.description,
          version: '1.0.0',
          nodes: template.workflow.nodes || [],
          edges: template.workflow.edges || [],
          variables: template.workflow.variables || [],
          triggers: template.workflow.triggers || [],
          metadata: {
            author: 'template',
            tags: template.tags,
            category: template.category,
            version: '1.0.0',
            permissions: [],
            environments: ['development'],
            dependencies: []
          },
          canvas: {
            width: 2000,
            height: 1500,
            zoom: 1,
            panX: 0,
            panY: 0,
            gridSize: 20,
            showGrid: true,
            snapToGrid: true,
            theme: 'light',
            minimap: true,
            toolbar: true,
            ruler: false
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [],
            coverage: {
              nodesCovered: 0,
              totalNodes: 0,
              edgesCovered: 0,
              totalEdges: 0,
              pathsCovered: 0,
              totalPaths: 0,
              percentage: 0
            }
          },
          execution: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        // Apply parameters
        if (parameters) {
          template.parameters.forEach(param => {
            if (parameters[param.name] !== undefined) {
              workflow.variables.push({
                id: crypto.randomBytes(4).toString('hex'),
                name: param.name,
                type: param.type as any,
                scope: 'global',
                value: parameters[param.name],
                description: param.description
              });
            }
          });
        }

        workflows.set(workflow.id, workflow);

        return NextResponse.json({
          success: true,
          workflow
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Workflow designer error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process workflow request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (id) {
      const workflow = workflows.get(id);
      if (!workflow) {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        workflow
      });
    }

    if (type === 'templates') {
      return NextResponse.json({
        success: true,
        templates: Array.from(templates.values())
      });
    }

    if (type === 'executions') {
      const workflowId = searchParams.get('workflowId');
      let executionList = Array.from(executions.values());
      
      if (workflowId) {
        executionList = executionList.filter(e => e.workflowId === workflowId);
      }

      return NextResponse.json({
        success: true,
        executions: executionList
      });
    }

    // Return all workflows
    return NextResponse.json({
      success: true,
      workflows: Array.from(workflows.values()),
      total: workflows.size
    });

  } catch (error) {
    console.error('Workflow designer GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch workflow data'
    }, { status: 500 });
  }
}