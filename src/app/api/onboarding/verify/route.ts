/**
 * Email Verification API Route
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
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Initialize onboarding service
    const onboardingService = new OnboardingService(prisma, redis, logger);

    // Verify email and create account
    const result = await onboardingService.verifyEmailAndCreateAccount(token);

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      customerId: result.customerId,
      sessionId: result.sessionId,
      message: 'Email verified successfully'
    });

    // Set secure session cookie
    response.cookies.set('onboarding_session', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 // 24 hours
    });

    return response;
  } catch (error: any) {
    logger.error({ error }, 'Email verification failed');

    if (error.message === 'Invalid or expired verification token') {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Initialize onboarding service
    const onboardingService = new OnboardingService(prisma, redis, logger);

    // Verify email and create account
    const result = await onboardingService.verifyEmailAndCreateAccount(token);

    // Redirect to onboarding flow
    const redirectUrl = new URL('/onboarding/welcome', request.url);
    redirectUrl.searchParams.set('session', result.sessionId);

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    logger.error({ error }, 'Email verification failed');

    // Redirect to error page
    const errorUrl = new URL('/onboarding/error', request.url);
    errorUrl.searchParams.set('error', 'verification_failed');

    return NextResponse.redirect(errorUrl);
  }
}