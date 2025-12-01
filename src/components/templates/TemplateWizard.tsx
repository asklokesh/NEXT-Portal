'use client';

/**
 * Template Wizard Component
 * Multi-step wizard for executing software templates
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Info,
  Code,
  Eye,
  Play,
  Settings,
  FileText,
  Shield,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  SoftwareTemplate,
  TemplateParameter,
  TemplateStep,
} from '@/services/templates/types';

interface TemplateWizardProps {
  template: SoftwareTemplate;
  onExecute: (parameters: Record<string, unknown>, dryRun?: boolean) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

type WizardStep = 'parameters' | 'review' | 'execute';

interface ParameterValidation {
  isValid: boolean;
  message?: string;
}

export function TemplateWizard({
  template,
  onExecute,
  onCancel,
  className,
}: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('parameters');
  const [parameters, setParameters] = useState<Record<string, unknown>>(() => {
    // Initialize with default values
    const defaults: Record<string, unknown> = {};
    template.parameters.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });
    return defaults;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);

  const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
    { key: 'parameters', label: 'Configure', icon: Settings },
    { key: 'review', label: 'Review', icon: Eye },
    { key: 'execute', label: 'Create', icon: Play },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  // Group parameters by UI group
  const parameterGroups = useMemo(() => {
    const groups: Record<string, TemplateParameter[]> = {};
    template.parameters.forEach((param) => {
      const group = param.ui?.group || 'General';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(param);
    });
    return groups;
  }, [template.parameters]);

  // Validate a single parameter
  const validateParameter = (param: TemplateParameter, value: unknown): ParameterValidation => {
    if (param.required && (value === undefined || value === null || value === '')) {
      return { isValid: false, message: `${param.title} is required` };
    }

    if (value === undefined || value === null || value === '') {
      return { isValid: true };
    }

    if (param.validation) {
      if (param.validation.pattern) {
        const regex = new RegExp(param.validation.pattern);
        if (!regex.test(String(value))) {
          return {
            isValid: false,
            message: param.validation.message || `Invalid format for ${param.title}`,
          };
        }
      }

      if (param.validation.minLength && String(value).length < param.validation.minLength) {
        return {
          isValid: false,
          message: `${param.title} must be at least ${param.validation.minLength} characters`,
        };
      }

      if (param.validation.maxLength && String(value).length > param.validation.maxLength) {
        return {
          isValid: false,
          message: `${param.title} must be at most ${param.validation.maxLength} characters`,
        };
      }

      if (param.validation.min !== undefined && Number(value) < param.validation.min) {
        return {
          isValid: false,
          message: `${param.title} must be at least ${param.validation.min}`,
        };
      }

      if (param.validation.max !== undefined && Number(value) > param.validation.max) {
        return {
          isValid: false,
          message: `${param.title} must be at most ${param.validation.max}`,
        };
      }
    }

    return { isValid: true };
  };

  // Validate all parameters
  const validateAllParameters = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    template.parameters.forEach((param) => {
      const validation = validateParameter(param, parameters[param.name]);
      if (!validation.isValid) {
        newErrors[param.name] = validation.message || 'Invalid value';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleParameterChange = (name: string, value: unknown) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleNext = () => {
    if (currentStep === 'parameters') {
      if (validateAllParameters()) {
        setCurrentStep('review');
      }
    } else if (currentStep === 'review') {
      setCurrentStep('execute');
    }
  };

  const handleBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('parameters');
    } else if (currentStep === 'execute') {
      setCurrentStep('review');
    }
  };

  const handleExecute = async (dryRun: boolean = false) => {
    setIsExecuting(true);
    setIsDryRun(dryRun);
    try {
      await onExecute(parameters, dryRun);
    } finally {
      setIsExecuting(false);
    }
  };

  // Render parameter input based on type
  const renderParameterInput = (param: TemplateParameter) => {
    const value = parameters[param.name];
    const error = errors[param.name];
    const isHidden = param.ui?.hidden;

    if (isHidden) return null;

    const commonClasses = cn(
      'w-full px-3 py-2 rounded-lg border transition-colors',
      'bg-white dark:bg-gray-900',
      'focus:outline-none focus:ring-2 focus:ring-blue-500',
      error
        ? 'border-red-300 dark:border-red-700'
        : 'border-gray-300 dark:border-gray-600'
    );

    const inputElement = (() => {
      switch (param.type) {
        case 'string':
          if (param.enum) {
            return (
              <select
                value={String(value || '')}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                className={commonClasses}
              >
                <option value="">Select {param.title}</option>
                {param.enum.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            );
          }
          if (param.ui?.widget === 'textarea') {
            return (
              <textarea
                value={String(value || '')}
                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                placeholder={param.ui?.placeholder}
                rows={4}
                className={commonClasses}
              />
            );
          }
          return (
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              placeholder={param.ui?.placeholder}
              className={commonClasses}
            />
          );

        case 'number':
          return (
            <input
              type="number"
              value={value !== undefined ? Number(value) : ''}
              onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
              placeholder={param.ui?.placeholder}
              min={param.validation?.min}
              max={param.validation?.max}
              className={commonClasses}
            />
          );

        case 'boolean':
          return (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {param.description}
              </span>
            </label>
          );

        case 'array':
          const arrayValue = Array.isArray(value) ? value : [];
          return (
            <div className="space-y-2">
              {arrayValue.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={String(item)}
                    onChange={(e) => {
                      const newArray = [...arrayValue];
                      newArray[index] = e.target.value;
                      handleParameterChange(param.name, newArray);
                    }}
                    className={cn(commonClasses, 'flex-1')}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newArray = arrayValue.filter((_, i) => i !== index);
                      handleParameterChange(param.name, newArray);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleParameterChange(param.name, [...arrayValue, ''])}
              >
                Add Item
              </Button>
            </div>
          );

        case 'object':
          return (
            <textarea
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : '{}'}
              onChange={(e) => {
                try {
                  handleParameterChange(param.name, JSON.parse(e.target.value));
                } catch {
                  // Keep the string value for editing
                }
              }}
              rows={4}
              className={cn(commonClasses, 'font-mono text-sm')}
            />
          );

        default:
          return (
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              className={commonClasses}
            />
          );
      }
    })();

    return (
      <div key={param.name} className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {param.title}
          {param.required && <span className="text-red-500">*</span>}
          {param.description && param.type !== 'boolean' && (
            <span className="text-gray-400" title={param.description}>
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </label>
        {inputElement}
        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'parameters':
        return (
          <div className="space-y-8">
            {Object.entries(parameterGroups).map(([groupName, params]) => (
              <div key={groupName}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  {groupName}
                </h3>
                <div className="space-y-4">
                  {params.map((param) => renderParameterInput(param))}
                </div>
              </div>
            ))}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Configuration Summary
              </h3>
              <dl className="space-y-2">
                {template.parameters
                  .filter((p) => !p.ui?.hidden && parameters[p.name] !== undefined)
                  .map((param) => (
                    <div key={param.name} className="flex justify-between text-sm">
                      <dt className="text-gray-500 dark:text-gray-400">{param.title}</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">
                        {typeof parameters[param.name] === 'boolean'
                          ? parameters[param.name]
                            ? 'Yes'
                            : 'No'
                          : typeof parameters[param.name] === 'object'
                          ? JSON.stringify(parameters[param.name])
                          : String(parameters[param.name])}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Steps Preview */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Execution Steps
              </h3>
              <div className="space-y-2">
                {template.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {step.name}
                      </p>
                      {step.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {step.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <Code className="h-3 w-3" />
                        {step.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Golden Path Info */}
            {template.goldenPath?.enabled && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
                    Golden Path Template
                  </h3>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  This template follows your organization&apos;s best practices and includes
                  pre-configured security, observability, and compliance standards.
                </p>
              </div>
            )}
          </div>
        );

      case 'execute':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mx-auto flex items-center justify-center mb-4">
                <Play className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Create
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Your {template.category} will be created using the {template.title} template.
                This process may take a few minutes.
              </p>
            </div>

            {/* What will be created */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                What will be created:
              </h4>
              <ul className="space-y-2">
                {template.steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {step.action.startsWith('publish:') ? (
                      <GitBranch className="h-4 w-4 text-purple-500" />
                    ) : step.action.startsWith('catalog:') ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {step.name}
                  </li>
                ))}
              </ul>
            </div>

            {/* Execution options */}
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full"
                onClick={() => handleExecute(false)}
                disabled={isExecuting}
              >
                {isExecuting && !isDryRun ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create Component
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => handleExecute(true)}
                disabled={isExecuting}
              >
                {isExecuting && isDryRun ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Dry Run...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Dry Run (Preview Only)
                  </>
                )}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {template.title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {template.description}
        </p>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mt-6">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <React.Fragment key={step.key}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-4',
                      index < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">{renderStepContent()}</div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={isExecuting}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {currentStep !== 'parameters' && (
            <Button variant="outline" onClick={handleBack} disabled={isExecuting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          {currentStep !== 'execute' && (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateWizard;
