/**
 * Trial Signup API Route
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
    
    // Validate required fields
    const { email, firstName, lastName, company, role } = body;
    
    if (!email || !firstName || !lastName || !company || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get source information from headers/query params
    const source = request.nextUrl.searchParams.get('utm_source') || 'organic';
    const referrer = request.headers.get('referer') || '';

    // Initialize onboarding service
    const onboardingService = new OnboardingService(prisma, redis, logger);

    // Start trial signup
    const result = await onboardingService.startTrialSignup({
      email,
      firstName,
      lastName,
      company,
      role,
      source,
      referrer
    });

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      message: 'Please check your email to verify your account'
    });
  } catch (error: any) {
    logger.error({ error }, 'Trial signup failed');
    
    if (error.message === 'Account already exists with this email') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}