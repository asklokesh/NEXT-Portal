'use client';

import React, { ReactNode, CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDragDrop, DragItem } from './DragDropContext';
import { cn } from '@/lib/utils';

interface DraggableProps {
  id: string;
  children: ReactNode;
  data: DragItem;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  handle?: boolean;
  handleClassName?: string;
}

export const Draggable: React.FC<DraggableProps> = ({
  id,
  children,
  data,
  disabled = false,
  className,
  style,
  handle = false,
  handleClassName,
}) => {
  const { isDragging } = useDragDrop();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isItemDragging,
  } = useSortable({
    id,
    data,
    disabled,
  });

  const draggableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...style,
  };

  const handleProps = handle
    ? {}
    : { ...listeners, ...attributes };

  return (
    <div
      ref={setNodeRef}
      style={draggableStyle}
      className={cn(
        'relative',
        isItemDragging && 'opacity-50 z-50',
        isDragging && !isItemDragging && 'pointer-events-none',
        className
      )}
      {...handleProps}
    >
      {handle && (
        <div
          className={cn(
            'absolute top-2 left-2 cursor-grab active:cursor-grabbing',
            'hover:bg-gray-100 rounded p-1 transition-colors',
            handleClassName
          )}
          {...listeners}
          {...attributes}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-gray-400"
          >
            <circle cx="2" cy="2" r="1" fill="currentColor" />
            <circle cx="6" cy="2" r="1" fill="currentColor" />
            <circle cx="10" cy="2" r="1" fill="currentColor" />
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="6" r="1" fill="currentColor" />
            <circle cx="2" cy="10" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
            <circle cx="10" cy="10" r="1" fill="currentColor" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
};

interface DraggableCardProps {
  id: string;
  data: DragItem;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  id,
  data,
  title,
  subtitle,
  icon,
  children,
  disabled = false,
  className,
  onClick,
}) => {
  return (
    <Draggable
      id={id}
      data={data}
      disabled={disabled}
      className={cn(
        'group bg-white border border-gray-200 rounded-lg shadow-sm',
        'hover:shadow-md hover:border-gray-300 transition-all duration-200',
        'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      handle
    >
      <div className="p-4" onClick={onClick}>
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex-shrink-0 mt-1">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children && (
          <div className="mt-3">
            {children}
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default Draggable;