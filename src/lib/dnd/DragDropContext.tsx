'use client';

import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  closestCenter,
  closestCorners,
  rectIntersection,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToWindowEdges, restrictToParentElement } from '@dnd-kit/modifiers';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface DragItem {
  id: string;
  type: 'entity' | 'folder' | 'group';
  data: any;
}

export interface DropZone {
  id: string;
  type: 'folder' | 'group' | 'category';
  accepts: string[];
  data: any;
}

export interface DragDropState {
  draggedItem: DragItem | null;
  dropZones: DropZone[];
  isValidDrop: boolean;
}

interface DragDropContextValue {
  state: DragDropState;
  isDragging: boolean;
  activeDragItem: DragItem | null;
  onDragStart: (item: DragItem) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  registerDropZone: (zone: DropZone) => void;
  unregisterDropZone: (zoneId: string) => void;
  isValidDropTarget: (sourceType: string, targetType: string) => boolean;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};

interface DragDropProviderProps {
  children: ReactNode;
  onItemMoved?: (item: DragItem, source: string, target: string, position?: number) => void;
  onFolderCreated?: (name: string, parentId?: string) => void;
  onGroupCreated?: (name: string, type: string) => void;
  collisionDetection?: CollisionDetection;
  modifiers?: any[];
}

export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  onItemMoved,
  onFolderCreated,
  onGroupCreated,
  collisionDetection = closestCenter,
  modifiers = [restrictToWindowEdges],
}) => {
  const [state, setState] = useState<DragDropState>({
    draggedItem: null,
    dropZones: [],
    isValidDrop: false,
  });

  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Configure sensors for different input methods
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay for touch devices
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const registerDropZone = useCallback((zone: DropZone) => {
    setState(prev => ({
      ...prev,
      dropZones: [...prev.dropZones.filter(z => z.id !== zone.id), zone],
    }));
  }, []);

  const unregisterDropZone = useCallback((zoneId: string) => {
    setState(prev => ({
      ...prev,
      dropZones: prev.dropZones.filter(z => z.id !== zoneId),
    }));
  }, []);

  const isValidDropTarget = useCallback((sourceType: string, targetType: string) => {
    // Define valid drop combinations
    const validCombinations: Record<string, string[]> = {
      entity: ['folder', 'group', 'category'],
      folder: ['folder', 'group'],
      group: ['category'],
    };

    return validCombinations[sourceType]?.includes(targetType) ?? false;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const dragItem = active.data.current as DragItem;
    
    setActiveDragItem(dragItem);
    setIsDragging(true);
    setState(prev => ({
      ...prev,
      draggedItem: dragItem,
    }));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over || !active.data.current) return;

    const dragItem = active.data.current as DragItem;
    const dropZone = state.dropZones.find(zone => zone.id === over.id);
    
    if (dropZone) {
      const isValid = isValidDropTarget(dragItem.type, dropZone.type);
      setState(prev => ({
        ...prev,
        isValidDrop: isValid,
      }));
    }
  }, [state.dropZones, isValidDropTarget]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // Optional: Handle drag move for visual feedback
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveDragItem(null);
    setIsDragging(false);
    setState(prev => ({
      ...prev,
      draggedItem: null,
      isValidDrop: false,
    }));

    if (!over || !active.data.current) return;

    const dragItem = active.data.current as DragItem;
    const dropZone = state.dropZones.find(zone => zone.id === over.id);
    
    if (dropZone && isValidDropTarget(dragItem.type, dropZone.type)) {
      const sourceId = active.id as string;
      const targetId = over.id as string;
      
      onItemMoved?.(dragItem, sourceId, targetId);
    }
  }, [state.dropZones, isValidDropTarget, onItemMoved]);

  const contextValue: DragDropContextValue = {
    state,
    isDragging,
    activeDragItem,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragMove: handleDragMove,
    registerDropZone,
    unregisterDropZone,
    isValidDropTarget,
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={modifiers}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeDragItem && (
            <div className="bg-white border-2 border-blue-500 rounded-lg shadow-xl p-3 opacity-95 transform rotate-3">
              <div className="text-sm font-medium text-gray-900">
                {activeDragItem.data.name || activeDragItem.id}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DragDropContext.Provider>
  );
};

export default DragDropProvider;