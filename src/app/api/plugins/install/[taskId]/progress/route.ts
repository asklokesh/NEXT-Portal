/**
 * Plugin Installation Progress Tracking API Route
 * Provides real-time progress updates for plugin installations
 */

import { NextRequest, NextResponse } from 'next/server';

interface InstallationTask {
  id: string;
  pluginId: string;
  status: 'pending' | 'validating' | 'installing' | 'configuring' | 'completed' | 'failed';
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
  validationResult?: any;
  installationResult?: any;
}

// This should be the same storage as in the main install route
// In production, use Redis or database for shared state
declare global {
  var installationTasks: Map<string, InstallationTask> | undefined;
}

const getInstallationTasks = (): Map<string, InstallationTask> => {
  if (!global.installationTasks) {
    global.installationTasks = new Map();
  }
  return global.installationTasks;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const installationTasks = getInstallationTasks();

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const task = installationTasks.get(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Installation task not found' },
        { status: 404 }
      );
    }

    // Calculate duration
    const duration = task.endTime 
      ? task.endTime.getTime() - task.startTime.getTime()
      : Date.now() - task.startTime.getTime();

    // Calculate estimated completion time
    let estimatedCompletion: Date | null = null;
    if (task.status !== 'completed' && task.status !== 'failed' && task.progress > 0) {
      const timePerPercent = duration / task.progress;
      const remainingTime = timePerPercent * (100 - task.progress);
      estimatedCompletion = new Date(Date.now() + remainingTime);
    }

    const response = {
      taskId: task.id,
      pluginId: task.pluginId,
      status: task.status,
      progress: task.progress,
      message: task.message,
      startTime: task.startTime.toISOString(),
      endTime: task.endTime?.toISOString(),
      duration: Math.round(duration / 1000), // in seconds
      estimatedCompletion: estimatedCompletion?.toISOString(),
      error: task.error,
      
      // Stage-specific information
      stages: {
        validation: {
          completed: task.progress >= 10,
          status: task.validationResult ? 'completed' : 
                 task.status === 'validating' ? 'in_progress' : 'pending',
          result: task.validationResult
        },
        installation: {
          completed: task.progress >= 80,
          status: task.installationResult ? 'completed' :
                 task.status === 'installing' ? 'in_progress' : 
                 task.progress >= 10 ? 'pending' : 'waiting',
          result: task.installationResult
        },
        configuration: {
          completed: task.progress >= 95,
          status: task.status === 'configuring' ? 'in_progress' :
                 task.progress >= 85 ? 'pending' : 'waiting'
        },
        completion: {
          completed: task.status === 'completed',
          status: task.status === 'completed' ? 'completed' :
                 task.progress >= 95 ? 'in_progress' : 'waiting'
        }
      },

      // Progress details
      progressDetails: getProgressDetails(task),
      
      // Next steps (if any)
      nextSteps: getNextSteps(task),
      
      // Troubleshooting info (if failed)
      troubleshooting: task.status === 'failed' ? getTroubleshootingInfo(task) : undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to get installation progress:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get installation progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Cancel an installation task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const installationTasks = getInstallationTasks();

    const task = installationTasks.get(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Installation task not found' },
        { status: 404 }
      );
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed or failed installation' },
        { status: 400 }
      );
    }

    // Mark task as cancelled (we'll use 'failed' status with specific error)
    task.status = 'failed';
    task.error = 'Installation cancelled by user';
    task.endTime = new Date();
    installationTasks.set(taskId, task);

    return NextResponse.json({
      message: 'Installation cancelled successfully',
      taskId,
      status: 'cancelled'
    });

  } catch (error) {
    console.error('Failed to cancel installation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cancel installation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get detailed progress information
 */
function getProgressDetails(task: InstallationTask): any {
  const details: any = {
    overallProgress: task.progress,
    currentStage: task.status,
    message: task.message
  };

  // Add stage-specific progress
  switch (task.status) {
    case 'validating':
      details.validationProgress = {
        message: 'Checking plugin compatibility and configuration',
        steps: [
          'Version compatibility check',
          'Dependency analysis',
          'Configuration validation',
          'Security assessment'
        ]
      };
      break;

    case 'installing':
      details.installationProgress = {
        message: 'Installing plugin package and dependencies',
        steps: [
          'Downloading plugin package',
          'Installing dependencies',
          'Updating application code',
          'Building assets'
        ]
      };
      break;

    case 'configuring':
      details.configurationProgress = {
        message: 'Applying plugin configuration',
        steps: [
          'Updating configuration files',
          'Setting up integrations',
          'Applying security settings',
          'Enabling plugin features'
        ]
      };
      break;
  }

  return details;
}

/**
 * Get next steps for the user
 */
function getNextSteps(task: InstallationTask): string[] {
  const steps: string[] = [];

  switch (task.status) {
    case 'pending':
      steps.push('Installation is queued and will start shortly');
      break;

    case 'validating':
      steps.push('Please wait while we validate the plugin');
      steps.push('This includes compatibility and security checks');
      break;

    case 'installing':
      steps.push('Plugin is being installed and configured');
      steps.push('This may take a few minutes depending on the plugin size');
      break;

    case 'configuring':
      steps.push('Applying plugin configuration settings');
      steps.push('Almost complete!');
      break;

    case 'completed':
      steps.push('Plugin installation completed successfully');
      steps.push('The plugin should now be available in your Backstage instance');
      steps.push('You may need to refresh your browser to see the new plugin');
      break;

    case 'failed':
      steps.push('Installation failed - please check the error details');
      steps.push('You can retry the installation or contact support');
      break;
  }

  return steps;
}

/**
 * Get troubleshooting information for failed installations
 */
function getTroubleshootingInfo(task: InstallationTask): any {
  if (task.status !== 'failed' || !task.error) {
    return null;
  }

  const troubleshooting: any = {
    error: task.error,
    commonSolutions: [],
    supportInfo: {
      taskId: task.id,
      pluginId: task.pluginId,
      failureTime: task.endTime,
      logs: []
    }
  };

  // Add common solutions based on error type
  if (task.error.includes('compatibility')) {
    troubleshooting.commonSolutions.push(
      'Check if your Backstage version is compatible with this plugin',
      'Try using a different version of the plugin',
      'Update your Backstage instance to the latest version'
    );
  } else if (task.error.includes('dependency')) {
    troubleshooting.commonSolutions.push(
      'Check for conflicting dependencies',
      'Try installing required dependencies manually',
      'Clear npm/yarn cache and retry'
    );
  } else if (task.error.includes('configuration')) {
    troubleshooting.commonSolutions.push(
      'Review your plugin configuration for errors',
      'Check required configuration fields',
      'Verify integration settings and credentials'
    );
  } else if (task.error.includes('network') || task.error.includes('timeout')) {
    troubleshooting.commonSolutions.push(
      'Check your internet connection',
      'Verify npm registry access',
      'Try again in a few minutes'
    );
  } else {
    troubleshooting.commonSolutions.push(
      'Try the installation again',
      'Check the plugin documentation for specific requirements',
      'Verify that all prerequisites are met'
    );
  }

  // Add general troubleshooting steps
  troubleshooting.commonSolutions.push(
    'Contact support with the task ID if the issue persists'
  );

  return troubleshooting;
}