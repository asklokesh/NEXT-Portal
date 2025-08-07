'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, ExternalLink, AlertCircle, Check, User, Users, Component, Package } from 'lucide-react';

import type { ConfigurationSchema, FormConfiguration } from '../../types/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useBackstageApi } from '@/hooks/useBackstageApi';

interface EntityReference {
  name: string;
  namespace?: string;
  kind: string;
  apiVersion?: string;
  title?: string;
  description?: string;
  tags?: string[];
  owner?: string;
  lifecycle?: string;
}

interface EntityRefFieldProps {
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

// Entity kind icons
const ENTITY_KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  User: User,
  Group: Users,
  Component: Component,
  API: Package,
  System: Component,
  Domain: Component,
  Resource: Package,
  Location: Package,
};

// Parse entity reference string
function parseEntityRef(entityRef: string): Partial<EntityReference> | null {
  if (!entityRef) return null;

  // Format: [kind:][namespace/]name
  const match = entityRef.match(/^(?:([^:]+):)?(?:([^\/]+)\/)?([^\/]+)$/);
  if (!match) return null;

  const [, kind, namespace, name] = match;
  return {
    kind: kind || 'Component',
    namespace: namespace || 'default',
    name,
  };
}

// Format entity reference string
function formatEntityRef(entity: Partial<EntityReference>): string {
  const { kind = 'Component', namespace = 'default', name } = entity;
  
  if (!name) return '';
  
  let ref = name;
  if (namespace && namespace !== 'default') {
    ref = `${namespace}/${ref}`;
  }
  if (kind && kind !== 'Component') {
    ref = `${kind}:${ref}`;
  }
  
  return ref;
}

const EntityRefField: React.FC<EntityRefFieldProps> = ({
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationState, setValidationState] = useState<'valid' | 'invalid' | 'validating' | null>(null);

  const { catalogApi } = useBackstageApi();

  // Extract entity kind filter from schema
  const allowedKinds = useMemo(() => {
    const backstageConfig = schema['x-backstage-config'];
    if (backstageConfig?.entityPath?.includes('owner')) {
      return ['User', 'Group'];
    }
    
    // From schema enum or examples
    if (schema.enum) {
      return schema.enum as string[];
    }
    
    // Default to common entity kinds
    return ['Component', 'API', 'System', 'Domain', 'Resource', 'User', 'Group'];
  }, [schema]);

  // Parse current value
  const parsedValue = useMemo(() => {
    return parseEntityRef(value);
  }, [value]);

  // Search for entities
  const searchEntities = useCallback(async (query: string) => {
    if (!catalogApi || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const entities = await catalogApi.getEntities({
        filter: {
          kind: allowedKinds,
        },
      });

      const filtered = entities.items
        .filter(entity => {
          const searchText = `${entity.metadata.name} ${entity.metadata.title || ''} ${entity.metadata.description || ''}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        })
        .slice(0, 20)
        .map((entity): EntityReference => ({
          name: entity.metadata.name,
          namespace: entity.metadata.namespace,
          kind: entity.kind,
          title: entity.metadata.title,
          description: entity.metadata.description,
          tags: entity.metadata.tags,
          owner: entity.spec?.owner as string,
          lifecycle: entity.spec?.lifecycle as string,
        }));

      setSuggestions(filtered);
    } catch (err) {
      console.error('Failed to search entities:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [catalogApi, allowedKinds]);

  // Validate entity reference
  const validateEntityRef = useCallback(async (entityRef: string) => {
    if (!entityRef || !catalogApi) {
      setValidationState(null);
      return;
    }

    const parsed = parseEntityRef(entityRef);
    if (!parsed || !parsed.name) {
      setValidationState('invalid');
      return;
    }

    setValidationState('validating');
    try {
      const entity = await catalogApi.getEntityByRef({
        kind: parsed.kind || 'Component',
        namespace: parsed.namespace || 'default',
        name: parsed.name,
      });

      setValidationState(entity ? 'valid' : 'invalid');
    } catch (err) {
      setValidationState('invalid');
    }
  }, [catalogApi]);

  // Handle input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      setSearchQuery(newValue);
      
      // Debounce search
      const timeoutId = setTimeout(() => {
        searchEntities(newValue);
        validateEntityRef(newValue);
      }, 300);

      return () => clearTimeout(timeoutId);
    },
    [onChange, searchEntities, validateEntityRef]
  );

  // Handle entity selection
  const handleEntitySelect = useCallback(
    (entity: EntityReference) => {
      const entityRef = formatEntityRef(entity);
      onChange(entityRef);
      setIsOpen(false);
      setSearchQuery('');
      validateEntityRef(entityRef);
    },
    [onChange, validateEntityRef]
  );

  // Initial validation
  useEffect(() => {
    if (value) {
      validateEntityRef(value);
    }
  }, [value, validateEntityRef]);

  // Get entity kind icon
  const getKindIcon = (kind: string) => {
    const IconComponent = ENTITY_KIND_ICONS[kind] || Component;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={value}
              onChange={handleInputChange}
              onBlur={onBlur}
              placeholder={config.placeholder || 'component:default/my-service'}
              disabled={disabled}
              readOnly={config.readonly}
              className={cn(
                'pr-20',
                error && 'border-destructive focus-visible:ring-destructive',
                validationState === 'valid' && 'border-green-500 focus-visible:ring-green-500',
                validationState === 'invalid' && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-describedby={error ? `${name}-error` : undefined}
              aria-invalid={!!error}
            />

            {/* Validation indicator and actions */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {validationState === 'validating' && (
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              )}
              
              {validationState === 'valid' && (
                <Tooltip content="Entity found">
                  <Check className="w-4 h-4 text-green-500" />
                </Tooltip>
              )}
              
              {validationState === 'invalid' && (
                <Tooltip content="Entity not found">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </Tooltip>
              )}

              {parsedValue && validationState === 'valid' && (
                <Tooltip content="View in catalog">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const url = `/catalog/${parsedValue.namespace || 'default'}/${parsedValue.kind?.toLowerCase() || 'component'}/${parsedValue.name}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Tooltip>
              )}
              
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          {loading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching entities...
            </div>
          )}

          {!loading && suggestions.length === 0 && searchQuery.length >= 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No entities found matching "{searchQuery}"
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="max-h-64 overflow-auto">
              {suggestions.map((entity, index) => (
                <button
                  key={index}
                  onClick={() => handleEntitySelect(entity)}
                  className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors border-b border-border last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getKindIcon(entity.kind)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {entity.title || entity.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {entity.kind}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-mono">
                          {formatEntityRef(entity)}
                        </div>
                        
                        {entity.description && (
                          <p className="line-clamp-2">{entity.description}</p>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {entity.owner && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entity.owner}
                            </span>
                          )}
                          
                          {entity.lifecycle && (
                            <Badge variant="outline" className="text-xs">
                              {entity.lifecycle}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Entity preview */}
      {parsedValue && validationState === 'valid' && (
        <div className="p-3 bg-muted/50 rounded-md border">
          <div className="flex items-center gap-2 text-sm">
            {getKindIcon(parsedValue.kind || 'Component')}
            <span className="font-medium">{parsedValue.kind}</span>
            <span className="text-muted-foreground">in</span>
            <Badge variant="outline">{parsedValue.namespace}</Badge>
          </div>
        </div>
      )}

      {/* Format help */}
      {!value && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Format: [kind:][namespace/]name</p>
          <p>Examples:</p>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            <li className="font-mono">my-service</li>
            <li className="font-mono">default/my-service</li>
            <li className="font-mono">component:default/my-service</li>
            <li className="font-mono">user:jane.doe</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default EntityRefField;