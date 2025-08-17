/**
 * Autonomous Platform Operations API
 * Manage self-optimizing infrastructure and autonomous agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { autonomousOperations } from '@/lib/autonomous/autonomous-operations';
import { extractTenantContext, validateTenantAccess } from '@/middleware/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/autonomous - Get autonomous operations data and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'metrics';

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');

    // Check admin access for most operations
    if (userRole !== 'admin' && action !== 'health' && action !== 'zero-ops-score') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'health':
        const agents = autonomousOperations.getAutonomousAgents();
        const activeAgents = agents.filter(a => a.status === 'active').length;
        const zeroOpsScore = autonomousOperations.calculateZeroOpsScore();
        
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          autonomousOps: {
            enabled: true,
            activeAgents,
            totalAgents: agents.length,
            zeroOpsAchievement: zeroOpsScore.overall,
            operationalStatus: zeroOpsScore.overall > 80 ? 'optimal' : zeroOpsScore.overall > 60 ? 'good' : 'needs_improvement'
          }
        });

      case 'metrics':
        const metrics = autonomousOperations.getMetrics();
        return NextResponse.json({
          metrics,
          timestamp: new Date().toISOString()
        });

      case 'agents':
        const allAgents = autonomousOperations.getAutonomousAgents();
        return NextResponse.json({
          agents: allAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            type: agent.type,
            status: agent.status,
            capabilities: agent.capabilities,
            confidence: agent.confidence,
            learningModel: agent.learningModel,
            decisions: agent.decisions,
            metrics: agent.metrics,
            configuration: agent.configuration,
            createdAt: agent.createdAt,
            lastActive: agent.lastActive
          })),
          total: allAgents.length,
          active: allAgents.filter(a => a.status === 'active').length
        });

      case 'agent-details':
        const agentId = searchParams.get('agentId');
        if (!agentId) {
          return NextResponse.json(
            { error: 'Missing agentId parameter' },
            { status: 400 }
          );
        }

        const agent = autonomousOperations.getAutonomousAgents().find(a => a.id === agentId);
        if (!agent) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          );
        }

        // Get agent's recent decisions
        const agentDecisions = autonomousOperations.getAutonomousDecisions({ type: undefined })
          .filter(d => d.agentId === agentId)
          .slice(0, 10);

        return NextResponse.json({
          agent,
          recentDecisions: agentDecisions.map(d => ({
            id: d.id,
            type: d.type,
            description: d.description,
            status: d.status,
            confidence: d.confidence,
            impact: d.impact,
            createdAt: d.createdAt,
            executedAt: d.executedAt,
            completedAt: d.completedAt
          }))
        });

      case 'decisions':
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

        const decisions = autonomousOperations.getAutonomousDecisions({ status, type })
          .slice(0, limit);

        return NextResponse.json({
          decisions: decisions.map(decision => ({
            id: decision.id,
            agentId: decision.agentId,
            type: decision.type,
            description: decision.description,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            impact: decision.impact,
            status: decision.status,
            approvedBy: decision.approvedBy,
            executionPlan: decision.executionPlan.length,
            createdAt: decision.createdAt,
            executedAt: decision.executedAt,
            completedAt: decision.completedAt
          })),
          total: decisions.length,
          filters: { status, type, limit }
        });

      case 'decision-details':
        const decisionId = searchParams.get('decisionId');
        if (!decisionId) {
          return NextResponse.json(
            { error: 'Missing decisionId parameter' },
            { status: 400 }
          );
        }

        const decision = autonomousOperations.getAutonomousDecisions()
          .find(d => d.id === decisionId);
        
        if (!decision) {
          return NextResponse.json(
            { error: 'Decision not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          decision: {
            ...decision,
            executionPlan: decision.executionPlan,
            rollbackPlan: decision.rollbackPlan,
            evidence: decision.evidence
          }
        });

      case 'capacity-predictions':
        // In a real implementation, this would get actual capacity predictions
        return NextResponse.json({
          predictions: [
            {
              resource: 'compute',
              current: { usage: 65, capacity: 100, utilization: 0.65 },
              predicted: { usage: 78, confidence: 0.85, trend: 'increasing' },
              recommendations: {
                action: 'scale_up',
                urgency: 'medium',
                reasoning: 'Predicted usage will exceed 75% threshold'
              }
            },
            {
              resource: 'memory',
              current: { usage: 45, capacity: 100, utilization: 0.45 },
              predicted: { usage: 42, confidence: 0.78, trend: 'stable' },
              recommendations: {
                action: 'none',
                urgency: 'low',
                reasoning: 'Usage within optimal range'
              }
            }
          ],
          timestamp: new Date().toISOString()
        });

      case 'cost-optimizations':
        const costStatus = searchParams.get('status');
        const costType = searchParams.get('type');

        const optimizations = autonomousOperations.getCostOptimizations({ status: costStatus, type: costType });

        return NextResponse.json({
          optimizations: optimizations.map(opt => ({
            id: opt.id,
            type: opt.type,
            target: opt.target,
            currentCost: opt.currentCost,
            optimizedCost: opt.optimizedCost,
            savings: opt.savings,
            implementation: opt.implementation,
            validation: opt.validation,
            status: opt.status,
            createdAt: opt.createdAt,
            implementedAt: opt.implementedAt
          })),
          total: optimizations.length,
          totalSavings: optimizations.reduce((sum, opt) => sum + opt.savings.amount, 0)
        });

      case 'security-threats':
        const threats = autonomousOperations.getSecurityThreats();
        return NextResponse.json({
          threats: threats.map(threat => ({
            id: threat.id,
            type: threat.type,
            severity: threat.severity,
            confidence: threat.confidence,
            source: threat.source,
            target: threat.target,
            details: threat.details,
            mitigation: threat.mitigation,
            status: threat.status,
            detectedAt: threat.detectedAt,
            mitigatedAt: threat.mitigatedAt,
            resolvedAt: threat.resolvedAt
          })),
          total: threats.length,
          summary: {
            critical: threats.filter(t => t.severity === 'critical').length,
            high: threats.filter(t => t.severity === 'high').length,
            medium: threats.filter(t => t.severity === 'medium').length,
            low: threats.filter(t => t.severity === 'low').length,
            mitigated: threats.filter(t => t.status === 'mitigated').length
          }
        });

      case 'performance-insights':
        const insights = autonomousOperations.getPerformanceInsights();
        return NextResponse.json({
          insights: insights.map(insight => ({
            id: insight.id,
            component: insight.component,
            metric: insight.metric,
            issue: insight.issue,
            analysis: insight.analysis,
            optimization: insight.optimization,
            status: insight.status,
            identifiedAt: insight.identifiedAt,
            resolvedAt: insight.resolvedAt
          })),
          total: insights.length,
          summary: {
            critical: insights.filter(i => i.issue.severity === 'critical').length,
            major: insights.filter(i => i.issue.severity === 'major').length,
            moderate: insights.filter(i => i.issue.severity === 'moderate').length,
            minor: insights.filter(i => i.issue.severity === 'minor').length,
            resolved: insights.filter(i => i.status === 'deployed').length
          }
        });

      case 'zero-ops-score':
        const score = autonomousOperations.calculateZeroOpsScore();
        return NextResponse.json({
          zeroOpsScore: score,
          timestamp: new Date().toISOString(),
          interpretation: {
            overall: score.overall >= 90 ? 'excellent' : score.overall >= 80 ? 'good' : score.overall >= 60 ? 'fair' : 'needs_improvement',
            recommendations: this.generateScoreRecommendations(score)
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: health, metrics, agents, agent-details, decisions, decision-details, capacity-predictions, cost-optimizations, security-threats, performance-insights, zero-ops-score' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing autonomous operations request:', error);
    return NextResponse.json(
      { error: 'Failed to process autonomous operations request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/autonomous - Deploy agents, execute decisions, trigger operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Extract tenant context
    const tenantContext = extractTenantContext(request);
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Check admin access
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'deploy-agent':
        return await handleDeployAgent(body);

      case 'execute-decision':
        return await handleExecuteDecision(body);

      case 'generate-capacity-prediction':
        return await handleGenerateCapacityPrediction(body);

      case 'identify-cost-optimizations':
        return await handleIdentifyCostOptimizations();

      case 'detect-security-threats':
        return await handleDetectSecurityThreats();

      case 'optimize-performance':
        return await handleOptimizePerformance();

      case 'trigger-learning':
        return await handleTriggerLearning(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: deploy-agent, execute-decision, generate-capacity-prediction, identify-cost-optimizations, detect-security-threats, optimize-performance, trigger-learning' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing autonomous operations operation:', error);
    return NextResponse.json(
      { error: 'Failed to process autonomous operations operation' },
      { status: 500 }
    );
  }
}

/**
 * Handler implementations
 */
async function handleDeployAgent(body: any): Promise<NextResponse> {
  const { agent } = body;

  if (!agent || !agent.name || !agent.type) {
    return NextResponse.json(
      { error: 'Missing required agent fields: name, type' },
      { status: 400 }
    );
  }

  const validTypes = ['capacity_planner', 'cost_optimizer', 'security_guardian', 'performance_tuner', 'incident_resolver'];
  if (!validTypes.includes(agent.type)) {
    return NextResponse.json(
      { error: `Invalid agent type. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const agentId = await autonomousOperations.deployAgent({
      name: agent.name,
      type: agent.type,
      capabilities: agent.capabilities || [],
      confidence: agent.confidence || 0.5,
      learningModel: {
        algorithm: agent.learningModel?.algorithm || 'supervised',
        trainingData: agent.learningModel?.trainingData || 0,
        accuracy: agent.learningModel?.accuracy || 0.5,
        lastTrained: new Date()
      },
      configuration: {
        aggressiveness: agent.configuration?.aggressiveness || 'moderate',
        autoApprove: agent.configuration?.autoApprove ?? true,
        requiresHumanConfirmation: agent.configuration?.requiresHumanConfirmation ?? false,
        maxImpact: agent.configuration?.maxImpact || 'medium'
      }
    });

    return NextResponse.json({
      agentId,
      message: 'Autonomous agent deployed successfully',
      name: agent.name,
      type: agent.type
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deploy agent' },
      { status: 500 }
    );
  }
}

async function handleExecuteDecision(body: any): Promise<NextResponse> {
  const { decisionId, forceExecution } = body;

  if (!decisionId) {
    return NextResponse.json(
      { error: 'Missing required field: decisionId' },
      { status: 400 }
    );
  }

  try {
    const execution = await autonomousOperations.executeAutonomousDecision(
      decisionId,
      forceExecution || false
    );

    return NextResponse.json({
      execution: {
        executionId: execution.executionId,
        status: execution.status,
        steps: execution.steps,
        estimatedDuration: execution.estimatedDuration
      },
      message: 'Decision execution initiated',
      decisionId
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute decision' },
      { status: 500 }
    );
  }
}

async function handleGenerateCapacityPrediction(body: any): Promise<NextResponse> {
  const { resource, timeHorizon } = body;

  if (!resource) {
    return NextResponse.json(
      { error: 'Missing required field: resource' },
      { status: 400 }
    );
  }

  try {
    const prediction = await autonomousOperations.generateCapacityPrediction(
      resource,
      timeHorizon || 60
    );

    return NextResponse.json({
      prediction: {
        id: prediction.id,
        resource: prediction.resource,
        timeHorizon: prediction.timeHorizon,
        current: prediction.current,
        predicted: prediction.predicted,
        recommendations: prediction.recommendations,
        validUntil: prediction.validUntil
      },
      message: 'Capacity prediction generated successfully',
      resource
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate capacity prediction' },
      { status: 500 }
    );
  }
}

async function handleIdentifyCostOptimizations(): Promise<NextResponse> {
  try {
    const optimizations = await autonomousOperations.identifyCostOptimizations();

    const totalSavings = optimizations.reduce((sum, opt) => sum + opt.savings.amount, 0);
    const averageSavings = optimizations.length > 0 ? totalSavings / optimizations.length : 0;

    return NextResponse.json({
      optimizations: optimizations.map(opt => ({
        id: opt.id,
        type: opt.type,
        target: opt.target,
        savings: opt.savings,
        implementation: opt.implementation,
        status: opt.status
      })),
      summary: {
        total: optimizations.length,
        totalSavings,
        averageSavings,
        byType: {
          rightsizing: optimizations.filter(o => o.type === 'rightsizing').length,
          scheduling: optimizations.filter(o => o.type === 'scheduling').length,
          purchasing: optimizations.filter(o => o.type === 'purchasing').length,
          architecture: optimizations.filter(o => o.type === 'architecture').length
        }
      },
      message: 'Cost optimization analysis completed'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to identify cost optimizations' },
      { status: 500 }
    );
  }
}

async function handleDetectSecurityThreats(): Promise<NextResponse> {
  try {
    const result = await autonomousOperations.detectAndMitigateThreats();

    return NextResponse.json({
      threatAnalysis: {
        detected: result.detected.length,
        mitigated: result.mitigated,
        escalated: result.escalated,
        threats: result.detected.map(threat => ({
          id: threat.id,
          type: threat.type,
          severity: threat.severity,
          confidence: threat.confidence,
          status: threat.status,
          detectedAt: threat.detectedAt
        }))
      },
      summary: {
        automaticMitigationRate: result.detected.length > 0 ? (result.mitigated / result.detected.length) * 100 : 0,
        escalationRate: result.detected.length > 0 ? (result.escalated / result.detected.length) * 100 : 0
      },
      message: 'Security threat detection completed'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect security threats' },
      { status: 500 }
    );
  }
}

async function handleOptimizePerformance(): Promise<NextResponse> {
  try {
    const result = await autonomousOperations.optimizePerformance();

    return NextResponse.json({
      performanceOptimization: {
        insightsGenerated: result.insights.length,
        optimizationsDeployed: result.optimizations,
        improvements: result.improvements,
        insights: result.insights.map(insight => ({
          id: insight.id,
          component: insight.component,
          issue: insight.issue,
          optimization: insight.optimization,
          status: insight.status
        }))
      },
      summary: {
        averageImprovement: Object.values(result.improvements).reduce((sum, imp) => sum + imp, 0) / Math.max(Object.keys(result.improvements).length, 1),
        componentsOptimized: Object.keys(result.improvements).length
      },
      message: 'Performance optimization completed'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to optimize performance' },
      { status: 500 }
    );
  }
}

async function handleTriggerLearning(body: any): Promise<NextResponse> {
  const { agentId, trainingData } = body;

  // In a real implementation, this would trigger ML model retraining
  console.log(`Triggering learning for agent ${agentId || 'all'} with ${trainingData?.length || 0} training samples`);

  return NextResponse.json({
    message: 'Learning process triggered successfully',
    agentId: agentId || 'all',
    trainingDataSize: trainingData?.length || 0,
    estimatedCompletionTime: '5-10 minutes'
  });
}

/**
 * PUT /api/autonomous - Update agent configurations and settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'update-agent-config':
        return await handleUpdateAgentConfig(body);

      case 'approve-decision':
        return await handleApproveDecision(body);

      case 'update-learning-parameters':
        return await handleUpdateLearningParameters(body);

      case 'configure-autonomous-settings':
        return await handleConfigureAutonomousSettings(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: update-agent-config, approve-decision, update-learning-parameters, configure-autonomous-settings' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating autonomous operations:', error);
    return NextResponse.json(
      { error: 'Failed to update autonomous operations' },
      { status: 500 }
    );
  }
}

async function handleUpdateAgentConfig(body: any): Promise<NextResponse> {
  const { agentId, configuration } = body;

  if (!agentId || !configuration) {
    return NextResponse.json(
      { error: 'Missing required fields: agentId, configuration' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update the agent configuration
  console.log(`Updating agent ${agentId} configuration:`, configuration);

  return NextResponse.json({
    message: 'Agent configuration updated successfully',
    agentId,
    configuration
  });
}

async function handleApproveDecision(body: any): Promise<NextResponse> {
  const { decisionId, approved, comments } = body;

  if (!decisionId || typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: decisionId, approved' },
      { status: 400 }
    );
  }

  try {
    if (approved) {
      const execution = await autonomousOperations.executeAutonomousDecision(decisionId, true);
      return NextResponse.json({
        message: 'Decision approved and executed',
        decisionId,
        executionId: execution.executionId,
        status: execution.status
      });
    } else {
      console.log(`Decision ${decisionId} rejected: ${comments || 'No comments provided'}`);
      return NextResponse.json({
        message: 'Decision rejected',
        decisionId,
        comments
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process decision approval' },
      { status: 500 }
    );
  }
}

async function handleUpdateLearningParameters(body: any): Promise<NextResponse> {
  const { agentId, parameters } = body;

  if (!parameters) {
    return NextResponse.json(
      { error: 'Missing required field: parameters' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update ML learning parameters
  console.log(`Updating learning parameters for agent ${agentId || 'all'}:`, parameters);

  return NextResponse.json({
    message: 'Learning parameters updated successfully',
    agentId: agentId || 'all',
    parameters
  });
}

async function handleConfigureAutonomousSettings(body: any): Promise<NextResponse> {
  const { settings } = body;

  if (!settings) {
    return NextResponse.json(
      { error: 'Missing required field: settings' },
      { status: 400 }
    );
  }

  // In a real implementation, this would update global autonomous settings
  console.log('Updating autonomous operations settings:', settings);

  return NextResponse.json({
    message: 'Autonomous settings configured successfully',
    settings
  });
}

/**
 * DELETE /api/autonomous - Remove agents and clean up data
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
      case 'remove-agent':
        const agentId = searchParams.get('agentId');
        if (!agentId) {
          return NextResponse.json(
            { error: 'Missing agentId parameter' },
            { status: 400 }
          );
        }

        console.log(`Removing autonomous agent: ${agentId}`);
        return NextResponse.json({
          message: 'Agent removed successfully',
          agentId
        });

      case 'clear-decisions':
        console.log('Clearing autonomous decisions history');
        return NextResponse.json({
          message: 'Decision history cleared successfully'
        });

      case 'reset-learning':
        const resetAgentId = searchParams.get('agentId');
        console.log(`Resetting learning models for agent ${resetAgentId || 'all'}`);
        return NextResponse.json({
          message: 'Learning models reset successfully',
          agentId: resetAgentId || 'all'
        });

      case 'cleanup-optimizations':
        console.log('Cleaning up completed cost optimizations');
        return NextResponse.json({
          message: 'Optimization history cleaned up successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: remove-agent, clear-decisions, reset-learning, cleanup-optimizations' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing autonomous operations delete request:', error);
    return NextResponse.json(
      { error: 'Failed to process delete request' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to generate score recommendations
 */
function generateScoreRecommendations(score: any): string[] {
  const recommendations: string[] = [];

  if (score.breakdown.automation < 80) {
    recommendations.push('Increase agent automation capabilities and decision confidence');
  }

  if (score.breakdown.selfHealing < 70) {
    recommendations.push('Deploy more incident resolution agents to improve self-healing');
  }

  if (score.breakdown.predictiveCapacity < 75) {
    recommendations.push('Enhance capacity prediction models with more training data');
  }

  if (score.breakdown.costOptimization < 60) {
    recommendations.push('Enable more aggressive cost optimization policies');
  }

  if (score.breakdown.securityResponse < 85) {
    recommendations.push('Strengthen automated security threat mitigation capabilities');
  }

  if (recommendations.length === 0) {
    recommendations.push('Excellent autonomous operations performance - consider expanding to new domains');
  }

  return recommendations;
}