'use client';

/**
 * Template Execution View Component
 * Display real-time progress of template execution
 */

import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  FileText,
  RefreshCw,
  Terminal,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  TemplateExecution,
  TemplateStepExecution,
} from '@/services/templates/types';

interface TemplateExecutionViewProps {
  execution: TemplateExecution;
  onClose?: () => void;
  onRetry?: () => void;
  onViewEntity?: (entityRef: string) => void;
  className?: string;
}

export function TemplateExecutionView({
  execution,
  onClose,
  onRetry,
  onViewEntity,
  className,
}: TemplateExecutionViewProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [copiedOutput, setCopiedOutput] = useState<string | null>(null);

  // Auto-expand failed or in-progress steps
  useEffect(() => {
    const autoExpand = new Set<string>();
    execution.steps?.forEach((step) => {
      if (step.status === 'failed' || step.status === 'running') {
        autoExpand.add(step.stepId);
      }
    });
    if (autoExpand.size > 0) {
      setExpandedSteps(autoExpand);
    }
  }, [execution.steps]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const copyOutput = async (output: string, stepId: string) => {
    await navigator.clipboard.writeText(output);
    setCopiedOutput(stepId);
    setTimeout(() => setCopiedOutput(null), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      pending: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      skipped: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
          styles[status] || styles.pending
        )}
      >
        {status}
      </span>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const calculateProgress = () => {
    if (!execution.steps || execution.steps.length === 0) return 0;
    const completed = execution.steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;
    return Math.round((completed / execution.steps.length) * 100);
  };

  const progress = calculateProgress();

  return (
    <div className={cn('flex flex-col h-full bg-white dark:bg-gray-900', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Template Execution
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {execution.templateId}
            </p>
          </div>
          {getStatusBadge(execution.status)}
        </div>

        {/* Progress Bar */}
        {execution.status === 'running' && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="text-gray-900 dark:text-white font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {execution.steps?.length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Steps</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {execution.steps?.filter((s) => s.status === 'completed').length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {execution.steps?.filter((s) => s.status === 'failed').length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {execution.completedAt
                ? formatDuration(
                    new Date(execution.completedAt).getTime() -
                      new Date(execution.startedAt).getTime()
                  )
                : '--'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Duration</div>
          </div>
        </div>
      </div>

      {/* Step List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {execution.steps?.map((step, index) => {
            const isExpanded = expandedSteps.has(step.stepId);

            return (
              <div
                key={step.stepId}
                className={cn(
                  'rounded-lg border transition-colors',
                  step.status === 'failed'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    : step.status === 'running'
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                {/* Step Header */}
                <button
                  onClick={() => toggleStep(step.stepId)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    {index + 1}
                  </div>
                  <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {step.stepId}
                    </p>
                    {step.startedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Started {new Date(step.startedAt).toLocaleTimeString()}
                        {step.completedAt && (
                          <span>
                            {' '}
                            • {formatDuration(
                              new Date(step.completedAt).getTime() -
                                new Date(step.startedAt).getTime()
                            )}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {/* Step Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Error Message */}
                    {step.error && (
                      <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-300">
                              Error
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                              {step.error}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Output */}
                    {step.output && Object.keys(step.output).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Output
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyOutput(JSON.stringify(step.output, null, 2), step.stepId)
                            }
                          >
                            {copiedOutput === step.stepId ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Links from output */}
                    {step.output?.repoUrl && (
                      <a
                        href={step.output.repoUrl as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <GitBranch className="h-4 w-4" />
                        View Repository
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {step.output?.entityRef && (
                      <button
                        onClick={() => onViewEntity?.(step.output?.entityRef as string)}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <FileText className="h-4 w-4" />
                        View in Catalog
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>Started: {new Date(execution.startedAt).toLocaleString()}</span>
          {execution.completedAt && (
            <span className="ml-4">
              Completed: {new Date(execution.completedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {execution.status === 'failed' && onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
          {onClose && (
            <Button onClick={onClose}>
              {execution.status === 'completed' ? 'Done' : 'Close'}
            </Button>
          )}
        </div>
      </div>

      {/* Success State */}
      {execution.status === 'completed' && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Successfully Created!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Your component has been created and registered in the catalog.
            </p>
            {execution.result?.outputs?.entityRef && (
              <div className="pointer-events-auto">
                <Button onClick={() => onViewEntity?.(execution.result?.outputs?.entityRef as string)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View in Catalog
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateExecutionView;
