/**
 * Multi-Tenant Data Isolation with PostgreSQL Row-Level Security (RLS)
 * Enterprise-grade tenant boundary enforcement and data governance
 */

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  tier: 'starter' | 'professional' | 'enterprise';
  dataResidency: string; // Region where data must stay
  complianceLevel: 'standard' | 'enhanced' | 'strict';
  isolationMode: 'shared' | 'dedicated';
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantIsolationConfig {
  enableRLS: boolean;
  enforceDataResidency: boolean;
  auditAllQueries: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  retentionPolicy: {
    auditLogs: number; // days
    userActivity: number; // days
    systemMetrics: number; // days
  };
  complianceSettings: {
    gdprCompliant: boolean;
    soc2Type2: boolean;
    hipaaCompliant: boolean;
    pciDssCompliant: boolean;
  };
}

export interface DataAccessPolicy {
  id: string;
  tenantId: string;
  resourceType: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  conditions: string; // SQL WHERE clause
  enabled: boolean;
  createdBy: string;
  validUntil?: Date;
}

export interface TenantAuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  sqlQuery?: string;
  clientIP: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  executionTime: number;
  timestamp: Date;
  dataAccessed?: {
    rows: number;
    columns: string[];
    sensitive: boolean;
  };
}

export interface ComplianceReport {
  tenantId: string;
  reportType: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS';
  generatedAt: Date;
  period: { start: Date; end: Date };
  findings: ComplianceFinding[];
  overallScore: number;
  recommendations: string[];
  nextReviewDate: Date;
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  evidence: string[];
  remediation: string;
  dueDate?: Date;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}

/**
 * Tenant Isolation Manager
 * Manages multi-tenant data isolation, RLS policies, and compliance
 */
export class TenantIsolationManager {
  private tenantContexts: Map<string, TenantContext> = new Map();
  private isolationConfigs: Map<string, TenantIsolationConfig> = new Map();
  private accessPolicies: Map<string, DataAccessPolicy[]> = new Map();
  private auditLogs: TenantAuditLog[] = [];
  private complianceReports: Map<string, ComplianceReport[]> = new Map();
  private currentTenantContext: string | null = null;

  constructor() {
    this.initializeSystemTenants();
    this.initializeDefaultPolicies();
    this.startComplianceMonitoring();
  }

  /**
   * Set tenant context for current request
   */
  setTenantContext(tenantId: string): void {
    const tenant = this.tenantContexts.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    this.currentTenantContext = tenantId;
    
    // Set PostgreSQL RLS context
    this.setDatabaseTenantContext(tenantId);
  }

  /**
   * Clear tenant context
   */
  clearTenantContext(): void {
    this.currentTenantContext = null;
    this.clearDatabaseTenantContext();
  }

  /**
   * Execute query with tenant isolation
   */
  async executeQuery<T>(
    sql: string,
    params: any[] = [],
    options: {
      operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
      resourceType: string;
      resourceId?: string;
      userId?: string;
      clientIP?: string;
      userAgent?: string;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const tenantId = this.currentTenantContext;

    if (!tenantId) {
      throw new Error('No tenant context set for database operation');
    }

    const tenant = this.tenantContexts.get(tenantId);
    const config = this.isolationConfigs.get(tenantId);

    if (!tenant || !config) {
      throw new Error('Tenant configuration not found');
    }

    try {
      // Validate data residency
      if (config.enforceDataResidency) {
        await this.validateDataResidency(tenantId, options.operation);
      }

      // Check access policies
      await this.validateAccessPolicy(tenantId, options);

      // Execute query with RLS enabled
      const result = await this.executeSecureQuery<T>(sql, params, tenantId);

      // Audit successful operation
      if (config.auditAllQueries) {
        await this.auditDatabaseOperation({
          tenantId,
          userId: options.userId,
          action: options.operation,
          resourceType: options.resourceType,
          resourceId: options.resourceId || 'unknown',
          sqlQuery: this.sanitizeQueryForAudit(sql),
          clientIP: options.clientIP || 'unknown',
          userAgent: options.userAgent || 'unknown',
          success: true,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
          dataAccessed: this.analyzeDataAccess(result, options.operation)
        });
      }

      return result;

    } catch (error) {
      // Audit failed operation
      if (config?.auditAllQueries) {
        await this.auditDatabaseOperation({
          tenantId,
          userId: options.userId,
          action: options.operation,
          resourceType: options.resourceType,
          resourceId: options.resourceId || 'unknown',
          sqlQuery: this.sanitizeQueryForAudit(sql),
          clientIP: options.clientIP || 'unknown',
          userAgent: options.userAgent || 'unknown',
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        });
      }

      throw error;
    }
  }

  /**
   * Create tenant isolation policies
   */
  async createTenantIsolation(tenantId: string): Promise<void> {
    const tenant = this.tenantContexts.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Create RLS policies for all tenant-aware tables
    const tables = [
      'plugins',
      'plugin_versions',
      'catalog_entities',
      'user_sessions',
      'audit_logs',
      'billing_records',
      'usage_metrics',
      'notifications',
      'workflows',
      'secrets'
    ];

    for (const table of tables) {
      await this.createTableRLSPolicy(table, tenantId);
    }

    console.log(`Created tenant isolation policies for tenant: ${tenantId}`);
  }

  /**
   * Create RLS policy for specific table
   */
  private async createTableRLSPolicy(tableName: string, tenantId: string): Promise<void> {
    const policyName = `${tableName}_tenant_isolation_${tenantId.replace('-', '_')}`;
    
    const createPolicySQL = `
      CREATE POLICY ${policyName} ON ${tableName}
      FOR ALL
      TO tenant_role_${tenantId.replace('-', '_')}
      USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
    `;

    try {
      await this.executeSystemQuery(createPolicySQL);
      console.log(`Created RLS policy for ${tableName}: ${policyName}`);
    } catch (error) {
      console.error(`Failed to create RLS policy for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Enable RLS on table
   */
  async enableRLSOnTable(tableName: string): Promise<void> {
    const enableRLSSQL = `
      ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;
    `;

    await this.executeSystemQuery(enableRLSSQL);
    console.log(`Enabled RLS on table: ${tableName}`);
  }

  /**
   * Create tenant-specific database role
   */
  async createTenantRole(tenantId: string, permissions: string[] = []): Promise<void> {
    const roleName = `tenant_role_${tenantId.replace('-', '_')}`;
    
    const createRoleSQL = `
      CREATE ROLE ${roleName};
      GRANT CONNECT ON DATABASE nextportal TO ${roleName};
      GRANT USAGE ON SCHEMA public TO ${roleName};
    `;

    await this.executeSystemQuery(createRoleSQL);

    // Grant specific table permissions
    const defaultPermissions = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    ];

    const permissionsToGrant = permissions.length > 0 ? permissions : defaultPermissions;
    
    for (const permission of permissionsToGrant) {
      const grantSQL = `
        GRANT ${permission} ON ALL TABLES IN SCHEMA public TO ${roleName};
        GRANT ${permission} ON ALL SEQUENCES IN SCHEMA public TO ${roleName};
      `;
      await this.executeSystemQuery(grantSQL);
    }

    console.log(`Created tenant role: ${roleName}`);
  }

  /**
   * Validate data residency requirements
   */
  private async validateDataResidency(tenantId: string, operation: string): Promise<void> {
    const tenant = this.tenantContexts.get(tenantId);
    if (!tenant) return;

    // Check if operation violates data residency
    const currentRegion = process.env.AWS_REGION || 'us-east-1';
    
    if (tenant.dataResidency !== currentRegion && 
        ['INSERT', 'UPDATE'].includes(operation)) {
      throw new Error(
        `Data residency violation: Tenant ${tenantId} requires data in ${tenant.dataResidency}, current region: ${currentRegion}`
      );
    }
  }

  /**
   * Validate access policies
   */
  private async validateAccessPolicy(
    tenantId: string,
    options: {
      operation: string;
      resourceType: string;
      resourceId?: string;
      userId?: string;
    }
  ): Promise<void> {
    const policies = this.accessPolicies.get(tenantId) || [];
    
    const applicablePolicies = policies.filter(policy =>
      policy.enabled &&
      policy.operation === options.operation &&
      policy.resourceType === options.resourceType &&
      (!policy.validUntil || policy.validUntil > new Date())
    );

    if (applicablePolicies.length === 0) {
      // No specific policies, use default tenant isolation
      return;
    }

    // Check if any policy allows the operation
    let accessGranted = false;
    
    for (const policy of applicablePolicies) {
      if (await this.evaluatePolicyCondition(policy.conditions, options)) {
        accessGranted = true;
        break;
      }
    }

    if (!accessGranted) {
      throw new Error(
        `Access denied: No policy allows ${options.operation} on ${options.resourceType} for tenant ${tenantId}`
      );
    }
  }

  /**
   * Evaluate policy condition
   */
  private async evaluatePolicyCondition(
    condition: string,
    context: { userId?: string; resourceId?: string }
  ): Promise<boolean> {
    // Simplified policy evaluation
    // In production, this would be a more sophisticated rule engine
    
    if (condition.includes('user_id')) {
      return condition.includes(context.userId || '');
    }
    
    if (condition.includes('resource_id')) {
      return condition.includes(context.resourceId || '');
    }
    
    // Default to allow if no specific conditions
    return true;
  }

  /**
   * Set database tenant context
   */
  private setDatabaseTenantContext(tenantId: string): void {
    // This would execute: SET app.current_tenant_id = tenantId
    // For now, we'll simulate this
    console.log(`Setting database tenant context: ${tenantId}`);
  }

  /**
   * Clear database tenant context
   */
  private clearDatabaseTenantContext(): void {
    // This would execute: RESET app.current_tenant_id
    console.log('Clearing database tenant context');
  }

  /**
   * Execute secure query with RLS
   */
  private async executeSecureQuery<T>(
    sql: string,
    params: any[],
    tenantId: string
  ): Promise<T> {
    // In production, this would use actual database connection
    // For now, simulate successful execution
    
    console.log(`Executing secure query for tenant ${tenantId}: ${sql.substring(0, 100)}...`);
    
    // Simulate query execution delay
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
    
    // Return mock result
    return {} as T;
  }

  /**
   * Execute system query (admin privileges)
   */
  private async executeSystemQuery(sql: string): Promise<void> {
    console.log(`Executing system query: ${sql.substring(0, 100)}...`);
    
    // Simulate system operation
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  }

  /**
   * Audit database operation
   */
  private async auditDatabaseOperation(auditLog: Omit<TenantAuditLog, 'id'>): Promise<void> {
    const log: TenantAuditLog = {
      ...auditLog,
      id: this.generateAuditId()
    };

    this.auditLogs.push(log);

    // Keep audit logs bounded
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }

    // In production, this would also write to external audit system
    if (!log.success || log.errorMessage) {
      console.warn('Database operation audit:', log);
    }
  }

  /**
   * Sanitize query for audit logging
   */
  private sanitizeQueryForAudit(sql: string): string {
    // Remove sensitive data from SQL for audit logs
    return sql
      .replace(/password\s*=\s*'[^']*'/gi, "password = '[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token = '[REDACTED]'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret = '[REDACTED]'");
  }

  /**
   * Analyze data access for audit
   */
  private analyzeDataAccess(
    result: any,
    operation: string
  ): { rows: number; columns: string[]; sensitive: boolean } | undefined {
    if (operation !== 'SELECT' || !result) return undefined;

    // Simplified analysis - in production would analyze actual result set
    return {
      rows: Array.isArray(result) ? result.length : 1,
      columns: ['id', 'name', 'data'], // Would extract actual columns
      sensitive: false // Would detect sensitive data patterns
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    reportType: 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS',
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const tenant = this.tenantContexts.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Analyze audit logs for compliance
    const relevantLogs = this.auditLogs.filter(log =>
      log.tenantId === tenantId &&
      log.timestamp >= period.start &&
      log.timestamp <= period.end
    );

    const findings = await this.analyzeComplianceFindings(relevantLogs, reportType);
    const overallScore = this.calculateComplianceScore(findings);

    const report: ComplianceReport = {
      tenantId,
      reportType,
      generatedAt: new Date(),
      period,
      findings,
      overallScore,
      recommendations: this.generateComplianceRecommendations(findings, reportType),
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };

    // Store report
    let reports = this.complianceReports.get(tenantId) || [];
    reports.push(report);
    this.complianceReports.set(tenantId, reports);

    return report;
  }

  /**
   * Analyze compliance findings
   */
  private async analyzeComplianceFindings(
    auditLogs: TenantAuditLog[],
    reportType: string
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for failed access attempts
    const failedAttempts = auditLogs.filter(log => !log.success);
    if (failedAttempts.length > 10) {
      findings.push({
        id: this.generateFindingId(),
        severity: 'medium',
        category: 'Access Control',
        description: `${failedAttempts.length} failed access attempts detected`,
        evidence: failedAttempts.slice(0, 5).map(log => 
          `${log.timestamp.toISOString()}: ${log.action} on ${log.resourceType} from ${log.clientIP}`
        ),
        remediation: 'Review access controls and implement additional monitoring',
        status: 'open'
      });
    }

    // Check for data access patterns
    const dataAccess = auditLogs.filter(log => 
      log.action === 'SELECT' && log.dataAccessed?.sensitive
    );
    
    if (dataAccess.length > 100) {
      findings.push({
        id: this.generateFindingId(),
        severity: 'low',
        category: 'Data Access',
        description: 'High volume of sensitive data access detected',
        evidence: [`${dataAccess.length} sensitive data access operations`],
        remediation: 'Review data access patterns and implement data classification',
        status: 'open'
      });
    }

    return findings;
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(findings: ComplianceFinding[]): number {
    const weights = { critical: 40, high: 20, medium: 10, low: 5 };
    const totalDeductions = findings.reduce((sum, finding) => 
      sum + weights[finding.severity], 0
    );
    
    return Math.max(0, 100 - totalDeductions);
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(
    findings: ComplianceFinding[],
    reportType: string
  ): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.category === 'Access Control')) {
      recommendations.push('Implement multi-factor authentication for all admin users');
      recommendations.push('Review and update access control policies quarterly');
    }

    if (findings.some(f => f.category === 'Data Access')) {
      recommendations.push('Implement data classification and labeling');
      recommendations.push('Deploy data loss prevention (DLP) solutions');
    }

    if (reportType === 'GDPR') {
      recommendations.push('Ensure data retention policies are properly configured');
      recommendations.push('Implement automated data deletion workflows');
    }

    return recommendations;
  }

  /**
   * Get tenant audit logs
   */
  getTenantAuditLogs(
    tenantId: string,
    filters?: {
      action?: string;
      resourceType?: string;
      userId?: string;
      timeRange?: { start: Date; end: Date };
      successOnly?: boolean;
    }
  ): TenantAuditLog[] {
    let logs = this.auditLogs.filter(log => log.tenantId === tenantId);

    if (filters) {
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.resourceType) {
        logs = logs.filter(log => log.resourceType === filters.resourceType);
      }
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.timeRange) {
        logs = logs.filter(log =>
          log.timestamp >= filters.timeRange!.start &&
          log.timestamp <= filters.timeRange!.end
        );
      }
      if (filters.successOnly !== undefined) {
        logs = logs.filter(log => log.success === filters.successOnly);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Initialize system tenants
   */
  private initializeSystemTenants(): void {
    const systemTenants: TenantContext[] = [
      {
        id: 'tenant-system',
        slug: 'system',
        name: 'System Tenant',
        tier: 'enterprise',
        dataResidency: 'us-east-1',
        complianceLevel: 'strict',
        isolationMode: 'dedicated',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'tenant-demo',
        slug: 'demo',
        name: 'Demo Tenant',
        tier: 'professional',
        dataResidency: 'us-east-1',
        complianceLevel: 'standard',
        isolationMode: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'tenant-localhost:4400',
        slug: 'localhost',
        name: 'Local Development Tenant',
        tier: 'enterprise',
        dataResidency: 'us-east-1',
        complianceLevel: 'standard',
        isolationMode: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'tenant-localhost',
        slug: 'localhost',
        name: 'Local Development Tenant (Fallback)',
        tier: 'enterprise',
        dataResidency: 'us-east-1',
        complianceLevel: 'standard',
        isolationMode: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const tenant of systemTenants) {
      this.tenantContexts.set(tenant.id, tenant);
      
      // Initialize default isolation config
      this.isolationConfigs.set(tenant.id, {
        enableRLS: true,
        enforceDataResidency: tenant.complianceLevel !== 'standard',
        auditAllQueries: tenant.complianceLevel === 'strict',
        encryptionAtRest: true,
        encryptionInTransit: true,
        retentionPolicy: {
          auditLogs: tenant.complianceLevel === 'strict' ? 2555 : 365, // 7 years vs 1 year
          userActivity: 90,
          systemMetrics: 30
        },
        complianceSettings: {
          gdprCompliant: tenant.complianceLevel !== 'standard',
          soc2Type2: tenant.tier === 'enterprise',
          hipaaCompliant: tenant.complianceLevel === 'strict',
          pciDssCompliant: tenant.complianceLevel === 'strict'
        }
      });
    }

    console.log(`Initialized ${systemTenants.length} system tenants`);
  }

  /**
   * Initialize default access policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: DataAccessPolicy[] = [
      {
        id: 'policy-admin-full-access',
        tenantId: 'tenant-system',
        resourceType: '*',
        operation: 'SELECT',
        conditions: "role = 'admin'",
        enabled: true,
        createdBy: 'system'
      },
      {
        id: 'policy-user-read-own',
        tenantId: 'tenant-demo',
        resourceType: 'user_data',
        operation: 'SELECT',
        conditions: "owner_id = current_user_id()",
        enabled: true,
        createdBy: 'system'
      }
    ];

    for (const policy of defaultPolicies) {
      let policies = this.accessPolicies.get(policy.tenantId) || [];
      policies.push(policy);
      this.accessPolicies.set(policy.tenantId, policies);
    }
  }

  /**
   * Start compliance monitoring
   */
  private startComplianceMonitoring(): void {
    // Generate weekly compliance reports
    setInterval(() => {
      for (const tenantId of this.tenantContexts.keys()) {
        const tenant = this.tenantContexts.get(tenantId);
        if (tenant?.complianceLevel === 'strict') {
          this.generateComplianceReport(
            tenantId,
            'SOC2',
            {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              end: new Date()
            }
          ).catch(console.error);
        }
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFindingId(): string {
    return `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get isolation statistics
   */
  getStatistics(): {
    totalTenants: number;
    activeTenants: number;
    auditLogs: number;
    complianceReports: number;
    avgComplianceScore: number;
    dataResidencyViolations: number;
  } {
    const activeTenants = Array.from(this.tenantContexts.values());
    const allReports = Array.from(this.complianceReports.values()).flat();
    
    const avgScore = allReports.length > 0 ?
      allReports.reduce((sum, r) => sum + r.overallScore, 0) / allReports.length : 0;

    const violations = this.auditLogs.filter(log => 
      log.errorMessage?.includes('residency violation')
    ).length;

    return {
      totalTenants: this.tenantContexts.size,
      activeTenants: activeTenants.length,
      auditLogs: this.auditLogs.length,
      complianceReports: allReports.length,
      avgComplianceScore: avgScore,
      dataResidencyViolations: violations
    };
  }
}

// Global tenant isolation manager
export const tenantIsolation = new TenantIsolationManager();

export default tenantIsolation;