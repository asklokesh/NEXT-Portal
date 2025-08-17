/**
 * AiKA (AI Knowledge Assistant) API
 * AI-powered assistance for platform engineering tasks
 * Enhanced with Premium Features Manager integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { premiumFeaturesManager } from '@/lib/premium/PremiumFeaturesManager';
import { premiumPerformanceOptimizer } from '@/lib/premium/PremiumPerformanceOptimizer';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Initialize Premium Features Manager
    await premiumFeaturesManager.initialize();
    
    const searchParams = new URL(req.url).searchParams;
    const action = searchParams.get('action');
    
    // Use performance optimizer for all operations
    const result = await premiumPerformanceOptimizer.optimizeOperation(
      'aika',
      action || 'status',
      async () => {
        switch (action) {
          case 'suggestions':
            const context = searchParams.get('context');
            return await generateSuggestions(context || '');

          case 'documentation':
            const query = searchParams.get('query');
            return await searchDocumentation(query || '');

          case 'code-analysis':
            const repository = searchParams.get('repository');
            return await analyzeCode(repository || '');

          case 'troubleshooting':
            const issue = searchParams.get('issue');
            return await generateTroubleshooting(issue || '');

          case 'chat-history':
            const userId = searchParams.get('userId') || 'default';
            return await getChatHistory(userId);

          case 'health':
            const aikaInstance = await premiumFeaturesManager.getFeatureInstance('aika');
            return {
              healthy: aikaInstance.initialized === true,
              initialized: aikaInstance.initialized,
              timestamp: new Date().toISOString()
            };

          default:
            return { 
              status: 'AiKA AI Assistant Ready',
              version: '2.0.0',
              capabilities: [
                'Code analysis and suggestions',
                'Documentation search and generation',
                'Troubleshooting assistance',
                'Platform engineering guidance',
                'Best practices recommendations',
                'Cross-feature intelligence',
                'Performance optimization',
                'Health monitoring'
              ],
              integrations: ['soundcheck', 'skill-exchange'],
              performance: {
                optimized: true,
                caching: 'enabled',
                batching: 'enabled'
              }
            };
        }
      },
      {
        cacheKey: action ? `aika:${action}:${JSON.stringify(Object.fromEntries(searchParams))}` : undefined,
        batchable: ['suggestions', 'documentation'].includes(action || ''),
        priority: action === 'troubleshooting' ? 'high' : 'medium',
        timeout: 10000
      }
    );

    // Record metrics
    const responseTime = Date.now() - startTime;
    premiumPerformanceOptimizer.recordMetrics('aika', {
      responseTime,
      throughput: 1,
      errorRate: 0
    });

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('AiKA API error:', error);
    
    // Record error metrics
    const responseTime = Date.now() - startTime;
    premiumPerformanceOptimizer.recordMetrics('aika', {
      responseTime,
      throughput: 0,
      errorRate: 100
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Initialize Premium Features Manager
    await premiumFeaturesManager.initialize();
    
    const body = await req.json();
    const { action, message, context } = body;

    // Use performance optimizer for all POST operations
    const result = await premiumPerformanceOptimizer.optimizeOperation(
      'aika',
      action,
      async () => {
        switch (action) {
          case 'chat':
            if (!message) {
              throw new Error('Message is required for chat');
            }

            // Get cross-feature context for enhanced responses
            const enhancedContext = await getEnhancedContext(context);
            const response = await processChat(message, enhancedContext);
            
            // Share chat insights with other features
            premiumFeaturesManager.shareCrossFeatureData('aika', 'skill-exchange', 'chat-insights', {
              message,
              response,
              context: enhancedContext
            });

            return { 
              success: true, 
              response,
              enhanced: true,
              timestamp: new Date().toISOString()
            };

          case 'analyze-entity':
            const { entity } = body;
            if (!entity) {
              throw new Error('Entity data is required for analysis');
            }

            // Get Soundcheck data for enhanced analysis
            const soundcheckData = premiumFeaturesManager.getCrossFeatureData('soundcheck', 'aika');
            const analysis = await analyzeEntity(entity, soundcheckData);
            
            return { 
              success: true, 
              analysis,
              crossFeatureEnhanced: soundcheckData.length > 0
            };

          case 'generate-docs':
            const { component, template } = body;
            if (!component) {
              throw new Error('Component data is required for documentation generation');
            }

            const documentation = await generateDocumentation(component, template);
            return { 
              success: true, 
              documentation 
            };

          case 'optimize-config':
            const { configuration, target } = body;
            if (!configuration) {
              throw new Error('Configuration data is required');
            }

            const optimizedConfig = await optimizeConfiguration(configuration, target);
            return { 
              success: true, 
              optimizedConfig 
            };

          case 'cross-feature-recommendation':
            // New action for cross-feature recommendations
            const { featureContext } = body;
            const crossRecommendations = await generateCrossFeatureRecommendations(featureContext);
            return {
              success: true,
              recommendations: crossRecommendations,
              type: 'cross-feature'
            };

          default:
            throw new Error('Invalid action parameter');
        }
      },
      {
        cacheKey: action === 'chat' ? undefined : `aika:post:${action}:${JSON.stringify(body)}`,
        batchable: ['analyze-entity', 'generate-docs'].includes(action),
        priority: action === 'chat' ? 'high' : 'medium',
        timeout: action === 'optimize-config' ? 15000 : 10000
      }
    );

    // Record metrics
    const responseTime = Date.now() - startTime;
    premiumPerformanceOptimizer.recordMetrics('aika', {
      responseTime,
      throughput: 1,
      errorRate: 0
    });

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('AiKA API error:', error);
    
    // Record error metrics
    const responseTime = Date.now() - startTime;
    premiumPerformanceOptimizer.recordMetrics('aika', {
      responseTime,
      throughput: 0,
      errorRate: 100
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper functions for AI-powered features
 */

async function generateSuggestions(context: string) {
  // Mock AI suggestions based on context
  const suggestions = [
    {
      id: 'suggestion-1',
      title: 'Optimize API Documentation',
      description: 'Your API endpoints could benefit from OpenAPI specifications',
      priority: 'high',
      category: 'documentation',
      action: 'Generate OpenAPI spec from existing code'
    },
    {
      id: 'suggestion-2', 
      title: 'Implement Health Checks',
      description: 'Add comprehensive health check endpoints',
      priority: 'medium',
      category: 'reliability',
      action: 'Add /health endpoint with dependency checks'
    },
    {
      id: 'suggestion-3',
      title: 'Security Vulnerability Scan',
      description: 'Schedule regular security scans for dependencies',
      priority: 'high',
      category: 'security',
      action: 'Configure automated security scanning'
    }
  ];

  return suggestions.filter(s => 
    !context || s.description.toLowerCase().includes(context.toLowerCase())
  );
}

async function searchDocumentation(query: string) {
  // Mock documentation search
  return [
    {
      title: 'Getting Started with Backstage',
      url: 'https://backstage.io/docs/getting-started/',
      excerpt: 'Learn how to set up and configure Backstage for your organization',
      relevance: 0.95
    },
    {
      title: 'Plugin Development Guide',
      url: 'https://backstage.io/docs/plugins/',
      excerpt: 'How to create custom plugins for Backstage',
      relevance: 0.87
    },
    {
      title: 'Service Catalog Configuration',
      url: 'https://backstage.io/docs/features/software-catalog/',
      excerpt: 'Configure and manage your service catalog entities',
      relevance: 0.82
    }
  ].filter(doc => 
    !query || doc.title.toLowerCase().includes(query.toLowerCase()) ||
    doc.excerpt.toLowerCase().includes(query.toLowerCase())
  );
}

async function analyzeCode(repository: string) {
  // Mock code analysis
  return {
    repository,
    metrics: {
      codeQuality: 85,
      testCoverage: 72,
      documentation: 68,
      dependencies: {
        total: 45,
        outdated: 3,
        vulnerable: 1
      }
    },
    recommendations: [
      'Increase test coverage in authentication module',
      'Update vulnerable dependency: lodash@4.17.15',
      'Add JSDoc comments to public API methods'
    ],
    trends: {
      qualityTrend: 'improving',
      coverageTrend: 'stable',
      dependencyTrend: 'needs_attention'
    }
  };
}

async function generateTroubleshooting(issue: string) {
  // Mock troubleshooting solutions
  const solutions = [
    {
      id: 'solution-1',
      title: 'Check service dependencies',
      description: 'Verify all required services are running and accessible',
      steps: [
        'Check service status with kubectl get pods',
        'Verify network connectivity',
        'Review service logs for errors'
      ],
      confidence: 0.9
    },
    {
      id: 'solution-2',
      title: 'Review configuration',
      description: 'Validate environment variables and config files',
      steps: [
        'Check environment variables are set correctly',
        'Validate configuration file syntax',
        'Ensure secrets are properly mounted'
      ],
      confidence: 0.85
    }
  ];

  return solutions.filter(s => 
    !issue || s.title.toLowerCase().includes(issue.toLowerCase()) ||
    s.description.toLowerCase().includes(issue.toLowerCase())
  );
}

async function getChatHistory(userId: string) {
  // Mock chat history
  return [
    {
      id: 'chat-1',
      message: 'How do I configure authentication in Backstage?',
      response: 'You can configure authentication using various providers...',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'chat-2',
      message: 'What are the best practices for plugin development?',
      response: 'Here are the key best practices for developing Backstage plugins...',
      timestamp: new Date(Date.now() - 7200000).toISOString()
    }
  ];
}

async function processChat(message: string, context?: any) {
  // Mock AI chat processing
  const responses = {
    'authentication': 'Backstage supports multiple authentication providers including OAuth2, OIDC, and SAML. For setup, configure your auth provider in app-config.yaml...',
    'plugin': 'To create a Backstage plugin, use the CLI: backstage-cli create plugin. This will generate the basic structure...',
    'deployment': 'For production deployment, consider using Docker containers with Kubernetes. Ensure proper health checks and monitoring...',
    'troubleshooting': 'Common issues include network connectivity, configuration errors, and dependency problems. Check logs first...',
    'default': `I understand you're asking about "${message}". Let me help you with that. Based on your context, I recommend checking the official documentation and following the best practices for your specific use case.`
  };

  // Simple keyword matching for demo
  const key = Object.keys(responses).find(k => 
    message.toLowerCase().includes(k) || (context && context.includes(k))
  ) || 'default';

  return {
    message: responses[key],
    confidence: key !== 'default' ? 0.9 : 0.7,
    suggestedActions: [
      'View documentation',
      'Check examples',
      'Ask follow-up questions'
    ]
  };
}

async function analyzeEntity(entity: any, soundcheckData: any[] = []) {
  // Enhanced entity analysis with cross-feature data
  const baseInsights = {
    healthScore: 85,
    securityScore: 92,
    complianceScore: 78,
    recommendedActions: [
      'Add security scanning to CI/CD pipeline',
      'Update documentation with recent changes',
      'Implement monitoring alerts'
    ]
  };

  // Enhance with Soundcheck data if available
  if (soundcheckData.length > 0) {
    const latestAssessment = soundcheckData[0];
    if (latestAssessment && latestAssessment.assessment) {
      baseInsights.healthScore = latestAssessment.assessment.overallScore || baseInsights.healthScore;
      baseInsights.complianceScore = latestAssessment.assessment.categoryScores?.compliance || baseInsights.complianceScore;
      
      // Add Soundcheck-specific recommendations
      baseInsights.recommendedActions.unshift(
        'Review Soundcheck quality assessment results',
        'Address failing quality checks'
      );
    }
  }

  return {
    entityId: entity.id || entity.name,
    insights: baseInsights,
    risks: [
      {
        type: 'security',
        level: 'medium',
        description: 'Missing dependency vulnerability scanning'
      },
      {
        type: 'maintenance',
        level: 'low', 
        description: 'Documentation last updated 30 days ago'
      }
    ],
    crossFeatureEnhanced: soundcheckData.length > 0,
    enhancementSources: soundcheckData.length > 0 ? ['soundcheck'] : []
  };
}

async function generateDocumentation(component: any, template?: string) {
  // Mock documentation generation
  return {
    markdown: `# ${component.name || 'Component'}

## Overview
${component.description || 'Description not provided'}

## API Endpoints
- GET /api/${component.name?.toLowerCase() || 'component'}
- POST /api/${component.name?.toLowerCase() || 'component'}

## Configuration
\`\`\`yaml
# Add your configuration here
\`\`\`

## Dependencies
- Node.js 18+
- PostgreSQL
- Redis

## Getting Started
1. Install dependencies: npm install
2. Configure environment variables
3. Run migrations: npm run migrate
4. Start the service: npm start
`,
    generated: true,
    timestamp: new Date().toISOString()
  };
}

async function optimizeConfiguration(configuration: any, target?: string) {
  // Mock configuration optimization
  return {
    original: configuration,
    optimized: {
      ...configuration,
      performance: {
        ...configuration.performance,
        caching: true,
        compression: true
      },
      security: {
        ...configuration.security,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      }
    },
    improvements: [
      'Enabled response caching for better performance',
      'Added security headers',
      'Optimized database connection pooling'
    ],
    estimatedImpact: {
      performance: '+25%',
      security: '+40%',
      reliability: '+15%'
    }
  };
}

/**
 * Enhanced helper functions for cross-feature integration
 */

async function getEnhancedContext(context: any): Promise<any> {
  // Get cross-feature data to enhance context
  const soundcheckData = premiumFeaturesManager.getCrossFeatureData('soundcheck', 'aika');
  const skillData = premiumFeaturesManager.getCrossFeatureData('skill-exchange', 'aika');
  
  return {
    ...context,
    crossFeatureData: {
      soundcheck: soundcheckData.slice(0, 5), // Latest 5 items
      skillExchange: skillData.slice(0, 5)
    },
    enhanced: true,
    timestamp: new Date().toISOString()
  };
}

async function generateCrossFeatureRecommendations(featureContext: any): Promise<any[]> {
  // Generate recommendations using data from all Premium features
  const recommendations = [];
  
  // Get data from other features
  const soundcheckData = premiumFeaturesManager.getCrossFeatureData('soundcheck', 'aika');
  const skillData = premiumFeaturesManager.getCrossFeatureData('skill-exchange', 'aika');
  
  // Generate Soundcheck-based recommendations
  if (soundcheckData.length > 0) {
    recommendations.push({
      id: 'cross-soundcheck-1',
      type: 'quality-improvement',
      title: 'Improve code quality based on Soundcheck analysis',
      description: 'Recent quality assessments indicate areas for improvement',
      priority: 'high',
      source: 'soundcheck-integration',
      confidence: 0.85
    });
  }
  
  // Generate Skill Exchange-based recommendations
  if (skillData.length > 0) {
    recommendations.push({
      id: 'cross-skill-1',
      type: 'skill-development',
      title: 'Leverage team expertise for knowledge sharing',
      description: 'Identified skill gaps that can be addressed through internal expertise',
      priority: 'medium',
      source: 'skill-exchange-integration',
      confidence: 0.75
    });
  }
  
  // Generate combined recommendations
  if (soundcheckData.length > 0 && skillData.length > 0) {
    recommendations.push({
      id: 'cross-combined-1',
      type: 'holistic-improvement',
      title: 'Comprehensive quality and skill development plan',
      description: 'Combine quality improvements with targeted skill development',
      priority: 'high',
      source: 'multi-feature-integration',
      confidence: 0.90
    });
  }
  
  return recommendations;
}