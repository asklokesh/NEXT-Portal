'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Search, X, Eye, EyeOff } from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TextFieldProps {
  name: string;
  schema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const TextField: React.FC<TextFieldProps> = ({
  name,
  schema,
  config,
  required,
  disabled,
  error,
  value = '',
  onChange,
  onBlur
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input type
  const inputType = config.fieldType === 'password' 
    ? (showPassword ? 'text' : 'password')
    : 'text';

  // Handle value changes with debouncing if configured
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
    },
    [onChange]
  );

  // Handle blur events
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setShowSuggestions(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  // Handle focus for suggestions
  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  // Handle clear button
  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // Generate suggestions based on schema enum or examples
  useEffect(() => {
    const schemaSuggestions = schema.enum as string[] || [];
    const exampleSuggestions = schema.examples as string[] || [];
    const allSuggestions = [...schemaSuggestions, ...exampleSuggestions];
    
    if (allSuggestions.length > 0) {
      setSuggestions(allSuggestions);
    }
  }, [schema.enum, schema.examples]);

  // Keyboard navigation for suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showSuggestions && suggestions.length > 0) {
        switch (e.key) {
          case 'Escape':
            setShowSuggestions(false);
            break;
          case 'ArrowDown':
            e.preventDefault();
            // Focus first suggestion
            break;
          case 'ArrowUp':
            e.preventDefault();
            // Focus last suggestion
            break;
        }
      }
    },
    [showSuggestions, suggestions]
  );

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder || schema.default as string}
          required={required}
          disabled={disabled}
          readOnly={config.readonly}
          autoFocus={config.autoFocus}
          minLength={schema.minLength}
          maxLength={schema.maxLength}
          pattern={schema.pattern}
          className={cn(
            'pr-20',
            error && 'border-destructive focus-visible:ring-destructive',
            config.readonly && 'bg-muted cursor-not-allowed'
          )}
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={!!error}
        />

        {/* Field actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Clear button */}
          {value && !disabled && !config.readonly && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label="Clear field"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Password visibility toggle */}
          {config.fieldType === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Search icon for search fields */}
          {config.fieldType === 'search' && (
            <Search className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Character count */}
      {schema.maxLength && (
        <div className="mt-1 text-xs text-muted-foreground text-right">
          {value.length} / {schema.maxLength}
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions
            .filter(suggestion => 
              suggestion.toLowerCase().includes(value.toLowerCase())
            )
            .map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors"
              >
                {suggestion}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default TextField;