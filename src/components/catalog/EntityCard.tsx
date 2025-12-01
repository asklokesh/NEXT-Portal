'use client';

/**
 * Entity Card Component
 * Display a catalog entity in a card format
 */

import React from 'react';
import {
  Server,
  Globe,
  Library,
  Database,
  Users,
  User,
  Boxes,
  Layers,
  Code,
  Cloud,
  ChevronRight,
  ExternalLink,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Entity,
  EntityKind,
  LifecycleStage,
  ComponentEntity,
  ApiEntity,
} from '@/services/catalog/entity-types';

interface EntityCardProps {
  entity: Entity;
  onSelect?: () => void;
  compact?: boolean;
  showRelations?: boolean;
  className?: string;
}

const KIND_CONFIG: Record<
  EntityKind,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  Component: { icon: Server, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Component' },
  API: { icon: Code, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'API' },
  Resource: { icon: Database, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Resource' },
  System: { icon: Boxes, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'System' },
  Domain: { icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'Domain' },
  Group: { icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'Group' },
  User: { icon: User, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800', label: 'User' },
  Location: { icon: Globe, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'Location' },
  Template: { icon: Library, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Template' },
  Infrastructure: { icon: Cloud, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30', label: 'Infrastructure' },
  Pipeline: { icon: GitBranch, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'Pipeline' },
  Environment: { icon: Cloud, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Environment' },
  Secret: { icon: Database, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Secret' },
};

const LIFECYCLE_CONFIG: Record<LifecycleStage, { color: string; bg: string }> = {
  experimental: { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  development: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  alpha: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  beta: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  production: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  deprecated: { color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  'end-of-life': { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const COMPONENT_TYPE_ICONS: Record<string, React.ElementType> = {
  service: Server,
  website: Globe,
  library: Library,
  frontend: Globe,
  backend: Server,
  worker: Activity,
};

export function EntityCard({
  entity,
  onSelect,
  compact = false,
  showRelations = true,
  className,
}: EntityCardProps) {
  const kindConfig = KIND_CONFIG[entity.kind] || KIND_CONFIG.Component;
  const KindIcon = kindConfig.icon;

  const spec = entity.spec as any;
  const lifecycle = spec.lifecycle as LifecycleStage | undefined;
  const lifecycleConfig = lifecycle ? LIFECYCLE_CONFIG[lifecycle] : undefined;
  const componentType = spec.type as string | undefined;
  const TypeIcon = componentType ? COMPONENT_TYPE_ICONS[componentType] || KindIcon : KindIcon;

  // Get deployment status for components
  const deployments = spec.deployments as ComponentEntity['spec']['deployments'];
  const prodDeployment = deployments?.find((d) => d.environment === 'production');

  const getEntityRef = () => {
    return `${entity.kind.toLowerCase()}:${entity.metadata.namespace}/${entity.metadata.name}`;
  };

  if (compact) {
    return (
      <div
        onClick={onSelect}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer',
          className
        )}
      >
        <div className={cn('p-2 rounded-lg', kindConfig.bg)}>
          <TypeIcon className={cn('h-4 w-4', kindConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {entity.metadata.title || entity.metadata.name}
            </h3>
            {lifecycle && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs font-medium rounded capitalize',
                  lifecycleConfig?.bg,
                  lifecycleConfig?.color
                )}
              >
                {lifecycle}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {entity.metadata.description || getEntityRef()}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex flex-col rounded-xl border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-900 hover:border-blue-400 hover:shadow-lg transition-all overflow-hidden cursor-pointer',
        className
      )}
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-3 rounded-xl', kindConfig.bg)}>
            <TypeIcon className={cn('h-6 w-6', kindConfig.color)} />
          </div>
          <div className="flex items-center gap-2">
            {/* Kind Badge */}
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {kindConfig.label}
            </span>
            {/* Lifecycle Badge */}
            {lifecycle && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
                  lifecycleConfig?.bg,
                  lifecycleConfig?.color
                )}
              >
                {lifecycle}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {entity.metadata.title || entity.metadata.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {entity.metadata.description || 'No description available'}
        </p>
      </div>

      {/* Tags */}
      {entity.metadata.tags && entity.metadata.tags.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {entity.metadata.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
            {entity.metadata.tags.length > 4 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                +{entity.metadata.tags.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Component specific info */}
      {entity.kind === 'Component' && (
        <div className="px-5 pb-3 space-y-2">
          {/* Type and tier */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {componentType && (
              <span className="capitalize">{componentType}</span>
            )}
            {spec.tier && (
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                {spec.tier}
              </span>
            )}
            {spec.criticality && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded capitalize',
                  spec.criticality === 'critical' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  spec.criticality === 'high' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                  spec.criticality === 'medium' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                  spec.criticality === 'low' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                )}
              >
                {spec.criticality}
              </span>
            )}
          </div>

          {/* Deployment status */}
          {prodDeployment && (
            <div className="flex items-center gap-2 text-xs">
              {prodDeployment.status === 'healthy' ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : prodDeployment.status === 'degraded' ? (
                <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
              ) : prodDeployment.status === 'unhealthy' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-gray-400" />
              )}
              <span className="text-gray-600 dark:text-gray-400">
                Production: {prodDeployment.replicas} replicas
              </span>
            </div>
          )}
        </div>
      )}

      {/* API specific info */}
      {entity.kind === 'API' && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {spec.type && (
              <span className="uppercase font-medium">{spec.type}</span>
            )}
            {spec.version && (
              <span className="text-blue-600 dark:text-blue-400">v{spec.version}</span>
            )}
            {(spec as ApiEntity['spec']).authentication?.type && (
              <span className="capitalize">
                {(spec as ApiEntity['spec']).authentication?.type} auth
              </span>
            )}
          </div>
        </div>
      )}

      {/* Relations */}
      {showRelations && entity.relations && entity.relations.length > 0 && (
        <div className="px-5 pb-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {entity.relations.length} {entity.relations.length === 1 ? 'relation' : 'relations'}
          </div>
        </div>
      )}

      {/* Owner */}
      {spec.owner && (
        <div className="mt-auto px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {spec.owner.replace('group:default/', '')}
          </span>
        </div>
      )}

      {/* Links */}
      {entity.metadata.links && entity.metadata.links.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
          {entity.metadata.links.slice(0, 3).map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {link.type === 'repository' ? (
                <GitBranch className="h-3 w-3" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              {link.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default EntityCard;
