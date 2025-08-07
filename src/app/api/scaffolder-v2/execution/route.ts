import { NextRequest, NextResponse } from 'next/server';
import { TemplateExecution, TemplateParameter } from '@/lib/scaffolder-v2/types';

// Mock execution storage - in production this would be a database
const executions = new Map<string, TemplateExecution>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateVersion, userId, parameters } = body;

    if (!templateId || !userId || !parameters) {
      return NextResponse.json(
        { error: 'Template ID, user ID, and parameters are required' },
        { status: 400 }
      );
    }

    // Create new execution
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: TemplateExecution = {
      id: executionId,
      templateId,
      templateVersion: templateVersion || '1.0.0',
      userId,
      parameters,
      status: 'pending',
      progress: {
        currentStep: 0,
        totalSteps: 5, // Mock value
        percentage: 0,
        message: 'Initializing template execution...'
      },
      outputs: [],
      logs: [{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Template execution started',
        data: { templateId, userId }
      }],
      startTime: new Date().toISOString()
    };

    executions.set(executionId, execution);

    // Start async execution
    executeTemplateAsync(executionId);

    return NextResponse.json({
      executionId,
      status: 'started',
      message: 'Template execution initiated'
    }, { status: 201 });
  } catch (error) {
    console.error('Error starting template execution:', error);
    return NextResponse.json(
      { error: 'Failed to start template execution' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let filteredExecutions = Array.from(executions.values());

    if (userId) {
      filteredExecutions = filteredExecutions.filter(exec => exec.userId === userId);
    }

    if (status) {
      filteredExecutions = filteredExecutions.filter(exec => exec.status === status);
    }

    // Sort by start time (most recent first)
    filteredExecutions.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    return NextResponse.json({
      executions: filteredExecutions.slice(0, limit),
      totalCount: filteredExecutions.length
    });
  } catch (error) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}

// Mock async template execution
async function executeTemplateAsync(executionId: string) {
  const execution = executions.get(executionId);
  if (!execution) return;

  try {
    // Simulate execution steps
    const steps = [
      'Validating parameters',
      'Setting up workspace',
      'Generating project files',
      'Installing dependencies',
      'Running post-generation scripts'
    ];

    execution.status = 'running';
    execution.progress.totalSteps = steps.length;

    for (let i = 0; i < steps.length; i++) {
      // Simulate step execution time
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      execution.progress.currentStep = i + 1;
      execution.progress.percentage = Math.round(((i + 1) / steps.length) * 100);
      execution.progress.message = steps[i];

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Completed step: ${steps[i]}`,
        step: `step-${i + 1}`
      });

      // Simulate potential failure
      if (Math.random() < 0.1) { // 10% chance of failure
        execution.status = 'failed';
        execution.endTime = new Date().toISOString();
        execution.error = {
          message: `Failed at step: ${steps[i]}`,
          step: `step-${i + 1}`,
          code: 'EXECUTION_ERROR'
        };
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: execution.error.message,
          step: execution.error.step
        });
        return;
      }
    }

    // Successful completion
    execution.status = 'completed';
    execution.progress.percentage = 100;
    execution.progress.message = 'Template execution completed successfully';
    execution.endTime = new Date().toISOString();
    
    // Add mock outputs
    execution.outputs = [
      {
        name: 'repositoryUrl',
        description: 'Repository URL',
        type: 'url',
        value: 'https://github.com/example/generated-project'
      },
      {
        name: 'projectPath',
        description: 'Local project path',
        type: 'file',
        value: '/workspace/generated-project'
      }
    ];

    execution.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Template execution completed successfully'
    });

  } catch (error) {
    execution.status = 'failed';
    execution.endTime = new Date().toISOString();
    execution.error = {
      message: (error as Error).message,
      step: 'unknown',
      code: 'INTERNAL_ERROR'
    };
    execution.logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: (error as Error).message
    });
  }
}