'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, jsx-a11y/no-autofocus */

import { 
 Filter, 
 X, 
 ChevronDown, 
 ChevronRight,
 Check,
 Search,
 RotateCcw,
 Save,
 Layers,
 Activity,
 Users,
 Tag,
 Package,
 Calendar,
 Globe as _Globe
} from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { ServiceEntity, CatalogFilters } from '../types';

interface FilterPanelProps {
 services: ServiceEntity[];
 filters: CatalogFilters;
 onChange: (filters: CatalogFilters) => void;
 onSaveSearch?: (name: string, filters: CatalogFilters) => void;
 className?: string;
 collapsible?: boolean;
 defaultCollapsed?: boolean;
}

interface FilterSectionProps {
 title: string;
 icon: React.ReactNode;
 children: React.ReactNode;
 defaultExpanded?: boolean;
 badge?: number;
}

interface FilterOption {
 value: string;
 label: string;
 count: number;
}

// Filter section component
const FilterSection: React.FC<FilterSectionProps> = ({ 
 title, 
 icon, 
 children, 
 defaultExpanded = true,
 badge 
}) => {
 const [isExpanded, setIsExpanded] = useState(defaultExpanded);

 return (
 <div className="border-b border-border last:border-b-0">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className={cn(
 'flex items-center justify-between w-full px-4 py-3',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200'
 )}
 aria-expanded={isExpanded}
 >
 <div className="flex items-center gap-2">
 <span className="text-muted-foreground">{icon}</span>
 <span className="font-medium">{title}</span>
 </div>
 
 <div className="flex items-center gap-2">
 {badge !== undefined && badge > 0 && (
 <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
 {badge}
 </span>
 )}
 {isExpanded ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 </div>
 </button>
 
 {isExpanded && (
 <div className="px-4 pb-3">
 {children}
 </div>
 )}
 </div>
 );
};

// Checkbox filter component
const CheckboxFilter: React.FC<{
 options: FilterOption[];
 selected: string[];
 onChange: (values: string[]) => void;
 searchable?: boolean;
 maxVisible?: number;
}> = ({ options, selected, onChange, searchable = true, maxVisible = 5 }) => {
 const [searchTerm, setSearchTerm] = useState('');
 const [showAll, setShowAll] = useState(false);

 const filteredOptions = useMemo(() => {
 if (!searchTerm) return options;
 
 return options.filter(option =>
 option.label.toLowerCase().includes(searchTerm.toLowerCase())
 );
 }, [options, searchTerm]);

 const visibleOptions = showAll ? filteredOptions : filteredOptions.slice(0, maxVisible);
 const hasMore = filteredOptions.length > maxVisible;

 const handleToggle = (value: string) => {
 const newSelected = selected.includes(value)
 ? selected.filter(v => v !== value)
 : [...selected, value];
 onChange(newSelected);
 };

 return (
 <div className="space-y-2">
 {searchable && options.length > 5 && (
 <div className="relative">
 <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search..."
 className={cn(
 'w-full pl-7 pr-2 py-1 text-xs rounded border',
 'bg-background border-input',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </div>
 )}
 
 <div className="space-y-1">
 {visibleOptions.map((option) => (
 <label
 key={option.value}
 className={cn(
 'flex items-center gap-2 py-1 cursor-pointer',
 'hover:text-accent-foreground transition-colors'
 )}
 >
 <input
 type="checkbox"
 checked={selected.includes(option.value)}
 onChange={() => handleToggle(option.value)}
 className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
 />
 <span className="flex-1 text-sm">{option.label}</span>
 <span className="text-xs text-muted-foreground">{option.count}</span>
 </label>
 ))}
 </div>
 
 {hasMore && !searchTerm && (
 <button
 onClick={() => setShowAll(!showAll)}
 className="text-xs text-primary hover:underline"
 >
 {showAll ? 'Show less' : `Show ${filteredOptions.length - maxVisible} more`}
 </button>
 )}
 </div>
 );
};

// Health status filter component
const HealthFilter: React.FC<{
 selected: string[];
 onChange: (values: string[]) => void;
}> = ({ selected, onChange }) => {
 const healthOptions = [
 { value: 'healthy', label: 'Healthy', color: 'bg-green-500' },
 { value: 'degraded', label: 'Degraded', color: 'bg-yellow-500' },
 { value: 'unhealthy', label: 'Unhealthy', color: 'bg-red-500' },
 { value: 'unknown', label: 'Unknown', color: 'bg-gray-400' },
 ];

 return (
 <div className="grid grid-cols-2 gap-2">
 {healthOptions.map((option) => {
 const isSelected = selected.includes(option.value);
 
 return (
 <button
 key={option.value}
 onClick={() => {
 const newSelected = isSelected
 ? selected.filter(v => v !== option.value)
 : [...selected, option.value];
 onChange(newSelected);
 }}
 className={cn(
 'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
 isSelected
 ? 'border-primary bg-primary/10 text-primary'
 : 'border-border hover:border-primary/50'
 )}
 >
 <div className={cn('w-2 h-2 rounded-full', option.color)} />
 <span className="text-sm">{option.label}</span>
 {isSelected && <Check className="w-3 h-3 ml-auto" />}
 </button>
 );
 })}
 </div>
 );
};

// Main filter panel component
export const FilterPanel: React.FC<FilterPanelProps> = ({
 services,
 filters,
 onChange,
 onSaveSearch,
 className,
 collapsible = true,
 defaultCollapsed = false,
}) => {
 const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
 const [showSaveDialog, setShowSaveDialog] = useState(false);
 const [searchName, setSearchName] = useState('');

 // Calculate filter options with counts
 const filterOptions = useMemo(() => {
 const types = new Map<string, number>();
 const lifecycles = new Map<string, number>();
 const owners = new Map<string, number>();
 const systems = new Map<string, number>();
 const tags = new Map<string, number>();

 services.forEach(service => {
 // Types
 types.set(service.spec.type, (types.get(service.spec.type) || 0) + 1);
 
 // Lifecycles
 lifecycles.set(service.spec.lifecycle, (lifecycles.get(service.spec.lifecycle) || 0) + 1);
 
 // Owners
 const owner = service.spec.owner.replace('group:', '').replace('user:', '');
 owners.set(owner, (owners.get(owner) || 0) + 1);
 
 // Systems
 if (service.spec.system) {
 systems.set(service.spec.system, (systems.get(service.spec.system) || 0) + 1);
 }
 
 // Tags
 service.metadata.tags?.forEach(tag => {
 tags.set(tag, (tags.get(tag) || 0) + 1);
 });
 });

 return {
 types: Array.from(types.entries()).map(([value, count]) => ({
 value,
 label: value.charAt(0).toUpperCase() + value.slice(1),
 count,
 })).sort((a, b) => b.count - a.count),
 
 lifecycles: Array.from(lifecycles.entries()).map(([value, count]) => ({
 value,
 label: value.charAt(0).toUpperCase() + value.slice(1),
 count,
 })),
 
 owners: Array.from(owners.entries()).map(([value, count]) => ({
 value,
 label: value,
 count,
 })).sort((a, b) => b.count - a.count),
 
 systems: Array.from(systems.entries()).map(([value, count]) => ({
 value,
 label: value,
 count,
 })).sort((a, b) => b.count - a.count),
 
 tags: Array.from(tags.entries()).map(([value, count]) => ({
 value,
 label: value,
 count,
 })).sort((a, b) => b.count - a.count),
 };
 }, [services]);

 // Handle filter changes
 const handleFilterChange = useCallback((key: keyof CatalogFilters, value: any) => {
 onChange({
 ...filters,
 [key]: value,
 });
 }, [filters, onChange]);

 // Reset filters
 const handleReset = useCallback(() => {
 onChange({});
 }, [onChange]);

 // Save search
 const handleSaveSearch = useCallback(() => {
 if (searchName && onSaveSearch) {
 onSaveSearch(searchName, filters);
 setShowSaveDialog(false);
 setSearchName('');
 }
 }, [searchName, filters, onSaveSearch]);

 // Count active filters
 const activeFilterCount = useMemo(() => {
 let count = 0;
 if (filters.types?.length) count += filters.types.length;
 if (filters.lifecycles?.length) count += filters.lifecycles.length;
 if (filters.owners?.length) count += filters.owners.length;
 if (filters.systems?.length) count += filters.systems.length;
 if (filters.tags?.length) count += filters.tags.length;
 if (filters.health?.length) count += filters.health.length;
 return count;
 }, [filters]);

 if (collapsible && isCollapsed) {
 return (
 <div className={cn('border-r border-border', className)}>
 <button
 onClick={() => setIsCollapsed(false)}
 className={cn(
 'flex items-center justify-center w-12 h-full',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200'
 )}
 aria-label="Expand filters"
 >
 <Filter className="w-5 h-5" />
 {activeFilterCount > 0 && (
 <span className="absolute top-4 right-2 w-2 h-2 bg-primary rounded-full" />
 )}
 </button>
 </div>
 );
 }

 return (
 <div className={cn('flex flex-col h-full bg-background border-r border-border', className)}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border">
 <div className="flex items-center gap-2">
 <Filter className="w-5 h-5 text-muted-foreground" />
 <h2 className="font-semibold">Filters</h2>
 {activeFilterCount > 0 && (
 <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
 {activeFilterCount}
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-1">
 {activeFilterCount > 0 && (
 <button
 onClick={handleReset}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 aria-label="Reset filters"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 )}
 
 {onSaveSearch && (
 <button
 onClick={() => setShowSaveDialog(true)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 aria-label="Save search"
 >
 <Save className="w-4 h-4" />
 </button>
 )}
 
 {collapsible && (
 <button
 onClick={() => setIsCollapsed(true)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 aria-label="Collapse filters"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Filter sections */}
 <div className="flex-1 overflow-y-auto">
 <FilterSection
 title="Type"
 icon={<Layers className="w-4 h-4" />}
 badge={filters.types?.length}
 >
 <CheckboxFilter
 options={filterOptions.types}
 selected={filters.types || []}
 onChange={(values) => handleFilterChange('types', values)}
 searchable={false}
 />
 </FilterSection>

 <FilterSection
 title="Lifecycle"
 icon={<Calendar className="w-4 h-4" />}
 badge={filters.lifecycles?.length}
 >
 <CheckboxFilter
 options={filterOptions.lifecycles}
 selected={filters.lifecycles || []}
 onChange={(values) => handleFilterChange('lifecycles', values)}
 searchable={false}
 />
 </FilterSection>

 <FilterSection
 title="Health Status"
 icon={<Activity className="w-4 h-4" />}
 badge={filters.health?.length}
 >
 <HealthFilter
 selected={filters.health || []}
 onChange={(values) => handleFilterChange('health', values)}
 />
 </FilterSection>

 <FilterSection
 title="Owner"
 icon={<Users className="w-4 h-4" />}
 badge={filters.owners?.length}
 >
 <CheckboxFilter
 options={filterOptions.owners}
 selected={filters.owners || []}
 onChange={(values) => handleFilterChange('owners', values)}
 />
 </FilterSection>

 <FilterSection
 title="System"
 icon={<Package className="w-4 h-4" />}
 badge={filters.systems?.length}
 >
 <CheckboxFilter
 options={filterOptions.systems}
 selected={filters.systems || []}
 onChange={(values) => handleFilterChange('systems', values)}
 />
 </FilterSection>

 <FilterSection
 title="Tags"
 icon={<Tag className="w-4 h-4" />}
 badge={filters.tags?.length}
 defaultExpanded={false}
 >
 <CheckboxFilter
 options={filterOptions.tags}
 selected={filters.tags || []}
 onChange={(values) => handleFilterChange('tags', values)}
 maxVisible={10}
 />
 </FilterSection>
 </div>

 {/* Save search dialog */}
 {showSaveDialog && (
 <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-popover border border-border rounded-lg p-4 w-full max-w-sm shadow-lg">
 <h3 className="font-semibold mb-2">Save Search</h3>
 <input
 type="text"
 value={searchName}
 onChange={(e) => setSearchName(e.target.value)}
 placeholder="Search name..."
 className={cn(
 'w-full px-3 py-2 rounded border',
 'bg-background border-input',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 autoFocus
 />
 <div className="flex justify-end gap-2 mt-4">
 <button
 onClick={() => setShowSaveDialog(false)}
 className="px-3 py-1 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleSaveSearch}
 disabled={!searchName}
 className={cn(
 'px-3 py-1 text-sm rounded',
 'bg-primary text-primary-foreground',
 'hover:bg-primary/90 disabled:opacity-50',
 'transition-colors'
 )}
 >
 Save
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};