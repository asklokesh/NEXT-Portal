import { NextRequest, NextResponse } from 'next/server';
import { usageService } from '@/lib/billing/usage-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get usage metrics for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const resourceType = searchParams.get('resourceType');

    let period: { start: Date; end: Date } | undefined;
    
    if (startDate && endDate) {
      period = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }

    // Get usage metrics
    const metrics = await usageService.getUsageMetrics(organizationId, period);

    // Get usage trends if requested
    const includeTrends = searchParams.get('includeTrends') === 'true';
    let trends = undefined;
    
    if (includeTrends) {
      trends = await usageService.getUsageTrends(
        organizationId,
        resourceType as any,
        30 // Last 30 days
      );
    }

    return NextResponse.json({
      ...metrics,
      trends
    });
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage metrics' },
      { status: 500 }
    );
  }
}

/**
 * Record usage for the organization
 */
export async function POST(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Handle single usage record
    if (body.resourceType && body.quantity !== undefined) {
      const usageRecord = await usageService.recordUsage({
        organizationId,
        resourceType: body.resourceType,
        quantity: parseFloat(body.quantity),
        metadata: body.metadata,
        timestamp: body.timestamp ? new Date(body.timestamp) : undefined
      });

      return NextResponse.json({
        usage: usageRecord,
        message: 'Usage recorded successfully'
      });
    }
    
    // Handle batch usage records
    if (Array.isArray(body.usageRecords)) {
      const usageRecords = body.usageRecords.map((record: any) => ({
        organizationId,
        resourceType: record.resourceType,
        quantity: parseFloat(record.quantity),
        metadata: record.metadata,
        timestamp: record.timestamp ? new Date(record.timestamp) : undefined
      }));

      const results = await usageService.recordBatchUsage(usageRecords);

      return NextResponse.json({
        usage: results,
        message: `${results.length} usage records created successfully`
      });
    }

    return NextResponse.json(
      { error: 'Invalid request format. Provide either resourceType/quantity or usageRecords array.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record usage' },
      { status: 500 }
    );
  }
}
