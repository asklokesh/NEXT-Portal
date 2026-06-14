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

const FileField: React.FC<FieldProps> = ({ name, onChange, required, disabled, error }) => (
  <Input
    type="file"
    name={name}
    onChange={e => onChange(e.target.value)}
    required={required}
    disabled={disabled}
    aria-invalid={!!error}
  />
);

export default FileField;
