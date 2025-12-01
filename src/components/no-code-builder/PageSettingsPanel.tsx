'use client';

/**
 * Page Settings Panel
 * Modal/sidebar for configuring page-level settings
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Palette,
  Layout,
  Shield,
  Search,
  Globe,
  FileCode,
  ChevronDown,
  ChevronRight,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageConfig, PageLayout } from './types';

interface PageSettingsPanelProps {
  isOpen: boolean;
  config: PageConfig;
  onUpdate: (updates: Partial<PageConfig>) => void;
  onClose: () => void;
}

interface SettingsSectionProps {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SettingsSection({ title, icon: Icon, defaultOpen = true, children }: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, description, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {children}
    </div>
  );
}

const LAYOUT_OPTIONS: { value: PageLayout['type']; label: string; description: string }[] = [
  { value: 'grid', label: 'Grid', description: 'Flexible grid layout with drag-and-drop' },
  { value: 'tabs', label: 'Tabs', description: 'Tabbed sections for organized content' },
  { value: 'sidebar', label: 'Sidebar', description: 'Main content with sidebar navigation' },
  { value: 'full-width', label: 'Full Width', description: 'Edge-to-edge content layout' },
];

export function PageSettingsPanel({ isOpen, config, onUpdate, onClose }: PageSettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<PageConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = <K extends keyof PageConfig>(key: K, value: PageConfig[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  const handleMetadataChange = (key: string, value: string) => {
    const metadata = { ...localConfig.metadata, [key]: value };
    handleChange('metadata', metadata);
  };

  const handlePermissionChange = (key: string, value: string[]) => {
    const permissions = { ...localConfig.permissions, [key]: value };
    handleChange('permissions', permissions);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Page Settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure page properties and behavior
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Basic Settings */}
              <SettingsSection title="Basic Information" icon={Settings}>
                <div className="space-y-4">
                  <FormField label="Page Name" required>
                    <input
                      type="text"
                      value={localConfig.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="My Custom Page"
                    />
                  </FormField>

                  <FormField label="Path" description="URL path for this page" required>
                    <div className="flex items-center">
                      <span className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg">
                        /
                      </span>
                      <input
                        type="text"
                        value={localConfig.path.replace(/^\//, '')}
                        onChange={(e) => handleChange('path', `/${e.target.value}`)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="custom-page"
                      />
                    </div>
                  </FormField>

                  <FormField label="Description">
                    <textarea
                      value={localConfig.description || ''}
                      onChange={(e) => handleChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Describe what this page is for..."
                    />
                  </FormField>

                  <FormField label="Icon" description="Lucide icon name for navigation">
                    <input
                      type="text"
                      value={localConfig.icon || ''}
                      onChange={(e) => handleChange('icon', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="layout-dashboard"
                    />
                  </FormField>
                </div>
              </SettingsSection>

              {/* Layout */}
              <SettingsSection title="Layout" icon={Layout} defaultOpen={false}>
                <div className="space-y-4">
                  <FormField label="Layout Type" description="Choose how widgets are arranged">
                    <div className="grid grid-cols-2 gap-2">
                      {LAYOUT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() =>
                            handleChange('layout', { ...localConfig.layout, type: option.value })
                          }
                          className={cn(
                            'p-3 rounded-lg border text-left transition-colors',
                            localConfig.layout.type === option.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                          )}
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </FormField>

                  {localConfig.layout.type === 'grid' && (
                    <FormField label="Grid Columns" description="Number of columns in the grid">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={localConfig.layout.columns || 12}
                        onChange={(e) =>
                          handleChange('layout', {
                            ...localConfig.layout,
                            columns: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </FormField>
                  )}

                  <FormField label="Gap Size" description="Spacing between widgets">
                    <select
                      value={localConfig.layout.gap || 'default'}
                      onChange={(e) =>
                        handleChange('layout', { ...localConfig.layout, gap: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="none">None</option>
                      <option value="sm">Small</option>
                      <option value="default">Default</option>
                      <option value="lg">Large</option>
                    </select>
                  </FormField>
                </div>
              </SettingsSection>

              {/* Appearance */}
              <SettingsSection title="Appearance" icon={Palette} defaultOpen={false}>
                <div className="space-y-4">
                  <FormField label="Theme">
                    <select
                      value={localConfig.theme || 'inherit'}
                      onChange={(e) => handleChange('theme', e.target.value as PageConfig['theme'])}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="inherit">Inherit from portal</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </FormField>

                  <FormField label="Background Color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={localConfig.style?.backgroundColor || '#f9fafb'}
                        onChange={(e) =>
                          handleChange('style', {
                            ...localConfig.style,
                            backgroundColor: e.target.value,
                          })
                        }
                        className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={localConfig.style?.backgroundColor || ''}
                        onChange={(e) =>
                          handleChange('style', {
                            ...localConfig.style,
                            backgroundColor: e.target.value,
                          })
                        }
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#f9fafb"
                      />
                    </div>
                  </FormField>

                  <FormField label="Custom CSS">
                    <textarea
                      value={localConfig.style?.customCss || ''}
                      onChange={(e) =>
                        handleChange('style', { ...localConfig.style, customCss: e.target.value })
                      }
                      rows={4}
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder=".custom-class { }"
                    />
                  </FormField>
                </div>
              </SettingsSection>

              {/* Permissions */}
              <SettingsSection title="Permissions" icon={Shield} defaultOpen={false}>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                      <Info className="h-4 w-4" />
                      <span>Control who can view and edit this page</span>
                    </div>
                  </div>

                  <FormField label="View Access" description="Groups that can view this page">
                    <div className="space-y-2">
                      {(localConfig.permissions?.view || ['*']).map((group, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={group}
                            onChange={(e) => {
                              const newView = [...(localConfig.permissions?.view || ['*'])];
                              newView[index] = e.target.value;
                              handlePermissionChange('view', newView);
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="group:developers or * for all"
                          />
                          <button
                            onClick={() => {
                              const newView = (localConfig.permissions?.view || ['*']).filter(
                                (_, i) => i !== index
                              );
                              handlePermissionChange('view', newView);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newView = [...(localConfig.permissions?.view || []), ''];
                          handlePermissionChange('view', newView);
                        }}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add group
                      </button>
                    </div>
                  </FormField>

                  <FormField label="Edit Access" description="Groups that can edit this page">
                    <div className="space-y-2">
                      {(localConfig.permissions?.edit || ['group:admins']).map((group, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={group}
                            onChange={(e) => {
                              const newEdit = [
                                ...(localConfig.permissions?.edit || ['group:admins']),
                              ];
                              newEdit[index] = e.target.value;
                              handlePermissionChange('edit', newEdit);
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="group:admins"
                          />
                          <button
                            onClick={() => {
                              const newEdit = (
                                localConfig.permissions?.edit || ['group:admins']
                              ).filter((_, i) => i !== index);
                              handlePermissionChange('edit', newEdit);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newEdit = [...(localConfig.permissions?.edit || []), ''];
                          handlePermissionChange('edit', newEdit);
                        }}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add group
                      </button>
                    </div>
                  </FormField>
                </div>
              </SettingsSection>

              {/* SEO & Metadata */}
              <SettingsSection title="SEO & Metadata" icon={Search} defaultOpen={false}>
                <div className="space-y-4">
                  <FormField label="Page Title" description="Browser tab title">
                    <input
                      type="text"
                      value={localConfig.metadata?.title || ''}
                      onChange={(e) => handleMetadataChange('title', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Page Title | Developer Portal"
                    />
                  </FormField>

                  <FormField label="Meta Description" description="Search engine description">
                    <textarea
                      value={localConfig.metadata?.description || ''}
                      onChange={(e) => handleMetadataChange('description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Brief description for search results..."
                    />
                  </FormField>

                  <FormField label="Keywords" description="Comma-separated keywords">
                    <input
                      type="text"
                      value={localConfig.metadata?.keywords || ''}
                      onChange={(e) => handleMetadataChange('keywords', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="developer, portal, services"
                    />
                  </FormField>
                </div>
              </SettingsSection>

              {/* Advanced */}
              <SettingsSection title="Advanced" icon={FileCode} defaultOpen={false}>
                <div className="space-y-4">
                  <FormField
                    label="Entity Context"
                    description="Associate this page with an entity kind"
                  >
                    <select
                      value={localConfig.entityKind || ''}
                      onChange={(e) =>
                        handleChange('entityKind', e.target.value || undefined)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No entity context</option>
                      <option value="Component">Component</option>
                      <option value="API">API</option>
                      <option value="System">System</option>
                      <option value="Domain">Domain</option>
                      <option value="Resource">Resource</option>
                      <option value="User">User</option>
                      <option value="Group">Group</option>
                    </select>
                  </FormField>

                  <FormField label="Navigation">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={localConfig.showInNavigation !== false}
                          onChange={(e) => handleChange('showInNavigation', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Show in main navigation
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={localConfig.showInSearch !== false}
                          onChange={(e) => handleChange('showInSearch', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Include in search results
                        </span>
                      </label>
                    </div>
                  </FormField>

                  <FormField label="Page Status">
                    <select
                      value={localConfig.status || 'published'}
                      onChange={(e) =>
                        handleChange('status', e.target.value as PageConfig['status'])
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </FormField>
                </div>
              </SettingsSection>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PageSettingsPanel;
