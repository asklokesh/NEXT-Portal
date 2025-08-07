'use client';

import React, { Suspense, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../types/schema';
import { Tooltip } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/Skeleton';

// Dynamic field component imports
const TextFieldComponent = React.lazy(() => import('./basic/TextField'));
const TextAreaFieldComponent = React.lazy(() => import('./basic/TextAreaField'));
const NumberFieldComponent = React.lazy(() => import('./basic/NumberField'));
const BooleanFieldComponent = React.lazy(() => import('./basic/BooleanField'));
const SelectFieldComponent = React.lazy(() => import('./basic/SelectField'));
const MultiSelectFieldComponent = React.lazy(() => import('./basic/MultiSelectField'));
const CodeFieldComponent = React.lazy(() => import('./advanced/CodeField'));
const FileFieldComponent = React.lazy(() => import('./advanced/FileField'));
const ColorFieldComponent = React.lazy(() => import('./basic/ColorField'));
const DateFieldComponent = React.lazy(() => import('./basic/DateField'));
const TimeFieldComponent = React.lazy(() => import('./basic/TimeField'));
const DateTimeFieldComponent = React.lazy(() => import('./basic/DateTimeField'));
const UrlFieldComponent = React.lazy(() => import('./basic/UrlField'));
const EmailFieldComponent = React.lazy(() => import('./basic/EmailField'));
const PasswordFieldComponent = React.lazy(() => import('./basic/PasswordField'));
const RangeFieldComponent = React.lazy(() => import('./basic/RangeField'));
const TagsFieldComponent = React.lazy(() => import('./advanced/TagsField'));
const JsonFieldComponent = React.lazy(() => import('./advanced/JsonField'));
const YamlFieldComponent = React.lazy(() => import('./advanced/YamlField'));
const DockerImageFieldComponent = React.lazy(() => import('./backstage/DockerImageField'));
const KubernetesResourceFieldComponent = React.lazy(() => import('./backstage/KubernetesResourceField'));
const ApiEndpointFieldComponent = React.lazy(() => import('./advanced/ApiEndpointField'));
const EntityRefFieldComponent = React.lazy(() => import('./backstage/EntityRefField'));
const OwnerFieldComponent = React.lazy(() => import('./backstage/OwnerField'));

interface FieldRendererProps {
  name: string;
  fieldSchema: ConfigurationSchema;
  config: FormConfiguration;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

interface FieldComponentProps {
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

// Field type mapping
const FIELD_COMPONENTS: Record<string, React.ComponentType<FieldComponentProps>> = {
  text: TextFieldComponent,
  textarea: TextAreaFieldComponent,
  number: NumberFieldComponent,
  boolean: BooleanFieldComponent,
  select: SelectFieldComponent,
  multiselect: MultiSelectFieldComponent,
  code: CodeFieldComponent,
  file: FileFieldComponent,
  color: ColorFieldComponent,
  date: DateFieldComponent,
  time: TimeFieldComponent,
  datetime: DateTimeFieldComponent,
  url: UrlFieldComponent,
  email: EmailFieldComponent,
  password: PasswordFieldComponent,
  range: RangeFieldComponent,
  tags: TagsFieldComponent,
  json: JsonFieldComponent,
  yaml: YamlFieldComponent,
  'docker-image': DockerImageFieldComponent,
  'kubernetes-resource': KubernetesResourceFieldComponent,
  'api-endpoint': ApiEndpointFieldComponent,
  'entity-ref': EntityRefFieldComponent,
  owner: OwnerFieldComponent,
};

// Determine field type from schema and configuration
function determineFieldType(
  fieldSchema: ConfigurationSchema,
  config: FormConfiguration
): string {
  // Explicit field type from configuration
  if (config.fieldType) {
    return config.fieldType;
  }

  // Infer from JSON Schema
  if (fieldSchema.type) {
    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.format === 'email') return 'email';
        if (fieldSchema.format === 'uri' || fieldSchema.format === 'url') return 'url';
        if (fieldSchema.format === 'password') return 'password';
        if (fieldSchema.format === 'date') return 'date';
        if (fieldSchema.format === 'time') return 'time';
        if (fieldSchema.format === 'date-time') return 'datetime';
        if (fieldSchema.enum && fieldSchema.enum.length > 0) return 'select';
        if (fieldSchema.maxLength && fieldSchema.maxLength > 100) return 'textarea';
        return 'text';

      case 'number':
      case 'integer':
        if (fieldSchema.minimum !== undefined && fieldSchema.maximum !== undefined) {
          return 'range';
        }
        return 'number';

      case 'boolean':
        return 'boolean';

      case 'array':
        if (fieldSchema.items && (fieldSchema.items as ConfigurationSchema).enum) {
          return 'multiselect';
        }
        if (fieldSchema['x-form-config']?.fieldType === 'tags') {
          return 'tags';
        }
        return 'multiselect';

      case 'object':
        if (config.fieldType === 'json') return 'json';
        if (config.fieldType === 'yaml') return 'yaml';
        return 'json';

      default:
        return 'text';
    }
  }

  // Fallback
  return 'text';
}

// Field wrapper component with label, help, and error display
interface FieldWrapperProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  help?: FormConfiguration['help'];
  children: React.ReactNode;
}

const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  description,
  required,
  error,
  help,
  children
}) => {
  return (
    <div className="space-y-2">
      {/* Label and help */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        
        {help && (
          <div className="flex items-center gap-1">
            {help.text && (
              <Tooltip content={help.text}>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            
            {help.link && (
              <Tooltip content="View documentation">
                <a
                  href={help.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {/* Field component */}
      <div className="relative">
        {children}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// Skeleton loader for field components
const FieldSkeleton: React.FC = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// Main field renderer component
export const FieldRenderer: React.FC<FieldRendererProps> = ({
  name,
  fieldSchema,
  config,
  required,
  disabled,
  error,
  className = ''
}) => {
  const { control } = useFormContext();

  // Determine field type and component
  const fieldType = useMemo(
    () => determineFieldType(fieldSchema, config),
    [fieldSchema, config]
  );

  const FieldComponent = FIELD_COMPONENTS[fieldType] || TextFieldComponent;

  // Extract field properties
  const label = fieldSchema.title || name;
  const description = fieldSchema.description;

  return (
    <div className={`field-renderer ${className}`}>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange, onBlur } }) => (
          <FieldWrapper
            label={label}
            description={description}
            required={required}
            error={error}
            help={config.help}
          >
            <Suspense fallback={<FieldSkeleton />}>
              <FieldComponent
                name={name}
                schema={fieldSchema}
                config={config}
                required={required}
                disabled={disabled}
                error={error}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
              />
            </Suspense>
          </FieldWrapper>
        )}
      />
    </div>
  );
};

export default FieldRenderer;