import { NextRequest, NextResponse } from 'next/server';
import { advancedDiffEngine } from '@/services/version-comparison/advanced-diff-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const version = searchParams.get('version');

    if (!pluginId || !version) {
      return NextResponse.json({
        error: 'Missing required parameters: pluginId, version'
      }, { status: 400 });
    }

    // Analyze changelog for specific version
    const analysis = await advancedDiffEngine.analyzeChangelog(pluginId, version);

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        pluginId,
        version,
        analysisTimestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Changelog analysis error:', error);
    
    return NextResponse.json({
      error: 'Failed to analyze changelog',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      pluginId,
      versions = [],
      analysisType = 'comprehensive' // 'comprehensive' | 'breaking_changes' | 'security_updates'
    } = body;

    if (!pluginId) {
      return NextResponse.json({
        error: 'Missing required parameter: pluginId'
      }, { status: 400 });
    }

    let analysisResults = [];

    if (versions.length > 0) {
      // Analyze specific versions
      for (const version of versions) {
        try {
          const analysis = await advancedDiffEngine.analyzeChangelog(pluginId, version);
          analysisResults.push(analysis);
        } catch (error) {
          console.warn(`Failed to analyze changelog for ${pluginId}@${version}:`, error);
          analysisResults.push({
            pluginId,
            version,
            error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    } else {
      // Analyze all available versions - this would need implementation
      return NextResponse.json({
        error: 'Multiple version analysis not yet implemented'
      }, { status: 501 });
    }

    // Filter results based on analysis type
    if (analysisType === 'breaking_changes') {
      analysisResults = analysisResults.map(analysis => ({
        ...analysis,
        parsedChanges: analysis.parsedChanges?.filter(change => 
          change.category === 'breaking' || change.category === 'deprecation'
        )
      }));
    } else if (analysisType === 'security_updates') {
      analysisResults = analysisResults.map(analysis => ({
        ...analysis,
        parsedChanges: analysis.parsedChanges?.filter(change => 
          change.category === 'security'
        )
      }));
    }

    // Generate summary insights
    const summary = generateChangelogSummary(analysisResults);

    return NextResponse.json({
      success: true,
      results: analysisResults,
      summary,
      metadata: {
        pluginId,
        analysisType,
        versionsAnalyzed: versions.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch changelog analysis error:', error);
    
    return NextResponse.json({
      error: 'Failed to perform batch changelog analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function generateChangelogSummary(analyses: any[]) {
  const validAnalyses = analyses.filter(a => !a.error);
  
  if (validAnalyses.length === 0) {
    return {
      totalVersions: 0,
      changelogQuality: 'unknown',
      overallSentiment: 'neutral',
      breakingChangesCount: 0,
      securityUpdatesCount: 0,
      majorConcerns: []
    };
  }

  const breakingChangesCount = validAnalyses.reduce((count, analysis) => 
    count + (analysis.parsedChanges?.filter(c => c.category === 'breaking').length || 0), 0
  );

  const securityUpdatesCount = validAnalyses.reduce((count, analysis) => 
    count + (analysis.parsedChanges?.filter(c => c.category === 'security').length || 0), 0
  );

  // Calculate average changelog quality
  const qualityScores = { 'excellent': 4, 'good': 3, 'fair': 2, 'poor': 1 };
  const avgQualityScore = validAnalyses.reduce((sum, analysis) => 
    sum + (qualityScores[analysis.changelogQuality as keyof typeof qualityScores] || 1), 0
  ) / validAnalyses.length;

  const overallQuality = avgQualityScore >= 3.5 ? 'excellent' :
                        avgQualityScore >= 2.5 ? 'good' :
                        avgQualityScore >= 1.5 ? 'fair' : 'poor';

  // Determine overall sentiment
  const sentimentCounts = validAnalyses.reduce((counts, analysis) => {
    counts[analysis.sentiment] = (counts[analysis.sentiment] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const overallSentiment = Object.keys(sentimentCounts).reduce((a, b) => 
    sentimentCounts[a] > sentimentCounts[b] ? a : b
  );

  // Identify major concerns
  const majorConcerns = [];
  if (breakingChangesCount > 5) {
    majorConcerns.push(`High number of breaking changes (${breakingChangesCount})`);
  }
  if (securityUpdatesCount === 0) {
    majorConcerns.push('No security updates found');
  }
  if (overallQuality === 'poor') {
    majorConcerns.push('Poor changelog quality across versions');
  }

  return {
    totalVersions: validAnalyses.length,
    changelogQuality: overallQuality,
    overallSentiment,
    breakingChangesCount,
    securityUpdatesCount,
    majorConcerns,
    recommendations: generateRecommendations(breakingChangesCount, securityUpdatesCount, overallQuality)
  };
}

function generateRecommendations(
  breakingChangesCount: number,
  securityUpdatesCount: number,
  quality: string
): string[] {
  const recommendations = [];

  if (breakingChangesCount > 3) {
    recommendations.push('Consider staged migration approach due to multiple breaking changes');
  }

  if (securityUpdatesCount > 0) {
    recommendations.push('Prioritize versions with security updates');
  }

  if (quality === 'poor') {
    recommendations.push('Review plugin documentation and community resources for migration guidance');
  } else if (quality === 'excellent') {
    recommendations.push('Plugin maintains excellent changelog - migration should be straightforward');
  }

  if (recommendations.length === 0) {
    recommendations.push('No specific concerns identified - standard migration process recommended');
  }

  return recommendations;
}