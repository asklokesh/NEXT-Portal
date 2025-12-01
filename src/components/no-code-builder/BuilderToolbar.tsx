'use client';

/**
 * Builder Toolbar Component
 * Top toolbar for the page builder with actions and view controls
 */

import React from 'react';
import {
  Undo2,
  Redo2,
  Save,
  Eye,
  Settings,
  Grid,
  Smartphone,
  Tablet,
  Monitor,
  Laptop,
  Code,
  Download,
  Upload,
  Copy,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  Play,
  Share2,
  History,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ViewportSize } from './types';

interface BuilderToolbarProps {
  pageName: string;
  onPageNameChange?: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
  onSettings?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  viewport: ViewportSize;
  onViewportChange: (viewport: ViewportSize) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  isDirty?: boolean;
  isPreviewMode?: boolean;
  onTogglePreview?: () => void;
  onBack?: () => void;
  className?: string;
}

const VIEWPORT_OPTIONS: { value: ViewportSize; label: string; icon: React.ElementType; width: string }[] = [
  { value: 'mobile', label: 'Mobile', icon: Smartphone, width: '375px' },
  { value: 'tablet', label: 'Tablet', icon: Tablet, width: '768px' },
  { value: 'laptop', label: 'Laptop', icon: Laptop, width: '1024px' },
  { value: 'desktop', label: 'Desktop', icon: Monitor, width: '100%' },
];

export function BuilderToolbar({
  pageName,
  onPageNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  onPreview,
  onSettings,
  onExport,
  onImport,
  viewport,
  onViewportChange,
  showGrid,
  onToggleGrid,
  zoom = 100,
  onZoomChange,
  isDirty = false,
  isPreviewMode = false,
  onTogglePreview,
  onBack,
  className,
}: BuilderToolbarProps) {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back to pages"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
        )}

        {/* Page Name */}
        <div className="flex items-center gap-2">
          {onPageNameChange ? (
            <input
              type="text"
              value={pageName}
              onChange={(e) => onPageNameChange(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white max-w-[200px]"
            />
          ) : (
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {pageName}
            </span>
          )}
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-orange-500" title="Unsaved changes" />
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              'p-2 rounded-lg transition-colors',
              canUndo
                ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            )}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={cn(
              'p-2 rounded-lg transition-colors',
              canRedo
                ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            )}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Center Section - Viewport */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {VIEWPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => onViewportChange(option.value)}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewport === option.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              title={`${option.label} (${option.width})`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Grid Toggle */}
        <button
          onClick={onToggleGrid}
          className={cn(
            'p-2 rounded-lg transition-colors',
            showGrid
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
          )}
          title="Toggle grid"
        >
          <Grid className="h-4 w-4" />
        </button>

        {/* Zoom Controls */}
        {onZoomChange && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-1">
            <button
              onClick={() => onZoomChange(Math.max(50, zoom - 10))}
              disabled={zoom <= 50}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              onClick={() => onZoomChange(Math.min(200, zoom + 10))}
              disabled={zoom >= 200}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Preview Toggle */}
        {onTogglePreview && (
          <button
            onClick={onTogglePreview}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isPreviewMode
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
          >
            {isPreviewMode ? (
              <>
                <Code className="h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Preview
              </>
            )}
          </button>
        )}

        {/* Settings */}
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            title="Page settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        {/* More Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMoreMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMoreMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                {onExport && (
                  <button
                    onClick={() => {
                      onExport();
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4" />
                    Export Page
                  </button>
                )}
                {onImport && (
                  <button
                    onClick={() => {
                      onImport();
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Upload className="h-4 w-4" />
                    Import Page
                  </button>
                )}
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate Page
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <History className="h-4 w-4" />
                  Version History
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Page
                </button>
              </div>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

        {/* Save */}
        {onSave && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            className={cn(isDirty && 'border-orange-500 text-orange-600')}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        )}

        {/* Publish */}
        {onPublish && (
          <Button size="sm" onClick={onPublish}>
            <Play className="h-4 w-4 mr-1" />
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}

export default BuilderToolbar;
