'use client';

import React from 'react';
import { 
 Shield, 
 Settings, 
 Users, 
 Package, 
 GitBranch,
 Database,
 FileCode,
 Activity,
 ChevronRight,
 Wand2
} from 'lucide-react';
import Link from 'next/link';

interface AdminSection {
 title: string;
 description: string;
 href: string;
 icon: React.ComponentType<{ className?: string }>;
 stats?: {
 label: string;
 value: string | number;
 }[];
}

export default function AdminDashboard() {
 const sections: AdminSection[] = [
 {
 title: 'Setup Wizard',
 description: 'Initial platform setup and configuration wizard',
 href: '/setup',
 icon: Wand2,
 stats: [
 { label: 'Setup Status', value: 'Complete' },
 { label: 'Last Run', value: 'Never' }
 ]
 },
 {
 title: 'Backstage Maintenance',
 description: 'Manage Backstage updates, compatibility, and system health',
 href: '/admin/maintenance',
 icon: Settings,
 stats: [
 { label: 'Current Version', value: '1.29.0' },
 { label: 'Updates Available', value: 3 }
 ]
 },
 {
 title: 'Template Management',
 description: 'Govern templates, review submissions, and set policies',
 href: '/admin/templates',
 icon: FileCode,
 stats: [
 { label: 'Total Templates', value: 45 },
 { label: 'Pending Review', value: 2 }
 ]
 },
 {
 title: 'Plugin Administration',
 description: 'Manage plugin installations and configurations',
 href: '/admin/plugins',
 icon: Package,
 stats: [
 { label: 'Installed Plugins', value: 12 },
 { label: 'Enabled', value: 8 }
 ]
 },
 {
 title: 'User & Team Management',
 description: 'Manage users, teams, and role-based access control',
 href: '/admin/users',
 icon: Users,
 stats: [
 { label: 'Active Users', value: 156 },
 { label: 'Teams', value: 23 }
 ]
 },
 {
 title: 'Entity Governance',
 description: 'Set policies for service catalog entities and ownership',
 href: '/admin/entities',
 icon: Database,
 stats: [
 { label: 'Total Entities', value: 234 },
 { label: 'Orphaned', value: 5 }
 ]
 },
 {
 title: 'System Monitoring',
 description: 'Monitor system health, performance, and audit logs',
 href: '/admin/monitoring',
 icon: Activity,
 stats: [
 { label: 'Uptime', value: '99.9%' },
 { label: 'API Latency', value: '45ms' }
 ]
 }
 ];

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Admin Dashboard
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Platform administration and governance controls
 </p>
 </div>
 <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-full">
 <Shield className="w-4 h-4" />
 Administrator Access
 </div>
 </div>

 {/* Quick Stats */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Platform Health</p>
 <p className="text-2xl font-bold text-green-600 dark:text-green-400">Healthy</p>
 </div>
 <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
 <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Active Services</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">234</p>
 </div>
 <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
 <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">156</p>
 </div>
 <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
 <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
 </div>
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Pending Actions</p>
 <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">7</p>
 </div>
 <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
 <GitBranch className="w-6 h-6 text-orange-600 dark:text-orange-400" />
 </div>
 </div>
 </div>
 </div>

 {/* Admin Sections */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {sections.map((section) => {
 const Icon = section.icon;
 return (
 <Link
 key={section.href}
 href={section.href}
 className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 transition-colors">
 <Icon className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
 </div>
 <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
 </div>
 
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 {section.title}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
 {section.description}
 </p>
 
 {section.stats && (
 <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
 {section.stats.map((stat, index) => (
 <div key={index}>
 <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stat.value}</p>
 </div>
 ))}
 </div>
 )}
 </Link>
 );
 })}
 </div>

 {/* Recent Activity */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Admin Activity
 </h2>
 <div className="space-y-3">
 <div className="flex items-center justify-between py-2">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 bg-green-500 rounded-full" />
 <div>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Backstage updated to v1.29.0
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">2 hours ago by System</p>
 </div>
 </div>
 </div>
 <div className="flex items-center justify-between py-2">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 bg-blue-500 rounded-full" />
 <div>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 New template approved: React Native App
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">5 hours ago by Admin</p>
 </div>
 </div>
 </div>
 <div className="flex items-center justify-between py-2">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 bg-orange-500 rounded-full" />
 <div>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 5 new users added to Engineering team
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">Yesterday by Team Lead</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}