import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { GitHubService } from '@/services/integrations/github';
import { JiraService } from '@/services/integrations/jira';
import { SlackService } from '@/services/integrations/slack';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  conditions: WorkflowCondition[];
  variables: Map<string, any>;
  metadata: {
    author: string;
    version: string;
    tags: string[];
    usage: number;
    rating: number;
  };
}

interface WorkflowTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual' | 'condition';
  config: {
    event?: string;
    schedule?: string;
    condition?: string;
    filters?: Record<string, any>;
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'parallel' | 'loop' | 'approval';
  action?: {
    service: string;
    method: string;
    parameters: Record<string, any>;
    retryPolicy?: {
      maxAttempts: number;
      backoff: 'linear' | 'exponential';
      delay: number;
    };
  };
  condition?: {
    expression: string;
    trueBranch: WorkflowStep[];
    falseBranch?: WorkflowStep[];
  };
  parallel?: {
    branches: WorkflowStep[][];
    waitAll: boolean;
  };
  loop?: {
    items: string;
    variable: string;
    steps: WorkflowStep[];
  };
  approval?: {
    approvers: string[];
    timeout: number;
    escalation?: string[];
  };
  errorHandler?: {
    action: 'retry' | 'skip' | 'fail' | 'compensate';
    compensationSteps?: WorkflowStep[];
  };
}

interface WorkflowCondition {
  id: string;
  expression: string;
  description: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  context: Map<string, any>;
  logs: WorkflowLog[];
  metrics: {
    duration?: number;
    stepsExecuted: number;
    stepsSucceeded: number;
    stepsFailed: number;
    retries: number;
  };
}

interface WorkflowLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug';
  stepId?: string;
  message: string;
  details?: any;
}

export class WorkflowAutomator extends EventEmitter {
  private templates: Map<string, WorkflowTemplate> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private services: Map<string, any> = new Map();
  private scheduledJobs: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeServices();
    this.loadTemplates();
  }

  private initializeServices() {
    this.services.set('github', new GitHubService());
    this.services.set('jira', new JiraService());
    this.services.set('slack', new SlackService());
  }

  private async loadTemplates() {
    const templates = [
      this.createPRAutomationTemplate(),
      this.createReleaseAutomationTemplate(),
      this.createIncidentResponseTemplate(),
      this.createOnboardingTemplate(),
      this.createCodeReviewTemplate(),
      this.createDeploymentTemplate()
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private createPRAutomationTemplate(): WorkflowTemplate {
    return {
      id: 'pr-automation',
      name: 'Pull Request Automation',
      description: 'Automate PR creation, review assignment, and merge',
      category: 'development',
      triggers: [
        {
          type: 'webhook',
          config: {
            event: 'push',
            filters: {
              branch: '^feature/.*'
            }
          }
        }
      ],
      steps: [
        {
          id: 'check-changes',
          name: 'Check for Changes',
          type: 'action',
          action: {
            service: 'github',
            method: 'getChangedFiles',
            parameters: {
              ref: '${trigger.ref}'
            }
          }
        },
        {
          id: 'run-tests',
          name: 'Run Tests',
          type: 'action',
          action: {
            service: 'ci',
            method: 'runTests',
            parameters: {
              branch: '${trigger.branch}'
            },
            retryPolicy: {
              maxAttempts: 3,
              backoff: 'exponential',
              delay: 1000
            }
          }
        },
        {
          id: 'create-pr',
          name: 'Create Pull Request',
          type: 'condition',
          condition: {
            expression: 'steps.run-tests.result.success === true',
            trueBranch: [
              {
                id: 'create-pr-action',
                name: 'Create PR',
                type: 'action',
                action: {
                  service: 'github',
                  method: 'createPullRequest',
                  parameters: {
                    title: 'Auto PR: ${trigger.commit.message}',
                    body: 'Automated PR created by workflow',
                    head: '${trigger.branch}',
                    base: 'main'
                  }
                }
              },
              {
                id: 'assign-reviewers',
                name: 'Assign Reviewers',
                type: 'action',
                action: {
                  service: 'github',
                  method: 'assignReviewers',
                  parameters: {
                    pr: '${steps.create-pr-action.result.number}',
                    reviewers: '${config.reviewers}'
                  }
                }
              }
            ],
            falseBranch: [
              {
                id: 'notify-failure',
                name: 'Notify Test Failure',
                type: 'action',
                action: {
                  service: 'slack',
                  method: 'sendMessage',
                  parameters: {
                    channel: '#dev-alerts',
                    message: 'Tests failed for ${trigger.branch}'
                  }
                }
              }
            ]
          }
        }
      ],
      conditions: [],
      variables: new Map([
        ['reviewers', ['team-lead', 'senior-dev']],
        ['testTimeout', 300000]
      ]),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['pr', 'automation', 'ci'],
        usage: 0,
        rating: 0
      }
    };
  }

  private createReleaseAutomationTemplate(): WorkflowTemplate {
    return {
      id: 'release-automation',
      name: 'Release Automation',
      description: 'Automate release process including versioning, tagging, and deployment',
      category: 'deployment',
      triggers: [
        {
          type: 'manual',
          config: {}
        }
      ],
      steps: [
        {
          id: 'bump-version',
          name: 'Bump Version',
          type: 'action',
          action: {
            service: 'versioning',
            method: 'bumpVersion',
            parameters: {
              type: '${input.versionType}'
            }
          }
        },
        {
          id: 'run-release-tests',
          name: 'Run Release Tests',
          type: 'parallel',
          parallel: {
            branches: [
              [
                {
                  id: 'unit-tests',
                  name: 'Unit Tests',
                  type: 'action',
                  action: {
                    service: 'ci',
                    method: 'runUnitTests',
                    parameters: {}
                  }
                }
              ],
              [
                {
                  id: 'integration-tests',
                  name: 'Integration Tests',
                  type: 'action',
                  action: {
                    service: 'ci',
                    method: 'runIntegrationTests',
                    parameters: {}
                  }
                }
              ],
              [
                {
                  id: 'e2e-tests',
                  name: 'E2E Tests',
                  type: 'action',
                  action: {
                    service: 'ci',
                    method: 'runE2ETests',
                    parameters: {}
                  }
                }
              ]
            ],
            waitAll: true
          }
        },
        {
          id: 'create-release',
          name: 'Create Release',
          type: 'action',
          action: {
            service: 'github',
            method: 'createRelease',
            parameters: {
              tag: 'v${steps.bump-version.result.version}',
              name: 'Release ${steps.bump-version.result.version}',
              body: '${input.releaseNotes}'
            }
          }
        },
        {
          id: 'deploy-staging',
          name: 'Deploy to Staging',
          type: 'action',
          action: {
            service: 'deployment',
            method: 'deploy',
            parameters: {
              environment: 'staging',
              version: '${steps.bump-version.result.version}'
            }
          }
        },
        {
          id: 'approval',
          name: 'Production Approval',
          type: 'approval',
          approval: {
            approvers: ['release-manager', 'tech-lead'],
            timeout: 86400000,
            escalation: ['cto']
          }
        },
        {
          id: 'deploy-production',
          name: 'Deploy to Production',
          type: 'action',
          action: {
            service: 'deployment',
            method: 'deploy',
            parameters: {
              environment: 'production',
              version: '${steps.bump-version.result.version}'
            }
          }
        }
      ],
      conditions: [],
      variables: new Map(),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['release', 'deployment', 'production'],
        usage: 0,
        rating: 0
      }
    };
  }

  private createIncidentResponseTemplate(): WorkflowTemplate {
    return {
      id: 'incident-response',
      name: 'Incident Response',
      description: 'Automated incident response and escalation',
      category: 'operations',
      triggers: [
        {
          type: 'event',
          config: {
            event: 'alert.triggered',
            filters: {
              severity: ['critical', 'high']
            }
          }
        }
      ],
      steps: [
        {
          id: 'create-incident',
          name: 'Create Incident',
          type: 'action',
          action: {
            service: 'incident',
            method: 'createIncident',
            parameters: {
              title: '${trigger.alert.title}',
              severity: '${trigger.alert.severity}',
              description: '${trigger.alert.description}'
            }
          }
        },
        {
          id: 'notify-oncall',
          name: 'Notify On-Call',
          type: 'parallel',
          parallel: {
            branches: [
              [
                {
                  id: 'page-oncall',
                  name: 'Page On-Call Engineer',
                  type: 'action',
                  action: {
                    service: 'pagerduty',
                    method: 'triggerIncident',
                    parameters: {
                      service: 'primary-oncall',
                      details: '${steps.create-incident.result}'
                    }
                  }
                }
              ],
              [
                {
                  id: 'slack-alert',
                  name: 'Send Slack Alert',
                  type: 'action',
                  action: {
                    service: 'slack',
                    method: 'sendAlert',
                    parameters: {
                      channel: '#incidents',
                      message: 'Critical incident: ${trigger.alert.title}'
                    }
                  }
                }
              ]
            ],
            waitAll: false
          }
        },
        {
          id: 'gather-diagnostics',
          name: 'Gather Diagnostics',
          type: 'action',
          action: {
            service: 'monitoring',
            method: 'collectDiagnostics',
            parameters: {
              services: '${trigger.alert.services}',
              timeRange: '30m'
            }
          }
        },
        {
          id: 'auto-remediation',
          name: 'Attempt Auto-Remediation',
          type: 'condition',
          condition: {
            expression: 'trigger.alert.autoRemediationEnabled === true',
            trueBranch: [
              {
                id: 'run-playbook',
                name: 'Run Remediation Playbook',
                type: 'action',
                action: {
                  service: 'automation',
                  method: 'runPlaybook',
                  parameters: {
                    playbook: '${trigger.alert.remediationPlaybook}',
                    context: '${steps.gather-diagnostics.result}'
                  }
                }
              }
            ]
          }
        }
      ],
      conditions: [],
      variables: new Map(),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['incident', 'alerting', 'operations'],
        usage: 0,
        rating: 0
      }
    };
  }

  private createOnboardingTemplate(): WorkflowTemplate {
    return {
      id: 'developer-onboarding',
      name: 'Developer Onboarding',
      description: 'Automate new developer onboarding process',
      category: 'hr',
      triggers: [
        {
          type: 'manual',
          config: {}
        }
      ],
      steps: [
        {
          id: 'create-accounts',
          name: 'Create Accounts',
          type: 'parallel',
          parallel: {
            branches: [
              [
                {
                  id: 'github-account',
                  name: 'Create GitHub Account',
                  type: 'action',
                  action: {
                    service: 'github',
                    method: 'inviteUser',
                    parameters: {
                      email: '${input.email}',
                      teams: '${input.teams}'
                    }
                  }
                }
              ],
              [
                {
                  id: 'jira-account',
                  name: 'Create Jira Account',
                  type: 'action',
                  action: {
                    service: 'jira',
                    method: 'createUser',
                    parameters: {
                      email: '${input.email}',
                      name: '${input.name}'
                    }
                  }
                }
              ],
              [
                {
                  id: 'slack-invite',
                  name: 'Send Slack Invite',
                  type: 'action',
                  action: {
                    service: 'slack',
                    method: 'inviteUser',
                    parameters: {
                      email: '${input.email}',
                      channels: ['#general', '#engineering', '#team-${input.team}']
                    }
                  }
                }
              ]
            ],
            waitAll: true
          }
        },
        {
          id: 'setup-environment',
          name: 'Setup Development Environment',
          type: 'action',
          action: {
            service: 'infrastructure',
            method: 'provisionDevEnvironment',
            parameters: {
              userId: '${input.userId}',
              stack: '${input.techStack}'
            }
          }
        },
        {
          id: 'assign-buddy',
          name: 'Assign Onboarding Buddy',
          type: 'action',
          action: {
            service: 'hr',
            method: 'assignBuddy',
            parameters: {
              newDeveloper: '${input.userId}',
              team: '${input.team}'
            }
          }
        },
        {
          id: 'schedule-meetings',
          name: 'Schedule Onboarding Meetings',
          type: 'loop',
          loop: {
            items: '${config.onboardingMeetings}',
            variable: 'meeting',
            steps: [
              {
                id: 'schedule-meeting',
                name: 'Schedule Meeting',
                type: 'action',
                action: {
                  service: 'calendar',
                  method: 'scheduleMeeting',
                  parameters: {
                    title: '${meeting.title}',
                    attendees: '${meeting.attendees}',
                    duration: '${meeting.duration}',
                    dayOffset: '${meeting.dayOffset}'
                  }
                }
              }
            ]
          }
        }
      ],
      conditions: [],
      variables: new Map([
        ['onboardingMeetings', [
          { title: 'Welcome & Intro', attendees: ['manager', 'buddy'], duration: 60, dayOffset: 0 },
          { title: 'Tech Stack Overview', attendees: ['tech-lead', 'buddy'], duration: 90, dayOffset: 1 },
          { title: 'Code Review Process', attendees: ['senior-dev'], duration: 60, dayOffset: 2 }
        ]]
      ]),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['onboarding', 'hr', 'automation'],
        usage: 0,
        rating: 0
      }
    };
  }

  private createCodeReviewTemplate(): WorkflowTemplate {
    return {
      id: 'smart-code-review',
      name: 'Smart Code Review',
      description: 'AI-assisted code review with automatic checks',
      category: 'quality',
      triggers: [
        {
          type: 'webhook',
          config: {
            event: 'pull_request.opened',
            filters: {}
          }
        }
      ],
      steps: [
        {
          id: 'analyze-changes',
          name: 'Analyze Code Changes',
          type: 'action',
          action: {
            service: 'codeAnalysis',
            method: 'analyzeChanges',
            parameters: {
              pr: '${trigger.pull_request.number}',
              repo: '${trigger.repository.name}'
            }
          }
        },
        {
          id: 'run-checks',
          name: 'Run Quality Checks',
          type: 'parallel',
          parallel: {
            branches: [
              [
                {
                  id: 'lint-check',
                  name: 'Lint Check',
                  type: 'action',
                  action: {
                    service: 'quality',
                    method: 'runLinter',
                    parameters: {
                      files: '${steps.analyze-changes.result.files}'
                    }
                  }
                }
              ],
              [
                {
                  id: 'security-scan',
                  name: 'Security Scan',
                  type: 'action',
                  action: {
                    service: 'security',
                    method: 'scanCode',
                    parameters: {
                      files: '${steps.analyze-changes.result.files}'
                    }
                  }
                }
              ],
              [
                {
                  id: 'complexity-check',
                  name: 'Complexity Analysis',
                  type: 'action',
                  action: {
                    service: 'quality',
                    method: 'analyzeComplexity',
                    parameters: {
                      files: '${steps.analyze-changes.result.files}'
                    }
                  }
                }
              ]
            ],
            waitAll: true
          }
        },
        {
          id: 'ai-review',
          name: 'AI Code Review',
          type: 'action',
          action: {
            service: 'ai',
            method: 'reviewCode',
            parameters: {
              changes: '${steps.analyze-changes.result}',
              context: {
                lint: '${steps.lint-check.result}',
                security: '${steps.security-scan.result}',
                complexity: '${steps.complexity-check.result}'
              }
            }
          }
        },
        {
          id: 'post-comments',
          name: 'Post Review Comments',
          type: 'action',
          action: {
            service: 'github',
            method: 'createReviewComments',
            parameters: {
              pr: '${trigger.pull_request.number}',
              comments: '${steps.ai-review.result.comments}'
            }
          }
        },
        {
          id: 'assign-reviewers',
          name: 'Smart Reviewer Assignment',
          type: 'action',
          action: {
            service: 'github',
            method: 'assignReviewers',
            parameters: {
              pr: '${trigger.pull_request.number}',
              reviewers: '${steps.ai-review.result.suggestedReviewers}'
            }
          }
        }
      ],
      conditions: [],
      variables: new Map(),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['code-review', 'quality', 'ai'],
        usage: 0,
        rating: 0
      }
    };
  }

  private createDeploymentTemplate(): WorkflowTemplate {
    return {
      id: 'progressive-deployment',
      name: 'Progressive Deployment',
      description: 'Canary deployment with automatic rollback',
      category: 'deployment',
      triggers: [
        {
          type: 'manual',
          config: {}
        }
      ],
      steps: [
        {
          id: 'validate-deployment',
          name: 'Validate Deployment',
          type: 'action',
          action: {
            service: 'deployment',
            method: 'validateDeployment',
            parameters: {
              version: '${input.version}',
              environment: '${input.environment}'
            }
          }
        },
        {
          id: 'deploy-canary',
          name: 'Deploy Canary',
          type: 'action',
          action: {
            service: 'deployment',
            method: 'deployCanary',
            parameters: {
              version: '${input.version}',
              percentage: 10
            }
          }
        },
        {
          id: 'monitor-canary',
          name: 'Monitor Canary',
          type: 'action',
          action: {
            service: 'monitoring',
            method: 'monitorDeployment',
            parameters: {
              deploymentId: '${steps.deploy-canary.result.id}',
              duration: 300000,
              metrics: ['error_rate', 'latency', 'success_rate']
            }
          }
        },
        {
          id: 'canary-decision',
          name: 'Canary Decision',
          type: 'condition',
          condition: {
            expression: 'steps.monitor-canary.result.healthy === true',
            trueBranch: [
              {
                id: 'progressive-rollout',
                name: 'Progressive Rollout',
                type: 'loop',
                loop: {
                  items: '[25, 50, 75, 100]',
                  variable: 'percentage',
                  steps: [
                    {
                      id: 'increase-traffic',
                      name: 'Increase Traffic',
                      type: 'action',
                      action: {
                        service: 'deployment',
                        method: 'updateTrafficSplit',
                        parameters: {
                          deploymentId: '${steps.deploy-canary.result.id}',
                          percentage: '${percentage}'
                        }
                      }
                    },
                    {
                      id: 'monitor-rollout',
                      name: 'Monitor Rollout',
                      type: 'action',
                      action: {
                        service: 'monitoring',
                        method: 'monitorDeployment',
                        parameters: {
                          deploymentId: '${steps.deploy-canary.result.id}',
                          duration: 180000
                        }
                      }
                    }
                  ]
                }
              }
            ],
            falseBranch: [
              {
                id: 'rollback',
                name: 'Rollback Deployment',
                type: 'action',
                action: {
                  service: 'deployment',
                  method: 'rollback',
                  parameters: {
                    deploymentId: '${steps.deploy-canary.result.id}'
                  }
                }
              },
              {
                id: 'notify-rollback',
                name: 'Notify Rollback',
                type: 'action',
                action: {
                  service: 'slack',
                  method: 'sendAlert',
                  parameters: {
                    channel: '#deployments',
                    message: 'Deployment rolled back due to canary failure'
                  }
                }
              }
            ]
          }
        }
      ],
      conditions: [],
      variables: new Map(),
      metadata: {
        author: 'system',
        version: '1.0.0',
        tags: ['deployment', 'canary', 'progressive'],
        usage: 0,
        rating: 0
      }
    };
  }

  async executeWorkflow(
    workflowId: string,
    input: Record<string, any> = {},
    context: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const template = this.templates.get(workflowId);
    if (!template) {
      throw new Error(`Workflow template ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      status: 'pending',
      startTime: new Date(),
      context: new Map(Object.entries({ ...context, input })),
      logs: [],
      metrics: {
        stepsExecuted: 0,
        stepsSucceeded: 0,
        stepsFailed: 0,
        retries: 0
      }
    };

    this.executions.set(execution.id, execution);
    this.emit('workflow-started', { executionId: execution.id, workflowId });

    try {
      execution.status = 'running';
      await this.executeSteps(template.steps, execution);
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.metrics.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('workflow-completed', {
        executionId: execution.id,
        workflowId,
        metrics: execution.metrics
      });
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.metrics.duration = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.logExecution(execution, 'error', 'Workflow execution failed', { error: error.message });
      
      this.emit('workflow-failed', {
        executionId: execution.id,
        workflowId,
        error: error.message
      });
    }

    await this.persistExecution(execution);
    return execution;
  }

  private async executeSteps(
    steps: WorkflowStep[],
    execution: WorkflowExecution
  ): Promise<void> {
    for (const step of steps) {
      execution.currentStep = step.id;
      execution.metrics.stepsExecuted++;

      this.logExecution(execution, 'info', `Executing step: ${step.name}`, { stepId: step.id });

      try {
        await this.executeStep(step, execution);
        execution.metrics.stepsSucceeded++;
      } catch (error: any) {
        execution.metrics.stepsFailed++;
        
        if (step.errorHandler) {
          await this.handleStepError(step, execution, error);
        } else {
          throw error;
        }
      }
    }
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    switch (step.type) {
      case 'action':
        return await this.executeAction(step.action!, execution);
      case 'condition':
        return await this.executeCondition(step.condition!, execution);
      case 'parallel':
        return await this.executeParallel(step.parallel!, execution);
      case 'loop':
        return await this.executeLoop(step.loop!, execution);
      case 'approval':
        return await this.executeApproval(step.approval!, execution);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeAction(
    action: any,
    execution: WorkflowExecution
  ): Promise<any> {
    const service = this.services.get(action.service);
    if (!service) {
      throw new Error(`Service ${action.service} not found`);
    }

    const parameters = this.resolveParameters(action.parameters, execution.context);
    
    let attempts = 0;
    const maxAttempts = action.retryPolicy?.maxAttempts || 1;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const result = await service[action.method](parameters);
        
        execution.context.set(`steps.${execution.currentStep}.result`, result);
        return result;
      } catch (error: any) {
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        execution.metrics.retries++;
        const delay = this.calculateRetryDelay(attempts, action.retryPolicy);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private calculateRetryDelay(attempt: number, retryPolicy: any): number {
    if (!retryPolicy) return 1000;
    
    const baseDelay = retryPolicy.delay || 1000;
    
    if (retryPolicy.backoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    }
    
    return baseDelay * attempt;
  }

  private async executeCondition(
    condition: any,
    execution: WorkflowExecution
  ): Promise<void> {
    const result = this.evaluateExpression(condition.expression, execution.context);
    
    if (result) {
      await this.executeSteps(condition.trueBranch, execution);
    } else if (condition.falseBranch) {
      await this.executeSteps(condition.falseBranch, execution);
    }
  }

  private async executeParallel(
    parallel: any,
    execution: WorkflowExecution
  ): Promise<void> {
    const promises = parallel.branches.map((branch: WorkflowStep[]) =>
      this.executeSteps(branch, execution)
    );

    if (parallel.waitAll) {
      await Promise.all(promises);
    } else {
      await Promise.race(promises);
    }
  }

  private async executeLoop(
    loop: any,
    execution: WorkflowExecution
  ): Promise<void> {
    const items = this.resolveParameter(loop.items, execution.context);
    
    for (const item of items) {
      execution.context.set(loop.variable, item);
      await this.executeSteps(loop.steps, execution);
    }
  }

  private async executeApproval(
    approval: any,
    execution: WorkflowExecution
  ): Promise<void> {
    const approvalRequest = {
      id: `approval-${Date.now()}`,
      executionId: execution.id,
      approvers: approval.approvers,
      timeout: approval.timeout,
      requestedAt: new Date()
    };

    this.emit('approval-required', approvalRequest);

    const approved = await this.waitForApproval(approvalRequest, approval.timeout);
    
    if (!approved && approval.escalation) {
      approvalRequest.approvers = approval.escalation;
      this.emit('approval-escalated', approvalRequest);
      
      const escalationApproved = await this.waitForApproval(
        approvalRequest,
        approval.timeout / 2
      );
      
      if (!escalationApproved) {
        throw new Error('Approval timeout');
      }
    } else if (!approved) {
      throw new Error('Approval denied or timeout');
    }
  }

  private async waitForApproval(
    request: any,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout);
      
      const handler = (approval: any) => {
        if (approval.requestId === request.id) {
          clearTimeout(timer);
          this.removeListener('approval-received', handler);
          resolve(approval.approved);
        }
      };
      
      this.on('approval-received', handler);
    });
  }

  private async handleStepError(
    step: WorkflowStep,
    execution: WorkflowExecution,
    error: Error
  ): Promise<void> {
    const handler = step.errorHandler!;
    
    this.logExecution(
      execution,
      'warning',
      `Step failed, executing error handler: ${handler.action}`,
      { stepId: step.id, error: error.message }
    );

    switch (handler.action) {
      case 'retry':
        await this.executeStep(step, execution);
        break;
      case 'skip':
        break;
      case 'compensate':
        if (handler.compensationSteps) {
          await this.executeSteps(handler.compensationSteps, execution);
        }
        break;
      case 'fail':
      default:
        throw error;
    }
  }

  private resolveParameters(
    parameters: Record<string, any>,
    context: Map<string, any>
  ): Record<string, any> {
    const resolved: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(parameters)) {
      resolved[key] = this.resolveParameter(value, context);
    }
    
    return resolved;
  }

  private resolveParameter(value: any, context: Map<string, any>): any {
    if (typeof value !== 'string') return value;
    
    const match = value.match(/^\$\{(.+)\}$/);
    if (!match) return value;
    
    const path = match[1];
    return this.getContextValue(path, context);
  }

  private getContextValue(path: string, context: Map<string, any>): any {
    const parts = path.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value instanceof Map) {
        value = value.get(part);
      } else if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateExpression(expression: string, context: Map<string, any>): boolean {
    const resolvedExpression = expression.replace(
      /\$\{([^}]+)\}/g,
      (_, path) => JSON.stringify(this.getContextValue(path, context))
    );
    
    try {
      return new Function('return ' + resolvedExpression)();
    } catch (error) {
      return false;
    }
  }

  private logExecution(
    execution: WorkflowExecution,
    level: 'info' | 'warning' | 'error' | 'debug',
    message: string,
    details?: any
  ): void {
    execution.logs.push({
      timestamp: new Date(),
      level,
      stepId: execution.currentStep,
      message,
      details
    });
  }

  private async persistExecution(execution: WorkflowExecution): Promise<void> {
    await prisma.workflowExecution.create({
      data: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        context: Object.fromEntries(execution.context),
        logs: execution.logs,
        metrics: execution.metrics
      }
    });
  }

  async createCustomWorkflow(workflow: WorkflowTemplate): Promise<void> {
    this.templates.set(workflow.id, workflow);
    
    await prisma.workflowTemplate.create({
      data: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        template: workflow,
        metadata: workflow.metadata
      }
    });

    this.emit('workflow-created', { workflowId: workflow.id });
  }

  async scheduleWorkflow(
    workflowId: string,
    schedule: string,
    input: Record<string, any> = {}
  ): Promise<void> {
    const template = this.templates.get(workflowId);
    if (!template) {
      throw new Error(`Workflow template ${workflowId} not found`);
    }

    const jobId = `schedule-${workflowId}-${Date.now()}`;
    
    this.scheduledJobs.set(jobId, { workflowId, schedule, input });
    
    this.emit('workflow-scheduled', { jobId, workflowId, schedule });
  }

  async getExecutionHistory(
    filters: {
      workflowId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<WorkflowExecution[]> {
    const where: any = {};
    
    if (filters.workflowId) where.workflowId = filters.workflowId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = filters.startDate;
      if (filters.endDate) where.startTime.lte = filters.endDate;
    }

    const executions = await prisma.workflowExecution.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 100
    });

    return executions.map(e => ({
      ...e,
      context: new Map(Object.entries(e.context as any)),
      logs: e.logs as WorkflowLog[]
    }));
  }
}