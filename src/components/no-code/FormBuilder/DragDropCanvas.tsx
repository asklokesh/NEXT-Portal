'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 DndContext,
 DragOverlay,
 PointerSensor,
 useSensor,
 useSensors,
 closestCenter,
 KeyboardSensor,
} from '@dnd-kit/core';
import { 
 SortableContext, 
 useSortable,
 sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Copy, Settings, Move, Eye, EyeOff } from 'lucide-react';
import React, { useCallback, useRef, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { FieldRenderer } from './FieldRenderer';
import { createFieldFromDefinition, getFieldDefinition } from '../common/FieldComponents';
import { useFormBuilderStore } from '../store/formBuilderStore';

import type { FormField, FieldPosition, DragItem } from '../types';
import type { 
 DragEndEvent, 
 DragMoveEvent,
 DragStartEvent} from '@dnd-kit/core';

interface DragDropCanvasProps {
 className?: string;
}

interface CanvasFieldProps {
 field: FormField;
 isSelected: boolean;
 isPreview?: boolean;
 onSelect: (fieldId: string) => void;
 onDelete: (fieldId: string) => void;
 onDuplicate: (fieldId: string) => void;
 onToggleVisibility: (fieldId: string) => void;
}

interface GridProps {
 gridSize: number;
 canvasSize: { width: number; height: number };
 zoom: number;
 show: boolean;
}

// Grid background component
const Grid: React.FC<GridProps> = ({ gridSize, canvasSize, zoom, show }) => {
 if (!show) return null;

 const scaledGridSize = gridSize * zoom;
 
 return (
 <div className="absolute inset-0 pointer-events-none">
 <svg 
 width={canvasSize.width} 
 height={canvasSize.height}
 className="w-full h-full"
 >
 <defs>
 <pattern
 id="grid"
 width={scaledGridSize}
 height={scaledGridSize}
 patternUnits="userSpaceOnUse"
 >
 <path
 d={`M ${scaledGridSize} 0 L 0 0 0 ${scaledGridSize}`}
 fill="none"
 stroke="currentColor"
 strokeWidth="0.5"
 className="text-border"
 />
 </pattern>
 </defs>
 <rect width="100%" height="100%" fill="url(#grid)" />
 </svg>
 </div>
 );
};

// Canvas field wrapper component
const CanvasField: React.FC<CanvasFieldProps> = ({ 
 field, 
 isSelected, 
 isPreview = false, 
 onSelect, 
 onDelete, 
 onDuplicate,
 onToggleVisibility 
}) => {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({
 id: field.id,
 data: {
 type: 'FIELD',
 field,
 },
 });

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 position: 'absolute' as const,
 left: field.position.x,
 top: field.position.y,
 width: field.position.width,
 height: field.position.height,
 zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
 };

 const handleClick = (e: React.MouseEvent) => {
 e.stopPropagation();
 if (!isPreview) {
 onSelect(field.id);
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Delete' || e.key === 'Backspace') {
 e.preventDefault();
 onDelete(field.id);
 } else if (e.key === 'Escape') {
 onSelect('');
 }
 };

 return (
 <div
 ref={setNodeRef}
 style={style}
 onClick={handleClick}
 onKeyDown={handleKeyDown}
 className={cn(
 'group cursor-pointer transition-all duration-200',
 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
 isSelected && !isPreview && 'ring-2 ring-primary ring-offset-2',
 isDragging && 'opacity-50 scale-105 rotate-1 shadow-lg',
 field.hidden && 'opacity-50',
 !isPreview && 'hover:shadow-md'
 )}
 {...(!isPreview && { tabIndex: 0, role: "button" })}
 aria-label={`Field: ${field.label}`}
 {...attributes}
 {...(isPreview ? {} : listeners)}
 >
 {/* Field content */}
 <div className={cn(
 'h-full rounded-lg border-2 bg-background p-3',
 isSelected && !isPreview ? 'border-primary' : 'border-border',
 field.hidden && 'border-dashed',
 !isPreview && 'hover:border-primary/50'
 )}>
 <FieldRenderer field={field} isPreview={isPreview} />
 </div>

 {/* Field controls (only in design mode) */}
 {isSelected && !isPreview && (
 <div className="absolute -top-2 -right-2 flex gap-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleVisibility(field.id);
 }}
 className={cn(
 'p-1 rounded-md bg-background border border-border',
 'hover:bg-accent hover:text-accent-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring',
 'transition-colors duration-200'
 )}
 title={field.hidden ? "Show field" : "Hide field"}
 >
 {field.hidden ? (
 <EyeOff className="w-3 h-3" />
 ) : (
 <Eye className="w-3 h-3" />
 )}
 </button>
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 onDuplicate(field.id);
 }}
 className={cn(
 'p-1 rounded-md bg-background border border-border',
 'hover:bg-accent hover:text-accent-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring',
 'transition-colors duration-200'
 )}
 title="Duplicate field"
 >
 <Copy className="w-3 h-3" />
 </button>
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 onDelete(field.id);
 }}
 className={cn(
 'p-1 rounded-md bg-destructive border border-destructive',
 'text-destructive-foreground hover:bg-destructive/90',
 'focus:outline-none focus:ring-2 focus:ring-ring',
 'transition-colors duration-200'
 )}
 title="Delete field"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 )}

 {/* Drag handle */}
 {isSelected && !isPreview && (
 <div className="absolute -top-2 -left-2">
 <div className={cn(
 'p-1 rounded-md bg-primary border border-primary',
 'text-primary-foreground cursor-move',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}>
 <Move className="w-3 h-3" />
 </div>
 </div>
 )}

 {/* Resize handles (if selected) */}
 {isSelected && !isPreview && (
 <>
 {/* Corner resize handles */}
 <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary border border-primary-foreground rounded-sm cursor-se-resize" />
 <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary border border-primary-foreground rounded-sm cursor-ne-resize" />
 <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary border border-primary-foreground rounded-sm cursor-sw-resize" />
 <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary border border-primary-foreground rounded-sm cursor-nw-resize" />
 </>
 )}
 </div>
 );
};

// Drop zone indicator
const DropZoneIndicator: React.FC<{ 
 position: { x: number; y: number }; 
 size: { width: number; height: number };
 show: boolean;
}> = ({ position, size, show }) => {
 if (!show) return null;

 return (
 <div
 className="absolute pointer-events-none border-2 border-dashed border-primary bg-primary/10 rounded-lg transition-all duration-200"
 style={{
 left: position.x,
 top: position.y,
 width: size.width,
 height: size.height,
 }}
 />
 );
};

// Main canvas component
export const DragDropCanvas: React.FC<DragDropCanvasProps> = ({ className }) => {
 const canvasRef = useRef<HTMLDivElement>(null);
 const [isDragOver, setIsDragOver] = useState(false);
 const [dropPosition, setDropPosition] = useState({ x: 0, y: 0 });
 const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);

 const {
 fields,
 selectedFieldId,
 canvasSize,
 gridSize,
 snapToGrid,
 showGrid,
 zoom,
 mode,
 addField,
 updateField,
 deleteField,
 selectField,
 moveField,
 duplicateField,
 } = useFormBuilderStore();

 // Sensors for drag and drop
 const sensors = useSensors(
 useSensor(PointerSensor, {
 activationConstraint: {
 distance: 8,
 },
 }),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 );

 // Handle canvas click to deselect
 const handleCanvasClick = useCallback((e: React.MouseEvent) => {
 if (e.target === e.currentTarget) {
 selectField(null);
 }
 }, [selectField]);

 // Calculate drop position with snap-to-grid
 const calculateDropPosition = useCallback((x: number, y: number): FieldPosition => {
 if (snapToGrid) {
 const snappedX = Math.round(x / gridSize) * gridSize;
 const snappedY = Math.round(y / gridSize) * gridSize;
 return {
 x: Math.max(0, Math.min(snappedX, canvasSize.width - 240)),
 y: Math.max(0, Math.min(snappedY, canvasSize.height - 60)),
 width: 240,
 height: 60,
 };
 }
 
 return {
 x: Math.max(0, Math.min(x, canvasSize.width - 240)),
 y: Math.max(0, Math.min(y, canvasSize.height - 60)),
 width: 240,
 height: 60,
 };
 }, [snapToGrid, gridSize, canvasSize]);

 // Drag handlers
 const handleDragStart = useCallback((event: DragStartEvent) => {
 const { active } = event;
 setDraggedItem(active.data.current as DragItem);
 }, []);

 const handleDragMove = useCallback((event: DragMoveEvent) => {
 if (!canvasRef.current) return;

 const { delta } = event;
 const rect = canvasRef.current.getBoundingClientRect();
 
 let x = (event.activatorEvent as MouseEvent).clientX - rect.left;
 let y = (event.activatorEvent as MouseEvent).clientY - rect.top;
 
 if (delta) {
 x += delta.x;
 y += delta.y;
 }

 // Apply zoom
 x = x / zoom;
 y = y / zoom;

 const position = calculateDropPosition(x, y);
 setDropPosition(position);
 setIsDragOver(true);
 }, [calculateDropPosition, zoom]);

 const handleDragEnd = useCallback((event: DragEndEvent) => {
 const { active, delta } = event;
 const dragData = active.data.current as DragItem;

 setIsDragOver(false);
 setDraggedItem(null);

 if (!canvasRef.current) return;

 if (dragData.type === 'PALETTE_ITEM' && dragData.fieldType) {
 // Adding new field from palette
 const definition = getFieldDefinition(dragData.fieldType);
 if (definition) {
 const rect = canvasRef.current.getBoundingClientRect();
 let x = (event.activatorEvent as MouseEvent).clientX - rect.left;
 let y = (event.activatorEvent as MouseEvent).clientY - rect.top;

 // Apply zoom
 x = x / zoom;
 y = y / zoom;

 const position = calculateDropPosition(x, y);
 const newField = createFieldFromDefinition(definition, { position });
 addField(newField);
 }
 } else if (dragData.type === 'FIELD' && dragData.fieldId && delta) {
 // Moving existing field
 const field = fields.find(f => f.id === dragData.fieldId);
 if (field) {
 const newX = field.position.x + delta.x / zoom;
 const newY = field.position.y + delta.y / zoom;
 const newPosition = calculateDropPosition(newX, newY);
 moveField(dragData.fieldId, newPosition);
 }
 }
 }, [addField, moveField, fields, calculateDropPosition, zoom]);

 // Field action handlers
 const handleSelectField = useCallback((fieldId: string) => {
 selectField(fieldId);
 }, [selectField]);

 const handleDeleteField = useCallback((fieldId: string) => {
 deleteField(fieldId);
 }, [deleteField]);

 const handleDuplicateField = useCallback((fieldId: string) => {
 duplicateField(fieldId);
 }, [duplicateField]);

 const handleToggleVisibility = useCallback((fieldId: string) => {
 const field = fields.find(f => f.id === fieldId);
 if (field) {
 updateField(fieldId, { hidden: !field.hidden });
 }
 }, [fields, updateField]);

 // Keyboard shortcuts
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (mode !== 'design') return;

 if (e.key === 'Delete' || e.key === 'Backspace') {
 if (selectedFieldId) {
 e.preventDefault();
 handleDeleteField(selectedFieldId);
 }
 } else if (e.key === 'Escape') {
 selectField(null);
 } else if (e.ctrlKey || e.metaKey) {
 if (e.key === 'd' && selectedFieldId) {
 e.preventDefault();
 handleDuplicateField(selectedFieldId);
 }
 }
 };

 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, [mode, selectedFieldId, handleDeleteField, handleDuplicateField, selectField]);

 const isPreviewMode = mode === 'preview';

 return (
 <div className={cn('relative flex-1 overflow-hidden bg-background', className)}>
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragStart={handleDragStart}
 onDragMove={handleDragMove}
 onDragEnd={handleDragEnd}
 >
 {/* Canvas */}
 <div
 ref={canvasRef}
 onClick={handleCanvasClick}
 className={cn(
 'relative w-full h-full overflow-auto',
 'focus:outline-none',
 isPreviewMode ? 'bg-muted/20' : 'bg-background'
 )}
 style={{
 transform: `scale(${zoom})`,
 transformOrigin: 'top left',
 }}
 tabIndex={0}
 role="application"
 aria-label="Form canvas"
 >
 {/* Grid */}
 <Grid
 gridSize={gridSize}
 canvasSize={canvasSize}
 zoom={zoom}
 show={showGrid && !isPreviewMode}
 />

 {/* Canvas content area */}
 <div
 className="relative"
 style={{
 width: canvasSize.width,
 height: canvasSize.height,
 minHeight: '100%',
 }}
 >
 {/* Drop zone indicator */}
 <DropZoneIndicator
 position={dropPosition}
 size={{ width: 240, height: 60 }}
 show={isDragOver && !isPreviewMode}
 />

 {/* Fields */}
 <SortableContext items={fields.map(f => f.id)}>
 {fields.map((field) => (
 <CanvasField
 key={field.id}
 field={field}
 isSelected={selectedFieldId === field.id}
 isPreview={isPreviewMode}
 onSelect={handleSelectField}
 onDelete={handleDeleteField}
 onDuplicate={handleDuplicateField}
 onToggleVisibility={handleToggleVisibility}
 />
 ))}
 </SortableContext>

 {/* Empty state */}
 {fields.length === 0 && !isDragOver && (
 <div className="absolute inset-0 flex items-center justify-center">
 <div className="text-center max-w-md mx-auto">
 <div className="mb-4">
 <Settings className="w-16 h-16 mx-auto text-muted-foreground/50" />
 </div>
 <h3 className="text-lg font-medium text-foreground mb-2">
 Start Building Your Form
 </h3>
 <p className="text-muted-foreground mb-4">
 Drag fields from the palette to create your Backstage entity configuration.
 </p>
 <div className="text-sm text-muted-foreground">
 TIP: Try dragging a preset to get started quickly
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Drag overlay */}
 <DragOverlay>
 {draggedItem?.type === 'PALETTE_ITEM' && draggedItem.fieldType && (
 <div className="w-60 p-3 bg-background border border-primary rounded-lg shadow-lg opacity-90">
 <div className="text-sm font-medium text-foreground">
 {getFieldDefinition(draggedItem.fieldType)?.label}
 </div>
 </div>
 )}
 {draggedItem?.type === 'FIELD' && draggedItem.field && (
 <div className="opacity-90 transform rotate-3 scale-105">
 <CanvasField
 field={draggedItem.field}
 isSelected={false}
 isPreview={true}
 onSelect={() => {}}
 onDelete={() => {}}
 onDuplicate={() => {}}
 onToggleVisibility={() => {}}
 />
 </div>
 )}
 </DragOverlay>
 </DndContext>
 </div>
 );
};