'use client';

import { useState, useEffect } from 'react';
import { 
 Settings,
 Bell,
 Shield,
 Database,
 Globe,
 Users,
 Key,
 Mail,
 Palette,
 Code,
 GitBranch,
 Cloud,
 Activity,
 AlertTriangle,
 Check,
 X,
 Save,
 RefreshCw,
 ChevronRight,
 ExternalLink,
 Info,
 Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FeatureTogglesSettings } from '@/components/settings/FeatureTogglesSettings';
// Removed direct import of backstageService to avoid Node.js dependencies in client
// Using API routes instead

interface SettingSection {
 id: string;
 title: string;
 description: string;
 icon: React.ElementType;
}

interface IntegrationStatus {
 name: string;
 status: 'connected' | 'disconnected' | 'error';
 lastSync?: Date;
 description: string;
}

const SettingsPage = () => {
 const [activeSection, setActiveSection] = useState('general');
 const [loading, setLoading] = useState(false);
 const [backstageHealth, setBackstageHealth] = useState<any>(null);
 
 // Settings state
 const [settings, setSettings] = useState({
 general: {
 organizationName: 'My Company',
 organizationUrl: 'https://mycompany.com',
 supportEmail: 'support@mycompany.com',
 timezone: 'America/New_York',
 },
 notifications: {
 emailEnabled: true,
 slackEnabled: false,
 webhookEnabled: false,
 emailFrequency: 'instant',
 notifyOnServiceCreate: true,
 notifyOnServiceUpdate: true,
 notifyOnServiceDelete: false,
 notifyOnCostAlerts: true,
 },
 security: {
 enforceSSO: false,
 allowedDomains: ['mycompany.com'],
 sessionTimeout: 30,
 requireMFA: false,
 apiTokenExpiry: 90,
 },
 integrations: {
 github: {
 enabled: true,
 org: 'my-company',
 token: '••••••••••••••••',
 },
 aws: {
 enabled: true,
 accountId: '123456789012',
 region: 'us-east-1',
 },
 kubernetes: {
 enabled: true,
 clusters: ['production', 'staging'],
 },
 },
 backstage: {
 baseUrl: process.env.NEXT_PUBLIC_BACKSTAGE_URL || 'http://localhost:7007',
 catalogRefreshInterval: 5,
 scaffolderTimeout: 300,
 techDocsEnabled: true,
 searchEnabled: true,
 },
 });

 const sections: SettingSection[] = [
 { id: 'general', title: 'General', description: 'Basic organization settings', icon: Settings },
 { id: 'features', title: 'Feature Toggles', description: 'Enable or disable platform features', icon: Activity },
 { id: 'notifications', title: 'Notifications', description: 'Email and alert preferences', icon: Bell },
 { id: 'security', title: 'Security', description: 'Authentication and access control', icon: Shield },
 { id: 'integrations', title: 'Integrations', description: 'External service connections', icon: Database },
 { id: 'backstage', title: 'Backstage Config', description: 'Backstage backend settings', icon: Code },
 { id: 'api', title: 'API & Webhooks', description: 'API keys and webhook settings', icon: Key },
 ];

 useEffect(() => {
 checkBackstageHealth();
 }, []);

 const checkBackstageHealth = async () => {
 try {
 const response = await fetch('/api/health');
 if (!response.ok) {
 throw new Error('Failed to check health');
 }
 const health = await response.json();
 setBackstageHealth(health);
 } catch (error) {
 console.error('Failed to check Backstage health:', error);
 setBackstageHealth({ status: 'error', details: { error: 'Connection failed' } });
 }
 };

 const handleSave = async (section: string) => {
 setLoading(true);
 try {
 // In a real implementation, this would save to backend
 await new Promise(resolve => setTimeout(resolve, 1000));
 toast.success(`${section} settings saved successfully`);
 } catch (error) {
 toast.error('Failed to save settings');
 } finally {
 setLoading(false);
 }
 };

 const getIntegrationStatus = (): IntegrationStatus[] => {
 return [
 {
 name: 'GitHub',
 status: settings.integrations.github.enabled ? 'connected' : 'disconnected',
 lastSync: new Date(Date.now() - 5 * 60 * 1000),
 description: 'Source code management and CI/CD',
 },
 {
 name: 'AWS',
 status: settings.integrations.aws.enabled ? 'connected' : 'disconnected',
 lastSync: new Date(Date.now() - 15 * 60 * 1000),
 description: 'Cloud infrastructure and services',
 },
 {
 name: 'Kubernetes',
 status: settings.integrations.kubernetes.enabled ? 'connected' : 'disconnected',
 lastSync: new Date(Date.now() - 2 * 60 * 1000),
 description: 'Container orchestration',
 },
 {
 name: 'Backstage',
 status: backstageHealth?.status === 'healthy' ? 'connected' : 
 backstageHealth?.status === 'error' ? 'error' : 'disconnected',
 description: 'Developer portal backend',
 },
 {
 name: 'Slack',
 status: settings.notifications.slackEnabled ? 'connected' : 'disconnected',
 description: 'Team communication',
 },
 ];
 };

 const renderSectionContent = () => {
 switch (activeSection) {
 case 'general':
 return (
 <div className="space-y-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 General Settings
 </h2>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Organization Name
 </label>
 <input
 type="text"
 value={settings.general.organizationName}
 onChange={(e) => setSettings({
 ...settings,
 general: { ...settings.general, organizationName: e.target.value }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Organization URL
 </label>
 <input
 type="url"
 value={settings.general.organizationUrl}
 onChange={(e) => setSettings({
 ...settings,
 general: { ...settings.general, organizationUrl: e.target.value }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Support Email
 </label>
 <input
 type="email"
 value={settings.general.supportEmail}
 onChange={(e) => setSettings({
 ...settings,
 general: { ...settings.general, supportEmail: e.target.value }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Timezone
 </label>
 <select
 value={settings.general.timezone}
 onChange={(e) => setSettings({
 ...settings,
 general: { ...settings.general, timezone: e.target.value }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="America/New_York">Eastern Time</option>
 <option value="America/Chicago">Central Time</option>
 <option value="America/Denver">Mountain Time</option>
 <option value="America/Los_Angeles">Pacific Time</option>
 <option value="UTC">UTC</option>
 </select>
 </div>
 </div>
 </div>
 );

 case 'features':
 return <FeatureTogglesSettings />;

 case 'notifications':
 return (
 <div className="space-y-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Notification Settings
 </h2>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Email Notifications
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Receive notifications via email
 </p>
 </div>
 <button
 onClick={() => setSettings({
 ...settings,
 notifications: { ...settings.notifications, emailEnabled: !settings.notifications.emailEnabled }
 })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full ${
 settings.notifications.emailEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
 settings.notifications.emailEnabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Slack Notifications
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Send notifications to Slack channels
 </p>
 </div>
 <button
 onClick={() => setSettings({
 ...settings,
 notifications: { ...settings.notifications, slackEnabled: !settings.notifications.slackEnabled }
 })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full ${
 settings.notifications.slackEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
 settings.notifications.slackEnabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
 Notification Events
 </h3>
 <div className="space-y-3">
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={settings.notifications.notifyOnServiceCreate}
 onChange={(e) => setSettings({
 ...settings,
 notifications: { ...settings.notifications, notifyOnServiceCreate: e.target.checked }
 })}
 className="rounded border-gray-300 dark:border-gray-600"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Service created
 </span>
 </label>
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={settings.notifications.notifyOnServiceUpdate}
 onChange={(e) => setSettings({
 ...settings,
 notifications: { ...settings.notifications, notifyOnServiceUpdate: e.target.checked }
 })}
 className="rounded border-gray-300 dark:border-gray-600"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Service updated
 </span>
 </label>
 <label className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={settings.notifications.notifyOnCostAlerts}
 onChange={(e) => setSettings({
 ...settings,
 notifications: { ...settings.notifications, notifyOnCostAlerts: e.target.checked }
 })}
 className="rounded border-gray-300 dark:border-gray-600"
 />
 <span className="text-sm text-gray-700 dark:text-gray-300">
 Cost threshold alerts
 </span>
 </label>
 </div>
 </div>
 </div>
 </div>
 );

 case 'backstage':
 return (
 <div className="space-y-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Backstage Configuration
 </h2>
 
 {/* Health Status */}
 <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Connection Status
 </h3>
 <button
 onClick={checkBackstageHealth}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 <div className="flex items-center gap-2">
 {backstageHealth?.status === 'healthy' ? (
 <Check className="w-5 h-5 text-green-600" />
 ) : backstageHealth?.status === 'error' ? (
 <X className="w-5 h-5 text-red-600" />
 ) : (
 <AlertTriangle className="w-5 h-5 text-yellow-600" />
 )}
 <span className="text-sm text-gray-600 dark:text-gray-300">
 {backstageHealth?.status === 'healthy' ? 'Connected to Backstage' : 
 backstageHealth?.status === 'error' ? 'Connection failed' : 
 'Checking connection...'}
 </span>
 </div>
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Backstage Base URL
 </label>
 <input
 type="url"
 value={settings.backstage.baseUrl}
 onChange={(e) => setSettings({
 ...settings,
 backstage: { ...settings.backstage, baseUrl: e.target.value }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
 The URL where your Backstage instance is running
 </p>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Catalog Refresh Interval (minutes)
 </label>
 <input
 type="number"
 value={settings.backstage.catalogRefreshInterval}
 onChange={(e) => setSettings({
 ...settings,
 backstage: { ...settings.backstage, catalogRefreshInterval: parseInt(e.target.value) }
 })}
 className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 TechDocs
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Enable technical documentation integration
 </p>
 </div>
 <button
 onClick={() => setSettings({
 ...settings,
 backstage: { ...settings.backstage, techDocsEnabled: !settings.backstage.techDocsEnabled }
 })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full ${
 settings.backstage.techDocsEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
 settings.backstage.techDocsEnabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Search
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 Enable Backstage search integration
 </p>
 </div>
 <button
 onClick={() => setSettings({
 ...settings,
 backstage: { ...settings.backstage, searchEnabled: !settings.backstage.searchEnabled }
 })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full ${
 settings.backstage.searchEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
 settings.backstage.searchEnabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 </div>
 </div>
 );

 case 'integrations':
 return (
 <div className="space-y-6">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Integrations
 </h2>
 <div className="space-y-4">
 {getIntegrationStatus().map((integration) => (
 <div
 key={integration.name}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-2 h-2 rounded-full ${
 integration.status === 'connected' ? 'bg-green-500' :
 integration.status === 'error' ? 'bg-red-500' :
 'bg-gray-400'
 }`} />
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 {integration.name}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {integration.description}
 </p>
 {integration.lastSync && integration.status === 'connected' && (
 <p className="text-xs text-gray-400 mt-1">
 Last synced: {integration.lastSync.toLocaleTimeString()}
 </p>
 )}
 </div>
 </div>
 <button 
 onClick={() => window.location.href = '/integrations/config'}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
 >
 Configure
 </button>
 </div>
 </div>
 ))}
 </div>
 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
 <div className="flex gap-3">
 <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-sm text-blue-900 dark:text-blue-100">
 Integrations allow your developer portal to connect with external services
 for authentication, source control, cloud resources, and more.
 </p>
 <div className="flex items-center gap-4 mt-2">
 <button
 onClick={() => window.location.href = '/integrations/config'}
 className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
 >
 Open Integration Configuration
 <ChevronRight className="w-3 h-3" />
 </button>
 <a
 href="https://backstage.io/docs/integrations/"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
 >
 Documentation
 <ExternalLink className="w-3 h-3" />
 </a>
 </div>
 </div>
 </div>
 </div>
 </div>
 );

 default:
 return (
 <div className="text-center py-12">
 <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Coming Soon
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 This settings section is under development
 </p>
 </div>
 );
 }
 };

 return (
 <div className="flex h-[calc(100vh-8rem)]">
 {/* Sidebar */}
 <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Settings
 </h2>
 <nav className="space-y-1">
 {sections.map((section) => {
 const Icon = section.icon;
 return (
 <button
 key={section.id}
 onClick={() => setActiveSection(section.id)}
 className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
 activeSection === section.id
 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
 : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
 }`}
 >
 <Icon className="w-4 h-4" />
 <div className="text-left">
 <p className="font-medium">{section.title}</p>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {section.description}
 </p>
 </div>
 </button>
 );
 })}
 </nav>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto">
 <div className="p-8">
 {renderSectionContent()}
 
 {/* Save Button */}
 {['general', 'notifications', 'backstage'].includes(activeSection) && (
 <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
 <button
 onClick={() => handleSave(activeSection)}
 disabled={loading}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
 >
 {loading ? (
 <RefreshCw className="w-4 h-4 animate-spin" />
 ) : (
 <Save className="w-4 h-4" />
 )}
 Save Changes
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

export default SettingsPage;