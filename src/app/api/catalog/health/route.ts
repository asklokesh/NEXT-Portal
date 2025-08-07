import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceHealthMonitor } from '@/lib/health/ServiceHealthMonitor';
import { Entity } from '@/services/backstage/types/entities';

// GET /api/catalog/health - Get health metrics for entities
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityRefs = searchParams.get('entityRefs')?.split(',') || [];
    const type = searchParams.get('type') || 'health'; // health or quality

    // Fetch entities from catalog
    const entityPromises = entityRefs.map(async (entityRef) => {
      const [kind, namespaceAndName] = entityRef.split(':');
      const [namespace, name] = namespaceAndName.split('/');
      
      // In production, this would fetch from Backstage catalog API
      // For now, create mock entities
      const entity: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind,
        metadata: {
          name,
          namespace: namespace || 'default',
          uid: `${kind}-${name}`,
        },
        spec: {},
      };
      
      return entity;
    });

    const entities = await Promise.all(entityPromises);
    const monitor = new ServiceHealthMonitor();

    if (type === 'quality') {
      const qualityPromises = entities.map(entity => monitor.getServiceQuality(entity));
      const qualityResults = await Promise.all(qualityPromises);
      
      return NextResponse.json({
        success: true,
        type: 'quality',
        results: qualityResults,
      });
    } else {
      const healthPromises = entities.map(entity => monitor.getServiceHealth(entity));
      const healthResults = await Promise.all(healthPromises);
      
      return NextResponse.json({
        success: true,
        type: 'health',
        results: healthResults,
      });
    }
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health metrics' },
      { status: 500 }
    );
  }
}

// POST /api/catalog/health/fleet - Get fleet-wide health metrics
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entities } = body;

    if (!entities || !Array.isArray(entities)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const monitor = new ServiceHealthMonitor();
    const fleetHealth = await monitor.getFleetHealth(entities);

    return NextResponse.json({
      success: true,
      fleetHealth,
    });
  } catch (error) {
    console.error('Error fetching fleet health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fleet health' },
      { status: 500 }
    );
  }
}