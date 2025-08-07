/**
 * Soundcheck Policy Engine
 * Rule management and policy enforcement system
 */

import {
 QualityPolicy,
 PolicyRule,
 PolicyCondition,
 QualityCheck,
 QualityGate,
 SoundcheckEntity,
 QualityAssessment
} from '@/types/soundcheck';
import { soundcheckEngine } from './soundcheck-engine';

export interface PolicyEvaluationResult {
 policyId: string;
 entityId: string;
 passed: boolean;
 enforcement: 'advisory' | 'warning' | 'blocking';
 violations: Array<{
 ruleId: string;
 ruleName: string;
 message: string;
 severity: string;
 }>;
 evaluatedAt: string;
}

export interface PolicyTemplate {
 id: string;
 name: string;
 description: string;
 category: string;
 rules: PolicyRule[];
 defaultEnforcement: 'advisory' | 'warning' | 'blocking';
 applicableKinds: string[];
}

export interface PolicyManagementResult {
 success: boolean;
 policyId?: string;
 message: string;
 errors?: string[];
}

export class PolicyEngine {
 private policies: Map<string, QualityPolicy> = new Map();
 private templates: Map<string, PolicyTemplate> = new Map();
 private evaluationHistory: Map<string, PolicyEvaluationResult[]> = new Map();

 constructor() {
 this.initializeDefaultPolicies();
 this.initializePolicyTemplates();
 }

 /**
 * Initialize default quality policies
 */
 private initializeDefaultPolicies(): void {
 const defaultPolicies: QualityPolicy[] = [
 {
 id: 'production-readiness',
 name: 'Production Readiness Policy',
 description: 'Ensures services meet production deployment standards',
 scope: 'global',
 targetSelector: {
 lifecycle: ['production', 'staging']
 },
 rules: [
 {
 id: 'prod-security-rule',
 name: 'Security Requirements',
 description: 'Mandatory security checks for production services',
 checkIds: ['security-api-authentication', 'security-tls-enabled'],
 conditions: [{
 field: 'spec.type',
 operator: 'equals',
 value: 'service'
 }]
 },
 {
 id: 'prod-reliability-rule',
 name: 'Reliability Standards',
 description: 'Service reliability requirements',
 checkIds: ['reliability-health-check', 'reliability-sla-defined'],
 gateIds: ['production-gate'],
 conditions: []
 }
 ],
 enforcement: 'blocking',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 createdBy: 'system'
 },
 {
 id: 'security-baseline',
 name: 'Security Baseline Policy',
 description: 'Minimum security requirements for all services',
 scope: 'global',
 rules: [
 {
 id: 'security-baseline-rule',
 name: 'Basic Security',
 description: 'Essential security controls',
 checkIds: [
 'security-api-authentication',
 'security-secrets-scanner',
 'security-vulnerability-scan'
 ],
 conditions: []
 }
 ],
 enforcement: 'warning',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 createdBy: 'security-team'
 },
 {
 id: 'team-standards',
 name: 'Team Development Standards',
 description: 'Development standards for engineering teams',
 scope: 'team',
 targetSelector: {
 owner: ['team-alpha', 'team-beta']
 },
 rules: [
 {
 id: 'team-docs-rule',
 name: 'Documentation Requirements',
 description: 'Team-specific documentation standards',
 checkIds: ['docs-readme-exists', 'docs-api-coverage'],
 conditions: []
 },
 {
 id: 'team-testing-rule',
 name: 'Testing Standards',
 description: 'Minimum testing requirements',
 checkIds: ['testing-unit-coverage', 'testing-integration-tests'],
 conditions: [{
 field: 'spec.type',
 operator: 'not_equals',
 value: 'documentation'
 }]
 }
 ],
 enforcement: 'advisory',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 createdBy: 'platform-team'
 }
 ];

 defaultPolicies.forEach(policy => this.policies.set(policy.id, policy));
 }

 /**
 * Initialize policy templates
 */
 private initializePolicyTemplates(): void {
 const templates: PolicyTemplate[] = [
 {
 id: 'api-service-policy',
 name: 'API Service Policy',
 description: 'Comprehensive policy for API services',
 category: 'service',
 applicableKinds: ['API', 'Component'],
 defaultEnforcement: 'warning',
 rules: [
 {
 id: 'api-auth-rule',
 name: 'API Authentication',
 description: 'APIs must implement proper authentication',
 checkIds: ['security-api-authentication'],
 conditions: [{
 field: 'spec.type',
 operator: 'equals',
 value: 'api'
 }]
 },
 {
 id: 'api-docs-rule',
 name: 'API Documentation',
 description: 'APIs must have complete documentation',
 checkIds: ['docs-api-coverage'],
 conditions: []
 },
 {
 id: 'api-performance-rule',
 name: 'API Performance',
 description: 'APIs must meet performance standards',
 checkIds: ['performance-response-time', 'performance-load-test'],
 conditions: []
 }
 ]
 },
 {
 id: 'microservice-policy',
 name: 'Microservice Policy',
 description: 'Standards for microservices architecture',
 category: 'architecture',
 applicableKinds: ['Component'],
 defaultEnforcement: 'blocking',
 rules: [
 {
 id: 'microservice-health-rule',
 name: 'Health Monitoring',
 description: 'Microservices must expose health endpoints',
 checkIds: ['reliability-health-check'],
 conditions: [{
 field: 'spec.type',
 operator: 'equals',
 value: 'service'
 }]
 },
 {
 id: 'microservice-resilience-rule',
 name: 'Resilience Patterns',
 description: 'Implement circuit breakers and retry logic',
 checkIds: ['reliability-error-rate'],
 conditions: []
 }
 ]
 },
 {
 id: 'data-service-policy',
 name: 'Data Service Policy',
 description: 'Policy for data-handling services',
 category: 'data',
 applicableKinds: ['Component'],
 defaultEnforcement: 'blocking',
 rules: [
 {
 id: 'data-encryption-rule',
 name: 'Data Encryption',
 description: 'Data must be encrypted at rest and in transit',
 checkIds: ['security-tls-enabled'],
 conditions: [{
 field: 'metadata.tags',
 operator: 'in',
 value: ['data', 'database', 'storage']
 }]
 },
 {
 id: 'data-backup-rule',
 name: 'Data Backup',
 description: 'Regular backups must be configured',
 checkIds: ['reliability-backup-configured'],
 conditions: []
 }
 ]
 }
 ];

 templates.forEach(template => this.templates.set(template.id, template));
 }

 /**
 * Create a new policy
 */
 async createPolicy(policy: QualityPolicy): Promise<PolicyManagementResult> {
 try {
 // Validate policy
 const validation = this.validatePolicy(policy);
 if (!validation.valid) {
 return {
 success: false,
 message: 'Policy validation failed',
 errors: validation.errors
 };
 }

 // Check for duplicate ID
 if (this.policies.has(policy.id)) {
 return {
 success: false,
 message: 'Policy with this ID already exists',
 errors: ['Duplicate policy ID']
 };
 }

 // Add timestamps
 policy.createdAt = new Date().toISOString();
 policy.updatedAt = policy.createdAt;

 // Store policy
 this.policies.set(policy.id, policy);

 return {
 success: true,
 policyId: policy.id,
 message: 'Policy created successfully'
 };
 } catch (error) {
 return {
 success: false,
 message: 'Failed to create policy',
 errors: [error instanceof Error ? error.message : 'Unknown error']
 };
 }
 }

 /**
 * Update an existing policy
 */
 async updatePolicy(
 policyId: string,
 updates: Partial<QualityPolicy>
 ): Promise<PolicyManagementResult> {
 try {
 const existingPolicy = this.policies.get(policyId);
 if (!existingPolicy) {
 return {
 success: false,
 message: 'Policy not found',
 errors: ['Policy does not exist']
 };
 }

 // Merge updates
 const updatedPolicy: QualityPolicy = {
 ...existingPolicy,
 ...updates,
 id: policyId, // Ensure ID cannot be changed
 createdAt: existingPolicy.createdAt, // Preserve creation date
 updatedAt: new Date().toISOString()
 };

 // Validate updated policy
 const validation = this.validatePolicy(updatedPolicy);
 if (!validation.valid) {
 return {
 success: false,
 message: 'Policy validation failed',
 errors: validation.errors
 };
 }

 // Store updated policy
 this.policies.set(policyId, updatedPolicy);

 return {
 success: true,
 policyId,
 message: 'Policy updated successfully'
 };
 } catch (error) {
 return {
 success: false,
 message: 'Failed to update policy',
 errors: [error instanceof Error ? error.message : 'Unknown error']
 };
 }
 }

 /**
 * Delete a policy
 */
 async deletePolicy(policyId: string): Promise<PolicyManagementResult> {
 if (!this.policies.has(policyId)) {
 return {
 success: false,
 message: 'Policy not found',
 errors: ['Policy does not exist']
 };
 }

 this.policies.delete(policyId);
 
 // Clear related evaluation history
 for (const [key, _] of this.evaluationHistory) {
 if (key.startsWith(`${policyId}-`)) {
 this.evaluationHistory.delete(key);
 }
 }

 return {
 success: true,
 policyId,
 message: 'Policy deleted successfully'
 };
 }

 /**
 * Evaluate policies for an entity
 */
 async evaluatePolicies(
 entity: SoundcheckEntity,
 policyIds?: string[]
 ): Promise<PolicyEvaluationResult[]> {
 const results: PolicyEvaluationResult[] = [];
 
 // Get applicable policies
 const policiesToEvaluate = policyIds 
 ? Array.from(this.policies.values()).filter(p => policyIds.includes(p.id))
 : this.getApplicablePolicies(entity);

 // Get latest assessment
 const assessment = soundcheckEngine.getLatestAssessment(entity.id) ||
 await soundcheckEngine.runAssessment(entity);

 // Evaluate each policy
 for (const policy of policiesToEvaluate) {
 const result = await this.evaluatePolicy(entity, policy, assessment);
 results.push(result);
 
 // Store in history
 const historyKey = `${policy.id}-${entity.id}`;
 if (!this.evaluationHistory.has(historyKey)) {
 this.evaluationHistory.set(historyKey, []);
 }
 this.evaluationHistory.get(historyKey)!.push(result);
 }

 return results;
 }

 /**
 * Evaluate a single policy
 */
 private async evaluatePolicy(
 entity: SoundcheckEntity,
 policy: QualityPolicy,
 assessment: QualityAssessment
 ): Promise<PolicyEvaluationResult> {
 const violations: PolicyEvaluationResult['violations'] = [];
 let allRulesPassed = true;

 // Evaluate each rule
 for (const rule of policy.rules) {
 // Check conditions
 if (!this.evaluateConditions(entity, rule.conditions)) {
 continue; // Skip rule if conditions not met
 }

 // Evaluate checks
 let rulePassed = true;
 for (const checkId of rule.checkIds) {
 const checkResult = assessment.checkResults.find(r => r.checkId === checkId);
 if (!checkResult || checkResult.status === 'fail') {
 rulePassed = false;
 const check = soundcheckEngine.getCheck(checkId);
 violations.push({
 ruleId: rule.id,
 ruleName: rule.name,
 message: checkResult?.message || `Check ${checkId} failed`,
 severity: check?.severity || 'medium'
 });
 }
 }

 // Evaluate gates
 if (rule.gateIds) {
 for (const gateId of rule.gateIds) {
 const gateResult = assessment.gateResults.find(r => r.gateId === gateId);
 if (!gateResult || gateResult.status === 'fail') {
 rulePassed = false;
 violations.push({
 ruleId: rule.id,
 ruleName: rule.name,
 message: `Quality gate ${gateId} not passed`,
 severity: 'high'
 });
 }
 }
 }

 if (!rulePassed) {
 allRulesPassed = false;
 }
 }

 return {
 policyId: policy.id,
 entityId: entity.id,
 passed: allRulesPassed,
 enforcement: policy.enforcement,
 violations,
 evaluatedAt: new Date().toISOString()
 };
 }

 /**
 * Evaluate conditions for a rule
 */
 private evaluateConditions(
 entity: SoundcheckEntity,
 conditions: PolicyCondition[]
 ): boolean {
 if (conditions.length === 0) return true;

 for (const condition of conditions) {
 const fieldValue = this.getFieldValue(entity, condition.field);
 
 switch (condition.operator) {
 case 'equals':
 if (fieldValue !== condition.value) return false;
 break;
 case 'not_equals':
 if (fieldValue === condition.value) return false;
 break;
 case 'greater_than':
 if (!(Number(fieldValue) > Number(condition.value))) return false;
 break;
 case 'less_than':
 if (!(Number(fieldValue) < Number(condition.value))) return false;
 break;
 case 'in':
 if (!Array.isArray(condition.value) || !condition.value.includes(fieldValue)) return false;
 break;
 case 'not_in':
 if (Array.isArray(condition.value) && condition.value.includes(fieldValue)) return false;
 break;
 }
 }

 return true;
 }

 /**
 * Get field value from entity using dot notation
 */
 private getFieldValue(entity: SoundcheckEntity, fieldPath: string): any {
 const parts = fieldPath.split('.');
 let current: any = entity;

 for (const part of parts) {
 if (current === null || current === undefined) {
 return undefined;
 }
 current = current[part];
 }

 return current;
 }

 /**
 * Get policies applicable to an entity
 */
 private getApplicablePolicies(entity: SoundcheckEntity): QualityPolicy[] {
 return Array.from(this.policies.values()).filter(policy => {
 // Check scope
 switch (policy.scope) {
 case 'global':
 return true;
 
 case 'team':
 if (policy.targetSelector?.owner) {
 return policy.targetSelector.owner.includes(entity.metadata.owner || '');
 }
 break;
 
 case 'system':
 if (policy.targetSelector?.system) {
 return policy.targetSelector.system.includes(entity.metadata.system || '');
 }
 break;
 
 case 'component':
 if (policy.targetSelector?.kind) {
 return policy.targetSelector.kind.includes(entity.kind);
 }
 break;
 }

 // Check other selectors
 if (policy.targetSelector) {
 if (policy.targetSelector.lifecycle && entity.metadata.lifecycle) {
 if (!policy.targetSelector.lifecycle.includes(entity.metadata.lifecycle)) {
 return false;
 }
 }
 
 if (policy.targetSelector.tags && entity.metadata.tags) {
 const hasMatchingTag = policy.targetSelector.tags.some(tag => 
 entity.metadata.tags?.includes(tag)
 );
 if (!hasMatchingTag) return false;
 }
 }

 return true;
 });
 }

 /**
 * Validate policy structure
 */
 private validatePolicy(policy: QualityPolicy): { valid: boolean; errors: string[] } {
 const errors: string[] = [];

 if (!policy.id) errors.push('Policy ID is required');
 if (!policy.name) errors.push('Policy name is required');
 if (!policy.scope) errors.push('Policy scope is required');
 if (!policy.rules || policy.rules.length === 0) errors.push('At least one rule is required');
 if (!['advisory', 'warning', 'blocking'].includes(policy.enforcement)) {
 errors.push('Invalid enforcement level');
 }

 // Validate rules
 policy.rules.forEach((rule, index) => {
 if (!rule.id) errors.push(`Rule ${index + 1}: ID is required`);
 if (!rule.name) errors.push(`Rule ${index + 1}: Name is required`);
 if (!rule.checkIds || rule.checkIds.length === 0) {
 if (!rule.gateIds || rule.gateIds.length === 0) {
 errors.push(`Rule ${index + 1}: At least one check or gate is required`);
 }
 }
 });

 return {
 valid: errors.length === 0,
 errors
 };
 }

 /**
 * Create policy from template
 */
 createPolicyFromTemplate(
 templateId: string,
 customization: {
 id: string;
 name: string;
 description?: string;
 scope: 'global' | 'team' | 'system' | 'component';
 targetSelector?: Record<string, any>;
 enforcement?: 'advisory' | 'warning' | 'blocking';
 }
 ): PolicyManagementResult {
 const template = this.templates.get(templateId);
 if (!template) {
 return {
 success: false,
 message: 'Template not found',
 errors: ['Invalid template ID']
 };
 }

 const policy: QualityPolicy = {
 id: customization.id,
 name: customization.name,
 description: customization.description || template.description,
 scope: customization.scope,
 targetSelector: customization.targetSelector,
 rules: [...template.rules], // Copy rules from template
 enforcement: customization.enforcement || template.defaultEnforcement,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 createdBy: 'user'
 };

 return this.createPolicy(policy);
 }

 /**
 * Get all policies
 */
 getAllPolicies(): QualityPolicy[] {
 return Array.from(this.policies.values());
 }

 /**
 * Get policy by ID
 */
 getPolicy(policyId: string): QualityPolicy | undefined {
 return this.policies.get(policyId);
 }

 /**
 * Get all templates
 */
 getAllTemplates(): PolicyTemplate[] {
 return Array.from(this.templates.values());
 }

 /**
 * Get template by ID
 */
 getTemplate(templateId: string): PolicyTemplate | undefined {
 return this.templates.get(templateId);
 }

 /**
 * Get evaluation history
 */
 getEvaluationHistory(
 policyId: string,
 entityId?: string,
 limit?: number
 ): PolicyEvaluationResult[] {
 const results: PolicyEvaluationResult[] = [];
 
 if (entityId) {
 const history = this.evaluationHistory.get(`${policyId}-${entityId}`) || [];
 results.push(...history);
 } else {
 // Get all evaluations for the policy
 for (const [key, history] of this.evaluationHistory) {
 if (key.startsWith(`${policyId}-`)) {
 results.push(...history);
 }
 }
 }

 // Sort by evaluation time (newest first)
 results.sort((a, b) => 
 new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
 );

 if (limit) {
 return results.slice(0, limit);
 }

 return results;
 }

 /**
 * Get policy compliance summary
 */
 getPolicyComplianceSummary(policyId: string): {
 totalEvaluations: number;
 passed: number;
 failed: number;
 complianceRate: number;
 criticalViolations: number;
 recentTrend: 'improving' | 'declining' | 'stable';
 } {
 const history = this.getEvaluationHistory(policyId);
 
 if (history.length === 0) {
 return {
 totalEvaluations: 0,
 passed: 0,
 failed: 0,
 complianceRate: 0,
 criticalViolations: 0,
 recentTrend: 'stable'
 };
 }

 const passed = history.filter(r => r.passed).length;
 const failed = history.filter(r => !r.passed).length;
 const criticalViolations = history.reduce((sum, r) => 
 sum + r.violations.filter(v => v.severity === 'critical').length, 0
 );

 // Calculate trend from last 10 evaluations
 const recentHistory = history.slice(0, 10);
 const recentPassRate = recentHistory.filter(r => r.passed).length / recentHistory.length;
 const olderHistory = history.slice(10, 20);
 const olderPassRate = olderHistory.length > 0 
 ? olderHistory.filter(r => r.passed).length / olderHistory.length 
 : recentPassRate;

 let recentTrend: 'improving' | 'declining' | 'stable';
 if (Math.abs(recentPassRate - olderPassRate) < 0.05) {
 recentTrend = 'stable';
 } else if (recentPassRate > olderPassRate) {
 recentTrend = 'improving';
 } else {
 recentTrend = 'declining';
 }

 return {
 totalEvaluations: history.length,
 passed,
 failed,
 complianceRate: Math.round((passed / history.length) * 100),
 criticalViolations,
 recentTrend
 };
 }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();