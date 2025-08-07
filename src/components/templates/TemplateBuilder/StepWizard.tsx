'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 ChevronRight, 
 ChevronLeft, 
 Check, 
 AlertCircle,
 Save,
 Eye,
 Play,
 FileCode,
 Settings,
 GitBranch,
 Shield,
 BarChart3
} from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { FileEditor } from './FileEditor';
import { ParameterBuilder } from './ParameterBuilder';
import { LivePreview } from '../TemplatePreview/LivePreview';

import type { Template, WizardStep, ValidationResult, EditorFile } from '../types';

interface StepWizardProps {
 template: Partial<Template>;
 onTemplateChange: (template: Partial<Template>) => void;
 onSave?: () => Promise<void>;
 onPreview?: () => void;
 onTest?: () => void;
 className?: string;
}

interface StepIndicatorProps {
 steps: WizardStep[];
 currentStep: number;
 onStepClick: (index: number) => void;
}

// Step indicator component
const StepIndicator: React.FC<StepIndicatorProps> = ({ 
 steps, 
 currentStep, 
 onStepClick 
}) => {
 return (
 <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
 {steps.map((step, index) => {
 const isActive = index === currentStep;
 const isComplete = step.isComplete || index < currentStep;
 const isClickable = isComplete || index <= currentStep;

 return (
 <React.Fragment key={step.id}>
 <button
 onClick={() => isClickable && onStepClick(index)}
 disabled={!isClickable}
 className={cn(
 'flex flex-col items-center gap-2 p-2 rounded-lg transition-all',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
 isClickable && 'cursor-pointer hover:bg-accent',
 !isClickable && 'cursor-not-allowed opacity-50'
 )}
 >
 <div className={cn(
 'w-10 h-10 rounded-full flex items-center justify-center',
 'border-2 transition-all duration-200',
 isActive && 'border-primary bg-primary text-primary-foreground',
 isComplete && !isActive && 'border-primary bg-primary/10 text-primary',
 !isComplete && !isActive && 'border-border bg-background text-muted-foreground'
 )}>
 {isComplete && !isActive ? (
 <Check className="w-5 h-5" />
 ) : (
 <span className="text-sm font-semibold">{index + 1}</span>
 )}
 </div>
 
 <span className={cn(
 'text-xs font-medium text-center max-w-[100px]',
 isActive && 'text-foreground',
 !isActive && 'text-muted-foreground'
 )}>
 {step.title}
 </span>
 </button>

 {index < steps.length - 1 && (
 <div className={cn(
 'flex-1 h-0.5 mx-2',
 index < currentStep ? 'bg-primary' : 'bg-border'
 )} />
 )}
 </React.Fragment>
 );
 })}
 </div>
 );
};

// Step content wrapper
const StepContent: React.FC<{
 step: WizardStep;
 isActive: boolean;
}> = ({ step, isActive }) => {
 if (!isActive) return null;

 return (
 <div className="animate-in fade-in slide-in-from-right-4 duration-300">
 {step.description && (
 <div className="mb-6 p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground">{step.description}</p>
 </div>
 )}
 
 <div className="min-h-[400px]">
 {step.component}
 </div>
 </div>
 );
};

// Main step wizard component
export const StepWizard: React.FC<StepWizardProps> = ({
 template,
 onTemplateChange,
 onSave,
 onPreview,
 onTest,
 className,
}) => {
 const [currentStep, setCurrentStep] = useState(0);
 const [validation, setValidation] = useState<Record<string, ValidationResult>>({});
 const [isSaving, setIsSaving] = useState(false);
 const [testParameters, setTestParameters] = useState<Record<string, any>>({});

 // Define wizard steps
 const steps: WizardStep[] = useMemo(() => [
 {
 id: 'metadata',
 title: 'Basic Info',
 description: 'Configure the basic information about your template',
 component: (
 <div className="space-y-6">
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium mb-2">Template Name</label>
 <input
 type="text"
 value={template.metadata?.name || ''}
 onChange={(e) => onTemplateChange({
 ...template,
 metadata: { ...template.metadata, name: e.target.value } as any,
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="my-awesome-template"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium mb-2">Title</label>
 <input
 type="text"
 value={template.metadata?.title || ''}
 onChange={(e) => onTemplateChange({
 ...template,
 metadata: { ...template.metadata, title: e.target.value } as any,
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="My Awesome Template"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Description</label>
 <textarea
 value={template.metadata?.description || ''}
 onChange={(e) => onTemplateChange({
 ...template,
 metadata: { ...template.metadata, description: e.target.value } as any,
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 rows={3}
 placeholder="Describe what this template does..."
 />
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium mb-2">Category</label>
 <select
 value={template.metadata?.category || ''}
 onChange={(e) => onTemplateChange({
 ...template,
 metadata: { ...template.metadata, category: e.target.value } as any,
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 <option value="">Select a category</option>
 <option value="service">Service</option>
 <option value="website">Website</option>
 <option value="library">Library</option>
 <option value="documentation">Documentation</option>
 <option value="infrastructure">Infrastructure</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-2">Tags</label>
 <input
 type="text"
 value={template.metadata?.tags?.join(', ') || ''}
 onChange={(e) => onTemplateChange({
 ...template,
 metadata: { 
 ...template.metadata, 
 tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
 } as any,
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="react, typescript, microservice"
 />
 </div>
 </div>
 </div>
 ),
 isComplete: Boolean(template.metadata?.name && template.metadata?.title),
 },
 {
 id: 'parameters',
 title: 'Parameters',
 description: 'Define the input parameters that users will fill out when using your template',
 component: (
 <ParameterBuilder
 parameters={template.spec?.parameters || []}
 onChange={(parameters) => onTemplateChange({
 ...template,
 spec: { ...template.spec, parameters } as any,
 })}
 />
 ),
 isComplete: Boolean(template.spec?.parameters?.length),
 },
 {
 id: 'files',
 title: 'Template Files',
 description: 'Create and edit the files that will be generated by your template',
 component: (
 <FileEditor
 files={template.spec?.files || []}
 onChange={(files) => onTemplateChange({
 ...template,
 spec: { ...template.spec, files } as any,
 })}
 />
 ),
 isComplete: Boolean(template.spec?.files?.length),
 },
 {
 id: 'actions',
 title: 'Actions',
 description: 'Configure the actions that will be executed when the template runs',
 component: (
 <div className="space-y-4">
 <div className="p-6 rounded-lg border border-dashed border-border text-center">
 <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
 <h4 className="font-medium mb-2">Action Builder</h4>
 <p className="text-sm text-muted-foreground max-w-md mx-auto">
 Configure Git actions, API calls, and other automation steps that run when your template is used
 </p>
 </div>
 </div>
 ),
 isComplete: Boolean(template.spec?.steps?.length),
 },
 {
 id: 'preview',
 title: 'Preview & Test',
 description: 'Preview the template output and test with sample data',
 component: (
 <LivePreview
 template={template}
 parameters={testParameters}
 onParameterChange={setTestParameters}
 />
 ),
 isComplete: false,
 },
 {
 id: 'review',
 title: 'Review & Publish',
 description: 'Review your template and prepare it for publishing',
 component: (
 <div className="space-y-6">
 <div className="p-6 rounded-lg border bg-card">
 <h3 className="font-semibold mb-4">Template Summary</h3>
 <dl className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <dt className="text-muted-foreground">Name</dt>
 <dd className="font-medium">{template.metadata?.name || 'Not set'}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Category</dt>
 <dd className="font-medium capitalize">{template.metadata?.category || 'Not set'}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Parameters</dt>
 <dd className="font-medium">{template.spec?.parameters?.length || 0} configured</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Files</dt>
 <dd className="font-medium">{template.spec?.files?.length || 0} files</dd>
 </div>
 </dl>
 </div>

 <div className="p-6 rounded-lg border bg-card">
 <h3 className="font-semibold mb-4">Publishing Options</h3>
 <div className="space-y-4">
 <label className="flex items-center gap-3">
 <input type="checkbox" className="rounded border-input" />
 <div>
 <p className="font-medium">Make template public</p>
 <p className="text-sm text-muted-foreground">Allow all users in the organization to use this template</p>
 </div>
 </label>
 <label className="flex items-center gap-3">
 <input type="checkbox" className="rounded border-input" />
 <div>
 <p className="font-medium">Enable versioning</p>
 <p className="text-sm text-muted-foreground">Track changes and maintain multiple versions of this template</p>
 </div>
 </label>
 </div>
 </div>
 </div>
 ),
 isComplete: false,
 },
 ], [template, onTemplateChange, testParameters, setTestParameters]);

 // Navigation handlers
 const canGoNext = useCallback(() => {
 const currentStepData = steps[currentStep];
 if (currentStepData.validation) {
 const result = currentStepData.validation();
 setValidation(prev => ({ ...prev, [currentStepData.id]: result }));
 return result.valid;
 }
 return true;
 }, [currentStep, steps]);

 const handleNext = useCallback(() => {
 if (canGoNext() && currentStep < steps.length - 1) {
 setCurrentStep(prev => prev + 1);
 }
 }, [canGoNext, currentStep, steps.length]);

 const handlePrevious = useCallback(() => {
 if (currentStep > 0) {
 setCurrentStep(prev => prev - 1);
 }
 }, [currentStep]);

 const handleStepClick = useCallback((index: number) => {
 if (index <= currentStep || steps[index].isComplete) {
 setCurrentStep(index);
 }
 }, [currentStep, steps]);

 const handleSave = useCallback(async () => {
 if (!onSave) return;
 
 setIsSaving(true);
 try {
 await onSave();
 } finally {
 setIsSaving(false);
 }
 }, [onSave]);

 // Calculate progress
 const progress = useMemo(() => {
 const completedSteps = steps.filter(step => step.isComplete).length;
 return (completedSteps / steps.length) * 100;
 }, [steps]);

 return (
 <div className={cn('flex flex-col h-full', className)}>
 {/* Header */}
 <div className="flex-shrink-0 border-b border-border bg-background">
 <div className="flex items-center justify-between p-4">
 <div>
 <h1 className="text-2xl font-bold">Template Builder</h1>
 <p className="text-sm text-muted-foreground mt-1">
 {template.metadata?.title || 'New Template'}
 </p>
 </div>

 <div className="flex items-center gap-2">
 {onPreview && (
 <button
 onClick={onPreview}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 <Eye className="w-4 h-4" />
 Preview
 </button>
 )}
 
 {onTest && (
 <button
 onClick={onTest}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 <Play className="w-4 h-4" />
 Test
 </button>
 )}
 
 <button
 onClick={handleSave}
 disabled={isSaving}
 className={cn(
 'flex items-center gap-2 px-4 py-2 rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'disabled:opacity-50 transition-colors'
 )}
 >
 <Save className="w-4 h-4" />
 {isSaving ? 'Saving...' : 'Save'}
 </button>
 </div>
 </div>

 {/* Progress bar */}
 <div className="px-4 pb-4">
 <div className="relative h-2 bg-border rounded-full overflow-hidden">
 <div 
 className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 </div>

 {/* Step indicator */}
 <div className="flex-shrink-0 px-8 py-6 bg-muted/50">
 <StepIndicator
 steps={steps}
 currentStep={currentStep}
 onStepClick={handleStepClick}
 />
 </div>

 {/* Step content */}
 <div className="flex-1 overflow-y-auto p-8">
 <div className="max-w-4xl mx-auto">
 {validation[steps[currentStep].id]?.errors.length > 0 && (
 <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
 <div className="flex items-start gap-3">
 <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
 <div className="space-y-1">
 {validation[steps[currentStep].id].errors.map((error, index) => (
 <p key={index} className="text-sm text-destructive">
 {error.message}
 </p>
 ))}
 </div>
 </div>
 </div>
 )}

 {steps.map((step, index) => (
 <StepContent
 key={step.id}
 step={step}
 isActive={index === currentStep}
 />
 ))}
 </div>
 </div>

 {/* Navigation */}
 <div className="flex-shrink-0 border-t border-border bg-background">
 <div className="flex items-center justify-between p-4">
 <button
 onClick={handlePrevious}
 disabled={currentStep === 0}
 className={cn(
 'flex items-center gap-2 px-4 py-2 rounded-md',
 'border border-border hover:bg-accent hover:text-accent-foreground',
 'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
 )}
 >
 <ChevronLeft className="w-4 h-4" />
 Previous
 </button>

 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 Step {currentStep + 1} of {steps.length}
 </div>

 <button
 onClick={handleNext}
 disabled={currentStep === steps.length - 1}
 className={cn(
 'flex items-center gap-2 px-4 py-2 rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
 )}
 >
 Next
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 );
};