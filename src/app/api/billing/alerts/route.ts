import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get billing alerts for the organization
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
    const acknowledged = searchParams.get('acknowledged') === 'true';
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: any = {
      organizationId
    };

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged;
    }

    if (severity) {
      where.severity = severity.toUpperCase();
    }

    if (type) {
      where.type = type.toUpperCase();
    }

    // Get alerts
    const alerts = await prisma.billingAlert.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Format alerts for frontend
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      message: alert.message,
      severity: alert.severity,
      threshold: parseFloat(alert.threshold.toString()),
      currentValue: parseFloat(alert.currentValue.toString()),
      acknowledged: alert.acknowledged,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString()
    }));

    return NextResponse.json({
      alerts: formattedAlerts
    });
  } catch (error) {
    console.error('Error fetching billing alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing alerts' },
      { status: 500 }
    );
  }
}

/**
 * Acknowledge billing alerts
 */
export async function POST(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    const userId = request.headers.get('x-user-id'); // Assuming you have user context
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { alertIds, acknowledgeAll } = body;

    let updateData: any = {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId
    };

    let where: any = {
      organizationId
    };

    if (acknowledgeAll) {
      // Acknowledge all unacknowledged alerts
      where.acknowledged = false;
    } else if (alertIds && Array.isArray(alertIds)) {
      // Acknowledge specific alerts
      where.id = { in: alertIds };
    } else {
      return NextResponse.json(
        { error: 'Either alertIds array or acknowledgeAll flag is required' },
        { status: 400 }
      );
    }

    // Update alerts
    const result = await prisma.billingAlert.updateMany({
      where,
      data: updateData
    });

    return NextResponse.json({
      acknowledgedCount: result.count,
      message: `${result.count} alert(s) acknowledged successfully`
    });
  } catch (error) {
    console.error('Error acknowledging alerts:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge alerts' },
      { status: 500 }
    );
  }
}

/**
 * Create a new billing alert (for internal use)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, type, threshold, currentValue, message, severity } = body;

    if (!organizationId || !type || !message) {
      return NextResponse.json(
        { error: 'Organization ID, type, and message are required' },
        { status: 400 }
      );
    }

    // Create alert
    const alert = await prisma.billingAlert.create({
      data: {
        organizationId,
        type: type.toUpperCase(),
        threshold: parseFloat(threshold || '0'),
        currentValue: parseFloat(currentValue || '0'),
        message,
        severity: (severity || 'WARNING').toUpperCase()
      }
    });

    return NextResponse.json({
      alert,
      message: 'Alert created successfully'
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
