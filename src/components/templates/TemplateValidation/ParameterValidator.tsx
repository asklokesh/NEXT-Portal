'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 CheckCircle,
 XCircle,
 AlertTriangle,
 Info,
 Eye,
 EyeOff,
 RefreshCw,
 Zap,
 Shield,
 Globe
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { 
 TemplateParameters, 
 TemplateParameterProperty 
} from '@/services/backstage/types/templates';

interface ValidationRule {
 name: string;
 validate: (value: any, allValues: Record<string, any>) => Promise<ValidationResult> | ValidationResult;
 severity: 'error' | 'warning' | 'info';
 description: string;
}

interface ValidationResult {
 valid: boolean;
 message?: string;
 suggestions?: string[];
}

interface FieldValidationState {
 isValidating: boolean;
 results: Array<ValidationResult & { rule: string; severity: 'error' | 'warning' | 'info' }>;
 lastValidated?: string;
}

interface ParameterValidatorProps {
 parameters: TemplateParameters | TemplateParameters[];
 values: Record<string, any>;
 onChange: (field: string, value: any) => void;
 onValidationChange: (isValid: boolean, errors: Record<string, string[]>) => void;
 className?: string;
}

// Built-in validation rules
const VALIDATION_RULES: Record<string, ValidationRule[]> = {
 name: [
 {
 name: 'required',
 validate: (value) => ({
 valid: Boolean(value && value.trim()),
 message: value ? undefined : 'Name is required',
 }),
 severity: 'error',
 description: 'Field must have a value',
 },
 {
 name: 'format',
 validate: (value) => {
 if (!value) return { valid: true };
 const isValid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value);
 return {
 valid: isValid,
 message: isValid ? undefined : 'Name must be lowercase alphanumeric with hyphens',
 suggestions: isValid ? undefined : [
 'Use only lowercase letters, numbers, and hyphens',
 'Start and end with alphanumeric characters',
 'Example: my-service-name',
 ],
 };
 },
 severity: 'error',
 description: 'Must follow naming conventions',
 },
 {
 name: 'uniqueness',
 validate: async (value) => {
 if (!value) return { valid: true };
 
 // Simulate API check for uniqueness
 await new Promise(resolve => setTimeout(resolve, 500));
 const isUnique = !['existing-service', 'test-service'].includes(value.toLowerCase());
 
 return {
 valid: isUnique,
 message: isUnique ? 'Name is available' : 'This name is already taken',
 suggestions: isUnique ? undefined : [
 `Try ${value}-v2`,
 `Try ${value}-new`,
 `Try my-${value}`,
 ],
 };
 },
 severity: 'error',
 description: 'Checks if the name is already in use',
 },
 {
 name: 'length',
 validate: (value) => {
 if (!value) return { valid: true };
 const isValid = value.length >= 3 && value.length <= 63;
 return {
 valid: isValid,
 message: isValid ? undefined : `Name must be 3-63 characters (currently ${value.length})`,
 };
 },
 severity: 'warning',
 description: 'Recommended length constraints',
 },
 ],
 description: [
 {
 name: 'required',
 validate: (value) => ({
 valid: Boolean(value && value.trim()),
 message: value ? undefined : 'Description is required',
 }),
 severity: 'error',
 description: 'Field must have a value',
 },
 {
 name: 'quality',
 validate: (value) => {
 if (!value) return { valid: true };
 const wordCount = value.trim().split(/\s+/).length;
 const hasProperCase = /^[A-Z]/.test(value.trim());
 const endsWithPeriod = value.trim().endsWith('.');
 
 let score = 0;
 const suggestions: string[] = [];
 
 if (wordCount >= 5) score += 1;
 else suggestions.push('Consider adding more detail (aim for 5+ words)');
 
 if (hasProperCase) score += 1;
 else suggestions.push('Start with a capital letter');
 
 if (endsWithPeriod) score += 1;
 else suggestions.push('End with a period');
 
 return {
 valid: score >= 2,
 message: score === 3 ? 'Good description quality' : 'Description could be improved',
 suggestions: suggestions.length > 0 ? suggestions : undefined,
 };
 },
 severity: 'info',
 description: 'Suggests improvements for description quality',
 },
 ],
 repoUrl: [
 {
 name: 'format',
 validate: (value) => {
 if (!value || typeof value !== 'object') return { valid: true };
 
 const { host, owner, repo } = value;
 const errors: string[] = [];
 
 if (!host) errors.push('Repository host is required');
 if (!owner) errors.push('Repository owner is required');
 if (!repo) errors.push('Repository name is required');
 
 if (repo && !/^[a-zA-Z0-9._-]+$/.test(repo)) {
 errors.push('Repository name contains invalid characters');
 }
 
 return {
 valid: errors.length === 0,
 message: errors.length === 0 ? undefined : errors.join(', '),
 };
 },
 severity: 'error',
 description: 'Validates repository URL format',
 },
 {
 name: 'availability',
 validate: async (value) => {
 if (!value || typeof value !== 'object') return { valid: true };
 
 const { host, owner, repo } = value;
 if (!host || !owner || !repo) return { valid: true };
 
 // Simulate API check for repository availability
 await new Promise(resolve => setTimeout(resolve, 800));
 const repoUrl = `${host}/${owner}/${repo}`;
 const isAvailable = !['github.com/octocat/Hello-World'].includes(repoUrl);
 
 return {
 valid: isAvailable,
 message: isAvailable ? 'Repository location is available' : 'Repository already exists',
 suggestions: isAvailable ? undefined : [
 `Try ${repo}-v2`,
 `Try ${repo}-new`,
 'Choose a different repository name',
 ],
 };
 },
 severity: 'warning',
 description: 'Checks if repository already exists',
 },
 ],
 owner: [
 {
 name: 'format',
 validate: (value) => {
 if (!value) return { valid: true };
 const isValid = /^(user|group):[^/]+\/[^/]+$/.test(value);
 return {
 valid: isValid,
 message: isValid ? undefined : 'Owner must be in format "type:namespace/name"',
 suggestions: isValid ? undefined : [
 'Example: user:default/john.doe',
 'Example: group:default/platform-team',
 ],
 };
 },
 severity: 'error',
 description: 'Validates owner entity reference format',
 },
 ],
};

const ValidationIndicator: React.FC<{
 state: FieldValidationState;
 compact?: boolean;
}> = ({ state, compact }) => {
 const { isValidating, results } = state;
 
 if (isValidating) {
 return (
 <div className="flex items-center gap-1 text-blue-600">
 <RefreshCw className="w-3 h-3 animate-spin" />
 {!compact && <span className="text-xs">Validating...</span>}
 </div>
 );
 }
 
 const errors = results.filter(r => !r.valid && r.severity === 'error');
 const warnings = results.filter(r => !r.valid && r.severity === 'warning');
 const infos = results.filter(r => r.severity === 'info');
 
 if (errors.length > 0) {
 return (
 <div className="flex items-center gap-1 text-red-600">
 <XCircle className="w-3 h-3" />
 {!compact && <span className="text-xs">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>}
 </div>
 );
 }
 
 if (warnings.length > 0) {
 return (
 <div className="flex items-center gap-1 text-yellow-600">
 <AlertTriangle className="w-3 h-3" />
 {!compact && <span className="text-xs">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>}
 </div>
 );
 }
 
 if (results.length > 0) {
 return (
 <div className="flex items-center gap-1 text-green-600">
 <CheckCircle className="w-3 h-3" />
 {!compact && <span className="text-xs">Valid</span>}
 </div>
 );
 }
 
 return null;
};

const ValidationMessages: React.FC<{
 results: Array<ValidationResult & { rule: string; severity: 'error' | 'warning' | 'info' }>;
}> = ({ results }) => {
 if (results.length === 0) return null;
 
 return (
 <div className="space-y-2">
 {results.map((result, index) => (
 <div
 key={`${result.rule}-${index}`}
 className={cn(
 'flex items-start gap-2 p-2 rounded text-sm',
 result.severity === 'error' && 'bg-red-50 text-red-700',
 result.severity === 'warning' && 'bg-yellow-50 text-yellow-700',
 result.severity === 'info' && 'bg-blue-50 text-blue-700'
 )}
 >
 {result.severity === 'error' && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
 {result.severity === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
 {result.severity === 'info' && <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
 
 <div className="flex-1">
 {result.message && <p>{result.message}</p>}
 {result.suggestions && result.suggestions.length > 0 && (
 <ul className="mt-1 space-y-0.5 text-xs opacity-75">
 {result.suggestions.map((suggestion, i) => (
 <li key={i}>• {suggestion}</li>
 ))}
 </ul>
 )}
 </div>
 </div>
 ))}
 </div>
 );
};

export const ParameterValidator: React.FC<ParameterValidatorProps> = ({
 parameters,
 values,
 onChange,
 onValidationChange,
 className,
}) => {
 const [validationStates, setValidationStates] = useState<Record<string, FieldValidationState>>({});
 const [showValidation, setShowValidation] = useState(true);
 
 const parameterSteps = Array.isArray(parameters) ? parameters : [parameters];
 
 // Get all field names
 const allFieldNames = useMemo(() => {
 const fields: string[] = [];
 parameterSteps.forEach(step => {
 Object.keys(step.properties).forEach(key => {
 if (!fields.includes(key)) {
 fields.push(key);
 }
 });
 });
 return fields;
 }, [parameterSteps]);
 
 // Validate a specific field
 const validateField = async (fieldName: string, value: any) => {
 const rules = VALIDATION_RULES[fieldName] || [];
 if (rules.length === 0) return;
 
 setValidationStates(prev => ({
 ...prev,
 [fieldName]: {
 ...prev[fieldName],
 isValidating: true,
 },
 }));
 
 const results = await Promise.all(
 rules.map(async rule => {
 try {
 const result = await rule.validate(value, values);
 return {
 ...result,
 rule: rule.name,
 severity: rule.severity,
 };
 } catch (error) {
 return {
 valid: false,
 message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
 rule: rule.name,
 severity: rule.severity,
 };
 }
 })
 );
 
 setValidationStates(prev => ({
 ...prev,
 [fieldName]: {
 isValidating: false,
 results,
 lastValidated: new Date().toISOString(),
 },
 }));
 };
 
 // Validate all fields
 const validateAllFields = async () => {
 const validationPromises = allFieldNames.map(fieldName => 
 validateField(fieldName, values[fieldName])
 );
 await Promise.all(validationPromises);
 };
 
 // Update validation state when values change
 useEffect(() => {
 const timeouts: Record<string, NodeJS.Timeout> = {};
 
 allFieldNames.forEach(fieldName => {
 // Debounce validation
 timeouts[fieldName] = setTimeout(() => {
 validateField(fieldName, values[fieldName]);
 }, 500);
 });
 
 return () => {
 Object.values(timeouts).forEach(clearTimeout);
 };
 }, [values, allFieldNames]);
 
 // Notify parent of validation state
 useEffect(() => {
 const errors: Record<string, string[]> = {};
 let hasErrors = false;
 
 Object.entries(validationStates).forEach(([fieldName, state]) => {
 const fieldErrors = state.results
 .filter(r => !r.valid && r.severity === 'error')
 .map(r => r.message)
 .filter(Boolean) as string[];
 
 if (fieldErrors.length > 0) {
 errors[fieldName] = fieldErrors;
 hasErrors = true;
 }
 });
 
 onValidationChange(!hasErrors, errors);
 }, [validationStates, onValidationChange]);
 
 // Get validation summary
 const validationSummary = useMemo(() => {
 const allResults = Object.values(validationStates).flatMap(state => state.results);
 const errors = allResults.filter(r => !r.valid && r.severity === 'error').length;
 const warnings = allResults.filter(r => !r.valid && r.severity === 'warning').length;
 const infos = allResults.filter(r => r.severity === 'info').length;
 
 return { errors, warnings, infos };
 }, [validationStates]);
 
 return (
 <div className={cn('space-y-4', className)}>
 {/* Validation summary */}
 <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1">
 <Shield className="w-4 h-4 text-primary" />
 <span className="font-medium text-sm">Parameter Validation</span>
 </div>
 
 <div className="flex items-center gap-3 text-xs">
 {validationSummary.errors > 0 && (
 <span className="flex items-center gap-1 text-red-600">
 <XCircle className="w-3 h-3" />
 {validationSummary.errors} error{validationSummary.errors !== 1 ? 's' : ''}
 </span>
 )}
 {validationSummary.warnings > 0 && (
 <span className="flex items-center gap-1 text-yellow-600">
 <AlertTriangle className="w-3 h-3" />
 {validationSummary.warnings} warning{validationSummary.warnings !== 1 ? 's' : ''}
 </span>
 )}
 {validationSummary.infos > 0 && (
 <span className="flex items-center gap-1 text-blue-600">
 <Info className="w-3 h-3" />
 {validationSummary.infos} suggestion{validationSummary.infos !== 1 ? 's' : ''}
 </span>
 )}
 {validationSummary.errors === 0 && validationSummary.warnings === 0 && (
 <span className="flex items-center gap-1 text-green-600">
 <CheckCircle className="w-3 h-3" />
 All validations passed
 </span>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={validateAllFields}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors"
 >
 <Zap className="w-3 h-3" />
 Validate All
 </button>
 
 <button
 onClick={() => setShowValidation(!showValidation)}
 className="p-1 rounded hover:bg-accent transition-colors"
 >
 {showValidation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
 </button>
 </div>
 </div>
 
 {/* Field validation details */}
 {showValidation && (
 <div className="space-y-4">
 {allFieldNames.map(fieldName => {
 const state = validationStates[fieldName];
 if (!state || state.results.length === 0) return null;
 
 const fieldSchema = parameterSteps.find(step => step.properties[fieldName])?.properties[fieldName];
 const fieldTitle = fieldSchema?.title || fieldName;
 
 return (
 <div key={fieldName} className="bg-card rounded-lg border p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="font-medium">{fieldTitle}</span>
 <ValidationIndicator state={state} />
 </div>
 
 {state.lastValidated && (
 <span className="text-xs text-muted-foreground">
 Last checked: {new Date(state.lastValidated).toLocaleTimeString()}
 </span>
 )}
 </div>
 
 <ValidationMessages results={state.results} />
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
};