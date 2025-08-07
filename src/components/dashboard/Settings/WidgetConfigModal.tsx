'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, jsx-a11y/label-has-associated-control */

import {
 Settings,
 X,
 Save,
 RotateCcw,
 Palette,
 BarChart3,
 Filter as _Filter,
 Clock as _Clock,
 AlertTriangle,
 Plus,
 Trash2,
 ChevronDown as _ChevronDown,
 ChevronUp as _ChevronUp
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { Widget, WidgetConfig, ThresholdConfig } from '../types';

interface WidgetConfigModalProps {
 widget: Widget | null;
 isOpen: boolean;
 onClose: () => void;
 onSave: (widgetId: string, config: WidgetConfig) => void;
}

const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({
 widget,
 isOpen,
 onClose,
 onSave
}) => {
 const [config, setConfig] = useState<WidgetConfig>({});
 const [activeTab, setActiveTab] = useState<'general' | 'display' | 'data' | 'alerts'>('general');

 useEffect(() => {
 if (widget) {
 setConfig(widget.config || {});
 }
 }, [widget]);

 const updateConfig = (updates: Partial<WidgetConfig>) => {
 setConfig(prev => ({ ...prev, ...updates }));
 };

 const updateDisplayConfig = (updates: Partial<WidgetConfig['display']>) => {
 setConfig(prev => ({
 ...prev,
 display: { ...prev.display, ...updates }
 }));
 };

 const updateVisualizationConfig = (updates: Partial<WidgetConfig['visualization']>) => {
 setConfig(prev => ({
 ...prev,
 visualization: { ...prev.visualization, ...updates }
 }));
 };

 const addThreshold = () => {
 const newThreshold: ThresholdConfig = {
 value: 0,
 color: '#ef4444',
 operator: '>',
 label: 'New Threshold'
 };
 
 setConfig(prev => ({
 ...prev,
 thresholds: [...(prev.thresholds || []), newThreshold]
 }));
 };

 const updateThreshold = (index: number, updates: Partial<ThresholdConfig>) => {
 setConfig(prev => ({
 ...prev,
 thresholds: prev.thresholds?.map((threshold, i) => 
 i === index ? { ...threshold, ...updates } : threshold
 )
 }));
 };

 const removeThreshold = (index: number) => {
 setConfig(prev => ({
 ...prev,
 thresholds: prev.thresholds?.filter((_, i) => i !== index)
 }));
 };

 const handleSave = () => {
 if (widget) {
 onSave(widget.id, config);
 onClose();
 }
 };

 const handleReset = () => {
 if (widget) {
 setConfig(widget.config || {});
 }
 };

 if (!isOpen || !widget) return null;

 const tabs = [
 { id: 'general' as const, label: 'General', icon: <Settings className="w-4 h-4" /> },
 { id: 'display' as const, label: 'Display', icon: <Palette className="w-4 h-4" /> },
 { id: 'data' as const, label: 'Data', icon: <BarChart3 className="w-4 h-4" /> },
 { id: 'alerts' as const, label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" /> }
 ];

 return (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border">
 <div>
 <h3 className="text-lg font-semibold">Configure Widget</h3>
 <p className="text-sm text-muted-foreground">{widget.title}</p>
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
 {activeTab === 'general' && (
 <div className="space-y-4">
 <div>
 <label className="text-sm font-medium mb-2 block">Refresh Interval</label>
 <select
 value={widget.refreshInterval || 30000}
 onChange={(e) => updateConfig({ refreshInterval: parseInt(e.target.value) })}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value={5000}>5 seconds</option>
 <option value={10000}>10 seconds</option>
 <option value={30000}>30 seconds</option>
 <option value={60000}>1 minute</option>
 <option value={300000}>5 minutes</option>
 </select>
 </div>

 {widget.type === 'metric' && (
 <div>
 <label className="text-sm font-medium mb-2 block">Comparison</label>
 <select
 value={config.display?.comparison || 'previous'}
 onChange={(e) => updateDisplayConfig({ comparison: e.target.value as any })}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value="previous">Previous Period</option>
 <option value="average">Average</option>
 <option value="target">Target</option>
 </select>
 </div>
 )}
 </div>
 )}

 {activeTab === 'display' && (
 <div className="space-y-4">
 <div>
 <label className="text-sm font-medium mb-2 block">Format</label>
 <select
 value={config.display?.format || 'number'}
 onChange={(e) => updateDisplayConfig({ format: e.target.value })}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value="number">Number</option>
 <option value="percent">Percentage</option>
 <option value="currency">Currency</option>
 <option value="bytes">Bytes</option>
 </select>
 </div>

 <div>
 <label className="text-sm font-medium mb-2 block">Unit</label>
 <input
 type="text"
 value={config.display?.unit || ''}
 onChange={(e) => updateDisplayConfig({ unit: e.target.value })}
 placeholder="e.g., requests/sec, MB, %"
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 />
 </div>

 <div>
 <label className="text-sm font-medium mb-2 block">Decimal Places</label>
 <input
 type="number"
 min="0"
 max="5"
 value={config.display?.decimals || 0}
 onChange={(e) => updateDisplayConfig({ decimals: parseInt(e.target.value) })}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 />
 </div>

 {widget.type === 'chart' && (
 <>
 <div>
 <label className="text-sm font-medium mb-2 block">Chart Type</label>
 <select
 value={config.visualization?.type || 'line'}
 onChange={(e) => updateVisualizationConfig({ type: e.target.value as any })}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 >
 <option value="line">Line Chart</option>
 <option value="area">Area Chart</option>
 <option value="bar">Bar Chart</option>
 <option value="pie">Pie Chart</option>
 </select>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={config.visualization?.smooth || false}
 onChange={(e) => updateVisualizationConfig({ smooth: e.target.checked })}
 className="rounded border-border"
 />
 <label className="text-sm">Smooth curves</label>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 checked={config.visualization?.stacked || false}
 onChange={(e) => updateVisualizationConfig({ stacked: e.target.checked })}
 className="rounded border-border"
 />
 <label className="text-sm">Stacked series</label>
 </div>
 </>
 )}
 </div>
 )}

 {activeTab === 'data' && (
 <div className="space-y-4">
 <div>
 <label className="text-sm font-medium mb-2 block">Data Source Query</label>
 <textarea
 value={widget.dataSource?.query as string || ''}
 onChange={(e) => updateConfig({ 
 dataSource: { ...widget.dataSource, query: e.target.value } 
 })}
 placeholder="Enter query or metric name..."
 rows={3}
 className="w-full px-3 py-2 border border-border rounded-md bg-background"
 />
 </div>

 <div className="bg-muted/50 p-4 rounded-lg">
 <h4 className="text-sm font-medium mb-2">Available Metrics</h4>
 <div className="text-xs text-muted-foreground space-y-1">
 <div>• services.count - Total number of services</div>
 <div>• services.healthy - Number of healthy services</div>
 <div>• services.errorRate - Average error rate</div>
 <div>• metrics.requestRate - Request rate over time</div>
 <div>• services.health - Service health status</div>
 <div>• deployments.recent - Recent deployments</div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'alerts' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-medium">Thresholds</h4>
 <button
 onClick={addThreshold}
 className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
 >
 <Plus className="w-4 h-4" />
 Add Threshold
 </button>
 </div>

 <div className="space-y-3">
 {(config.thresholds || []).map((threshold, index) => (
 <div key={index} className="p-3 border border-border rounded-lg space-y-3">
 <div className="flex items-center justify-between">
 <input
 type="text"
 value={threshold.label || ''}
 onChange={(e) => updateThreshold(index, { label: e.target.value })}
 placeholder="Threshold label"
 className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
 />
 <button
 onClick={() => removeThreshold(index)}
 className="p-1 text-destructive hover:bg-destructive/10 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>

 <div className="grid grid-cols-3 gap-2">
 <select
 value={threshold.operator}
 onChange={(e) => updateThreshold(index, { operator: e.target.value as any })}
 className="px-2 py-1 text-sm border border-border rounded bg-background"
 >
 <option value=">">Greater than</option>
 <option value="<">Less than</option>
 <option value=">=">Greater or equal</option>
 <option value="<=">Less or equal</option>
 <option value="=">Equal to</option>
 <option value="!=">Not equal to</option>
 </select>

 <input
 type="number"
 value={threshold.value}
 onChange={(e) => updateThreshold(index, { value: parseFloat(e.target.value) })}
 className="px-2 py-1 text-sm border border-border rounded bg-background"
 />

 <input
 type="color"
 value={threshold.color}
 onChange={(e) => updateThreshold(index, { color: e.target.value })}
 className="w-full h-8 border border-border rounded"
 />
 </div>
 </div>
 ))}

 {(!config.thresholds || config.thresholds.length === 0) && (
 <div className="text-center py-6 text-muted-foreground">
 <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No thresholds configured</p>
 <p className="text-xs">Add thresholds to get alerts when values cross certain limits</p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border flex items-center justify-end gap-3">
 <button
 onClick={handleReset}
 className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
 >
 <RotateCcw className="w-4 h-4" />
 Reset
 </button>
 
 <button
 onClick={handleSave}
 className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
 >
 <Save className="w-4 h-4" />
 Save Changes
 </button>
 </div>
 </div>
 </div>
 );
};

export default WidgetConfigModal;