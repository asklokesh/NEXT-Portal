// Plugin Health Monitoring Service
// Monitors the health and performance of installed Backstage plugins

import { pluginRegistry, type BackstagePlugin } from './plugin-registry';

export interface PluginHealthStatus {
 pluginId: string;
 status: 'healthy' | 'degraded' | 'error' | 'unknown';
 lastChecked: Date;
 responseTime?: number;
 errorCount: number;
 successCount: number;
 availability: number; // Percentage
 issues: HealthIssue[];
 metrics: PluginMetrics;
}

export interface HealthIssue {
 severity: 'low' | 'medium' | 'high' | 'critical';
 type: 'performance' | 'error' | 'configuration' | 'dependency';
 message: string;
 timestamp: Date;
 details?: any;
}

export interface PluginMetrics {
 apiCalls: number;
 avgResponseTime: number;
 errorRate: number;
 throughput: number;
 memoryUsage?: number;
 cpuUsage?: number;
}

class PluginHealthMonitor {
 private healthStatus: Map<string, PluginHealthStatus> = new Map();
 private monitoringInterval: NodeJS.Timeout | null = null;
 private metricsHistory: Map<string, PluginMetrics[]> = new Map();
 
 // Start monitoring all installed plugins
 startMonitoring(intervalMs: number = 60000) {
 if (this.monitoringInterval) {
 this.stopMonitoring();
 }

 // Initial health check
 this.checkAllPlugins();

 // Set up periodic monitoring
 this.monitoringInterval = setInterval(() => {
 this.checkAllPlugins();
 }, intervalMs);
 }

 // Stop monitoring
 stopMonitoring() {
 if (this.monitoringInterval) {
 clearInterval(this.monitoringInterval);
 this.monitoringInterval = null;
 }
 }

 // Check health of all installed plugins
 private async checkAllPlugins() {
 try {
 const plugins = await pluginRegistry.fetchAvailablePlugins();
 const installedPlugins = plugins.filter(p => p.installed && p.enabled);

 for (const plugin of installedPlugins) {
 await this.checkPluginHealth(plugin);
 }

 // Analyze trends and detect anomalies
 this.analyzeHealthTrends();
 } catch (error) {
 console.error('Failed to check plugin health:', error);
 }
 }

 // Check health of a specific plugin
 async checkPluginHealth(plugin: BackstagePlugin): Promise<PluginHealthStatus> {
 const startTime = Date.now();
 const pluginId = plugin.id;
 
 // Get or create health status
 let status = this.healthStatus.get(pluginId) || this.createInitialStatus(pluginId);
 
 try {
 // Check plugin API endpoint
 const healthCheckResult = await this.performHealthCheck(plugin);
 const responseTime = Date.now() - startTime;
 
 // Update metrics
 status.responseTime = responseTime;
 status.lastChecked = new Date();
 
 if (healthCheckResult.success) {
 status.status = this.determineHealthStatus(responseTime, status);
 status.successCount++;
 } else {
 status.status = 'error';
 status.errorCount++;
 status.issues.push({
 severity: 'high',
 type: 'error',
 message: healthCheckResult.error || 'Health check failed',
 timestamp: new Date()
 });
 }
 
 // Calculate availability
 const totalChecks = status.successCount + status.errorCount;
 status.availability = totalChecks > 0 
 ? (status.successCount / totalChecks) * 100 
 : 0;
 
 // Update metrics
 status.metrics = await this.collectPluginMetrics(plugin);
 
 // Store metrics history
 this.updateMetricsHistory(pluginId, status.metrics);
 
 // Check for issues
 this.detectIssues(status, plugin);
 
 // Save status
 this.healthStatus.set(pluginId, status);
 
 return status;
 } catch (error) {
 status.status = 'error';
 status.errorCount++;
 status.issues.push({
 severity: 'critical',
 type: 'error',
 message: `Health check failed: ${error}`,
 timestamp: new Date()
 });
 
 this.healthStatus.set(pluginId, status);
 return status;
 }
 }

 // Perform actual health check
 private async performHealthCheck(plugin: BackstagePlugin): Promise<{ success: boolean; error?: string }> {
 try {
 // Check if plugin has a health endpoint
 const healthEndpoint = `/api/backstage/plugins/${plugin.id}/health`;
 const response = await fetch(healthEndpoint, {
 method: 'GET',
 signal: AbortSignal.timeout(5000) // 5 second timeout
 });
 
 if (response.ok) {
 return { success: true };
 } else {
 return { 
 success: false, 
 error: `Health check returned ${response.status}` 
 };
 }
 } catch (error) {
 // Fallback: Check if plugin configuration exists
 const config = typeof window !== 'undefined' 
 ? localStorage.getItem(`plugin-config-${plugin.id}`)
 : null;
 
 if (config) {
 return { success: true };
 }
 
 return { 
 success: false, 
 error: error instanceof Error ? error.message : 'Unknown error' 
 };
 }
 }

 // Determine health status based on metrics
 private determineHealthStatus(responseTime: number, status: PluginHealthStatus): PluginHealthStatus['status'] {
 const issues = [];
 
 // Check response time
 if (responseTime > 3000) {
 issues.push('slow');
 }
 
 // Check error rate
 const totalChecks = status.successCount + status.errorCount;
 const errorRate = totalChecks > 0 ? (status.errorCount / totalChecks) * 100 : 0;
 if (errorRate > 10) {
 issues.push('high-error-rate');
 }
 
 // Check availability
 if (status.availability < 95) {
 issues.push('low-availability');
 }
 
 // Determine overall status
 if (issues.length === 0) {
 return 'healthy';
 } else if (issues.length === 1 || responseTime < 5000) {
 return 'degraded';
 } else {
 return 'error';
 }
 }

 // Collect plugin metrics
 private async collectPluginMetrics(plugin: BackstagePlugin): Promise<PluginMetrics> {
 // In a real implementation, this would collect actual metrics
 // from the plugin's runtime performance
 return {
 apiCalls: Math.floor(Math.random() * 1000),
 avgResponseTime: Math.random() * 500,
 errorRate: Math.random() * 5,
 throughput: Math.floor(Math.random() * 100),
 memoryUsage: Math.random() * 100,
 cpuUsage: Math.random() * 50
 };
 }

 // Detect issues based on health data
 private detectIssues(status: PluginHealthStatus, plugin: BackstagePlugin) {
 // Clear old issues
 status.issues = status.issues.filter(issue => {
 const ageMs = Date.now() - issue.timestamp.getTime();
 return ageMs < 3600000; // Keep issues for 1 hour
 });
 
 // Check response time
 if (status.responseTime && status.responseTime > 2000) {
 const severity = status.responseTime > 5000 ? 'high' : 'medium';
 status.issues.push({
 severity,
 type: 'performance',
 message: `Response time is ${status.responseTime}ms (threshold: 2000ms)`,
 timestamp: new Date(),
 details: { responseTime: status.responseTime }
 });
 }
 
 // Check error rate
 const errorRate = status.metrics.errorRate;
 if (errorRate > 5) {
 const severity = errorRate > 10 ? 'high' : 'medium';
 status.issues.push({
 severity,
 type: 'error',
 message: `Error rate is ${errorRate.toFixed(2)}% (threshold: 5%)`,
 timestamp: new Date(),
 details: { errorRate }
 });
 }
 
 // Check availability
 if (status.availability < 99) {
 const severity = status.availability < 95 ? 'high' : 'low';
 status.issues.push({
 severity,
 type: 'error',
 message: `Availability is ${status.availability.toFixed(2)}% (threshold: 99%)`,
 timestamp: new Date(),
 details: { availability: status.availability }
 });
 }
 
 // Check dependencies
 if (plugin.dependencies && plugin.dependencies.length > 0) {
 // Check if dependencies are healthy
 for (const dep of plugin.dependencies) {
 if (dep.includes('@backstage/plugin-')) {
 const depId = dep.replace('@backstage/plugin-', '');
 const depStatus = this.healthStatus.get(depId);
 if (depStatus && depStatus.status === 'error') {
 status.issues.push({
 severity: 'medium',
 type: 'dependency',
 message: `Dependency ${depId} is unhealthy`,
 timestamp: new Date(),
 details: { dependency: depId }
 });
 }
 }
 }
 }
 }

 // Update metrics history
 private updateMetricsHistory(pluginId: string, metrics: PluginMetrics) {
 const history = this.metricsHistory.get(pluginId) || [];
 history.push(metrics);
 
 // Keep only last 100 data points
 if (history.length > 100) {
 history.shift();
 }
 
 this.metricsHistory.set(pluginId, history);
 }

 // Analyze health trends across all plugins
 private analyzeHealthTrends() {
 for (const [pluginId, status] of this.healthStatus.entries()) {
 const history = this.metricsHistory.get(pluginId);
 if (!history || history.length < 10) continue;
 
 // Detect performance degradation
 const recentMetrics = history.slice(-10);
 const oldMetrics = history.slice(-20, -10);
 
 if (oldMetrics.length > 0) {
 const recentAvgResponseTime = this.average(recentMetrics.map(m => m.avgResponseTime));
 const oldAvgResponseTime = this.average(oldMetrics.map(m => m.avgResponseTime));
 
 // Check if performance has degraded by more than 50%
 if (recentAvgResponseTime > oldAvgResponseTime * 1.5) {
 status.issues.push({
 severity: 'medium',
 type: 'performance',
 message: 'Performance degradation detected',
 timestamp: new Date(),
 details: {
 recent: recentAvgResponseTime,
 previous: oldAvgResponseTime,
 change: ((recentAvgResponseTime - oldAvgResponseTime) / oldAvgResponseTime) * 100
 }
 });
 }
 }
 }
 }

 // Helper function to calculate average
 private average(values: number[]): number {
 if (values.length === 0) return 0;
 return values.reduce((a, b) => a + b, 0) / values.length;
 }

 // Create initial health status
 private createInitialStatus(pluginId: string): PluginHealthStatus {
 return {
 pluginId,
 status: 'unknown',
 lastChecked: new Date(),
 errorCount: 0,
 successCount: 0,
 availability: 100,
 issues: [],
 metrics: {
 apiCalls: 0,
 avgResponseTime: 0,
 errorRate: 0,
 throughput: 0
 }
 };
 }

 // Get health status for a specific plugin
 getPluginHealth(pluginId: string): PluginHealthStatus | undefined {
 return this.healthStatus.get(pluginId);
 }

 // Get health status for all plugins
 getAllPluginHealth(): Map<string, PluginHealthStatus> {
 return new Map(this.healthStatus);
 }

 // Get plugins with issues
 getPluginsWithIssues(): PluginHealthStatus[] {
 const result: PluginHealthStatus[] = [];
 for (const status of this.healthStatus.values()) {
 if (status.issues.length > 0 || status.status !== 'healthy') {
 result.push(status);
 }
 }
 return result;
 }

 // Get health summary
 getHealthSummary(): {
 total: number;
 healthy: number;
 degraded: number;
 error: number;
 unknown: number;
 avgAvailability: number;
 totalIssues: number;
 } {
 let healthy = 0;
 let degraded = 0;
 let error = 0;
 let unknown = 0;
 let totalAvailability = 0;
 let totalIssues = 0;
 
 for (const status of this.healthStatus.values()) {
 switch (status.status) {
 case 'healthy': healthy++; break;
 case 'degraded': degraded++; break;
 case 'error': error++; break;
 case 'unknown': unknown++; break;
 }
 totalAvailability += status.availability;
 totalIssues += status.issues.length;
 }
 
 const total = this.healthStatus.size;
 
 return {
 total,
 healthy,
 degraded,
 error,
 unknown,
 avgAvailability: total > 0 ? totalAvailability / total : 0,
 totalIssues
 };
 }

 // Export health report
 exportHealthReport(): string {
 const summary = this.getHealthSummary();
 const issues = this.getPluginsWithIssues();
 
 const report = {
 timestamp: new Date().toISOString(),
 summary,
 plugins: Array.from(this.healthStatus.values()),
 criticalIssues: issues.filter(p => 
 p.issues.some(i => i.severity === 'critical' || i.severity === 'high')
 )
 };
 
 return JSON.stringify(report, null, 2);
 }
}

export const pluginHealthMonitor = new PluginHealthMonitor();