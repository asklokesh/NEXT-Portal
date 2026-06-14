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

const TagsField: React.FC<FieldProps> = ({ name, value, onChange, required, disabled, error }) => (
  <Input
    name={name}
    value={Array.isArray(value) ? value.join(', ') : (value as string) ?? ''}
    onChange={e => onChange(e.target.value.split(',').map((t: string) => t.trim()))}
    placeholder="tag1, tag2, tag3"
    required={required}
    disabled={disabled}
    aria-invalid={!!error}
  />
);

export default TagsField;
