import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { z } from 'zod';

export interface ExportOptions {
  format: 'yaml' | 'json' | 'csv' | 'excel' | 'zip';
  filters?: ExportFilters;
  template?: string;
  includeMetadata?: boolean;
  compression?: boolean;
  filename?: string;
  fields?: string[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExportFilters {
  kinds?: string[];
  namespaces?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];
  owners?: string[];
  lifecycle?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
    field?: 'created' | 'updated';
  };
  customQuery?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  format: string;
  fileBuffer: ArrayBuffer;
  metadata: ExportMetadata;
  statistics: ExportStatistics;
}

export interface ExportMetadata {
  exportedAt: Date;
  totalEntities: number;
  filteredEntities: number;
  exportedBy?: string;
  filters: ExportFilters;
  schema: string;
  version: string;
}

export interface ExportStatistics {
  entitiesByKind: Record<string, number>;
  entitiesByNamespace: Record<string, number>;
  entitiesByOwner: Record<string, number>;
  totalSize: number;
  compressionRatio?: number;
}

export interface ExportProgress {
  phase: 'querying' | 'transforming' | 'formatting' | 'compressing' | 'complete';
  progress: number;
  message: string;
  processed: number;
  total: number;
}

export interface CustomExportTemplate {
  name: string;
  description: string;
  fields: ExportField[];
  transformations?: ExportTransformation[];
  grouping?: ExportGrouping;
  formatting?: ExportFormatting;
}

export interface ExportField {
  name: string;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required?: boolean;
  defaultValue?: any;
  transform?: (value: any, entity: any) => any;
}

export interface ExportTransformation {
  field: string;
  operation: 'map' | 'filter' | 'aggregate' | 'format';
  config: any;
}

export interface ExportGrouping {
  field: string;
  separateSheets?: boolean;
  separateFiles?: boolean;
}

export interface ExportFormatting {
  dateFormat?: string;
  numberFormat?: string;
  booleanFormat?: 'true/false' | 'yes/no' | '1/0';
  arrayFormat?: 'comma' | 'pipe' | 'newline';
}

export class BulkExporter {
  private progressCallbacks: ((progress: ExportProgress) => void)[] = [];
  private templateCache = new Map<string, CustomExportTemplate>();

  constructor(private defaultOptions: Partial<ExportOptions> = {}) {}

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: ExportProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  private notifyProgress(progress: ExportProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  /**
   * Export entities with specified options
   */
  async exportEntities(
    entities: any[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      this.notifyProgress({
        phase: 'querying',
        progress: 0,
        message: 'Filtering entities...',
        processed: 0,
        total: entities.length,
      });

      // Apply filters
      const filteredEntities = await this.applyFilters(entities, mergedOptions.filters);

      this.notifyProgress({
        phase: 'transforming',
        progress: 25,
        message: 'Transforming data...',
        processed: 0,
        total: filteredEntities.length,
      });

      // Apply template transformation
      const transformedData = await this.applyTemplate(filteredEntities, mergedOptions);

      this.notifyProgress({
        phase: 'formatting',
        progress: 50,
        message: `Formatting as ${mergedOptions.format}...`,
        processed: 0,
        total: transformedData.length,
      });

      // Format data
      const formattedBuffer = await this.formatData(transformedData, mergedOptions);

      let finalBuffer = formattedBuffer;
      let compressionRatio: number | undefined;

      if (mergedOptions.compression && mergedOptions.format !== 'zip') {
        this.notifyProgress({
          phase: 'compressing',
          progress: 75,
          message: 'Compressing file...',
          processed: transformedData.length,
          total: transformedData.length,
        });

        const zip = new JSZip();
        const filename = this.generateFilename(mergedOptions);
        zip.file(filename, formattedBuffer);
        finalBuffer = await zip.generateAsync({ type: 'arraybuffer' });
        compressionRatio = finalBuffer.byteLength / formattedBuffer.byteLength;
      }

      // Generate metadata and statistics
      const metadata = this.generateMetadata(
        entities,
        filteredEntities,
        mergedOptions
      );

      const statistics = this.generateStatistics(
        filteredEntities,
        finalBuffer.byteLength,
        compressionRatio
      );

      this.notifyProgress({
        phase: 'complete',
        progress: 100,
        message: 'Export complete',
        processed: transformedData.length,
        total: transformedData.length,
      });

      return {
        success: true,
        filename: this.generateFilename(mergedOptions),
        format: mergedOptions.format,
        fileBuffer: finalBuffer,
        metadata,
        statistics,
      };

    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply filters to entities
   */
  private async applyFilters(
    entities: any[],
    filters?: ExportFilters
  ): Promise<any[]> {
    if (!filters) return entities;

    let filtered = entities;

    // Filter by kinds
    if (filters.kinds && filters.kinds.length > 0) {
      filtered = filtered.filter(entity => 
        filters.kinds!.includes(entity.kind)
      );
    }

    // Filter by namespaces
    if (filters.namespaces && filters.namespaces.length > 0) {
      filtered = filtered.filter(entity =>
        filters.namespaces!.includes(entity.metadata?.namespace || 'default')
      );
    }

    // Filter by labels
    if (filters.labels) {
      filtered = filtered.filter(entity => {
        const labels = entity.metadata?.labels || {};
        return Object.entries(filters.labels!).every(([key, value]) =>
          labels[key] === value
        );
      });
    }

    // Filter by annotations
    if (filters.annotations) {
      filtered = filtered.filter(entity => {
        const annotations = entity.metadata?.annotations || {};
        return Object.entries(filters.annotations!).every(([key, value]) =>
          annotations[key] === value
        );
      });
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(entity => {
        const tags = entity.metadata?.tags || [];
        return filters.tags!.some(tag => tags.includes(tag));
      });
    }

    // Filter by owners
    if (filters.owners && filters.owners.length > 0) {
      filtered = filtered.filter(entity => {
        const owner = entity.spec?.owner || entity.metadata?.annotations?.['backstage.io/owner'];
        return owner && filters.owners!.includes(owner);
      });
    }

    // Filter by lifecycle
    if (filters.lifecycle && filters.lifecycle.length > 0) {
      filtered = filtered.filter(entity =>
        entity.spec?.lifecycle && filters.lifecycle!.includes(entity.spec.lifecycle)
      );
    }

    // Filter by date range
    if (filters.dateRange) {
      filtered = filtered.filter(entity => {
        const dateField = filters.dateRange!.field === 'updated' 
          ? entity.metadata?.updatedAt 
          : entity.metadata?.createdAt;
        
        if (!dateField) return true;
        
        const date = new Date(dateField);
        const { from, to } = filters.dateRange!;
        
        if (from && date < from) return false;
        if (to && date > to) return false;
        
        return true;
      });
    }

    return filtered;
  }

  /**
   * Apply template transformation
   */
  private async applyTemplate(
    entities: any[],
    options: ExportOptions
  ): Promise<any[]> {
    if (!options.template) {
      return entities;
    }

    const template = await this.getTemplate(options.template);
    if (!template) {
      return entities;
    }

    return entities.map(entity => this.transformEntity(entity, template));
  }

  private async getTemplate(templateName: string): Promise<CustomExportTemplate | null> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Load built-in templates
    try {
      const template = await this.loadBuiltInTemplate(templateName);
      if (template) {
        this.templateCache.set(templateName, template);
        return template;
      }
    } catch (error) {
      console.warn(`Failed to load template "${templateName}":`, error);
    }

    return null;
  }

  private async loadBuiltInTemplate(templateName: string): Promise<CustomExportTemplate | null> {
    const templates: Record<string, CustomExportTemplate> = {
      'service-summary': {
        name: 'Service Summary',
        description: 'Basic service information for reporting',
        fields: [
          { name: 'Name', path: 'metadata.name', type: 'string', required: true },
          { name: 'Namespace', path: 'metadata.namespace', type: 'string', defaultValue: 'default' },
          { name: 'Title', path: 'metadata.title', type: 'string' },
          { name: 'Description', path: 'metadata.description', type: 'string' },
          { name: 'Owner', path: 'spec.owner', type: 'string' },
          { name: 'Lifecycle', path: 'spec.lifecycle', type: 'string' },
          { name: 'Type', path: 'spec.type', type: 'string' },
          { name: 'Tags', path: 'metadata.tags', type: 'array' },
        ],
        formatting: {
          arrayFormat: 'comma',
        },
      },
      'component-inventory': {
        name: 'Component Inventory',
        description: 'Detailed component information for inventory management',
        fields: [
          { name: 'Name', path: 'metadata.name', type: 'string', required: true },
          { name: 'Kind', path: 'kind', type: 'string', required: true },
          { name: 'Owner', path: 'spec.owner', type: 'string' },
          { name: 'System', path: 'spec.system', type: 'string' },
          { name: 'Language', path: 'metadata.annotations["backstage.io/language"]', type: 'string' },
          { name: 'Repository', path: 'metadata.annotations["backstage.io/source-location"]', type: 'string' },
          { name: 'Created', path: 'metadata.createdAt', type: 'date' },
          { name: 'Updated', path: 'metadata.updatedAt', type: 'date' },
        ],
        formatting: {
          dateFormat: 'YYYY-MM-DD',
        },
      },
      'security-audit': {
        name: 'Security Audit',
        description: 'Security-focused entity information',
        fields: [
          { name: 'Entity', path: 'metadata.name', type: 'string', required: true },
          { name: 'Kind', path: 'kind', type: 'string', required: true },
          { name: 'Owner', path: 'spec.owner', type: 'string' },
          { name: 'Security Contact', path: 'metadata.annotations["security.backstage.io/contact"]', type: 'string' },
          { name: 'Security Level', path: 'metadata.annotations["security.backstage.io/level"]', type: 'string' },
          { name: 'Last Security Review', path: 'metadata.annotations["security.backstage.io/last-review"]', type: 'date' },
          { name: 'Compliance Status', path: 'metadata.annotations["compliance.backstage.io/status"]', type: 'string' },
        ],
        formatting: {
          dateFormat: 'YYYY-MM-DD',
        },
      },
    };

    return templates[templateName] || null;
  }

  private transformEntity(entity: any, template: CustomExportTemplate): any {
    const result: any = {};

    for (const field of template.fields) {
      let value = this.getValueByPath(entity, field.path);
      
      if (value === undefined || value === null) {
        value = field.defaultValue;
      }

      if (field.transform) {
        value = field.transform(value, entity);
      }

      if (value !== undefined) {
        result[field.name] = this.formatValue(value, field.type, template.formatting);
      }
    }

    return result;
  }

  private getValueByPath(obj: any, path: string): any {
    try {
      // Handle annotation paths with brackets
      if (path.includes('[') && path.includes(']')) {
        const match = path.match(/^(.+)\["([^"]+)"\]$/);
        if (match) {
          const [, objPath, key] = match;
          const parentObj = this.getValueByPath(obj, objPath);
          return parentObj?.[key];
        }
      }

      return path.split('.').reduce((current, key) => current?.[key], obj);
    } catch (error) {
      return undefined;
    }
  }

  private formatValue(
    value: any,
    type: string,
    formatting?: ExportFormatting
  ): any {
    switch (type) {
      case 'date':
        if (value instanceof Date || typeof value === 'string') {
          const date = new Date(value);
          if (formatting?.dateFormat) {
            return this.formatDate(date, formatting.dateFormat);
          }
          return date.toISOString();
        }
        return value;

      case 'boolean':
        if (typeof value === 'boolean') {
          switch (formatting?.booleanFormat) {
            case 'yes/no':
              return value ? 'Yes' : 'No';
            case '1/0':
              return value ? '1' : '0';
            default:
              return value ? 'true' : 'false';
          }
        }
        return value;

      case 'array':
        if (Array.isArray(value)) {
          switch (formatting?.arrayFormat) {
            case 'pipe':
              return value.join(' | ');
            case 'newline':
              return value.join('\n');
            default:
              return value.join(', ');
          }
        }
        return value;

      case 'number':
        if (typeof value === 'number' && formatting?.numberFormat) {
          return this.formatNumber(value, formatting.numberFormat);
        }
        return value;

      default:
        return value;
    }
  }

  private formatDate(date: Date, format: string): string {
    // Simple date formatting - in production you might want to use a library like date-fns
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }

  private formatNumber(value: number, format: string): string {
    // Simple number formatting
    if (format.includes(',')) {
      return value.toLocaleString();
    }
    return String(value);
  }

  /**
   * Format data based on export format
   */
  private async formatData(
    data: any[],
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    // Apply sorting
    if (options.sortBy) {
      data = this.sortData(data, options.sortBy, options.sortOrder || 'asc');
    }

    switch (options.format) {
      case 'yaml':
        return this.formatAsYaml(data);
      case 'json':
        return this.formatAsJson(data);
      case 'csv':
        return this.formatAsCsv(data);
      case 'excel':
        return this.formatAsExcel(data, options);
      case 'zip':
        return this.formatAsZip(data, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  private sortData(data: any[], sortBy: string, sortOrder: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const aValue = this.getValueByPath(a, sortBy);
      const bValue = this.getValueByPath(b, sortBy);
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private async formatAsYaml(data: any[]): Promise<ArrayBuffer> {
    const yamlContent = data.map(item => yaml.dump(item)).join('---\n');
    return new TextEncoder().encode(yamlContent).buffer;
  }

  private async formatAsJson(data: any[]): Promise<ArrayBuffer> {
    const jsonContent = JSON.stringify(data, null, 2);
    return new TextEncoder().encode(jsonContent).buffer;
  }

  private async formatAsCsv(data: any[]): Promise<ArrayBuffer> {
    if (data.length === 0) {
      return new ArrayBuffer(0);
    }

    const csv = Papa.unparse(data);
    return new TextEncoder().encode(csv).buffer;
  }

  private async formatAsExcel(data: any[], options: ExportOptions): Promise<ArrayBuffer> {
    const workbook = XLSX.utils.book_new();
    
    if (options.groupBy) {
      // Create separate sheets for each group
      const groups = this.groupData(data, options.groupBy);
      
      for (const [groupName, groupData] of Object.entries(groups)) {
        const worksheet = XLSX.utils.json_to_sheet(groupData);
        XLSX.utils.book_append_sheet(workbook, worksheet, groupName);
      }
    } else {
      // Single sheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    }

    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }).buffer;
  }

  private async formatAsZip(data: any[], options: ExportOptions): Promise<ArrayBuffer> {
    const zip = new JSZip();
    
    if (options.groupBy) {
      // Create separate files for each group
      const groups = this.groupData(data, options.groupBy);
      
      for (const [groupName, groupData] of Object.entries(groups)) {
        const jsonContent = JSON.stringify(groupData, null, 2);
        zip.file(`${groupName}.json`, jsonContent);
      }
    } else {
      // Include multiple formats
      const jsonContent = JSON.stringify(data, null, 2);
      const yamlContent = data.map(item => yaml.dump(item)).join('---\n');
      const csvContent = data.length > 0 ? Papa.unparse(data) : '';
      
      zip.file('export.json', jsonContent);
      zip.file('export.yaml', yamlContent);
      if (csvContent) {
        zip.file('export.csv', csvContent);
      }
    }

    // Add metadata file
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalEntities: data.length,
      filters: options.filters || {},
      version: '1.0.0',
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    return zip.generateAsync({ type: 'arraybuffer' });
  }

  private groupData(data: any[], groupBy: string): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    for (const item of data) {
      const groupValue = this.getValueByPath(item, groupBy) || 'ungrouped';
      const groupKey = String(groupValue).replace(/[^a-zA-Z0-9-_]/g, '_');
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }
    
    return groups;
  }

  /**
   * Generate export filename
   */
  private generateFilename(options: ExportOptions): string {
    if (options.filename) {
      return options.filename;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const extension = options.format === 'excel' ? 'xlsx' : options.format;
    
    return `backstage-export-${timestamp}.${extension}`;
  }

  /**
   * Generate export metadata
   */
  private generateMetadata(
    originalEntities: any[],
    filteredEntities: any[],
    options: ExportOptions
  ): ExportMetadata {
    return {
      exportedAt: new Date(),
      totalEntities: originalEntities.length,
      filteredEntities: filteredEntities.length,
      filters: options.filters || {},
      schema: 'backstage-entity-v1',
      version: '1.0.0',
    };
  }

  /**
   * Generate export statistics
   */
  private generateStatistics(
    entities: any[],
    fileSize: number,
    compressionRatio?: number
  ): ExportStatistics {
    const entitiesByKind: Record<string, number> = {};
    const entitiesByNamespace: Record<string, number> = {};
    const entitiesByOwner: Record<string, number> = {};

    for (const entity of entities) {
      // Count by kind
      const kind = entity.kind || 'Unknown';
      entitiesByKind[kind] = (entitiesByKind[kind] || 0) + 1;

      // Count by namespace
      const namespace = entity.metadata?.namespace || 'default';
      entitiesByNamespace[namespace] = (entitiesByNamespace[namespace] || 0) + 1;

      // Count by owner
      const owner = entity.spec?.owner || 'Unknown';
      entitiesByOwner[owner] = (entitiesByOwner[owner] || 0) + 1;
    }

    return {
      entitiesByKind,
      entitiesByNamespace,
      entitiesByOwner,
      totalSize: fileSize,
      compressionRatio,
    };
  }

  /**
   * Create custom export template
   */
  registerTemplate(template: CustomExportTemplate): void {
    this.templateCache.set(template.name, template);
  }

  /**
   * Get available export templates
   */
  getAvailableTemplates(): string[] {
    return [
      'service-summary',
      'component-inventory',
      'security-audit',
      ...Array.from(this.templateCache.keys()),
    ];
  }

  /**
   * Preview export data without generating file
   */
  async previewExport(
    entities: any[],
    options: ExportOptions,
    limit = 10
  ): Promise<any[]> {
    const filteredEntities = await this.applyFilters(entities, options.filters);
    const transformedData = await this.applyTemplate(filteredEntities, options);
    
    if (options.sortBy) {
      return this.sortData(transformedData, options.sortBy, options.sortOrder || 'asc')
        .slice(0, limit);
    }
    
    return transformedData.slice(0, limit);
  }
}

export default BulkExporter;