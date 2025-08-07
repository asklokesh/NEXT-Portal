'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { motion, AnimatePresence } from 'framer-motion';
import {
 Settings,
 Bell,
 Monitor,
 Palette,
 Globe,
 Shield,
 Save,
 RotateCcw,
 Download,
 Upload,
 Trash2,
 Plus,
 X,
 AlertCircle
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export interface UserPreferences {
 // Appearance
 theme: 'light' | 'dark' | 'auto';
 colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'red';
 compactMode: boolean;
 sidebarCollapsed: boolean;
 fontSize: 'small' | 'medium' | 'large';
 
 // Dashboard
 defaultDashboard: string;
 dashboardRefreshRate: number; // in seconds
 showWelcomeMessage: boolean;
 quickActions: string[];
 favoriteServices: string[];
 
 // Notifications
 emailNotifications: boolean;
 pushNotifications: boolean;
 digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
 notificationTypes: {
 deployments: boolean;
 incidents: boolean;
 updates: boolean;
 mentions: boolean;
 };
 
 // Search & Navigation
 recentSearchLimit: number;
 defaultSearchFilters: string[];
 bookmarks: Array<{
 id: string;
 name: string;
 url: string;
 category: string;
 }>;
 
 // Privacy & Security
 profileVisibility: 'public' | 'team' | 'private';
 activityTracking: boolean;
 dataSharing: boolean;
 twoFactorEnabled: boolean;
 
 // Advanced
 developerMode: boolean;
 debugInfo: boolean;
 experimentalFeatures: boolean;
 apiSettings: {
 timeout: number;
 retries: number;
 batchSize: number;
 };
}

const defaultPreferences: UserPreferences = {
 theme: 'auto',
 colorScheme: 'blue',
 compactMode: false,
 sidebarCollapsed: false,
 fontSize: 'medium',
 defaultDashboard: 'overview',
 dashboardRefreshRate: 30,
 showWelcomeMessage: true,
 quickActions: ['create-service', 'browse-catalog', 'view-docs'],
 favoriteServices: [],
 emailNotifications: true,
 pushNotifications: true,
 digestFrequency: 'daily',
 notificationTypes: {
 deployments: true,
 incidents: true,
 updates: false,
 mentions: true
 },
 recentSearchLimit: 10,
 defaultSearchFilters: [],
 bookmarks: [],
 profileVisibility: 'team',
 activityTracking: true,
 dataSharing: false,
 twoFactorEnabled: false,
 developerMode: false,
 debugInfo: false,
 experimentalFeatures: false,
 apiSettings: {
 timeout: 30000,
 retries: 3,
 batchSize: 100
 }
};

interface UserPreferencesProps {
 isOpen: boolean;
 onClose: () => void;
}

export default function UserPreferences({ isOpen, onClose }: UserPreferencesProps) {
 const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
 const [activeTab, setActiveTab] = useState('appearance');
 const [hasChanges, setHasChanges] = useState(false);
 const [saving, setSaving] = useState(false);
 const [_showAdvanced, _setShowAdvanced] = useState(false);

 // Load preferences from localStorage
 useEffect(() => {
 const saved = localStorage.getItem('user-preferences');
 if (saved) {
 try {
 const parsed = JSON.parse(saved);
 setPreferences({ ...defaultPreferences, ...parsed });
 } catch (error) {
 console.warn('Failed to load preferences:', error);
 }
 }
 }, []);

 // Track changes
 useEffect(() => {
 const saved = localStorage.getItem('user-preferences');
 const currentPrefsString = JSON.stringify(preferences);
 const savedPrefsString = saved || JSON.stringify(defaultPreferences);
 setHasChanges(currentPrefsString !== savedPrefsString);
 }, [preferences]);

 const updatePreference = <K extends keyof UserPreferences>(
 key: K,
 value: UserPreferences[K]
 ) => {
 setPreferences(prev => ({ ...prev, [key]: value }));
 };

 const updateNestedPreference = <K extends keyof UserPreferences>(
 key: K,
 nested: Partial<UserPreferences[K]>
 ) => {
 setPreferences(prev => ({
 ...prev,
 [key]: { ...prev[key], ...nested }
 }));
 };

 const savePreferences = async () => {
 try {
 setSaving(true);
 localStorage.setItem('user-preferences', JSON.stringify(preferences));
 
 // Apply theme changes immediately
 if (preferences.theme === 'dark') {
 document.documentElement.classList.add('dark');
 } else if (preferences.theme === 'light') {
 document.documentElement.classList.remove('dark');
 } else {
 // Auto mode - check system preference
 if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
 document.documentElement.classList.add('dark');
 } else {
 document.documentElement.classList.remove('dark');
 }
 }
 
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 toast.success('Preferences saved successfully');
 setHasChanges(false);
 } catch (error) {
 console.error('Failed to save preferences:', error);
 toast.error('Failed to save preferences');
 } finally {
 setSaving(false);
 }
 };

 const resetPreferences = () => {
 setPreferences(defaultPreferences);
 toast.info('Preferences reset to defaults');
 };

 const exportPreferences = () => {
 const dataStr = JSON.stringify(preferences, null, 2);
 const dataBlob = new Blob([dataStr], { type: 'application/json' });
 const url = URL.createObjectURL(dataBlob);
 const link = document.createElement('a');
 link.href = url;
 link.download = 'backstage-preferences.json';
 link.click();
 URL.revokeObjectURL(url);
 toast.success('Preferences exported');
 };

 const importPreferences = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (e) => {
 try {
 const imported = JSON.parse(e.target?.result as string);
 setPreferences({ ...defaultPreferences, ...imported });
 toast.success('Preferences imported successfully');
 } catch (error) {
 toast.error('Invalid preferences file');
 }
 };
 reader.readAsText(file);
 };

 const addBookmark = () => {
 const name = prompt('Bookmark name:');
 const url = prompt('Bookmark URL:');
 if (name && url) {
 const newBookmark = {
 id: Date.now().toString(),
 name,
 url,
 category: 'general'
 };
 updatePreference('bookmarks', [...preferences.bookmarks, newBookmark]);
 }
 };

 const removeBookmark = (id: string) => {
 updatePreference('bookmarks', preferences.bookmarks.filter(b => b.id !== id));
 };

 const tabs = [
 { id: 'appearance', label: 'Appearance', icon: Palette },
 { id: 'dashboard', label: 'Dashboard', icon: Monitor },
 { id: 'notifications', label: 'Notifications', icon: Bell },
 { id: 'navigation', label: 'Navigation', icon: Globe },
 { id: 'privacy', label: 'Privacy & Security', icon: Shield },
 { id: 'advanced', label: 'Advanced', icon: Settings }
 ];

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
 onClick={onClose}
 >
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 20 }}
 className="relative mx-auto mt-8 mb-8 max-w-6xl h-[calc(100vh-4rem)] overflow-hidden"
 onClick={e => e.stopPropagation()}
 >
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 h-full flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-3">
 <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 User Preferences
 </h2>
 {hasChanges && (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 text-xs rounded-full">
 <AlertCircle className="w-3 h-3" />
 Unsaved changes
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={exportPreferences}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Export preferences"
 >
 <Download className="w-4 h-4" />
 </button>
 
 <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
 title="Import preferences">
 <Upload className="w-4 h-4" />
 <input
 type="file"
 accept=".json"
 className="hidden"
 onChange={importPreferences}
 />
 </label>
 
 <button
 onClick={resetPreferences}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Reset to defaults"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 
 <button
 onClick={onClose}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 <div className="flex flex-1 overflow-hidden">
 {/* Sidebar */}
 <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
 <nav className="space-y-1">
 {tabs.map(tab => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
 activeTab === tab.id
 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
 : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
 }`}
 >
 <Icon className="w-4 h-4" />
 {tab.label}
 </button>
 );
 })}
 </nav>
 </div>

 {/* Content */}
 <div className="flex-1 p-6 overflow-y-auto">
 {activeTab === 'appearance' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Appearance Settings
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Theme
 </label>
 <select
 value={preferences.theme}
 onChange={(e) => updatePreference('theme', e.target.value as any)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="light">Light</option>
 <option value="dark">Dark</option>
 <option value="auto">Auto (System)</option>
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Color Scheme
 </label>
 <div className="flex gap-2">
 {['blue', 'green', 'purple', 'orange', 'red'].map(color => (
 <button
 key={color}
 onClick={() => updatePreference('colorScheme', color as any)}
 className={`w-8 h-8 rounded-full border-2 ${
 preferences.colorScheme === color
 ? 'border-gray-900 dark:border-gray-100'
 : 'border-gray-300 dark:border-gray-600'
 } bg-${color}-500`}
 />
 ))}
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Font Size
 </label>
 <select
 value={preferences.fontSize}
 onChange={(e) => updatePreference('fontSize', e.target.value as any)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="small">Small</option>
 <option value="medium">Medium</option>
 <option value="large">Large</option>
 </select>
 </div>
 </div>
 
 <div className="space-y-4">
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.compactMode}
 onChange={(e) => updatePreference('compactMode', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Compact mode (denser layout)
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.sidebarCollapsed}
 onChange={(e) => updatePreference('sidebarCollapsed', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Collapse sidebar by default
 </span>
 </label>
 </div>
 </div>
 )}

 {activeTab === 'dashboard' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Dashboard Settings
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Default Dashboard
 </label>
 <select
 value={preferences.defaultDashboard}
 onChange={(e) => updatePreference('defaultDashboard', e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="overview">Overview</option>
 <option value="services">Services</option>
 <option value="metrics">Metrics</option>
 <option value="custom">Custom</option>
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Refresh Rate (seconds)
 </label>
 <input
 type="number"
 min="5"
 max="300"
 value={preferences.dashboardRefreshRate}
 onChange={(e) => updatePreference('dashboardRefreshRate', Number(e.target.value))}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 
 <div>
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.showWelcomeMessage}
 onChange={(e) => updatePreference('showWelcomeMessage', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Show welcome message on dashboard
 </span>
 </label>
 </div>
 </div>
 )}

 {activeTab === 'notifications' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Notification Settings
 </h3>
 
 <div className="space-y-4">
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.emailNotifications}
 onChange={(e) => updatePreference('emailNotifications', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Email notifications
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.pushNotifications}
 onChange={(e) => updatePreference('pushNotifications', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Browser push notifications
 </span>
 </label>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Digest Frequency
 </label>
 <select
 value={preferences.digestFrequency}
 onChange={(e) => updatePreference('digestFrequency', e.target.value as any)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="immediate">Immediate</option>
 <option value="hourly">Hourly</option>
 <option value="daily">Daily</option>
 <option value="weekly">Weekly</option>
 </select>
 </div>
 
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
 Notification Types
 </h4>
 <div className="space-y-2">
 {Object.entries(preferences.notificationTypes).map(([type, enabled]) => (
 <label key={type} className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={enabled}
 onChange={(e) => updateNestedPreference('notificationTypes', {
 [type]: e.target.checked
 })}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
 {type}
 </span>
 </label>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'navigation' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Navigation & Search
 </h3>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Recent Search Limit
 </label>
 <input
 type="number"
 min="5"
 max="50"
 value={preferences.recentSearchLimit}
 onChange={(e) => updatePreference('recentSearchLimit', Number(e.target.value))}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <div className="flex items-center justify-between mb-3">
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Bookmarks
 </h4>
 <button
 onClick={addBookmark}
 className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30"
 >
 <Plus className="w-3 h-3" />
 Add
 </button>
 </div>
 
 {preferences.bookmarks.length > 0 ? (
 <div className="space-y-2">
 {preferences.bookmarks.map(bookmark => (
 <div key={bookmark.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
 <span className="text-sm text-gray-900 dark:text-gray-100">
 {bookmark.name}
 </span>
 <button
 onClick={() => removeBookmark(bookmark.id)}
 className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-gray-500 dark:text-gray-400">
 No bookmarks yet
 </p>
 )}
 </div>
 </div>
 )}

 {activeTab === 'privacy' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Privacy & Security
 </h3>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Profile Visibility
 </label>
 <select
 value={preferences.profileVisibility}
 onChange={(e) => updatePreference('profileVisibility', e.target.value as any)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="public">Public</option>
 <option value="team">Team Only</option>
 <option value="private">Private</option>
 </select>
 </div>
 
 <div className="space-y-4">
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.activityTracking}
 onChange={(e) => updatePreference('activityTracking', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Allow activity tracking for analytics
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.dataSharing}
 onChange={(e) => updatePreference('dataSharing', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Share usage data to improve the platform
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.twoFactorEnabled}
 onChange={(e) => updatePreference('twoFactorEnabled', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Enable two-factor authentication
 </span>
 </label>
 </div>
 </div>
 )}

 {activeTab === 'advanced' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Advanced Settings
 </h3>
 
 <div className="space-y-4">
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.developerMode}
 onChange={(e) => updatePreference('developerMode', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Developer mode (show technical details)
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.debugInfo}
 onChange={(e) => updatePreference('debugInfo', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Show debug information
 </span>
 </label>
 
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={preferences.experimentalFeatures}
 onChange={(e) => updatePreference('experimentalFeatures', e.target.checked)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Enable experimental features
 </span>
 </label>
 </div>
 
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
 API Settings
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
 Timeout (ms)
 </label>
 <input
 type="number"
 min="1000"
 max="60000"
 value={preferences.apiSettings.timeout}
 onChange={(e) => updateNestedPreference('apiSettings', {
 timeout: Number(e.target.value)
 })}
 className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
 Retries
 </label>
 <input
 type="number"
 min="0"
 max="10"
 value={preferences.apiSettings.retries}
 onChange={(e) => updateNestedPreference('apiSettings', {
 retries: Number(e.target.value)
 })}
 className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
 Batch Size
 </label>
 <input
 type="number"
 min="10"
 max="1000"
 value={preferences.apiSettings.batchSize}
 onChange={(e) => updateNestedPreference('apiSettings', {
 batchSize: Number(e.target.value)
 })}
 className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
 <div className="text-sm text-gray-500 dark:text-gray-400">
 Changes are saved automatically
 </div>
 
 <div className="flex items-center gap-3">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
 >
 Cancel
 </button>
 
 <button
 onClick={savePreferences}
 disabled={!hasChanges || saving}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {saving ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 Saving...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Save Changes
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
}