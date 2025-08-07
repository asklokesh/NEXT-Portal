'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment */

import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { MetricWidgetLoading, LoadingSpinner } from './WidgetLoadingStates';

import type { Widget } from '../types';

interface MetricWidgetProps {
 widget: Widget;
 data?: {
 value: number;
 previousValue?: number;
 trend?: 'up' | 'down' | 'neutral';
 change?: number;
 changePercent?: number;
 };
 loading?: boolean;
 error?: Error | null;
 isEditing?: boolean;
}

const MetricWidget: React.FC<MetricWidgetProps> = ({ widget, data, loading, error, isEditing }) => {
 // Mock data if not provided
 const mockData = {
 value: 1247,
 previousValue: 1156,
 trend: 'up' as const,
 change: 91,
 changePercent: 7.8
 };

 const metrics = data || mockData;
 const config = widget.config?.display || {};

 const formatValue = (value: number) => {
 const decimals = config.decimals ?? 0;
 const formatted = value.toLocaleString('en-US', {
 minimumFractionDigits: decimals,
 maximumFractionDigits: decimals
 });

 if (config.unit) {
 return `${formatted} ${config.unit}`;
 }

 return formatted;
 };

 const getTrendIcon = () => {
 switch (metrics.trend) {
 case 'up':
 return <TrendingUp className="w-4 h-4" />;
 case 'down':
 return <TrendingDown className="w-4 h-4" />;
 default:
 return <Minus className="w-4 h-4" />;
 }
 };

 const getTrendColor = () => {
 switch (metrics.trend) {
 case 'up':
 return 'text-green-600';
 case 'down':
 return 'text-red-600';
 default:
 return 'text-muted-foreground';
 }
 };

 // Handle loading state
 if (loading) {
 return <MetricWidgetLoading />;
 }

 // Handle error state
 if (error) {
 return (
 <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-3">
 <AlertCircle className="w-8 h-8 text-destructive" />
 <div className="space-y-1">
 <h4 className="font-medium text-destructive">Failed to Load Metric</h4>
 <p className="text-sm text-muted-foreground">
 {error.message || 'An error occurred while fetching metric data'}
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className="h-full flex flex-col justify-center">
 {/* Main metric */}
 <div className="text-center mb-4">
 <div className="text-3xl font-bold mb-1">
 {formatValue(metrics.value)}
 </div>
 
 {/* Comparison */}
 {metrics.changePercent !== undefined && (
 <div className={cn(
 'flex items-center justify-center gap-1 text-sm',
 getTrendColor()
 )}>
 {getTrendIcon()}
 <span>
 {metrics.changePercent > 0 ? '+' : ''}{metrics.changePercent.toFixed(1)}%
 </span>
 {config.comparison && (
 <span className="text-muted-foreground">
 vs {config.comparison}
 </span>
 )}
 </div>
 )}
 </div>

 {/* Sparkline placeholder */}
 {config.sparkline && (
 <div className="h-8 bg-muted rounded flex items-center justify-center">
 <span className="text-xs text-muted-foreground">Sparkline chart</span>
 </div>
 )}

 {/* Thresholds */}
 {widget.config?.thresholds && widget.config.thresholds.length > 0 && (
 <div className="mt-4 space-y-1">
 {widget.config.thresholds.map((threshold, index) => {
 const isActive = eval(`${metrics.value} ${threshold.operator} ${threshold.value}`);
 
 return (
 <div
 key={index}
 className={cn(
 'flex items-center gap-2 text-xs',
 isActive ? 'text-foreground' : 'text-muted-foreground'
 )}
 >
 <div
 className="w-2 h-2 rounded-full"
 style={{ backgroundColor: isActive ? threshold.color : 'transparent', border: `1px solid ${threshold.color}` }}
 />
 <span>
 {threshold.label || `${threshold.operator} ${threshold.value}`}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
};

export default MetricWidget;