'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, 
  Settings, 
  Eye, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Type, 
  Hash, 
  ToggleLeft, 
  List, 
  Calendar, 
  Code, 
  Link, 
  Mail,
  GripVertical,
  Edit3
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

import { 
  MetadataSchema, 
  FieldDefinition, 
  FieldType, 
  ValidationRule,
  ConditionalRule,
  metadataSchemaManager 
} from '@/lib/metadata/MetadataSchemaManager';

// Field type configurations
const FIELD_TYPES: Array<{
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultProps: Partial<FieldDefinition>;
}> = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    description: 'Single line text input',
    defaultProps: { placeholder: 'Enter text...' }
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    description: 'Numeric input',
    defaultProps: { placeholder: '0' }
  },
  {
    type: 'boolean',
    label: 'Boolean',
    icon: ToggleLeft,
    description: 'True/false toggle',
    defaultProps: {}
  },
  {
    type: 'select',
    label: 'Select',
    icon: List,
    description: 'Single selection dropdown',
    defaultProps: { options: [{ label: 'Option 1', value: 'option1' }] }
  },
  {
    type: 'multi-select',
    label: 'Multi-Select',
    icon: List,
    description: 'Multiple selection dropdown',
    defaultProps: { options: [{ label: 'Option 1', value: 'option1' }] }
  },
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
    defaultProps: {}
  },
  {
    type: 'json',
    label: 'JSON',
    icon: Code,
    description: 'JSON object editor',
    defaultProps: { placeholder: '{}' }
  },
  {
    type: 'url',
    label: 'URL',
    icon: Link,
    description: 'URL input with validation',
    defaultProps: { placeholder: 'https://example.com' }
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email input with validation',
    defaultProps: { placeholder: 'user@example.com' }
  }
];

// Form schema for metadata schema creation
const metadataSchemaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  entityKind: z.string().optional(),
  version: z.string().min(1, 'Version is required'),
});

// Field configuration schema
const fieldConfigSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
});

interface MetadataFormBuilderProps {
  schema?: MetadataSchema;
  onSave?: (schema: MetadataSchema) => void;
  onCancel?: () => void;
}

interface DraggableFieldProps {
  field: FieldDefinition;
  isActive?: boolean;
  onEdit: (field: FieldDefinition) => void;
  onDelete: (fieldId: string) => void;
  onDuplicate: (field: FieldDefinition) => void;
}

// Draggable field component
function DraggableField({ field, isActive, onEdit, onDelete, onDuplicate }: DraggableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fieldTypeConfig = FIELD_TYPES.find(ft => ft.type === field.type);
  const Icon = fieldTypeConfig?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white border rounded-lg p-4 hover:border-blue-300 ${
        isActive ? 'border-blue-500 shadow-md' : 'border-gray-200'
      } ${isDragging ? 'z-50' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <Icon className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {field.label}
              </h4>
              {field.required && (
                <Badge variant="secondary" className="text-xs">Required</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {field.description || `${fieldTypeConfig?.description || field.type} field`}
            </p>
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
              <span>Type: {field.type}</span>
              <span>Name: {field.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(field)}
            className="h-8 w-8 p-0"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(field)}
            className="h-8 w-8 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(field.id)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Field palette component
function FieldPalette({ onAddField }: { onAddField: (type: FieldType) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-900">Field Types</h3>
      <div className="grid grid-cols-1 gap-2">
        {FIELD_TYPES.map(fieldType => {
          const Icon = fieldType.icon;
          return (
            <Button
              key={fieldType.type}
              variant="outline"
              className="justify-start h-auto p-3 text-left"
              onClick={() => onAddField(fieldType.type)}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm font-medium">{fieldType.label}</div>
                  <div className="text-xs text-gray-500">{fieldType.description}</div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Field configuration modal
function FieldConfigModal({ 
  field, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  field: FieldDefinition | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (field: FieldDefinition) => void;
}) {
  const form = useForm({
    resolver: zodResolver(fieldConfigSchema),
    defaultValues: {
      name: '',
      label: '',
      description: '',
      placeholder: '',
      required: false,
      defaultValue: '',
    }
  });

  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    if (field) {
      form.reset({
        name: field.name,
        label: field.label,
        description: field.description || '',
        placeholder: field.placeholder || '',
        required: field.required || false,
        defaultValue: field.defaultValue || '',
      });
      setValidationRules(field.validation || []);
      setOptions(field.options || []);
    }
  }, [field, form]);

  const onSubmit = (data: any) => {
    if (!field) return;

    const updatedField: FieldDefinition = {
      ...field,
      ...data,
      validation: validationRules,
      options: (field.type === 'select' || field.type === 'multi-select') ? options : undefined,
    };

    onSave(updatedField);
    onOpenChange(false);
  };

  const addValidationRule = () => {
    setValidationRules([...validationRules, { type: 'required', message: '' }]);
  };

  const updateValidationRule = (index: number, updates: Partial<ValidationRule>) => {
    const newRules = [...validationRules];
    newRules[index] = { ...newRules[index], ...updates };
    setValidationRules(newRules);
  };

  const removeValidationRule = (index: number) => {
    setValidationRules(validationRules.filter((_, i) => i !== index));
  };

  const addOption = () => {
    setOptions([...options, { label: '', value: '' }]);
  };

  const updateOption = (index: number, updates: Partial<{ label: string; value: string }>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Configure Field: {field.label}</DialogTitle>
          <DialogDescription>
            Configure properties, validation, and behavior for this field.
          </DialogDescription>
        </DialogHeader>
        
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="validation">Validation</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Field Name</Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="fieldName"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-500 mt-1">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="label">Display Label</Label>
                      <Input
                        id="label"
                        {...form.register('label')}
                        placeholder="Field Label"
                      />
                      {form.formState.errors.label && (
                        <p className="text-sm text-red-500 mt-1">
                          {form.formState.errors.label.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      placeholder="Field description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="placeholder">Placeholder</Label>
                    <Input
                      id="placeholder"
                      {...form.register('placeholder')}
                      placeholder="Enter placeholder text..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="required"
                      checked={form.watch('required')}
                      onCheckedChange={(checked) => form.setValue('required', !!checked)}
                    />
                    <Label htmlFor="required">Required field</Label>
                  </div>

                  {(field.type === 'select' || field.type === 'multi-select') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Options</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addOption}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Option
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              placeholder="Label"
                              value={option.label}
                              onChange={(e) => updateOption(index, { label: e.target.value })}
                            />
                            <Input
                              placeholder="Value"
                              value={option.value}
                              onChange={(e) => updateOption(index, { value: e.target.value })}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeOption(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="validation" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Validation Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addValidationRule}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {validationRules.map((rule, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className="flex-1 space-y-2">
                            <Select
                              value={rule.type}
                              onValueChange={(value) => updateValidationRule(index, { type: value as ValidationRule['type'] })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="required">Required</SelectItem>
                                <SelectItem value="pattern">Pattern</SelectItem>
                                <SelectItem value="min">Minimum</SelectItem>
                                <SelectItem value="max">Maximum</SelectItem>
                                <SelectItem value="minLength">Min Length</SelectItem>
                                <SelectItem value="maxLength">Max Length</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {rule.type !== 'required' && (
                              <Input
                                placeholder="Value"
                                value={rule.value || ''}
                                onChange={(e) => updateValidationRule(index, { value: e.target.value })}
                              />
                            )}
                            
                            <Input
                              placeholder="Error message"
                              value={rule.message || ''}
                              onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                            />
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeValidationRule(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <Alert>
                    <AlertDescription>
                      Advanced features like conditional visibility and Backstage mapping will be implemented in future versions.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </ScrollArea>
            
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Field</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

// Preview component
function SchemaPreview({ schema }: { schema: MetadataSchema }) {
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const handlePreviewChange = (fieldName: string, value: any) => {
    setPreviewData(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Form Preview</h3>
      <Card>
        <CardHeader>
          <CardTitle>{schema.name}</CardTitle>
          {schema.description && (
            <p className="text-sm text-gray-600">{schema.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {schema.fields.map(field => (
            <div key={field.id}>
              <Label htmlFor={`preview-${field.id}`}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {field.description && (
                <p className="text-xs text-gray-500 mb-2">{field.description}</p>
              )}
              
              {field.type === 'text' && (
                <Input
                  id={`preview-${field.id}`}
                  placeholder={field.placeholder}
                  value={previewData[field.name] || ''}
                  onChange={(e) => handlePreviewChange(field.name, e.target.value)}
                />
              )}
              
              {field.type === 'number' && (
                <Input
                  id={`preview-${field.id}`}
                  type="number"
                  placeholder={field.placeholder}
                  value={previewData[field.name] || ''}
                  onChange={(e) => handlePreviewChange(field.name, Number(e.target.value))}
                />
              )}
              
              {field.type === 'boolean' && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`preview-${field.id}`}
                    checked={previewData[field.name] || false}
                    onCheckedChange={(checked) => handlePreviewChange(field.name, checked)}
                  />
                  <Label htmlFor={`preview-${field.id}`}>Enable</Label>
                </div>
              )}
              
              {field.type === 'select' && field.options && (
                <Select
                  value={previewData[field.name] || ''}
                  onValueChange={(value) => handlePreviewChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || 'Select an option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {field.type === 'textarea' && (
                <Textarea
                  id={`preview-${field.id}`}
                  placeholder={field.placeholder}
                  value={previewData[field.name] || ''}
                  onChange={(e) => handlePreviewChange(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Main component
export default function MetadataFormBuilder({ schema, onSave, onCancel }: MetadataFormBuilderProps) {
  const [currentSchema, setCurrentSchema] = useState<MetadataSchema>(
    schema || {
      id: '',
      name: 'New Schema',
      version: '1.0.0',
      fields: [],
      created: new Date(),
      updated: new Date(),
      createdBy: 'current-user',
      active: true,
    }
  );

  const [activeField, setActiveField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [mode, setMode] = useState<'design' | 'preview'>('design');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm({
    resolver: zodResolver(metadataSchemaSchema),
    defaultValues: {
      name: currentSchema.name,
      description: currentSchema.description || '',
      entityKind: currentSchema.entityKind || 'Component',
      version: currentSchema.version,
    }
  });

  const generateFieldId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const addField = useCallback((type: FieldType) => {
    const fieldTypeConfig = FIELD_TYPES.find(ft => ft.type === type);
    const newField: FieldDefinition = {
      id: generateFieldId(),
      name: `field_${currentSchema.fields.length + 1}`,
      label: `${fieldTypeConfig?.label || type} Field`,
      type,
      position: { x: 0, y: 0, width: 12, height: 1 },
      ...fieldTypeConfig?.defaultProps,
    };

    setCurrentSchema(prev => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  }, [currentSchema.fields.length]);

  const updateField = useCallback((updatedField: FieldDefinition) => {
    setCurrentSchema(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === updatedField.id ? updatedField : field
      ),
    }));
  }, []);

  const deleteField = useCallback((fieldId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId),
    }));
    if (activeField === fieldId) {
      setActiveField(null);
    }
  }, [activeField]);

  const duplicateField = useCallback((field: FieldDefinition) => {
    const duplicatedField: FieldDefinition = {
      ...field,
      id: generateFieldId(),
      name: `${field.name}_copy`,
      label: `${field.label} Copy`,
    };

    setCurrentSchema(prev => ({
      ...prev,
      fields: [...prev.fields, duplicatedField],
    }));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCurrentSchema(prev => {
        const oldIndex = prev.fields.findIndex(field => field.id === active.id);
        const newIndex = prev.fields.findIndex(field => field.id === over.id);

        return {
          ...prev,
          fields: arrayMove(prev.fields, oldIndex, newIndex),
        };
      });
    }
  };

  const handleSave = async () => {
    const formData = form.getValues();
    const schemaToSave: MetadataSchema = {
      ...currentSchema,
      ...formData,
      updated: new Date(),
    };

    try {
      const savedSchema = schema
        ? await metadataSchemaManager.updateSchema(schema.id, schemaToSave)
        : await metadataSchemaManager.createSchema(schemaToSave);
      
      onSave?.(savedSchema);
    } catch (error) {
      console.error('Failed to save schema:', error);
    }
  };

  const exportSchema = () => {
    const schemaJson = metadataSchemaManager.exportSchema(currentSchema.id);
    const blob = new Blob([schemaJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSchema.name.replace(/\s+/g, '_')}_schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Metadata Form Builder</h1>
            <p className="text-gray-600">Design custom metadata fields for your entities</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Tabs value={mode} onValueChange={(value) => setMode(value as 'design' | 'preview')}>
              <TabsList>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button variant="outline" onClick={exportSchema}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Schema
            </Button>
            
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
        
        {/* Schema configuration */}
        <div className="mt-4">
          <FormProvider {...form}>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="name">Schema Name</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  onChange={(e) => {
                    form.setValue('name', e.target.value);
                    setCurrentSchema(prev => ({ ...prev, name: e.target.value }));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  {...form.register('version')}
                  onChange={(e) => {
                    form.setValue('version', e.target.value);
                    setCurrentSchema(prev => ({ ...prev, version: e.target.value }));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="entityKind">Entity Kind</Label>
                <Select
                  value={form.watch('entityKind')}
                  onValueChange={(value) => {
                    form.setValue('entityKind', value);
                    setCurrentSchema(prev => ({ ...prev, entityKind: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Component">Component</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="Resource">Resource</SelectItem>
                    <SelectItem value="System">System</SelectItem>
                    <SelectItem value="Domain">Domain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...form.register('description')}
                  placeholder="Schema description..."
                  onChange={(e) => {
                    form.setValue('description', e.target.value);
                    setCurrentSchema(prev => ({ ...prev, description: e.target.value }));
                  }}
                />
              </div>
            </div>
          </FormProvider>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {mode === 'design' && (
          <>
            {/* Field palette */}
            <div className="w-80 border-r p-4 overflow-y-auto">
              <FieldPalette onAddField={addField} />
            </div>

            {/* Canvas */}
            <div className="flex-1 p-4 overflow-y-auto">
              <DndContext
                sensors={sensors}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={currentSchema.fields.map(f => f.id)}>
                  <div className="space-y-4">
                    {currentSchema.fields.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                        <Type className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No fields yet</h3>
                        <p className="text-gray-500">Add fields from the palette on the left to get started.</p>
                      </div>
                    ) : (
                      currentSchema.fields.map(field => (
                        <DraggableField
                          key={field.id}
                          field={field}
                          isActive={activeField === field.id}
                          onEdit={(field) => {
                            setEditingField(field);
                            setIsConfigModalOpen(true);
                          }}
                          onDelete={deleteField}
                          onDuplicate={duplicateField}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </>
        )}

        {mode === 'preview' && (
          <div className="flex-1 p-4 overflow-y-auto">
            <SchemaPreview schema={currentSchema} />
          </div>
        )}
      </div>

      {/* Field configuration modal */}
      <FieldConfigModal
        field={editingField}
        open={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        onSave={updateField}
      />
    </div>
  );
}