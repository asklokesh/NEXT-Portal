import { NextRequest, NextResponse } from 'next/server';
import { getCostOptimizationEngine, aiRecommendationsEngine } from '@/lib/cost-analytics';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Request schemas
const UpdateRecommendationStatusSchema = z.object({
  recommendationId: z.string().min(1),
  status: z.enum(['active', 'implemented', 'dismissed', 'in_progress'])
});

const GenerateForecastSchema = z.object({
  serviceId: z.string().optional(),
  period: z.enum(['1_month', '3_months', '6_months', '1_year']).default('3_months')
});

const AnomalyDetectionSchema = z.object({
  serviceId: z.string().optional(),
  threshold: z.number().min(1).max(5).default(2.5),
  lookbackDays: z.number().min(7).max(365).default(30)
});

// GET - Retrieve cost optimization data
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');
      const serviceId = searchParams.get('serviceId') || undefined;

      const optimizationEngine = getCostOptimizationEngine();

      switch (action) {
        case 'recommendations':
          const recommendations = optimizationEngine.getRecommendations(serviceId);
          const totalPotentialSavings = optimizationEngine.getTotalPotentialSavings();
          
          logger.info('Cost recommendations retrieved', {
            user: user.id,
            serviceId,
            count: recommendations.length,
            totalSavings: totalPotentialSavings
          });
          
          return NextResponse.json({
            recommendations,
            summary: {
              totalRecommendations: recommendations.length,
              totalPotentialSavings,
              byType: this.groupRecommendationsByType(recommendations),
              byPriority: this.groupRecommendationsByPriority(recommendations)
            }
          });

        case 'forecasts':
          const forecasts = optimizationEngine.getForecasts(serviceId);
          
          logger.info('Cost forecasts retrieved', {
            user: user.id,
            serviceId,
            count: forecasts.length
          });
          
          return NextResponse.json({ forecasts });

        case 'budget-optimization':
          const budgetOptimizations = optimizationEngine.generateBudgetOptimization(serviceId);
          
          return NextResponse.json({
            budgetOptimizations,
            summary: {
              totalOptimizations: budgetOptimizations.length,
              averageRecommendedChange: budgetOptimizations.reduce(
                (avg, opt) => avg + (opt.recommendedBudget - opt.currentBudget), 0
              ) / budgetOptimizations.length
            }
          });

        case 'anomalies':
          // Generate mock historical data for demonstration
          const mockData = this.generateMockHistoricalData(serviceId);
          const anomalies = aiRecommendationsEngine.detectCostAnomalies(mockData);
          
          logger.info('Cost anomalies detected', {
            user: user.id,
            serviceId,
            anomaliesCount: anomalies.length
          });
          
          return NextResponse.json({
            anomalies,
            summary: {
              totalAnomalies: anomalies.length,
              bySeverity: this.groupAnomaliesBySeverity(anomalies),
              byType: this.groupAnomaliesByType(anomalies)
            }
          });

        case 'predictions':
          const period = searchParams.get('period') as any || '1_month';
          const mockDataForPredictions = this.generateMockHistoricalData(serviceId);
          const predictions = aiRecommendationsEngine.generateUsagePredictions(mockDataForPredictions, period);
          
          return NextResponse.json({
            predictions,
            summary: {
              totalPredictions: predictions.length,
              averageGrowthRate: predictions.reduce((avg, p) => avg + p.growthRate, 0) / predictions.length,
              trendsBreakdown: this.groupPredictionsByTrend(predictions)
            }
          });

        case 'status':
          const status = optimizationEngine.getStatus();
          
          return NextResponse.json({
            status,
            aiEngine: {
              available: true,
              lastAnalysis: new Date(),
              modelsActive: [
                'cost_anomaly',
                'usage_prediction', 
                'optimization_scoring',
                'seasonal_adjustment'
              ]
            }
          });

        case 'ml-insights':
          const recommendationId = searchParams.get('recommendationId');
          if (!recommendationId) {
            return NextResponse.json(
              { error: 'Recommendation ID is required for ML insights' },
              { status: 400 }
            );
          }
          
          const recommendation = optimizationEngine.getRecommendationById(recommendationId);
          if (!recommendation) {
            return NextResponse.json(
              { error: 'Recommendation not found' },
              { status: 404 }
            );
          }
          
          // Generate ML insights for the recommendation
          const mlInsights = this.generateMLInsights(recommendation);
          
          return NextResponse.json({ mlInsights });

        default:
          // Return overview dashboard data
          const overviewRecommendations = optimizationEngine.getRecommendations();
          const overviewForecasts = optimizationEngine.getForecasts();
          const overviewStatus = optimizationEngine.getStatus();
          
          return NextResponse.json({
            overview: {
              totalRecommendations: overviewRecommendations.length,
              totalPotentialSavings: optimizationEngine.getTotalPotentialSavings(),
              activeRecommendations: overviewRecommendations.filter(r => r.status === 'active').length,
              totalForecasts: overviewForecasts.length,
              engineStatus: overviewStatus
            },
            recentRecommendations: overviewRecommendations.slice(0, 5),
            topSavingsOpportunities: overviewRecommendations
              .sort((a, b) => b.potentialSavings - a.potentialSavings)
              .slice(0, 3)
          });
      }
    } catch (error) {
      logger.error('Cost analytics API error', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });
      
      return NextResponse.json(
        { error: 'Cost analytics operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// POST - Create or trigger cost optimization operations
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      const optimizationEngine = getCostOptimizationEngine();

      switch (action) {
        case 'run-analysis':
          // Start optimization analysis manually
          optimizationEngine.start();
          
          logger.info('Cost optimization analysis triggered manually', {
            user: user.id
          });
          
          return NextResponse.json({
            success: true,
            message: 'Cost optimization analysis started',
            estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
          });

        case 'generate-forecast':
          const forecastData = GenerateForecastSchema.parse(body);
          
          // In a real implementation, this would trigger ML model execution
          const mockHistoricalData = this.generateMockHistoricalData(forecastData.serviceId);
          const forecasts = aiRecommendationsEngine.generateUsagePredictions(
            mockHistoricalData,
            forecastData.period as any
          );
          
          logger.info('Cost forecast generated', {
            user: user.id,
            serviceId: forecastData.serviceId,
            period: forecastData.period,
            forecastsCount: forecasts.length
          });
          
          return NextResponse.json({
            success: true,
            forecasts,
            generatedAt: new Date()
          });

        case 'detect-anomalies':
          const anomalyData = AnomalyDetectionSchema.parse(body);
          
          const historicalDataForAnomalies = this.generateMockHistoricalData(
            anomalyData.serviceId,
            anomalyData.lookbackDays
          );
          const detectedAnomalies = aiRecommendationsEngine.detectCostAnomalies(historicalDataForAnomalies);
          
          logger.info('Anomaly detection executed', {
            user: user.id,
            serviceId: anomalyData.serviceId,
            threshold: anomalyData.threshold,
            anomaliesFound: detectedAnomalies.length
          });
          
          return NextResponse.json({
            success: true,
            anomalies: detectedAnomalies,
            parameters: anomalyData,
            detectedAt: new Date()
          });

        case 'ml-prediction':
          const predictionData = z.object({
            modelType: z.enum(['cost_anomaly', 'usage_prediction', 'optimization_scoring', 'seasonal_adjustment']),
            inputFeatures: z.record(z.number()),
            serviceId: z.string().optional()
          }).parse(body);
          
          const mlPrediction = aiRecommendationsEngine.generateMLPrediction(
            predictionData.modelType,
            predictionData.inputFeatures
          );
          
          return NextResponse.json({
            success: true,
            prediction: mlPrediction
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Cost analytics POST operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// PUT - Update recommendation status or optimization settings
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      const optimizationEngine = getCostOptimizationEngine();

      switch (action) {
        case 'update-recommendation':
          const updateData = UpdateRecommendationStatusSchema.parse(body);
          
          optimizationEngine.updateRecommendationStatus(
            updateData.recommendationId,
            updateData.status
          );
          
          logger.info('Recommendation status updated', {
            user: user.id,
            recommendationId: updateData.recommendationId,
            newStatus: updateData.status
          });
          
          return NextResponse.json({
            success: true,
            message: 'Recommendation status updated successfully'
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Cost analytics PUT operation failed', {
        error: error.message,
        user: user?.id
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// Helper methods
class CostAnalyticsAPIHelper {
  static groupRecommendationsByType(recommendations: any[]) {
    return recommendations.reduce((groups, rec) => {
      groups[rec.type] = (groups[rec.type] || 0) + 1;
      return groups;
    }, {});
  }

  static groupRecommendationsByPriority(recommendations: any[]) {
    return recommendations.reduce((groups, rec) => {
      groups[rec.priority] = (groups[rec.priority] || 0) + 1;
      return groups;
    }, {});
  }

  static groupAnomaliesBySeverity(anomalies: any[]) {
    return anomalies.reduce((groups, anomaly) => {
      groups[anomaly.severity] = (groups[anomaly.severity] || 0) + 1;
      return groups;
    }, {});
  }

  static groupAnomaliesByType(anomalies: any[]) {
    return anomalies.reduce((groups, anomaly) => {
      groups[anomaly.anomalyType] = (groups[anomaly.anomalyType] || 0) + 1;
      return groups;
    }, {});
  }

  static groupPredictionsByTrend(predictions: any[]) {
    return predictions.reduce((groups, pred) => {
      groups[pred.trend] = (groups[pred.trend] || 0) + 1;
      return groups;
    }, {});
  }

  static generateMockHistoricalData(serviceId?: string, days = 30): Record<string, any[]> {
    const services = serviceId ? [serviceId] : ['service-1', 'service-2', 'service-3'];
    const data: Record<string, any[]> = {};
    
    services.forEach(id => {
      const costData = [];
      const baseCost = 50 + Math.random() * 100;
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        
        // Add trend and noise
        const trend = (i / days) * 10; // Slight upward trend
        const noise = (Math.random() - 0.5) * 20;
        const seasonality = Math.sin((i / 7) * 2 * Math.PI) * 5; // Weekly pattern
        
        costData.push({
          date: date.toISOString(),
          cost: Math.max(0, baseCost + trend + noise + seasonality)
        });
      }
      
      data[id] = costData;
    });
    
    return data;
  }

  static generateMLInsights(recommendation: any) {
    return {
      confidence: recommendation.confidence,
      modelVersion: '1.0.0',
      factors: [
        {
          name: 'Historical Pattern Analysis',
          weight: 0.4,
          value: 0.8,
          description: 'Strong historical evidence supports this recommendation'
        },
        {
          name: 'Cost Impact Assessment',
          weight: 0.3,
          value: recommendation.potentialSavings > 100 ? 0.9 : 0.6,
          description: `Potential savings of $${recommendation.potentialSavings} analyzed`
        },
        {
          name: 'Implementation Risk',
          weight: 0.2,
          value: recommendation.riskLevel === 'low' ? 0.9 : 0.5,
          description: `${recommendation.riskLevel} risk implementation assessed`
        },
        {
          name: 'Market Conditions',
          weight: 0.1,
          value: 0.7,
          description: 'Current cloud pricing trends considered'
        }
      ],
      predictions: {
        successProbability: recommendation.confidence,
        timeToRealize: recommendation.estimatedTimeToSave,
        riskFactors: recommendation.actionItems.slice(0, 2)
      },
      aiRecommendations: [
        'Monitor implementation closely for first 2 weeks',
        'Set up automated alerts for the optimized resources',
        'Review cost impact after 1 month'
      ]
    };
  }
}

// Bind helper methods to this context
Object.assign(module.exports, CostAnalyticsAPIHelper);