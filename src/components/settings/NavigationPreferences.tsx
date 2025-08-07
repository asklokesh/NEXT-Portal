'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Layout,
  Sidebar,
  PanelLeft,
  PanelRight,
  Menu,
  ChevronRight,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Move,
  Check,
  X
} from 'lucide-react';

interface NavigationPreferences {
  layout: 'sidebar' | 'top' | 'compact';
  sidebarPosition: 'left' | 'right';
  sidebarWidth: 'narrow' | 'normal' | 'wide';
  defaultExpanded: string[];
  showIcons: boolean;
  showDescriptions: boolean;
  showBadges: boolean;
  compactMode: boolean;
  autoCollapse: boolean;
  stickyHeader: boolean;
  showBreadcrumbs: boolean;
  menuOrder: string[];
}

const defaultPreferences: NavigationPreferences = {
  layout: 'sidebar',
  sidebarPosition: 'left',
  sidebarWidth: 'normal',
  defaultExpanded: ['Catalog'],
  showIcons: true,
  showDescriptions: true,
  showBadges: true,
  compactMode: false,
  autoCollapse: false,
  stickyHeader: true,
  showBreadcrumbs: true,
  menuOrder: []
};

export const NavigationPreferencesPanel: React.FC = () => {
  const [preferences, setPreferences] = useState<NavigationPreferences>(defaultPreferences);
  const [isDirty, setIsDirty] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Load preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('navigationPreferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch (error) {
        console.error('Failed to load navigation preferences:', error);
      }
    }
  }, []);

  // Update preference
  const updatePreference = <K extends keyof NavigationPreferences>(
    key: K,
    value: NavigationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Save preferences
  const savePreferences = () => {
    localStorage.setItem('navigationPreferences', JSON.stringify(preferences));
    setIsDirty(false);
    
    // Dispatch event to notify app of preference changes
    window.dispatchEvent(new CustomEvent('navigationPreferencesChanged', {
      detail: preferences
    }));
    
    // Show success message
    const event = new CustomEvent('showToast', {
      detail: {
        type: 'success',
        message: 'Navigation preferences saved successfully'
      }
    });
    window.dispatchEvent(event);
  };

  // Reset to defaults
  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    setIsDirty(true);
  };

  // Available menu items for reordering
  const menuItems = [
    'Dashboard',
    'Catalog',
    'Create',
    'Operations',
    'Monitoring',
    'Insights',
    'Plugins',
    'Docs'
  ];

  // Handle drag start
  const handleDragStart = (item: string) => {
    setDraggedItem(item);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const items = preferences.menuOrder.length > 0 ? preferences.menuOrder : menuItems;
    const draggedIndex = items.indexOf(draggedItem);
    
    if (draggedIndex === index) return;

    const newItems = [...items];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    updatePreference('menuOrder', newItems);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Navigation Preferences
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Customize how navigation appears and behaves
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetPreferences}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </button>
          <button
            onClick={savePreferences}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              isDirty
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Layout Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Layout Style
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {/* Sidebar Layout */}
          <button
            onClick={() => updatePreference('layout', 'sidebar')}
            className={`relative p-4 rounded-lg border-2 transition-colors ${
              preferences.layout === 'sidebar'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Sidebar className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Sidebar
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Traditional sidebar navigation
            </p>
            {preferences.layout === 'sidebar' && (
              <Check className="absolute top-2 right-2 h-5 w-5 text-blue-500" />
            )}
          </button>

          {/* Top Navigation */}
          <button
            onClick={() => updatePreference('layout', 'top')}
            className={`relative p-4 rounded-lg border-2 transition-colors ${
              preferences.layout === 'top'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Menu className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Top Bar
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Horizontal navigation menu
            </p>
            {preferences.layout === 'top' && (
              <Check className="absolute top-2 right-2 h-5 w-5 text-blue-500" />
            )}
          </button>

          {/* Compact Layout */}
          <button
            onClick={() => updatePreference('layout', 'compact')}
            className={`relative p-4 rounded-lg border-2 transition-colors ${
              preferences.layout === 'compact'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Layout className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Compact
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimal icon-only sidebar
            </p>
            {preferences.layout === 'compact' && (
              <Check className="absolute top-2 right-2 h-5 w-5 text-blue-500" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Options (only show if sidebar layout is selected) */}
      {preferences.layout === 'sidebar' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Sidebar Options
          </h3>
          
          <div className="space-y-4">
            {/* Sidebar Position */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Position
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose which side the sidebar appears on
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updatePreference('sidebarPosition', 'left')}
                  className={`p-2 rounded-md transition-colors ${
                    preferences.sidebarPosition === 'left'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => updatePreference('sidebarPosition', 'right')}
                  className={`p-2 rounded-md transition-colors ${
                    preferences.sidebarPosition === 'right'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  <PanelRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sidebar Width */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Width
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Adjust the sidebar width
                </p>
              </div>
              <select
                value={preferences.sidebarWidth}
                onChange={(e) => updatePreference('sidebarWidth', e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                <option value="narrow">Narrow</option>
                <option value="normal">Normal</option>
                <option value="wide">Wide</option>
              </select>
            </div>

            {/* Auto Collapse */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto Collapse
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically collapse sidebar on smaller screens
                </p>
              </div>
              <button
                onClick={() => updatePreference('autoCollapse', !preferences.autoCollapse)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.autoCollapse
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.autoCollapse ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Display Options
        </h3>
        
        <div className="space-y-4">
          {/* Show Icons */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Icons
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Display icons next to menu items
              </p>
            </div>
            <button
              onClick={() => updatePreference('showIcons', !preferences.showIcons)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showIcons
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showIcons ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show Descriptions */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Descriptions
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Display tooltips with item descriptions
              </p>
            </div>
            <button
              onClick={() => updatePreference('showDescriptions', !preferences.showDescriptions)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showDescriptions
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showDescriptions ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show Badges */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Badges
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Display notification badges on menu items
              </p>
            </div>
            <button
              onClick={() => updatePreference('showBadges', !preferences.showBadges)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showBadges
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showBadges ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show Breadcrumbs */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Breadcrumbs
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Display breadcrumb navigation
              </p>
            </div>
            <button
              onClick={() => updatePreference('showBreadcrumbs', !preferences.showBreadcrumbs)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showBreadcrumbs
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showBreadcrumbs ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Menu Order */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Menu Order
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag to reorder navigation items
            </p>
          </div>
          <button
            onClick={() => setIsReordering(!isReordering)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isReordering
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            <Move className="h-4 w-4" />
            {isReordering ? 'Done' : 'Reorder'}
          </button>
        </div>

        <div className="space-y-2">
          {(preferences.menuOrder.length > 0 ? preferences.menuOrder : menuItems).map((item, index) => (
            <motion.div
              key={item}
              draggable={isReordering}
              onDragStart={() => handleDragStart(item)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              whileHover={isReordering ? { scale: 1.02 } : {}}
              whileDrag={{ scale: 1.05, opacity: 0.8 }}
              className={`flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-md ${
                isReordering ? 'cursor-move' : ''
              } ${draggedItem === item ? 'opacity-50' : ''}`}
            >
              {isReordering && (
                <Menu className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Preview
        </h3>
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 min-h-[200px]">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-20">
            Navigation preview will appear here
          </p>
        </div>
      </div>
    </div>
  );
};