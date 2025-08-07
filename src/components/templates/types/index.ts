/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { ReactNode } from 'react';

// Template types based on Backstage template structure
export interface TemplateMetadata {
 name: string;
 title: string;
 description: string;
 tags?: string[];
 category?: string;
 icon?: string;
 version?: string;
 author?: string;
 createdAt?: Date;
 updatedAt?: Date;
 publishedAt?: Date;
 deprecated?: boolean;
}

export interface TemplateParameter {
 title: string;
 type: 'string' | 'number' | 'boolean' | 'array' | 'object';
 description?: string;
 default?: any;
 enum?: any[];
 enumNames?: string[];
 pattern?: string;
 minLength?: number;
 maxLength?: number;
 minimum?: number;
 maximum?: number;
 required?: boolean;
 'ui:widget'?: string;
 'ui:options'?: Record<string, any>;
 'ui:help'?: string;
 'ui:placeholder'?: string;
 'ui:autofocus'?: boolean;
 properties?: Record<string, TemplateParameter>;
 items?: TemplateParameter;
 dependencies?: Record<string, any>;
 oneOf?: TemplateParameter[];
 anyOf?: TemplateParameter[];
 allOf?: TemplateParameter[];
}

export interface TemplateStep {
 id: string;
 name: string;
 action: string;
 input?: Record<string, any>;
 if?: string;
}

export interface TemplateAction {
 id: string;
 name: string;
 description?: string;
 schema?: {
 input?: Record<string, any>;
 output?: Record<string, any>;
 };
 handler?: string;
 examples?: Array<{
 description: string;
 input: Record<string, any>;
 }>;
}

export interface Template {
 apiVersion?: 'scaffolder.backstage.io/v1beta3';
 kind?: 'Template';
 id?: string;
 metadata: TemplateMetadata;
 spec: {
 type: string;
 owner?: string;
 parameters: Array<{
 title: string;
 required?: string[];
 properties: Record<string, TemplateParameter>;
 }>;
 steps: TemplateStep[];
 output?: Record<string, any>;
 files?: EditorFile[];
 };
}

// Builder types
export interface BuilderState {
 template: Partial<Template>;
 currentStep: number;
 validation: ValidationResult;
 preview: PreviewData;
 isDirty: boolean;
}

export interface WizardStep {
 id: string;
 title: string;
 description?: string;
 component: ReactNode;
 validation?: () => ValidationResult;
 isComplete?: boolean;
}

export interface ParameterFormData {
 name: string;
 parameter: TemplateParameter;
}

export interface ActionFormData {
 id: string;
 action: string;
 input: Record<string, any>;
 condition?: string;
}

// Preview types
export interface PreviewContext {
 parameters: Record<string, any>;
 steps: Array<{
 action: string;
 input: Record<string, any>;
 output?: Record<string, any>;
 }>;
}

export interface PreviewData {
 files: Array<{
 path: string;
 content: string;
 processed: boolean;
 }>;
 variables: Record<string, any>;
 errors: string[];
}

// Marketplace types
export interface TemplateListItem {
 id: string;
 metadata: TemplateMetadata;
 status: 'draft' | 'published' | 'archived';
 version: string;
 stats: {
 downloads: number;
 rating: number;
 reviews?: number;
 forks: number;
 stars: number;
 };
 owner: {
 name: string;
 email?: string;
 avatar?: string;
 };
}

export interface TemplateCategory {
 id: string;
 name: string;
 description: string;
 icon: ReactNode;
 count: number;
}

export interface TemplateReview {
 id: string;
 userId: string;
 userName: string;
 userAvatar?: string;
 rating: number;
 comment: string;
 createdAt: Date;
 helpful: number;
}

// Version control types
export interface TemplateVersion {
 id: string;
 version: string;
 template: Template;
 changelog?: string;
 author: string;
 createdAt: Date;
 approved?: boolean;
 approvedBy?: string;
 approvedAt?: Date;
 commitHash?: string;
}

export interface TemplateChange {
 type: 'added' | 'modified' | 'deleted';
 path: string;
 oldValue?: any;
 newValue?: any;
}

export interface ApprovalRequest {
 id: string;
 templateId: string;
 version: string;
 requestedBy: string;
 requestedAt: Date;
 status: 'pending' | 'approved' | 'rejected';
 reviewers: Array<{
 userId: string;
 userName: string;
 status: 'pending' | 'approved' | 'rejected';
 comment?: string;
 reviewedAt?: Date;
 }>;
 changes: TemplateChange[];
}

// Testing types
export interface TestCase {
 id: string;
 name: string;
 description?: string;
 parameters: Record<string, any>;
 expectedOutput?: Record<string, any>;
 assertions?: Array<{
 type: 'exists' | 'contains' | 'matches' | 'schema';
 path: string;
 value?: any;
 pattern?: string;
 schema?: any;
 }>;
}

export interface TestResult {
 testCaseId: string;
 status: 'passed' | 'failed' | 'error';
 duration: number;
 output?: Record<string, any>;
 errors?: string[];
 assertions: Array<{
 assertion: string;
 passed: boolean;
 actual?: any;
 expected?: any;
 error?: string;
 }>;
}

export interface ValidationResult {
 valid: boolean;
 errors: Array<{
 path: string;
 message: string;
 severity: 'error' | 'warning' | 'info';
 }>;
}

// Analytics types
export interface TemplateUsageStats {
 templateId: string;
 period: 'day' | 'week' | 'month' | 'year';
 metrics: {
 executions: number;
 uniqueUsers: number;
 successRate: number;
 averageDuration: number;
 errors: Array<{
 error: string;
 count: number;
 }>;
 parameterUsage: Record<string, Record<string, number>>;
 };
}

export interface TemplateAnalytics {
 overview: {
 totalTemplates: number;
 totalExecutions: number;
 activeUsers: number;
 successRate: number;
 };
 topTemplates: Array<{
 templateId: string;
 name: string;
 executions: number;
 trend: number;
 }>;
 recentActivity: Array<{
 type: 'created' | 'updated' | 'executed' | 'reviewed';
 templateId: string;
 templateName: string;
 userId: string;
 userName: string;
 timestamp: Date;
 }>;
}

// Security types
export interface SecurityScanResult {
 templateId: string;
 version: string;
 scannedAt: Date;
 status: 'safe' | 'warning' | 'danger';
 vulnerabilities: Array<{
 severity: 'low' | 'medium' | 'high' | 'critical';
 type: string;
 description: string;
 location: string;
 recommendation: string;
 }>;
}

// Editor types
export interface EditorFile {
 path: string;
 content: string;
 language?: string;
 readOnly?: boolean;
}

export interface EditorState {
 files: EditorFile[];
 activeFile?: string;
 unsavedChanges: Set<string>;
}

// Action builder types
export interface CustomAction {
 id: string;
 name: string;
 description: string;
 category: string;
 schema: {
 input: Record<string, TemplateParameter>;
 output?: Record<string, TemplateParameter>;
 };
 implementation: string;
 examples: Array<{
 name: string;
 input: Record<string, any>;
 output?: Record<string, any>;
 }>;
}

// Template inheritance
export interface TemplateExtension {
 extends: string;
 overrides?: {
 metadata?: Partial<TemplateMetadata>;
 parameters?: Array<{
 path: string;
 value: TemplateParameter;
 }>;
 steps?: Array<{
 position: 'before' | 'after' | 'replace';
 target?: string;
 steps: TemplateStep[];
 }>;
 };
}