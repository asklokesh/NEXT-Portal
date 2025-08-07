/**
 * Backstage Plugin Bridge
 * 
 * This bridge ensures the wrapper works seamlessly with any Backstage version
 * by using Backstage's own plugin APIs and patterns
 */

import { Entity, CompoundEntityRef } from '@backstage/catalog-model';

export interface BackstagePluginConfig {
 apiVersion: string;
 features: {
 catalog: boolean;
 scaffolder: boolean;
 techdocs: boolean;
 kubernetes: boolean;
 [key: string]: boolean;
 };
}

export class BackstagePluginBridge {
 private config: BackstagePluginConfig;
 private versionCompatibility: Map<string, string[]> = new Map([
 ['1.x', ['catalog', 'scaffolder', 'techdocs']],
 ['2.x', ['catalog', 'scaffolder', 'techdocs', 'kubernetes']],
 ]);

 constructor(config: BackstagePluginConfig) {
 this.config = config;
 }

 /**
 * Check if a feature is available in the current Backstage version
 */
 isFeatureAvailable(feature: string): boolean {
 const majorVersion = this.config.apiVersion.split('.')[0] + '.x';
 const supportedFeatures = this.versionCompatibility.get(majorVersion) || [];
 return supportedFeatures.includes(feature) && this.config.features[feature];
 }

 /**
 * Transform UI data to Backstage format
 * This ensures any UI changes are compatible with Backstage's data model
 */
 transformToBackstageEntity(uiData: any): Entity {
 return {
 apiVersion: uiData.apiVersion || 'backstage.io/v1alpha1',
 kind: uiData.kind || 'Component',
 metadata: {
 name: uiData.name,
 namespace: uiData.namespace || 'default',
 title: uiData.title || uiData.name,
 description: uiData.description,
 labels: this.transformLabels(uiData.labels),
 annotations: this.transformAnnotations(uiData.annotations),
 tags: uiData.tags || [],
 links: uiData.links || [],
 },
 spec: {
 type: uiData.type || 'service',
 lifecycle: uiData.lifecycle || 'production',
 owner: uiData.owner || 'unknown',
 system: uiData.system,
 subcomponentOf: uiData.parent,
 providesApis: uiData.providesApis || [],
 consumesApis: uiData.consumesApis || [],
 dependsOn: uiData.dependsOn || [],
 },
 relations: uiData.relations || [],
 status: uiData.status,
 };
 }

 /**
 * Transform Backstage entity to UI-friendly format
 */
 transformFromBackstageEntity(entity: Entity): any {
 return {
 // Core fields
 apiVersion: entity.apiVersion,
 kind: entity.kind,
 name: entity.metadata.name,
 namespace: entity.metadata.namespace,
 title: entity.metadata.title || entity.metadata.name,
 description: entity.metadata.description,
 
 // UI-friendly fields
 displayName: entity.metadata.title || entity.metadata.name,
 tags: entity.metadata.tags || [],
 labels: this.flattenLabels(entity.metadata.labels || {}),
 annotations: this.flattenAnnotations(entity.metadata.annotations || {}),
 
 // Spec fields
 type: entity.spec?.type,
 lifecycle: entity.spec?.lifecycle,
 owner: entity.spec?.owner,
 system: entity.spec?.system,
 parent: entity.spec?.subcomponentOf,
 
 // Relations
 providesApis: entity.spec?.providesApis || [],
 consumesApis: entity.spec?.consumesApis || [],
 dependsOn: entity.spec?.dependsOn || [],
 
 // UI metadata
 _original: entity,
 _entityRef: this.stringifyEntityRef(entity),
 };
 }

 /**
 * Convert UI labels to Backstage format
 */
 private transformLabels(labels: Array<{key: string; value: string}>): Record<string, string> {
 if (!labels) return {};
 return labels.reduce((acc, label) => {
 acc[label.key] = label.value;
 return acc;
 }, {} as Record<string, string>);
 }

 /**
 * Convert UI annotations to Backstage format
 */
 private transformAnnotations(annotations: Array<{key: string; value: string}>): Record<string, string> {
 if (!annotations) return {};
 return annotations.reduce((acc, annotation) => {
 acc[annotation.key] = annotation.value;
 return acc;
 }, {} as Record<string, string>);
 }

 /**
 * Flatten Backstage labels for UI display
 */
 private flattenLabels(labels: Record<string, string>): Array<{key: string; value: string}> {
 return Object.entries(labels).map(([key, value]) => ({ key, value }));
 }

 /**
 * Flatten Backstage annotations for UI display
 */
 private flattenAnnotations(annotations: Record<string, string>): Array<{key: string; value: string}> {
 return Object.entries(annotations).map(([key, value]) => ({ key, value }));
 }

 /**
 * Create entity reference string
 */
 private stringifyEntityRef(entity: Entity | CompoundEntityRef): string {
 if ('metadata' in entity) {
 return `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
 }
 return `${entity.kind}:${entity.namespace || 'default'}/${entity.name}`;
 }

 /**
 * Validate entity against Backstage schema
 */
 validateEntity(entity: any): { valid: boolean; errors: string[] } {
 const errors: string[] = [];

 // Required fields
 if (!entity.apiVersion) errors.push('apiVersion is required');
 if (!entity.kind) errors.push('kind is required');
 if (!entity.metadata?.name) errors.push('metadata.name is required');

 // Validate name format
 if (entity.metadata?.name && !/^[a-zA-Z0-9-]+$/.test(entity.metadata.name)) {
 errors.push('metadata.name must contain only alphanumeric characters and hyphens');
 }

 // Validate kind
 const validKinds = ['Component', 'API', 'System', 'Domain', 'Resource', 'Location', 'Template'];
 if (entity.kind && !validKinds.includes(entity.kind)) {
 errors.push(`kind must be one of: ${validKinds.join(', ')}`);
 }

 return {
 valid: errors.length === 0,
 errors,
 };
 }

 /**
 * Generate YAML from entity (for catalog-info.yaml files)
 */
 generateYAML(entity: Entity): string {
 const yaml = require('js-yaml');
 return yaml.dump(entity, {
 schema: yaml.JSON_SCHEMA,
 skipInvalid: true,
 noRefs: true,
 sortKeys: false,
 });
 }

 /**
 * Parse YAML to entity
 */
 parseYAML(yamlContent: string): Entity | null {
 try {
 const yaml = require('js-yaml');
 return yaml.load(yamlContent) as Entity;
 } catch (error) {
 console.error('Failed to parse YAML:', error);
 return null;
 }
 }
}

// Singleton instance
export const pluginBridge = new BackstagePluginBridge({
 apiVersion: '1.29.0', // This should come from Backstage API
 features: {
 catalog: true,
 scaffolder: true,
 techdocs: true,
 kubernetes: true,
 },
});