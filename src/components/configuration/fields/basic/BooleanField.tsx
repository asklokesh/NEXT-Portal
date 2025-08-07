'use client';

import React, { useCallback } from 'react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface BooleanFieldProps {
  name: string;
  schema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onBlur?: () => void;
}

const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  schema,
  config,
  required,
  disabled,
  error,
  value = false,
  onChange,
  onBlur
}) => {
  const handleSwitchChange = useCallback(
    (checked: boolean) => {
      onChange(checked);
      onBlur?.();
    },
    [onChange, onBlur]
  );

  const handleCheckboxChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      onChange(checked === true);
      onBlur?.();
    },
    [onChange, onBlur]
  );

  const handleRadioChange = useCallback(
    (radioValue: string) => {
      onChange(radioValue === 'true');
      onBlur?.();
    },
    [onChange, onBlur]
  );

  // Determine widget type
  const widget = config.widget || 'switch';

  // Labels for true/false options
  const trueLabel = schema['x-true-label'] as string || 'Yes';
  const falseLabel = schema['x-false-label'] as string || 'No';

  switch (widget) {
    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={name}
            checked={value}
            onCheckedChange={handleCheckboxChange}
            disabled={disabled || config.readonly}
            className={cn(
              error && 'border-destructive',
              config.readonly && 'cursor-not-allowed opacity-50'
            )}
            aria-describedby={error ? `${name}-error` : undefined}
            aria-invalid={!!error}
          />
          {(schema.title || schema.description) && (
            <Label
              htmlFor={name}
              className={cn(
                'text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                config.readonly && 'cursor-not-allowed opacity-70'
              )}
            >
              {schema.title || schema.description}
            </Label>
          )}
        </div>
      );

    case 'radio':
      return (
        <RadioGroup
          value={value ? 'true' : 'false'}
          onValueChange={handleRadioChange}
          disabled={disabled || config.readonly}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="true"
              id={`${name}-true`}
              className={cn(
                error && 'border-destructive',
                config.readonly && 'cursor-not-allowed opacity-50'
              )}
            />
            <Label
              htmlFor={`${name}-true`}
              className={cn(
                'text-sm font-normal',
                config.readonly && 'cursor-not-allowed opacity-70'
              )}
            >
              {trueLabel}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="false"
              id={`${name}-false`}
              className={cn(
                error && 'border-destructive',
                config.readonly && 'cursor-not-allowed opacity-50'
              )}
            />
            <Label
              htmlFor={`${name}-false`}
              className={cn(
                'text-sm font-normal',
                config.readonly && 'cursor-not-allowed opacity-70'
              )}
            >
              {falseLabel}
            </Label>
          </div>
        </RadioGroup>
      );

    case 'toggle':
    case 'switch':
    default:
      return (
        <div className="flex items-center space-x-3">
          <Switch
            id={name}
            checked={value}
            onCheckedChange={handleSwitchChange}
            disabled={disabled || config.readonly}
            className={cn(
              config.readonly && 'cursor-not-allowed opacity-50'
            )}
            aria-describedby={error ? `${name}-error` : undefined}
            aria-invalid={!!error}
          />
          
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2 text-sm">
              <span className={cn(
                value ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}>
                {value ? trueLabel : falseLabel}
              </span>
              
              {required && (
                <span className="text-destructive">*</span>
              )}
            </div>
            
            {schema.description && (
              <p className="text-xs text-muted-foreground">
                {schema.description}
              </p>
            )}
          </div>
        </div>
      );
  }
};

export default BooleanField;