'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import { 
 CheckCircle, 
 XCircle, 
 Clock, 
 AlertCircle,
 GitBranch,
 User,
 Timer,
 GitCommit
} from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import type { Widget, DeploymentData } from '../types';

interface DeploymentWidgetProps {
 widget: Widget;
 data?: DeploymentData[];
 isEditing?: boolean;
}

const DeploymentWidget: React.FC<DeploymentWidgetProps> = ({ widget, data, isEditing }) => {
 // Mock data if not provided
 const mockData: DeploymentData[] = [
 {
 id: 'deploy-1',
 service: 'user-service',
 version: 'v2.3.1',
 environment: 'production',
 status: 'success',
 startTime: new Date(Date.now() - 3600000),
 endTime: new Date(Date.now() - 3300000),
 deployer: 'alice@company.com',
 commits: 5
 },
 {
 id: 'deploy-2',
 service: 'auth-service',
 version: 'v1.8.2',
 environment: 'staging',
 status: 'in_progress',
 startTime: new Date(Date.now() - 600000),
 deployer: 'bob@company.com',
 commits: 3
 },
 {
 id: 'deploy-3',
 service: 'payment-service',
 version: 'v3.1.0',
 environment: 'production',
 status: 'failed',
 startTime: new Date(Date.now() - 7200000),
 endTime: new Date(Date.now() - 6900000),
 deployer: 'charlie@company.com',
 commits: 8
 }
 ];

 // Transform data from metrics service format
 const transformDeployments = (rawData: any) => {
 if (rawData?.deployments && Array.isArray(rawData.deployments)) {
 return rawData.deployments.map((deployment: any): DeploymentData => ({
 id: deployment.id,
 service: deployment.entityRef?.split('/')[1] || 'unknown',
 version: deployment.version,
 environment: 'production', // Default since not provided
 status: deployment.status,
 startTime: new Date(deployment.timestamp),
 endTime: deployment.status === 'success' || deployment.status === 'failed' 
 ? new Date(deployment.timestamp) 
 : undefined,
 deployer: deployment.deployer,
 commits: Math.floor(Math.random() * 10) + 1 // Mock commits count
 }));
 }
 return mockData;
 };

 const deployments = transformDeployments(data);

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'success':
 return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'failed':
 return <XCircle className="w-4 h-4 text-red-600" />;
 case 'in_progress':
 return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
 case 'rolled_back':
 return <AlertCircle className="w-4 h-4 text-yellow-600" />;
 default:
 return <Clock className="w-4 h-4 text-gray-600" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'success':
 return 'text-green-600 bg-green-50';
 case 'failed':
 return 'text-red-600 bg-red-50';
 case 'in_progress':
 return 'text-blue-600 bg-blue-50';
 case 'rolled_back':
 return 'text-yellow-600 bg-yellow-50';
 default:
 return 'text-gray-600 bg-gray-50';
 }
 };

 const getEnvironmentColor = (environment: string) => {
 switch (environment) {
 case 'production':
 return 'text-red-700 bg-red-100';
 case 'staging':
 return 'text-yellow-700 bg-yellow-100';
 case 'development':
 return 'text-green-700 bg-green-100';
 default:
 return 'text-gray-700 bg-gray-100';
 }
 };

 const formatDuration = (startTime: Date, endTime?: Date) => {
 const end = endTime || new Date();
 const duration = Math.floor((end.getTime() - startTime.getTime()) / 1000);
 
 if (duration < 60) {
 return `${duration}s`;
 } else if (duration < 3600) {
 return `${Math.floor(duration / 60)}m ${duration % 60}s`;
 } else {
 const hours = Math.floor(duration / 3600);
 const minutes = Math.floor((duration % 3600) / 60);
 return `${hours}h ${minutes}m`;
 }
 };

 const formatTimeAgo = (date: Date) => {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMins < 1) return 'just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 return `${diffDays}d ago`;
 };

 return (
 <div className="h-full overflow-auto">
 <div className="space-y-3">
 {deployments.map((deployment) => (
 <div
 key={deployment.id}
 className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
 >
 {/* Header */}
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 {getStatusIcon(deployment.status)}
 <div>
 <div className="font-medium text-sm">{deployment.service}</div>
 <div className="text-xs text-muted-foreground">
 {deployment.version}
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <span className={cn(
 'px-2 py-0.5 text-xs font-medium rounded-full',
 getEnvironmentColor(deployment.environment)
 )}>
 {deployment.environment}
 </span>
 <span className={cn(
 'px-2 py-0.5 text-xs font-medium rounded-full',
 getStatusColor(deployment.status)
 )}>
 {deployment.status.replace('_', ' ')}
 </span>
 </div>
 </div>

 {/* Details */}
 <div className="grid grid-cols-2 gap-4 text-xs">
 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <User className="w-3 h-3" />
 <span>Deployer</span>
 </div>
 <div className="font-medium">
 {deployment.deployer.split('@')[0]}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <Timer className="w-3 h-3" />
 <span>Duration</span>
 </div>
 <div className="font-medium">
 {formatDuration(deployment.startTime, deployment.endTime)}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <GitCommit className="w-3 h-3" />
 <span>Commits</span>
 </div>
 <div className="font-medium">
 {deployment.commits}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1 text-muted-foreground mb-1">
 <Clock className="w-3 h-3" />
 <span>Started</span>
 </div>
 <div className="font-medium">
 {formatTimeAgo(deployment.startTime)}
 </div>
 </div>
 </div>

 {/* Progress bar for in-progress deployments */}
 {deployment.status === 'in_progress' && (
 <div className="mt-3">
 <div className="w-full bg-muted rounded-full h-1.5">
 <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 Deployment in progress...
 </div>
 </div>
 )}
 </div>
 ))}
 </div>

 {deployments.length === 0 && (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
 <p className="text-sm text-muted-foreground">No recent deployments</p>
 </div>
 </div>
 )}
 </div>
 );
};

export default DeploymentWidget;