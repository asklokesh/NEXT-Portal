'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Edit3,
  Tags,
  Users,
  GitBranch,
  Clock,
  Building2,
  Folder,
  BookOpen,
  Link,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  Upload,
  Download,
  FileCode,
  Search,
  Filter,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  ChevronRight,
  Loader2,
  Info,
  Wand2,
  Zap,
  Target,
  Package,
  Key,
  Globe,
  Code,
  Database,
  Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface BulkMetadataOperationsProps {
  entities: Entity[];
  selectedEntities: string[];
  onOperationComplete?: (results: BulkOperationResult) => void;
  onClose?: () => void;
  className?: string;
}

interface BulkOperationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{
    entityId: string;
    message: string;
  }>;
  changes: Array<{
    entityId: string;
    changes: Record<string, any>;
  }>;
}

interface MetadataChange {
  field: string;
  operation: 'set' | 'add' | 'remove' | 'replace' | 'append';
  value: any;
  path?: string;
}

interface OperationPreview {
  entityId: string;
  entityName: string;
  entityKind: string;
  currentValue: any;
  newValue: any;
  willChange: boolean;
}

const COMMON_TAGS = [
  'production',
  'staging',
  'development',
  'backend',
  'frontend',
  'database',
  'microservice',
  'api',
  'critical',
  'deprecated',
  'internal',
  'external',
  'public',
  'private',
  'experimental',
];

const LIFECYCLE_OPTIONS = [
  'production',
  'experimental',
  'deprecated',
  'development',
];

const METADATA_FIELDS = [
  { key: 'metadata.name', label: 'Name', type: 'text', category: 'basic' },
  { key: 'metadata.description', label: 'Description', type: 'textarea', category: 'basic' },
  { key: 'metadata.title', label: 'Title', type: 'text', category: 'basic' },
  { key: 'metadata.tags', label: 'Tags', type: 'tags', category: 'basic' },
  { key: 'metadata.labels', label: 'Labels', type: 'keyvalue', category: 'basic' },
  { key: 'metadata.annotations', label: 'Annotations', type: 'keyvalue', category: 'basic' },
  { key: 'metadata.links', label: 'Links', type: 'links', category: 'basic' },
  { key: 'spec.owner', label: 'Owner', type: 'text', category: 'ownership' },
  { key: 'spec.lifecycle', label: 'Lifecycle', type: 'select', category: 'ownership' },
  { key: 'spec.system', label: 'System', type: 'text', category: 'organization' },
  { key: 'spec.domain', label: 'Domain', type: 'text', category: 'organization' },
  { key: 'spec.type', label: 'Type', type: 'text', category: 'technical' },
  { key: 'spec.providesApis', label: 'Provides APIs', type: 'array', category: 'technical' },
  { key: 'spec.consumesApis', label: 'Consumes APIs', type: 'array', category: 'technical' },
  { key: 'spec.dependsOn', label: 'Depends On', type: 'array', category: 'technical' },
];

export function BulkMetadataOperations({
  entities,
  selectedEntities,
  onOperationComplete,
  onClose,
  className,
}: BulkMetadataOperationsProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced' | 'templates'>('quick');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [changes, setChanges] = useState<MetadataChange[]>([]);
  const [preview, setPreview] = useState<OperationPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [validationMode, setValidationMode] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  // Quick operation states
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [quickOwner, setQuickOwner] = useState('');
  const [quickLifecycle, setQuickLifecycle] = useState('');
  const [quickSystem, setQuickSystem] = useState('');
  const [quickDomain, setQuickDomain] = useState('');
  const [quickDescription, setQuickDescription] = useState('');
  const [customTag, setCustomTag] = useState('');

  // Advanced operation states
  const [advancedField, setAdvancedField] = useState('');
  const [advancedOperation, setAdvancedOperation] = useState<'set' | 'add' | 'remove' | 'replace' | 'append'>('set');
  const [advancedValue, setAdvancedValue] = useState('');
  const [advancedPath, setAdvancedPath] = useState('');

  // Template states
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateValues, setTemplateValues] = useState<Record<string, any>>({});

  // Get selected entities
  const selectedEntitiesData = useMemo(() => {
    return entities.filter(entity => {
      const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
      return selectedEntities.includes(entityId);
    });
  }, [entities, selectedEntities]);

  // Generate preview of changes
  const generatePreview = useCallback(() => {
    const previews: OperationPreview[] = [];

    selectedEntitiesData.forEach(entity => {
      const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
      
      // Quick operations preview
      if (activeTab === 'quick') {
        // Tags
        if (quickTags.length > 0) {
          const currentTags = entity.metadata.tags || [];
          const newTags = Array.from(new Set([...currentTags, ...quickTags]));
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: currentTags,
            newValue: newTags,
            willChange: JSON.stringify(currentTags) !== JSON.stringify(newTags),
          });
        }

        // Owner
        if (quickOwner) {
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: entity.spec?.owner || 'unowned',
            newValue: quickOwner,
            willChange: entity.spec?.owner !== quickOwner,
          });
        }

        // Lifecycle
        if (quickLifecycle) {
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: entity.spec?.lifecycle || 'unknown',
            newValue: quickLifecycle,
            willChange: entity.spec?.lifecycle !== quickLifecycle,
          });
        }

        // System
        if (quickSystem) {
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: entity.spec?.system || 'none',
            newValue: quickSystem,
            willChange: entity.spec?.system !== quickSystem,
          });
        }

        // Domain
        if (quickDomain) {
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: entity.spec?.domain || 'none',
            newValue: quickDomain,
            willChange: entity.spec?.domain !== quickDomain,
          });
        }

        // Description
        if (quickDescription) {
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue: entity.metadata.description || '',
            newValue: quickDescription,
            willChange: entity.metadata.description !== quickDescription,
          });
        }
      }

      // Advanced operations preview
      if (activeTab === 'advanced' && changes.length > 0) {
        changes.forEach(change => {
          const currentValue = getFieldValue(entity, change.field);
          const newValue = applyOperation(currentValue, change);
          
          previews.push({
            entityId,
            entityName: entity.metadata.name,
            entityKind: entity.kind,
            currentValue,
            newValue,
            willChange: JSON.stringify(currentValue) !== JSON.stringify(newValue),
          });
        });
      }
    });

    setPreview(previews);
    setShowPreview(true);
  }, [selectedEntitiesData, activeTab, quickTags, quickOwner, quickLifecycle, quickSystem, quickDomain, quickDescription, changes]);

  // Get field value from entity
  const getFieldValue = (entity: Entity, field: string): any => {
    const parts = field.split('.');
    let value: any = entity;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  };

  // Apply operation to value
  const applyOperation = (currentValue: any, change: MetadataChange): any => {
    switch (change.operation) {
      case 'set':
        return change.value;
      
      case 'add':
        if (Array.isArray(currentValue)) {
          return [...currentValue, change.value];
        } else if (typeof currentValue === 'object' && currentValue !== null) {
          return { ...currentValue, [change.path || 'newKey']: change.value };
        }
        return change.value;
      
      case 'remove':
        if (Array.isArray(currentValue)) {
          return currentValue.filter(v => v !== change.value);
        } else if (typeof currentValue === 'object' && currentValue !== null) {
          const { [change.path || change.value]: _, ...rest } = currentValue;
          return rest;
        }
        return currentValue;
      
      case 'replace':
        if (typeof currentValue === 'string') {
          return currentValue.replace(new RegExp(change.path || '', 'g'), change.value);
        }
        return change.value;
      
      case 'append':
        if (typeof currentValue === 'string') {
          return currentValue + change.value;
        } else if (Array.isArray(currentValue)) {
          return [...currentValue, ...change.value];
        }
        return change.value;
      
      default:
        return currentValue;
    }
  };

  // Execute bulk operation
  const executeBulkOperation = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    const results: BulkOperationResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      changes: [],
    };

    try {
      const totalEntities = selectedEntitiesData.length;
      
      for (let i = 0; i < totalEntities; i++) {
        const entity = selectedEntitiesData[i];
        const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
        
        setCurrentStep(`Processing ${entity.metadata.name} (${i + 1}/${totalEntities})`);
        setProgress((i / totalEntities) * 100);

        try {
          // Build changes for this entity
          const entityChanges: Record<string, any> = {};

          if (activeTab === 'quick') {
            if (quickTags.length > 0) {
              entityChanges['metadata.tags'] = Array.from(new Set([...(entity.metadata.tags || []), ...quickTags]));
            }
            if (quickOwner) entityChanges['spec.owner'] = quickOwner;
            if (quickLifecycle) entityChanges['spec.lifecycle'] = quickLifecycle;
            if (quickSystem) entityChanges['spec.system'] = quickSystem;
            if (quickDomain) entityChanges['spec.domain'] = quickDomain;
            if (quickDescription) entityChanges['metadata.description'] = quickDescription;
          } else if (activeTab === 'advanced') {
            changes.forEach(change => {
              const currentValue = getFieldValue(entity, change.field);
              entityChanges[change.field] = applyOperation(currentValue, change);
            });
          }

          // Skip if no changes
          if (Object.keys(entityChanges).length === 0) {
            results.skipped++;
            continue;
          }

          // Apply changes via API
          if (!dryRun) {
            const response = await fetch(`/api/catalog/entities/${encodeURIComponent(entityId)}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                changes: entityChanges,
                validate: validationMode,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Failed to update entity');
            }
          }

          results.success++;
          results.changes.push({
            entityId,
            changes: entityChanges,
          });
        } catch (error) {
          results.failed++;
          results.errors.push({
            entityId,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      setProgress(100);
      setCurrentStep('Operation complete');

      if (onOperationComplete) {
        onOperationComplete(results);
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add advanced change
  const addAdvancedChange = () => {
    if (advancedField && advancedValue) {
      setChanges([...changes, {
        field: advancedField,
        operation: advancedOperation,
        value: advancedValue,
        path: advancedPath,
      }]);
      
      // Reset form
      setAdvancedValue('');
      setAdvancedPath('');
    }
  };

  // Remove advanced change
  const removeAdvancedChange = (index: number) => {
    setChanges(changes.filter((_, i) => i !== index));
  };

  // Templates
  const templates = [
    {
      id: 'production-ready',
      name: 'Production Ready',
      description: 'Mark entities as production-ready with proper metadata',
      fields: ['lifecycle', 'owner', 'tags', 'description'],
      values: {
        lifecycle: 'production',
        tags: ['production', 'verified'],
      },
    },
    {
      id: 'deprecate',
      name: 'Deprecate Entities',
      description: 'Mark entities as deprecated with migration info',
      fields: ['lifecycle', 'tags', 'annotations'],
      values: {
        lifecycle: 'deprecated',
        tags: ['deprecated', 'migration-required'],
      },
    },
    {
      id: 'organize-by-domain',
      name: 'Organize by Domain',
      description: 'Assign entities to domains and systems',
      fields: ['domain', 'system', 'tags'],
      values: {},
    },
    {
      id: 'compliance-ready',
      name: 'Compliance Ready',
      description: 'Add compliance metadata and documentation',
      fields: ['annotations', 'links', 'tags'],
      values: {
        tags: ['compliant', 'audited'],
      },
    },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Bulk Metadata Operations
          </DialogTitle>
          <DialogDescription>
            Update metadata for {selectedEntities.length} selected entities
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick" className="gap-2">
                <Zap className="h-4 w-4" />
                Quick Actions
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Settings className="h-4 w-4" />
                Advanced
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <FileCode className="h-4 w-4" />
                Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4">
              {/* Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Tags
                  </CardTitle>
                  <CardDescription>Add tags to selected entities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TAGS.map(tag => (
                      <Badge
                        key={tag}
                        variant={quickTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (quickTags.includes(tag)) {
                            setQuickTags(quickTags.filter(t => t !== tag));
                          } else {
                            setQuickTags([...quickTags, tag]);
                          }
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && customTag) {
                          setQuickTags([...quickTags, customTag]);
                          setCustomTag('');
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (customTag) {
                          setQuickTags([...quickTags, customTag]);
                          setCustomTag('');
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {quickTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {quickTags.map(tag => (
                        <Badge
                          key={tag}
                          variant="default"
                          className="gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => setQuickTags(quickTags.filter(t => t !== tag))}
                            className="ml-1 hover:text-destructive"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ownership & Organization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Ownership & Organization
                  </CardTitle>
                  <CardDescription>Update ownership and organizational metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner">Owner</Label>
                      <Input
                        id="owner"
                        placeholder="team-name or user-name"
                        value={quickOwner}
                        onChange={(e) => setQuickOwner(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lifecycle">Lifecycle</Label>
                      <Select value={quickLifecycle} onValueChange={setQuickLifecycle}>
                        <SelectTrigger id="lifecycle">
                          <SelectValue placeholder="Select lifecycle" />
                        </SelectTrigger>
                        <SelectContent>
                          {LIFECYCLE_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="system">System</Label>
                      <Input
                        id="system"
                        placeholder="system-name"
                        value={quickSystem}
                        onChange={(e) => setQuickSystem(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        placeholder="domain-name"
                        value={quickDomain}
                        onChange={(e) => setQuickDomain(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Description
                  </CardTitle>
                  <CardDescription>Update entity descriptions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Enter a description for all selected entities..."
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Advanced Field Editor</CardTitle>
                  <CardDescription>
                    Add custom field modifications with precise control
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Path</Label>
                      <Select value={advancedField} onValueChange={setAdvancedField}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {METADATA_FIELDS.map(field => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label} ({field.key})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Operation</Label>
                      <Select value={advancedOperation} onValueChange={(v: any) => setAdvancedOperation(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="set">Set (Replace)</SelectItem>
                          <SelectItem value="add">Add</SelectItem>
                          <SelectItem value="remove">Remove</SelectItem>
                          <SelectItem value="replace">Replace Pattern</SelectItem>
                          <SelectItem value="append">Append</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Textarea
                      placeholder="Enter value (JSON for complex types)"
                      value={advancedValue}
                      onChange={(e) => setAdvancedValue(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  {(advancedOperation === 'replace' || advancedOperation === 'add') && (
                    <div className="space-y-2">
                      <Label>Path/Pattern</Label>
                      <Input
                        placeholder={advancedOperation === 'replace' ? 'Pattern to replace' : 'Key or path'}
                        value={advancedPath}
                        onChange={(e) => setAdvancedPath(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <Button onClick={addAdvancedChange} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Change
                  </Button>
                </CardContent>
              </Card>

              {changes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Planned Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {changes.map((change, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{change.field}</div>
                            <div className="text-sm text-muted-foreground">
                              {change.operation} → {JSON.stringify(change.value)}
                              {change.path && ` (${change.path})`}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAdvancedChange(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <Card
                    key={template.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedTemplate === template.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {template.fields.map(field => (
                          <Badge key={field} variant="secondary" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedTemplate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configure Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Template configuration will be available in the next update
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operation Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="validation">Validation Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Validate changes before applying
                  </div>
                </div>
                <Switch
                  id="validation"
                  checked={validationMode}
                  onCheckedChange={setValidationMode}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dryrun">Dry Run</Label>
                  <div className="text-sm text-muted-foreground">
                    Preview changes without applying
                  </div>
                </div>
                <Switch
                  id="dryrun"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={generatePreview}
            disabled={isProcessing}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Changes
          </Button>
          <Button
            onClick={executeBulkOperation}
            disabled={isProcessing || (!quickTags.length && !quickOwner && !quickLifecycle && !quickSystem && !quickDomain && !quickDescription && !changes.length)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Apply Changes {dryRun && '(Dry Run)'}
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Progress */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {currentStep}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview Dialog */}
        {showPreview && (
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Preview Changes</DialogTitle>
                <DialogDescription>
                  Review the changes that will be applied to {preview.length} entities
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.filter(p => p.willChange).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.entityName}</div>
                            <div className="text-xs text-muted-foreground">{item.entityKind}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {activeTab === 'quick' ? getQuickFieldName(item) : 'Custom'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(item.currentValue)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(item.newValue)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Will change
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );

  function getQuickFieldName(item: OperationPreview): string {
    if (Array.isArray(item.currentValue) && Array.isArray(item.newValue)) {
      return 'Tags';
    }
    if (quickOwner && item.newValue === quickOwner) return 'Owner';
    if (quickLifecycle && item.newValue === quickLifecycle) return 'Lifecycle';
    if (quickSystem && item.newValue === quickSystem) return 'System';
    if (quickDomain && item.newValue === quickDomain) return 'Domain';
    if (quickDescription && item.newValue === quickDescription) return 'Description';
    return 'Unknown';
  }
}