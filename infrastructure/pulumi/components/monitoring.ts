import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';

export interface MonitoringStackArgs {
  provider: any;
  environment: string;
  vpc: any;
  privateSubnets: any[];
  enablePrometheus: boolean;
  enableGrafana: boolean;
  enableLoki: boolean;
  enableJaeger: boolean;
  enableAlertManager: boolean;
  retentionDays: number;
  alertingRules: Array<{
    name: string;
    expr: string;
    for: string;
    severity: string;
    annotations: {
      summary: string;
      description: string;
    };
  }>;
  dashboards: string[];
}

export class MonitoringStack extends pulumi.ComponentResource {
  public readonly dashboardUrl: pulumi.Output<string>;
  public readonly metricsEndpoint: pulumi.Output<string>;
  public readonly logsEndpoint: pulumi.Output<string>;
  public readonly tracingEndpoint: pulumi.Output<string>;
  public readonly alertManagerUrl: pulumi.Output<string>;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: MonitoringStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:monitoring:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'Monitoring',
      Project: 'SaaS-IDP'
    };

    if (args.provider.constructor.name.includes('Aws')) {
      // AWS CloudWatch Implementation
      
      // Create CloudWatch Dashboard
      const dashboardBody = {
        widgets: [
          // Application Metrics Widget
          {
            type: 'metric',
            properties: {
              metrics: [
                ['AWS/ECS', 'CPUUtilization', { stat: 'Average' }],
                ['.', 'MemoryUtilization', { stat: 'Average' }],
                ['AWS/ApplicationELB', 'TargetResponseTime', { stat: 'Average' }],
                ['.', 'RequestCount', { stat: 'Sum' }],
                ['.', 'HTTPCode_Target_2XX_Count', { stat: 'Sum' }],
                ['.', 'HTTPCode_Target_5XX_Count', { stat: 'Sum' }]
              ],
              period: 300,
              stat: 'Average',
              region: aws.getRegion().then(r => r.name),
              title: 'Application Performance'
            }
          },
          // Database Metrics Widget
          {
            type: 'metric',
            properties: {
              metrics: [
                ['AWS/RDS', 'DatabaseConnections', { stat: 'Average' }],
                ['.', 'CPUUtilization', { stat: 'Average' }],
                ['.', 'FreeableMemory', { stat: 'Average' }],
                ['.', 'ReadLatency', { stat: 'Average' }],
                ['.', 'WriteLatency', { stat: 'Average' }],
                ['.', 'DiskQueueDepth', { stat: 'Average' }]
              ],
              period: 300,
              stat: 'Average',
              region: aws.getRegion().then(r => r.name),
              title: 'Database Performance'
            }
          },
          // Error Rate Widget
          {
            type: 'metric',
            properties: {
              metrics: [
                ['AWS/ApplicationELB', 'HTTPCode_Target_4XX_Count', { stat: 'Sum', label: '4XX Errors' }],
                ['.', 'HTTPCode_Target_5XX_Count', { stat: 'Sum', label: '5XX Errors' }],
                ['.', 'TargetConnectionErrorCount', { stat: 'Sum', label: 'Connection Errors' }]
              ],
              period: 60,
              stat: 'Sum',
              region: aws.getRegion().then(r => r.name),
              title: 'Error Rates',
              yAxis: {
                left: {
                  min: 0
                }
              }
            }
          },
          // Logs Insights Widget
          {
            type: 'log',
            properties: {
              query: `SOURCE '/aws/ecs/${name}'
                | fields @timestamp, @message
                | filter @message like /ERROR/
                | sort @timestamp desc
                | limit 20`,
              region: aws.getRegion().then(r => r.name),
              title: 'Recent Errors'
            }
          }
        ]
      };

      const dashboard = new aws.cloudwatch.Dashboard(`${name}-dashboard`, {
        dashboardName: `${name}-monitoring`,
        dashboardBody: JSON.stringify(dashboardBody)
      }, { parent: this });

      // Create SNS Topic for Alerts
      const alertTopic = new aws.sns.Topic(`${name}-alerts`, {
        displayName: `${name} Monitoring Alerts`,
        tags: defaultTags
      }, { parent: this });

      // Subscribe email to alerts (production only)
      if (args.environment === 'production') {
        new aws.sns.TopicSubscription(`${name}-alert-email`, {
          topic: alertTopic.arn,
          protocol: 'email',
          endpoint: 'ops@saas-idp.com'
        }, { parent: this });
      }

      // Create CloudWatch Alarms based on alerting rules
      const alarms = args.alertingRules.map(rule => {
        return new aws.cloudwatch.MetricAlarm(`${name}-alarm-${rule.name}`, {
          name: `${name}-${rule.name}`,
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 2,
          metricName: this.getMetricNameFromExpression(rule.expr),
          namespace: this.getNamespaceFromExpression(rule.expr),
          period: this.parseDuration(rule.for),
          statistic: 'Average',
          threshold: this.getThresholdFromExpression(rule.expr),
          alarmDescription: rule.annotations.description,
          insufficientDataActions: [],
          alarmActions: [alertTopic.arn],
          okActions: [alertTopic.arn],
          treatMissingData: 'notBreaching',
          tags: {
            ...defaultTags,
            Severity: rule.severity
          }
        }, { parent: this });
      });

      // Create Log Groups for different components
      const logGroups = {
        application: new aws.cloudwatch.LogGroup(`${name}-app-logs`, {
          retentionInDays: args.retentionDays,
          tags: defaultTags
        }, { parent: this }),
        database: new aws.cloudwatch.LogGroup(`${name}-db-logs`, {
          retentionInDays: args.retentionDays,
          tags: defaultTags
        }, { parent: this }),
        security: new aws.cloudwatch.LogGroup(`${name}-security-logs`, {
          retentionInDays: args.retentionDays * 2, // Keep security logs longer
          tags: defaultTags
        }, { parent: this })
      };

      // Create Metric Filters for custom metrics
      new aws.cloudwatch.LogMetricFilter(`${name}-error-count`, {
        logGroupName: logGroups.application.name,
        pattern: '[time, request_id, level = ERROR, ...]',
        metricTransformation: {
          name: 'ErrorCount',
          namespace: `${name}/Application`,
          value: '1',
          defaultValue: 0
        }
      }, { parent: this });

      new aws.cloudwatch.LogMetricFilter(`${name}-latency`, {
        logGroupName: logGroups.application.name,
        pattern: '[time, request_id, level, msg, latency]',
        metricTransformation: {
          name: 'RequestLatency',
          namespace: `${name}/Application`,
          value: '$latency',
          defaultValue: 0
        }
      }, { parent: this });

      // X-Ray for distributed tracing
      if (args.enableJaeger) {
        const xrayGroup = new aws.xray.Group(`${name}-xray-group`, {
          groupName: name,
          filterExpression: `service("${name}")`,
          tags: defaultTags
        }, { parent: this });

        const xraySamplingRule = new aws.xray.SamplingRule(`${name}-xray-sampling`, {
          ruleName: `${name}-sampling`,
          priority: 1000,
          version: 1,
          reservoirSize: 1,
          fixedRate: 0.05, // 5% sampling rate
          urlPath: '*',
          host: '*',
          httpMethod: '*',
          serviceType: '*',
          serviceName: '*',
          resourceArn: '*',
          tags: defaultTags
        }, { parent: this });
      }

      // Container Insights for ECS
      new aws.ecs.ClusterCapacityProviders(`${name}-capacity-providers`, {
        clusterName: `${name}-cluster`,
        capacityProviders: ['FARGATE', 'FARGATE_SPOT'],
        defaultCapacityProviderStrategies: [
          {
            base: 1,
            weight: 1,
            capacityProvider: 'FARGATE'
          },
          {
            weight: 4,
            capacityProvider: 'FARGATE_SPOT'
          }
        ]
      }, { parent: this });

      // Enhanced Monitoring with CloudWatch Logs Insights
      const insightsQueries = [
        {
          name: 'top-errors',
          query: `fields @timestamp, @message
            | filter @message like /ERROR/
            | stats count() by bin(5m)`
        },
        {
          name: 'slow-requests',
          query: `fields @timestamp, duration
            | filter duration > 1000
            | sort duration desc
            | limit 100`
        },
        {
          name: 'user-activity',
          query: `fields @timestamp, user, action
            | stats count() by user, action
            | sort count desc`
        }
      ];

      insightsQueries.forEach(q => {
        new aws.cloudwatch.QueryDefinition(`${name}-query-${q.name}`, {
          name: `${name}-${q.name}`,
          logGroupNames: [logGroups.application.name],
          queryString: q.query
        }, { parent: this });
      });

      // Synthetic monitoring for availability
      if (args.environment === 'production') {
        const canaryRole = new aws.iam.Role(`${name}-canary-role`, {
          assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            }]
          }),
          tags: defaultTags
        }, { parent: this });

        new aws.iam.RolePolicyAttachment(`${name}-canary-policy`, {
          role: canaryRole.name,
          policyArn: 'arn:aws:iam::aws:policy/CloudWatchSyntheticsFullAccess'
        }, { parent: this });

        const canaryBucket = new aws.s3.BucketV2(`${name}-canary-artifacts`, {
          bucketPrefix: `${name}-canary-`,
          tags: defaultTags
        }, { parent: this });

        new aws.synthetics.Canary(`${name}-availability-canary`, {
          name: `${name}-availability`,
          artifactS3Location: pulumi.interpolate`s3://${canaryBucket.id}/`,
          executionRoleArn: canaryRole.arn,
          handler: 'apiCanary.handler',
          zipFile: this.getCanaryCode(),
          runtimeVersion: 'syn-nodejs-puppeteer-3.9',
          schedule: {
            expression: 'rate(5 minutes)'
          },
          runConfig: {
            timeoutInSeconds: 60,
            memoryInMb: 960,
            activeTracing: true
          },
          successRetentionPeriodInDays: 31,
          failureRetentionPeriodInDays: 31,
          tags: defaultTags
        }, { parent: this });
      }

      this.dashboardUrl = pulumi.interpolate`https://console.aws.amazon.com/cloudwatch/home?region=${aws.getRegion().then(r => r.name)}#dashboards:name=${dashboard.dashboardName}`;
      this.metricsEndpoint = pulumi.interpolate`https://monitoring.${aws.getRegion().then(r => r.name)}.amazonaws.com`;
      this.logsEndpoint = pulumi.interpolate`https://logs.${aws.getRegion().then(r => r.name)}.amazonaws.com`;
      this.tracingEndpoint = pulumi.interpolate`https://xray.${aws.getRegion().then(r => r.name)}.amazonaws.com`;
      this.alertManagerUrl = alertTopic.arn;
      
      this.resourceCount = pulumi.output(
        1 + // Dashboard
        1 + // SNS Topic
        (args.environment === 'production' ? 1 : 0) + // Email subscription
        args.alertingRules.length + // Alarms
        3 + // Log Groups
        2 + // Metric Filters
        (args.enableJaeger ? 2 : 0) + // X-Ray resources
        1 + // Capacity Providers
        insightsQueries.length + // Query Definitions
        (args.environment === 'production' ? 4 : 0) // Synthetic monitoring
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Cloud Monitoring Implementation
      const dashboard = new gcp.monitoring.Dashboard(`${name}-dashboard`, {
        displayName: `${name} Monitoring`,
        dashboardJson: JSON.stringify({
          displayName: `${name} Monitoring`,
          gridLayout: {
            widgets: [
              {
                title: 'CPU Utilization',
                xyChart: {
                  dataSets: [{
                    timeSeriesQuery: {
                      timeSeriesFilter: {
                        filter: 'metric.type="compute.googleapis.com/instance/cpu/utilization"'
                      }
                    }
                  }]
                }
              },
              {
                title: 'Memory Usage',
                xyChart: {
                  dataSets: [{
                    timeSeriesQuery: {
                      timeSeriesFilter: {
                        filter: 'metric.type="kubernetes.io/container/memory/used_bytes"'
                      }
                    }
                  }]
                }
              }
            ]
          }
        }),
        project: args.provider.project
      }, { parent: this });

      // Create alerting policies
      const notificationChannel = new gcp.monitoring.NotificationChannel(`${name}-notification`, {
        displayName: `${name} Alerts`,
        type: 'email',
        userLabels: {
          email_address: 'ops@saas-idp.com'
        },
        project: args.provider.project
      }, { parent: this });

      args.alertingRules.forEach(rule => {
        new gcp.monitoring.AlertPolicy(`${name}-alert-${rule.name}`, {
          displayName: rule.name,
          conditions: [{
            displayName: rule.annotations.summary,
            conditionThreshold: {
              filter: this.convertToGCPFilter(rule.expr),
              duration: rule.for,
              comparison: 'COMPARISON_GT',
              thresholdValue: this.getThresholdFromExpression(rule.expr)
            }
          }],
          notificationChannels: [notificationChannel.name],
          documentation: {
            content: rule.annotations.description
          },
          project: args.provider.project
        }, { parent: this });
      });

      this.dashboardUrl = pulumi.interpolate`https://console.cloud.google.com/monitoring/dashboards`;
      this.metricsEndpoint = pulumi.interpolate`https://monitoring.googleapis.com`;
      this.logsEndpoint = pulumi.interpolate`https://logging.googleapis.com`;
      this.tracingEndpoint = pulumi.interpolate`https://cloudtrace.googleapis.com`;
      this.alertManagerUrl = notificationChannel.name;
      this.resourceCount = pulumi.output(1 + 1 + args.alertingRules.length);

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure Monitor Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.provider.location,
        tags: defaultTags
      }, { parent: this });

      const workspace = new azure.operationalinsights.Workspace(`${name}-workspace`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        sku: {
          name: 'PerGB2018'
        },
        retentionInDays: args.retentionDays,
        tags: defaultTags
      }, { parent: this });

      const appInsights = new azure.insights.Component(`${name}-insights`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        applicationType: 'web',
        kind: 'web',
        workspaceResourceId: workspace.id,
        tags: defaultTags
      }, { parent: this });

      this.dashboardUrl = pulumi.interpolate`https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade`;
      this.metricsEndpoint = workspace.id;
      this.logsEndpoint = workspace.id;
      this.tracingEndpoint = appInsights.id;
      this.alertManagerUrl = pulumi.output('');
      this.resourceCount = pulumi.output(3);
    }

    this.registerOutputs({
      dashboardUrl: this.dashboardUrl,
      metricsEndpoint: this.metricsEndpoint,
      logsEndpoint: this.logsEndpoint,
      tracingEndpoint: this.tracingEndpoint,
      alertManagerUrl: this.alertManagerUrl,
      resourceCount: this.resourceCount
    });
  }

  private getMetricNameFromExpression(expr: string): string {
    // Simplified metric name extraction
    if (expr.includes('cpu')) return 'CPUUtilization';
    if (expr.includes('memory')) return 'MemoryUtilization';
    if (expr.includes('connection')) return 'DatabaseConnections';
    return 'CustomMetric';
  }

  private getNamespaceFromExpression(expr: string): string {
    // Simplified namespace extraction
    if (expr.includes('container')) return 'AWS/ECS';
    if (expr.includes('database') || expr.includes('pg_')) return 'AWS/RDS';
    return 'CustomNamespace';
  }

  private getThresholdFromExpression(expr: string): number {
    // Extract threshold value from expression
    const match = expr.match(/>\s*([\d.]+)/);
    return match ? parseFloat(match[1]) * 100 : 80;
  }

  private parseDuration(duration: string): number {
    // Convert duration string to seconds
    const match = duration.match(/(\d+)([msh])/);
    if (!match) return 300;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return 300;
    }
  }

  private convertToGCPFilter(expr: string): string {
    // Convert Prometheus expression to GCP filter
    if (expr.includes('cpu')) {
      return 'metric.type="compute.googleapis.com/instance/cpu/utilization"';
    }
    if (expr.includes('memory')) {
      return 'metric.type="kubernetes.io/container/memory/used_bytes"';
    }
    return 'metric.type="custom.googleapis.com/metric"';
  }

  private getCanaryCode(): string {
    return `
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const apiCanary = async function () {
  const page = await synthetics.getPage();
  
  const response = await page.goto('https://portal.saas-idp.com/health', {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });
  
  if (!response) {
    throw new Error('Failed to load page');
  }
  
  const statusCode = response.status();
  if (statusCode !== 200) {
    throw new Error(\`Expected status code 200, got \${statusCode}\`);
  }
  
  const healthCheck = await page.evaluate(() => {
    return fetch('/api/health').then(r => r.json());
  });
  
  if (healthCheck.status !== 'healthy') {
    throw new Error('Health check failed');
  }
  
  log.info('Canary passed');
};

exports.handler = async () => {
  return await synthetics.executeStep('apiCanary', apiCanary);
};
    `;
  }
}