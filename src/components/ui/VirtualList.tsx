import React, { useRef, useEffect, useMemo } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import InfiniteLoader from 'react-window-infinite-loader';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
 items: T[];
 renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
 itemSize?: number | ((index: number) => number);
 className?: string;
 overscan?: number;
 loadMoreItems?: (startIndex: number, stopIndex: number) => Promise<void>;
 hasNextPage?: boolean;
 isItemLoaded?: (index: number) => boolean;
 threshold?: number;
 minimumBatchSize?: number;
 gridCols?: number; // For grid layout
 gap?: number; // Gap between items
 emptyState?: React.ReactNode;
 loadingState?: React.ReactNode;
 estimatedItemSize?: number;
}

export function VirtualList<T>({
 items,
 renderItem,
 itemSize = 100,
 className,
 overscan = 3,
 loadMoreItems,
 hasNextPage = false,
 isItemLoaded,
 threshold = 15,
 minimumBatchSize = 10,
 gridCols = 1,
 gap = 0,
 emptyState,
 loadingState,
 estimatedItemSize,
}: VirtualListProps<T>) {
 const listRef = useRef<List>(null);
 const itemSizeMap = useRef<Map<number, number>>(new Map());
 
 // Calculate item count including potential loading items
 const itemCount = hasNextPage ? items.length + 1 : items.length;
 
 // Default isItemLoaded function
 const defaultIsItemLoaded = (index: number) => index < items.length;
 const checkItemLoaded = isItemLoaded || defaultIsItemLoaded;
 
 // Calculate row height for grid layout
 const getItemSize = useMemo(() => {
 if (typeof itemSize === 'function') {
 return itemSize;
 }
 
 return (index: number) => {
 // For grid layout, we need to calculate based on columns
 if (gridCols > 1) {
 const rowIndex = Math.floor(index / gridCols);
 const cachedSize = itemSizeMap.current.get(rowIndex);
 if (cachedSize !== undefined) {
 return cachedSize;
 }
 return estimatedItemSize || itemSize;
 }
 
 const cachedSize = itemSizeMap.current.get(index);
 if (cachedSize !== undefined) {
 return cachedSize;
 }
 return estimatedItemSize || itemSize;
 };
 }, [itemSize, gridCols, estimatedItemSize]);
 
 // Set measured item size
 const setItemSize = (index: number, size: number) => {
 itemSizeMap.current.set(index, size);
 if (listRef.current) {
 listRef.current.resetAfterIndex(index);
 }
 };
 
 // Render wrapper with measurement
 const ItemWrapper = ({ index, style }: { index: number; style: React.CSSProperties }) => {
 const measureRef = useRef<HTMLDivElement>(null);
 
 useEffect(() => {
 if (measureRef.current) {
 const height = measureRef.current.getBoundingClientRect().height;
 if (height !== getItemSize(index)) {
 setItemSize(index, height);
 }
 }
 }, [index]);
 
 // Loading state
 if (!checkItemLoaded(index)) {
 return (
 <div style={style} className="flex items-center justify-center p-4">
 {loadingState || <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />}
 </div>
 );
 }
 
 // Grid layout
 if (gridCols > 1) {
 const startIdx = index * gridCols;
 const endIdx = Math.min(startIdx + gridCols, items.length);
 const rowItems = items.slice(startIdx, endIdx);
 
 return (
 <div ref={measureRef} style={style} className="px-4">
 <div 
 className="grid" 
 style={{ 
 gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
 gap: `${gap}px`
 }}
 >
 {rowItems.map((item, idx) => (
 <div key={startIdx + idx}>
 {renderItem(item, startIdx + idx, {})}
 </div>
 ))}
 </div>
 </div>
 );
 }
 
 // Single column layout
 return (
 <div ref={measureRef} style={style}>
 {renderItem(items[index], index, style)}
 </div>
 );
 };
 
 // Empty state
 if (items.length === 0 && emptyState) {
 return <>{emptyState}</>;
 }
 
 // Calculate actual row count for grid
 const rowCount = gridCols > 1 ? Math.ceil(itemCount / gridCols) : itemCount;
 
 const content = (
 <AutoSizer>
 {({ height, width }) => {
 if (loadMoreItems && hasNextPage) {
 return (
 <InfiniteLoader
 isItemLoaded={(index) => checkItemLoaded(gridCols > 1 ? index * gridCols : index)}
 itemCount={rowCount}
 loadMoreItems={loadMoreItems}
 minimumBatchSize={minimumBatchSize}
 threshold={threshold}
 >
 {({ onItemsRendered, ref }) => (
 <List
 ref={(list) => {
 if (list) {
 listRef.current = list;
 ref(list);
 }
 }}
 className={cn('scrollbar-thin', className)}
 height={height}
 itemCount={rowCount}
 itemSize={getItemSize}
 width={width}
 overscanCount={overscan}
 onItemsRendered={onItemsRendered}
 estimatedItemSize={estimatedItemSize || 100}
 >
 {ItemWrapper}
 </List>
 )}
 </InfiniteLoader>
 );
 }
 
 return (
 <List
 ref={listRef}
 className={cn('scrollbar-thin', className)}
 height={height}
 itemCount={rowCount}
 itemSize={getItemSize}
 width={width}
 overscanCount={overscan}
 estimatedItemSize={estimatedItemSize || 100}
 >
 {ItemWrapper}
 </List>
 );
 }}
 </AutoSizer>
 );
 
 return content;
}

// Optimized fixed-size list for better performance
export function FixedSizeVirtualList<T>({
 items,
 renderItem,
 itemSize = 100,
 className,
 overscan = 3,
 gridCols = 1,
 gap = 0,
 emptyState,
}: Omit<VirtualListProps<T>, 'itemSize' | 'estimatedItemSize' | 'loadMoreItems' | 'hasNextPage' | 'isItemLoaded' | 'threshold' | 'minimumBatchSize'> & {
 itemSize?: number;
}) {
 // Empty state
 if (items.length === 0 && emptyState) {
 return <>{emptyState}</>;
 }
 
 const rowCount = gridCols > 1 ? Math.ceil(items.length / gridCols) : items.length;
 
 const ItemWrapper = ({ index, style }: { index: number; style: React.CSSProperties }) => {
 if (gridCols > 1) {
 const startIdx = index * gridCols;
 const endIdx = Math.min(startIdx + gridCols, items.length);
 const rowItems = items.slice(startIdx, endIdx);
 
 return (
 <div style={style} className="px-4">
 <div 
 className="grid" 
 style={{ 
 gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
 gap: `${gap}px`
 }}
 >
 {rowItems.map((item, idx) => (
 <div key={startIdx + idx}>
 {renderItem(item, startIdx + idx, {})}
 </div>
 ))}
 </div>
 </div>
 );
 }
 
 return renderItem(items[index], index, style);
 };
 
 return (
 <AutoSizer>
 {({ height, width }) => (
 <List
 className={cn('scrollbar-thin', className)}
 height={height}
 itemCount={rowCount}
 itemSize={() => itemSize}
 width={width}
 overscanCount={overscan}
 >
 {ItemWrapper}
 </List>
 )}
 </AutoSizer>
 );
}