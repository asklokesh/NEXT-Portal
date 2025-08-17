/**
 * Complete Onboarding API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import { OnboardingService } from '@/services/onboarding';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = pino({ level: 'info' });

export async function POST(request: NextRequest) {
  try {
    // Get session from cookie or header
    const sessionId = request.cookies.get('onboarding_session')?.value ||
                     request.headers.get('x-onboarding-session');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Initialize onboarding service
    const onboardingService = new OnboardingService(prisma, redis, logger);

    // Complete onboarding
    const result = await onboardingService.completeOnboarding(sessionId);

    return NextResponse.json({
      success: true,
      customerId: result.customerId,
      organizationId: result.organizationId,
      healthScore: result.healthScore,
      message: 'Onboarding completed successfully'
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to complete onboarding');

    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}