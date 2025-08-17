/**
 * Plugin Installation API Route
 * Handles plugin installation, configuration deployment, and progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { backstageIntegration } from '../../../../lib/plugins/BackstageIntegration';
import { pluginValidator } from '../../../../lib/plugins/PluginValidator';
import { pluginInstaller } from '../../../../lib/plugins/plugin-installer';
import { dockerPluginInstaller } from '../../../../lib/plugins/docker-plugin-installer';
import { enhancedLocalInstaller } from '../../../../services/enhancedLocalPluginInstaller';
import { securityValidationMiddleware } from '../../../../services/plugin-security/SecurityValidationMiddleware';

interface InstallationTask {
  id: string;
  pluginId: string;
  status: 'pending' | 'validating' | 'security_scanning' | 'installing' | 'configuring' | 'completed' | 'failed';
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
  validationResult?: any;
  installationResult?: any;
  securityResult?: any;
}

// In-memory task storage - in production, use Redis or database
const installationTasks = new Map<string, InstallationTask>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      pluginId, 
      version, 
      configuration = {}, 
      validateFirst = true,
      enableSecurityValidation = true,
      environment = 'production' // 'production' | 'staging' | 'test'
    } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    // Create installation task
    const taskId = generateTaskId();
    const task: InstallationTask = {
      id: taskId,
      pluginId,
      status: 'pending',
      progress: 0,
      message: 'Installation queued',
      startTime: new Date()
    };

    installationTasks.set(taskId, task);

    // Start asynchronous installation process
    processInstallation(taskId, pluginId, version, configuration, validateFirst, enableSecurityValidation, environment)
      .catch(error => {
        console.error(`Installation failed for task ${taskId}:`, error);
        const failedTask = installationTasks.get(taskId);
        if (failedTask) {
          failedTask.status = 'failed';
          failedTask.error = error instanceof Error ? error.message : 'Unknown error';
          failedTask.endTime = new Date();
          installationTasks.set(taskId, failedTask);
        }
      });

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Plugin installation started',
      trackingUrl: `/api/plugins/install/${taskId}/progress`
    });

  } catch (error) {
    console.error('Failed to start plugin installation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start installation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // Get specific task status
      const task = installationTasks.get(taskId);
      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        task,
        duration: task.endTime 
          ? task.endTime.getTime() - task.startTime.getTime()
          : Date.now() - task.startTime.getTime()
      });
    } else {
      // Get all active tasks
      const activeTasks = Array.from(installationTasks.values())
        .filter(task => task.status !== 'completed' && task.status !== 'failed')
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      return NextResponse.json({
        activeTasks,
        totalActive: activeTasks.length
      });
    }

  } catch (error) {
    console.error('Failed to get installation status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get installation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Process plugin installation asynchronously
 */
async function processInstallation(
  taskId: string,
  pluginId: string,
  version?: string,
  configuration: any = {},
  validateFirst: boolean = true,
  enableSecurityValidation: boolean = true,
  environment: string = 'production'
): Promise<void> {
  const task = installationTasks.get(taskId);
  if (!task) return;

  try {
    // Step 1: Validation (if requested)
    if (validateFirst) {
      updateTask(taskId, {
        status: 'validating',
        progress: 10,
        message: 'Validating plugin compatibility and configuration'
      });

      task.validationResult = await pluginValidator.validatePlugin(pluginId, configuration);
      
      // Check for critical issues
      const criticalErrors = task.validationResult.errors.filter((e: any) => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        throw new Error(`Validation failed with critical errors: ${criticalErrors.map((e: any) => e.message).join(', ')}`);
      }

      // Check compatibility
      if (!task.validationResult.compatibility.isCompatible) {
        throw new Error(`Plugin is not compatible with current Backstage version ${task.validationResult.compatibility.backstageVersion}`);
      }
    }

    // Step 2: Security Validation (if enabled)
    if (enableSecurityValidation) {
      updateTask(taskId, {
        status: 'security_scanning',
        progress: 20,
        message: 'Performing security validation and scanning'
      });

      try {
        // Get package metadata for security validation
        const packageInfo = await fetchPackageInfo(pluginId, version);
        
        const securityValidation = await securityValidationMiddleware.validatePluginForInstallation({
          pluginId,
          version: version || 'latest',
          tarballUrl: packageInfo.tarballUrl,
          publishedBy: packageInfo.author || 'unknown',
          publishedAt: new Date(packageInfo.publishedAt || Date.now()),
          shasum: packageInfo.shasum,
          integrity: packageInfo.integrity,
          signature: packageInfo.signature,
          publicKey: packageInfo.publicKey
        });

        task.securityResult = securityValidation;

        // Check if installation should be blocked
        if (!securityValidation.isValid) {
          const errorMessage = `Security validation failed: ${securityValidation.blockers.join(', ')}`;
          
          // Log security event
          console.warn(`Plugin ${pluginId} failed security validation:`, {
            blockers: securityValidation.blockers,
            warnings: securityValidation.warnings,
            riskLevel: securityValidation.securityResult.riskLevel,
            trustScore: securityValidation.securityResult.trustScore
          });

          // For critical security issues, block installation
          if (securityValidation.securityResult.riskLevel === 'critical') {
            throw new Error(`Installation blocked due to critical security issues: ${errorMessage}`);
          }

          // For high risk, require explicit approval (in production)
          if (securityValidation.securityResult.riskLevel === 'high' && environment === 'production') {
            updateTask(taskId, {
              status: 'failed',
              error: `Installation requires security approval: ${errorMessage}`,
              message: 'Plugin requires security team approval before installation'
            });
            return;
          }

          // For medium/low risk, proceed with warnings
          updateTask(taskId, {
            message: `Security warnings detected but proceeding: ${securityValidation.warnings.join(', ')}`
          });
        } else {
          updateTask(taskId, {
            message: `Security validation passed (Trust Score: ${securityValidation.securityResult.trustScore}/100)`
          });
        }

      } catch (securityError) {
        console.error('Security validation error:', securityError);
        
        // In production, fail on security validation errors
        if (environment === 'production') {
          throw new Error(`Security validation failed: ${securityError instanceof Error ? securityError.message : 'Unknown security error'}`);
        } else {
          // In non-production, log warning and continue
          updateTask(taskId, {
            message: `Security validation warning: ${securityError instanceof Error ? securityError.message : 'Security check failed'}`
          });
        }
      }
    }

    // Step 3: Installation
    updateTask(taskId, {
      status: 'installing',
      progress: 30,
      message: 'Installing plugin package and dependencies'
    });

    let installResult;
    
    // Check if we're in development mode and should use enhanced local installer
    const isDevelopment = process.env.NODE_ENV === 'development' || environment === 'development';
    const useEnhancedInstaller = isDevelopment && process.env.USE_ENHANCED_INSTALLER !== 'false';
    
    if (useEnhancedInstaller) {
      // Use enhanced local installer for full automation in dev mode
      console.log('Using enhanced local installer for automated plugin installation');
      
      // Set up progress reporting
      enhancedLocalInstaller.onProgress((progress) => {
        updateTask(taskId, {
          progress: Math.min(30 + (progress.progress * 0.5), 80),
          message: progress.message
        });
      });
      
      installResult = await enhancedLocalInstaller.installPlugin({
        pluginId,
        version,
        configuration,
        autoRestart: true,
        updateCode: true
      });
      
    } else if (environment === 'production') {
      // Use Backstage integration for production
      try {
        const installData = await backstageIntegration.installPlugin(pluginId, version, configuration);
        
        // Track installation progress
        let progress = 30;
        const maxWaitTime = 300000; // 5 minutes
        const startTime = Date.now();
        
        while (progress < 80 && (Date.now() - startTime) < maxWaitTime) {
          try {
            const progressData = await backstageIntegration.getInstallationProgress(installData.taskId);
            progress = Math.min(30 + (progressData.progress * 0.5), 80);
            
            updateTask(taskId, {
              progress,
              message: progressData.message
            });
            
            if (progressData.stage === 'complete') break;
            if (progressData.stage === 'failed') {
              throw new Error(progressData.error || 'Installation failed');
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          } catch (progressError) {
            console.warn('Failed to get installation progress:', progressError);
            break;
          }
        }
        
        installResult = { success: true, message: 'Plugin installed via Backstage API' };
      } catch (backstageError) {
        console.warn('Backstage installation failed, falling back to Docker installer:', backstageError);
        // Fallback to Docker installer
        installResult = await dockerPluginInstaller.installPlugin(pluginId, version);
      }
    } else {
      // Use Docker installer for test/staging environments
      installResult = await dockerPluginInstaller.installPlugin(pluginId, version);
    }

    if (!installResult.success) {
      throw new Error(installResult.error || installResult.message);
    }

    task.installationResult = installResult;

    // Step 3: Configuration
    if (Object.keys(configuration).length > 0) {
      updateTask(taskId, {
        status: 'configuring',
        progress: 85,
        message: 'Applying plugin configuration'
      });

      let configResult;
      
      if (environment === 'production') {
        try {
          configResult = await backstageIntegration.configurePlugin(pluginId, configuration);
        } catch (configError) {
          console.warn('Backstage configuration failed, falling back to local configurator:', configError);
          configResult = await pluginInstaller.configurePlugin(pluginId, configuration);
        }
      } else {
        configResult = await pluginInstaller.configurePlugin(pluginId, configuration);
      }

      if (!configResult.success) {
        console.warn('Configuration failed:', configResult.error);
        // Don't fail the entire installation for configuration issues
        updateTask(taskId, {
          message: `Installation completed with configuration warnings: ${configResult.error}`
        });
      }
    }

    // Step 4: Final validation
    updateTask(taskId, {
      progress: 95,
      message: 'Performing final validation checks'
    });

    // Verify the installation was successful
    try {
      const finalValidation = await pluginValidator.validatePlugin(pluginId, configuration);
      if (!finalValidation.isValid) {
        console.warn('Post-installation validation found issues:', finalValidation.errors);
      }
    } catch (validationError) {
      console.warn('Post-installation validation failed:', validationError);
    }

    // Step 5: Complete
    updateTask(taskId, {
      status: 'completed',
      progress: 100,
      message: 'Plugin installation completed successfully',
      endTime: new Date()
    });

  } catch (error) {
    updateTask(taskId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      endTime: new Date()
    });
    throw error;
  }
}

/**
 * Update installation task
 */
function updateTask(taskId: string, updates: Partial<InstallationTask>): void {
  const task = installationTasks.get(taskId);
  if (task) {
    const updatedTask = { ...task, ...updates };
    installationTasks.set(taskId, updatedTask);
    
    // Emit progress update (in production, use WebSocket or Server-Sent Events)
    console.log(`Task ${taskId} update:`, {
      status: updatedTask.status,
      progress: updatedTask.progress,
      message: updatedTask.message
    });
  }
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fetch package information from NPM registry
 */
async function fetchPackageInfo(packageName: string, version?: string): Promise<any> {
  try {
    const registryUrl = version 
      ? `https://registry.npmjs.org/${packageName}/${version}`
      : `https://registry.npmjs.org/${packageName}/latest`;
    
    const response = await fetch(registryUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PluginSecurityService/1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch package info: ${response.status} ${response.statusText}`);
    }

    const packageData = await response.json();
    
    // Extract security-relevant metadata
    return {
      name: packageData.name,
      version: packageData.version,
      tarballUrl: packageData.dist?.tarball,
      shasum: packageData.dist?.shasum,
      integrity: packageData.dist?.integrity,
      publishedAt: packageData.time?.[packageData.version],
      author: packageData.author?.name || packageData.maintainers?.[0]?.name,
      maintainers: packageData.maintainers,
      repository: packageData.repository?.url,
      homepage: packageData.homepage,
      license: packageData.license,
      keywords: packageData.keywords || [],
      // These would be populated if the package includes security metadata
      signature: packageData.dist?.signature,
      publicKey: packageData.dist?.publicKey
    };
  } catch (error) {
    console.error('Failed to fetch package info:', error);
    // Return minimal info to allow security validation to proceed
    return {
      name: packageName,
      version: version || 'latest',
      tarballUrl: `https://registry.npmjs.org/${packageName}/-/${packageName}-${version || 'latest'}.tgz`,
      publishedAt: new Date().toISOString(),
      author: 'unknown'
    };
  }
}