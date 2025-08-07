// Scoring and Prioritization Engine

import { EventEmitter } from 'events';
import {
  Recommendation,
  Impact,
  EffortEstimate,
  Risk,
  ServiceMetrics,
  RecommendationCategory,
  Evidence
} from './types';

interface ScoringWeights {
  impact: {
    performance: number;
    security: number;
    cost: number;
    reliability: number;
    maintainability: number;
    userExperience: number;
    businessValue: number;
  };
  effort: {
    hours: number;
    complexity: number;
    teamSize: number;
    skills: number;
  };
  risk: {
    probability: number;
    impact: number;
  };
  evidence: {
    confidence: number;
    recency: number;
    quantity: number;
  };
}

interface BusinessContext {
  objectives: string[];
  constraints: {
    budget: number;
    timeline: number;
    teamCapacity: number;
  };
  priorities: {
    performance: number;
    security: number;
    cost: number;
    reliability: number;
    innovation: number;
  };
  riskTolerance: 'low' | 'medium' | 'high';
}

export class ScoringEngine extends EventEmitter {
  private weights: ScoringWeights;
  private businessContext: BusinessContext;
  private historicalData: Map<string, any>;
  private modelVersion: string;

  constructor() {
    super();
    this.weights = this.initializeWeights();
    this.businessContext = this.getDefaultBusinessContext();
    this.historicalData = new Map();
    this.modelVersion = '1.0.0';
  }

  private initializeWeights(): ScoringWeights {
    return {
      impact: {
        performance: 1.2,
        security: 1.8, // Higher weight for security
        cost: 1.0,
        reliability: 1.5,
        maintainability: 0.8,
        userExperience: 1.3,
        businessValue: 1.6
      },
      effort: {
        hours: -0.5, // Negative weight (more effort = lower score)
        complexity: -0.8,
        teamSize: -0.3,
        skills: -0.4
      },
      risk: {
        probability: -0.6,
        impact: -0.9
      },
      evidence: {
        confidence: 1.0,
        recency: 0.7,
        quantity: 0.5
      }
    };
  }

  private getDefaultBusinessContext(): BusinessContext {
    return {
      objectives: ['improve_performance', 'reduce_costs', 'enhance_security'],
      constraints: {
        budget: 100000,
        timeline: 90, // days
        teamCapacity: 10 // team members
      },
      priorities: {
        performance: 0.8,
        security: 0.9,
        cost: 0.7,
        reliability: 0.85,
        innovation: 0.6
      },
      riskTolerance: 'medium'
    };
  }

  async scoreRecommendation(
    recommendation: Recommendation,
    metrics: ServiceMetrics,
    context?: Partial<BusinessContext>
  ): Promise<number> {
    const businessCtx = { ...this.businessContext, ...context };

    // Calculate component scores
    const impactScore = this.calculateImpactScore(recommendation.impact, businessCtx);
    const effortScore = this.calculateEffortScore(recommendation.effort, businessCtx);
    const riskScore = this.calculateRiskScore(recommendation.risks, businessCtx);
    const evidenceScore = this.calculateEvidenceScore(recommendation.evidence);
    const alignmentScore = this.calculateBusinessAlignment(recommendation, businessCtx);
    const urgencyScore = this.calculateUrgencyScore(recommendation, metrics);

    // Combine scores with weights
    const totalScore = 
      (impactScore * 0.35) +
      (effortScore * 0.20) +
      (riskScore * 0.15) +
      (evidenceScore * 0.10) +
      (alignmentScore * 0.15) +
      (urgencyScore * 0.05);

    // Apply confidence adjustment
    const confidenceAdjustment = this.getConfidenceAdjustment(recommendation);
    const finalScore = totalScore * confidenceAdjustment;

    this.emit('recommendation-scored', {
      recommendationId: recommendation.id,
      score: finalScore,
      components: {
        impact: impactScore,
        effort: effortScore,
        risk: riskScore,
        evidence: evidenceScore,
        alignment: alignmentScore,
        urgency: urgencyScore
      }
    });

    return Math.min(100, Math.max(0, finalScore));
  }

  private calculateImpactScore(
    impact: Impact,
    context: BusinessContext
  ): number {
    let score = 0;
    const weights = this.weights.impact;
    const priorities = context.priorities;

    score += impact.performance * weights.performance * priorities.performance;
    score += impact.security * weights.security * priorities.security;
    score += impact.cost * weights.cost * priorities.cost;
    score += impact.reliability * weights.reliability * priorities.reliability;
    score += impact.maintainability * weights.maintainability;
    score += impact.userExperience * weights.userExperience;
    score += impact.businessValue * weights.businessValue;

    // Normalize to 0-100 scale
    return (score / 7) * (100 / Math.max(...Object.values(weights)));
  }

  private calculateEffortScore(
    effort: EffortEstimate,
    context: BusinessContext
  ): number {
    const weights = this.weights.effort;
    let score = 100; // Start with max score

    // Deduct points based on effort
    score += (effort.hours / 8) * weights.hours; // Convert to days
    
    const complexityPenalty = 
      effort.complexity === 'low' ? 0 :
      effort.complexity === 'medium' ? 10 : 20;
    score += complexityPenalty * weights.complexity;

    score += effort.teamSize * weights.teamSize * 5;

    // Check if team has required skills
    const skillGap = this.calculateSkillGap(effort.skills);
    score += skillGap * weights.skills * 10;

    // Check constraints
    if (effort.hours / 8 > context.constraints.timeline) {
      score *= 0.5; // Heavy penalty for exceeding timeline
    }

    if (effort.teamSize > context.constraints.teamCapacity) {
      score *= 0.7; // Penalty for exceeding team capacity
    }

    return Math.max(0, score);
  }

  private calculateSkillGap(requiredSkills: string[]): number {
    // Simulate checking against available team skills
    const availableSkills = [
      'JavaScript', 'TypeScript', 'React', 'Node.js',
      'Docker', 'Kubernetes', 'AWS', 'Testing'
    ];

    const missingSkills = requiredSkills.filter(
      skill => !availableSkills.includes(skill)
    );

    return missingSkills.length / requiredSkills.length;
  }

  private calculateRiskScore(
    risks: Risk[],
    context: BusinessContext
  ): number {
    if (risks.length === 0) return 100;

    let totalRisk = 0;
    const weights = this.weights.risk;

    risks.forEach(risk => {
      const probabilityScore = 
        risk.probability === 'low' ? 0.2 :
        risk.probability === 'medium' ? 0.5 : 0.8;

      const impactScore = 
        risk.impact === 'low' ? 0.2 :
        risk.impact === 'medium' ? 0.5 : 0.8;

      const riskValue = 
        (probabilityScore * weights.probability) +
        (impactScore * weights.impact);

      totalRisk += riskValue;
    });

    // Average risk score
    const avgRisk = totalRisk / risks.length;

    // Adjust based on risk tolerance
    const toleranceMultiplier = 
      context.riskTolerance === 'low' ? 0.5 :
      context.riskTolerance === 'medium' ? 1.0 : 1.5;

    const score = 100 - (avgRisk * 50 * toleranceMultiplier);
    return Math.max(0, score);
  }

  private calculateEvidenceScore(evidence: Evidence[]): number {
    if (evidence.length === 0) return 50; // Neutral score for no evidence

    const weights = this.weights.evidence;
    let totalScore = 0;

    evidence.forEach(e => {
      let evidenceValue = 0;

      // Confidence contribution
      evidenceValue += e.confidence * weights.confidence * 30;

      // Recency contribution (assume newer is better)
      const ageInDays = (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (ageInDays / 30)); // Decay over 30 days
      evidenceValue += recencyScore * weights.recency * 20;

      totalScore += evidenceValue;
    });

    // Quantity bonus
    const quantityBonus = Math.min(evidence.length * 5, 20) * weights.quantity;
    totalScore += quantityBonus;

    return Math.min(100, totalScore / evidence.length + quantityBonus);
  }

  private calculateBusinessAlignment(
    recommendation: Recommendation,
    context: BusinessContext
  ): number {
    let alignmentScore = 0;
    const objectives = context.objectives;

    // Check alignment with business objectives
    const alignmentMap: Record<string, RecommendationCategory[]> = {
      'improve_performance': [RecommendationCategory.PERFORMANCE],
      'reduce_costs': [RecommendationCategory.COST],
      'enhance_security': [RecommendationCategory.SECURITY],
      'improve_quality': [RecommendationCategory.QUALITY],
      'modernize_tech': [RecommendationCategory.TECHNOLOGY],
      'improve_architecture': [RecommendationCategory.ARCHITECTURE]
    };

    objectives.forEach(objective => {
      const alignedCategories = alignmentMap[objective] || [];
      if (alignedCategories.includes(recommendation.category)) {
        alignmentScore += 100 / objectives.length;
      }
    });

    // Bonus for high business value impact
    if (recommendation.impact.businessValue > 70) {
      alignmentScore *= 1.2;
    }

    return Math.min(100, alignmentScore);
  }

  private calculateUrgencyScore(
    recommendation: Recommendation,
    metrics: ServiceMetrics
  ): number {
    let urgencyScore = 50; // Base urgency

    // Security issues are always urgent
    if (recommendation.category === RecommendationCategory.SECURITY) {
      urgencyScore = 90;
    }

    // Performance issues affecting users
    if (recommendation.category === RecommendationCategory.PERFORMANCE &&
        metrics.performance.errorRate > 0.05) {
      urgencyScore = 85;
    }

    // Cost issues with high spend
    if (recommendation.category === RecommendationCategory.COST &&
        metrics.cost.monthlySpend > 10000) {
      urgencyScore = 75;
    }

    // Adjust based on service metrics
    if (metrics.performance.availability < 99.5) {
      urgencyScore *= 1.3;
    }

    return Math.min(100, urgencyScore);
  }

  private getConfidenceAdjustment(recommendation: Recommendation): number {
    // Adjust confidence based on historical success
    const historicalSuccess = this.getHistoricalSuccess(recommendation.type);
    
    let confidence = 1.0;
    
    if (historicalSuccess !== null) {
      if (historicalSuccess > 0.8) confidence = 1.1;
      else if (historicalSuccess > 0.6) confidence = 1.0;
      else if (historicalSuccess > 0.4) confidence = 0.9;
      else confidence = 0.8;
    }

    // Adjust based on evidence quality
    if (recommendation.evidence.length > 5) {
      confidence *= 1.05;
    }

    return confidence;
  }

  private getHistoricalSuccess(type: string): number | null {
    // Retrieve historical success rate for this recommendation type
    const history = this.historicalData.get(type);
    if (!history) return null;

    return history.successRate || 0.5;
  }

  async prioritizeRecommendations(
    recommendations: Recommendation[],
    metrics: Map<string, ServiceMetrics>,
    context?: Partial<BusinessContext>
  ): Promise<Recommendation[]> {
    // Score all recommendations
    const scoredRecommendations = await Promise.all(
      recommendations.map(async rec => {
        const serviceMetrics = metrics.get(rec.serviceId) || this.getDefaultMetrics();
        const score = await this.scoreRecommendation(rec, serviceMetrics, context);
        return { ...rec, score, priority: score };
      })
    );

    // Sort by priority score
    scoredRecommendations.sort((a, b) => b.priority - a.priority);

    // Apply dependency ordering
    const orderedRecommendations = this.applyDependencyOrdering(scoredRecommendations);

    // Apply resource constraints
    const feasibleRecommendations = this.applyResourceConstraints(
      orderedRecommendations,
      context
    );

    this.emit('prioritization-complete', {
      total: recommendations.length,
      prioritized: feasibleRecommendations.length
    });

    return feasibleRecommendations;
  }

  private applyDependencyOrdering(
    recommendations: Recommendation[]
  ): Recommendation[] {
    const ordered: Recommendation[] = [];
    const remaining = [...recommendations];
    const completed = new Set<string>();

    while (remaining.length > 0) {
      let added = false;

      for (let i = 0; i < remaining.length; i++) {
        const rec = remaining[i];
        const deps = rec.dependencies || [];
        
        // Check if all dependencies are satisfied
        if (deps.every(dep => completed.has(dep))) {
          ordered.push(rec);
          completed.add(rec.id);
          remaining.splice(i, 1);
          added = true;
          break;
        }
      }

      // If no recommendation could be added, add the highest priority one
      if (!added && remaining.length > 0) {
        const next = remaining.shift()!;
        ordered.push(next);
        completed.add(next.id);
      }
    }

    return ordered;
  }

  private applyResourceConstraints(
    recommendations: Recommendation[],
    context?: Partial<BusinessContext>
  ): Recommendation[] {
    const ctx = { ...this.businessContext, ...context };
    const feasible: Recommendation[] = [];
    
    let totalHours = 0;
    let maxTeamSize = 0;
    let budget = ctx.constraints.budget;

    for (const rec of recommendations) {
      const estimatedCost = this.estimateCost(rec.effort);
      
      // Check if recommendation fits within constraints
      if (totalHours + rec.effort.hours <= ctx.constraints.timeline * 8 &&
          rec.effort.teamSize <= ctx.constraints.teamCapacity &&
          estimatedCost <= budget) {
        
        feasible.push(rec);
        totalHours += rec.effort.hours;
        maxTeamSize = Math.max(maxTeamSize, rec.effort.teamSize);
        budget -= estimatedCost;
      }
    }

    return feasible;
  }

  private estimateCost(effort: EffortEstimate): number {
    // Estimate cost based on effort
    const hourlyRate = 150; // Average hourly rate
    return effort.hours * effort.teamSize * hourlyRate;
  }

  private getDefaultMetrics(): ServiceMetrics {
    return {
      performance: {
        responseTime: 500,
        throughput: 1000,
        errorRate: 0.01,
        availability: 99.9,
        latency: [100, 200, 300, 400, 500],
        p50: 250,
        p95: 450,
        p99: 490
      },
      resource: {
        cpuUsage: 50,
        memoryUsage: 60,
        diskUsage: 40,
        networkBandwidth: 100,
        containerCount: 3
      },
      cost: {
        monthlySpend: 5000,
        perRequestCost: 0.001,
        infrastructureCost: 3000,
        operationalCost: 2000
      },
      quality: {
        codeComplexity: 50,
        testCoverage: 70,
        technicalDebt: 30,
        securityScore: 80,
        documentationScore: 60
      }
    };
  }

  async calculateROI(
    recommendation: Recommendation,
    metrics: ServiceMetrics
  ): Promise<number> {
    // Calculate expected return on investment
    const expectedBenefit = this.calculateExpectedBenefit(recommendation, metrics);
    const implementationCost = this.estimateCost(recommendation.effort);
    
    if (implementationCost === 0) return Infinity;
    
    const roi = ((expectedBenefit - implementationCost) / implementationCost) * 100;
    
    this.emit('roi-calculated', {
      recommendationId: recommendation.id,
      roi,
      benefit: expectedBenefit,
      cost: implementationCost
    });

    return roi;
  }

  private calculateExpectedBenefit(
    recommendation: Recommendation,
    metrics: ServiceMetrics
  ): number {
    let benefit = 0;

    // Performance improvements
    if (recommendation.impact.performance > 0) {
      // Estimate value of reduced response time
      const responseTimeReduction = metrics.performance.responseTime * 
        (recommendation.impact.performance / 100);
      benefit += responseTimeReduction * 100; // $100 per ms reduction
    }

    // Cost savings
    if (recommendation.impact.cost > 0) {
      // Direct cost reduction
      benefit += metrics.cost.monthlySpend * 
        (recommendation.impact.cost / 100) * 12; // Annual savings
    }

    // Security improvements (risk mitigation)
    if (recommendation.impact.security > 0) {
      // Estimate value of reduced security risk
      const riskMitigation = 50000 * (recommendation.impact.security / 100);
      benefit += riskMitigation;
    }

    // Business value
    if (recommendation.impact.businessValue > 0) {
      // Estimate business impact
      benefit += 10000 * (recommendation.impact.businessValue / 100);
    }

    return benefit;
  }

  updateWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.modelVersion = this.incrementVersion(this.modelVersion);
    
    this.emit('weights-updated', {
      version: this.modelVersion,
      weights: this.weights
    });
  }

  updateBusinessContext(context: Partial<BusinessContext>): void {
    this.businessContext = { ...this.businessContext, ...context };
    
    this.emit('context-updated', {
      context: this.businessContext
    });
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  async exportScoringModel(): Promise<any> {
    return {
      version: this.modelVersion,
      weights: this.weights,
      businessContext: this.businessContext,
      exportedAt: new Date().toISOString()
    };
  }

  async importScoringModel(model: any): Promise<void> {
    this.modelVersion = model.version;
    this.weights = model.weights;
    this.businessContext = model.businessContext;
    
    this.emit('model-imported', {
      version: this.modelVersion
    });
  }
}