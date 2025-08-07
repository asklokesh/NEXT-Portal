'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */

// Removed date-fns import - using native JavaScript date formatting instead
// Note: subMinutes, subHours, subDays functionality replaced with native JS where needed
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
 LineChart,
 Line,
 AreaChart,
 Area,
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 ReferenceLine,
} from '@/components/charts';

interface ChartProps {
 data: any[];
 height?: number;
 className?: string;
}

interface MetricCardProps {
 title: string;
 value: string | number;
 change?: {
 value: number;
 period: string;
 trend: 'up' | 'down' | 'neutral';
 };
 status?: 'success' | 'warning' | 'error' | 'info';
 icon?: React.ReactNode;
 onClick?: () => void;
}

interface TimeSeriesPoint {
 timestamp: string;
 value: number;
 label?: string;
}

// Enhanced Metric Card with trend indicators
export const MetricCard = ({
 title,
 value,
 change,
 status = 'info',
 icon,
 onClick
}: MetricCardProps) => {
 const statusColors = {
 success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
 warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
 error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
 info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
 };

 const statusTextColors = {
 success: 'text-green-700 dark:text-green-300',
 warning: 'text-yellow-700 dark:text-yellow-300',
 error: 'text-red-700 dark:text-red-300',
 info: 'text-blue-700 dark:text-blue-300',
 };

 const getTrendIcon = (trend: string) => {
 switch (trend) {
 case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
 case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
 default: return <Minus className="w-4 h-4 text-gray-600" />;
 }
 };

 const getTrendColor = (trend: string) => {
 switch (trend) {
 case 'up': return 'text-green-600 dark:text-green-400';
 case 'down': return 'text-red-600 dark:text-red-400';
 default: return 'text-gray-600 dark:text-gray-400';
 }
 };

 return (
 <div 
 className={`relative p-6 rounded-lg border-2 transition-all hover:shadow-md ${statusColors[status]} ${
 onClick ? 'cursor-pointer hover:scale-105' : ''
 }`}
 onClick={onClick}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
 {title}
 </p>
 <p className={`text-3xl font-bold ${statusTextColors[status]} mb-2`}>
 {value}
 </p>
 {change && (
 <div className="flex items-center gap-2">
 {getTrendIcon(change.trend)}
 <span className={`text-sm font-medium ${getTrendColor(change.trend)}`}>
 {change.value > 0 ? '+' : ''}{change.value}% {change.period}
 </span>
 </div>
 )}
 </div>
 {icon && (
 <div className={`p-3 rounded-lg ${statusTextColors[status]}`}>
 {icon}
 </div>
 )}
 </div>
 </div>
 );
}

// Real-time Line Chart with smooth animations
export const RealTimeLineChart = ({ 
 data, 
 height = 300, 
 className = '',
 dataKey = 'value',
 name = 'Value',
 color = '#3B82F6',
 showGrid = true,
 showTooltip = true,
 threshold
}: ChartProps & {
 dataKey?: string;
 name?: string;
 color?: string;
 showGrid?: boolean;
 showTooltip?: boolean;
 threshold?: number;
}) => {
 const formatXAxis = (tickItem: any) => {
 return new Date(tickItem).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 };

 const formatTooltip = (value: any, name: string, props: any) => {
 return [
 `${value}${name.includes('%') ? '%' : ''}`,
 name,
 new Date(props.payload.timestamp).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ', ' + new Date(props.payload.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
 ];
 };

 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
 {showGrid && (
 <CartesianGrid 
 strokeDasharray="3 3" 
 stroke="#374151" 
 opacity={0.1}
 />
 )}
 <XAxis 
 dataKey="timestamp"
 tickFormatter={formatXAxis}
 stroke="#9CA3AF"
 fontSize={12}
 />
 <YAxis 
 stroke="#9CA3AF"
 fontSize={12}
 />
 {showTooltip && (
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '0.375rem',
 color: '#F9FAFB'
 }}
 labelStyle={{ color: '#9CA3AF' }}
 formatter={formatTooltip}
 />
 )}
 {threshold && (
 <ReferenceLine 
 y={threshold} 
 stroke="#EF4444" 
 strokeDasharray="5 5"
 label={{ value: `Threshold: ${threshold}`, position: 'topRight' }}
 />
 )}
 <Line
 type="monotone"
 dataKey={dataKey}
 stroke={color}
 strokeWidth={2}
 dot={false}
 name={name}
 animationDuration={300}
 connectNulls={false}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 );
}

// Area Chart for filled metrics
export const RealTimeAreaChart = ({ 
 data, 
 height = 300, 
 className = '',
 dataKey = 'value',
 name = 'Value',
 color = '#10B981',
 fillOpacity = 0.3
}: ChartProps & {
 dataKey?: string;
 name?: string;
 color?: string;
 fillOpacity?: number;
}) => {
 const formatXAxis = (tickItem: any) => {
 return new Date(tickItem).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 };

 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
 <stop offset="95%" stopColor={color} stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
 <XAxis 
 dataKey="timestamp"
 tickFormatter={formatXAxis}
 stroke="#9CA3AF"
 fontSize={12}
 />
 <YAxis stroke="#9CA3AF" fontSize={12} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '0.375rem',
 color: '#F9FAFB'
 }}
 labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ', ' + new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
 />
 <Area
 type="monotone"
 dataKey={dataKey}
 stroke={color}
 fillOpacity={fillOpacity}
 fill={`url(#gradient-${dataKey})`}
 name={name}
 animationDuration={300}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 );
}

// Multi-line chart for comparing metrics
export const MultiLineChart = ({
 data,
 height = 300,
 className = '',
 lines = []
}: ChartProps & {
 lines: Array<{
 dataKey: string;
 name: string;
 color: string;
 }>;
}) => {
 const formatXAxis = (tickItem: any) => {
 return new Date(tickItem).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
 };

 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
 <XAxis 
 dataKey="timestamp"
 tickFormatter={formatXAxis}
 stroke="#9CA3AF"
 fontSize={12}
 />
 <YAxis stroke="#9CA3AF" fontSize={12} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '0.375rem',
 color: '#F9FAFB'
 }}
 labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ', ' + new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
 />
 <Legend />
 {lines.map(line => (
 <Line
 key={line.dataKey}
 type="monotone"
 dataKey={line.dataKey}
 stroke={line.color}
 strokeWidth={2}
 dot={false}
 name={line.name}
 animationDuration={300}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 );
}

// Status Distribution Pie Chart
export const StatusDistributionChart = ({
 data,
 height = 300,
 className = ''
}: ChartProps) => {
 const COLORS = {
 healthy: '#10B981',
 degraded: '#F59E0B', 
 unhealthy: '#EF4444',
 unknown: '#6B7280'
 };

 const RADIAN = Math.PI / 180;
 const renderCustomizedLabel = ({
 cx, cy, midAngle, innerRadius, outerRadius, percent
 }: any) => {
 const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
 const x = cx + radius * Math.cos(-midAngle * RADIAN);
 const y = cy + radius * Math.sin(-midAngle * RADIAN);

 return (
 <text 
 x={x} 
 y={y} 
 fill="white" 
 textAnchor={x > cx ? 'start' : 'end'} 
 dominantBaseline="central"
 fontSize={12}
 fontWeight="bold"
 >
 {`${(percent * 100).toFixed(0)}%`}
 </text>
 );
 };

 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <PieChart>
 <Pie
 data={data}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={renderCustomizedLabel}
 outerRadius={80}
 fill="#8884d8"
 dataKey="count"
 animationDuration={600}
 >
 {data.map((entry: any, index: number) => (
 <Cell 
 key={`cell-${index}`} 
 fill={COLORS[entry.status as keyof typeof COLORS] || COLORS.unknown} 
 />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '0.375rem',
 color: '#F9FAFB'
 }}
 />
 <Legend 
 wrapperStyle={{ color: '#9CA3AF' }}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>
 );
}

// Bar Chart for deployment frequency
export const DeploymentFrequencyChart = ({
 data,
 height = 300,
 className = ''
}: ChartProps) => {
 const formatXAxis = (tickItem: any) => {
 return new Date(tickItem).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
 };

 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
 <XAxis 
 dataKey="date"
 tickFormatter={formatXAxis}
 stroke="#9CA3AF"
 fontSize={12}
 />
 <YAxis stroke="#9CA3AF" fontSize={12} />
 <Tooltip
 contentStyle={{
 backgroundColor: '#1F2937',
 border: 'none',
 borderRadius: '0.375rem',
 color: '#F9FAFB'
 }}
 labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
 />
 <Bar 
 dataKey="successful" 
 stackId="a" 
 fill="#10B981" 
 name="Successful"
 animationDuration={600}
 />
 <Bar 
 dataKey="failed" 
 stackId="a" 
 fill="#EF4444" 
 name="Failed"
 animationDuration={600}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>
 );
}

// Metric Sparkline - Small inline chart
export const MetricSparkline = ({
 data,
 height = 60,
 color = '#3B82F6',
 className = ''
}: {
 data: TimeSeriesPoint[];
 height?: number;
 color?: string;
 className?: string;
}) => {
 return (
 <div className={`w-full ${className}`}>
 <ResponsiveContainer width="100%" height={height}>
 <LineChart data={data}>
 <Line
 type="monotone"
 dataKey="value"
 stroke={color}
 strokeWidth={2}
 dot={false}
 animationDuration={300}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 );
}

// Alert Status Bar
export const AlertStatusBar = ({ 
 alerts 
}: { 
 alerts: Array<{ severity: string; count: number }> 
}) => {
 const total = alerts.reduce((sum, alert) => sum + alert.count, 0);
 
 const severityColors = {
 critical: 'bg-red-500',
 high: 'bg-orange-500', 
 medium: 'bg-yellow-500',
 low: 'bg-blue-500'
 };

 if (total === 0) {
 return (
 <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
 <div className="w-3 h-3 rounded-full bg-green-500"></div>
 <span className="text-sm font-medium text-green-700 dark:text-green-300">
 No active alerts
 </span>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Active Alerts ({total})
 </span>
 <AlertTriangle className="w-4 h-4 text-orange-500" />
 </div>
 <div className="flex rounded-lg overflow-hidden h-2">
 {alerts.map(alert => {
 const percentage = (alert.count / total) * 100;
 return (
 <div
 key={alert.severity}
 className={severityColors[alert.severity as keyof typeof severityColors]}
 style={{ width: `${percentage}%` }}
 title={`${alert.severity}: ${alert.count}`}
 />
 );
 })}
 </div>
 <div className="flex flex-wrap gap-2">
 {alerts.map(alert => (
 <span
 key={alert.severity}
 className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 <div 
 className={`w-2 h-2 rounded-full mr-1 ${severityColors[alert.severity as keyof typeof severityColors]}`} 
 />
 {alert.severity}: {alert.count}
 </span>
 ))}
 </div>
 </div>
 );
}

// Hook for generating mock time series data
export function useRealTimeData(
 initialValue: number = 50,
 variance: number = 10,
 pointCount: number = 30
) {
 const [data, setData] = useState<TimeSeriesPoint[]>([]);

 useEffect(() => {
 // Generate initial data
 const initialData: TimeSeriesPoint[] = [];
 const now = new Date();
 
 for (let i = pointCount - 1; i >= 0; i--) {
 const timestamp = subMinutes(now, i * 2).toISOString();
 const value = initialValue + (Math.random() - 0.5) * variance * 2;
 initialData.push({ timestamp, value: Math.max(0, value) });
 }
 
 setData(initialData);

 // Update data every 5 seconds
 const interval = setInterval(() => {
 setData(prevData => {
 const newPoint: TimeSeriesPoint = {
 timestamp: new Date().toISOString(),
 value: Math.max(0, initialValue + (Math.random() - 0.5) * variance * 2)
 };
 
 return [...prevData.slice(1), newPoint];
 });
 }, 5000);

 return () => clearInterval(interval);
 }, [initialValue, variance, pointCount]);

 return data;
}