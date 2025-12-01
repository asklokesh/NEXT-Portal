/**
 * Scorecard Service
 * Main service for managing and evaluating service health scorecards
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Scorecard,
  ScorecardCheck,
  ScorecardResult,
  CheckResult,
  CheckStatus,
  CheckCategory,
  TeamScorecardSummary,
  OrgScorecardSummary,
  EntityScoreSummary,
  ScorecardLevel,
  ScoreTrend,
  BulkEvaluationRequest,
  BulkEvaluationResponse,
} from './types';
import { RuleEngine } from './RuleEngine';

interface Entity {
  metadata: {
    name: string;
    namespace?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    description?: string;
  };
  spec?: {
    type?: string;
    lifecycle?: string;
    owner?: string;
    system?: string;
    [key: string]: unknown;
  };
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
}

export class ScorecardService {
  private scorecards: Map<string, Scorecard> = new Map();
  private results: Map<string, ScorecardResult> = new Map();
  private ruleEngine: RuleEngine;
  private cacheTTL: number = 3600000; // 1 hour

  constructor() {
    this.ruleEngine = new RuleEngine();
    this.initializeDefaultScorecards();
  }

  /**
   * Initialize with default scorecards
   */
  private initializeDefaultScorecards(): void {
    const defaultScorecard: Scorecard = {
      id: 'default-health-scorecard',
      name: 'Service Health Scorecard',
      description: 'Default scorecard for evaluating service health and maturity',
      owner: 'platform-team',
      entityTypes: ['Component'],
      checks: this.getDefaultChecks(),
      levels: this.getDefaultLevels(),
      schedule: {
        enabled: true,
        frequency: 'daily',
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        updatedBy: 'system',
        version: 1,
        status: 'active',
      },
    };

    this.scorecards.set(defaultScorecard.id, defaultScorecard);
  }

  /**
   * Get default checks for the scorecard
   */
  private getDefaultChecks(): ScorecardCheck[] {
    return [
      // Documentation Checks
      {
        id: 'has-description',
        name: 'Has Description',
        description: 'Service has a meaningful description',
        category: 'documentation',
        weight: 5,
        rule: {
          type: 'metadata',
          config: {
            field: 'metadata.description',
            operator: 'exists',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
      {
        id: 'has-techdocs',
        name: 'Has TechDocs',
        description: 'Service has technical documentation configured',
        category: 'documentation',
        weight: 10,
        rule: {
          type: 'annotation',
          config: {
            field: 'backstage.io/techdocs-ref',
            operator: 'exists',
          },
          passingCondition: { type: 'boolean' },
        },
        remediationUrl: '/docs/techdocs-setup',
        enabled: true,
      },
      {
        id: 'has-readme',
        name: 'Has README',
        description: 'Repository has a README file',
        category: 'documentation',
        weight: 5,
        rule: {
          type: 'github',
          config: {
            checkType: 'has_readme',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },

      // Ownership Checks
      {
        id: 'has-owner',
        name: 'Has Owner',
        description: 'Service has an assigned owner',
        category: 'operations',
        weight: 10,
        rule: {
          type: 'metadata',
          config: {
            field: 'spec.owner',
            operator: 'exists',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
      {
        id: 'has-codeowners',
        name: 'Has CODEOWNERS',
        description: 'Repository has a CODEOWNERS file',
        category: 'operations',
        weight: 5,
        rule: {
          type: 'github',
          config: {
            checkType: 'has_codeowners',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },

      // Security Checks
      {
        id: 'branch-protection',
        name: 'Branch Protection',
        description: 'Main branch has protection rules enabled',
        category: 'security',
        weight: 15,
        rule: {
          type: 'github',
          config: {
            checkType: 'branch_protection',
          },
          passingCondition: { type: 'boolean' },
        },
        remediationUrl: '/docs/security/branch-protection',
        enabled: true,
      },
      {
        id: 'security-scan',
        name: 'Security Scanning',
        description: 'Service has security scanning enabled (Snyk/Dependabot)',
        category: 'security',
        weight: 15,
        rule: {
          type: 'github',
          config: {
            checkType: 'dependabot_enabled',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },

      // Reliability Checks
      {
        id: 'has-oncall',
        name: 'On-Call Configured',
        description: 'Service has PagerDuty/on-call rotation configured',
        category: 'reliability',
        weight: 10,
        rule: {
          type: 'annotation',
          config: {
            field: 'pagerduty.com/service-id',
            operator: 'exists',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
      {
        id: 'has-slos',
        name: 'SLOs Defined',
        description: 'Service has SLOs defined',
        category: 'reliability',
        weight: 10,
        rule: {
          type: 'annotation',
          config: {
            field: 'slos/defined',
            operator: 'equals',
            value: 'true',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },

      // Quality Checks
      {
        id: 'ci-passing',
        name: 'CI Passing',
        description: 'CI pipeline is passing on the main branch',
        category: 'quality',
        weight: 10,
        rule: {
          type: 'github',
          config: {
            checkType: 'ci_passing',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
      {
        id: 'test-coverage',
        name: 'Test Coverage',
        description: 'Code coverage is above 70%',
        category: 'quality',
        weight: 10,
        rule: {
          type: 'sonarqube',
          config: {
            query: 'coverage',
            threshold: 70,
          },
          passingCondition: {
            type: 'threshold',
            value: 70,
            comparison: 'gte',
          },
        },
        enabled: true,
      },

      // Observability Checks
      {
        id: 'has-monitoring',
        name: 'Monitoring Configured',
        description: 'Service has monitoring dashboards',
        category: 'observability',
        weight: 10,
        rule: {
          type: 'annotation',
          config: {
            field: 'grafana/dashboard-url',
            operator: 'exists',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
      {
        id: 'has-logging',
        name: 'Structured Logging',
        description: 'Service has structured logging configured',
        category: 'observability',
        weight: 5,
        rule: {
          type: 'label',
          config: {
            field: 'logging/structured',
            operator: 'equals',
            value: 'true',
          },
          passingCondition: { type: 'boolean' },
        },
        enabled: true,
      },
    ];
  }

  /**
   * Get default levels
   */
  private getDefaultLevels(): ScorecardLevel[] {
    return [
      {
        id: 'bronze',
        name: 'Bronze',
        color: '#CD7F32',
        icon: 'shield',
        requirements: [{ type: 'min_score', value: 30 }],
        benefits: ['Basic support', 'Self-service deployments'],
        order: 1,
      },
      {
        id: 'silver',
        name: 'Silver',
        color: '#C0C0C0',
        icon: 'shield',
        requirements: [{ type: 'min_score', value: 50 }],
        benefits: ['Priority support', 'Advanced monitoring'],
        order: 2,
      },
      {
        id: 'gold',
        name: 'Gold',
        color: '#FFD700',
        icon: 'shield',
        requirements: [{ type: 'min_score', value: 75 }],
        benefits: ['Dedicated support', 'Custom SLAs', 'Feature flags'],
        order: 3,
      },
      {
        id: 'platinum',
        name: 'Platinum',
        color: '#E5E4E2',
        icon: 'trophy',
        requirements: [{ type: 'min_score', value: 90 }],
        benefits: ['24/7 support', 'Architecture reviews', 'Priority roadmap'],
        order: 4,
      },
    ];
  }

  // ============================================================================
  // Scorecard CRUD Operations
  // ============================================================================

  async createScorecard(scorecard: Omit<Scorecard, 'id' | 'metadata'>): Promise<Scorecard> {
    const now = new Date().toISOString();
    const newScorecard: Scorecard = {
      ...scorecard,
      id: uuidv4(),
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'current-user',
        updatedBy: 'current-user',
        version: 1,
        status: 'draft',
      },
    };

    this.scorecards.set(newScorecard.id, newScorecard);
    return newScorecard;
  }

  async getScorecard(id: string): Promise<Scorecard | null> {
    return this.scorecards.get(id) || null;
  }

  async listScorecards(): Promise<Scorecard[]> {
    return Array.from(this.scorecards.values());
  }

  async updateScorecard(id: string, updates: Partial<Scorecard>): Promise<Scorecard | null> {
    const existing = this.scorecards.get(id);
    if (!existing) return null;

    const updated: Scorecard = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      metadata: {
        ...existing.metadata,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        version: existing.metadata.version + 1,
      },
    };

    this.scorecards.set(id, updated);
    return updated;
  }

  async deleteScorecard(id: string): Promise<boolean> {
    return this.scorecards.delete(id);
  }

  // ============================================================================
  // Evaluation
  // ============================================================================

  async evaluateEntity(
    scorecardId: string,
    entityRef: string,
    entity: Entity,
    force = false
  ): Promise<ScorecardResult> {
    const scorecard = this.scorecards.get(scorecardId);
    if (!scorecard) {
      throw new Error(`Scorecard not found: ${scorecardId}`);
    }

    // Check cache
    const cacheKey = `${scorecardId}:${entityRef}`;
    if (!force) {
      const cached = this.results.get(cacheKey);
      if (cached && Date.now() - new Date(cached.evaluatedAt).getTime() < this.cacheTTL) {
        return cached;
      }
    }

    // Evaluate all checks
    const checkResults: CheckResult[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const check of scorecard.checks) {
      if (!check.enabled) continue;

      maxScore += check.weight;

      try {
        const result = await this.ruleEngine.evaluateCheck(check, entity);
        totalScore += result.score;
        checkResults.push(result);
      } catch (error) {
        checkResults.push({
          checkId: check.id,
          checkName: check.name,
          category: check.category,
          status: 'error',
          score: 0,
          maxScore: check.weight,
          message: String(error),
          evaluatedAt: new Date().toISOString(),
        });
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Determine level
    let level: string | undefined;
    if (scorecard.levels) {
      const sortedLevels = [...scorecard.levels].sort((a, b) => b.order - a.order);
      for (const lvl of sortedLevels) {
        const meetsRequirements = lvl.requirements.every((req) => {
          if (req.type === 'min_score') {
            return percentage >= (req.value as number);
          }
          return true;
        });
        if (meetsRequirements) {
          level = lvl.id;
          break;
        }
      }
    }

    // Get trend
    const previousResult = this.results.get(cacheKey);
    let trend: ScoreTrend | undefined;
    if (previousResult) {
      const change = percentage - previousResult.percentage;
      trend = {
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        change,
        period: '1 day',
        history: [
          {
            date: previousResult.evaluatedAt,
            score: previousResult.score,
            percentage: previousResult.percentage,
          },
        ],
      };
    }

    const result: ScorecardResult = {
      id: uuidv4(),
      scorecardId,
      entityRef,
      score: totalScore,
      maxScore,
      percentage,
      level,
      checkResults,
      evaluatedAt: new Date().toISOString(),
      trend,
    };

    // Cache result
    this.results.set(cacheKey, result);

    return result;
  }

  async bulkEvaluate(request: BulkEvaluationRequest): Promise<BulkEvaluationResponse> {
    const results: ScorecardResult[] = [];
    let failed = 0;

    // In production, this would fetch entities from the catalog
    // For now, return mock response
    return {
      results,
      total: request.entityRefs?.length || 0,
      completed: results.length,
      failed,
    };
  }

  // ============================================================================
  // Results & Summaries
  // ============================================================================

  async getResult(scorecardId: string, entityRef: string): Promise<ScorecardResult | null> {
    const cacheKey = `${scorecardId}:${entityRef}`;
    return this.results.get(cacheKey) || null;
  }

  async getTeamSummary(teamRef: string, scorecardId?: string): Promise<TeamScorecardSummary> {
    // In production, this would aggregate results for all team entities
    const summary: TeamScorecardSummary = {
      teamRef,
      teamName: teamRef.split('/').pop() || teamRef,
      entityCount: 0,
      averageScore: 0,
      averagePercentage: 0,
      levelDistribution: {},
      categoryScores: {} as Record<CheckCategory, number>,
      trend: {
        direction: 'stable',
        change: 0,
        period: '7 days',
        history: [],
      },
      topPerformers: [],
      needsAttention: [],
    };

    return summary;
  }

  async getOrgSummary(scorecardId?: string): Promise<OrgScorecardSummary> {
    // In production, this would aggregate all results
    const summary: OrgScorecardSummary = {
      totalEntities: 0,
      evaluatedEntities: 0,
      averageScore: 0,
      averagePercentage: 0,
      levelDistribution: {},
      categoryScores: {} as Record<CheckCategory, number>,
      teamRankings: [],
      improvementOpportunities: [],
    };

    return summary;
  }

  // ============================================================================
  // Check Management
  // ============================================================================

  async addCheck(scorecardId: string, check: Omit<ScorecardCheck, 'id'>): Promise<ScorecardCheck | null> {
    const scorecard = this.scorecards.get(scorecardId);
    if (!scorecard) return null;

    const newCheck: ScorecardCheck = {
      ...check,
      id: uuidv4(),
    };

    scorecard.checks.push(newCheck);
    this.scorecards.set(scorecardId, scorecard);

    return newCheck;
  }

  async updateCheck(
    scorecardId: string,
    checkId: string,
    updates: Partial<ScorecardCheck>
  ): Promise<ScorecardCheck | null> {
    const scorecard = this.scorecards.get(scorecardId);
    if (!scorecard) return null;

    const checkIndex = scorecard.checks.findIndex((c) => c.id === checkId);
    if (checkIndex === -1) return null;

    scorecard.checks[checkIndex] = {
      ...scorecard.checks[checkIndex],
      ...updates,
      id: checkId, // Ensure ID doesn't change
    };

    this.scorecards.set(scorecardId, scorecard);
    return scorecard.checks[checkIndex];
  }

  async removeCheck(scorecardId: string, checkId: string): Promise<boolean> {
    const scorecard = this.scorecards.get(scorecardId);
    if (!scorecard) return false;

    const initialLength = scorecard.checks.length;
    scorecard.checks = scorecard.checks.filter((c) => c.id !== checkId);

    if (scorecard.checks.length < initialLength) {
      this.scorecards.set(scorecardId, scorecard);
      return true;
    }

    return false;
  }
}

// Singleton instance
let instance: ScorecardService | null = null;

export function getScorecardService(): ScorecardService {
  if (!instance) {
    instance = new ScorecardService();
  }
  return instance;
}

export default ScorecardService;
