'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { Loader2, TrendingUp, BarChart3, Activity, GitBranch, Table } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
 size?: 'sm' | 'md' | 'lg';
 className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
 size = 'md', 
 className 
}) => {
 const sizeClasses = {
 sm: 'w-4 h-4',
 md: 'w-6 h-6',
 lg: 'w-8 h-8'
 };

 return (
 <Loader2 className={cn(
 'animate-spin text-muted-foreground',
 sizeClasses[size],
 className
 )} />
 );
};

interface SkeletonProps {
 className?: string;
 variant?: 'default' | 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
 className, 
 variant = 'default' 
}) => {
 const variantClasses = {
 default: 'rounded-md',
 text: 'rounded h-4',
 circular: 'rounded-full',
 rectangular: 'rounded-none'
 };

 return (
 <div className={cn(
 'animate-pulse bg-muted',
 variantClasses[variant],
 className
 )} />
 );
};

interface WidgetLoadingProps {
 widgetType?: string;
 className?: string;
}

export const WidgetLoading: React.FC<WidgetLoadingProps> = ({ 
 widgetType, 
 className 
}) => {
 const getWidgetIcon = () => {
 switch (widgetType) {
 case 'metric':
 return <TrendingUp className="w-5 h-5" />;
 case 'chart':
 return <BarChart3 className="w-5 h-5" />;
 case 'serviceHealth':
 return <Activity className="w-5 h-5" />;
 case 'deployment':
 return <GitBranch className="w-5 h-5" />;
 case 'table':
 return <Table className="w-5 h-5" />;
 default:
 return <LoadingSpinner size="md" />;
 }
 };

 return (
 <div className={cn(
 'h-full flex flex-col items-center justify-center p-4 space-y-3',
 className
 )}>
 <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
 <div className="text-muted-foreground opacity-50">
 {getWidgetIcon()}
 </div>
 </div>
 
 <div className="space-y-2 text-center">
 <LoadingSpinner size="sm" />
 <p className="text-sm text-muted-foreground">Loading widget...</p>
 </div>
 </div>
 );
};

export const MetricWidgetLoading: React.FC = () => (
 <div className="h-full flex flex-col justify-center p-4 space-y-4">
 <div className="text-center space-y-2">
 <Skeleton className="h-8 w-24 mx-auto" />
 <Skeleton className="h-4 w-16 mx-auto" />
 </div>
 <Skeleton className="h-2 w-full" />
 </div>
);

export const ChartWidgetLoading: React.FC = () => (
 <div className="h-full flex flex-col p-4 space-y-4">
 <div className="flex items-center justify-between">
 <Skeleton className="h-4 w-20" />
 <Skeleton className="h-4 w-12" />
 </div>
 
 <div className="flex-1 space-y-2">
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="flex items-end gap-2 h-8">
 {Array.from({ length: 7 }).map((_, j) => (
 <Skeleton 
 key={j} 
 className="flex-1" 
 style={{ height: `${20 + Math.random() * 60}%` }}
 />
 ))}
 </div>
 ))}
 </div>
 </div>
);

export const ServiceHealthWidgetLoading: React.FC = () => (
 <div className="h-full overflow-auto p-4 space-y-3">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="p-3 rounded-lg border space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Skeleton variant="circular" className="w-4 h-4" />
 <Skeleton className="h-4 w-24" />
 </div>
 <Skeleton className="h-5 w-16" />
 </div>
 
 <div className="grid grid-cols-3 gap-3">
 {Array.from({ length: 3 }).map((_, j) => (
 <div key={j} className="space-y-1">
 <Skeleton className="h-3 w-12" />
 <Skeleton className="h-4 w-8" />
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
);

export const DeploymentWidgetLoading: React.FC = () => (
 <div className="h-full overflow-auto p-4 space-y-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
 <Skeleton variant="circular" className="w-2 h-2 mt-1" />
 <div className="flex-1 space-y-2">
 <div className="flex items-center justify-between">
 <Skeleton className="h-4 w-20" />
 <Skeleton className="h-3 w-16" />
 </div>
 <Skeleton className="h-3 w-32" />
 <Skeleton className="h-2 w-full" />
 </div>
 </div>
 ))}
 </div>
);

export const TableWidgetLoading: React.FC = () => (
 <div className="h-full flex flex-col p-4 space-y-4">
 {/* Table header */}
 <div className="grid grid-cols-4 gap-4 pb-2 border-b">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-4 w-full" />
 ))}
 </div>
 
 {/* Table rows */}
 <div className="space-y-3">
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="grid grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, j) => (
 <Skeleton key={j} className="h-4 w-full" />
 ))}
 </div>
 ))}
 </div>
 </div>
);

interface ProgressiveLoadingProps {
 stages: Array<{
 name: string;
 duration: number;
 completed: boolean;
 }>;
 currentStage: number;
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
 stages,
 currentStage
}) => (
 <div className="h-full flex flex-col items-center justify-center p-4 space-y-4">
 <LoadingSpinner size="lg" />
 
 <div className="w-full max-w-xs space-y-2">
 <div className="text-sm font-medium text-center">
 {stages[currentStage]?.name || 'Loading...'}
 </div>
 
 <div className="w-full bg-muted rounded-full h-2">
 <div 
 className="bg-primary h-2 rounded-full transition-all duration-300"
 style={{ width: `${((currentStage + 1) / stages.length) * 100}%` }}
 />
 </div>
 
 <div className="text-xs text-muted-foreground text-center">
 {currentStage + 1} of {stages.length}
 </div>
 </div>
 </div>
);

export const EmptyState: React.FC<{
 title: string;
 description?: string;
 action?: React.ReactNode;
 icon?: React.ReactNode;
}> = ({ title, description, action, icon }) => (
 <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
 {icon && (
 <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
 <div className="text-muted-foreground">
 {icon}
 </div>
 </div>
 )}
 
 <div className="space-y-2">
 <h3 className="font-medium">{title}</h3>
 {description && (
 <p className="text-sm text-muted-foreground max-w-sm">
 {description}
 </p>
 )}
 </div>
 
 {action}
 </div>
);