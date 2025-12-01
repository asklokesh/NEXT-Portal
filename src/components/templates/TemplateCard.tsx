'use client';

/**
 * Template Card Component
 * Display a software template in a card format
 */

import React from 'react';
import {
  Server,
  Globe,
  Library,
  Database,
  Brain,
  FileText,
  Settings,
  Star,
  GitBranch,
  Clock,
  Users,
  CheckCircle,
  Shield,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SoftwareTemplate, TemplateCategory } from '@/services/templates/types';

interface TemplateCardProps {
  template: SoftwareTemplate;
  onSelect?: () => void;
  onExecute?: () => void;
  compact?: boolean;
  className?: string;
}

const CATEGORY_CONFIG: Record<
  TemplateCategory,
  { icon: React.ElementType; color: string; bg: string }
> = {
  service: { icon: Server, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  frontend: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  backend: { icon: Server, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  library: { icon: Library, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  infrastructure: { icon: Database, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
  'data-pipeline': { icon: GitBranch, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  'ml-model': { icon: Brain, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  documentation: { icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  custom: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
};

export function TemplateCard({
  template,
  onSelect,
  onExecute,
  compact = false,
  className,
}: TemplateCardProps) {
  const categoryConfig = CATEGORY_CONFIG[template.category];
  const CategoryIcon = categoryConfig.icon;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer',
          className
        )}
        onClick={onSelect}
      >
        <div className={cn('p-2 rounded-lg', categoryConfig.bg)}>
          <CategoryIcon className={cn('h-5 w-5', categoryConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {template.title}
            </h3>
            {template.goldenPath?.recommended && (
              <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {template.description}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
      </div>
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
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-3 rounded-xl', categoryConfig.bg)}>
            <CategoryIcon className={cn('h-6 w-6', categoryConfig.color)} />
          </div>
          <div className="flex items-center gap-2">
            {template.goldenPath?.enabled && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <Shield className="h-3 w-3" />
                Golden Path
              </span>
            )}
            {template.goldenPath?.recommended && (
              <Star className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {template.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {template.description}
        </p>
      </div>

      {/* Tags */}
      <div className="px-6 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 4 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              +{template.tags.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Golden Path Features */}
      {template.goldenPath?.features && template.goldenPath.features.length > 0 && (
        <div className="px-6 pb-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Includes
          </div>
          <div className="flex flex-wrap gap-2">
            {template.goldenPath.features
              .filter((f) => f.included)
              .slice(0, 3)
              .map((feature) => (
                <span
                  key={feature.name}
                  className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400"
                >
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {feature.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-6 pb-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {template.metadata.usageCount} uses
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {template.metadata.averageExecutionTime
            ? `~${Math.round(template.metadata.averageExecutionTime / 1000)}s`
            : '< 1 min'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {template.owner}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-auto px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onSelect}
        >
          View Details
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={onExecute}
        >
          Use Template
        </Button>
      </div>
    </div>
  );
}

export default TemplateCard;
