'use client';

import { 
 LayoutGrid, 
 List, 
 GitBranch, 
 Map,
 Filter as _Filter,
 Download as _Download,
 Upload as _Upload,
 Settings,
 RefreshCw,
 AlertCircle,
 CheckSquare as _CheckSquare,
 Square as _Square,
 Trash2,
 Edit,
 Share2,
 BarChart3
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { GridContainer } from './CatalogGrid/GridContainer';
import { ServiceTable } from './CatalogList/ServiceTable';
import { BulkActionsBar } from './common/BulkActionsBar';
import { ViewToggle } from './common/ViewToggle';
import { FilterPanel } from './Search/FilterPanel';
import { SearchBar } from './Search/SearchBar';
import { generateMockServices } from './utils/mockData';

import type { 
 ServiceEntity, 
 CatalogView, 
 CatalogFilters, 
 CatalogState,
 BulkOperation 
} from './types';

interface CatalogLayoutProps {
 initialServices?: ServiceEntity[];
 onServiceSelect?: (service: ServiceEntity) => void;
 className?: string;
}

// URL state management hook
const useUrlState = () => {
 const router = useRouter();
 const searchParams = useSearchParams();

 const getFiltersFromUrl = (): CatalogFilters => {
 const filters: CatalogFilters = {};
 
 const search = searchParams.get('search');
 if (search) filters.search = search;
 
 const types = searchParams.get('types');
 if (types) filters.types = types.split(',');
 
 const lifecycles = searchParams.get('lifecycles');
 if (lifecycles) filters.lifecycles = lifecycles.split(',');
 
 const owners = searchParams.get('owners');
 if (owners) filters.owners = owners.split(',');
 
 const sortBy = searchParams.get('sortBy');
 if (sortBy) filters.sortBy = sortBy as CatalogFilters['sortBy'];
 
 const sortOrder = searchParams.get('sortOrder');
 if (sortOrder) filters.sortOrder = sortOrder as CatalogFilters['sortOrder'];
 
 return filters;
 };

 const updateUrl = (filters: CatalogFilters, view: CatalogView) => {
 const params = new URLSearchParams();
 
 if (filters.search) params.set('search', filters.search);
 if (filters.types?.length) params.set('types', filters.types.join(','));
 if (filters.lifecycles?.length) params.set('lifecycles', filters.lifecycles.join(','));
 if (filters.owners?.length) params.set('owners', filters.owners.join(','));
 if (filters.sortBy) params.set('sortBy', filters.sortBy);
 if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
 params.set('view', view);
 
 router.push(`?${params.toString()}`, { scroll: false });
 };

 return { getFiltersFromUrl, updateUrl };
};

// Main catalog layout component
export const CatalogLayout: React.FC<CatalogLayoutProps> = ({ 
 initialServices,
 onServiceSelect,
 className 
}) => {
 // State management
 const [state, setState] = useState<CatalogState>({
 services: initialServices || generateMockServices(100),
 loading: false,
 error: null,
 filters: {},
 view: 'grid',
 selectedServices: [],
 expandedGroups: [],
 virtualization: {
 itemHeight: 280,
 overscan: 2,
 scrollDebounceMs: 150,
 },
 });

 const { getFiltersFromUrl, updateUrl } = useUrlState();
 const searchParams = useSearchParams();

 // Initialize from URL
 useEffect(() => {
 const urlFilters = getFiltersFromUrl();
 const view = searchParams.get('view') as CatalogView || 'grid';
 
 setState(prev => ({
 ...prev,
 filters: urlFilters,
 view,
 }));
 }, [getFiltersFromUrl, searchParams]);

 // Filter services based on current filters
 const filteredServices = useMemo(() => {
 let filtered = [...state.services];

 // Apply search filter
 if (state.filters.search) {
 const searchTerm = state.filters.search.toLowerCase();
 filtered = filtered.filter(service => 
 service.metadata.name.toLowerCase().includes(searchTerm) ||
 service.metadata.title?.toLowerCase().includes(searchTerm) ||
 service.metadata.description?.toLowerCase().includes(searchTerm) ||
 service.metadata.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
 );
 }

 // Apply type filter
 if (state.filters.types?.length) {
 filtered = filtered.filter(service => 
 state.filters.types!.includes(service.spec.type)
 );
 }

 // Apply lifecycle filter
 if (state.filters.lifecycles?.length) {
 filtered = filtered.filter(service => 
 state.filters.lifecycles!.includes(service.spec.lifecycle)
 );
 }

 // Apply owner filter
 if (state.filters.owners?.length) {
 filtered = filtered.filter(service => {
 const owner = service.spec.owner.replace('group:', '').replace('user:', '');
 return state.filters.owners!.includes(owner);
 });
 }

 // Apply health filter
 if (state.filters.health?.length) {
 filtered = filtered.filter(service => 
 state.filters.health!.includes(service.status?.health || 'unknown')
 );
 }

 // Apply sorting
 if (state.filters.sortBy) {
 filtered.sort((a, b) => {
 let aValue: string;
 let bValue: string;

 switch (state.filters.sortBy) {
 case 'name':
 aValue = a.metadata.title || a.metadata.name;
 bValue = b.metadata.title || b.metadata.name;
 break;
 case 'owner':
 aValue = a.spec.owner;
 bValue = b.spec.owner;
 break;
 case 'lifecycle':
 aValue = a.spec.lifecycle;
 bValue = b.spec.lifecycle;
 break;
 case 'health':
 aValue = a.status?.health || 'unknown';
 bValue = b.status?.health || 'unknown';
 break;
 default:
 return 0;
 }

 const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
 return state.filters.sortOrder === 'desc' ? -comparison : comparison;
 });
 }

 return filtered;
 }, [state.services, state.filters]);

 // Selection management
 const selectedServicesSet = useMemo(() => {
 return new Set(state.selectedServices);
 }, [state.selectedServices]);

 // Handlers
 const handleFilterChange = useCallback((filters: CatalogFilters) => {
 setState(prev => ({ ...prev, filters }));
 updateUrl(filters, state.view);
 }, [state.view, updateUrl]);

 const handleViewChange = useCallback((view: CatalogView) => {
 setState(prev => ({ ...prev, view }));
 updateUrl(state.filters, view);
 }, [state.filters, updateUrl]);

 const handleServiceClick = useCallback((service: ServiceEntity) => {
 onServiceSelect?.(service);
 }, [onServiceSelect]);

 const handleServiceSelect = useCallback((service: ServiceEntity, selected: boolean) => {
 const serviceId = `${service.metadata.namespace}/${service.metadata.name}`;
 
 setState(prev => ({
 ...prev,
 selectedServices: selected 
 ? [...prev.selectedServices, serviceId]
 : prev.selectedServices.filter(id => id !== serviceId),
 }));
 }, []);

 const handleServiceAction = useCallback((service: ServiceEntity, action: string) => {
 // eslint-disable-next-line no-console
 console.log('Service action:', action, service);
 // Implement service actions
 }, []);

 const handleSelectAll = useCallback(() => {
 const allSelected = state.selectedServices.length === filteredServices.length;
 
 setState(prev => ({
 ...prev,
 selectedServices: allSelected 
 ? []
 : filteredServices.map(s => `${s.metadata.namespace}/${s.metadata.name}`),
 }));
 }, [filteredServices, state.selectedServices]);

 const handleRefresh = useCallback(async () => {
 setState(prev => ({ ...prev, loading: true }));
 
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 setState(prev => ({ 
 ...prev, 
 loading: false,
 services: generateMockServices(100),
 }));
 }, []);

 // Bulk operations
 const bulkOperations: BulkOperation[] = [
 {
 id: 'edit',
 label: 'Edit',
 icon: <Edit className="w-4 h-4" />,
 action: async (services): Promise<void> => {
 // eslint-disable-next-line no-console
 console.log('Edit services:', services);
 await new Promise(resolve => setTimeout(resolve, 100));
 },
 },
 {
 id: 'share',
 label: 'Share',
 icon: <Share2 className="w-4 h-4" />,
 action: async (services): Promise<void> => {
 // eslint-disable-next-line no-console
 console.log('Share services:', services);
 await new Promise(resolve => setTimeout(resolve, 100));
 },
 },
 {
 id: 'delete',
 label: 'Delete',
 icon: <Trash2 className="w-4 h-4" />,
 action: async (services): Promise<void> => {
 // eslint-disable-next-line no-console
 console.log('Delete services:', services);
 await new Promise(resolve => setTimeout(resolve, 100));
 },
 confirmationRequired: true,
 confirmationMessage: 'Are you sure you want to delete the selected services?',
 },
 ];

 // Calculate stats
 const stats = useMemo(() => {
 const total = filteredServices.length;
 const byType = filteredServices.reduce((acc, service) => {
 acc[service.spec.type] = (acc[service.spec.type] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);
 
 const byHealth = filteredServices.reduce((acc, service) => {
 const health = service.status?.health || 'unknown';
 acc[health] = (acc[health] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 return { total, byType, byHealth };
 }, [filteredServices]);

 return (
 <div className={cn('flex flex-col h-screen bg-background', className)}>
 {/* Header */}
 <div className="flex-shrink-0 border-b border-border bg-background">
 <div className="flex items-center justify-between p-4">
 <div className="flex items-center gap-4">
 <h1 className="text-2xl font-bold">Service Catalog</h1>
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span>{stats.total} services</span>
 {state.selectedServices.length > 0 && (
 <>
 <span>•</span>
 <span>{state.selectedServices.length} selected</span>
 </>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <ViewToggle
 view={state.view}
 onChange={handleViewChange}
 views={[
 { id: 'grid', label: 'Grid', icon: LayoutGrid },
 { id: 'list', label: 'List', icon: List },
 { id: 'graph', label: 'Graph', icon: GitBranch },
 { id: 'map', label: 'Map', icon: Map },
 ]}
 />
 
 <div className="w-px h-6 bg-border" />
 
 <button
 onClick={handleRefresh}
 disabled={state.loading}
 className={cn(
 'p-2 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors disabled:opacity-50',
 state.loading && 'animate-spin'
 )}
 aria-label="Refresh catalog"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 
 <button
 className="p-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 aria-label="Catalog settings"
 >
 <Settings className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search bar */}
 <div className="px-4 pb-4">
 <SearchBar
 services={state.services}
 value={state.filters.search}
 onChange={(search) => handleFilterChange({ ...state.filters, search })}
 onSelect={handleServiceClick}
 />
 </div>

 {/* Bulk actions bar */}
 {state.selectedServices.length > 0 && (
 <BulkActionsBar
 selectedCount={state.selectedServices.length}
 operations={bulkOperations}
 onSelectAll={handleSelectAll}
 onClearSelection={() => setState(prev => ({ ...prev, selectedServices: [] }))}
 isAllSelected={state.selectedServices.length === filteredServices.length}
 />
 )}
 </div>

 {/* Main content */}
 <div className="flex flex-1 overflow-hidden">
 {/* Filter panel */}
 <FilterPanel
 services={state.services}
 filters={state.filters}
 onChange={handleFilterChange}
 className="w-64 flex-shrink-0"
 />

 {/* Service view */}
 <div className="flex-1 overflow-hidden">
 {state.error && (
 <div className="flex items-center gap-2 m-4 p-4 rounded-lg bg-destructive/10 text-destructive">
 <AlertCircle className="w-5 h-5" />
 <span>{state.error.message}</span>
 </div>
 )}

 {state.view === 'grid' && (
 <GridContainer
 services={filteredServices}
 selectedServices={selectedServicesSet}
 onServiceClick={handleServiceClick}
 onServiceSelect={handleServiceSelect}
 onServiceAction={handleServiceAction}
 loading={state.loading}
 virtualization={state.virtualization}
 className="p-4"
 />
 )}

 {state.view === 'list' && (
 <ServiceTable
 services={filteredServices}
 selectedServices={selectedServicesSet}
 onServiceClick={handleServiceClick}
 onServiceSelect={handleServiceSelect}
 onServiceAction={handleServiceAction}
 onSort={(column, order) => 
 handleFilterChange({ 
 ...state.filters, 
 sortBy: column as CatalogFilters['sortBy'], 
 sortOrder: order 
 })
 }
 sortColumn={state.filters.sortBy}
 sortOrder={state.filters.sortOrder}
 loading={state.loading}
 />
 )}

 {state.view === 'graph' && (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
 <h3 className="text-lg font-semibold mb-2">Dependency Graph</h3>
 <p className="text-sm text-muted-foreground">
 Graph view coming soon...
 </p>
 </div>
 </div>
 )}

 {state.view === 'map' && (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <Map className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
 <h3 className="text-lg font-semibold mb-2">Organization Map</h3>
 <p className="text-sm text-muted-foreground">
 Map view coming soon...
 </p>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Status bar */}
 <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-muted border-t border-border text-xs text-muted-foreground">
 <div className="flex items-center gap-4">
 <span>
 <BarChart3 className="w-3 h-3 inline mr-1" />
 {Object.entries(stats.byHealth).map(([health, count]) => (
 <span key={health} className="ml-2">
 {health}: {count}
 </span>
 ))}
 </span>
 </div>
 
 <div className="flex items-center gap-4">
 <span>Last updated: {new Date().toLocaleTimeString()}</span>
 </div>
 </div>
 </div>
 );
};