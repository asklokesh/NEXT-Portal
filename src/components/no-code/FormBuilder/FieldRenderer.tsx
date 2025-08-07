'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Type, 
 Link, 
 Mail, 
 Globe, 
 User, 
 Calendar,
 ChevronDown,
 EyeOff,
 Info
} from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { getFieldDefinition } from '../common/FieldComponents';

import type { FormField } from '../types';

interface FieldRendererProps {
 field: FormField;
 isPreview?: boolean;
 className?: string;
}

interface FieldLabelProps {
 field: FormField;
 isPreview?: boolean;
}

interface FieldContentProps {
 field: FormField;
 isPreview: boolean;
}

// Field label component
const FieldLabel: React.FC<FieldLabelProps> = ({ field, isPreview = false }) => {
 const definition = getFieldDefinition(field.type);
 const IconComponent = definition?.icon || Type;

 return (
 <div className="flex items-center gap-2 mb-2">
 <div className={cn(
 'flex-shrink-0 p-1 rounded',
 isPreview ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
 )}>
 <IconComponent className="w-3 h-3" />
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1">
 <span className={cn(
 'text-xs font-medium truncate',
 isPreview ? 'text-foreground' : 'text-muted-foreground'
 )}>
 {field.label}
 </span>
 {field.required && (
 <span className="text-destructive text-xs">*</span>
 )}
 {field.hidden && (
 <EyeOff className="w-3 h-3 text-muted-foreground" />
 )}
 </div>
 
 {field.description && (
 <p className="text-xs text-muted-foreground/70 truncate">
 {field.description}
 </p>
 )}
 </div>
 </div>
 );
};

// String field renderer
const StringFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const stringField = field as any;
 const value = isPreview ? (field.defaultValue as string || field.placeholder || '') : field.placeholder;
 
 if (stringField.multiline) {
 return (
 <textarea
 value={value}
 placeholder={field.placeholder}
 readOnly
 className={cn(
 'w-full h-16 px-2 py-1 text-xs rounded border resize-none',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 isPreview ? 'cursor-default' : 'cursor-not-allowed'
 )}
 />
 );
 }
 
 return (
 <input
 type="text"
 value={value}
 placeholder={field.placeholder}
 readOnly
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 isPreview ? 'cursor-default' : 'cursor-not-allowed'
 )}
 />
 );
};

// Number field renderer
const NumberFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const numberField = field as any;
 const value = isPreview ? (field.defaultValue as number || '') : '';
 
 return (
 <input
 type="number"
 value={value}
 placeholder={field.placeholder}
 min={numberField.min}
 max={numberField.max}
 step={numberField.step}
 readOnly
 className={cn(
 'w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 isPreview ? 'cursor-default' : 'cursor-not-allowed'
 )}
 />
 );
};

// Boolean field renderer
const BooleanFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const checked = isPreview ? (field.defaultValue as boolean || false) : false;
 
 return (
 <div className="flex items-center gap-2">
 <div className={cn(
 'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
 checked ? 'bg-primary' : 'bg-input'
 )}>
 <div className={cn(
 'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
 checked ? 'translate-x-5' : 'translate-x-0.5'
 )} />
 </div>
 <span className="text-xs text-muted-foreground">
 {checked ? 'Enabled' : 'Disabled'}
 </span>
 </div>
 );
};

// Select field renderer
const SelectFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const selectField = field as any;
 const value = isPreview ? (field.defaultValue || selectField.options?.[0]?.label) : 'Select option...';
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 'flex items-center justify-between'
 )}>
 <span className="truncate">{value}</span>
 <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
 </div>
 );
};

// Array/List field renderer
const ArrayFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const items = isPreview ? (field.defaultValue as string[] || ['Item 1', 'Item 2']) : ['Item 1', 'Item 2'];
 
 return (
 <div className="space-y-1">
 {items.slice(0, 3).map((item, index) => (
 <div
 key={index}
 className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
 >
 <span className="w-1 h-1 bg-current rounded-full flex-shrink-0" />
 <span className="truncate">{item}</span>
 </div>
 ))}
 {items.length > 3 && (
 <div className="text-xs text-muted-foreground px-2">
 +{items.length - 3} more items
 </div>
 )}
 </div>
 );
};

// Tags field renderer
const TagsFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const tags = isPreview ? (field.defaultValue as string[] || ['tag1', 'tag2']) : ['tag1', 'tag2'];
 
 return (
 <div className="flex flex-wrap gap-1">
 {tags.slice(0, 4).map((tag, index) => (
 <span
 key={index}
 className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
 >
 {tag}
 </span>
 ))}
 {tags.length > 4 && (
 <span className="text-xs text-muted-foreground px-1">
 +{tags.length - 4}
 </span>
 )}
 </div>
 );
};

// Entity reference field renderer
const EntityRefFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const value = isPreview ? (field.defaultValue as string || 'component:default/example') : 'Select entity...';
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 'flex items-center gap-2'
 )}>
 <Link className="w-3 h-3 text-muted-foreground flex-shrink-0" />
 <span className="truncate">{value}</span>
 </div>
 );
};

// URL field renderer
const UrlFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const value = isPreview ? (field.defaultValue as string || 'https://example.com') : '';
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 'flex items-center gap-2'
 )}>
 <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
 <input
 type="url"
 value={value}
 placeholder={field.placeholder}
 readOnly
 className="flex-1 bg-transparent focus:outline-none"
 />
 </div>
 );
};

// Email field renderer
const EmailFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const value = isPreview ? (field.defaultValue as string || 'user@example.com') : '';
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 'flex items-center gap-2'
 )}>
 <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
 <input
 type="email"
 value={value}
 placeholder={field.placeholder}
 readOnly
 className="flex-1 bg-transparent focus:outline-none"
 />
 </div>
 );
};

// Lifecycle field renderer
const LifecycleFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const lifecycleField = field as any;
 const value = isPreview ? (field.defaultValue || lifecycleField.options?.[0]?.label || 'production') : 'Select lifecycle...';
 
 const getLifecycleColor = (lifecycle: string) => {
 switch (lifecycle?.toLowerCase()) {
 case 'experimental': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
 case 'production': return 'bg-green-100 text-green-800 border-green-200';
 case 'deprecated': return 'bg-red-100 text-red-800 border-red-200';
 default: return 'bg-muted text-muted-foreground border-border';
 }
 };
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'flex items-center gap-2',
 getLifecycleColor(value as string)
 )}>
 <Calendar className="w-3 h-3 flex-shrink-0" />
 <span className="truncate">{value}</span>
 </div>
 );
};

// Owner field renderer
const OwnerFieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 const value = isPreview ? (field.defaultValue as string || 'group:default/platform-team') : 'Select owner...';
 
 return (
 <div className={cn(
 'relative w-full px-2 py-1 text-xs rounded border',
 'bg-background border-input text-foreground',
 'focus:outline-none focus:ring-1 focus:ring-ring',
 'flex items-center gap-2'
 )}>
 <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
 <span className="truncate">{value}</span>
 </div>
 );
};

// Main field content renderer
const FieldContent: React.FC<FieldContentProps> = ({ field, isPreview }) => {
 switch (field.type) {
 case 'string':
 return <StringFieldContent field={field} isPreview={isPreview} />;
 case 'number':
 return <NumberFieldContent field={field} isPreview={isPreview} />;
 case 'boolean':
 return <BooleanFieldContent field={field} isPreview={isPreview} />;
 case 'select':
 return <SelectFieldContent field={field} isPreview={isPreview} />;
 case 'array':
 return <ArrayFieldContent field={field} isPreview={isPreview} />;
 case 'tags':
 return <TagsFieldContent field={field} isPreview={isPreview} />;
 case 'entityRef':
 return <EntityRefFieldContent field={field} isPreview={isPreview} />;
 case 'url':
 return <UrlFieldContent field={field} isPreview={isPreview} />;
 case 'email':
 return <EmailFieldContent field={field} isPreview={isPreview} />;
 case 'lifecycle':
 return <LifecycleFieldContent field={field} isPreview={isPreview} />;
 case 'owner':
 return <OwnerFieldContent field={field} isPreview={isPreview} />;
 default:
 return (
 <div className="flex items-center justify-center h-8 text-xs text-muted-foreground bg-muted rounded">
 <Info className="w-3 h-3 mr-1" />
 Unknown field type: {field.type}
 </div>
 );
 }
};

// Main field renderer component
export const FieldRenderer: React.FC<FieldRendererProps> = ({ 
 field, 
 isPreview = false, 
 className 
}) => {
 return (
 <div className={cn('w-full h-full flex flex-col', className)}>
 <FieldLabel field={field} isPreview={isPreview} />
 <div className="flex-1 flex flex-col justify-center">
 <FieldContent field={field} isPreview={isPreview || false} />
 </div>
 
 {/* Backstage mapping indicator */}
 {field.backstageMapping && !isPreview && (
 <div className="mt-1 flex items-center gap-1">
 <div className="w-1 h-1 bg-primary rounded-full" />
 <span className="text-xs text-primary/70 truncate">
 {field.backstageMapping}
 </span>
 </div>
 )}
 </div>
 );
};