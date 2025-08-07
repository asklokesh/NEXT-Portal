/**
 * Quality Assessor
 * 
 * Comprehensive quality assessment system that evaluates entity data quality
 * across multiple dimensions and provides actionable improvement recommendations.
 */

import { EventEmitter } from 'events';
import {
  TransformedEntityData,
  EntityQualityScore,
  IQualityAssessor,
} from '../types';

interface QualityRule {
  id: string;
  name: string;
  description: string;
  category: 'completeness' | 'accuracy' | 'consistency' | 'freshness' | 'relationships';
  weight: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  evaluate: (entity: TransformedEntityData, context?: QualityContext) => QualityRuleResult;
}

interface QualityRuleResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

interface QualityContext {
  allEntities: TransformedEntityData[];
  relatedEntities: TransformedEntityData[];
  externalData?: Record<string, unknown>;
}

interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  rules: Array<{
    ruleId: string;
    passed: boolean;
    score: number;
    impact: number;
  }>;
}

export class QualityAssessor extends EventEmitter implements IQualityAssessor {
  readonly id = 'comprehensive-quality-assessor';
  readonly name = 'Comprehensive Quality Assessor';

  private readonly rules: QualityRule[] = [];
  private readonly dimensionWeights = {
    completeness: 0.25,
    accuracy: 0.25,
    consistency: 0.20,
    freshness: 0.15,
    relationships: 0.15,
  };

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Assess entity quality
   */
  async assess(entity: TransformedEntityData, context?: QualityContext): Promise<EntityQualityScore> {
    const startTime = Date.now();
    
    this.emit('assessmentStarted', { entityRef: entity.entityRef });

    try {
      // Group rules by dimension
      const dimensionRules = this.groupRulesByDimension();
      const dimensions = new Map<string, QualityDimension>();

      // Evaluate each dimension
      for (const [dimensionName, rules] of dimensionRules) {
        const dimension = await this.evaluateDimension(dimensionName, rules, entity, context);
        dimensions.set(dimensionName, dimension);
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(dimensions);
      
      // Generate quality score object
      const qualityScore: EntityQualityScore = {
        entityRef: entity.entityRef,
        overallScore: Math.round(overallScore),
        scores: {
          completeness: Math.round(dimensions.get('completeness')?.score || 0),
          accuracy: Math.round(dimensions.get('accuracy')?.score || 0),
          consistency: Math.round(dimensions.get('consistency')?.score || 0),
          freshness: Math.round(dimensions.get('freshness')?.score || 0),
          relationships: Math.round(dimensions.get('relationships')?.score || 0),
        },
        issues: this.generateIssues(dimensions),
        lastEvaluated: new Date(),
      };

      const processingTime = Date.now() - startTime;
      
      this.emit('assessmentCompleted', { 
        entityRef: entity.entityRef, 
        overallScore: qualityScore.overallScore,
        processingTime,
      });

      return qualityScore;

    } catch (error) {
      this.emit('assessmentFailed', { entityRef: entity.entityRef, error });
      
      // Return low-quality score on error
      return {
        entityRef: entity.entityRef,
        overallScore: 0,
        scores: {
          completeness: 0,
          accuracy: 0,
          consistency: 0,
          freshness: 0,
          relationships: 0,
        },
        issues: [{
          severity: 'critical',
          message: `Quality assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        lastEvaluated: new Date(),
      };
    }
  }

  /**
   * Add custom quality rule
   */
  addRule(rule: QualityRule): void {
    this.rules.push(rule);
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove quality rule
   */
  removeRule(ruleId: string): void {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      const removed = this.rules.splice(index, 1)[0];
      this.emit('ruleRemoved', removed);
    }
  }

  /**
   * Get all quality rules
   */
  getRules(): QualityRule[] {
    return [...this.rules];
  }

  /**
   * Update dimension weights
   */
  updateDimensionWeights(weights: Partial<typeof this.dimensionWeights>): void {
    Object.assign(this.dimensionWeights, weights);
    
    // Ensure weights sum to 1
    const total = Object.values(this.dimensionWeights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 1) > 0.01) {
      throw new Error('Dimension weights must sum to 1');
    }

    this.emit('dimensionWeightsUpdated', this.dimensionWeights);
  }

  /**
   * Group rules by dimension
   */
  private groupRulesByDimension(): Map<string, QualityRule[]> {
    const grouped = new Map<string, QualityRule[]>();
    
    for (const rule of this.rules) {
      const existing = grouped.get(rule.category) || [];
      existing.push(rule);
      grouped.set(rule.category, existing);
    }
    
    return grouped;
  }

  /**
   * Evaluate a quality dimension
   */
  private async evaluateDimension(
    dimensionName: string,
    rules: QualityRule[],
    entity: TransformedEntityData,
    context?: QualityContext
  ): Promise<QualityDimension> {
    const dimension: QualityDimension = {
      name: dimensionName,
      score: 0,
      weight: this.dimensionWeights[dimensionName as keyof typeof this.dimensionWeights] || 0,
      rules: [],
    };

    let totalWeight = 0;
    let weightedScore = 0;

    for (const rule of rules) {
      try {
        const result = rule.evaluate(entity, context);
        
        dimension.rules.push({
          ruleId: rule.id,
          passed: result.passed,
          score: result.score,
          impact: rule.weight,
        });

        weightedScore += result.score * rule.weight;
        totalWeight += rule.weight;

      } catch (error) {
        this.emit('ruleEvaluationError', { 
          ruleId: rule.id, 
          entityRef: entity.entityRef, 
          error 
        });
        
        // Treat rule evaluation errors as failed rules
        dimension.rules.push({
          ruleId: rule.id,
          passed: false,
          score: 0,
          impact: rule.weight,
        });
        
        totalWeight += rule.weight;
      }
    }

    dimension.score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return dimension;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(dimensions: Map<string, QualityDimension>): number {
    let weightedScore = 0;
    let totalWeight = 0;

    for (const [dimensionName, dimension] of dimensions) {
      weightedScore += dimension.score * dimension.weight;
      totalWeight += dimension.weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Generate quality issues from dimension results
   */
  private generateIssues(dimensions: Map<string, QualityDimension>): EntityQualityScore['issues'] {
    const issues: EntityQualityScore['issues'] = [];

    for (const dimension of dimensions.values()) {
      for (const ruleResult of dimension.rules) {
        if (!ruleResult.passed) {
          const rule = this.rules.find(r => r.id === ruleResult.ruleId);
          if (rule) {
            const result = rule.evaluate({ entityRef: '', kind: '', metadata: { name: '', namespace: '' }, spec: {}, rawData: {} as any, sourceId: '', transformedBy: [] }, undefined);
            
            issues.push({
              severity: rule.severity,
              message: result.message,
              field: rule.category,
              suggestion: result.suggestion,
            });
          }
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return issues;
  }

  /**
   * Initialize default quality rules
   */
  private initializeDefaultRules(): void {
    // Completeness rules
    this.addRule({
      id: 'has-description',
      name: 'Has Description',
      description: 'Entity should have a meaningful description',
      category: 'completeness',
      weight: 3,
      severity: 'warning',
      evaluate: (entity) => {
        const description = entity.metadata.description;
        const hasDescription = Boolean(description && description.trim().length > 10);
        
        return {
          passed: hasDescription,
          score: hasDescription ? 100 : 0,
          message: hasDescription 
            ? 'Entity has a good description'
            : 'Entity is missing a meaningful description',
          suggestion: hasDescription 
            ? undefined
            : 'Add a description explaining what this entity does and its purpose',
        };
      },
    });

    this.addRule({
      id: 'has-owner',
      name: 'Has Owner',
      description: 'Entity should have a designated owner',
      category: 'completeness',
      weight: 4,
      severity: 'error',
      evaluate: (entity) => {
        const hasOwner = Boolean(
          entity.spec.owner ||
          entity.metadata.labels?.owner ||
          entity.metadata.annotations?.owner
        );
        
        return {
          passed: hasOwner,
          score: hasOwner ? 100 : 0,
          message: hasOwner 
            ? 'Entity has a designated owner'
            : 'Entity is missing owner information',
          suggestion: hasOwner 
            ? undefined
            : 'Specify an owner in spec.owner, labels.owner, or annotations.owner',
        };
      },
    });

    this.addRule({
      id: 'has-lifecycle',
      name: 'Has Lifecycle',
      description: 'Entity should specify its lifecycle stage',
      category: 'completeness',
      weight: 2,
      severity: 'warning',
      evaluate: (entity) => {
        const lifecycle = entity.spec.lifecycle as string;
        const validLifecycles = ['experimental', 'development', 'production', 'deprecated'];
        const hasValidLifecycle = Boolean(lifecycle && validLifecycles.includes(lifecycle));
        
        return {
          passed: hasValidLifecycle,
          score: hasValidLifecycle ? 100 : 0,
          message: hasValidLifecycle 
            ? `Entity has valid lifecycle: ${lifecycle}`
            : 'Entity is missing or has invalid lifecycle information',
          suggestion: hasValidLifecycle 
            ? undefined
            : `Specify lifecycle as one of: ${validLifecycles.join(', ')}`,
        };
      },
    });

    this.addRule({
      id: 'has-tags',
      name: 'Has Tags',
      description: 'Entity should have relevant tags for discoverability',
      category: 'completeness',
      weight: 1,
      severity: 'info',
      evaluate: (entity) => {
        const tags = entity.metadata.tags || [];
        const hasAdequateTags = tags.length >= 2;
        
        return {
          passed: hasAdequateTags,
          score: Math.min(tags.length * 25, 100),
          message: hasAdequateTags 
            ? `Entity has ${tags.length} tags`
            : 'Entity has few or no tags',
          suggestion: hasAdequateTags 
            ? undefined
            : 'Add relevant tags to improve discoverability (e.g., technology, team, domain)',
        };
      },
    });

    // Accuracy rules
    this.addRule({
      id: 'valid-entity-ref',
      name: 'Valid Entity Reference',
      description: 'Entity reference should follow Backstage naming conventions',
      category: 'accuracy',
      weight: 5,
      severity: 'critical',
      evaluate: (entity) => {
        const refPattern = /^[a-zA-Z][a-zA-Z0-9-]*:[a-zA-Z][a-zA-Z0-9-]*\/[a-zA-Z][a-zA-Z0-9-]*$/;
        const isValid = refPattern.test(entity.entityRef);
        
        return {
          passed: isValid,
          score: isValid ? 100 : 0,
          message: isValid 
            ? 'Entity reference follows naming conventions'
            : 'Entity reference does not follow naming conventions',
          suggestion: isValid 
            ? undefined
            : 'Entity reference should match pattern: kind:namespace/name',
        };
      },
    });

    this.addRule({
      id: 'valid-urls',
      name: 'Valid URLs',
      description: 'All URLs in entity should be valid and accessible',
      category: 'accuracy',
      weight: 3,
      severity: 'warning',
      evaluate: (entity) => {
        const urls = this.extractUrls(entity);
        const validUrlPattern = /^https?:\/\/.+/;
        const validUrls = urls.filter(url => validUrlPattern.test(url));
        const allValid = urls.length === 0 || validUrls.length === urls.length;
        
        return {
          passed: allValid,
          score: urls.length === 0 ? 100 : (validUrls.length / urls.length) * 100,
          message: allValid 
            ? 'All URLs are valid'
            : `${validUrls.length}/${urls.length} URLs are valid`,
          suggestion: allValid 
            ? undefined
            : 'Fix invalid URLs in links, source location, or other references',
        };
      },
    });

    this.addRule({
      id: 'consistent-naming',
      name: 'Consistent Naming',
      description: 'Entity name should be consistent across metadata',
      category: 'consistency',
      weight: 3,
      severity: 'warning',
      evaluate: (entity) => {
        const metadataName = entity.metadata.name;
        const title = entity.metadata.title;
        const specName = entity.spec.name as string;
        
        const names = [metadataName, title, specName].filter(Boolean);
        const uniqueNames = [...new Set(names.map(n => n?.toLowerCase()))];
        const isConsistent = uniqueNames.length <= 1 || names.length === 1;
        
        return {
          passed: isConsistent,
          score: isConsistent ? 100 : Math.max(0, 100 - (uniqueNames.length - 1) * 25),
          message: isConsistent 
            ? 'Entity naming is consistent'
            : 'Entity has inconsistent naming across fields',
          suggestion: isConsistent 
            ? undefined
            : 'Ensure name consistency between metadata.name, metadata.title, and spec.name',
        };
      },
    });

    // Freshness rules
    this.addRule({
      id: 'recently-updated',
      name: 'Recently Updated',
      description: 'Entity should be updated regularly',
      category: 'freshness',
      weight: 2,
      severity: 'info',
      evaluate: (entity) => {
        const lastUpdate = entity.rawData.metadata.discoveredAt;
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        const isRecent = daysSinceUpdate <= 30;
        
        return {
          passed: isRecent,
          score: Math.max(0, 100 - Math.floor(daysSinceUpdate / 7) * 10),
          message: isRecent 
            ? 'Entity was updated recently'
            : `Entity hasn't been updated in ${Math.floor(daysSinceUpdate)} days`,
          suggestion: isRecent 
            ? undefined
            : 'Consider reviewing and updating entity information',
        };
      },
    });

    // Relationship rules
    this.addRule({
      id: 'has-relationships',
      name: 'Has Relationships',
      description: 'Entity should have meaningful relationships with other entities',
      category: 'relationships',
      weight: 2,
      severity: 'info',
      evaluate: (entity) => {
        const relationships = entity.relations || [];
        const hasRelationships = relationships.length > 0;
        
        return {
          passed: hasRelationships,
          score: Math.min(relationships.length * 20, 100),
          message: hasRelationships 
            ? `Entity has ${relationships.length} relationships`
            : 'Entity has no defined relationships',
          suggestion: hasRelationships 
            ? undefined
            : 'Define relationships to other entities to show dependencies and context',
        };
      },
    });

    this.addRule({
      id: 'valid-relationship-refs',
      name: 'Valid Relationship References',
      description: 'All relationship references should point to valid entities',
      category: 'relationships',
      weight: 4,
      severity: 'error',
      evaluate: (entity, context) => {
        const relationships = entity.relations || [];
        if (relationships.length === 0) {
          return { passed: true, score: 100, message: 'No relationships to validate' };
        }
        
        const allEntityRefs = new Set(
          context?.allEntities?.map(e => e.entityRef) || []
        );
        
        const validRefs = relationships.filter(rel => 
          allEntityRefs.has(rel.targetRef)
        );
        
        const allValid = validRefs.length === relationships.length;
        
        return {
          passed: allValid,
          score: (validRefs.length / relationships.length) * 100,
          message: allValid 
            ? 'All relationship references are valid'
            : `${validRefs.length}/${relationships.length} relationship references are valid`,
          suggestion: allValid 
            ? undefined
            : 'Fix or remove references to non-existent entities',
        };
      },
    });
  }

  /**
   * Extract URLs from entity
   */
  private extractUrls(entity: TransformedEntityData): string[] {
    const urls: string[] = [];
    const entityStr = JSON.stringify(entity);
    
    // Find URL patterns
    const urlPattern = /https?:\/\/[^\s"'\]},]+/g;
    const matches = entityStr.match(urlPattern) || [];
    
    urls.push(...matches);
    
    // Check specific fields
    if (entity.metadata.annotations?.['backstage.io/source-location']) {
      const sourceLocation = entity.metadata.annotations['backstage.io/source-location'];
      if (sourceLocation.startsWith('url:')) {
        urls.push(sourceLocation.substring(4));
      }
    }
    
    return [...new Set(urls)];
  }
}

export default QualityAssessor;