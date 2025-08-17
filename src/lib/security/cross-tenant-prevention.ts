/**
 * Cross-Tenant Data Leakage Prevention System
 * Enterprise-grade protection against data exposure across tenant boundaries
 */

import { enhancedTenantIsolation } from '@/lib/database/enhanced-tenant-isolation';

export interface DataLeakageRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'QUERY_FILTER' | 'RESULT_SANITIZER' | 'ACCESS_VALIDATOR' | 'DATA_CLASSIFIER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: string; // SQL pattern or regex
  action: 'BLOCK' | 'SANITIZE' | 'ALERT' | 'LOG';
  isActive: boolean;
  tenantScope: string[]; // Empty array means applies to all tenants
  createdAt: Date;
  updatedAt: Date;
}

export interface LeakageDetectionResult {
  detected: boolean;
  violations: LeakageViolation[];
  riskScore: number;
  action: 'ALLOW' | 'BLOCK' | 'SANITIZE';
  sanitizedData?: any;
}

export interface LeakageViolation {
  ruleId: string;
  ruleName: string;
  severity: string;
  description: string;
  evidence: string[];
  affectedTenants: string[];
  dataPoints: string[];
  recommendation: string;
}

export interface DataClassification {
  level: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  categories: string[]; // PII, PHI, FINANCIAL, etc.
  tenantOwner: string;
  restrictions: string[];
  retentionPeriod?: number;
  encryptionRequired: boolean;
}

/**
 * Cross-Tenant Data Leakage Prevention Engine
 * Prevents data exposure across tenant boundaries with real-time monitoring
 */
export class CrossTenantLeakagePreventionEngine {
  private readonly rules: Map<string, DataLeakageRule> = new Map();
  private readonly dataClassifications: Map<string, DataClassification> = new Map();
  private readonly violationHistory: LeakageViolation[] = [];
  private readonly tenantDataMap: Map<string, Set<string>> = new Map(); // tenant -> data identifiers
  
  // Performance optimization caches
  private readonly ruleCache: Map<string, DataLeakageRule[]> = new Map();
  private readonly classificationCache: Map<string, DataClassification> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeDataClassifications();
    this.startRealTimeMonitoring();
  }

  /**
   * Primary leakage detection and prevention
   */
  async preventDataLeakage(
    query: string,
    params: any[],
    tenantId: string,
    userId?: string,
    context?: { operation: string; resourceType: string }
  ): Promise<LeakageDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Get applicable rules for this tenant and operation
      const applicableRules = await this.getApplicableRules(tenantId, context?.operation || 'UNKNOWN');
      
      const violations: LeakageViolation[] = [];
      let riskScore = 0;
      let shouldBlock = false;
      let shouldSanitize = false;

      // Check each rule against the query
      for (const rule of applicableRules) {
        const violation = await this.checkRule(rule, query, params, tenantId, userId);
        
        if (violation) {
          violations.push(violation);
          riskScore += this.calculateRiskScore(violation);
          
          switch (rule.action) {
            case 'BLOCK':
              shouldBlock = true;
              break;
            case 'SANITIZE':
              shouldSanitize = true;
              break;
            case 'ALERT':
              await this.sendSecurityAlert(violation, tenantId);
              break;
            case 'LOG':
              await this.logViolation(violation, tenantId);
              break;
          }
        }
      }

      // Determine final action
      let finalAction: 'ALLOW' | 'BLOCK' | 'SANITIZE' = 'ALLOW';
      
      if (shouldBlock || riskScore >= 80) {
        finalAction = 'BLOCK';
      } else if (shouldSanitize || riskScore >= 40) {
        finalAction = 'SANITIZE';
      }

      // Record metrics
      const processingTime = Date.now() - startTime;
      await this.recordMetrics(tenantId, {
        processingTime,
        rulesChecked: applicableRules.length,
        violationsFound: violations.length,
        riskScore,
        action: finalAction,
      });

      return {
        detected: violations.length > 0,
        violations,
        riskScore,
        action: finalAction,
      };

    } catch (error) {
      console.error('Data leakage prevention error:', error);
      
      // Fail securely - block on error
      return {
        detected: true,
        violations: [{
          ruleId: 'SYSTEM_ERROR',
          ruleName: 'System Error Protection',
          severity: 'CRITICAL',
          description: 'Data leakage prevention system error - blocking for security',
          evidence: [error instanceof Error ? error.message : 'Unknown error'],
          affectedTenants: [tenantId],
          dataPoints: [],
          recommendation: 'Check system logs and contact security team',
        }],
        riskScore: 100,
        action: 'BLOCK',
      };
    }
  }

  /**
   * Sanitize query results to prevent data leakage
   */
  async sanitizeResults<T>(
    results: T[],
    tenantId: string,
    context: { operation: string; resourceType: string }
  ): Promise<T[]> {
    if (!results || results.length === 0) {
      return results;
    }

    const sanitizedResults: T[] = [];
    
    for (const result of results) {
      const sanitizedResult = await this.sanitizeRecord(result, tenantId, context);
      sanitizedResults.push(sanitizedResult);
    }

    return sanitizedResults;
  }

  /**
   * Classify data sensitivity and ownership
   */
  async classifyData(
    data: any,
    tenantId: string,
    context: { table: string; column?: string }
  ): Promise<DataClassification> {
    const cacheKey = `${tenantId}:${context.table}:${context.column || '*'}`;
    const cached = this.classificationCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const classification = await this.performDataClassification(data, tenantId, context);
    
    // Cache for 10 minutes
    this.classificationCache.set(cacheKey, classification);
    setTimeout(() => this.classificationCache.delete(cacheKey), 600000);

    return classification;
  }

  /**
   * Validate cross-tenant access attempt
   */
  async validateCrossTenantAccess(
    sourceTenantId: string,
    targetTenantId: string,
    operation: string,
    resourceType: string,
    userId?: string
  ): Promise<{ allowed: boolean; reason?: string; restrictions?: string[] }> {
    // Cross-tenant access is generally prohibited
    if (sourceTenantId !== targetTenantId) {
      
      // Check for specific exemptions (e.g., system admin, shared resources)
      const exemptions = await this.getCrossTenantExemptions(sourceTenantId, targetTenantId);
      
      for (const exemption of exemptions) {
        if (this.matchesExemption(exemption, operation, resourceType, userId)) {
          return {
            allowed: true,
            restrictions: exemption.restrictions,
          };
        }
      }

      // Log the attempt
      await this.logCrossTenantAttempt({
        sourceTenantId,
        targetTenantId,
        operation,
        resourceType,
        userId,
        blocked: true,
        timestamp: new Date(),
      });

      return {
        allowed: false,
        reason: `Cross-tenant access from ${sourceTenantId} to ${targetTenantId} is not permitted`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get applicable rules for tenant and operation
   */
  private async getApplicableRules(tenantId: string, operation: string): Promise<DataLeakageRule[]> {
    const cacheKey = `${tenantId}:${operation}`;
    const cached = this.ruleCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allRules = Array.from(this.rules.values());
    const applicableRules = allRules.filter(rule => {
      // Check if rule is active
      if (!rule.isActive) return false;
      
      // Check tenant scope
      if (rule.tenantScope.length > 0 && !rule.tenantScope.includes(tenantId)) {
        return false;
      }
      
      // Check operation type (simplified)
      if (rule.ruleType === 'QUERY_FILTER' && !operation.includes('SELECT')) {
        return false;
      }
      
      return true;
    });

    // Cache for 5 minutes
    this.ruleCache.set(cacheKey, applicableRules);
    setTimeout(() => this.ruleCache.delete(cacheKey), 300000);

    return applicableRules;
  }

  /**
   * Check individual rule against query
   */
  private async checkRule(
    rule: DataLeakageRule,
    query: string,
    params: any[],
    tenantId: string,
    userId?: string
  ): Promise<LeakageViolation | null> {
    try {
      switch (rule.ruleType) {
        case 'QUERY_FILTER':
          return this.checkQueryFilterRule(rule, query, tenantId);
        
        case 'ACCESS_VALIDATOR':
          return this.checkAccessValidatorRule(rule, query, tenantId, userId);
        
        case 'DATA_CLASSIFIER':
          return this.checkDataClassifierRule(rule, query, params, tenantId);
        
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error checking rule ${rule.id}:`, error);
      return null;
    }
  }

  /**
   * Check query filter rule (prevents cross-tenant queries)
   */
  private checkQueryFilterRule(
    rule: DataLeakageRule,
    query: string,
    tenantId: string
  ): LeakageViolation | null {
    const pattern = new RegExp(rule.pattern, 'gi');
    const matches = query.match(pattern);
    
    if (matches) {
      // Check if query contains references to other tenants
      const otherTenantPattern = /tenant_id\s*[=!<>]\s*'([^']+)'/gi;
      const tenantMatches = query.match(otherTenantPattern);
      
      if (tenantMatches) {
        const referencedTenants = tenantMatches
          .map(match => match.match(/'([^']+)'/)?.[1])
          .filter(Boolean) as string[];
        
        const crossTenantRefs = referencedTenants.filter(t => t !== tenantId);
        
        if (crossTenantRefs.length > 0) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            description: `Query contains cross-tenant references`,
            evidence: matches,
            affectedTenants: [tenantId, ...crossTenantRefs],
            dataPoints: referencedTenants,
            recommendation: 'Remove cross-tenant references from query',
          };
        }
      }
    }

    return null;
  }

  /**
   * Check access validator rule
   */
  private checkAccessValidatorRule(
    rule: DataLeakageRule,
    query: string,
    tenantId: string,
    userId?: string
  ): LeakageViolation | null {
    // Check for unauthorized table access
    const sensitiveTablesPattern = /(?:FROM|JOIN|INTO|UPDATE)\s+(secrets|api_keys|encryption_keys|billing_data|audit_logs)/gi;
    const matches = query.match(sensitiveTablesPattern);
    
    if (matches && (!userId || !this.hasAdminAccess(tenantId, userId))) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: 'Unauthorized access to sensitive tables',
        evidence: matches,
        affectedTenants: [tenantId],
        dataPoints: matches,
        recommendation: 'Request admin access or use appropriate API endpoints',
      };
    }

    return null;
  }

  /**
   * Check data classifier rule
   */
  private checkDataClassifierRule(
    rule: DataLeakageRule,
    query: string,
    params: any[],
    tenantId: string
  ): LeakageViolation | null {
    // Check for PII data exposure in query parameters
    const piiPattern = /\b(?:\d{3}-\d{2}-\d{4}|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b|\+?1?-?\(?[0-9]{3}\)?-?[0-9]{3}-?[0-9]{4})\b/;
    
    const queryText = query + ' ' + params.join(' ');
    const matches = queryText.match(piiPattern);
    
    if (matches) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: 'PII data detected in query parameters',
        evidence: matches,
        affectedTenants: [tenantId],
        dataPoints: matches,
        recommendation: 'Use parameterized queries and encrypt PII data',
      };
    }

    return null;
  }

  /**
   * Sanitize individual record
   */
  private async sanitizeRecord<T>(
    record: T,
    tenantId: string,
    context: { operation: string; resourceType: string }
  ): Promise<T> {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const sanitized = { ...record } as any;
    
    // Remove cross-tenant references
    if ('tenant_id' in sanitized && sanitized.tenant_id !== tenantId) {
      // This record belongs to another tenant - should not be returned
      throw new Error(`Cross-tenant data leakage detected: Record belongs to ${sanitized.tenant_id}, requested by ${tenantId}`);
    }

    // Sanitize sensitive fields based on classification
    const sensitiveFields = ['password', 'secret', 'token', 'api_key', 'private_key', 'ssn', 'tax_id'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Remove internal fields
    const internalFields = ['created_by_system', 'internal_notes', 'debug_info'];
    for (const field of internalFields) {
      delete sanitized[field];
    }

    return sanitized;
  }

  /**
   * Perform data classification
   */
  private async performDataClassification(
    data: any,
    tenantId: string,
    context: { table: string; column?: string }
  ): Promise<DataClassification> {
    // Default classification
    let level: DataClassification['level'] = 'INTERNAL';
    const categories: string[] = [];
    let encryptionRequired = false;

    // Classify based on table and column
    if (context.table === 'users' || context.table === 'user_profiles') {
      level = 'CONFIDENTIAL';
      categories.push('PII');
      encryptionRequired = true;
    } else if (context.table === 'billing_records' || context.table === 'payments') {
      level = 'RESTRICTED';
      categories.push('FINANCIAL');
      encryptionRequired = true;
    } else if (context.table === 'audit_logs') {
      level = 'CONFIDENTIAL';
      categories.push('AUDIT');
      encryptionRequired = true;
    } else if (context.table === 'secrets' || context.table === 'api_keys') {
      level = 'RESTRICTED';
      categories.push('SECRETS');
      encryptionRequired = true;
    }

    // Classify based on column name
    if (context.column) {
      const sensitiveColumns = ['email', 'phone', 'ssn', 'tax_id', 'password', 'secret', 'token'];
      if (sensitiveColumns.includes(context.column.toLowerCase())) {
        level = 'RESTRICTED';
        categories.push('PII');
        encryptionRequired = true;
      }
    }

    return {
      level,
      categories,
      tenantOwner: tenantId,
      restrictions: level === 'RESTRICTED' ? ['ADMIN_ONLY', 'AUDIT_REQUIRED'] : [],
      retentionPeriod: level === 'RESTRICTED' ? 2555 : 365, // 7 years vs 1 year
      encryptionRequired,
    };
  }

  /**
   * Calculate risk score for violation
   */
  private calculateRiskScore(violation: LeakageViolation): number {
    const severityScores = {
      'LOW': 10,
      'MEDIUM': 25,
      'HIGH': 50,
      'CRITICAL': 75,
    };

    let score = severityScores[violation.severity as keyof typeof severityScores] || 10;
    
    // Increase score based on affected tenants
    score += Math.min(violation.affectedTenants.length * 10, 20);
    
    // Increase score for data exposure
    score += Math.min(violation.dataPoints.length * 5, 15);

    return Math.min(score, 100);
  }

  /**
   * Check if user has admin access
   */
  private hasAdminAccess(tenantId: string, userId: string): boolean {
    // This would check actual user permissions in production
    return userId.includes('admin') || userId.includes('system');
  }

  /**
   * Get cross-tenant exemptions
   */
  private async getCrossTenantExemptions(
    sourceTenantId: string,
    targetTenantId: string
  ): Promise<Array<{ operation: string; resourceType: string; restrictions: string[] }>> {
    // Return any configured exemptions (e.g., for system operations)
    return [];
  }

  /**
   * Check if exemption matches
   */
  private matchesExemption(
    exemption: { operation: string; resourceType: string },
    operation: string,
    resourceType: string,
    userId?: string
  ): boolean {
    return exemption.operation === '*' || exemption.operation === operation &&
           exemption.resourceType === '*' || exemption.resourceType === resourceType;
  }

  /**
   * Initialize default security rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: DataLeakageRule[] = [
      {
        id: 'cross-tenant-query-block',
        name: 'Cross-Tenant Query Blocker',
        description: 'Prevents queries from accessing data across tenant boundaries',
        ruleType: 'QUERY_FILTER',
        severity: 'CRITICAL',
        pattern: 'tenant_id\\s*[=!<>]\\s*\'[^\']+\'',
        action: 'BLOCK',
        isActive: true,
        tenantScope: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'sensitive-table-access',
        name: 'Sensitive Table Access Control',
        description: 'Controls access to sensitive tables like secrets and billing data',
        ruleType: 'ACCESS_VALIDATOR',
        severity: 'HIGH',
        pattern: '(?:FROM|JOIN|INTO|UPDATE)\\s+(secrets|api_keys|billing_data)',
        action: 'BLOCK',
        isActive: true,
        tenantScope: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'pii-data-classifier',
        name: 'PII Data Classifier',
        description: 'Detects and classifies personally identifiable information',
        ruleType: 'DATA_CLASSIFIER',
        severity: 'MEDIUM',
        pattern: '\\b(?:\\d{3}-\\d{2}-\\d{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,})\\b',
        action: 'SANITIZE',
        isActive: true,
        tenantScope: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    console.log(`Initialized ${defaultRules.length} data leakage prevention rules`);
  }

  /**
   * Initialize data classifications
   */
  private initializeDataClassifications(): void {
    // This would load classifications from configuration
    console.log('Initialized data classifications');
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    // Monitor for patterns and anomalies
    setInterval(() => {
      this.analyzeViolationTrends();
    }, 300000); // Every 5 minutes
  }

  /**
   * Analyze violation trends for proactive security
   */
  private analyzeViolationTrends(): void {
    const recentViolations = this.violationHistory.filter(
      v => Date.now() - new Date(v.toString()).getTime() < 3600000 // Last hour
    );

    if (recentViolations.length > 10) {
      console.warn(`High number of data leakage violations detected: ${recentViolations.length} in the last hour`);
    }
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(violation: LeakageViolation, tenantId: string): Promise<void> {
    console.warn('SECURITY ALERT:', {
      tenantId,
      violation: violation.ruleName,
      severity: violation.severity,
      description: violation.description,
    });

    // In production, this would send to security team
  }

  /**
   * Log violation
   */
  private async logViolation(violation: LeakageViolation, tenantId: string): Promise<void> {
    this.violationHistory.push(violation);
    
    // Keep history bounded
    if (this.violationHistory.length > 1000) {
      this.violationHistory.splice(0, 500);
    }

    console.log('Data leakage violation logged:', {
      tenantId,
      rule: violation.ruleName,
      severity: violation.severity,
    });
  }

  /**
   * Log cross-tenant access attempt
   */
  private async logCrossTenantAttempt(attempt: {
    sourceTenantId: string;
    targetTenantId: string;
    operation: string;
    resourceType: string;
    userId?: string;
    blocked: boolean;
    timestamp: Date;
  }): Promise<void> {
    console.warn('Cross-tenant access attempt:', attempt);
    
    // In production, this would be stored in audit database
  }

  /**
   * Record performance metrics
   */
  private async recordMetrics(
    tenantId: string,
    metrics: {
      processingTime: number;
      rulesChecked: number;
      violationsFound: number;
      riskScore: number;
      action: string;
    }
  ): Promise<void> {
    // Record metrics for monitoring dashboard
    console.debug('Data leakage prevention metrics:', { tenantId, ...metrics });
  }

  /**
   * Get violation statistics for tenant
   */
  getViolationStats(tenantId: string): {
    totalViolations: number;
    criticalViolations: number;
    recentViolations: number;
    topRules: Array<{ ruleId: string; count: number }>;
  } {
    const tenantViolations = this.violationHistory.filter(v => 
      v.affectedTenants.includes(tenantId)
    );

    const critical = tenantViolations.filter(v => v.severity === 'CRITICAL').length;
    const recent = tenantViolations.filter(v => 
      Date.now() - new Date(v.toString()).getTime() < 86400000 // Last 24 hours
    ).length;

    // Count violations by rule
    const ruleCounts = new Map<string, number>();
    tenantViolations.forEach(v => {
      ruleCounts.set(v.ruleId, (ruleCounts.get(v.ruleId) || 0) + 1);
    });

    const topRules = Array.from(ruleCounts.entries())
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalViolations: tenantViolations.length,
      criticalViolations: critical,
      recentViolations: recent,
      topRules,
    };
  }
}

// Global instance
export const crossTenantLeakagePrevention = new CrossTenantLeakagePreventionEngine();

export default crossTenantLeakagePrevention;