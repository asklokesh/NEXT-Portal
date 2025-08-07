'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Type, Maximize2, Minimize2 } from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TextAreaFieldProps {
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

const TextAreaField: React.FC<TextAreaFieldProps> = ({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Allow Tab to insert tabs instead of changing focus
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        const newValue = value.substring(0, start) + '\t' + value.substring(end);
        onChange(newValue);
        
        // Restore cursor position after state update
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }, 0);
      }
    },
    [value, onChange]
  );

  // Calculate rows based on content or schema
  const rows = Math.max(
    schema.minLength ? Math.ceil(schema.minLength / 50) : 3,
    Math.min(value.split('\n').length + 1, 20)
  );

  const textareaComponent = (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={config.placeholder || schema.default as string}
        required={required}
        disabled={disabled}
        readOnly={config.readonly}
        rows={isExpanded ? 20 : rows}
        maxLength={schema.maxLength}
        className={cn(
          'resize-y min-h-[80px] font-mono text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
          config.readonly && 'bg-muted cursor-not-allowed'
        )}
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={!!error}
      />

      {/* Expand button */}
      {!isExpanded && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-60 hover:opacity-100"
        >
          <Maximize2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {isExpanded ? (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-4xl max-h-[80vh] p-0">
            <DialogHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  {schema.title || name}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="h-6 w-6 p-0"
                >
                  <Minimize2 className="w-3 h-3" />
                </Button>
              </div>
            </DialogHeader>
            <div className="p-4">
              {textareaComponent}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        textareaComponent
      )}

      {/* Character/word count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="space-x-4">
          <span>{value.length} characters</span>
          <span>{value.split(/\s+/).filter(word => word.length > 0).length} words</span>
          <span>{value.split('\n').length} lines</span>
        </div>
        
        {schema.maxLength && (
          <span className={cn(
            value.length > schema.maxLength * 0.9 && 'text-yellow-600',
            value.length > schema.maxLength && 'text-destructive'
          )}>
            {value.length} / {schema.maxLength}
          </span>
        )}
      </div>
    </div>
  );
};

export default TextAreaField;