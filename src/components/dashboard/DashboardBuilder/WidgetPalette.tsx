'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus */

import { 
 X, 
 TrendingUp, 
 Activity, 
 BarChart3, 
 PieChart,
 GitBranch,
 Shield,
 Server,
 Clock,
 Table,
 FileText,
 AlertCircle,
 Search,
 Plus
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { useDashboard } from '../hooks/useDashboard';

import type { Widget, WidgetType } from '../types';

interface WidgetPaletteProps {
 onClose: () => void;
 onAddWidget: (widget: Widget) => void;
}

interface WidgetTemplate {
 type: WidgetType;
 title: string;
 description: string;
 icon: React.ReactNode;
 category: string;
}

const widgetTemplates: WidgetTemplate[] = [
 {
 type: 'metric',
 title: 'Metric Card',
 description: 'Display a single metric with trend',
 icon: <TrendingUp className="w-5 h-5" />,
 category: 'Basic'
 },
 {
 type: 'chart',
 title: 'Chart',
 description: 'Line, bar, or area charts',
 icon: <BarChart3 className="w-5 h-5" />,
 category: 'Basic'
 },
 {
 type: 'serviceHealth',
 title: 'Service Health',
 description: 'Monitor service status and uptime',
 icon: <Activity className="w-5 h-5" />,
 category: 'Monitoring'
 },
 {
 type: 'deployment',
 title: 'Deployments',
 description: 'Track deployment history and status',
 icon: <GitBranch className="w-5 h-5" />,
 category: 'DevOps'
 },
 {
 type: 'table',
 title: 'Data Table',
 description: 'Display tabular data with sorting',
 icon: <Table className="w-5 h-5" />,
 category: 'Basic'
 },
 {
 type: 'gauge',
 title: 'Gauge',
 description: 'Circular progress indicator',
 icon: <PieChart className="w-5 h-5" />,
 category: 'Basic'
 },
 {
 type: 'timeline',
 title: 'Timeline',
 description: 'Show events over time',
 icon: <Clock className="w-5 h-5" />,
 category: 'Time Series'
 },
 {
 type: 'log',
 title: 'Log Viewer',
 description: 'Real-time log streaming',
 icon: <FileText className="w-5 h-5" />,
 category: 'Monitoring'
 },
 {
 type: 'heatmap',
 title: 'Heatmap',
 description: 'Visualize data density',
 icon: <Shield className="w-5 h-5" />,
 category: 'Advanced'
 },
 {
 type: 'custom',
 title: 'Custom Widget',
 description: 'Build your own widget',
 icon: <Plus className="w-5 h-5" />,
 category: 'Advanced'
 }
];

const categories = ['All', 'Basic', 'Monitoring', 'DevOps', 'Time Series', 'Advanced'];

export const WidgetPalette: React.FC<WidgetPaletteProps> = ({ onClose, onAddWidget }) => {
 const { addWidget } = useDashboard();
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedTemplate, setSelectedTemplate] = useState<WidgetTemplate | null>(null);
 const [widgetTitle, setWidgetTitle] = useState('');

 const filteredTemplates = widgetTemplates.filter(template => {
 const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
 const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 template.description.toLowerCase().includes(searchTerm.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 const handleAddWidget = () => {
 if (!selectedTemplate || !widgetTitle.trim()) return;

 const newWidget: Widget = {
 id: `widget-${Date.now()}`,
 type: selectedTemplate.type,
 title: widgetTitle,
 config: {
 display: {
 format: 'number',
 decimals: 2
 }
 }
 };

 addWidget(newWidget);
 onAddWidget(newWidget);
 onClose();
 };

 return (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border">
 <div>
 <h2 className="text-xl font-semibold">Add Widget</h2>
 <p className="text-sm text-muted-foreground mt-1">
 Choose a widget template to add to your dashboard
 </p>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Content */}
 <div className="flex flex-1 overflow-hidden">
 {/* Sidebar */}
 <div className="w-64 border-r border-border p-4 space-y-4">
 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search widgets..."
 className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background"
 />
 </div>

 {/* Categories */}
 <div>
 <h3 className="text-sm font-medium mb-2">Categories</h3>
 <div className="space-y-1">
 {categories.map(category => (
 <button
 key={category}
 onClick={() => setSelectedCategory(category)}
 className={cn(
 'w-full text-left px-3 py-2 text-sm rounded-md',
 'hover:bg-accent hover:text-accent-foreground',
 selectedCategory === category && 'bg-accent text-accent-foreground'
 )}
 >
 {category}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Widget Grid */}
 <div className="flex-1 p-6 overflow-y-auto">
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 {filteredTemplates.map(template => (
 <button
 key={template.type}
 onClick={() => {
 setSelectedTemplate(template);
 setWidgetTitle(template.title);
 }}
 className={cn(
 'p-4 rounded-lg border text-left transition-all',
 'hover:border-primary hover:shadow-md',
 selectedTemplate?.type === template.type
 ? 'border-primary bg-primary/5'
 : 'border-border'
 )}
 >
 <div className="flex items-start gap-3">
 <div className={cn(
 'p-2 rounded-md',
 selectedTemplate?.type === template.type
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted'
 )}>
 {template.icon}
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-sm">{template.title}</h4>
 <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
 {template.description}
 </p>
 </div>
 </div>
 </button>
 ))}
 </div>

 {filteredTemplates.length === 0 && (
 <div className="text-center py-12">
 <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
 <p className="text-muted-foreground">No widgets found</p>
 </div>
 )}
 </div>
 </div>

 {/* Footer */}
 {selectedTemplate && (
 <div className="p-6 border-t border-border">
 <div className="flex items-end gap-4">
 <div className="flex-1">
 <label className="block text-sm font-medium mb-2">Widget Title</label>
 <input
 type="text"
 value={widgetTitle}
 onChange={(e) => setWidgetTitle(e.target.value)}
 placeholder="Enter widget title..."
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 autoFocus
 />
 </div>
 <button
 onClick={handleAddWidget}
 disabled={!widgetTitle.trim()}
 className={cn(
 'px-4 py-2 rounded-md',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'disabled:opacity-50 disabled:cursor-not-allowed'
 )}
 >
 Add Widget
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};