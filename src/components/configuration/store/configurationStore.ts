'use client';

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { produce } from 'immer';

import type {
  ConfigurationSchema,
  ConfigurationVersion,
  ConfigurationDiff,
  ConfigurationTemplate,
  FormState,
  CollaborationSession,
  CollaborationChange,
  AccessibilityConfig,
  FormPerformanceMetrics
} from '../types/schema';

interface ConfigurationState {
  // Current configuration
  currentSchema: ConfigurationSchema | null;
  currentValues: Record<string, any>;
  
  // Form state
  formState: FormState;
  
  // Version management
  versions: ConfigurationVersion[];
  currentVersion: string | null;
  
  // Templates
  templates: ConfigurationTemplate[];
  favoriteTemplates: string[];
  recentTemplates: string[];
  
  // Collaboration
  collaborationSession: CollaborationSession | null;
  pendingChanges: CollaborationChange[];
  
  // UI state
  activeMode: 'form' | 'wizard' | 'code' | 'preview';
  sidebarCollapsed: boolean;
  showValidationPanel: boolean;
  showPreview: boolean;
  
  // Accessibility
  accessibility: AccessibilityConfig;
  
  // Performance monitoring
  performanceMetrics: FormPerformanceMetrics[];
  
  // Preferences
  preferences: {
    autoSave: boolean;
    autoSaveInterval: number;
    validateOnChange: boolean;
    showFieldHelp: boolean;
    compactMode: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

interface ConfigurationActions {
  // Schema and values
  setSchema: (schema: ConfigurationSchema) => void;
  setValues: (values: Record<string, any>) => void;
  updateValue: (path: string, value: any) => void;
  resetValues: () => void;
  
  // Form state
  updateFormState: (updates: Partial<FormState>) => void;
  setFieldState: (fieldName: string, state: Partial<FormState['fields'][string]>) => void;
  
  // Version management
  createVersion: (message: string, author: string) => Promise<void>;
  loadVersion: (versionId: string) => Promise<void>;
  compareVersions: (version1: string, version2: string) => ConfigurationDiff[];
  deleteVersion: (versionId: string) => void;
  
  // Templates
  loadTemplates: () => Promise<void>;
  createTemplate: (template: Omit<ConfigurationTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<ConfigurationTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  favoriteTemplate: (id: string) => void;
  unfavoriteTemplate: (id: string) => void;
  addRecentTemplate: (id: string) => void;
  
  // Import/Export
  exportConfiguration: (format: 'json' | 'yaml' | 'typescript') => string;
  importConfiguration: (data: string, format: 'json' | 'yaml' | 'typescript') => Promise<void>;
  
  // Collaboration
  startCollaborationSession: (configurationId: string) => Promise<void>;
  endCollaborationSession: () => void;
  applyCollaborationChange: (change: CollaborationChange) => void;
  rejectCollaborationChange: (changeId: string) => void;
  
  // UI state
  setActiveMode: (mode: ConfigurationState['activeMode']) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleValidationPanel: () => void;
  togglePreview: () => void;
  
  // Accessibility
  updateAccessibility: (updates: Partial<AccessibilityConfig>) => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  
  // Performance
  recordPerformanceMetric: (metric: FormPerformanceMetrics) => void;
  clearPerformanceMetrics: () => void;
  
  // Preferences
  updatePreferences: (updates: Partial<ConfigurationState['preferences']>) => void;
  resetPreferences: () => void;
  
  // Utilities
  getFieldValue: (path: string) => any;
  validateConfiguration: () => Promise<boolean>;
  isDirty: () => boolean;
  canUndo: () => boolean;
  canRedo: () => void;
  undo: () => void;
  redo: () => void;
}

type ConfigurationStore = ConfigurationState & ConfigurationActions;

// Initial state
const initialState: ConfigurationState = {
  currentSchema: null,
  currentValues: {},
  
  formState: {
    fields: {},
    groups: {},
    values: {},
    errors: {},
    warnings: {},
    touched: {},
    dirty: false,
    valid: true,
    validating: false,
    submitting: false,
  },
  
  versions: [],
  currentVersion: null,
  
  templates: [],
  favoriteTemplates: [],
  recentTemplates: [],
  
  collaborationSession: null,
  pendingChanges: [],
  
  activeMode: 'form',
  sidebarCollapsed: false,
  showValidationPanel: true,
  showPreview: false,
  
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    screenReaderOptimized: false,
    keyboardNavigation: true,
    focusTrapping: true,
    announcements: true,
    largeText: false,
    colorBlindFriendly: false,
  },
  
  performanceMetrics: [],
  
  preferences: {
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    validateOnChange: true,
    showFieldHelp: true,
    compactMode: false,
    theme: 'auto',
  },
};

// Helper functions
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  if (lastKey) {
    target[lastKey] = value;
  }
}

function generateDiff(oldValues: Record<string, any>, newValues: Record<string, any>): ConfigurationDiff[] {
  const diffs: ConfigurationDiff[] = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  
  allKeys.forEach(key => {
    const oldValue = oldValues[key];
    const newValue = newValues[key];
    
    if (oldValue === undefined && newValue !== undefined) {
      diffs.push({
        field: key,
        path: key,
        type: 'added',
        newValue,
      });
    } else if (oldValue !== undefined && newValue === undefined) {
      diffs.push({
        field: key,
        path: key,
        type: 'removed',
        oldValue,
      });
    } else if (oldValue !== newValue) {
      diffs.push({
        field: key,
        path: key,
        type: 'modified',
        oldValue,
        newValue,
      });
    }
  });
  
  return diffs;
}

// Create the store
export const useConfigurationStore = create<ConfigurationStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,
        
        // Schema and values
        setSchema: (schema: ConfigurationSchema) => {
          set((state) => {
            state.currentSchema = schema;
            // Reset form state when schema changes
            state.formState = { ...initialState.formState };
          });
        },
        
        setValues: (values: Record<string, any>) => {
          set((state) => {
            state.currentValues = values;
            state.formState.values = values;
            state.formState.dirty = true;
          });
        },
        
        updateValue: (path: string, value: any) => {
          set((state) => {
            setNestedValue(state.currentValues, path, value);
            setNestedValue(state.formState.values, path, value);
            state.formState.dirty = true;
            
            // Update touched state
            state.formState.touched[path] = true;
          });
        },
        
        resetValues: () => {
          set((state) => {
            state.currentValues = {};
            state.formState.values = {};
            state.formState.touched = {};
            state.formState.errors = {};
            state.formState.warnings = {};
            state.formState.dirty = false;
          });
        },
        
        // Form state
        updateFormState: (updates: Partial<FormState>) => {
          set((state) => {
            Object.assign(state.formState, updates);
          });
        },
        
        setFieldState: (fieldName: string, fieldState: Partial<FormState['fields'][string]>) => {
          set((state) => {
            if (!state.formState.fields[fieldName]) {
              state.formState.fields[fieldName] = {
                id: fieldName,
                name: fieldName,
                value: getNestedValue(state.currentValues, fieldName),
                touched: false,
                dirty: false,
                visible: true,
                disabled: false,
                required: false,
              };
            }
            
            Object.assign(state.formState.fields[fieldName], fieldState);
          });
        },
        
        // Version management
        createVersion: async (message: string, author: string) => {
          set((state) => {
            const version: ConfigurationVersion = {
              id: `v${Date.now()}`,
              version: `1.${state.versions.length}`,
              timestamp: new Date(),
              author,
              message,
              schema: state.currentSchema!,
              values: { ...state.currentValues },
              tags: [],
            };
            
            state.versions.unshift(version);
            state.currentVersion = version.id;
            state.formState.dirty = false;
          });
        },
        
        loadVersion: async (versionId: string) => {
          set((state) => {
            const version = state.versions.find(v => v.id === versionId);
            if (version) {
              state.currentSchema = version.schema;
              state.currentValues = { ...version.values };
              state.formState.values = { ...version.values };
              state.currentVersion = versionId;
              state.formState.dirty = false;
            }
          });
        },
        
        compareVersions: (version1: string, version2: string) => {
          const state = get();
          const v1 = state.versions.find(v => v.id === version1);
          const v2 = state.versions.find(v => v.id === version2);
          
          if (!v1 || !v2) return [];
          
          return generateDiff(v1.values, v2.values);
        },
        
        deleteVersion: (versionId: string) => {
          set((state) => {
            state.versions = state.versions.filter(v => v.id !== versionId);
            if (state.currentVersion === versionId) {
              state.currentVersion = state.versions[0]?.id || null;
            }
          });
        },
        
        // Templates
        loadTemplates: async () => {
          try {
            // In production, this would fetch from an API
            const mockTemplates: ConfigurationTemplate[] = [
              {
                id: 'basic-service',
                name: 'Basic Service',
                description: 'A simple service configuration',
                category: 'Services',
                tags: ['service', 'basic'],
                schema: {} as ConfigurationSchema,
                defaultValues: {},
                author: 'System',
                version: '1.0.0',
                createdAt: new Date(),
                updatedAt: new Date(),
                featured: true,
              },
            ];
            
            set((state) => {
              state.templates = mockTemplates;
            });
          } catch (error) {
            console.error('Failed to load templates:', error);
          }
        },
        
        createTemplate: async (templateData) => {
          const template: ConfigurationTemplate = {
            ...templateData,
            id: `template_${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => {
            state.templates.unshift(template);
          });
        },
        
        updateTemplate: async (id: string, updates) => {
          set((state) => {
            const index = state.templates.findIndex(t => t.id === id);
            if (index !== -1) {
              Object.assign(state.templates[index], updates, { 
                updatedAt: new Date() 
              });
            }
          });
        },
        
        deleteTemplate: async (id: string) => {
          set((state) => {
            state.templates = state.templates.filter(t => t.id !== id);
            state.favoriteTemplates = state.favoriteTemplates.filter(fid => fid !== id);
            state.recentTemplates = state.recentTemplates.filter(rid => rid !== id);
          });
        },
        
        favoriteTemplate: (id: string) => {
          set((state) => {
            if (!state.favoriteTemplates.includes(id)) {
              state.favoriteTemplates.push(id);
            }
          });
        },
        
        unfavoriteTemplate: (id: string) => {
          set((state) => {
            state.favoriteTemplates = state.favoriteTemplates.filter(fid => fid !== id);
          });
        },
        
        addRecentTemplate: (id: string) => {
          set((state) => {
            state.recentTemplates = [id, ...state.recentTemplates.filter(rid => rid !== id)].slice(0, 10);
          });
        },
        
        // Import/Export
        exportConfiguration: (format: 'json' | 'yaml' | 'typescript') => {
          const state = get();
          const data = {
            schema: state.currentSchema,
            values: state.currentValues,
            version: state.currentVersion,
            exportedAt: new Date().toISOString(),
          };
          
          switch (format) {
            case 'json':
              return JSON.stringify(data, null, 2);
            case 'yaml':
              // In production, use a proper YAML library
              return JSON.stringify(data, null, 2);
            case 'typescript':
              return `export const configuration = ${JSON.stringify(data, null, 2)} as const;`;
            default:
              return JSON.stringify(data, null, 2);
          }
        },
        
        importConfiguration: async (data: string, format: 'json' | 'yaml' | 'typescript') => {
          try {
            let parsed;
            
            switch (format) {
              case 'json':
                parsed = JSON.parse(data);
                break;
              case 'yaml':
                // In production, use a proper YAML library
                parsed = JSON.parse(data);
                break;
              case 'typescript':
                // Basic extraction - in production, use proper parsing
                const match = data.match(/export\s+const\s+\w+\s*=\s*({[\s\S]*?})\s*as\s+const;?/);
                if (match) {
                  parsed = JSON.parse(match[1]);
                } else {
                  throw new Error('Invalid TypeScript format');
                }
                break;
              default:
                throw new Error('Unsupported format');
            }
            
            set((state) => {
              if (parsed.schema) state.currentSchema = parsed.schema;
              if (parsed.values) {
                state.currentValues = parsed.values;
                state.formState.values = parsed.values;
                state.formState.dirty = true;
              }
            });
          } catch (error) {
            throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        
        // UI state
        setActiveMode: (mode) => {
          set((state) => {
            state.activeMode = mode;
          });
        },
        
        toggleSidebar: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          });
        },
        
        setSidebarCollapsed: (collapsed) => {
          set((state) => {
            state.sidebarCollapsed = collapsed;
          });
        },
        
        toggleValidationPanel: () => {
          set((state) => {
            state.showValidationPanel = !state.showValidationPanel;
          });
        },
        
        togglePreview: () => {
          set((state) => {
            state.showPreview = !state.showPreview;
          });
        },
        
        // Accessibility
        updateAccessibility: (updates) => {
          set((state) => {
            Object.assign(state.accessibility, updates);
          });
        },
        
        toggleHighContrast: () => {
          set((state) => {
            state.accessibility.highContrast = !state.accessibility.highContrast;
          });
        },
        
        toggleReducedMotion: () => {
          set((state) => {
            state.accessibility.reducedMotion = !state.accessibility.reducedMotion;
          });
        },
        
        // Performance
        recordPerformanceMetric: (metric) => {
          set((state) => {
            state.performanceMetrics.push(metric);
            // Keep only last 100 metrics
            if (state.performanceMetrics.length > 100) {
              state.performanceMetrics = state.performanceMetrics.slice(-100);
            }
          });
        },
        
        clearPerformanceMetrics: () => {
          set((state) => {
            state.performanceMetrics = [];
          });
        },
        
        // Preferences
        updatePreferences: (updates) => {
          set((state) => {
            Object.assign(state.preferences, updates);
          });
        },
        
        resetPreferences: () => {
          set((state) => {
            state.preferences = { ...initialState.preferences };
          });
        },
        
        // Utilities
        getFieldValue: (path: string) => {
          const state = get();
          return getNestedValue(state.currentValues, path);
        },
        
        validateConfiguration: async () => {
          // In production, this would use the validation engine
          return true;
        },
        
        isDirty: () => {
          const state = get();
          return state.formState.dirty;
        },
        
        canUndo: () => {
          // Placeholder - would implement with history management
          return false;
        },
        
        canRedo: () => {
          // Placeholder - would implement with history management
        },
        
        undo: () => {
          // Placeholder - would implement with history management
        },
        
        redo: () => {
          // Placeholder - would implement with history management
        },
        
        // Collaboration placeholders
        startCollaborationSession: async () => {},
        endCollaborationSession: () => {},
        applyCollaborationChange: () => {},
        rejectCollaborationChange: () => {},
      }))
    ),
    { name: 'configuration-store' }
  )
);

// Selectors for optimized subscriptions
export const useCurrentSchema = () => 
  useConfigurationStore(state => state.currentSchema);

export const useCurrentValues = () => 
  useConfigurationStore(state => state.currentValues);

export const useFormState = () => 
  useConfigurationStore(state => state.formState);

export const useTemplates = () => 
  useConfigurationStore(state => state.templates);

export const useActiveMode = () => 
  useConfigurationStore(state => state.activeMode);

export const useAccessibility = () => 
  useConfigurationStore(state => state.accessibility);

export const usePreferences = () => 
  useConfigurationStore(state => state.preferences);