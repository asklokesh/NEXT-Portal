'use client';

import { X, Edit3, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CatalogBulkOperationsBarProps {
  selectedEntities: string[];
  onBulkAction: (action: string, entityIds: string[]) => void;
  onClearSelection: () => void;
  className?: string;
}

export function CatalogBulkOperationsBar({
  selectedEntities,
  onBulkAction,
  onClearSelection,
  className,
}: CatalogBulkOperationsBarProps) {
  return (
    <div className={cn(
      "sticky bottom-4 left-0 right-0 mx-auto max-w-2xl",
      className
    )}>
      <div className="bg-background border rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Selection Info */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedEntities.length} selected
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkAction('edit-metadata', selectedEntities)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Metadata
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkAction('refresh', selectedEntities)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkAction('export', selectedEntities)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkAction('delete', selectedEntities)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}