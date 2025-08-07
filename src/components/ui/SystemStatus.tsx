'use client';

import { useState, useEffect } from 'react';
import { 
 CheckCircle, 
 AlertTriangle, 
 XCircle, 
 Wifi, 
 WifiOff, 
 Server, 
 Database,
 ExternalLink,
 RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useError } from '@/contexts/ErrorContext';
import { backstageService } from '@/lib/backstage/service';

interface ServiceStatus {
 name: string;
 status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
 message?: string;
 lastCheck?: Date;
 responseTime?: number;
}

export function SystemStatus({ 
 compact = false,
 showDetails = false 
}: { 
 compact?: boolean;
 showDetails?: boolean;
}) {
 const { state } = useError();
 const [services, setServices] = useState<ServiceStatus[]>([]);
 const [loading, setLoading] = useState(false);
 const [expanded, setExpanded] = useState(false);

 const checkServicesHealth = async () => {
 setLoading(true);
 try {
 const startTime = Date.now();
 const health = await backstageService.getHealthStatus();
 const responseTime = Date.now() - startTime;

 const serviceStatuses: ServiceStatus[] = [
 {
 name: 'Backstage',
 status: health.backstage ? 'healthy' : 'degraded',
 message: health.backstage ? 'Service operational' : 'Using mock data',
 lastCheck: health.lastCheck || new Date(),
 responseTime: health.backstage ? responseTime : undefined,
 },
 {
 name: 'Database',
 status: health.database ? 'healthy' : 'unhealthy',
 message: health.database ? 'Connected' : 'Connection failed',
 lastCheck: new Date(),
 },
 {
 name: 'Network',
 status: state.isOnline ? 'healthy' : 'unhealthy',
 message: state.isOnline ? 'Online' : 'Offline',
 lastCheck: new Date(),
 },
 ];

 setServices(serviceStatuses);
 } catch (error) {
 console.error('Failed to check service health:', error);
 setServices([
 {
 name: 'System',
 status: 'unknown',
 message: 'Unable to check status',
 lastCheck: new Date(),
 },
 ]);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 checkServicesHealth();
 
 // Check every 30 seconds
 const interval = setInterval(checkServicesHealth, 30000);
 return () => clearInterval(interval);
 }, [state.isOnline, state.backstageAvailable, state.databaseAvailable]);

 const getOverallStatus = () => {
 if (services.length === 0) return 'unknown';
 
 const hasUnhealthy = services.some(s => s.status === 'unhealthy');
 const hasDegraded = services.some(s => s.status === 'degraded');
 
 if (hasUnhealthy) return 'unhealthy';
 if (hasDegraded) return 'degraded';
 return 'healthy';
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'healthy':
 return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'degraded':
 return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
 case 'unhealthy':
 return <XCircle className="w-4 h-4 text-red-600" />;
 default:
 return <RefreshCw className="w-4 h-4 text-gray-400" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy':
 return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
 case 'degraded':
 return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
 case 'unhealthy':
 return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
 default:
 return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600';
 }
 };

 const overallStatus = getOverallStatus();

 if (compact) {
 return (
 <div className="flex items-center gap-2">
 {getStatusIcon(overallStatus)}
 <span className="text-sm font-medium">
 {overallStatus === 'healthy' && 'All Systems Operational'}
 {overallStatus === 'degraded' && 'Minor Issues'}
 {overallStatus === 'unhealthy' && 'Service Disruption'}
 {overallStatus === 'unknown' && 'Status Unknown'}
 </span>
 {loading && <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />}
 </div>
 );
 }

 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div 
 className="flex items-center justify-between p-4 cursor-pointer"
 onClick={() => setExpanded(!expanded)}
 >
 <div className="flex items-center gap-3">
 {getStatusIcon(overallStatus)}
 <div>
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 System Status
 </h3>
 <p className={`text-sm ${getStatusColor(overallStatus).split(' ')[0]}`}>
 {overallStatus === 'healthy' && 'All systems operational'}
 {overallStatus === 'degraded' && 'Minor issues detected'}
 {overallStatus === 'unhealthy' && 'Service disruption'}
 {overallStatus === 'unknown' && 'Unable to determine status'}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 {loading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
 <button
 onClick={(e) => {
 e.stopPropagation();
 checkServicesHealth();
 }}
 className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 </div>

 <AnimatePresence>
 {(expanded || showDetails) && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="border-t border-gray-200 dark:border-gray-700 overflow-hidden"
 >
 <div className="p-4 space-y-3">
 {services.map((service, index) => (
 <div 
 key={service.name}
 className="flex items-center justify-between py-2"
 >
 <div className="flex items-center gap-3">
 {service.name === 'Network' && (
 state.isOnline ? 
 <Wifi className="w-4 h-4 text-green-600" /> : 
 <WifiOff className="w-4 h-4 text-red-600" />
 )}
 {service.name === 'Backstage' && (
 <Server className="w-4 h-4 text-blue-600" />
 )}
 {service.name === 'Database' && (
 <Database className="w-4 h-4 text-purple-600" />
 )}
 
 <div>
 <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {service.name}
 </p>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {service.message}
 {service.responseTime && ` (${service.responseTime}ms)`}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 {getStatusIcon(service.status)}
 {service.lastCheck && (
 <span className="text-xs text-gray-400">
 {service.lastCheck.toLocaleTimeString()}
 </span>
 )}
 </div>
 </div>
 ))}
 
 {state.errors.length > 0 && (
 <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
 Recent Issues
 </h4>
 <div className="space-y-2">
 {state.errors.slice(0, 3).map((error) => (
 <div 
 key={error.id}
 className={`p-2 rounded text-xs border ${getStatusColor(error.type === 'error' ? 'unhealthy' : 'degraded')}`}
 >
 <div className="flex items-center justify-between">
 <span>{error.message}</span>
 <span className="text-gray-400">
 {error.timestamp.toLocaleTimeString()}
 </span>
 </div>
 {error.context && (
 <div className="text-gray-500 mt-1">
 Context: {error.context}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

// Status badge for navigation or headers
export function StatusBadge() {
 const { state } = useError();
 const [health, setHealth] = useState<any>(null);

 useEffect(() => {
 backstageService.getHealthStatus().then(setHealth).catch(() => {});
 }, []);

 const hasIssues = !state.isOnline || !state.backstageAvailable || !state.databaseAvailable;
 
 if (!hasIssues && health?.backstage) {
 return null; // Don't show badge when everything is working
 }

 return (
 <div className="relative">
 <div className={`w-2 h-2 rounded-full ${
 hasIssues ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
 }`} />
 </div>
 );
}