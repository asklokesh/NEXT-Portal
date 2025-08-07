'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
 Package,
 GitBranch,
 Code,
 Users,
 User,
 Globe,
 Database,
 ChevronRight,
 Plus
} from 'lucide-react';

interface EntityType {
 kind: string;
 title: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
 color: string;
}

const ENTITY_TYPES: EntityType[] = [
 {
 kind: 'Component',
 title: 'Component',
 description: 'A piece of software - service, website, library, or other',
 icon: Package,
 color: 'blue'
 },
 {
 kind: 'System',
 title: 'System',
 description: 'A collection of components that work together',
 icon: GitBranch,
 color: 'purple'
 },
 {
 kind: 'API',
 title: 'API',
 description: 'An interface that components can provide or consume',
 icon: Code,
 color: 'green'
 },
 {
 kind: 'Group',
 title: 'Group',
 description: 'A team or organizational unit',
 icon: Users,
 color: 'orange'
 },
 {
 kind: 'User',
 title: 'User',
 description: 'An individual person in the organization',
 icon: User,
 color: 'pink'
 },
 {
 kind: 'Domain',
 title: 'Domain',
 description: 'A business domain that systems belong to',
 icon: Globe,
 color: 'indigo'
 },
 {
 kind: 'Resource',
 title: 'Resource',
 description: 'Infrastructure or external resources',
 icon: Database,
 color: 'gray'
 }
];

export default function CreateEntityPage() {
 const router = useRouter();
 const [selectedType, setSelectedType] = useState<string | null>(null);

 const handleSelectType = (kind: string) => {
 router.push(`/catalog/${kind}/create`);
 };

 const getColorClasses = (color: string) => {
 const colors: Record<string, string> = {
 blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30',
 purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30',
 green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30',
 orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/30',
 pink: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 hover:bg-pink-200 dark:hover:bg-pink-900/30',
 indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/30',
 gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
 };
 return colors[color] || colors.gray;
 };

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* Header */}
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Create New Entity
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Choose the type of entity you want to create
 </p>
 </div>

 {/* Entity Type Selection */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {ENTITY_TYPES.map((entityType) => {
 const Icon = entityType.icon;
 return (
 <button
 key={entityType.kind}
 onClick={() => handleSelectType(entityType.kind)}
 className={`group relative flex items-start p-6 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-md transition-all ${
 selectedType === entityType.kind
 ? 'border-blue-500 ring-2 ring-blue-500'
 : 'border-gray-200 dark:border-gray-700'
 }`}
 >
 <div className={`p-3 rounded-lg ${getColorClasses(entityType.color)}`}>
 <Icon className="w-6 h-6" />
 </div>
 
 <div className="ml-4 flex-1 text-left">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {entityType.title}
 </h3>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 {entityType.description}
 </p>
 </div>
 
 <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 ml-2" />
 </button>
 );
 })}
 </div>

 {/* Quick Actions */}
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Other Ways to Add Entities
 </h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
 <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Import from URL
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Import existing catalog-info.yaml files from a Git repository
 </p>
 <button className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
 Import from URL 
 </button>
 </div>
 </div>
 
 <div className="flex items-start gap-3">
 <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
 <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Auto-discovery
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Automatically discover entities from your infrastructure
 </p>
 <button className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
 Configure discovery 
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Templates Suggestion */}
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
 <div className="flex items-start">
 <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
 <div>
 <h3 className="font-medium text-blue-900 dark:text-blue-100">
 Looking to create a new service?
 </h3>
 <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
 Use our software templates to quickly scaffold new services with best practices built-in.
 </p>
 <button
 onClick={() => router.push('/templates')}
 className="mt-3 inline-flex items-center px-3 py-1.5 border border-blue-300 dark:border-blue-700 text-sm font-medium rounded-md text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30"
 >
 Browse Templates
 <ChevronRight className="w-4 h-4 ml-1" />
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}