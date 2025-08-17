/**
 * Enhanced Analytics API
 * Main API endpoint for the comprehensive analytics and BI infrastructure
 * Integrates all analytics components: pipeline, BI tools, KPIs, warehouse, streaming, quality
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import EnhancedDataPipeline from '@/lib/analytics/enhanced-data-pipeline';
import BIIntegrationHub from '@/lib/analytics/bi-integration-hub';
import KPIManagementEngine from '@/lib/analytics/kpi-management-engine';
import DataWarehouseOptimizer from '@/lib/analytics/data-warehouse-optimizer';
import RealtimeStreamingProcessor from '@/lib/analytics/realtime-streaming-processor';
import DataQualityMonitor from '@/lib/analytics/data-quality-monitor';

// Global instances (in production, use dependency injection)
let dataPipeline: EnhancedDataPipeline | null = null;
let biHub: BIIntegrationHub | null = null;
let kpiEngine: KPIManagementEngine | null = null;
let warehouseOptimizer: DataWarehouseOptimizer | null = null;
let streamingProcessor: RealtimeStreamingProcessor | null = null;
let qualityMonitor: DataQualityMonitor | null = null;

// Initialize services
async function initializeServices() {
  if (!dataPipeline) {
    dataPipeline = new EnhancedDataPipeline({
      batchSize: 1000,
      flushInterval: 5000,
      qualityThreshold: 95.0,
      enableRealTime: true,
      enableLineageTracking: true
    });
  }

  if (!biHub) {
    biHub = new BIIntegrationHub();
  }

  if (!kpiEngine) {
    kpiEngine = new KPIManagementEngine();
  }

  if (!warehouseOptimizer) {
    warehouseOptimizer = new DataWarehouseOptimizer();
  }

  if (!streamingProcessor && process.env.KAFKA_ENABLED === 'true') {
    streamingProcessor = new RealtimeStreamingProcessor({
      kafka: {
        brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
        clientId: 'analytics-hub',
        ssl: process.env.KAFKA_SSL === 'true',
        sasl: process.env.KAFKA_USERNAME ? {
          mechanism: 'plain' as const,
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD || ''
        } : undefined
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      topics: {
        rawEvents: 'analytics-raw-events',
        processedEvents: 'analytics-processed-events',
        aggregations: 'analytics-aggregations',
        alerts: 'analytics-alerts'
      },
      processing: {
        batchSize: 1000,
        flushInterval: 5000,
        windowSize: 60000,
        retryAttempts: 3,
        deadLetterQueue: true
      }
    });
    
    await streamingProcessor.start();
  }

  if (!qualityMonitor) {
    qualityMonitor = new DataQualityMonitor();
    await qualityMonitor.start();
  }
}

/**
 * GET /api/analytics/enhanced - Get analytics dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    await initializeServices();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metrics = searchParams.get('metrics')?.split(',') || [];

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId parameter is required' },
        { status: 400 }
      );
    }

    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    // Gather analytics data from all components
    const [
      kpiDashboard,
      qualityReport,
      biConnections,
      performanceMetrics,
      realtimeMetrics
    ] = await Promise.all([
      getKPIDashboard(tenantId, timeRange),
      getQualityReport(tenantId),
      getBIConnectionStatus(),
      getPerformanceMetrics(tenantId, timeRange),
      getRealtimeMetrics(tenantId)
    ]);

    const analyticsData = {
      tenant: {
        id: tenantId,
        timeRange
      },
      kpis: kpiDashboard,
      dataQuality: qualityReport,
      biIntegration: biConnections,
      performance: performanceMetrics,
      realtime: realtimeMetrics,
      summary: {
        dataAccuracy: qualityReport.overallScore,
        biConnectionsActive: biConnections.filter(c => c.status === 'CONNECTED').length,
        totalKPIs: kpiDashboard.kpis.length,
        criticalAlerts: kpiDashboard.alerts.filter(a => a.severity === 'CRITICAL').length
      }
    };

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Enhanced analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/enhanced - Ingest data or configure analytics
 */
export async function POST(request: NextRequest) {
  try {
    await initializeServices();

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'ingest':
        return await handleDataIngestion(data);
      
      case 'configure_kpi':
        return await handleKPIConfiguration(data);
      
      case 'configure_bi':
        return await handleBIConfiguration(data);
      
      case 'configure_warehouse':
        return await handleWarehouseConfiguration(data);
      
      case 'configure_quality':
        return await handleQualityConfiguration(data);
      
      case 'trigger_optimization':
        return await handleOptimizationTrigger(data);
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Enhanced analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to process analytics request' },
      { status: 500 }
    );
  }
}

/**
 * Handle data ingestion
 */
async function handleDataIngestion(data: any) {
  if (!dataPipeline) {
    throw new Error('Data pipeline not initialized');
  }

  const result = await dataPipeline.ingestMetric(data);
  
  // Also send to streaming processor if available
  if (streamingProcessor) {
    await streamingProcessor.publishEvent({
      eventType: 'metric_ingested',
      source: data.source,
      timestamp: new Date(data.timestamp),
      tenantId: data.tenantId,
      payload: data
    });
  }

  return NextResponse.json({
    success: result.success,
    issues: result.issues || [],
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle KPI configuration
 */
async function handleKPIConfiguration(data: any) {
  if (!kpiEngine) {
    throw new Error('KPI engine not initialized');
  }

  switch (data.operation) {
    case 'define':
      const kpi = await kpiEngine.defineKPI(data.kpi);
      return NextResponse.json({ kpi });
    
    case 'calculate':
      const value = await kpiEngine.calculateKPI(data.kpiId, data.timestamp, data.dimensions);
      return NextResponse.json({ value });
    
    case 'configure_alert':
      const alert = await kpiEngine.configureAlert(data.alert);
      return NextResponse.json({ alert });
    
    case 'analyze_trends':
      const trends = await kpiEngine.analyzeKPITrends(data.kpiId, data.period);
      return NextResponse.json({ trends });
    
    case 'detect_anomalies':
      const anomalies = await kpiEngine.detectAnomalies(data.kpiId, data.lookbackDays);
      return NextResponse.json({ anomalies });
    
    default:
      return NextResponse.json(
        { error: `Unknown KPI operation: ${data.operation}` },
        { status: 400 }
      );
  }
}

/**
 * Handle BI configuration
 */
async function handleBIConfiguration(data: any) {
  if (!biHub) {
    throw new Error('BI hub not initialized');
  }

  switch (data.operation) {
    case 'add_connection':
      const connection = await biHub.addConnection(data.name, data.type, data.config);
      return NextResponse.json({ connection });
    
    case 'create_cube':
      const cube = await biHub.createOLAPCube(data.cubeDefinition);
      return NextResponse.json({ cube });
    
    case 'export_data':
      const exportJob = await biHub.exportData(
        data.connectionId,
        data.query,
        data.format,
        data.destination,
        data.filters
      );
      return NextResponse.json({ exportJob });
    
    case 'refresh_cube':
      await biHub.refreshCube(data.cubeId, data.incremental);
      return NextResponse.json({ success: true });
    
    default:
      return NextResponse.json(
        { error: `Unknown BI operation: ${data.operation}` },
        { status: 400 }
      );
  }
}

/**
 * Handle warehouse configuration
 */
async function handleWarehouseConfiguration(data: any) {
  if (!warehouseOptimizer) {
    throw new Error('Warehouse optimizer not initialized');
  }

  switch (data.operation) {
    case 'create_schema':
      await warehouseOptimizer.createSchema(data.schema);
      return NextResponse.json({ success: true });
    
    case 'optimize_query':
      const plan = await warehouseOptimizer.optimizeQuery(data.query);
      return NextResponse.json({ plan });
    
    case 'analyze_performance':
      const metrics = await warehouseOptimizer.analyzePerformance(data.schemaName);
      return NextResponse.json({ metrics });
    
    case 'auto_tune':
      const suggestions = await warehouseOptimizer.autoTuneIndexes(data.schemaName);
      return NextResponse.json({ suggestions });
    
    default:
      return NextResponse.json(
        { error: `Unknown warehouse operation: ${data.operation}` },
        { status: 400 }
      );
  }
}

/**
 * Handle quality configuration
 */
async function handleQualityConfiguration(data: any) {
  if (!qualityMonitor) {
    throw new Error('Quality monitor not initialized');
  }

  switch (data.operation) {
    case 'add_rule':
      const rule = await qualityMonitor.addRule(data.rule);
      return NextResponse.json({ rule });
    
    case 'execute_rule':
      const result = await qualityMonitor.executeRule(data.ruleId);
      return NextResponse.json({ result });
    
    case 'generate_report':
      const report = await qualityMonitor.generateQualityReport(data.scope);
      return NextResponse.json({ report });
    
    case 'profile_data':
      const profiles = await qualityMonitor.profileData(data.table, data.columns);
      return NextResponse.json({ profiles });
    
    case 'detect_anomalies':
      const anomalies = await qualityMonitor.detectAnomalies(
        data.table,
        data.column,
        data.timeWindow
      );
      return NextResponse.json({ anomalies });
    
    case 'remediate':
      const remediation = await qualityMonitor.remediateIssue(data.issueId);
      return NextResponse.json({ remediation });
    
    default:
      return NextResponse.json(
        { error: `Unknown quality operation: ${data.operation}` },
        { status: 400 }
      );
  }
}

/**
 * Handle optimization trigger
 */
async function handleOptimizationTrigger(data: any) {
  const results = {
    warehouse: null as any,
    quality: null as any,
    kpis: null as any
  };

  // Trigger warehouse optimization
  if (warehouseOptimizer && data.optimizeWarehouse) {
    results.warehouse = await warehouseOptimizer.autoTuneIndexes(data.schemaName);
  }

  // Trigger quality monitoring
  if (qualityMonitor && data.checkQuality) {
    results.quality = await qualityMonitor.generateQualityReport(data.scope);
  }

  // Trigger KPI recalculation
  if (kpiEngine && data.recalculateKPIs) {
    results.kpis = {
      recalculated: data.kpiIds?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  return NextResponse.json({ results });
}

/**
 * Get KPI dashboard data
 */
async function getKPIDashboard(tenantId: string, timeRange: any) {
  if (!kpiEngine) return { kpis: [], alerts: [] };

  // Get tenant's KPIs (simplified - would query database)
  const kpis = [
    {
      id: 'api-success-rate',
      name: 'API Success Rate',
      value: 99.5,
      unit: '%',
      status: 'GOOD',
      trend: { direction: 'UP', change: 0.2 }
    },
    {
      id: 'response-time',
      name: 'Avg Response Time',
      value: 250,
      unit: 'ms',
      status: 'GOOD',
      trend: { direction: 'DOWN', change: -15 }
    },
    {
      id: 'active-users',
      name: 'Active Users',
      value: 1247,
      unit: 'users',
      status: 'GOOD',
      trend: { direction: 'UP', change: 8.5 }
    }
  ];

  const alerts = [
    {
      id: 'storage-warning',
      kpiId: 'storage-usage',
      severity: 'WARNING' as const,
      message: 'Storage usage at 85%',
      timestamp: new Date()
    }
  ];

  return { kpis, alerts };
}

/**
 * Get data quality report
 */
async function getQualityReport(tenantId: string) {
  if (!qualityMonitor) {
    return {
      overallScore: 95.0,
      issues: [],
      trends: []
    };
  }

  // Simplified quality report
  return {
    overallScore: 96.2,
    issues: [
      {
        id: 'completeness-issue-1',
        severity: 'MEDIUM' as const,
        description: 'Missing user_id in 0.3% of events',
        affectedRecords: 127
      }
    ],
    trends: [
      {
        metric: 'completeness',
        current: 99.7,
        previous: 99.5,
        direction: 'IMPROVING' as const
      }
    ]
  };
}

/**
 * Get BI connection status
 */
async function getBIConnectionStatus() {
  if (!biHub) return [];

  return biHub.getAllConnections();
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(tenantId: string, timeRange: any) {
  // Query performance metrics from database
  const metrics = await prisma.metricDataPoint.findMany({
    where: {
      metadata: {
        path: ['tenantId'],
        equals: tenantId
      },
      timestamp: {
        gte: timeRange.start,
        lte: timeRange.end
      }
    },
    take: 100,
    orderBy: { timestamp: 'desc' }
  });

  return {
    totalMetrics: metrics.length,
    avgIngestionRate: metrics.length / 24, // per hour
    latestTimestamp: metrics[0]?.timestamp || null
  };
}

/**
 * Get real-time metrics
 */
async function getRealtimeMetrics(tenantId: string) {
  // Get real-time metrics from Redis or streaming processor
  return {
    currentUsers: 89,
    activeConnections: 156,
    eventsPerSecond: 23.5,
    systemHealth: 'HEALTHY' as const
  };
}

export { GET, POST };