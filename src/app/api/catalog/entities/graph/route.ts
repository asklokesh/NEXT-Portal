/**
 * Entity Graph API
 * Get entity relationships as a graph structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntityDiscoveryService } from '@/services/catalog/discovery';

export const dynamic = 'force-dynamic';

/**
 * GET /api/catalog/entities/graph
 * Get entity graph for visualization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rootRef = searchParams.get('rootRef');
    const direction = (searchParams.get('direction') as 'outbound' | 'inbound' | 'both') || 'both';
    const maxDepth = parseInt(searchParams.get('maxDepth') || '3', 10);
    const relationTypes = searchParams.get('relationTypes')?.split(',').filter(Boolean);
    const includeKinds = searchParams.get('includeKinds')?.split(',').filter(Boolean);
    const excludeKinds = searchParams.get('excludeKinds')?.split(',').filter(Boolean);

    if (!rootRef) {
      return NextResponse.json(
        { error: 'rootRef is required' },
        { status: 400 }
      );
    }

    const service = getEntityDiscoveryService();

    const graph = await service.getEntityGraph({
      rootRef,
      direction,
      maxDepth,
      relationTypes: relationTypes as any,
      includeKinds: includeKinds as any,
      excludeKinds: excludeKinds as any,
    });

    return NextResponse.json(graph);
  } catch (error) {
    console.error('Failed to get entity graph:', error);
    return NextResponse.json(
      { error: 'Failed to get entity graph' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/catalog/entities/graph
 * Get entity graph with complex query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = getEntityDiscoveryService();

    const graph = await service.getEntityGraph(body);

    return NextResponse.json(graph);
  } catch (error) {
    console.error('Failed to get entity graph:', error);
    return NextResponse.json(
      { error: 'Failed to get entity graph' },
      { status: 500 }
    );
  }
}
