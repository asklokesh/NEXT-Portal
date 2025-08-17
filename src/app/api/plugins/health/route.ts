import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    // Mock health data
    const mockHealthData = [
      {
        pluginId: '@backstage/plugin-catalog',
        status: 'healthy',
        healthScore: 98,
        uptime: '99.9%',
        responseTime: 45,
        errorRate: 0.1,
        lastCheck: new Date().toISOString(),
        metrics: {
          cpu: 12.5,
          memory: 156.7,
          requests: 1247,
          errors: 2
        },
        alerts: []
      },
      {
        pluginId: '@backstage/plugin-techdocs',
        status: 'healthy',
        healthScore: 95,
        uptime: '99.7%',
        responseTime: 67,
        errorRate: 0.3,
        lastCheck: new Date().toISOString(),
        metrics: {
          cpu: 8.2,
          memory: 98.3,
          requests: 892,
          errors: 3
        },
        alerts: []
      },
      {
        pluginId: '@backstage/plugin-kubernetes',
        status: 'warning',
        healthScore: 88,
        uptime: '99.2%',
        responseTime: 134,
        errorRate: 1.2,
        lastCheck: new Date().toISOString(),
        metrics: {
          cpu: 23.8,
          memory: 234.1,
          requests: 567,
          errors: 7
        },
        alerts: [
          {
            id: 'k8s-001',
            type: 'warning',
            message: 'High CPU usage detected',
            timestamp: new Date().toISOString()
          }
        ]
      }
    ];

    if (pluginId) {
      const pluginHealth = mockHealthData.find(h => h.pluginId === pluginId);
      if (!pluginHealth) {
        return NextResponse.json(
          { error: 'Plugin not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(pluginHealth);
    }

    return NextResponse.json({
      plugins: mockHealthData,
      summary: {
        total: mockHealthData.length,
        healthy: mockHealthData.filter(p => p.status === 'healthy').length,
        warning: mockHealthData.filter(p => p.status === 'warning').length,
        critical: mockHealthData.filter(p => p.status === 'critical').length,
        averageHealthScore: Math.round(mockHealthData.reduce((sum, p) => sum + p.healthScore, 0) / mockHealthData.length)
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { error: 'Failed to get health data' },
      { status: 500 }
    );
  }
}