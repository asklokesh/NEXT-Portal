import { PrometheusQuery } from '../types';

interface PrometheusConfig {
  enabled: boolean;
  url: string;
  queries: PrometheusQuery[];
}

interface PrometheusQueryResult {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix' | 'vector' | 'scalar' | 'string';
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
  error?: string;
  errorType?: string;
}

interface PrometheusQueryRangeParams {
  query: string;
  start: Date;
  end: Date;
  step: string;
}

export class PrometheusClient {
  private config: PrometheusConfig;

  constructor(config: PrometheusConfig) {
    this.config = config;
  }

  async query(query: string, time?: Date): Promise<PrometheusQueryResult> {
    if (!this.config.enabled) {
      throw new Error('Prometheus integration is not enabled');
    }

    const params = new URLSearchParams({
      query
    });

    if (time) {
      params.append('time', (time.getTime() / 1000).toString());
    }

    try {
      const response = await fetch(`${this.config.url}/api/v1/query?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Failed to query Prometheus:', error);
      throw error;
    }
  }

  async queryRange(params: PrometheusQueryRangeParams): Promise<PrometheusQueryResult> {
    if (!this.config.enabled) {
      throw new Error('Prometheus integration is not enabled');
    }

    const queryParams = new URLSearchParams({
      query: params.query,
      start: (params.start.getTime() / 1000).toString(),
      end: (params.end.getTime() / 1000).toString(),
      step: params.step
    });

    try {
      const response = await fetch(`${this.config.url}/api/v1/query_range?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Failed to query Prometheus range:', error);
      throw error;
    }
  }

  async getLabels(): Promise<string[]> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/labels`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('Failed to get Prometheus labels:', error);
      return [];
    }
  }

  async getLabelValues(labelName: string): Promise<string[]> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/label/${labelName}/values`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('Failed to get Prometheus label values:', error);
      return [];
    }
  }

  async getSeries(matches: string[], start?: Date, end?: Date): Promise<Array<Record<string, string>>> {
    if (!this.config.enabled) return [];

    const params = new URLSearchParams();
    matches.forEach(match => params.append('match[]', match));
    
    if (start) {
      params.append('start', (start.getTime() / 1000).toString());
    }
    if (end) {
      params.append('end', (end.getTime() / 1000).toString());
    }

    try {
      const response = await fetch(`${this.config.url}/api/v1/series?${params}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('Failed to get Prometheus series:', error);
      return [];
    }
  }

  async getTargets(): Promise<Array<{
    discoveredLabels: Record<string, string>;
    labels: Record<string, string>;
    scrapePool: string;
    scrapeUrl: string;
    globalUrl: string;
    lastError: string;
    lastScrape: string;
    lastScrapeDuration: number;
    health: 'up' | 'down' | 'unknown';
  }>> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/targets`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data?.activeTargets || [];

    } catch (error) {
      console.error('Failed to get Prometheus targets:', error);
      return [];
    }
  }

  async getRules(): Promise<Array<{
    name: string;
    file: string;
    rules: Array<{
      name: string;
      query: string;
      duration: number;
      labels: Record<string, string>;
      annotations: Record<string, string>;
      alerts?: Array<{
        labels: Record<string, string>;
        annotations: Record<string, string>;
        state: 'firing' | 'pending';
        activeAt: string;
        value: string;
      }>;
      health: 'ok' | 'unknown' | 'err';
      lastError?: string;
      type: 'alerting' | 'recording';
    }>;
    interval: number;
    limit: number;
    evaluationTime: number;
    lastEvaluation: string;
  }>> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/rules`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data?.groups || [];

    } catch (error) {
      console.error('Failed to get Prometheus rules:', error);
      return [];
    }
  }

  async getAlerts(): Promise<Array<{
    labels: Record<string, string>;
    annotations: Record<string, string>;
    state: 'firing' | 'pending';
    activeAt: string;
    value: string;
  }>> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/alerts`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data?.alerts || [];

    } catch (error) {
      console.error('Failed to get Prometheus alerts:', error);
      return [];
    }
  }

  // Built-in queries for common metrics
  async getCpuUsage(instance?: string, duration = '5m'): Promise<PrometheusQueryResult> {
    const query = instance 
      ? `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[${duration}])) * 100)`
      : `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[${duration}])) * 100)`;
    
    return this.query(query);
  }

  async getMemoryUsage(instance?: string): Promise<PrometheusQueryResult> {
    const query = instance
      ? `(1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"})) * 100`
      : `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`;
    
    return this.query(query);
  }

  async getDiskUsage(instance?: string): Promise<PrometheusQueryResult> {
    const query = instance
      ? `(1 - (node_filesystem_avail_bytes{instance="${instance}",fstype!="tmpfs"} / node_filesystem_size_bytes{instance="${instance}",fstype!="tmpfs"})) * 100`
      : `(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100`;
    
    return this.query(query);
  }

  async getNetworkTraffic(instance?: string, duration = '5m'): Promise<PrometheusQueryResult> {
    const query = instance
      ? `rate(node_network_receive_bytes_total{instance="${instance}"}[${duration}])`
      : `rate(node_network_receive_bytes_total[${duration}])`;
    
    return this.query(query);
  }

  async getServiceUptime(service: string): Promise<PrometheusQueryResult> {
    return this.query(`up{job="${service}"}`);
  }

  async getHttpRequestRate(service?: string, duration = '5m'): Promise<PrometheusQueryResult> {
    const query = service
      ? `rate(http_requests_total{service="${service}"}[${duration}])`
      : `rate(http_requests_total[${duration}])`;
    
    return this.query(query);
  }

  async getHttpErrorRate(service?: string, duration = '5m'): Promise<PrometheusQueryResult> {
    const query = service
      ? `rate(http_requests_total{service="${service}",status=~"5.."}[${duration}]) / rate(http_requests_total{service="${service}"}[${duration}])`
      : `rate(http_requests_total{status=~"5.."}[${duration}]) / rate(http_requests_total[${duration}])`;
    
    return this.query(query);
  }

  async getResponseTime(service?: string, percentile = '95', duration = '5m'): Promise<PrometheusQueryResult> {
    const query = service
      ? `histogram_quantile(0.${percentile}, rate(http_request_duration_seconds_bucket{service="${service}"}[${duration}]))`
      : `histogram_quantile(0.${percentile}, rate(http_request_duration_seconds_bucket[${duration}]))`;
    
    return this.query(query);
  }

  // Utility methods
  isHealthy(): Promise<boolean> {
    if (!this.config.enabled) return Promise.resolve(false);

    return this.query('up')
      .then(() => true)
      .catch(() => false);
  }

  async getMetricNames(prefix?: string): Promise<string[]> {
    if (!this.config.enabled) return [];

    try {
      const response = await fetch(`${this.config.url}/api/v1/label/__name__/values`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const metrics = result.data || [];

      if (prefix) {
        return metrics.filter((metric: string) => metric.startsWith(prefix));
      }

      return metrics;

    } catch (error) {
      console.error('Failed to get Prometheus metric names:', error);
      return [];
    }
  }

  buildQuery(metric: string, filters?: Record<string, string>, functions?: string[]): string {
    let query = metric;

    if (filters && Object.keys(filters).length > 0) {
      const filterStr = Object.entries(filters)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');
      query += `{${filterStr}}`;
    }

    if (functions && functions.length > 0) {
      functions.forEach(func => {
        query = `${func}(${query})`;
      });
    }

    return query;
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.url;
  }

  getConfig(): PrometheusConfig {
    return { ...this.config };
  }

  getUrl(): string {
    return this.config.url;
  }
}