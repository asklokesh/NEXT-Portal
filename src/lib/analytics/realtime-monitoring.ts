/**
 * Real-time Monitoring Service
 * 
 * Provides live streaming of plugin metrics with WebSocket support
 * Handles real-time alerting and anomaly detection
 */

import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';

export interface RealtimeMetric {
  pluginId: string;
  metric: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface RealtimeAlert {
  id: string;
  pluginId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface MetricStream {
  pluginId: string;
  metrics: {
    timestamp: Date;
    values: Record<string, number>;
  }[];
}

export interface HealthCheck {
  pluginId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
}

class RealtimeMonitoringService extends EventEmitter {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private metricsBuffer: Map<string, RealtimeMetric[]> = new Map();
  private activeAlerts: Map<string, RealtimeAlert> = new Map();
  private healthStatus: Map<string, HealthCheck> = new Map();
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  
  constructor(private wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') {
    super();
    this.initializeConnection();
  }
  
  private initializeConnection(): void {
    try {
      this.socket = io(this.wsUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });
      
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.handleReconnection();
    }
  }
  
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      console.log('Real-time monitoring connected');
      
      // Re-subscribe to all active subscriptions
      this.subscriptions.forEach(pluginId => {
        this.subscribeToPlugin(pluginId);
      });
    });
    
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
      console.log('Real-time monitoring disconnected');
    });
    
    this.socket.on('metric', (data: RealtimeMetric) => {
      this.handleMetricUpdate(data);
    });
    
    this.socket.on('alert', (data: RealtimeAlert) => {
      this.handleAlert(data);
    });
    
    this.socket.on('health', (data: HealthCheck) => {
      this.handleHealthUpdate(data);
    });
    
    this.socket.on('batch-metrics', (data: RealtimeMetric[]) => {
      data.forEach(metric => this.handleMetricUpdate(metric));
    });
    
    this.socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }
  
  private handleMetricUpdate(metric: RealtimeMetric): void {
    // Buffer metrics for aggregation
    if (!this.metricsBuffer.has(metric.pluginId)) {
      this.metricsBuffer.set(metric.pluginId, []);
    }
    
    const buffer = this.metricsBuffer.get(metric.pluginId)!;
    buffer.push(metric);
    
    // Keep only last 1000 metrics per plugin
    if (buffer.length > 1000) {
      buffer.shift();
    }
    
    // Emit metric update
    this.emit('metric', metric);
    this.emit(`metric:${metric.pluginId}`, metric);
    
    // Check for threshold violations
    this.checkThresholds(metric);
  }
  
  private handleAlert(alert: RealtimeAlert): void {
    this.activeAlerts.set(alert.id, alert);
    
    // Emit alert
    this.emit('alert', alert);
    this.emit(`alert:${alert.pluginId}`, alert);
    
    // Auto-acknowledge info alerts after 5 minutes
    if (alert.severity === 'info') {
      setTimeout(() => {
        this.acknowledgeAlert(alert.id);
      }, 5 * 60 * 1000);
    }
  }
  
  private handleHealthUpdate(health: HealthCheck): void {
    this.healthStatus.set(health.pluginId, health);
    
    // Emit health update
    this.emit('health', health);
    this.emit(`health:${health.pluginId}`, health);
    
    // Check for health degradation
    if (health.status === 'unhealthy' || health.status === 'degraded') {
      this.handleAlert({
        id: `health-${health.pluginId}-${Date.now()}`,
        pluginId: health.pluginId,
        severity: health.status === 'unhealthy' ? 'critical' : 'warning',
        title: `Plugin Health ${health.status}`,
        message: `Plugin ${health.pluginId} is ${health.status}`,
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }
  
  private checkThresholds(metric: RealtimeMetric): void {
    // Example threshold checks
    const thresholds: Record<string, { critical: number; warning: number }> = {
      errorRate: { critical: 10, warning: 5 },
      responseTime: { critical: 1000, warning: 500 },
      cpuUsage: { critical: 90, warning: 80 },
      memoryUsage: { critical: 90, warning: 80 },
    };
    
    const threshold = thresholds[metric.metric];
    if (!threshold) return;
    
    let severity: 'warning' | 'critical' | null = null;
    
    if (metric.value >= threshold.critical) {
      severity = 'critical';
    } else if (metric.value >= threshold.warning) {
      severity = 'warning';
    }
    
    if (severity) {
      this.handleAlert({
        id: `threshold-${metric.pluginId}-${metric.metric}-${Date.now()}`,
        pluginId: metric.pluginId,
        severity,
        title: `${metric.metric} Threshold Exceeded`,
        message: `${metric.metric} is ${metric.value.toFixed(2)} (threshold: ${severity === 'critical' ? threshold.critical : threshold.warning})`,
        metric: metric.metric,
        value: metric.value,
        threshold: severity === 'critical' ? threshold.critical : threshold.warning,
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }
  
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max-reconnect-exceeded');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.initializeConnection();
    }, delay);
  }
  
  // Public Methods
  
  public subscribeToPlugin(pluginId: string): void {
    if (!this.socket || !this.connected) {
      console.warn('Cannot subscribe: not connected');
      return;
    }
    
    this.subscriptions.add(pluginId);
    this.socket.emit('subscribe', { pluginId });
  }
  
  public unsubscribeFromPlugin(pluginId: string): void {
    if (!this.socket || !this.connected) {
      return;
    }
    
    this.subscriptions.delete(pluginId);
    this.socket.emit('unsubscribe', { pluginId });
  }
  
  public subscribeToAllPlugins(): void {
    if (!this.socket || !this.connected) {
      console.warn('Cannot subscribe: not connected');
      return;
    }
    
    this.socket.emit('subscribe-all');
  }
  
  public getMetricsBuffer(pluginId?: string): RealtimeMetric[] {
    if (pluginId) {
      return this.metricsBuffer.get(pluginId) || [];
    }
    
    const allMetrics: RealtimeMetric[] = [];
    this.metricsBuffer.forEach(metrics => {
      allMetrics.push(...metrics);
    });
    
    return allMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  public getActiveAlerts(pluginId?: string): RealtimeAlert[] {
    const alerts = Array.from(this.activeAlerts.values());
    
    if (pluginId) {
      return alerts.filter(a => a.pluginId === pluginId);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  public acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      
      // Remove from active alerts after acknowledgment
      setTimeout(() => {
        this.activeAlerts.delete(alertId);
      }, 60000); // Keep for 1 minute after acknowledgment
    }
  }
  
  public getHealthStatus(pluginId?: string): HealthCheck | HealthCheck[] | null {
    if (pluginId) {
      return this.healthStatus.get(pluginId) || null;
    }
    
    return Array.from(this.healthStatus.values());
  }
  
  public getMetricStream(pluginId: string, metric: string, duration: number = 3600000): MetricStream {
    const metrics = this.metricsBuffer.get(pluginId) || [];
    const cutoff = Date.now() - duration;
    
    const relevantMetrics = metrics
      .filter(m => m.metric === metric && m.timestamp.getTime() > cutoff)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Group by timestamp (rounded to nearest minute)
    const grouped = new Map<number, number[]>();
    
    relevantMetrics.forEach(m => {
      const minute = Math.floor(m.timestamp.getTime() / 60000) * 60000;
      if (!grouped.has(minute)) {
        grouped.set(minute, []);
      }
      grouped.get(minute)!.push(m.value);
    });
    
    // Calculate averages
    const stream: MetricStream = {
      pluginId,
      metrics: Array.from(grouped.entries()).map(([timestamp, values]) => ({
        timestamp: new Date(timestamp),
        values: {
          [metric]: values.reduce((sum, v) => sum + v, 0) / values.length,
        },
      })),
    };
    
    return stream;
  }
  
  public getAggregatedMetrics(pluginId: string, duration: number = 3600000): Record<string, number> {
    const metrics = this.metricsBuffer.get(pluginId) || [];
    const cutoff = Date.now() - duration;
    
    const relevantMetrics = metrics.filter(m => m.timestamp.getTime() > cutoff);
    
    const aggregated: Record<string, { sum: number; count: number }> = {};
    
    relevantMetrics.forEach(m => {
      if (!aggregated[m.metric]) {
        aggregated[m.metric] = { sum: 0, count: 0 };
      }
      aggregated[m.metric].sum += m.value;
      aggregated[m.metric].count++;
    });
    
    const result: Record<string, number> = {};
    
    Object.entries(aggregated).forEach(([metric, data]) => {
      result[metric] = data.sum / data.count;
    });
    
    return result;
  }
  
  public simulateMetrics(pluginId: string): void {
    // Simulate metrics for testing
    const metrics = [
      'responseTime',
      'throughput',
      'errorRate',
      'cpuUsage',
      'memoryUsage',
      'activeConnections',
    ];
    
    setInterval(() => {
      metrics.forEach(metric => {
        const value = this.generateSimulatedValue(metric);
        const simulatedMetric: RealtimeMetric = {
          pluginId,
          metric,
          value,
          timestamp: new Date(),
        };
        
        this.handleMetricUpdate(simulatedMetric);
      });
    }, 5000);
  }
  
  private generateSimulatedValue(metric: string): number {
    const base = {
      responseTime: 100,
      throughput: 500,
      errorRate: 1,
      cpuUsage: 40,
      memoryUsage: 50,
      activeConnections: 100,
    };
    
    const variance = {
      responseTime: 50,
      throughput: 200,
      errorRate: 3,
      cpuUsage: 30,
      memoryUsage: 20,
      activeConnections: 50,
    };
    
    const baseValue = base[metric as keyof typeof base] || 50;
    const varianceValue = variance[metric as keyof typeof variance] || 10;
    
    return Math.max(0, baseValue + (Math.random() - 0.5) * 2 * varianceValue);
  }
  
  public isConnected(): boolean {
    return this.connected;
  }
  
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.metricsBuffer.clear();
    this.activeAlerts.clear();
    this.healthStatus.clear();
    this.subscriptions.clear();
  }
  
  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.initializeConnection();
  }
}

// Singleton instance
let instance: RealtimeMonitoringService | null = null;

export function getRealtimeMonitoringService(): RealtimeMonitoringService {
  if (!instance) {
    instance = new RealtimeMonitoringService();
  }
  return instance;
}

export default RealtimeMonitoringService;