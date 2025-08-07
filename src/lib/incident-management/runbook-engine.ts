import { Runbook, RunbookStep, Incident, User } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

interface RunbookExecutionResult {
  success: boolean;
  executionTime: number; // in milliseconds
  steps: StepResult[];
  error?: string;
  output?: string;
}

interface StepResult {
  stepId: string;
  name: string;
  success: boolean;
  executionTime: number;
  output?: string;
  error?: string;
  timestamp: Date;
  automated: boolean;
}

interface RunbookContext {
  incident: Incident;
  environment: Record<string, string>;
  variables: Record<string, any>;
  user?: User;
}

export class RunbookEngine {
  private readonly builtInRunbooks: Map<string, Runbook> = new Map();
  private executionHistory: Map<string, RunbookExecutionResult[]> = new Map();

  constructor() {
    this.initializeBuiltInRunbooks();
  }

  async execute(runbook: Runbook, incident: Incident, user?: User): Promise<RunbookExecutionResult> {
    const startTime = Date.now();
    const context: RunbookContext = {
      incident,
      environment: this.buildEnvironmentVariables(incident),
      variables: {},
      user
    };

    console.log(`Starting execution of runbook: ${runbook.name} for incident: ${incident.id}`);

    try {
      const steps: StepResult[] = [];
      let currentStepId = runbook.steps[0]?.id;

      while (currentStepId) {
        const step = runbook.steps.find(s => s.id === currentStepId);
        if (!step) {
          throw new Error(`Step not found: ${currentStepId}`);
        }

        const stepResult = await this.executeStep(step, context);
        steps.push(stepResult);

        // Determine next step based on result
        if (stepResult.success) {
          currentStepId = step.onSuccess || this.getNextStepId(runbook, currentStepId);
        } else {
          currentStepId = step.onFailure || undefined;
          
          // If no failure path defined, stop execution
          if (!currentStepId) {
            break;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const allStepsSucceeded = steps.every(s => s.success);

      const result: RunbookExecutionResult = {
        success: allStepsSucceeded,
        executionTime,
        steps,
        output: steps.map(s => s.output).filter(Boolean).join('\n')
      };

      // Update runbook statistics
      this.updateRunbookStats(runbook, result);

      // Store execution history
      this.storeExecutionHistory(runbook.id, result);

      console.log(`Runbook execution completed: ${runbook.name} (success: ${allStepsSucceeded}, time: ${executionTime}ms)`);
      
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: RunbookExecutionResult = {
        success: false,
        executionTime,
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      console.error(`Runbook execution failed: ${runbook.name}`, error);
      return result;
    }
  }

  private async executeStep(step: RunbookStep, context: RunbookContext): Promise<StepResult> {
    const startTime = Date.now();
    
    console.log(`Executing step: ${step.name} (${step.type})`);

    try {
      let output: string | undefined;
      let success = true;

      switch (step.type) {
        case 'script':
          output = await this.executeScript(step, context);
          break;
        
        case 'api_call':
          output = await this.executeApiCall(step, context);
          break;
        
        case 'notification':
          output = await this.executeNotification(step, context);
          break;
        
        case 'manual':
          output = await this.executeManualStep(step, context);
          success = step.automated ? false : true; // Manual steps require human intervention
          break;
        
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        stepId: step.id,
        name: step.name,
        success,
        executionTime: Date.now() - startTime,
        output,
        timestamp: new Date(),
        automated: step.automated
      };

    } catch (error) {
      return {
        stepId: step.id,
        name: step.name,
        success: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        automated: step.automated
      };
    }
  }

  private async executeScript(step: RunbookStep, context: RunbookContext): Promise<string> {
    if (!step.command) {
      throw new Error('No command specified for script step');
    }

    // Replace variables in command
    const command = this.replaceVariables(step.command, context);
    
    console.log(`Executing command: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: step.timeout * 1000,
        env: { ...process.env, ...context.environment }
      });

      // Check expected output if specified
      if (step.expectedOutput && !stdout.includes(step.expectedOutput)) {
        throw new Error(`Expected output not found. Expected: ${step.expectedOutput}, Got: ${stdout}`);
      }

      return stdout || stderr;

    } catch (error: any) {
      // Retry logic
      if (step.retries > 0) {
        console.log(`Command failed, retrying (${step.retries} attempts left)`);
        step.retries--;
        await this.delay(1000); // Wait 1 second before retry
        return this.executeScript(step, context);
      }
      
      throw error;
    }
  }

  private async executeApiCall(step: RunbookStep, context: RunbookContext): Promise<string> {
    if (!step.command) {
      throw new Error('No API configuration specified for API call step');
    }

    let apiConfig: any;
    try {
      apiConfig = JSON.parse(this.replaceVariables(step.command, context));
    } catch (error) {
      throw new Error('Invalid API configuration JSON');
    }

    const { method = 'GET', url, headers = {}, data } = apiConfig;

    console.log(`Making API call: ${method} ${url}`);

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: step.timeout * 1000
      });

      const result = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      };

      // Store response data in context variables
      context.variables[`${step.id}_response`] = result;

      return JSON.stringify(result, null, 2);

    } catch (error: any) {
      if (step.retries > 0) {
        console.log(`API call failed, retrying (${step.retries} attempts left)`);
        step.retries--;
        await this.delay(2000);
        return this.executeApiCall(step, context);
      }

      throw new Error(`API call failed: ${error.message}`);
    }
  }

  private async executeNotification(step: RunbookStep, context: RunbookContext): Promise<string> {
    if (!step.command) {
      throw new Error('No notification configuration specified');
    }

    let notificationConfig: any;
    try {
      notificationConfig = JSON.parse(this.replaceVariables(step.command, context));
    } catch (error) {
      throw new Error('Invalid notification configuration JSON');
    }

    const { type, recipients, subject, message } = notificationConfig;

    console.log(`Sending notification: ${type} to ${recipients}`);

    // This would integrate with actual notification services
    switch (type) {
      case 'slack':
        return this.sendSlackNotification(recipients, subject, message, context);
      
      case 'email':
        return this.sendEmailNotification(recipients, subject, message, context);
      
      case 'webhook':
        return this.sendWebhookNotification(recipients, { subject, message }, context);
      
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  private async executeManualStep(step: RunbookStep, context: RunbookContext): Promise<string> {
    // For automated execution, manual steps are skipped or marked as pending
    if (step.automated) {
      throw new Error('Manual step cannot be automated');
    }

    console.log(`Manual step requires human intervention: ${step.description}`);
    
    // In a real system, this would create a task or notification for operators
    return `Manual step queued: ${step.description}`;
  }

  private replaceVariables(text: string, context: RunbookContext): string {
    let result = text;

    // Replace incident variables
    result = result.replace(/\$\{incident\.id\}/g, context.incident.id);
    result = result.replace(/\$\{incident\.title\}/g, context.incident.title);
    result = result.replace(/\$\{incident\.severity\}/g, context.incident.severity);
    result = result.replace(/\$\{incident\.status\}/g, context.incident.status);

    // Replace environment variables
    Object.entries(context.environment).forEach(([key, value]) => {
      const regex = new RegExp(`\\$\\{env\\.${key}\\}`, 'g');
      result = result.replace(regex, value);
    });

    // Replace context variables
    Object.entries(context.variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\$\\{var\\.${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    });

    // Replace affected services
    if (context.incident.affectedServices.length > 0) {
      result = result.replace(/\$\{incident\.services\}/g, context.incident.affectedServices.join(','));
      result = result.replace(/\$\{incident\.service\}/g, context.incident.affectedServices[0]);
    }

    return result;
  }

  private buildEnvironmentVariables(incident: Incident): Record<string, string> {
    return {
      INCIDENT_ID: incident.id,
      INCIDENT_SEVERITY: incident.severity,
      INCIDENT_STATUS: incident.status,
      INCIDENT_PRIORITY: incident.priority,
      AFFECTED_SERVICES: incident.affectedServices.join(','),
      INCIDENT_COMMANDER: incident.incidentCommander.email,
      CREATED_AT: incident.createdAt.toISOString()
    };
  }

  private getNextStepId(runbook: Runbook, currentStepId: string): string | undefined {
    const currentIndex = runbook.steps.findIndex(s => s.id === currentStepId);
    const nextStep = runbook.steps[currentIndex + 1];
    return nextStep?.id;
  }

  private updateRunbookStats(runbook: Runbook, result: RunbookExecutionResult): void {
    // Update success rate
    const history = this.executionHistory.get(runbook.id) || [];
    const totalExecutions = history.length + 1;
    const successfulExecutions = history.filter(h => h.success).length + (result.success ? 1 : 0);
    
    runbook.successRate = (successfulExecutions / totalExecutions) * 100;
    
    // Update average execution time
    const totalTime = history.reduce((sum, h) => sum + h.executionTime, 0) + result.executionTime;
    runbook.averageExecutionTime = totalTime / totalExecutions;
    
    runbook.lastExecuted = new Date();
  }

  private storeExecutionHistory(runbookId: string, result: RunbookExecutionResult): void {
    const history = this.executionHistory.get(runbookId) || [];
    history.push(result);
    
    // Keep only last 100 executions
    if (history.length > 100) {
      history.shift();
    }
    
    this.executionHistory.set(runbookId, history);
  }

  private async sendSlackNotification(channels: string[], subject: string, message: string, context: RunbookContext): Promise<string> {
    // Mock Slack notification
    console.log(`Slack notification sent to ${channels.join(', ')}: ${subject}`);
    return `Slack notification sent to ${channels.length} channels`;
  }

  private async sendEmailNotification(recipients: string[], subject: string, message: string, context: RunbookContext): Promise<string> {
    // Mock email notification
    console.log(`Email sent to ${recipients.join(', ')}: ${subject}`);
    return `Email sent to ${recipients.length} recipients`;
  }

  private async sendWebhookNotification(url: string, payload: any, context: RunbookContext): Promise<string> {
    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      return `Webhook notification sent: ${response.status}`;
    } catch (error: any) {
      throw new Error(`Webhook notification failed: ${error.message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeBuiltInRunbooks(): void {
    // Database Connection Issue Runbook
    this.builtInRunbooks.set('db_connection_issue', {
      id: 'db_connection_issue',
      name: 'Database Connection Issue Response',
      description: 'Automated response to database connectivity issues',
      steps: [
        {
          id: 'check_db_status',
          name: 'Check Database Status',
          description: 'Verify database server status',
          type: 'script',
          command: 'pg_isready -h ${env.DB_HOST} -p ${env.DB_PORT} -d ${env.DB_NAME}',
          expectedOutput: 'accepting connections',
          timeout: 30,
          retries: 2,
          onSuccess: 'check_connection_pool',
          onFailure: 'restart_db_service',
          automated: true
        },
        {
          id: 'check_connection_pool',
          name: 'Check Connection Pool Status',
          description: 'Verify connection pool health',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://${env.APP_HOST}/health/db", "headers": {"Authorization": "Bearer ${env.HEALTH_TOKEN}"}}',
          timeout: 10,
          retries: 1,
          onSuccess: 'notify_team',
          onFailure: 'restart_app_service',
          automated: true
        },
        {
          id: 'restart_db_service',
          name: 'Restart Database Service',
          description: 'Restart database service if not responding',
          type: 'script',
          command: 'systemctl restart postgresql',
          timeout: 60,
          retries: 1,
          onSuccess: 'verify_db_restart',
          onFailure: 'escalate_to_dba',
          automated: true
        },
        {
          id: 'restart_app_service',
          name: 'Restart Application Service',
          description: 'Restart application to reset connection pool',
          type: 'script',
          command: 'kubectl rollout restart deployment/${incident.service} -n production',
          timeout: 120,
          retries: 1,
          onSuccess: 'verify_app_restart',
          onFailure: 'notify_team',
          automated: true
        },
        {
          id: 'verify_db_restart',
          name: 'Verify Database Restart',
          description: 'Confirm database is accepting connections after restart',
          type: 'script',
          command: 'pg_isready -h ${env.DB_HOST} -p ${env.DB_PORT} -d ${env.DB_NAME}',
          expectedOutput: 'accepting connections',
          timeout: 30,
          retries: 3,
          onSuccess: 'notify_success',
          onFailure: 'escalate_to_dba',
          automated: true
        },
        {
          id: 'verify_app_restart',
          name: 'Verify Application Restart',
          description: 'Confirm application is healthy after restart',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://${env.APP_HOST}/health", "timeout": 30}',
          timeout: 30,
          retries: 3,
          onSuccess: 'notify_success',
          onFailure: 'notify_team',
          automated: true
        },
        {
          id: 'notify_success',
          name: 'Notify Success',
          description: 'Notify team that issue has been resolved',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "DB Issue Resolved", "message": "Database connection issue for incident ${incident.id} has been automatically resolved."}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'escalate_to_dba',
          name: 'Escalate to DBA Team',
          description: 'Escalate to database administrator team',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#dba-team"], "subject": "DB Issue Escalation", "message": "Database connection issue requires DBA intervention. Incident: ${incident.id}"}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'notify_team',
          name: 'Notify Incident Team',
          description: 'Notify incident response team',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "DB Issue Update", "message": "Database connection issue update for incident ${incident.id}. Manual intervention may be required."}',
          timeout: 10,
          retries: 1,
          automated: true
        }
      ],
      triggers: [
        {
          condition: 'database connection',
          severity: ['critical', 'high'],
          services: ['api', 'backend', 'database'],
          keywords: ['database', 'connection', 'pool', 'timeout']
        }
      ],
      automationLevel: 'semi-automated',
      successRate: 85,
      averageExecutionTime: 180000 // 3 minutes
    });

    // High CPU Usage Runbook
    this.builtInRunbooks.set('high_cpu_usage', {
      id: 'high_cpu_usage',
      name: 'High CPU Usage Response',
      description: 'Automated response to high CPU usage alerts',
      steps: [
        {
          id: 'identify_high_cpu_processes',
          name: 'Identify High CPU Processes',
          description: 'Find processes consuming most CPU',
          type: 'script',
          command: 'top -bn1 | head -20',
          timeout: 10,
          retries: 1,
          onSuccess: 'check_system_load',
          automated: true
        },
        {
          id: 'check_system_load',
          name: 'Check System Load Average',
          description: 'Get current system load average',
          type: 'script',
          command: 'uptime',
          timeout: 5,
          retries: 1,
          onSuccess: 'scale_if_possible',
          automated: true
        },
        {
          id: 'scale_if_possible',
          name: 'Auto-scale Service',
          description: 'Attempt to scale service horizontally',
          type: 'script',
          command: 'kubectl scale deployment/${incident.service} --replicas=5 -n production',
          timeout: 60,
          retries: 1,
          onSuccess: 'monitor_scaling',
          onFailure: 'notify_ops_team',
          automated: true
        },
        {
          id: 'monitor_scaling',
          name: 'Monitor Scaling Progress',
          description: 'Monitor the scaling operation',
          type: 'script',
          command: 'kubectl rollout status deployment/${incident.service} -n production --timeout=120s',
          timeout: 130,
          retries: 1,
          onSuccess: 'verify_cpu_reduction',
          onFailure: 'notify_ops_team',
          automated: true
        },
        {
          id: 'verify_cpu_reduction',
          name: 'Verify CPU Reduction',
          description: 'Check if CPU usage has decreased',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://prometheus:9090/api/v1/query?query=avg(cpu_usage_percent{service=\\"${incident.service}\\"})", "timeout": 10}',
          timeout: 15,
          retries: 2,
          onSuccess: 'notify_success',
          onFailure: 'notify_ops_team',
          automated: true
        },
        {
          id: 'notify_success',
          name: 'Notify Success',
          description: 'Notify that CPU issue has been mitigated',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "CPU Issue Mitigated", "message": "High CPU usage for ${incident.service} has been mitigated through auto-scaling."}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'notify_ops_team',
          name: 'Notify Operations Team',
          description: 'Notify operations team for manual intervention',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#ops-team"], "subject": "High CPU Alert", "message": "High CPU usage on ${incident.service} requires manual intervention. Incident: ${incident.id}"}',
          timeout: 10,
          retries: 1,
          automated: true
        }
      ],
      triggers: [
        {
          condition: 'cpu usage > 80%',
          severity: ['warning', 'critical'],
          services: ['api', 'backend', 'frontend'],
          keywords: ['cpu', 'high', 'usage', 'load']
        }
      ],
      automationLevel: 'fully-automated',
      successRate: 92,
      averageExecutionTime: 240000 // 4 minutes
    });

    // Service Down Runbook
    this.builtInRunbooks.set('service_down', {
      id: 'service_down',
      name: 'Service Down Recovery',
      description: 'Automated recovery for down services',
      steps: [
        {
          id: 'check_service_health',
          name: 'Check Service Health',
          description: 'Verify service health endpoint',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://${incident.service}/health", "timeout": 10}',
          timeout: 15,
          retries: 3,
          onSuccess: 'false_alarm',
          onFailure: 'check_pod_status',
          automated: true
        },
        {
          id: 'check_pod_status',
          name: 'Check Pod Status',
          description: 'Check Kubernetes pod status',
          type: 'script',
          command: 'kubectl get pods -l app=${incident.service} -n production',
          timeout: 10,
          retries: 1,
          onSuccess: 'restart_unhealthy_pods',
          automated: true
        },
        {
          id: 'restart_unhealthy_pods',
          name: 'Restart Unhealthy Pods',
          description: 'Restart pods that are not ready',
          type: 'script',
          command: 'kubectl delete pods -l app=${incident.service} -n production --field-selector=status.phase!=Running',
          timeout: 30,
          retries: 1,
          onSuccess: 'wait_for_startup',
          onFailure: 'rollback_deployment',
          automated: true
        },
        {
          id: 'wait_for_startup',
          name: 'Wait for Service Startup',
          description: 'Wait for pods to become ready',
          type: 'script',
          command: 'kubectl wait --for=condition=ready pod -l app=${incident.service} -n production --timeout=120s',
          timeout: 130,
          retries: 1,
          onSuccess: 'verify_service_recovery',
          onFailure: 'rollback_deployment',
          automated: true
        },
        {
          id: 'verify_service_recovery',
          name: 'Verify Service Recovery',
          description: 'Confirm service is responding',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://${incident.service}/health", "timeout": 10}',
          timeout: 15,
          retries: 3,
          onSuccess: 'notify_recovery',
          onFailure: 'rollback_deployment',
          automated: true
        },
        {
          id: 'rollback_deployment',
          name: 'Rollback Deployment',
          description: 'Rollback to previous working version',
          type: 'script',
          command: 'kubectl rollout undo deployment/${incident.service} -n production',
          timeout: 120,
          retries: 1,
          onSuccess: 'verify_rollback',
          onFailure: 'escalate_critical',
          automated: true
        },
        {
          id: 'verify_rollback',
          name: 'Verify Rollback',
          description: 'Confirm rollback was successful',
          type: 'api_call',
          command: '{"method": "GET", "url": "http://${incident.service}/health", "timeout": 10}',
          timeout: 15,
          retries: 5,
          onSuccess: 'notify_rollback',
          onFailure: 'escalate_critical',
          automated: true
        },
        {
          id: 'false_alarm',
          name: 'False Alarm Resolution',
          description: 'Handle false positive alerts',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "False Alarm", "message": "Service ${incident.service} is actually healthy. Alert may be a false positive."}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'notify_recovery',
          name: 'Notify Recovery',
          description: 'Notify that service has recovered',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "Service Recovered", "message": "Service ${incident.service} has been automatically recovered."}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'notify_rollback',
          name: 'Notify Rollback',
          description: 'Notify that rollback was performed',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#incidents"], "subject": "Service Rollback", "message": "Service ${incident.service} has been rolled back to previous version."}',
          timeout: 10,
          retries: 1,
          automated: true
        },
        {
          id: 'escalate_critical',
          name: 'Critical Escalation',
          description: 'Escalate to on-call team',
          type: 'notification',
          command: '{"type": "slack", "recipients": ["#oncall", "#incidents"], "subject": "CRITICAL: Service Down", "message": "CRITICAL: Service ${incident.service} is down and automated recovery failed. Immediate attention required!"}',
          timeout: 10,
          retries: 1,
          automated: true
        }
      ],
      triggers: [
        {
          condition: 'service health check failed',
          severity: ['critical'],
          services: ['api', 'backend', 'frontend'],
          keywords: ['down', 'unavailable', 'timeout', '5xx']
        }
      ],
      automationLevel: 'fully-automated',
      successRate: 78,
      averageExecutionTime: 300000 // 5 minutes
    });

    console.log('Initialized built-in runbooks');
  }

  public getBuiltInRunbooks(): Runbook[] {
    return Array.from(this.builtInRunbooks.values());
  }

  public getRunbookById(id: string): Runbook | undefined {
    return this.builtInRunbooks.get(id);
  }

  public getExecutionHistory(runbookId: string): RunbookExecutionResult[] {
    return this.executionHistory.get(runbookId) || [];
  }

  public addCustomRunbook(runbook: Runbook): void {
    this.builtInRunbooks.set(runbook.id, runbook);
    console.log(`Custom runbook added: ${runbook.name}`);
  }

  public removeRunbook(runbookId: string): void {
    this.builtInRunbooks.delete(runbookId);
    this.executionHistory.delete(runbookId);
    console.log(`Runbook removed: ${runbookId}`);
  }
}