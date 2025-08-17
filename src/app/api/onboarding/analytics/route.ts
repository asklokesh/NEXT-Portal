/**
 * Onboarding Analytics API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import { OnboardingService, AnalyticsTracker } from '@/services/onboarding';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = pino({ level: 'info' });

export async function GET(request: NextRequest) {
  try {
    // Check authorization (admin only)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';
    const type = searchParams.get('type') || 'overview';

    const analyticsTracker = new AnalyticsTracker(redis, logger);

    let data;

    switch (type) {
      case 'funnel':
        data = await analyticsTracker.getFunnelAnalytics(period as 'day' | 'week' | 'month');
        break;

      case 'attribution':
        const days = parseInt(searchParams.get('days') || '30');
        data = await analyticsTracker.getSourceAttribution(days);
        break;

      case 'health':
        const onboardingService = new OnboardingService(prisma, redis, logger);
        const organizationId = searchParams.get('organizationId');
        data = await onboardingService.getCustomerHealthScores(organizationId);
        break;

      case 'churn':
        const service = new OnboardingService(prisma, redis, logger);
        data = await service.identifyChurnRisk();
        break;

      default:
        // Get overview analytics
        const endDate = new Date();
        const startDate = new Date();
        
        if (period === 'day') {
          startDate.setDate(startDate.getDate() - 1);
        } else if (period === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else {
          startDate.setMonth(startDate.getMonth() - 1);
        }

        const onboarding = new OnboardingService(prisma, redis, logger);
        data = await onboarding.getOnboardingAnalytics(startDate, endDate);
    }

    return NextResponse.json({
      success: true,
      period,
      type,
      data
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to get analytics');

    return NextResponse.json(
      { error: 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}