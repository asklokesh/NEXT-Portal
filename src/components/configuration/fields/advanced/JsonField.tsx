'use client';
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
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

const JsonField: React.FC<FieldProps> = ({ name, value, onChange, required, disabled, error, onBlur }) => (
  <Textarea
    name={name}
    value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder="{}"
    rows={6}
    required={required}
    disabled={disabled}
    aria-invalid={!!error}
    className="font-mono text-sm"
  />
);

export default JsonField;
