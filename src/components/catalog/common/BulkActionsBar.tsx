'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

import { 
 X, 
 CheckSquare, 
 Square,
 AlertTriangle 
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import type { BulkOperation, ServiceEntity } from '../types';

interface BulkActionsBarProps {
 selectedCount: number;
 operations: BulkOperation[];
 onSelectAll: () => void;
 onClearSelection: () => void;
 isAllSelected: boolean;
 className?: string;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
 selectedCount,
 operations,
 onSelectAll,
 onClearSelection,
 isAllSelected,
 className,
}) => {
 const [confirmDialog, setConfirmDialog] = useState<{
 operation: BulkOperation;
 show: boolean;
 } | null>(null);

 const handleOperation = async (operation: BulkOperation) => {
 if (operation.confirmationRequired) {
 setConfirmDialog({ operation, show: true });
 } else {
 // Execute operation
 await operation.action([]);
 }
 };

 const handleConfirm = async () => {
 if (confirmDialog) {
 await confirmDialog.operation.action([]);
 setConfirmDialog(null);
 }
 };

 return (
 <>
 <div className={cn(
 'flex items-center justify-between px-4 py-2',
 'bg-accent border-t border-b border-border',
 className
 )}>
 <div className="flex items-center gap-3">
 <button
 onClick={onSelectAll}
 className="p-1 rounded hover:bg-accent-foreground/10 transition-colors"
 aria-label={isAllSelected ? "Deselect all" : "Select all"}
 >
 {isAllSelected ? (
 <CheckSquare className="w-4 h-4" />
 ) : (
 <Square className="w-4 h-4" />
 )}
 </button>
 
 <span className="text-sm font-medium">
 {selectedCount} selected
 </span>
 
 <button
 onClick={onClearSelection}
 className="text-sm text-muted-foreground hover:text-foreground transition-colors"
 >
 Clear
 </button>
 </div>

 <div className="flex items-center gap-2">
 {operations.map((operation) => (
 <button
 key={operation.id}
 onClick={() => handleOperation(operation)}
 className={cn(
 'flex items-center gap-2 px-3 py-1 text-sm rounded',
 'border border-border hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200'
 )}
 >
 {operation.icon}
 {operation.label}
 </button>
 ))}
 </div>
 </div>

 {/* Confirmation dialog */}
 {confirmDialog?.show && (
 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-popover border border-border rounded-lg p-6 max-w-md shadow-lg">
 <div className="flex items-start gap-3 mb-4">
 <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
 <div>
 <h3 className="font-semibold mb-1">Confirm Action</h3>
 <p className="text-sm text-muted-foreground">
 {confirmDialog.operation.confirmationMessage || 
 `Are you sure you want to ${confirmDialog.operation.label.toLowerCase()} the selected items?`}
 </p>
 </div>
 </div>
 
 <div className="flex justify-end gap-2">
 <button
 onClick={() => setConfirmDialog(null)}
 className="px-4 py-2 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirm}
 className={cn(
 'px-4 py-2 text-sm rounded',
 'bg-destructive text-destructive-foreground',
 'hover:bg-destructive/90 transition-colors'
 )}
 >
 {confirmDialog.operation.label}
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
};