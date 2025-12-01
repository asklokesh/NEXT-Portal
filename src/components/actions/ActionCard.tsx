'use client';

/**
 * Action Card Component
 * Display a self-service action in a card format
 */

import React from 'react';
import {
  Rocket,
  RefreshCw,
  Maximize2,
  RotateCcw,
  AlertTriangle,
  Database,
  Cloud,
  Shield,
  Settings,
  Play,
  ChevronRight,
  Clock,
  CheckCircle,
  TrendingUp,
  Lock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SelfServiceAction, ActionCategory } from '@/services/actions/types';

interface ActionCardProps {
  action: SelfServiceAction;
  onExecute: () => void;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

const CATEGORY_CONFIG: Record<
  ActionCategory,
  { icon: React.ElementType; color: string; bg: string }
> = {
  deployment: { icon: Rocket, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  infrastructure: { icon: Cloud, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  'ci-cd': { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  database: { icon: Database, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  security: { icon: Shield, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  observability: { icon: TrendingUp, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  maintenance: { icon: RefreshCw, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
  notifications: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  integrations: { icon: Settings, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  custom: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
};

const ICON_MAP: Record<string, React.ElementType> = {
  rocket: Rocket,
  'refresh-cw': RefreshCw,
  'maximize-2': Maximize2,
  'rotate-ccw': RotateCcw,
  'alert-triangle': AlertTriangle,
  database: Database,
  cloud: Cloud,
  shield: Shield,
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const BUTTON_VARIANTS: Record<string, 'primary' | 'secondary' | 'outline' | 'danger'> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  warning: 'secondary',
};

export function ActionCard({
  action,
  onExecute,
  compact = false,
  disabled = false,
  className,
}: ActionCardProps) {
  const categoryConfig = CATEGORY_CONFIG[action.category];
  const CategoryIcon = categoryConfig.icon;
  const ActionIcon = action.ui?.icon ? ICON_MAP[action.ui.icon] || CategoryIcon : CategoryIcon;
  const riskLevel = action.validation?.riskLevel;
  const buttonVariant = action.ui?.buttonVariant
    ? BUTTON_VARIANTS[action.ui.buttonVariant]
    : 'primary';

  if (compact) {
    return (
      <button
        onClick={onExecute}
        disabled={disabled}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-md transition-all text-left w-full',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div className={cn('p-2 rounded-lg', categoryConfig.bg)}>
          <ActionIcon className={cn('h-4 w-4', categoryConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {action.name}
            </h3>
            {action.requiresApproval && (
              <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {action.description}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-lg transition-all overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-3 rounded-xl', categoryConfig.bg)}>
            <ActionIcon className={cn('h-6 w-6', categoryConfig.color)} />
          </div>
          <div className="flex items-center gap-2">
            {riskLevel && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
                  RISK_COLORS[riskLevel]
                )}
              >
                {riskLevel} risk
              </span>
            )}
            {action.requiresApproval && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Approval
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {action.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {action.description}
        </p>
      </div>

      {/* Tags */}
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {action.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
          {action.tags.length > 4 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              +{action.tags.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Parameters Preview */}
      {action.parameters.length > 0 && (
        <div className="px-5 pb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {action.parameters.filter((p) => p.required).length} required{' '}
            {action.parameters.filter((p) => p.required).length === 1 ? 'parameter' : 'parameters'}
          </div>
          <div className="flex flex-wrap gap-2">
            {action.parameters.slice(0, 3).map((param) => (
              <span
                key={param.name}
                className="inline-flex items-center text-xs text-gray-600 dark:text-gray-400"
              >
                {param.required && <span className="text-red-500 mr-0.5">*</span>}
                {param.title}
              </span>
            ))}
            {action.parameters.length > 3 && (
              <span className="text-xs text-gray-400">
                +{action.parameters.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-5 pb-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {action.metadata.totalExecutions} runs
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {action.metadata.successRate.toFixed(1)}% success
        </span>
        {action.metadata.averageExecutionTime && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{Math.round(action.metadata.averageExecutionTime / 1000)}s
          </span>
        )}
      </div>

      {/* Action */}
      <div className="mt-auto px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        <Button
          variant={buttonVariant}
          size="sm"
          className="w-full"
          onClick={onExecute}
          disabled={disabled}
        >
          <Play className="h-4 w-4 mr-2" />
          {action.ui?.buttonText || 'Run Action'}
        </Button>
      </div>
    </div>
  );
}

export default ActionCard;
