'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, import/no-named-as-default-member, jsx-a11y/click-events-have-key-events, jsx-a11y/role-supports-aria-props */

import { 
 Server, 
 Globe, 
 BookOpen, 
 Package, 
 Wrench,
 ExternalLink,
 GitBranch,
 Users,
 Activity as _Activity,
 AlertCircle,
 CheckCircle,
 XCircle,
 Clock,
 MoreVertical,
 Star,
 GitCommit
} from 'lucide-react';
import React, { memo } from 'react';

import { cn } from '@/lib/utils';

import type { ServiceEntity } from '../types';

interface ServiceCardProps {
 service: ServiceEntity;
 selected?: boolean;
 onClick?: (service: ServiceEntity) => void;
 onSelect?: (service: ServiceEntity, selected: boolean) => void;
 onAction?: (service: ServiceEntity, action: string) => void;
 className?: string;
}

interface HealthIndicatorProps {
 health?: string;
 size?: 'sm' | 'md' | 'lg';
}

interface ServiceTypeIconProps {
 type: string;
 className?: string;
}

// Service type icon component
const ServiceTypeIcon: React.FC<ServiceTypeIconProps> = ({ type, className }) => {
 const icons = {
 service: Server,
 website: Globe,
 library: Package,
 documentation: BookOpen,
 tool: Wrench,
 };

 const Icon = icons[type as keyof typeof icons] || Server;
 
 return <Icon className={cn('w-5 h-5', className)} />;
};

// Health indicator component
const HealthIndicator: React.FC<HealthIndicatorProps> = ({ health = 'unknown', size = 'md' }) => {
 const sizeClasses = {
 sm: 'w-2 h-2',
 md: 'w-3 h-3',
 lg: 'w-4 h-4',
 };

 const healthConfig = {
 healthy: {
 icon: CheckCircle,
 color: 'text-green-500',
 bgColor: 'bg-green-500',
 label: 'Healthy',
 },
 degraded: {
 icon: AlertCircle,
 color: 'text-yellow-500',
 bgColor: 'bg-yellow-500',
 label: 'Degraded',
 },
 unhealthy: {
 icon: XCircle,
 color: 'text-red-500',
 bgColor: 'bg-red-500',
 label: 'Unhealthy',
 },
 unknown: {
 icon: Clock,
 color: 'text-gray-400',
 bgColor: 'bg-gray-400',
 label: 'Unknown',
 },
 };

 const config = healthConfig[health as keyof typeof healthConfig] || healthConfig.unknown;
 const Icon = config.icon;

 return (
 <div className="flex items-center gap-1">
 <Icon className={cn(sizeClasses[size], config.color)} />
 <span className={cn(
 'text-xs capitalize',
 config.color
 )}>
 {config.label}
 </span>
 </div>
 );
};

// Main service card component
export const ServiceCard = memo<ServiceCardProps>(({ 
 service, 
 selected = false,
 onClick,
 onSelect,
 onAction,
 className 
}) => {
 // eslint-disable-next-line import/no-named-as-default-member
 const [menuOpen, setMenuOpen] = React.useState(false);
 // eslint-disable-next-line import/no-named-as-default-member
 const [starred, setStarred] = React.useState(false);

 const handleCardClick = (e: React.MouseEvent) => {
 if (e.ctrlKey || e.metaKey) {
 onSelect?.(service, !selected);
 } else {
 onClick?.(service);
 }
 };

 const handleCheckboxClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 onSelect?.(service, !selected);
 };

 const handleMenuClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 setMenuOpen(!menuOpen);
 };

 const handleStarClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 setStarred(!starred);
 onAction?.(service, starred ? 'unstar' : 'star');
 };

 // Extract display data
 const { metadata, spec, status } = service;
 const displayName = metadata.title || metadata.name;
 const owner = spec.owner.replace('group:', '').replace('user:', '');
 const lifecycle = spec.lifecycle;
 const tags = metadata.tags || [];
 const links = metadata.links || [];

 return (
 <div
 className={cn(
 'group relative flex flex-col p-4 rounded-lg border bg-card',
 'hover:shadow-md hover:border-primary/50 transition-all duration-200',
 'cursor-pointer select-none',
 selected && 'ring-2 ring-primary ring-offset-2',
 className
 )}
 onClick={handleCardClick}
 role="button"
 tabIndex={0}
 aria-pressed={selected}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleCardClick(e as any);
 }
 }}
 aria-label={`Service card for ${displayName}`}
 >
 {/* Selection checkbox */}
 <div className={cn(
 'absolute top-2 left-2 opacity-0 group-hover:opacity-100',
 'transition-opacity duration-200',
 selected && 'opacity-100'
 )}>
 <input
 type="checkbox"
 checked={selected}
 onChange={() => {}}
 onClick={handleCheckboxClick}
 className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
 aria-label={`Select ${displayName}`}
 />
 </div>

 {/* Action menu */}
 <div className="absolute top-2 right-2">
 <button
 onClick={handleMenuClick}
 className={cn(
 'p-1 rounded opacity-0 group-hover:opacity-100',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-all duration-200',
 menuOpen && 'opacity-100 bg-accent'
 )}
 aria-label="Service actions"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 
 {menuOpen && (
 <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onAction?.(service, 'view');
 setMenuOpen(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <ExternalLink className="w-4 h-4" />
 View Details
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onAction?.(service, 'edit');
 setMenuOpen(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <GitBranch className="w-4 h-4" />
 View Source
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onAction?.(service, 'dependencies');
 setMenuOpen(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <GitCommit className="w-4 h-4" />
 Dependencies
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Service icon and name */}
 <div className="flex items-start gap-3 mb-3">
 <div className={cn(
 'p-2 rounded-lg',
 'bg-primary/10 text-primary'
 )}>
 <ServiceTypeIcon type={spec.type} />
 </div>
 
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-foreground truncate pr-8">
 {displayName}
 </h3>
 <p className="text-sm text-muted-foreground truncate">
 {metadata.namespace || 'default'}/{metadata.name}
 </p>
 </div>
 </div>

 {/* Description */}
 {metadata.description && (
 <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
 {metadata.description}
 </p>
 )}

 {/* Metadata grid */}
 <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
 <div className="flex items-center gap-1 text-muted-foreground">
 <Users className="w-3 h-3" />
 <span className="truncate">{owner}</span>
 </div>
 
 <div className="flex items-center gap-1">
 <div className={cn(
 'px-2 py-0.5 rounded-full text-xs font-medium',
 lifecycle === 'production' && 'bg-green-100 text-green-800',
 lifecycle === 'experimental' && 'bg-yellow-100 text-yellow-800',
 lifecycle === 'deprecated' && 'bg-red-100 text-red-800'
 )}>
 {lifecycle}
 </div>
 </div>
 </div>

 {/* Health status */}
 {status && (
 <div className="flex items-center justify-between mb-3">
 <HealthIndicator health={status.health} size="sm" />
 {status.version && (
 <span className="text-xs text-muted-foreground">
 v{status.version}
 </span>
 )}
 </div>
 )}

 {/* Tags */}
 {tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-3">
 {tags.slice(0, 3).map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 {tags.length > 3 && (
 <span className="text-xs text-muted-foreground">
 +{tags.length - 3} more
 </span>
 )}
 </div>
 )}

 {/* Quick actions */}
 <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
 <div className="flex items-center gap-2">
 {links.slice(0, 3).map((link, index) => (
 <a
 key={index}
 href={link.url}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 title={link.title || link.url}
 >
 <ExternalLink className="w-3 h-3" />
 </a>
 ))}
 </div>
 
 <button
 onClick={handleStarClick}
 className={cn(
 'p-1 rounded transition-colors',
 starred 
 ? 'text-yellow-500 hover:text-yellow-600' 
 : 'text-muted-foreground hover:text-foreground'
 )}
 aria-label={starred ? 'Unstar service' : 'Star service'}
 >
 <Star className={cn('w-4 h-4', starred && 'fill-current')} />
 </button>
 </div>

 {/* Metrics overlay (on hover) */}
 {status?.metrics && (
 <div className={cn(
 'absolute inset-x-0 bottom-0 p-3 bg-background/95 backdrop-blur-sm',
 'border-t border-border rounded-b-lg',
 'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
 'pointer-events-none'
 )}>
 <div className="grid grid-cols-3 gap-2 text-xs">
 <div>
 <div className="text-muted-foreground">Response</div>
 <div className="font-medium">{status.metrics.responseTime}ms</div>
 </div>
 <div>
 <div className="text-muted-foreground">Errors</div>
 <div className="font-medium">{status.metrics.errorRate}%</div>
 </div>
 <div>
 <div className="text-muted-foreground">Requests</div>
 <div className="font-medium">{status.metrics.throughput}/s</div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
});

ServiceCard.displayName = 'ServiceCard';