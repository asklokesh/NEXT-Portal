/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { useEffect, useCallback } from 'react';

interface KeyboardShortcutConfig {
 key: string;
 ctrl?: boolean;
 shift?: boolean;
 alt?: boolean;
 callback: () => void;
 description: string;
 enabled?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcutConfig[]) => {
 const handleKeyDown = useCallback((event: KeyboardEvent) => {
 // Don't trigger shortcuts when typing in inputs
 if (
 event.target instanceof HTMLInputElement ||
 event.target instanceof HTMLTextAreaElement ||
 event.target instanceof HTMLSelectElement ||
 (event.target as HTMLElement)?.contentEditable === 'true'
 ) {
 return;
 }

 for (const shortcut of shortcuts) {
 if (shortcut.enabled === false) continue;

 const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
 const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
 const shiftMatches = !!shortcut.shift === event.shiftKey;
 const altMatches = !!shortcut.alt === event.altKey;

 if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
 event.preventDefault();
 shortcut.callback();
 break;
 }
 }
 }, [shortcuts]);

 useEffect(() => {
 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, [handleKeyDown]);

 return shortcuts;
};

// Hook for dashboard-specific shortcuts
export const useDashboardShortcuts = ({
 onToggleEdit,
 onAddWidget,
 onSave,
 onRefresh,
 onOpenSettings,
 onShowHelp,
 onNavigateNext,
 onNavigatePrev,
 onSelectWidget,
 onDeleteSelected,
 isEditing
}: {
 onToggleEdit: () => void;
 onAddWidget: () => void;
 onSave: () => void;
 onRefresh: () => void;
 onOpenSettings: () => void;
 onShowHelp?: () => void;
 onNavigateNext?: () => void;
 onNavigatePrev?: () => void;
 onSelectWidget?: () => void;
 onDeleteSelected?: () => void;
 isEditing: boolean;
}) => {
 const shortcuts: KeyboardShortcutConfig[] = [
 {
 key: 'e',
 ctrl: true,
 callback: onToggleEdit,
 description: 'Toggle edit mode',
 },
 {
 key: 'n',
 ctrl: true,
 callback: onAddWidget,
 description: 'Add new widget',
 enabled: isEditing,
 },
 {
 key: 's',
 ctrl: true,
 callback: onSave,
 description: 'Save dashboard',
 },
 {
 key: 'r',
 ctrl: true,
 callback: onRefresh,
 description: 'Refresh all widgets',
 },
 {
 key: ',',
 ctrl: true,
 callback: onOpenSettings,
 description: 'Open dashboard settings',
 },
 {
 key: '?',
 callback: () => {
 if (onShowHelp) {
 onShowHelp();
 }
 },
 description: 'Show keyboard shortcuts',
 },
 {
 key: 'Escape',
 callback: () => {
 // Close any open modals or palettes
 document.dispatchEvent(new CustomEvent('dashboard:escape'));
 },
 description: 'Close modals and panels',
 },
 {
 key: 'Tab',
 callback: () => {
 if (onNavigateNext) {
 onNavigateNext();
 }
 },
 description: 'Navigate to next widget',
 enabled: isEditing,
 },
 {
 key: 'Tab',
 shift: true,
 callback: () => {
 if (onNavigatePrev) {
 onNavigatePrev();
 }
 },
 description: 'Navigate to previous widget',
 enabled: isEditing,
 },
 {
 key: 'Enter',
 callback: () => {
 if (onSelectWidget) {
 onSelectWidget();
 }
 },
 description: 'Select/configure widget',
 enabled: isEditing,
 },
 {
 key: 'Delete',
 callback: () => {
 if (onDeleteSelected) {
 onDeleteSelected();
 }
 },
 description: 'Delete selected widget',
 enabled: isEditing,
 },
 {
 key: 'ArrowRight',
 callback: () => {
 if (onNavigateNext) {
 onNavigateNext();
 }
 },
 description: 'Navigate to next widget',
 enabled: isEditing,
 },
 {
 key: 'ArrowLeft',
 callback: () => {
 if (onNavigatePrev) {
 onNavigatePrev();
 }
 },
 description: 'Navigate to previous widget',
 enabled: isEditing,
 }
 ];

 return useKeyboardShortcuts(shortcuts);
};