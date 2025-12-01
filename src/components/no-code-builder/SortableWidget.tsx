'use client';

/**
 * Sortable Widget Component
 * Wrapper for widgets that enables drag-and-drop reordering
 */

import React, { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetInstance } from './types';
import { WidgetRenderer } from './WidgetRenderer';

interface SortableWidgetProps {
  widget: WidgetInstance;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConfigure?: () => void;
  onResize?: (direction: 'expand' | 'shrink') => void;
  className?: string;
}

export const SortableWidget = forwardRef<HTMLDivElement, SortableWidgetProps>(
  function SortableWidget(
    {
      widget,
      isSelected = false,
      isEditing = true,
      onSelect,
      onDelete,
      onDuplicate,
      onConfigure,
      onResize,
      className,
    },
    ref
  ) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: widget.id,
      data: {
        type: 'widget-instance',
        widget,
      },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      gridColumn: `span ${widget.position.width}`,
      gridRow: `span ${widget.position.height}`,
    };

    // Combine refs
    const combinedRef = (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div
        ref={combinedRef}
        style={style}
        className={cn(
          'relative group',
          isDragging && 'opacity-50 z-50',
          className
        )}
      >
        {/* Widget Content */}
        <WidgetRenderer
          widget={widget}
          isEditing={isEditing}
          isSelected={isSelected}
          onSelect={onSelect}
          onEdit={onConfigure}
        />

        {/* Editing Overlay */}
        {isEditing && (
          <>
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className={cn(
                'absolute top-2 left-2 p-1.5 rounded cursor-grab active:cursor-grabbing',
                'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                isSelected && 'opacity-100'
              )}
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>

            {/* Action Buttons */}
            <div
              className={cn(
                'absolute top-2 right-2 flex items-center gap-1',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                isSelected && 'opacity-100'
              )}
            >
              {onConfigure && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigure();
                  }}
                  className="p-1.5 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Configure"
                >
                  <Settings className="h-3.5 w-3.5 text-gray-500" />
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="p-1.5 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Resize Handles */}
            {onResize && isSelected && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize('shrink');
                  }}
                  className="p-1 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Shrink"
                >
                  <Minimize2 className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize('expand');
                  }}
                  className="p-1 rounded bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Expand"
                >
                  <Maximize2 className="h-3 w-3 text-gray-500" />
                </button>
              </div>
            )}

            {/* Selection Border */}
            {isSelected && (
              <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-blue-500" />
            )}
          </>
        )}
      </div>
    );
  }
);

export default SortableWidget;
