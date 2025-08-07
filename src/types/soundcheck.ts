/**
 * Soundcheck Quality Assurance Platform Types
 * Comprehensive quality tracking and compliance system inspired by Spotify's implementation
 */

export interface SoundcheckEntity {
 id: string;
 name: string;
 kind: 'Component' | 'API' | 'System' | 'Domain' | 'Resource';
 namespace: string;
 metadata: {
 title?: string;
 description?: string;
 tags?: string[];
 owner?: string;
 lifecycle?: string;
 system?: string;
 };
 spec: Record<string, any>;
 relations?: EntityRelation[];
}

export interface EntityRelation {
 type: 'ownedBy' | 'dependsOn' | 'providesApi' | 'consumesApi' | 'partOf';
 target: string;
}

export interface QualityCheck {
 id: string;
 name: string;
 description: string;
 category: QualityCategory;
 severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
 automated: boolean;
 tags: string[];
 rule: QualityRule;
 remediation?: RemediationGuidance;
 createdAt: string;
 updatedAt: string;
 createdBy: string;
}

export interface QualityRule {
 type: 'boolean' | 'threshold' | 'presence' | 'pattern' | 'custom';
 field: string;
 operator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'matches' | 'exists';
 value?: any;
 threshold?: {
 min?: number;
 max?: number;
 target?: number;
 };
 pattern?: string;
 customScript?: string;
}

export interface RemediationGuidance {
 title: string;
 description: string;
 steps: string[];
 links: Array<{
 title: string;
 url: string;
 }>;
 estimatedTime?: string;
 difficulty?: 'easy' | 'medium' | 'hard';
}

export type QualityCategory = 
 | 'security'
 | 'reliability' 
 | 'performance'
 | 'maintainability'
 | 'documentation'
 | 'testing'
 | 'deployment'
 | 'monitoring'
 | 'compliance'
 | 'architecture';

export interface QualityGate {
 id: string;
 name: string;
 description: string;
 stage: 'development' | 'staging' | 'production' | 'custom';
 checks: QualityGateCheck[];
 passingThreshold: number; // Percentage of checks that must pass
 blocking: boolean; // Whether failures block deployment
 createdAt: string;
 updatedAt: string;
 createdBy: string;
}

export interface QualityGateCheck {
 checkId: string;
 required: boolean;
 weight: number; // Weight in overall gate score
}

export interface QualityAssessment {
 id: string;
 entityId: string;
 timestamp: string;
 overallScore: number;
 categoryScores: Record<QualityCategory, number>;
 checkResults: CheckResult[];
 gateResults: GateResult[];
 trends: QualityTrend[];
 recommendations: QualityRecommendation[];
}

export interface CheckResult {
 checkId: string;
 status: 'pass' | 'fail' | 'warning' | 'skip' | 'error';
 score: number;
 message?: string;
 details?: Record<string, any>;
 timestamp: string;
 executionTime?: number;
}

export interface GateResult {
 gateId: string;
 status: 'pass' | 'fail' | 'warning';
 score: number;
 passedChecks: number;
 totalChecks: number;
 requiredChecksPassed: boolean;
 timestamp: string;
}

export interface QualityTrend {
 category: QualityCategory;
 timestamps: string[];
 scores: number[];
 change: 'improving' | 'declining' | 'stable';
 changePercentage: number;
}

export interface QualityRecommendation {
 id: string;
 priority: 'critical' | 'high' | 'medium' | 'low';
 category: QualityCategory;
 title: string;
 description: string;
 impact: string;
 effort: 'low' | 'medium' | 'high';
 actionItems: string[];
 relatedChecks: string[];
}

export interface QualityCertification {
 id: string;
 entityId: string;
 level: 'bronze' | 'silver' | 'gold' | 'platinum';
 category?: QualityCategory;
 issuedAt: string;
 expiresAt?: string;
 issuedBy: string;
 criteria: CertificationCriteria[];
 status: 'active' | 'expired' | 'revoked';
}

export interface CertificationCriteria {
 name: string;
 description: string;
 required: boolean;
 met: boolean;
 evidence?: string;
}

export interface QualityPolicy {
 id: string;
 name: string;
 description: string;
 scope: 'global' | 'team' | 'system' | 'component';
 targetSelector?: Record<string, any>;
 rules: PolicyRule[];
 enforcement: 'advisory' | 'warning' | 'blocking';
 createdAt: string;
 updatedAt: string;
 createdBy: string;
}

export interface PolicyRule {
 id: string;
 name: string;
 description: string;
 checkIds: string[];
 gateIds?: string[];
 conditions: PolicyCondition[];
}

export interface PolicyCondition {
 field: string;
 operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in';
 value: any;
}

export interface QualityReport {
 id: string;
 title: string;
 description?: string;
 type: 'summary' | 'detailed' | 'trend' | 'compliance';
 scope: {
 entities?: string[];
 teams?: string[];
 systems?: string[];
 timeRange: {
 start: string;
 end: string;
 };
 };
 generatedAt: string;
 generatedBy: string;
 data: QualityReportData;
}

export interface QualityReportData {
 summary: {
 totalEntities: number;
 averageScore: number;
 passRate: number;
 trends: Record<QualityCategory, number>;
 };
 topPerformers: Array<{
 entityId: string;
 score: number;
 }>;
 needsAttention: Array<{
 entityId: string;
 score: number;
 criticalIssues: number;
 }>;
 categoryBreakdown: Record<QualityCategory, {
 averageScore: number;
 passRate: number;
 commonIssues: string[];
 }>;
 certifications: {
 issued: number;
 expiring: number;
 byLevel: Record<string, number>;
 };
}

export interface QualityAlert {
 id: string;
 entityId: string;
 severity: 'critical' | 'high' | 'medium' | 'low';
 title: string;
 description: string;
 category: QualityCategory;
 triggerCondition: string;
 status: 'open' | 'acknowledged' | 'resolved' | 'closed';
 createdAt: string;
 acknowledgedAt?: string;
 resolvedAt?: string;
 assignedTo?: string;
 actions: QualityAlertAction[];
}

export interface QualityAlertAction {
 type: 'acknowledge' | 'resolve' | 'escalate' | 'assign' | 'comment';
 timestamp: string;
 userId: string;
 comment?: string;
 assignedTo?: string;
}

export interface SoundcheckConfig {
 enabled: boolean;
 assessmentInterval: number; // Minutes between assessments
 retentionPeriod: number; // Days to retain assessment history
 defaultGates: string[];
 alerting: {
 enabled: boolean;
 channels: AlertChannel[];
 };
 integrations: {
 catalog: boolean;
 ci: boolean;
 monitoring: boolean;
 };
}

export interface AlertChannel {
 type: 'email' | 'slack' | 'webhook' | 'teams';
 config: Record<string, any>;
 conditions: {
 severity: string[];
 categories: QualityCategory[];
 };
}