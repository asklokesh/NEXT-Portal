# Bulk Import/Export System

A comprehensive bulk import/export system for Backstage entities with smart templates, validation, and error recovery.

## Features

- **Multi-format Support**: YAML, JSON, CSV, Excel
- **Smart Template Matching**: Automatic entity type detection and template application
- **Comprehensive Validation**: Schema validation with detailed error reporting
- **Error Recovery**: Automatic fixing of common issues
- **Conflict Resolution**: Multiple strategies for handling duplicates
- **Progress Tracking**: Real-time progress updates
- **Batch Processing**: Efficient processing of large datasets
- **Drag-and-Drop UI**: Intuitive file upload interface

## Quick Start

### Basic Import

```typescript
import BulkImporter from '@/lib/import/BulkImporter';

const importer = new BulkImporter({
  format: 'auto',
  conflictResolution: 'prompt',
  validateOnly: false,
});

// Import from file
const fileBuffer = await file.arrayBuffer();
const result = await importer.importFromFile(fileBuffer, file.name);

console.log(`Imported ${result.imported} entities`);
```

### Basic Export

```typescript
import BulkExporter from '@/lib/export/BulkExporter';

const exporter = new BulkExporter();

// Export entities
const result = await exporter.exportEntities(entities, {
  format: 'yaml',
  template: 'service-summary',
  includeMetadata: true,
});

// Download the exported file
const blob = new Blob([result.fileBuffer]);
const url = URL.createObjectURL(blob);
// ... trigger download
```

## Supported Formats

### Input Formats

- **YAML**: Native Backstage entity format
- **JSON**: Structured data format
- **CSV**: Tabular data with headers
- **Excel**: Spreadsheet format (.xlsx, .xls)

### Output Formats

- **YAML**: Native Backstage entity format
- **JSON**: Structured data format  
- **CSV**: Flat tabular format
- **Excel**: Multi-sheet spreadsheet
- **ZIP**: All formats combined

## Smart Templates

The system includes smart templates for common entity types:

### Service Template
Maps common service fields to Backstage Component entities:
- Auto-detects service type from naming patterns
- Infers technology stack from language/framework
- Generates appropriate tags and annotations

### Component Template  
For libraries, packages, and reusable components:
- Detects component type (library, website, service)
- Maps dependency relationships
- Handles API consumption/provision

### API Template
For API definitions and specifications:
- Auto-detects API type (OpenAPI, GraphQL, gRPC)
- Validates API definition format
- Links to specification URLs

### Resource Template
For infrastructure and external resources:
- Maps cloud provider information
- Handles resource dependencies
- Categorizes by resource type

## Configuration Options

### Import Options

```typescript
interface ImportOptions {
  format?: 'auto' | 'yaml' | 'json' | 'csv' | 'excel';
  validateOnly?: boolean;
  conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'prompt';
  batchSize?: number;
  dryRun?: boolean;
  templateMapping?: Record<string, any>;
}
```

### Export Options

```typescript
interface ExportOptions {
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
```

## Validation & Error Handling

### Entity Validation

The system performs comprehensive validation:

- **Schema Validation**: Ensures entities match Backstage schemas
- **Business Rules**: Validates entity relationships and references
- **Format Validation**: Checks field formats and constraints
- **Duplicate Detection**: Identifies conflicting entities

### Error Categories

- **Validation Errors**: Schema or format violations
- **Parsing Errors**: File format or encoding issues
- **System Errors**: Resource limits or timeouts
- **Network Errors**: Connectivity issues
- **Permission Errors**: Access control violations

### Auto-Recovery

Common issues are automatically fixed:

- **Name Formatting**: Converts to valid entity names
- **Reference Format**: Fixes entity reference syntax
- **Circular Dependencies**: Detects and suggests fixes
- **Missing Fields**: Applies default values where appropriate

## Usage Examples

### Import with Progress Tracking

```typescript
const importer = new BulkImporter();

importer.onProgress((progress) => {
  console.log(`${progress.phase}: ${progress.progress}%`);
  console.log(`Processed: ${progress.processed}/${progress.total}`);
});

const result = await importer.importFromFile(fileBuffer, filename);
```

### Export with Filters

```typescript
const exporter = new BulkExporter();

const result = await exporter.exportEntities(entities, {
  format: 'excel',
  filters: {
    kinds: ['Component', 'API'],
    owners: ['platform-team'],
    lifecycle: ['production'],
  },
  template: 'component-inventory',
  groupBy: 'kind',
});
```

### Custom Export Template

```typescript
const customTemplate = {
  name: 'Security Audit',
  description: 'Security-focused entity information',
  fields: [
    { name: 'Entity', path: 'metadata.name', type: 'string' },
    { name: 'Owner', path: 'spec.owner', type: 'string' },
    { name: 'Security Level', path: 'metadata.annotations["security.level"]', type: 'string' },
    { name: 'Last Review', path: 'metadata.annotations["security.lastReview"]', type: 'date' },
  ],
};

exporter.registerTemplate(customTemplate);
```

### Validation Only

```typescript
const result = await importer.importFromFile(fileBuffer, filename, {
  validateOnly: true,
  dryRun: true,
});

console.log(`Found ${result.preview?.length} entities`);
console.log(`Errors: ${result.errors.length}`);
```

## API Endpoints

### Import Endpoint

```http
POST /api/catalog/import
Content-Type: multipart/form-data

{
  "file": <file>,
  "options": {
    "format": "auto",
    "conflictResolution": "prompt",
    "validateOnly": false
  }
}
```

### Export Endpoint

```http
POST /api/catalog/export
Content-Type: application/json

{
  "options": {
    "format": "yaml",
    "template": "service-summary"
  },
  "filters": {
    "kinds": ["Component"],
    "owners": ["platform-team"]
  }
}
```

### Template Download

```http
GET /api/catalog/import?kind=Service&format=csv&samples=3
```

## Best Practices

### Data Preparation

1. **Use Templates**: Download and modify provided templates
2. **Validate Early**: Use validation-only mode before importing
3. **Start Small**: Test with small batches first
4. **Clean Data**: Remove special characters from names
5. **Check References**: Ensure entity references are valid

### Performance

1. **Batch Size**: Use appropriate batch sizes (100-500 entities)
2. **Memory**: Large files may require more memory
3. **Network**: Consider timeout settings for slow connections
4. **Caching**: Templates and validation rules are cached

### Error Handling

1. **Review Errors**: Check all validation errors before importing
2. **Use Auto-Fix**: Enable auto-recovery for common issues
3. **Backup Data**: Keep original files as backups
4. **Monitor Progress**: Use progress callbacks for long operations

## Troubleshooting

### Common Issues

**File Format Not Detected**
- Ensure file extension matches content
- Check file encoding (UTF-8 recommended)
- Verify file is not corrupted

**Validation Errors**
- Check entity schema documentation
- Verify required fields are present
- Use provided templates as reference

**Import Timeout**
- Reduce batch size
- Check network connectivity
- Use smaller files

**Memory Issues**
- Process files in smaller batches
- Increase available memory
- Use streaming for very large files

### Debug Mode

Enable debug logging:

```typescript
const importer = new BulkImporter({
  debug: true,
});
```

### Support

For additional support:
1. Check the error details and suggestions
2. Review the entity schema documentation
3. Use the built-in template downloads
4. Contact your platform team for help

## License

This bulk import/export system is part of the Backstage IDP wrapper and follows the same license terms.