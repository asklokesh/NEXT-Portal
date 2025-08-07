'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, jsx-a11y/anchor-is-valid */

import {
 HelpCircle,
 X,
 Keyboard,
 Mouse,
 Zap,
 Settings,
 RefreshCw,
 Plus,
 Edit3,
 Save,
 Command,
 ChevronRight,
 Info,
 BookOpen,
 Video,
 MessageCircle
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

interface DashboardHelpProps {
 isOpen: boolean;
 onClose: () => void;
}

const DashboardHelp: React.FC<DashboardHelpProps> = ({ isOpen, onClose }) => {
 const [activeTab, setActiveTab] = useState<'shortcuts' | 'features' | 'tips'>('shortcuts');

 if (!isOpen) return null;

 const keyboardShortcuts = [
 { keys: ['Ctrl', 'E'], description: 'Toggle edit mode' },
 { keys: ['Ctrl', 'N'], description: 'Add new widget (in edit mode)' },
 { keys: ['Ctrl', 'S'], description: 'Save dashboard' },
 { keys: ['Ctrl', 'R'], description: 'Refresh all widgets' },
 { keys: ['Ctrl', ','], description: 'Open dashboard settings' },
 { keys: ['?'], description: 'Show this help dialog' },
 { keys: ['Escape'], description: 'Close modals and panels' }
 ];

 const features = [
 {
 icon: <Edit3 className="w-5 h-5" />,
 title: 'Drag & Drop Editing',
 description: 'Click "Edit" to enter edit mode and drag widgets to reposition them. Resize widgets by dragging the corners.'
 },
 {
 icon: <Plus className="w-5 h-5" />,
 title: 'Widget Library',
 description: 'Add new widgets from the widget palette. Choose from metrics, charts, tables, and more.'
 },
 {
 icon: <RefreshCw className="w-5 h-5" />,
 title: 'Real-time Updates',
 description: 'Widgets automatically refresh with live data. Configure refresh intervals in widget settings.'
 },
 {
 icon: <Settings className="w-5 h-5" />,
 title: 'Customization',
 description: 'Configure each widget individually. Set thresholds, change colors, and customize data sources.'
 },
 {
 icon: <Zap className="w-5 h-5" />,
 title: 'Performance',
 description: 'Optimized for speed with efficient data loading and caching. Handles large datasets smoothly.'
 }
 ];

 const tips = [
 {
 title: 'Organize by Importance',
 content: 'Place your most critical metrics at the top-left of the dashboard where they\'ll be seen first.'
 },
 {
 title: 'Use Color Coding',
 content: 'Set up threshold colors (red for critical, yellow for warning, green for healthy) to quickly identify issues.'
 },
 {
 title: 'Group Related Widgets',
 content: 'Keep related metrics together. For example, group all database metrics in one area.'
 },
 {
 title: 'Mobile Optimization',
 content: 'Your dashboard automatically adapts to mobile devices with responsive layouts.'
 },
 {
 title: 'Backup Your Config',
 content: 'Export your dashboard configuration regularly from Settings > Advanced > Export Dashboard.'
 },
 {
 title: 'Filter by Ownership',
 content: 'Enable "Filter by ownership" in settings to only show services you own or are responsible for.'
 }
 ];

 const tabs = [
 { id: 'shortcuts' as const, label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
 { id: 'features' as const, label: 'Features', icon: <Zap className="w-4 h-4" /> },
 { id: 'tips' as const, label: 'Tips & Tricks', icon: <Info className="w-4 h-4" /> }
 ];

 return (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border">
 <div className="flex items-center gap-2">
 <HelpCircle className="w-5 h-5" />
 <h2 className="text-lg font-semibold">Dashboard Help</h2>
 </div>
 <button
 onClick={onClose}
 className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Tabs */}
 <div className="border-b border-border">
 <div className="flex">
 {tabs.map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={cn(
 'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
 activeTab === tab.id
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {activeTab === 'shortcuts' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground mb-6">
 Use these keyboard shortcuts to navigate and control the dashboard efficiently.
 </p>
 
 <div className="space-y-3">
 {keyboardShortcuts.map((shortcut, index) => (
 <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
 <span className="text-sm">{shortcut.description}</span>
 <div className="flex items-center gap-1">
 {shortcut.keys.map((key, keyIndex) => (
 <React.Fragment key={keyIndex}>
 {keyIndex > 0 && <span className="text-muted-foreground mx-1">+</span>}
 <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded">
 {key === 'Ctrl' ? (
 <div className="flex items-center gap-1">
 <Command className="w-3 h-3" />
 Ctrl
 </div>
 ) : key}
 </kbd>
 </React.Fragment>
 ))}
 </div>
 </div>
 ))}
 </div>

 <div className="mt-8 p-4 bg-muted/50 rounded-lg">
 <div className="flex items-center gap-2 mb-2">
 <Mouse className="w-4 h-4" />
 <h4 className="font-medium">Mouse Actions</h4>
 </div>
 <div className="space-y-2 text-sm text-muted-foreground">
 <div>• <strong>Drag widgets:</strong> Enter edit mode and drag widgets to reposition</div>
 <div>• <strong>Resize widgets:</strong> Drag the bottom-right corner of widgets</div>
 <div>• <strong>Widget menu:</strong> Click the ⋮ button on any widget for options</div>
 <div>• <strong>Quick refresh:</strong> Click the refresh icon on individual widgets</div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'features' && (
 <div className="space-y-6">
 <p className="text-sm text-muted-foreground mb-6">
 Explore the powerful features available in your dashboard.
 </p>
 
 {features.map((feature, index) => (
 <div key={index} className="flex gap-4 p-4 rounded-lg border border-border">
 <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg text-primary">
 {feature.icon}
 </div>
 <div>
 <h4 className="font-medium mb-2">{feature.title}</h4>
 <p className="text-sm text-muted-foreground">{feature.description}</p>
 </div>
 </div>
 ))}

 <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
 <div className="flex items-center gap-2 mb-2">
 <BookOpen className="w-4 h-4 text-blue-600" />
 <h4 className="font-medium text-blue-600">Learn More</h4>
 </div>
 <div className="space-y-2 text-sm">
 <div className="flex items-center gap-2">
 <Video className="w-4 h-4 text-blue-600" />
 <a href="#" className="text-blue-600 hover:underline">Watch video tutorials</a>
 </div>
 <div className="flex items-center gap-2">
 <MessageCircle className="w-4 h-4 text-blue-600" />
 <a href="#" className="text-blue-600 hover:underline">Join our community</a>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'tips' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground mb-6">
 Pro tips to get the most out of your dashboard experience.
 </p>
 
 {tips.map((tip, index) => (
 <div key={index} className="p-4 rounded-lg border border-border">
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
 {index + 1}
 </div>
 <div>
 <h4 className="font-medium mb-2">{tip.title}</h4>
 <p className="text-sm text-muted-foreground">{tip.content}</p>
 </div>
 </div>
 </div>
 ))}

 <div className="mt-8 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
 <div className="flex items-center gap-2 mb-2">
 <Zap className="w-4 h-4 text-green-600" />
 <h4 className="font-medium text-green-600">Power User Tip</h4>
 </div>
 <p className="text-sm text-green-700 dark:text-green-300">
 Create multiple dashboard configurations for different scenarios (daily monitoring, incident response, weekly reviews) 
 and quickly switch between them using the export/import feature.
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border text-center">
 <p className="text-sm text-muted-foreground">
 Need more help? Check our{' '}
 <a href="#" className="text-primary hover:underline">documentation</a>
 {' '}or{' '}
 <a href="#" className="text-primary hover:underline">contact support</a>
 </p>
 </div>
 </div>
 </div>
 );
};

export default DashboardHelp;