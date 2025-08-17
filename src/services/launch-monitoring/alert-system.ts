import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  source: string;
  metric: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface AlertCondition {
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  duration?: number; // minutes - how long condition must persist
  evaluationWindow?: number; // minutes - time window for evaluation
}

enum AlertSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  SUPPRESSED = 'SUPPRESSED'
}

interface Alert {
  id: string;
  ruleId?: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  metric?: string;
  value?: number;
  threshold?: number;
  tags: string[];
  fingerprint: string;
  startsAt: Date;
  endsAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: any;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'sms' | 'pagerduty';
  config: NotificationConfig;
  enabled: boolean;
  filters: NotificationFilter[];
  rateLimits: RateLimit;
  createdAt: Date;
}

interface NotificationConfig {
  // Email config
  to?: string[];
  cc?: string[];
  bcc?: string[];
  template?: string;
  
  // Slack config
  webhook?: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  
  // Teams config
  webhookUrl?: string;
  
  // Webhook config
  url?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  
  // SMS config
  phoneNumbers?: string[];
  provider?: 'twilio' | 'aws-sns';
  
  // PagerDuty config
  integrationKey?: string;
  severity?: string;
}

interface NotificationFilter {
  field: 'severity' | 'source' | 'metric' | 'tags';
  operator: 'eq' | 'neq' | 'contains' | 'not_contains';
  value: string | string[];
}

interface RateLimit {
  maxNotifications: number;
  windowMinutes: number;
  enabled: boolean;
}

interface NotificationHistory {
  id: string;
  alertId: string;
  channelId: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: Date;
  error?: string;
  metadata?: any;
}

interface DashboardConfig {
  id: string;
  name: string;
  type: 'executive' | 'operational' | 'technical' | 'business';
  audience: 'leadership' | 'engineering' | 'operations' | 'sales' | 'marketing';
  widgets: DashboardWidget[];
  refreshInterval: number; // seconds
  timeRange: TimeRange;
  filters: DashboardFilter[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert-list' | 'health-status' | 'trend';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  dataSource: string;
  config: WidgetConfig;
  refreshInterval?: number;
}

interface WidgetConfig {
  metrics?: string[];
  chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'number';
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  groupBy?: string;
  filters?: any;
  thresholds?: { warning: number; critical: number };
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

interface TimeRange {
  start: Date;
  end: Date;
  relative?: '1h' | '4h' | '24h' | '7d' | '30d' | '90d';
}

interface DashboardFilter {
  field: string;
  operator: string;
  value: any;
}

interface ReportConfig {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'ad-hoc';
  schedule: ReportSchedule;
  recipients: string[];
  template: ReportTemplate;
  sections: ReportSection[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // HH:MM format
  timezone: string;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
}

interface ReportTemplate {
  format: 'pdf' | 'html' | 'csv';
  style: 'executive' | 'detailed' | 'summary';
  branding: boolean;
  attachments: boolean;
}

interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'metrics' | 'charts' | 'tables' | 'alerts' | 'recommendations';
  dataSource: string;
  config: any;
  order: number;
}

export class AlertSystem extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private dashboards: Map<string, DashboardConfig> = new Map();
  private reports: Map<string, ReportConfig> = new Map();
  private evaluationJobs: Map<string, NodeJS.Timeout> = new Map();
  private reportJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.initializeDefaultDashboards();
    this.initializeDefaultReports();
    this.startAlertEvaluation();
    this.startReportScheduler();
  }

  private initializeDefaultRules() {
    const defaultRules: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'High Response Time',
        description: 'Alert when average response time exceeds threshold',
        source: 'platform-reliability',
        metric: 'response_time_avg',
        condition: { operator: 'gt', threshold: 500, duration: 5 },
        severity: AlertSeverity.HIGH,
        enabled: true,
        tags: ['performance', 'sla']
      },
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds threshold',
        source: 'platform-reliability',
        metric: 'error_rate',
        condition: { operator: 'gt', threshold: 0.05, duration: 3 },
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        tags: ['reliability', 'sla']
      },
      {
        name: 'Low Customer Health Score',
        description: 'Alert when customer health score drops below threshold',
        source: 'customer-success',
        metric: 'health_score',
        condition: { operator: 'lt', threshold: 60, duration: 30 },
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        tags: ['customer-success', 'churn-risk']
      },
      {
        name: 'High Churn Risk',
        description: 'Alert when customer churn risk exceeds threshold',
        source: 'customer-success',
        metric: 'churn_risk',
        condition: { operator: 'gt', threshold: 0.7, duration: 60 },
        severity: AlertSeverity.HIGH,
        enabled: true,
        tags: ['customer-success', 'churn-risk']
      },
      {
        name: 'Low Conversion Rate',
        description: 'Alert when trial-to-paid conversion rate drops',
        source: 'launch-metrics',
        metric: 'trial_to_paid_conversion',
        condition: { operator: 'lt', threshold: 0.15, duration: 60 },
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        tags: ['conversion', 'sales']
      },
      {
        name: 'Competitor Pricing Change',
        description: 'Alert when competitor changes pricing',
        source: 'competitive-intelligence',
        metric: 'pricing_change',
        condition: { operator: 'eq', threshold: 1 },
        severity: AlertSeverity.INFO,
        enabled: true,
        tags: ['competitive', 'pricing']
      },
      {
        name: 'Security Vulnerability',
        description: 'Alert on critical security vulnerabilities',
        source: 'platform-reliability',
        metric: 'critical_vulnerabilities',
        condition: { operator: 'gt', threshold: 0 },
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        tags: ['security', 'vulnerability']
      },
      {
        name: 'Database High Connections',
        description: 'Alert when database connection usage is high',
        source: 'platform-reliability',
        metric: 'database_connections',
        condition: { operator: 'gt', threshold: 180, duration: 10 },
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        tags: ['database', 'performance']
      },
      {
        name: 'Low NPS Score',
        description: 'Alert when Net Promoter Score drops significantly',
        source: 'customer-success',
        metric: 'nps',
        condition: { operator: 'lt', threshold: 30, duration: 1440 }, // 24 hours
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        tags: ['customer-satisfaction', 'nps']
      },
      {
        name: 'Pipeline Coverage Low',
        description: 'Alert when sales pipeline coverage drops below target',
        source: 'business-performance',
        metric: 'pipeline_coverage',
        condition: { operator: 'lt', threshold: 2.5, duration: 60 },
        severity: AlertSeverity.HIGH,
        enabled: true,
        tags: ['sales', 'pipeline']
      }
    ];

    defaultRules.forEach(rule => {
      this.addAlertRule(rule);
    });
  }

  private initializeDefaultChannels() {
    const defaultChannels: Omit<NotificationChannel, 'id' | 'createdAt'>[] = [
      {
        name: 'Engineering Team Slack',
        type: 'slack',
        config: {
          webhook: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
          channel: '#alerts-engineering',
          username: 'Platform Monitor',
          iconEmoji: ':warning:'
        },
        enabled: true,
        filters: [
          { field: 'source', operator: 'eq', value: 'platform-reliability' },
          { field: 'severity', operator: 'eq', value: ['HIGH', 'CRITICAL'] }
        ],
        rateLimits: { maxNotifications: 10, windowMinutes: 60, enabled: true }
      },
      {
        name: 'Executive Email',
        type: 'email',
        config: {
          to: ['ceo@company.com', 'cto@company.com', 'vp-eng@company.com'],
          template: 'executive-alert'
        },
        enabled: true,
        filters: [
          { field: 'severity', operator: 'eq', value: 'CRITICAL' }
        ],
        rateLimits: { maxNotifications: 5, windowMinutes: 240, enabled: true }
      },
      {
        name: 'Customer Success Slack',
        type: 'slack',
        config: {
          webhook: 'https://hooks.slack.com/services/T00000000/B00000000/YYYYYYYYYYYYYYYYYYYYYYYY',
          channel: '#customer-alerts',
          username: 'Customer Success Monitor'
        },
        enabled: true,
        filters: [
          { field: 'source', operator: 'eq', value: 'customer-success' }
        ],
        rateLimits: { maxNotifications: 15, windowMinutes: 60, enabled: true }
      },
      {
        name: 'Sales Team Email',
        type: 'email',
        config: {
          to: ['sales-team@company.com'],
          template: 'sales-alert'
        },
        enabled: true,
        filters: [
          { field: 'source', operator: 'eq', value: 'business-performance' },
          { field: 'tags', operator: 'contains', value: 'sales' }
        ],
        rateLimits: { maxNotifications: 8, windowMinutes: 120, enabled: true }
      },
      {
        name: 'PagerDuty Critical',
        type: 'pagerduty',
        config: {
          integrationKey: 'your-pagerduty-integration-key',
          severity: 'critical'
        },
        enabled: true,
        filters: [
          { field: 'severity', operator: 'eq', value: 'CRITICAL' }
        ],
        rateLimits: { maxNotifications: 3, windowMinutes: 60, enabled: true }
      }
    ];

    defaultChannels.forEach(channel => {
      this.addNotificationChannel(channel);
    });
  }

  private initializeDefaultDashboards() {
    const executiveDashboard: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Executive Launch Dashboard',
        type: 'executive',
        audience: 'leadership',
        widgets: [
          {
            id: 'launch-score',
            type: 'metric',
            title: 'Launch Score',
            position: { x: 0, y: 0, width: 4, height: 3 },
            dataSource: 'launch-metrics',
            config: {
              metrics: ['launch_score'],
              chartType: 'gauge',
              thresholds: { warning: 70, critical: 50 },
              format: 'number'
            }
          },
          {
            id: 'revenue-trend',
            type: 'chart',
            title: 'Revenue Trend',
            position: { x: 4, y: 0, width: 8, height: 3 },
            dataSource: 'launch-metrics',
            config: {
              metrics: ['mrr', 'arr'],
              chartType: 'line',
              aggregation: 'sum',
              format: 'currency'
            }
          },
          {
            id: 'customer-health',
            type: 'metric',
            title: 'Avg Customer Health',
            position: { x: 0, y: 3, width: 3, height: 2 },
            dataSource: 'customer-success',
            config: {
              metrics: ['avg_health_score'],
              chartType: 'number',
              format: 'number'
            }
          },
          {
            id: 'platform-uptime',
            type: 'metric',
            title: 'Platform Uptime',
            position: { x: 3, y: 3, width: 3, height: 2 },
            dataSource: 'platform-reliability',
            config: {
              metrics: ['uptime'],
              chartType: 'number',
              format: 'percentage'
            }
          },
          {
            id: 'active-alerts',
            type: 'alert-list',
            title: 'Critical Alerts',
            position: { x: 6, y: 3, width: 6, height: 4 },
            dataSource: 'alerts',
            config: {
              filters: { severity: ['HIGH', 'CRITICAL'], status: 'ACTIVE' }
            }
          }
        ],
        refreshInterval: 300, // 5 minutes
        timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date(), relative: '24h' },
        filters: [],
        permissions: ['leadership', 'executives']
      }
    ];

    executiveDashboard.forEach(dashboard => {
      this.addDashboard(dashboard);
    });
  }

  private initializeDefaultReports() {
    const defaultReports: Omit<ReportConfig, 'id'>[] = [
      {
        name: 'Daily Operations Report',
        type: 'daily',
        schedule: {
          frequency: 'daily',
          time: '08:00',
          timezone: 'UTC'
        },
        recipients: ['ops-team@company.com'],
        template: {
          format: 'html',
          style: 'detailed',
          branding: true,
          attachments: false
        },
        sections: [
          {
            id: 'platform-health',
            title: 'Platform Health Summary',
            type: 'summary',
            dataSource: 'platform-reliability',
            config: { metrics: ['uptime', 'response_time', 'error_rate'] },
            order: 1
          },
          {
            id: 'active-alerts',
            title: 'Active Alerts',
            type: 'alerts',
            dataSource: 'alerts',
            config: { status: 'ACTIVE', severity: ['MEDIUM', 'HIGH', 'CRITICAL'] },
            order: 2
          },
          {
            id: 'performance-metrics',
            title: 'Performance Metrics',
            type: 'metrics',
            dataSource: 'platform-reliability',
            config: { timeRange: '24h' },
            order: 3
          }
        ],
        enabled: true
      },
      {
        name: 'Weekly Business Review',
        type: 'weekly',
        schedule: {
          frequency: 'weekly',
          time: '09:00',
          timezone: 'UTC',
          daysOfWeek: [1] // Monday
        },
        recipients: ['leadership-team@company.com'],
        template: {
          format: 'pdf',
          style: 'executive',
          branding: true,
          attachments: true
        },
        sections: [
          {
            id: 'launch-summary',
            title: 'Launch Progress Summary',
            type: 'summary',
            dataSource: 'launch-metrics',
            config: { timeRange: '7d' },
            order: 1
          },
          {
            id: 'customer-metrics',
            title: 'Customer Success Metrics',
            type: 'metrics',
            dataSource: 'customer-success',
            config: { timeRange: '7d' },
            order: 2
          },
          {
            id: 'business-performance',
            title: 'Business Performance',
            type: 'metrics',
            dataSource: 'business-performance',
            config: { timeRange: '7d' },
            order: 3
          },
          {
            id: 'competitive-intel',
            title: 'Competitive Intelligence',
            type: 'summary',
            dataSource: 'competitive-intelligence',
            config: { timeRange: '7d' },
            order: 4
          },
          {
            id: 'recommendations',
            title: 'Key Recommendations',
            type: 'recommendations',
            dataSource: 'insights',
            config: {},
            order: 5
          }
        ],
        enabled: true
      },
      {
        name: 'Monthly Investor Report',
        type: 'monthly',
        schedule: {
          frequency: 'monthly',
          time: '10:00',
          timezone: 'UTC',
          dayOfMonth: 1
        },
        recipients: ['investors@company.com', 'board@company.com'],
        template: {
          format: 'pdf',
          style: 'executive',
          branding: true,
          attachments: true
        },
        sections: [
          {
            id: 'executive-summary',
            title: 'Executive Summary',
            type: 'summary',
            dataSource: 'launch-metrics',
            config: { timeRange: '30d' },
            order: 1
          },
          {
            id: 'financial-metrics',
            title: 'Financial Performance',
            type: 'charts',
            dataSource: 'business-performance',
            config: { metrics: ['revenue', 'mrr', 'arr'], timeRange: '30d' },
            order: 2
          },
          {
            id: 'customer-metrics',
            title: 'Customer Metrics',
            type: 'charts',
            dataSource: 'customer-success',
            config: { metrics: ['acquisition', 'retention', 'expansion'], timeRange: '30d' },
            order: 3
          },
          {
            id: 'platform-reliability',
            title: 'Platform Reliability',
            type: 'metrics',
            dataSource: 'platform-reliability',
            config: { timeRange: '30d' },
            order: 4
          }
        ],
        enabled: true
      }
    ];

    defaultReports.forEach(report => {
      this.addReport(report);
    });
  }

  private startAlertEvaluation() {
    // Evaluate alert rules every minute
    this.evaluationJobs.set('rules-evaluation', setInterval(
      () => this.evaluateAlertRules(),
      60 * 1000
    ));

    // Check for alert resolution every 2 minutes
    this.evaluationJobs.set('resolution-check', setInterval(
      () => this.checkAlertResolution(),
      2 * 60 * 1000
    ));

    // Cleanup old alerts every hour
    this.evaluationJobs.set('alert-cleanup', setInterval(
      () => this.cleanupOldAlerts(),
      60 * 60 * 1000
    ));
  }

  private startReportScheduler() {
    // Check for scheduled reports every minute
    this.reportJobs.set('report-scheduler', setInterval(
      () => this.checkScheduledReports(),
      60 * 1000
    ));
  }

  async addAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.alertRules.set(newRule.id, newRule);

    // Store in database
    await prisma.alertRule.create({
      data: {
        id: newRule.id,
        name: newRule.name,
        description: newRule.description,
        source: newRule.source,
        metric: newRule.metric,
        condition: newRule.condition,
        severity: newRule.severity,
        enabled: newRule.enabled,
        tags: newRule.tags
      }
    });

    this.emit('alert-rule-added', newRule);
    return newRule;
  }

  async addNotificationChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt'>): Promise<NotificationChannel> {
    const newChannel: NotificationChannel = {
      ...channel,
      id: `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    this.notificationChannels.set(newChannel.id, newChannel);

    // Store in database
    await prisma.notificationChannel.create({
      data: {
        id: newChannel.id,
        name: newChannel.name,
        type: newChannel.type,
        config: newChannel.config,
        enabled: newChannel.enabled,
        filters: newChannel.filters,
        rateLimits: newChannel.rateLimits
      }
    });

    this.emit('notification-channel-added', newChannel);
    return newChannel;
  }

  async addDashboard(dashboard: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardConfig> {
    const newDashboard: DashboardConfig = {
      ...dashboard,
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);

    // Store in database
    await prisma.dashboard.create({
      data: {
        id: newDashboard.id,
        name: newDashboard.name,
        type: newDashboard.type,
        audience: newDashboard.audience,
        widgets: newDashboard.widgets,
        refreshInterval: newDashboard.refreshInterval,
        timeRange: newDashboard.timeRange,
        filters: newDashboard.filters,
        permissions: newDashboard.permissions
      }
    });

    this.emit('dashboard-added', newDashboard);
    return newDashboard;
  }

  async addReport(report: Omit<ReportConfig, 'id'>): Promise<ReportConfig> {
    const newReport: ReportConfig = {
      ...report,
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nextRun: this.calculateNextRun(report.schedule)
    };

    this.reports.set(newReport.id, newReport);

    // Store in database
    await prisma.reportConfig.create({
      data: {
        id: newReport.id,
        name: newReport.name,
        type: newReport.type,
        schedule: newReport.schedule,
        recipients: newReport.recipients,
        template: newReport.template,
        sections: newReport.sections,
        enabled: newReport.enabled,
        nextRun: newReport.nextRun
      }
    });

    this.emit('report-added', newReport);
    return newReport;
  }

  private calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      
      case 'weekly':
        if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
          const targetDay = schedule.daysOfWeek[0];
          const currentDay = nextRun.getDay();
          let daysToAdd = targetDay - currentDay;
          
          if (daysToAdd <= 0 && (nextRun <= now)) {
            daysToAdd += 7;
          }
          
          nextRun.setDate(nextRun.getDate() + daysToAdd);
        }
        break;
      
      case 'monthly':
        if (schedule.dayOfMonth) {
          nextRun.setDate(schedule.dayOfMonth);
          if (nextRun <= now) {
            nextRun.setMonth(nextRun.getMonth() + 1);
          }
        }
        break;
    }

    return nextRun;
  }

  async evaluateAlertRules(): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Get current metric value
    const currentValue = await this.getMetricValue(rule.source, rule.metric);
    if (currentValue === null) return;

    const conditionMet = this.checkCondition(currentValue, rule.condition);
    const fingerprint = this.generateFingerprint(rule, currentValue);
    
    const existingAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.fingerprint === fingerprint && alert.status === AlertStatus.ACTIVE);

    if (conditionMet && !existingAlert) {
      // Create new alert
      const alert = await this.createAlert(rule, currentValue, fingerprint);
      await this.sendNotifications(alert);
    } else if (!conditionMet && existingAlert) {
      // Resolve existing alert
      await this.resolveAlert(existingAlert.id, 'condition-no-longer-met');
    }
  }

  private async getMetricValue(source: string, metric: string): Promise<number | null> {
    // Mock metric fetching - in real implementation, query actual metrics
    const mockValues: Record<string, Record<string, number>> = {
      'platform-reliability': {
        'response_time_avg': 85 + Math.random() * 100,
        'error_rate': Math.random() * 0.02,
        'uptime': 0.999 + Math.random() * 0.001,
        'database_connections': 120 + Math.random() * 80,
        'critical_vulnerabilities': Math.floor(Math.random() * 3)
      },
      'customer-success': {
        'health_score': 60 + Math.random() * 30,
        'churn_risk': Math.random() * 0.8,
        'nps': 30 + Math.random() * 40
      },
      'launch-metrics': {
        'trial_to_paid_conversion': 0.12 + Math.random() * 0.08,
        'launch_score': 70 + Math.random() * 25
      },
      'business-performance': {
        'pipeline_coverage': 2.0 + Math.random() * 1.5
      }
    };

    return mockValues[source]?.[metric] ?? null;
  }

  private checkCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'neq': return value !== condition.threshold;
      default: return false;
    }
  }

  private generateFingerprint(rule: AlertRule, value: number): string {
    return `${rule.source}-${rule.metric}-${rule.condition.operator}-${rule.condition.threshold}`;
  }

  private async createAlert(rule: AlertRule, value: number, fingerprint: string): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: AlertStatus.ACTIVE,
      source: rule.source,
      metric: rule.metric,
      value,
      threshold: rule.condition.threshold,
      tags: rule.tags,
      fingerprint,
      startsAt: new Date(),
      metadata: { rule: rule.id, evaluatedValue: value }
    };

    this.activeAlerts.set(alert.id, alert);

    // Store in database
    await prisma.alert.create({
      data: {
        id: alert.id,
        ruleId: alert.ruleId,
        name: alert.name,
        severity: alert.severity,
        source: alert.source,
        message: alert.description,
        fingerprint: alert.fingerprint,
        status: alert.status,
        metadata: alert.metadata
      }
    });

    this.emit('alert-created', alert);
    return alert;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const eligibleChannels = this.getEligibleChannels(alert);
    
    for (const channel of eligibleChannels) {
      try {
        if (await this.checkRateLimit(channel, alert)) {
          await this.sendNotification(channel, alert);
        }
      } catch (error) {
        console.error(`Failed to send notification to ${channel.name}:`, error);
      }
    }
  }

  private getEligibleChannels(alert: Alert): NotificationChannel[] {
    return Array.from(this.notificationChannels.values())
      .filter(channel => {
        if (!channel.enabled) return false;
        
        return channel.filters.every(filter => {
          switch (filter.field) {
            case 'severity':
              return this.matchesFilter(alert.severity, filter);
            case 'source':
              return this.matchesFilter(alert.source, filter);
            case 'metric':
              return this.matchesFilter(alert.metric || '', filter);
            case 'tags':
              return alert.tags.some(tag => this.matchesFilter(tag, filter));
            default:
              return true;
          }
        });
      });
  }

  private matchesFilter(value: string, filter: NotificationFilter): boolean {
    const filterValue = Array.isArray(filter.value) ? filter.value : [filter.value];
    
    switch (filter.operator) {
      case 'eq':
        return filterValue.includes(value);
      case 'neq':
        return !filterValue.includes(value);
      case 'contains':
        return filterValue.some(fv => value.includes(fv));
      case 'not_contains':
        return !filterValue.some(fv => value.includes(fv));
      default:
        return false;
    }
  }

  private async checkRateLimit(channel: NotificationChannel, alert: Alert): Promise<boolean> {
    if (!channel.rateLimits.enabled) return true;

    const windowStart = new Date(Date.now() - channel.rateLimits.windowMinutes * 60 * 1000);
    
    const recentNotifications = await prisma.notificationHistory.count({
      where: {
        channelId: channel.id,
        sentAt: { gte: windowStart },
        status: 'sent'
      }
    });

    return recentNotifications < channel.rateLimits.maxNotifications;
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    let success = false;
    let error: string | undefined;

    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert);
          success = true;
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert);
          success = true;
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          success = true;
          break;
        case 'pagerduty':
          await this.sendPagerDutyNotification(channel, alert);
          success = true;
          break;
        default:
          error = 'Unsupported channel type';
      }
    } catch (err: any) {
      error = err.message;
    }

    // Record notification history
    await prisma.notificationHistory.create({
      data: {
        alertId: alert.id,
        channelId: channel.id,
        status: success ? 'sent' : 'failed',
        sentAt: new Date(),
        error,
        metadata: { channel: channel.name, type: channel.type }
      }
    });

    this.emit('notification-sent', { channel, alert, success, error });
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock email sending
    console.log(`Sending email notification for alert ${alert.name} to ${channel.config.to?.join(', ')}`);
    
    // In real implementation, use email service like SendGrid, AWS SES, etc.
    const emailContent = {
      to: channel.config.to,
      subject: `[${alert.severity}] ${alert.name}`,
      html: this.generateEmailTemplate(alert, channel.config.template || 'default')
    };
    
    // Mock success
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock Slack webhook
    console.log(`Sending Slack notification for alert ${alert.name} to ${channel.config.channel}`);
    
    const slackMessage = {
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.iconEmoji,
      attachments: [
        {
          color: this.getSlackColor(alert.severity),
          title: alert.name,
          text: alert.description,
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Source', value: alert.source, short: true },
            { title: 'Value', value: alert.value?.toString() || 'N/A', short: true },
            { title: 'Threshold', value: alert.threshold?.toString() || 'N/A', short: true }
          ],
          ts: Math.floor(alert.startsAt.getTime() / 1000)
        }
      ]
    };

    // Mock HTTP request to Slack webhook
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock webhook
    console.log(`Sending webhook notification for alert ${alert.name} to ${channel.config.url}`);
    
    const webhookPayload = {
      alert: alert,
      timestamp: new Date().toISOString(),
      source: 'platform-monitoring'
    };

    // Mock HTTP request
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private async sendPagerDutyNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Mock PagerDuty API call
    console.log(`Sending PagerDuty notification for alert ${alert.name}`);
    
    const pagerDutyPayload = {
      routing_key: channel.config.integrationKey,
      event_action: 'trigger',
      dedup_key: alert.fingerprint,
      payload: {
        summary: alert.name,
        severity: channel.config.severity || alert.severity.toLowerCase(),
        source: alert.source,
        custom_details: {
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold
        }
      }
    };

    // Mock HTTP request to PagerDuty
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private getSlackColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return '#ff0000';
      case AlertSeverity.HIGH: return '#ff8000';
      case AlertSeverity.MEDIUM: return '#ffff00';
      case AlertSeverity.LOW: return '#00ff00';
      default: return '#0080ff';
    }
  }

  private generateEmailTemplate(alert: Alert, template: string): string {
    const baseTemplate = `
      <h2>Alert: ${alert.name}</h2>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Description:</strong> ${alert.description}</p>
      <p><strong>Source:</strong> ${alert.source}</p>
      <p><strong>Started:</strong> ${alert.startsAt.toISOString()}</p>
      ${alert.metric ? `<p><strong>Metric:</strong> ${alert.metric}</p>` : ''}
      ${alert.value ? `<p><strong>Current Value:</strong> ${alert.value}</p>` : ''}
      ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
      <p><strong>Tags:</strong> ${alert.tags.join(', ')}</p>
    `;

    return baseTemplate;
  }

  async checkAlertResolution(): Promise<void> {
    for (const alert of this.activeAlerts.values()) {
      if (alert.status !== AlertStatus.ACTIVE) continue;

      const rule = this.alertRules.get(alert.ruleId || '');
      if (!rule) continue;

      const currentValue = await this.getMetricValue(rule.source, rule.metric);
      if (currentValue === null) continue;

      const conditionMet = this.checkCondition(currentValue, rule.condition);
      if (!conditionMet) {
        await this.resolveAlert(alert.id, 'condition-resolved');
      }
    }
  }

  async resolveAlert(alertId: string, reason: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.endsAt = new Date();

    // Update in database
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: alert.status,
        resolvedAt: alert.resolvedAt,
        metadata: { ...alert.metadata, resolutionReason: reason }
      }
    });

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    this.emit('alert-resolved', { alert, reason });
  }

  async checkScheduledReports(): Promise<void> {
    const now = new Date();
    
    for (const report of this.reports.values()) {
      if (!report.enabled || !report.nextRun) continue;
      
      if (report.nextRun <= now) {
        await this.generateReport(report);
        
        // Update next run time
        report.nextRun = this.calculateNextRun(report.schedule);
        report.lastRun = now;
        
        await prisma.reportConfig.update({
          where: { id: report.id },
          data: {
            lastRun: report.lastRun,
            nextRun: report.nextRun
          }
        });
      }
    }
  }

  private async generateReport(reportConfig: ReportConfig): Promise<void> {
    try {
      console.log(`Generating report: ${reportConfig.name}`);
      
      // Collect data for each section
      const reportData = await this.collectReportData(reportConfig.sections);
      
      // Generate report content
      const reportContent = await this.formatReport(reportData, reportConfig.template);
      
      // Send to recipients
      await this.sendReport(reportContent, reportConfig);
      
      this.emit('report-generated', { reportConfig, success: true });
    } catch (error) {
      console.error(`Failed to generate report ${reportConfig.name}:`, error);
      this.emit('report-generated', { reportConfig, success: false, error });
    }
  }

  private async collectReportData(sections: ReportSection[]): Promise<any> {
    const data: any = {};
    
    for (const section of sections.sort((a, b) => a.order - b.order)) {
      switch (section.dataSource) {
        case 'launch-metrics':
          data[section.id] = await this.getLaunchMetricsData(section.config);
          break;
        case 'customer-success':
          data[section.id] = await this.getCustomerSuccessData(section.config);
          break;
        case 'business-performance':
          data[section.id] = await this.getBusinessPerformanceData(section.config);
          break;
        case 'platform-reliability':
          data[section.id] = await this.getPlatformReliabilityData(section.config);
          break;
        case 'competitive-intelligence':
          data[section.id] = await this.getCompetitiveIntelligenceData(section.config);
          break;
        case 'alerts':
          data[section.id] = await this.getAlertsData(section.config);
          break;
      }
    }
    
    return data;
  }

  private async getLaunchMetricsData(config: any): Promise<any> {
    // Mock data collection from launch metrics
    return {
      launchScore: 78,
      signups: 145,
      conversions: 32,
      revenue: 45000,
      churnRate: 0.04
    };
  }

  private async getCustomerSuccessData(config: any): Promise<any> {
    return {
      healthScore: 72,
      nps: 45,
      churnRisk: 0.12,
      expansionRevenue: 25000
    };
  }

  private async getBusinessPerformanceData(config: any): Promise<any> {
    return {
      pipelineValue: 2500000,
      winRate: 0.22,
      marketingROI: 4.2,
      salesAttainment: 0.94
    };
  }

  private async getPlatformReliabilityData(config: any): Promise<any> {
    return {
      uptime: 0.9998,
      responseTime: 85,
      errorRate: 0.008,
      incidentCount: 2
    };
  }

  private async getCompetitiveIntelligenceData(config: any): Promise<any> {
    return {
      newFeatures: 3,
      pricingChanges: 1,
      marketTrends: 5
    };
  }

  private async getAlertsData(config: any): Promise<any> {
    const activeAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => {
        if (config.status && alert.status !== config.status) return false;
        if (config.severity && !config.severity.includes(alert.severity)) return false;
        return true;
      });

    return {
      total: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
      high: activeAlerts.filter(a => a.severity === AlertSeverity.HIGH).length,
      alerts: activeAlerts.slice(0, 10) // Top 10 alerts
    };
  }

  private async formatReport(data: any, template: ReportTemplate): Promise<string> {
    // Mock report formatting
    let content = '';
    
    switch (template.format) {
      case 'html':
        content = this.formatHTMLReport(data, template);
        break;
      case 'pdf':
        content = this.formatPDFReport(data, template);
        break;
      case 'csv':
        content = this.formatCSVReport(data, template);
        break;
    }
    
    return content;
  }

  private formatHTMLReport(data: any, template: ReportTemplate): string {
    return `
      <html>
        <head><title>Platform Report</title></head>
        <body>
          <h1>Platform Monitoring Report</h1>
          <div>Generated: ${new Date().toISOString()}</div>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body>
      </html>
    `;
  }

  private formatPDFReport(data: any, template: ReportTemplate): string {
    // Mock PDF generation
    return 'PDF content would be generated here';
  }

  private formatCSVReport(data: any, template: ReportTemplate): string {
    // Mock CSV generation
    return Object.entries(data)
      .map(([key, value]) => `${key},${JSON.stringify(value)}`)
      .join('\n');
  }

  private async sendReport(content: string, config: ReportConfig): Promise<void> {
    // Mock report sending
    console.log(`Sending report ${config.name} to ${config.recipients.join(', ')}`);
    
    // In real implementation, send via email service
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async cleanupOldAlerts(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Remove resolved alerts older than 7 days
    await prisma.alert.deleteMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { lt: sevenDaysAgo }
      }
    });

    // Cleanup notification history older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.notificationHistory.deleteMany({
      where: {
        sentAt: { lt: thirtyDaysAgo }
      }
    });

    this.emit('cleanup-completed');
  }

  async getExecutiveDashboard(): Promise<any> {
    const executiveDash = Array.from(this.dashboards.values())
      .find(d => d.type === 'executive');
    
    if (!executiveDash) return null;

    // Collect data for all widgets
    const widgetData: any = {};
    
    for (const widget of executiveDash.widgets) {
      widgetData[widget.id] = await this.getWidgetData(widget);
    }

    return {
      dashboard: executiveDash,
      data: widgetData,
      lastUpdated: new Date()
    };
  }

  private async getWidgetData(widget: DashboardWidget): Promise<any> {
    // Mock widget data collection
    switch (widget.type) {
      case 'metric':
        return { value: 78, trend: 'up', change: 5.2 };
      case 'chart':
        return { 
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          data: [120, 135, 150, 142, 168]
        };
      case 'alert-list':
        return Array.from(this.activeAlerts.values())
          .filter(a => a.severity === AlertSeverity.CRITICAL || a.severity === AlertSeverity.HIGH)
          .slice(0, 5);
      default:
        return {};
    }
  }

  cleanup(): void {
    this.evaluationJobs.forEach(job => clearInterval(job));
    this.evaluationJobs.clear();
    
    this.reportJobs.forEach(job => clearInterval(job));
    this.reportJobs.clear();
  }
}