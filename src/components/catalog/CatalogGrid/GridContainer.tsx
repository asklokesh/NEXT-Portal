'use client';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, import/no-named-as-default-member */

import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { 
 FixedSizeGrid as Grid,
 areEqual
} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { cn } from '@/lib/utils';

import { ServiceCard } from './ServiceCard';

import type { ServiceEntity, VirtualizationConfig } from '../types';
import type {
 GridChildComponentProps} from 'react-window';

interface GridContainerProps {
 services: ServiceEntity[];
 selectedServices: Set<string>;
 onServiceClick?: (service: ServiceEntity) => void;
 onServiceSelect?: (service: ServiceEntity, selected: boolean) => void;
 onServiceAction?: (service: ServiceEntity, action: string) => void;
 onLoadMore?: () => Promise<void>;
 hasMore?: boolean;
 loading?: boolean;
 columnWidth?: number;
 rowHeight?: number;
 gap?: number;
 className?: string;
 virtualization?: VirtualizationConfig;
}

interface CellProps extends GridChildComponentProps {
 data: {
 services: ServiceEntity[];
 selectedServices: Set<string>;
 columnCount: number;
 gap: number;
 onServiceClick?: (service: ServiceEntity) => void;
 onServiceSelect?: (service: ServiceEntity, selected: boolean) => void;
 onServiceAction?: (service: ServiceEntity, action: string) => void;
 };
}

// Memoized cell component for performance
// eslint-disable-next-line import/no-named-as-default-member
const Cell = React.memo<CellProps>(({ 
 columnIndex, 
 rowIndex, 
 style, 
 data 
}) => {
 const { 
 services, 
 selectedServices, 
 columnCount, 
 gap,
 onServiceClick,
 onServiceSelect,
 onServiceAction
 } = data;

 const index = rowIndex * columnCount + columnIndex;
 const service = services[index];

 if (!service) {
 return null;
 }

 const serviceId = `${service.metadata.namespace}/${service.metadata.name}`;
 const isSelected = selectedServices.has(serviceId);

 return (
 <div
 style={{
 ...style,
 left: (style.left as number) + gap,
 top: (style.top as number) + gap,
 width: (style.width as number) - gap,
 height: (style.height as number) - gap,
 }}
 >
 <ServiceCard
 service={service}
 selected={isSelected}
 onClick={onServiceClick}
 onSelect={onServiceSelect}
 onAction={onServiceAction}
 className="h-full"
 />
 </div>
 );
}, areEqual);

Cell.displayName = 'GridCell';

// Loading placeholder component
const LoadingCard: React.FC<{ className?: string }> = ({ className }) => (
 <div className={cn(
 'flex flex-col p-4 rounded-lg border bg-card animate-pulse',
 className
 )}>
 <div className="flex items-start gap-3 mb-3">
 <div className="w-10 h-10 rounded-lg bg-muted" />
 <div className="flex-1">
 <div className="h-5 w-3/4 bg-muted rounded mb-2" />
 <div className="h-3 w-1/2 bg-muted rounded" />
 </div>
 </div>
 <div className="h-12 bg-muted rounded mb-3" />
 <div className="grid grid-cols-2 gap-2">
 <div className="h-6 bg-muted rounded" />
 <div className="h-6 bg-muted rounded" />
 </div>
 </div>
);

// Empty state component
const EmptyState: React.FC = () => (
 <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
 <Loader2 className="w-8 h-8 text-muted-foreground" />
 </div>
 <h3 className="text-lg font-semibold text-foreground mb-2">
 No services found
 </h3>
 <p className="text-sm text-muted-foreground max-w-md">
 Try adjusting your filters or search criteria to find services.
 </p>
 </div>
);

// Main grid container component
export const GridContainer: React.FC<GridContainerProps> = ({
 services,
 selectedServices,
 onServiceClick,
 onServiceSelect,
 onServiceAction,
 onLoadMore,
 hasMore = false,
 loading = false,
 columnWidth = 320,
 rowHeight = 280,
 gap = 16,
 className,
 virtualization = {
 itemHeight: rowHeight,
 overscan: 2,
 scrollDebounceMs: 150,
 enableWindowScroll: false,
 }
}) => {
 const containerRef = useRef<HTMLDivElement>(null);
 const gridRef = useRef<Grid>(null);
 const [isLoadingMore, setIsLoadingMore] = useState(false);

 // Calculate grid dimensions
 const calculateGridDimensions = useCallback((width: number) => {
 const effectiveWidth = width - gap;
 const columnCount = Math.max(1, Math.floor(effectiveWidth / (columnWidth + gap)));
 const rowCount = Math.ceil(services.length / columnCount);
 
 return { columnCount, rowCount };
 }, [services.length, columnWidth, gap]);

 // Infinite scroll handling
 const loadMoreItems = useCallback(async () => {
 if (!onLoadMore || isLoadingMore || !hasMore) return;

 setIsLoadingMore(true);
 try {
 await onLoadMore();
 } finally {
 setIsLoadingMore(false);
 }
 }, [onLoadMore, isLoadingMore, hasMore]);

 // Check if item is loaded
 const isItemLoaded = useCallback((index: number) => {
 return index < services.length;
 }, [services.length]);

 // Get item count including potential unloaded items
 const itemCount = useMemo(() => {
 return hasMore ? services.length + 20 : services.length;
 }, [services.length, hasMore]);

 // Keyboard navigation
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
 e.preventDefault();
 // Select all logic
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 // Scroll restoration
 useEffect(() => {
 const scrollPosition = sessionStorage.getItem('catalog-grid-scroll');
 if (scrollPosition && gridRef.current) {
 // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
 const { scrollTop } = JSON.parse(scrollPosition);
 // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
 gridRef.current.scrollTo({ scrollTop });
 }

 return () => {
 const currentGrid = gridRef.current;
 if (currentGrid) {
 // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
 const state = currentGrid.state;
 sessionStorage.setItem('catalog-grid-scroll', JSON.stringify({
 // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
 scrollTop: state.scrollTop,
 }));
 }
 };
 }, []);

 if (loading && services.length === 0) {
 return (
 <div className={cn('grid gap-4', className)}>
 {Array.from({ length: 12 }).map((_, _i) => (
 <LoadingCard key={_i} />
 ))}
 </div>
 );
 }

 if (!loading && services.length === 0) {
 return <EmptyState />;
 }

 return (
 <div ref={containerRef} className={cn('h-full w-full', className)}>
 <AutoSizer>
 {({ height, width }) => {
 const { columnCount, rowCount } = calculateGridDimensions(width);
 
 const itemData = {
 services,
 selectedServices,
 columnCount,
 gap,
 onServiceClick,
 onServiceSelect,
 onServiceAction,
 };

 return (
 <InfiniteLoader
 isItemLoaded={isItemLoaded}
 itemCount={itemCount}
 loadMoreItems={loadMoreItems}
 threshold={10}
 >
 {({ onItemsRendered }) => (
 <Grid
 ref={gridRef}
 className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
 columnCount={columnCount}
 columnWidth={columnWidth + gap}
 height={height}
 rowCount={rowCount}
 rowHeight={rowHeight + gap}
 width={width}
 itemData={itemData}
 overscanRowCount={virtualization.overscan}
 // eslint-disable-next-line @typescript-eslint/no-unsafe-call
 onItemsRendered={({
 visibleRowStartIndex,
 visibleRowStopIndex,
 overscanRowStartIndex,
 overscanRowStopIndex,
 }) => {
 onItemsRendered({
 overscanStartIndex: overscanRowStartIndex * columnCount,
 overscanStopIndex: overscanRowStopIndex * columnCount + columnCount - 1,
 visibleStartIndex: visibleRowStartIndex * columnCount,
 visibleStopIndex: visibleRowStopIndex * columnCount + columnCount - 1,
 });
 }}
 >
 {Cell}
 </Grid>
 )}
 </InfiniteLoader>
 );
 }}
 </AutoSizer>
 
 {isLoadingMore && (
 <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border shadow-lg">
 <Loader2 className="w-4 h-4 animate-spin" />
 <span className="text-sm">Loading more services...</span>
 </div>
 </div>
 )}
 </div>
 );
};