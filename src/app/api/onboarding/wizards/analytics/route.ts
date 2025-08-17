/**
 * Wizard Analytics API
 * Provides insights and metrics on wizard usage and completion rates
 */

import { NextRequest, NextResponse } from 'next/server';
import WizardOrchestrator from '@/services/onboarding/WizardOrchestrator';

// Singleton orchestrator
let orchestrator: WizardOrchestrator;

function getOrchestrator(): WizardOrchestrator {
  if (!orchestrator) {
    orchestrator = new WizardOrchestrator();
  }
  return orchestrator;
}

// GET /api/onboarding/wizards/analytics - Get wizard analytics and metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wizardId = searchParams.get('wizardId');
    const timeframe = searchParams.get('timeframe') || '30d';
    const detailed = searchParams.get('detailed') === 'true';

    const orchestrator = getOrchestrator();

    if (wizardId) {
      // Get analytics for specific wizard
      const analytics = orchestrator.getWizardAnalytics(wizardId);
      const wizard = orchestrator.getWizard(wizardId);

      if (!wizard) {
        return NextResponse.json({
          success: false,
          error: 'Wizard not found'
        }, { status: 404 });
      }

      const response = {
        success: true,
        wizard: {
          id: wizard.id,
          name: wizard.name,
          category: wizard.category
        },
        analytics: {
          overview: {
            totalSessions: analytics.totalSessions,
            completedSessions: analytics.completedSessions,
            successRate: Math.round(analytics.successRate * 100) / 100,
            averageCompletionTime: Math.round(analytics.averageCompletionTime * 100) / 100
          },
          dropOffPoints: analytics.dropOffPoints,
          ...(detailed && {
            stepAnalytics: this.getStepAnalytics(wizard, analytics),
            timeAnalytics: this.getTimeAnalytics(wizardId, timeframe),
            userSegmentation: this.getUserSegmentation(wizardId)
          })
        }
      };

      return NextResponse.json(response);
    }

    // Get overall analytics for all wizards
    const allWizards = orchestrator.getAllWizards();
    const overallAnalytics = {
      totalWizards: allWizards.length,
      categories: {} as Record<string, any>,
      topPerforming: [] as any[],
      overallMetrics: {
        totalSessions: 0,
        totalCompletions: 0,
        averageSuccessRate: 0,
        averageCompletionTime: 0
      }
    };

    // Collect analytics for all wizards
    const wizardAnalytics = allWizards.map(wizard => {
      const analytics = orchestrator.getWizardAnalytics(wizard.id);
      return {
        wizard,
        analytics
      };
    });

    // Calculate category-based analytics
    wizardAnalytics.forEach(({ wizard, analytics }) => {
      const category = wizard.category;
      
      if (!overallAnalytics.categories[category]) {
        overallAnalytics.categories[category] = {
          wizardCount: 0,
          totalSessions: 0,
          totalCompletions: 0,
          averageSuccessRate: 0,
          wizards: []
        };
      }

      const categoryData = overallAnalytics.categories[category];
      categoryData.wizardCount++;
      categoryData.totalSessions += analytics.totalSessions;
      categoryData.totalCompletions += analytics.completedSessions;
      categoryData.wizards.push({
        id: wizard.id,
        name: wizard.name,
        sessions: analytics.totalSessions,
        completions: analytics.completedSessions,
        successRate: analytics.successRate
      });

      // Update overall metrics
      overallAnalytics.overallMetrics.totalSessions += analytics.totalSessions;
      overallAnalytics.overallMetrics.totalCompletions += analytics.completedSessions;
    });

    // Calculate average success rates
    Object.keys(overallAnalytics.categories).forEach(category => {
      const categoryData = overallAnalytics.categories[category];
      categoryData.averageSuccessRate = categoryData.totalSessions > 0 
        ? (categoryData.totalCompletions / categoryData.totalSessions) * 100
        : 0;
    });

    overallAnalytics.overallMetrics.averageSuccessRate = overallAnalytics.overallMetrics.totalSessions > 0
      ? (overallAnalytics.overallMetrics.totalCompletions / overallAnalytics.overallMetrics.totalSessions) * 100
      : 0;

    // Get top performing wizards
    overallAnalytics.topPerforming = wizardAnalytics
      .sort((a, b) => b.analytics.successRate - a.analytics.successRate)
      .slice(0, 5)
      .map(({ wizard, analytics }) => ({
        id: wizard.id,
        name: wizard.name,
        category: wizard.category,
        successRate: Math.round(analytics.successRate * 100) / 100,
        totalSessions: analytics.totalSessions,
        averageCompletionTime: Math.round(analytics.averageCompletionTime * 100) / 100
      }));

    return NextResponse.json({
      success: true,
      analytics: overallAnalytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get wizard analytics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get wizard analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper methods for detailed analytics
function getStepAnalytics(wizard: any, analytics: any) {
  return wizard.steps.map((step: any, index: number) => ({
    stepId: step.id,
    stepName: step.name,
    stepIndex: index,
    dropOffCount: analytics.dropOffPoints[step.id] || 0,
    dropOffRate: analytics.totalSessions > 0 
      ? ((analytics.dropOffPoints[step.id] || 0) / analytics.totalSessions) * 100 
      : 0,
    averageTimeSpent: this.getStepAverageTime(step.id), // Mock implementation
    completionRate: analytics.totalSessions > 0 
      ? Math.max(0, 100 - ((analytics.dropOffPoints[step.id] || 0) / analytics.totalSessions) * 100)
      : 0
  }));
}

function getTimeAnalytics(wizardId: string, timeframe: string) {
  // Mock time-based analytics
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const timeData = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    timeData.push({
      date: date.toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 20) + 1,
      completions: Math.floor(Math.random() * 15) + 1,
      averageTime: Math.floor(Math.random() * 30) + 10
    });
  }

  return timeData;
}

function getUserSegmentation(wizardId: string) {
  // Mock user segmentation data
  return {
    byRole: {
      admin: { sessions: 45, completions: 42, successRate: 93.3 },
      developer: { sessions: 128, completions: 98, successRate: 76.6 },
      viewer: { sessions: 23, completions: 18, successRate: 78.3 }
    },
    byExperience: {
      beginner: { sessions: 89, completions: 62, successRate: 69.7 },
      intermediate: { sessions: 78, completions: 68, successRate: 87.2 },
      advanced: { sessions: 29, completions: 28, successRate: 96.6 }
    },
    byOrganizationSize: {
      small: { sessions: 67, completions: 54, successRate: 80.6 },
      medium: { sessions: 89, completions: 74, successRate: 83.1 },
      large: { sessions: 40, completions: 30, successRate: 75.0 }
    }
  };
}

function getStepAverageTime(stepId: string): number {
  // Mock average time calculation
  return Math.floor(Math.random() * 300) + 60; // 1-5 minutes
}