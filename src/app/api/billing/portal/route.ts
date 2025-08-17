import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/billing/stripe-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a Stripe billing portal session
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

    // Get organization with Stripe customer ID
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!organization.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this organization' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { returnUrl } = body;

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: returnUrl || `${request.headers.get('origin')}/billing`
    });

    return NextResponse.json({
      url: portalSession.url
    });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
