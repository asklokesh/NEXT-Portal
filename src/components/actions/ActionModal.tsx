'use client';

/**
 * Action Modal Component
 * Modal for configuring and executing self-service actions
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Lock,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  SelfServiceAction,
  ActionParameter,
  ActionExecution,
} from '@/services/actions/types';

interface ActionModalProps {
  action: SelfServiceAction;
  entityRef?: string;
  onExecute: (parameters: Record<string, unknown>) => Promise<ActionExecution>;
  onClose: () => void;
  className?: string;
}

type ModalStep = 'configure' | 'confirm' | 'executing' | 'result';

const RISK_MESSAGES: Record<string, string> = {
  low: 'This action has minimal impact and can be safely executed.',
  medium: 'This action may affect service availability temporarily.',
  high: 'This action could impact production systems. Please review carefully.',
  critical: 'This action has critical impact and requires careful consideration.',
};

export function ActionModal({
  action,
  entityRef,
  onExecute,
  onClose,
  className,
}: ActionModalProps) {
  const [step, setStep] = useState<ModalStep>('configure');
  const [parameters, setParameters] = useState<Record<string, unknown>>(() => {
    // Initialize with default values
    const defaults: Record<string, unknown> = {};
    action.parameters.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });
    return defaults;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [execution, setExecution] = useState<ActionExecution | null>(null);
  const [reason, setReason] = useState('');

  const riskLevel = action.validation?.riskLevel;
  const requiresConfirmation = action.validation?.requiresConfirmation;
  const requiresReason = action.validation?.requiresReasonInput;

  // Validate parameters
  const validateParameters = (): boolean => {
    const newErrors: Record<string, string> = {};

    action.parameters.forEach((param) => {
      const value = parameters[param.name];

      if (param.required && (value === undefined || value === null || value === '')) {
        newErrors[param.name] = `${param.title} is required`;
        return;
      }

      if (value === undefined || value === null || value === '') return;

      if (param.validation) {
        if (param.validation.pattern) {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(String(value))) {
            newErrors[param.name] = param.validation.message || `Invalid format for ${param.title}`;
          }
        }

        if (typeof value === 'number') {
          if (param.validation.min !== undefined && value < param.validation.min) {
            newErrors[param.name] = `Must be at least ${param.validation.min}`;
          }
          if (param.validation.max !== undefined && value > param.validation.max) {
            newErrors[param.name] = `Must be at most ${param.validation.max}`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleParameterChange = (name: string, value: unknown) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleContinue = () => {
    if (step === 'configure') {
      if (!validateParameters()) return;
      if (requiresConfirmation || riskLevel === 'high' || riskLevel === 'critical') {
        setStep('confirm');
      } else {
        handleExecute();
      }
    } else if (step === 'confirm') {
      if (requiresReason && !reason.trim()) {
        return;
      }
      handleExecute();
    }
  };

  const handleExecute = async () => {
    setStep('executing');
    try {
      const result = await onExecute(parameters);
      setExecution(result);
      setStep('result');
    } catch (error) {
      setExecution({
        id: 'error',
        actionId: action.id,
        actionName: action.name,
        status: 'failed',
        triggeredBy: 'user',
        triggerType: 'manual',
        parameters,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'An error occurred',
          },
        },
      });
      setStep('result');
    }
  };

  // Render parameter input
  const renderParameterInput = (param: ActionParameter) => {
    const value = parameters[param.name];
    const error = errors[param.name];

    // Check if parameter should be hidden based on dependency
    if (param.ui?.dependsOn) {
      const dependentValue = parameters[param.ui.dependsOn.parameter];
      if (dependentValue !== param.ui.dependsOn.value) {
        return null;
      }
    }

    if (param.ui?.hidden) return null;

    const commonClasses = cn(
      'w-full px-3 py-2 rounded-lg border transition-colors',
      'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
      'focus:outline-none focus:ring-2 focus:ring-blue-500',
      error
        ? 'border-red-300 dark:border-red-700'
        : 'border-gray-300 dark:border-gray-600'
    );

    let inputElement: React.ReactNode;

    switch (param.type) {
      case 'string':
        if (param.ui?.widget === 'textarea') {
          inputElement = (
            <textarea
              value={String(value || '')}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              placeholder={param.ui?.placeholder}
              rows={4}
              className={commonClasses}
            />
          );
        } else {
          inputElement = (
            <input
              type="text"
              value={String(value || '')}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              placeholder={param.ui?.placeholder}
              className={commonClasses}
            />
          );
        }
        break;

      case 'number':
        inputElement = (
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
        break;

      case 'boolean':
        inputElement = (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleParameterChange(param.name, e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {param.description || 'Enable'}
            </span>
          </label>
        );
        break;

      case 'select':
      case 'environment-picker':
        const options = param.type === 'environment-picker'
          ? param.environments?.map((e) => ({ label: e, value: e })) || []
          : param.options || [];

        inputElement = (
          <div className="relative">
            <select
              value={String(value || '')}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
              className={cn(commonClasses, 'appearance-none pr-10')}
            >
              <option value="">Select {param.title}</option>
              {options.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        );
        break;

      case 'multiselect':
        const multiValue = Array.isArray(value) ? value : [];
        inputElement = (
          <div className="space-y-2">
            {param.options?.map((opt) => (
              <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiValue.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleParameterChange(param.name, [...multiValue, opt.value]);
                    } else {
                      handleParameterChange(
                        param.name,
                        multiValue.filter((v) => v !== opt.value)
                      );
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        );
        break;

      case 'secret':
        inputElement = (
          <input
            type="password"
            value={String(value || '')}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.ui?.placeholder || '••••••••'}
            className={commonClasses}
          />
        );
        break;

      case 'json':
        inputElement = (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '{}')}
            onChange={(e) => {
              try {
                handleParameterChange(param.name, JSON.parse(e.target.value));
              } catch {
                // Keep raw string while editing
              }
            }}
            rows={6}
            className={cn(commonClasses, 'font-mono text-sm')}
          />
        );
        break;

      default:
        inputElement = (
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className={commonClasses}
          />
        );
    }

    return (
      <div key={param.name} className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {param.title}
          {param.required && <span className="text-red-500">*</span>}
        </label>
        {inputElement}
        {param.description && param.type !== 'boolean' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{param.description}</p>
        )}
        {param.ui?.helpText && (
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Info className="h-3 w-3" />
            {param.ui.helpText}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    );
  };

  // Render step content
  const renderContent = () => {
    switch (step) {
      case 'configure':
        return (
          <div className="space-y-4">
            {action.parameters.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                This action has no configurable parameters.
              </p>
            ) : (
              action.parameters.map((param) => renderParameterInput(param))
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            {/* Risk Warning */}
            {riskLevel && (
              <div
                className={cn(
                  'rounded-lg p-4 flex items-start gap-3',
                  riskLevel === 'low' && 'bg-green-50 dark:bg-green-900/20',
                  riskLevel === 'medium' && 'bg-yellow-50 dark:bg-yellow-900/20',
                  riskLevel === 'high' && 'bg-orange-50 dark:bg-orange-900/20',
                  riskLevel === 'critical' && 'bg-red-50 dark:bg-red-900/20'
                )}
              >
                <AlertTriangle
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    riskLevel === 'low' && 'text-green-600',
                    riskLevel === 'medium' && 'text-yellow-600',
                    riskLevel === 'high' && 'text-orange-600',
                    riskLevel === 'critical' && 'text-red-600'
                  )}
                />
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      riskLevel === 'low' && 'text-green-800 dark:text-green-300',
                      riskLevel === 'medium' && 'text-yellow-800 dark:text-yellow-300',
                      riskLevel === 'high' && 'text-orange-800 dark:text-orange-300',
                      riskLevel === 'critical' && 'text-red-800 dark:text-red-300'
                    )}
                  >
                    {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk Action
                  </p>
                  <p
                    className={cn(
                      'text-sm mt-1',
                      riskLevel === 'low' && 'text-green-700 dark:text-green-400',
                      riskLevel === 'medium' && 'text-yellow-700 dark:text-yellow-400',
                      riskLevel === 'high' && 'text-orange-700 dark:text-orange-400',
                      riskLevel === 'critical' && 'text-red-700 dark:text-red-400'
                    )}
                  >
                    {RISK_MESSAGES[riskLevel]}
                  </p>
                </div>
              </div>
            )}

            {/* Confirmation Message */}
            {action.validation?.confirmationMessage && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300">
                  {action.validation.confirmationMessage}
                </p>
              </div>
            )}

            {/* Parameter Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Configuration Summary
              </h4>
              <dl className="space-y-2 text-sm">
                {action.parameters
                  .filter((p) => !p.ui?.hidden && parameters[p.name] !== undefined)
                  .map((param) => (
                    <div key={param.name} className="flex justify-between">
                      <dt className="text-gray-500 dark:text-gray-400">{param.title}</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">
                        {typeof parameters[param.name] === 'boolean'
                          ? parameters[param.name]
                            ? 'Yes'
                            : 'No'
                          : Array.isArray(parameters[param.name])
                          ? (parameters[param.name] as unknown[]).join(', ')
                          : String(parameters[param.name])}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Reason Input */}
            {requiresReason && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for this action..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Approval Notice */}
            {action.requiresApproval && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Approval Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    This action requires approval before execution. An approval request will be
                    created and sent to the appropriate approvers.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'executing':
        return (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Executing Action
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Please wait while the action is being executed...
            </p>
          </div>
        );

      case 'result':
        const isSuccess = execution?.result?.success;
        return (
          <div className="text-center py-6">
            <div
              className={cn(
                'w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4',
                isSuccess
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              )}
            >
              {isSuccess ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
            <h3
              className={cn(
                'text-lg font-medium mb-2',
                isSuccess
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              )}
            >
              {isSuccess ? 'Action Completed Successfully' : 'Action Failed'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {execution?.result?.message ||
                execution?.result?.error?.message ||
                (isSuccess ? 'The action was executed successfully.' : 'An error occurred.')}
            </p>

            {/* Outputs */}
            {isSuccess && execution?.result?.outputs && Object.keys(execution.result.outputs).length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Outputs
                </h4>
                <dl className="space-y-1 text-sm">
                  {Object.entries(execution.result.outputs).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-gray-500 dark:text-gray-400">{key}</dt>
                      <dd className="text-gray-900 dark:text-white font-mono">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Links */}
            {execution?.result?.links && execution.result.links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {execution.result.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {/* Duration */}
            {execution?.duration && (
              <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Completed in {(execution.duration / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={step === 'result' || step === 'executing' ? undefined : onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-xl',
          'max-h-[90vh] overflow-hidden flex flex-col',
          className
        )}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {action.name}
            </h2>
            {entityRef && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{entityRef}</p>
            )}
          </div>
          {step !== 'executing' && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>

        {/* Footer */}
        {step !== 'executing' && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-2">
            {step === 'result' ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                {step === 'confirm' && (
                  <Button variant="ghost" onClick={() => setStep('configure')}>
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleContinue}
                  disabled={step === 'confirm' && requiresReason && !reason.trim()}
                >
                  {step === 'configure'
                    ? requiresConfirmation || riskLevel === 'high' || riskLevel === 'critical'
                      ? 'Continue'
                      : 'Execute'
                    : action.requiresApproval
                    ? 'Request Approval'
                    : 'Execute'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActionModal;
