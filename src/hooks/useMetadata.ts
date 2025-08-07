import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MetadataSchema, 
  metadataSchemaManager 
} from '@/lib/metadata/MetadataSchemaManager';
import { 
  MetadataFormData, 
  MetadataApiResponse, 
  BulkUpdateResult,
  FormValidationError,
  MetadataUsageStats
} from '@/types/metadata';
import { MetadataUtils } from '@/lib/metadata/utils';

// API client for metadata operations
class MetadataApiClient {
  private baseUrl = '/api/catalog/metadata';

  async getSchemas(params?: { entityKind?: string; active?: boolean }): Promise<MetadataSchema[]> {
    const searchParams = new URLSearchParams();
    if (params?.entityKind) searchParams.set('entityKind', params.entityKind);
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());
    
    const response = await fetch(`${this.baseUrl}/schemas?${searchParams}`);
    const result: MetadataApiResponse<MetadataSchema[]> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch schemas');
    }
    
    return result.data || [];
  }

  async createSchema(schema: Omit<MetadataSchema, 'id' | 'created' | 'updated'>): Promise<MetadataSchema> {
    const response = await fetch(`${this.baseUrl}/schemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schema),
    });
    
    const result: MetadataApiResponse<MetadataSchema> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create schema');
    }
    
    return result.data!;
  }

  async updateSchema(id: string, updates: Partial<MetadataSchema>): Promise<MetadataSchema> {
    const response = await fetch(`${this.baseUrl}/schemas?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    const result: MetadataApiResponse<MetadataSchema> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update schema');
    }
    
    return result.data!;
  }

  async deleteSchema(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/schemas?id=${id}`, {
      method: 'DELETE',
    });
    
    const result: MetadataApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete schema');
    }
  }

  async updateMetadata(data: {
    entityId: string;
    schemaId: string;
    data: MetadataFormData;
    generateBackstageYaml?: boolean;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    const result: MetadataApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update metadata');
    }
    
    return result.data;
  }

  async bulkUpdateMetadata(data: {
    schemaId: string;
    updates: Array<{ entityId: string; data: MetadataFormData }>;
    generateBackstageYaml?: boolean;
  }): Promise<BulkUpdateResult> {
    const response = await fetch(`${this.baseUrl}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    const result: MetadataApiResponse<BulkUpdateResult> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to bulk update metadata');
    }
    
    return result.data!;
  }

  async validateMetadata(schemaId: string, data: MetadataFormData): Promise<any> {
    const response = await fetch(`${this.baseUrl}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaId, data }),
    });
    
    const result: MetadataApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to validate metadata');
    }
    
    return result.data;
  }

  async exportSchema(id: string, format: 'json' | 'download' = 'json'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/schemas/${id}/export?format=${format}`);
    
    if (format === 'download') {
      return response.blob();
    }
    
    const result: MetadataApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to export schema');
    }
    
    return result.data;
  }

  async importSchema(schemaJson: string, overwriteExisting = false): Promise<MetadataSchema> {
    const response = await fetch(`${this.baseUrl}/schemas/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaJson, overwriteExisting }),
    });
    
    const result: MetadataApiResponse<MetadataSchema> = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to import schema');
    }
    
    return result.data!;
  }
}

const apiClient = new MetadataApiClient();

/**
 * Hook for managing metadata schemas
 */
export function useMetadataSchemas(entityKind?: string) {
  const queryClient = useQueryClient();
  
  const {
    data: schemas,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['metadata-schemas', entityKind],
    queryFn: () => apiClient.getSchemas({ entityKind, active: true }),
  });

  const createSchemaMutation = useMutation({
    mutationFn: apiClient.createSchema,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-schemas'] });
    },
  });

  const updateSchemaMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MetadataSchema> }) =>
      apiClient.updateSchema(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-schemas'] });
    },
  });

  const deleteSchemaMutation = useMutation({
    mutationFn: apiClient.deleteSchema,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-schemas'] });
    },
  });

  const importSchemaMutation = useMutation({
    mutationFn: ({ schemaJson, overwriteExisting }: { schemaJson: string; overwriteExisting: boolean }) =>
      apiClient.importSchema(schemaJson, overwriteExisting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-schemas'] });
    },
  });

  return {
    schemas: schemas || [],
    isLoading,
    error,
    refetch,
    createSchema: createSchemaMutation.mutate,
    updateSchema: updateSchemaMutation.mutate,
    deleteSchema: deleteSchemaMutation.mutate,
    importSchema: importSchemaMutation.mutate,
    isCreating: createSchemaMutation.isPending,
    isUpdating: updateSchemaMutation.isPending,
    isDeleting: deleteSchemaMutation.isPending,
    isImporting: importSchemaMutation.isPending,
  };
}

/**
 * Hook for managing metadata for a specific entity
 */
export function useEntityMetadata(
  entityId: string,
  schemaId: string,
  initialData: MetadataFormData = {}
) {
  const [formData, setFormData] = useState<MetadataFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const schema = metadataSchemaManager.getSchema(schemaId);

  // Initialize form data when schema loads
  useEffect(() => {
    if (schema) {
      const initialized = MetadataUtils.initializeFormData(schema, initialData);
      setFormData(initialized);
    }
  }, [schema, initialData]);

  // Validate form data when it changes
  useEffect(() => {
    if (schema) {
      const validationErrors = MetadataUtils.validateFormData(schema, formData);
      const errorMap: Record<string, string> = {};
      
      validationErrors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      
      setErrors(errorMap);
      setIsValid(validationErrors.length === 0);
    }
  }, [schema, formData]);

  const updateMetadataMutation = useMutation({
    mutationFn: (data: { data: MetadataFormData; generateBackstageYaml?: boolean }) =>
      apiClient.updateMetadata({
        entityId,
        schemaId,
        data: data.data,
        generateBackstageYaml: data.generateBackstageYaml,
      }),
  });

  const validateMetadataMutation = useMutation({
    mutationFn: (data: MetadataFormData) => 
      apiClient.validateMetadata(schemaId, data),
  });

  const updateField = useCallback((fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);
    
    // Clear field-specific error
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  const resetForm = useCallback(() => {
    if (schema) {
      const initialized = MetadataUtils.initializeFormData(schema, initialData);
      setFormData(initialized);
      setErrors({});
      setIsDirty(false);
    }
  }, [schema, initialData]);

  const saveMetadata = useCallback(async (generateBackstageYaml = false) => {
    if (!isValid) {
      throw new Error('Form has validation errors');
    }
    
    const result = await updateMetadataMutation.mutateAsync({ 
      data: formData, 
      generateBackstageYaml 
    });
    
    setIsDirty(false);
    return result;
  }, [formData, isValid, updateMetadataMutation]);

  const validateForm = useCallback(async () => {
    return await validateMetadataMutation.mutateAsync(formData);
  }, [formData, validateMetadataMutation]);

  return {
    schema,
    formData,
    errors,
    isValid,
    isDirty,
    updateField,
    resetForm,
    saveMetadata,
    validateForm,
    isSaving: updateMetadataMutation.isPending,
    isValidating: validateMetadataMutation.isPending,
    saveError: updateMetadataMutation.error,
    validationResult: validateMetadataMutation.data,
  };
}

/**
 * Hook for bulk metadata operations
 */
export function useBulkMetadata() {
  const bulkUpdateMutation = useMutation({
    mutationFn: apiClient.bulkUpdateMetadata,
  });

  const bulkUpdate = useCallback(async (
    schemaId: string,
    updates: Array<{ entityId: string; data: MetadataFormData }>,
    generateBackstageYaml = false
  ) => {
    return await bulkUpdateMutation.mutateAsync({
      schemaId,
      updates,
      generateBackstageYaml,
    });
  }, [bulkUpdateMutation]);

  return {
    bulkUpdate,
    isUpdating: bulkUpdateMutation.isPending,
    result: bulkUpdateMutation.data,
    error: bulkUpdateMutation.error,
  };
}

/**
 * Hook for metadata validation
 */
export function useMetadataValidation(schema: MetadataSchema | null) {
  const [validationCache, setValidationCache] = useState<Map<string, FormValidationError[]>>(new Map());

  const validateData = useCallback((data: MetadataFormData): FormValidationError[] => {
    if (!schema) return [];
    
    const cacheKey = JSON.stringify(data);
    const cached = validationCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const errors = MetadataUtils.validateFormData(schema, data);
    
    // Cache the result
    setValidationCache(prev => new Map(prev).set(cacheKey, errors));
    
    return errors;
  }, [schema, validationCache]);

  const validateField = useCallback((fieldName: string, value: any, formData: MetadataFormData): string | null => {
    if (!schema) return null;
    
    const field = schema.fields.find(f => f.name === fieldName);
    if (!field) return null;
    
    // Create temporary data with the new value
    const tempData = { ...formData, [fieldName]: value };
    const errors = MetadataUtils.validateFormData(schema, tempData);
    
    const fieldError = errors.find(e => e.field === fieldName);
    return fieldError ? fieldError.message : null;
  }, [schema]);

  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  return {
    validateData,
    validateField,
    clearCache,
  };
}

/**
 * Hook for schema analytics and insights
 */
export function useSchemaAnalytics(schemaId: string) {
  const [usageStats, setUsageStats] = useState<MetadataUsageStats | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculateStats = useCallback(async (entityData: Array<{ entityId: string; data: MetadataFormData }>) => {
    setIsLoading(true);
    
    try {
      const schema = metadataSchemaManager.getSchema(schemaId);
      if (!schema) {
        throw new Error('Schema not found');
      }
      
      const stats = MetadataUtils.calculateUsageStats(schema, entityData);
      const schemaInsights = MetadataUtils.generateSchemaInsights(schema, stats);
      
      setUsageStats(stats);
      setInsights(schemaInsights);
    } catch (error) {
      console.error('Failed to calculate schema analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [schemaId]);

  return {
    usageStats,
    insights,
    isLoading,
    calculateStats,
  };
}

/**
 * Hook for managing schema export/import
 */
export function useSchemaImportExport() {
  const exportSchemaMutation = useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'json' | 'download' }) =>
      apiClient.exportSchema(id, format),
  });

  const importSchemaMutation = useMutation({
    mutationFn: ({ schemaJson, overwriteExisting }: { schemaJson: string; overwriteExisting: boolean }) =>
      apiClient.importSchema(schemaJson, overwriteExisting),
  });

  const exportSchema = useCallback(async (id: string, format: 'json' | 'download' = 'json') => {
    return await exportSchemaMutation.mutateAsync({ id, format });
  }, [exportSchemaMutation]);

  const importSchema = useCallback(async (schemaJson: string, overwriteExisting = false) => {
    return await importSchemaMutation.mutateAsync({ schemaJson, overwriteExisting });
  }, [importSchemaMutation]);

  return {
    exportSchema,
    importSchema,
    isExporting: exportSchemaMutation.isPending,
    isImporting: importSchemaMutation.isPending,
    exportError: exportSchemaMutation.error,
    importError: importSchemaMutation.error,
  };
}