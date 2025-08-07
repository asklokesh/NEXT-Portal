import { useEffect, useState, useCallback, useRef } from 'react';
import { metricsCollector, type Metric, type Alert, type LogEntry, type PerformanceMetric } from '@/lib/monitoring/MetricsCollector';

// Hook for collecting metrics
export function useMetricsCollector() {
 return {
 incrementCounter: useCallback((name: string, labels?: Record<string, string>, value?: number) => {
 metricsCollector.incrementCounter(name, labels, value);
 }, []),
 
 setGauge: useCallback((name: string, value: number, labels?: Record<string, string>) => {
 metricsCollector.setGauge(name, value, labels);
 }, []),
 
 recordHistogram: useCallback((name: string, value: number, labels?: Record<string, string>) => {
 metricsCollector.recordHistogram(name, value, labels);
 }, []),
 
 startTimer: useCallback((name: string) => {
 return metricsCollector.startPerformanceTimer(name);
 }, []),
 
 measureAsync: useCallback(async <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>) => {
 return await metricsCollector.measureAsync(name, fn, metadata);
 }, []),
 
 measureSync: useCallback(<T>(name: string, fn: () => T, metadata?: Record<string, any>) => {
 return metricsCollector.measureSync(name, fn, metadata);
 }, [])
 };
}

// Hook for logging
export function useLogger(source: string) {
 return {
 error: useCallback((message: string, metadata?: Record<string, any>, entityRef?: string) => {
 return metricsCollector.error(message, source, metadata, entityRef);
 }, [source]),
 
 warn: useCallback((message: string, metadata?: Record<string, any>, entityRef?: string) => {
 return metricsCollector.warn(message, source, metadata, entityRef);
 }, [source]),
 
 info: useCallback((message: string, metadata?: Record<string, any>, entityRef?: string) => {
 return metricsCollector.info(message, source, metadata, entityRef);
 }, [source]),
 
 debug: useCallback((message: string, metadata?: Record<string, any>, entityRef?: string) => {
 return metricsCollector.debug(message, source, metadata, entityRef);
 }, [source])
 };
}

// Hook for alerts
export function useAlerts() {
 const [alerts, setAlerts] = useState<Alert[]>([]);
 const [firingAlerts, setFiringAlerts] = useState<Alert[]>([]);

 useEffect(() => {
 const loadAlerts = () => {
 const allAlerts = metricsCollector.getAlerts();
 const firing = metricsCollector.getAlerts('firing');
 
 setAlerts(allAlerts);
 setFiringAlerts(firing);
 };

 // Load initial alerts
 loadAlerts();

 // Subscribe to real-time updates
 const unsubscribe = metricsCollector.subscribe((type, data) => {
 if (type === 'alert' || type === 'alert_resolved') {
 loadAlerts();
 }
 });

 return unsubscribe;
 }, []);

 const fireAlert = useCallback((alert: Omit<Alert, 'id' | 'timestamp' | 'status'>) => {
 return metricsCollector.fireAlert(alert);
 }, []);

 const resolveAlert = useCallback((alertId: string) => {
 return metricsCollector.resolveAlert(alertId);
 }, []);

 return {
 alerts,
 firingAlerts,
 fireAlert,
 resolveAlert,
 criticalCount: firingAlerts.filter(a => a.severity === 'critical').length,
 warningCount: firingAlerts.filter(a => a.severity === 'warning').length,
 infoCount: firingAlerts.filter(a => a.severity === 'info').length
 };
}

// Hook for logs
export function useLogs(filters?: {
 level?: LogEntry['level'];
 source?: string;
 entityRef?: string;
 since?: number;
}) {
 const [logs, setLogs] = useState<LogEntry[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const loadLogs = () => {
 const filteredLogs = metricsCollector.getLogs(
 filters?.level,
 filters?.source,
 filters?.entityRef,
 filters?.since
 );
 setLogs(filteredLogs);
 setLoading(false);
 };

 // Load initial logs
 loadLogs();

 // Subscribe to real-time updates
 const unsubscribe = metricsCollector.subscribe((type, data) => {
 if (type === 'log') {
 loadLogs();
 }
 });

 return unsubscribe;
 }, [filters?.level, filters?.source, filters?.entityRef, filters?.since]);

 return {
 logs,
 loading,
 errorCount: logs.filter(l => l.level === 'error').length,
 warnCount: logs.filter(l => l.level === 'warn').length,
 infoCount: logs.filter(l => l.level === 'info').length,
 debugCount: logs.filter(l => l.level === 'debug').length
 };
}

// Hook for performance metrics
export function usePerformanceMetrics(name?: string, since?: number) {
 const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
 const [stats, setStats] = useState<ReturnType<typeof metricsCollector.getPerformanceStats>>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const loadMetrics = () => {
 const performanceMetrics = metricsCollector.getPerformanceMetrics(name, since);
 const performanceStats = name ? metricsCollector.getPerformanceStats(name, since) : null;
 
 setMetrics(performanceMetrics);
 setStats(performanceStats);
 setLoading(false);
 };

 // Load initial metrics
 loadMetrics();

 // Subscribe to real-time updates
 const unsubscribe = metricsCollector.subscribe((type, data) => {
 if (type === 'performance') {
 loadMetrics();
 }
 });

 return unsubscribe;
 }, [name, since]);

 return {
 metrics,
 stats,
 loading
 };
}

// Hook for system metrics
export function useSystemMetrics(metricName: string, labels?: Record<string, string>, since?: number) {
 const [metrics, setMetrics] = useState<Metric[]>([]);
 const [stats, setStats] = useState<ReturnType<typeof metricsCollector.getMetricStats>>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const loadMetrics = () => {
 const systemMetrics = metricsCollector.getMetrics(metricName, labels, since);
 const metricStats = metricsCollector.getMetricStats(metricName, labels, since);
 
 setMetrics(systemMetrics);
 setStats(metricStats);
 setLoading(false);
 };

 // Load initial metrics
 loadMetrics();

 // Subscribe to real-time updates
 const unsubscribe = metricsCollector.subscribe((type, data) => {
 if (type === 'metric') {
 loadMetrics();
 }
 });

 return unsubscribe;
 }, [metricName, JSON.stringify(labels), since]);

 return {
 metrics,
 stats,
 loading,
 latest: stats?.latest || 0,
 average: stats?.avg || 0,
 count: stats?.count || 0
 };
}

// Hook for system health
export function useSystemHealth() {
 const [health, setHealth] = useState<ReturnType<typeof metricsCollector.getSystemHealth>>({
 status: 'healthy',
 checks: []
 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const loadHealth = () => {
 const systemHealth = metricsCollector.getSystemHealth();
 setHealth(systemHealth);
 setLoading(false);
 };

 // Load initial health
 loadHealth();

 // Refresh health status every 30 seconds
 const interval = setInterval(loadHealth, 30000);

 // Subscribe to real-time updates
 const unsubscribe = metricsCollector.subscribe((type, data) => {
 if (type === 'alert' || type === 'log' || type === 'metric') {
 // Debounce health updates
 setTimeout(loadHealth, 1000);
 }
 });

 return () => {
 clearInterval(interval);
 unsubscribe();
 };
 }, []);

 return {
 health,
 loading,
 isHealthy: health.status === 'healthy',
 isDegraded: health.status === 'degraded',
 isUnhealthy: health.status === 'unhealthy'
 };
}

// Hook for component-specific monitoring
export function useComponentMonitoring(componentName: string, entityRef?: string) {
 const metrics = useMetricsCollector();
 const logger = useLogger(componentName);
 const componentRef = useRef<HTMLElement | null>(null);

 // Track component lifecycle
 useEffect(() => {
 metrics.incrementCounter('component_mounted', { component: componentName });
 logger.info(`Component ${componentName} mounted`, { entityRef });

 return () => {
 metrics.incrementCounter('component_unmounted', { component: componentName });
 logger.info(`Component ${componentName} unmounted`, { entityRef });
 };
 // Remove metrics and logger from dependencies as they contain stable callback functions
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [componentName, entityRef]);

 // Track component errors
 const trackError = useCallback((error: Error, errorInfo?: any) => {
 metrics.incrementCounter('component_error', { component: componentName });
 logger.error(`Error in component ${componentName}`, {
 error: error.message,
 stack: error.stack,
 errorInfo,
 entityRef
 });
 }, [componentName, entityRef, metrics, logger]);

 // Track user interactions
 const trackInteraction = useCallback((action: string, metadata?: Record<string, any>) => {
 metrics.incrementCounter('user_interaction', { 
 component: componentName, 
 action 
 });
 logger.info(`User interaction: ${action}`, { 
 component: componentName, 
 entityRef,
 ...metadata 
 });
 }, [componentName, entityRef, metrics, logger]);

 // Track API calls
 const trackApiCall = useCallback(async <T>(
 apiName: string, 
 apiCall: () => Promise<T>, 
 metadata?: Record<string, any>
 ): Promise<T> => {
 return await metrics.measureAsync(
 `api_call_${apiName}`,
 apiCall,
 { component: componentName, entityRef, ...metadata }
 );
 }, [componentName, entityRef, metrics]);

 // Track performance
 const trackPerformance = useCallback(<T>(
 operationName: string,
 operation: () => T,
 metadata?: Record<string, any>
 ): T => {
 return metrics.measureSync(
 `${componentName}_${operationName}`,
 operation,
 { component: componentName, entityRef, ...metadata }
 );
 }, [componentName, entityRef, metrics]);

 return {
 metrics,
 logger,
 trackError,
 trackInteraction,
 trackApiCall,
 trackPerformance,
 componentRef
 };
}

// Hook for real-time monitoring dashboard
export function useMonitoringDashboard() {
 const { alerts, firingAlerts, criticalCount, warningCount } = useAlerts();
 const { health, isHealthy, isDegraded, isUnhealthy } = useSystemHealth();
 const { logs, errorCount, warnCount } = useLogs({ since: Date.now() - 24 * 60 * 60 * 1000 }); // Last 24 hours
 
 // Key system metrics
 const cpuMetrics = useSystemMetrics('cpu_usage', {}, Date.now() - 60 * 60 * 1000); // Last hour
 const memoryMetrics = useSystemMetrics('memory_usage', {}, Date.now() - 60 * 60 * 1000);
 const responseTimeMetrics = usePerformanceMetrics(undefined, Date.now() - 60 * 60 * 1000);

 const summary = {
 alerts: {
 total: alerts.length,
 firing: firingAlerts.length,
 critical: criticalCount,
 warning: warningCount
 },
 health: {
 status: health.status,
 isHealthy,
 isDegraded,
 isUnhealthy,
 checks: health.checks
 },
 logs: {
 total: logs.length,
 errors: errorCount,
 warnings: warnCount
 },
 performance: {
 avgResponseTime: responseTimeMetrics.stats?.avgDuration || 0,
 successRate: responseTimeMetrics.stats?.successRate || 100,
 p95ResponseTime: responseTimeMetrics.stats?.p95 || 0
 },
 system: {
 avgCpu: cpuMetrics.stats?.avg || 0,
 maxCpu: cpuMetrics.stats?.max || 0,
 avgMemory: memoryMetrics.stats?.avg || 0,
 maxMemory: memoryMetrics.stats?.max || 0
 }
 };

 return {
 summary,
 alerts,
 health,
 logs: logs.slice(0, 100), // Latest 100 logs
 cpuMetrics,
 memoryMetrics,
 responseTimeMetrics
 };
}