'use client';

/**
 * Widget Configuration Panel
 * Sidebar panel for configuring selected widget properties
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Palette,
  Database,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { WidgetInstance, WidgetConfig, DataSourceConfig } from './types';

interface WidgetConfigPanelProps {
  widget: WidgetInstance | null;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
  onClose: () => void;
  className?: string;
}

interface ConfigSectionProps {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function ConfigSection({ title, icon: Icon, defaultOpen = true, children }: ConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FormField({ label, description, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {children}
    </div>
  );
}

export function WidgetConfigPanel({
  widget,
  onUpdate,
  onClose,
  className,
}: WidgetConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    if (widget) {
      setLocalConfig({ ...widget.config });
    } else {
      setLocalConfig(null);
    }
  }, [widget]);

  if (!widget || !localConfig) {
    return (
      <div className={cn('flex flex-col h-full bg-white dark:bg-gray-900', className)}>
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Select a widget to configure</p>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (key: keyof WidgetConfig, value: unknown) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdate({ [key]: value });
  };

  const handleSettingChange = (key: string, value: unknown) => {
    const settings = { ...localConfig.settings, [key]: value };
    setLocalConfig({ ...localConfig, settings });
    onUpdate({ settings });
  };

  const handleDataSourceChange = (updates: Partial<DataSourceConfig>) => {
    const dataSource = { ...localConfig.dataSource, ...updates } as DataSourceConfig;
    setLocalConfig({ ...localConfig, dataSource });
    onUpdate({ dataSource });
  };

  return (
    <div className={cn('flex flex-col h-full bg-white dark:bg-gray-900', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Widget Settings
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{widget.type}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Config Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Basic Settings */}
        <ConfigSection title="Basic" icon={Settings}>
          <div className="space-y-4">
            <FormField label="Title" description="Display title for this widget">
              <input
                type="text"
                value={localConfig.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Widget title"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={localConfig.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optional description"
              />
            </FormField>

            <FormField label="Visibility">
              <select
                value={localConfig.visibility || 'visible'}
                onChange={(e) => handleChange('visibility', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="visible">Always visible</option>
                <option value="hidden">Hidden</option>
                <option value="conditional">Conditional</option>
              </select>
            </FormField>
          </div>
        </ConfigSection>

        {/* Appearance */}
        <ConfigSection title="Appearance" icon={Palette} defaultOpen={false}>
          <div className="space-y-4">
            <FormField label="Background Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localConfig.style?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    handleChange('style', { ...localConfig.style, backgroundColor: e.target.value })
                  }
                  className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={localConfig.style?.backgroundColor || ''}
                  onChange={(e) =>
                    handleChange('style', { ...localConfig.style, backgroundColor: e.target.value })
                  }
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#ffffff"
                />
              </div>
            </FormField>

            <FormField label="Border Radius">
              <select
                value={localConfig.style?.borderRadius || 'default'}
                onChange={(e) =>
                  handleChange('style', { ...localConfig.style, borderRadius: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="sm">Small</option>
                <option value="default">Default</option>
                <option value="lg">Large</option>
                <option value="full">Full</option>
              </select>
            </FormField>

            <FormField label="Shadow">
              <select
                value={localConfig.style?.shadow || 'default'}
                onChange={(e) =>
                  handleChange('style', { ...localConfig.style, shadow: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="sm">Small</option>
                <option value="default">Default</option>
                <option value="lg">Large</option>
              </select>
            </FormField>

            <FormField label="Padding">
              <select
                value={localConfig.style?.padding || 'default'}
                onChange={(e) =>
                  handleChange('style', { ...localConfig.style, padding: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="sm">Small</option>
                <option value="default">Default</option>
                <option value="lg">Large</option>
              </select>
            </FormField>
          </div>
        </ConfigSection>

        {/* Data Source */}
        <ConfigSection title="Data Source" icon={Database} defaultOpen={false}>
          <div className="space-y-4">
            <FormField label="Source Type" description="Where to fetch data from">
              <select
                value={localConfig.dataSource?.type || 'static'}
                onChange={(e) => handleDataSourceChange({ type: e.target.value as DataSourceConfig['type'] })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="static">Static Data</option>
                <option value="catalog">Software Catalog</option>
                <option value="api">REST API</option>
                <option value="graphql">GraphQL</option>
                <option value="metrics">Metrics Backend</option>
              </select>
            </FormField>

            {localConfig.dataSource?.type === 'catalog' && (
              <FormField label="Entity Kind">
                <select
                  value={localConfig.dataSource?.entityKind || 'Component'}
                  onChange={(e) => handleDataSourceChange({ entityKind: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Component">Component</option>
                  <option value="API">API</option>
                  <option value="System">System</option>
                  <option value="Domain">Domain</option>
                  <option value="Resource">Resource</option>
                  <option value="User">User</option>
                  <option value="Group">Group</option>
                </select>
              </FormField>
            )}

            {(localConfig.dataSource?.type === 'api' ||
              localConfig.dataSource?.type === 'graphql') && (
              <FormField label="Endpoint URL">
                <input
                  type="text"
                  value={localConfig.dataSource?.endpoint || ''}
                  onChange={(e) => handleDataSourceChange({ endpoint: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://api.example.com/data"
                />
              </FormField>
            )}

            <FormField label="Refresh Interval" description="How often to refresh data">
              <select
                value={localConfig.dataSource?.refreshInterval || '0'}
                onChange={(e) =>
                  handleDataSourceChange({ refreshInterval: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Manual</option>
                <option value="30000">30 seconds</option>
                <option value="60000">1 minute</option>
                <option value="300000">5 minutes</option>
                <option value="900000">15 minutes</option>
              </select>
            </FormField>
          </div>
        </ConfigSection>

        {/* Filters */}
        <ConfigSection title="Filters" icon={Filter} defaultOpen={false}>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Info className="h-4 w-4" />
                <span>Configure data filters based on context</span>
              </div>
            </div>

            <FormField label="Filter by Current Entity">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.settings?.filterByCurrentEntity || false}
                  onChange={(e) => handleSettingChange('filterByCurrentEntity', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Filter data based on current page entity
                </span>
              </label>
            </FormField>

            <FormField label="Filter by Current User">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.settings?.filterByCurrentUser || false}
                  onChange={(e) => handleSettingChange('filterByCurrentUser', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show only data relevant to current user
                </span>
              </label>
            </FormField>

            <FormField label="Custom Filter Expression">
              <textarea
                value={localConfig.settings?.customFilter || ''}
                onChange={(e) => handleSettingChange('customFilter', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="entity.metadata.annotations['custom/filter'] === 'value'"
              />
            </FormField>
          </div>
        </ConfigSection>

        {/* Advanced */}
        <ConfigSection title="Advanced" icon={Code} defaultOpen={false}>
          <div className="space-y-4">
            <FormField label="Widget ID">
              <input
                type="text"
                value={widget.id}
                disabled
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              />
            </FormField>

            <FormField label="Custom CSS Class">
              <input
                type="text"
                value={localConfig.settings?.customClass || ''}
                onChange={(e) => handleSettingChange('customClass', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="custom-widget-class"
              />
            </FormField>

            <FormField label="Custom Data Attributes">
              <textarea
                value={JSON.stringify(localConfig.settings?.dataAttributes || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const attrs = JSON.parse(e.target.value);
                    handleSettingChange('dataAttributes', attrs);
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder='{"key": "value"}'
              />
            </FormField>

            <FormField label="Analytics Tracking">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.settings?.enableAnalytics !== false}
                  onChange={(e) => handleSettingChange('enableAnalytics', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable usage analytics for this widget
                </span>
              </label>
            </FormField>
          </div>
        </ConfigSection>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            // Reset to defaults
            onUpdate({
              title: '',
              description: '',
              style: {},
              settings: {},
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

export default WidgetConfigPanel;
