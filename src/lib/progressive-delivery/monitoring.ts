import { EventEmitter } from 'events';
import axios from 'axios';
import { ProgressiveDeployment, MetricResult, MetricQuery, ProgressiveDeliveryEvent } from './types';

export class DeploymentMonitor extends EventEmitter {
  private activeMonitors = new Map<string, MonitoringSession>();
  private prometheusClient: PrometheusClient;
  private grafanaClient: GrafanaClient;

  constructor() {
    super();
    this.prometheusClient = new PrometheusClient();
    this.grafanaClient = new GrafanaClient();
  }

  async startMonitoring(deployment: ProgressiveDeployment): Promise<void> {
    const session = this.createMonitoringSession(deployment);
    this.activeMonitors.set(deployment.id, session);
    
    // Start metric collection
    await this.startMetricCollection(deployment);
    
    // Create Grafana dashboard
    await this.createGrafanaDashboard(deployment);
    
    // Setup alerts
    await this.setupAlerts(deployment);
    
    this.emit('monitoringStarted', { deployment, session });
  }

  async stopMonitoring(deploymentId: string): Promise<void> {
    const session = this.activeMonitors.get(deploymentId);
    if (session) {
      clearInterval(session.metricCollectionInterval);
      this.activeMonitors.delete(deploymentId);
    }
    
    this.emit('monitoringStopped', { deploymentId });
  }

  async getMetrics(deployment: ProgressiveDeployment): Promise<MetricResult[]> {
    const session = this.activeMonitors.get(deployment.id);
    if (!session) {
      throw new Error('Monitoring session not found');
    }
    
    return session.currentMetrics;
  }

  async evaluateMetrics(deployment: ProgressiveDeployment, metricQueries: MetricQuery[]): Promise<MetricResult[]> {
    const results: MetricResult[] = [];
    
    for (const query of metricQueries) {
      try {
        const result = await this.executeMetricQuery(deployment, query);
        results.push(result);
      } catch (error) {
        results.push({
          name: query.name,
          value: 0,
          threshold: query.threshold,
          status: 'unknown',
          timestamp: new Date()
        });
      }
    }
    
    return results;
  }

  async getEvents(deploymentId: string): Promise<ProgressiveDeliveryEvent[]> {
    const session = this.activeMonitors.get(deploymentId);
    return session?.events || [];
  }

  private createMonitoringSession(deployment: ProgressiveDeployment): MonitoringSession {
    return {
      deploymentId: deployment.id,
      startTime: new Date(),
      currentMetrics: [],
      events: [],
      dashboardUrl: '',
      alertRules: []
    };
  }

  private async startMetricCollection(deployment: ProgressiveDeployment): Promise<void> {
    const session = this.activeMonitors.get(deployment.id);
    if (!session) return;
    
    // Collect metrics every 30 seconds
    session.metricCollectionInterval = setInterval(async () => {
      try {
        const metrics = await this.evaluateMetrics(deployment, deployment.config.analysis.metrics);
        session.currentMetrics = metrics;
        
        // Check for failures and emit events
        for (const metric of metrics) {
          if (metric.status === 'failure') {
            this.emit('metricFailed', { deployment, metric });
            
            const event: ProgressiveDeliveryEvent = {
              id: `event-${Date.now()}`,
              deploymentId: deployment.id,
              type: 'phase_failed',
              timestamp: new Date(),
              data: { metric },
              metadata: {
                triggeredBy: 'monitoring',
                automated: true
              }
            };
            
            session.events.push(event);
          }
        }
      } catch (error) {
        console.error('Metric collection failed:', error);
      }
    }, 30000);
  }

  private async executeMetricQuery(deployment: ProgressiveDeployment, query: MetricQuery): Promise<MetricResult> {
    let value: number;
    
    switch (query.provider) {
      case 'prometheus':
        value = await this.prometheusClient.query(query.query, deployment);
        break;
      case 'datadog':
        value = await this.queryDatadog(query.query);
        break;
      case 'newrelic':
        value = await this.queryNewRelic(query.query);
        break;
      default:
        value = await this.queryCustom(query.query);
    }
    
    const status = this.evaluateMetricStatus(value, query.threshold, query.comparison);
    
    return {
      name: query.name,
      value,
      threshold: query.threshold,
      status,
      timestamp: new Date()
    };
  }

  private evaluateMetricStatus(value: number, threshold: number, comparison: string): 'success' | 'failure' | 'unknown' {
    switch (comparison) {
      case '>':
        return value > threshold ? 'success' : 'failure';
      case '<':
        return value < threshold ? 'success' : 'failure';
      case '>=':
        return value >= threshold ? 'success' : 'failure';
      case '<=':
        return value <= threshold ? 'success' : 'failure';
      case '==':
        return value === threshold ? 'success' : 'failure';
      default:
        return 'unknown';
    }
  }

  private async queryDatadog(query: string): Promise<number> {
    // Mock Datadog query
    return Math.random();
  }

  private async queryNewRelic(query: string): Promise<number> {
    // Mock New Relic query
    return Math.random();
  }

  private async queryCustom(query: string): Promise<number> {
    // Mock custom query
    return Math.random();
  }

  private async createGrafanaDashboard(deployment: ProgressiveDeployment): Promise<void> {
    const dashboard = {
      dashboard: {
        title: `Progressive Delivery - ${deployment.name}`,
        tags: ['progressive-delivery', deployment.config.service.name],
        panels: await this.generateDashboardPanels(deployment)
      }
    };
    
    const response = await this.grafanaClient.createDashboard(dashboard);
    const session = this.activeMonitors.get(deployment.id);
    if (session) {
      session.dashboardUrl = response.url;
    }
  }

  private async generateDashboardPanels(deployment: ProgressiveDeployment): Promise<any[]> {
    const { service } = deployment.config;
    
    return [
      {
        title: 'Request Rate',
        type: 'graph',
        targets: [{
          expr: `sum(rate(http_requests_total{service="${service.name}"}[5m]))`
        }]
      },
      {
        title: 'Error Rate',
        type: 'graph',
        targets: [{
          expr: `sum(rate(http_requests_total{service="${service.name}", status=~"5.."}[5m])) / sum(rate(http_requests_total{service="${service.name}"}[5m]))`
        }]
      },
      {
        title: 'Response Time P99',
        type: 'graph',
        targets: [{
          expr: `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="${service.name}"}[5m])) by (le))`
        }]
      },
      {
        title: 'Traffic Split',
        type: 'piechart',
        targets: [
          {
            expr: `sum(rate(http_requests_total{service="${service.name}", version="stable"}[5m]))`,
            legendFormat: 'Stable'
          },
          {
            expr: `sum(rate(http_requests_total{service="${service.name}", version="canary"}[5m]))`,
            legendFormat: 'Canary'
          }
        ]
      }
    ];
  }

  private async setupAlerts(deployment: ProgressiveDeployment): Promise<void> {
    const alertRules = [
      {
        alert: `${deployment.name}_HighErrorRate`,
        expr: `sum(rate(http_requests_total{service="${deployment.config.service.name}", status=~"5.."}[5m])) / sum(rate(http_requests_total{service="${deployment.config.service.name}"}[5m])) > ${deployment.config.analysis.threshold}`,
        for: '1m',
        labels: {
          severity: 'critical',
          deployment: deployment.id
        },
        annotations: {
          summary: 'High error rate detected',
          description: `Error rate is above ${deployment.config.analysis.threshold * 100}%`
        }
      },
      {
        alert: `${deployment.name}_HighLatency`,
        expr: `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="${deployment.config.service.name}"}[5m])) by (le)) > 2`,
        for: '2m',
        labels: {
          severity: 'warning',
          deployment: deployment.id
        },
        annotations: {
          summary: 'High latency detected',
          description: 'P99 latency is above 2 seconds'
        }
      }
    ];
    
    const session = this.activeMonitors.get(deployment.id);
    if (session) {
      session.alertRules = alertRules;
    }
    
    // Configure alerts in Prometheus AlertManager
    await this.configureAlerts(alertRules);
  }

  private async configureAlerts(alertRules: any[]): Promise<void> {
    // Mock alert configuration
    console.log('Configuring alerts:', alertRules);
  }
}

class PrometheusClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.PROMETHEUS_URL || 'http://prometheus.monitoring.svc.cluster.local:9090';
  }
  
  async query(query: string, deployment: ProgressiveDeployment): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/query`, {
        params: { query }
      });
      
      const data = response.data.data.result;
      if (data.length > 0) {
        return parseFloat(data[0].value[1]);
      }
      
      return 0;
    } catch (error) {
      console.error('Prometheus query failed:', error);
      return 0;
    }
  }
}

class GrafanaClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.GRAFANA_URL || 'http://grafana.monitoring.svc.cluster.local:3000';
    this.apiKey = process.env.GRAFANA_API_KEY || '';
  }
  
  async createDashboard(dashboard: any): Promise<{ url: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/dashboards/db`,
        dashboard,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        url: `${this.baseUrl}/d/${response.data.uid}/${response.data.slug}`
      };
    } catch (error) {
      console.error('Grafana dashboard creation failed:', error);
      return { url: '' };
    }
  }
}

interface MonitoringSession {
  deploymentId: string;
  startTime: Date;
  currentMetrics: MetricResult[];
  events: ProgressiveDeliveryEvent[];
  dashboardUrl: string;
  alertRules: any[];
  metricCollectionInterval?: NodeJS.Timeout;
}