import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Revenue sharing configuration schema
const RevenueShareConfigSchema = z.object({
  pluginId: z.string().min(1),
  revenueSharePercentage: z.number().min(0).max(100),
  minimumPayout: z.number().min(0).default(25), // Minimum $25 for payout
  payoutSchedule: z.enum(['weekly', 'monthly', 'quarterly']).default('monthly'),
  currency: z.string().length(3).default('USD'),
  stripeAccountId: z.string().optional() // Developer's Stripe Connect account
});

const PayoutRequestSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  description: z.string().optional()
});

const RevenueFiltersSchema = z.object({
  pluginId: z.string().optional(),
  developerId: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().length(3).default('USD')
});

// GET /api/marketplace/revenue - Get revenue data and analytics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(searchParams.entries());
    const filters = RevenueFiltersSchema.parse(rawFilters);

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Build date range filter
    const dateFilter: any = {};
    if (filters.startDate || filters.endDate) {
      dateFilter.createdAt = {};
      if (filters.startDate) dateFilter.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) dateFilter.createdAt.lte = new Date(filters.endDate);
    } else {
      // Default to current month if no dates specified
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFilter.createdAt = { gte: startOfMonth, lte: endOfMonth };
    }

    // Build where clause based on user permissions
    let salesWhere: any = { 
      status: 'COMPLETED',
      currency: filters.currency,
      ...dateFilter
    };

    // If not admin, only show user's plugins
    if (user.role !== 'ADMIN') {
      const userPlugins = await prisma.plugin.findMany({
        where: { author: user.id },
        select: { id: true }
      });
      const userPluginIds = userPlugins.map(p => p.id);

      salesWhere.marketplacePlugin = {
        plugin: {
          id: { in: userPluginIds }
        }
      };
    }

    if (filters.pluginId) {
      salesWhere.marketplacePlugin = {
        ...salesWhere.marketplacePlugin,
        pluginId: filters.pluginId
      };
    }

    if (filters.developerId) {
      salesWhere.marketplacePlugin = {
        ...salesWhere.marketplacePlugin,
        developerId: filters.developerId
      };
    }

    // Get sales data with detailed information
    const sales = await prisma.pluginSale.findMany({
      where: salesWhere,
      include: {
        marketplacePlugin: {
          include: {
            plugin: {
              select: {
                id: true,
                name: true,
                displayName: true,
                author: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate revenue metrics
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
    const totalCommission = sales.reduce((sum, sale) => sum + Number(sale.commission), 0);
    const developerRevenue = sales.reduce((sum, sale) => sum + Number(sale.netAmount), 0);

    // Group sales by plugin for plugin-level analytics
    const pluginRevenue = sales.reduce((acc, sale) => {
      const pluginId = sale.marketplacePlugin.plugin.id;
      if (!acc[pluginId]) {
        acc[pluginId] = {
          pluginId,
          pluginName: sale.marketplacePlugin.plugin.displayName,
          totalSales: 0,
          totalRevenue: 0,
          totalCommission: 0,
          developerRevenue: 0,
          saleCount: 0
        };
      }
      
      acc[pluginId].totalRevenue += Number(sale.amount);
      acc[pluginId].totalCommission += Number(sale.commission);
      acc[pluginId].developerRevenue += Number(sale.netAmount);
      acc[pluginId].saleCount += 1;
      
      return acc;
    }, {} as Record<string, any>);

    // Get payout history for the user/developer
    const payoutsWhere: any = { ...dateFilter };
    if (user.role !== 'ADMIN') {
      payoutsWhere.organizationId = user.id; // Simplified org mapping
    }

    const payouts = await prisma.developerPayout.findMany({
      where: payoutsWhere,
      orderBy: { createdAt: 'desc' },
      take: 10 // Latest 10 payouts
    });

    const totalPayouts = payouts.reduce((sum, payout) => sum + Number(payout.amount), 0);
    const pendingPayout = developerRevenue - totalPayouts;

    // Calculate time-series data based on period
    const timeSeries = await calculateTimeSeries(sales, filters.period);

    // Get top-performing plugins
    const topPlugins = Object.values(pluginRevenue)
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    const response = {
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalCommission,
          developerRevenue,
          totalPayouts,
          pendingPayout,
          totalSales: sales.length,
          currency: filters.currency,
          period: {
            startDate: dateFilter.createdAt?.gte || null,
            endDate: dateFilter.createdAt?.lte || null
          }
        },
        pluginBreakdown: Object.values(pluginRevenue),
        topPlugins,
        recentSales: sales.slice(0, 10).map(sale => ({
          id: sale.id,
          amount: Number(sale.amount),
          commission: Number(sale.commission),
          netAmount: Number(sale.netAmount),
          currency: sale.currency,
          createdAt: sale.createdAt.toISOString(),
          plugin: {
            id: sale.marketplacePlugin.plugin.id,
            name: sale.marketplacePlugin.plugin.displayName
          }
        })),
        payoutHistory: payouts.map(payout => ({
          id: payout.id,
          amount: Number(payout.amount),
          currency: payout.currency,
          status: payout.status,
          processedAt: payout.processedAt?.toISOString(),
          createdAt: payout.createdAt.toISOString(),
          notes: payout.notes
        })),
        timeSeries,
        analytics: {
          averageSaleAmount: sales.length > 0 ? totalRevenue / sales.length : 0,
          conversionRate: 0, // Would need plugin view data to calculate
          monthlyRecurringRevenue: 0, // For subscription-based plugins
          churnRate: 0, // For subscription-based plugins
          topCountries: [], // Would need buyer location data
          paymentMethods: [] // Would need payment method data from Stripe
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Revenue API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch revenue data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/marketplace/revenue - Request payout or update revenue sharing settings
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (action === 'request_payout') {
      const payoutData = PayoutRequestSchema.parse(body);

      // Calculate available balance
      const sales = await prisma.pluginSale.findMany({
        where: {
          status: 'COMPLETED',
          marketplacePlugin: {
            plugin: {
              author: user.id
            }
          }
        }
      });

      const totalEarned = sales.reduce((sum, sale) => sum + Number(sale.netAmount), 0);
      
      const previousPayouts = await prisma.developerPayout.findMany({
        where: {
          organizationId: user.id,
          status: { in: ['COMPLETED', 'PROCESSING'] }
        }
      });

      const totalPaid = previousPayouts.reduce((sum, payout) => sum + Number(payout.amount), 0);
      const availableBalance = totalEarned - totalPaid;

      if (payoutData.amount > availableBalance) {
        return NextResponse.json({
          success: false,
          error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} ${payoutData.currency}`
        }, { status: 400 });
      }

      if (payoutData.amount < 25) { // Minimum payout threshold
        return NextResponse.json({
          success: false,
          error: 'Minimum payout amount is $25.00'
        }, { status: 400 });
      }

      // Create payout request
      const payout = await prisma.developerPayout.create({
        data: {
          organizationId: user.id,
          period: new Date(), // Current period
          amount: payoutData.amount,
          currency: payoutData.currency,
          status: 'PENDING',
          notes: payoutData.description || `Payout request by ${user.name}`
        }
      });

      // In a real implementation, you would:
      // 1. Create a Stripe transfer to the developer's Connect account
      // 2. Handle webhooks to update the payout status
      // For now, we'll simulate this:

      // Simulate processing (in production, this would be handled by Stripe webhooks)
      setTimeout(async () => {
        try {
          await prisma.developerPayout.update({
            where: { id: payout.id },
            data: {
              status: 'PROCESSING',
              processedAt: new Date()
            }
          });

          // Create notification for developer
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'success',
              title: 'Payout Processing',
              message: `Your payout request of $${payoutData.amount} is being processed`,
              sourceName: 'Revenue System',
              sourceType: 'system'
            }
          });
        } catch (error) {
          console.error('Error updating payout status:', error);
        }
      }, 5000); // 5 seconds delay

      return NextResponse.json({
        success: true,
        data: {
          payoutId: payout.id,
          amount: Number(payout.amount),
          currency: payout.currency,
          status: payout.status,
          message: 'Payout request submitted successfully'
        }
      }, { status: 201 });

    } else if (action === 'update_revenue_share') {
      const config = RevenueShareConfigSchema.parse(body);

      // Verify user owns the plugin
      const plugin = await prisma.plugin.findFirst({
        where: {
          id: config.pluginId,
          author: user.id
        },
        include: {
          marketplacePlugin: true
        }
      });

      if (!plugin?.marketplacePlugin) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found or not owned by user'
        }, { status: 404 });
      }

      // Update revenue sharing configuration
      const updatedPlugin = await prisma.marketplacePlugin.update({
        where: { id: plugin.marketplacePlugin.id },
        data: {
          revenueShare: config.revenueSharePercentage,
          // Store additional config in metadata if needed
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          pluginId: config.pluginId,
          revenueShare: Number(updatedPlugin.revenueShare),
          message: 'Revenue sharing configuration updated successfully'
        }
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "request_payout" or "update_revenue_share"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Revenue action error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process revenue action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to calculate time series data
async function calculateTimeSeries(sales: any[], period: string) {
  const timeSeriesData: Record<string, { revenue: number, sales: number }> = {};
  
  sales.forEach(sale => {
    const date = new Date(sale.createdAt);
    let key: string;
    
    switch (period) {
      case 'day':
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'year':
        key = String(date.getFullYear());
        break;
      default:
        key = date.toISOString().split('T')[0];
    }
    
    if (!timeSeriesData[key]) {
      timeSeriesData[key] = { revenue: 0, sales: 0 };
    }
    
    timeSeriesData[key].revenue += Number(sale.amount);
    timeSeriesData[key].sales += 1;
  });
  
  // Convert to array and sort by date
  return Object.entries(timeSeriesData)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}