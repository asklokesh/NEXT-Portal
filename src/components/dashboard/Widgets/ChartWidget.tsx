'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import React from 'react';
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
 ResponsiveContainer
} from '@/components/charts';

import { cn } from '@/lib/utils';

import type { Widget } from '../types';

interface ChartWidgetProps {
 widget: Widget;
 data?: Array<Record<string, any>>;
 isEditing?: boolean;
}

const ChartWidget: React.FC<ChartWidgetProps> = ({ widget, data, isEditing }) => {
 // Mock data if not provided
 const mockData = [
 { name: 'Jan', value: 400, deployment: 24 },
 { name: 'Feb', value: 300, deployment: 13 },
 { name: 'Mar', value: 200, deployment: 98 },
 { name: 'Apr', value: 278, deployment: 39 },
 { name: 'May', value: 189, deployment: 48 },
 { name: 'Jun', value: 239, deployment: 38 },
 { name: 'Jul', value: 349, deployment: 43 }
 ];

 // Transform data from metrics service format
 const transformData = (rawData: any) => {
 if (rawData?.data && Array.isArray(rawData.data)) {
 return rawData.data.map((point: any) => ({
 name: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
 value: point.value,
 timestamp: point.timestamp
 }));
 }
 return rawData || mockData;
 };

 const chartData = transformData(data);
 const config = widget.config?.visualization || { type: 'line' };
 const colors = config.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

 const renderChart = () => {
 const commonProps = {
 width: '100%',
 height: '100%',
 data: chartData,
 margin: { top: 5, right: 30, left: 20, bottom: 5 }
 };

 switch (config.type) {
 case 'bar':
 return (
 <ResponsiveContainer {...commonProps}>
 <BarChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis 
 dataKey={config.xAxis?.label || 'name'} 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <YAxis 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <Tooltip 
 contentStyle={{
 backgroundColor: 'hsl(var(--popover))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '6px'
 }}
 />
 {config.legend?.show && <Legend />}
 {config.series?.map((series, index) => (
 <Bar
 key={series.name}
 dataKey={series.dataKey}
 fill={series.color || colors[index % colors.length]}
 name={series.name}
 />
 )) || (
 <Bar dataKey="value" fill={colors[0]} />
 )}
 </BarChart>
 </ResponsiveContainer>
 );

 case 'area':
 return (
 <ResponsiveContainer {...commonProps}>
 <AreaChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis 
 dataKey={config.xAxis?.label || 'name'} 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <YAxis 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <Tooltip 
 contentStyle={{
 backgroundColor: 'hsl(var(--popover))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '6px'
 }}
 />
 {config.legend?.show && <Legend />}
 {config.series?.map((series, index) => (
 <Area
 key={series.name}
 type="monotone"
 dataKey={series.dataKey}
 stackId={config.stacked ? '1' : undefined}
 stroke={series.color || colors[index % colors.length]}
 fill={series.color || colors[index % colors.length]}
 fillOpacity={0.6}
 name={series.name}
 />
 )) || (
 <Area
 type="monotone"
 dataKey="value"
 stroke={colors[0]}
 fill={colors[0]}
 fillOpacity={0.6}
 />
 )}
 </AreaChart>
 </ResponsiveContainer>
 );

 case 'pie':
 return (
 <ResponsiveContainer {...commonProps}>
 <PieChart>
 <Pie
 data={chartData}
 cx="50%"
 cy="50%"
 outerRadius={80}
 fill={colors[0]}
 dataKey="value"
 label
 >
 {chartData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
 ))}
 </Pie>
 <Tooltip />
 {config.legend?.show && <Legend />}
 </PieChart>
 </ResponsiveContainer>
 );

 case 'line':
 default:
 return (
 <ResponsiveContainer {...commonProps}>
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis 
 dataKey={config.xAxis?.label || 'name'} 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <YAxis 
 className="fill-muted-foreground"
 fontSize={12}
 />
 <Tooltip 
 contentStyle={{
 backgroundColor: 'hsl(var(--popover))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '6px'
 }}
 />
 {config.legend?.show && <Legend />}
 {config.series?.map((series, index) => (
 <Line
 key={series.name}
 type={config.smooth ? 'monotone' : 'linear'}
 dataKey={series.dataKey}
 stroke={series.color || colors[index % colors.length]}
 strokeWidth={2}
 dot={false}
 name={series.name}
 />
 )) || (
 <Line
 type={config.smooth ? 'monotone' : 'linear'}
 dataKey="value"
 stroke={colors[0]}
 strokeWidth={2}
 dot={false}
 />
 )}
 </LineChart>
 </ResponsiveContainer>
 );
 }
 };

 return (
 <div className="h-full w-full">
 {chartData.length > 0 ? (
 renderChart()
 ) : (
 <div className="flex items-center justify-center h-full">
 <p className="text-sm text-muted-foreground">No data available</p>
 </div>
 )}
 </div>
 );
};

export default ChartWidget;