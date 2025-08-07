'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Plus, 
 Trash2, 
 ChevronDown, 
 ChevronRight,
 GripVertical,
 Copy,
 Settings,
 Type,
 Hash,
 ToggleLeft,
 List,
 Calendar,
 Mail,
 Link,
 FileText,
 Code,
 HelpCircle,
 AlertCircle
} from 'lucide-react';
import React, { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { TemplateParameter } from '../types';

interface ParameterBuilderProps {
 parameters: Array<{
 title: string;
 required?: string[];
 properties: Record<string, TemplateParameter>;
 }>;
 onChange: (parameters: Array<{
 title: string;
 required?: string[];
 properties: Record<string, TemplateParameter>;
 }>) => void;
 className?: string;
}

interface ParameterItemProps {
 name: string;
 parameter: TemplateParameter;
 required: boolean;
 onUpdate: (name: string, parameter: TemplateParameter) => void;
 onDelete: (name: string) => void;
 onToggleRequired: (name: string) => void;
 onDuplicate: (name: string) => void;
}

// Parameter type configurations
const PARAMETER_TYPES = [
 { value: 'string', label: 'Text', icon: Type },
 { value: 'number', label: 'Number', icon: Hash },
 { value: 'boolean', label: 'Boolean', icon: ToggleLeft },
 { value: 'array', label: 'Array', icon: List },
 { value: 'object', label: 'Object', icon: FileText },
];

const UI_WIDGETS = {
 string: [
 { value: '', label: 'Default Input' },
 { value: 'textarea', label: 'Textarea' },
 { value: 'password', label: 'Password' },
 { value: 'color', label: 'Color Picker' },
 { value: 'date', label: 'Date Picker' },
 { value: 'email', label: 'Email' },
 { value: 'uri', label: 'URL' },
 ],
 number: [
 { value: '', label: 'Default Input' },
 { value: 'updown', label: 'Up/Down' },
 { value: 'range', label: 'Range Slider' },
 ],
 boolean: [
 { value: '', label: 'Checkbox' },
 { value: 'radio', label: 'Radio' },
 { value: 'select', label: 'Dropdown' },
 ],
 array: [
 { value: '', label: 'Default' },
 { value: 'checkboxes', label: 'Checkboxes' },
 { value: 'files', label: 'File Upload' },
 ],
};

// Parameter item component
const ParameterItem: React.FC<ParameterItemProps> = ({
 name,
 parameter,
 required,
 onUpdate,
 onDelete,
 onToggleRequired,
 onDuplicate,
}) => {
 const [isExpanded, setIsExpanded] = useState(false);
 const [showAdvanced, setShowAdvanced] = useState(false);

 const TypeIcon = PARAMETER_TYPES.find(t => t.value === parameter.type)?.icon || Type;

 const handleFieldUpdate = (field: string, value: any) => {
 onUpdate(name, { ...parameter, [field]: value });
 };

 return (
 <div className="border border-border rounded-lg bg-card">
 {/* Header */}
 <div className="flex items-center gap-2 p-4">
 <button className="cursor-move text-muted-foreground hover:text-foreground">
 <GripVertical className="w-4 h-4" />
 </button>

 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="text-muted-foreground hover:text-foreground"
 >
 {isExpanded ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 </button>

 <TypeIcon className="w-4 h-4 text-muted-foreground" />

 <div className="flex-1">
 <input
 type="text"
 value={parameter.title}
 onChange={(e) => handleFieldUpdate('title', e.target.value)}
 className="font-medium bg-transparent border-none focus:outline-none"
 placeholder="Parameter Title"
 />
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <code>{name}</code>
 <span>•</span>
 <span>{parameter.type}</span>
 {required && (
 <>
 <span>•</span>
 <span className="text-destructive">Required</span>
 </>
 )}
 </div>
 </div>

 <div className="flex items-center gap-1">
 <button
 onClick={() => onToggleRequired(name)}
 className={cn(
 'p-1 rounded hover:bg-accent hover:text-accent-foreground',
 required && 'text-destructive'
 )}
 title={required ? 'Make optional' : 'Make required'}
 >
 <AlertCircle className="w-4 h-4" />
 </button>

 <button
 onClick={() => onDuplicate(name)}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground"
 title="Duplicate parameter"
 >
 <Copy className="w-4 h-4" />
 </button>

 <button
 onClick={() => onDelete(name)}
 className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
 title="Delete parameter"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Expanded content */}
 {isExpanded && (
 <div className="px-4 pb-4 space-y-4 border-t border-border">
 {/* Basic fields */}
 <div className="grid grid-cols-2 gap-4 pt-4">
 <div>
 <label className="block text-sm font-medium mb-1">Field Name</label>
 <input
 type="text"
 value={name}
 readOnly
 className="w-full px-3 py-2 rounded-md border border-input bg-muted"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1">Type</label>
 <select
 value={parameter.type}
 onChange={(e) => handleFieldUpdate('type', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 {PARAMETER_TYPES.map((type) => (
 <option key={type.value} value={type.value}>
 {type.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1">Description</label>
 <textarea
 value={parameter.description || ''}
 onChange={(e) => handleFieldUpdate('description', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 rows={2}
 placeholder="Describe what this parameter is for..."
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1">Default Value</label>
 <input
 type={parameter.type === 'number' ? 'number' : 'text'}
 value={parameter.default || ''}
 onChange={(e) => handleFieldUpdate('default', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="Default value"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1">Placeholder</label>
 <input
 type="text"
 value={parameter['ui:placeholder'] || ''}
 onChange={(e) => handleFieldUpdate('ui:placeholder', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="Placeholder text"
 />
 </div>
 </div>

 {/* UI Widget selection */}
 {UI_WIDGETS[parameter.type as keyof typeof UI_WIDGETS] && (
 <div>
 <label className="block text-sm font-medium mb-1">UI Widget</label>
 <select
 value={parameter['ui:widget'] || ''}
 onChange={(e) => handleFieldUpdate('ui:widget', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 >
 {UI_WIDGETS[parameter.type as keyof typeof UI_WIDGETS].map((widget) => (
 <option key={widget.value} value={widget.value}>
 {widget.label}
 </option>
 ))}
 </select>
 </div>
 )}

 {/* Enum values for select */}
 {(parameter.type === 'string' || parameter.type === 'number') && (
 <div>
 <label className="block text-sm font-medium mb-1">
 Options (for dropdown)
 </label>
 <div className="space-y-2">
 {parameter.enum?.map((value, index) => (
 <div key={index} className="flex gap-2">
 <input
 type="text"
 value={value}
 onChange={(e) => {
 const newEnum = [...(parameter.enum || [])];
 newEnum[index] = e.target.value;
 handleFieldUpdate('enum', newEnum);
 }}
 className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
 placeholder="Option value"
 />
 <input
 type="text"
 value={parameter.enumNames?.[index] || ''}
 onChange={(e) => {
 const newEnumNames = [...(parameter.enumNames || [])];
 newEnumNames[index] = e.target.value;
 handleFieldUpdate('enumNames', newEnumNames);
 }}
 className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
 placeholder="Display name"
 />
 <button
 onClick={() => {
 const newEnum = parameter.enum?.filter((_, i) => i !== index);
 const newEnumNames = parameter.enumNames?.filter((_, i) => i !== index);
 handleFieldUpdate('enum', newEnum);
 handleFieldUpdate('enumNames', newEnumNames);
 }}
 className="p-2 rounded hover:bg-destructive hover:text-destructive-foreground"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 ))}
 <button
 onClick={() => {
 handleFieldUpdate('enum', [...(parameter.enum || []), '']);
 handleFieldUpdate('enumNames', [...(parameter.enumNames || []), '']);
 }}
 className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:border-primary text-sm"
 >
 <Plus className="w-4 h-4" />
 Add Option
 </button>
 </div>
 </div>
 )}

 {/* Advanced settings */}
 <div>
 <button
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <Settings className="w-4 h-4" />
 Advanced Settings
 {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 </button>
 </div>

 {showAdvanced && (
 <div className="space-y-4 pt-2">
 {/* Validation rules */}
 {parameter.type === 'string' && (
 <>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1">Min Length</label>
 <input
 type="number"
 value={parameter.minLength || ''}
 onChange={(e) => handleFieldUpdate('minLength', parseInt(e.target.value) || undefined)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1">Max Length</label>
 <input
 type="number"
 value={parameter.maxLength || ''}
 onChange={(e) => handleFieldUpdate('maxLength', parseInt(e.target.value) || undefined)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1">Pattern (Regex)</label>
 <input
 type="text"
 value={parameter.pattern || ''}
 onChange={(e) => handleFieldUpdate('pattern', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background font-mono text-sm"
 placeholder="^[a-z0-9-]+$"
 />
 </div>
 </>
 )}

 {parameter.type === 'number' && (
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1">Minimum</label>
 <input
 type="number"
 value={parameter.minimum || ''}
 onChange={(e) => handleFieldUpdate('minimum', parseFloat(e.target.value) || undefined)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1">Maximum</label>
 <input
 type="number"
 value={parameter.maximum || ''}
 onChange={(e) => handleFieldUpdate('maximum', parseFloat(e.target.value) || undefined)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>
 </div>
 )}

 <div>
 <label className="block text-sm font-medium mb-1">Help Text</label>
 <input
 type="text"
 value={parameter['ui:help'] || ''}
 onChange={(e) => handleFieldUpdate('ui:help', e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 placeholder="Additional help text for users"
 />
 </div>

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id={`autofocus-${name}`}
 checked={parameter['ui:autofocus'] || false}
 onChange={(e) => handleFieldUpdate('ui:autofocus', e.target.checked)}
 className="rounded border-input"
 />
 <label htmlFor={`autofocus-${name}`} className="text-sm">
 Auto-focus this field
 </label>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

// Main parameter builder component
export const ParameterBuilder: React.FC<ParameterBuilderProps> = ({
 parameters,
 onChange,
 className,
}) => {
 const [activeSection, setActiveSection] = useState(0);

 const handleAddParameter = (sectionIndex: number) => {
 const newParameters = [...parameters];
 const paramName = `param${Object.keys(newParameters[sectionIndex].properties).length + 1}`;
 
 newParameters[sectionIndex].properties[paramName] = {
 title: 'New Parameter',
 type: 'string',
 description: '',
 };
 
 onChange(newParameters);
 };

 const handleUpdateParameter = (sectionIndex: number, name: string, parameter: TemplateParameter) => {
 const newParameters = [...parameters];
 newParameters[sectionIndex].properties[name] = parameter;
 onChange(newParameters);
 };

 const handleDeleteParameter = (sectionIndex: number, name: string) => {
 const newParameters = [...parameters];
 delete newParameters[sectionIndex].properties[name];
 
 // Remove from required array if present
 if (newParameters[sectionIndex].required) {
 newParameters[sectionIndex].required = newParameters[sectionIndex].required.filter(
 (req) => req !== name
 );
 }
 
 onChange(newParameters);
 };

 const handleToggleRequired = (sectionIndex: number, name: string) => {
 const newParameters = [...parameters];
 const required = newParameters[sectionIndex].required || [];
 
 if (required.includes(name)) {
 newParameters[sectionIndex].required = required.filter((req) => req !== name);
 } else {
 newParameters[sectionIndex].required = [...required, name];
 }
 
 onChange(newParameters);
 };

 const handleDuplicateParameter = (sectionIndex: number, name: string) => {
 const newParameters = [...parameters];
 const originalParam = newParameters[sectionIndex].properties[name];
 const newName = `${name}_copy`;
 
 newParameters[sectionIndex].properties[newName] = {
 ...originalParam,
 title: `${originalParam.title} (Copy)`,
 };
 
 onChange(newParameters);
 };

 const handleAddSection = () => {
 onChange([
 ...parameters,
 {
 title: 'New Section',
 properties: {},
 },
 ]);
 setActiveSection(parameters.length);
 };

 return (
 <div className={cn('space-y-6', className)}>
 {/* Section tabs */}
 <div className="flex items-center gap-2 border-b border-border">
 {parameters.map((section, index) => (
 <button
 key={index}
 onClick={() => setActiveSection(index)}
 className={cn(
 'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
 activeSection === index
 ? 'border-primary text-foreground'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 {section.title}
 </button>
 ))}
 
 <button
 onClick={handleAddSection}
 className="ml-auto flex items-center gap-2 px-3 py-1 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 <Plus className="w-4 h-4" />
 Add Section
 </button>
 </div>

 {/* Active section */}
 {parameters[activeSection] && (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-2">Section Title</label>
 <input
 type="text"
 value={parameters[activeSection].title}
 onChange={(e) => {
 const newParameters = [...parameters];
 newParameters[activeSection].title = e.target.value;
 onChange(newParameters);
 }}
 className="w-full px-3 py-2 rounded-md border border-input bg-background"
 />
 </div>

 {/* Parameters list */}
 <div className="space-y-3">
 {Object.entries(parameters[activeSection].properties).map(([name, param]) => (
 <ParameterItem
 key={name}
 name={name}
 parameter={param}
 required={parameters[activeSection].required?.includes(name) || false}
 onUpdate={(name, param) => handleUpdateParameter(activeSection, name, param)}
 onDelete={(name) => handleDeleteParameter(activeSection, name)}
 onToggleRequired={(name) => handleToggleRequired(activeSection, name)}
 onDuplicate={(name) => handleDuplicateParameter(activeSection, name)}
 />
 ))}
 </div>

 <button
 onClick={() => handleAddParameter(activeSection)}
 className="w-full flex items-center justify-center gap-2 py-3 rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors"
 >
 <Plus className="w-5 h-5" />
 Add Parameter
 </button>
 </div>
 )}
 </div>
 );
};