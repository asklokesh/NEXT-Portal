'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { cn } from '@/lib/utils';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface SelectOption {
  label: string;
  value: string | number | boolean;
  description?: string;
  disabled?: boolean;
  group?: string;
}

interface SelectFieldProps {
  name: string;
  schema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
}

// Enhanced select field with search, grouping, and async loading
const SelectField: React.FC<SelectFieldProps> = ({
  name,
  schema,
  config,
  required,
  disabled,
  error,
  value,
  onChange,
  onBlur
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Generate options from schema
  const options = useMemo((): SelectOption[] => {
    const opts: SelectOption[] = [];

    // From schema enum
    if (schema.enum) {
      schema.enum.forEach((enumValue, index) => {
        const enumLabels = schema.enumNames as string[] || [];
        opts.push({
          value: enumValue,
          label: enumLabels[index] || String(enumValue),
          description: schema.description,
        });
      });
    }

    // From schema oneOf
    if (schema.oneOf) {
      schema.oneOf.forEach((option: any) => {
        if (option.const !== undefined) {
          opts.push({
            value: option.const,
            label: option.title || String(option.const),
            description: option.description,
          });
        }
      });
    }

    // From schema anyOf
    if (schema.anyOf) {
      schema.anyOf.forEach((option: any) => {
        if (option.const !== undefined) {
          opts.push({
            value: option.const,
            label: option.title || String(option.const),
            description: option.description,
          });
        }
      });
    }

    // From examples
    if (schema.examples && opts.length === 0) {
      schema.examples.forEach((example: any) => {
        opts.push({
          value: example,
          label: String(example),
        });
      });
    }

    return opts;
  }, [schema]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(query) ||
      option.value.toString().toLowerCase().includes(query) ||
      option.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Group options
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    
    filteredOptions.forEach(option => {
      const group = option.group || 'default';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(option);
    });

    return groups;
  }, [filteredOptions]);

  // Handle selection
  const handleSelect = useCallback(
    (selectedValue: string) => {
      const option = options.find(opt => String(opt.value) === selectedValue);
      onChange(option?.value);
      setIsOpen(false);
      setSearchQuery('');
    },
    [options, onChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  // Get selected option for display
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  // Simple select for small option sets
  if (options.length <= 10 && !config.validation?.async) {
    return (
      <Select
        value={value ? String(value) : undefined}
        onValueChange={handleSelect}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger 
          className={cn(
            error && 'border-destructive focus:ring-destructive',
            config.readonly && 'bg-muted cursor-not-allowed'
          )}
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={!!error}
        >
          <SelectValue 
            placeholder={config.placeholder || 'Select an option...'}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem 
              key={index}
              value={String(option.value)}
              disabled={option.disabled}
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Advanced select with search and grouping
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            'w-full justify-between font-normal',
            !selectedOption && 'text-muted-foreground',
            error && 'border-destructive focus-visible:ring-destructive',
            config.readonly && 'bg-muted cursor-not-allowed'
          )}
          disabled={disabled || config.readonly}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedOption ? (
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="truncate">{selectedOption.label}</span>
                {selectedOption.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedOption.description}
                  </span>
                )}
              </div>
            ) : (
              <span className="truncate">
                {config.placeholder || 'Select an option...'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedOption && !disabled && !config.readonly && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 hover:bg-accent rounded transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className="w-4 h-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        
        <div className="max-h-64 overflow-auto">
          {Object.keys(groupedOptions).length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No options found
            </div>
          ) : (
            Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
              <div key={groupName}>
                {groupName !== 'default' && (
                  <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/50 border-b border-border">
                    {groupName}
                  </div>
                )}
                {groupOptions.map((option, index) => (
                  <button
                    key={`${groupName}-${index}`}
                    onClick={() => handleSelect(String(option.value))}
                    disabled={option.disabled}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors',
                      selectedOption?.value === option.value && 'bg-accent text-accent-foreground',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{option.label}</span>
                          {selectedOption?.value === option.value && (
                            <Check className="w-4 h-4 flex-shrink-0" />
                          )}
                        </div>
                        {option.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SelectField;