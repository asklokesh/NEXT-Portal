import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { catalogClient } from '@/services/backstage/clients/catalog.client';
import { ComplianceScanner } from '@/lib/security/ComplianceScanner';

// POST /api/catalog/compliance/scan - Run compliance scan on entities
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entityRefs, scanType = 'full' } = body;

    // Initialize scanner
    const scanner = new ComplianceScanner();

    // Fetch entities
    const entities = await catalogClient.getEntities();
    
    // Filter entities if specific refs provided
    let entitiesToScan = entities;
    if (entityRefs && Array.isArray(entityRefs) && entityRefs.length > 0) {
      entitiesToScan = entities.filter(entity => {
        const ref = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
        return entityRefs.includes(ref);
      });
    }

    // Run scan
    const results = await scanner.scanMultipleEntities(entitiesToScan);

    // Calculate summary statistics
    const summary = {
      totalScanned: results.length,
      averageScore: Math.round(
        results.reduce((sum, r) => sum + r.overallScore, 0) / results.length
      ),
      totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
      criticalViolations: results.reduce((sum, r) => 
        sum + r.violations.filter(v => v.severity === 'critical').length, 0
      ),
      highViolations: results.reduce((sum, r) => 
        sum + r.violations.filter(v => v.severity === 'high').length, 0
      ),
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      scanDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Compliance scan error:', error);
    return NextResponse.json(
      { error: 'Failed to run compliance scan' },
      { status: 500 }
    );
  }
}

// GET /api/catalog/compliance/scan - Get scan history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In a real implementation, this would fetch from a database
    // For now, return mock history
    const history = [
      {
        id: '1',
        scanDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        totalScanned: 45,
        averageScore: 78,
        totalViolations: 23,
      },
      {
        id: '2',
        scanDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        totalScanned: 45,
        averageScore: 75,
        totalViolations: 28,
      },
    ];

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Error fetching scan history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan history' },
      { status: 500 }
    );
  }
}