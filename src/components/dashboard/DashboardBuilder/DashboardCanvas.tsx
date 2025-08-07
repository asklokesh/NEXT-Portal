'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-misused-promises, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, import/no-extraneous-dependencies */

import { 
 Plus, 
 Edit3, 
 Save, 
 X, 
 Settings,
 RefreshCw,
 Download,
 Share2,
 Filter,
 Clock,
 Maximize2,
 Grid
} from 'lucide-react';
import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';

import { cn } from '@/lib/utils';

import { WidgetPalette } from './WidgetPalette';
import { WidgetRenderer } from './WidgetRenderer';
import DashboardHelp from '../Help/DashboardHelp';
import { useDashboard } from '../hooks/useDashboard';
import { useDashboardShortcuts } from '../hooks/useKeyboardShortcuts';
import DashboardSettings from '../Settings/DashboardSettings';
import WidgetConfigModal from '../Settings/WidgetConfigModal';

import type { Widget, LayoutItem } from '../types';
import type { Layout } from 'react-grid-layout';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Memoized widget wrapper for performance
const MemoizedWidgetWrapper = memo<{
 widget: Widget;
 isEditing: boolean;
 isSelected: boolean;
 onWidgetClick: (widgetId: string) => void;
 onRemove: () => void;
 onConfig: () => void;
}>(({ widget, isEditing, isSelected, onWidgetClick, onRemove, onConfig }) => (
 <div
 className={cn(
 'bg-card rounded-lg border shadow-sm transition-all',
 isEditing && 'cursor-move',
 isSelected && 'ring-2 ring-primary',
 'hover:shadow-md'
 )}
 onClick={() => onWidgetClick(widget.id)}
 >
 <WidgetRenderer
 widget={widget}
 isEditing={isEditing}
 isSelected={isSelected}
 onRemove={onRemove}
 onConfig={onConfig}
 />
 </div>
));

MemoizedWidgetWrapper.displayName = 'MemoizedWidgetWrapper';

interface DashboardCanvasProps {
 className?: string;
}

export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({ className }) => {
 const {
 dashboard,
 widgets,
 isEditing,
 selectedWidget,
 setEditing,
 selectWidget,
 updateWidget,
 removeWidget,
 setDashboard
 } = useDashboard();

 const [showPalette, setShowPalette] = useState(false);
 const [showSettings, setShowSettings] = useState(false);
 const [showHelp, setShowHelp] = useState(false);
 const [configWidget, setConfigWidget] = useState<Widget | null>(null);
 const [autoRefresh, setAutoRefresh] = useState(true);
 const [refreshInterval, setRefreshInterval] = useState(30); // seconds
 const [preferences, setPreferences] = useState({
 autoSave: true,
 autoRefresh: true,
 refreshInterval: 30,
 theme: 'system' as const,
 filterByOwnership: true,
 defaultView: 'grid' as const,
 compactMode: false
 });

 // Auto-refresh effect
 useEffect(() => {
 if (!autoRefresh || !refreshInterval) return;

 const interval = setInterval(() => {
 // Trigger refresh for all widgets
 widgets.forEach(widget => {
 // This would trigger data refresh via WebSocket or API
 // TODO: Implement actual widget refresh logic
 });
 }, refreshInterval * 1000);

 return () => clearInterval(interval);
 }, [autoRefresh, refreshInterval, widgets]);

 const handleLayoutChange = useCallback((layout: Layout[], layouts: any) => {
 if (!dashboard) return;

 // Apply size constraints to prevent widgets from being too small or large
 const constrainedLayouts = Object.entries(layouts).reduce((acc, [breakpoint, layoutItems]) => {
 acc[breakpoint] = (layoutItems as Layout[]).map(item => ({
 ...item,
 // Minimum widget size constraints
 w: Math.max(item.w, 2), // Minimum width: 2 grid units
 h: Math.max(item.h, 2), // Minimum height: 2 grid units
 // Maximum widget size constraints
 w: Math.min(item.w, 12), // Maximum width: 12 grid units
 h: Math.min(item.h, 8) // Maximum height: 8 grid units
 }));
 return acc;
 }, {} as any);

 setDashboard({
 ...dashboard,
 layout: {
 ...dashboard.layout,
 layouts: constrainedLayouts
 }
 });
 }, [dashboard, setDashboard]);

 const handleEditToggle = useCallback(() => {
 setEditing(!isEditing);
 if (isEditing) {
 selectWidget(null);
 }
 }, [isEditing, setEditing, selectWidget]);

 const handleWidgetClick = useCallback((widgetId: string) => {
 if (isEditing) {
 selectWidget(widgetId === selectedWidget ? null : widgetId);
 }
 }, [isEditing, selectedWidget, selectWidget]);

 // Memoized widget removal callbacks to prevent re-renders
 const widgetCallbacks = useMemo(() => {
 return widgets.reduce((acc, widget) => {
 acc[widget.id] = {
 onRemove: () => removeWidget(widget.id),
 onConfig: () => setConfigWidget(widget)
 };
 return acc;
 }, {} as Record<string, { onRemove: () => void; onConfig: () => void }>);
 }, [widgets, removeWidget, setConfigWidget]);

 const handleAddWidget = useCallback((widget: Widget) => {
 // Widget will be added via the dashboard context
 setShowPalette(false);
 }, []);

 const handleExport = useCallback(() => {
 if (!dashboard) return;

 const data = JSON.stringify(dashboard, null, 2);
 const blob = new Blob([data], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-dashboard.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 }, [dashboard]);

 // Handle save dashboard
 const handleSave = useCallback(async () => {
 if (dashboard) {
 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 await persistenceService.saveDashboard(dashboard);
 // Could show toast notification here
 // Dashboard saved successfully
 } catch (error) {
 console.error('Failed to save dashboard:', error);
 }
 }
 }, [dashboard]);

 // Handle refresh all widgets
 const handleRefresh = useCallback(() => {
 widgets.forEach(widget => {
 // TODO: Trigger actual widget refresh
 });
 }, [widgets]);

 // Widget navigation
 const navigateToNextWidget = useCallback(() => {
 if (!isEditing || widgets.length === 0) return;
 
 const currentIndex = selectedWidget 
 ? widgets.findIndex(w => w.id === selectedWidget)
 : -1;
 
 const nextIndex = (currentIndex + 1) % widgets.length;
 selectWidget(widgets[nextIndex].id);
 }, [isEditing, widgets, selectedWidget, selectWidget]);

 const navigateToPrevWidget = useCallback(() => {
 if (!isEditing || widgets.length === 0) return;
 
 const currentIndex = selectedWidget 
 ? widgets.findIndex(w => w.id === selectedWidget)
 : -1;
 
 const prevIndex = currentIndex <= 0 ? widgets.length - 1 : currentIndex - 1;
 selectWidget(widgets[prevIndex].id);
 }, [isEditing, widgets, selectedWidget, selectWidget]);

 const handleSelectWidget = useCallback(() => {
 if (!selectedWidget) return;
 const widget = widgets.find(w => w.id === selectedWidget);
 if (widget) {
 setConfigWidget(widget);
 }
 }, [selectedWidget, widgets]);

 const handleDeleteSelected = useCallback(() => {
 if (selectedWidget) {
 removeWidget(selectedWidget);
 selectWidget(null);
 }
 }, [selectedWidget, removeWidget, selectWidget]);

 // Keyboard shortcuts
 useDashboardShortcuts({
 onToggleEdit: handleEditToggle,
 onAddWidget: () => setShowPalette(true),
 onSave: handleSave,
 onRefresh: handleRefresh,
 onOpenSettings: () => setShowSettings(true),
 onShowHelp: () => setShowHelp(true),
 onNavigateNext: navigateToNextWidget,
 onNavigatePrev: navigateToPrevWidget,
 onSelectWidget: handleSelectWidget,
 onDeleteSelected: handleDeleteSelected,
 isEditing
 });

 // Listen for escape events to close modals
 useEffect(() => {
 const handleEscape = () => {
 setShowPalette(false);
 setShowSettings(false);
 setShowHelp(false);
 setConfigWidget(null);
 };

 document.addEventListener('dashboard:escape', handleEscape);
 return () => document.removeEventListener('dashboard:escape', handleEscape);
 }, []);

 const gridLayouts = useMemo(() => {
 if (!dashboard) return { lg: [] };
 return dashboard.layout.layouts;
 }, [dashboard]);

 // Grid constraints and configuration
 const gridConfig = useMemo(() => ({
 breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
 cols: { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 },
 rowHeight: dashboard?.layout.rowHeight || 60,
 margin: dashboard?.layout.margin || [8, 8],
 containerPadding: dashboard?.layout.containerPadding || [0, 0],
 // Snap to grid settings
 compactType: 'vertical' as const,
 preventCollision: false,
 // Resize constraints
 resizeHandles: ['se', 'sw', 'ne', 'nw'] as const,
 // Drag constraints
 isDraggable: isEditing,
 isResizable: isEditing,
 useCSSTransforms: true,
 transformScale: 1
 }), [dashboard, isEditing]);

 if (!dashboard) {
 return (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <Grid className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
 <h3 className="font-semibold mb-2">No Dashboard Selected</h3>
 <p className="text-sm text-muted-foreground">
 Select or create a dashboard to get started
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className={cn('flex flex-col h-full bg-background', className)}>
 {/* Header */}
 <div className="flex-shrink-0 border-b border-border">
 <div className="flex items-center justify-between p-4">
 <div>
 <h1 className="text-2xl font-bold">{dashboard.name}</h1>
 {dashboard.description && (
 <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
 )}
 </div>

 <div className="flex items-center gap-2">
 {/* Auto-refresh controls */}
 <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-border">
 <Clock className="w-4 h-4 text-muted-foreground" />
 <select
 value={autoRefresh ? refreshInterval : 0}
 onChange={(e) => {
 const value = parseInt(e.target.value);
 if (value === 0) {
 setAutoRefresh(false);
 } else {
 setAutoRefresh(true);
 setRefreshInterval(value);
 }
 }}
 className="text-sm bg-transparent border-none focus:outline-none"
 >
 <option value={0}>Off</option>
 <option value={5}>5s</option>
 <option value={10}>10s</option>
 <option value={30}>30s</option>
 <option value={60}>1m</option>
 <option value={300}>5m</option>
 </select>
 </div>

 <button
 onClick={() => {
 // Trigger manual refresh
 widgets.forEach(widget => {
 // TODO: Trigger actual widget refresh
 });
 }}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Refresh all widgets"
 >
 <RefreshCw className="w-4 h-4" />
 </button>

 <button
 onClick={handleExport}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Export dashboard"
 >
 <Download className="w-4 h-4" />
 </button>

 <button
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Share dashboard"
 >
 <Share2 className="w-4 h-4" />
 </button>

 <button
 onClick={() => setShowSettings(true)}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Dashboard settings"
 >
 <Settings className="w-4 h-4" />
 </button>

 <button
 onClick={() => setShowHelp(true)}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 title="Help & keyboard shortcuts"
 >
 ?
 </button>

 <div className="w-px h-6 bg-border mx-2" />

 {isEditing && (
 <button
 onClick={() => setShowPalette(true)}
 className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Plus className="w-4 h-4" />
 Add Widget
 </button>
 )}

 <button
 onClick={handleEditToggle}
 className={cn(
 'flex items-center gap-2 px-3 py-1.5 rounded-md border',
 isEditing
 ? 'border-primary bg-primary text-primary-foreground'
 : 'border-border hover:bg-accent hover:text-accent-foreground'
 )}
 >
 {isEditing ? (
 <>
 <Save className="w-4 h-4" />
 Save
 </>
 ) : (
 <>
 <Edit3 className="w-4 h-4" />
 Edit
 </>
 )}
 </button>
 </div>
 </div>

 {/* Filters bar */}
 {dashboard.filters && dashboard.filters.length > 0 && (
 <div className="px-4 pb-4 flex items-center gap-4">
 <Filter className="w-4 h-4 text-muted-foreground" />
 {/* Filter components would go here */}
 <span className="text-sm text-muted-foreground">Filters coming soon...</span>
 </div>
 )}
 </div>

 {/* Grid Layout */}
 <div className="flex-1 overflow-auto p-4">
 <ResponsiveGridLayout
 className="layout"
 layouts={gridLayouts}
 onLayoutChange={handleLayoutChange}
 {...gridConfig}
 >
 {widgets.map((widget) => (
 <MemoizedWidgetWrapper
 key={widget.id}
 widget={widget}
 isEditing={isEditing}
 isSelected={selectedWidget === widget.id}
 onWidgetClick={handleWidgetClick}
 onRemove={widgetCallbacks[widget.id]?.onRemove || (() => removeWidget(widget.id))}
 onConfig={widgetCallbacks[widget.id]?.onConfig || (() => setConfigWidget(widget))}
 />
 ))}
 </ResponsiveGridLayout>
 </div>

 {/* Widget Palette */}
 {showPalette && (
 <WidgetPalette
 onClose={() => setShowPalette(false)}
 onAddWidget={handleAddWidget}
 />
 )}

 {/* Dashboard Settings */}
 <DashboardSettings
 isOpen={showSettings}
 onClose={() => setShowSettings(false)}
 onSave={async (newPreferences) => {
 setPreferences(prev => ({ ...prev, ...newPreferences }));
 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 await persistenceService.savePreferences(newPreferences);
 } catch (error) {
 console.error('Failed to save preferences:', error);
 }
 }}
 currentPreferences={preferences}
 />

 {/* Widget Configuration */}
 <WidgetConfigModal
 widget={configWidget}
 isOpen={!!configWidget}
 onClose={() => setConfigWidget(null)}
 onSave={(widgetId, config) => {
 updateWidget(widgetId, { config });
 }}
 />

 {/* Help Modal */}
 <DashboardHelp
 isOpen={showHelp}
 onClose={() => setShowHelp(false)}
 />
 </div>
 );
};