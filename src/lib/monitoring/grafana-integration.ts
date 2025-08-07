import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'monitoring.log' })
  ]
});

// Grafana API schemas
export const GrafanaDashboardSchema = z.object({
  id: z.number().optional(),
  uid: z.string().optional(),
  title: z.string(),
  tags: z.array(z.string()).default([]),
  timezone: z.string().default('browser'),
  panels: z.array(z.any()).default([]),
  time: z.object({
    from: z.string().default('now-1h'),
    to: z.string().default('now')
  }).default({}),
  refresh: z.string().default('5s'),
  version: z.number().default(0),
  editable: z.boolean().default(true)
});

export const GrafanaDataSourceSchema = z.object({
  name: z.string(),
  type: z.string(),
  url: z.string(),
  access: z.enum(['proxy', 'direct']).default('proxy'),
  basicAuth: z.boolean().default(false),
  basicAuthUser: z.string().optional(),
  basicAuthPassword: z.string().optional(),
  jsonData: z.record(z.any()).default({}),
  secureJsonData: z.record(z.string()).default({})
});

export const AlertRuleSchema = z.object({
  uid: z.string().optional(),
  title: z.string(),
  condition: z.string(),
  data: z.array(z.any()),
  noDataState: z.enum(['NoData', 'Alerting', 'OK']).default('NoData'),
  execErrState: z.enum(['Alerting', 'OK']).default('Alerting'),
  for: z.string().default('5m'),
  annotations: z.record(z.string()).default({}),
  labels: z.record(z.string()).default({}),
  folderUID: z.string().optional()
});

export type GrafanaDashboard = z.infer<typeof GrafanaDashboardSchema>;
export type GrafanaDataSource = z.infer<typeof GrafanaDataSourceSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;

interface GrafanaConfig {
  baseUrl: string;
  apiKey: string;
  orgId?: number;
  timeout?: number;
}

export class GrafanaIntegration {
  private client: axios.AxiosInstance;
  private config: GrafanaConfig;

  constructor(config: GrafanaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.baseUrl}/api`,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.orgId && { 'X-Grafana-Org-Id': config.orgId.toString() })
      },
      timeout: config.timeout || 30000
    });

    // Request/Response interceptors for logging and error handling
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Grafana API Request', {
          method: config.method,
          url: config.url,
          timestamp: new Date().toISOString()
        });
        return config;
      },
      (error) => {
        logger.error('Grafana API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('Grafana API Response', {
          status: response.status,
          url: response.config.url,
          timestamp: new Date().toISOString()
        });
        return response;
      },
      (error) => {
        logger.error('Grafana API Response Error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  // Dashboard Management
  async createDashboard(dashboard: GrafanaDashboard): Promise<{ id: number; uid: string; url: string }> {
    try {
      const validatedDashboard = GrafanaDashboardSchema.parse(dashboard);
      const response: AxiosResponse = await this.client.post('/dashboards/db', {
        dashboard: validatedDashboard,
        overwrite: false
      });
      
      logger.info('Dashboard created successfully', {
        dashboardId: response.data.id,
        uid: response.data.uid
      });

      return {
        id: response.data.id,
        uid: response.data.uid,
        url: response.data.url
      };
    } catch (error) {
      logger.error('Failed to create dashboard', { error: error.message });
      throw new Error(`Failed to create dashboard: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateDashboard(uid: string, dashboard: GrafanaDashboard): Promise<{ id: number; uid: string; url: string }> {
    try {
      const validatedDashboard = GrafanaDashboardSchema.parse(dashboard);
      const response: AxiosResponse = await this.client.post('/dashboards/db', {
        dashboard: {
          ...validatedDashboard,
          uid
        },
        overwrite: true
      });
      
      return {
        id: response.data.id,
        uid: response.data.uid,
        url: response.data.url
      };
    } catch (error) {
      logger.error('Failed to update dashboard', { uid, error: error.message });
      throw new Error(`Failed to update dashboard: ${error.response?.data?.message || error.message}`);
    }
  }

  async getDashboard(uid: string): Promise<GrafanaDashboard> {
    try {
      const response: AxiosResponse = await this.client.get(`/dashboards/uid/${uid}`);
      return response.data.dashboard;
    } catch (error) {
      logger.error('Failed to get dashboard', { uid, error: error.message });
      throw new Error(`Failed to get dashboard: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteDashboard(uid: string): Promise<void> {
    try {
      await this.client.delete(`/dashboards/uid/${uid}`);
      logger.info('Dashboard deleted successfully', { uid });
    } catch (error) {
      logger.error('Failed to delete dashboard', { uid, error: error.message });
      throw new Error(`Failed to delete dashboard: ${error.response?.data?.message || error.message}`);
    }
  }

  async listDashboards(query?: string, tag?: string[]): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (tag) tag.forEach(t => params.append('tag', t));

      const response: AxiosResponse = await this.client.get(`/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to list dashboards', { error: error.message });
      throw new Error(`Failed to list dashboards: ${error.response?.data?.message || error.message}`);
    }
  }

  // Data Source Management
  async createDataSource(dataSource: GrafanaDataSource): Promise<{ id: number; name: string }> {
    try {
      const validatedDataSource = GrafanaDataSourceSchema.parse(dataSource);
      const response: AxiosResponse = await this.client.post('/datasources', validatedDataSource);
      
      logger.info('Data source created successfully', {
        id: response.data.id,
        name: response.data.name
      });

      return {
        id: response.data.id,
        name: response.data.name
      };
    } catch (error) {
      logger.error('Failed to create data source', { error: error.message });
      throw new Error(`Failed to create data source: ${error.response?.data?.message || error.message}`);
    }
  }

  async testDataSource(dataSource: GrafanaDataSource): Promise<{ status: string; message: string }> {
    try {
      const validatedDataSource = GrafanaDataSourceSchema.parse(dataSource);
      const response: AxiosResponse = await this.client.post('/datasources/test', validatedDataSource);
      
      return {
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      logger.error('Data source test failed', { error: error.message });
      throw new Error(`Data source test failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Alert Management
  async createAlertRule(rule: AlertRule): Promise<{ uid: string }> {
    try {
      const validatedRule = AlertRuleSchema.parse(rule);
      const response: AxiosResponse = await this.client.post('/ruler/grafana/api/v1/rules/backstage', {
        rules: [validatedRule]
      });
      
      logger.info('Alert rule created successfully', { uid: response.data.uid });
      return { uid: response.data.uid };
    } catch (error) {
      logger.error('Failed to create alert rule', { error: error.message });
      throw new Error(`Failed to create alert rule: ${error.response?.data?.message || error.message}`);
    }
  }

  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const response: AxiosResponse = await this.client.get('/ruler/grafana/api/v1/rules');
      return response.data.backstage?.rules || [];
    } catch (error) {
      logger.error('Failed to get alert rules', { error: error.message });
      throw new Error(`Failed to get alert rules: ${error.response?.data?.message || error.message}`);
    }
  }

  // Metrics and Annotations
  async addAnnotation(dashboardUID: string, annotation: {
    time: number;
    timeEnd?: number;
    text: string;
    tags?: string[];
  }): Promise<{ id: number }> {
    try {
      const response: AxiosResponse = await this.client.post('/annotations', {
        dashboardUID,
        ...annotation
      });
      
      return { id: response.data.id };
    } catch (error) {
      logger.error('Failed to add annotation', { error: error.message });
      throw new Error(`Failed to add annotation: ${error.response?.data?.message || error.message}`);
    }
  }

  async queryMetrics(query: string, start: number, end: number, step = 15): Promise<any> {
    try {
      const response: AxiosResponse = await this.client.get('/prometheus/api/v1/query_range', {
        params: {
          query,
          start,
          end,
          step
        }
      });
      
      return response.data.data;
    } catch (error) {
      logger.error('Failed to query metrics', { error: error.message });
      throw new Error(`Failed to query metrics: ${error.response?.data?.message || error.message}`);
    }
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; version: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/health');
      return {
        status: 'healthy',
        version: response.data.version
      };
    } catch (error) {
      logger.error('Grafana health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        version: 'unknown'
      };
    }
  }

  // Utility Methods
  async exportDashboard(uid: string): Promise<GrafanaDashboard> {
    const dashboard = await this.getDashboard(uid);
    // Remove runtime properties for export
    const { id, version, ...exportDashboard } = dashboard;
    return exportDashboard;
  }

  async importDashboard(dashboard: GrafanaDashboard, overwrite = false): Promise<{ id: number; uid: string; url: string }> {
    const cleanDashboard = { ...dashboard };
    delete cleanDashboard.id;
    delete cleanDashboard.version;
    
    if (overwrite && dashboard.uid) {
      return this.updateDashboard(dashboard.uid, cleanDashboard);
    } else {
      return this.createDashboard(cleanDashboard);
    }
  }

  // Batch operations
  async createMultipleDashboards(dashboards: GrafanaDashboard[]): Promise<Array<{ id: number; uid: string; url: string; title: string }>> {
    const results = [];
    
    for (const dashboard of dashboards) {
      try {
        const result = await this.createDashboard(dashboard);
        results.push({
          ...result,
          title: dashboard.title
        });
        
        // Add small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Failed to create dashboard in batch', {
          title: dashboard.title,
          error: error.message
        });
        // Continue with other dashboards
      }
    }
    
    return results;
  }
}

// Default Grafana configuration from environment
export function createGrafanaClient(): GrafanaIntegration {
  const config: GrafanaConfig = {
    baseUrl: process.env.GRAFANA_URL || 'http://localhost:3000',
    apiKey: process.env.GRAFANA_API_KEY || '',
    orgId: process.env.GRAFANA_ORG_ID ? parseInt(process.env.GRAFANA_ORG_ID) : undefined,
    timeout: 30000
  };

  if (!config.apiKey) {
    throw new Error('GRAFANA_API_KEY environment variable is required');
  }

  return new GrafanaIntegration(config);
}

export default GrafanaIntegration;