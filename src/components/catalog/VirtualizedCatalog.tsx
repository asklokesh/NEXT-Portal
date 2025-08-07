'use client';

import React, { useMemo, useCallback } from 'react';
import { VirtualList, FixedSizeVirtualList } from '@/components/ui/VirtualList';
import type { ServiceEntity } from '@/lib/backstage/types';

interface VirtualizedCatalogProps {
 services: ServiceEntity[];
 viewMode: 'grid' | 'list' | 'table';
 renderServiceCard: (service: ServiceEntity) => React.ReactNode;
 renderListItem: (service: ServiceEntity) => React.ReactNode;
 renderTableRow?: (service: ServiceEntity) => React.ReactNode;
 groupBy?: string;
 className?: string;
}

export const VirtualizedCatalog = React.memo(({
 services,
 viewMode,
 renderServiceCard,
 renderListItem,
 renderTableRow,
 groupBy,
 className,
}: VirtualizedCatalogProps) => {
 // Calculate grid columns based on view mode
 const gridCols = viewMode === 'grid' ? 3 : 1;
 const itemSize = viewMode === 'grid' ? 350 : viewMode === 'list' ? 120 : 60;
 const gap = viewMode === 'grid' ? 24 : 0;
 
 // Render item based on view mode
 const renderItem = useCallback((service: ServiceEntity, index: number, style: React.CSSProperties) => {
 switch (viewMode) {
 case 'grid':
 return renderServiceCard(service);
 case 'list':
 return renderListItem(service);
 case 'table':
 return renderTableRow ? renderTableRow(service) : renderListItem(service);
 default:
 return renderListItem(service);
 }
 }, [viewMode, renderServiceCard, renderListItem, renderTableRow]);
 
 // Empty state
 const emptyState = (
 <div className="flex flex-col items-center justify-center h-64">
 <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No services found</p>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
 Try adjusting your filters or search query
 </p>
 </div>
 );
 
 // Group services if needed
 const groupedServices = useMemo(() => {
 if (!groupBy || groupBy === 'none') {
 return [{ groupName: 'All Services', services }];
 }
 
 const groups = new Map<string, ServiceEntity[]>();
 
 services.forEach(service => {
 let groupKey = 'Other';
 
 switch (groupBy) {
 case 'owner':
 groupKey = service.spec?.owner || 'Unassigned';
 break;
 case 'lifecycle':
 groupKey = service.spec?.lifecycle || 'Unknown';
 break;
 case 'type':
 groupKey = service.spec?.type || 'Unknown';
 break;
 case 'namespace':
 groupKey = service.metadata.namespace || 'default';
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
 }, [services, groupBy]);
 
 // Render grouped view
 if (groupBy && groupBy !== 'none') {
 return (
 <div className={className}>
 {groupedServices.map(group => (
 <div key={group.groupName} className="mb-8">
 <h3 className="text-lg font-semibold mb-4 px-4 sticky top-0 bg-background z-10">
 {group.groupName} ({group.services.length})
 </h3>
 <div style={{ height: '600px' }}>
 <FixedSizeVirtualList
 items={group.services}
 renderItem={renderItem}
 itemSize={itemSize}
 gridCols={gridCols}
 gap={gap}
 emptyState={emptyState}
 />
 </div>
 </div>
 ))}
 </div>
 );
 }
 
 // Render flat view
 return (
 <div className={className} style={{ height: '100%' }}>
 <FixedSizeVirtualList
 items={services}
 renderItem={renderItem}
 itemSize={itemSize}
 gridCols={gridCols}
 gap={gap}
 emptyState={emptyState}
 overscan={5}
 />
 </div>
 );
});

VirtualizedCatalog.displayName = 'VirtualizedCatalog';

// Virtual table component for table view
export const VirtualizedTable = React.memo(({
 services,
 columns,
 renderRow,
 className,
}: {
 services: ServiceEntity[];
 columns: Array<{ key: string; label: string; width?: number }>;
 renderRow: (service: ServiceEntity) => React.ReactNode;
 className?: string;
}) => {
 // Table header
 const tableHeader = (
 <div className="sticky top-0 z-20 bg-background border-b">
 <div className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
 {columns.map(col => (
 <div 
 key={col.key} 
 className="flex-1"
 style={{ width: col.width ? `${col.width}px` : undefined }}
 >
 {col.label}
 </div>
 ))}
 </div>
 </div>
 );
 
 return (
 <div className={className}>
 {tableHeader}
 <div style={{ height: 'calc(100% - 48px)' }}>
 <FixedSizeVirtualList
 items={services}
 renderItem={(service, index, style) => (
 <div style={style} className="border-b hover:bg-accent/50 transition-colors">
 {renderRow(service)}
 </div>
 )}
 itemSize={60}
 emptyState={
 <div className="flex items-center justify-center h-64">
 <p className="text-gray-500">No services found</p>
 </div>
 }
 />
 </div>
 </div>
 );
});

VirtualizedTable.displayName = 'VirtualizedTable';