'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider, useFormContext, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  Code,
  Upload,
  Download,
  Copy,
  Trash2,
  Plus,
  Edit3,
  X
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

import {
  MetadataSchema,
  FieldDefinition,
  metadataSchemaManager,
  FieldTypeRegistry
} from '@/lib/metadata/MetadataSchemaManager';

interface CustomMetadataEditorProps {
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  schemaId?: string;
  initialData?: Record<string, any>;
  onSave?: (data: Record<string, any>, backstageYaml?: any) => void;
  onCancel?: () => void;
  mode?: 'edit' | 'create' | 'bulk';
  bulkEntities?: Array<{ id: string; name: string; data?: Record<string, any> }>;
}

interface FieldRendererProps {
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

// Field renderer component
function FieldRenderer({ field, value, onChange, error, disabled }: FieldRendererProps) {
  const [isJsonValid, setIsJsonValid] = useState(true);

  const handleJsonChange = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      setIsJsonValid(true);
      onChange(parsed);
    } catch (error) {
      setIsJsonValid(false);
      onChange(text);
    }
  };

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value || false}
              onCheckedChange={onChange}
              disabled={disabled}
            />
            <Label>{value ? 'Yes' : 'No'}</Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi-select':
        const multiValue = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.options?.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={multiValue.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...multiValue, option.value]);
                    } else {
                      onChange(multiValue.filter(v => v !== option.value));
                    }
                  }}
                  disabled={disabled}
                />
                <Label>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${error ? 'border-red-500' : ''}`}
                disabled={disabled}
              >
                {value ? format(new Date(value), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => onChange(date?.toISOString())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case 'json':
        const jsonValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value || '{}';
        return (
          <div className="space-y-2">
            <Textarea
              value={jsonValue}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder={field.placeholder || '{}'}
              disabled={disabled}
              className={`font-mono ${error || !isJsonValid ? 'border-red-500' : ''}`}
              rows={6}
            />
            {!isJsonValid && (
              <p className="text-sm text-red-500">Invalid JSON format</p>
            )}
          </div>
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'https://example.com'}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'user@example.com'}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`field-${field.id}`}>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.description && (
          <div className="text-xs text-gray-500 max-w-xs text-right">
            {field.description}
          </div>
        )}
      </div>
      
      {renderField()}
      
      {error && (
        <p className="text-sm text-red-500 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}
    </div>
  );
}

// Bulk edit component
function BulkMetadataEditor({ 
  schema, 
  entities, 
  onSave, 
  onCancel 
}: { 
  schema: MetadataSchema; 
  entities: Array<{ id: string; name: string; data?: Record<string, any> }>; 
  onSave: (updates: Array<{ id: string; data: Record<string, any> }>) => void;
  onCancel: () => void;
}) {
  const [selectedEntities, setSelectedEntities] = useState<string[]>(entities.map(e => e.id));
  const [commonData, setCommonData] = useState<Record<string, any>>({});
  const [fieldsToUpdate, setFieldsToUpdate] = useState<Set<string>>(new Set());

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    const newFieldsToUpdate = new Set(fieldsToUpdate);
    if (checked) {
      newFieldsToUpdate.add(fieldName);
    } else {
      newFieldsToUpdate.delete(fieldName);
    }
    setFieldsToUpdate(newFieldsToUpdate);
  };

  const handleSave = () => {
    const updates = selectedEntities.map(entityId => ({
      id: entityId,
      data: Object.fromEntries(
        Object.entries(commonData).filter(([key]) => fieldsToUpdate.has(key))
      ),
    }));
    onSave(updates);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Bulk Edit Metadata</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select entities and fields to update. Changes will be applied to all selected entities.
        </p>
      </div>

      {/* Entity selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Entities ({selectedEntities.length} selected)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                checked={selectedEntities.length === entities.length}
                onCheckedChange={(checked) => {
                  setSelectedEntities(checked ? entities.map(e => e.id) : []);
                }}
              />
              <Label className="font-medium">Select All</Label>
            </div>
            {entities.map(entity => (
              <div key={entity.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedEntities.includes(entity.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEntities([...selectedEntities, entity.id]);
                    } else {
                      setSelectedEntities(selectedEntities.filter(id => id !== entity.id));
                    }
                  }}
                />
                <Label>{entity.name}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field updates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fields to Update</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schema.fields.map(field => (
            <div key={field.id} className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={fieldsToUpdate.has(field.name)}
                  onCheckedChange={(checked) => handleFieldToggle(field.name, !!checked)}
                />
                <Label className="font-medium">{field.label}</Label>
                {field.required && <Badge variant="secondary">Required</Badge>}
              </div>
              
              {fieldsToUpdate.has(field.name) && (
                <div className="ml-6">
                  <FieldRenderer
                    field={field}
                    value={commonData[field.name]}
                    onChange={(value) => setCommonData(prev => ({ ...prev, [field.name]: value }))}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={selectedEntities.length === 0 || fieldsToUpdate.size === 0}
        >
          Update {selectedEntities.length} Entities
        </Button>
      </div>
    </div>
  );
}

// Main component
export default function CustomMetadataEditor({
  entityId,
  entityName,
  entityKind,
  schemaId,
  initialData = {},
  onSave,
  onCancel,
  mode = 'edit',
  bulkEntities = []
}: CustomMetadataEditorProps) {
  const [schema, setSchema] = useState<MetadataSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [validationResults, setValidationResults] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [showBackstageYaml, setShowBackstageYaml] = useState(false);
  const [backstageYaml, setBackstageYaml] = useState<any>(null);

  // Load schema
  useEffect(() => {
    const loadSchema = async () => {
      setLoading(true);
      try {
        let targetSchema: MetadataSchema | undefined;

        if (schemaId) {
          targetSchema = metadataSchemaManager.getSchema(schemaId);
        } else if (entityKind) {
          const schemas = metadataSchemaManager.getSchemasByEntityKind(entityKind);
          targetSchema = schemas[0]; // Use first available schema for this entity kind
        }

        if (!targetSchema) {
          // Create a default schema if none exists
          targetSchema = await metadataSchemaManager.createSchema({
            name: `${entityKind || 'Entity'} Metadata`,
            version: '1.0.0',
            entityKind: entityKind || 'Component',
            fields: [],
            createdBy: 'system',
            active: true,
          });
        }

        setSchema(targetSchema);
        
        // Initialize form data with defaults
        const defaultData = { ...initialData };
        targetSchema.fields.forEach(field => {
          if (!(field.name in defaultData) && field.defaultValue !== undefined) {
            defaultData[field.name] = field.defaultValue;
          }
        });
        setFormData(defaultData);

      } catch (error) {
        console.error('Failed to load schema:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [schemaId, entityKind, initialData]);

  // Validate data when form changes
  useEffect(() => {
    if (schema) {
      const results = metadataSchemaManager.validateData(schema.id, formData);
      setValidationResults(results);
      
      // Convert validation errors to field-specific errors
      const fieldErrors: Record<string, string> = {};
      results.errors.forEach(error => {
        // Extract field name from error message (simple approach)
        const fieldMatch = error.match(/Field '([^']+)'/);
        if (fieldMatch && fieldMatch[1]) {
          fieldErrors[fieldMatch[1]] = error;
        }
      });
      setErrors(fieldErrors);

      // Generate Backstage YAML preview
      try {
        const yaml = metadataSchemaManager.generateBackstageYaml(schema.id, formData);
        setBackstageYaml(yaml);
      } catch (error) {
        console.error('Failed to generate Backstage YAML:', error);
      }
    }
  }, [schema, formData]);

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear field-specific error
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  const handleSave = async () => {
    if (!schema || !validationResults?.valid) {
      return;
    }

    setSaving(true);
    try {
      await onSave?.(formData, backstageYaml);
    } catch (error) {
      console.error('Failed to save metadata:', error);
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    const dataToExport = {
      entityId,
      entityName,
      entityKind,
      schemaId: schema?.id,
      schemaVersion: schema?.version,
      data: formData,
      backstageYaml,
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName || 'metadata'}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading schema...</span>
      </div>
    );
  }

  if (!schema) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No metadata schema found for this entity type. Please create a schema first.
        </AlertDescription>
      </Alert>
    );
  }

  if (mode === 'bulk' && bulkEntities.length > 0) {
    return (
      <BulkMetadataEditor
        schema={schema}
        entities={bulkEntities}
        onSave={(updates) => onSave?.(updates)}
        onCancel={() => onCancel?.()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {mode === 'create' ? 'Create' : 'Edit'} Metadata
            </h1>
            <p className="text-gray-600">
              {entityName && `${entityName} • `}
              {schema.name} v{schema.version}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowBackstageYaml(!showBackstageYaml)}
            >
              {showBackstageYaml ? <Eye className="h-4 w-4 mr-2" /> : <Code className="h-4 w-4 mr-2" />}
              {showBackstageYaml ? 'Form' : 'YAML'}
            </Button>
            
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            
            <Button
              onClick={handleSave}
              disabled={!validationResults?.valid || saving}
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Validation status */}
        {validationResults && (
          <div className="mt-4">
            {validationResults.valid ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  All fields are valid
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {validationResults.errors.length} validation error(s) found
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {showBackstageYaml ? (
          <div className="h-full p-4">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Backstage YAML Preview</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(backstageYaml, null, 2))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(backstageYaml, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ScrollArea className="h-full p-4">
            <div className="max-w-4xl mx-auto space-y-6">
              {schema.description && (
                <Alert>
                  <AlertDescription>{schema.description}</AlertDescription>
                </Alert>
              )}

              {/* Group fields by sections if layout is defined */}
              {schema.layout?.sections ? (
                schema.layout.sections.map(section => (
                  <Card key={section.id}>
                    <Collapsible defaultOpen={section.defaultExpanded !== false}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-gray-50">
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="space-y-4">
                          {section.fields.map(fieldName => {
                            const field = schema.fields.find(f => f.name === fieldName);
                            if (!field) return null;
                            
                            return (
                              <FieldRenderer
                                key={field.id}
                                field={field}
                                value={formData[field.name]}
                                onChange={(value) => handleFieldChange(field.name, value)}
                                error={errors[field.name]}
                              />
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
              ) : (
                // No layout sections, render all fields in a single card
                <Card>
                  <CardHeader>
                    <CardTitle>Metadata Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {schema.fields.map(field => (
                      <FieldRenderer
                        key={field.id}
                        field={field}
                        value={formData[field.name]}
                        onChange={(value) => handleFieldChange(field.name, value)}
                        error={errors[field.name]}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Validation errors summary */}
              {validationResults && !validationResults.valid && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-700 flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Validation Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {validationResults.errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-600">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}