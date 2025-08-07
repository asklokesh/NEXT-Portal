/**
 * Advanced ABAC Engine - Core Policy Decision Point (PDP)
 * Sub-10ms evaluation with context-aware permissions
 */

import {
  ABACConfiguration,
  ABACDecision,
  ABACPolicy,
  ABACRequest,
  ABACResponse,
  ActionAttributes,
  AnomalyEvent,
  AnomalyType,
  ComparisonOperator,
  EnvironmentAttributes,
  PolicyEffect,
  PolicyRule,
  ResourceAttributes,
  RiskLevel,
  SecurityRecommendation,
  SubjectAttributes,
  ValueType,
  VerificationLevel,
  ZeroTrustContext
} from '../types';
import { PolicyCache } from './policy-cache';
import { RiskAssessmentEngine } from './risk-assessment-engine';
import { ContextEnrichmentEngine } from './context-enrichment-engine';
import { MLAnomalyDetector } from './ml-anomaly-detector';
import { ContinuousValidationEngine } from './continuous-validation-engine';
import { AttributeResolver } from './attribute-resolver';
import { PolicyTestEngine } from './policy-test-engine';

export class ABACEngine {
  private cache: PolicyCache;
  private riskEngine: RiskAssessmentEngine;
  private contextEnricher: ContextEnrichmentEngine;
  private anomalyDetector: MLAnomalyDetector;
  private continuousValidator: ContinuousValidationEngine;
  private attributeResolver: AttributeResolver;
  private testEngine: PolicyTestEngine;
  private config: ABACConfiguration;
  private policies: Map<string, ABACPolicy>;
  private evaluationMetrics: Map<string, number>;

  constructor(config: ABACConfiguration) {
    this.config = config;
    this.cache = new PolicyCache(config.cacheTtl);
    this.riskEngine = new RiskAssessmentEngine();
    this.contextEnricher = new ContextEnrichmentEngine();
    this.anomalyDetector = new MLAnomalyDetector();
    this.continuousValidator = new ContinuousValidationEngine();
    this.attributeResolver = new AttributeResolver();
    this.testEngine = new PolicyTestEngine();
    this.policies = new Map();
    this.evaluationMetrics = new Map();
  }

  /**
   * Main entry point for ABAC evaluation
   * Optimized for sub-10ms performance
   */
  async evaluate(request: ABACRequest): Promise<ABACResponse> {
    const startTime = performance.now();
    const requestId = request.requestId || this.generateRequestId();

    try {
      // Check cache first (sub-millisecond lookup)
      if (this.config.cacheEnabled) {
        const cached = await this.cache.get(request);
        if (cached) {
          this.recordMetric('cache_hit', 1);
          return {
            decision: cached,
            obligations: cached.obligations,
            recommendations: cached.recommendations || [],
            requestId
          };
        }
      }

      // Enrich context with real-time data
      const enrichedRequest = await this.enrichContext(request);

      // Parallel evaluation for performance
      const [
        policyDecision,
        riskAssessment,
        anomalies,
        zeroTrustValidation
      ] = await Promise.all([
        this.evaluatePolicies(enrichedRequest),
        this.riskEngine.assess(enrichedRequest),
        this.detectAnomalies(enrichedRequest),
        this.validateZeroTrust(enrichedRequest)
      ]);

      // Combine evaluations
      const finalDecision = this.combinePolicyDecisions([
        policyDecision,
        this.riskBasedDecision(riskAssessment),
        this.anomalyBasedDecision(anomalies),
        this.zeroTrustDecision(zeroTrustValidation)
      ]);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        enrichedRequest,
        finalDecision,
        riskAssessment,
        anomalies
      );

      // Cache the decision
      if (this.config.cacheEnabled && finalDecision.permit) {
        await this.cache.set(request, finalDecision);
      }

      // Record metrics
      const evaluationTime = performance.now() - startTime;
      this.recordMetric('evaluation_time', evaluationTime);
      this.recordMetric('total_evaluations', 1);

      // Ensure sub-10ms performance
      if (evaluationTime > 10) {
        console.warn(`ABAC evaluation exceeded 10ms: ${evaluationTime}ms`);
      }

      return {
        decision: finalDecision,
        obligations: finalDecision.obligations,
        recommendations,
        nextReviewAt: this.calculateNextReview(finalDecision, riskAssessment),
        requestId
      };

    } catch (error) {
      console.error('ABAC evaluation failed:', error);
      this.recordMetric('evaluation_error', 1);
      
      return {
        decision: {
          decision: PolicyEffect.DENY,
          permit: false,
          reason: 'Evaluation error occurred',
          appliedPolicies: [],
          evaluatedRules: [],
          obligations: [],
          confidence: 0,
          evaluationTime: performance.now() - startTime,
          riskScore: 100
        },
        obligations: [],
        recommendations: [],
        requestId
      };
    }
  }

  /**
   * Evaluate all applicable policies
   */
  private async evaluatePolicies(request: ABACRequest): Promise<ABACDecision> {
    const applicablePolicies = await this.findApplicablePolicies(request);
    const evaluatedRules: PolicyRule[] = [];
    const appliedPolicies: ABACPolicy[] = [];
    
    let finalEffect = PolicyEffect.DENY;
    let highestConfidence = 0;
    let reason = 'No applicable policies found';

    // Evaluate policies in priority order
    const sortedPolicies = applicablePolicies.sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      const policyResult = await this.evaluatePolicy(policy, request);
      
      if (policyResult.applicable) {
        appliedPolicies.push(policy);
        evaluatedRules.push(...policyResult.evaluatedRules);

        if (policyResult.effect === PolicyEffect.DENY) {
          // Explicit deny always wins
          finalEffect = PolicyEffect.DENY;
          reason = `Denied by policy: ${policy.name}`;
          break;
        } else if (policyResult.effect === PolicyEffect.PERMIT && policyResult.confidence > highestConfidence) {
          finalEffect = PolicyEffect.PERMIT;
          highestConfidence = policyResult.confidence;
          reason = `Permitted by policy: ${policy.name}`;
        }
      }
    }

    return {
      decision: finalEffect,
      permit: finalEffect === PolicyEffect.PERMIT,
      reason,
      appliedPolicies,
      evaluatedRules,
      obligations: this.extractObligations(appliedPolicies),
      confidence: highestConfidence,
      evaluationTime: 0, // Will be set by caller
      riskScore: 0 // Will be set by risk engine
    };
  }

  /**
   * Evaluate a single policy against request
   */
  private async evaluatePolicy(
    policy: ABACPolicy,
    request: ABACRequest
  ): Promise<{
    applicable: boolean;
    effect: PolicyEffect;
    confidence: number;
    evaluatedRules: PolicyRule[];
  }> {
    if (!policy.isActive || !this.isPolicyTimeValid(policy)) {
      return {
        applicable: false,
        effect: PolicyEffect.NOT_APPLICABLE,
        confidence: 0,
        evaluatedRules: []
      };
    }

    const evaluatedRules: PolicyRule[] = [];
    let highestConfidence = 0;
    let applicableRuleFound = false;
    let finalEffect = policy.effect;

    for (const rule of policy.rules) {
      const ruleResult = await this.evaluateRule(rule, request);
      
      if (ruleResult.matches) {
        evaluatedRules.push(rule);
        applicableRuleFound = true;
        
        if (rule.confidence > highestConfidence) {
          highestConfidence = rule.confidence;
          finalEffect = rule.effect;
        }
      }
    }

    // Evaluate policy-level conditions
    const conditionsMatch = await this.evaluateConditions(policy.conditions || [], request);

    return {
      applicable: applicableRuleFound && conditionsMatch,
      effect: finalEffect,
      confidence: highestConfidence,
      evaluatedRules
    };
  }

  /**
   * Evaluate a single rule against request
   */
  private async evaluateRule(
    rule: PolicyRule,
    request: ABACRequest
  ): Promise<{ matches: boolean; confidence: number }> {
    try {
      const [subjectMatch, resourceMatch, actionMatch, environmentMatch] = await Promise.all([
        this.evaluateAttributeExpression(rule.subject, request.subject),
        this.evaluateAttributeExpression(rule.resource, request.resource),
        this.evaluateAttributeExpression(rule.action, request.action),
        this.evaluateAttributeExpression(rule.environment, request.environment)
      ]);

      const matches = subjectMatch && resourceMatch && actionMatch && environmentMatch;
      return {
        matches,
        confidence: matches ? rule.confidence : 0
      };
    } catch (error) {
      console.error(`Rule evaluation error for rule ${rule.id}:`, error);
      return { matches: false, confidence: 0 };
    }
  }

  /**
   * Evaluate attribute expression
   */
  private async evaluateAttributeExpression(
    expression: any,
    attributes: any
  ): Promise<boolean> {
    if (!expression || !expression.field) return true;

    const actualValue = await this.attributeResolver.resolveValue(
      expression.field,
      attributes,
      expression.dynamicValue
    );

    const expectedValue = expression.dynamicValue
      ? await this.attributeResolver.resolveDynamicValue(expression.dynamicValue)
      : expression.value;

    return this.compareValues(
      actualValue,
      expectedValue,
      expression.operator,
      expression.valueType
    );
  }

  /**
   * Compare values using operator
   */
  private compareValues(
    actual: any,
    expected: any,
    operator: ComparisonOperator,
    valueType: ValueType
  ): boolean {
    switch (operator) {
      case ComparisonOperator.EQUALS:
        return actual === expected;
        
      case ComparisonOperator.NOT_EQUALS:
        return actual !== expected;
        
      case ComparisonOperator.GREATER_THAN:
        return actual > expected;
        
      case ComparisonOperator.LESS_THAN:
        return actual < expected;
        
      case ComparisonOperator.GREATER_EQUAL:
        return actual >= expected;
        
      case ComparisonOperator.LESS_EQUAL:
        return actual <= expected;
        
      case ComparisonOperator.CONTAINS:
        return String(actual).includes(String(expected));
        
      case ComparisonOperator.NOT_CONTAINS:
        return !String(actual).includes(String(expected));
        
      case ComparisonOperator.IN:
        return Array.isArray(expected) && expected.includes(actual);
        
      case ComparisonOperator.NOT_IN:
        return Array.isArray(expected) && !expected.includes(actual);
        
      case ComparisonOperator.MATCHES_REGEX:
        return new RegExp(expected).test(String(actual));
        
      case ComparisonOperator.EXISTS:
        return actual !== undefined && actual !== null;
        
      case ComparisonOperator.NOT_EXISTS:
        return actual === undefined || actual === null;
        
      case ComparisonOperator.IS_SUBSET:
        return Array.isArray(actual) && Array.isArray(expected) && 
               actual.every(item => expected.includes(item));
               
      case ComparisonOperator.IS_SUPERSET:
        return Array.isArray(actual) && Array.isArray(expected) && 
               expected.every(item => actual.includes(item));
               
      case ComparisonOperator.INTERSECTS:
        return Array.isArray(actual) && Array.isArray(expected) && 
               actual.some(item => expected.includes(item));
               
      default:
        return false;
    }
  }

  /**
   * Find applicable policies for request
   */
  private async findApplicablePolicies(request: ABACRequest): Promise<ABACPolicy[]> {
    const applicable: ABACPolicy[] = [];
    
    for (const [id, policy] of this.policies) {
      if (policy.isActive && this.isPolicyTimeValid(policy)) {
        // Quick pre-filtering based on policy metadata
        if (this.policyMightApply(policy, request)) {
          applicable.push(policy);
        }
      }
    }
    
    return applicable;
  }

  /**
   * Quick policy pre-filtering
   */
  private policyMightApply(policy: ABACPolicy, request: ABACRequest): boolean {
    // Basic filtering logic - can be enhanced with indexing
    return true; // For now, evaluate all active policies
  }

  /**
   * Check if policy is time-valid
   */
  private isPolicyTimeValid(policy: ABACPolicy): boolean {
    const now = new Date();
    return now >= policy.validFrom && (!policy.validTo || now <= policy.validTo);
  }

  /**
   * Enrich request context
   */
  private async enrichContext(request: ABACRequest): Promise<ABACRequest> {
    return this.contextEnricher.enrich(request);
  }

  /**
   * Generate risk-based decision
   */
  private riskBasedDecision(riskScore: number): ABACDecision {
    const critical = riskScore >= this.config.riskThresholds.critical;
    const high = riskScore >= this.config.riskThresholds.high;
    
    if (critical) {
      return {
        decision: PolicyEffect.DENY,
        permit: false,
        reason: 'Risk score too high',
        appliedPolicies: [],
        evaluatedRules: [],
        obligations: [],
        confidence: 100,
        evaluationTime: 0,
        riskScore
      };
    }
    
    return {
      decision: high ? PolicyEffect.PERMIT : PolicyEffect.NOT_APPLICABLE,
      permit: !high,
      reason: high ? 'Elevated risk requires additional validation' : 'Risk acceptable',
      appliedPolicies: [],
      evaluatedRules: [],
      obligations: high ? [/* MFA obligation */] : [],
      confidence: 80,
      evaluationTime: 0,
      riskScore
    };
  }

  /**
   * Generate anomaly-based decision
   */
  private anomalyBasedDecision(anomalies: AnomalyEvent[]): ABACDecision {
    const criticalAnomalies = anomalies.filter(a => a.severity === RiskLevel.CRITICAL);
    
    if (criticalAnomalies.length > 0) {
      return {
        decision: PolicyEffect.DENY,
        permit: false,
        reason: `Critical anomalies detected: ${criticalAnomalies.map(a => a.type).join(', ')}`,
        appliedPolicies: [],
        evaluatedRules: [],
        obligations: [],
        confidence: 95,
        evaluationTime: 0,
        riskScore: 90
      };
    }
    
    return {
      decision: PolicyEffect.NOT_APPLICABLE,
      permit: true,
      reason: 'No critical anomalies detected',
      appliedPolicies: [],
      evaluatedRules: [],
      obligations: [],
      confidence: 70,
      evaluationTime: 0,
      riskScore: 0
    };
  }

  /**
   * Generate zero-trust decision
   */
  private zeroTrustDecision(validation: ZeroTrustContext): ABACDecision {
    if (validation.trustScore < 0.5 || validation.verificationLevel === VerificationLevel.NONE) {
      return {
        decision: PolicyEffect.DENY,
        permit: false,
        reason: 'Zero-trust validation failed',
        appliedPolicies: [],
        evaluatedRules: [],
        obligations: [],
        confidence: 90,
        evaluationTime: 0,
        riskScore: 80
      };
    }
    
    return {
      decision: PolicyEffect.NOT_APPLICABLE,
      permit: true,
      reason: 'Zero-trust validation passed',
      appliedPolicies: [],
      evaluatedRules: [],
      obligations: [],
      confidence: 85,
      evaluationTime: 0,
      riskScore: 0
    };
  }

  /**
   * Combine multiple policy decisions
   */
  private combinePolicyDecisions(decisions: ABACDecision[]): ABACDecision {
    const denyDecisions = decisions.filter(d => d.decision === PolicyEffect.DENY);
    
    if (denyDecisions.length > 0) {
      // Any deny decision overrides permits
      const highestConfidenceDeny = denyDecisions.reduce((max, current) => 
        current.confidence > max.confidence ? current : max
      );
      return highestConfidenceDeny;
    }
    
    const permitDecisions = decisions.filter(d => d.decision === PolicyEffect.PERMIT);
    
    if (permitDecisions.length > 0) {
      const highestConfidencePermit = permitDecisions.reduce((max, current) => 
        current.confidence > max.confidence ? current : max
      );
      return highestConfidencePermit;
    }
    
    return {
      decision: PolicyEffect.DENY,
      permit: false,
      reason: 'No explicit permit found',
      appliedPolicies: [],
      evaluatedRules: [],
      obligations: [],
      confidence: 50,
      evaluationTime: 0,
      riskScore: 50
    };
  }

  /**
   * Detect anomalies in request
   */
  private async detectAnomalies(request: ABACRequest): Promise<AnomalyEvent[]> {
    if (!this.config.mlModelsEnabled) return [];
    
    return this.anomalyDetector.detect(request);
  }

  /**
   * Validate zero-trust requirements
   */
  private async validateZeroTrust(request: ABACRequest): Promise<ZeroTrustContext> {
    return this.continuousValidator.validate(request);
  }

  /**
   * Generate security recommendations
   */
  private async generateRecommendations(
    request: ABACRequest,
    decision: ABACDecision,
    riskScore: number,
    anomalies: AnomalyEvent[]
  ): Promise<SecurityRecommendation[]> {
    const recommendations: SecurityRecommendation[] = [];
    
    // Add risk-based recommendations
    if (riskScore > this.config.riskThresholds.medium) {
      recommendations.push({
        type: 'mfa_upgrade' as any,
        message: 'Consider upgrading to stronger MFA',
        priority: 'high' as any,
        actionRequired: true,
        autoRemediable: false
      });
    }
    
    // Add anomaly-based recommendations
    for (const anomaly of anomalies) {
      if (anomaly.type === AnomalyType.GEOGRAPHIC_ANOMALY) {
        recommendations.push({
          type: 'location_review' as any,
          message: 'Unusual access location detected',
          priority: 'medium' as any,
          actionRequired: false,
          autoRemediable: false
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Calculate next review time
   */
  private calculateNextReview(decision: ABACDecision, riskScore: number): Date | undefined {
    if (!decision.permit) return undefined;
    
    const baseInterval = 3600000; // 1 hour
    const riskMultiplier = Math.max(0.1, 1 - (riskScore / 100));
    const intervalMs = baseInterval * riskMultiplier;
    
    return new Date(Date.now() + intervalMs);
  }

  /**
   * Extract obligations from policies
   */
  private extractObligations(policies: ABACPolicy[]) {
    return policies.flatMap(p => p.obligations || []);
  }

  /**
   * Evaluate policy conditions
   */
  private async evaluateConditions(conditions: any[], request: ABACRequest): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, request);
      if (!result) return false;
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private async evaluateCondition(condition: any, request: ABACRequest): Promise<boolean> {
    // Implement condition evaluation logic
    return true; // Placeholder
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `abac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record performance metrics
   */
  private recordMetric(name: string, value: number): void {
    const current = this.evaluationMetrics.get(name) || 0;
    this.evaluationMetrics.set(name, current + value);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.evaluationMetrics);
  }

  /**
   * Load policies from storage
   */
  async loadPolicies(policies: ABACPolicy[]): Promise<void> {
    this.policies.clear();
    for (const policy of policies) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Test policies
   */
  async testPolicies(testCases: any[]): Promise<any> {
    return this.testEngine.runTests(testCases, this);
  }

  /**
   * Get policy analytics
   */
  getAnalytics() {
    return {
      totalPolicies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.isActive).length,
      evaluationMetrics: this.getMetrics()
    };
  }
}