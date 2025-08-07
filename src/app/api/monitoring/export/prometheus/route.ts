import { NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/MetricsCollector';
import { realMetricsCollector } from '@/lib/monitoring/RealMetricsCollector';

export async function GET() {
  try {
    // Get metrics from both the in-memory collector and real metrics
    const prometheusMetrics = metricsCollector.exportPrometheusMetrics();
    const collectorStatus = realMetricsCollector.getStatus();
    const systemHealth = metricsCollector.getSystemHealth();
    
    // Add status metrics
    const statusMetrics = [
      `# HELP backstage_real_metrics_collector_running Whether real metrics collector is running`,
      `# TYPE backstage_real_metrics_collector_running gauge`,
      `backstage_real_metrics_collector_running ${collectorStatus.running ? 1 : 0}`,
      '',
      `# HELP backstage_real_metrics_sources_count Number of active metrics sources`,
      `# TYPE backstage_real_metrics_sources_count gauge`,
      `backstage_real_metrics_sources_count ${collectorStatus.sources.length}`,
      '',
      `# HELP backstage_system_health_status System health status (0=unhealthy, 1=degraded, 2=healthy)`,
      `# TYPE backstage_system_health_status gauge`,
      `backstage_system_health_status ${systemHealth.status === 'healthy' ? 2 : systemHealth.status === 'degraded' ? 1 : 0}`,
      ''
    ].join('\n');
    
    const combinedMetrics = [statusMetrics, prometheusMetrics].filter(Boolean).join('\n');
    
    return new NextResponse(combinedMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error exporting Prometheus metrics:', error);
    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}