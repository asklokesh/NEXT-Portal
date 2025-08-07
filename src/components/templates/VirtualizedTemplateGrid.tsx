'use client';

import React, { useCallback } from 'react';
import { FixedSizeVirtualList } from '@/components/ui/VirtualList';
import type { TemplateEntity } from '@/services/backstage/types/templates';

interface VirtualizedTemplateGridProps {
 templates: TemplateEntity[];
 onTemplateClick: (template: TemplateEntity) => void;
 isFavorite?: (templateRef: string) => boolean;
 toggleFavorite?: (templateRef: string) => void;
 renderTemplateCard: (template: TemplateEntity, onClick: () => void) => React.ReactNode;
 viewMode?: 'grid' | 'list';
 emptyMessage?: string;
}

export const VirtualizedTemplateGrid = React.memo(({
 templates,
 onTemplateClick,
 isFavorite,
 toggleFavorite,
 renderTemplateCard,
 viewMode = 'grid',
 emptyMessage = "No templates found",
}: VirtualizedTemplateGridProps) => {
 // Calculate grid layout
 const gridCols = viewMode === 'grid' ? 3 : 1;
 const itemHeight = viewMode === 'grid' ? 380 : 120; // Estimated heights
 const gap = viewMode === 'grid' ? 24 : 0;

 const renderTemplate = useCallback((template: TemplateEntity, index: number) => {
 const handleClick = () => onTemplateClick(template);
 
 return (
 <div className="relative group">
 {renderTemplateCard(template, handleClick)}
 
 {/* Quick actions overlay - only in grid view */}
 {viewMode === 'grid' && toggleFavorite && isFavorite && (
 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={(e) => {
 e.stopPropagation();
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 toggleFavorite(templateRef);
 }}
 className={`p-1 rounded hover:bg-accent transition-colors ${
 isFavorite(`${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`)
 ? 'text-red-500'
 : 'text-muted-foreground'
 }`}
 >
 <svg 
 className={`w-4 h-4 ${
 isFavorite(`${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`)
 ? 'fill-current'
 : ''
 }`}
 fill="none" 
 stroke="currentColor" 
 viewBox="0 0 24 24"
 >
 <path 
 strokeLinecap="round" 
 strokeLinejoin="round" 
 strokeWidth={2} 
 d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
 />
 </svg>
 </button>
 </div>
 )}
 </div>
 );
 }, [onTemplateClick, renderTemplateCard, viewMode, toggleFavorite, isFavorite]);

 const emptyState = (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <svg 
 className="w-12 h-12 text-muted-foreground mb-4" 
 fill="none" 
 stroke="currentColor" 
 viewBox="0 0 24 24"
 >
 <path 
 strokeLinecap="round" 
 strokeLinejoin="round" 
 strokeWidth={2} 
 d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
 />
 </svg>
 <h3 className="font-semibold mb-2">No templates found</h3>
 <p className="text-sm text-muted-foreground max-w-md">
 {emptyMessage}
 </p>
 </div>
 );

 return (
 <div className="h-full">
 <FixedSizeVirtualList
 items={templates}
 renderItem={renderTemplate}
 itemSize={itemHeight}
 gridCols={gridCols}
 gap={gap}
 emptyState={emptyState}
 overscan={3}
 />
 </div>
 );
});

VirtualizedTemplateGrid.displayName = 'VirtualizedTemplateGrid';

// Virtualized template list for recently used, favorites, etc.
export const VirtualizedTemplateList = React.memo(({
 templates,
 onTemplateClick,
 renderItem,
 emptyMessage = "No templates",
 className,
}: {
 templates: TemplateEntity[];
 onTemplateClick: (template: TemplateEntity) => void;
 renderItem?: (template: TemplateEntity, onClick: () => void) => React.ReactNode;
 emptyMessage?: string;
 className?: string;
}) => {
 const defaultRenderItem = useCallback((template: TemplateEntity, onClick: () => void) => (
 <button
 onClick={onClick}
 className="w-full text-left p-3 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 <div className="font-medium text-sm truncate">
 {template.metadata.title || template.metadata.name}
 </div>
 <div className="text-xs text-muted-foreground truncate">
 {template.spec.type} • {template.spec.owner}
 </div>
 {template.metadata.description && (
 <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
 {template.metadata.description}
 </div>
 )}
 </button>
 ), []);

 const renderTemplate = useCallback((template: TemplateEntity) => {
 const handleClick = () => onTemplateClick(template);
 return (renderItem || defaultRenderItem)(template, handleClick);
 }, [onTemplateClick, renderItem, defaultRenderItem]);

 const emptyState = (
 <div className="text-center py-4 text-sm text-muted-foreground">
 {emptyMessage}
 </div>
 );

 return (
 <div className={className}>
 <FixedSizeVirtualList
 items={templates}
 renderItem={renderTemplate}
 itemSize={80}
 emptyState={emptyState}
 overscan={2}
 />
 </div>
 );
});

VirtualizedTemplateList.displayName = 'VirtualizedTemplateList';