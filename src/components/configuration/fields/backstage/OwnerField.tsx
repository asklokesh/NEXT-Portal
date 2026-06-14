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

const OwnerField: React.FC<FieldProps> = ({ name, value, onChange, required, disabled, error, onBlur }) => (
  <Input
    name={name}
    value={(value as string) ?? ''}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder="group:default/team-name"
    required={required}
    disabled={disabled}
    aria-invalid={!!error}
  />
);

export default OwnerField;
