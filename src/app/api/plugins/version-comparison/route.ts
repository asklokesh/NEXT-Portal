import { NextRequest, NextResponse } from 'next/server';
import { advancedDiffEngine } from '@/services/version-comparison/advanced-diff-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const fromVersion = searchParams.get('fromVersion');
    const toVersion = searchParams.get('toVersion');

    if (!pluginId || !fromVersion || !toVersion) {
      return NextResponse.json({
        error: 'Missing required parameters: pluginId, fromVersion, toVersion'
      }, { status: 400 });
    }

    // Get version comparison
    const comparison = await advancedDiffEngine.compareVersions(
      pluginId,
      fromVersion,
      toVersion
    );

    return NextResponse.json({
      success: true,
      comparison,
      metadata: {
        pluginId,
        fromVersion,
        toVersion,
        generatedAt: new Date().toISOString(),
        analysisVersion: '2.0'
      }
    });

  } catch (error) {
    console.error('Version comparison error:', error);
    
    return NextResponse.json({
      error: 'Failed to compare versions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      pluginId,
      fromVersion,
      toVersion,
      includePerformanceAnalysis = true,
      includeMigrationGuide = true,
      includeRiskAssessment = true
    } = body;

    if (!pluginId || !fromVersion || !toVersion) {
      return NextResponse.json({
        error: 'Missing required parameters: pluginId, fromVersion, toVersion'
      }, { status: 400 });
    }

    // Get detailed version comparison
    const comparison = await advancedDiffEngine.compareVersions(
      pluginId,
      fromVersion,
      toVersion
    );

    // Optionally filter results based on request parameters
    let filteredComparison = { ...comparison };

    if (!includePerformanceAnalysis) {
      delete filteredComparison.performanceChanges;
    }

    if (!includeMigrationGuide) {
      filteredComparison.migrationPath = [];
    }

    if (!includeRiskAssessment) {
      delete filteredComparison.riskAssessment;
    }

    return NextResponse.json({
      success: true,
      comparison: filteredComparison,
      changelog: await advancedDiffEngine.analyzeChangelog(pluginId, toVersion),
      metadata: {
        pluginId,
        fromVersion,
        toVersion,
        analysisOptions: {
          includePerformanceAnalysis,
          includeMigrationGuide,
          includeRiskAssessment
        },
        generatedAt: new Date().toISOString(),
        analysisVersion: '2.0'
      }
    });

  } catch (error) {
    console.error('Detailed version comparison error:', error);
    
    return NextResponse.json({
      error: 'Failed to perform detailed version comparison',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}