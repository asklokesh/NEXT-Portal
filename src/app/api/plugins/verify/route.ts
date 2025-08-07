/**
 * Plugin Verification API Route
 * Provides comprehensive plugin validation and verification services
 */

import { NextRequest, NextResponse } from 'next/server';
import { pluginValidator } from '../../../../lib/plugins/PluginValidator';
import { backstageIntegration } from '../../../../lib/plugins/BackstageIntegration';
import { pluginTester } from '../../../../lib/testing/PluginTester';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, configuration, testEnvironment, validationType = 'full' } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    let validationResult;

    switch (validationType) {
      case 'quick':
        // Quick validation - basic checks only
        validationResult = await pluginValidator.validatePlugin(pluginId, configuration);
        break;

      case 'full':
        // Full validation including runtime checks
        try {
          validationResult = await backstageIntegration.verifyPlugin(pluginId);
        } catch (error) {
          // Fallback to local validation if Backstage integration fails
          console.warn('Backstage integration verification failed, falling back to local validation:', error);
          validationResult = await pluginValidator.validatePlugin(pluginId, configuration);
        }
        break;

      case 'test':
        // Test environment validation
        if (!testEnvironment) {
          return NextResponse.json(
            { error: 'Test environment ID is required for test validation' },
            { status: 400 }
          );
        }
        validationResult = await pluginTester.validatePluginInEnvironment(
          pluginId,
          testEnvironment,
          configuration
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid validation type. Use "quick", "full", or "test"' },
          { status: 400 }
        );
    }

    // Add additional metadata
    const response = {
      pluginId,
      validationType,
      timestamp: new Date().toISOString(),
      validation: validationResult,
      recommendations: generateRecommendations(validationResult),
      summary: {
        isValid: validationResult.isValid,
        score: validationResult.score,
        criticalErrors: validationResult.errors.filter(e => e.severity === 'critical').length,
        warnings: validationResult.warnings.length,
        compatibility: validationResult.compatibility.isCompatible
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Plugin verification failed:', error);
    return NextResponse.json(
      { 
        error: 'Plugin verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    // Get cached validation results
    const validationResult = await pluginValidator.validatePlugin(pluginId);

    const response = {
      pluginId,
      timestamp: new Date().toISOString(),
      validation: validationResult,
      summary: {
        isValid: validationResult.isValid,
        score: validationResult.score,
        lastChecked: validationResult.runtime.lastChecked
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to get plugin verification status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get verification status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate actionable recommendations based on validation results
 */
function generateRecommendations(validationResult: any): string[] {
  const recommendations: string[] = [];

  // Critical errors
  const criticalErrors = validationResult.errors.filter((e: any) => e.severity === 'critical');
  if (criticalErrors.length > 0) {
    recommendations.push('🚨 Critical issues must be resolved before deployment');
    criticalErrors.forEach((error: any) => {
      if (error.suggestedFix) {
        recommendations.push(`Fix: ${error.suggestedFix}`);
      }
    });
  }

  // Version compatibility
  if (!validationResult.compatibility.isCompatible) {
    recommendations.push('⚠️ Update Backstage to a compatible version or find an alternative plugin version');
  }

  // Configuration issues
  if (!validationResult.configuration.isValid) {
    recommendations.push('🔧 Review and fix configuration issues');
    if (validationResult.configuration.securityIssues.length > 0) {
      recommendations.push('🔒 Address security issues in configuration');
    }
  }

  // Performance optimizations
  if (validationResult.configuration.performance?.score < 80) {
    recommendations.push('⚡ Consider performance optimizations');
    validationResult.configuration.performance?.recommendations.forEach((rec: string) => {
      recommendations.push(`Performance: ${rec}`);
    });
  }

  // Runtime health
  if (!validationResult.runtime.isHealthy) {
    recommendations.push('🏥 Monitor plugin runtime health and address errors');
  }

  // Score-based recommendations
  if (validationResult.score < 70) {
    recommendations.push('📊 Plugin validation score is low - review all issues and warnings');
  } else if (validationResult.score < 90) {
    recommendations.push('📈 Good plugin health - address remaining warnings to improve score');
  } else {
    recommendations.push('✅ Excellent plugin health - ready for production use');
  }

  return recommendations;
}