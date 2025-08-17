import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/billing/subscription-service';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth'; // Assuming you have an auth system

const prisma = new PrismaClient();

/**
 * Get current subscription for the authenticated organization
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user and organization
    // This would typically come from your authentication system
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      },
      include: {
        plan: true,
        organization: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        message: 'No active subscription found'
      });
    }

    // Format subscription data for frontend
    const formattedSubscription = {
      id: subscription.id,
      planName: subscription.plan.displayName,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      quantity: subscription.quantity,
      amount: parseFloat(subscription.plan.monthlyPrice.toString()),
      currency: subscription.plan.currency,
      trialEnd: subscription.trialEnd?.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeSubscriptionId: subscription.stripeSubscriptionId
    };

    return NextResponse.json({
      subscription: formattedSubscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

/**
 * Create a new subscription
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
    const { planTier, quantity, trialDays, paymentMethodId, couponCode } = body;

    if (!planTier || !quantity) {
      return NextResponse.json(
        { error: 'Plan tier and quantity are required' },
        { status: 400 }
      );
    }

    // Create subscription
    const subscription = await subscriptionService.createSubscription({
      organizationId,
      planTier,
      quantity: parseInt(quantity),
      trialDays: trialDays ? parseInt(trialDays) : undefined,
      paymentMethodId,
      couponCode
    });

    return NextResponse.json({
      subscription,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

/**
 * Update an existing subscription
 */
export async function PUT(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { subscriptionId, planTier, quantity, prorationBehavior } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify subscription belongs to organization
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId
      }
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Update subscription
    const subscription = await subscriptionService.updateSubscription({
      subscriptionId,
      planTier,
      quantity: quantity ? parseInt(quantity) : undefined,
      prorationBehavior
    });

    return NextResponse.json({
      subscription,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

/**
 * Cancel a subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const organizationId = request.headers.get('x-organization-id');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const cancelAtPeriodEnd = searchParams.get('cancelAtPeriodEnd') === 'true';
    const reason = searchParams.get('reason');

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify subscription belongs to organization
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId
      }
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Cancel subscription
    const subscription = await subscriptionService.cancelSubscription(
      subscriptionId,
      cancelAtPeriodEnd,
      reason || undefined
    );

    return NextResponse.json({
      subscription,
      message: cancelAtPeriodEnd 
        ? 'Subscription will be cancelled at the end of the billing period'
        : 'Subscription cancelled immediately'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
