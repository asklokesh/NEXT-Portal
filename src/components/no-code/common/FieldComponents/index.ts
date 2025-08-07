/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { Type, Hash, ToggleLeft, List, Tags, Link, Mail, Globe, User, Calendar } from 'lucide-react';

import type { FieldType, FormField } from '../../types';
import type { LucideIcon} from 'lucide-react';

// Field type definitions with icons and configurations
export interface FieldTypeDefinition {
 type: FieldType;
 label: string;
 description: string;
 icon: LucideIcon;
 category: 'basic' | 'backstage' | 'advanced';
 defaultConfig: Partial<FormField>;
 previewValue?: unknown;
}

export const FIELD_TYPE_DEFINITIONS: FieldTypeDefinition[] = [
 // Basic fields
 {
 type: 'string',
 label: 'Text Input',
 description: 'Single line text input field',
 icon: Type,
 category: 'basic',
 defaultConfig: {
 type: 'string',
 label: 'Text Field',
 placeholder: 'Enter text...',
 validation: { required: false },
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'Sample text',
 },
 {
 type: 'number',
 label: 'Number Input',
 description: 'Numeric input field with validation',
 icon: Hash,
 category: 'basic',
 defaultConfig: {
 type: 'number',
 label: 'Number Field',
 placeholder: 'Enter number...',
 validation: { required: false },
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 42,
 },
 {
 type: 'boolean',
 label: 'Toggle',
 description: 'Boolean toggle switch',
 icon: ToggleLeft,
 category: 'basic',
 defaultConfig: {
 type: 'boolean',
 label: 'Toggle Field',
 defaultValue: false,
 position: { x: 0, y: 0, width: 240, height: 50 },
 },
 previewValue: true,
 },
 {
 type: 'select',
 label: 'Dropdown',
 description: 'Select from predefined options',
 icon: List,
 category: 'basic',
 defaultConfig: {
 type: 'select',
 label: 'Select Field',
 options: [
 { label: 'Option 1', value: 'option1' },
 { label: 'Option 2', value: 'option2' },
 { label: 'Option 3', value: 'option3' },
 ],
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'option1',
 },
 {
 type: 'array',
 label: 'List',
 description: 'Dynamic list of items',
 icon: List,
 category: 'basic',
 defaultConfig: {
 type: 'array',
 label: 'List Field',
 itemType: 'string',
 position: { x: 0, y: 0, width: 240, height: 120 },
 },
 previewValue: ['Item 1', 'Item 2'],
 },
 
 // Backstage-specific fields
 {
 type: 'tags',
 label: 'Tags',
 description: 'Backstage entity tags',
 icon: Tags,
 category: 'backstage',
 defaultConfig: {
 type: 'tags',
 label: 'Tags',
 description: 'Add tags to categorize this entity',
 backstageMapping: 'metadata.tags',
 suggestions: ['frontend', 'backend', 'api', 'service', 'library', 'tool'],
 position: { x: 0, y: 0, width: 240, height: 80 },
 },
 previewValue: ['frontend', 'react'],
 },
 {
 type: 'entityRef',
 label: 'Entity Reference',
 description: 'Reference to another Backstage entity',
 icon: Link,
 category: 'backstage',
 defaultConfig: {
 type: 'entityRef',
 label: 'Entity Reference',
 description: 'Select an entity from the catalog',
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'component:default/my-service',
 },
 {
 type: 'owner',
 label: 'Owner',
 description: 'Entity owner (user or group)',
 icon: User,
 category: 'backstage',
 defaultConfig: {
 type: 'owner',
 label: 'Owner',
 description: 'Who owns this entity?',
 backstageMapping: 'spec.owner',
 entityTypes: ['user', 'group'],
 validation: { required: true },
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'group:default/platform-team',
 },
 {
 type: 'lifecycle',
 label: 'Lifecycle',
 description: 'Entity lifecycle stage',
 icon: Calendar,
 category: 'backstage',
 defaultConfig: {
 type: 'lifecycle',
 label: 'Lifecycle',
 description: 'What stage is this entity in?',
 backstageMapping: 'spec.lifecycle',
 options: [
 { label: 'Experimental', value: 'experimental' },
 { label: 'Production', value: 'production' },
 { label: 'Deprecated', value: 'deprecated' },
 ],
 validation: { required: true },
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'production',
 },
 
 // Advanced fields
 {
 type: 'url',
 label: 'URL',
 description: 'URL input with validation',
 icon: Globe,
 category: 'advanced',
 defaultConfig: {
 type: 'url',
 label: 'URL',
 placeholder: 'https://example.com',
 protocols: ['http', 'https'],
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'https://example.com',
 },
 {
 type: 'email',
 label: 'Email',
 description: 'Email input with validation',
 icon: Mail,
 category: 'advanced',
 defaultConfig: {
 type: 'email',
 label: 'Email',
 placeholder: 'user@example.com',
 position: { x: 0, y: 0, width: 240, height: 60 },
 },
 previewValue: 'user@example.com',
 },
];

// Common Backstage field configurations
export const BACKSTAGE_FIELD_CONFIGS = {
 metadata: {
 name: {
 type: 'string' as const,
 label: 'Name',
 description: 'Unique identifier for this entity',
 backstageMapping: 'metadata.name',
 validation: { 
 required: true,
 pattern: '^[a-z0-9\\-\\.]+$',
 },
 placeholder: 'my-component',
 },
 title: {
 type: 'string' as const,
 label: 'Title',
 description: 'Human-readable name',
 backstageMapping: 'metadata.title',
 placeholder: 'My Component',
 },
 description: {
 type: 'string' as const,
 label: 'Description',
 description: 'Brief description of this entity',
 backstageMapping: 'metadata.description',
 multiline: true,
 placeholder: 'What does this component do?',
 },
 tags: {
 type: 'tags' as const,
 label: 'Tags',
 description: 'Tags for categorization',
 backstageMapping: 'metadata.tags',
 suggestions: ['frontend', 'backend', 'api', 'service', 'library'],
 },
 },
 spec: {
 component: {
 type: {
 type: 'select' as const,
 label: 'Type',
 description: 'Type of component',
 backstageMapping: 'spec.type',
 options: [
 { label: 'Service', value: 'service' },
 { label: 'Website', value: 'website' },
 { label: 'Library', value: 'library' },
 ],
 validation: { required: true },
 },
 lifecycle: {
 type: 'lifecycle' as const,
 label: 'Lifecycle',
 description: 'Current lifecycle stage',
 backstageMapping: 'spec.lifecycle',
 options: [
 { label: 'Experimental', value: 'experimental' },
 { label: 'Production', value: 'production' },
 { label: 'Deprecated', value: 'deprecated' },
 ],
 validation: { required: true },
 },
 owner: {
 type: 'owner' as const,
 label: 'Owner',
 description: 'Team or person responsible',
 backstageMapping: 'spec.owner',
 entityTypes: ['user', 'group'],
 validation: { required: true },
 },
 system: {
 type: 'entityRef' as const,
 label: 'System',
 description: 'System this component belongs to',
 backstageMapping: 'spec.system',
 entityKind: 'System',
 },
 },
 api: {
 type: {
 type: 'select' as const,
 label: 'Type',
 description: 'API type',
 backstageMapping: 'spec.type',
 options: [
 { label: 'OpenAPI', value: 'openapi' },
 { label: 'AsyncAPI', value: 'asyncapi' },
 { label: 'GraphQL', value: 'graphql' },
 { label: 'gRPC', value: 'grpc' },
 ],
 validation: { required: true },
 },
 lifecycle: {
 type: 'lifecycle' as const,
 label: 'Lifecycle',
 description: 'Current lifecycle stage',
 backstageMapping: 'spec.lifecycle',
 validation: { required: true },
 },
 owner: {
 type: 'owner' as const,
 label: 'Owner',
 description: 'Team or person responsible',
 backstageMapping: 'spec.owner',
 validation: { required: true },
 },
 definition: {
 type: 'string' as const,
 label: 'Definition',
 description: 'API definition (URL or inline)',
 backstageMapping: 'spec.definition',
 multiline: true,
 validation: { required: true },
 },
 },
 system: {
 owner: {
 type: 'owner' as const,
 label: 'Owner',
 description: 'Team or person responsible',
 backstageMapping: 'spec.owner',
 validation: { required: true },
 },
 domain: {
 type: 'entityRef' as const,
 label: 'Domain',
 description: 'Domain this system belongs to',
 backstageMapping: 'spec.domain',
 entityKind: 'Domain',
 },
 },
 },
};

// Helper functions
export function getFieldDefinition(type: FieldType): FieldTypeDefinition | undefined {
 return FIELD_TYPE_DEFINITIONS.find(def => def.type === type);
}

export function getFieldsByCategory(category: 'basic' | 'backstage' | 'advanced'): FieldTypeDefinition[] {
 return FIELD_TYPE_DEFINITIONS.filter(def => def.category === category);
}

export function createFieldFromDefinition(
 definition: FieldTypeDefinition,
 overrides: Partial<FormField> = {}
): FormField {
 const baseField = {
 id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 ...definition.defaultConfig,
 ...overrides,
 } as FormField;

 return baseField;
}

export function getBackstageFieldsForEntityType(
 entityType: 'Component' | 'API' | 'System' | 'Domain' | 'Resource' | 'User' | 'Group'
): FormField[] {
 const commonFields = [
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'string')!,
 BACKSTAGE_FIELD_CONFIGS.metadata.name
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'string')!,
 BACKSTAGE_FIELD_CONFIGS.metadata.title
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'string')!,
 { ...BACKSTAGE_FIELD_CONFIGS.metadata.description, multiline: true }
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'tags')!,
 BACKSTAGE_FIELD_CONFIGS.metadata.tags
 ),
 ];

 let specificFields: FormField[] = [];

 switch (entityType) {
 case 'Component':
 specificFields = [
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'select')!,
 BACKSTAGE_FIELD_CONFIGS.spec.component.type
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'lifecycle')!,
 BACKSTAGE_FIELD_CONFIGS.spec.component.lifecycle
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'owner')!,
 { ...BACKSTAGE_FIELD_CONFIGS.spec.component.owner, entityTypes: ['user', 'group'] as ('user' | 'group')[] }
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'entityRef')!,
 BACKSTAGE_FIELD_CONFIGS.spec.component.system
 ),
 ];
 break;

 case 'API':
 specificFields = [
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'select')!,
 BACKSTAGE_FIELD_CONFIGS.spec.api.type
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'lifecycle')!,
 BACKSTAGE_FIELD_CONFIGS.spec.api.lifecycle
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'owner')!,
 BACKSTAGE_FIELD_CONFIGS.spec.api.owner
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'string')!,
 BACKSTAGE_FIELD_CONFIGS.spec.api.definition
 ),
 ];
 break;

 case 'System':
 specificFields = [
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'owner')!,
 BACKSTAGE_FIELD_CONFIGS.spec.system.owner
 ),
 createFieldFromDefinition(
 FIELD_TYPE_DEFINITIONS.find(d => d.type === 'entityRef')!,
 BACKSTAGE_FIELD_CONFIGS.spec.system.domain
 ),
 ];
 break;

 // Add more entity types as needed
 }

 // Position fields automatically
 const allFields = [...commonFields, ...specificFields];
 allFields.forEach((field, index) => {
 const row = Math.floor(index / 2);
 const col = index % 2;
 field.position = {
 x: col * 260,
 y: row * 100,
 width: 240,
 height: field.type === 'string' && (field as any).multiline ? 100 : 60,
 };
 });

 return allFields;
}