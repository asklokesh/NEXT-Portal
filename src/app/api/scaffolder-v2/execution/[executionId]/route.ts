import { NextRequest, NextResponse } from 'next/server';
import { TemplateExecution } from '@/lib/scaffolder-v2/types';

// Mock execution storage - in production this would be a database
// This should be the same Map instance as in the main execution route
declare global {
  var executions: Map<string, TemplateExecution> | undefined;
}

const getExecutions = () => {
  if (!global.executions) {
    global.executions = new Map<string, TemplateExecution>();
  }
  return global.executions;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const executions = getExecutions();
    const execution = executions.get(params.executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const body = await request.json();
    const { action } = body;

    const executions = getExecutions();
    const execution = executions.get(params.executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'cancel':
        if (execution.status === 'running' || execution.status === 'pending') {
          execution.status = 'cancelled';
          execution.endTime = new Date().toISOString();
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Template execution cancelled by user'
          });
          
          return NextResponse.json({
            success: true,
            message: 'Execution cancelled successfully'
          });
        } else {
          return NextResponse.json(
            { error: `Cannot cancel execution with status: ${execution.status}` },
            { status: 400 }
          );
        }

      case 'retry':
        if (execution.status === 'failed' || execution.status === 'cancelled') {
          // Reset execution state for retry
          execution.status = 'pending';
          execution.progress = {
            currentStep: 0,
            totalSteps: execution.progress.totalSteps,
            percentage: 0,
            message: 'Retrying template execution...'
          };
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Template execution retry initiated'
          });
          execution.error = undefined;
          execution.endTime = undefined;

          // Start async retry (this would call the same execution function)
          return NextResponse.json({
            success: true,
            message: 'Execution retry initiated'
          });
        } else {
          return NextResponse.json(
            { error: `Cannot retry execution with status: ${execution.status}` },
            { status: 400 }
          );
        }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error performing execution action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const executions = getExecutions();
    const execution = executions.get(params.executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of completed, failed, or cancelled executions
    if (execution.status === 'running' || execution.status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete running or pending execution' },
        { status: 400 }
      );
    }

    executions.delete(params.executionId);

    return NextResponse.json({
      success: true,
      message: 'Execution deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting execution:', error);
    return NextResponse.json(
      { error: 'Failed to delete execution' },
      { status: 500 }
    );
  }
}