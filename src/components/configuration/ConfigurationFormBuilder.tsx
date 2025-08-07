'use client';

import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Wand2, 
  Code, 
  Eye, 
  Save, 
  Share2,
  History,
  Palette,
  Accessibility,
  Zap,
  FileText,
  Menu,
  X
} from 'lucide-react';

import type { 
  ConfigurationSchema, 
  WizardConfiguration,
  ConfigurationTemplate 
} from './types/schema';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfigurationStore, useAccessibility, usePreferences } from './store/configurationStore';
import { cn } from '@/lib/utils';

// Lazy load components for better performance
const SchemaToFormEngine = lazy(() => import('./engine/SchemaToFormEngine'));
const ConfigurationWizard = lazy(() => import('./wizard/ConfigurationWizard'));
const BackstageIntegration = lazy(() => import('./integration/BackstageIntegration'));

interface ConfigurationFormBuilderProps {
  className?: string;
  onSave?: (values: Record<string, any>) => void | Promise<void>;
  onExport?: (format: 'json' | 'yaml' | 'typescript') => void;
  showBackstageIntegration?: boolean;
  allowModeSwitch?: boolean;
}

// Performance monitoring hook
const usePerformanceMonitoring = () => {
  const { recordPerformanceMetric } = useConfigurationStore();

  return useCallback((operation: string, startTime: number) => {
    const endTime = performance.now();
    recordPerformanceMetric({
      renderTime: endTime - startTime,
      validationTime: 0,
      fieldCount: 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      reRenderCount: 0,
      asyncValidationCount: 0,
      timestamp: new Date(),
    });
  }, [recordPerformanceMetric]);
};

// Accessibility status component
const AccessibilityStatus: React.FC = () => {
  const accessibility = useAccessibility();
  const { toggleHighContrast, toggleReducedMotion } = useConfigurationStore();

  const activeFeatures = [
    accessibility.highContrast && 'High Contrast',
    accessibility.reducedMotion && 'Reduced Motion',
    accessibility.screenReaderOptimized && 'Screen Reader',
    accessibility.keyboardNavigation && 'Keyboard Navigation',
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Accessibility className="w-4 h-4" />
        <span className="text-sm font-medium">Accessibility</span>
        <Badge variant="outline" className="text-xs">
          {activeFeatures.length} active
        </Badge>
      </div>
      
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleHighContrast}
          className={cn(
            'w-full justify-start text-xs',
            accessibility.highContrast && 'bg-accent'
          )}
        >
          High Contrast
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={toggleReducedMotion}
          className={cn(
            'w-full justify-start text-xs',
            accessibility.reducedMotion && 'bg-accent'
          )}
        >
          Reduced Motion
        </Button>
      </div>
    </div>
  );
};

// Quick actions component
const QuickActions: React.FC<{
  onSave: () => void;
  onExport: (format: 'json' | 'yaml' | 'typescript') => void;
  canSave: boolean;
}> = ({ onSave, onExport, canSave }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Quick Actions</h4>
      
      <div className="grid grid-cols-1 gap-2">
        <Button size="sm" onClick={onSave} disabled={!canSave}>
          <Save className="w-3 h-3 mr-2" />
          Save
        </Button>
        
        <Button variant="outline" size="sm" onClick={() => onExport('json')}>
          <FileText className="w-3 h-3 mr-2" />
          Export JSON
        </Button>
        
        <Button variant="outline" size="sm" onClick={() => onExport('yaml')}>
          <Code className="w-3 h-3 mr-2" />
          Export YAML
        </Button>
        
        <Button variant="outline" size="sm" onClick={() => onExport('typescript')}>
          <Zap className="w-3 h-3 mr-2" />
          Export TS
        </Button>
      </div>
    </div>
  );
};

// Loading skeleton component
const FormSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="space-y-2">
      <div className="h-4 bg-muted rounded w-1/4"></div>
      <div className="h-10 bg-muted rounded"></div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-muted rounded w-1/3"></div>
      <div className="h-20 bg-muted rounded"></div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-muted rounded w-1/5"></div>
      <div className="h-10 bg-muted rounded"></div>
    </div>
  </div>
);

export const ConfigurationFormBuilder: React.FC<ConfigurationFormBuilderProps> = ({
  className = '',
  onSave,
  onExport,
  showBackstageIntegration = true,
  allowModeSwitch = true
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const recordPerformance = usePerformanceMonitoring();
  
  // Store state
  const {
    currentSchema,
    currentValues,
    formState,
    activeMode,
    sidebarCollapsed,
    showValidationPanel,
    setActiveMode,
    setSchema,
    setValues,
    exportConfiguration,
    isDirty
  } = useConfigurationStore();

  const accessibility = useAccessibility();
  const preferences = usePreferences();

  // Sample wizard configuration
  const wizardConfig: WizardConfiguration = useMemo(() => ({
    steps: [
      {
        id: 'basic',
        name: 'Basic Info',
        title: 'Basic Information',
        description: 'Configure basic application settings',
        fields: ['app.title', 'app.baseUrl'],
        validation: 'errors',
        estimatedTime: 2,
      },
      {
        id: 'backend',
        name: 'Backend',
        title: 'Backend Configuration',
        description: 'Configure backend service settings',
        fields: ['backend.baseUrl', 'backend.listen.port'],
        validation: 'warnings',
        estimatedTime: 3,
      },
      {
        id: 'catalog',
        name: 'Catalog',
        title: 'Catalog Setup',
        description: 'Configure software catalog',
        fields: ['catalog.locations'],
        validation: 'warnings',
        optional: true,
        estimatedTime: 5,
      },
    ],
    navigation: {
      allowSkip: true,
      allowBack: true,
      showProgress: true,
      showStepNumbers: true,
      confirmExit: true,
    },
    layout: {
      theme: 'default',
      sidebar: true,
      breadcrumbs: true,
    },
  }), []);

  // Sample templates
  const templates: ConfigurationTemplate[] = useMemo(() => [
    {
      id: 'basic-app',
      name: 'Basic Application',
      description: 'Simple application configuration',
      category: 'Getting Started',
      tags: ['basic', 'app'],
      schema: {} as ConfigurationSchema,
      defaultValues: {
        app: { title: 'My App', baseUrl: 'http://localhost:3000' },
      },
      author: 'System',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      featured: true,
    },
  ], []);

  // Handle form submission
  const handleSave = useCallback(async (values: Record<string, any>) => {
    const startTime = performance.now();
    
    try {
      await onSave?.(values);
      recordPerformance('save', startTime);
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [onSave, recordPerformance]);

  // Handle export
  const handleExport = useCallback((format: 'json' | 'yaml' | 'typescript') => {
    const startTime = performance.now();
    
    try {
      if (onExport) {
        onExport(format);
      } else {
        const content = exportConfiguration(format);
        console.log(`Exported ${format}:`, content);
      }
      recordPerformance('export', startTime);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [onExport, exportConfiguration, recordPerformance]);

  // Handle schema generation from Backstage
  const handleSchemaGenerated = useCallback((schema: ConfigurationSchema) => {
    setSchema(schema);
  }, [setSchema]);

  const handleValuesGenerated = useCallback((values: Record<string, any>) => {
    setValues(values);
  }, [setValues]);

  // Sidebar content
  const sidebarContent = (
    <div className="space-y-6">
      <AccessibilityStatus />
      
      <Separator />
      
      <QuickActions
        onSave={() => handleSave(currentValues)}
        onExport={handleExport}
        canSave={isDirty() && formState.valid}
      />
      
      {formState.dirty && (
        <>
          <Separator />
          <Alert>
            <AlertDescription className="text-xs">
              You have unsaved changes
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );

  // Apply accessibility settings
  const containerClasses = cn(
    'configuration-form-builder h-full flex flex-col bg-background',
    accessibility.highContrast && 'high-contrast',
    accessibility.reducedMotion && 'reduce-motion',
    preferences.compactMode && 'compact-mode',
    className
  );

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Configuration Tools</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  {sidebarContent}
                </div>
              </SheetContent>
            </Sheet>
            
            <h1 className="text-xl font-semibold">Configuration Builder</h1>
            
            {formState.validating && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Validating...</span>
              </div>
            )}
          </div>

          {allowModeSwitch && (
            <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="form" className="flex items-center gap-1">
                  <Settings className="w-3 h-3" />
                  <span className="hidden sm:inline">Form</span>
                </TabsTrigger>
                <TabsTrigger value="wizard" className="flex items-center gap-1">
                  <Wand2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Wizard</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  <span className="hidden sm:inline">Code</span>
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span className="hidden sm:inline">Preview</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block w-80 border-r border-border p-4 overflow-auto">
          {sidebarContent}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {!currentSchema ? (
            // No schema - show Backstage integration
            showBackstageIntegration ? (
              <div className="p-6">
                <Suspense fallback={<FormSkeleton />}>
                  <BackstageIntegration
                    onSchemaGenerated={handleSchemaGenerated}
                    onValuesGenerated={handleValuesGenerated}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <Settings className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h2 className="text-lg font-semibold">No Configuration Schema</h2>
                  <p className="text-muted-foreground max-w-md">
                    Load a configuration schema or use the Backstage integration to get started.
                  </p>
                </div>
              </div>
            )
          ) : (
            // Schema available - show appropriate form
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeMode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: accessibility.reducedMotion ? 0.1 : 0.3,
                    ease: 'easeInOut'
                  }}
                >
                  <Suspense fallback={<FormSkeleton />}>
                    {activeMode === 'wizard' ? (
                      <ConfigurationWizard
                        schema={currentSchema}
                        wizardConfig={wizardConfig}
                        templates={templates}
                        initialValues={currentValues}
                        onComplete={handleSave}
                        onSave={(values) => handleSave(values)}
                        showPreview={true}
                      />
                    ) : activeMode === 'code' ? (
                      <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Configuration Code</h2>
                        <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm font-mono">
                          {JSON.stringify({ schema: currentSchema, values: currentValues }, null, 2)}
                        </pre>
                      </div>
                    ) : activeMode === 'preview' ? (
                      <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Configuration Preview</h2>
                        <Card>
                          <CardHeader>
                            <CardTitle>Generated Configuration</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-sm font-mono whitespace-pre-wrap">
                              {JSON.stringify(currentValues, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <SchemaToFormEngine
                        schema={currentSchema}
                        initialValues={currentValues}
                        onSubmit={handleSave}
                        onChange={(values) => setValues(values)}
                        mode="form"
                      />
                    )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {currentSchema && (
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Mode: {activeMode}</span>
              <span>
                Fields: {Object.keys(currentSchema.properties || {}).length}
              </span>
              {formState.dirty && (
                <Badge variant="outline" className="text-xs">
                  Unsaved changes
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <span>
                {formState.valid ? 'Valid' : 'Invalid'}
              </span>
              <span>Last saved: Never</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationFormBuilder;