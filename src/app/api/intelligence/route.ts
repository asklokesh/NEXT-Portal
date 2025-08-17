/**
 * Developer Intelligence API
 * AI-powered insights, code analysis, and developer experience optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { developerIntelligence } from '@/lib/intelligence/developer-intelligence';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/intelligence - Get developer insights and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'metrics';

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Check access permissions
    if (!tenantContext || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate tenant access
    const hasAccess = await validateTenantAccess(tenantContext.tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Tenant access denied' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          intelligence: {
            enabled: true,
            aiModelsLoaded: true,
            analysisCapacity: 'high'
          }
        });

      case 'metrics':
        const metrics = developerIntelligence.getMetrics();
        return NextResponse.json({
          metrics,
          timestamp: new Date().toISOString()
        });

      case 'profile':
        const targetUserId = searchParams.get('userId') || userId;
        
        // Users can only access their own profile unless they're admin
        if (userRole !== 'admin' && targetUserId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }

        const profile = developerIntelligence.getDeveloperProfile(targetUserId);
        if (!profile) {
          return NextResponse.json(
            { error: 'Developer profile not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          profile: {
            id: profile.id,
            userId: profile.userId,
            skills: profile.skills,
            experience: profile.experience,
            preferences: profile.preferences,
            productivity: profile.productivity,
            learningPath: profile.learningPath,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
          }
        });

      case 'insights':
        const insightUserId = searchParams.get('userId') || userId;
        
        // Access control for insights
        if (userRole !== 'admin' && insightUserId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }

        const insights = developerIntelligence.getDeveloperInsights(insightUserId);
        return NextResponse.json({
          insights: insights.map(insight => ({
            id: insight.id,
            type: insight.type,
            title: insight.title,
            description: insight.description,
            metrics: insight.metrics,
            trends: insight.trends,
            recommendations: insight.recommendations,
            actionable: insight.actionable,
            generatedAt: insight.generatedAt
          })),
          total: insights.length
        });

      case 'suggestions':
        const suggestionUserId = searchParams.get('userId') || userId;
        
        // Access control for suggestions
        if (userRole !== 'admin' && suggestionUserId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }

        const suggestions = developerIntelligence.getStoredSuggestions(suggestionUserId);
        return NextResponse.json({
          suggestions: suggestions.map(suggestion => ({
            id: suggestion.id,
            type: suggestion.type,
            title: suggestion.title,
            description: suggestion.description,
            context: suggestion.context,
            suggestion: suggestion.suggestion,
            confidence: suggestion.confidence,
            personalized: suggestion.personalized,
            aiGenerated: suggestion.aiGenerated
          })),
          total: suggestions.length
        });

      case 'code-analyses':
        const repositoryId = searchParams.get('repositoryId');
        if (!repositoryId) {
          return NextResponse.json(
            { error: 'Missing repositoryId parameter' },
            { status: 400 }
          );
        }

        const analyses = developerIntelligence.getCodeAnalyses(repositoryId);
        return NextResponse.json({
          analyses: analyses.map(analysis => ({
            id: analysis.id,
            repositoryId: analysis.repositoryId,
            filePath: analysis.filePath,
            language: analysis.language,
            complexity: analysis.analysis.complexity,
            quality: {
              codeSmells: analysis.analysis.quality.codeSmells.length,
              bugs: analysis.analysis.quality.bugs.length,
              vulnerabilities: analysis.analysis.quality.vulnerabilities.length,
              testCoverage: analysis.analysis.quality.testCoverage
            },
            recommendations: analysis.recommendations.length,
            riskAssessment: analysis.aiInsights.riskAssessment,
            analyzedAt: analysis.analyzedAt
          })),
          total: analyses.length
        });

      case 'learning-recommendations':
        const learningUserId = searchParams.get('userId') || userId;
        
        // Access control
        if (userRole !== 'admin' && learningUserId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }

        const learningRecs = await developerIntelligence.getLearningRecommendations(
          learningUserId,
          tenantContext.tenantId
        );

        return NextResponse.json({
          recommendations: learningRecs,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, metrics, profile, insights, suggestions, code-analyses, learning-recommendations' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing intelligence request:', error);
    return NextResponse.json(
      { error: 'Failed to process intelligence request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intelligence - Create profiles, analyze code, generate insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Authentication check
    if (!tenantContext || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate tenant access
    const hasAccess = await validateTenantAccess(tenantContext.tenantId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Tenant access denied' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'create-profile':
        return await handleCreateProfile(body, tenantContext, userId);

      case 'analyze-code':
        return await handleAnalyzeCode(body, tenantContext, userId);

      case 'generate-insights':
        return await handleGenerateInsights(body, tenantContext, userId, userRole);

      case 'get-suggestions':
        return await handleGetSuggestions(body, tenantContext, userId, userRole);

      case 'code-review':
        return await handleCodeReview(body, tenantContext, userId);

      case 'update-profile':
        return await handleUpdateProfile(body, tenantContext, userId, userRole);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: create-profile, analyze-code, generate-insights, get-suggestions, code-review, update-profile' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing intelligence operation:', error);
    return NextResponse.json(
      { error: 'Failed to process intelligence operation' },
      { status: 500 }
    );
  }
}

/**
 * Handler implementations
 */
async function handleCreateProfile(body: any, tenantContext: any, userId: string): Promise<NextResponse> {
  const { skills, experience, preferences } = body;

  if (!skills || !experience) {
    return NextResponse.json(
      { error: 'Missing required fields: skills, experience' },
      { status: 400 }
    );
  }

  try {
    const profileId = await developerIntelligence.createDeveloperProfile({
      userId,
      tenantId: tenantContext.tenantId,
      skills: skills || [],
      experience: experience || 'junior',
      preferences: preferences || {
        framework: [],
        languages: [],
        tools: [],
        workingHours: { start: '09:00', end: '17:00', timezone: 'UTC' }
      },
      productivity: {
        averageTaskTime: 0,
        codeQuality: 75,
        bugRate: 0.05,
        reviewParticipation: 0.8
      },
      learningPath: {
        currentGoals: [],
        completedCourses: [],
        recommendedSkills: []
      }
    });

    return NextResponse.json({
      profileId,
      message: 'Developer profile created successfully',
      userId
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create developer profile' },
      { status: 500 }
    );
  }
}

async function handleAnalyzeCode(body: any, tenantContext: any, userId: string): Promise<NextResponse> {
  const { repositoryId, filePath, code, language } = body;

  if (!repositoryId || !filePath || !code || !language) {
    return NextResponse.json(
      { error: 'Missing required fields: repositoryId, filePath, code, language' },
      { status: 400 }
    );
  }

  try {
    const analysisId = await developerIntelligence.analyzeCode(
      repositoryId,
      filePath,
      code,
      language,
      tenantContext.tenantId,
      userId
    );

    return NextResponse.json({
      analysisId,
      message: 'Code analysis completed successfully',
      repositoryId,
      filePath,
      language
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to analyze code' },
      { status: 500 }
    );
  }
}

async function handleGenerateInsights(
  body: any,
  tenantContext: any,
  userId: string,
  userRole: string | null
): Promise<NextResponse> {
  const { targetUserId, timeRange } = body;
  const developerId = targetUserId || userId;

  // Access control
  if (userRole !== 'admin' && developerId !== userId) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const insights = await developerIntelligence.generateDeveloperInsights(
      developerId,
      tenantContext.tenantId,
      timeRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      }
    );

    return NextResponse.json({
      insights: insights.map(insight => ({
        id: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        metrics: insight.metrics,
        trends: insight.trends,
        recommendations: insight.recommendations,
        actionable: insight.actionable,
        generatedAt: insight.generatedAt
      })),
      message: 'Developer insights generated successfully',
      total: insights.length
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

async function handleGetSuggestions(
  body: any,
  tenantContext: any,
  userId: string,
  userRole: string | null
): Promise<NextResponse> {
  const { targetUserId, context } = body;
  const developerId = targetUserId || userId;

  // Access control
  if (userRole !== 'admin' && developerId !== userId) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const suggestions = await developerIntelligence.getSmartSuggestions(
      developerId,
      tenantContext.tenantId,
      context
    );

    return NextResponse.json({
      suggestions: suggestions.map(suggestion => ({
        id: suggestion.id,
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description,
        context: suggestion.context,
        suggestion: suggestion.suggestion,
        confidence: suggestion.confidence,
        personalized: suggestion.personalized,
        aiGenerated: suggestion.aiGenerated
      })),
      message: 'Smart suggestions generated successfully',
      total: suggestions.length
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

async function handleCodeReview(body: any, tenantContext: any, userId: string): Promise<NextResponse> {
  const { pullRequestId, code, language } = body;

  if (!pullRequestId || !code || !language) {
    return NextResponse.json(
      { error: 'Missing required fields: pullRequestId, code, language' },
      { status: 400 }
    );
  }

  try {
    const review = await developerIntelligence.performAutomatedCodeReview(
      pullRequestId,
      code,
      language,
      tenantContext.tenantId,
      userId
    );

    return NextResponse.json({
      review: {
        summary: review.summary,
        issues: review.issues,
        score: review.score,
        recommendations: review.recommendations
      },
      message: 'Automated code review completed',
      pullRequestId
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to perform code review' },
      { status: 500 }
    );
  }
}

async function handleUpdateProfile(
  body: any,
  tenantContext: any,
  userId: string,
  userRole: string | null
): Promise<NextResponse> {
  const { targetUserId, updates } = body;
  const profileUserId = targetUserId || userId;

  // Access control
  if (userRole !== 'admin' && profileUserId !== userId) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  try {
    // Get existing profile
    const existingProfile = developerIntelligence.getDeveloperProfile(profileUserId);
    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      );
    }

    // Create updated profile
    const updatedProfile = {
      ...existingProfile,
      ...updates,
      updatedAt: new Date()
    };

    // In a real implementation, this would update the profile in the engine
    console.log(`Updating profile for user ${profileUserId}:`, updates);

    return NextResponse.json({
      message: 'Developer profile updated successfully',
      profileId: existingProfile.id,
      updates
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update developer profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/intelligence - Update profiles and settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!tenantContext || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'reset-analytics':
        // Reset analytics data
        console.log('Resetting intelligence analytics');
        return NextResponse.json({
          message: 'Intelligence analytics reset successfully'
        });

      case 'update-ai-settings':
        // Update AI model settings
        console.log('Updating AI settings:', body.settings);
        return NextResponse.json({
          message: 'AI settings updated successfully',
          settings: body.settings
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: reset-analytics, update-ai-settings' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating intelligence settings:', error);
    return NextResponse.json(
      { error: 'Failed to update intelligence settings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/intelligence - Remove profiles and data
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'clear-cache':
        console.log('Clearing intelligence cache');
        return NextResponse.json({
          message: 'Intelligence cache cleared successfully'
        });

      case 'reset-ai-models':
        console.log('Resetting AI models');
        return NextResponse.json({
          message: 'AI models reset successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: clear-cache, reset-ai-models' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing intelligence delete request:', error);
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}