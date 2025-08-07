/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { backstageClient } from './client';
import { Entity } from './types';

export interface ValidationResult {
 valid: boolean;
 errors: ValidationError[];
 warnings: ValidationWarning[];
}

export interface ValidationError {
 type: 'name_conflict' | 'invalid_reference' | 'circular_dependency' | 'missing_owner' | 'invalid_format';
 message: string;
 field?: string;
 suggestion?: string;
}

export interface ValidationWarning {
 type: 'deprecated_dependency' | 'missing_tags' | 'no_description' | 'experimental_lifecycle';
 message: string;
 field?: string;
 suggestion?: string;
}

export class ServiceValidator {
 /**
 * Validate service configuration before creation
 */
 static async validateService(formData: any): Promise<ValidationResult> {
 const errors: ValidationError[] = [];
 const warnings: ValidationWarning[] = [];

 try {
 // Check for name conflicts
 await this.checkNameConflict(formData.name, errors);

 // Validate owner references
 await this.validateOwnerReferences(formData.owner, errors, warnings);

 // Validate dependency references
 if (formData.dependsOn?.length > 0) {
 await this.validateDependencies(formData.dependsOn, errors, warnings);
 }

 // Validate API references
 if (formData.providesApis?.length > 0) {
 await this.validateApiReferences(formData.providesApis, errors, warnings);
 }

 if (formData.consumesApis?.length > 0) {
 await this.validateApiReferences(formData.consumesApis, errors, warnings);
 }

 // Check for common issues
 this.validateCommonIssues(formData, warnings);

 // Validate system references
 if (formData.system) {
 await this.validateSystemReference(formData.system, errors, warnings);
 }

 } catch (error) {
 errors.push({
 type: 'invalid_format',
 message: 'Failed to validate service configuration',
 suggestion: 'Check your network connection and try again',
 });
 }

 return {
 valid: errors.length === 0,
 errors,
 warnings,
 };
 }

 /**
 * Check if service name already exists
 */
 private static async checkNameConflict(name: string, errors: ValidationError[]): Promise<void> {
 if (!name) return;

 try {
 const existingServices = await backstageClient.getCatalogEntities({
 kind: 'Component',
 });

 const conflict = existingServices.find(service => 
 service.metadata.name.toLowerCase() === name.toLowerCase()
 );

 if (conflict) {
 errors.push({
 type: 'name_conflict',
 message: `A service named "${name}" already exists`,
 field: 'name',
 suggestion: `Try "${name}-v2" or "${name}-new" instead`,
 });
 }
 } catch (error) {
 // If we can't check, it's not necessarily an error
 console.warn('Could not check for name conflicts:', error);
 }
 }

 /**
 * Validate owner references exist
 */
 private static async validateOwnerReferences(owner: string, errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
 if (!owner) {
 errors.push({
 type: 'missing_owner',
 message: 'Owner is required for all services',
 field: 'owner',
 suggestion: 'Select a team or user as the owner',
 });
 return;
 }

 try {
 // Try to find the owner in the catalog
 const entities = await backstageClient.getCatalogEntities({
 kind: ['Group', 'User'],
 });

 const ownerExists = entities.some(entity => 
 entity.metadata.name.toLowerCase() === owner.toLowerCase() ||
 entity.metadata.title?.toLowerCase() === owner.toLowerCase()
 );

 if (!ownerExists) {
 warnings.push({
 type: 'missing_tags',
 message: `Owner "${owner}" not found in catalog`,
 field: 'owner',
 suggestion: 'Make sure the owner exists in the catalog or create them first',
 });
 }
 } catch (error) {
 console.warn('Could not validate owner reference:', error);
 }
 }

 /**
 * Validate dependency references
 */
 private static async validateDependencies(dependencies: string[], errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
 try {
 const allEntities = await backstageClient.getCatalogEntities();
 
 for (const dep of dependencies) {
 if (!dep.trim()) continue;

 // Parse entity reference (kind:namespace/name format)
 const entityRef = this.parseEntityReference(dep);
 if (!entityRef) {
 errors.push({
 type: 'invalid_reference',
 message: `Invalid dependency reference: "${dep}"`,
 field: 'dependsOn',
 suggestion: 'Use format: Component:default/service-name or just service-name',
 });
 continue;
 }

 // Check if the referenced entity exists
 const exists = allEntities.some(entity =>
 entity.kind === entityRef.kind &&
 entity.metadata.namespace === entityRef.namespace &&
 entity.metadata.name === entityRef.name
 );

 if (!exists) {
 warnings.push({
 type: 'missing_tags',
 message: `Dependency "${dep}" not found in catalog`,
 field: 'dependsOn',
 suggestion: 'Make sure the dependency exists or will be created before this service',
 });
 } else {
 // Check if dependency is deprecated
 const entity = allEntities.find(e =>
 e.kind === entityRef.kind &&
 e.metadata.namespace === entityRef.namespace &&
 e.metadata.name === entityRef.name
 );

 if (entity && (entity.spec as any)?.lifecycle === 'deprecated') {
 warnings.push({
 type: 'deprecated_dependency',
 message: `Dependency "${dep}" is marked as deprecated`,
 field: 'dependsOn',
 suggestion: 'Consider finding an alternative or updating the dependency',
 });
 }
 }
 }
 } catch (error) {
 console.warn('Could not validate dependencies:', error);
 }
 }

 /**
 * Validate API references
 */
 private static async validateApiReferences(apis: string[], errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
 try {
 const apiEntities = await backstageClient.getCatalogEntities({
 kind: 'API',
 });

 for (const api of apis) {
 if (!api.trim()) continue;

 const entityRef = this.parseEntityReference(api);
 if (!entityRef) {
 errors.push({
 type: 'invalid_reference',
 message: `Invalid API reference: "${api}"`,
 suggestion: 'Use format: API:default/api-name or just api-name',
 });
 continue;
 }

 const exists = apiEntities.some(entity =>
 entity.metadata.namespace === entityRef.namespace &&
 entity.metadata.name === entityRef.name
 );

 if (!exists) {
 warnings.push({
 type: 'missing_tags',
 message: `API "${api}" not found in catalog`,
 suggestion: 'Make sure the API exists or will be created',
 });
 }
 }
 } catch (error) {
 console.warn('Could not validate API references:', error);
 }
 }

 /**
 * Validate system reference
 */
 private static async validateSystemReference(system: string, errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
 try {
 const systemEntities = await backstageClient.getCatalogEntities({
 kind: 'System',
 });

 const exists = systemEntities.some(entity =>
 entity.metadata.name.toLowerCase() === system.toLowerCase()
 );

 if (!exists) {
 warnings.push({
 type: 'missing_tags',
 message: `System "${system}" not found in catalog`,
 field: 'system',
 suggestion: 'Make sure the system exists or create it first',
 });
 }
 } catch (error) {
 console.warn('Could not validate system reference:', error);
 }
 }

 /**
 * Check for common configuration issues
 */
 private static validateCommonIssues(formData: any, warnings: ValidationWarning[]): void {
 // Check for missing description
 if (!formData.description || formData.description.length < 10) {
 warnings.push({
 type: 'no_description',
 message: 'Service description is too short or missing',
 field: 'description',
 suggestion: 'Add a meaningful description to help others understand the service',
 });
 }

 // Check for missing tags
 if (!formData.tags || formData.tags.length === 0) {
 warnings.push({
 type: 'missing_tags',
 message: 'No tags specified',
 field: 'tags',
 suggestion: 'Add tags like technology stack, team, or purpose for better discoverability',
 });
 }

 // Check experimental lifecycle warning
 if (formData.lifecycle === 'experimental') {
 warnings.push({
 type: 'experimental_lifecycle',
 message: 'Service is marked as experimental',
 field: 'lifecycle',
 suggestion: 'Experimental services may have breaking changes and limited support',
 });
 }

 // Check for long service names
 if (formData.name && formData.name.length > 30) {
 warnings.push({
 type: 'missing_tags',
 message: 'Service name is quite long',
 field: 'name',
 suggestion: 'Consider a shorter, more concise name for better readability',
 });
 }
 }

 /**
 * Parse entity reference string
 */
 private static parseEntityReference(ref: string): { kind: string; namespace: string; name: string } | null {
 if (!ref) return null;

 // Handle full format: Kind:namespace/name
 const fullMatch = ref.match(/^([^:]+):([^/]+)\/(.+)$/);
 if (fullMatch) {
 return {
 kind: fullMatch[1],
 namespace: fullMatch[2],
 name: fullMatch[3],
 };
 }

 // Handle short format: just name (assume Component:default/name)
 const nameMatch = ref.match(/^[a-z0-9-]+$/);
 if (nameMatch) {
 return {
 kind: 'Component',
 namespace: 'default',
 name: ref,
 };
 }

 return null;
 }

 /**
 * Get validation suggestions based on form data
 */
 static getRecommendations(formData: any): string[] {
 const recommendations: string[] = [];

 // Technology-specific recommendations
 if (formData.tags?.includes('nodejs')) {
 recommendations.push('Consider adding health check endpoints for Node.js services');
 recommendations.push('Enable Prometheus metrics for monitoring');
 }

 if (formData.tags?.includes('react')) {
 recommendations.push('Add bundle size monitoring for React applications');
 recommendations.push('Consider implementing proper error boundaries');
 }

 if (formData.infrastructure?.database) {
 recommendations.push('Consider database migration strategies');
 recommendations.push('Plan for database backup and recovery');
 }

 if (formData.infrastructure?.messaging) {
 recommendations.push('Design for message retry and dead letter queues');
 recommendations.push('Consider message ordering and idempotency');
 }

 // Team-specific recommendations
 if (formData.owner === 'frontend-team') {
 recommendations.push('Follow accessibility guidelines (WCAG 2.1)');
 recommendations.push('Implement proper SEO optimization');
 }

 if (formData.type === 'service') {
 recommendations.push('Document your API schema with OpenAPI/GraphQL');
 recommendations.push('Implement proper authentication and authorization');
 }

 return recommendations;
 }

 /**
 * Check for circular dependencies
 */
 static async checkCircularDependencies(serviceName: string, dependencies: string[]): Promise<ValidationError[]> {
 const errors: ValidationError[] = [];
 
 try {
 // This would require a more complex graph analysis
 // For now, just check if service depends on itself
 for (const dep of dependencies) {
 const entityRef = this.parseEntityReference(dep);
 if (entityRef && entityRef.name === serviceName) {
 errors.push({
 type: 'circular_dependency',
 message: 'Service cannot depend on itself',
 field: 'dependsOn',
 suggestion: 'Remove self-reference from dependencies',
 });
 }
 }
 } catch (error) {
 console.warn('Could not check circular dependencies:', error);
 }

 return errors;
 }
}