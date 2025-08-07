'use client';

import React, { useState, useEffect } from 'react';
import {
 Bell,
 Mail,
 MessageSquare,
 Smartphone,
 Clock,
 Filter,
 Volume2,
 VolumeX,
 Save,
 ArrowLeft,
 Zap,
 Users,
 AlertTriangle,
 CheckCircle,
 Info,
 User,
 Settings,
 Globe,
 Slack,
 MessageCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface NotificationSettings {
 preferences: {
 email: {
 enabled: boolean;
 types: string[];
 frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
 };
 push: {
 enabled: boolean;
 types: string[];
 };
 inApp: {
 enabled: boolean;
 types: string[];
 };
 slack: {
 enabled: boolean;
 webhookUrl?: string;
 channel?: string;
 types: string[];
 };
 teams: {
 enabled: boolean;
 webhookUrl?: string;
 types: string[];
 };
 };
 filters: {
 priorities: string[];
 environments: string[];
 entityTypes: string[];
 keywords: string[];
 };
 quietHours: {
 enabled: boolean;
 start: string;
 end: string;
 timezone: string;
 };
}

const defaultSettings: NotificationSettings = {
 preferences: {
 email: {
 enabled: true,
 types: ['error', 'warning', 'mention'],
 frequency: 'immediate'
 },
 push: {
 enabled: true,
 types: ['error', 'warning', 'mention']
 },
 inApp: {
 enabled: true,
 types: ['error', 'warning', 'success', 'info', 'mention', 'system', 'alert']
 },
 slack: {
 enabled: false,
 types: ['error', 'warning']
 },
 teams: {
 enabled: false,
 types: ['error', 'warning']
 }
 },
 filters: {
 priorities: ['urgent', 'high', 'medium', 'low'],
 environments: ['production', 'staging', 'development'],
 entityTypes: ['component', 'api', 'website', 'service'],
 keywords: []
 },
 quietHours: {
 enabled: false,
 start: '22:00',
 end: '08:00',
 timezone: 'UTC'
 }
};

const notificationTypes = [
 { id: 'error', label: 'Errors', icon: AlertTriangle, color: 'text-red-600' },
 { id: 'warning', label: 'Warnings', icon: AlertTriangle, color: 'text-orange-600' },
 { id: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-600' },
 { id: 'info', label: 'Information', icon: Info, color: 'text-blue-600' },
 { id: 'mention', label: 'Mentions', icon: User, color: 'text-purple-600' },
 { id: 'system', label: 'System', icon: Settings, color: 'text-gray-600' },
 { id: 'alert', label: 'Alerts', icon: Bell, color: 'text-red-600' }
];

const priorities = [
 { id: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
 { id: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
 { id: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
 { id: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' }
];

const environments = [
 { id: 'production', label: 'Production' },
 { id: 'staging', label: 'Staging' },
 { id: 'development', label: 'Development' }
];

const entityTypes = [
 { id: 'component', label: 'Components' },
 { id: 'api', label: 'APIs' },
 { id: 'website', label: 'Websites' },
 { id: 'service', label: 'Services' }
];

const timezones = [
 'UTC',
 'America/New_York',
 'America/Chicago',
 'America/Denver',
 'America/Los_Angeles',
 'Europe/London',
 'Europe/Paris',
 'Europe/Berlin',
 'Asia/Tokyo',
 'Asia/Shanghai',
 'Australia/Sydney'
];

export default function NotificationSettingsPage() {
 const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [newKeyword, setNewKeyword] = useState('');

 useEffect(() => {
 loadSettings();
 }, []);

 const loadSettings = async () => {
 try {
 setLoading(true);
 const response = await fetch('/api/notifications/settings');
 
 if (response.ok) {
 const data = await response.json();
 setSettings(data.settings || defaultSettings);
 } else {
 // Use default settings if none exist
 setSettings(defaultSettings);
 }
 } catch (error) {
 console.error('Failed to load notification settings:', error);
 toast.error('Failed to load settings');
 setSettings(defaultSettings);
 } finally {
 setLoading(false);
 }
 };

 const saveSettings = async () => {
 try {
 setSaving(true);
 
 const response = await fetch('/api/notifications/settings', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(settings)
 });

 if (response.ok) {
 toast.success('Settings saved successfully');
 } else {
 throw new Error('Failed to save settings');
 }
 } catch (error) {
 console.error('Failed to save settings:', error);
 toast.error('Failed to save settings');
 } finally {
 setSaving(false);
 }
 };

 const updateChannelPreference = (channel: keyof NotificationSettings['preferences'], field: string, value: any) => {
 setSettings(prev => ({
 ...prev,
 preferences: {
 ...prev.preferences,
 [channel]: {
 ...prev.preferences[channel],
 [field]: value
 }
 }
 }));
 };

 const toggleNotificationType = (channel: keyof NotificationSettings['preferences'], type: string) => {
 const currentTypes = settings.preferences[channel].types;
 const newTypes = currentTypes.includes(type)
 ? currentTypes.filter(t => t !== type)
 : [...currentTypes, type];
 
 updateChannelPreference(channel, 'types', newTypes);
 };

 const updateFilter = (filterType: keyof NotificationSettings['filters'], value: any) => {
 setSettings(prev => ({
 ...prev,
 filters: {
 ...prev.filters,
 [filterType]: value
 }
 }));
 };

 const updateQuietHours = (field: keyof NotificationSettings['quietHours'], value: any) => {
 setSettings(prev => ({
 ...prev,
 quietHours: {
 ...prev.quietHours,
 [field]: value
 }
 }));
 };

 const addKeyword = () => {
 if (newKeyword.trim() && !settings.filters.keywords.includes(newKeyword.trim())) {
 updateFilter('keywords', [...settings.filters.keywords, newKeyword.trim()]);
 setNewKeyword('');
 }
 };

 const removeKeyword = (keyword: string) => {
 updateFilter('keywords', settings.filters.keywords.filter(k => k !== keyword));
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Link
 href="/notifications"
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <ArrowLeft className="w-5 h-5" />
 </Link>
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Notification Settings
 </h1>
 <p className="text-gray-600 dark:text-gray-400 mt-1">
 Configure how and when you receive notifications
 </p>
 </div>
 </div>
 
 <button
 onClick={saveSettings}
 disabled={saving}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Save className="w-4 h-4" />
 {saving ? 'Saving...' : 'Save Settings'}
 </button>
 </div>

 {/* Notification Channels */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
 Notification Channels
 </h2>

 <div className="space-y-8">
 {/* In-App Notifications */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Bell className="w-5 h-5 text-blue-600" />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">In-App Notifications</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Real-time notifications in the application
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.inApp.enabled}
 onChange={(e) => updateChannelPreference('inApp', 'enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 
 {settings.preferences.inApp.enabled && (
 <div className="ml-8 grid grid-cols-2 md:grid-cols-4 gap-3">
 {notificationTypes.map(type => {
 const Icon = type.icon;
 return (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.inApp.types.includes(type.id)}
 onChange={() => toggleNotificationType('inApp', type.id)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <Icon className={`w-4 h-4 ${type.color}`} />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 );
 })}
 </div>
 )}
 </div>

 {/* Email Notifications */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Mail className="w-5 h-5 text-green-600" />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">Email Notifications</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Receive notifications via email
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.email.enabled}
 onChange={(e) => updateChannelPreference('email', 'enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 
 {settings.preferences.email.enabled && (
 <div className="ml-8 space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Email Frequency
 </label>
 <select
 value={settings.preferences.email.frequency}
 onChange={(e) => updateChannelPreference('email', 'frequency', e.target.value)}
 className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="immediate">Immediate</option>
 <option value="hourly">Hourly digest</option>
 <option value="daily">Daily digest</option>
 <option value="weekly">Weekly digest</option>
 </select>
 </div>
 
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {notificationTypes.map(type => {
 const Icon = type.icon;
 return (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.email.types.includes(type.id)}
 onChange={() => toggleNotificationType('email', type.id)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <Icon className={`w-4 h-4 ${type.color}`} />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Push Notifications */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Smartphone className="w-5 h-5 text-purple-600" />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">Push Notifications</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Browser and mobile push notifications
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.push.enabled}
 onChange={(e) => updateChannelPreference('push', 'enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 
 {settings.preferences.push.enabled && (
 <div className="ml-8 grid grid-cols-2 md:grid-cols-4 gap-3">
 {notificationTypes.map(type => {
 const Icon = type.icon;
 return (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.push.types.includes(type.id)}
 onChange={() => toggleNotificationType('push', type.id)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <Icon className={`w-4 h-4 ${type.color}`} />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 );
 })}
 </div>
 )}
 </div>

 {/* Slack */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <MessageSquare className="w-5 h-5 text-pink-600" />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">Slack</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Send notifications to Slack channels
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.slack.enabled}
 onChange={(e) => updateChannelPreference('slack', 'enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 
 {settings.preferences.slack.enabled && (
 <div className="ml-8 space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Slack Channel
 </label>
 <input
 type="text"
 placeholder="#alerts"
 value={settings.preferences.slack.channel || ''}
 onChange={(e) => updateChannelPreference('slack', 'channel', e.target.value)}
 className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {notificationTypes.map(type => {
 const Icon = type.icon;
 return (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.slack.types.includes(type.id)}
 onChange={() => toggleNotificationType('slack', type.id)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <Icon className={`w-4 h-4 ${type.color}`} />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Microsoft Teams */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Users className="w-5 h-5 text-blue-600" />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">Microsoft Teams</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Send notifications to Teams channels
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.teams.enabled}
 onChange={(e) => updateChannelPreference('teams', 'enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 
 {settings.preferences.teams.enabled && (
 <div className="ml-8 space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Teams Webhook URL
 </label>
 <input
 type="url"
 placeholder="https://outlook.office.com/webhook/..."
 value={settings.preferences.teams.webhookUrl || ''}
 onChange={(e) => updateChannelPreference('teams', 'webhookUrl', e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {notificationTypes.map(type => {
 const Icon = type.icon;
 return (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.preferences.teams.types.includes(type.id)}
 onChange={() => toggleNotificationType('teams', type.id)}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <Icon className={`w-4 h-4 ${type.color}`} />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 );
 })}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Filters */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
 Notification Filters
 </h2>

 <div className="space-y-6">
 {/* Priority Filter */}
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Priority Levels</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {priorities.map(priority => (
 <label key={priority.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.filters.priorities.includes(priority.id)}
 onChange={(e) => {
 const newPriorities = e.target.checked
 ? [...settings.filters.priorities, priority.id]
 : settings.filters.priorities.filter(p => p !== priority.id);
 updateFilter('priorities', newPriorities);
 }}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
 {priority.label}
 </span>
 </label>
 ))}
 </div>
 </div>

 {/* Environment Filter */}
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Environments</h3>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 {environments.map(env => (
 <label key={env.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.filters.environments.includes(env.id)}
 onChange={(e) => {
 const newEnvs = e.target.checked
 ? [...settings.filters.environments, env.id]
 : settings.filters.environments.filter(e => e !== env.id);
 updateFilter('environments', newEnvs);
 }}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">{env.label}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Entity Type Filter */}
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Entity Types</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {entityTypes.map(type => (
 <label key={type.id} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={settings.filters.entityTypes.includes(type.id)}
 onChange={(e) => {
 const newTypes = e.target.checked
 ? [...settings.filters.entityTypes, type.id]
 : settings.filters.entityTypes.filter(t => t !== type.id);
 updateFilter('entityTypes', newTypes);
 }}
 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Keywords Filter */}
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Keywords</h3>
 <div className="space-y-3">
 <div className="flex gap-2">
 <input
 type="text"
 placeholder="Add keyword filter..."
 value={newKeyword}
 onChange={(e) => setNewKeyword(e.target.value)}
 onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
 className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 <button
 onClick={addKeyword}
 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 Add
 </button>
 </div>
 
 {settings.filters.keywords.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {settings.filters.keywords.map(keyword => (
 <span
 key={keyword}
 className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
 >
 {keyword}
 <button
 onClick={() => removeKeyword(keyword)}
 className="text-gray-500 hover:text-red-600 ml-1"
 >
 ×
 </button>
 </span>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Quiet Hours */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <Clock className="w-5 h-5 text-indigo-600" />
 <div>
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quiet Hours</h2>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Suppress non-urgent notifications during specified hours
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.quietHours.enabled}
 onChange={(e) => updateQuietHours('enabled', e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>

 {settings.quietHours.enabled && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Start Time
 </label>
 <input
 type="time"
 value={settings.quietHours.start}
 onChange={(e) => updateQuietHours('start', e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 End Time
 </label>
 <input
 type="time"
 value={settings.quietHours.end}
 onChange={(e) => updateQuietHours('end', e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Timezone
 </label>
 <select
 value={settings.quietHours.timezone}
 onChange={(e) => updateQuietHours('timezone', e.target.value)}
 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 {timezones.map(tz => (
 <option key={tz} value={tz}>{tz}</option>
 ))}
 </select>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}