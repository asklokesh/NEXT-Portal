/**
 * Rule Engine
 * Evaluates scorecard check rules against entities
 */

import {
  ScorecardCheck,
  CheckResult,
  CheckStatus,
  RuleOperator,
  CheckEvidence,
} from './types';

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

export class RuleEngine {
  /**
   * Evaluate a check against an entity
   */
  async evaluateCheck(check: ScorecardCheck, entity: Entity): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      let status: CheckStatus;
      let message: string | undefined;
      let details: Record<string, unknown> | undefined;
      let evidence: CheckEvidence | undefined;

      switch (check.rule.type) {
        case 'metadata':
          ({ status, message, details, evidence } = this.evaluateMetadataRule(check, entity));
          break;

        case 'annotation':
          ({ status, message, details, evidence } = this.evaluateAnnotationRule(check, entity));
          break;

        case 'label':
          ({ status, message, details, evidence } = this.evaluateLabelRule(check, entity));
          break;

        case 'relation':
          ({ status, message, details, evidence } = this.evaluateRelationRule(check, entity));
          break;

        case 'api':
          ({ status, message, details, evidence } = await this.evaluateApiRule(check, entity));
          break;

        case 'github':
          ({ status, message, details, evidence } = await this.evaluateGitHubRule(check, entity));
          break;

        case 'sonarqube':
          ({ status, message, details, evidence } = await this.evaluateSonarQubeRule(check, entity));
          break;

        case 'snyk':
          ({ status, message, details, evidence } = await this.evaluateSnykRule(check, entity));
          break;

        case 'pagerduty':
          ({ status, message, details, evidence } = await this.evaluatePagerDutyRule(check, entity));
          break;

        case 'datadog':
          ({ status, message, details, evidence } = await this.evaluateDatadogRule(check, entity));
          break;

        case 'prometheus':
          ({ status, message, details, evidence } = await this.evaluatePrometheusRule(check, entity));
          break;

        case 'custom':
          ({ status, message, details, evidence } = await this.evaluateCustomRule(check, entity));
          break;

        default:
          status = 'error';
          message = `Unknown rule type: ${check.rule.type}`;
      }

      const score = status === 'pass' ? check.weight : status === 'warning' ? Math.floor(check.weight / 2) : 0;

      return {
        checkId: check.id,
        checkName: check.name,
        category: check.category,
        status,
        score,
        maxScore: check.weight,
        message,
        details,
        evidence,
        evaluatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        checkId: check.id,
        checkName: check.name,
        category: check.category,
        status: 'error',
        score: 0,
        maxScore: check.weight,
        message: `Evaluation error: ${error}`,
        evaluatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Evaluate metadata field rule
   */
  private evaluateMetadataRule(
    check: ScorecardCheck,
    entity: Entity
  ): { status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence } {
    const { field, operator, value } = check.rule.config;
    const actualValue = this.getNestedValue(entity, field!);

    const result = this.compareValues(actualValue, operator!, value);

    return {
      status: result ? 'pass' : 'fail',
      message: result
        ? `${field} check passed`
        : `${field} check failed: expected ${operator} ${value}, got ${actualValue}`,
      details: {
        field,
        expectedOperator: operator,
        expectedValue: value,
        actualValue,
      },
      evidence: {
        type: 'json',
        data: { field, value: actualValue },
        label: 'Metadata value',
      },
    };
  }

  /**
   * Evaluate annotation rule
   */
  private evaluateAnnotationRule(
    check: ScorecardCheck,
    entity: Entity
  ): { status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence } {
    const { field, operator, value } = check.rule.config;
    const annotations = entity.metadata.annotations || {};
    const actualValue = annotations[field!];

    const result = this.compareValues(actualValue, operator!, value);

    return {
      status: result ? 'pass' : 'fail',
      message: result
        ? `Annotation ${field} is set correctly`
        : `Annotation ${field} is missing or incorrect`,
      details: {
        annotation: field,
        expectedOperator: operator,
        expectedValue: value,
        actualValue,
      },
    };
  }

  /**
   * Evaluate label rule
   */
  private evaluateLabelRule(
    check: ScorecardCheck,
    entity: Entity
  ): { status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence } {
    const { field, operator, value } = check.rule.config;
    const labels = entity.metadata.labels || {};
    const actualValue = labels[field!];

    const result = this.compareValues(actualValue, operator!, value);

    return {
      status: result ? 'pass' : 'fail',
      message: result
        ? `Label ${field} is set correctly`
        : `Label ${field} is missing or incorrect`,
      details: {
        label: field,
        expectedOperator: operator,
        expectedValue: value,
        actualValue,
      },
    };
  }

  /**
   * Evaluate relation rule
   */
  private evaluateRelationRule(
    check: ScorecardCheck,
    entity: Entity
  ): { status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence } {
    const { field: relationType, operator, value } = check.rule.config;
    const relations = entity.relations || [];
    const matchingRelations = relations.filter((r) => r.type === relationType);

    let result = false;
    switch (operator) {
      case 'exists':
        result = matchingRelations.length > 0;
        break;
      case 'not_exists':
        result = matchingRelations.length === 0;
        break;
      case 'equals':
        result = matchingRelations.some((r) => r.targetRef === value);
        break;
      case 'contains':
        result = matchingRelations.some((r) => r.targetRef.includes(value as string));
        break;
      case 'greater_than':
        result = matchingRelations.length > (value as number);
        break;
      default:
        result = matchingRelations.length > 0;
    }

    return {
      status: result ? 'pass' : 'fail',
      message: result
        ? `Relation ${relationType} check passed`
        : `Required relation ${relationType} not found`,
      details: {
        relationType,
        relationCount: matchingRelations.length,
        relations: matchingRelations,
      },
    };
  }

  /**
   * Evaluate API rule
   */
  private async evaluateApiRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const { endpoint, method, headers, jsonPath, threshold } = check.rule.config;

    try {
      // Replace entity placeholders in endpoint
      const resolvedEndpoint = this.resolveTemplate(endpoint!, entity);

      // In production, make actual HTTP request
      // For now, return mock result
      const mockResult = Math.random() > 0.3; // 70% pass rate for demo

      return {
        status: mockResult ? 'pass' : 'fail',
        message: mockResult ? 'API check passed' : 'API check failed',
        details: {
          endpoint: resolvedEndpoint,
          method: method || 'GET',
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `API request failed: ${error}`,
      };
    }
  }

  /**
   * Evaluate GitHub rule
   */
  private async evaluateGitHubRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const { checkType } = check.rule.config;
    const annotations = entity.metadata.annotations || {};
    const repoUrl = annotations['github.com/project-slug'] || annotations['backstage.io/source-location'];

    if (!repoUrl) {
      return {
        status: 'skipped',
        message: 'No GitHub repository configured',
      };
    }

    // In production, these would make actual GitHub API calls
    // For now, return mock results based on check type
    let result = false;
    let message = '';

    switch (checkType) {
      case 'has_readme':
        result = Math.random() > 0.2;
        message = result ? 'README file found' : 'README file not found';
        break;

      case 'has_codeowners':
        result = Math.random() > 0.4;
        message = result ? 'CODEOWNERS file found' : 'CODEOWNERS file not found';
        break;

      case 'branch_protection':
        result = Math.random() > 0.5;
        message = result ? 'Branch protection enabled' : 'Branch protection not configured';
        break;

      case 'ci_passing':
        result = Math.random() > 0.2;
        message = result ? 'CI pipeline passing' : 'CI pipeline failing or not configured';
        break;

      case 'dependabot_enabled':
        result = Math.random() > 0.5;
        message = result ? 'Dependabot/security alerts enabled' : 'Security scanning not configured';
        break;

      default:
        return {
          status: 'error',
          message: `Unknown GitHub check type: ${checkType}`,
        };
    }

    return {
      status: result ? 'pass' : 'fail',
      message,
      details: {
        checkType,
        repository: repoUrl,
      },
      evidence: repoUrl
        ? {
            type: 'link',
            data: repoUrl,
            label: 'Repository',
          }
        : undefined,
    };
  }

  /**
   * Evaluate SonarQube rule
   */
  private async evaluateSonarQubeRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const { query, threshold } = check.rule.config;
    const annotations = entity.metadata.annotations || {};
    const projectKey = annotations['sonarqube.org/project-key'];

    if (!projectKey) {
      return {
        status: 'skipped',
        message: 'No SonarQube project configured',
      };
    }

    // In production, make actual SonarQube API call
    // Mock result for demo
    const mockValue = Math.floor(Math.random() * 100);
    const meetsThreshold = this.evaluateThreshold(mockValue, check.rule.passingCondition);

    return {
      status: meetsThreshold ? 'pass' : 'fail',
      message: meetsThreshold
        ? `${query} is ${mockValue}%, meets threshold of ${threshold}%`
        : `${query} is ${mockValue}%, below threshold of ${threshold}%`,
      details: {
        metric: query,
        value: mockValue,
        threshold,
        projectKey,
      },
    };
  }

  /**
   * Evaluate Snyk rule
   */
  private async evaluateSnykRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    // Mock implementation
    const mockVulnerabilities = Math.floor(Math.random() * 10);
    const { threshold = 0 } = check.rule.config;

    return {
      status: mockVulnerabilities <= (threshold as number) ? 'pass' : 'fail',
      message:
        mockVulnerabilities === 0
          ? 'No vulnerabilities found'
          : `${mockVulnerabilities} vulnerabilities found`,
      details: {
        vulnerabilityCount: mockVulnerabilities,
        threshold,
      },
    };
  }

  /**
   * Evaluate PagerDuty rule
   */
  private async evaluatePagerDutyRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const annotations = entity.metadata.annotations || {};
    const serviceId = annotations['pagerduty.com/service-id'];

    if (!serviceId) {
      return {
        status: 'fail',
        message: 'No PagerDuty service configured',
      };
    }

    // Mock: Check if on-call is configured
    return {
      status: 'pass',
      message: 'PagerDuty service configured with on-call rotation',
      details: {
        serviceId,
      },
    };
  }

  /**
   * Evaluate Datadog rule
   */
  private async evaluateDatadogRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    // Mock implementation
    const mockDashboardExists = Math.random() > 0.3;

    return {
      status: mockDashboardExists ? 'pass' : 'fail',
      message: mockDashboardExists
        ? 'Datadog monitoring configured'
        : 'No Datadog dashboard found',
    };
  }

  /**
   * Evaluate Prometheus rule
   */
  private async evaluatePrometheusRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const { query, threshold } = check.rule.config;

    // Mock implementation
    const mockMetricValue = Math.random() * 100;
    const meetsThreshold = this.evaluateThreshold(mockMetricValue, check.rule.passingCondition);

    return {
      status: meetsThreshold ? 'pass' : 'fail',
      message: `Prometheus metric: ${mockMetricValue.toFixed(2)}`,
      details: {
        query,
        value: mockMetricValue,
        threshold,
      },
    };
  }

  /**
   * Evaluate custom rule
   */
  private async evaluateCustomRule(
    check: ScorecardCheck,
    entity: Entity
  ): Promise<{ status: CheckStatus; message?: string; details?: Record<string, unknown>; evidence?: CheckEvidence }> {
    const { script, timeout = 5000 } = check.rule.config;

    if (!script) {
      return {
        status: 'error',
        message: 'No custom script provided',
      };
    }

    // In production, this would safely execute the custom script
    // For now, return a mock result
    return {
      status: Math.random() > 0.5 ? 'pass' : 'fail',
      message: 'Custom check evaluated',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private compareValues(actual: unknown, operator: RuleOperator, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected as string);
      case 'not_contains':
        return typeof actual === 'string' && !actual.includes(expected as string);
      case 'starts_with':
        return typeof actual === 'string' && actual.startsWith(expected as string);
      case 'ends_with':
        return typeof actual === 'string' && actual.endsWith(expected as string);
      case 'regex':
        return typeof actual === 'string' && new RegExp(expected as string).test(actual);
      case 'exists':
        return actual !== undefined && actual !== null && actual !== '';
      case 'not_exists':
        return actual === undefined || actual === null || actual === '';
      case 'greater_than':
        return typeof actual === 'number' && actual > (expected as number);
      case 'less_than':
        return typeof actual === 'number' && actual < (expected as number);
      case 'between':
        if (typeof actual === 'number' && Array.isArray(expected) && expected.length === 2) {
          return actual >= expected[0] && actual <= expected[1];
        }
        return false;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  private evaluateThreshold(
    value: number,
    condition: { type: string; value?: number; comparison?: string }
  ): boolean {
    if (condition.type !== 'threshold' || condition.value === undefined) {
      return value > 0;
    }

    switch (condition.comparison) {
      case 'gte':
        return value >= condition.value;
      case 'lte':
        return value <= condition.value;
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'eq':
        return value === condition.value;
      default:
        return value >= condition.value;
    }
  }

  private resolveTemplate(template: string, entity: Entity): string {
    return template
      .replace(/\{\{entity\.name\}\}/g, entity.metadata.name)
      .replace(/\{\{entity\.namespace\}\}/g, entity.metadata.namespace || 'default')
      .replace(/\{\{entity\.owner\}\}/g, entity.spec?.owner || '')
      .replace(/\{\{entity\.type\}\}/g, entity.spec?.type || '');
  }
}

export default RuleEngine;
