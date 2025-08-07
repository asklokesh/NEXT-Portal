/**
 * Test Data Manager
 * Comprehensive test data management and fixture system
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export interface TestDataSet {
  id: string;
  name: string;
  description: string;
  type: 'fixture' | 'seed' | 'mock' | 'synthetic';
  category: string;
  version: string;
  data: any;
  schema?: TestDataSchema;
  dependencies: string[];
  tags: string[];
  metadata: TestDataMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDataSchema {
  type: 'json' | 'sql' | 'csv' | 'xml' | 'yaml';
  properties: SchemaProperty[];
  constraints: SchemaConstraint[];
  validations: SchemaValidation[];
}

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  nullable: boolean;
  unique: boolean;
  constraints?: any;
  description?: string;
}

export interface SchemaConstraint {
  type: 'foreign_key' | 'check' | 'unique' | 'not_null';
  field: string;
  reference?: string;
  condition?: string;
}

export interface SchemaValidation {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TestDataMetadata {
  source: string;
  size: number;
  format: string;
  encoding: string;
  sensitive: boolean;
  retention: string;
  privacy: PrivacyConfig;
}

export interface PrivacyConfig {
  piiFields: string[];
  anonymized: boolean;
  maskedFields: string[];
  encryptedFields: string[];
}

export interface DataGenerator {
  id: string;
  name: string;
  type: 'faker' | 'template' | 'custom' | 'ai';
  configuration: GeneratorConfig;
}

export interface GeneratorConfig {
  locale: string;
  seed?: number;
  rules: GeneratorRule[];
  templates: GeneratorTemplate[];
  constraints: GeneratorConstraint[];
}

export interface GeneratorRule {
  field: string;
  type: string;
  parameters: Record<string, any>;
  format?: string;
}

export interface GeneratorTemplate {
  name: string;
  pattern: string;
  variables: Record<string, any>;
}

export interface GeneratorConstraint {
  field: string;
  relation: 'dependent' | 'unique' | 'range';
  parameters: any;
}

export interface DataTransformation {
  id: string;
  name: string;
  type: 'anonymize' | 'mask' | 'encrypt' | 'filter' | 'aggregate';
  configuration: TransformationConfig;
}

export interface TransformationConfig {
  fields: string[];
  rules: TransformationRule[];
  options: Record<string, any>;
}

export interface TransformationRule {
  condition: string;
  action: string;
  parameters: Record<string, any>;
}

export interface TestDataQuery {
  dataset?: string;
  category?: string;
  tags?: string[];
  size?: number;
  format?: string;
  filters?: DataFilter[];
  transformations?: string[];
}

export interface DataFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: any;
}

export interface DataSnapshot {
  id: string;
  datasetId: string;
  name: string;
  data: any;
  checksum: string;
  createdAt: Date;
}

export class TestDataManager extends EventEmitter {
  private datasets: Map<string, TestDataSet> = new Map();
  private generators: Map<string, DataGenerator> = new Map();
  private transformations: Map<string, DataTransformation> = new Map();
  private snapshots: Map<string, DataSnapshot> = new Map();
  private dataPath: string = './test-data';

  constructor(dataPath?: string) {
    super();
    if (dataPath) {
      this.dataPath = dataPath;
    }
    this.initializeDefaultGenerators();
    this.initializeDefaultTransformations();
  }

  /**
   * Register a test dataset
   */
  public registerDataset(dataset: TestDataSet): void {
    this.datasets.set(dataset.id, dataset);
    this.emit('dataset:registered', dataset);
  }

  /**
   * Load dataset from file
   */
  public loadDataset(filePath: string, datasetConfig?: Partial<TestDataSet>): TestDataSet {
    if (!existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data = this.parseDataFile(filePath, fileContent);
    
    const dataset: TestDataSet = {
      id: datasetConfig?.id || path.basename(filePath, path.extname(filePath)),
      name: datasetConfig?.name || path.basename(filePath),
      description: datasetConfig?.description || 'Loaded from file',
      type: datasetConfig?.type || 'fixture',
      category: datasetConfig?.category || 'general',
      version: datasetConfig?.version || '1.0.0',
      data,
      schema: this.inferSchema(data),
      dependencies: datasetConfig?.dependencies || [],
      tags: datasetConfig?.tags || [],
      metadata: {
        source: filePath,
        size: fileContent.length,
        format: this.detectFileFormat(filePath),
        encoding: 'utf-8',
        sensitive: false,
        retention: '30d',
        privacy: {
          piiFields: [],
          anonymized: false,
          maskedFields: [],
          encryptedFields: []
        },
        ...datasetConfig?.metadata
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.registerDataset(dataset);
    return dataset;
  }

  /**
   * Generate synthetic test data
   */
  public async generateData(
    generatorId: string,
    count: number,
    overrides?: Record<string, any>
  ): Promise<TestDataSet> {
    const generator = this.generators.get(generatorId);
    if (!generator) {
      throw new Error(`Generator not found: ${generatorId}`);
    }

    this.emit('data:generating', { generatorId, count });

    const data = await this.executeGenerator(generator, count, overrides);
    
    const dataset: TestDataSet = {
      id: `generated-${generatorId}-${Date.now()}`,
      name: `Generated ${generator.name}`,
      description: `Synthetic data generated using ${generator.name}`,
      type: 'synthetic',
      category: 'generated',
      version: '1.0.0',
      data,
      schema: this.inferSchema(data),
      dependencies: [],
      tags: ['generated', generator.name],
      metadata: {
        source: `generator:${generatorId}`,
        size: JSON.stringify(data).length,
        format: 'json',
        encoding: 'utf-8',
        sensitive: false,
        retention: '7d',
        privacy: {
          piiFields: [],
          anonymized: false,
          maskedFields: [],
          encryptedFields: []
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.registerDataset(dataset);
    this.emit('data:generated', dataset);
    
    return dataset;
  }

  /**
   * Query test data with filters and transformations
   */
  public queryData(query: TestDataQuery): any[] {
    let results: any[] = [];

    // Collect datasets based on query criteria
    const matchingDatasets = Array.from(this.datasets.values()).filter(dataset => {
      if (query.dataset && dataset.id !== query.dataset) return false;
      if (query.category && dataset.category !== query.category) return false;
      if (query.tags && !query.tags.every(tag => dataset.tags.includes(tag))) return false;
      return true;
    });

    // Combine data from matching datasets
    matchingDatasets.forEach(dataset => {
      const data = Array.isArray(dataset.data) ? dataset.data : [dataset.data];
      results.push(...data);
    });

    // Apply filters
    if (query.filters) {
      results = this.applyFilters(results, query.filters);
    }

    // Apply transformations
    if (query.transformations) {
      results = this.applyTransformations(results, query.transformations);
    }

    // Limit size
    if (query.size && results.length > query.size) {
      results = results.slice(0, query.size);
    }

    return results;
  }

  /**
   * Create a data snapshot
   */
  public createSnapshot(datasetId: string, name: string): DataSnapshot {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const snapshot: DataSnapshot = {
      id: `snapshot-${datasetId}-${Date.now()}`,
      datasetId,
      name,
      data: JSON.parse(JSON.stringify(dataset.data)), // Deep clone
      checksum: this.calculateChecksum(dataset.data),
      createdAt: new Date()
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.emit('snapshot:created', snapshot);
    
    return snapshot;
  }

  /**
   * Restore data from snapshot
   */
  public restoreFromSnapshot(snapshotId: string): TestDataSet | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const dataset = this.datasets.get(snapshot.datasetId);
    if (!dataset) {
      throw new Error(`Original dataset not found: ${snapshot.datasetId}`);
    }

    // Restore data
    dataset.data = JSON.parse(JSON.stringify(snapshot.data));
    dataset.updatedAt = new Date();

    this.emit('snapshot:restored', snapshot, dataset);
    return dataset;
  }

  /**
   * Setup all test data for a test suite
   */
  public async setupAll(): Promise<void> {
    this.emit('setup:started');
    
    // Load any configured datasets
    await this.loadConfiguredDatasets();
    
    // Generate any required synthetic data
    await this.generateRequiredData();
    
    this.emit('setup:completed');
  }

  /**
   * Clean up all test data
   */
  public async cleanupAll(): Promise<void> {
    this.emit('cleanup:started');
    
    // Clean up sensitive or temporary data
    const temporaryDatasets = Array.from(this.datasets.values())
      .filter(dataset => 
        dataset.metadata.retention === 'session' ||
        dataset.type === 'synthetic'
      );
    
    temporaryDatasets.forEach(dataset => {
      this.datasets.delete(dataset.id);
    });
    
    // Clear snapshots
    this.snapshots.clear();
    
    this.emit('cleanup:completed');
  }

  /**
   * Health check for the data manager
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if data directory is accessible
      if (!existsSync(this.dataPath)) {
        return false;
      }

      // Check if we can create and delete test files
      const testFile = path.join(this.dataPath, '.health-check');
      writeFileSync(testFile, 'test');
      
      if (existsSync(testFile)) {
        require('fs').unlinkSync(testFile);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export dataset to file
   */
  public exportDataset(datasetId: string, filePath: string, format?: string): void {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const exportFormat = format || this.detectFileFormat(filePath);
    const exportData = this.formatDataForExport(dataset.data, exportFormat);
    
    writeFileSync(filePath, exportData);
    this.emit('dataset:exported', dataset, filePath);
  }

  /**
   * Anonymize sensitive data
   */
  public anonymizeDataset(datasetId: string): TestDataSet {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const anonymizedData = this.anonymizeData(
      dataset.data,
      dataset.metadata.privacy.piiFields
    );

    const anonymizedDataset: TestDataSet = {
      ...dataset,
      id: `${dataset.id}-anonymized`,
      name: `${dataset.name} (Anonymized)`,
      data: anonymizedData,
      metadata: {
        ...dataset.metadata,
        privacy: {
          ...dataset.metadata.privacy,
          anonymized: true
        }
      },
      updatedAt: new Date()
    };

    this.registerDataset(anonymizedDataset);
    return anonymizedDataset;
  }

  private parseDataFile(filePath: string, content: string): any {
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
      case '.json':
        return JSON.parse(content);
      case '.yaml':
      case '.yml':
        return require('js-yaml').load(content);
      case '.csv':
        return this.parseCSV(content);
      case '.xml':
        return this.parseXML(content);
      case '.sql':
        return { queries: this.parseSQLStatements(content) };
      default:
        return { content };
    }
  }

  private detectFileFormat(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
      case '.json': return 'json';
      case '.yaml':
      case '.yml': return 'yaml';
      case '.csv': return 'csv';
      case '.xml': return 'xml';
      case '.sql': return 'sql';
      default: return 'text';
    }
  }

  private inferSchema(data: any): TestDataSchema {
    if (Array.isArray(data) && data.length > 0) {
      return this.inferSchemaFromArray(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.inferSchemaFromObject(data);
    }
    
    return {
      type: 'json',
      properties: [],
      constraints: [],
      validations: []
    };
  }

  private inferSchemaFromArray(data: any[]): TestDataSchema {
    const sample = data[0];
    const properties: SchemaProperty[] = [];
    
    if (typeof sample === 'object' && sample !== null) {
      Object.entries(sample).forEach(([key, value]) => {
        properties.push({
          name: key,
          type: typeof value,
          required: true, // Assume required for now
          nullable: value === null,
          unique: false,
          description: `Inferred from sample data`
        });
      });
    }
    
    return {
      type: 'json',
      properties,
      constraints: [],
      validations: []
    };
  }

  private inferSchemaFromObject(data: any): TestDataSchema {
    const properties: SchemaProperty[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      properties.push({
        name: key,
        type: typeof value,
        required: true,
        nullable: value === null,
        unique: false,
        description: `Inferred from object data`
      });
    });
    
    return {
      type: 'json',
      properties,
      constraints: [],
      validations: []
    };
  }

  private async executeGenerator(
    generator: DataGenerator,
    count: number,
    overrides?: Record<string, any>
  ): Promise<any[]> {
    const data: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const record = await this.generateRecord(generator, overrides);
      data.push(record);
    }
    
    return data;
  }

  private async generateRecord(
    generator: DataGenerator,
    overrides?: Record<string, any>
  ): Promise<any> {
    const record: any = {};
    
    for (const rule of generator.configuration.rules) {
      if (overrides && overrides[rule.field] !== undefined) {
        record[rule.field] = overrides[rule.field];
      } else {
        record[rule.field] = await this.generateFieldValue(rule);
      }
    }
    
    return record;
  }

  private async generateFieldValue(rule: GeneratorRule): Promise<any> {
    switch (rule.type) {
      case 'string':
        return this.generateString(rule.parameters);
      case 'number':
        return this.generateNumber(rule.parameters);
      case 'boolean':
        return this.generateBoolean(rule.parameters);
      case 'date':
        return this.generateDate(rule.parameters);
      case 'email':
        return this.generateEmail(rule.parameters);
      case 'phone':
        return this.generatePhone(rule.parameters);
      case 'address':
        return this.generateAddress(rule.parameters);
      case 'name':
        return this.generateName(rule.parameters);
      case 'uuid':
        return this.generateUUID();
      default:
        return `generated-${rule.type}`;
    }
  }

  private generateString(params: any): string {
    const length = params.length || 10;
    const charset = params.charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  private generateNumber(params: any): number {
    const min = params.min || 0;
    const max = params.max || 100;
    const isInteger = params.integer !== false;
    
    const value = Math.random() * (max - min) + min;
    return isInteger ? Math.floor(value) : value;
  }

  private generateBoolean(params: any): boolean {
    const probability = params.probability || 0.5;
    return Math.random() < probability;
  }

  private generateDate(params: any): Date {
    const start = params.start ? new Date(params.start) : new Date('2020-01-01');
    const end = params.end ? new Date(params.end) : new Date();
    
    const timestamp = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(timestamp);
  }

  private generateEmail(params: any): string {
    const domains = params.domains || ['example.com', 'test.org', 'demo.net'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const username = this.generateString({ length: 8, charset: 'abcdefghijklmnopqrstuvwxyz' });
    return `${username}@${domain}`;
  }

  private generatePhone(params: any): string {
    const format = params.format || '(###) ###-####';
    return format.replace(/#/g, () => Math.floor(Math.random() * 10).toString());
  }

  private generateAddress(params: any): any {
    return {
      street: `${this.generateNumber({ min: 1, max: 9999 })} ${this.generateString({ length: 8 })} St`,
      city: this.generateString({ length: 6 }),
      state: this.generateString({ length: 2 }).toUpperCase(),
      zipCode: this.generateString({ length: 5, charset: '0123456789' })
    };
  }

  private generateName(params: any): string {
    const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private applyFilters(data: any[], filters: DataFilter[]): any[] {
    return data.filter(record => {
      return filters.every(filter => {
        const fieldValue = record[filter.field];
        
        switch (filter.operator) {
          case 'eq': return fieldValue === filter.value;
          case 'neq': return fieldValue !== filter.value;
          case 'gt': return fieldValue > filter.value;
          case 'gte': return fieldValue >= filter.value;
          case 'lt': return fieldValue < filter.value;
          case 'lte': return fieldValue <= filter.value;
          case 'in': return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          case 'like': return String(fieldValue).includes(String(filter.value));
          default: return true;
        }
      });
    });
  }

  private applyTransformations(data: any[], transformationIds: string[]): any[] {
    let transformedData = data;
    
    transformationIds.forEach(id => {
      const transformation = this.transformations.get(id);
      if (transformation) {
        transformedData = this.executeTransformation(transformedData, transformation);
      }
    });
    
    return transformedData;
  }

  private executeTransformation(data: any[], transformation: DataTransformation): any[] {
    switch (transformation.type) {
      case 'anonymize':
        return data.map(record => this.anonymizeRecord(record, transformation.configuration.fields));
      case 'mask':
        return data.map(record => this.maskRecord(record, transformation.configuration.fields));
      case 'filter':
        return this.filterRecords(data, transformation.configuration.rules);
      default:
        return data;
    }
  }

  private anonymizeRecord(record: any, fields: string[]): any {
    const anonymized = { ...record };
    
    fields.forEach(field => {
      if (anonymized[field] !== undefined) {
        anonymized[field] = this.anonymizeValue(anonymized[field], field);
      }
    });
    
    return anonymized;
  }

  private anonymizeValue(value: any, fieldName: string): any {
    if (fieldName.toLowerCase().includes('email')) {
      return 'anonymized@example.com';
    } else if (fieldName.toLowerCase().includes('name')) {
      return 'Anonymous User';
    } else if (fieldName.toLowerCase().includes('phone')) {
      return '(555) 123-4567';
    } else if (typeof value === 'string') {
      return 'ANONYMIZED';
    } else if (typeof value === 'number') {
      return 0;
    }
    
    return value;
  }

  private maskRecord(record: any, fields: string[]): any {
    const masked = { ...record };
    
    fields.forEach(field => {
      if (masked[field] !== undefined && typeof masked[field] === 'string') {
        const value = masked[field];
        masked[field] = value.substring(0, 2) + '*'.repeat(Math.max(0, value.length - 4)) + value.substring(value.length - 2);
      }
    });
    
    return masked;
  }

  private filterRecords(data: any[], rules: TransformationRule[]): any[] {
    return data.filter(record => {
      return rules.every(rule => {
        // Simple condition evaluation
        try {
          return new Function('record', `return ${rule.condition}`)(record);
        } catch (error) {
          return true;
        }
      });
    });
  }

  private anonymizeData(data: any, piiFields: string[]): any {
    if (Array.isArray(data)) {
      return data.map(record => this.anonymizeRecord(record, piiFields));
    } else if (typeof data === 'object' && data !== null) {
      return this.anonymizeRecord(data, piiFields);
    }
    
    return data;
  }

  private calculateChecksum(data: any): string {
    const content = JSON.stringify(data);
    // Simple checksum calculation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private formatDataForExport(data: any, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        return require('js-yaml').dump(data);
      case 'csv':
        return this.formatAsCSV(data);
      default:
        return JSON.stringify(data);
    }
  }

  private formatAsCSV(data: any): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }
    
    const headers = Object.keys(data[0]);
    const rows = data.map(record => 
      headers.map(header => JSON.stringify(record[header] || '')).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  private parseCSV(content: string): any[] {
    const lines = content.split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() || '';
      });
      return record;
    });
    
    return data.filter(record => Object.values(record).some(val => val !== ''));
  }

  private parseXML(content: string): any {
    // Simplified XML parsing - in production, use proper XML parser
    return { xmlContent: content };
  }

  private parseSQLStatements(content: string): string[] {
    return content
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
  }

  private async loadConfiguredDatasets(): Promise<void> {
    // Load datasets specified in configuration
    // This would typically load from a configuration file
  }

  private async generateRequiredData(): Promise<void> {
    // Generate any required synthetic data based on configuration
    // This would typically be defined in test configuration
  }

  private initializeDefaultGenerators(): void {
    // User generator
    this.generators.set('user', {
      id: 'user',
      name: 'User Data Generator',
      type: 'faker',
      configuration: {
        locale: 'en',
        rules: [
          { field: 'id', type: 'uuid', parameters: {} },
          { field: 'name', type: 'name', parameters: {} },
          { field: 'email', type: 'email', parameters: {} },
          { field: 'phone', type: 'phone', parameters: {} },
          { field: 'address', type: 'address', parameters: {} },
          { field: 'createdAt', type: 'date', parameters: { start: '2020-01-01', end: '2024-01-01' } }
        ],
        templates: [],
        constraints: []
      }
    });

    // Product generator
    this.generators.set('product', {
      id: 'product',
      name: 'Product Data Generator',
      type: 'faker',
      configuration: {
        locale: 'en',
        rules: [
          { field: 'id', type: 'uuid', parameters: {} },
          { field: 'name', type: 'string', parameters: { length: 20 } },
          { field: 'price', type: 'number', parameters: { min: 10, max: 1000, integer: false } },
          { field: 'inStock', type: 'boolean', parameters: { probability: 0.8 } },
          { field: 'category', type: 'string', parameters: { charset: 'abcdefghijklmnopqrstuvwxyz' } }
        ],
        templates: [],
        constraints: []
      }
    });
  }

  private initializeDefaultTransformations(): void {
    // PII Anonymization transformation
    this.transformations.set('anonymize-pii', {
      id: 'anonymize-pii',
      name: 'PII Anonymization',
      type: 'anonymize',
      configuration: {
        fields: ['email', 'phone', 'name', 'address'],
        rules: [],
        options: {}
      }
    });

    // Data masking transformation
    this.transformations.set('mask-sensitive', {
      id: 'mask-sensitive',
      name: 'Sensitive Data Masking',
      type: 'mask',
      configuration: {
        fields: ['ssn', 'creditCard', 'password'],
        rules: [],
        options: {}
      }
    });
  }
}

export default TestDataManager;