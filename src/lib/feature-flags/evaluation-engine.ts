/**
 * Feature Flag Evaluation Engine
 * Handles complex flag evaluation logic including targeting, rollouts, and A/B testing
 */

import { 
  FeatureFlag, 
  FlagEvaluation, 
  UserContext, 
  TargetingRule,
  TargetingCondition,
  EvaluationReason,
  RolloutConfig,
  FlagVariation,
  ConditionOperator
} from './types';

export class EvaluationEngine {
  /**
   * Evaluate a feature flag for a given user context
   */
  async evaluate(flag: FeatureFlag, context: UserContext): Promise<FlagEvaluation> {
    // If flag is disabled, return default value
    if (!flag.enabled) {
      return this.createEvaluation(flag.key, flag.defaultValue, { kind: 'OFF' });
    }

    try {
      // Check prerequisites first
      // (Not implemented in this example, but would check dependent flags)

      // Evaluate targeting rules
      if (flag.targeting.enabled) {
        const targetingResult = await this.evaluateTargeting(flag, context);
        if (targetingResult) {
          return targetingResult;
        }
      }

      // Evaluate rollout configuration
      if (flag.rollout.enabled) {
        const rolloutResult = await this.evaluateRollout(flag, context);
        if (rolloutResult) {
          return rolloutResult;
        }
      }

      // Fall back to default behavior
      return this.createEvaluation(
        flag.key, 
        flag.defaultValue,
        { kind: 'FALLTHROUGH' }
      );

    } catch (error) {
      // Return fallback value on evaluation error
      return this.createEvaluation(
        flag.key,
        flag.targeting.fallback.value ?? flag.defaultValue,
        {
          kind: 'ERROR',
          errorKind: 'EVALUATION_ERROR'
        }
      );
    }
  }

  /**
   * Evaluate targeting rules
   */
  private async evaluateTargeting(flag: FeatureFlag, context: UserContext): Promise<FlagEvaluation | null> {
    if (!flag.targeting.rules.length) {
      return null;
    }

    // Sort rules by priority
    const sortedRules = [...flag.targeting.rules].sort((a, b) => a.priority - b.priority);

    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];
      
      if (!rule.enabled) {
        continue;
      }

      const matches = await this.evaluateRule(rule, context);
      
      if (matches) {
        // Rule matched, determine the value to return
        let value: any;
        let variation: string | undefined;

        if (rule.variation) {
          const flagVariation = flag.variations?.find(v => v.key === rule.variation);
          if (flagVariation) {
            value = flagVariation.value;
            variation = rule.variation;
          } else {
            value = flag.defaultValue;
          }
        } else if (rule.percentage !== undefined) {
          // Percentage-based rule
          if (this.isInPercentage(context, rule.percentage)) {
            value = true;
            variation = 'enabled';
          } else {
            value = false;
            variation = 'disabled';
          }
        } else {
          value = true;
          variation = 'enabled';
        }

        return this.createEvaluation(flag.key, value, {
          kind: 'RULE_MATCH',
          ruleIndex: i,
          ruleId: rule.id
        }, variation);
      }
    }

    return null;
  }

  /**
   * Evaluate a single targeting rule
   */
  private async evaluateRule(rule: TargetingRule, context: UserContext): Promise<boolean> {
    if (!rule.conditions.length) {
      return false;
    }

    const conditionResults = await Promise.all(
      rule.conditions.map(condition => this.evaluateCondition(condition, context))
    );

    // Apply logical operator
    if (rule.operator === 'and') {
      return conditionResults.every(result => result);
    } else {
      return conditionResults.some(result => result);
    }
  }

  /**
   * Evaluate a single targeting condition
   */
  private async evaluateCondition(condition: TargetingCondition, context: UserContext): Promise<boolean> {
    const attributeValue = this.getAttributeValue(condition.attribute, context);
    
    if (attributeValue === undefined || attributeValue === null) {
      return condition.operator === 'not_exists' ? !condition.negate : !!condition.negate;
    }

    let result = false;

    switch (condition.operator) {
      case 'equals':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'equals'));
        break;
      
      case 'not_equals':
        result = !condition.values.some(value => this.compareValues(attributeValue, value, 'equals'));
        break;
      
      case 'contains':
        result = condition.values.some(value => 
          String(attributeValue).toLowerCase().includes(String(value).toLowerCase())
        );
        break;
      
      case 'not_contains':
        result = !condition.values.some(value => 
          String(attributeValue).toLowerCase().includes(String(value).toLowerCase())
        );
        break;
      
      case 'starts_with':
        result = condition.values.some(value => 
          String(attributeValue).toLowerCase().startsWith(String(value).toLowerCase())
        );
        break;
      
      case 'ends_with':
        result = condition.values.some(value => 
          String(attributeValue).toLowerCase().endsWith(String(value).toLowerCase())
        );
        break;
      
      case 'in':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'equals'));
        break;
      
      case 'not_in':
        result = !condition.values.some(value => this.compareValues(attributeValue, value, 'equals'));
        break;
      
      case 'regex':
        result = condition.values.some(pattern => {
          try {
            const regex = new RegExp(pattern);
            return regex.test(String(attributeValue));
          } catch {
            return false;
          }
        });
        break;
      
      case 'greater_than':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'gt'));
        break;
      
      case 'less_than':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'lt'));
        break;
      
      case 'greater_equal':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'gte'));
        break;
      
      case 'less_equal':
        result = condition.values.some(value => this.compareValues(attributeValue, value, 'lte'));
        break;
      
      case 'exists':
        result = attributeValue !== undefined && attributeValue !== null;
        break;
      
      case 'not_exists':
        result = attributeValue === undefined || attributeValue === null;
        break;
      
      default:
        result = false;
    }

    return condition.negate ? !result : result;
  }

  /**
   * Evaluate rollout configuration
   */
  private async evaluateRollout(flag: FeatureFlag, context: UserContext): Promise<FlagEvaluation | null> {
    const rollout = flag.rollout;

    switch (rollout.strategy) {
      case 'percentage':
        return this.evaluatePercentageRollout(flag, context, rollout);
      
      case 'user_id':
        return this.evaluateUserIdRollout(flag, context, rollout);
      
      case 'segment':
        return this.evaluateSegmentRollout(flag, context, rollout);
      
      case 'sticky':
        return this.evaluateStickyRollout(flag, context, rollout);
      
      case 'gradual':
        return this.evaluateGradualRollout(flag, context, rollout);
      
      case 'canary':
        return this.evaluateCanaryRollout(flag, context, rollout);
      
      case 'blue_green':
        return this.evaluateBlueGreenRollout(flag, context, rollout);
      
      default:
        return null;
    }
  }

  /**
   * Evaluate percentage-based rollout
   */
  private evaluatePercentageRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    const isIncluded = this.isInPercentage(context, rollout.percentage);
    
    if (isIncluded) {
      // Check if using variations
      if (flag.variations && flag.variations.length > 0) {
        const variation = this.selectVariation(flag.variations, context);
        return this.createEvaluation(flag.key, variation.value, {
          kind: 'FALLTHROUGH',
          inExperiment: true
        }, variation.key);
      }
      
      return this.createEvaluation(flag.key, true, {
        kind: 'FALLTHROUGH',
        inExperiment: true
      });
    }

    return this.createEvaluation(flag.key, flag.defaultValue, {
      kind: 'FALLTHROUGH',
      inExperiment: false
    });
  }

  /**
   * Evaluate user ID-based rollout
   */
  private evaluateUserIdRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    if (!context.userId) {
      return this.createEvaluation(flag.key, flag.defaultValue, { kind: 'FALLTHROUGH' });
    }

    const hash = this.hashString(`${flag.key}:${context.userId}`);
    const bucket = hash % 100;
    const isIncluded = bucket < rollout.percentage;

    return this.createEvaluation(flag.key, isIncluded, {
      kind: 'FALLTHROUGH',
      inExperiment: isIncluded
    });
  }

  /**
   * Evaluate segment-based rollout
   */
  private evaluateSegmentRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    if (!rollout.segments || !context.attributes.segment) {
      return this.createEvaluation(flag.key, flag.defaultValue, { kind: 'FALLTHROUGH' });
    }

    const userSegment = context.attributes.segment as string;
    const isIncluded = rollout.segments.includes(userSegment);

    return this.createEvaluation(flag.key, isIncluded, {
      kind: 'FALLTHROUGH',
      inExperiment: isIncluded
    });
  }

  /**
   * Evaluate sticky rollout (consistent user experience)
   */
  private evaluateStickyRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    // Use consistent hashing based on user ID and flag key
    const hashKey = context.userId || context.sessionId || 'anonymous';
    const hash = this.hashString(`${flag.key}:${hashKey}`);
    const bucket = hash % 100;
    const isIncluded = bucket < rollout.percentage;

    return this.createEvaluation(flag.key, isIncluded, {
      kind: 'FALLTHROUGH',
      inExperiment: isIncluded
    });
  }

  /**
   * Evaluate gradual rollout
   */
  private evaluateGradualRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    if (!rollout.phaseRollout) {
      return this.evaluatePercentageRollout(flag, context, rollout);
    }

    const currentPhase = rollout.phaseRollout.phases[rollout.phaseRollout.currentPhase];
    if (!currentPhase) {
      return this.createEvaluation(flag.key, flag.defaultValue, { kind: 'FALLTHROUGH' });
    }

    const isIncluded = this.isInPercentage(context, currentPhase.percentage);
    
    return this.createEvaluation(flag.key, isIncluded, {
      kind: 'FALLTHROUGH',
      inExperiment: isIncluded
    });
  }

  /**
   * Evaluate canary rollout
   */
  private evaluateCanaryRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    // Canary rollout targets specific user attributes (e.g., beta users)
    const isBetaUser = context.attributes.beta === true || 
                      context.groups?.includes('beta') ||
                      context.attributes.canary === true;

    if (isBetaUser) {
      return this.createEvaluation(flag.key, true, {
        kind: 'FALLTHROUGH',
        inExperiment: true
      });
    }

    // Fall back to percentage rollout for other users
    return this.evaluatePercentageRollout(flag, context, rollout);
  }

  /**
   * Evaluate blue-green rollout
   */
  private evaluateBlueGreenRollout(
    flag: FeatureFlag, 
    context: UserContext, 
    rollout: RolloutConfig
  ): FlagEvaluation {
    // Blue-green deployment based on deployment version or environment
    const deploymentVersion = context.attributes.deploymentVersion as string;
    const environment = context.attributes.environment as string;

    // Route to green environment based on criteria
    const routeToGreen = deploymentVersion === 'v2' || 
                        environment === 'staging' ||
                        this.isInPercentage(context, rollout.percentage);

    return this.createEvaluation(flag.key, routeToGreen, {
      kind: 'FALLTHROUGH',
      inExperiment: routeToGreen
    });
  }

  /**
   * Select variation based on weights
   */
  private selectVariation(variations: FlagVariation[], context: UserContext): FlagVariation {
    if (variations.length === 1) {
      return variations[0];
    }

    // Use consistent hashing to select variation
    const hashKey = context.userId || context.sessionId || 'anonymous';
    const hash = this.hashString(`variation:${hashKey}`);
    const bucket = hash % 100;

    let cumulativeWeight = 0;
    for (const variation of variations) {
      cumulativeWeight += variation.weight;
      if (bucket < cumulativeWeight) {
        return variation;
      }
    }

    // Fallback to first variation
    return variations[0];
  }

  /**
   * Check if user falls within percentage
   */
  private isInPercentage(context: UserContext, percentage: number): boolean {
    const hashKey = context.userId || context.sessionId || context.attributes.ip || 'anonymous';
    const hash = this.hashString(hashKey);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Get attribute value from user context
   */
  private getAttributeValue(attributePath: string, context: UserContext): any {
    const parts = attributePath.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Compare two values based on operator
   */
  private compareValues(a: any, b: any, operator: 'equals' | 'gt' | 'lt' | 'gte' | 'lte'): boolean {
    // Try to convert to numbers for numeric comparisons
    const numA = Number(a);
    const numB = Number(b);

    if (!isNaN(numA) && !isNaN(numB)) {
      switch (operator) {
        case 'equals': return numA === numB;
        case 'gt': return numA > numB;
        case 'lt': return numA < numB;
        case 'gte': return numA >= numB;
        case 'lte': return numA <= numB;
      }
    }

    // Fallback to string comparison
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();

    switch (operator) {
      case 'equals': return strA === strB;
      case 'gt': return strA > strB;
      case 'lt': return strA < strB;
      case 'gte': return strA >= strB;
      case 'lte': return strA <= strB;
    }

    return false;
  }

  /**
   * Hash string to number for consistent bucketing
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create a flag evaluation result
   */
  private createEvaluation(
    flagKey: string,
    value: any,
    reason: EvaluationReason,
    variation?: string
  ): FlagEvaluation {
    return {
      flagKey,
      value,
      variation,
      reason,
      timestamp: new Date()
    };
  }
}