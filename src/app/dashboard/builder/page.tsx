'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import React, { useState, useEffect } from 'react';
// import { v4 as uuidv4 } from 'uuid';
const uuidv4 = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

import { DashboardCanvas } from '@/components/dashboard/DashboardBuilder/DashboardCanvas';
import { DashboardProvider } from '@/components/dashboard/hooks/useDashboard';
import { initializeWebSocketService } from '@/components/dashboard/services/websocket';

import type { Dashboard, Widget } from '@/components/dashboard/types';


// Default dashboard configuration
const createDefaultDashboard = (): Dashboard => ({
 id: 'default-dashboard',
 name: 'Platform Overview',
 description: 'Real-time monitoring of all platform services',
 owner: 'platform-team',
 type: 'platform',
 layout: {
 type: 'grid',
 columns: 24,
 rowHeight: 60,
 margin: [16, 16],
 containerPadding: [0, 0],
 layouts: {
 lg: [],
 md: [],
 sm: []
 }
 },
 widgets: [],
 refreshInterval: 30000,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 isPublic: true,
 tags: ['monitoring', 'platform', 'real-time']
});

// Default widgets with real data sources
const createDefaultWidgets = (): Widget[] => [
 {
 id: uuidv4(),
 type: 'metric',
 title: 'Total Services',
 config: {
 metric: 'totalServices',
 display: {
 format: 'number',
 comparison: 'previous'
 }
 },
 dataSource: {
 type: 'custom',
 query: 'services.count'
 }
 },
 {
 id: uuidv4(),
 type: 'metric',
 title: 'Healthy Services',
 config: {
 metric: 'healthyServices',
 display: {
 format: 'number',
 unit: 'services',
 comparison: 'target',
 comparisonValue: 100
 },
 thresholds: [
 { value: 90, color: '#10B981', operator: '>=', label: 'Good' },
 { value: 70, color: '#F59E0B', operator: '>=', label: 'Warning' },
 { value: 0, color: '#EF4444', operator: '>=', label: 'Critical' }
 ]
 },
 dataSource: {
 type: 'custom',
 query: 'services.healthy'
 }
 },
 {
 id: uuidv4(),
 type: 'metric',
 title: 'Average Error Rate',
 config: {
 metric: 'errorRate',
 display: {
 format: 'percent',
 decimals: 1,
 unit: '%',
 comparison: 'previous'
 },
 thresholds: [
 { value: 5, color: '#EF4444', operator: '>', label: 'High' },
 { value: 2, color: '#F59E0B', operator: '>', label: 'Medium' },
 { value: 0, color: '#10B981', operator: '>=', label: 'Low' }
 ]
 },
 dataSource: {
 type: 'custom',
 query: 'services.errorRate'
 }
 },
 {
 id: uuidv4(),
 type: 'chart',
 title: 'Request Rate',
 config: {
 visualization: {
 type: 'line',
 xAxis: { type: 'time' },
 yAxis: { label: 'Requests/sec' },
 series: [{ name: 'Requests', dataKey: 'value', color: '#3B82F6' }]
 }
 },
 dataSource: {
 type: 'custom',
 query: 'metrics.requestRate'
 }
 },
 {
 id: uuidv4(),
 type: 'serviceHealth',
 title: 'Service Health',
 config: {
 showTopServices: 5,
 sortBy: 'requests'
 },
 dataSource: {
 type: 'custom',
 query: 'services.health'
 }
 },
 {
 id: uuidv4(),
 type: 'deployment',
 title: 'Recent Deployments',
 config: {
 limit: 10,
 showInProgress: true
 },
 dataSource: {
 type: 'custom',
 query: 'deployments.recent'
 }
 },
 {
 id: uuidv4(),
 type: 'table',
 title: 'Service Metrics',
 config: {
 pageSize: 10,
 sortable: true,
 filterable: true
 },
 dataSource: {
 type: 'custom',
 query: 'services.metrics'
 }
 }
];

const DashboardBuilderPage = () => {
 const [dashboard, setDashboard] = useState<Dashboard | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [_filterByOwnership, _setFilterByOwnership] = useState(true);

 useEffect(() => {
 // Initialize WebSocket service
 const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:7007/ws';
 initializeWebSocketService(wsUrl);

 // Load dashboard from persistence service or create default
 const loadDashboard = async () => {
 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 const savedDashboard = await persistenceService.loadDashboard();
 
 if (savedDashboard) {
 setDashboard(savedDashboard);
 } else {
 createNewDashboard();
 }
 } catch (error) {
 console.error('Failed to load saved dashboard:', error);
 createNewDashboard();
 }
 
 setIsLoading(false);
 };

 const createNewDashboard = () => {
 const newDashboard = createDefaultDashboard();
 const widgets = createDefaultWidgets();
 
 // Create layout items for widgets
 const layoutItems = widgets.map((widget, index) => ({
 i: widget.id,
 x: (index % 4) * 6,
 y: Math.floor(index / 4) * 4,
 w: 6,
 h: 4,
 minW: 3,
 minH: 2
 }));

 newDashboard.widgets = widgets;
 newDashboard.layout.layouts = {
 lg: layoutItems,
 md: layoutItems.map(item => ({ ...item, w: 8, x: (widgets.findIndex(w => w.id === item.i) % 3) * 8 })),
 sm: layoutItems.map(item => ({ ...item, w: 12, x: 0 }))
 };

 setDashboard(newDashboard);
 };

 void loadDashboard();
 }, []);

 // Auto-save dashboard changes
 useEffect(() => {
 if (dashboard) {
 const saveTimer = setTimeout(() => {
 void (async () => {
 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 await persistenceService.saveDashboard(dashboard);
 } catch (error) {
 console.error('Failed to auto-save dashboard:', error);
 }
 })();
 }, 1000);

 return () => clearTimeout(saveTimer);
 }
 }, [dashboard]);

 if (isLoading) {
 return (
 <div className="flex items-center justify-center h-screen">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <DashboardProvider initialDashboard={dashboard}>
 <div className="h-screen flex flex-col">
 <DashboardCanvas className="flex-1" />
 </div>
 </DashboardProvider>
 );
};

export default DashboardBuilderPage;