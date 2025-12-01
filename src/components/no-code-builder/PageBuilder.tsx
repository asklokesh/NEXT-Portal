'use client';

/**
 * No-Code Page Builder
 * Visual drag-and-drop interface for creating portal pages
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Plus,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Save,
  Settings,
  Grid3X3,
  Smartphone,
  Monitor,
  Tablet,
  Copy,
  Trash2,
  Layers,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  PortalPage,
  Widget,
  WidgetType,
  BuilderState,
  WidgetDefinition,
  WidgetPosition,
  WidgetSize,
} from './types';
import { WidgetLibrary } from './WidgetLibrary';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { PageSettingsPanel } from './PageSettingsPanel';
import { SortableWidget } from './SortableWidget';

interface PageBuilderProps {
  initialPage?: PortalPage;
  onSave?: (page: PortalPage) => Promise<void>;
  onPublish?: (page: PortalPage) => Promise<void>;
  readOnly?: boolean;
}

const createEmptyPage = (): PortalPage => ({
  id: `page-${Date.now()}`,
  name: 'Untitled Page',
  slug: 'untitled',
  layout: {
    type: 'grid',
    columns: 12,
    rowHeight: 80,
    gap: 16,
  },
  widgets: [],
  settings: {
    theme: 'system',
    headerVisible: true,
    sidebarVisible: true,
    maxWidth: 'xl',
  },
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user',
    updatedBy: 'current-user',
    version: 1,
    status: 'draft',
  },
});

export function PageBuilder({
  initialPage,
  onSave,
  onPublish,
  readOnly = false,
}: PageBuilderProps) {
  const [state, setState] = useState<BuilderState>({
    page: initialPage || createEmptyPage(),
    selectedWidgetId: null,
    isDragging: false,
    isResizing: false,
    zoom: 100,
    showGrid: true,
    snapToGrid: true,
    history: [],
    historyIndex: -1,
    clipboard: null,
    previewMode: false,
  });

  const [showLibrary, setShowLibrary] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const canvasRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // History management
  const saveToHistory = useCallback(() => {
    const entry = {
      id: `history-${Date.now()}`,
      timestamp: new Date(),
      action: 'update',
      widgets: [...state.page.widgets],
      settings: { ...state.page.settings },
    };

    setState(prev => ({
      ...prev,
      history: [...prev.history.slice(0, prev.historyIndex + 1), entry],
      historyIndex: prev.historyIndex + 1,
    }));
  }, [state.page.widgets, state.page.settings, state.historyIndex]);

  const undo = useCallback(() => {
    if (state.historyIndex > 0) {
      const entry = state.history[state.historyIndex - 1];
      setState(prev => ({
        ...prev,
        page: {
          ...prev.page,
          widgets: entry.widgets,
          settings: entry.settings,
        },
        historyIndex: prev.historyIndex - 1,
      }));
    }
  }, [state.historyIndex, state.history]);

  const redo = useCallback(() => {
    if (state.historyIndex < state.history.length - 1) {
      const entry = state.history[state.historyIndex + 1];
      setState(prev => ({
        ...prev,
        page: {
          ...prev.page,
          widgets: entry.widgets,
          settings: entry.settings,
        },
        historyIndex: prev.historyIndex + 1,
      }));
    }
  }, [state.historyIndex, state.history]);

  // Widget operations
  const addWidget = useCallback((definition: WidgetDefinition) => {
    saveToHistory();

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: definition.type,
      title: definition.name,
      config: { ...definition.defaultConfig },
      position: { x: 0, y: state.page.widgets.length * 4 },
      size: { ...definition.defaultSize },
    };

    setState(prev => ({
      ...prev,
      page: {
        ...prev.page,
        widgets: [...prev.page.widgets, newWidget],
      },
      selectedWidgetId: newWidget.id,
    }));
  }, [state.page.widgets, saveToHistory]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>) => {
    saveToHistory();

    setState(prev => ({
      ...prev,
      page: {
        ...prev.page,
        widgets: prev.page.widgets.map(w =>
          w.id === widgetId ? { ...w, ...updates } : w
        ),
      },
    }));
  }, [saveToHistory]);

  const removeWidget = useCallback((widgetId: string) => {
    saveToHistory();

    setState(prev => ({
      ...prev,
      page: {
        ...prev.page,
        widgets: prev.page.widgets.filter(w => w.id !== widgetId),
      },
      selectedWidgetId: prev.selectedWidgetId === widgetId ? null : prev.selectedWidgetId,
    }));
  }, [saveToHistory]);

  const duplicateWidget = useCallback((widgetId: string) => {
    const widget = state.page.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    saveToHistory();

    const newWidget: Widget = {
      ...widget,
      id: `widget-${Date.now()}`,
      position: {
        x: widget.position.x + 1,
        y: widget.position.y + 1,
      },
    };

    setState(prev => ({
      ...prev,
      page: {
        ...prev.page,
        widgets: [...prev.page.widgets, newWidget],
      },
      selectedWidgetId: newWidget.id,
    }));
  }, [state.page.widgets, saveToHistory]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setState(prev => ({ ...prev, isDragging: true }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setState(prev => ({ ...prev, isDragging: false }));

    if (over && active.id !== over.id) {
      saveToHistory();

      setState(prev => {
        const oldIndex = prev.page.widgets.findIndex(w => w.id === active.id);
        const newIndex = prev.page.widgets.findIndex(w => w.id === over.id);

        const newWidgets = [...prev.page.widgets];
        const [removed] = newWidgets.splice(oldIndex, 1);
        newWidgets.splice(newIndex, 0, removed);

        return {
          ...prev,
          page: {
            ...prev.page,
            widgets: newWidgets,
          },
        };
      });
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(state.page);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;

      // Undo: Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      // Save: Cmd+S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Delete selected widget
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedWidgetId && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          removeWidget(state.selectedWidgetId);
        }
      }

      // Duplicate: Cmd+D
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        if (state.selectedWidgetId) {
          e.preventDefault();
          duplicateWidget(state.selectedWidgetId);
        }
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setState(prev => ({ ...prev, selectedWidgetId: null }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, undo, redo, state.selectedWidgetId, removeWidget, duplicateWidget]);

  const selectedWidget = state.page.widgets.find(w => w.id === state.selectedWidgetId);
  const activeWidget = state.page.widgets.find(w => w.id === activeId);

  const viewportWidths = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Widget Library Sidebar */}
      <AnimatePresence>
        {showLibrary && !state.previewMode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <WidgetLibrary onAddWidget={addWidget} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLibrary(!showLibrary)}
              className={cn(!showLibrary && 'opacity-50')}
            >
              {showLibrary ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>

            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

            <Button variant="ghost" size="sm" onClick={undo} disabled={state.historyIndex <= 0}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={state.historyIndex >= state.history.length - 1}>
              <Redo2 className="h-4 w-4" />
            </Button>

            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
              className={cn(!state.showGrid && 'opacity-50')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>

          {/* Viewport Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <Button
              variant={viewport === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('desktop')}
              className="px-2"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={viewport === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('tablet')}
              className="px-2"
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={viewport === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport('mobile')}
              className="px-2"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState(prev => ({ ...prev, previewMode: !prev.previewMode }))}
            >
              {state.previewMode ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-auto p-8"
          onClick={() => setState(prev => ({ ...prev, selectedWidgetId: null }))}
        >
          <div
            className={cn(
              "mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg min-h-[600px] transition-all duration-300",
              state.showGrid && !state.previewMode && "bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:20px_20px] dark:bg-[linear-gradient(to_right,#374151_1px,transparent_1px),linear-gradient(to_bottom,#374151_1px,transparent_1px)]"
            )}
            style={{ width: viewportWidths[viewport] }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={state.page.widgets.map(w => w.id)}
                strategy={rectSortingStrategy}
              >
                <div className="p-6 space-y-4">
                  {state.page.widgets.length === 0 && !state.previewMode && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Layers className="h-12 w-12 mb-4" />
                      <p className="text-lg font-medium">No widgets yet</p>
                      <p className="text-sm">Drag widgets from the library to get started</p>
                    </div>
                  )}

                  {state.page.widgets.map((widget) => (
                    <SortableWidget
                      key={widget.id}
                      widget={widget}
                      isSelected={widget.id === state.selectedWidgetId}
                      isPreview={state.previewMode}
                      onSelect={() => {
                        setState(prev => ({ ...prev, selectedWidgetId: widget.id }));
                      }}
                      onDuplicate={() => duplicateWidget(widget.id)}
                      onDelete={() => removeWidget(widget.id)}
                    >
                      <WidgetRenderer widget={widget} isPreview={state.previewMode} />
                    </SortableWidget>
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeWidget && (
                  <div className="opacity-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4">
                    <WidgetRenderer widget={activeWidget} isPreview={false} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Config Panel Sidebar */}
      <AnimatePresence>
        {showConfig && selectedWidget && !state.previewMode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <WidgetConfigPanel
              widget={selectedWidget}
              onUpdate={(updates) => updateWidget(selectedWidget.id, updates)}
              onClose={() => setState(prev => ({ ...prev, selectedWidgetId: null }))}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Settings Modal */}
      {showSettings && (
        <PageSettingsPanel
          page={state.page}
          onUpdate={(updates) => {
            saveToHistory();
            setState(prev => ({
              ...prev,
              page: { ...prev.page, ...updates },
            }));
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default PageBuilder;
