'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Settings, 
 Type, 
 Hash, 
 List, 
 Tags, 
 Link, 
 Plus,
 Trash2,
 ChevronDown,
 ChevronRight,
 Eye,
 EyeOff,
 Lock,
 Unlock,
 AlertTriangle
} from 'lucide-react';
import React, { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';

import { getFieldDefinition } from '../common/FieldComponents';
import { useFormBuilderStore } from '../store/formBuilderStore';

import type { FormField, FieldOption, FieldValidation } from '../types';

interface PropertyPanelProps {
 className?: string;
}

interface FieldConfigSectionProps {
 title: string;
 icon: React.ReactNode;
 children: React.ReactNode;
 defaultExpanded?: boolean;
}

interface FormGroupProps {
 label: string;
 description?: string;
 required?: boolean;
 children: React.ReactNode;
}

interface OptionEditorProps {
 options: FieldOption[];
 onChange: (options: FieldOption[]) => void;
}

interface ValidationEditorProps {
 validation: FieldValidation | undefined;
 fieldType: string;
 onChange: (validation: FieldValidation) => void;
}

// Collapsible section component
const FieldConfigSection: React.FC<FieldConfigSectionProps> = ({ 
 title, 
 icon, 
 children, 
 defaultExpanded = true 
}) => {
 const [isExpanded, setIsExpanded] = useState(defaultExpanded);

 return (
 <div className="border-b border-border last:border-b-0">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className={cn(
 'flex items-center gap-2 w-full p-3 text-left',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 aria-expanded={isExpanded}
 >
 {isExpanded ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 {icon}
 <span className="font-medium">{title}</span>
 </button>
 
 {isExpanded && (
 <div className="px-3 pb-3 space-y-4">
 {children}
 </div>
 )}
 </div>
 );
};

// Form group component
const FormGroup: React.FC<FormGroupProps> = ({ 
 label, 
 description, 
 required = false, 
 children 
}) => {
 return (
 <div className="space-y-2">
 <label className="block text-sm font-medium text-foreground">
 {label}
 {required && <span className="text-destructive ml-1">*</span>}
 </label>
 {description && (
 <p className="text-xs text-muted-foreground">{description}</p>
 )}
 {children}
 </div>
 );
};

// Option editor for select/lifecycle fields
const OptionEditor: React.FC<OptionEditorProps> = ({ options, onChange }) => {
 const [isExpanded, setIsExpanded] = useState(false);

 const addOption = () => {
 const newOption: FieldOption = {
 label: `Option ${options.length + 1}`,
 value: `option${options.length + 1}`,
 };
 onChange([...options, newOption]);
 };

 const updateOption = (index: number, updates: Partial<FieldOption>) => {
 const newOptions = [...options];
 newOptions[index] = { ...newOptions[index], ...updates };
 onChange(newOptions);
 };

 const removeOption = (index: number) => {
 const newOptions = options.filter((_, i) => i !== index);
 onChange(newOptions);
 };

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
 >
 {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
 {options.length} options
 </button>
 <button
 onClick={addOption}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded',
 'bg-primary text-primary-foreground hover:bg-primary/90',
 'transition-colors duration-200'
 )}
 >
 <Plus className="w-3 h-3" />
 Add
 </button>
 </div>

 {isExpanded && (
 <div className="space-y-2 pl-2 border-l border-border">
 {options.map((option, index) => (
 <div key={index} className="flex gap-2">
 <input
 type="text"
 value={option.label}
 onChange={(e) => updateOption(index, { label: e.target.value })}
 placeholder="Label"
 className={cn(
 'flex-1 px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 <input
 type="text"
 value={option.value.toString()}
 onChange={(e) => updateOption(index, { value: e.target.value })}
 placeholder="Value"
 className={cn(
 'flex-1 px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 <button
 onClick={() => removeOption(index)}
 className={cn(
 'p-1 rounded text-destructive hover:bg-destructive/10',
 'transition-colors duration-200'
 )}
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

// Validation editor
const ValidationEditor: React.FC<ValidationEditorProps> = ({ 
 validation = {}, 
 fieldType, 
 onChange 
}) => {
 const [isExpanded, setIsExpanded] = useState(false);

 const updateValidation = (updates: Partial<FieldValidation>) => {
 onChange({ ...validation, ...updates });
 };

 return (
 <div className="space-y-2">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
 >
 {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
 Validation Rules
 </button>

 {isExpanded && (
 <div className="space-y-3 pl-2 border-l border-border">
 {/* Required */}
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="required"
 checked={validation.required || false}
 onChange={(e) => updateValidation({ required: e.target.checked })}
 className="rounded border-input"
 />
 <label htmlFor="required" className="text-xs text-foreground">
 Required field
 </label>
 </div>

 {/* String-specific validation */}
 {fieldType === 'string' && (
 <>
 <FormGroup label="Min Length" description="Minimum number of characters">
 <input
 type="number"
 value={validation.minLength || ''}
 onChange={(e) => updateValidation({ minLength: parseInt(e.target.value) || undefined })}
 min={0}
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Max Length" description="Maximum number of characters">
 <input
 type="number"
 value={validation.maxLength || ''}
 onChange={(e) => updateValidation({ maxLength: parseInt(e.target.value) || undefined })}
 min={0}
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Pattern" description="Regular expression pattern">
 <input
 type="text"
 value={validation.pattern || ''}
 onChange={(e) => updateValidation({ pattern: e.target.value || undefined })}
 placeholder="^[a-z0-9-]+$"
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </FormGroup>
 </>
 )}

 {/* Number-specific validation */}
 {fieldType === 'number' && (
 <>
 <FormGroup label="Minimum Value" description="Minimum allowed value">
 <input
 type="number"
 value={validation.min || ''}
 onChange={(e) => updateValidation({ min: parseFloat(e.target.value) || undefined })}
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Maximum Value" description="Maximum allowed value">
 <input
 type="number"
 value={validation.max || ''}
 onChange={(e) => updateValidation({ max: parseFloat(e.target.value) || undefined })}
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring'
 )}
 />
 </FormGroup>
 </>
 )}
 </div>
 )}
 </div>
 );
};

// Main property panel component
export const PropertyPanel: React.FC<PropertyPanelProps> = ({ className }) => {
 const { 
 fields: _fields, 
 selectedFieldId, 
 updateField, 
 getSelectedField 
 } = useFormBuilderStore();

 const selectedField = getSelectedField();

 const updateFieldProperty = useCallback((updates: Partial<FormField>) => {
 if (selectedFieldId) {
 updateField(selectedFieldId, updates);
 }
 }, [selectedFieldId, updateField]);

 if (!selectedField) {
 return (
 <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
 <div className="p-4 border-b border-border">
 <h2 className="text-lg font-semibold text-foreground">Properties</h2>
 </div>
 
 <div className="flex-1 flex items-center justify-center p-8">
 <div className="text-center">
 <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
 <h3 className="text-sm font-medium text-foreground mb-2">
 No Field Selected
 </h3>
 <p className="text-xs text-muted-foreground">
 Select a field from the canvas to edit its properties.
 </p>
 </div>
 </div>
 </div>
 );
 }

 const definition = getFieldDefinition(selectedField.type);
 const IconComponent = definition?.icon || Type;

 return (
 <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
 {/* Header */}
 <div className="p-4 border-b border-border">
 <div className="flex items-center gap-3 mb-3">
 <div className="p-2 rounded-md bg-primary/10 text-primary">
 <IconComponent className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <h2 className="text-lg font-semibold text-foreground truncate">
 {selectedField.label || 'Untitled Field'}
 </h2>
 <p className="text-xs text-muted-foreground">
 {definition?.label} • {selectedField.id}
 </p>
 </div>
 </div>
 
 {/* Quick actions */}
 <div className="flex gap-2">
 <button
 onClick={() => updateFieldProperty({ hidden: !selectedField.hidden })}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded border',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 selectedField.hidden ? 'border-primary text-primary' : 'border-border text-muted-foreground'
 )}
 title={selectedField.hidden ? 'Show field' : 'Hide field'}
 >
 {selectedField.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
 {selectedField.hidden ? 'Hidden' : 'Visible'}
 </button>
 
 <button
 onClick={() => updateFieldProperty({ disabled: !selectedField.disabled })}
 className={cn(
 'flex items-center gap-1 px-2 py-1 text-xs rounded border',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 selectedField.disabled ? 'border-primary text-primary' : 'border-border text-muted-foreground'
 )}
 title={selectedField.disabled ? 'Enable field' : 'Disable field'}
 >
 {selectedField.disabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
 {selectedField.disabled ? 'Disabled' : 'Enabled'}
 </button>
 </div>
 </div>

 {/* Properties */}
 <div className="flex-1 overflow-y-auto">
 {/* Basic Properties */}
 <FieldConfigSection
 title="Basic Properties"
 icon={<Type className="w-4 h-4" />}
 defaultExpanded={true}
 >
 <FormGroup label="Label" description="Display name for the field" required>
 <input
 type="text"
 value={selectedField.label}
 onChange={(e) => updateFieldProperty({ label: e.target.value })}
 placeholder="Field label"
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Description" description="Help text for the field">
 <textarea
 value={selectedField.description || ''}
 onChange={(e) => updateFieldProperty({ description: e.target.value })}
 placeholder="Field description"
 rows={3}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border resize-none',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Placeholder" description="Placeholder text">
 <input
 type="text"
 value={selectedField.placeholder || ''}
 onChange={(e) => updateFieldProperty({ placeholder: e.target.value })}
 placeholder="Enter placeholder text"
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Default Value" description="Initial value for the field">
 <input
 type="text"
 value={selectedField.defaultValue?.toString() || ''}
 onChange={(e) => updateFieldProperty({ defaultValue: e.target.value })}
 placeholder="Default value"
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>
 </FieldConfigSection>

 {/* Backstage Mapping */}
 <FieldConfigSection
 title="Backstage Mapping"
 icon={<Link className="w-4 h-4" />}
 defaultExpanded={true}
 >
 <FormGroup 
 label="Entity Property" 
 description="Maps to this property in the Backstage entity"
 >
 <input
 type="text"
 value={selectedField.backstageMapping || ''}
 onChange={(e) => updateFieldProperty({ backstageMapping: e.target.value })}
 placeholder="metadata.name, spec.type, etc."
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>
 </FieldConfigSection>

 {/* Field-specific options */}
 {(selectedField.type === 'select' || selectedField.type === 'lifecycle') && (
 <FieldConfigSection
 title="Options"
 icon={<List className="w-4 h-4" />}
 defaultExpanded={true}
 >
 <OptionEditor
 options={(selectedField as any).options || []}
 onChange={(options) => updateFieldProperty({ options } as any)}
 />
 </FieldConfigSection>
 )}

 {/* String field options */}
 {selectedField.type === 'string' && (
 <FieldConfigSection
 title="Text Options"
 icon={<Type className="w-4 h-4" />}
 >
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="multiline"
 checked={(selectedField as any).multiline || false}
 onChange={(e) => updateFieldProperty({ multiline: e.target.checked } as any)}
 className="rounded border-input"
 />
 <label htmlFor="multiline" className="text-sm text-foreground">
 Multiline textarea
 </label>
 </div>
 </FieldConfigSection>
 )}

 {/* Number field options */}
 {selectedField.type === 'number' && (
 <FieldConfigSection
 title="Number Options"
 icon={<Hash className="w-4 h-4" />}
 >
 <FormGroup label="Step" description="Increment/decrement step">
 <input
 type="number"
 value={(selectedField as any).step || ''}
 onChange={(e) => updateFieldProperty({ step: parseFloat(e.target.value) || undefined } as any)}
 step={0.1}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>
 </FieldConfigSection>
 )}

 {/* Tags field options */}
 {selectedField.type === 'tags' && (
 <FieldConfigSection
 title="Tag Options"
 icon={<Tags className="w-4 h-4" />}
 >
 <FormGroup label="Suggestions" description="Suggested tags (comma-separated)">
 <input
 type="text"
 value={(selectedField as any).suggestions?.join(', ') || ''}
 onChange={(e) => updateFieldProperty({ 
 suggestions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
 } as any)}
 placeholder="frontend, backend, api"
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>
 </FieldConfigSection>
 )}

 {/* Validation */}
 <FieldConfigSection
 title="Validation"
 icon={<AlertTriangle className="w-4 h-4" />}
 >
 <ValidationEditor
 validation={selectedField.validation}
 fieldType={selectedField.type}
 onChange={(validation) => updateFieldProperty({ validation })}
 />
 </FieldConfigSection>

 {/* Position & Size */}
 <FieldConfigSection
 title="Position & Size"
 icon={<Settings className="w-4 h-4" />}
 >
 <div className="grid grid-cols-2 gap-3">
 <FormGroup label="X Position">
 <input
 type="number"
 value={selectedField.position.x}
 onChange={(e) => updateFieldProperty({ 
 position: { ...selectedField.position, x: parseInt(e.target.value) || 0 }
 })}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Y Position">
 <input
 type="number"
 value={selectedField.position.y}
 onChange={(e) => updateFieldProperty({ 
 position: { ...selectedField.position, y: parseInt(e.target.value) || 0 }
 })}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Width">
 <input
 type="number"
 value={selectedField.position.width}
 onChange={(e) => updateFieldProperty({ 
 position: { ...selectedField.position, width: parseInt(e.target.value) || 240 }
 })}
 min={120}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>

 <FormGroup label="Height">
 <input
 type="number"
 value={selectedField.position.height}
 onChange={(e) => updateFieldProperty({ 
 position: { ...selectedField.position, height: parseInt(e.target.value) || 60 }
 })}
 min={40}
 className={cn(
 'w-full px-3 py-2 text-sm rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring'
 )}
 />
 </FormGroup>
 </div>
 </FieldConfigSection>
 </div>
 </div>
 );
};