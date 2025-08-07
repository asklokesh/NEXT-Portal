'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, import/no-named-as-default-member, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus, jsx-a11y/no-static-element-interactions */

import {
 ArrowUpDown,
 ArrowUp,
 ArrowDown,
 ChevronDown as _ChevronDown,
 ChevronRight as _ChevronRight,
 CheckCircle,
 XCircle,
 AlertCircle,
 Clock,
 ExternalLink,
 MoreVertical,
 Package,
 Server,
 Globe,
 BookOpen,
 Wrench,
 Star as _Star
} from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { 
 FixedSizeList as List,
 areEqual
} from 'react-window';

import { cn } from '@/lib/utils';

import type { ServiceEntity, TableColumn } from '../types';
import type {
 ListChildComponentProps} from 'react-window';

interface ServiceTableProps {
 services: ServiceEntity[];
 selectedServices: Set<string>;
 onServiceClick?: (service: ServiceEntity) => void;
 onServiceSelect?: (service: ServiceEntity, selected: boolean) => void;
 onServiceAction?: (service: ServiceEntity, action: string) => void;
 onSort?: (column: string, order: 'asc' | 'desc') => void;
 sortColumn?: string;
 sortOrder?: 'asc' | 'desc';
 loading?: boolean;
 virtualization?: boolean;
 rowHeight?: number;
 className?: string;
}

interface RowProps extends ListChildComponentProps {
 data: {
 services: ServiceEntity[];
 selectedServices: Set<string>;
 columns: TableColumn[];
 onServiceClick?: (service: ServiceEntity) => void;
 onServiceSelect?: (service: ServiceEntity, selected: boolean) => void;
 onServiceAction?: (service: ServiceEntity, action: string) => void;
 };
}

// Service type icons
const ServiceTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
 const icons = {
 service: Server,
 website: Globe,
 library: Package,
 documentation: BookOpen,
 tool: Wrench,
 };

 const Icon = icons[type as keyof typeof icons] || Server;
 return <Icon className={cn('w-4 h-4', className)} />;
};

// Health status indicator
const HealthIndicator: React.FC<{ health?: string }> = ({ health = 'unknown' }) => {
 const healthConfig = {
 healthy: { icon: CheckCircle, color: 'text-green-500' },
 degraded: { icon: AlertCircle, color: 'text-yellow-500' },
 unhealthy: { icon: XCircle, color: 'text-red-500' },
 unknown: { icon: Clock, color: 'text-gray-400' },
 };

 const config = healthConfig[health as keyof typeof healthConfig] || healthConfig.unknown;
 const Icon = config.icon;

 return <Icon className={cn('w-4 h-4', config.color)} />;
};

// Table row component
const Row = React.memo<RowProps>(({ index, style, data }) => {
 const { services, selectedServices, columns, onServiceClick, onServiceSelect, onServiceAction } = data;
 const service = services[index];
 const serviceId = `${service.metadata.namespace}/${service.metadata.name}`;
 const isSelected = selectedServices.has(serviceId);
 const [menuOpen, setMenuOpen] = useState(false);

 const handleRowClick = (e: React.MouseEvent) => {
 if (e.ctrlKey || e.metaKey) {
 onServiceSelect?.(service, !isSelected);
 } else {
 onServiceClick?.(service);
 }
 };

 const handleCheckboxClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 onServiceSelect?.(service, !isSelected);
 };

 return (
 <div
 style={style}
 className={cn(
 'flex items-center border-b border-border hover:bg-accent/50',
 'cursor-pointer transition-colors duration-150',
 isSelected && 'bg-accent',
 index % 2 === 0 && 'bg-muted/20'
 )}
 onClick={handleRowClick}
 role="row"
 aria-selected={isSelected}
 >
 {/* Selection checkbox */}
 <div className="w-12 flex items-center justify-center">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => {}}
 onClick={handleCheckboxClick}
 className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
 />
 </div>

 {/* Render columns */}
 {columns.map((column) => (
 <div
 key={column.id}
 className={cn(
 'px-3 py-2 flex items-center',
 column.align === 'center' && 'justify-center',
 column.align === 'right' && 'justify-end'
 )}
 style={{ width: column.width || 'auto', flexGrow: column.width ? 0 : 1 }}
 >
 {typeof column.accessor === 'function' 
 ? column.accessor(service) 
 : service[column.accessor as keyof ServiceEntity] as React.ReactNode}
 </div>
 ))}

 {/* Actions menu */}
 <div className="w-12 flex items-center justify-center">
 <div className="relative">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setMenuOpen(!menuOpen);
 }}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 
 {menuOpen && (
 <div className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onServiceAction?.(service, 'view');
 setMenuOpen(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <ExternalLink className="w-4 h-4" />
 View Details
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}, areEqual);

Row.displayName = 'TableRow';

// Column header component
const ColumnHeader: React.FC<{
 column: TableColumn;
 sortColumn?: string;
 sortOrder?: 'asc' | 'desc';
 onSort?: (column: string) => void;
}> = ({ column, sortColumn, sortOrder, onSort }) => {
 const isSorted = sortColumn === column.id;
 
 return (
 <div
 className={cn(
 'px-3 py-2 font-medium text-muted-foreground',
 column.align === 'center' && 'text-center',
 column.align === 'right' && 'text-right',
 column.sortable && 'cursor-pointer hover:text-foreground'
 )}
 style={{ width: column.width || 'auto', flexGrow: column.width ? 0 : 1 }}
 onClick={() => column.sortable && onSort?.(column.id)}
 >
 <div className="flex items-center gap-1">
 <span>{column.label}</span>
 {column.sortable && (
 <span className="ml-auto">
 {!isSorted && <ArrowUpDown className="w-3 h-3 opacity-50" />}
 {isSorted && sortOrder === 'asc' && <ArrowUp className="w-3 h-3" />}
 {isSorted && sortOrder === 'desc' && <ArrowDown className="w-3 h-3" />}
 </span>
 )}
 </div>
 </div>
 );
};

// Main service table component
export const ServiceTable: React.FC<ServiceTableProps> = ({
 services,
 selectedServices,
 onServiceClick,
 onServiceSelect,
 onServiceAction,
 onSort,
 sortColumn,
 sortOrder = 'asc',
 loading = false,
 virtualization = true,
 rowHeight = 48,
 className,
}) => {
 // Define table columns
 const columns: TableColumn[] = useMemo(() => [
 {
 id: 'type',
 label: 'Type',
 accessor: (service) => (
 <ServiceTypeIcon type={service.spec.type} />
 ),
 width: 60,
 align: 'center',
 },
 {
 id: 'name',
 label: 'Name',
 accessor: (service) => (
 <div className="min-w-0">
 <div className="font-medium truncate">
 {service.metadata.title || service.metadata.name}
 </div>
 <div className="text-xs text-muted-foreground truncate">
 {service.metadata.namespace}/{service.metadata.name}
 </div>
 </div>
 ),
 sortable: true,
 width: 250,
 },
 {
 id: 'owner',
 label: 'Owner',
 accessor: (service) => {
 const owner = service.spec.owner.replace('group:', '').replace('user:', '');
 return <span className="truncate">{owner}</span>;
 },
 sortable: true,
 width: 150,
 },
 {
 id: 'lifecycle',
 label: 'Lifecycle',
 accessor: (service) => (
 <span className={cn(
 'px-2 py-0.5 text-xs rounded-full font-medium',
 service.spec.lifecycle === 'production' && 'bg-green-100 text-green-800',
 service.spec.lifecycle === 'experimental' && 'bg-yellow-100 text-yellow-800',
 service.spec.lifecycle === 'deprecated' && 'bg-red-100 text-red-800'
 )}>
 {service.spec.lifecycle}
 </span>
 ),
 sortable: true,
 width: 120,
 },
 {
 id: 'health',
 label: 'Health',
 accessor: (service) => (
 <HealthIndicator health={service.status?.health} />
 ),
 width: 80,
 align: 'center',
 },
 {
 id: 'system',
 label: 'System',
 accessor: (service) => (
 <span className="truncate text-sm">
 {service.spec.system || '-'}
 </span>
 ),
 sortable: true,
 width: 150,
 },
 {
 id: 'tags',
 label: 'Tags',
 accessor: (service) => (
 <div className="flex flex-wrap gap-1">
 {service.metadata.tags?.slice(0, 2).map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 {service.metadata.tags && service.metadata.tags.length > 2 && (
 <span className="text-xs text-muted-foreground">
 +{service.metadata.tags.length - 2}
 </span>
 )}
 </div>
 ),
 },
 ], []);

 // Handle sort
 const handleSort = useCallback((columnId: string) => {
 const newOrder = sortColumn === columnId && sortOrder === 'asc' ? 'desc' : 'asc';
 onSort?.(columnId, newOrder);
 }, [sortColumn, sortOrder, onSort]);

 // Prepare row data
 const itemData = {
 services,
 selectedServices,
 columns,
 onServiceClick,
 onServiceSelect,
 onServiceAction,
 };

 if (loading) {
 return (
 <div className={cn('flex items-center justify-center h-64', className)}>
 <div className="text-muted-foreground">Loading services...</div>
 </div>
 );
 }

 if (services.length === 0) {
 return (
 <div className={cn('flex items-center justify-center h-64', className)}>
 <div className="text-center">
 <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
 <h3 className="font-semibold mb-2">No services found</h3>
 <p className="text-sm text-muted-foreground">
 Try adjusting your filters or search criteria.
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className={cn('flex flex-col h-full bg-background', className)}>
 {/* Header */}
 <div className="flex items-center border-b border-border bg-muted/50 sticky top-0 z-10">
 <div className="w-12 flex items-center justify-center">
 <input
 type="checkbox"
 checked={selectedServices.size === services.length && services.length > 0}
 onChange={(e) => {
 if (e.target.checked) {
 services.forEach(service => {
 onServiceSelect?.(service, true);
 });
 } else {
 services.forEach(service => {
 onServiceSelect?.(service, false);
 });
 }
 }}
 className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
 />
 </div>
 
 {columns.map((column) => (
 <ColumnHeader
 key={column.id}
 column={column}
 sortColumn={sortColumn}
 sortOrder={sortOrder}
 onSort={handleSort}
 />
 ))}
 
 <div className="w-12" />
 </div>

 {/* Table body */}
 {virtualization ? (
 <div className="flex-1">
 <AutoSizer>
 {({ height, width }) => (
 <List
 height={height}
 itemCount={services.length}
 itemSize={rowHeight}
 width={width}
 itemData={itemData}
 className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
 >
 {Row}
 </List>
 )}
 </AutoSizer>
 </div>
 ) : (
 <div className="flex-1 overflow-y-auto">
 {services.map((service, index) => (
 <Row
 key={`${service.metadata.namespace}/${service.metadata.name}`}
 index={index}
 style={{ height: rowHeight, width: '100%' }}
 data={itemData}
 />
 ))}
 </div>
 )}
 </div>
 );
};