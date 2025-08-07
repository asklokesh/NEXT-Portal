/**
 * Monitoring and Reporting Service
 * Real-time compliance dashboard, policy violation alerts, governance metrics,
 * executive reporting, and audit log management
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { PolicyEngine } from './policy-engine';
import { ComplianceAutomationService, ComplianceFramework, ComplianceAssessment } from './compliance-automation';
import { SecurityGovernanceService, SecurityMetrics } from './security-governance';
import { QualityGatesService, QualityGateExecution } from './quality-gates';

// Monitoring Configuration
export const MonitoringConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['real-time', 'scheduled', 'event-driven']),
  category: z.enum(['compliance', 'security', 'quality', 'performance', 'governance']),
  metrics: z.array(z.object({
    name: z.string(),
    source: z.string(),
    query: z.string().optional(),
    thresholds: z.object({
      warning: z.number().optional(),
      critical: z.number().optional()
    }).optional(),
    aggregation: z.enum(['sum', 'avg', 'max', 'min', 'count', 'p50', 'p95', 'p99']),
    timeWindow: z.string(), // e.g., '5m', '1h', '24h'
    frequency: z.string() // e.g., '30s', '5m', '1h'
  })),
  alerts: z.array(z.object({
    id: z.string(),
    condition: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
    channels: z.array(z.string()),
    cooldown: z.number().default(300) // seconds
  })),
  dashboards: z.array(z.string()),
  retention: z.number().default(2555), // days
  enabled: z.boolean().default(true)
});

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

// Dashboard Definition
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  category: 'executive' | 'operational' | 'technical' | 'compliance';
  audience: 'executives' | 'managers' | 'engineers' | 'auditors';
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number; // seconds
  permissions: {
    view: string[];
    edit: string[];
  };
  metadata: {
    owner: string;
    created: Date;
    lastModified: Date;
    version: string;
  };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  responsive: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert-list' | 'trend' | 'compliance-score';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    dataSource: string;
    query?: string;
    visualization: string;
    options: Record<string, any>;
  };
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

export interface DashboardFilter {
  name: string;
  type: 'select' | 'multiselect' | 'date-range' | 'text';
  options?: string[];
  default?: any;
}

// Metrics and KPIs
export interface GovernanceMetrics {
  timestamp: Date;
  overall: {
    complianceScore: number;
    securityScore: number;
    qualityScore: number;
    governanceScore: number;
  };
  compliance: {
    frameworkScores: Record<ComplianceFramework, number>;
    totalAssessments: number;
    passedAssessments: number;
    overduePolicies: number;
    activeViolations: number;
  };
  security: {
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    accessViolations: number;
    containerIssues: number;
    secretsExposed: number;
  };
  qualityGates: {
    totalExecutions: number;
    passRate: number;
    averageExecutionTime: number;
    blockedDeployments: number;
  };
  policies: {
    totalPolicies: number;
    activePolicies: number;
    violatedPolicies: number;
    exemptedPolicies: number;
  };
}

// Alert Management
export interface Alert {
  id: string;
  type: 'policy-violation' | 'compliance-failure' | 'security-incident' | 'quality-gate-failure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  source: {
    service: string;
    component: string;
    rule?: string;
  };
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
  channels: string[];
  escalationLevel: number;
  cooldownUntil?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: Alert['severity'];
  enabled: boolean;
  channels: NotificationChannel[];
  cooldown: number; // seconds
  escalation: {
    levels: Array<{
      after: number; // seconds
      channels: string[];
    }>;
  };
  suppressionRules: Array<{
    condition: string;
    duration: number; // seconds
  }>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'teams';
  config: Record<string, any>;
  enabled: boolean;
}

// Report Generation
export interface Report {
  id: string;
  name: string;
  type: 'executive' | 'compliance' | 'security' | 'operational';
  format: 'pdf' | 'html' | 'json' | 'csv';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:mm
    timezone: string;
  };
  recipients: string[];
  template: string;
  filters: Record<string, any>;
  data: ReportData;
  metadata: {
    generated: Date;
    generatedBy: string;
    version: string;
    size: number; // bytes
  };
}

export interface ReportData {
  summary: Record<string, any>;
  metrics: Record<string, any>;
  trends: Array<{
    metric: string;
    timeRange: string;
    values: Array<{ timestamp: Date; value: number }>;
  }>;
  findings: Array<{
    category: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  charts: Array<{
    type: string;
    title: string;
    data: any;
  }>;
  tables: Array<{
    title: string;
    columns: string[];
    rows: any[][];
  }>;
}

// Audit Log
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: {
    type: 'user' | 'service' | 'system';
    id: string;
    ip?: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  metadata: {
    sessionId?: string;
    requestId?: string;
    userAgent?: string;
    geolocation?: string;
  };
  compliance: {
    relevant: boolean;
    frameworks: ComplianceFramework[];
    retention: number; // days
  };
}

export class MonitoringReportingService extends EventEmitter {
  private policyEngine: PolicyEngine;
  private complianceService: ComplianceAutomationService;
  private securityService: SecurityGovernanceService;
  private qualityGatesService: QualityGatesService;

  private monitoringConfigs: Map<string, MonitoringConfig> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private reports: Map<string, Report> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private metrics: GovernanceMetrics[] = [];
  
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    policyEngine: PolicyEngine,
    complianceService: ComplianceAutomationService,
    securityService: SecurityGovernanceService,
    qualityGatesService: QualityGatesService
  ) {
    super();
    this.policyEngine = policyEngine;
    this.complianceService = complianceService;
    this.securityService = securityService;
    this.qualityGatesService = qualityGatesService;
    
    this.initializeDefaultConfigurations();
    this.startMonitoring();
  }

  /**
   * Real-time Monitoring
   */
  async startMonitoring(): Promise<void> {
    // Start monitoring for each configuration
    for (const [configId, config] of this.monitoringConfigs) {
      if (config.enabled) {
        await this.startMonitoringConfig(configId, config);
      }
    }

    // Start metrics collection
    this.startMetricsCollection();
    
    this.emit('monitoringStarted');
  }

  async stopMonitoring(): Promise<void> {
    // Stop all active monitors
    for (const [configId, timer] of this.activeMonitors) {
      clearInterval(timer);
      this.activeMonitors.delete(configId);
    }
    
    this.emit('monitoringStopped');
  }

  /**
   * Dashboard Management
   */
  async createDashboard(dashboard: Omit<Dashboard, 'metadata'>): Promise<string> {
    const dashboardWithMetadata: Dashboard = {
      ...dashboard,
      metadata: {
        owner: 'system',
        created: new Date(),
        lastModified: new Date(),
        version: '1.0.0'
      }
    };

    this.dashboards.set(dashboard.id, dashboardWithMetadata);
    this.emit('dashboardCreated', dashboardWithMetadata);
    
    return dashboard.id;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    // Get real-time data for dashboard widgets
    const dashboardWithData = await this.populateDashboardData(dashboard);
    return dashboardWithData;
  }

  async getDashboardsList(
    category?: Dashboard['category'],
    audience?: Dashboard['audience']
  ): Promise<Dashboard[]> {
    let dashboards = Array.from(this.dashboards.values());

    if (category) {
      dashboards = dashboards.filter(d => d.category === category);
    }

    if (audience) {
      dashboards = dashboards.filter(d => d.audience === audience);
    }

    return dashboards;
  }

  /**
   * Alert Management
   */
  async createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    description: string,
    source: Alert['source'],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const alertId = crypto.randomUUID();
    
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      description,
      source,
      metadata,
      status: 'active',
      createdAt: new Date(),
      channels: await this.getApplicableChannels(type, severity),
      escalationLevel: 0
    };

    this.alerts.set(alertId, alert);
    
    // Send notifications
    await this.sendAlertNotifications(alert);
    
    // Schedule escalation if configured
    await this.scheduleAlertEscalation(alert);
    
    this.emit('alertCreated', alert);
    
    return alertId;
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit('alertAcknowledged', alert);
    
    // Log audit event
    await this.logAuditEvent('alert-acknowledged', { type: 'user', id: acknowledgedBy }, {
      type: 'alert',
      id: alertId,
      name: alert.title
    }, 'success', { alertId, severity: alert.severity });
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.emit('alertResolved', alert);
    
    // Log audit event
    await this.logAuditEvent('alert-resolved', { type: 'user', id: resolvedBy }, {
      type: 'alert',
      id: alertId,
      name: alert.title
    }, 'success', { alertId, severity: alert.severity });
  }

  /**
   * Report Generation
   */
  async generateReport(
    type: Report['type'],
    format: Report['format'],
    filters: Record<string, any> = {}
  ): Promise<Report> {
    const reportId = crypto.randomUUID();
    
    try {
      const data = await this.collectReportData(type, filters);
      const template = this.getReportTemplate(type, format);
      
      const report: Report = {
        id: reportId,
        name: `${type} Report - ${new Date().toISOString().split('T')[0]}`,
        type,
        format,
        recipients: [],
        template,
        filters,
        data,
        metadata: {
          generated: new Date(),
          generatedBy: 'system',
          version: '1.0.0',
          size: JSON.stringify(data).length
        }
      };

      this.reports.set(reportId, report);
      this.emit('reportGenerated', report);
      
      return report;
      
    } catch (error) {
      this.emit('reportGenerationFailed', { reportId, type, error });
      throw error;
    }
  }

  async scheduleReport(
    reportConfig: Omit<Report, 'id' | 'data' | 'metadata'>
  ): Promise<string> {
    const reportId = crypto.randomUUID();
    
    // Schedule report generation
    if (reportConfig.schedule) {
      this.scheduleReportGeneration(reportId, reportConfig);
    }
    
    this.emit('reportScheduled', { reportId, config: reportConfig });
    
    return reportId;
  }

  /**
   * Metrics Collection
   */
  async collectGovernanceMetrics(): Promise<GovernanceMetrics> {
    const timestamp = new Date();
    
    // Collect compliance metrics
    const complianceMetrics = await this.collectComplianceMetrics();
    
    // Collect security metrics
    const securityMetrics = await this.securityService.generateSecurityMetrics();
    
    // Collect quality gate metrics
    const qualityMetrics = await this.collectQualityMetrics();
    
    // Collect policy metrics
    const policyMetrics = await this.collectPolicyMetrics();
    
    // Calculate overall scores
    const overall = {
      complianceScore: complianceMetrics.averageScore,
      securityScore: this.calculateSecurityScore(securityMetrics),
      qualityScore: qualityMetrics.averageScore,
      governanceScore: this.calculateOverallGovernanceScore({
        compliance: complianceMetrics.averageScore,
        security: this.calculateSecurityScore(securityMetrics),
        quality: qualityMetrics.averageScore
      })
    };
    
    const metrics: GovernanceMetrics = {
      timestamp,
      overall,
      compliance: {
        frameworkScores: complianceMetrics.frameworkScores,
        totalAssessments: complianceMetrics.totalAssessments,
        passedAssessments: complianceMetrics.passedAssessments,
        overduePolicies: policyMetrics.overduePolicies,
        activeViolations: complianceMetrics.activeViolations
      },
      security: {
        vulnerabilities: securityMetrics.vulnerabilities,
        accessViolations: securityMetrics.accessControl.deniedRequests,
        containerIssues: securityMetrics.containerSecurity.misconfigurations,
        secretsExposed: securityMetrics.containerSecurity.secretsDetected
      },
      qualityGates: {
        totalExecutions: qualityMetrics.totalExecutions,
        passRate: qualityMetrics.passRate,
        averageExecutionTime: qualityMetrics.averageExecutionTime,
        blockedDeployments: qualityMetrics.blockedDeployments
      },
      policies: {
        totalPolicies: policyMetrics.totalPolicies,
        activePolicies: policyMetrics.activePolicies,
        violatedPolicies: policyMetrics.violatedPolicies,
        exemptedPolicies: policyMetrics.exemptedPolicies
      }
    };
    
    this.metrics.push(metrics);
    this.emit('metricsCollected', metrics);
    
    return metrics;
  }

  /**
   * Audit Logging
   */
  async logAuditEvent(
    action: string,
    actor: AuditLogEntry['actor'],
    resource: AuditLogEntry['resource'],
    outcome: AuditLogEntry['outcome'],
    details: Record<string, any> = {},
    metadata: AuditLogEntry['metadata'] = {}
  ): Promise<string> {
    const auditId = crypto.randomUUID();
    
    const auditEntry: AuditLogEntry = {
      id: auditId,
      timestamp: new Date(),
      actor,
      action,
      resource,
      outcome,
      details,
      metadata,
      compliance: {
        relevant: this.isComplianceRelevant(action, resource),
        frameworks: this.getRelevantFrameworks(action, resource),
        retention: this.getRetentionPeriod(action, resource)
      }
    };
    
    this.auditLog.push(auditEntry);
    
    // Trigger compliance tracking if relevant
    if (auditEntry.compliance.relevant) {
      await this.complianceService.trackAuditEvent({
        user: actor.id,
        action,
        resource,
        details,
        complianceRelevant: true,
        frameworks: auditEntry.compliance.frameworks,
        classification: this.classifyData(details),
        retention: auditEntry.compliance.retention
      });
    }
    
    this.emit('auditEventLogged', auditEntry);
    
    return auditId;
  }

  async getAuditLog(
    filters: {
      startDate?: Date;
      endDate?: Date;
      actor?: string;
      action?: string;
      resource?: string;
      outcome?: string;
    } = {},
    pagination: { limit: number; offset: number } = { limit: 100, offset: 0 }
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    let filteredLog = [...this.auditLog];
    
    // Apply filters
    if (filters.startDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp <= filters.endDate!);
    }
    if (filters.actor) {
      filteredLog = filteredLog.filter(entry => entry.actor.id === filters.actor);
    }
    if (filters.action) {
      filteredLog = filteredLog.filter(entry => entry.action.includes(filters.action!));
    }
    if (filters.resource) {
      filteredLog = filteredLog.filter(entry => entry.resource.id === filters.resource);
    }
    if (filters.outcome) {
      filteredLog = filteredLog.filter(entry => entry.outcome === filters.outcome);
    }
    
    // Sort by timestamp (newest first)
    filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply pagination
    const total = filteredLog.length;
    const entries = filteredLog.slice(pagination.offset, pagination.offset + pagination.limit);
    
    return { entries, total };
  }

  // Private methods

  private async startMonitoringConfig(configId: string, config: MonitoringConfig): Promise<void> {
    if (config.type === 'real-time' || config.type === 'scheduled') {
      // Start periodic monitoring
      const interval = this.parseInterval(config.metrics[0]?.frequency || '5m');
      
      const timer = setInterval(async () => {
        try {
          await this.executeMonitoringConfig(configId, config);
        } catch (error) {
          console.error(`Monitoring config ${configId} failed:`, error);
        }
      }, interval);
      
      this.activeMonitors.set(configId, timer);
    }
  }

  private async executeMonitoringConfig(configId: string, config: MonitoringConfig): Promise<void> {
    // Collect metrics
    for (const metric of config.metrics) {
      try {
        const value = await this.collectMetric(metric);
        
        // Check thresholds and generate alerts if needed
        if (metric.thresholds) {
          await this.checkMetricThresholds(configId, metric, value);
        }
        
      } catch (error) {
        console.error(`Failed to collect metric ${metric.name}:`, error);
      }
    }
  }

  private async collectMetric(metric: MonitoringConfigSchema['_output']['metrics'][0]): Promise<number> {
    // Collect metric from various sources
    switch (metric.source) {
      case 'compliance':
        return await this.getComplianceMetric(metric.name);
      case 'security':
        return await this.getSecurityMetric(metric.name);
      case 'quality-gates':
        return await this.getQualityMetric(metric.name);
      case 'policies':
        return await this.getPolicyMetric(metric.name);
      default:
        return 0;
    }
  }

  private async checkMetricThresholds(
    configId: string,
    metric: MonitoringConfigSchema['_output']['metrics'][0],
    value: number
  ): Promise<void> {
    const thresholds = metric.thresholds;
    if (!thresholds) return;

    let severity: Alert['severity'] | null = null;
    let description = '';

    if (thresholds.critical && value >= thresholds.critical) {
      severity = 'critical';
      description = `${metric.name} is ${value}, exceeding critical threshold of ${thresholds.critical}`;
    } else if (thresholds.warning && value >= thresholds.warning) {
      severity = 'warning';
      description = `${metric.name} is ${value}, exceeding warning threshold of ${thresholds.warning}`;
    }

    if (severity) {
      await this.createAlert(
        'policy-violation',
        severity,
        `Threshold exceeded: ${metric.name}`,
        description,
        { service: 'monitoring', component: configId },
        { metric: metric.name, value, thresholds }
      );
    }
  }

  private startMetricsCollection(): void {
    // Collect governance metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectGovernanceMetrics();
      } catch (error) {
        console.error('Failed to collect governance metrics:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async populateDashboardData(dashboard: Dashboard): Promise<Dashboard> {
    // Clone dashboard to avoid modifying original
    const dashboardWithData = JSON.parse(JSON.stringify(dashboard));

    // Populate widget data
    for (const widget of dashboardWithData.widgets) {
      try {
        const data = await this.getWidgetData(widget);
        widget.config.data = data;
      } catch (error) {
        console.error(`Failed to populate widget ${widget.id}:`, error);
        widget.config.data = { error: error.message };
      }
    }

    return dashboardWithData;
  }

  private async getWidgetData(widget: DashboardWidget): Promise<any> {
    switch (widget.type) {
      case 'metric':
        return await this.getMetricWidgetData(widget);
      case 'chart':
        return await this.getChartWidgetData(widget);
      case 'table':
        return await this.getTableWidgetData(widget);
      case 'alert-list':
        return await this.getAlertListWidgetData(widget);
      case 'trend':
        return await this.getTrendWidgetData(widget);
      case 'compliance-score':
        return await this.getComplianceScoreWidgetData(widget);
      default:
        return {};
    }
  }

  private async getMetricWidgetData(widget: DashboardWidget): Promise<any> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return { value: 0 };

    const dataSource = widget.config.dataSource;
    switch (dataSource) {
      case 'governance.overall.complianceScore':
        return { value: latestMetrics.overall.complianceScore };
      case 'governance.overall.securityScore':
        return { value: latestMetrics.overall.securityScore };
      case 'governance.overall.qualityScore':
        return { value: latestMetrics.overall.qualityScore };
      default:
        return { value: 0 };
    }
  }

  private async getChartWidgetData(widget: DashboardWidget): Promise<any> {
    const timeRange = this.getTimeRange(widget.config.options?.timeRange || '24h');
    const metrics = this.metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);

    return {
      labels: metrics.map(m => m.timestamp.toISOString()),
      datasets: [{
        label: widget.title,
        data: metrics.map(m => this.extractMetricValue(m, widget.config.dataSource))
      }]
    };
  }

  private async getTableWidgetData(widget: DashboardWidget): Promise<any> {
    // Return table data based on widget configuration
    return {
      columns: ['Name', 'Status', 'Score', 'Last Updated'],
      rows: [
        ['Security Policy', 'Active', '95', '2024-01-15'],
        ['Compliance Check', 'Warning', '82', '2024-01-14'],
        ['Quality Gate', 'Passed', '88', '2024-01-15']
      ]
    };
  }

  private async getAlertListWidgetData(widget: DashboardWidget): Promise<any> {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      alerts: activeAlerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        createdAt: alert.createdAt,
        source: alert.source
      }))
    };
  }

  private async getTrendWidgetData(widget: DashboardWidget): Promise<any> {
    const timeRange = this.getTimeRange(widget.config.options?.timeRange || '7d');
    const metrics = this.metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);

    return {
      trend: {
        current: metrics[metrics.length - 1]?.overall.governanceScore || 0,
        previous: metrics[0]?.overall.governanceScore || 0,
        change: this.calculateTrendChange(metrics, widget.config.dataSource)
      }
    };
  }

  private async getComplianceScoreWidgetData(widget: DashboardWidget): Promise<any> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return { scores: {} };

    return {
      scores: latestMetrics.compliance.frameworkScores,
      overall: latestMetrics.overall.complianceScore
    };
  }

  private async getApplicableChannels(type: Alert['type'], severity: Alert['severity']): Promise<string[]> {
    // Get channels based on alert type and severity
    const channels = Array.from(this.notificationChannels.values())
      .filter(channel => channel.enabled)
      .map(channel => channel.id);

    return channels;
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    for (const channelId of alert.channels) {
      try {
        const channel = this.notificationChannels.get(channelId);
        if (channel && channel.enabled) {
          await this.sendNotification(channel, alert);
        }
      } catch (error) {
        console.error(`Failed to send notification to channel ${channelId}:`, error);
      }
    }
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Send notification based on channel type
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      default:
        console.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would integrate with email service
    console.log(`Sending email notification for alert ${alert.id}`);
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would integrate with Slack API
    console.log(`Sending Slack notification for alert ${alert.id}`);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would send HTTP webhook
    console.log(`Sending webhook notification for alert ${alert.id}`);
  }

  private async scheduleAlertEscalation(alert: Alert): Promise<void> {
    const rules = Array.from(this.alertRules.values())
      .filter(rule => rule.enabled);

    for (const rule of rules) {
      if (rule.escalation.levels.length > 0) {
        // Schedule escalation levels
        for (const level of rule.escalation.levels) {
          setTimeout(async () => {
            if (alert.status === 'active') {
              await this.escalateAlert(alert, level);
            }
          }, level.after * 1000);
        }
      }
    }
  }

  private async escalateAlert(alert: Alert, level: { after: number; channels: string[] }): Promise<void> {
    alert.escalationLevel++;
    
    // Send escalation notifications
    for (const channelId of level.channels) {
      const channel = this.notificationChannels.get(channelId);
      if (channel) {
        await this.sendNotification(channel, alert);
      }
    }

    this.emit('alertEscalated', { alert, level });
  }

  private async collectReportData(type: Report['type'], filters: Record<string, any>): Promise<ReportData> {
    const latestMetrics = await this.collectGovernanceMetrics();
    
    switch (type) {
      case 'executive':
        return this.generateExecutiveReportData(latestMetrics, filters);
      case 'compliance':
        return this.generateComplianceReportData(latestMetrics, filters);
      case 'security':
        return this.generateSecurityReportData(latestMetrics, filters);
      case 'operational':
        return this.generateOperationalReportData(latestMetrics, filters);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private generateExecutiveReportData(metrics: GovernanceMetrics, filters: Record<string, any>): ReportData {
    return {
      summary: {
        overallScore: metrics.overall.governanceScore,
        complianceScore: metrics.overall.complianceScore,
        securityScore: metrics.overall.securityScore,
        qualityScore: metrics.overall.qualityScore,
        totalViolations: metrics.compliance.activeViolations + metrics.security.accessViolations,
        blockedDeployments: metrics.qualityGates.blockedDeployments
      },
      metrics: {
        compliance: metrics.compliance,
        security: metrics.security,
        qualityGates: metrics.qualityGates
      },
      trends: this.generateTrends(['governanceScore', 'complianceScore', 'securityScore']),
      findings: this.generateKeyFindings(metrics),
      charts: [
        {
          type: 'donut',
          title: 'Overall Governance Score',
          data: {
            labels: ['Compliance', 'Security', 'Quality'],
            values: [metrics.overall.complianceScore, metrics.overall.securityScore, metrics.overall.qualityScore]
          }
        }
      ],
      tables: [
        {
          title: 'Compliance Framework Scores',
          columns: ['Framework', 'Score', 'Status'],
          rows: Object.entries(metrics.compliance.frameworkScores).map(([framework, score]) => [
            framework,
            score.toString(),
            score >= 80 ? 'Compliant' : 'Non-compliant'
          ])
        }
      ]
    };
  }

  private generateComplianceReportData(metrics: GovernanceMetrics, filters: Record<string, any>): ReportData {
    return {
      summary: {
        overallCompliance: metrics.overall.complianceScore,
        totalAssessments: metrics.compliance.totalAssessments,
        passedAssessments: metrics.compliance.passedAssessments,
        activeViolations: metrics.compliance.activeViolations
      },
      metrics: metrics.compliance,
      trends: this.generateTrends(['complianceScore']),
      findings: this.generateComplianceFindings(metrics),
      charts: [
        {
          type: 'bar',
          title: 'Framework Compliance Scores',
          data: {
            labels: Object.keys(metrics.compliance.frameworkScores),
            values: Object.values(metrics.compliance.frameworkScores)
          }
        }
      ],
      tables: [
        {
          title: 'Active Violations',
          columns: ['Violation', 'Severity', 'Framework', 'Status'],
          rows: [] // Would be populated with actual violation data
        }
      ]
    };
  }

  private generateSecurityReportData(metrics: GovernanceMetrics, filters: Record<string, any>): ReportData {
    return {
      summary: {
        securityScore: metrics.overall.securityScore,
        totalVulnerabilities: Object.values(metrics.security.vulnerabilities).reduce((sum, count) => sum + count, 0),
        criticalVulnerabilities: metrics.security.vulnerabilities.critical,
        accessViolations: metrics.security.accessViolations
      },
      metrics: metrics.security,
      trends: this.generateTrends(['securityScore']),
      findings: this.generateSecurityFindings(metrics),
      charts: [
        {
          type: 'bar',
          title: 'Vulnerability Distribution',
          data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            values: [
              metrics.security.vulnerabilities.critical,
              metrics.security.vulnerabilities.high,
              metrics.security.vulnerabilities.medium,
              metrics.security.vulnerabilities.low
            ]
          }
        }
      ],
      tables: [
        {
          title: 'Top Vulnerabilities',
          columns: ['CVE ID', 'Severity', 'Component', 'Status'],
          rows: [] // Would be populated with actual vulnerability data
        }
      ]
    };
  }

  private generateOperationalReportData(metrics: GovernanceMetrics, filters: Record<string, any>): ReportData {
    return {
      summary: {
        totalQualityGateExecutions: metrics.qualityGates.totalExecutions,
        qualityGatePassRate: metrics.qualityGates.passRate,
        averageExecutionTime: metrics.qualityGates.averageExecutionTime,
        blockedDeployments: metrics.qualityGates.blockedDeployments
      },
      metrics: {
        qualityGates: metrics.qualityGates,
        policies: metrics.policies
      },
      trends: this.generateTrends(['qualityScore']),
      findings: this.generateOperationalFindings(metrics),
      charts: [
        {
          type: 'line',
          title: 'Quality Gate Success Rate',
          data: {
            labels: this.getTimeLabels('7d'),
            values: this.getQualityGateTrend()
          }
        }
      ],
      tables: [
        {
          title: 'Policy Summary',
          columns: ['Category', 'Total', 'Active', 'Violated'],
          rows: [
            ['Security', '25', '23', '2'],
            ['Compliance', '18', '18', '0'],
            ['Quality', '12', '11', '1']
          ]
        }
      ]
    };
  }

  private getReportTemplate(type: Report['type'], format: Report['format']): string {
    // Return appropriate template based on type and format
    return `template-${type}-${format}`;
  }

  private scheduleReportGeneration(reportId: string, config: Omit<Report, 'id' | 'data' | 'metadata'>): void {
    // Implementation would use cron-like scheduling
    console.log(`Scheduling report generation for ${reportId}`);
  }

  private async collectComplianceMetrics(): Promise<{
    averageScore: number;
    frameworkScores: Record<ComplianceFramework, number>;
    totalAssessments: number;
    passedAssessments: number;
    activeViolations: number;
  }> {
    // Simulate compliance metrics collection
    return {
      averageScore: 85,
      frameworkScores: {
        [ComplianceFramework.GDPR]: 88,
        [ComplianceFramework.HIPAA]: 82,
        [ComplianceFramework.SOC2]: 90,
        [ComplianceFramework.PCI_DSS]: 78,
        [ComplianceFramework.ISO27001]: 85,
        [ComplianceFramework.NIST]: 87,
        [ComplianceFramework.CIS]: 83
      },
      totalAssessments: 12,
      passedAssessments: 10,
      activeViolations: 3
    };
  }

  private async collectQualityMetrics(): Promise<{
    averageScore: number;
    totalExecutions: number;
    passRate: number;
    averageExecutionTime: number;
    blockedDeployments: number;
  }> {
    const dashboard = await this.qualityGatesService.getQualityGatesDashboard();
    
    return {
      averageScore: 82,
      totalExecutions: dashboard.overview.totalExecutions,
      passRate: dashboard.overview.successRate,
      averageExecutionTime: dashboard.overview.averageExecutionTime,
      blockedDeployments: dashboard.overview.blockedDeployments
    };
  }

  private async collectPolicyMetrics(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    violatedPolicies: number;
    exemptedPolicies: number;
    overduePolicies: number;
  }> {
    const policyMetrics = this.policyEngine.getEvaluationMetrics();
    
    return {
      totalPolicies: policyMetrics.totalPolicies,
      activePolicies: Math.floor(policyMetrics.totalPolicies * 0.9),
      violatedPolicies: Math.floor(policyMetrics.totalPolicies * 0.1),
      exemptedPolicies: Math.floor(policyMetrics.totalPolicies * 0.05),
      overduePolicies: Math.floor(policyMetrics.totalPolicies * 0.03)
    };
  }

  private calculateSecurityScore(securityMetrics: SecurityMetrics): number {
    // Calculate security score based on various factors
    let score = 100;
    
    score -= securityMetrics.vulnerabilities.critical * 20;
    score -= securityMetrics.vulnerabilities.high * 10;
    score -= securityMetrics.vulnerabilities.medium * 5;
    score -= Math.min(20, (securityMetrics.accessControl.deniedRequests / securityMetrics.accessControl.totalRequests) * 100);
    
    return Math.max(0, Math.round(score));
  }

  private calculateOverallGovernanceScore(scores: {
    compliance: number;
    security: number;
    quality: number;
  }): number {
    // Weighted average
    const weights = { compliance: 0.4, security: 0.4, quality: 0.2 };
    
    return Math.round(
      scores.compliance * weights.compliance +
      scores.security * weights.security +
      scores.quality * weights.quality
    );
  }

  private parseInterval(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 5 * 60 * 1000; // 5 minutes default
    }
  }

  private async getComplianceMetric(metricName: string): Promise<number> {
    // Return specific compliance metric
    const metrics = await this.collectComplianceMetrics();
    
    switch (metricName) {
      case 'compliance-score': return metrics.averageScore;
      case 'active-violations': return metrics.activeViolations;
      case 'passed-assessments': return metrics.passedAssessments;
      default: return 0;
    }
  }

  private async getSecurityMetric(metricName: string): Promise<number> {
    const securityMetrics = await this.securityService.generateSecurityMetrics();
    
    switch (metricName) {
      case 'critical-vulnerabilities': return securityMetrics.vulnerabilities.critical;
      case 'access-violations': return securityMetrics.accessControl.deniedRequests;
      case 'security-score': return this.calculateSecurityScore(securityMetrics);
      default: return 0;
    }
  }

  private async getQualityMetric(metricName: string): Promise<number> {
    const qualityMetrics = await this.collectQualityMetrics();
    
    switch (metricName) {
      case 'quality-gate-pass-rate': return qualityMetrics.passRate;
      case 'blocked-deployments': return qualityMetrics.blockedDeployments;
      case 'execution-time': return qualityMetrics.averageExecutionTime;
      default: return 0;
    }
  }

  private async getPolicyMetric(metricName: string): Promise<number> {
    const policyMetrics = await this.collectPolicyMetrics();
    
    switch (metricName) {
      case 'violated-policies': return policyMetrics.violatedPolicies;
      case 'active-policies': return policyMetrics.activePolicies;
      case 'overdue-policies': return policyMetrics.overduePolicies;
      default: return 0;
    }
  }

  private getTimeRange(range: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    const unit = range.slice(-1);
    const value = parseInt(range.slice(0, -1));
    
    switch (unit) {
      case 'h':
        start.setHours(end.getHours() - value);
        break;
      case 'd':
        start.setDate(end.getDate() - value);
        break;
      case 'w':
        start.setDate(end.getDate() - (value * 7));
        break;
      case 'm':
        start.setMonth(end.getMonth() - value);
        break;
      default:
        start.setDate(end.getDate() - 1); // Default 1 day
    }
    
    return { start, end };
  }

  private extractMetricValue(metrics: GovernanceMetrics, dataSource: string): number {
    // Extract metric value from governance metrics based on data source path
    const path = dataSource.split('.');
    let value: any = metrics;
    
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return 0;
      }
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private calculateTrendChange(metrics: GovernanceMetrics[], dataSource: string): number {
    if (metrics.length < 2) return 0;
    
    const latest = this.extractMetricValue(metrics[metrics.length - 1], dataSource);
    const previous = this.extractMetricValue(metrics[0], dataSource);
    
    if (previous === 0) return 0;
    
    return Math.round(((latest - previous) / previous) * 100);
  }

  private generateTrends(metricNames: string[]): ReportData['trends'] {
    const timeRange = this.getTimeRange('7d');
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= timeRange.start);
    
    return metricNames.map(metricName => ({
      metric: metricName,
      timeRange: '7d',
      values: relevantMetrics.map(m => ({
        timestamp: m.timestamp,
        value: this.extractMetricValue(m, `overall.${metricName}`)
      }))
    }));
  }

  private generateKeyFindings(metrics: GovernanceMetrics): ReportData['findings'] {
    const findings: ReportData['findings'] = [];
    
    if (metrics.overall.complianceScore < 80) {
      findings.push({
        category: 'compliance',
        severity: 'high',
        description: `Compliance score of ${metrics.overall.complianceScore}% is below target of 80%`,
        recommendation: 'Review and address compliance violations across all frameworks'
      });
    }
    
    if (metrics.security.vulnerabilities.critical > 0) {
      findings.push({
        category: 'security',
        severity: 'critical',
        description: `${metrics.security.vulnerabilities.critical} critical vulnerabilities detected`,
        recommendation: 'Immediately address all critical vulnerabilities before next deployment'
      });
    }
    
    return findings;
  }

  private generateComplianceFindings(metrics: GovernanceMetrics): ReportData['findings'] {
    return Object.entries(metrics.compliance.frameworkScores)
      .filter(([, score]) => score < 80)
      .map(([framework, score]) => ({
        category: 'compliance',
        severity: score < 60 ? 'high' : 'medium',
        description: `${framework} compliance score of ${score}% is below target`,
        recommendation: `Review ${framework} requirements and implement missing controls`
      }));
  }

  private generateSecurityFindings(metrics: GovernanceMetrics): ReportData['findings'] {
    const findings: ReportData['findings'] = [];
    
    if (metrics.security.vulnerabilities.critical > 0) {
      findings.push({
        category: 'security',
        severity: 'critical',
        description: `${metrics.security.vulnerabilities.critical} critical vulnerabilities`,
        recommendation: 'Patch critical vulnerabilities immediately'
      });
    }
    
    if (metrics.security.accessViolations > 10) {
      findings.push({
        category: 'security',
        severity: 'medium',
        description: `${metrics.security.accessViolations} access violations detected`,
        recommendation: 'Review access control policies and user permissions'
      });
    }
    
    return findings;
  }

  private generateOperationalFindings(metrics: GovernanceMetrics): ReportData['findings'] {
    const findings: ReportData['findings'] = [];
    
    if (metrics.qualityGates.passRate < 90) {
      findings.push({
        category: 'quality',
        severity: 'medium',
        description: `Quality gate pass rate of ${metrics.qualityGates.passRate}% is below target`,
        recommendation: 'Review failing quality gates and improve code quality practices'
      });
    }
    
    if (metrics.qualityGates.blockedDeployments > 5) {
      findings.push({
        category: 'operations',
        severity: 'high',
        description: `${metrics.qualityGates.blockedDeployments} deployments blocked by quality gates`,
        recommendation: 'Address quality gate failures to improve deployment success rate'
      });
    }
    
    return findings;
  }

  private getTimeLabels(range: string): string[] {
    // Generate time labels for charts
    const labels = [];
    const timeRange = this.getTimeRange(range);
    const current = new Date(timeRange.start);
    
    while (current <= timeRange.end) {
      labels.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return labels;
  }

  private getQualityGateTrend(): number[] {
    // Generate quality gate trend data
    return [88, 85, 92, 89, 91, 87, 90];
  }

  private isComplianceRelevant(action: string, resource: AuditLogEntry['resource']): boolean {
    const complianceActions = ['policy-created', 'policy-updated', 'compliance-scan', 'access-denied', 'vulnerability-detected'];
    const complianceResources = ['policy', 'compliance-report', 'security-scan', 'access-control'];
    
    return complianceActions.some(a => action.includes(a)) || 
           complianceResources.some(r => resource.type.includes(r));
  }

  private getRelevantFrameworks(action: string, resource: AuditLogEntry['resource']): ComplianceFramework[] {
    // Determine which compliance frameworks are relevant
    const frameworks: ComplianceFramework[] = [];
    
    if (action.includes('data') || resource.type.includes('data')) {
      frameworks.push(ComplianceFramework.GDPR);
    }
    
    if (action.includes('security') || resource.type.includes('security')) {
      frameworks.push(ComplianceFramework.SOC2, ComplianceFramework.ISO27001);
    }
    
    return frameworks;
  }

  private getRetentionPeriod(action: string, resource: AuditLogEntry['resource']): number {
    // Determine retention period based on action and resource type
    if (this.isComplianceRelevant(action, resource)) {
      return 2555; // 7 years for compliance-relevant events
    }
    
    return 365; // 1 year for regular events
  }

  private classifyData(details: Record<string, any>): 'public' | 'internal' | 'confidential' | 'restricted' {
    // Classify data based on content
    if (details.sensitive || details.personal) return 'confidential';
    if (details.security || details.compliance) return 'internal';
    return 'public';
  }

  private initializeDefaultConfigurations(): void {
    // Initialize default monitoring configurations
    const defaultMonitoringConfig: MonitoringConfig = {
      id: 'governance-monitoring',
      name: 'Governance Monitoring',
      type: 'real-time',
      category: 'governance',
      metrics: [
        {
          name: 'compliance-score',
          source: 'compliance',
          thresholds: { warning: 80, critical: 70 },
          aggregation: 'avg',
          timeWindow: '5m',
          frequency: '1m'
        },
        {
          name: 'security-score',
          source: 'security',
          thresholds: { warning: 75, critical: 60 },
          aggregation: 'avg',
          timeWindow: '5m',
          frequency: '1m'
        }
      ],
      alerts: [
        {
          id: 'compliance-critical',
          condition: 'compliance-score < 70',
          severity: 'critical',
          channels: ['email', 'slack'],
          cooldown: 3600
        }
      ],
      dashboards: ['executive-dashboard', 'compliance-dashboard'],
      retention: 90,
      enabled: true
    };

    this.monitoringConfigs.set(defaultMonitoringConfig.id, defaultMonitoringConfig);

    // Initialize default dashboards
    const executiveDashboard: Dashboard = {
      id: 'executive-dashboard',
      name: 'Executive Governance Dashboard',
      description: 'High-level governance metrics for executives',
      category: 'executive',
      audience: 'executives',
      layout: { columns: 12, rows: 8, responsive: true },
      widgets: [
        {
          id: 'overall-score',
          type: 'metric',
          title: 'Overall Governance Score',
          position: { x: 0, y: 0, width: 3, height: 2 },
          config: {
            dataSource: 'governance.overall.governanceScore',
            visualization: 'gauge',
            options: { min: 0, max: 100, unit: '%' }
          },
          thresholds: { warning: 80, critical: 70 }
        },
        {
          id: 'compliance-trend',
          type: 'chart',
          title: 'Compliance Score Trend',
          position: { x: 3, y: 0, width: 6, height: 3 },
          config: {
            dataSource: 'governance.overall.complianceScore',
            visualization: 'line',
            options: { timeRange: '30d' }
          }
        },
        {
          id: 'active-alerts',
          type: 'alert-list',
          title: 'Active Alerts',
          position: { x: 9, y: 0, width: 3, height: 4 },
          config: {
            dataSource: 'alerts',
            visualization: 'list',
            options: { limit: 5 }
          }
        }
      ],
      filters: [
        {
          name: 'timeRange',
          type: 'select',
          options: ['24h', '7d', '30d', '90d'],
          default: '7d'
        }
      ],
      refreshInterval: 300, // 5 minutes
      permissions: {
        view: ['executives', 'managers'],
        edit: ['administrators']
      },
      metadata: {
        owner: 'system',
        created: new Date(),
        lastModified: new Date(),
        version: '1.0.0'
      }
    };

    this.dashboards.set(executiveDashboard.id, executiveDashboard);

    // Initialize default notification channels
    const emailChannel: NotificationChannel = {
      id: 'email-alerts',
      name: 'Email Alerts',
      type: 'email',
      config: {
        smtpServer: 'smtp.company.com',
        from: 'governance@company.com'
      },
      enabled: true
    };

    this.notificationChannels.set(emailChannel.id, emailChannel);
  }
}