'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { useDraggable } from '@dnd-kit/core';
import { Search, ChevronDown, ChevronRight, Layers, Zap, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { 
 FIELD_TYPE_DEFINITIONS, 
 getFieldsByCategory, 
 getBackstageFieldsForEntityType 
} from '../common/FieldComponents';
import { useFormBuilderStore } from '../store/formBuilderStore';

import type { FieldTypeDefinition, FormField } from '../types';

interface FieldPaletteProps {
 className?: string;
}

interface DraggableFieldItemProps {
 definition: FieldTypeDefinition;
 isPreset?: boolean;
}

interface CategorySectionProps {
 title: string;
 icon: React.ReactNode;
 fields: FieldTypeDefinition[];
 defaultExpanded?: boolean;
}

interface PresetSectionProps {
 title: string;
 fields: FormField[];
}

// Draggable field item component
const DraggableFieldItem: React.FC<DraggableFieldItemProps> = ({ definition, isPreset = false }) => {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 isDragging,
 } = useDraggable({
 id: `field-${definition.type}-${Date.now()}`,
 data: {
 type: 'PALETTE_ITEM',
 fieldType: definition.type,
 definition,
 isPreset,
 },
 });

 const style = transform ? {
 transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
 } : undefined;

 const IconComponent = definition.icon;

 return (
 <div
 ref={setNodeRef}
 style={style}
 {...listeners}
 {...attributes}
 className={cn(
 'group flex items-center gap-3 p-3 rounded-lg border border-border',
 'bg-background hover:bg-accent hover:border-accent-foreground/20',
 'cursor-grab active:cursor-grabbing transition-all duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
 isDragging && 'opacity-50 rotate-2 scale-105 shadow-lg',
 isPreset && 'border-primary/20 bg-primary/5'
 )}
 role="button"
 tabIndex={0}
 aria-label={`Drag ${definition.label} field to canvas`}
 >
 <div className={cn(
 'flex-shrink-0 p-2 rounded-md',
 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
 'transition-colors duration-200'
 )}>
 <IconComponent className="w-4 h-4" />
 </div>
 
 <div className="flex-1 min-w-0">
 <h4 className="text-sm font-medium text-foreground group-hover:text-accent-foreground truncate">
 {definition.label}
 </h4>
 <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 truncate">
 {definition.description}
 </p>
 </div>
 
 {isPreset && (
 <div className="flex-shrink-0">
 <div className="w-2 h-2 bg-primary rounded-full" />
 </div>
 )}
 </div>
 );
};

// Category section component
const CategorySection: React.FC<CategorySectionProps> = ({ 
 title, 
 icon, 
 fields, 
 defaultExpanded = true 
}) => {
 const [isExpanded, setIsExpanded] = useState(defaultExpanded);

 return (
 <div className="mb-4">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className={cn(
 'flex items-center gap-2 w-full p-2 rounded-md',
 'text-sm font-medium text-foreground',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 aria-expanded={isExpanded}
 aria-controls={`category-${title.toLowerCase().replace(/\s+/g, '-')}`}
 >
 {isExpanded ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 <span className="flex items-center gap-2">
 {icon}
 {title}
 </span>
 <span className="ml-auto text-xs text-muted-foreground">
 {fields.length}
 </span>
 </button>
 
 {isExpanded && (
 <div 
 id={`category-${title.toLowerCase().replace(/\s+/g, '-')}`}
 className="mt-2 space-y-2"
 >
 {fields.map((definition) => (
 <DraggableFieldItem 
 key={definition.type} 
 definition={definition} 
 />
 ))}
 </div>
 )}
 </div>
 );
};

// Preset section component
const PresetSection: React.FC<PresetSectionProps> = ({ title, fields }) => {
 const [isExpanded, setIsExpanded] = useState(false);
 const addField = useFormBuilderStore(state => state.addField);

 const handleAddPreset = () => {
 fields.forEach((field, index) => {
 // Add small delay to ensure proper positioning
 setTimeout(() => {
 addField(field);
 }, index * 50);
 });
 };

 return (
 <div className="mb-4">
 <div className="flex items-center gap-2 mb-2">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className={cn(
 'flex items-center gap-2 flex-1 p-2 rounded-md',
 'text-sm font-medium text-foreground',
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
 <Zap className="w-4 h-4 text-primary" />
 {title}
 </button>
 
 <button
 onClick={handleAddPreset}
 className={cn(
 'px-3 py-1 text-xs rounded-md border',
 'bg-primary text-primary-foreground border-primary',
 'hover:bg-primary/90 transition-colors duration-200',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
 )}
 title={`Add all ${title} fields to canvas`}
 >
 Add All
 </button>
 </div>
 
 {isExpanded && (
 <div className="space-y-2">
 {FIELD_TYPE_DEFINITIONS
 .filter(def => fields.some(field => field.type === def.type))
 .map((definition) => (
 <DraggableFieldItem 
 key={`preset-${definition.type}`} 
 definition={definition}
 isPreset={true}
 />
 ))}
 </div>
 )}
 </div>
 );
};

// Main field palette component
export const FieldPalette: React.FC<FieldPaletteProps> = ({ className }) => {
 const [searchTerm, setSearchTerm] = useState('');
 const [activeTab, setActiveTab] = useState<'fields' | 'presets'>('fields');

 // Filter fields based on search term
 const filteredDefinitions = FIELD_TYPE_DEFINITIONS.filter(def =>
 def.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
 def.description.toLowerCase().includes(searchTerm.toLowerCase())
 );

 const basicFields = getFieldsByCategory('basic').filter(def =>
 filteredDefinitions.includes(def)
 );
 
 const backstageFields = getFieldsByCategory('backstage').filter(def =>
 filteredDefinitions.includes(def)
 );
 
 const advancedFields = getFieldsByCategory('advanced').filter(def =>
 filteredDefinitions.includes(def)
 );

 // Preset configurations
 const presets = [
 {
 title: 'Component',
 fields: getBackstageFieldsForEntityType('Component'),
 },
 {
 title: 'API',
 fields: getBackstageFieldsForEntityType('API'),
 },
 {
 title: 'System',
 fields: getBackstageFieldsForEntityType('System'),
 },
 ];

 return (
 <div className={cn('flex flex-col h-full bg-background border-r border-border', className)}>
 {/* Header */}
 <div className="p-4 border-b border-border">
 <h2 className="text-lg font-semibold text-foreground mb-3">
 Field Palette
 </h2>
 
 {/* Search */}
 <div className="relative mb-3">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Search fields..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className={cn(
 'w-full pl-10 pr-4 py-2 text-sm rounded-md',
 'bg-background border border-input',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
 'placeholder:text-muted-foreground'
 )}
 />
 </div>
 
 {/* Tabs */}
 <div className="flex rounded-md bg-muted p-1">
 <button
 onClick={() => setActiveTab('fields')}
 className={cn(
 'flex-1 px-3 py-1 text-sm font-medium rounded-sm transition-colors',
 activeTab === 'fields'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 )}
 >
 <Layers className="w-4 h-4 inline mr-1" />
 Fields
 </button>
 <button
 onClick={() => setActiveTab('presets')}
 className={cn(
 'flex-1 px-3 py-1 text-sm font-medium rounded-sm transition-colors',
 activeTab === 'presets'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 )}
 >
 <Zap className="w-4 h-4 inline mr-1" />
 Presets
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-4">
 {activeTab === 'fields' ? (
 <div>
 {searchTerm ? (
 // Show filtered results
 <div className="space-y-2">
 {filteredDefinitions.map((definition) => (
 <DraggableFieldItem 
 key={definition.type} 
 definition={definition} 
 />
 ))}
 {filteredDefinitions.length === 0 && (
 <div className="text-center py-8 text-muted-foreground">
 <Search className="w-8 h-8 mx-auto mb-2" />
 <p>No fields match your search.</p>
 </div>
 )}
 </div>
 ) : (
 // Show categorized fields
 <>
 <CategorySection
 title="Basic Fields"
 icon={<Layers className="w-4 h-4" />}
 fields={basicFields}
 defaultExpanded={true}
 />
 
 <CategorySection
 title="Backstage Fields"
 icon={<Settings className="w-4 h-4" />}
 fields={backstageFields}
 defaultExpanded={true}
 />
 
 <CategorySection
 title="Advanced Fields"
 icon={<Zap className="w-4 h-4" />}
 fields={advancedFields}
 defaultExpanded={false}
 />
 </>
 )}
 </div>
 ) : (
 // Presets tab
 <div>
 <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-md">
 <p className="text-sm text-foreground">
 <Zap className="w-4 h-4 inline mr-1 text-primary" />
 Quick-start with pre-configured field sets for common Backstage entities.
 </p>
 </div>
 
 {presets.map((preset) => (
 <PresetSection
 key={preset.title}
 title={preset.title}
 fields={preset.fields}
 />
 ))}
 </div>
 )}
 </div>

 {/* Help text */}
 <div className="p-4 border-t border-border bg-muted/50">
 <p className="text-xs text-muted-foreground">
 TIP: Drag fields onto the canvas to build your form. Use presets for quick setup.
 </p>
 </div>
 </div>
 );
};