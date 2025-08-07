/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import yaml from 'js-yaml';

import type { Entity } from './backstage/types';
import type { ServiceFormData } from '@/app/create/page';


export interface BulkImportResult {
 success: boolean;
 services: ImportedService[];
 errors: ImportError[];
 summary: {
 total: number;
 successful: number;
 failed: number;
 warnings: number;
 };
}

export interface ImportedService {
 name: string;
 data: ServiceFormData;
 status: 'success' | 'warning' | 'error';
 messages: string[];
 originalIndex: number;
}

export interface ImportError {
 row: number;
 field?: string;
 message: string;
 type: 'validation' | 'format' | 'missing_field';
}

export interface BulkImportOptions {
 overwriteExisting: boolean;
 validateOnly: boolean;
 defaultOwner?: string;
 defaultNamespace?: string;
 skipValidation?: boolean;
}

export class BulkImporter {
 /**
 * Import services from CSV data
 */
 static importFromCSV(
 csvData: string,
 options: BulkImportOptions = { overwriteExisting: false, validateOnly: false }
 ): BulkImportResult {
 const result: BulkImportResult = {
 success: false,
 services: [],
 errors: [],
 summary: { total: 0, successful: 0, failed: 0, warnings: 0 }
 };

 try {
 const lines = csvData.trim().split('\n');
 if (lines.length < 2) {
 result.errors.push({
 row: 0,
 message: 'CSV must contain at least a header row and one data row',
 type: 'format'
 });
 return result;
 }

 const headers = this.parseCSVLine(lines[0]);
 const requiredFields = ['name', 'title', 'description', 'owner', 'type'];
 
 // Validate headers
 const missingFields = requiredFields.filter(field => !headers.includes(field));
 if (missingFields.length > 0) {
 result.errors.push({
 row: 0,
 message: `Missing required columns: ${missingFields.join(', ')}`,
 type: 'missing_field'
 });
 return result;
 }

 // Process each data row
 for (let i = 1; i < lines.length; i++) {
 const values = this.parseCSVLine(lines[i]);
 if (values.length === 0) continue; // Skip empty lines

 const service = this.processCSVRow(headers, values, i, options);
 result.services.push(service);
 result.summary.total++;

 if (service.status === 'success') {
 result.summary.successful++;
 } else if (service.status === 'warning') {
 result.summary.warnings++;
 result.summary.successful++; // Warnings still count as importable
 } else {
 result.summary.failed++;
 result.errors.push({
 row: i + 1,
 message: service.messages.join(', '),
 type: 'validation'
 });
 }
 }

 result.success = result.summary.failed === 0;
 return result;

 } catch (error) {
 result.errors.push({
 row: 0,
 message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
 type: 'format'
 });
 return result;
 }
 }

 /**
 * Import services from JSON data
 */
 static importFromJSON(
 jsonData: string,
 options: BulkImportOptions = { overwriteExisting: false, validateOnly: false }
 ): BulkImportResult {
 const result: BulkImportResult = {
 success: false,
 services: [],
 errors: [],
 summary: { total: 0, successful: 0, failed: 0, warnings: 0 }
 };

 try {
 const data = JSON.parse(jsonData);
 
 // Handle different JSON formats
 let services: any[] = [];
 
 if (Array.isArray(data)) {
 services = data;
 } else if (data.services && Array.isArray(data.services)) {
 services = data.services;
 } else if (data.entities && Array.isArray(data.entities)) {
 // Backstage entity format
 services = data.entities.filter((entity: any) => entity.kind === 'Component');
 } else {
 result.errors.push({
 row: 0,
 message: 'JSON must contain an array of services or an object with a "services" property',
 type: 'format'
 });
 return result;
 }

 // Process each service
 services.forEach((serviceData, index) => {
 const service = this.processJSONService(serviceData, index, options);
 result.services.push(service);
 result.summary.total++;

 if (service.status === 'success') {
 result.summary.successful++;
 } else if (service.status === 'warning') {
 result.summary.warnings++;
 result.summary.successful++;
 } else {
 result.summary.failed++;
 result.errors.push({
 row: index + 1,
 message: service.messages.join(', '),
 type: 'validation'
 });
 }
 });

 result.success = result.summary.failed === 0;
 return result;

 } catch (error) {
 result.errors.push({
 row: 0,
 message: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
 type: 'format'
 });
 return result;
 }
 }

 /**
 * Import from YAML catalog-info files
 */
 static importFromYAML(
 yamlData: string,
 options: BulkImportOptions = { overwriteExisting: false, validateOnly: false }
 ): BulkImportResult {
 const result: BulkImportResult = {
 success: false,
 services: [],
 errors: [],
 summary: { total: 0, successful: 0, failed: 0, warnings: 0 }
 };

 try {
 // Handle multi-document YAML
 const documents = yamlData.split('---').filter(doc => doc.trim());
 
 documents.forEach((doc, index) => {
 try {
 const entity = yaml.load(doc.trim()) as Entity;
 
 if (entity && entity.kind === 'Component') {
 const service = this.processBackstageEntity(entity, index, options);
 result.services.push(service);
 result.summary.total++;

 if (service.status === 'success') {
 result.summary.successful++;
 } else if (service.status === 'warning') {
 result.summary.warnings++;
 result.summary.successful++;
 } else {
 result.summary.failed++;
 }
 }
 } catch (error) {
 result.errors.push({
 row: index + 1,
 message: `Invalid YAML document: ${error instanceof Error ? error.message : 'Unknown error'}`,
 type: 'format'
 });
 result.summary.failed++;
 result.summary.total++;
 }
 });

 result.success = result.summary.failed === 0;
 return result;

 } catch (error) {
 result.errors.push({
 row: 0,
 message: `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
 type: 'format'
 });
 return result;
 }
 }

 /**
 * Parse CSV line handling quoted values
 */
 private static parseCSVLine(line: string): string[] {
 const result: string[] = [];
 let current = '';
 let inQuotes = false;
 
 for (let i = 0; i < line.length; i++) {
 const char = line[i];
 
 if (char === '"') {
 inQuotes = !inQuotes;
 } else if (char === ',' && !inQuotes) {
 result.push(current.trim());
 current = '';
 } else {
 current += char;
 }
 }
 
 result.push(current.trim());
 return result.map(val => val.replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
 }

 /**
 * Process a single CSV row
 */
 private static processCSVRow(
 headers: string[],
 values: string[],
 rowIndex: number,
 options: BulkImportOptions
 ): ImportedService {
 const service: ImportedService = {
 name: '',
 data: {} as ServiceFormData,
 status: 'success',
 messages: [],
 originalIndex: rowIndex
 };

 try {
 // Map CSV values to form data
 const rowData: Record<string, string> = {};
 headers.forEach((header, index) => {
 rowData[header] = values[index] || '';
 });

 // Required fields
 service.name = rowData.name;
 service.data = {
 name: rowData.name,
 title: rowData.title,
 description: rowData.description,
 owner: rowData.owner || options.defaultOwner || '',
 type: (rowData.type as any) || 'service',
 lifecycle: (rowData.lifecycle as any) || 'experimental',
 system: rowData.system,
 tags: rowData.tags ? rowData.tags.split(',').map(t => t.trim()) : [],
 providesApis: rowData.providesApis ? rowData.providesApis.split(',').map(t => t.trim()) : [],
 consumesApis: rowData.consumesApis ? rowData.consumesApis.split(',').map(t => t.trim()) : [],
 dependsOn: rowData.dependsOn ? rowData.dependsOn.split(',').map(t => t.trim()) : [],
 repository: {
 url: rowData.repositoryUrl || '',
 visibility: (rowData.repositoryVisibility as any) || 'private',
 },
 infrastructure: {
 kubernetes: this.parseBoolean(rowData.kubernetes, true),
 database: this.parseBoolean(rowData.database, false),
 cache: this.parseBoolean(rowData.cache, false),
 messaging: this.parseBoolean(rowData.messaging, false),
 },
 monitoring: {
 prometheus: this.parseBoolean(rowData.prometheus, true),
 logging: this.parseBoolean(rowData.logging, true),
 tracing: this.parseBoolean(rowData.tracing, false),
 alerts: this.parseBoolean(rowData.alerts, true),
 }
 };

 // Validation
 const validationErrors = this.validateServiceData(service.data);
 if (validationErrors.length > 0) {
 service.status = 'error';
 service.messages = validationErrors;
 } else {
 // Check for warnings
 const warnings = this.getServiceWarnings(service.data);
 if (warnings.length > 0) {
 service.status = 'warning';
 service.messages = warnings;
 }
 }

 } catch (error) {
 service.status = 'error';
 service.messages = [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`];
 }

 return service;
 }

 /**
 * Process JSON service data
 */
 private static processJSONService(
 serviceData: any,
 index: number,
 options: BulkImportOptions
 ): ImportedService {
 const service: ImportedService = {
 name: serviceData.name || `service-${index}`,
 data: {} as ServiceFormData,
 status: 'success',
 messages: [],
 originalIndex: index
 };

 try {
 service.data = {
 name: serviceData.name || '',
 title: serviceData.title || serviceData.name || '',
 description: serviceData.description || '',
 owner: serviceData.owner || options.defaultOwner || '',
 type: serviceData.type || 'service',
 lifecycle: serviceData.lifecycle || 'experimental',
 system: serviceData.system,
 tags: Array.isArray(serviceData.tags) ? serviceData.tags : [],
 providesApis: Array.isArray(serviceData.providesApis) ? serviceData.providesApis : [],
 consumesApis: Array.isArray(serviceData.consumesApis) ? serviceData.consumesApis : [],
 dependsOn: Array.isArray(serviceData.dependsOn) ? serviceData.dependsOn : [],
 repository: {
 url: serviceData.repository?.url || serviceData.repositoryUrl || '',
 visibility: serviceData.repository?.visibility || 'private',
 },
 infrastructure: {
 kubernetes: serviceData.infrastructure?.kubernetes ?? true,
 database: serviceData.infrastructure?.database ?? false,
 cache: serviceData.infrastructure?.cache ?? false,
 messaging: serviceData.infrastructure?.messaging ?? false,
 },
 monitoring: {
 prometheus: serviceData.monitoring?.prometheus ?? true,
 logging: serviceData.monitoring?.logging ?? true,
 tracing: serviceData.monitoring?.tracing ?? false,
 alerts: serviceData.monitoring?.alerts ?? true,
 }
 };

 // Validation
 const validationErrors = this.validateServiceData(service.data);
 if (validationErrors.length > 0) {
 service.status = 'error';
 service.messages = validationErrors;
 } else {
 const warnings = this.getServiceWarnings(service.data);
 if (warnings.length > 0) {
 service.status = 'warning';
 service.messages = warnings;
 }
 }

 } catch (error) {
 service.status = 'error';
 service.messages = [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`];
 }

 return service;
 }

 /**
 * Process Backstage entity
 */
 private static processBackstageEntity(
 entity: Entity,
 index: number,
 options: BulkImportOptions
 ): ImportedService {
 const service: ImportedService = {
 name: entity.metadata.name,
 data: {} as ServiceFormData,
 status: 'success',
 messages: [],
 originalIndex: index
 };

 try {
 const spec = entity.spec as any;
 
 service.data = {
 name: entity.metadata.name,
 title: entity.metadata.title || entity.metadata.name,
 description: entity.metadata.description || '',
 owner: spec.owner || options.defaultOwner || '',
 type: spec.type || 'service',
 lifecycle: spec.lifecycle || 'experimental',
 system: spec.system,
 tags: entity.metadata.tags || [],
 providesApis: spec.providesApis || [],
 consumesApis: spec.consumesApis || [],
 dependsOn: spec.dependsOn || [],
 repository: {
 url: entity.metadata.annotations?.['backstage.io/managed-by-location'] || '',
 visibility: 'private',
 },
 infrastructure: {
 kubernetes: true,
 database: false,
 cache: false,
 messaging: false,
 },
 monitoring: {
 prometheus: true,
 logging: true,
 tracing: false,
 alerts: true,
 }
 };

 const warnings = this.getServiceWarnings(service.data);
 if (warnings.length > 0) {
 service.status = 'warning';
 service.messages = warnings;
 }

 } catch (error) {
 service.status = 'error';
 service.messages = [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`];
 }

 return service;
 }

 /**
 * Parse boolean from string
 */
 private static parseBoolean(value: string, defaultValue: boolean): boolean {
 if (!value) return defaultValue;
 const lower = value.toLowerCase();
 return lower === 'true' || lower === 'yes' || lower === '1';
 }

 /**
 * Validate service data
 */
 private static validateServiceData(data: ServiceFormData): string[] {
 const errors: string[] = [];

 if (!data.name) errors.push('Name is required');
 if (!data.title) errors.push('Title is required');
 if (!data.description) errors.push('Description is required');
 if (!data.owner) errors.push('Owner is required');

 if (data.name && !/^[a-z0-9-]+$/.test(data.name)) {
 errors.push('Name must be lowercase alphanumeric with hyphens only');
 }

 if (!['service', 'website', 'library', 'documentation'].includes(data.type)) {
 errors.push('Type must be one of: service, website, library, documentation');
 }

 if (!['experimental', 'production', 'deprecated'].includes(data.lifecycle)) {
 errors.push('Lifecycle must be one of: experimental, production, deprecated');
 }

 return errors;
 }

 /**
 * Get service warnings
 */
 private static getServiceWarnings(data: ServiceFormData): string[] {
 const warnings: string[] = [];

 if (data.description && data.description.length < 10) {
 warnings.push('Description is quite short');
 }

 if (!data.tags || data.tags.length === 0) {
 warnings.push('No tags specified');
 }

 if (data.lifecycle === 'experimental') {
 warnings.push('Service is marked as experimental');
 }

 return warnings;
 }

 /**
 * Generate CSV template
 */
 static generateCSVTemplate(): string {
 const headers = [
 'name', 'title', 'description', 'owner', 'type', 'lifecycle',
 'system', 'tags', 'providesApis', 'consumesApis', 'dependsOn',
 'repositoryUrl', 'repositoryVisibility',
 'kubernetes', 'database', 'cache', 'messaging',
 'prometheus', 'logging', 'tracing', 'alerts'
 ];

 const example = [
 'user-service',
 'User Service',
 'Handles user authentication and profile management',
 'backend-team',
 'service',
 'production',
 'user-management',
 'backend,api,typescript',
 'user-api',
 'auth-api',
 'Component:default/auth-service',
 'https://github.com/company/user-service',
 'private',
 'true',
 'true',
 'false',
 'false',
 'true',
 'true',
 'false',
 'true'
 ];

 return headers.join(',') + '\n' + example.map(val => 
 val.includes(',') ? `"${val}"` : val
 ).join(',');
 }

 /**
 * Generate JSON template
 */
 static generateJSONTemplate(): string {
 const template = {
 services: [
 {
 name: 'user-service',
 title: 'User Service',
 description: 'Handles user authentication and profile management',
 owner: 'backend-team',
 type: 'service',
 lifecycle: 'production',
 system: 'user-management',
 tags: ['backend', 'api', 'typescript'],
 providesApis: ['user-api'],
 consumesApis: ['auth-api'],
 dependsOn: ['Component:default/auth-service'],
 repository: {
 url: 'https://github.com/company/user-service',
 visibility: 'private'
 },
 infrastructure: {
 kubernetes: true,
 database: true,
 cache: false,
 messaging: false
 },
 monitoring: {
 prometheus: true,
 logging: true,
 tracing: false,
 alerts: true
 }
 }
 ]
 };

 return JSON.stringify(template, null, 2);
 }
}