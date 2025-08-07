'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await, import/no-named-as-default-member, react/no-unescaped-entities */

import { 
 MoreVertical, 
 X, 
 Settings, 
 RefreshCw,
 Maximize2,
 AlertCircle,
 Loader2
} from 'lucide-react';
import React, { Suspense, lazy } from 'react';

import { cn } from '@/lib/utils';

import { useWidgetData } from '../hooks/useWebSocket';
import { WidgetErrorBoundary } from '../Widgets/WidgetErrorBoundary';

import type { Widget } from '../types';

// Lazy load widget components
const MetricWidget = lazy(() => import('../Widgets/MetricWidget'));
const ChartWidget = lazy(() => import('../Widgets/ChartWidget'));
const ServiceHealthWidget = lazy(() => import('../Widgets/ServiceHealthWidget'));
const DeploymentWidget = lazy(() => import('../Widgets/DeploymentWidget'));
const TableWidget = lazy(() => import('../Widgets/TableWidget'));

interface WidgetRendererProps {
 widget: Widget;
 isEditing?: boolean;
 isSelected?: boolean;
 onRemove?: () => void;
 onConfig?: () => void;
}

const WidgetComponentMap: Record<string, React.ComponentType<any>> = {
 metric: MetricWidget,
 chart: ChartWidget,
 serviceHealth: ServiceHealthWidget,
 deployment: DeploymentWidget,
 table: TableWidget,
};

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
 widget,
 isEditing,
 isSelected,
 onRemove,
 onConfig
}) => {
 const { data, loading, error, refresh } = useWidgetData(
 widget.id,
 widget
 );

 const [showMenu, setShowMenu] = React.useState(false);
 const [isMaximized, setIsMaximized] = React.useState(false);
 const [isRefreshing, setIsRefreshing] = React.useState(false);

 const WidgetComponent = WidgetComponentMap[widget.type];

 const handleRefresh = async () => {
 setIsRefreshing(true);
 refresh();
 // Add a small delay to show the refresh animation
 setTimeout(() => setIsRefreshing(false), 500);
 };

 const handleMaximize = () => {
 setIsMaximized(!isMaximized);
 // In a real app, this would open a modal or fullscreen view
 };

 return (
 <WidgetErrorBoundary 
 widgetId={widget.id}
 widgetTitle={widget.title}
 onRetry={handleRefresh}
 >
 <div className="h-full flex flex-col">
 {/* Widget Header */}
 <div className="flex items-center justify-between p-3 border-b border-border">
 <h3 className="font-medium text-sm truncate">{widget.title}</h3>
 
 <div className="flex items-center gap-1">
 {/* Alert indicator */}
 {widget.alerts && widget.alerts.length > 0 && (
 <div className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
 <AlertCircle className="w-3 h-3" />
 </div>
 )}

 {/* Action buttons */}
 {!isEditing && (
 <>
 <button
 onClick={handleRefresh}
 disabled={isRefreshing}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Refresh"
 >
 <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
 </button>
 
 <button
 onClick={handleMaximize}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Maximize"
 >
 <Maximize2 className="w-3 h-3" />
 </button>
 </>
 )}

 {/* Menu */}
 <div className="relative">
 <button
 onClick={() => setShowMenu(!showMenu)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 >
 <MoreVertical className="w-3 h-3" />
 </button>

 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-50">
 <div className="py-1">
 <button
 onClick={() => {
 onConfig?.();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Settings className="w-4 h-4" />
 Configure
 </button>
 
 {isEditing && (
 <button
 onClick={() => {
 onRemove?.();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
 >
 <X className="w-4 h-4" />
 Remove
 </button>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Quick remove in edit mode */}
 {isEditing && (
 <button
 onClick={onRemove}
 className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
 title="Remove widget"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>

 {/* Widget Content */}
 <div className="flex-1 overflow-auto p-4">
 {error ? (
 <div className="flex flex-col items-center justify-center h-full text-center">
 <AlertCircle className="w-8 h-8 text-destructive mb-2" />
 <p className="text-sm text-muted-foreground">Error loading widget</p>
 <p className="text-xs text-destructive mt-1">{error.message}</p>
 <button
 onClick={handleRefresh}
 className="mt-4 text-xs text-primary hover:underline"
 >
 Try again
 </button>
 </div>
 ) : loading ? (
 <div className="flex items-center justify-center h-full">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : WidgetComponent ? (
 <Suspense
 fallback={
 <div className="flex items-center justify-center h-full">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 }
 >
 <WidgetComponent
 widget={widget}
 data={data}
 loading={loading}
 error={error}
 isEditing={isEditing}
 />
 </Suspense>
 ) : (
 <div className="flex items-center justify-center h-full">
 <p className="text-sm text-muted-foreground">
 Widget type "{widget.type}" not supported
 </p>
 </div>
 )}
 </div>
 </div>
 </WidgetErrorBoundary>
 );
};