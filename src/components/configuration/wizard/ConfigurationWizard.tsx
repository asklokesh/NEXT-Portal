'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  AlertTriangle,
  Clock,
  BookOpen,
  Save,
  Eye,
  Settings
} from 'lucide-react';

import type { 
  ConfigurationSchema, 
  WizardStep, 
  WizardConfiguration,
  ConfigurationTemplate,
  ConditionalLogic
} from '../types/schema';
import { SchemaToFormEngine } from '../engine/SchemaToFormEngine';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfigurationWizardProps {
  schema: ConfigurationSchema;
  wizardConfig: WizardConfiguration;
  templates?: ConfigurationTemplate[];
  initialValues?: Record<string, any>;
  onComplete?: (values: Record<string, any>) => void | Promise<void>;
  onSave?: (values: Record<string, any>, step?: number) => void | Promise<void>;
  onCancel?: () => void;
  allowSkipSteps?: boolean;
  showPreview?: boolean;
  className?: string;
}

interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

// Evaluate conditional logic for step visibility
function evaluateStepCondition(
  condition: ConditionalLogic | undefined,
  formValues: Record<string, any>
): boolean {
  if (!condition) return true;

  const fieldValue = formValues[condition.field];
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      return Array.isArray(fieldValue) 
        ? fieldValue.includes(conditionValue)
        : String(fieldValue).includes(String(conditionValue));
    case 'not_contains':
      return Array.isArray(fieldValue)
        ? !fieldValue.includes(conditionValue)
        : !String(fieldValue).includes(String(conditionValue));
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    case 'is_empty':
      return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    default:
      return true;
  }
}

// Step component
interface WizardStepComponentProps {
  step: WizardStep;
  schema: ConfigurationSchema;
  isActive: boolean;
  isCompleted: boolean;
  canAccess: boolean;
  onStepClick: (stepId: string) => void;
}

const WizardStepComponent: React.FC<WizardStepComponentProps> = ({
  step,
  schema,
  isActive,
  isCompleted,
  canAccess,
  onStepClick
}) => {
  return (
    <button
      onClick={() => canAccess && onStepClick(step.id)}
      disabled={!canAccess}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all duration-200',
        isActive && 'border-primary bg-primary/5 shadow-sm',
        isCompleted && 'border-green-500 bg-green-50',
        !canAccess && 'opacity-50 cursor-not-allowed',
        canAccess && !isActive && 'hover:border-muted-foreground hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Step status indicator */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
          isCompleted && 'bg-green-500 text-white',
          isActive && !isCompleted && 'bg-primary text-primary-foreground',
          !isActive && !isCompleted && canAccess && 'bg-muted text-muted-foreground',
          !canAccess && 'bg-muted text-muted-foreground'
        )}>
          {isCompleted ? (
            <Check className="w-4 h-4" />
          ) : (
            <span>{step.id}</span>
          )}
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{step.title}</h3>
            {step.optional && (
              <Badge variant="secondary" className="text-xs">Optional</Badge>
            )}
            {step.estimatedTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {step.estimatedTime}m
              </div>
            )}
          </div>
          
          {step.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {step.description}
            </p>
          )}
        </div>

        {/* Step icon */}
        {step.icon && (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 opacity-60">
              {/* Icon would be rendered here based on step.icon */}
              <Settings className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

// Template selection component
interface TemplateSelectionProps {
  templates: ConfigurationTemplate[];
  onSelect: (template: ConfigurationTemplate) => void;
  onSkip: () => void;
}

const TemplateSelection: React.FC<TemplateSelectionProps> = ({
  templates,
  onSelect,
  onSkip
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigurationTemplate | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Choose a Starting Template</h2>
        <p className="text-muted-foreground">
          Select a pre-configured template to get started quickly, or start from scratch.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-md',
              selectedTemplate?.id === template.id && 'ring-2 ring-primary border-primary'
            )}
            onClick={() => setSelectedTemplate(template)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                {template.icon && <span className="text-lg">{template.icon}</span>}
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.featured && (
                  <Badge variant="secondary">Featured</Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{template.category}</span>
                <span>v{template.version}</span>
              </div>
              
              {template.tags && template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4 justify-center pt-4">
        <Button
          variant="outline"
          onClick={onSkip}
        >
          Start from Scratch
        </Button>
        
        <Button
          onClick={() => selectedTemplate && onSelect(selectedTemplate)}
          disabled={!selectedTemplate}
        >
          Use Template
        </Button>
      </div>
    </div>
  );
};

export const ConfigurationWizard: React.FC<ConfigurationWizardProps> = ({
  schema,
  wizardConfig,
  templates = [],
  initialValues = {},
  onComplete,
  onSave,
  onCancel,
  allowSkipSteps = true,
  showPreview = true,
  className = ''
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepValidations, setStepValidations] = useState<Record<string, StepValidationResult>>({});
  const [showTemplateSelection, setShowTemplateSelection] = useState(templates.length > 0);
  const [previewMode, setPreviewMode] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  // Form methods
  const methods = useForm({
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const { watch, handleSubmit, trigger, formState: { isDirty } } = methods;
  const formValues = watch();

  // Get visible steps based on conditional logic
  const visibleSteps = useMemo(() => {
    return wizardConfig.steps.filter(step => 
      evaluateStepCondition(step.condition, formValues)
    );
  }, [wizardConfig.steps, formValues]);

  const currentStep = visibleSteps[currentStepIndex];
  
  // Calculate progress
  const progress = useMemo(() => {
    const totalSteps = visibleSteps.length;
    const completed = visibleSteps.filter(step => completedSteps.has(step.id)).length;
    return totalSteps > 0 ? (completed / totalSteps) * 100 : 0;
  }, [visibleSteps, completedSteps]);

  // Validate current step
  const validateCurrentStep = useCallback(async () => {
    if (!currentStep) return { isValid: true, errors: [], warnings: [], canProceed: true };

    const fieldsToValidate = currentStep.fields;
    const isValid = await trigger(fieldsToValidate);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    fieldsToValidate.forEach(fieldName => {
      const fieldValue = formValues[fieldName];
      if (!fieldValue && schema.required?.includes(fieldName)) {
        errors.push(`${fieldName} is required`);
      }
    });

    const canProceed = currentStep.validation === 'none' || 
                      (currentStep.validation === 'warnings' && errors.length === 0) ||
                      isValid;

    const result: StepValidationResult = {
      isValid,
      errors,
      warnings,
      canProceed,
    };

    setStepValidations(prev => ({
      ...prev,
      [currentStep.id]: result,
    }));

    return result;
  }, [currentStep, trigger, formValues, schema.required]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: ConfigurationTemplate) => {
    methods.reset(template.defaultValues);
    setShowTemplateSelection(false);
  }, [methods]);

  // Navigation functions
  const canGoNext = useMemo(() => {
    if (!currentStep) return false;
    const validation = stepValidations[currentStep.id];
    return validation ? validation.canProceed : true;
  }, [currentStep, stepValidations]);

  const canGoBack = useMemo(() => {
    return currentStepIndex > 0 && wizardConfig.navigation.allowBack;
  }, [currentStepIndex, wizardConfig.navigation.allowBack]);

  const handleNext = useCallback(async () => {
    const validation = await validateCurrentStep();
    
    if (validation.canProceed) {
      if (currentStep) {
        setCompletedSteps(prev => new Set(prev).add(currentStep.id));
        
        // Auto-save progress
        await onSave?.(formValues, currentStepIndex);
      }
      
      if (currentStepIndex < visibleSteps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    }
  }, [validateCurrentStep, currentStep, currentStepIndex, visibleSteps.length, onSave, formValues]);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [canGoBack, currentStepIndex]);

  const handleStepClick = useCallback((stepId: string) => {
    const stepIndex = visibleSteps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex);
    }
  }, [visibleSteps]);

  const handleComplete = useCallback(async () => {
    const validation = await validateCurrentStep();
    
    if (validation.canProceed) {
      const allValues = methods.getValues();
      await onComplete?.(allValues);
    }
  }, [validateCurrentStep, methods, onComplete]);

  const handleExit = useCallback(() => {
    if (isDirty && wizardConfig.navigation.confirmExit) {
      setExitConfirmOpen(true);
    } else {
      onCancel?.();
    }
  }, [isDirty, wizardConfig.navigation.confirmExit, onCancel]);

  // Auto-validate current step on change
  useEffect(() => {
    if (currentStep) {
      validateCurrentStep();
    }
  }, [currentStep, formValues, validateCurrentStep]);

  // Template selection screen
  if (showTemplateSelection) {
    return (
      <div className={cn('configuration-wizard', className)}>
        <TemplateSelection
          templates={templates}
          onSelect={handleTemplateSelect}
          onSkip={() => setShowTemplateSelection(false)}
        />
      </div>
    );
  }

  // Main wizard interface
  return (
    <FormProvider {...methods}>
      <div className={cn('configuration-wizard h-full flex flex-col', className)}>
        {/* Header */}
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Configuration Wizard</h1>
            
            <div className="flex items-center gap-2">
              {showPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {previewMode ? 'Edit' : 'Preview'}
                </Button>
              )}
              
              <Button variant="outline" size="sm" onClick={handleExit}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Breadcrumbs */}
          {wizardConfig.layout.breadcrumbs && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              {visibleSteps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => handleStepClick(step.id)}
                    className={cn(
                      'hover:text-foreground transition-colors',
                      index === currentStepIndex && 'text-foreground font-medium',
                      completedSteps.has(step.id) && 'text-green-600'
                    )}
                  >
                    {step.name}
                  </button>
                  {index < visibleSteps.length - 1 && (
                    <span>/</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          {wizardConfig.layout.sidebar && (
            <div className="w-80 border-r border-border p-4 overflow-auto">
              <div className="space-y-2">
                {visibleSteps.map((step, index) => (
                  <WizardStepComponent
                    key={step.id}
                    step={step}
                    schema={schema}
                    isActive={index === currentStepIndex}
                    isCompleted={completedSteps.has(step.id)}
                    canAccess={true} // Could implement access logic here
                    onStepClick={handleStepClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {currentStep && (
              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Step header */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-semibold">{currentStep.title}</h2>
                        {currentStep.optional && (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </div>
                      {currentStep.description && (
                        <p className="text-muted-foreground">{currentStep.description}</p>
                      )}
                    </div>

                    {/* Help content */}
                    {currentStep.helpContent && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="w-4 h-4" />
                            Help & Tips
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: currentStep.helpContent }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Step form */}
                    <div className="space-y-6">
                      <SchemaToFormEngine
                        schema={{
                          ...schema,
                          properties: currentStep.fields.reduce((props, fieldName) => {
                            if (schema.properties?.[fieldName]) {
                              props[fieldName] = schema.properties[fieldName];
                            }
                            return props;
                          }, {} as Record<string, any>),
                        }}
                        mode="wizard"
                        readonly={previewMode}
                      />
                    </div>

                    {/* Validation feedback */}
                    {stepValidations[currentStep.id] && (
                      <div className="space-y-2">
                        {stepValidations[currentStep.id].errors.map((error, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                          </div>
                        ))}
                        {stepValidations[currentStep.id].warnings.map((warning, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-yellow-600">
                            <AlertTriangle className="w-4 h-4" />
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {canGoBack && (
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => onSave?.(formValues, currentStepIndex)}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Progress
              </Button>

              {currentStepIndex < visibleSteps.length - 1 ? (
                <Button onClick={handleNext} disabled={!canGoNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={!canGoNext}>
                  <Check className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Exit confirmation dialog */}
        <Dialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Exit</DialogTitle>
              <DialogDescription>
                You have unsaved changes. Are you sure you want to exit the wizard?
                All progress will be lost.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center gap-4 justify-end">
              <Button variant="outline" onClick={() => setExitConfirmOpen(false)}>
                Continue Editing
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  setExitConfirmOpen(false);
                  onCancel?.();
                }}
              >
                Exit Without Saving
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </FormProvider>
  );
};

export default ConfigurationWizard;