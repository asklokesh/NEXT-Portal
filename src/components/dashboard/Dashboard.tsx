'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus */

import { 
 LayoutDashboard, 
 Plus, 
 Settings,
 Bell,
 BarChart3,
 FileDown,
 Share2,
 Palette,
 Monitor,
 Smartphone
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import { AlertManager } from './Alerts/AlertManager';
import { DashboardCanvas } from './DashboardBuilder/DashboardCanvas';
import { DashboardProvider } from './hooks/useDashboard';
import { initializeWebSocketService } from './services/websocket';

import type { Dashboard as DashboardType } from './types';

interface DashboardProps {
 className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
 const [currentView, setCurrentView] = useState<'dashboard' | 'alerts' | 'analytics'>('dashboard');
 const [selectedDashboard, setSelectedDashboard] = useState<DashboardType | null>(null);
 const [dashboards, setDashboards] = useState<DashboardType[]>([]);
 const [showCreateModal, setShowCreateModal] = useState(false);

 // Initialize WebSocket service
 useEffect(() => {
 // In a real app, this URL would come from config
 const wsUrl = 'ws://localhost:8080/dashboard-ws';
 try {
 const wsService = initializeWebSocketService(wsUrl);
 wsService.connect();
 
 return () => {
 wsService.disconnect();
 };
 } catch (error) {
 console.warn('WebSocket service not available in demo mode');
 }
 }, []);

 // Set selected dashboard in context when it changes
 useEffect(() => {
 if (selectedDashboard && currentView === 'dashboard') {
 // This would be handled by the DashboardProvider
 }
 }, [selectedDashboard, currentView]);

 // Load mock dashboards
 useEffect(() => {
 const mockDashboards: DashboardType[] = [
 {
 id: 'dash-1',
 name: 'Platform Overview',
 description: 'High-level metrics for the entire platform',
 owner: 'platform-team',
 type: 'platform',
 layout: {
 type: 'grid',
 columns: 24,
 rowHeight: 60,
 margin: [16, 16],
 containerPadding: [16, 16],
 layouts: {
 lg: [
 { i: 'widget-1', x: 0, y: 0, w: 6, h: 4 },
 { i: 'widget-2', x: 6, y: 0, w: 6, h: 4 },
 { i: 'widget-3', x: 12, y: 0, w: 6, h: 4 },
 { i: 'widget-4', x: 18, y: 0, w: 6, h: 4 },
 { i: 'widget-5', x: 0, y: 4, w: 12, h: 6 },
 { i: 'widget-6', x: 12, y: 4, w: 12, h: 6 }
 ],
 md: [
 { i: 'widget-1', x: 0, y: 0, w: 10, h: 4 },
 { i: 'widget-2', x: 10, y: 0, w: 10, h: 4 },
 { i: 'widget-3', x: 0, y: 4, w: 10, h: 4 },
 { i: 'widget-4', x: 10, y: 4, w: 10, h: 4 },
 { i: 'widget-5', x: 0, y: 8, w: 20, h: 6 },
 { i: 'widget-6', x: 0, y: 14, w: 20, h: 6 }
 ],
 sm: [
 { i: 'widget-1', x: 0, y: 0, w: 12, h: 4 },
 { i: 'widget-2', x: 0, y: 4, w: 12, h: 4 },
 { i: 'widget-3', x: 0, y: 8, w: 12, h: 4 },
 { i: 'widget-4', x: 0, y: 12, w: 12, h: 4 },
 { i: 'widget-5', x: 0, y: 16, w: 12, h: 6 },
 { i: 'widget-6', x: 0, y: 22, w: 12, h: 6 }
 ]
 }
 },
 widgets: [
 {
 id: 'widget-1',
 type: 'metric',
 title: 'Total Services',
 config: {
 display: { format: 'number', unit: 'services' }
 }
 },
 {
 id: 'widget-2',
 type: 'metric',
 title: 'Active Deployments',
 config: {
 display: { format: 'number', unit: 'deployments' }
 }
 },
 {
 id: 'widget-3',
 type: 'metric',
 title: 'Success Rate',
 config: {
 display: { format: 'percentage', unit: '%' }
 }
 },
 {
 id: 'widget-4',
 type: 'metric',
 title: 'Avg Response Time',
 config: {
 display: { format: 'number', unit: 'ms' }
 }
 },
 {
 id: 'widget-5',
 type: 'chart',
 title: 'Deployment Trends',
 config: {
 visualization: {
 type: 'line',
 series: [{ name: 'Deployments', dataKey: 'value' }]
 }
 }
 },
 {
 id: 'widget-6',
 type: 'serviceHealth',
 title: 'Service Health Status',
 config: {}
 }
 ],
 refreshInterval: 30,
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-20T15:30:00Z',
 isPublic: true,
 tags: ['platform', 'overview', 'monitoring']
 },
 {
 id: 'dash-2',
 name: 'Development Team',
 description: 'Metrics focused on development productivity',
 owner: 'dev-team',
 type: 'team',
 layout: {
 type: 'grid',
 columns: 24,
 rowHeight: 60,
 margin: [16, 16],
 containerPadding: [16, 16],
 layouts: {
 lg: [
 { i: 'widget-7', x: 0, y: 0, w: 12, h: 6 },
 { i: 'widget-8', x: 12, y: 0, w: 12, h: 6 },
 { i: 'widget-9', x: 0, y: 6, w: 24, h: 8 }
 ]
 }
 },
 widgets: [
 {
 id: 'widget-7',
 type: 'deployment',
 title: 'Recent Deployments',
 config: {}
 },
 {
 id: 'widget-8',
 type: 'chart',
 title: 'Code Quality Trends',
 config: {
 visualization: {
 type: 'area',
 series: [{ name: 'Coverage', dataKey: 'coverage' }]
 }
 }
 },
 {
 id: 'widget-9',
 type: 'table',
 title: 'Service Performance',
 config: {}
 }
 ],
 refreshInterval: 60,
 createdAt: '2024-01-10T09:00:00Z',
 updatedAt: '2024-01-18T14:20:00Z',
 isPublic: false,
 tags: ['development', 'team', 'productivity']
 }
 ];

 setDashboards(mockDashboards);
 setSelectedDashboard(mockDashboards[0]);
 }, []);

 const handleCreateDashboard = (name: string, description: string) => {
 const newDashboard: DashboardType = {
 id: `dash-${Date.now()}`,
 name,
 description,
 owner: 'current-user',
 type: 'personal',
 layout: {
 type: 'grid',
 columns: 24,
 rowHeight: 60,
 margin: [16, 16],
 containerPadding: [16, 16],
 layouts: { lg: [] }
 },
 widgets: [],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 isPublic: false,
 tags: []
 };

 setDashboards(prev => [...prev, newDashboard]);
 setSelectedDashboard(newDashboard);
 setShowCreateModal(false);
 };

 return (
 <div className={cn('flex h-screen bg-background', className)}>
 {/* Sidebar */}
 <div className="w-64 border-r border-border bg-muted/50 flex flex-col">
 {/* Header */}
 <div className="p-4 border-b border-border">
 <h1 className="text-lg font-semibold flex items-center gap-2">
 <LayoutDashboard className="w-5 h-5" />
 Analytics Hub
 </h1>
 </div>

 {/* Navigation */}
 <div className="p-4">
 <div className="space-y-1">
 <button
 onClick={() => setCurrentView('dashboard')}
 className={cn(
 'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md',
 'hover:bg-accent hover:text-accent-foreground',
 currentView === 'dashboard' && 'bg-accent text-accent-foreground'
 )}
 >
 <Monitor className="w-4 h-4" />
 Dashboards
 </button>
 
 <button
 onClick={() => setCurrentView('alerts')}
 className={cn(
 'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md',
 'hover:bg-accent hover:text-accent-foreground',
 currentView === 'alerts' && 'bg-accent text-accent-foreground'
 )}
 >
 <Bell className="w-4 h-4" />
 Alerts
 </button>
 
 <button
 onClick={() => setCurrentView('analytics')}
 className={cn(
 'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md',
 'hover:bg-accent hover:text-accent-foreground',
 currentView === 'analytics' && 'bg-accent text-accent-foreground'
 )}
 >
 <BarChart3 className="w-4 h-4" />
 Analytics
 </button>
 </div>
 </div>

 {/* Dashboard List */}
 {currentView === 'dashboard' && (
 <div className="flex-1 overflow-auto p-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium">Dashboards</h3>
 <button
 onClick={() => setShowCreateModal(true)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>
 
 <div className="space-y-1">
 {dashboards.map((dashboard) => (
 <button
 key={dashboard.id}
 onClick={() => setSelectedDashboard(dashboard)}
 className={cn(
 'w-full text-left p-2 rounded-md text-sm',
 'hover:bg-accent hover:text-accent-foreground',
 selectedDashboard?.id === dashboard.id && 'bg-accent text-accent-foreground'
 )}
 >
 <div className="font-medium">{dashboard.name}</div>
 <div className="text-xs text-muted-foreground">
 {dashboard.widgets.length} widgets
 </div>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Main Content */}
 <div className="flex-1 flex flex-col">
 {currentView === 'dashboard' && selectedDashboard ? (
 <DashboardProvider initialDashboard={selectedDashboard}>
 <DashboardCanvas />
 </DashboardProvider>
 ) : currentView === 'alerts' ? (
 <AlertManager />
 ) : (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="font-semibold mb-2">Analytics Coming Soon</h3>
 <p className="text-sm text-muted-foreground">
 Advanced analytics and reporting features will be available here
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Create Dashboard Modal */}
 {showCreateModal && (
 <CreateDashboardModal
 onClose={() => setShowCreateModal(false)}
 onCreate={handleCreateDashboard}
 />
 )}
 </div>
 );
};

// Create Dashboard Modal Component
interface CreateDashboardModalProps {
 onClose: () => void;
 onCreate: (name: string, description: string) => void;
}

const CreateDashboardModal: React.FC<CreateDashboardModalProps> = ({ onClose, onCreate }) => {
 const [name, setName] = useState('');
 const [description, setDescription] = useState('');

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (name.trim()) {
 onCreate(name.trim(), description.trim());
 }
 };

 return (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-card border border-border rounded-lg w-full max-w-md">
 <div className="p-6">
 <h3 className="text-lg font-semibold mb-4">Create New Dashboard</h3>
 
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-2">Name</label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="My Dashboard"
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 autoFocus
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium mb-2">Description</label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Brief description of this dashboard..."
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 rows={3}
 />
 </div>
 
 <div className="flex justify-end gap-2 pt-4">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={!name.trim()}
 className={cn(
 'px-4 py-2 rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'disabled:opacity-50 disabled:cursor-not-allowed'
 )}
 >
 Create
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}