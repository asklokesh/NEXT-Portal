'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Plus,
 X,
 GitCompare,
 Package,
 Star,
 Download,
 Clock,
 Users,
 Shield,
 Tag,
 CheckCircle,
 XCircle,
 ArrowRight,
 Play,
 Eye,
 BarChart3
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { useTemplates, useTemplateStats } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateComparisonProps {
 initialTemplates?: string[];
 onUseTemplate?: (templateRef: string) => void;
 className?: string;
}

interface ComparisonMetric {
 key: string;
 label: string;
 category: 'basic' | 'usage' | 'parameters' | 'steps';
 getValue: (template: TemplateEntity, stats?: any) => string | number | React.ReactNode;
 compare?: 'higher' | 'lower' | 'equal';
}

const COMPARISON_METRICS: ComparisonMetric[] = [
 // Basic Information
 {
 key: 'name',
 label: 'Name',
 category: 'basic',
 getValue: (template) => template.metadata.title || template.metadata.name,
 },
 {
 key: 'type',
 label: 'Type',
 category: 'basic',
 getValue: (template) => (
 <span className="capitalize px-2 py-1 rounded-full text-xs bg-secondary">
 {template.spec.type}
 </span>
 ),
 },
 {
 key: 'owner',
 label: 'Owner',
 category: 'basic',
 getValue: (template) => template.spec.owner,
 },
 {
 key: 'description',
 label: 'Description',
 category: 'basic',
 getValue: (template) => template.metadata.description || 'No description',
 },
 {
 key: 'tags',
 label: 'Tags',
 category: 'basic',
 getValue: (template) => (
 <div className="flex flex-wrap gap-1">
 {(template.metadata.tags || []).slice(0, 3).map(tag => (
 <span key={tag} className="px-1 py-0.5 rounded text-xs bg-muted">
 {tag}
 </span>
 ))}
 {(template.metadata.tags || []).length > 3 && (
 <span className="text-xs text-muted-foreground">
 +{(template.metadata.tags || []).length - 3}
 </span>
 )}
 </div>
 ),
 },
 {
 key: 'official',
 label: 'Official',
 category: 'basic',
 getValue: (template) => template.metadata.namespace === 'default' ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-muted-foreground" />
 ),
 },

 // Usage Statistics
 {
 key: 'totalExecutions',
 label: 'Total Uses',
 category: 'usage',
 getValue: (template, stats) => stats?.totalExecutions?.toLocaleString() || '0',
 compare: 'higher',
 },
 {
 key: 'successRate',
 label: 'Success Rate',
 category: 'usage',
 getValue: (template, stats) => {
 const rate = stats ? Math.round((stats.successfulExecutions / Math.max(stats.totalExecutions, 1)) * 100) : 0;
 return (
 <span className={cn(
 'font-medium',
 rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'
 )}>
 {rate}%
 </span>
 );
 },
 compare: 'higher',
 },
 {
 key: 'avgExecutionTime',
 label: 'Avg. Execution Time',
 category: 'usage',
 getValue: (template, stats) => {
 const time = stats?.averageExecutionTime || 0;
 return `${Math.round(time / 1000)}s`;
 },
 compare: 'lower',
 },

 // Parameters
 {
 key: 'parameterCount',
 label: 'Parameters',
 category: 'parameters',
 getValue: (template) => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 return Object.keys(params.properties).length;
 },
 },
 {
 key: 'requiredParams',
 label: 'Required Parameters',
 category: 'parameters',
 getValue: (template) => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 return (params.required || []).length;
 },
 },
 {
 key: 'hasAdvancedFields',
 label: 'Advanced Fields',
 category: 'parameters',
 getValue: (template) => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 
 const hasAdvanced = Object.values(params.properties).some(prop => 
 prop['ui:field'] === 'EntityPicker' || 
 prop['ui:field'] === 'RepoUrlPicker' ||
 prop['ui:field'] === 'OwnerPicker'
 );
 
 return hasAdvanced ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-muted-foreground" />
 );
 },
 },

 // Steps
 {
 key: 'stepCount',
 label: 'Steps',
 category: 'steps',
 getValue: (template) => template.spec.steps.length,
 },
 {
 key: 'hasPublishStep',
 label: 'Publishes to Git',
 category: 'steps',
 getValue: (template) => {
 const hasPublish = template.spec.steps.some(step => 
 step.action.includes('publish') || step.action.includes('github')
 );
 return hasPublish ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-muted-foreground" />
 );
 },
 },
 {
 key: 'hasRegisterStep',
 label: 'Registers in Catalog',
 category: 'steps',
 getValue: (template) => {
 const hasRegister = template.spec.steps.some(step => 
 step.action.includes('catalog:register')
 );
 return hasRegister ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-muted-foreground" />
 );
 },
 },
];

const TemplateSelector: React.FC<{
 onSelect: (templateRef: string) => void;
 excludeRefs: string[];
}> = ({ onSelect, excludeRefs }) => {
 const [isOpen, setIsOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const { data: templates = [] } = useTemplates();

 const filteredTemplates = useMemo(() => {
 return templates.filter(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 if (excludeRefs.includes(templateRef)) return false;
 
 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 return (
 (template.metadata.title || template.metadata.name).toLowerCase().includes(term) ||
 template.metadata.description?.toLowerCase().includes(term) ||
 template.metadata.tags?.some(tag => tag.toLowerCase().includes(term))
 );
 }
 
 return true;
 });
 }, [templates, excludeRefs, searchTerm]);

 return (
 <div className="relative">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Add Template
 </button>

 {isOpen && (
 <>
 <div 
 className="fixed inset-0 z-10" 
 onClick={() => setIsOpen(false)}
 />
 <div className="absolute top-full left-0 mt-1 w-80 bg-popover border border-border rounded-lg shadow-lg z-20">
 <div className="p-3 border-b">
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search templates..."
 className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
 autoFocus
 />
 </div>
 
 <div className="max-h-64 overflow-y-auto">
 {filteredTemplates.length === 0 ? (
 <div className="p-4 text-center text-muted-foreground">
 No templates found
 </div>
 ) : (
 filteredTemplates.map(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return (
 <button
 key={templateRef}
 onClick={() => {
 onSelect(templateRef);
 setIsOpen(false);
 setSearchTerm('');
 }}
 className="w-full text-left p-3 hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 <div className="font-medium">
 {template.metadata.title || template.metadata.name}
 </div>
 <div className="text-xs text-muted-foreground truncate">
 {template.metadata.description}
 </div>
 </button>
 );
 })
 )}
 </div>
 </div>
 </>
 )}
 </div>
 );
};

const ComparisonTable: React.FC<{
 templates: TemplateEntity[];
 templateStats: Record<string, any>;
 onRemoveTemplate: (index: number) => void;
 onUseTemplate?: (templateRef: string) => void;
}> = ({ templates, templateStats, onRemoveTemplate, onUseTemplate }) => {
 const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'usage' | 'parameters' | 'steps'>('all');

 const categories = [
 { id: 'all', label: 'All' },
 { id: 'basic', label: 'Basic Info' },
 { id: 'usage', label: 'Usage Stats' },
 { id: 'parameters', label: 'Parameters' },
 { id: 'steps', label: 'Steps' },
 ];

 const filteredMetrics = selectedCategory === 'all' 
 ? COMPARISON_METRICS 
 : COMPARISON_METRICS.filter(m => m.category === selectedCategory);

 const getBestValue = (metric: ComparisonMetric) => {
 if (!metric.compare) return null;

 const values = templates.map((template, index) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const stats = templateStats[templateRef];
 const value = metric.getValue(template, stats);
 
 if (typeof value === 'number') {
 return { index, value };
 }
 
 // Extract numeric values from strings
 if (typeof value === 'string') {
 const numericMatch = value.match(/(\d+)/);
 if (numericMatch) {
 return { index, value: parseInt(numericMatch[1]) };
 }
 }
 
 return { index, value: 0 };
 }).filter(item => typeof item.value === 'number');

 if (values.length === 0) return null;

 if (metric.compare === 'higher') {
 return values.reduce((best, current) => 
 current.value > best.value ? current : best
 ).index;
 } else {
 return values.reduce((best, current) => 
 current.value < best.value ? current : best
 ).index;
 }
 };

 return (
 <div className="space-y-4">
 {/* Category filter */}
 <div className="flex gap-2">
 {categories.map(category => (
 <button
 key={category.id}
 onClick={() => setSelectedCategory(category.id as any)}
 className={cn(
 'px-3 py-1 rounded-md text-sm transition-colors',
 selectedCategory === category.id
 ? 'bg-primary text-primary-foreground'
 : 'hover:bg-accent hover:text-accent-foreground'
 )}
 >
 {category.label}
 </button>
 ))}
 </div>

 {/* Comparison table */}
 <div className="overflow-x-auto">
 <table className="w-full border-collapse">
 {/* Header */}
 <thead>
 <tr>
 <th className="text-left p-3 border-b font-medium min-w-[200px]">
 Metric
 </th>
 {templates.map((template, index) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return (
 <th key={templateRef} className="text-left p-3 border-b min-w-[200px]">
 <div className="space-y-2">
 <div className="flex items-start justify-between">
 <div>
 <h3 className="font-medium">
 {template.metadata.title || template.metadata.name}
 </h3>
 <p className="text-xs text-muted-foreground capitalize">
 {template.spec.type}
 </p>
 </div>
 <button
 onClick={() => onRemoveTemplate(index)}
 className="p-1 rounded hover:bg-accent text-muted-foreground"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 
 <div className="flex gap-1">
 <button
 onClick={() => onUseTemplate?.(templateRef)}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
 >
 <Play className="w-3 h-3" />
 Use
 </button>
 <button className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors">
 <Eye className="w-3 h-3" />
 View
 </button>
 </div>
 </div>
 </th>
 );
 })}
 </tr>
 </thead>

 {/* Body */}
 <tbody>
 {filteredMetrics.map((metric) => {
 const bestIndex = getBestValue(metric);
 
 return (
 <tr key={metric.key} className="hover:bg-accent/30">
 <td className="p-3 border-b font-medium">
 {metric.label}
 </td>
 {templates.map((template, index) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const stats = templateStats[templateRef];
 const value = metric.getValue(template, stats);
 const isBest = bestIndex === index;
 
 return (
 <td 
 key={templateRef} 
 className={cn(
 'p-3 border-b',
 isBest && metric.compare && 'bg-green-50 border-green-200'
 )}
 >
 <div className="flex items-center gap-2">
 {value}
 {isBest && metric.compare && (
 <Star className="w-3 h-3 text-green-600" />
 )}
 </div>
 </td>
 );
 })}
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 );
};

export const TemplateComparison: React.FC<TemplateComparisonProps> = ({
 initialTemplates = [],
 onUseTemplate,
 className,
}) => {
 const [selectedTemplateRefs, setSelectedTemplateRefs] = useState<string[]>(initialTemplates);
 const { data: allTemplates = [] } = useTemplates();

 // Get templates data for selected refs
 const selectedTemplates = useMemo(() => {
 return selectedTemplateRefs.map(ref => {
 return allTemplates.find(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return templateRef === ref;
 });
 }).filter(Boolean) as TemplateEntity[];
 }, [selectedTemplateRefs, allTemplates]);

 // Mock template stats - in real implementation, fetch from analytics service
 const templateStats = useMemo(() => {
 const stats: Record<string, any> = {};
 selectedTemplateRefs.forEach(ref => {
 stats[ref] = {
 totalExecutions: Math.floor(Math.random() * 100),
 successfulExecutions: Math.floor(Math.random() * 80),
 averageExecutionTime: 30000 + Math.random() * 120000,
 };
 });
 return stats;
 }, [selectedTemplateRefs]);

 const addTemplate = (templateRef: string) => {
 if (!selectedTemplateRefs.includes(templateRef)) {
 setSelectedTemplateRefs([...selectedTemplateRefs, templateRef]);
 }
 };

 const removeTemplate = (index: number) => {
 setSelectedTemplateRefs(selectedTemplateRefs.filter((_, i) => i !== index));
 };

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <GitCompare className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-2xl font-bold">Template Comparison</h2>
 <p className="text-sm text-muted-foreground">
 Compare templates side by side to find the best fit
 </p>
 </div>
 </div>

 {selectedTemplates.length > 0 && (
 <div className="text-sm text-muted-foreground">
 Comparing {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''}
 </div>
 )}
 </div>

 {/* Template selection */}
 <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
 <span className="text-sm font-medium">Templates:</span>
 
 <div className="flex flex-wrap gap-2">
 {selectedTemplates.map((template, index) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return (
 <div
 key={templateRef}
 className="flex items-center gap-1 px-2 py-1 rounded-md bg-background border"
 >
 <Package className="w-3 h-3" />
 <span className="text-sm">
 {template.metadata.title || template.metadata.name}
 </span>
 <button
 onClick={() => removeTemplate(index)}
 className="p-0.5 rounded hover:bg-accent"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 );
 })}
 
 {selectedTemplateRefs.length < 4 && (
 <TemplateSelector
 onSelect={addTemplate}
 excludeRefs={selectedTemplateRefs}
 />
 )}
 </div>
 </div>

 {/* Comparison content */}
 {selectedTemplates.length === 0 ? (
 <div className="text-center py-12">
 <GitCompare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No templates selected</h3>
 <p className="text-muted-foreground mb-4">
 Add templates to compare their features and capabilities
 </p>
 <TemplateSelector
 onSelect={addTemplate}
 excludeRefs={selectedTemplateRefs}
 />
 </div>
 ) : selectedTemplates.length === 1 ? (
 <div className="text-center py-8">
 <p className="text-muted-foreground mb-4">
 Add another template to start comparing
 </p>
 <TemplateSelector
 onSelect={addTemplate}
 excludeRefs={selectedTemplateRefs}
 />
 </div>
 ) : (
 <ComparisonTable
 templates={selectedTemplates}
 templateStats={templateStats}
 onRemoveTemplate={removeTemplate}
 onUseTemplate={onUseTemplate}
 />
 )}
 </div>
 );
};