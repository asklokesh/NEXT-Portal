'use client';

import React, { ReactNode, useEffect, CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDragDrop, DropZone } from './DragDropContext';
import { cn } from '@/lib/utils';

interface DroppableProps {
  id: string;
  children: ReactNode;
  data: DropZone;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  strategy?: 'vertical' | 'horizontal';
}

export const Droppable: React.FC<DroppableProps> = ({
  id,
  children,
  data,
  className,
  style,
  disabled = false,
  strategy = 'vertical',
}) => {
  const { registerDropZone, unregisterDropZone, state, isDragging } = useDragDrop();
  
  const { isOver, setNodeRef } = useDroppable({
    id,
    data,
    disabled,
  });

  const isValidDrop = state.draggedItem
    ? data.accepts.includes(state.draggedItem.type)
    : false;

  const showDropIndicator = isDragging && isOver && isValidDrop;
  const showInvalidIndicator = isDragging && isOver && !isValidDrop;

  useEffect(() => {
    registerDropZone(data);
    return () => unregisterDropZone(id);
  }, [id, data, registerDropZone, unregisterDropZone]);

  const sortingStrategy = strategy === 'horizontal' 
    ? horizontalListSortingStrategy 
    : verticalListSortingStrategy;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200 rounded-lg',
        showDropIndicator && 'bg-blue-50 border-2 border-blue-300 border-dashed',
        showInvalidIndicator && 'bg-red-50 border-2 border-red-300 border-dashed',
        !isDragging && 'border border-transparent',
        className
      )}
    >
      {children}
    </div>
  );
};

interface DroppableZoneProps {
  id: string;
  title: string;
  description?: string;
  accepts: string[];
  items: string[];
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
  icon?: ReactNode;
  strategy?: 'vertical' | 'horizontal';
  onItemsChange?: (items: string[]) => void;
}

export const DroppableZone: React.FC<DroppableZoneProps> = ({
  id,
  title,
  description,
  accepts,
  items,
  children,
  className,
  emptyMessage = 'Drop items here',
  icon,
  strategy = 'vertical',
  onItemsChange,
}) => {
  const dropZoneData: DropZone = {
    id,
    type: 'folder',
    accepts,
    data: { title, description },
  };

  const { isDragging, state } = useDragDrop();
  const isValidTarget = state.draggedItem
    ? accepts.includes(state.draggedItem.type)
    : false;

  const isEmpty = items.length === 0;
  const showEmptyState = isEmpty && (!isDragging || isValidTarget);

  return (
    <div className={cn('bg-gray-50 rounded-lg', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <Droppable
        id={id}
        data={dropZoneData}
        strategy={strategy}
        className="p-4 min-h-[120px]"
      >
        <SortableContext
          items={items}
          strategy={strategy === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
        >
          {showEmptyState ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              <div className="text-center">
                <div className="mb-2">
                  <svg
                    className="mx-auto h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                {emptyMessage}
              </div>
            </div>
          ) : (
            <div className={cn(
              'space-y-2',
              strategy === 'horizontal' && 'flex space-x-2 space-y-0'
            )}>
              {children}
            </div>
          )}
        </SortableContext>
      </Droppable>
    </div>
  );
};

interface DroppableListProps {
  id: string;
  items: string[];
  accepts: string[];
  children: ReactNode;
  className?: string;
  strategy?: 'vertical' | 'horizontal';
}

export const DroppableList: React.FC<DroppableListProps> = ({
  id,
  items,
  accepts,
  children,
  className,
  strategy = 'vertical',
}) => {
  const dropZoneData: DropZone = {
    id,
    type: 'group',
    accepts,
    data: {},
  };

  return (
    <Droppable
      id={id}
      data={dropZoneData}
      strategy={strategy}
      className={className}
    >
      <SortableContext
        items={items}
        strategy={strategy === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </Droppable>
  );
};

export default Droppable;