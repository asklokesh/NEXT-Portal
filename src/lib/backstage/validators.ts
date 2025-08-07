/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import yaml from 'js-yaml';
import { z } from 'zod';

// Backstage Entity validation schemas
const EntityMetadataSchema = z.object({
 name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
 namespace: z.string().optional().default('default'),
 title: z.string().optional(),
 description: z.string().optional(),
 labels: z.record(z.string()).optional(),
 annotations: z.record(z.string()).optional(),
 tags: z.array(z.string()).optional(),
 links: z.array(z.object({
 url: z.string().url(),
 title: z.string(),
 icon: z.string().optional(),
 })).optional(),
});

const ComponentSpecSchema = z.object({
 type: z.enum(['service', 'website', 'library', 'documentation', 'tool', 'other']),
 lifecycle: z.enum(['experimental', 'production', 'deprecated']),
 owner: z.string(),
 system: z.string().optional(),
 subcomponentOf: z.string().optional(),
 providesApis: z.array(z.string()).optional(),
 consumesApis: z.array(z.string()).optional(),
 dependsOn: z.array(z.string()).optional(),
 dependencyOf: z.array(z.string()).optional(),
});

const EntitySchema = z.object({
 apiVersion: z.literal('backstage.io/v1alpha1'),
 kind: z.enum(['Component', 'API', 'Group', 'User', 'Resource', 'System', 'Domain', 'Location']),
 metadata: EntityMetadataSchema,
 spec: z.any(), // Spec varies by kind
});

const ComponentEntitySchema = EntitySchema.extend({
 kind: z.literal('Component'),
 spec: ComponentSpecSchema,
});

// Validation functions
export function validateYaml(yamlContent: string): { valid: boolean; error?: string } {
 try {
 // First, check if it's valid YAML
 const parsed = yaml.load(yamlContent);
 
 if (!parsed || typeof parsed !== 'object') {
 return { valid: false, error: 'Invalid YAML structure' };
 }
 
 return { valid: true };
 } catch (error) {
 return { 
 valid: false, 
 error: error instanceof Error ? error.message : 'Invalid YAML syntax' 
 };
 }
}

export function validateBackstageEntity(entity: unknown): { valid: boolean; error?: string } {
 try {
 // Basic entity validation
 const baseResult = EntitySchema.safeParse(entity);
 if (!baseResult.success) {
 const firstError = baseResult.error.errors[0];
 return { 
 valid: false, 
 error: `${firstError.path.join('.')}: ${firstError.message}` 
 };
 }

 // Kind-specific validation
 const entityData = baseResult.data;
 if (entityData.kind === 'Component') {
 const componentResult = ComponentEntitySchema.safeParse(entity);
 if (!componentResult.success) {
 const firstError = componentResult.error.errors[0];
 return { 
 valid: false, 
 error: `${firstError.path.join('.')}: ${firstError.message}` 
 };
 }
 }

 // Validate entity references
 const spec = (entity as any).spec;
 if (spec) {
 // Check providesApis references
 if (spec.providesApis) {
 for (const api of spec.providesApis) {
 if (!isValidEntityRef(api)) {
 return { valid: false, error: `Invalid API reference: ${api}` };
 }
 }
 }

 // Check consumesApis references
 if (spec.consumesApis) {
 for (const api of spec.consumesApis) {
 if (!isValidEntityRef(api)) {
 return { valid: false, error: `Invalid API reference: ${api}` };
 }
 }
 }

 // Check dependsOn references
 if (spec.dependsOn) {
 for (const dep of spec.dependsOn) {
 if (!isValidEntityRef(dep)) {
 return { valid: false, error: `Invalid dependency reference: ${dep}` };
 }
 }
 }

 // Check owner reference
 if (spec.owner && !isValidEntityRef(spec.owner)) {
 return { valid: false, error: `Invalid owner reference: ${spec.owner}` };
 }
 }

 return { valid: true };
 } catch (error) {
 return { 
 valid: false, 
 error: error instanceof Error ? error.message : 'Validation error' 
 };
 }
}

export function validateCatalogInfo(yamlContent: string): { valid: boolean; error?: string } {
 // First validate YAML syntax
 const yamlValidation = validateYaml(yamlContent);
 if (!yamlValidation.valid) {
 return yamlValidation;
 }

 try {
 // Parse YAML and validate as Backstage entity
 const entity = yaml.load(yamlContent);
 return validateBackstageEntity(entity);
 } catch (error) {
 return { 
 valid: false, 
 error: error instanceof Error ? error.message : 'Failed to validate entity' 
 };
 }
}

// Helper function to validate entity references
function isValidEntityRef(ref: string): boolean {
 // Entity refs can be in these formats:
 // - Full: [<kind>:][<namespace>/]<name>
 // - User/Group shorthand: <name>
 // - Component shorthand: <name>
 
 // For now, accept any non-empty string
 // In production, you'd want more strict validation
 return typeof ref === 'string' && ref.length > 0;
}

// Export additional utilities
export function formatEntityRef(kind: string, namespace: string, name: string): string {
 return `${kind}:${namespace}/${name}`;
}

export function parseEntityRef(ref: string): { kind?: string; namespace?: string; name: string } {
 const match = ref.match(/^(?:([^:]+):)?(?:([^/]+)\/)?(.+)$/);
 if (!match) {
 throw new Error(`Invalid entity reference: ${ref}`);
 }
 
 const [, kind, namespace, name] = match;
 return {
 kind,
 namespace,
 name,
 };
}