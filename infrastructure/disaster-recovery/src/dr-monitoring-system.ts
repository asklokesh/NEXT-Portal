/**
 * Disaster Recovery Monitoring and Alerting System
 * Comprehensive monitoring, metrics collection, and alerting for all DR components
 */

import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as cron from 'node-cron';
import { Logger } from './logger';
import { MetricsCollector } from './metrics-collector';
import { AlertManager } from './alert-manager';
import { DashboardManager } from './dashboard-manager';
import { ReportGenerator } from './report-generator';

interface MonitoringConfiguration {
  targets: Record<string, MonitoringTarget>;
  alert_routing: AlertRouting;
  receivers: Record<string, NotificationReceiver>;
  alert_rules: Record<string, AlertRule[]>;
  dashboards: Record<string, DashboardConfig>;
  reporting: ReportingConfig;
  integrations: IntegrationConfig;
}

interface MonitoringTarget {
  metrics: MetricDefinition[];
  thresholds: Record<string, string>;
}

interface MetricDefinition {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: string[];
}

interface AlertRule {
  name: string;
  condition: string;
  for: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface MonitoringEvent {
  id: string;
  timestamp: Date;
  type: 'metric_threshold' | 'alert_triggered' | 'system_health' | 'performance_issue';
  severity: 'critical' | 'high' | 'medium' | 'low';
  component: string;
  message: string;
  metrics: Record<string, any>;
  metadata: any;
}

interface SystemHealth {
  overall_health: number;
  component_health: Record<string, ComponentHealth>;
  active_alerts: number;
  critical_alerts: number;
  last_updated: Date;
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  availability: number;
  response_time: number;
  error_rate: number;
  last_check: Date;
  issues: string[];
}

export class DRMonitoringSystem extends EventEmitter {
  private config: MonitoringConfiguration;
  private logger: Logger;
  
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private dashboardManager: DashboardManager;
  private reportGenerator: ReportGenerator;
  
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private activeAlerts: Map<string, MonitoringEvent> = new Map();
  private alertHistory: MonitoringEvent[] = [];
  private systemHealth: SystemHealth;
  
  private metricsCache: Map<string, any> = new Map();
  private thresholdViolations: Map<string, Date> = new Map();

  constructor(configPath: string) {
    super();
    this.logger = new Logger('DRMonitoringSystem');
    this.loadConfiguration(configPath);
    this.initializeServices();
    this.initializeSystemHealth();
  }

  private loadConfiguration(configPath: string): void {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.load(configContent) as MonitoringConfiguration;
      this.logger.info('DR monitoring configuration loaded successfully', { configPath });
    } catch (error) {
      this.logger.error('Failed to load DR monitoring configuration', { error, configPath });
      throw error;
    }
  }

  private initializeServices(): void {
    this.metricsCollector = new MetricsCollector(this.config, this.logger);
    this.alertManager = new AlertManager(this.config.alert_routing, this.config.receivers, this.logger);
    this.dashboardManager = new DashboardManager(this.config.dashboards, this.config.integrations, this.logger);
    this.reportGenerator = new ReportGenerator(this.config.reporting, this.logger);
  }

  private initializeSystemHealth(): void {
    this.systemHealth = {
      overall_health: 100,
      component_health: {},
      active_alerts: 0,
      critical_alerts: 0,
      last_updated: new Date()
    };

    // Initialize component health for all monitored targets
    Object.keys(this.config.targets).forEach(targetName => {
      this.systemHealth.component_health[targetName] = {
        status: 'unknown',
        availability: 100,
        response_time: 0,
        error_rate: 0,
        last_check: new Date(),
        issues: []
      };
    });
  }

  public async start(): Promise<void> {
    this.logger.info('Starting DR Monitoring System...');

    try {
      // Start service components
      await Promise.all([
        this.metricsCollector.start(),
        this.alertManager.start(),
        this.dashboardManager.start(),
        this.reportGenerator.start()
      ]);

      // Start metrics collection
      await this.startMetricsCollection();

      // Start alert evaluation
      await this.startAlertEvaluation();

      // Schedule regular tasks
      this.scheduleRegularTasks();

      // Register event handlers
      this.registerEventHandlers();

      // Perform initial health check
      await this.performInitialHealthCheck();

      this.logger.info('DR Monitoring System started successfully');

    } catch (error) {
      this.logger.error('Failed to start DR Monitoring System', { error: error.message });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping DR Monitoring System...');

    // Stop scheduled tasks
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      this.logger.debug('Stopped scheduled task', { name });
    });
    this.scheduledTasks.clear();

    // Stop service components
    await Promise.all([
      this.metricsCollector.stop(),
      this.alertManager.stop(),
      this.dashboardManager.stop(),
      this.reportGenerator.stop()
    ]);

    this.logger.info('DR Monitoring System stopped successfully');
  }

  private async startMetricsCollection(): Promise<void> {
    this.logger.info('Starting metrics collection...');

    // Collect backup operation metrics
    const backupMetricsTask = cron.schedule('* * * * *', async () => {
      try {
        await this.collectBackupMetrics();
      } catch (error) {
        this.logger.error('Failed to collect backup metrics', { error: error.message });
      }
    });

    this.scheduledTasks.set('backup_metrics', backupMetricsTask);
    backupMetricsTask.start();

    // Collect DR operation metrics
    const drMetricsTask = cron.schedule('*/2 * * * *', async () => {
      try {
        await this.collectDRMetrics();
      } catch (error) {
        this.logger.error('Failed to collect DR metrics', { error: error.message });
      }
    });

    this.scheduledTasks.set('dr_metrics', drMetricsTask);
    drMetricsTask.start();

    // Collect business continuity metrics
    const bcpMetricsTask = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.collectBCPMetrics();
      } catch (error) {
        this.logger.error('Failed to collect BCP metrics', { error: error.message });
      }
    });

    this.scheduledTasks.set('bcp_metrics', bcpMetricsTask);
    bcpMetricsTask.start();

    // Collect point-in-time recovery metrics
    const pitrMetricsTask = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.collectPITRMetrics();
      } catch (error) {
        this.logger.error('Failed to collect PITR metrics', { error: error.message });
      }
    });

    this.scheduledTasks.set('pitr_metrics', pitrMetricsTask);
    pitrMetricsTask.start();

    this.logger.info('Metrics collection started successfully');
  }

  private async startAlertEvaluation(): Promise<void> {
    this.logger.info('Starting alert evaluation...');

    // Evaluate alert rules every minute
    const alertEvaluationTask = cron.schedule('* * * * *', async () => {
      try {
        await this.evaluateAlertRules();
      } catch (error) {
        this.logger.error('Failed to evaluate alert rules', { error: error.message });
      }
    });

    this.scheduledTasks.set('alert_evaluation', alertEvaluationTask);
    alertEvaluationTask.start();

    // Update system health every 5 minutes
    const healthUpdateTask = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.updateSystemHealth();
      } catch (error) {
        this.logger.error('Failed to update system health', { error: error.message });
      }
    });

    this.scheduledTasks.set('health_update', healthUpdateTask);
    healthUpdateTask.start();

    this.logger.info('Alert evaluation started successfully');
  }

  private async collectBackupMetrics(): Promise<void> {
    try {
      // Collect metrics from backup orchestrator
      const backupMetrics = await this.metricsCollector.collectFromEndpoint(
        'http://backup-orchestrator:8081/metrics'
      );

      // Process and cache backup metrics
      this.processBackupMetrics(backupMetrics);

      // Update component health
      this.updateComponentHealth('backup_operations', backupMetrics);

    } catch (error) {
      this.logger.warn('Failed to collect backup metrics', { error: error.message });
      this.markComponentUnhealthy('backup_operations', error.message);
    }
  }

  private async collectDRMetrics(): Promise<void> {
    try {
      // Collect metrics from DR orchestrator
      const drMetrics = await this.metricsCollector.collectFromEndpoint(
        'http://dr-orchestrator:8081/metrics'
      );

      // Process and cache DR metrics
      this.processDRMetrics(drMetrics);

      // Update component health
      this.updateComponentHealth('disaster_recovery', drMetrics);

    } catch (error) {
      this.logger.warn('Failed to collect DR metrics', { error: error.message });
      this.markComponentUnhealthy('disaster_recovery', error.message);
    }
  }

  private async collectBCPMetrics(): Promise<void> {
    try {
      // Collect metrics from business continuity manager
      const bcpMetrics = await this.metricsCollector.collectFromEndpoint(
        'http://business-continuity-manager:8081/metrics'
      );

      // Process and cache BCP metrics
      this.processBCPMetrics(bcpMetrics);

      // Update component health
      this.updateComponentHealth('business_continuity', bcpMetrics);

    } catch (error) {
      this.logger.warn('Failed to collect BCP metrics', { error: error.message });
      this.markComponentUnhealthy('business_continuity', error.message);
    }
  }

  private async collectPITRMetrics(): Promise<void> {
    try {
      // Collect point-in-time recovery metrics
      const pitrMetrics = await this.metricsCollector.collectPITRMetrics();

      // Process and cache PITR metrics
      this.processPITRMetrics(pitrMetrics);

      // Update component health
      this.updateComponentHealth('point_in_time_recovery', pitrMetrics);

    } catch (error) {
      this.logger.warn('Failed to collect PITR metrics', { error: error.message });
      this.markComponentUnhealthy('point_in_time_recovery', error.message);
    }
  }

  private processBackupMetrics(metrics: any): void {
    // Process backup job duration
    if (metrics.backup_job_duration_seconds) {
      this.metricsCache.set('backup_job_duration', metrics.backup_job_duration_seconds);
    }

    // Process backup success rate
    if (metrics.backup_job_success_rate) {
      this.metricsCache.set('backup_success_rate', metrics.backup_job_success_rate);
    }

    // Process backup size
    if (metrics.backup_size_bytes) {
      this.metricsCache.set('backup_size', metrics.backup_size_bytes);
    }

    // Process storage utilization
    if (metrics.backup_storage_utilization_percent) {
      this.metricsCache.set('storage_utilization', metrics.backup_storage_utilization_percent);
    }
  }

  private processDRMetrics(metrics: any): void {
    // Process failover duration
    if (metrics.dr_failover_duration_seconds) {
      this.metricsCache.set('failover_duration', metrics.dr_failover_duration_seconds);
    }

    // Process RTO/RPO metrics
    if (metrics.dr_rto_seconds) {
      this.metricsCache.set('actual_rto', metrics.dr_rto_seconds);
    }

    if (metrics.dr_rpo_seconds) {
      this.metricsCache.set('actual_rpo', metrics.dr_rpo_seconds);
    }

    // Process replication lag
    if (metrics.replication_lag_seconds) {
      this.metricsCache.set('replication_lag', metrics.replication_lag_seconds);
    }
  }

  private processBCPMetrics(metrics: any): void {
    // Process incident response time
    if (metrics.incident_response_time_seconds) {
      this.metricsCache.set('incident_response_time', metrics.incident_response_time_seconds);
    }

    // Process SLA metrics
    if (metrics.sla_availability_percent) {
      this.metricsCache.set('sla_availability', metrics.sla_availability_percent);
    }

    if (metrics.sla_response_time_milliseconds) {
      this.metricsCache.set('sla_response_time', metrics.sla_response_time_milliseconds);
    }

    // Process active incidents
    if (metrics.active_incidents_count) {
      this.metricsCache.set('active_incidents', metrics.active_incidents_count);
    }
  }

  private processPITRMetrics(metrics: any): void {
    // Process recovery point count
    if (metrics.recovery_point_count) {
      this.metricsCache.set('recovery_points', metrics.recovery_point_count);
    }

    // Process timeline confidence
    if (metrics.recovery_timeline_confidence_score) {
      this.metricsCache.set('timeline_confidence', metrics.recovery_timeline_confidence_score);
    }

    // Process recovery success rate
    if (metrics.recovery_success_rate) {
      this.metricsCache.set('recovery_success_rate', metrics.recovery_success_rate);
    }
  }

  private updateComponentHealth(component: string, metrics: any): void {
    const health = this.systemHealth.component_health[component];
    if (!health) return;

    health.last_check = new Date();
    health.status = 'healthy';
    health.issues = [];

    // Update based on component-specific metrics
    switch (component) {
      case 'backup_operations':
        this.updateBackupComponentHealth(health, metrics);
        break;
      case 'disaster_recovery':
        this.updateDRComponentHealth(health, metrics);
        break;
      case 'business_continuity':
        this.updateBCPComponentHealth(health, metrics);
        break;
      case 'point_in_time_recovery':
        this.updatePITRComponentHealth(health, metrics);
        break;
    }
  }

  private updateBackupComponentHealth(health: ComponentHealth, metrics: any): void {
    // Check backup success rate
    if (metrics.backup_job_success_rate && metrics.backup_job_success_rate < 0.95) {
      health.status = 'degraded';
      health.issues.push(`Low backup success rate: ${(metrics.backup_job_success_rate * 100).toFixed(1)}%`);
    }

    // Check storage utilization
    if (metrics.backup_storage_utilization_percent && metrics.backup_storage_utilization_percent > 80) {
      if (metrics.backup_storage_utilization_percent > 90) {
        health.status = 'unhealthy';
      } else if (health.status === 'healthy') {
        health.status = 'degraded';
      }
      health.issues.push(`High storage utilization: ${metrics.backup_storage_utilization_percent.toFixed(1)}%`);
    }

    health.availability = metrics.backup_job_success_rate ? metrics.backup_job_success_rate * 100 : 100;
    health.error_rate = metrics.backup_job_success_rate ? (1 - metrics.backup_job_success_rate) * 100 : 0;
  }

  private updateDRComponentHealth(health: ComponentHealth, metrics: any): void {
    // Check replication lag
    if (metrics.replication_lag_seconds && metrics.replication_lag_seconds > 300) {
      health.status = 'degraded';
      health.issues.push(`High replication lag: ${metrics.replication_lag_seconds}s`);
    }

    // Check RTO/RPO violations
    if (metrics.rto_violation || metrics.rpo_violation) {
      health.status = 'unhealthy';
      if (metrics.rto_violation) health.issues.push('RTO violation detected');
      if (metrics.rpo_violation) health.issues.push('RPO violation detected');
    }

    health.availability = metrics.dr_site_availability || 100;
    health.response_time = metrics.dr_failover_duration_seconds || 0;
  }

  private updateBCPComponentHealth(health: ComponentHealth, metrics: any): void {
    // Check incident response time
    if (metrics.incident_response_time_seconds && metrics.incident_response_time_seconds > 1800) {
      health.status = 'degraded';
      health.issues.push(`Slow incident response: ${Math.round(metrics.incident_response_time_seconds / 60)}min`);
    }

    // Check SLA breaches
    if (metrics.sla_availability_percent && metrics.sla_availability_percent < 99.5) {
      health.status = 'unhealthy';
      health.issues.push(`SLA availability breach: ${metrics.sla_availability_percent.toFixed(2)}%`);
    }

    // Check active critical incidents
    if (metrics.critical_incidents_count && metrics.critical_incidents_count > 0) {
      health.status = 'unhealthy';
      health.issues.push(`${metrics.critical_incidents_count} critical incidents active`);
    }

    health.availability = metrics.sla_availability_percent || 100;
    health.response_time = metrics.sla_response_time_p95 || 0;
  }

  private updatePITRComponentHealth(health: ComponentHealth, metrics: any): void {
    // Check recovery timeline confidence
    if (metrics.recovery_timeline_confidence_score && metrics.recovery_timeline_confidence_score < 60) {
      health.status = 'unhealthy';
      health.issues.push(`Low timeline confidence: ${metrics.recovery_timeline_confidence_score}%`);
    } else if (metrics.recovery_timeline_confidence_score && metrics.recovery_timeline_confidence_score < 80) {
      health.status = 'degraded';
      health.issues.push(`Moderate timeline confidence: ${metrics.recovery_timeline_confidence_score}%`);
    }

    // Check recovery point gaps
    if (metrics.recovery_point_gaps && metrics.recovery_point_gaps > 0) {
      health.status = 'degraded';
      health.issues.push(`${metrics.recovery_point_gaps} recovery point gaps detected`);
    }

    health.availability = metrics.recovery_success_rate ? metrics.recovery_success_rate * 100 : 100;
  }

  private markComponentUnhealthy(component: string, reason: string): void {
    const health = this.systemHealth.component_health[component];
    if (health) {
      health.status = 'unhealthy';
      health.last_check = new Date();
      health.issues = [reason];
      health.availability = 0;
    }
  }

  private async evaluateAlertRules(): Promise<void> {
    for (const [category, rules] of Object.entries(this.config.alert_rules)) {
      for (const rule of rules) {
        try {
          const shouldAlert = await this.evaluateAlertRule(rule);
          
          if (shouldAlert) {
            await this.triggerAlert(rule, category);
          } else {
            await this.resolveAlert(rule.name);
          }

        } catch (error) {
          this.logger.error('Failed to evaluate alert rule', {
            rule: rule.name,
            error: error.message
          });
        }
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    try {
      // Parse and evaluate the rule condition
      const result = await this.evaluateCondition(rule.condition);
      
      if (result) {
        // Check if alert should fire based on 'for' duration
        const alertKey = rule.name;
        const firstViolation = this.thresholdViolations.get(alertKey);
        
        if (!firstViolation) {
          this.thresholdViolations.set(alertKey, new Date());
          return false;
        }
        
        const violationDuration = Date.now() - firstViolation.getTime();
        const forDuration = this.parseDuration(rule.for);
        
        return violationDuration >= forDuration;
      } else {
        // Clear violation tracking if condition is no longer met
        this.thresholdViolations.delete(rule.name);
        return false;
      }

    } catch (error) {
      this.logger.warn('Failed to evaluate alert condition', {
        rule: rule.name,
        condition: rule.condition,
        error: error.message
      });
      return false;
    }
  }

  private async evaluateCondition(condition: string): Promise<boolean> {
    // Simplified condition evaluation
    // In production, this would integrate with Prometheus or similar query engine
    
    // Parse conditions like "backup_job_success_rate < 0.9"
    const parts = condition.split(/\s+(>|<|>=|<=|==|!=)\s+/);
    if (parts.length !== 3) {
      return false;
    }

    const [metricName, operator, threshold] = parts;
    const metricValue = this.getMetricValue(metricName);
    
    if (metricValue === null || metricValue === undefined) {
      return false;
    }

    const thresholdValue = parseFloat(threshold);
    
    switch (operator) {
      case '>':
        return metricValue > thresholdValue;
      case '<':
        return metricValue < thresholdValue;
      case '>=':
        return metricValue >= thresholdValue;
      case '<=':
        return metricValue <= thresholdValue;
      case '==':
        return metricValue === thresholdValue;
      case '!=':
        return metricValue !== thresholdValue;
      default:
        return false;
    }
  }

  private getMetricValue(metricName: string): number | null {
    // Get metric value from cache
    const value = this.metricsCache.get(metricName);
    return typeof value === 'number' ? value : null;
  }

  private parseDuration(duration: string): number {
    // Parse duration strings like "5m", "1h", "30s"
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 0;
    }
  }

  private async triggerAlert(rule: AlertRule, category: string): Promise<void> {
    const alertId = this.generateAlertId(rule.name);
    
    // Check if alert is already active
    if (this.activeAlerts.has(alertId)) {
      return;
    }

    const alertEvent: MonitoringEvent = {
      id: alertId,
      timestamp: new Date(),
      type: 'alert_triggered',
      severity: rule.severity,
      component: category,
      message: rule.annotations.summary || rule.name,
      metrics: this.gatherAlertMetrics(rule),
      metadata: {
        rule_name: rule.name,
        condition: rule.condition,
        labels: rule.labels,
        annotations: rule.annotations
      }
    };

    this.activeAlerts.set(alertId, alertEvent);
    this.alertHistory.push(alertEvent);

    // Keep alert history manageable
    if (this.alertHistory.length > 10000) {
      this.alertHistory = this.alertHistory.slice(-10000);
    }

    // Send alert notification
    await this.alertManager.sendAlert(alertEvent);

    // Emit alert event
    this.emit('alert_triggered', alertEvent);

    this.logger.warn('Alert triggered', {
      alertId,
      rule: rule.name,
      severity: rule.severity,
      message: alertEvent.message
    });

    // Update system health
    this.updateSystemHealthForAlert(alertEvent);
  }

  private async resolveAlert(ruleName: string): Promise<void> {
    const alertId = this.generateAlertId(ruleName);
    const alertEvent = this.activeAlerts.get(alertId);
    
    if (alertEvent) {
      // Mark alert as resolved
      alertEvent.metadata.resolved_at = new Date();
      alertEvent.metadata.duration = Date.now() - alertEvent.timestamp.getTime();

      this.activeAlerts.delete(alertId);

      // Send resolution notification
      await this.alertManager.resolveAlert(alertEvent);

      // Emit resolution event
      this.emit('alert_resolved', alertEvent);

      this.logger.info('Alert resolved', {
        alertId,
        rule: ruleName,
        duration: alertEvent.metadata.duration
      });
    }
  }

  private gatherAlertMetrics(rule: AlertRule): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    // Extract metric names from condition and gather their current values
    const metricNames = this.extractMetricNamesFromCondition(rule.condition);
    
    metricNames.forEach(metricName => {
      const value = this.getMetricValue(metricName);
      if (value !== null) {
        metrics[metricName] = value;
      }
    });

    return metrics;
  }

  private extractMetricNamesFromCondition(condition: string): string[] {
    // Extract metric names from conditions
    // This is a simplified implementation
    const matches = condition.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    return matches ? matches.filter(match => !['and', 'or', 'not'].includes(match)) : [];
  }

  private updateSystemHealthForAlert(alertEvent: MonitoringEvent): void {
    // Update active alert counts
    this.systemHealth.active_alerts = this.activeAlerts.size;
    this.systemHealth.critical_alerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.severity === 'critical').length;

    // Recalculate overall health
    this.calculateOverallHealth();

    this.systemHealth.last_updated = new Date();
  }

  private async updateSystemHealth(): Promise<void> {
    // Update active alert counts
    this.systemHealth.active_alerts = this.activeAlerts.size;
    this.systemHealth.critical_alerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.severity === 'critical').length;

    // Calculate overall health based on component health
    this.calculateOverallHealth();

    this.systemHealth.last_updated = new Date();

    // Emit system health update
    this.emit('system_health_updated', this.systemHealth);
  }

  private calculateOverallHealth(): void {
    const components = Object.values(this.systemHealth.component_health);
    if (components.length === 0) {
      this.systemHealth.overall_health = 100;
      return;
    }

    let totalHealth = 0;
    let healthyComponents = 0;

    components.forEach(component => {
      switch (component.status) {
        case 'healthy':
          totalHealth += 100;
          healthyComponents++;
          break;
        case 'degraded':
          totalHealth += 70;
          healthyComponents++;
          break;
        case 'unhealthy':
          totalHealth += 30;
          healthyComponents++;
          break;
        case 'unknown':
          totalHealth += 50;
          healthyComponents++;
          break;
      }
    });

    this.systemHealth.overall_health = healthyComponents > 0 ? totalHealth / healthyComponents : 0;

    // Apply penalty for critical alerts
    if (this.systemHealth.critical_alerts > 0) {
      this.systemHealth.overall_health = Math.max(0, this.systemHealth.overall_health - (this.systemHealth.critical_alerts * 20));
    }
  }

  private scheduleRegularTasks(): void {
    // Daily health report
    const dailyReportTask = cron.schedule('0 8 * * *', async () => {
      try {
        await this.generateDailyHealthReport();
      } catch (error) {
        this.logger.error('Failed to generate daily health report', { error: error.message });
      }
    });

    this.scheduledTasks.set('daily_health_report', dailyReportTask);
    dailyReportTask.start();

    // Weekly metrics cleanup
    const cleanupTask = cron.schedule('0 2 * * 0', async () => {
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        this.logger.error('Failed to cleanup old metrics', { error: error.message });
      }
    });

    this.scheduledTasks.set('weekly_cleanup', cleanupTask);
    cleanupTask.start();

    // Dashboard updates
    const dashboardUpdateTask = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.updateDashboards();
      } catch (error) {
        this.logger.error('Failed to update dashboards', { error: error.message });
      }
    });

    this.scheduledTasks.set('dashboard_updates', dashboardUpdateTask);
    dashboardUpdateTask.start();

    this.logger.info('Scheduled regular monitoring tasks', { 
      taskCount: this.scheduledTasks.size 
    });
  }

  private registerEventHandlers(): void {
    // Handle metrics collector events
    this.metricsCollector.on('metrics_collected', (data) => {
      this.emit('metrics_updated', data);
    });

    this.metricsCollector.on('collection_failed', (error) => {
      this.logger.warn('Metrics collection failed', error);
    });

    // Handle alert manager events
    this.alertManager.on('notification_sent', (data) => {
      this.logger.info('Alert notification sent', data);
    });

    this.alertManager.on('notification_failed', (error) => {
      this.logger.error('Alert notification failed', error);
    });
  }

  private async performInitialHealthCheck(): Promise<void> {
    this.logger.info('Performing initial monitoring system health check...');

    try {
      // Check all monitoring targets
      const healthChecks = Object.keys(this.config.targets).map(target =>
        this.checkTargetHealth(target)
      );

      const results = await Promise.allSettled(healthChecks);
      
      let healthyTargets = 0;
      results.forEach((result, index) => {
        const targetName = Object.keys(this.config.targets)[index];
        
        if (result.status === 'fulfilled') {
          healthyTargets++;
          this.logger.debug('Target health check passed', { target: targetName });
        } else {
          this.logger.warn('Target health check failed', {
            target: targetName,
            error: result.reason
          });
        }
      });

      const healthPercentage = (healthyTargets / results.length) * 100;
      this.logger.info('Initial health check completed', {
        healthPercentage: `${healthPercentage.toFixed(1)}%`,
        healthyTargets,
        totalTargets: results.length
      });

    } catch (error) {
      this.logger.error('Initial health check failed', { error: error.message });
    }
  }

  private async checkTargetHealth(targetName: string): Promise<boolean> {
    // Check if target endpoints are accessible and returning expected metrics
    try {
      switch (targetName) {
        case 'backup_operations':
          await this.metricsCollector.collectFromEndpoint('http://backup-orchestrator:8081/metrics');
          return true;
        case 'disaster_recovery':
          await this.metricsCollector.collectFromEndpoint('http://dr-orchestrator:8081/metrics');
          return true;
        case 'business_continuity':
          await this.metricsCollector.collectFromEndpoint('http://business-continuity-manager:8081/metrics');
          return true;
        case 'point_in_time_recovery':
          // PITR metrics are collected internally
          return true;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  private async generateDailyHealthReport(): Promise<void> {
    const report = {
      date: new Date().toISOString().split('T')[0],
      overall_health: this.systemHealth.overall_health,
      component_health: this.systemHealth.component_health,
      alerts_summary: {
        total_alerts: this.alertHistory.filter(a => 
          a.timestamp.toDateString() === new Date().toDateString()
        ).length,
        critical_alerts: this.systemHealth.critical_alerts,
        active_alerts: this.systemHealth.active_alerts
      },
      metrics_summary: this.summarizeMetrics()
    };

    await this.reportGenerator.generateHealthReport(report);
    this.logger.info('Daily health report generated');
  }

  private async cleanupOldMetrics(): Promise<void> {
    // Clean up old alert history (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > thirtyDaysAgo);

    // Clean up old threshold violations
    for (const [key, timestamp] of this.thresholdViolations) {
      if (timestamp < thirtyDaysAgo) {
        this.thresholdViolations.delete(key);
      }
    }

    this.logger.info('Old metrics cleaned up', {
      alertHistorySize: this.alertHistory.length,
      thresholdViolationsSize: this.thresholdViolations.size
    });
  }

  private async updateDashboards(): Promise<void> {
    try {
      await this.dashboardManager.updateAllDashboards(this.systemHealth, this.metricsCache);
    } catch (error) {
      this.logger.warn('Failed to update dashboards', { error: error.message });
    }
  }

  private summarizeMetrics(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [key, value] of this.metricsCache) {
      if (typeof value === 'number') {
        summary[key] = value;
      }
    }
    
    return summary;
  }

  private generateAlertId(ruleName: string): string {
    return `alert-${ruleName}-${Date.now()}`;
  }

  // Public API methods
  public getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  public getActiveAlerts(): MonitoringEvent[] {
    return Array.from(this.activeAlerts.values());
  }

  public getAlertHistory(limit: number = 100): MonitoringEvent[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getMetrics(): Record<string, any> {
    return Object.fromEntries(this.metricsCache);
  }

  public async getComponentStatus(component: string): Promise<ComponentHealth | null> {
    return this.systemHealth.component_health[component] || null;
  }

  public async triggerManualCheck(targetName: string): Promise<boolean> {
    this.logger.info('Triggering manual health check', { target: targetName });
    
    try {
      const isHealthy = await this.checkTargetHealth(targetName);
      
      if (isHealthy) {
        // Collect metrics for the target
        switch (targetName) {
          case 'backup_operations':
            await this.collectBackupMetrics();
            break;
          case 'disaster_recovery':
            await this.collectDRMetrics();
            break;
          case 'business_continuity':
            await this.collectBCPMetrics();
            break;
          case 'point_in_time_recovery':
            await this.collectPITRMetrics();
            break;
        }
      }
      
      return isHealthy;
    } catch (error) {
      this.logger.error('Manual health check failed', { target: targetName, error: error.message });
      return false;
    }
  }

  public getMonitoringStatus(): any {
    return {
      system_health: this.systemHealth,
      active_alerts: this.activeAlerts.size,
      scheduled_tasks: Array.from(this.scheduledTasks.keys()),
      metrics_count: this.metricsCache.size,
      last_updated: new Date()
    };
  }
}

// Additional interface definitions
interface AlertRouting {
  routes: any[];
}

interface NotificationReceiver {
  channels: any[];
}

interface DashboardConfig {
  title: string;
  panels: any[];
}

interface ReportingConfig {
  scheduled_reports: any[];
}

interface IntegrationConfig {
  prometheus: any;
  grafana: any;
  alertmanager: any;
}