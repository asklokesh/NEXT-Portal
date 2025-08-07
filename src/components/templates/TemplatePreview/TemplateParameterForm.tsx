'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Info,
 AlertCircle,
 HelpCircle,
 ChevronDown,
 ChevronRight,
 Check,
 X,
 Plus,
 Trash2
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { 
 TemplateParameters, 
 TemplateParameterProperty 
} from '@/services/backstage/types/templates';

interface TemplateParameterFormProps {
 parameters: TemplateParameters | TemplateParameters[];
 values: Record<string, any>;
 onChange: (values: Record<string, any>) => void;
 errors?: Record<string, string>;
 className?: string;
}

interface FieldProps {
 name: string;
 property: TemplateParameterProperty;
 value: any;
 onChange: (value: any) => void;
 error?: string;
 required?: boolean;
}

// Individual field component
const ParameterField: React.FC<FieldProps> = ({
 name,
 property,
 value,
 onChange,
 error,
 required,
}) => {
 const [showHelp, setShowHelp] = useState(false);

 // Handle different field types
 const renderField = () => {
 // Custom UI fields
 if (property['ui:field']) {
 switch (property['ui:field']) {
 case 'EntityPicker':
 return (
 <select
 value={value || ''}
 onChange={(e) => onChange(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="">Select an entity...</option>
 <option value="user:default/guest">Guest User</option>
 <option value="group:default/platform">Platform Team</option>
 <option value="group:default/frontend">Frontend Team</option>
 </select>
 );
 
 case 'OwnerPicker':
 return (
 <select
 value={value || ''}
 onChange={(e) => onChange(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="">Select owner...</option>
 <option value="group:default/platform">Platform Team</option>
 <option value="group:default/backend">Backend Team</option>
 <option value="group:default/frontend">Frontend Team</option>
 </select>
 );

 case 'RepoUrlPicker':
 return (
 <div className="space-y-2">
 <select
 value={value?.host || 'github.com'}
 onChange={(e) => onChange({ ...value, host: e.target.value })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="github.com">GitHub</option>
 <option value="gitlab.com">GitLab</option>
 <option value="bitbucket.org">Bitbucket</option>
 </select>
 <input
 type="text"
 value={value?.owner || ''}
 onChange={(e) => onChange({ ...value, owner: e.target.value })}
 placeholder="Organization/Owner"
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 <input
 type="text"
 value={value?.repo || ''}
 onChange={(e) => onChange({ ...value, repo: e.target.value })}
 placeholder="Repository name"
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>
 );
 }
 }

 // Standard field types
 switch (property.type) {
 case 'string':
 if (property.enum) {
 return (
 <select
 value={value || ''}
 onChange={(e) => onChange(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="">Select...</option>
 {property.enum.map((option: any) => (
 <option key={option} value={option}>
 {option}
 </option>
 ))}
 </select>
 );
 }

 if (property['ui:widget'] === 'textarea') {
 return (
 <textarea
 value={value || ''}
 onChange={(e) => onChange(e.target.value)}
 placeholder={property['ui:placeholder'] || property.description}
 rows={4}
 className="w-full px-3 py-2 rounded-md border border-input bg-background resize-none"
 />
 );
 }

 return (
 <input
 type={property.format === 'password' ? 'password' : 'text'}
 value={value || ''}
 onChange={(e) => onChange(e.target.value)}
 placeholder={property['ui:placeholder'] || property.description}
 pattern={property.pattern}
 minLength={property.minLength}
 maxLength={property.maxLength}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 );

 case 'number':
 case 'integer':
 return (
 <input
 type="number"
 value={value || ''}
 onChange={(e) => onChange(e.target.valueAsNumber)}
 placeholder={property.description}
 min={property.minimum}
 max={property.maximum}
 step={property.type === 'integer' ? 1 : 'any'}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 );

 case 'boolean':
 return (
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={value || false}
 onChange={(e) => onChange(e.target.checked)}
 className="w-4 h-4 rounded border-input"
 />
 <span className="text-sm">{property.description || 'Enable'}</span>
 </label>
 );

 case 'array':
 return (
 <ArrayField
 value={value || []}
 onChange={onChange}
 itemSchema={property.items}
 />
 );

 case 'object':
 return (
 <ObjectField
 value={value || {}}
 onChange={onChange}
 properties={property.properties || {}}
 required={property.required || []}
 />
 );

 default:
 return (
 <div className="text-sm text-muted-foreground">
 Unsupported field type: {property.type}
 </div>
 );
 }
 };

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <label className="flex items-center gap-2 text-sm font-medium">
 {property.title}
 {required && <span className="text-destructive">*</span>}
 {property['ui:help'] && (
 <button
 type="button"
 onClick={() => setShowHelp(!showHelp)}
 className="text-muted-foreground hover:text-foreground"
 >
 <HelpCircle className="w-4 h-4" />
 </button>
 )}
 </label>
 </div>

 {showHelp && property['ui:help'] && (
 <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm">
 <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
 <span>{property['ui:help']}</span>
 </div>
 )}

 {renderField()}

 {error && (
 <div className="flex items-center gap-2 text-sm text-destructive">
 <AlertCircle className="w-4 h-4" />
 <span>{error}</span>
 </div>
 )}
 </div>
 );
};

// Array field component
const ArrayField: React.FC<{
 value: any[];
 onChange: (value: any[]) => void;
 itemSchema?: TemplateParameterProperty;
}> = ({ value, onChange, itemSchema }) => {
 const handleAdd = () => {
 const newValue = itemSchema?.type === 'string' ? '' : 
 itemSchema?.type === 'number' ? 0 : 
 itemSchema?.type === 'boolean' ? false : {};
 onChange([...value, newValue]);
 };

 const handleRemove = (index: number) => {
 onChange(value.filter((_, i) => i !== index));
 };

 const handleItemChange = (index: number, newValue: any) => {
 const updated = [...value];
 updated[index] = newValue;
 onChange(updated);
 };

 return (
 <div className="space-y-2">
 {value.map((item, index) => (
 <div key={index} className="flex items-center gap-2">
 <input
 type="text"
 value={item}
 onChange={(e) => handleItemChange(index, e.target.value)}
 className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
 />
 <button
 type="button"
 onClick={() => handleRemove(index)}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 <button
 type="button"
 onClick={handleAdd}
 className="flex items-center gap-2 px-3 py-1 rounded-md border border-input hover:bg-accent hover:text-accent-foreground text-sm"
 >
 <Plus className="w-4 h-4" />
 Add Item
 </button>
 </div>
 );
};

// Object field component
const ObjectField: React.FC<{
 value: Record<string, any>;
 onChange: (value: Record<string, any>) => void;
 properties: Record<string, TemplateParameterProperty>;
 required: string[];
}> = ({ value, onChange, properties, required }) => {
 const [expanded, setExpanded] = useState(true);

 return (
 <div className="space-y-2">
 <button
 type="button"
 onClick={() => setExpanded(!expanded)}
 className="flex items-center gap-2 text-sm font-medium"
 >
 {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 Properties
 </button>
 
 {expanded && (
 <div className="pl-6 space-y-4 border-l-2 border-border">
 {Object.entries(properties).map(([key, prop]) => (
 <ParameterField
 key={key}
 name={key}
 property={prop}
 value={value[key]}
 onChange={(newValue) => onChange({ ...value, [key]: newValue })}
 required={required.includes(key)}
 />
 ))}
 </div>
 )}
 </div>
 );
};

// Main form component
export const TemplateParameterForm: React.FC<TemplateParameterFormProps> = ({
 parameters,
 values,
 onChange,
 errors = {},
 className,
}) => {
 const [currentStep, setCurrentStep] = useState(0);
 const [stepValues, setStepValues] = useState<Record<string, any>>(values);

 // Handle multi-step forms
 const parameterSteps = Array.isArray(parameters) ? parameters : [parameters];
 const currentParams = parameterSteps[currentStep];

 // Validate current step
 const validateStep = (): boolean => {
 if (!currentParams.required) return true;

 for (const field of currentParams.required) {
 if (!stepValues[field]) {
 return false;
 }
 }
 return true;
 };

 const handleFieldChange = (name: string, value: any) => {
 const newValues = { ...stepValues, [name]: value };
 setStepValues(newValues);
 onChange(newValues);
 };

 const handleNext = () => {
 if (currentStep < parameterSteps.length - 1) {
 setCurrentStep(currentStep + 1);
 }
 };

 const handlePrevious = () => {
 if (currentStep > 0) {
 setCurrentStep(currentStep - 1);
 }
 };

 const isLastStep = currentStep === parameterSteps.length - 1;
 const canProceed = validateStep();

 return (
 <div className={cn('space-y-6', className)}>
 {/* Step indicator */}
 {parameterSteps.length > 1 && (
 <div className="flex items-center justify-between mb-6">
 {parameterSteps.map((step, index) => (
 <React.Fragment key={index}>
 <div className="flex items-center gap-2">
 <div className={cn(
 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
 index === currentStep ? 'bg-primary text-primary-foreground' :
 index < currentStep ? 'bg-green-600 text-white' :
 'bg-muted text-muted-foreground'
 )}>
 {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
 </div>
 <span className={cn(
 'text-sm font-medium',
 index === currentStep ? 'text-foreground' : 'text-muted-foreground'
 )}>
 {step.title || `Step ${index + 1}`}
 </span>
 </div>
 {index < parameterSteps.length - 1 && (
 <div className={cn(
 'flex-1 h-0.5 mx-4',
 index < currentStep ? 'bg-green-600' : 'bg-muted'
 )} />
 )}
 </React.Fragment>
 ))}
 </div>
 )}

 {/* Current step header */}
 {currentParams.title && (
 <div>
 <h3 className="text-lg font-semibold">{currentParams.title}</h3>
 {currentParams.description && (
 <p className="text-sm text-muted-foreground mt-1">
 {currentParams.description}
 </p>
 )}
 </div>
 )}

 {/* Form fields */}
 <div className="space-y-4">
 {Object.entries(currentParams.properties).map(([name, property]) => (
 <ParameterField
 key={name}
 name={name}
 property={property}
 value={stepValues[name]}
 onChange={(value) => handleFieldChange(name, value)}
 error={errors[name]}
 required={currentParams.required?.includes(name)}
 />
 ))}
 </div>

 {/* Navigation */}
 {parameterSteps.length > 1 && (
 <div className="flex items-center justify-between pt-4 border-t">
 <button
 type="button"
 onClick={handlePrevious}
 disabled={currentStep === 0}
 className={cn(
 'px-4 py-2 rounded-md',
 currentStep === 0 
 ? 'opacity-50 cursor-not-allowed text-muted-foreground' 
 : 'hover:bg-accent hover:text-accent-foreground'
 )}
 >
 Previous
 </button>
 
 <span className="text-sm text-muted-foreground">
 Step {currentStep + 1} of {parameterSteps.length}
 </span>

 <button
 type="button"
 onClick={handleNext}
 disabled={!canProceed || isLastStep}
 className={cn(
 'px-4 py-2 rounded-md',
 !canProceed || isLastStep
 ? 'opacity-50 cursor-not-allowed text-muted-foreground'
 : 'bg-primary text-primary-foreground hover:bg-primary/90'
 )}
 >
 Next
 </button>
 </div>
 )}
 </div>
 );
};