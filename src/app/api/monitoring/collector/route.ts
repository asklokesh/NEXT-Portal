import { NextRequest, NextResponse } from 'next/server';
import { realMetricsCollector, RealMetricsConfig } from '@/lib/monitoring/RealMetricsCollector';
import { withAuth } from '@/lib/auth/middleware';

async function getHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const status = realMetricsCollector.getStatus();
    const config = realMetricsCollector.getConfig();
    
    return NextResponse.json({
      status,
      config: {
        // Return config without sensitive data
        refreshInterval: config.refreshInterval,
        enableBackstageMetrics: config.enableBackstageMetrics,
        enableSystemMetrics: config.enableSystemMetrics,
        sources: {
          prometheus: !!config.prometheus?.length,
          kubernetes: !!config.kubernetes,
          cloud: !!config.cloud?.length,
          apm: !!config.apm?.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching collector status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collector status' },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { action, config } = body;

    switch (action) {
      case 'start':
        await realMetricsCollector.start();
        return NextResponse.json({ success: true, message: 'Real metrics collection started' });
        
      case 'stop':
        realMetricsCollector.stop();
        return NextResponse.json({ success: true, message: 'Real metrics collection stopped' });
        
      case 'restart':
        realMetricsCollector.stop();
        await realMetricsCollector.start();
        return NextResponse.json({ success: true, message: 'Real metrics collection restarted' });
        
      case 'update_config':
        if (config) {
          await realMetricsCollector.updateConfig(config);
          return NextResponse.json({ success: true, message: 'Configuration updated' });
        }
        return NextResponse.json({ error: 'Config is required for update_config action' }, { status: 400 });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error controlling metrics collector:', error);
    return NextResponse.json(
      { error: 'Failed to control metrics collector' },
      { status: 500 }
    );
  }
}

// Apply auth middleware to require authentication for collector control
export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);