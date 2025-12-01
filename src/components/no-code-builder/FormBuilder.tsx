'use client';

/**
 * Form Builder Component
 * Visual form builder for creating self-service action forms
 */

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Type,
  Hash,
  Mail,
  Calendar,
  CheckSquare,
  List,
  Radio,
  Upload,
  Link,
  FileText,
  Eye,
  Code,
  GripVertical,
  Trash2,
  Settings,
  Plus,
  Copy,
  ChevronDown,
  ChevronRight,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { FormFieldConfig, FormConfig, FormFieldType } from './types';
import { v4 as uuidv4 } from 'uuid';

interface FieldDefinition {
  type: FormFieldType;
  name: string;
  icon: React.ElementType;
  description: string;
  defaultConfig: Partial<FormFieldConfig>;
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    type: 'text',
    name: 'Text Input',
    icon: Type,
    description: 'Single line text input',
    defaultConfig: { label: 'Text Field', placeholder: 'Enter text...' },
  },
  {
    type: 'textarea',
    name: 'Text Area',
    icon: FileText,
    description: 'Multi-line text input',
    defaultConfig: { label: 'Description', placeholder: 'Enter description...' },
  },
  {
    type: 'number',
    name: 'Number',
    icon: Hash,
    description: 'Numeric input',
    defaultConfig: { label: 'Number', placeholder: '0' },
  },
  {
    type: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Email address input',
    defaultConfig: { label: 'Email', placeholder: 'user@example.com' },
  },
  {
    type: 'url',
    name: 'URL',
    icon: Link,
    description: 'Website URL input',
    defaultConfig: { label: 'URL', placeholder: 'https://...' },
  },
  {
    type: 'date',
    name: 'Date',
    icon: Calendar,
    description: 'Date picker',
    defaultConfig: { label: 'Date' },
  },
  {
    type: 'select',
    name: 'Dropdown',
    icon: List,
    description: 'Single selection dropdown',
    defaultConfig: {
      label: 'Select',
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
      ],
    },
  },
  {
    type: 'multiselect',
    name: 'Multi-Select',
    icon: CheckSquare,
    description: 'Multiple selection',
    defaultConfig: {
      label: 'Multi-Select',
      options: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ],
    },
  },
  {
    type: 'radio',
    name: 'Radio Group',
    icon: Radio,
    description: 'Radio button group',
    defaultConfig: {
      label: 'Choose One',
      options: [
        { label: 'Choice 1', value: 'choice1' },
        { label: 'Choice 2', value: 'choice2' },
      ],
    },
  },
  {
    type: 'checkbox',
    name: 'Checkbox',
    icon: CheckSquare,
    description: 'Boolean checkbox',
    defaultConfig: { label: 'I agree to the terms' },
  },
  {
    type: 'file',
    name: 'File Upload',
    icon: Upload,
    description: 'File upload field',
    defaultConfig: { label: 'Upload File', accept: '*/*' },
  },
  {
    type: 'entity-picker',
    name: 'Entity Picker',
    icon: Code,
    description: 'Catalog entity selector',
    defaultConfig: { label: 'Select Entity', entityKind: 'Component' },
  },
];

interface SortableFieldProps {
  field: FormFieldConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: SortableFieldProps) {
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
  };

  const Icon = FIELD_DEFINITIONS.find((f) => f.type === field.type)?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-gray-800',
        'transition-all duration-150',
        isDragging && 'opacity-50',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {field.label || field.name}
          </span>
          {field.required && <span className="text-red-500 text-xs">*</span>}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{field.type}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface FieldConfigPanelProps {
  field: FormFieldConfig | null;
  onUpdate: (updates: Partial<FormFieldConfig>) => void;
  onClose: () => void;
}

function FieldConfigPanel({ field, onUpdate, onClose }: FieldConfigPanelProps) {
  if (!field) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Settings className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Select a field to configure</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Field Settings
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Settings */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Field Name
            </label>
            <input
              type="text"
              value={field.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label
            </label>
            <input
              type="text"
              value={field.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={field.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Placeholder
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Value
            </label>
            <input
              type="text"
              value={String(field.defaultValue || '')}
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Options for select/multiselect/radio */}
        {['select', 'multiselect', 'radio'].includes(field.type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Options
            </label>
            <div className="space-y-2">
              {(field.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[index] = { ...option, label: e.target.value };
                      onUpdate({ options: newOptions });
                    }}
                    placeholder="Label"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={option.value}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[index] = { ...option, value: e.target.value };
                      onUpdate({ options: newOptions });
                    }}
                    placeholder="Value"
                    className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const newOptions = (field.options || []).filter((_, i) => i !== index);
                      onUpdate({ options: newOptions });
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [
                    ...(field.options || []),
                    { label: 'New Option', value: `option${(field.options || []).length + 1}` },
                  ];
                  onUpdate({ options: newOptions });
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </button>
            </div>
          </div>
        )}

        {/* Validation */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Validation
          </h4>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
            </label>

            {['text', 'textarea', 'email', 'url'].includes(field.type) && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Min Length</label>
                  <input
                    type="number"
                    value={field.validation?.minLength || ''}
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, minLength: parseInt(e.target.value) || undefined },
                      })
                    }
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Max Length</label>
                  <input
                    type="number"
                    value={field.validation?.maxLength || ''}
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, maxLength: parseInt(e.target.value) || undefined },
                      })
                    }
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
              </>
            )}

            {field.type === 'number' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Min</label>
                  <input
                    type="number"
                    value={field.validation?.min ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, min: parseFloat(e.target.value) || undefined },
                      })
                    }
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Max</label>
                  <input
                    type="number"
                    value={field.validation?.max ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        validation: { ...field.validation, max: parseFloat(e.target.value) || undefined },
                      })
                    }
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Custom Pattern (Regex)
              </label>
              <input
                type="text"
                value={field.validation?.pattern || ''}
                onChange={(e) =>
                  onUpdate({
                    validation: { ...field.validation, pattern: e.target.value || undefined },
                  })
                }
                placeholder="^[a-zA-Z]+$"
                className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Conditional Logic */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Conditional Display
          </h4>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm text-gray-500 dark:text-gray-400">
            Configure when this field should be shown based on other field values.
          </div>
        </div>
      </div>
    </div>
  );
}

interface FormBuilderProps {
  form?: FormConfig;
  onChange?: (form: FormConfig) => void;
  onSave?: (form: FormConfig) => void;
  className?: string;
}

export function FormBuilder({
  form: initialForm,
  onChange,
  onSave,
  className,
}: FormBuilderProps) {
  const [form, setForm] = useState<FormConfig>(
    initialForm || {
      id: uuidv4(),
      name: 'New Form',
      description: '',
      fields: [],
      submitAction: {
        type: 'api',
        endpoint: '',
      },
    }
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'preview' | 'json'>('design');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = form.fields.find((f) => f.id === selectedFieldId) || null;

  const updateForm = useCallback(
    (updates: Partial<FormConfig>) => {
      const newForm = { ...form, ...updates };
      setForm(newForm);
      onChange?.(newForm);
    },
    [form, onChange]
  );

  const addField = useCallback(
    (definition: FieldDefinition) => {
      const newField: FormFieldConfig = {
        id: uuidv4(),
        name: `field_${form.fields.length + 1}`,
        type: definition.type,
        ...definition.defaultConfig,
      };
      updateForm({ fields: [...form.fields, newField] });
      setSelectedFieldId(newField.id);
    },
    [form.fields, updateForm]
  );

  const updateField = useCallback(
    (fieldId: string, updates: Partial<FormFieldConfig>) => {
      const newFields = form.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      );
      updateForm({ fields: newFields });
    },
    [form.fields, updateForm]
  );

  const deleteField = useCallback(
    (fieldId: string) => {
      const newFields = form.fields.filter((f) => f.id !== fieldId);
      updateForm({ fields: newFields });
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [form.fields, selectedFieldId, updateForm]
  );

  const duplicateField = useCallback(
    (fieldId: string) => {
      const field = form.fields.find((f) => f.id === fieldId);
      if (field) {
        const newField = {
          ...field,
          id: uuidv4(),
          name: `${field.name}_copy`,
        };
        const index = form.fields.findIndex((f) => f.id === fieldId);
        const newFields = [
          ...form.fields.slice(0, index + 1),
          newField,
          ...form.fields.slice(index + 1),
        ];
        updateForm({ fields: newFields });
        setSelectedFieldId(newField.id);
      }
    },
    [form.fields, updateForm]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = form.fields.findIndex((f) => f.id === active.id);
      const newIndex = form.fields.findIndex((f) => f.id === over.id);
      updateForm({ fields: arrayMove(form.fields, oldIndex, newIndex) });
    }
  };

  const renderPreview = () => (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {form.name}
      </h2>
      {form.description && (
        <p className="text-gray-500 dark:text-gray-400 mb-6">{form.description}</p>
      )}

      <div className="space-y-4">
        {form.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {field.description}
              </p>
            )}

            {/* Render appropriate input based on type */}
            {field.type === 'textarea' ? (
              <textarea
                placeholder={field.placeholder}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            ) : field.type === 'select' ? (
              <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {field.label}
                </span>
              </label>
            ) : field.type === 'radio' ? (
              <div className="space-y-2">
                {field.options?.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.name}
                      value={opt.value}
                      className="border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button className="w-full">{form.submitButtonText || 'Submit'}</Button>
      </div>
    </div>
  );

  return (
    <div className={cn('flex flex-col h-full bg-gray-50 dark:bg-gray-950', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Buttons */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('design')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                activeTab === 'design'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Design
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                activeTab === 'preview'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Eye className="h-4 w-4 inline mr-1" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                activeTab === 'json'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Code className="h-4 w-4 inline mr-1" />
              JSON
            </button>
          </div>

          {onSave && (
            <Button onClick={() => onSave(form)} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'design' && (
          <>
            {/* Field Library */}
            <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Field Types
                </h3>
                <div className="space-y-2">
                  {FIELD_DEFINITIONS.map((definition) => {
                    const Icon = definition.icon;
                    return (
                      <button
                        key={definition.type}
                        onClick={() => addField(definition)}
                        className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="p-1.5 rounded bg-gray-100 dark:bg-gray-700">
                          <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {definition.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {definition.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-y-auto p-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={form.fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="max-w-2xl mx-auto space-y-3">
                    {form.fields.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <FileText className="h-12 w-12 mx-auto mb-4" />
                        <p className="text-lg">No fields yet</p>
                        <p className="text-sm">Click on a field type to add it to your form</p>
                      </div>
                    ) : (
                      form.fields.map((field) => (
                        <SortableField
                          key={field.id}
                          field={field}
                          isSelected={selectedFieldId === field.id}
                          onSelect={() => setSelectedFieldId(field.id)}
                          onDelete={() => deleteField(field.id)}
                          onDuplicate={() => duplicateField(field.id)}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Config Panel */}
            <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
              <FieldConfigPanel
                field={selectedField}
                onUpdate={(updates) =>
                  selectedFieldId && updateField(selectedFieldId, updates)
                }
                onClose={() => setSelectedFieldId(null)}
              />
            </div>
          </>
        )}

        {activeTab === 'preview' && (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
            {renderPreview()}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(form, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default FormBuilder;
