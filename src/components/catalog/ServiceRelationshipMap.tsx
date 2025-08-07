'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-hooks/exhaustive-deps */

// Removed date-fns import - using native JavaScript date formatting instead
import { motion, AnimatePresence } from 'framer-motion';
import {
 Network,
 GitBranch,
 Package,
 Database,
 Cloud,
 Server,
 Users,
 Shield,
 Zap,
 AlertCircle,
 ChevronRight,
 ChevronDown,
 Filter,
 Download,
 Maximize2,
 Search,
 Settings,
 Info,
 ExternalLink,
 Copy,
 Check
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

interface ServiceNode {
 id: string;
 name: string;
 type: 'service' | 'database' | 'api' | 'frontend' | 'backend' | 'external';
 status: 'healthy' | 'warning' | 'error' | 'unknown';
 owner: string;
 version: string;
 dependencies: string[];
 dependents: string[];
 metadata: {
 language?: string;
 framework?: string;
 deployments?: number;
 lastUpdated?: string;
 sla?: string;
 criticality?: 'high' | 'medium' | 'low';
 };
}

interface Relationship {
 source: string;
 target: string;
 type: 'depends_on' | 'consumes' | 'provides' | 'calls' | 'data_flow';
 protocol?: string;
 latency?: number;
 throughput?: string;
 errors?: number;
}

interface ServiceRelationshipMapProps {
 serviceId?: string;
 depth?: number;
 hideExternal?: boolean;
}

export const ServiceRelationshipMap = ({ 
 serviceId, 
 depth = 2,
 hideExternal = false 
}: ServiceRelationshipMapProps) => {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const [services, setServices] = useState<ServiceNode[]>([]);
 const [relationships, setRelationships] = useState<Relationship[]>([]);
 const [selectedService, setSelectedService] = useState<ServiceNode | null>(null);
 const [hoveredService, setHoveredService] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [viewMode, setViewMode] = useState<'graph' | 'tree' | 'matrix'>('graph');
 const [filters, setFilters] = useState({
 status: 'all',
 type: 'all',
 criticality: 'all'
 });
 const [searchTerm, setSearchTerm] = useState('');
 const [showLegend, setShowLegend] = useState(true);
 const [copied, setCopied] = useState(false);

 useEffect(() => {
 loadServiceRelationships();
 }, [serviceId, depth]);

 const loadServiceRelationships = async () => {
 try {
 setLoading(true);
 
 // Generate mock service relationship data
 const mockData = generateMockRelationships(serviceId, depth);
 setServices(mockData.services);
 setRelationships(mockData.relationships);
 
 if (serviceId) {
 const selected = mockData.services.find(s => s.id === serviceId);
 setSelectedService(selected || null);
 }
 } catch (error) {
 console.error('Failed to load service relationships:', error);
 toast.error('Failed to load service relationships');
 } finally {
 setLoading(false);
 }
 };

 const generateMockRelationships = (centerServiceId?: string, maxDepth: number = 2) => {
 const services: ServiceNode[] = [];
 const relationships: Relationship[] = [];
 
 // Core services
 const coreServices = [
 {
 id: centerServiceId || 'user-service',
 name: 'User Service',
 type: 'backend' as const,
 status: 'healthy' as const,
 owner: 'platform-team',
 version: '2.3.1',
 dependencies: ['auth-service', 'user-db', 'cache-service'],
 dependents: ['frontend-app', 'mobile-app', 'admin-portal'],
 metadata: {
 language: 'Go',
 framework: 'gin',
 deployments: 45,
 lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
 sla: '99.9%',
 criticality: 'high' as const
 }
 },
 {
 id: 'auth-service',
 name: 'Authentication Service',
 type: 'backend' as const,
 status: 'healthy' as const,
 owner: 'security-team',
 version: '3.1.0',
 dependencies: ['auth-db', 'cache-service', 'oauth-provider'],
 dependents: ['user-service', 'api-gateway'],
 metadata: {
 language: 'Java',
 framework: 'Spring Boot',
 deployments: 38,
 lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
 sla: '99.95%',
 criticality: 'high' as const
 }
 },
 {
 id: 'api-gateway',
 name: 'API Gateway',
 type: 'api' as const,
 status: 'warning' as const,
 owner: 'platform-team',
 version: '1.8.2',
 dependencies: ['auth-service', 'rate-limiter'],
 dependents: ['frontend-app', 'mobile-app', 'external-api'],
 metadata: {
 language: 'Node.js',
 framework: 'Express',
 deployments: 52,
 lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
 sla: '99.9%',
 criticality: 'high' as const
 }
 },
 {
 id: 'frontend-app',
 name: 'Web Application',
 type: 'frontend' as const,
 status: 'healthy' as const,
 owner: 'frontend-team',
 version: '4.2.0',
 dependencies: ['api-gateway', 'cdn-service'],
 dependents: [],
 metadata: {
 language: 'TypeScript',
 framework: 'React',
 deployments: 67,
 lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
 criticality: 'medium' as const
 }
 },
 {
 id: 'user-db',
 name: 'User Database',
 type: 'database' as const,
 status: 'healthy' as const,
 owner: 'data-team',
 version: 'PostgreSQL 14',
 dependencies: [],
 dependents: ['user-service', 'analytics-service'],
 metadata: {
 deployments: 12,
 lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
 sla: '99.99%',
 criticality: 'high' as const
 }
 },
 {
 id: 'cache-service',
 name: 'Redis Cache',
 type: 'database' as const,
 status: 'healthy' as const,
 owner: 'platform-team',
 version: 'Redis 7.0',
 dependencies: [],
 dependents: ['user-service', 'auth-service', 'session-service'],
 metadata: {
 deployments: 8,
 lastUpdated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
 sla: '99.9%',
 criticality: 'medium' as const
 }
 },
 {
 id: 'analytics-service',
 name: 'Analytics Service',
 type: 'backend' as const,
 status: 'error' as const,
 owner: 'data-team',
 version: '1.5.3',
 dependencies: ['user-db', 'event-stream', 'data-warehouse'],
 dependents: ['admin-portal', 'reporting-api'],
 metadata: {
 language: 'Python',
 framework: 'FastAPI',
 deployments: 23,
 lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
 sla: '99.5%',
 criticality: 'low' as const
 }
 },
 {
 id: 'oauth-provider',
 name: 'OAuth Provider',
 type: 'external' as const,
 status: 'unknown' as const,
 owner: 'external',
 version: 'OAuth 2.0',
 dependencies: [],
 dependents: ['auth-service'],
 metadata: {
 criticality: 'high' as const
 }
 }
 ];

 services.push(...coreServices);

 // Generate relationships
 services.forEach(service => {
 service.dependencies.forEach(depId => {
 relationships.push({
 source: service.id,
 target: depId,
 type: 'depends_on',
 protocol: 'HTTP/REST',
 latency: Math.floor(Math.random() * 100) + 10,
 throughput: `${Math.floor(Math.random() * 1000) + 100} req/s`,
 errors: Math.floor(Math.random() * 10)
 });
 });
 });

 return { services, relationships };
 };

 const getServiceIcon = (type: string) => {
 switch (type) {
 case 'database': return Database;
 case 'api': return Cloud;
 case 'frontend': return Package;
 case 'backend': return Server;
 case 'external': return ExternalLink;
 default: return Package;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
 case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
 };

 const getCriticalityColor = (criticality: string) => {
 switch (criticality) {
 case 'high': return 'border-red-500';
 case 'medium': return 'border-yellow-500';
 case 'low': return 'border-green-500';
 default: return 'border-gray-300';
 }
 };

 const filteredServices = services.filter(service => {
 if (hideExternal && service.type === 'external') return false;
 if (filters.status !== 'all' && service.status !== filters.status) return false;
 if (filters.type !== 'all' && service.type !== filters.type) return false;
 if (filters.criticality !== 'all' && service.metadata.criticality !== filters.criticality) return false;
 if (searchTerm && !service.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
 return true;
 });

 const renderGraphView = () => {
 // Simple grid layout for services
 const cols = Math.ceil(Math.sqrt(filteredServices.length));
 
 return (
 <div className="relative h-full">
 <svg className="absolute inset-0 w-full h-full">
 {/* Render relationships as lines */}
 {relationships.map((rel, idx) => {
 const sourceService = filteredServices.find(s => s.id === rel.source);
 const targetService = filteredServices.find(s => s.id === rel.target);
 if (!sourceService || !targetService) return null;
 
 const sourceIdx = filteredServices.indexOf(sourceService);
 const targetIdx = filteredServices.indexOf(targetService);
 
 const sourceX = (sourceIdx % cols) * 250 + 125;
 const sourceY = Math.floor(sourceIdx / cols) * 200 + 100;
 const targetX = (targetIdx % cols) * 250 + 125;
 const targetY = Math.floor(targetIdx / cols) * 200 + 100;
 
 return (
 <g key={idx}>
 <line
 x1={sourceX}
 y1={sourceY}
 x2={targetX}
 y2={targetY}
 stroke={rel.errors && rel.errors > 5 ? '#ef4444' : '#9ca3af'}
 strokeWidth={hoveredService === rel.source || hoveredService === rel.target ? 3 : 1}
 strokeDasharray={rel.type === 'data_flow' ? '5,5' : undefined}
 opacity={hoveredService && hoveredService !== rel.source && hoveredService !== rel.target ? 0.2 : 0.5}
 />
 {/* Arrow marker */}
 <polygon
 points={`${targetX},${targetY} ${targetX - 5},${targetY - 5} ${targetX - 5},${targetY + 5}`}
 fill={rel.errors && rel.errors > 5 ? '#ef4444' : '#9ca3af'}
 opacity={hoveredService && hoveredService !== rel.source && hoveredService !== rel.target ? 0.2 : 0.5}
 />
 </g>
 );
 })}
 </svg>
 
 {/* Render service nodes */}
 <div className="relative grid grid-cols-auto gap-8 p-8">
 {filteredServices.map((service, idx) => {
 const Icon = getServiceIcon(service.type);
 const isSelected = selectedService?.id === service.id;
 const isHovered = hoveredService === service.id;
 
 return (
 <motion.div
 key={service.id}
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: idx * 0.05 }}
 className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-56 cursor-pointer
 border-2 ${getCriticalityColor(service.metadata.criticality || 'low')}
 ${isSelected ? 'ring-2 ring-blue-500' : ''}
 ${isHovered ? 'transform scale-105' : ''}`}
 onMouseEnter={() => setHoveredService(service.id)}
 onMouseLeave={() => setHoveredService(null)}
 onClick={() => setSelectedService(service)}
 style={{
 gridColumn: (idx % cols) + 1,
 gridRow: Math.floor(idx / cols) + 1
 }}
 >
 <div className="flex items-start justify-between mb-2">
 <div className={`p-2 rounded ${getStatusColor(service.status)}`}>
 <Icon className="w-5 h-5" />
 </div>
 <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(service.status)}`}>
 {service.status}
 </span>
 </div>
 
 <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
 {service.name}
 </h3>
 
 <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
 <div>Version: {service.version}</div>
 <div>Owner: {service.owner}</div>
 {service.metadata.sla && <div>SLA: {service.metadata.sla}</div>}
 </div>
 
 <div className="mt-2 flex items-center justify-between text-xs">
 <span className="text-gray-500">
 {service.dependencies.length} deps
 </span>
 <span className="text-gray-500">
 {service.dependents.length} dependents
 </span>
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 );
 };

 const renderTreeView = () => {
 const renderNode = (service: ServiceNode, level: number = 0) => {
 const Icon = getServiceIcon(service.type);
 const isExpanded = true; // For simplicity, all expanded
 
 return (
 <div key={service.id} className={`${level > 0 ? 'ml-8' : ''}`}>
 <div
 className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
 onClick={() => setSelectedService(service)}
 >
 {service.dependencies.length > 0 && (
 isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
 )}
 {service.dependencies.length === 0 && <div className="w-4" />}
 
 <div className={`p-1 rounded ${getStatusColor(service.status)}`}>
 <Icon className="w-4 h-4" />
 </div>
 
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {service.name}
 </span>
 
 <span className="text-xs text-gray-500 ml-2">
 v{service.version}
 </span>
 
 {service.metadata.criticality && (
 <span className={`ml-auto text-xs px-2 py-1 rounded-full
 ${service.metadata.criticality === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
 service.metadata.criticality === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
 {service.metadata.criticality}
 </span>
 )}
 </div>
 
 {isExpanded && service.dependencies.length > 0 && (
 <div className="ml-4">
 {service.dependencies.map(depId => {
 const dep = services.find(s => s.id === depId);
 if (dep) return renderNode(dep, level + 1);
 return null;
 })}
 </div>
 )}
 </div>
 );
 };
 
 const rootServices = filteredServices.filter(s => s.dependents.length === 0);
 
 return (
 <div className="p-4 space-y-2">
 {rootServices.map(service => renderNode(service))}
 </div>
 );
 };

 const renderMatrixView = () => {
 return (
 <div className="p-4">
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
 <thead className="bg-gray-50 dark:bg-gray-800">
 <tr>
 <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
 Service
 </th>
 {filteredServices.map(service => (
 <th key={service.id} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
 <div className="transform -rotate-45 origin-center">
 {service.name.substring(0, 10)}...
 </div>
 </th>
 ))}
 </tr>
 </thead>
 <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
 {filteredServices.map(sourceService => (
 <tr key={sourceService.id}>
 <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
 {sourceService.name}
 </td>
 {filteredServices.map(targetService => {
 const relationship = relationships.find(
 r => r.source === sourceService.id && r.target === targetService.id
 );
 return (
 <td key={targetService.id} className="px-2 py-2 text-center">
 {relationship && (
 <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center
 ${relationship.errors && relationship.errors > 5 ? 'bg-red-100' : 'bg-green-100'}`}>
 <span className="text-xs">
 {relationship.type === 'depends_on' ? 'D' :
 relationship.type === 'consumes' ? 'C' :
 relationship.type === 'provides' ? 'P' :
 relationship.type === 'calls' ? 'A' : 'F'}
 </span>
 </div>
 )}
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 
 <div className="mt-4 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 bg-green-100 rounded-full"></div>
 <span>Healthy Connection</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 bg-red-100 rounded-full"></div>
 <span>Connection with Errors</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="font-mono">D</span>=Depends On
 <span className="font-mono">C</span>=Consumes
 <span className="font-mono">P</span>=Provides
 <span className="font-mono">A</span>=Calls
 <span className="font-mono">F</span>=Data Flow
 </div>
 </div>
 </div>
 );
 };

 const exportDiagram = () => {
 // Export as SVG or PNG
 toast.success('Relationship diagram exported');
 };

 const copyServiceInfo = async () => {
 if (selectedService) {
 const info = `${selectedService.name} (${selectedService.version})
Type: ${selectedService.type}
Status: ${selectedService.status}
Owner: ${selectedService.owner}
Dependencies: ${selectedService.dependencies.join(', ')}
Dependents: ${selectedService.dependents.join(', ')}`;
 
 await navigator.clipboard.writeText(info);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 toast.success('Service info copied to clipboard');
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
 {/* Header */}
 <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Service Relationship Map
 </h2>
 
 {/* View Mode Toggle */}
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
 <button
 onClick={() => setViewMode('graph')}
 className={`px-3 py-1 text-sm rounded ${viewMode === 'graph' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Graph
 </button>
 <button
 onClick={() => setViewMode('tree')}
 className={`px-3 py-1 text-sm rounded ${viewMode === 'tree' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Tree
 </button>
 <button
 onClick={() => setViewMode('matrix')}
 className={`px-3 py-1 text-sm rounded ${viewMode === 'matrix' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Matrix
 </button>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowLegend(!showLegend)}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 title="Toggle legend"
 >
 <Info className="w-4 h-4" />
 </button>
 
 <button
 onClick={exportDiagram}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 title="Export diagram"
 >
 <Download className="w-4 h-4" />
 </button>
 
 <button
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 title="Fullscreen"
 >
 <Maximize2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 
 {/* Filters */}
 <div className="mt-4 flex items-center gap-4">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 
 <select
 value={filters.status}
 onChange={(e) => setFilters({ ...filters, status: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Status</option>
 <option value="healthy">Healthy</option>
 <option value="warning">Warning</option>
 <option value="error">Error</option>
 <option value="unknown">Unknown</option>
 </select>
 
 <select
 value={filters.type}
 onChange={(e) => setFilters({ ...filters, type: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Types</option>
 <option value="frontend">Frontend</option>
 <option value="backend">Backend</option>
 <option value="api">API</option>
 <option value="database">Database</option>
 <option value="external">External</option>
 </select>
 
 <select
 value={filters.criticality}
 onChange={(e) => setFilters({ ...filters, criticality: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Criticality</option>
 <option value="high">High</option>
 <option value="medium">Medium</option>
 <option value="low">Low</option>
 </select>
 </div>
 </div>
 
 {/* Main Content */}
 <div className="flex-1 flex">
 {/* Diagram Area */}
 <div className="flex-1 overflow-auto">
 {viewMode === 'graph' && renderGraphView()}
 {viewMode === 'tree' && renderTreeView()}
 {viewMode === 'matrix' && renderMatrixView()}
 </div>
 
 {/* Details Panel */}
 {selectedService && (
 <motion.div
 initial={{ opacity: 0, x: 300 }}
 animate={{ opacity: 1, x: 0 }}
 className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto"
 >
 <div className="flex items-start justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {selectedService.name}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 {selectedService.type} • v{selectedService.version}
 </p>
 </div>
 
 <button
 onClick={copyServiceInfo}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 >
 {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
 </button>
 </div>
 
 <div className="space-y-4">
 {/* Status */}
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</h4>
 <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(selectedService.status)}`}>
 {selectedService.status}
 </span>
 </div>
 
 {/* Metadata */}
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Details</h4>
 <dl className="space-y-1 text-sm">
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">Owner</dt>
 <dd className="text-gray-900 dark:text-gray-100">{selectedService.owner}</dd>
 </div>
 {selectedService.metadata.language && (
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">Language</dt>
 <dd className="text-gray-900 dark:text-gray-100">{selectedService.metadata.language}</dd>
 </div>
 )}
 {selectedService.metadata.framework && (
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">Framework</dt>
 <dd className="text-gray-900 dark:text-gray-100">{selectedService.metadata.framework}</dd>
 </div>
 )}
 {selectedService.metadata.sla && (
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">SLA</dt>
 <dd className="text-gray-900 dark:text-gray-100">{selectedService.metadata.sla}</dd>
 </div>
 )}
 {selectedService.metadata.deployments && (
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">Deployments</dt>
 <dd className="text-gray-900 dark:text-gray-100">{selectedService.metadata.deployments}</dd>
 </div>
 )}
 {selectedService.metadata.lastUpdated && (
 <div className="flex justify-between">
 <dt className="text-gray-600 dark:text-gray-400">Last Updated</dt>
 <dd className="text-gray-900 dark:text-gray-100">
 {new Date(selectedService.metadata.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
 </dd>
 </div>
 )}
 </dl>
 </div>
 
 {/* Dependencies */}
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Dependencies ({selectedService.dependencies.length})
 </h4>
 <div className="space-y-1">
 {selectedService.dependencies.map(depId => {
 const dep = services.find(s => s.id === depId);
 if (!dep) return null;
 const Icon = getServiceIcon(dep.type);
 return (
 <div
 key={depId}
 className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
 onClick={() => setSelectedService(dep)}
 >
 <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
 <span className="text-sm text-gray-900 dark:text-gray-100">{dep.name}</span>
 <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${getStatusColor(dep.status)}`}>
 {dep.status}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 
 {/* Dependents */}
 <div>
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Dependents ({selectedService.dependents.length})
 </h4>
 <div className="space-y-1">
 {selectedService.dependents.map(depId => {
 const dep = services.find(s => s.id === depId);
 if (!dep) return null;
 const Icon = getServiceIcon(dep.type);
 return (
 <div
 key={depId}
 className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
 onClick={() => setSelectedService(dep)}
 >
 <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
 <span className="text-sm text-gray-900 dark:text-gray-100">{dep.name}</span>
 <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${getStatusColor(dep.status)}`}>
 {dep.status}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </div>
 
 {/* Legend */}
 {showLegend && (
 <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
 <div className="flex items-center gap-8 text-xs text-gray-600 dark:text-gray-400">
 <div className="flex items-center gap-4">
 <span className="font-medium">Service Types:</span>
 <div className="flex items-center gap-2">
 <Package className="w-4 h-4" /> Frontend
 </div>
 <div className="flex items-center gap-2">
 <Server className="w-4 h-4" /> Backend
 </div>
 <div className="flex items-center gap-2">
 <Cloud className="w-4 h-4" /> API
 </div>
 <div className="flex items-center gap-2">
 <Database className="w-4 h-4" /> Database
 </div>
 <div className="flex items-center gap-2">
 <ExternalLink className="w-4 h-4" /> External
 </div>
 </div>
 
 <div className="flex items-center gap-4">
 <span className="font-medium">Status:</span>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-green-500 rounded-full"></div> Healthy
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-yellow-500 rounded-full"></div> Warning
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-red-500 rounded-full"></div> Error
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-gray-500 rounded-full"></div> Unknown
 </div>
 </div>
 
 <div className="flex items-center gap-4">
 <span className="font-medium">Criticality:</span>
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 border-2 border-red-500 rounded"></div> High
 </div>
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 border-2 border-yellow-500 rounded"></div> Medium
 </div>
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 border-2 border-green-500 rounded"></div> Low
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}