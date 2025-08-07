'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import type { Dashboard, Widget, DashboardContextValue } from '../types';

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider: React.FC<{ 
 children: React.ReactNode;
 initialDashboard?: Dashboard;
}> = ({ children, initialDashboard }) => {
 const [dashboard, setDashboard] = useState<Dashboard | null>(initialDashboard || null);

 // Update dashboard when initialDashboard changes
 useEffect(() => {
 if (initialDashboard) {
 setDashboard(initialDashboard);
 }
 }, [initialDashboard]);
 const [filters, setFilters] = useState<Record<string, any>>({});
 const [isEditing, setIsEditing] = useState(false);
 const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

 const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>) => {
 if (!dashboard) return;

 setDashboard(prev => {
 if (!prev) return prev;
 
 return {
 ...prev,
 widgets: prev.widgets.map(widget =>
 widget.id === widgetId ? { ...widget, ...updates } : widget
 )
 };
 });
 }, [dashboard]);

 const removeWidget = useCallback((widgetId: string) => {
 if (!dashboard) return;

 setDashboard(prev => {
 if (!prev) return prev;
 
 return {
 ...prev,
 widgets: prev.widgets.filter(widget => widget.id !== widgetId),
 layout: {
 ...prev.layout,
 layouts: Object.fromEntries(
 Object.entries(prev.layout.layouts).map(([breakpoint, items]) => [
 breakpoint,
 items.filter(item => item.i !== widgetId)
 ])
 )
 }
 };
 });
 }, [dashboard]);

 const addWidget = useCallback((widget: Widget) => {
 if (!dashboard) return;

 setDashboard(prev => {
 if (!prev) return prev;
 
 // Find available position for new widget
 const layout = prev.layout.layouts.lg || [];
 const maxY = Math.max(...layout.map(item => item.y + item.h), 0);
 
 const newLayoutItem = {
 i: widget.id,
 x: 0,
 y: maxY,
 w: 6,
 h: 4,
 minW: 2,
 minH: 2
 };
 
 return {
 ...prev,
 widgets: [...prev.widgets, widget],
 layout: {
 ...prev.layout,
 layouts: {
 ...prev.layout.layouts,
 lg: [...(prev.layout.layouts.lg || []), newLayoutItem],
 md: [...(prev.layout.layouts.md || []), { ...newLayoutItem, w: 6 }],
 sm: [...(prev.layout.layouts.sm || []), { ...newLayoutItem, w: 12, x: 0 }]
 }
 }
 };
 });
 }, [dashboard]);

 const value: DashboardContextValue = {
 dashboard,
 widgets: dashboard?.widgets || [],
 filters,
 isEditing,
 selectedWidget,
 setDashboard,
 updateWidget,
 removeWidget,
 addWidget,
 setFilters,
 setEditing: setIsEditing,
 selectWidget: setSelectedWidget
 };

 return (
 <DashboardContext.Provider value={value}>
 {children}
 </DashboardContext.Provider>
 );
};

export const useDashboard = () => {
 const context = useContext(DashboardContext);
 if (!context) {
 throw new Error('useDashboard must be used within a DashboardProvider');
 }
 return context;
};