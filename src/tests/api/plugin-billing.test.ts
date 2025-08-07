import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/plugin-billing/route';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');
const MockStripe = Stripe as jest.MockedClass<typeof Stripe>;

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'test-billing-id-12345')
  }))
}));

describe('Plugin Billing API', () => {
  let mockStripeInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Stripe mock
    mockStripeInstance = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
        retrieve: jest.fn().mockResolvedValue({ 
          id: 'cus_test123',
          email: 'test@example.com'
        })
      },
      products: {
        create: jest.fn().mockResolvedValue({ id: 'prod_test123' }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'prod_test123',
          name: 'Test Plugin'
        })
      },
      prices: {
        create: jest.fn().mockResolvedValue({ id: 'price_test123' }),
        list: jest.fn().mockResolvedValue({
          data: [{ id: 'price_test123', unit_amount: 1000 }]
        })
      },
      subscriptions: {
        create: jest.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'active',
          current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'active'
        }),
        update: jest.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'cancelled'
        })
      },
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test123',
          client_secret: 'pi_test123_secret',
          status: 'requires_payment_method'
        })
      },
      invoices: {
        list: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'inv_test123',
              amount_paid: 5000,
              created: Date.now() / 1000
            }
          ]
        })
      },
      charges: {
        create: jest.fn().mockResolvedValue({
          id: 'ch_test123',
          amount: 1000,
          status: 'succeeded'
        })
      },
      subscriptionItems: {
        createUsageRecord: jest.fn().mockResolvedValue({
          id: 'mbur_test123',
          quantity: 100
        })
      }
    };

    MockStripe.mockImplementation(() => mockStripeInstance as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/plugin-billing', () => {
    describe('Subscription Management', () => {
      it('should create a new subscription successfully', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_subscription',
            customerId: 'cus_test123',
            pluginId: 'premium-plugin',
            plan: 'professional',
            paymentMethodId: 'pm_test123'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.subscription).toBeDefined();
        expect(data.subscription.id).toBe('sub_test123');
        expect(mockStripeInstance.subscriptions.create).toHaveBeenCalled();
      });

      it('should handle subscription creation failure', async () => {
        mockStripeInstance.subscriptions.create.mockRejectedValue(
          new Error('Payment method declined')
        );

        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_subscription',
            customerId: 'cus_test123',
            pluginId: 'premium-plugin',
            plan: 'professional'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to process billing request');
      });

      it('should cancel a subscription', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'cancel_subscription',
            subscriptionId: 'sub_test123'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
          'sub_test123',
          expect.objectContaining({ cancel_at_period_end: true })
        );
      });

      it('should update subscription plan', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_subscription',
            subscriptionId: 'sub_test123',
            newPlan: 'enterprise'
          })
        });

        mockStripeInstance.subscriptions.update.mockResolvedValue({
          id: 'sub_test123',
          status: 'active',
          items: { data: [{ price: { id: 'price_enterprise' } }] }
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockStripeInstance.subscriptions.update).toHaveBeenCalled();
      });
    });

    describe('Usage-Based Billing', () => {
      it('should record usage for metered billing', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'record_usage',
            subscriptionItemId: 'si_test123',
            quantity: 1000,
            timestamp: Date.now() / 1000
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockStripeInstance.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
          'si_test123',
          expect.objectContaining({
            quantity: 1000
          })
        );
      });

      it('should handle usage recording errors', async () => {
        mockStripeInstance.subscriptionItems.createUsageRecord.mockRejectedValue(
          new Error('Invalid subscription item')
        );

        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'record_usage',
            subscriptionItemId: 'si_invalid',
            quantity: 1000
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
      });
    });

    describe('Commission Calculation', () => {
      it('should calculate commission correctly for different tiers', async () => {
        const testCases = [
          { revenue: 500, expectedRate: 0.30, expectedCommission: 150 },
          { revenue: 5000, expectedRate: 0.25, expectedCommission: 1250 },
          { revenue: 25000, expectedRate: 0.20, expectedCommission: 5000 },
          { revenue: 100000, expectedRate: 0.15, expectedCommission: 15000 }
        ];

        for (const testCase of testCases) {
          const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
            method: 'POST',
            body: JSON.stringify({
              action: 'calculate_commission',
              pluginId: 'test-plugin',
              revenue: testCase.revenue
            })
          });

          const response = await POST(mockRequest);
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.commission.rate).toBe(testCase.expectedRate);
          expect(data.commission.amount).toBe(testCase.expectedCommission);
        }
      });

      it('should track lifetime revenue for commission tier calculation', async () => {
        // First sale - 30% commission
        let mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_payment',
            pluginId: 'lifetime-plugin',
            amount: 1000,
            customerId: 'cus_test123'
          })
        });

        let response = await POST(mockRequest);
        let data = await response.json();

        expect(data.commission).toBe(300); // 30% of 1000

        // Second sale - should move to 25% tier
        mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_payment',
            pluginId: 'lifetime-plugin',
            amount: 500,
            customerId: 'cus_test456'
          })
        });

        response = await POST(mockRequest);
        data = await response.json();

        // Commission should be calculated at new tier
        expect(data.commission).toBe(125); // 25% of 500
      });
    });

    describe('Payment Processing', () => {
      it('should process one-time payment successfully', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_payment',
            pluginId: 'onetime-plugin',
            amount: 4999,
            currency: 'usd',
            customerId: 'cus_test123',
            paymentMethodId: 'pm_test123'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.payment).toBeDefined();
        expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 4999,
            currency: 'usd'
          })
        );
      });

      it('should handle payment failure gracefully', async () => {
        mockStripeInstance.paymentIntents.create.mockRejectedValue(
          new Error('Card declined')
        );

        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_payment',
            pluginId: 'failed-plugin',
            amount: 4999,
            customerId: 'cus_test123'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to process billing request');
      });
    });

    describe('Refund Processing', () => {
      it('should process refund and adjust commission', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_refund',
            paymentId: 'pi_test123',
            amount: 1000,
            reason: 'requested_by_customer'
          })
        });

        mockStripeInstance.refunds = {
          create: jest.fn().mockResolvedValue({
            id: 'refund_test123',
            amount: 1000,
            status: 'succeeded'
          })
        };

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.refund).toBeDefined();
        expect(data.commissionAdjustment).toBeDefined();
      });

      it('should handle partial refunds', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'process_refund',
            paymentId: 'pi_test123',
            amount: 500, // Partial refund
            originalAmount: 1000
          })
        });

        mockStripeInstance.refunds = {
          create: jest.fn().mockResolvedValue({
            id: 'refund_test123',
            amount: 500,
            status: 'succeeded'
          })
        };

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.refund.amount).toBe(500);
      });
    });

    describe('Invoice Management', () => {
      it('should generate invoice for subscription', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'generate_invoice',
            subscriptionId: 'sub_test123',
            customerId: 'cus_test123'
          })
        });

        mockStripeInstance.invoices.create = jest.fn().mockResolvedValue({
          id: 'inv_new123',
          amount_due: 5000,
          status: 'draft'
        });

        mockStripeInstance.invoices.finalizeInvoice = jest.fn().mockResolvedValue({
          id: 'inv_new123',
          status: 'open'
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.invoice).toBeDefined();
      });

      it('should retrieve invoice history', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'get_invoices',
            customerId: 'cus_test123',
            limit: 10
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.invoices).toBeDefined();
        expect(Array.isArray(data.invoices)).toBe(true);
      });
    });

    describe('Pricing Plans', () => {
      it('should create tiered pricing plans', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_pricing',
            pluginId: 'tiered-plugin',
            pricing: {
              free: { price: 0, features: ['basic'] },
              starter: { price: 10, features: ['basic', 'support'] },
              professional: { price: 50, features: ['all', 'priority'] },
              enterprise: { price: 'custom', features: ['everything'] }
            }
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.pricing).toBeDefined();
        expect(mockStripeInstance.products.create).toHaveBeenCalled();
        expect(mockStripeInstance.prices.create).toHaveBeenCalled();
      });

      it('should update existing pricing', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_pricing',
            pluginId: 'existing-plugin',
            priceId: 'price_test123',
            newPrice: 75
          })
        });

        mockStripeInstance.prices.update = jest.fn().mockResolvedValue({
          id: 'price_test123_new',
          unit_amount: 7500
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe('Analytics and Reporting', () => {
      it('should generate revenue report', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'revenue_report',
            pluginId: 'analytics-plugin',
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.report).toBeDefined();
        expect(data.report.totalRevenue).toBeDefined();
        expect(data.report.totalCommission).toBeDefined();
        expect(data.report.netRevenue).toBeDefined();
      });

      it('should calculate MRR (Monthly Recurring Revenue)', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'calculate_mrr',
            pluginId: 'mrr-plugin'
          })
        });

        mockStripeInstance.subscriptions.list = jest.fn().mockResolvedValue({
          data: [
            { id: 'sub1', status: 'active', items: { data: [{ price: { unit_amount: 5000 } }] } },
            { id: 'sub2', status: 'active', items: { data: [{ price: { unit_amount: 10000 } }] } },
            { id: 'sub3', status: 'cancelled', items: { data: [{ price: { unit_amount: 5000 } }] } }
          ]
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.mrr).toBe(150); // $50 + $100, excluding cancelled
      });

      it('should track churn rate', async () => {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
          method: 'POST',
          body: JSON.stringify({
            action: 'churn_analysis',
            pluginId: 'churn-plugin',
            period: 'monthly'
          })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.churnRate).toBeDefined();
        expect(data.customerRetention).toBeDefined();
      });
    });
  });

  describe('GET /api/plugin-billing', () => {
    it('should retrieve billing details for a plugin', async () => {
      const mockRequest = new NextRequest(
        'http://localhost:3000/api/plugin-billing?pluginId=test-plugin'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.billing).toBeDefined();
    });

    it('should retrieve subscription status', async () => {
      const mockRequest = new NextRequest(
        'http://localhost:3000/api/plugin-billing?subscriptionId=sub_test123'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockStripeInstance.subscriptions.retrieve).toHaveBeenCalledWith('sub_test123');
    });

    it('should retrieve payment history', async () => {
      const mockRequest = new NextRequest(
        'http://localhost:3000/api/plugin-billing?customerId=cus_test123&type=payments'
      );

      mockStripeInstance.paymentIntents = {
        list: jest.fn().mockResolvedValue({
          data: [
            { id: 'pi_1', amount: 5000, created: Date.now() / 1000 },
            { id: 'pi_2', amount: 10000, created: Date.now() / 1000 - 86400 }
          ]
        })
      };

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payments).toBeDefined();
      expect(data.payments.length).toBe(2);
    });

    it('should handle missing parameters', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required parameters');
    });
  });

  describe('Webhook Handling', () => {
    it('should handle successful payment webhook', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        headers: {
          'stripe-signature': 'valid-signature'
        },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test123',
              amount: 5000,
              metadata: {
                pluginId: 'webhook-plugin',
                customerId: 'cus_test123'
              }
            }
          }
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Webhook processing would update internal state
    });

    it('should handle subscription cancelled webhook', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        headers: {
          'stripe-signature': 'valid-signature'
        },
        body: JSON.stringify({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_test123',
              metadata: {
                pluginId: 'cancelled-plugin'
              }
            }
          }
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Would trigger cancellation logic
    });
  });

  describe('Free Trial Management', () => {
    it('should create subscription with free trial', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_subscription',
          customerId: 'cus_test123',
          pluginId: 'trial-plugin',
          plan: 'professional',
          trialDays: 14
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockStripeInstance.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trial_period_days: 14
        })
      );
    });

    it('should convert trial to paid subscription', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        body: JSON.stringify({
          action: 'convert_trial',
          subscriptionId: 'sub_trial123',
          paymentMethodId: 'pm_test123'
        })
      });

      mockStripeInstance.subscriptions.update.mockResolvedValue({
        id: 'sub_trial123',
        status: 'active',
        trial_end: null
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('converted to paid');
    });
  });

  describe('Coupon and Discount Management', () => {
    it('should apply coupon to subscription', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        body: JSON.stringify({
          action: 'apply_coupon',
          subscriptionId: 'sub_test123',
          couponCode: 'SAVE20'
        })
      });

      mockStripeInstance.coupons = {
        retrieve: jest.fn().mockResolvedValue({
          id: 'SAVE20',
          percent_off: 20,
          valid: true
        })
      };

      mockStripeInstance.subscriptions.update.mockResolvedValue({
        id: 'sub_test123',
        discount: {
          coupon: { id: 'SAVE20', percent_off: 20 }
        }
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.discount.percent_off).toBe(20);
    });

    it('should validate coupon before applying', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-billing', {
        method: 'POST',
        body: JSON.stringify({
          action: 'validate_coupon',
          couponCode: 'EXPIRED'
        })
      });

      mockStripeInstance.coupons = {
        retrieve: jest.fn().mockRejectedValue(new Error('No such coupon'))
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid coupon');
    });
  });
});