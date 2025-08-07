'use client';

import React from 'react';
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext';
import { 
 Home,
 Package,
 Network,
 Plus,
 FileCode,
 Zap,
 GitBranch,
 Rocket,
 Shield,
 BarChart3,
 DollarSign,
 Activity,
 ClipboardList,
 BookOpen,
 Code2,
 Users,
 RefreshCw
} from 'lucide-react';

interface FeatureToggleItem {
 key: keyof ReturnType<typeof useFeatureToggles>['toggles'];
 label: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
}

const featureToggles: FeatureToggleItem[] = [
 {
 key: 'dashboard',
 label: 'Dashboard',
 description: 'Platform overview and metrics',
 icon: Home
 },
 {
 key: 'serviceCatalog',
 label: 'Service Catalog',
 description: 'Browse and manage services',
 icon: Package
 },
 {
 key: 'relationships',
 label: 'Relationships',
 description: 'Service dependency map',
 icon: Network
 },
 {
 key: 'create',
 label: 'Create',
 description: 'Create new services and entities',
 icon: Plus
 },
 {
 key: 'templates',
 label: 'Templates',
 description: 'Templates & Software Catalog',
 icon: FileCode
 },
 {
 key: 'plugins',
 label: 'Plugins',
 description: 'Plugin marketplace',
 icon: Zap
 },
 {
 key: 'workflows',
 label: 'Workflows',
 description: 'Workflow automation and approvals',
 icon: GitBranch
 },
 {
 key: 'deployments',
 label: 'Deployments',
 description: 'Deployment pipelines and releases',
 icon: Rocket
 },
 {
 key: 'healthMonitor',
 label: 'Health Monitor',
 description: 'Service health and monitoring',
 icon: Shield
 },
 {
 key: 'analytics',
 label: 'Analytics',
 description: 'Performance analytics and insights',
 icon: BarChart3
 },
 {
 key: 'costTracking',
 label: 'Cost Tracking',
 description: 'Service cost optimization',
 icon: DollarSign
 },
 {
 key: 'monitoring',
 label: 'Monitoring',
 description: 'System monitoring and observability',
 icon: Activity
 },
 {
 key: 'activity',
 label: 'Activity',
 description: 'Audit logs and activity tracking',
 icon: ClipboardList
 },
 {
 key: 'documentation',
 label: 'Documentation',
 description: 'Platform documentation',
 icon: BookOpen
 },
 {
 key: 'apiDocs',
 label: 'API Docs',
 description: 'Interactive API documentation',
 icon: Code2
 },
 {
 key: 'teams',
 label: 'Teams',
 description: 'Team management',
 icon: Users
 }
];

export function FeatureTogglesSettings() {
 const { toggles, updateToggle, resetToDefaults } = useFeatureToggles();

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Feature Toggles
 </h2>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Enable or disable features in the sidebar navigation
 </p>
 </div>
 <button
 onClick={resetToDefaults}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Reset to Defaults
 </button>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
 {featureToggles.map((feature) => {
 const Icon = feature.icon;
 return (
 <div key={feature.key} className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
 <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {feature.label}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {feature.description}
 </p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={toggles[feature.key]}
 onChange={(e) => updateToggle(feature.key, e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
 </label>
 </div>
 );
 })}
 </div>

 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
 <p className="text-sm text-blue-800 dark:text-blue-200">
 <strong>Note:</strong> Changes to feature toggles are saved automatically and will persist across sessions.
 The Dashboard cannot be disabled as it is the default landing page.
 </p>
 </div>
 </div>
 );
}