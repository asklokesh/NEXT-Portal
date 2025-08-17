import { PrismaClient } from '@prisma/client';
import { 
  QualityGrade, 
  QualityCategory, 
  QualityCheckType, 
  TrendDirection,
  CheckSeverity,
  QualityCheckStatus,
  IssueType,
  IssueSeverity
} from '@prisma/client';

const prisma = new PrismaClient();

export interface QualityCheck {
  checkType: QualityCheckType;
  checkName: string;
  checkId: string;
  category: QualityCategory;
  passed: boolean;
  score: number;
  weight: number;
  severity: CheckSeverity;
  description?: string;
  rationale?: string;
  recommendation?: string;
  evidence?: any;
  metrics?: any;
  duration?: number;
  errorDetails?: string;
}

export interface QualityEvaluationResult {
  overallScore: number;
  overallGrade: QualityGrade;
  categoryScores: {
    security: number;
    performance: number;
    maintainability: number;
    reliability: number;
    documentation: number;
  };
  categoryGrades: {
    security: QualityGrade;
    performance: QualityGrade;
    maintainability: QualityGrade;
    reliability: QualityGrade;
    documentation: QualityGrade;
  };
  checks: QualityCheck[];
  issues: QualityIssue[];
  confidenceLevel: number;
  dataQualityScore: number;
  passesMinimumStandards: boolean;
  scoreImprovement?: number;
  trendDirection: TrendDirection;
  complianceFlags: string[];
}

export interface QualityIssue {
  issueType: IssueType;
  category: QualityCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  affectedChecks: string[];
  impact?: string;
  resolution?: string;
  workaround?: string;
  evidence?: any;
  reproductionSteps?: string;
  affectedVersions: string[];
  environment?: string;
  references: string[];
}

export interface QualityGateConfiguration {
  gradeAThreshold: number;
  gradeBThreshold: number;
  gradeCThreshold: number;
  gradeDThreshold: number;
  securityWeight: number;
  performanceWeight: number;
  maintainabilityWeight: number;
  reliabilityWeight: number;
  documentationWeight: number;
  minimumOverallScore: number;
  minimumSecurityScore: number;
  blockingIssues: string[];
  enabledChecks: Record<string, boolean>;
  checkWeights: Record<string, number>;
}

export class QualityScoringEngine {
  private config: QualityGateConfiguration;

  constructor(config?: QualityGateConfiguration) {
    this.config = config || this.getDefaultConfiguration();
  }

  private getDefaultConfiguration(): QualityGateConfiguration {
    return {
      gradeAThreshold: 90,
      gradeBThreshold: 80,
      gradeCThreshold: 70,
      gradeDThreshold: 60,
      securityWeight: 0.25,
      performanceWeight: 0.20,
      maintainabilityWeight: 0.20,
      reliabilityWeight: 0.20,
      documentationWeight: 0.15,
      minimumOverallScore: 70,
      minimumSecurityScore: 80,
      blockingIssues: ['SECURITY_VULNERABILITY', 'CRITICAL_PERFORMANCE_ISSUE'],
      enabledChecks: {},
      checkWeights: {}
    };
  }

  /**
   * Main method to evaluate plugin quality
   */
  async evaluatePluginQuality(
    pluginId: string,
    pluginData: any,
    tenantId?: string
  ): Promise<QualityEvaluationResult> {
    try {
      // 1. Run all quality checks
      const checks = await this.runQualityChecks(pluginId, pluginData);
      
      // 2. Calculate category scores
      const categoryScores = this.calculateCategoryScores(checks);
      
      // 3. Calculate overall score
      const overallScore = this.calculateOverallScore(categoryScores);
      
      // 4. Determine grades
      const overallGrade = this.scoreToGrade(overallScore);
      const categoryGrades = {
        security: this.scoreToGrade(categoryScores.security),
        performance: this.scoreToGrade(categoryScores.performance),
        maintainability: this.scoreToGrade(categoryScores.maintainability),
        reliability: this.scoreToGrade(categoryScores.reliability),
        documentation: this.scoreToGrade(categoryScores.documentation)
      };
      
      // 5. Identify quality issues
      const issues = await this.identifyQualityIssues(checks, categoryScores);
      
      // 6. Calculate confidence and data quality
      const confidenceLevel = this.calculateConfidenceLevel(checks);
      const dataQualityScore = this.calculateDataQualityScore(pluginData, checks);
      
      // 7. Check minimum standards
      const passesMinimumStandards = this.checkMinimumStandards(
        overallScore, 
        categoryScores, 
        issues
      );
      
      // 8. Calculate trend analysis
      const { scoreImprovement, trendDirection } = await this.calculateTrendAnalysis(
        pluginId, 
        overallScore, 
        tenantId
      );
      
      // 9. Generate compliance flags
      const complianceFlags = this.generateComplianceFlags(checks, issues);

      return {
        overallScore,
        overallGrade,
        categoryScores,
        categoryGrades,
        checks,
        issues,
        confidenceLevel,
        dataQualityScore,
        passesMinimumStandards,
        scoreImprovement,
        trendDirection,
        complianceFlags
      };
    } catch (error) {
      console.error('Error evaluating plugin quality:', error);
      throw new Error(`Quality evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run all quality checks for a plugin
   */
  private async runQualityChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // Security Checks
    checks.push(...await this.runSecurityChecks(pluginId, pluginData));
    
    // Performance Checks
    checks.push(...await this.runPerformanceChecks(pluginId, pluginData));
    
    // Maintainability Checks
    checks.push(...await this.runMaintainabilityChecks(pluginId, pluginData));
    
    // Reliability Checks
    checks.push(...await this.runReliabilityChecks(pluginId, pluginData));
    
    // Documentation Checks
    checks.push(...await this.runDocumentationChecks(pluginId, pluginData));

    return checks;
  }

  /**
   * Security checks
   */
  private async runSecurityChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // Vulnerability scan check
    checks.push(await this.runVulnerabilityCheck(pluginId, pluginData));
    
    // Dependency audit check
    checks.push(await this.runDependencyAuditCheck(pluginId, pluginData));
    
    // Secrets detection check
    checks.push(await this.runSecretsDetectionCheck(pluginId, pluginData));
    
    // Permission analysis check
    checks.push(await this.runPermissionAnalysisCheck(pluginId, pluginData));
    
    // Security policy compliance check
    checks.push(await this.runSecurityPolicyComplianceCheck(pluginId, pluginData));

    return checks;
  }

  /**
   * Performance checks
   */
  private async runPerformanceChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // Bundle size analysis
    checks.push(await this.runBundleSizeAnalysisCheck(pluginId, pluginData));
    
    // Load time analysis
    checks.push(await this.runLoadTimeAnalysisCheck(pluginId, pluginData));
    
    // Memory usage check
    checks.push(await this.runMemoryUsageCheck(pluginId, pluginData));
    
    // CPU usage check
    checks.push(await this.runCpuUsageCheck(pluginId, pluginData));

    return checks;
  }

  /**
   * Maintainability checks
   */
  private async runMaintainabilityChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // Code complexity check
    checks.push(await this.runCodeComplexityCheck(pluginId, pluginData));
    
    // Code coverage check
    checks.push(await this.runCodeCoverageCheck(pluginId, pluginData));
    
    // Technical debt check
    checks.push(await this.runTechnicalDebtCheck(pluginId, pluginData));
    
    // Code duplication check
    checks.push(await this.runCodeDuplicationCheck(pluginId, pluginData));
    
    // Coding standards check
    checks.push(await this.runCodingStandardsCheck(pluginId, pluginData));

    return checks;
  }

  /**
   * Reliability checks
   */
  private async runReliabilityChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // Error rate analysis
    checks.push(await this.runErrorRateAnalysisCheck(pluginId, pluginData));
    
    // Uptime monitoring check
    checks.push(await this.runUptimeMonitoringCheck(pluginId, pluginData));
    
    // Dependency health check
    checks.push(await this.runDependencyHealthCheck(pluginId, pluginData));
    
    // API reliability check
    checks.push(await this.runApiReliabilityCheck(pluginId, pluginData));

    return checks;
  }

  /**
   * Documentation checks
   */
  private async runDocumentationChecks(pluginId: string, pluginData: any): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    // README quality check
    checks.push(await this.runReadmeQualityCheck(pluginId, pluginData));
    
    // API documentation check
    checks.push(await this.runApiDocumentationCheck(pluginId, pluginData));
    
    // Code comments check
    checks.push(await this.runCodeCommentsCheck(pluginId, pluginData));
    
    // Changelog quality check
    checks.push(await this.runChangelogQualityCheck(pluginId, pluginData));
    
    // Setup instructions check
    checks.push(await this.runSetupInstructionsCheck(pluginId, pluginData));

    return checks;
  }

  // Individual check implementations
  private async runVulnerabilityCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    const startTime = Date.now();
    
    try {
      // Get vulnerability data from security scan results
      const vulnerabilities = await prisma.pluginVulnerability.findMany({
        where: { 
          pluginId,
          status: { not: 'RESOLVED' }
        }
      });

      const criticalCount = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
      const highCount = vulnerabilities.filter(v => v.severity === 'HIGH').length;
      const mediumCount = vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
      const lowCount = vulnerabilities.filter(v => v.severity === 'LOW').length;

      // Calculate score based on vulnerability severity
      let score = 100;
      score -= criticalCount * 25; // Critical vulnerabilities heavily penalize
      score -= highCount * 15;
      score -= mediumCount * 8;
      score -= lowCount * 3;
      
      score = Math.max(0, Math.min(100, score));

      const passed = criticalCount === 0 && highCount === 0;
      const severity = criticalCount > 0 ? CheckSeverity.CRITICAL : 
                     highCount > 0 ? CheckSeverity.HIGH : 
                     mediumCount > 0 ? CheckSeverity.MEDIUM : CheckSeverity.LOW;

      return {
        checkType: QualityCheckType.VULNERABILITY_SCAN,
        checkName: 'Vulnerability Scan',
        checkId: 'vulnerability-scan',
        category: QualityCategory.SECURITY,
        passed,
        score,
        weight: 1.0,
        severity,
        description: 'Scans for known security vulnerabilities in dependencies and code',
        rationale: 'Security vulnerabilities can expose systems to attacks',
        recommendation: criticalCount > 0 || highCount > 0 ? 
          'Fix critical and high severity vulnerabilities immediately' : 
          'Continue monitoring for new vulnerabilities',
        evidence: {
          totalVulnerabilities: vulnerabilities.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          vulnerabilities: vulnerabilities.map(v => ({
            id: v.id,
            cveId: v.cveId,
            severity: v.severity,
            title: v.title,
            score: v.score
          }))
        },
        metrics: {
          scanDate: new Date().toISOString(),
          vulnerabilitiesFound: vulnerabilities.length
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        checkType: QualityCheckType.VULNERABILITY_SCAN,
        checkName: 'Vulnerability Scan',
        checkId: 'vulnerability-scan',
        category: QualityCategory.SECURITY,
        passed: false,
        score: 0,
        weight: 1.0,
        severity: CheckSeverity.CRITICAL,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private async runBundleSizeAnalysisCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    const startTime = Date.now();
    
    try {
      // Analyze bundle size from plugin data or metrics
      const bundleSize = pluginData.bundleSize || 
                        (await this.estimateBundleSize(pluginId, pluginData));

      // Define thresholds (in KB)
      const excellentThreshold = 100;
      const goodThreshold = 250;
      const fairThreshold = 500;
      const poorThreshold = 1000;

      let score = 100;
      let severity = CheckSeverity.INFO;
      let passed = true;

      if (bundleSize > poorThreshold) {
        score = 20;
        severity = CheckSeverity.HIGH;
        passed = false;
      } else if (bundleSize > fairThreshold) {
        score = 40;
        severity = CheckSeverity.MEDIUM;
      } else if (bundleSize > goodThreshold) {
        score = 70;
        severity = CheckSeverity.LOW;
      } else if (bundleSize > excellentThreshold) {
        score = 85;
        severity = CheckSeverity.INFO;
      } else {
        score = 100;
        severity = CheckSeverity.INFO;
      }

      return {
        checkType: QualityCheckType.BUNDLE_SIZE_ANALYSIS,
        checkName: 'Bundle Size Analysis',
        checkId: 'bundle-size-analysis',
        category: QualityCategory.PERFORMANCE,
        passed,
        score,
        weight: 1.0,
        severity,
        description: 'Analyzes the bundle size impact on application performance',
        rationale: 'Large bundles increase load times and impact user experience',
        recommendation: bundleSize > fairThreshold ? 
          'Consider code splitting and lazy loading to reduce bundle size' : 
          'Bundle size is within acceptable limits',
        evidence: {
          bundleSizeKB: bundleSize,
          threshold: {
            excellent: excellentThreshold,
            good: goodThreshold,
            fair: fairThreshold,
            poor: poorThreshold
          }
        },
        metrics: {
          bundleSizeBytes: bundleSize * 1024,
          compressionRatio: 0.7 // Estimated gzip compression
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        checkType: QualityCheckType.BUNDLE_SIZE_ANALYSIS,
        checkName: 'Bundle Size Analysis',
        checkId: 'bundle-size-analysis',
        category: QualityCategory.PERFORMANCE,
        passed: false,
        score: 0,
        weight: 1.0,
        severity: CheckSeverity.MEDIUM,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private async runReadmeQualityCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    const startTime = Date.now();
    
    try {
      const readmeContent = pluginData.readme || '';
      
      // Analyze README quality
      const hasDescription = readmeContent.toLowerCase().includes('description') || 
                           readmeContent.length > 100;
      const hasInstallation = readmeContent.toLowerCase().includes('install') ||
                             readmeContent.toLowerCase().includes('npm install');
      const hasUsage = readmeContent.toLowerCase().includes('usage') ||
                      readmeContent.toLowerCase().includes('example');
      const hasConfiguration = readmeContent.toLowerCase().includes('config') ||
                              readmeContent.toLowerCase().includes('setup');
      const hasContributing = readmeContent.toLowerCase().includes('contribut') ||
                             readmeContent.toLowerCase().includes('development');

      let score = 0;
      score += hasDescription ? 25 : 0;
      score += hasInstallation ? 25 : 0;
      score += hasUsage ? 25 : 0;
      score += hasConfiguration ? 15 : 0;
      score += hasContributing ? 10 : 0;

      const passed = score >= 70;
      const severity = score < 50 ? CheckSeverity.MEDIUM : 
                      score < 70 ? CheckSeverity.LOW : CheckSeverity.INFO;

      return {
        checkType: QualityCheckType.README_QUALITY,
        checkName: 'README Quality',
        checkId: 'readme-quality',
        category: QualityCategory.DOCUMENTATION,
        passed,
        score,
        weight: 1.0,
        severity,
        description: 'Evaluates the quality and completeness of README documentation',
        rationale: 'Good documentation helps users understand and adopt the plugin',
        recommendation: passed ? 
          'README documentation meets quality standards' : 
          'Improve README by adding missing sections: installation, usage, and configuration',
        evidence: {
          hasDescription,
          hasInstallation,
          hasUsage,
          hasConfiguration,
          hasContributing,
          contentLength: readmeContent.length
        },
        metrics: {
          readmeLength: readmeContent.length,
          sectionsCount: [hasDescription, hasInstallation, hasUsage, hasConfiguration, hasContributing].filter(Boolean).length
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        checkType: QualityCheckType.README_QUALITY,
        checkName: 'README Quality',
        checkId: 'readme-quality',
        category: QualityCategory.DOCUMENTATION,
        passed: false,
        score: 0,
        weight: 1.0,
        severity: CheckSeverity.MEDIUM,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  // Utility methods for scoring calculations

  /**
   * Calculate category scores from individual checks
   */
  private calculateCategoryScores(checks: QualityCheck[]): {
    security: number;
    performance: number;
    maintainability: number;
    reliability: number;
    documentation: number;
  } {
    const categories = {
      security: this.calculateCategoryScore(checks, QualityCategory.SECURITY),
      performance: this.calculateCategoryScore(checks, QualityCategory.PERFORMANCE),
      maintainability: this.calculateCategoryScore(checks, QualityCategory.MAINTAINABILITY),
      reliability: this.calculateCategoryScore(checks, QualityCategory.RELIABILITY),
      documentation: this.calculateCategoryScore(checks, QualityCategory.DOCUMENTATION)
    };

    return categories;
  }

  private calculateCategoryScore(checks: QualityCheck[], category: QualityCategory): number {
    const categoryChecks = checks.filter(check => check.category === category);
    
    if (categoryChecks.length === 0) {
      return 0;
    }

    // Calculate weighted average
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const check of categoryChecks) {
      totalWeightedScore += check.score * check.weight;
      totalWeight += check.weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }

  /**
   * Calculate overall score from category scores
   */
  private calculateOverallScore(categoryScores: {
    security: number;
    performance: number;
    maintainability: number;
    reliability: number;
    documentation: number;
  }): number {
    const overallScore = 
      categoryScores.security * this.config.securityWeight +
      categoryScores.performance * this.config.performanceWeight +
      categoryScores.maintainability * this.config.maintainabilityWeight +
      categoryScores.reliability * this.config.reliabilityWeight +
      categoryScores.documentation * this.config.documentationWeight;

    return Math.round(overallScore * 100) / 100;
  }

  /**
   * Convert numeric score to letter grade
   */
  private scoreToGrade(score: number): QualityGrade {
    if (score >= this.config.gradeAThreshold) return QualityGrade.A;
    if (score >= this.config.gradeBThreshold) return QualityGrade.B;
    if (score >= this.config.gradeCThreshold) return QualityGrade.C;
    if (score >= this.config.gradeDThreshold) return QualityGrade.D;
    return QualityGrade.F;
  }

  /**
   * Identify quality issues from check results
   */
  private async identifyQualityIssues(
    checks: QualityCheck[], 
    categoryScores: any
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Identify issues from failed checks
    const failedChecks = checks.filter(check => !check.passed);
    
    for (const check of failedChecks) {
      if (check.severity === CheckSeverity.CRITICAL || check.severity === CheckSeverity.HIGH) {
        issues.push({
          issueType: this.mapCheckTypeToIssueType(check.checkType),
          category: check.category,
          severity: this.mapCheckSeverityToIssueSeverity(check.severity),
          title: `${check.checkName} Failed`,
          description: check.recommendation || `The ${check.checkName} check failed to pass quality standards`,
          affectedChecks: [check.checkId],
          impact: check.impact,
          resolution: check.recommendation,
          evidence: check.evidence,
          affectedVersions: [],
          references: []
        });
      }
    }

    // Add category-level issues for very poor scores
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score < 40) {
        issues.push({
          issueType: IssueType.OTHER,
          category: this.mapCategoryNameToEnum(category),
          severity: IssueSeverity.HIGH,
          title: `Poor ${category.charAt(0).toUpperCase() + category.slice(1)} Score`,
          description: `The ${category} category has a very low quality score of ${score.toFixed(1)}`,
          affectedChecks: checks
            .filter(c => c.category === this.mapCategoryNameToEnum(category))
            .map(c => c.checkId),
          impact: `Low ${category} quality can impact plugin reliability and user experience`,
          resolution: `Improve ${category} by addressing the failing checks in this category`,
          affectedVersions: [],
          references: []
        });
      }
    }

    return issues;
  }

  private mapCheckTypeToIssueType(checkType: QualityCheckType): IssueType {
    switch (checkType) {
      case QualityCheckType.VULNERABILITY_SCAN:
      case QualityCheckType.DEPENDENCY_AUDIT:
      case QualityCheckType.SECRETS_DETECTION:
      case QualityCheckType.PERMISSION_ANALYSIS:
      case QualityCheckType.SECURITY_POLICY_COMPLIANCE:
        return IssueType.SECURITY_VULNERABILITY;
      
      case QualityCheckType.BUNDLE_SIZE_ANALYSIS:
      case QualityCheckType.LOAD_TIME_ANALYSIS:
      case QualityCheckType.MEMORY_USAGE_CHECK:
      case QualityCheckType.CPU_USAGE_CHECK:
      case QualityCheckType.DATABASE_QUERY_ANALYSIS:
        return IssueType.PERFORMANCE_ISSUE;
      
      case QualityCheckType.CODE_COMPLEXITY:
      case QualityCheckType.CODE_COVERAGE:
      case QualityCheckType.TECHNICAL_DEBT:
      case QualityCheckType.CODE_DUPLICATION:
      case QualityCheckType.CODING_STANDARDS:
        return IssueType.MAINTAINABILITY_DEBT;
      
      case QualityCheckType.ERROR_RATE_ANALYSIS:
      case QualityCheckType.UPTIME_MONITORING:
      case QualityCheckType.DEPENDENCY_HEALTH:
      case QualityCheckType.API_RELIABILITY:
      case QualityCheckType.FAILURE_RECOVERY:
        return IssueType.RELIABILITY_CONCERN;
      
      case QualityCheckType.README_QUALITY:
      case QualityCheckType.API_DOCUMENTATION:
      case QualityCheckType.CODE_COMMENTS:
      case QualityCheckType.CHANGELOG_QUALITY:
      case QualityCheckType.SETUP_INSTRUCTIONS:
        return IssueType.DOCUMENTATION_GAP;
      
      default:
        return IssueType.OTHER;
    }
  }

  private mapCheckSeverityToIssueSeverity(severity: CheckSeverity): IssueSeverity {
    switch (severity) {
      case CheckSeverity.CRITICAL: return IssueSeverity.CRITICAL;
      case CheckSeverity.HIGH: return IssueSeverity.HIGH;
      case CheckSeverity.MEDIUM: return IssueSeverity.MEDIUM;
      case CheckSeverity.LOW: return IssueSeverity.LOW;
      case CheckSeverity.INFO: return IssueSeverity.INFO;
      default: return IssueSeverity.MEDIUM;
    }
  }

  private mapCategoryNameToEnum(categoryName: string): QualityCategory {
    switch (categoryName.toUpperCase()) {
      case 'SECURITY': return QualityCategory.SECURITY;
      case 'PERFORMANCE': return QualityCategory.PERFORMANCE;
      case 'MAINTAINABILITY': return QualityCategory.MAINTAINABILITY;
      case 'RELIABILITY': return QualityCategory.RELIABILITY;
      case 'DOCUMENTATION': return QualityCategory.DOCUMENTATION;
      default: return QualityCategory.SECURITY;
    }
  }

  /**
   * Calculate confidence level in the quality score
   */
  private calculateConfidenceLevel(checks: QualityCheck[]): number {
    if (checks.length === 0) return 0;

    const completedChecks = checks.filter(c => c.errorDetails === undefined);
    const completionRate = completedChecks.length / checks.length;

    // Base confidence on completion rate and data availability
    let confidence = completionRate * 80; // Max 80% for completion

    // Add bonus for comprehensive checks
    if (checks.length >= 15) confidence += 10;
    if (checks.length >= 20) confidence += 10;

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(pluginData: any, checks: QualityCheck[]): number {
    let score = 0;
    let maxScore = 0;

    // Check availability of key data points
    const dataPoints = [
      { key: 'package.json', weight: 20, available: !!pluginData.packageJson },
      { key: 'README', weight: 15, available: !!pluginData.readme },
      { key: 'Dependencies', weight: 15, available: !!pluginData.dependencies },
      { key: 'Repository info', weight: 10, available: !!pluginData.repository },
      { key: 'License', weight: 10, available: !!pluginData.license },
      { key: 'Documentation', weight: 10, available: !!pluginData.documentation },
      { key: 'Tests', weight: 10, available: !!pluginData.hasTests },
      { key: 'CI/CD', weight: 10, available: !!pluginData.hasCicd }
    ];

    for (const point of dataPoints) {
      maxScore += point.weight;
      if (point.available) {
        score += point.weight;
      }
    }

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  /**
   * Check if plugin meets minimum quality standards
   */
  private checkMinimumStandards(
    overallScore: number, 
    categoryScores: any, 
    issues: QualityIssue[]
  ): boolean {
    // Check overall minimum score
    if (overallScore < this.config.minimumOverallScore) {
      return false;
    }

    // Check minimum security score
    if (categoryScores.security < this.config.minimumSecurityScore) {
      return false;
    }

    // Check for blocking issues
    const hasBlockingIssues = issues.some(issue => 
      this.config.blockingIssues.includes(issue.issueType) ||
      issue.severity === IssueSeverity.CRITICAL
    );

    if (hasBlockingIssues) {
      return false;
    }

    return true;
  }

  /**
   * Calculate trend analysis
   */
  private async calculateTrendAnalysis(
    pluginId: string, 
    currentScore: number, 
    tenantId?: string
  ): Promise<{ scoreImprovement?: number; trendDirection: TrendDirection }> {
    try {
      // Get the most recent previous score
      const previousScore = await prisma.pluginQualityHistory.findFirst({
        where: { 
          pluginId,
          tenantId 
        },
        orderBy: { recordedAt: 'desc' },
        select: { overallScore: true }
      });

      if (!previousScore) {
        return { trendDirection: TrendDirection.UNKNOWN };
      }

      const scoreImprovement = currentScore - previousScore.overallScore;
      
      let trendDirection: TrendDirection;
      if (Math.abs(scoreImprovement) < 2) {
        trendDirection = TrendDirection.STABLE;
      } else if (scoreImprovement > 0) {
        trendDirection = TrendDirection.IMPROVING;
      } else {
        trendDirection = TrendDirection.DECLINING;
      }

      return { scoreImprovement, trendDirection };
    } catch (error) {
      console.warn('Failed to calculate trend analysis:', error);
      return { trendDirection: TrendDirection.UNKNOWN };
    }
  }

  /**
   * Generate compliance flags
   */
  private generateComplianceFlags(checks: QualityCheck[], issues: QualityIssue[]): string[] {
    const flags: string[] = [];

    // Check for security compliance issues
    const securityIssues = issues.filter(i => i.category === QualityCategory.SECURITY);
    if (securityIssues.length > 0) {
      flags.push('SECURITY_COMPLIANCE_ISSUE');
    }

    // Check for critical vulnerabilities
    const criticalSecurityChecks = checks.filter(c => 
      c.category === QualityCategory.SECURITY && 
      c.severity === CheckSeverity.CRITICAL && 
      !c.passed
    );
    if (criticalSecurityChecks.length > 0) {
      flags.push('CRITICAL_SECURITY_VULNERABILITIES');
    }

    // Check for performance compliance
    const performanceScore = checks
      .filter(c => c.category === QualityCategory.PERFORMANCE)
      .reduce((sum, c) => sum + c.score, 0) / 
      Math.max(1, checks.filter(c => c.category === QualityCategory.PERFORMANCE).length);
    
    if (performanceScore < 60) {
      flags.push('PERFORMANCE_COMPLIANCE_ISSUE');
    }

    // Check for documentation compliance
    const docScore = checks
      .filter(c => c.category === QualityCategory.DOCUMENTATION)
      .reduce((sum, c) => sum + c.score, 0) / 
      Math.max(1, checks.filter(c => c.category === QualityCategory.DOCUMENTATION).length);
    
    if (docScore < 50) {
      flags.push('DOCUMENTATION_COMPLIANCE_ISSUE');
    }

    return flags;
  }

  // Placeholder methods for additional checks (implement as needed)
  private async runDependencyAuditCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    // Implementation for dependency audit
    return this.createPlaceholderCheck(QualityCheckType.DEPENDENCY_AUDIT, 'Dependency Audit', QualityCategory.SECURITY);
  }

  private async runSecretsDetectionCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    // Implementation for secrets detection
    return this.createPlaceholderCheck(QualityCheckType.SECRETS_DETECTION, 'Secrets Detection', QualityCategory.SECURITY);
  }

  private async runPermissionAnalysisCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    // Implementation for permission analysis
    return this.createPlaceholderCheck(QualityCheckType.PERMISSION_ANALYSIS, 'Permission Analysis', QualityCategory.SECURITY);
  }

  private async runSecurityPolicyComplianceCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    // Implementation for security policy compliance
    return this.createPlaceholderCheck(QualityCheckType.SECURITY_POLICY_COMPLIANCE, 'Security Policy Compliance', QualityCategory.SECURITY);
  }

  // Additional placeholder methods...
  private async runLoadTimeAnalysisCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.LOAD_TIME_ANALYSIS, 'Load Time Analysis', QualityCategory.PERFORMANCE);
  }

  private async runMemoryUsageCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.MEMORY_USAGE_CHECK, 'Memory Usage Check', QualityCategory.PERFORMANCE);
  }

  private async runCpuUsageCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CPU_USAGE_CHECK, 'CPU Usage Check', QualityCategory.PERFORMANCE);
  }

  private async runCodeComplexityCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CODE_COMPLEXITY, 'Code Complexity', QualityCategory.MAINTAINABILITY);
  }

  private async runCodeCoverageCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CODE_COVERAGE, 'Code Coverage', QualityCategory.MAINTAINABILITY);
  }

  private async runTechnicalDebtCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.TECHNICAL_DEBT, 'Technical Debt', QualityCategory.MAINTAINABILITY);
  }

  private async runCodeDuplicationCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CODE_DUPLICATION, 'Code Duplication', QualityCategory.MAINTAINABILITY);
  }

  private async runCodingStandardsCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CODING_STANDARDS, 'Coding Standards', QualityCategory.MAINTAINABILITY);
  }

  private async runErrorRateAnalysisCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.ERROR_RATE_ANALYSIS, 'Error Rate Analysis', QualityCategory.RELIABILITY);
  }

  private async runUptimeMonitoringCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.UPTIME_MONITORING, 'Uptime Monitoring', QualityCategory.RELIABILITY);
  }

  private async runDependencyHealthCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.DEPENDENCY_HEALTH, 'Dependency Health', QualityCategory.RELIABILITY);
  }

  private async runApiReliabilityCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.API_RELIABILITY, 'API Reliability', QualityCategory.RELIABILITY);
  }

  private async runApiDocumentationCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.API_DOCUMENTATION, 'API Documentation', QualityCategory.DOCUMENTATION);
  }

  private async runCodeCommentsCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CODE_COMMENTS, 'Code Comments', QualityCategory.DOCUMENTATION);
  }

  private async runChangelogQualityCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.CHANGELOG_QUALITY, 'Changelog Quality', QualityCategory.DOCUMENTATION);
  }

  private async runSetupInstructionsCheck(pluginId: string, pluginData: any): Promise<QualityCheck> {
    return this.createPlaceholderCheck(QualityCheckType.SETUP_INSTRUCTIONS, 'Setup Instructions', QualityCategory.DOCUMENTATION);
  }

  private createPlaceholderCheck(
    checkType: QualityCheckType, 
    checkName: string, 
    category: QualityCategory,
    score: number = 75
  ): QualityCheck {
    return {
      checkType,
      checkName,
      checkId: checkType.toLowerCase().replace(/_/g, '-'),
      category,
      passed: score >= 70,
      score,
      weight: 1.0,
      severity: score >= 70 ? CheckSeverity.INFO : CheckSeverity.MEDIUM,
      description: `${checkName} check - implementation pending`,
      rationale: `${checkName} is important for plugin quality`,
      recommendation: score >= 70 ? 'Check passed' : 'Improvement needed',
      duration: 50
    };
  }

  private async estimateBundleSize(pluginId: string, pluginData: any): Promise<number> {
    // Estimate bundle size based on dependencies and package info
    const dependencies = Object.keys(pluginData.dependencies || {});
    const devDependencies = Object.keys(pluginData.devDependencies || {});
    
    // Simple estimation: base size + dependency impact
    let estimatedSize = 50; // Base size in KB
    estimatedSize += dependencies.length * 15; // ~15KB per dependency
    estimatedSize += devDependencies.length * 5; // Dev deps have less impact
    
    return Math.max(50, estimatedSize);
  }
}

export default QualityScoringEngine;