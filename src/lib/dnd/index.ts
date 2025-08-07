import type { DragItem, DropZone } from './DragDropContext';

export { DragDropProvider, useDragDrop } from './DragDropContext';
export type { DragItem, DropZone, DragDropState } from './DragDropContext';

export { Draggable, DraggableCard } from './Draggable';
export { Droppable, DroppableZone, DroppableList } from './Droppable';

// Utility functions for drag and drop operations
export const createDragItem = (id: string, type: 'entity' | 'folder' | 'group', data: any): DragItem => ({
  id,
  type,
  data,
});

export const createDropZone = (
  id: string,
  type: 'folder' | 'group' | 'category',
  accepts: string[],
  data: any = {}
): DropZone => ({
  id,
  type,
  accepts,
  data,
});

// Type guards
export const isDragItem = (item: any): item is DragItem => {
  return item && typeof item.id === 'string' && typeof item.type === 'string';
};

export const isDropZone = (zone: any): zone is DropZone => {
  return zone && typeof zone.id === 'string' && typeof zone.type === 'string' && Array.isArray(zone.accepts);
};

// Common drop zone configurations
export const ENTITY_ACCEPTS = ['entity'];
export const FOLDER_ACCEPTS = ['entity', 'folder'];
export const GROUP_ACCEPTS = ['entity', 'folder', 'group'];
export const CATEGORY_ACCEPTS = ['entity', 'folder', 'group'];