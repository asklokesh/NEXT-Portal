import { NextRequest, NextResponse } from 'next/server';

interface RevenueData {
  overview: {
    total_revenue: number;
    monthly_recurring_revenue: number;
    annual_recurring_revenue: number;
    growth_rate: number;
    churn_rate: number;
    average_revenue_per_user: number;
    lifetime_value: number;
  };
  subscription_tiers: {
    tier: string;
    name: string;
    price: number;
    subscribers: number;
    revenue: number;
    percentage: number;
  }[];
  monthly_trends: {
    month: string;
    revenue: number;
    new_customers: number;
    churned_customers: number;
    expansion_revenue: number;
    contraction_revenue: number;
  }[];
  revenue_by_feature: {
    feature: string;
    revenue: number;
    users: number;
    conversion_rate: number;
  }[];
  geographic_breakdown: {
    region: string;
    revenue: number;
    customers: number;
    percentage: number;
  }[];
  customer_segments: {
    segment: string;
    customers: number;
    revenue: number;
    avg_deal_size: number;
    growth_rate: number;
  }[];
  forecasting: {
    projected_monthly_revenue: number[];
    confidence_interval: {
      lower: number[];
      upper: number[];
    };
    key_assumptions: string[];
  };
}

// Mock data generator
function generateMockRevenueData(): RevenueData {
  const currentMonth = new Date().toLocaleString('default', { month: 'short' });
  const currentYear = new Date().getFullYear();
  
  // Generate monthly trends for the last 12 months
  const monthlyTrends = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    
    monthlyTrends.push({
      month,
      revenue: Math.floor(Math.random() * 50000) + 150000, // $150k - $200k
      new_customers: Math.floor(Math.random() * 30) + 20,
      churned_customers: Math.floor(Math.random() * 10) + 5,
      expansion_revenue: Math.floor(Math.random() * 20000) + 10000,
      contraction_revenue: Math.floor(Math.random() * 5000) + 2000
    });
  }

  // Generate forecasting data for next 6 months
  const projectedRevenue = [];
  const lowerBound = [];
  const upperBound = [];
  const baseRevenue = 175000;
  
  for (let i = 1; i <= 6; i++) {
    const growth = 1 + (0.05 * i); // 5% monthly growth
    const projected = Math.floor(baseRevenue * growth);
    const variance = projected * 0.15; // 15% variance
    
    projectedRevenue.push(projected);
    lowerBound.push(Math.floor(projected - variance));
    upperBound.push(Math.floor(projected + variance));
  }

  return {
    overview: {
      total_revenue: 2100000, // $2.1M
      monthly_recurring_revenue: 175000, // $175k MRR
      annual_recurring_revenue: 2100000, // $2.1M ARR
      growth_rate: 15.3, // 15.3% monthly growth
      churn_rate: 3.2, // 3.2% monthly churn
      average_revenue_per_user: 1250, // $1,250 ARPU
      lifetime_value: 15600 // $15,600 LTV
    },
    subscription_tiers: [
      {
        tier: 'starter',
        name: 'Starter Plan',
        price: 299,
        subscribers: 45,
        revenue: 13455,
        percentage: 7.7
      },
      {
        tier: 'professional',
        name: 'Professional Plan',
        price: 899,
        subscribers: 78,
        revenue: 70122,
        percentage: 40.1
      },
      {
        tier: 'enterprise',
        name: 'Enterprise Plan',
        price: 2499,
        subscribers: 33,
        revenue: 82467,
        percentage: 47.1
      },
      {
        tier: 'custom',
        name: 'Custom Solutions',
        price: 0, // Variable pricing
        subscribers: 4,
        revenue: 8956,
        percentage: 5.1
      }
    ],
    monthly_trends: monthlyTrends,
    revenue_by_feature: [
      {
        feature: 'Premium Templates',
        revenue: 45000,
        users: 89,
        conversion_rate: 23.5
      },
      {
        feature: 'Advanced Analytics',
        revenue: 67000,
        users: 156,
        conversion_rate: 41.2
      },
      {
        feature: 'Custom Integrations',
        revenue: 38000,
        users: 67,
        conversion_rate: 18.9
      },
      {
        feature: 'Priority Support',
        revenue: 25000,
        users: 45,
        conversion_rate: 15.3
      }
    ],
    geographic_breakdown: [
      {
        region: 'North America',
        revenue: 945000,
        customers: 87,
        percentage: 45.0
      },
      {
        region: 'Europe',
        revenue: 693000,
        customers: 56,
        percentage: 33.0
      },
      {
        region: 'Asia Pacific',
        revenue: 315000,
        customers: 23,
        percentage: 15.0
      },
      {
        region: 'Latin America',
        revenue: 105000,
        customers: 12,
        percentage: 5.0
      },
      {
        region: 'Other',
        revenue: 42000,
        customers: 8,
        percentage: 2.0
      }
    ],
    customer_segments: [
      {
        segment: 'Enterprise (1000+ employees)',
        customers: 25,
        revenue: 875000,
        avg_deal_size: 35000,
        growth_rate: 12.5
      },
      {
        segment: 'Mid-Market (200-999 employees)',
        customers: 45,
        revenue: 765000,
        avg_deal_size: 17000,
        growth_rate: 18.3
      },
      {
        segment: 'Small Business (50-199 employees)',
        customers: 67,
        revenue: 335000,
        avg_deal_size: 5000,
        growth_rate: 22.1
      },
      {
        segment: 'Startup (<50 employees)',
        customers: 89,
        revenue: 125000,
        avg_deal_size: 1400,
        growth_rate: 31.7
      }
    ],
    forecasting: {
      projected_monthly_revenue: projectedRevenue,
      confidence_interval: {
        lower: lowerBound,
        upper: upperBound
      },
      key_assumptions: [
        '5% monthly growth rate based on current trends',
        'Churn rate remains stable at 3.2%',
        'New customer acquisition continues at current pace',
        'Average deal size grows by 2% monthly',
        'No major competitive threats in forecast period'
      ]
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('time_range') || '12m';
    const segment = searchParams.get('segment') || 'all';
    const includeForecasting = searchParams.get('include_forecasting') === 'true';

    const revenueData = generateMockRevenueData();

    // Filter data based on time range
    if (timeRange === '6m') {
      revenueData.monthly_trends = revenueData.monthly_trends.slice(-6);
    } else if (timeRange === '3m') {
      revenueData.monthly_trends = revenueData.monthly_trends.slice(-3);
    }

    // Filter by customer segment if specified
    if (segment !== 'all') {
      revenueData.customer_segments = revenueData.customer_segments.filter(
        seg => seg.segment.toLowerCase().includes(segment.toLowerCase())
      );
    }

    // Remove forecasting data if not requested
    if (!includeForecasting) {
      delete revenueData.forecasting;
    }

    return NextResponse.json({
      success: true,
      data: revenueData,
      generated_at: new Date().toISOString(),
      time_range: timeRange,
      segment: segment
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'export_revenue_report':
        const format = params?.format || 'csv';
        const timeRange = params?.time_range || '12m';
        
        return NextResponse.json({
          success: true,
          message: `Revenue report export initiated in ${format} format`,
          download_url: `/api/admin/revenue/export?format=${format}&time_range=${timeRange}`,
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });

      case 'recalculate_metrics':
        // Simulate metric recalculation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return NextResponse.json({
          success: true,
          message: 'Revenue metrics recalculated successfully',
          updated_at: new Date().toISOString()
        });

      case 'update_forecasting':
        const assumptions = params?.assumptions || [];
        
        return NextResponse.json({
          success: true,
          message: 'Forecasting model updated with new assumptions',
          assumptions,
          model_version: `v${Date.now()}`,
          updated_at: new Date().toISOString()
        });

      case 'generate_cohort_analysis':
        return NextResponse.json({
          success: true,
          message: 'Cohort analysis generation started',
          analysis_id: `cohort-${Date.now()}`,
          estimated_completion: new Date(Date.now() + 600000).toISOString() // 10 minutes
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling revenue action:', error);
    return NextResponse.json(
      { error: 'Failed to process revenue action' },
      { status: 500 }
    );
  }
}