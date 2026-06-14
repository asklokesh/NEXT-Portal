'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';

interface FieldProps {
  name: string;
  schema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: string | number | boolean | string[];
  onChange: (value: any) => void;
  onBlur?: () => void;
}

const ApiEndpointField: React.FC<FieldProps> = ({ name, value, onChange, required, disabled, error, onBlur }) => (
  <Input
    type="url"
    name={name}
    value={(value as string) ?? ''}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder="https://api.example.com/v1"
    required={required}
    disabled={disabled}
    aria-invalid={!!error}
  />
);

export default ApiEndpointField;
