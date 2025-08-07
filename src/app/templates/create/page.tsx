'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
 ArrowLeft,
 FileCode,
 Upload,
 GitBranch,
 Package,
 Zap,
 ChevronRight
} from 'lucide-react';

interface CreateOption {
 id: string;
 title: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
 href: string;
 color: string;
}

const CREATE_OPTIONS: CreateOption[] = [
 {
 id: 'template',
 title: 'Use a Template',
 description: 'Start from a pre-configured template with best practices built-in',
 icon: FileCode,
 href: '/templates',
 color: 'blue'
 },
 {
 id: 'import',
 title: 'Import from Git',
 description: 'Import an existing template from a Git repository',
 icon: GitBranch,
 href: '/templates/import',
 color: 'purple'
 },
 {
 id: 'scratch',
 title: 'Create from Scratch',
 description: 'Build a custom template with your own specifications',
 icon: Package,
 href: '/templates/builder',
 color: 'green'
 }
];

export default function CreateTemplatePage() {
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
 <div>
 <button
 onClick={() => router.back()}
 className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Templates
 </button>
 
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
 Create New Service
 </h1>
 <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
 Choose how you want to create your new service
 </p>
 </div>

 {/* Options Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
 {CREATE_OPTIONS.map((option) => {
 const Icon = option.icon;
 return (
 <button
 key={option.id}
 onClick={() => router.push(option.href)}
 className="group relative flex flex-col items-center text-center p-8 rounded-lg border bg-white dark:bg-gray-800 hover:shadow-lg transition-all hover:scale-105"
 >
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

 {/* Quick Start Guide */}
 <div className="mt-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Quick Start Guide
 </h2>
 
 <div className="space-y-4">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
 <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Templates Include Everything
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Our templates come with CI/CD pipelines, monitoring, documentation, and best practices pre-configured
 </p>
 </div>
 </div>
 
 <div className="flex items-start gap-3">
 <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex-shrink-0">
 <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Git Integration
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Import templates from any Git repository or create your own and share with your team
 </p>
 </div>
 </div>
 
 <div className="flex items-start gap-3">
 <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg flex-shrink-0">
 <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
 </div>
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Customizable
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 All templates can be customized to match your organization&apos;s standards and requirements
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}