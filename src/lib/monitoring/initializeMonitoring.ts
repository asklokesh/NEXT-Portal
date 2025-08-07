import { metricsCollector } from '@/lib/monitoring/MetricsCollector';

export function initializeMonitoringData() {
 // Only initialize in development mode
 if (process.env.NODE_ENV !== 'development') {
 return;
 }

 console.log('Initializing monitoring data for development...');

 // Generate some historical metrics
 const now = Date.now();
 const oneHourAgo = now - 60 * 60 * 1000;
 
 // Generate CPU and memory metrics for the last hour
 for (let i = 0; i < 60; i++) {
 const timestamp = oneHourAgo + (i * 60 * 1000); // Every minute
 
 // CPU usage with some variation
 const cpuUsage = 45 + Math.sin(i / 10) * 20 + Math.random() * 10;
 metricsCollector.setGauge('cpu_usage', Math.max(0, Math.min(100, cpuUsage)), {});
 
 // Memory usage with gradual increase
 const memoryUsage = 60 + (i / 60) * 15 + Math.random() * 5;
 metricsCollector.setGauge('memory_usage', Math.max(0, Math.min(100, memoryUsage)), {});
 
 // Request count
 const requestCount = Math.floor(Math.random() * 100) + 50;
 metricsCollector.incrementCounter('http_requests_total', { method: 'GET', status: '200' }, requestCount);
 
 // Error count (much lower)
 if (Math.random() > 0.8) {
 const errorCount = Math.floor(Math.random() * 5) + 1;
 metricsCollector.incrementCounter('http_requests_total', { method: 'GET', status: '500' }, errorCount);
 }
 }

 // Generate some performance metrics
 for (let i = 0; i < 100; i++) {
 const duration = Math.random() * 500 + 50; // 50-550ms
 const success = Math.random() > 0.05; // 95% success rate
 
 const timer = metricsCollector.startPerformanceTimer('api_request');
 setTimeout(() => {
 timer(success, success ? undefined : 'Request timeout', {
 endpoint: '/api/catalog/entities',
 method: 'GET'
 });
 }, 0);
 }

 // Create some sample alerts
 metricsCollector.fireAlert({
 name: 'High CPU Usage',
 severity: 'warning',
 message: 'CPU usage has been above 80% for 5 minutes',
 entityRef: 'Component:default/user-service',
 labels: { service: 'user-service', environment: 'production' }
 });

 metricsCollector.fireAlert({
 name: 'Memory Usage Critical',
 severity: 'critical',
 message: 'Memory usage is above 90% and may cause service degradation',
 entityRef: 'Component:default/payment-service',
 labels: { service: 'payment-service', environment: 'production' }
 });

 metricsCollector.fireAlert({
 name: 'API Response Time',
 severity: 'info',
 message: 'API response time is slightly elevated but within acceptable limits',
 entityRef: 'Component:default/api-gateway',
 labels: { service: 'api-gateway', environment: 'production' }
 });

 // Create some sample logs
 const logSources = ['user-service', 'payment-service', 'api-gateway', 'auth-service'];
 const logLevels: ('error' | 'warn' | 'info' | 'debug')[] = ['error', 'warn', 'info', 'debug'];
 
 for (let i = 0; i < 50; i++) {
 const source = logSources[Math.floor(Math.random() * logSources.length)];
 const level = i < 5 ? 'error' : i < 15 ? 'warn' : i < 35 ? 'info' : 'debug';
 
 let message = '';
 switch (level) {
 case 'error':
 message = `Database connection failed for ${source}`;
 break;
 case 'warn':
 message = `High response time detected in ${source} (${Math.floor(Math.random() * 500 + 200)}ms)`;
 break;
 case 'info':
 message = `${source} processed ${Math.floor(Math.random() * 100 + 10)} requests successfully`;
 break;
 case 'debug':
 message = `${source} debug: Processing request ID ${Math.random().toString(36).substr(2, 9)}`;
 break;
 }
 
 metricsCollector.log(level, message, source, {
 timestamp: new Date(now - Math.random() * 60 * 60 * 1000).toISOString(),
 requestId: Math.random().toString(36).substr(2, 9)
 }, `Component:default/${source}`);
 }

 console.log('Monitoring data initialized with:');
 console.log(`- ${metricsCollector.getMetrics().length} metrics`);
 console.log(`- ${metricsCollector.getAlerts().length} alerts`);
 console.log(`- ${metricsCollector.getLogs().length} log entries`);
 console.log(`- ${metricsCollector.getPerformanceMetrics().length} performance metrics`);
}

// Auto-initialize when this module is imported in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
 // Initialize after a short delay to ensure the metrics collector is ready
 setTimeout(initializeMonitoringData, 1000);
}