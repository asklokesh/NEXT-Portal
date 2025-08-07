'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Layout, 
 Eye, 
 Code, 
 Grid, 
 ZoomIn, 
 ZoomOut, 
 RotateCcw,
 Save,
 Upload,
 Download
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { DragDropCanvas } from './DragDropCanvas';
import { FieldPalette } from './FieldPalette';
import { PreviewPane } from './PreviewPane';
import { PropertyPanel } from './PropertyPanel';
import { useFormBuilderStore } from '../store/formBuilderStore';

interface FormBuilderProps {
 className?: string;
}

interface ToolbarProps {
 onSave?: () => void;
 onLoad?: () => void;
 onExport?: () => void;
}

interface ModeToggleProps {
 mode: 'design' | 'preview' | 'code';
 onChange: (mode: 'design' | 'preview' | 'code') => void;
}

interface CanvasControlsProps {
 zoom: number;
 showGrid: boolean;
 snapToGrid: boolean;
 onZoomChange: (zoom: number) => void;
 onToggleGrid: () => void;
 onToggleSnap: () => void;
 onResetView: () => void;
}

// Toolbar component
const Toolbar: React.FC<ToolbarProps> = ({ onSave, onLoad, onExport }) => {
 return (
 <div className="flex items-center gap-2">
 <button
 onClick={onSave}
 className={cn(
 'flex items-center gap-1 px-3 py-1 text-sm rounded border',
 'bg-primary text-primary-foreground border-primary',
 'hover:bg-primary/90 transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 >
 <Save className="w-4 h-4" />
 Save
 </button>
 
 <button
 onClick={onLoad}
 className={cn(
 'flex items-center gap-1 px-3 py-1 text-sm rounded border',
 'bg-background text-foreground border-border',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 >
 <Upload className="w-4 h-4" />
 Load
 </button>
 
 <button
 onClick={onExport}
 className={cn(
 'flex items-center gap-1 px-3 py-1 text-sm rounded border',
 'bg-background text-foreground border-border',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 >
 <Download className="w-4 h-4" />
 Export
 </button>
 </div>
 );
};

// Mode toggle component
const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => {
 const modes = [
 { id: 'design', label: 'Design', icon: Layout },
 { id: 'preview', label: 'Preview', icon: Eye },
 { id: 'code', label: 'Code', icon: Code },
 ] as const;

 return (
 <div className="flex rounded-md bg-muted p-1">
 {modes.map((modeOption) => {
 const IconComponent = modeOption.icon;
 return (
 <button
 key={modeOption.id}
 onClick={() => onChange(modeOption.id)}
 className={cn(
 'flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-sm transition-colors',
 mode === modeOption.id
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 )}
 >
 <IconComponent className="w-4 h-4" />
 {modeOption.label}
 </button>
 );
 })}
 </div>
 );
};

// Canvas controls component
const CanvasControls: React.FC<CanvasControlsProps> = ({
 zoom,
 showGrid,
 snapToGrid,
 onZoomChange,
 onToggleGrid,
 onToggleSnap,
 onResetView,
}) => {
 return (
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1">
 <button
 onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title="Zoom out"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 
 <span className="px-2 py-1 text-xs font-mono bg-muted rounded min-w-[60px] text-center">
 {Math.round(zoom * 100)}%
 </span>
 
 <button
 onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title="Zoom in"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 </div>
 
 <div className="w-px h-4 bg-border" />
 
 <button
 onClick={onToggleGrid}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded border',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring',
 showGrid 
 ? 'border-primary text-primary bg-primary/10' 
 : 'border-border text-muted-foreground hover:text-foreground'
 )}
 title="Toggle grid"
 >
 <Grid className="w-3 h-3" />
 Grid
 </button>
 
 <button
 onClick={onToggleSnap}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded border',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring',
 snapToGrid 
 ? 'border-primary text-primary bg-primary/10' 
 : 'border-border text-muted-foreground hover:text-foreground'
 )}
 title="Toggle snap to grid"
 >
 <div className="w-3 h-3 border border-current rounded-sm" />
 Snap
 </button>
 
 <div className="w-px h-4 bg-border" />
 
 <button
 onClick={onResetView}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title="Reset view"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 </div>
 );
};

// Main form builder component
export const FormBuilder: React.FC<FormBuilderProps> = ({ className }) => {
 const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
 const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
 const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);

 const {
 mode,
 zoom,
 showGrid,
 snapToGrid,
 setMode,
 setZoom,
 toggleShowGrid,
 toggleSnapToGrid,
 clearForm: _clearForm,
 } = useFormBuilderStore();

 const handleSave = () => {
 // TODO: Implement save functionality
 console.log('Save form');
 };

 const handleLoad = () => {
 // TODO: Implement load functionality
 console.log('Load form');
 };

 const handleExport = () => {
 // TODO: Implement export functionality
 console.log('Export form');
 };

 const handleResetView = () => {
 setZoom(1);
 };

 return (
 <div className={cn('flex flex-col h-full bg-background', className)}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border bg-background">
 <div className="flex items-center gap-4">
 <h1 className="text-xl font-semibold text-foreground">
 Backstage Form Builder
 </h1>
 
 <ModeToggle mode={mode} onChange={setMode} />
 </div>
 
 <div className="flex items-center gap-4">
 <CanvasControls
 zoom={zoom}
 showGrid={showGrid}
 snapToGrid={snapToGrid}
 onZoomChange={setZoom}
 onToggleGrid={toggleShowGrid}
 onToggleSnap={toggleSnapToGrid}
 onResetView={handleResetView}
 />
 
 <div className="w-px h-6 bg-border" />
 
 <Toolbar
 onSave={handleSave}
 onLoad={handleLoad}
 onExport={handleExport}
 />
 </div>
 </div>

 {/* Main content */}
 <div className="flex flex-1 overflow-hidden">
 {/* Field Palette */}
 {!isPaletteCollapsed && (
 <div className="w-80 flex-shrink-0">
 <FieldPalette />
 </div>
 )}

 {/* Palette collapse toggle */}
 <button
 onClick={() => setIsPaletteCollapsed(!isPaletteCollapsed)}
 className={cn(
 'w-6 flex-shrink-0 bg-border hover:bg-accent',
 'flex items-center justify-center transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title={isPaletteCollapsed ? 'Show palette' : 'Hide palette'}
 >
 <div className={cn(
 'w-1 h-8 bg-muted-foreground rounded-full transition-transform duration-200',
 isPaletteCollapsed ? 'rotate-180' : ''
 )} />
 </button>

 {/* Canvas */}
 <div className="flex-1 flex flex-col min-w-0">
 <DragDropCanvas />
 </div>

 {/* Properties panel */}
 {mode === 'design' && !isPropertiesCollapsed && (
 <>
 {/* Properties collapse toggle */}
 <button
 onClick={() => setIsPropertiesCollapsed(!isPropertiesCollapsed)}
 className={cn(
 'w-6 flex-shrink-0 bg-border hover:bg-accent',
 'flex items-center justify-center transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title={isPropertiesCollapsed ? 'Show properties' : 'Hide properties'}
 >
 <div className={cn(
 'w-1 h-8 bg-muted-foreground rounded-full transition-transform duration-200',
 isPropertiesCollapsed ? 'rotate-180' : ''
 )} />
 </button>

 <div className="w-80 flex-shrink-0">
 <PropertyPanel />
 </div>
 </>
 )}

 {/* Preview pane */}
 {(mode === 'preview' || mode === 'code') && !isPreviewCollapsed && (
 <>
 {/* Preview collapse toggle */}
 <button
 onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
 className={cn(
 'w-6 flex-shrink-0 bg-border hover:bg-accent',
 'flex items-center justify-center transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 title={isPreviewCollapsed ? 'Show preview' : 'Hide preview'}
 >
 <div className={cn(
 'w-1 h-8 bg-muted-foreground rounded-full transition-transform duration-200',
 isPreviewCollapsed ? 'rotate-180' : ''
 )} />
 </button>

 <div className="w-96 flex-shrink-0">
 <PreviewPane />
 </div>
 </>
 )}
 </div>

 {/* Status bar */}
 <div className="flex items-center justify-between px-4 py-2 bg-muted border-t border-border text-xs text-muted-foreground">
 <div className="flex items-center gap-4">
 <span>Mode: {mode}</span>
 <span>Zoom: {Math.round(zoom * 100)}%</span>
 <span>Grid: {showGrid ? 'On' : 'Off'}</span>
 <span>Snap: {snapToGrid ? 'On' : 'Off'}</span>
 </div>
 
 <div className="flex items-center gap-4">
 <span>Ready</span>
 </div>
 </div>
 </div>
 );
};

export default FormBuilder;