import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const period = url.searchParams.get('period') || 'all'; // 'day', 'week', 'month', 'quarter', 'year', 'all'
    const category = url.searchParams.get('category'); // Filter by specific category

    // Check if plugin exists and user has access
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      select: {
        id: true,
        name: true,
        displayName: true,
        tenantId: true
      }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Multi-tenant access control
    if (tenantId && plugin.tenantId && plugin.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to this plugin quality history' },
        { status: 403 }
      );
    }

    // Calculate date filter based on period
    const now = new Date();
    let dateFilter: Date | undefined;
    
    switch (period) {
      case 'day':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = undefined;
    }

    // Fetch quality history
    const history = await prisma.pluginQualityHistory.findMany({
      where: {
        pluginId,
        tenantId: tenantId || plugin.tenantId,
        ...(dateFilter && { recordedAt: { gte: dateFilter } })
      },
      orderBy: { recordedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        qualityScore: {
          select: {
            id: true,
            evaluationEngine: true,
            confidenceLevel: true,
            dataQualityScore: true,
            passesMinimumStandards: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.pluginQualityHistory.count({
      where: {
        pluginId,
        tenantId: tenantId || plugin.tenantId,
        ...(dateFilter && { recordedAt: { gte: dateFilter } })
      }
    });

    // Calculate trend analysis
    const trendAnalysis = calculateTrendAnalysis(history);

    // Calculate score statistics
    const scoreStats = calculateScoreStatistics(history);

    // Prepare response data
    const historyData = history.map(entry => ({
      id: entry.id,
      recordedAt: entry.recordedAt,
      overallScore: entry.overallScore,
      overallGrade: entry.overallGrade,
      scoreChange: entry.scoreChange,
      changeReason: entry.changeReason,
      triggerEvent: entry.triggerEvent,
      pluginVersion: entry.pluginVersion,
      evaluationEngine: entry.evaluationEngine,
      
      // Category scores
      categoryScores: {
        security: entry.securityScore,
        performance: entry.performanceScore,
        maintainability: entry.maintainabilityScore,
        reliability: entry.reliabilityScore,
        documentation: entry.documentationScore
      },
      
      // Additional metadata from snapshot
      metadata: entry.snapshot ? 
        (typeof entry.snapshot === 'string' ? JSON.parse(entry.snapshot) : entry.snapshot) : 
        null,
      
      // Quality score metadata
      qualityScoreInfo: entry.qualityScore ? {
        evaluationEngine: entry.qualityScore.evaluationEngine,
        confidenceLevel: entry.qualityScore.confidenceLevel,
        dataQualityScore: entry.qualityScore.dataQualityScore,
        passesMinimumStandards: entry.qualityScore.passesMinimumStandards
      } : null
    }));

    // If category filter is requested, extract category-specific data
    let categoryTrend = null;
    if (category && isValidCategory(category)) {
      categoryTrend = calculateCategoryTrend(history, category);
    }

    const response = {
      plugin: {
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName
      },
      
      history: historyData,
      
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      
      period: period,
      dateRange: dateFilter ? {
        from: dateFilter.toISOString(),
        to: now.toISOString()
      } : null,
      
      // Trend analysis
      trend: trendAnalysis,
      
      // Score statistics
      statistics: scoreStats,
      
      // Category-specific trend (if requested)
      ...(categoryTrend && { categoryTrend })
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching plugin quality history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch plugin quality history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateTrendAnalysis(history: any[]) {
  if (history.length < 2) {
    return {
      direction: 'UNKNOWN',
      totalChange: 0,
      averageChange: 0,
      volatility: 0,
      evaluationCount: history.length
    };
  }

  const scores = history.map(h => h.overallScore).reverse(); // Oldest to newest
  const changes = [];
  
  for (let i = 1; i < scores.length; i++) {
    changes.push(scores[i] - scores[i - 1]);
  }

  const totalChange = scores[scores.length - 1] - scores[0];
  const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
  
  // Calculate volatility (standard deviation of changes)
  const meanChange = averageChange;
  const squaredDifferences = changes.map(change => Math.pow(change - meanChange, 2));
  const volatility = Math.sqrt(squaredDifferences.reduce((sum, sq) => sum + sq, 0) / changes.length);

  // Determine overall direction
  let direction = 'STABLE';
  if (Math.abs(averageChange) > 1) {
    direction = averageChange > 0 ? 'IMPROVING' : 'DECLINING';
  }

  return {
    direction,
    totalChange: Math.round(totalChange * 100) / 100,
    averageChange: Math.round(averageChange * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    evaluationCount: history.length,
    recentTrend: changes.slice(-3) // Last 3 changes
  };
}

function calculateScoreStatistics(history: any[]) {
  if (history.length === 0) {
    return {
      current: 0,
      highest: 0,
      lowest: 0,
      average: 0,
      median: 0,
      standardDeviation: 0
    };
  }

  const scores = history.map(h => h.overallScore);
  const current = scores[0]; // Most recent (first in desc order)
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  // Calculate median
  const sortedScores = [...scores].sort((a, b) => a - b);
  const median = sortedScores.length % 2 === 0 ?
    (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2 :
    sortedScores[Math.floor(sortedScores.length / 2)];
  
  // Calculate standard deviation
  const squaredDifferences = scores.map(score => Math.pow(score - average, 2));
  const standardDeviation = Math.sqrt(squaredDifferences.reduce((sum, sq) => sum + sq, 0) / scores.length);

  return {
    current: Math.round(current * 100) / 100,
    highest: Math.round(highest * 100) / 100,
    lowest: Math.round(lowest * 100) / 100,
    average: Math.round(average * 100) / 100,
    median: Math.round(median * 100) / 100,
    standardDeviation: Math.round(standardDeviation * 100) / 100
  };
}

function calculateCategoryTrend(history: any[], category: string) {
  const categoryField = `${category}Score`;
  
  const categoryScores = history
    .map(h => h[categoryField])
    .filter(score => score !== null && score !== undefined)
    .reverse(); // Oldest to newest

  if (categoryScores.length < 2) {
    return {
      category,
      direction: 'UNKNOWN',
      totalChange: 0,
      current: categoryScores[categoryScores.length - 1] || 0,
      scores: categoryScores
    };
  }

  const totalChange = categoryScores[categoryScores.length - 1] - categoryScores[0];
  const changes = [];
  
  for (let i = 1; i < categoryScores.length; i++) {
    changes.push(categoryScores[i] - categoryScores[i - 1]);
  }

  const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
  
  let direction = 'STABLE';
  if (Math.abs(averageChange) > 1) {
    direction = averageChange > 0 ? 'IMPROVING' : 'DECLINING';
  }

  return {
    category,
    direction,
    totalChange: Math.round(totalChange * 100) / 100,
    averageChange: Math.round(averageChange * 100) / 100,
    current: categoryScores[categoryScores.length - 1],
    highest: Math.max(...categoryScores),
    lowest: Math.min(...categoryScores),
    scores: categoryScores
  };
}

function isValidCategory(category: string): boolean {
  const validCategories = ['security', 'performance', 'maintainability', 'reliability', 'documentation'];
  return validCategories.includes(category.toLowerCase());
}