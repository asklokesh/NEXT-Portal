'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import { CheckCircle, AlertCircle, XCircle, Clock, Activity, Zap } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import type { Widget, ServiceHealthData } from '../types';

interface ServiceHealthWidgetProps {
 widget: Widget;
 data?: ServiceHealthData[];
 isEditing?: boolean;
}

const ServiceHealthWidget: React.FC<ServiceHealthWidgetProps> = ({ widget, data, isEditing }) => {
 // Mock data if not provided
 const mockData: ServiceHealthData[] = [
 {
 serviceId: 'auth-service',
 status: 'healthy',
 uptime: 99.9,
 responseTime: 45,
 errorRate: 0.1,
 lastChecked: new Date()
 },
 {
 serviceId: 'user-service',
 status: 'degraded',
 uptime: 98.5,
 responseTime: 120,
 errorRate: 2.3,
 lastChecked: new Date()
 },
 {
 serviceId: 'payment-service',
 status: 'healthy',
 uptime: 99.95,
 responseTime: 32,
 errorRate: 0.05,
 lastChecked: new Date()
 },
 {
 serviceId: 'notification-service',
 status: 'down',
 uptime: 85.2,
 responseTime: 0,
 errorRate: 100,
 lastChecked: new Date()
 }
 ];

 // Transform data from metrics service format
 const transformServices = (rawData: any) => {
 if (rawData?.services && Array.isArray(rawData.services)) {
 return rawData.services.map((service: any): ServiceHealthData => ({
 serviceId: service.id || service.entityRef || service.name,
 status: service.status === 'unhealthy' ? 'down' : 
 service.status === 'degraded' ? 'degraded' :
 service.status === 'healthy' ? 'healthy' : 'down',
 uptime: service.uptime || 99.9,
 responseTime: service.responseTime || 0,
 errorRate: service.errorRate || 0,
 lastChecked: service.lastChecked ? new Date(service.lastChecked) : new Date()
 }));
 }
 return mockData;
 };

 const services = transformServices(data);

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'healthy':
 return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'degraded':
 return <AlertCircle className="w-4 h-4 text-yellow-600" />;
 case 'down':
 return <XCircle className="w-4 h-4 text-red-600" />;
 default:
 return <Clock className="w-4 h-4 text-gray-600" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy':
 return 'text-green-600 bg-green-50';
 case 'degraded':
 return 'text-yellow-600 bg-yellow-50';
 case 'down':
 return 'text-red-600 bg-red-50';
 default:
 return 'text-gray-600 bg-gray-50';
 }
 };

 const getUptimeColor = (uptime: number) => {
 if (uptime >= 99.5) return 'text-green-600';
 if (uptime >= 95) return 'text-yellow-600';
 return 'text-red-600';
 };

 const formatServiceName = (serviceId: string) => {
 return serviceId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
 };

 return (
 <div className="h-full overflow-auto">
 <div className="space-y-3">
 {services.map((service) => (
 <div
 key={service.serviceId}
 className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
 >
 {/* Service header */}
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 {getStatusIcon(service.status)}
 <span className="font-medium text-sm">
 {formatServiceName(service.serviceId)}
 </span>
 </div>
 <span className={cn(
 'px-2 py-0.5 text-xs font-medium rounded-full',
 getStatusColor(service.status)
 )}>
 {service.status}
 </span>
 </div>

 {/* Metrics */}
 <div className="grid grid-cols-3 gap-3 text-xs">
 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <Activity className="w-3 h-3" />
 <span>Uptime</span>
 </div>
 <div className={cn('font-medium', getUptimeColor(service.uptime))}>
 {service.uptime.toFixed(2)}%
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <Zap className="w-3 h-3" />
 <span>Response</span>
 </div>
 <div className="font-medium">
 {service.status === 'down' ? 'N/A' : `${service.responseTime}ms`}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <AlertCircle className="w-3 h-3" />
 <span>Error Rate</span>
 </div>
 <div className={cn(
 'font-medium',
 service.errorRate > 5 ? 'text-red-600' :
 service.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'
 )}>
 {service.errorRate.toFixed(1)}%
 </div>
 </div>
 </div>

 {/* Last checked */}
 <div className="mt-2 text-xs text-muted-foreground">
 Last checked: {service.lastChecked.toLocaleTimeString()}
 </div>
 </div>
 ))}
 </div>

 {services.length === 0 && (
 <div className="flex items-center justify-center h-full">
 <p className="text-sm text-muted-foreground">No services to monitor</p>
 </div>
 )}
 </div>
 );
};

export default ServiceHealthWidget;