'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
 Package,
 FileCode,
 Database,
 ChevronRight,
 Zap,
 Sparkles
} from 'lucide-react';

interface CreateOption {
 id: string;
 title: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
 href: string;
 color: string;
 recommended?: boolean;
}

const CREATE_OPTIONS: CreateOption[] = [
 {
 id: 'template',
 title: 'Create from Template',
 description: 'Use a software template to quickly scaffold a new service with best practices',
 icon: FileCode,
 href: '/templates',
 color: 'blue',
 recommended: true
 },
 {
 id: 'entity',
 title: 'Create Catalog Entity',
 description: 'Manually create a new entity in the software catalog',
 icon: Database,
 href: '/catalog/create',
 color: 'purple'
 },
 {
 id: 'plugin',
 title: 'Install Plugin',
 description: 'Browse and install Backstage plugins to extend functionality',
 icon: Package,
 href: '/plugins',
 color: 'green'
 }
];
export default function CreatePage() {
 const router = useRouter();

 const getColorClasses = (color: string) => {
 const colors: Record<string, string> = {
 blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
 purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
 green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
 };
 return colors[color] || colors.blue;
 };

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* Header */}
 <div className="text-center">
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
 What would you like to create?
 </h1>
 <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
 Choose how you want to add new resources to the platform
 </p>
 </div>

 {/* Options Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
 {CREATE_OPTIONS.map((option) => {
 const Icon = option.icon;
 return (
 <button
 key={option.id}
 onClick={() => router.push(option.href)}
 className="group relative flex flex-col items-center text-center p-8 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-lg transition-all hover:scale-105"
 >
 {option.recommended && (
 <div className="absolute -top-3 -right-3">
 <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium px-2 py-1 rounded-full">
 <Sparkles className="w-3 h-3" />
 Recommended
 </div>
 </div>
 )}
 
 <div className={`p-4 rounded-full ${getColorClasses(option.color)} mb-4`}>
 <Icon className="w-8 h-8" />
 </div>
 
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 {option.title}
 </h3>
 
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
 {option.description}
 </p>
 
 <div className="mt-auto flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
 Get Started
 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
 </div>
 </button>
 );
 })}
 </div>

 {/* Quick Tips */}
 <div className="mt-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Quick Tips
 </h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
 <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Use Templates for New Services
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Software templates include CI/CD pipelines, monitoring, and best practices out of the box
 </p>
 </div>
 </div>
 
 <div className="flex items-start gap-3">
 <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
 <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Register Existing Services
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Use catalog entities to register services that already exist in your infrastructure
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}