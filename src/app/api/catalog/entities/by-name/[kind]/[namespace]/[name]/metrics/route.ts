import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
 params: Promise<{
 kind: string;
 namespace: string;
 name: string;
 }>;
}

// Function to fetch metrics from Prometheus
async function fetchPrometheusMetrics(entityRef: string, metricName: string, query: string) {
 const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
 try {
 const response = await fetch(
 `${prometheusUrl}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${Date.now() - 7 * 24 * 60 * 60 * 1000}&end=${Date.now()}&step=3600`,
 {
 headers: {
 'Accept': 'application/json',
 },
 }
 );
 
 if (response.ok) {
 const data = await response.json();
 return data.data?.result?.[0]?.values || [];
 }
 } catch (error) {
 console.error(`Failed to fetch ${metricName} from Prometheus:`, error);
 }
 return [];
}

// Function to fetch metrics from Grafana
async function fetchGrafanaMetrics(entityRef: string) {
 const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3000';
 const grafanaApiKey = process.env.GRAFANA_API_KEY;
 
 if (!grafanaApiKey) {
 return null;
 }
 
 try {
 // This would fetch dashboard data for the entity
 const response = await fetch(
 `${grafanaUrl}/api/dashboards/uid/${entityRef.replace(/[^a-zA-Z0-9]/g, '-')}`,
 {
 headers: {
 'Authorization': `Bearer ${grafanaApiKey}`,
 'Accept': 'application/json',
 },
 }
 );
 
 if (response.ok) {
 return await response.json();
 }
 } catch (error) {
 console.error('Failed to fetch from Grafana:', error);
 }
 return null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
 try {
 const { kind, namespace, name } = await params;
 const entityRef = `${kind}:${namespace}/${name}`;
 
 console.log(`Fetching metrics for entity: ${entityRef}`);
 
 const now = Date.now();
 const dayMs = 24 * 60 * 60 * 1000;
 
 // Check if monitoring systems are configured
 const hasPrometheus = process.env.PROMETHEUS_URL;
 const hasGrafana = process.env.GRAFANA_URL && process.env.GRAFANA_API_KEY;
 
 // Try to fetch real metrics if monitoring is configured
 if (hasPrometheus || hasGrafana) {
 // Fetch metrics from Prometheus
 const [cpuData, memoryData, latencyData, throughputData] = await Promise.all([
 hasPrometheus ? fetchPrometheusMetrics(entityRef, 'cpu', `container_cpu_usage_seconds_total{pod=~".*${name}.*"}`) : Promise.resolve([]),
 hasPrometheus ? fetchPrometheusMetrics(entityRef, 'memory', `container_memory_usage_bytes{pod=~".*${name}.*"}`) : Promise.resolve([]),
 hasPrometheus ? fetchPrometheusMetrics(entityRef, 'latency', `http_request_duration_seconds{service="${name}"}`) : Promise.resolve([]),
 hasPrometheus ? fetchPrometheusMetrics(entityRef, 'throughput', `http_requests_total{service="${name}"}`) : Promise.resolve([]),
 ]);
 
 // If we have real data, format and return it
 if (cpuData.length > 0 || memoryData.length > 0) {
 const metrics = {
 entityRef,
 period: {
 start: new Date(now - 7 * dayMs).toISOString(),
 end: new Date(now).toISOString(),
 },
 availability: {
 current: 0,
 sla: 99.9,
 incidents: 0,
 downtime: '0s',
 },
 performance: {
 latency: {
 p50: 0,
 p95: 0,
 p99: 0,
 unit: 'ms',
 timeSeries: latencyData.map((point: any[]) => ({
 timestamp: new Date(point[0] * 1000).toISOString(),
 value: parseFloat(point[1]) * 1000, // Convert to ms
 })),
 },
 throughput: {
 current: 0,
 peak: 0,
 unit: 'req/s',
 timeSeries: throughputData.map((point: any[]) => ({
 timestamp: new Date(point[0] * 1000).toISOString(),
 value: parseFloat(point[1]),
 })),
 },
 errorRate: {
 current: 0,
 threshold: 1.0,
 unit: '%',
 timeSeries: [],
 },
 },
 resources: {
 cpu: {
 usage: cpuData.length > 0 ? parseFloat(cpuData[cpuData.length - 1][1]) : 0,
 limit: 100,
 unit: '%',
 timeSeries: cpuData.map((point: any[]) => ({
 timestamp: new Date(point[0] * 1000).toISOString(),
 value: parseFloat(point[1]),
 })),
 },
 memory: {
 usage: memoryData.length > 0 ? parseFloat(memoryData[memoryData.length - 1][1]) / (1024 * 1024 * 1024) : 0,
 limit: 4,
 unit: 'GB',
 timeSeries: memoryData.map((point: any[]) => ({
 timestamp: new Date(point[0] * 1000).toISOString(),
 value: parseFloat(point[1]) / (1024 * 1024 * 1024), // Convert to GB
 })),
 },
 storage: {
 usage: 0,
 limit: 100,
 unit: 'GB',
 timeSeries: [],
 },
 },
 alerts: [],
 deployments: [],
 source: 'prometheus',
 };
 
 return NextResponse.json(metrics);
 }
 }
 
 // Return empty metrics with a warning if no monitoring is configured
 console.warn('No monitoring systems configured. Configure PROMETHEUS_URL or GRAFANA_URL to see real metrics.');
 
 const emptyMetrics = {
 entityRef,
 period: {
 start: new Date(now - 7 * dayMs).toISOString(),
 end: new Date(now).toISOString(),
 },
 availability: {
 current: 0,
 sla: 99.9,
 incidents: 0,
 downtime: '0s',
 warning: 'Configure monitoring systems to see real data',
 },
 performance: {
 latency: {
 p50: 0,
 p95: 0,
 p99: 0,
 unit: 'ms',
 timeSeries: [],
 },
 throughput: {
 current: 0,
 peak: 0,
 unit: 'req/s',
 timeSeries: [],
 },
 errorRate: {
 current: 0,
 threshold: 1.0,
 unit: '%',
 timeSeries: [],
 },
 },
 resources: {
 cpu: {
 usage: 0,
 limit: 100,
 unit: '%',
 timeSeries: [],
 },
 memory: {
 usage: 0,
 limit: 4,
 unit: 'GB',
 timeSeries: [],
 },
 storage: {
 usage: 0,
 limit: 100,
 unit: 'GB',
 timeSeries: [],
 },
 },
 alerts: [],
 deployments: [],
 warning: 'Configure PROMETHEUS_URL and GRAFANA_API_KEY environment variables to see real metrics',
 };
 
 return NextResponse.json(emptyMetrics);
 } catch (error) {
 console.error('Failed to fetch entity metrics:', error);
 return NextResponse.json(
 { error: 'Failed to fetch entity metrics' },
 { status: 500 }
 );
 }
}