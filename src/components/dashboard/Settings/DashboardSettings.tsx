'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, no-alert, jsx-a11y/label-has-associated-control */

import {
 Settings,
 Monitor,
 Palette,
 Clock as _Clock,
 User as _User,
 Database,
 Download,
 Upload,
 RotateCcw,
 Save,
 X,
 ChevronRight,
 Bell,
 Shield,
 Trash2,
 Info
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import { useTheme, ThemeToggle } from '../contexts/ThemeContext';

import type { DashboardPreferences } from '@/services/dashboard/persistence';

interface DashboardSettingsProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (preferences: Partial<DashboardPreferences>) => void;
 currentPreferences: DashboardPreferences;
}

type SettingsSection = 'general' | 'appearance' | 'data' | 'notifications' | 'advanced';

const DashboardSettings: React.FC<DashboardSettingsProps> = ({
 isOpen,
 onClose,
 onSave,
 currentPreferences
}) => {
 const [activeSection, setActiveSection] = useState<SettingsSection>('general');
 const [preferences, setPreferences] = useState<DashboardPreferences>(currentPreferences);
 const [hasChanges, setHasChanges] = useState(false);
 const { theme, setTheme } = useTheme();

 useEffect(() => {
 setPreferences(currentPreferences);
 setHasChanges(false);
 }, [currentPreferences]);

 const updatePreference = <K extends keyof DashboardPreferences>(
 key: K,
 value: DashboardPreferences[K]
 ) => {
 setPreferences(prev => ({ ...prev, [key]: value }));
 setHasChanges(true);
 };

 const handleSave = () => {
 onSave(preferences);
 setHasChanges(false);
 };

 const handleReset = () => {
 setPreferences(currentPreferences);
 setHasChanges(false);
 };

 const handleExport = async () => {
 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 const exportData = await persistenceService.exportDashboard();
 
 const blob = new Blob([exportData], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 } catch (error) {
 console.error('Failed to export dashboard:', error);
 }
 };

 const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 try {
 const text = await file.text();
 const { persistenceService } = await import('@/services/dashboard/persistence');
 await persistenceService.importDashboard(text);
 
 // Reload the page to reflect changes
 window.location.reload();
 } catch (error) {
 console.error('Failed to import dashboard:', error);
 alert('Failed to import dashboard configuration. Please check the file format.');
 }
 };

 const clearAllData = async () => {
 if (!confirm('Are you sure you want to clear all dashboard data? This action cannot be undone.')) {
 return;
 }

 try {
 const { persistenceService } = await import('@/services/dashboard/persistence');
 await persistenceService.clearAllData();
 window.location.reload();
 } catch (error) {
 console.error('Failed to clear data:', error);
 }
 };

 const sections = [
 {
 id: 'general' as const,
 label: 'General',
 icon: <Settings className="w-4 h-4" />,
 description: 'Basic dashboard settings'
 },
 {
 id: 'appearance' as const,
 label: 'Appearance',
 icon: <Palette className="w-4 h-4" />,
 description: 'Themes and visual preferences'
 },
 {
 id: 'data' as const,
 label: 'Data & Sync',
 icon: <Database className="w-4 h-4" />,
 description: 'Data refresh and filtering'
 },
 {
 id: 'notifications' as const,
 label: 'Notifications',
 icon: <Bell className="w-4 h-4" />,
 description: 'Alerts and notifications'
 },
 {
 id: 'advanced' as const,
 label: 'Advanced',
 icon: <Shield className="w-4 h-4" />,
 description: 'Import, export, and reset'
 }
 ];

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] flex">
 {/* Sidebar */}
 <div className="w-64 border-r border-border p-4">
 <div className="flex items-center gap-2 mb-6">
 <Settings className="w-5 h-5" />
 <h2 className="font-semibold">Dashboard Settings</h2>
 </div>
 
 <nav className="space-y-1">
 {sections.map(section => (
 <button
 key={section.id}
 onClick={() => setActiveSection(section.id)}
 className={cn(
 'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
 activeSection === section.id
 ? 'bg-primary text-primary-foreground'
 : 'hover:bg-accent hover:text-accent-foreground'
 )}
 >
 {section.icon}
 <div className="flex-1 text-left">
 <div className="font-medium">{section.label}</div>
 <div className={cn(
 'text-xs',
 activeSection === section.id
 ? 'text-primary-foreground/70'
 : 'text-muted-foreground'
 )}>
 {section.description}
 </div>
 </div>
 <ChevronRight className="w-4 h-4" />
 </button>
 ))}
 </nav>
 </div>

 {/* Content */}
 <div className="flex-1 flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border">
 <div>
 <h3 className="text-lg font-semibold">
 {sections.find(s => s.id === activeSection)?.label}
 </h3>
 <p className="text-sm text-muted-foreground">
 {sections.find(s => s.id === activeSection)?.description}
 </p>
 </div>
 <button
 onClick={onClose}
 className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Settings Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {activeSection === 'general' && (
 <div className="space-y-6">
 <div>
 <label className="text-sm font-medium mb-3 block">Auto-save</label>
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.autoSave}
 onChange={(e) => updatePreference('autoSave', e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm">Automatically save dashboard changes</span>
 </div>
 </div>

 <div>
 <label className="text-sm font-medium mb-3 block">Default View</label>
 <select
 value={preferences.defaultView}
 onChange={(e) => updatePreference('defaultView', e.target.value as 'grid' | 'list')}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value="grid">Grid View</option>
 <option value="list">List View</option>
 </select>
 </div>

 <div>
 <label className="text-sm font-medium mb-3 block">Compact Mode</label>
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.compactMode}
 onChange={(e) => updatePreference('compactMode', e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm">Use compact widget spacing</span>
 </div>
 </div>
 </div>
 )}

 {activeSection === 'appearance' && (
 <div className="space-y-6">
 <div>
 <label className="text-sm font-medium mb-3 block">Theme</label>
 <div className="grid grid-cols-3 gap-3">
 {(['light', 'dark', 'system'] as const).map(themeOption => (
 <button
 key={themeOption}
 onClick={() => setTheme(themeOption)}
 className={cn(
 'p-4 border rounded-lg text-center transition-colors',
 theme === themeOption
 ? 'border-primary bg-primary/5'
 : 'border-border hover:bg-accent'
 )}
 >
 <Monitor className="w-6 h-6 mx-auto mb-2" />
 <div className="text-sm font-medium capitalize">{themeOption}</div>
 </button>
 ))}
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 Theme changes apply immediately and persist across sessions
 </p>
 </div>
 </div>
 )}

 {activeSection === 'data' && (
 <div className="space-y-6">
 <div>
 <label className="text-sm font-medium mb-3 block">Auto-refresh</label>
 <div className="flex items-center gap-3 mb-3">
 <input
 type="checkbox"
 checked={preferences.autoRefresh}
 onChange={(e) => updatePreference('autoRefresh', e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm">Enable automatic data refresh</span>
 </div>
 
 {preferences.autoRefresh && (
 <div>
 <label className="text-sm text-muted-foreground mb-2 block">Refresh Interval</label>
 <select
 value={preferences.refreshInterval}
 onChange={(e) => updatePreference('refreshInterval', parseInt(e.target.value))}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value={5}>5 seconds</option>
 <option value={10}>10 seconds</option>
 <option value={30}>30 seconds</option>
 <option value={60}>1 minute</option>
 <option value={300}>5 minutes</option>
 </select>
 </div>
 )}
 </div>

 <div>
 <label className="text-sm font-medium mb-3 block">Service Filtering</label>
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.filterByOwnership}
 onChange={(e) => updatePreference('filterByOwnership', e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm">Only show services I own or am responsible for</span>
 </div>
 </div>
 </div>
 )}

 {activeSection === 'notifications' && (
 <div className="space-y-6">
 <div className="bg-muted/50 p-4 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <Info className="w-4 h-4 text-blue-600" />
 <span className="text-sm font-medium">Coming Soon</span>
 </div>
 <p className="text-sm text-muted-foreground">
 Notification settings will be available in a future update.
 </p>
 </div>
 </div>
 )}

 {activeSection === 'advanced' && (
 <div className="space-y-6">
 <div>
 <h4 className="text-sm font-medium mb-3">Data Management</h4>
 <div className="space-y-3">
 <button
 onClick={handleExport}
 className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent"
 >
 <Download className="w-4 h-4" />
 Export Dashboard
 </button>
 
 <div>
 <input
 type="file"
 accept=".json"
 onChange={handleImport}
 className="hidden"
 id="import-file"
 />
 <label
 htmlFor="import-file"
 className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent cursor-pointer"
 >
 <Upload className="w-4 h-4" />
 Import Dashboard
 </label>
 </div>
 </div>
 </div>

 <div>
 <h4 className="text-sm font-medium mb-3">Reset Options</h4>
 <div className="space-y-3">
 <button
 onClick={clearAllData}
 className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive/10"
 >
 <Trash2 className="w-4 h-4" />
 Clear All Data
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border flex items-center justify-between">
 <div className="text-sm text-muted-foreground">
 {hasChanges && 'You have unsaved changes'}
 </div>
 
 <div className="flex items-center gap-3">
 {hasChanges && (
 <button
 onClick={handleReset}
 className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
 >
 <RotateCcw className="w-4 h-4" />
 Reset
 </button>
 )}
 
 <button
 onClick={handleSave}
 disabled={!hasChanges}
 className={cn(
 'flex items-center gap-2 px-4 py-2 text-sm rounded-md',
 hasChanges
 ? 'bg-primary text-primary-foreground hover:bg-primary/90'
 : 'bg-muted text-muted-foreground cursor-not-allowed'
 )}
 >
 <Save className="w-4 h-4" />
 Save Changes
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

export default DashboardSettings;