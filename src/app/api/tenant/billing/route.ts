/**
 * Tenant Billing API
 * Handles subscription management, billing, and payment processing
 */

import { NextRequest, NextResponse } from 'next/server';
import TenantBillingService, { UsageResourceType } from '@/services/billing/TenantBillingService';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights, checkSystemPermissions } from '@/lib/permissions/SystemPermissions';

/**
 * GET - Retrieve billing information and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetTenantId = searchParams.get('tenantId') || tenantContext.tenant.id;
    const section = searchParams.get('section'); // 'subscription', 'usage', 'invoices', 'analytics'
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Check permissions for cross-tenant access
    if (targetTenantId !== tenantContext.tenant.id) {
      const hasSystemAccess = await checkSystemPermissions(request, ['system:billing:read', 'admin:all']);
      if (!hasSystemAccess) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions for cross-tenant billing access'
        }, { status: 403 });
      }
    } else {
      // Check billing permissions for own tenant
      if (!tenantContext.permissions.includes('billing:read') && 
          !checkTenantAdminRights(tenantContext, targetTenantId)) {
        return NextResponse.json({
          success: false,
          error: 'Billing read permissions required'
        }, { status: 403 });
      }
    }

    const billingService = new TenantBillingService();
    await billingService.initializeWithRequest(request);

    let responseData;

    switch (section) {
      case 'subscription':
        responseData = await billingService.getTenantSubscription(targetTenantId);
        break;
        
      case 'analytics':
        responseData = await billingService.getBillingAnalytics(targetTenantId);
        break;
        
      case 'invoices':
        // Get invoices with optional date filtering
        const filters: any = { tenantId: targetTenantId };
        if (startDate && endDate) {
          filters.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate)
          };
        }
        
        responseData = await billingService['getInvoices'](filters, includeHistory);
        break;
        
      case 'usage':
        // Get current usage data
        responseData = await billingService['getCurrentUsage'](targetTenantId);
        break;
        
      default:
        // Return comprehensive billing information
        const [subscription, analytics] = await Promise.all([
          billingService.getTenantSubscription(targetTenantId),
          billingService.getBillingAnalytics(targetTenantId)
        ]);
        
        responseData = {
          subscription,
          analytics: analytics ? {
            currentUsage: analytics.currentUsage,
            projectedCosts: analytics.projectedCosts,
            alerts: analytics.alerts.filter(alert => !alert.isResolved),
            recommendations: analytics.recommendations
          } : null
        };
    }

    await billingService.disconnect();

    if (!responseData && section !== 'analytics') {
      return NextResponse.json({
        success: false,
        error: 'Billing information not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        tenantId: targetTenantId,
        section,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Billing retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve billing information'
    }, { status: 500 });
  }
}

/**
 * POST - Create subscription, record usage, or process payments
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      operation: { 
        type: 'text', 
        required: true, 
        enum: ['create_subscription', 'record_usage', 'process_payment', 'generate_invoice'] 
      },
      data: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data } = validation.sanitized;

    // Check billing permissions
    if (!tenantContext.permissions.includes('billing:write') && 
        !checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Billing write permissions required'
      }, { status: 403 });
    }

    const billingService = new TenantBillingService();
    await billingService.initializeWithRequest(request);

    let result;

    switch (operation) {
      case 'create_subscription':
        // Validate subscription data
        const subscriptionValidation = validateRequestBody(data, {
          planId: { type: 'text', required: true },
          trialDays: { type: 'number', required: false },
          paymentMethodId: { type: 'text', required: false },
          metadata: { type: 'json', required: false }
        });

        if (!subscriptionValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid subscription data',
            details: subscriptionValidation.errors
          }, { status: 400 });
        }

        result = await billingService.manageSubscription(
          tenantContext.tenant.id,
          subscriptionValidation.sanitized.planId,
          {
            trialDays: subscriptionValidation.sanitized.trialDays,
            paymentMethodId: subscriptionValidation.sanitized.paymentMethodId,
            metadata: subscriptionValidation.sanitized.metadata
          }
        );
        break;

      case 'record_usage':
        // Validate usage data
        const usageValidation = validateRequestBody(data, {
          resourceType: { type: 'text', required: true },
          quantity: { type: 'number', required: true },
          metadata: { type: 'json', required: false }
        });

        if (!usageValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid usage data',
            details: usageValidation.errors
          }, { status: 400 });
        }

        result = await billingService.recordUsage(
          tenantContext.tenant.id,
          usageValidation.sanitized.resourceType as UsageResourceType,
          usageValidation.sanitized.quantity,
          usageValidation.sanitized.metadata || {}
        );
        break;

      case 'process_payment':
        // Validate payment data
        const paymentValidation = validateRequestBody(data, {
          invoiceId: { type: 'text', required: true },
          paymentMethodId: { type: 'text', required: true },
          metadata: { type: 'json', required: false }
        });

        if (!paymentValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid payment data',
            details: paymentValidation.errors
          }, { status: 400 });
        }

        result = await billingService.processPayment(
          tenantContext.tenant.id,
          paymentValidation.sanitized.invoiceId,
          paymentValidation.sanitized.paymentMethodId,
          paymentValidation.sanitized.metadata || {}
        );
        break;

      case 'generate_invoice':
        // Validate invoice generation data
        const invoiceValidation = validateRequestBody(data, {
          billingPeriodStart: { type: 'text', required: true },
          billingPeriodEnd: { type: 'text', required: true }
        });

        if (!invoiceValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid invoice data',
            details: invoiceValidation.errors
          }, { status: 400 });
        }

        // Check system permissions for manual invoice generation
        const hasSystemAccess = await checkSystemPermissions(request, ['system:billing:write', 'admin:all']);
        if (!hasSystemAccess) {
          return NextResponse.json({
            success: false,
            error: 'System permissions required for manual invoice generation'
          }, { status: 403 });
        }

        result = await billingService.generateInvoice(
          tenantContext.tenant.id,
          {
            start: new Date(invoiceValidation.sanitized.billingPeriodStart),
            end: new Date(invoiceValidation.sanitized.billingPeriodEnd)
          }
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    await billingService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      operation,
      data: result,
      message: `${operation.replace('_', ' ')} completed successfully`
    });

  } catch (error) {
    console.error('Billing operation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform billing operation'
    }, { status: 500 });
  }
}

/**
 * PATCH - Update subscription or billing settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check billing admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for billing updates'
      }, { status: 403 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      operation: { 
        type: 'text', 
        required: true, 
        enum: ['update_subscription', 'update_payment_method', 'update_billing_settings'] 
      },
      data: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data } = validation.sanitized;
    const billingService = new TenantBillingService();
    await billingService.initializeWithRequest(request);

    let result;

    switch (operation) {
      case 'update_subscription':
        // Validate subscription update data
        const subscriptionValidation = validateRequestBody(data, {
          planId: { type: 'text', required: false },
          autoRenew: { type: 'boolean', required: false },
          metadata: { type: 'json', required: false }
        });

        if (!subscriptionValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid subscription update data',
            details: subscriptionValidation.errors
          }, { status: 400 });
        }

        if (subscriptionValidation.sanitized.planId) {
          // Plan change
          result = await billingService.manageSubscription(
            tenantContext.tenant.id,
            subscriptionValidation.sanitized.planId,
            { metadata: subscriptionValidation.sanitized.metadata }
          );
        } else {
          // Other subscription updates
          result = await billingService['updateSubscriptionSettings'](
            tenantContext.tenant.id,
            subscriptionValidation.sanitized
          );
        }
        break;

      case 'update_payment_method':
        // Validate payment method data
        const paymentMethodValidation = validateRequestBody(data, {
          paymentMethodId: { type: 'text', required: true },
          setAsDefault: { type: 'boolean', required: false }
        });

        if (!paymentMethodValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid payment method data',
            details: paymentMethodValidation.errors
          }, { status: 400 });
        }

        result = await billingService['updatePaymentMethod'](
          tenantContext.tenant.id,
          paymentMethodValidation.sanitized.paymentMethodId,
          paymentMethodValidation.sanitized.setAsDefault || false
        );
        break;

      case 'update_billing_settings':
        // Validate billing settings data
        const settingsValidation = validateRequestBody(data, {
          billingEmail: { type: 'email', required: false },
          billingAddress: { type: 'json', required: false },
          taxId: { type: 'text', required: false },
          invoicePrefix: { type: 'text', required: false }
        });

        if (!settingsValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid billing settings data',
            details: settingsValidation.errors
          }, { status: 400 });
        }

        result = await billingService['updateBillingSettings'](
          tenantContext.tenant.id,
          settingsValidation.sanitized
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    await billingService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      operation,
      data: result,
      message: `${operation.replace('_', ' ')} completed successfully`
    });

  } catch (error) {
    console.error('Billing update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update billing information'
    }, { status: 500 });
  }
}

/**
 * DELETE - Cancel subscription or delete billing data
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check billing admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for subscription cancellation'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || 'cancel_subscription';
    const immediate = searchParams.get('immediate') === 'true';
    const reason = searchParams.get('reason');
    const confirm = searchParams.get('confirm') === 'true';

    if (!confirm) {
      return NextResponse.json({
        success: false,
        error: 'Subscription cancellation requires confirmation'
      }, { status: 400 });
    }

    const billingService = new TenantBillingService();
    await billingService.initializeWithRequest(request);

    let result;

    switch (operation) {
      case 'cancel_subscription':
        result = await billingService.cancelSubscription(
          tenantContext.tenant.id,
          reason || 'User requested cancellation',
          immediate
        );
        break;

      case 'delete_billing_data':
        // Check system permissions for data deletion
        const hasSystemAccess = await checkSystemPermissions(request, ['system:billing:delete', 'super-admin:all']);
        if (!hasSystemAccess) {
          return NextResponse.json({
            success: false,
            error: 'System permissions required for billing data deletion'
          }, { status: 403 });
        }

        result = await billingService['deleteBillingData'](tenantContext.tenant.id);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    await billingService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      operation,
      data: result,
      message: `${operation.replace('_', ' ')} completed successfully`
    });

  } catch (error) {
    console.error('Billing deletion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform billing operation'
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}