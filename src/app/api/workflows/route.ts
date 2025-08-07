import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngine, createWorkflowFromTemplate, getAvailableTemplates } from '@/lib/workflows';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Request schemas
const CreateWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['deployment', 'approval', 'maintenance', 'compliance', 'onboarding', 'incident_response', 'custom']),
  trigger: z.object({
    type: z.enum(['manual', 'schedule', 'webhook', 'event', 'api']),
    config: z.record(z.any()).default({})
  }),
  steps: z.array(z.any()), // Step validation handled by workflow engine
  variables: z.record(z.any()).default({}),
  permissions: z.object({
    execute: z.array(z.string()).default([]),
    approve: z.array(z.string()).default([]),
    view: z.array(z.string()).default([])
  }).default({})
});

const StartExecutionSchema = z.object({
  workflowId: z.string().min(1),
  input: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({})
});

const ProcessApprovalSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().optional()
});

const CreateFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  customizations: z.record(z.any()).default({})
});

// GET - Retrieve workflows, executions, or approvals
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');
      const workflowEngine = getWorkflowEngine();

      switch (action) {
        case 'workflows':
          const workflows = workflowEngine.getAllWorkflows();
          const filteredWorkflows = workflows.filter(w => 
            w.permissions.view.length === 0 || 
            w.permissions.view.includes(user.id) ||
            w.permissions.view.includes(user.role)
          );
          
          logger.info('Workflows retrieved', {
            user: user.id,
            total: workflows.length,
            accessible: filteredWorkflows.length
          });
          
          return NextResponse.json({
            workflows: filteredWorkflows,
            total: filteredWorkflows.length
          });

        case 'workflow':
          const workflowId = searchParams.get('workflowId');
          if (!workflowId) {
            return NextResponse.json(
              { error: 'Workflow ID is required' },
              { status: 400 }
            );
          }
          
          const workflow = workflowEngine.getWorkflow(workflowId);
          if (!workflow) {
            return NextResponse.json(
              { error: 'Workflow not found' },
              { status: 404 }
            );
          }
          
          // Check view permission
          if (workflow.permissions.view.length > 0 &&
              !workflow.permissions.view.includes(user.id) &&
              !workflow.permissions.view.includes(user.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions to view this workflow' },
              { status: 403 }
            );
          }
          
          return NextResponse.json({ workflow });

        case 'executions':
          const executionWorkflowId = searchParams.get('workflowId');
          const executions = workflowEngine.getAllExecutions(executionWorkflowId || undefined);
          
          // Filter executions based on workflow permissions
          const accessibleExecutions = executions.filter(exec => {
            const workflow = workflowEngine.getWorkflow(exec.workflowId);
            return workflow && (
              workflow.permissions.view.length === 0 ||
              workflow.permissions.view.includes(user.id) ||
              workflow.permissions.view.includes(user.role) ||
              exec.startedBy === user.id
            );
          });
          
          logger.info('Executions retrieved', {
            user: user.id,
            workflowId: executionWorkflowId,
            total: executions.length,
            accessible: accessibleExecutions.length
          });
          
          return NextResponse.json({
            executions: accessibleExecutions,
            total: accessibleExecutions.length
          });

        case 'execution':
          const executionId = searchParams.get('executionId');
          if (!executionId) {
            return NextResponse.json(
              { error: 'Execution ID is required' },
              { status: 400 }
            );
          }
          
          const execution = workflowEngine.getExecution(executionId);
          if (!execution) {
            return NextResponse.json(
              { error: 'Execution not found' },
              { status: 404 }
            );
          }
          
          // Check permissions
          const executionWorkflow = workflowEngine.getWorkflow(execution.workflowId);
          if (executionWorkflow &&
              executionWorkflow.permissions.view.length > 0 &&
              !executionWorkflow.permissions.view.includes(user.id) &&
              !executionWorkflow.permissions.view.includes(user.role) &&
              execution.startedBy !== user.id) {
            return NextResponse.json(
              { error: 'Insufficient permissions to view this execution' },
              { status: 403 }
            );
          }
          
          return NextResponse.json({ execution });

        case 'approvals':
          const pendingApprovals = workflowEngine.getPendingApprovals(user.id);
          
          logger.info('Pending approvals retrieved', {
            user: user.id,
            count: pendingApprovals.length
          });
          
          return NextResponse.json({
            approvals: pendingApprovals,
            total: pendingApprovals.length
          });

        case 'approval':
          const approvalId = searchParams.get('approvalId');
          if (!approvalId) {
            return NextResponse.json(
              { error: 'Approval ID is required' },
              { status: 400 }
            );
          }
          
          const approval = workflowEngine.getApprovalRequest(approvalId);
          if (!approval) {
            return NextResponse.json(
              { error: 'Approval request not found' },
              { status: 404 }
            );
          }
          
          // Check if user is an approver
          if (!approval.approvers.includes(user.id)) {
            return NextResponse.json(
              { error: 'User is not authorized to view this approval request' },
              { status: 403 }
            );
          }
          
          return NextResponse.json({ approval });

        case 'templates':
          const templates = getAvailableTemplates();
          
          return NextResponse.json({
            templates,
            total: templates.length
          });

        case 'stats':
          const stats = workflowEngine.getStats();
          
          return NextResponse.json({ stats });

        default:
          // Return dashboard overview
          const allWorkflows = workflowEngine.getAllWorkflows();
          const allExecutions = workflowEngine.getAllExecutions();
          const userApprovals = workflowEngine.getPendingApprovals(user.id);
          const engineStats = workflowEngine.getStats();
          
          // Filter by user permissions
          const userWorkflows = allWorkflows.filter(w => 
            w.permissions.view.length === 0 || 
            w.permissions.view.includes(user.id) ||
            w.permissions.view.includes(user.role)
          );
          
          const userExecutions = allExecutions.filter(exec => {
            const workflow = workflowEngine.getWorkflow(exec.workflowId);
            return workflow && (
              workflow.permissions.view.length === 0 ||
              workflow.permissions.view.includes(user.id) ||
              workflow.permissions.view.includes(user.role) ||
              exec.startedBy === user.id
            );
          }).slice(0, 10); // Recent 10
          
          return NextResponse.json({
            overview: {
              accessibleWorkflows: userWorkflows.length,
              recentExecutions: userExecutions.length,
              pendingApprovals: userApprovals.length,
              engineStats
            },
            recentExecutions: userExecutions,
            pendingApprovals: userApprovals.slice(0, 5)
          });
      }
    } catch (error) {
      logger.error('Workflows API error', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });
      
      return NextResponse.json(
        { error: 'Workflows operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// POST - Create workflows or start executions
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      const workflowEngine = getWorkflowEngine();

      switch (action) {
        case 'create-workflow':
          const workflowData = CreateWorkflowSchema.parse(body);
          
          const newWorkflow = {
            id: `workflow-${Date.now()}`,
            ...workflowData,
            version: '1.0.0',
            enabled: true,
            createdBy: user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          workflowEngine.createWorkflow(newWorkflow);
          
          logger.info('Workflow created', {
            user: user.id,
            workflowId: newWorkflow.id,
            name: newWorkflow.name,
            stepsCount: newWorkflow.steps.length
          });
          
          return NextResponse.json({
            success: true,
            workflow: newWorkflow
          });

        case 'create-from-template':
          const templateData = CreateFromTemplateSchema.parse(body);
          
          const workflowFromTemplate = createWorkflowFromTemplate(
            templateData.templateId,
            {
              id: `workflow-${Date.now()}`,
              name: templateData.name,
              description: templateData.description,
              createdBy: user.id,
              ...templateData.customizations
            }
          );
          
          workflowEngine.createWorkflow(workflowFromTemplate);
          
          logger.info('Workflow created from template', {
            user: user.id,
            templateId: templateData.templateId,
            workflowId: workflowFromTemplate.id,
            name: workflowFromTemplate.name
          });
          
          return NextResponse.json({
            success: true,
            workflow: workflowFromTemplate
          });

        case 'start-execution':
          const executionData = StartExecutionSchema.parse(body);
          
          const workflow = workflowEngine.getWorkflow(executionData.workflowId);
          if (!workflow) {
            return NextResponse.json(
              { error: 'Workflow not found' },
              { status: 404 }
            );
          }
          
          // Check execute permission
          if (workflow.permissions.execute.length > 0 &&
              !workflow.permissions.execute.includes(user.id) &&
              !workflow.permissions.execute.includes(user.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions to execute this workflow' },
              { status: 403 }
            );
          }
          
          const executionId = await workflowEngine.startExecution(
            executionData.workflowId,
            executionData.input,
            user.id,
            executionData.metadata
          );
          
          logger.info('Workflow execution started', {
            user: user.id,
            workflowId: executionData.workflowId,
            executionId,
            inputKeys: Object.keys(executionData.input)
          });
          
          return NextResponse.json({
            success: true,
            executionId,
            message: 'Workflow execution started successfully'
          });

        case 'process-approval':
          const approvalData = ProcessApprovalSchema.parse(body);
          
          await workflowEngine.processApproval(
            approvalData.approvalId,
            user.id,
            approvalData.decision,
            approvalData.comment
          );
          
          logger.info('Approval processed', {
            user: user.id,
            approvalId: approvalData.approvalId,
            decision: approvalData.decision
          });
          
          return NextResponse.json({
            success: true,
            message: `Approval ${approvalData.decision} successfully`
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Workflows POST operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// PUT - Update workflows or executions
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      const workflowEngine = getWorkflowEngine();

      switch (action) {
        case 'update-workflow':
          const workflowId = searchParams.get('workflowId');
          if (!workflowId) {
            return NextResponse.json(
              { error: 'Workflow ID is required' },
              { status: 400 }
            );
          }
          
          const existingWorkflow = workflowEngine.getWorkflow(workflowId);
          if (!existingWorkflow) {
            return NextResponse.json(
              { error: 'Workflow not found' },
              { status: 404 }
            );
          }
          
          // Check if user can modify this workflow
          if (existingWorkflow.createdBy !== user.id && user.role !== 'admin') {
            return NextResponse.json(
              { error: 'Insufficient permissions to modify this workflow' },
              { status: 403 }
            );
          }
          
          workflowEngine.updateWorkflow(workflowId, body);
          
          logger.info('Workflow updated', {
            user: user.id,
            workflowId,
            updatedFields: Object.keys(body)
          });
          
          return NextResponse.json({
            success: true,
            message: 'Workflow updated successfully'
          });

        case 'cancel-execution':
          const executionId = searchParams.get('executionId');
          if (!executionId) {
            return NextResponse.json(
              { error: 'Execution ID is required' },
              { status: 400 }
            );
          }
          
          const execution = workflowEngine.getExecution(executionId);
          if (!execution) {
            return NextResponse.json(
              { error: 'Execution not found' },
              { status: 404 }
            );
          }
          
          // Check if user can cancel this execution
          if (execution.startedBy !== user.id && user.role !== 'admin') {
            const workflow = workflowEngine.getWorkflow(execution.workflowId);
            if (workflow &&
                workflow.permissions.execute.length > 0 &&
                !workflow.permissions.execute.includes(user.id) &&
                !workflow.permissions.execute.includes(user.role)) {
              return NextResponse.json(
                { error: 'Insufficient permissions to cancel this execution' },
                { status: 403 }
              );
            }
          }
          
          await workflowEngine.cancelExecution(executionId, user.id);
          
          logger.info('Execution cancelled', {
            user: user.id,
            executionId,
            workflowId: execution.workflowId
          });
          
          return NextResponse.json({
            success: true,
            message: 'Execution cancelled successfully'
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Workflows PUT operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// DELETE - Delete workflows
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const workflowId = searchParams.get('workflowId');

      if (!workflowId) {
        return NextResponse.json(
          { error: 'Workflow ID is required' },
          { status: 400 }
        );
      }

      const workflowEngine = getWorkflowEngine();
      const workflow = workflowEngine.getWorkflow(workflowId);
      
      if (!workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        );
      }

      // Check if user can delete this workflow
      if (workflow.createdBy !== user.id && user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete this workflow' },
          { status: 403 }
        );
      }

      workflowEngine.deleteWorkflow(workflowId);
      
      logger.info('Workflow deleted', {
        user: user.id,
        workflowId,
        name: workflow.name
      });

      return NextResponse.json({
        success: true,
        message: 'Workflow deleted successfully'
      });
    } catch (error) {
      logger.error('Workflows DELETE operation failed', {
        error: error.message,
        user: user?.id
      });

      return NextResponse.json(
        { error: 'Delete failed', details: error.message },
        { status: 500 }
      );
    }
  });
}