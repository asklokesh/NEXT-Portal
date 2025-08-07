import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';

export interface ImportOptions {
  format?: 'auto' | 'yaml' | 'json' | 'csv' | 'excel';
  validateOnly?: boolean;
  conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'prompt';
  batchSize?: number;
  dryRun?: boolean;
  templateMapping?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  processed: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
  conflicts: ConflictItem[];
  preview?: EntityPreview[];
}

export interface ImportError {
  row?: number;
  field?: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  suggestions?: string[];
}

export interface ConflictItem {
  entityId: string;
  existingEntity: any;
  newEntity: any;
  conflictType: 'duplicate' | 'version' | 'reference';
  resolution?: 'skip' | 'overwrite' | 'merge';
}

export interface EntityPreview {
  id: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    title?: string;
  };
  spec?: any;
  status: 'valid' | 'invalid' | 'warning';
  issues?: string[];
}

export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'processing' | 'importing' | 'complete';
  progress: number;
  message: string;
  processed: number;
  total: number;
}

// Entity validation schemas
const EntityMetadataSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  labels: z.record(z.string()).optional(),
  annotations: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const BaseEntitySchema = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  metadata: EntityMetadataSchema,
  spec: z.any().optional(),
  relations: z.array(z.any()).optional(),
});

export class BulkImporter {
  private progressCallbacks: ((progress: ImportProgress) => void)[] = [];
  private templateCache = new Map<string, any>();
  private validationCache = new Map<string, any>();

  constructor(private options: ImportOptions = {}) {
    this.options = {
      format: 'auto',
      validateOnly: false,
      conflictResolution: 'prompt',
      batchSize: 100,
      dryRun: false,
      ...options,
    };
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: ImportProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  private notifyProgress(progress: ImportProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  /**
   * Import entities from file buffer
   */
  async importFromFile(
    fileBuffer: ArrayBuffer,
    filename: string,
    options?: Partial<ImportOptions>
  ): Promise<ImportResult> {
    const mergedOptions = { ...this.options, ...options };
    
    try {
      this.notifyProgress({
        phase: 'parsing',
        progress: 0,
        message: 'Parsing file...',
        processed: 0,
        total: 0,
      });

      // Detect file format
      const format = await this.detectFormat(fileBuffer, filename, mergedOptions.format);
      
      // Parse file based on format
      const rawData = await this.parseFile(fileBuffer, format);
      
      this.notifyProgress({
        phase: 'validating',
        progress: 25,
        message: 'Validating entities...',
        processed: 0,
        total: rawData.length,
      });

      // Validate and transform entities
      const validationResult = await this.validateEntities(rawData);
      
      if (mergedOptions.validateOnly || mergedOptions.dryRun) {
        return {
          success: validationResult.errors.length === 0,
          processed: validationResult.entities.length,
          imported: 0,
          skipped: 0,
          errors: validationResult.errors,
          conflicts: [],
          preview: validationResult.entities,
        };
      }

      this.notifyProgress({
        phase: 'processing',
        progress: 50,
        message: 'Processing entities...',
        processed: 0,
        total: validationResult.entities.length,
      });

      // Check for conflicts
      const conflicts = await this.detectConflicts(validationResult.entities);
      
      // Resolve conflicts based on strategy
      const resolvedEntities = await this.resolveConflicts(
        validationResult.entities,
        conflicts,
        mergedOptions.conflictResolution
      );

      this.notifyProgress({
        phase: 'importing',
        progress: 75,
        message: 'Importing entities...',
        processed: 0,
        total: resolvedEntities.length,
      });

      // Import in batches
      const importResult = await this.importEntitiesBatch(
        resolvedEntities,
        mergedOptions.batchSize || 100
      );

      this.notifyProgress({
        phase: 'complete',
        progress: 100,
        message: 'Import complete',
        processed: importResult.imported,
        total: validationResult.entities.length,
      });

      return {
        ...importResult,
        errors: [...validationResult.errors, ...importResult.errors],
        conflicts,
      };

    } catch (error) {
      return {
        success: false,
        processed: 0,
        imported: 0,
        skipped: 0,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'IMPORT_FAILED',
          severity: 'error' as const,
        }],
        conflicts: [],
      };
    }
  }

  /**
   * Detect file format
   */
  private async detectFormat(
    buffer: ArrayBuffer,
    filename: string,
    preferredFormat?: string
  ): Promise<string> {
    if (preferredFormat && preferredFormat !== 'auto') {
      return preferredFormat;
    }

    // Check file extension
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'json':
        return 'json';
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'excel';
    }

    // Try to detect by content type
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      if (fileType) {
        switch (fileType.mime) {
          case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          case 'application/vnd.ms-excel':
            return 'excel';
          case 'application/json':
            return 'json';
          case 'text/csv':
            return 'csv';
        }
      }
    } catch (error) {
      // Fallback to content inspection
    }

    // Try to parse as text and guess format
    const text = new TextDecoder().decode(buffer.slice(0, 1000));
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return 'json';
    }
    if (text.includes('apiVersion:') || text.includes('kind:')) {
      return 'yaml';
    }
    if (text.includes(',') && text.includes('\n')) {
      return 'csv';
    }

    throw new Error('Unable to detect file format');
  }

  /**
   * Parse file based on format
   */
  private async parseFile(buffer: ArrayBuffer, format: string): Promise<any[]> {
    switch (format) {
      case 'yaml':
        return this.parseYaml(buffer);
      case 'json':
        return this.parseJson(buffer);
      case 'csv':
        return this.parseCsv(buffer);
      case 'excel':
        return this.parseExcel(buffer);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async parseYaml(buffer: ArrayBuffer): Promise<any[]> {
    const text = new TextDecoder().decode(buffer);
    const documents = yaml.loadAll(text) as any[];
    return documents.filter(doc => doc != null);
  }

  private async parseJson(buffer: ArrayBuffer): Promise<any[]> {
    const text = new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }

  private async parseCsv(buffer: ArrayBuffer): Promise<any[]> {
    const text = new TextDecoder().decode(buffer);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data as any[]);
          }
        },
        error: reject,
      });
    });
  }

  private async parseExcel(buffer: ArrayBuffer): Promise<any[]> {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
    }) as any[][];

    if (data.length === 0) {
      return [];
    }

    // Convert array of arrays to array of objects
    const headers = data[0] as string[];
    return data.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          obj[header.trim()] = row[index];
        }
      });
      return obj;
    });
  }

  /**
   * Validate entities and apply smart templates
   */
  private async validateEntities(rawData: any[]): Promise<{
    entities: EntityPreview[];
    errors: ImportError[];
  }> {
    const entities: EntityPreview[] = [];
    const errors: ImportError[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      
      try {
        // Apply smart template matching
        const entityData = await this.applySmartTemplate(item, i);
        
        // Validate entity structure
        const validation = BaseEntitySchema.safeParse(entityData);
        
        if (validation.success) {
          const entity = validation.data;
          const preview: EntityPreview = {
            id: `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
            kind: entity.kind,
            metadata: entity.metadata,
            spec: entity.spec,
            status: 'valid',
            issues: [],
          };

          // Additional validation checks
          const issues = await this.performAdditionalValidation(entity);
          if (issues.length > 0) {
            preview.status = 'warning';
            preview.issues = issues;
          }

          entities.push(preview);
        } else {
          errors.push({
            row: i + 1,
            message: 'Entity validation failed',
            code: 'VALIDATION_ERROR',
            severity: 'error',
            suggestions: validation.error.issues.map(issue => 
              `${issue.path.join('.')}: ${issue.message}`
            ),
          });
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PROCESSING_ERROR',
          severity: 'error',
        });
      }
    }

    return { entities, errors };
  }

  /**
   * Apply smart template matching and auto-completion
   */
  private async applySmartTemplate(item: any, index: number): Promise<any> {
    // If item is already a valid entity, return as-is
    if (item.apiVersion && item.kind && item.metadata) {
      return item;
    }

    // Detect entity type based on available fields
    const detectedKind = this.detectEntityKind(item);
    
    // Get template for detected kind
    const template = await this.getTemplate(detectedKind);
    
    // Apply template and fill in data
    return this.applyTemplate(template, item, index);
  }

  private detectEntityKind(item: any): string {
    const keys = Object.keys(item).map(k => k.toLowerCase());
    
    // Service detection
    if (keys.some(k => ['service', 'app', 'application'].includes(k)) ||
        keys.includes('port') || keys.includes('url')) {
      return 'Service';
    }
    
    // Component detection  
    if (keys.some(k => ['component', 'library', 'repo'].includes(k)) ||
        keys.includes('language') || keys.includes('framework')) {
      return 'Component';
    }
    
    // API detection
    if (keys.some(k => ['api', 'endpoint', 'swagger'].includes(k)) ||
        keys.includes('openapi') || keys.includes('spec')) {
      return 'API';
    }
    
    // Resource detection
    if (keys.some(k => ['resource', 'database', 'storage'].includes(k)) ||
        keys.includes('provider') || keys.includes('connection')) {
      return 'Resource';
    }

    return 'Component'; // Default fallback
  }

  private async getTemplate(kind: string): Promise<any> {
    if (this.templateCache.has(kind)) {
      return this.templateCache.get(kind);
    }

    let template;
    switch (kind) {
      case 'Service':
        template = await import('../templates/ServiceTemplate');
        break;
      case 'Component':
        template = await import('../templates/ComponentTemplate');
        break;
      case 'API':
        template = await import('../templates/APITemplate');
        break;
      case 'Resource':
        template = await import('../templates/ResourceTemplate');
        break;
      default:
        template = await import('../templates/ComponentTemplate');
    }

    this.templateCache.set(kind, template.default);
    return template.default;
  }

  private applyTemplate(template: any, data: any, index: number): any {
    return template.transform(data, { rowIndex: index });
  }

  /**
   * Perform additional validation checks
   */
  private async performAdditionalValidation(entity: any): Promise<string[]> {
    const issues: string[] = [];

    // Check naming conventions
    if (!entity.metadata.name.match(/^[a-z0-9-]+$/)) {
      issues.push('Name should contain only lowercase letters, numbers, and hyphens');
    }

    // Check for required annotations
    if (entity.kind === 'Service' && !entity.metadata.annotations?.['backstage.io/source-location']) {
      issues.push('Service entities should have a source-location annotation');
    }

    // Check for dependencies validation
    if (entity.spec?.dependsOn) {
      const dependencies = Array.isArray(entity.spec.dependsOn) 
        ? entity.spec.dependsOn 
        : [entity.spec.dependsOn];
      
      for (const dep of dependencies) {
        if (typeof dep === 'string' && !dep.includes(':')) {
          issues.push(`Dependency "${dep}" should be in format "kind:namespace/name"`);
        }
      }
    }

    return issues;
  }

  /**
   * Detect conflicts with existing entities
   */
  private async detectConflicts(entities: EntityPreview[]): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = [];
    
    // This would normally check against the actual catalog
    // For now, we'll simulate conflict detection
    for (const entity of entities) {
      const existingEntity = await this.findExistingEntity(entity.id);
      if (existingEntity) {
        conflicts.push({
          entityId: entity.id,
          existingEntity,
          newEntity: entity,
          conflictType: 'duplicate',
        });
      }
    }

    return conflicts;
  }

  private async findExistingEntity(entityId: string): Promise<any | null> {
    // In a real implementation, this would query the Backstage catalog
    // For now, return null (no conflicts)
    return null;
  }

  /**
   * Resolve conflicts based on strategy
   */
  private async resolveConflicts(
    entities: EntityPreview[],
    conflicts: ConflictItem[],
    strategy: string
  ): Promise<EntityPreview[]> {
    const conflictMap = new Map(conflicts.map(c => [c.entityId, c]));
    
    return entities.filter(entity => {
      const conflict = conflictMap.get(entity.id);
      if (!conflict) return true;

      switch (strategy) {
        case 'skip':
          return false;
        case 'overwrite':
          return true;
        case 'merge':
          // Implement merge logic
          return true;
        case 'prompt':
          // This would need UI interaction
          return true;
        default:
          return false;
      }
    });
  }

  /**
   * Import entities in batches
   */
  private async importEntitiesBatch(
    entities: EntityPreview[],
    batchSize: number
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: ImportError[] = [];

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      this.notifyProgress({
        phase: 'importing',
        progress: 75 + (i / entities.length) * 20,
        message: `Importing batch ${Math.floor(i / batchSize) + 1}...`,
        processed: i,
        total: entities.length,
      });

      try {
        const result = await this.importBatch(batch);
        imported += result.imported;
        skipped += result.skipped;
        errors.push(...result.errors);
      } catch (error) {
        errors.push({
          message: `Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'BATCH_IMPORT_ERROR',
          severity: 'error',
        });
        skipped += batch.length;
      }
    }

    return {
      success: errors.filter(e => e.severity === 'error').length === 0,
      processed: entities.length,
      imported,
      skipped,
      errors,
      conflicts: [],
    };
  }

  private async importBatch(entities: EntityPreview[]): Promise<{
    imported: number;
    skipped: number;
    errors: ImportError[];
  }> {
    // In a real implementation, this would call the Backstage catalog API
    // For now, simulate successful import
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      imported: entities.length,
      skipped: 0,
      errors: [],
    };
  }

  /**
   * Create import template for a specific entity kind
   */
  static async createImportTemplate(
    kind: string,
    format: 'csv' | 'excel' | 'yaml' | 'json',
    sampleCount = 3
  ): Promise<ArrayBuffer> {
    const template = await this.getTemplateForKind(kind);
    const sampleData = template.generateSamples(sampleCount);

    switch (format) {
      case 'csv':
        return this.generateCsvTemplate(sampleData);
      case 'excel':
        return this.generateExcelTemplate(sampleData);
      case 'yaml':
        return this.generateYamlTemplate(sampleData);
      case 'json':
        return this.generateJsonTemplate(sampleData);
      default:
        throw new Error(`Unsupported template format: ${format}`);
    }
  }

  private static async getTemplateForKind(kind: string): Promise<any> {
    switch (kind) {
      case 'Service':
        return (await import('../templates/ServiceTemplate')).default;
      case 'Component':
        return (await import('../templates/ComponentTemplate')).default;
      case 'API':
        return (await import('../templates/APITemplate')).default;
      case 'Resource':
        return (await import('../templates/ResourceTemplate')).default;
      default:
        throw new Error(`Unknown entity kind: ${kind}`);
    }
  }

  private static generateCsvTemplate(data: any[]): ArrayBuffer {
    if (data.length === 0) return new ArrayBuffer(0);
    
    const csv = Papa.unparse(data);
    return new TextEncoder().encode(csv).buffer;
  }

  private static generateExcelTemplate(data: any[]): ArrayBuffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template');
    
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }).buffer;
  }

  private static generateYamlTemplate(data: any[]): ArrayBuffer {
    const yamlContent = data.map(item => yaml.dump(item)).join('---\n');
    return new TextEncoder().encode(yamlContent).buffer;
  }

  private static generateJsonTemplate(data: any[]): ArrayBuffer {
    const jsonContent = JSON.stringify(data, null, 2);
    return new TextEncoder().encode(jsonContent).buffer;
  }
}

export default BulkImporter;