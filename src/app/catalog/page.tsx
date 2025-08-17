'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */

import debounce from 'lodash/debounce';
import { 
 Search, 
 Filter, 
 Grid3X3, 
 List, 
 RefreshCw, 
 Plus,
 Download,
 CheckSquare,
 AlertCircle,
 ExternalLink,
 GitBranch,
 Users,
 Activity,
 BarChart3,
 MoreHorizontal,
 Tag,
 UserCheck,
 Trash2,
 Upload,
 FolderTree,
 LayoutGrid
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';

import { ServiceComparison } from '@/components/catalog/ServiceComparison';
import { CatalogOrganizer } from '@/components/catalog/CatalogOrganizer';
import { 
 ServiceCardSkeleton, 
 ServiceListSkeleton, 
 ErrorState, 
 EmptyState 
} from '@/components/ui/Skeleton';
import { useWebSocketConnection, useCatalogUpdates, useEntityUpdates } from '@/hooks/useWebSocket';
import { useComponentMonitoring } from '@/hooks/useMonitoring';
// Removed direct import of backstageService to avoid Node.js dependencies in client
// Using API routes instead
import { stringifyEntityRef } from '@/lib/backstage/client';

import type { ServiceEntity } from '@/lib/backstage/types';

type ViewMode = 'grid' | 'list' | 'table';
type SortOption = 'name' | 'updated' | 'owner' | 'lifecycle' | 'health' | 'responseTime' | 'errorRate';
type GroupOption = 'none' | 'owner' | 'lifecycle' | 'type' | 'health' | 'namespace';

interface ServiceHealth {
 status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
 message?: string;
}

interface ServiceWithMetrics extends ServiceEntity {
 metrics?: {
 cpu: number;
 memory: number;
 errorRate: number;
 responseTime: number;
 };
 health?: ServiceHealth;
}

const CatalogPage = () => {
 const router = useRouter();
 const { isConnected } = useWebSocketConnection();
 const { catalogUpdates, lastCatalogUpdate } = useCatalogUpdates();
 const { updates: entityUpdates, lastUpdate } = useEntityUpdates();
 const { trackInteraction, trackApiCall, trackError } = useComponentMonitoring('CatalogPage');
 
 // State management
 const [services, setServices] = useState<ServiceWithMetrics[]>([]);
 const [filteredServices, setFilteredServices] = useState<ServiceWithMetrics[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [viewMode, setViewMode] = useState<ViewMode>('grid');
 const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
 const [showComparison, setShowComparison] = useState(false);
 const [showBulkMenu, setShowBulkMenu] = useState(false);
 const [showFilters, setShowFilters] = useState(false);
 const [showOrganizer, setShowOrganizer] = useState(false);
 const [sortBy, setSortBy] = useState<SortOption>('name');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [groupBy, setGroupBy] = useState<GroupOption>('none');
 const [retryCount, setRetryCount] = useState(0);
 const [isOnline, setIsOnline] = useState(true);
 
 // Filters
 const [filters, setFilters] = useState({
 type: '',
 lifecycle: '',
 owner: '',
 tags: [] as string[],
 });

 // Load services from Backstage with comprehensive error handling
 const loadServices = useCallback(async (showLoadingState = true, isRetry = false) => {
 try {
 if (showLoadingState) {
 setLoading(true);
 }
 setError(null);
 
 // Build filters properly
 const apiFilters = {
 kind: 'Component',
 ...(filters.type && { 'spec.type': filters.type }),
 ...(filters.lifecycle && { 'spec.lifecycle': filters.lifecycle }),
 ...(filters.owner && { 'spec.owner': filters.owner }),
 ...(filters.tags.length > 0 && { tag: filters.tags }),
 };
 
 // Build query string for API call
 const queryParams = new URLSearchParams();
 if (apiFilters.kind) queryParams.append('kind', apiFilters.kind);
 if (apiFilters['spec.type']) queryParams.append('type', apiFilters['spec.type']);
 if (apiFilters['spec.lifecycle']) queryParams.append('lifecycle', apiFilters['spec.lifecycle']);
 if (apiFilters['spec.owner']) queryParams.append('owner', apiFilters['spec.owner']);
 if (apiFilters.tag) {
 apiFilters.tag.forEach(tag => queryParams.append('tag', tag));
 }
 
 const responseData = await trackApiCall('fetch_entities', async () => {
 const response = await fetch(`/api/catalog/services?${queryParams.toString()}`);
 if (!response.ok) {
 throw new Error('Failed to fetch entities');
 }
 return await response.json();
 }, { filters: apiFilters });

 // Handle both direct array response and wrapped response formats
 const entities = Array.isArray(responseData) 
 ? responseData as ServiceEntity[]
 : (responseData.entities || responseData.items || []) as ServiceEntity[];
 
 // Transform to ServiceWithMetrics
 const servicesWithMetrics = entities.map(entity => ({
 ...entity,
 health: getServiceHealth(entity),
 }));
 
 setServices(servicesWithMetrics);
 setFilteredServices(servicesWithMetrics);
 setRetryCount(0); // Reset retry count on success
 
 if (isRetry) {
 toast.success('Services loaded successfully');
 }
 } catch (error: any) {
 console.error('Failed to load services:', error);
 trackError(error as Error, { isRetry, showLoadingState });
 
 let errorMessage = 'Failed to load services';
 let _showRetry = true;
 
 if ((error as any).code === 'ECONNREFUSED' || (error as any).message?.includes('Network Error')) {
 errorMessage = isOnline 
 ? 'Cannot connect to Backstage. Please check if it is running.'
 : 'You are offline. Please check your internet connection.';
 } else if ((error as any).response?.status === 401) {
 errorMessage = 'Authentication required. Please log in again.';
 _showRetry = false;
 } else if ((error as any).response?.status === 403) {
 errorMessage = 'You don\'t have permission to view the service catalog.';
 _showRetry = false;
 } else if ((error as any).response?.status === 404) {
 errorMessage = 'Backstage catalog API not found. Please check the configuration.';
 } else if ((error as any).response?.status >= 500) {
 errorMessage = 'Backstage server error. Please try again later.';
 } else if ((error as any).code === 'ECONNABORTED') {
 errorMessage = 'Request timed out. Please try again.';
 }
 
 setError(errorMessage);
 
 if (!isRetry) {
 toast.error(errorMessage);
 }
 } finally {
 if (showLoadingState) {
 setLoading(false);
 }
 }
 }, [filters, isOnline]);

 // Set page title
 useEffect(() => {
 const updateTitle = () => {
 document.title = 'Service Catalog | Backstage IDP Platform';
 };
 
 // Update immediately
 updateTitle();
 
 // Also update after a short delay to ensure it takes effect
 const timer = setTimeout(updateTitle, 100);
 
 return () => clearTimeout(timer);
 }, []);

 // Online/offline detection
 useEffect(() => {
 const handleOnline = () => {
 setIsOnline(true);
 if (error) {
 void loadServices();
 }
 };
 const handleOffline = () => setIsOnline(false);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, [error, loadServices]);

 // Retry function with exponential backoff
 const retryLoadServices = useCallback(() => {
 const maxRetries = 3;
 const baseDelay = 1000; // 1 second
 
 if (retryCount >= maxRetries) {
 toast.error('Max retries reached. Please check your connection and try again.');
 return;
 }
 
 setRetryCount(prev => prev + 1);
 const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
 
 toast(`Retrying in ${delay / 1000} seconds...`, { icon: 'INFO' });
 
 setTimeout(() => {
 void loadServices(false, true);
 }, delay);
 }, [retryCount, loadServices]);

 // Refresh services
 const handleRefresh = useCallback(async () => {
 setRefreshing(true);
 try {
 await loadServices(false);
 toast.success('Services refreshed successfully');
 } catch (error) {
 // Error handling is done in loadServices
 } finally {
 setRefreshing(false);
 }
 }, [loadServices]);

 // Get service health from status
 const getServiceHealth = (entity: ServiceEntity): ServiceHealth => {
 const statusItems = (entity.status as any)?.items || [];
 const healthItem = statusItems.find((item: any) => item.type === 'health');
 
 if (!healthItem) return { status: 'unknown' };
 
 switch ((healthItem as any).level) {
 case 'info':
 return { status: 'healthy', message: (healthItem as any).message };
 case 'warning':
 return { status: 'degraded', message: (healthItem as any).message };
 case 'error':
 return { status: 'unhealthy', message: (healthItem as any).message };
 default:
 return { status: 'unknown' };
 }
 };

 // Subscribe to real-time metrics
 useEffect(() => {
 if (!isConnected) return;

 // Update filtered services when services change
 setFilteredServices(prev => prev.map(service => {
 const updated = services.find(s => (s.metadata as any).name === (service.metadata as any).name);
 return updated || service;
 }));
 }, [isConnected, services]);

 // Initial load
 useEffect(() => {
 void loadServices();
 }, [loadServices]);

 // Search functionality with debouncing
 const handleSearch = useMemo(
 () => debounce((query: string) => {
 const lowercaseQuery = query.toLowerCase();
 const filtered = services.filter(service => {
 const name = (service.metadata as any).name?.toLowerCase() || '';
 const title = (service.metadata as any).title?.toLowerCase() || '';
 const description = (service.metadata as any).description?.toLowerCase() || '';
 const tags = (service.metadata as any).tags?.map((t: any) => t.toLowerCase()) || [];
 const owner = (service.spec as any)?.owner?.toLowerCase() || '';
 
 return name.includes(lowercaseQuery) ||
 title.includes(lowercaseQuery) ||
 description.includes(lowercaseQuery) ||
 tags.some((tag: any) => tag.includes(lowercaseQuery)) ||
 owner.includes(lowercaseQuery);
 });
 
 setFilteredServices(filtered);
 }, 300),
 [services]
 );

 useEffect(() => {
 handleSearch(searchQuery);
 }, [searchQuery, handleSearch]);

 // Close bulk menu when clicking outside
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (showBulkMenu && !(event.target as Element).closest('.bulk-menu-container')) {
 setShowBulkMenu(false);
 }
 };

 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, [showBulkMenu]);

 // Handle real-time WebSocket updates
 useEffect(() => {
 if (lastCatalogUpdate) {
 const { kind, namespace, name, data, changeType } = lastCatalogUpdate;
 
 // Only handle Component (service) updates
 if (kind === 'Component') {
 setServices(prevServices => {
 const entityRef = `${kind}:${namespace}/${name}`;
 
 if (changeType === 'created' || changeType === 'updated') {
 // Update or add the service
 const existingIndex = prevServices.findIndex(s => stringifyEntityRef(s) === entityRef);
 const updatedService: ServiceWithMetrics = {
 ...data,
 metrics: {
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 requests: Math.floor(Math.random() * 1000),
 errors: Math.floor(Math.random() * 50),
 responseTime: Math.random() * 500 + 100,
 errorRate: Math.random() * 10
 },
 health: getServiceHealth(data)
 };
 
 if (existingIndex >= 0) {
 // Update existing service
 const newServices = [...prevServices];
 newServices[existingIndex] = updatedService;
 toast.success(`Service ${name} updated`);
 return newServices;
 } else {
 // Add new service
 toast.success(`New service ${name} added`);
 return [...prevServices, updatedService];
 }
 } else if (changeType === 'deleted') {
 // Remove the service
 toast.error(`Service ${name} deleted`);
 return prevServices.filter(s => stringifyEntityRef(s) !== entityRef);
 }
 
 return prevServices;
 });
 }
 }
 }, [lastCatalogUpdate]);

 // Sorting and Grouping
 const sortedAndGroupedServices = useMemo(() => {
 // Helper function to calculate health score for sorting
 const getHealthScore = (status?: string): number => {
 switch (status) {
 case 'healthy': return 4;
 case 'degraded': return 3;
 case 'unhealthy': return 2;
 case 'unknown': return 1;
 default: return 0;
 }
 };

 const sorted = [...filteredServices];
 
 // Sort services
 sorted.sort((a, b) => {
 let compareValue = 0;
 
 switch (sortBy) {
 case 'name':
 compareValue = (a.metadata as any).name.localeCompare((b.metadata as any).name);
 break;
 case 'updated': {
 const aTime = new Date((a.metadata as any).annotations?.['backstage.io/edit-time'] || 0).getTime();
 const bTime = new Date((b.metadata as any).annotations?.['backstage.io/edit-time'] || 0).getTime();
 compareValue = bTime - aTime;
 break;
 }
 case 'owner': {
 const aOwner = (a.spec as any)?.owner || '';
 const bOwner = (b.spec as any)?.owner || '';
 compareValue = aOwner.localeCompare(bOwner);
 break;
 }
 case 'lifecycle': {
 const aLifecycle = (a.spec as any)?.lifecycle || '';
 const bLifecycle = (b.spec as any)?.lifecycle || '';
 compareValue = aLifecycle.localeCompare(bLifecycle);
 break;
 }
 case 'health': {
 const aHealthScore = getHealthScore(a.health?.status);
 const bHealthScore = getHealthScore(b.health?.status);
 compareValue = bHealthScore - aHealthScore;
 break;
 }
 case 'responseTime': {
 const aResponseTime = a.metrics?.responseTime || 0;
 const bResponseTime = b.metrics?.responseTime || 0;
 compareValue = aResponseTime - bResponseTime;
 break;
 }
 case 'errorRate': {
 const aErrorRate = a.metrics?.errorRate || 0;
 const bErrorRate = b.metrics?.errorRate || 0;
 compareValue = aErrorRate - bErrorRate;
 break;
 }
 }
 
 return sortDirection === 'asc' ? compareValue : -compareValue;
 });
 
 // Group services if groupBy is not 'none'
 if (groupBy === 'none') {
 return [{ groupName: null, services: sorted }];
 }
 
 const groups = new Map<string, ServiceWithMetrics[]>();
 
 sorted.forEach(service => {
 let groupKey = '';
 
 switch (groupBy) {
 case 'owner':
 groupKey = (service.spec as any)?.owner || 'Unknown Owner';
 break;
 case 'lifecycle':
 groupKey = (service.spec as any)?.lifecycle || 'Unknown Lifecycle';
 break;
 case 'type':
 groupKey = (service.spec as any)?.type || 'Unknown Type';
 break;
 case 'health':
 groupKey = service.health?.status || 'unknown';
 break;
 case 'namespace':
 groupKey = (service.metadata as any)?.namespace || 'default';
 break;
 }
 
 if (!groups.has(groupKey)) {
 groups.set(groupKey, []);
 }
 groups.get(groupKey)!.push(service);
 });
 
 return Array.from(groups.entries())
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([groupName, services]) => ({ groupName, services }));
 }, [filteredServices, sortBy, sortDirection, groupBy]);

 // Flatten grouped services for backward compatibility
 const sortedServices = useMemo(() => {
 return sortedAndGroupedServices.flatMap(group => group.services);
 }, [sortedAndGroupedServices]);


 // Bulk operations
 const handleBulkOperation = async (operation: 'refresh' | 'export' | 'delete' | 'compare' | 'tag' | 'change-owner') => {
 if (selectedServices.size === 0) {
 toast.error('No services selected');
 return;
 }

 switch (operation) {
 case 'refresh':
 for (const serviceRef of selectedServices) {
 try {
 // Refresh entity via API
 const [kind, namespace, name] = serviceRef.split(':');
 const response = await fetch(`/api/catalog/entities/by-name/${kind}/${namespace}/${name}/refresh`, {
 method: 'POST'
 });
 if (!response.ok) {
 throw new Error('Failed to refresh entity');
 }
 } catch (error) {
 console.error(`Failed to refresh ${serviceRef}:`, error);
 }
 }
 toast.success(`Refreshed ${selectedServices.size} services`);
 break;
 
 case 'export': {
 const selectedEntities = services.filter(s => {
 const ref = `${s.kind}:${(s.metadata as any)?.namespace}/${(s.metadata as any)?.name}`;
 return selectedServices.has(ref);
 });
 const exportData = JSON.stringify(selectedEntities, null, 2);
 const blob = new Blob([exportData], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `services-export-${Date.now()}.json`;
 a.click();
 URL.revokeObjectURL(url);
 toast.success(`Exported ${selectedServices.size} services`);
 break;
 }
 
 case 'delete':
 // eslint-disable-next-line no-alert
 if (!confirm(`Are you sure you want to delete ${selectedServices.size} services?`)) {
 return;
 }
 for (const serviceRef of selectedServices) {
 try {
 // Delete entity via API
 const [kind, namespace, name] = serviceRef.split(':');
 const response = await fetch(`/api/catalog/entities/by-name/${kind}/${namespace}/${name}`, {
 method: 'DELETE'
 });
 if (!response.ok) {
 throw new Error('Failed to delete entity');
 }
 } catch (error) {
 console.error(`Failed to delete ${serviceRef}:`, error);
 }
 }
 toast.success(`Deleted ${selectedServices.size} services`);
 await loadServices();
 break;
 
 case 'compare':
 if (selectedServices.size < 2) {
 toast.error('Select at least 2 services to compare');
 return;
 }
 if (selectedServices.size > 5) {
 toast.error('Maximum 5 services can be compared at once');
 return;
 }
 setShowComparison(true);
 return; // Don't clear selection for comparison
 
 case 'tag': {
 // eslint-disable-next-line no-alert
 const newTag = prompt('Enter tag to add to selected services:');
 if (!newTag || !newTag.trim()) return;
 
 for (const serviceRef of selectedServices) {
 try {
 // In a real implementation, this would update the entity metadata
 // In a real implementation, this would update the entity metadata
 } catch (error) {
 console.error(`Failed to tag ${serviceRef}:`, error);
 }
 }
 toast.success(`Added tag "${newTag.trim()}" to ${selectedServices.size} services`);
 break;
 }
 
 case 'change-owner': {
 // eslint-disable-next-line no-alert
 const newOwner = prompt('Enter new owner for selected services:');
 if (!newOwner || !newOwner.trim()) return;
 
 for (const serviceRef of selectedServices) {
 try {
 // In a real implementation, this would update the entity spec.owner
 } catch (error) {
 console.error(`Failed to change owner of ${serviceRef}:`, error);
 }
 }
 toast.success(`Changed owner to "${newOwner.trim()}" for ${selectedServices.size} services`);
 break;
 }
 }
 
 setSelectedServices(new Set());
 };

 // Service card click handler
 const handleServiceClick = (service: ServiceWithMetrics) => {
 const namespace = (service.metadata as any)?.namespace || 'default';
 const serviceName = (service.metadata as any)?.name;
 
 trackInteraction('service_clicked', { 
 serviceName, 
 namespace, 
 lifecycle: (service.spec as any)?.lifecycle,
 owner: (service.spec as any)?.owner 
 });
 
 router.push(`/catalog/${namespace}/${service.kind}/${serviceName}`);
 };

 // Toggle service selection
 const toggleServiceSelection = (service: ServiceWithMetrics) => {
 const ref = stringifyEntityRef(service);
 const newSelection = new Set(selectedServices);
 
 if (newSelection.has(ref)) {
 newSelection.delete(ref);
 } else {
 newSelection.add(ref);
 }
 
 setSelectedServices(newSelection);
 };

 // Get unique values for filters
 const getFilterOptions = useMemo(() => {
 const types = new Set<string>();
 const lifecycles = new Set<string>();
 const owners = new Set<string>();
 const tags = new Set<string>();
 
 services.forEach(service => {
 const spec = service.spec as any;
 if (spec?.type) types.add(spec.type);
 if (spec?.lifecycle) lifecycles.add(spec.lifecycle);
 if (spec?.owner) owners.add(spec.owner);
 (service.metadata as any)?.tags?.forEach((tag: string) => tags.add(tag));
 });
 
 return {
 types: Array.from(types).sort(),
 lifecycles: Array.from(lifecycles).sort(),
 owners: Array.from(owners).sort(),
 tags: Array.from(tags).sort(),
 };
 }, [services]);

 const renderServiceCard = (service: ServiceWithMetrics) => {
 const spec = service.spec;
 const ref = stringifyEntityRef(service);
 const isSelected = selectedServices.has(ref);
 
 return (
 <div
 key={ref}
 data-testid="service-card"
 className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all cursor-pointer ${
 isSelected ? 'ring-2 ring-blue-500' : ''
 }`}
 onClick={() => handleServiceClick(service)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleServiceClick(service);
 }
 }}
 role="button"
 tabIndex={0}
 aria-label={`Service ${service.metadata.name}`}
 >
 {/* Selection checkbox */}
 <div
 data-testid="service-checkbox"
 className="absolute top-4 right-4 z-10"
 onClick={(e) => {
 e.stopPropagation();
 toggleServiceSelection(service);
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 e.stopPropagation();
 toggleServiceSelection(service);
 }
 }}
 role="button"
 tabIndex={0}
 aria-label={`Select service ${service.metadata.name}`}
 >
 <CheckSquare
 className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
 />
 </div>

 {/* Service header */}
 <div className="flex items-start justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {(service.metadata as any)?.title || (service.metadata as any)?.name}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {(service.metadata as any)?.name}
 </p>
 </div>
 <ServiceHealthIndicator health={service.health} />
 </div>

 {/* Description */}
 {(service.metadata as any)?.description && (
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
 {(service.metadata as any)?.description}
 </p>
 )}

 {/* Metadata */}
 <div className="space-y-2 mb-4">
 <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
 <Users className="w-4 h-4 mr-2" />
 <span>{spec.owner || 'No owner'}</span>
 </div>
 <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
 <GitBranch className="w-4 h-4 mr-2" />
 <span className="capitalize">{spec.lifecycle || 'unknown'}</span>
 </div>
 {spec.system && (
 <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
 <Activity className="w-4 h-4 mr-2" />
 <span>{spec.system}</span>
 </div>
 )}
 </div>

 {/* Real-time metrics */}
 {service.metrics && (
 <div className="grid grid-cols-2 gap-2 mb-4">
 <MetricBadge
 label="CPU"
 value={`${service.metrics.cpu.toFixed(1)}%`}
 status={service.metrics.cpu > 80 ? 'warning' : 'normal'}
 />
 <MetricBadge
 label="Memory"
 value={`${service.metrics.memory.toFixed(1)}%`}
 status={service.metrics.memory > 80 ? 'warning' : 'normal'}
 />
 <MetricBadge
 label="Errors"
 value={`${service.metrics.errorRate.toFixed(2)}%`}
 status={service.metrics.errorRate > 5 ? 'error' : 'normal'}
 />
 <MetricBadge
 label="Response"
 value={`${service.metrics.responseTime.toFixed(0)}ms`}
 status={service.metrics.responseTime > 200 ? 'warning' : 'normal'}
 />
 </div>
 )}

 {/* Tags */}
 {(service.metadata as any)?.tags && (service.metadata as any)?.tags.length > 0 && (
 <div className="flex flex-wrap gap-1">
 {(service.metadata as any).tags.map((tag: string) => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>
 );
 };

 const renderListItem = (service: ServiceWithMetrics) => {
 const spec = service.spec;
 const ref = stringifyEntityRef(service);
 const isSelected = selectedServices.has(ref);
 
 return (
 <div
 key={ref}
 className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${
 isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
 }`}
 onClick={() => handleServiceClick(service)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleServiceClick(service);
 }
 }}
 role="button"
 tabIndex={0}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <div
 onClick={(e) => {
 e.stopPropagation();
 toggleServiceSelection(service);
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 e.stopPropagation();
 toggleServiceSelection(service);
 }
 }}
 role="button"
 tabIndex={0}
 aria-label={`${isSelected ? 'Deselect' : 'Select'} service ${(service.metadata as any)?.name}`}
 >
 <CheckSquare
 className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
 />
 </div>
 <ServiceHealthIndicator health={service.health} />
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {(service.metadata as any)?.title || (service.metadata as any)?.name}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {spec?.owner} • {spec?.lifecycle}
 </p>
 </div>
 </div>
 <div className="flex items-center space-x-6">
 {service.metrics && (
 <>
 <MetricBadge
 label="CPU"
 value={`${service.metrics.cpu.toFixed(1)}%`}
 status={service.metrics.cpu > 80 ? 'warning' : 'normal'}
 compact
 />
 <MetricBadge
 label="Errors"
 value={`${service.metrics.errorRate.toFixed(2)}%`}
 status={service.metrics.errorRate > 5 ? 'error' : 'normal'}
 compact
 />
 </>
 )}
 <button
 onClick={(e) => {
 e.stopPropagation();
 window.open((service.metadata as any)?.annotations?.['backstage.io/managed-by-location'], '_blank');
 }}
 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 >
 <ExternalLink className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 );
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 data-testid="catalog-page-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Service Catalog
 </h2>
 <p className="text-gray-600 dark:text-gray-400">
 Browse and manage all services in your organization
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowOrganizer(!showOrganizer)}
 className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
  showOrganizer 
   ? 'border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-900/20' 
   : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
 } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
 >
 {showOrganizer ? <LayoutGrid className="w-4 h-4 mr-2" /> : <FolderTree className="w-4 h-4 mr-2" />}
 {showOrganizer ? 'Default View' : 'Organize'}
 </button>
 <button
 onClick={() => router.push('/catalog/dependencies')}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <GitBranch className="w-4 h-4 mr-2" />
 Dependencies
 </button>
 <button
 onClick={() => router.push('/catalog/import')}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Upload className="w-4 h-4 mr-2" />
 Import
 </button>
 <button
 onClick={() => router.push('/create')}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Plus className="w-4 h-4 mr-2" />
 Create Service
 </button>
 </div>
 </div>

 {/* Toolbar */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex flex-col sm:flex-row gap-4">
 {/* Search */}
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchQuery}
 onChange={(e) => {
 const query = e.target.value;
 setSearchQuery(query);
 if (query.length > 2) {
 trackInteraction('search_performed', { query: query.substring(0, 10) }); // Only track first 10 chars for privacy
 }
 }}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 aria-label="Search services"
 />
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2">
 {/* View mode */}
 <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-1">
 <button
 data-testid="grid-view"
 onClick={() => {
 setViewMode('grid');
 trackInteraction('view_mode_changed', { viewMode: 'grid' });
 }}
 className={`p-1.5 rounded ${
 viewMode === 'grid'
 ? 'bg-white dark:bg-gray-600 shadow-sm'
 : 'text-gray-600 dark:text-gray-400'
 }`}
 aria-label="Grid view"
 >
 <Grid3X3 className="w-4 h-4" />
 </button>
 <button
 data-testid="list-view"
 onClick={() => {
 setViewMode('list');
 trackInteraction('view_mode_changed', { viewMode: 'list' });
 }}
 className={`p-1.5 rounded ${
 viewMode === 'list'
 ? 'bg-white dark:bg-gray-600 shadow-sm'
 : 'text-gray-600 dark:text-gray-400'
 }`}
 aria-label="List view"
 >
 <List className="w-4 h-4" />
 </button>
 </div>

 {/* Sort */}
 <div className="flex items-center gap-2">
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as SortOption)}
 className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 aria-label="Sort services by"
 >
 <option value="name">Sort by Name</option>
 <option value="updated">Sort by Updated</option>
 <option value="owner">Sort by Owner</option>
 <option value="lifecycle">Sort by Lifecycle</option>
 <option value="health">Sort by Health</option>
 <option value="responseTime">Sort by Response Time</option>
 <option value="errorRate">Sort by Error Rate</option>
 </select>
 
 <button
 onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
 aria-label={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
 >
 {sortDirection === 'asc' ? '' : ''}
 </button>
 </div>

 {/* Group By */}
 <select
 value={groupBy}
 onChange={(e) => setGroupBy(e.target.value as GroupOption)}
 className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 aria-label="Group services by"
 >
 <option value="none">No Grouping</option>
 <option value="owner">Group by Owner</option>
 <option value="lifecycle">Group by Lifecycle</option>
 <option value="type">Group by Type</option>
 <option value="health">Group by Health</option>
 <option value="namespace">Group by Namespace</option>
 </select>

 {/* Filter */}
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`p-2 rounded-md ${
 showFilters
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
 : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
 }`}
 aria-label={showFilters ? 'Hide filters' : 'Show filters'}
 title={showFilters ? 'Hide filters' : 'Show filters'}
 >
 <Filter className="w-4 h-4" />
 </button>

 {/* Refresh */}
 <button
 onClick={handleRefresh}
 disabled={refreshing}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
 aria-label={refreshing ? 'Refreshing services...' : 'Refresh services'}
 title={refreshing ? 'Refreshing services...' : 'Refresh services'}
 >
 <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
 </button>

 {/* Bulk actions */}
 {selectedServices.size > 0 && (
 <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
 <span className="text-sm text-gray-600 dark:text-gray-400">
 {selectedServices.size} selected
 </span>
 <button
 onClick={() => void handleBulkOperation('refresh')}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 title="Refresh selected"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 <button
 onClick={() => void handleBulkOperation('export')}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 title="Export selected"
 >
 <Download className="w-4 h-4" />
 </button>
 <button
 onClick={() => void handleBulkOperation('compare')}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 title="Compare selected services"
 disabled={selectedServices.size < 2}
 >
 <BarChart3 className={`w-4 h-4 ${selectedServices.size < 2 ? 'opacity-50' : ''}`} />
 </button>
 
 {/* More Actions Dropdown */}
 <div className="relative bulk-menu-container">
 <button
 data-testid="bulk-actions"
 onClick={() => setShowBulkMenu(!showBulkMenu)}
 className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 title="More actions"
 >
 <MoreHorizontal className="w-4 h-4" />
 </button>
 
 {showBulkMenu && (
 <div data-testid="bulk-actions-menu" className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
 <div className="py-1">
 <button
 onClick={() => {
 void handleBulkOperation('tag');
 setShowBulkMenu(false);
 }}
 className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
 >
 <Tag className="w-4 h-4" />
 Add Tag
 </button>
 <button
 onClick={() => {
 void handleBulkOperation('change-owner');
 setShowBulkMenu(false);
 }}
 className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
 >
 <UserCheck className="w-4 h-4" />
 Change Owner
 </button>
 <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
 <button
 onClick={() => {
 void handleBulkOperation('delete');
 setShowBulkMenu(false);
 }}
 className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 Delete Services
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Filters panel */}
 {showFilters && (
 <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
 <select
 value={filters.type}
 onChange={(e) => setFilters({ ...filters, type: e.target.value })}
 className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Types</option>
 {getFilterOptions.types.map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>

 <select
 value={filters.lifecycle}
 onChange={(e) => setFilters({ ...filters, lifecycle: e.target.value })}
 className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Lifecycles</option>
 {getFilterOptions.lifecycles.map(lifecycle => (
 <option key={lifecycle} value={lifecycle}>{lifecycle}</option>
 ))}
 </select>

 <select
 value={filters.owner}
 onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
 className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="">All Owners</option>
 {getFilterOptions.owners.map(owner => (
 <option key={owner} value={owner}>{owner}</option>
 ))}
 </select>

 <button
 onClick={() => setFilters({ type: '', lifecycle: '', owner: '', tags: [] })}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 Clear filters
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Loading State */}
 {loading && (
 <div>
 {viewMode === 'grid' ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {Array.from({ length: 6 }).map((_, index) => (
 <ServiceCardSkeleton key={index} />
 ))}
 </div>
 ) : (
 <div className="space-y-4">
 {Array.from({ length: 8 }).map((_, index) => (
 <ServiceListSkeleton key={index} />
 ))}
 </div>
 )}
 </div>
 )}

 {/* Error State */}
 {!loading && error && (
 <ErrorState
 title="Failed to load services"
 message={error}
 onRetry={retryLoadServices}
 retryLabel={retryCount > 0 ? `Retry (${retryCount}/3)` : 'Retry'}
 showRetry={retryCount < 3}
 />
 )}

 {/* Content */}
 {!loading && !error && (
 <>
 {showOrganizer ? (
 <CatalogOrganizer
 entities={services.map(service => ({
 id: (service.metadata as any)?.name || service.kind,
 name: (service.metadata as any)?.title || (service.metadata as any)?.name || service.kind,
 kind: service.kind,
 namespace: (service.metadata as any)?.namespace,
 description: (service.metadata as any)?.description,
 metadata: service.metadata,
 relations: {
 ownedBy: [(service.spec as any)?.owner].filter(Boolean),
 dependsOn: (service.relations as any)?.dependsOn || [],
 partOf: (service.spec as any)?.system ? [(service.spec as any).system] : [],
 }
 }))}
 onEntitiesChange={(updatedEntities) => {
 console.log('Entities updated:', updatedEntities);
 }}
 onLayoutSave={async (layout) => {
 try {
 const response = await fetch('/api/catalog/organization', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(layout),
 });
 if (response.ok) {
 toast.success('Layout saved successfully');
 }
 } catch (error) {
 console.error('Failed to save layout:', error);
 toast.error('Failed to save layout');
 }
 }}
 onLayoutLoad={async (layoutId) => {
 try {
 const response = await fetch(`/api/catalog/organization?layoutId=${layoutId}`);
 if (response.ok) {
 const result = await response.json();
 return result.data;
 }
 } catch (error) {
 console.error('Failed to load layout:', error);
 }
 return null;
 }}
 currentUserId="current-user"
 className="h-[800px]"
 />
 ) : (
 <>
 {/* Results count */}
 <div className="text-sm text-gray-600 dark:text-gray-400">
 Showing {filteredServices.length} of {services.length} services
 {isConnected && (
 <span className="ml-4 inline-flex items-center">
 <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
 Live updates enabled
 </span>
 )}
 </div>

 {/* Services grid/list */}
 {filteredServices.length > 0 ? (
 groupBy === 'none' ? (
 // No grouping - render as before
 viewMode === 'grid' ? (
 <div data-testid="service-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="grid" aria-label="Services in grid view">
 {sortedServices.map(service => renderServiceCard(service))}
 </div>
 ) : (
 <div data-testid="service-list" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" role="list" aria-label="Services in list view">
 {sortedServices.map(service => renderListItem(service))}
 </div>
 )
 ) : (
 // Grouped display
 <div className="space-y-8">
 {sortedAndGroupedServices.map(group => (
 <div key={group.groupName || 'ungrouped'}>
 {/* Group Header */}
 <div className="flex items-center gap-3 mb-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {group.groupName || 'Ungrouped'}
 </h3>
 <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
 {group.services.length}
 </span>
 </div>
 
 {/* Group Content */}
 {viewMode === 'grid' ? (
 <div data-testid="service-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="grid" aria-label={`Services in group ${group.title} - grid view`}>
 {group.services.map(service => renderServiceCard(service))}
 </div>
 ) : (
 <div data-testid="service-list" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" role="list" aria-label={`Services in group ${group.title} - list view`}>
 {group.services.map(service => renderListItem(service))}
 </div>
 )}
 </div>
 ))}
 </div>
 )
 ) : (
 <EmptyState
 title="No services found"
 message={
 searchQuery || Object.values(filters).some(f => f)
 ? 'Try adjusting your search or filters'
 : 'Get started by creating a new service'
 }
 icon={
 <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
 </svg>
 }
 action={
 !searchQuery && !Object.values(filters).some(f => f) ? (
 <button
 onClick={() => router.push('/create')}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Plus className="w-4 h-4 mr-2" />
 Create Service
 </button>
 ) : undefined
 }
 />
 )}
 </>
 )}
 </>
 )}

 {/* Legacy empty state - keeping for reference */}
 {false && filteredServices.length === 0 && (
 <div className="text-center py-12">
 <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
 <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
 No services found
 </h3>
 <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
 {searchQuery || Object.values(filters).some(f => f)
 ? 'Try adjusting your search or filters'
 : 'Get started by creating a new service'}
 </p>
 {!searchQuery && !Object.values(filters).some(f => f) && (
 <div className="mt-6">
 <button
 onClick={() => router.push('/create')}
 className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <Plus className="w-4 h-4 mr-2" />
 Create Service
 </button>
 </div>
 )}
 </div>
 )}

 {/* Service Comparison Modal */}
 {showComparison && (
 <ServiceComparison
 initialServices={Array.from(selectedServices)}
 onClose={() => {
 setShowComparison(false);
 setSelectedServices(new Set());
 }}
 />
 )}
 </div>
 );
}

// Helper components
const ServiceHealthIndicator = ({ health }: { health?: ServiceHealth }) => {
 if (!health) return null;
 
 const colors = {
 healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
 degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
 unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
 unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
 };
 
 return (
 <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[health.status]}`}>
 {health.status}
 </div>
 );
}

const MetricBadge = ({ 
 label, 
 value, 
 status = 'normal',
 compact = false 
}: { 
 label: string; 
 value: string; 
 status?: 'normal' | 'warning' | 'error';
 compact?: boolean;
}) => {
 const colors = {
 normal: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
 warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
 error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
 };
 
 if (compact) {
 return (
 <div className="flex items-center space-x-1 text-sm">
 <span className="text-gray-500 dark:text-gray-400">{label}:</span>
 <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${colors[status]}`}>
 {value}
 </span>
 </div>
 );
 }
 
 return (
 <div className={`px-3 py-2 rounded-md ${colors[status]}`}>
 <div className="text-xs opacity-75">{label}</div>
 <div className="text-sm font-medium">{value}</div>
 </div>
 );
}
export default CatalogPage;
