// Comprehensive metrics collection and observability

export interface Metric {
 name: string;
 value: number;
 timestamp: number;
 labels: Record<string, string>;
 type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface Alert {
 id: string;
 name: string;
 severity: 'critical' | 'warning' | 'info';
 message: string;
 timestamp: number;
 entityRef?: string;
 status: 'firing' | 'resolved';
 labels: Record<string, string>;
}

export interface LogEntry {
 id: string;
 timestamp: number;
 level: 'error' | 'warn' | 'info' | 'debug';
 message: string;
 source: string;
 entityRef?: string;
 metadata: Record<string, any>;
 traceId?: string;
 spanId?: string;
}

export interface PerformanceMetric {
 name: string;
 duration: number;
 startTime: number;
 endTime: number;
 success: boolean;
 error?: string;
 metadata: Record<string, any>;
}

class MetricsCollector {
 private metrics: Map<string, Metric[]> = new Map();
 private alerts: Alert[] = [];
 private logs: LogEntry[] = [];
 private performanceMetrics: PerformanceMetric[] = [];
 private subscribers: Set<(data: any) => void> = new Set();
 private maxRetentionSize = 10000; // Maximum number of items to retain in memory

 // Metric collection methods
 incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
 this.addMetric({
 name,
 value,
 timestamp: Date.now(),
 labels,
 type: 'counter'
 });
 }

 setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
 this.addMetric({
 name,
 value,
 timestamp: Date.now(),
 labels,
 type: 'gauge'
 });
 }

 recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
 this.addMetric({
 name,
 value,
 timestamp: Date.now(),
 labels,
 type: 'histogram'
 });
 }

 private addMetric(metric: Metric): void {
 const key = `${metric.name}_${JSON.stringify(metric.labels)}`;
 
 if (!this.metrics.has(key)) {
 this.metrics.set(key, []);
 }
 
 const metricArray = this.metrics.get(key)!;
 metricArray.push(metric);
 
 // Maintain max retention size
 if (metricArray.length > this.maxRetentionSize) {
 metricArray.shift();
 }

 this.notifySubscribers('metric', metric);
 }

 // Alert methods
 fireAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'status'>): string {
 const newAlert: Alert = {
 ...alert,
 id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 timestamp: Date.now(),
 status: 'firing'
 };

 this.alerts.push(newAlert);
 
 // Maintain max retention size
 if (this.alerts.length > this.maxRetentionSize) {
 this.alerts.shift();
 }

 this.notifySubscribers('alert', newAlert);
 
 return newAlert.id;
 }

 resolveAlert(alertId: string): boolean {
 const alert = this.alerts.find(a => a.id === alertId);
 if (alert && alert.status === 'firing') {
 alert.status = 'resolved';
 this.notifySubscribers('alert_resolved', alert);
 return true;
 }
 return false;
 }

 // Logging methods
 log(level: LogEntry['level'], message: string, source: string, metadata: Record<string, any> = {}, entityRef?: string): string {
 const logEntry: LogEntry = {
 id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 timestamp: Date.now(),
 level,
 message,
 source,
 entityRef,
 metadata,
 traceId: this.generateTraceId(),
 spanId: this.generateSpanId()
 };

 this.logs.push(logEntry);
 
 // Maintain max retention size
 if (this.logs.length > this.maxRetentionSize) {
 this.logs.shift();
 }

 this.notifySubscribers('log', logEntry);

 // Also log to console in development
 if (process.env.NODE_ENV === 'development') {
 const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
 console[consoleMethod](`[${source}] ${message}`, metadata);
 }

 return logEntry.id;
 }

 error(message: string, source: string, metadata: Record<string, any> = {}, entityRef?: string): string {
 return this.log('error', message, source, metadata, entityRef);
 }

 warn(message: string, source: string, metadata: Record<string, any> = {}, entityRef?: string): string {
 return this.log('warn', message, source, metadata, entityRef);
 }

 info(message: string, source: string, metadata: Record<string, any> = {}, entityRef?: string): string {
 return this.log('info', message, source, metadata, entityRef);
 }

 debug(message: string, source: string, metadata: Record<string, any> = {}, entityRef?: string): string {
 return this.log('debug', message, source, metadata, entityRef);
 }

 // Performance monitoring methods
 startPerformanceTimer(name: string): () => PerformanceMetric {
 const startTime = performance.now();
 
 return (success: boolean = true, error?: string, metadata: Record<string, any> = {}) => {
 const endTime = performance.now();
 const duration = endTime - startTime;
 
 const performanceMetric: PerformanceMetric = {
 name,
 duration,
 startTime,
 endTime,
 success,
 error,
 metadata
 };

 this.performanceMetrics.push(performanceMetric);
 
 // Maintain max retention size
 if (this.performanceMetrics.length > this.maxRetentionSize) {
 this.performanceMetrics.shift();
 }

 this.notifySubscribers('performance', performanceMetric);

 // Record as histogram metric
 this.recordHistogram(`${name}_duration_ms`, duration, { 
 success: success.toString(),
 ...metadata 
 });

 return performanceMetric;
 };
 }

 // Utility methods for performance monitoring
 async measureAsync<T>(name: string, fn: () => Promise<T>, metadata: Record<string, any> = {}): Promise<T> {
 const timer = this.startPerformanceTimer(name);
 
 try {
 const result = await fn();
 timer(true, undefined, metadata);
 return result;
 } catch (error) {
 timer(false, error instanceof Error ? error.message : 'Unknown error', { 
 ...metadata, 
 error: error instanceof Error ? error.stack : error 
 });
 throw error;
 }
 }

 measureSync<T>(name: string, fn: () => T, metadata: Record<string, any> = {}): T {
 const timer = this.startPerformanceTimer(name);
 
 try {
 const result = fn();
 timer(true, undefined, metadata);
 return result;
 } catch (error) {
 timer(false, error instanceof Error ? error.message : 'Unknown error', { 
 ...metadata, 
 error: error instanceof Error ? error.stack : error 
 });
 throw error;
 }
 }

 // Query methods
 getMetrics(name?: string, labels?: Record<string, string>, since?: number): Metric[] {
 const allMetrics = Array.from(this.metrics.values()).flat();
 
 return allMetrics.filter(metric => {
 if (name && metric.name !== name) return false;
 if (since && metric.timestamp < since) return false;
 if (labels) {
 for (const [key, value] of Object.entries(labels)) {
 if (metric.labels[key] !== value) return false;
 }
 }
 return true;
 }).sort((a, b) => b.timestamp - a.timestamp);
 }

 getAlerts(status?: Alert['status'], severity?: Alert['severity'], entityRef?: string): Alert[] {
 return this.alerts.filter(alert => {
 if (status && alert.status !== status) return false;
 if (severity && alert.severity !== severity) return false;
 if (entityRef && alert.entityRef !== entityRef) return false;
 return true;
 }).sort((a, b) => b.timestamp - a.timestamp);
 }

 getLogs(level?: LogEntry['level'], source?: string, entityRef?: string, since?: number): LogEntry[] {
 return this.logs.filter(log => {
 if (level && log.level !== level) return false;
 if (source && log.source !== source) return false;
 if (entityRef && log.entityRef !== entityRef) return false;
 if (since && log.timestamp < since) return false;
 return true;
 }).sort((a, b) => b.timestamp - a.timestamp);
 }

 getPerformanceMetrics(name?: string, since?: number): PerformanceMetric[] {
 return this.performanceMetrics.filter(metric => {
 if (name && metric.name !== name) return false;
 if (since && metric.startTime < since) return false;
 return true;
 }).sort((a, b) => b.startTime - a.startTime);
 }

 // Statistics and aggregation methods
 getMetricStats(name: string, labels?: Record<string, string>, since?: number): {
 count: number;
 min: number;
 max: number;
 avg: number;
 sum: number;
 latest: number;
 } | null {
 const metrics = this.getMetrics(name, labels, since);
 
 if (metrics.length === 0) return null;

 const values = metrics.map(m => m.value);
 
 return {
 count: values.length,
 min: Math.min(...values),
 max: Math.max(...values),
 avg: values.reduce((a, b) => a + b, 0) / values.length,
 sum: values.reduce((a, b) => a + b, 0),
 latest: values[0] // Latest value (array is already sorted by timestamp desc)
 };
 }

 getPerformanceStats(name: string, since?: number): {
 count: number;
 avgDuration: number;
 minDuration: number;
 maxDuration: number;
 successRate: number;
 p50: number;
 p95: number;
 p99: number;
 } | null {
 const metrics = this.getPerformanceMetrics(name, since);
 
 if (metrics.length === 0) return null;

 const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
 const successCount = metrics.filter(m => m.success).length;
 
 const percentile = (arr: number[], p: number) => {
 const index = Math.ceil((p / 100) * arr.length) - 1;
 return arr[Math.max(0, index)] || 0;
 };

 return {
 count: metrics.length,
 avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
 minDuration: durations[0] || 0,
 maxDuration: durations[durations.length - 1] || 0,
 successRate: (successCount / metrics.length) * 100,
 p50: percentile(durations, 50),
 p95: percentile(durations, 95),
 p99: percentile(durations, 99)
 };
 }

 // Subscription methods for real-time updates
 subscribe(callback: (type: string, data: any) => void): () => void {
 this.subscribers.add(callback);
 
 return () => {
 this.subscribers.delete(callback);
 };
 }

 private notifySubscribers(type: string, data: any): void {
 this.subscribers.forEach(callback => {
 try {
 callback(type, data);
 } catch (error) {
 console.error('Error in metrics subscriber:', error);
 }
 });
 }

 // Utility methods
 private generateTraceId(): string {
 return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
 }

 private generateSpanId(): string {
 return `span_${Math.random().toString(36).substr(2, 8)}`;
 }

 // Health check methods
 getSystemHealth(): {
 status: 'healthy' | 'degraded' | 'unhealthy';
 checks: Array<{
 name: string;
 status: 'pass' | 'fail' | 'warn';
 message: string;
 timestamp: number;
 }>;
 } {
 const now = Date.now();
 const checks = [];

 // Check error rate
 const recentErrors = this.getLogs('error', undefined, undefined, now - 5 * 60 * 1000); // Last 5 minutes
 const errorRate = recentErrors.length;
 
 checks.push({
 name: 'error_rate',
 status: errorRate > 50 ? 'fail' : errorRate > 10 ? 'warn' : 'pass',
 message: `${errorRate} errors in last 5 minutes`,
 timestamp: now
 });

 // Check memory usage
 const memoryMetrics = this.getMetrics('memory_usage', {}, now - 60 * 1000); // Last minute
 const latestMemory = memoryMetrics.length > 0 ? memoryMetrics[0].value : 0;
 
 checks.push({
 name: 'memory_usage',
 status: latestMemory > 90 ? 'fail' : latestMemory > 80 ? 'warn' : 'pass',
 message: `Memory usage: ${latestMemory.toFixed(1)}%`,
 timestamp: now
 });

 // Check active alerts
 const criticalAlerts = this.getAlerts('firing', 'critical');
 const warningAlerts = this.getAlerts('firing', 'warning');
 
 checks.push({
 name: 'active_alerts',
 status: criticalAlerts.length > 0 ? 'fail' : warningAlerts.length > 0 ? 'warn' : 'pass',
 message: `${criticalAlerts.length} critical, ${warningAlerts.length} warning alerts`,
 timestamp: now
 });

 // Determine overall status
 const hasFailures = checks.some(c => c.status === 'fail');
 const hasWarnings = checks.some(c => c.status === 'warn');
 
 const status = hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

 return { status, checks };
 }

 // Export methods for external monitoring systems
 exportPrometheusMetrics(): string {
 const lines: string[] = [];
 
 // Group metrics by name
 const metricGroups = new Map<string, Metric[]>();
 
 Array.from(this.metrics.values()).flat().forEach(metric => {
 if (!metricGroups.has(metric.name)) {
 metricGroups.set(metric.name, []);
 }
 metricGroups.get(metric.name)!.push(metric);
 });

 // Generate Prometheus format
 metricGroups.forEach((metrics, name) => {
 const latestMetric = metrics[metrics.length - 1]; // Get latest metric
 const labelStr = Object.entries(latestMetric.labels)
 .map(([key, value]) => `${key}="${value}"`)
 .join(',');
 
 lines.push(`# TYPE ${name} ${latestMetric.type}`);
 lines.push(`${name}{${labelStr}} ${latestMetric.value} ${latestMetric.timestamp}`);
 });

 return lines.join('\n');
 }

 // Clear data methods
 clearMetrics(): void {
 this.metrics.clear();
 }

 clearAlerts(): void {
 this.alerts = [];
 }

 clearLogs(): void {
 this.logs = [];
 }

 clearPerformanceMetrics(): void {
 this.performanceMetrics = [];
 }

 clearAll(): void {
 this.clearMetrics();
 this.clearAlerts();
 this.clearLogs();
 this.clearPerformanceMetrics();
 }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();