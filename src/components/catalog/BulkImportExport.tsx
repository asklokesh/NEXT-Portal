'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Eye, Settings, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'react-hot-toast';

import BulkImporter, { 
  ImportOptions, 
  ImportResult, 
  ImportProgress, 
  ImportError, 
  ConflictItem, 
  EntityPreview 
} from '@/lib/import/BulkImporter';
import BulkExporter, { 
  ExportOptions, 
  ExportResult, 
  ExportProgress, 
  ExportFilters 
} from '@/lib/export/BulkExporter';

interface BulkImportExportProps {
  entities?: any[];
  onImportComplete?: (result: ImportResult) => void;
  onExportComplete?: (result: ExportResult) => void;
}

export default function BulkImportExport({ 
  entities = [], 
  onImportComplete, 
  onExportComplete 
}: BulkImportExportProps) {
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    format: 'auto',
    conflictResolution: 'prompt',
    validateOnly: false,
    dryRun: false,
  });
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'yaml',
    includeMetadata: true,
    compression: false,
  });
  const [exportFilters, setExportFilters] = useState<ExportFilters>({});
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // UI state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importer = new BulkImporter(importOptions);
  const exporter = new BulkExporter();

  // File drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImportFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  }, []);

  // Import handlers
  const handleImport = useCallback(async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setImportProgress(null);

    try {
      // Set up progress tracking
      importer.onProgress((progress) => {
        setImportProgress(progress);
      });

      const fileBuffer = await importFile.arrayBuffer();
      const result = await importer.importFromFile(fileBuffer, importFile.name, importOptions);

      setImportResult(result);
      setConflicts(result.conflicts);

      if (result.success) {
        toast.success(`Successfully imported ${result.imported} entities`);
        onImportComplete?.(result);
      } else {
        const errorCount = result.errors.filter(e => e.severity === 'error').length;
        toast.error(`Import failed with ${errorCount} errors`);
      }
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, importOptions, importer, onImportComplete]);

  const handlePreview = useCallback(async () => {
    if (!importFile) {
      toast.error('Please select a file to preview');
      return;
    }

    try {
      const fileBuffer = await importFile.arrayBuffer();
      const result = await importer.importFromFile(fileBuffer, importFile.name, {
        ...importOptions,
        validateOnly: true,
      });

      setImportResult(result);
      setShowPreview(true);
    } catch (error) {
      toast.error(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [importFile, importOptions, importer]);

  // Export handlers
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgress(null);

    try {
      // Set up progress tracking
      exporter.onProgress((progress) => {
        setExportProgress(progress);
      });

      const result = await exporter.exportEntities(entities, {
        ...exportOptions,
        filters: exportFilters,
      });

      // Download the file
      const blob = new Blob([result.fileBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${result.metadata.filteredEntities} entities`);
      onExportComplete?.(result);
    } catch (error) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [entities, exportOptions, exportFilters, exporter, onExportComplete]);

  const handleDownloadTemplate = useCallback(async (kind: string, format: string) => {
    try {
      const templateBuffer = await BulkImporter.createImportTemplate(
        kind, 
        format as any, 
        3
      );

      const blob = new Blob([templateBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind.toLowerCase()}-template.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${kind} template`);
    } catch (error) {
      toast.error(`Failed to download template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Import/Export</h2>
          <p className="text-muted-foreground">
            Import and export entities in bulk with smart templates and validation
          </p>
        </div>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Entities
              </CardTitle>
              <CardDescription>
                Upload files to import entities into your catalog. Supports YAML, JSON, CSV, and Excel formats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".yaml,.yml,.json,.csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  
                  <div>
                    <p className="text-lg font-medium">
                      {importFile ? importFile.name : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports YAML, JSON, CSV, and Excel files (max 50MB)
                    </p>
                  </div>

                  {importFile && (
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="secondary">
                        {importFile.size > 1024 * 1024 
                          ? `${(importFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : `${(importFile.size / 1024).toFixed(1)} KB`
                        }
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setImportFile(null)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="format">File Format</Label>
                  <Select 
                    value={importOptions.format} 
                    onValueChange={(value) => setImportOptions(prev => ({ ...prev, format: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="yaml">YAML</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conflict-resolution">Conflict Resolution</Label>
                  <Select 
                    value={importOptions.conflictResolution} 
                    onValueChange={(value) => setImportOptions(prev => ({ ...prev, conflictResolution: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prompt">Prompt for decision</SelectItem>
                      <SelectItem value="skip">Skip conflicts</SelectItem>
                      <SelectItem value="overwrite">Overwrite existing</SelectItem>
                      <SelectItem value="merge">Merge changes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="validate-only"
                    checked={importOptions.validateOnly}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, validateOnly: !!checked }))
                    }
                  />
                  <Label htmlFor="validate-only">Validate only (don't import)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="dry-run"
                    checked={importOptions.dryRun}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, dryRun: !!checked }))
                    }
                  />
                  <Label htmlFor="dry-run">Dry run</Label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handlePreview}
                  variant="outline"
                  disabled={!importFile || isImporting}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                
                <Button 
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Import'}
                </Button>
              </div>

              {/* Progress */}
              {importProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{importProgress.message}</span>
                    <span>{importProgress.processed}/{importProgress.total}</span>
                  </div>
                  <Progress value={importProgress.progress} />
                </div>
              )}

              {/* Results */}
              {importResult && (
                <Alert className={importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center gap-2">
                    {importResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription>
                      <div className="space-y-2">
                        <p>
                          <strong>
                            {importResult.success ? 'Import completed successfully' : 'Import completed with errors'}
                          </strong>
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span>Processed: {importResult.processed}</span>
                          <span>Imported: {importResult.imported}</span>
                          <span>Skipped: {importResult.skipped}</span>
                          <span>Errors: {importResult.errors.length}</span>
                        </div>
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Errors */}
              {importResult?.errors && importResult.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Import Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'}>
                              {error.severity}
                            </Badge>
                            {error.row && <span className="text-muted-foreground">Row {error.row}:</span>}
                            <span>{error.message}</span>
                          </div>
                          {error.suggestions && (
                            <ul className="ml-4 mt-1 text-xs text-muted-foreground">
                              {error.suggestions.map((suggestion, i) => (
                                <li key={i}>• {suggestion}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          ... and {importResult.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Template Downloads */}
          <Card>
            <CardHeader>
              <CardTitle>Download Templates</CardTitle>
              <CardDescription>
                Download pre-configured templates to get started with importing your entities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Service', 'Component', 'API', 'Resource'].map((kind) => (
                  <div key={kind} className="space-y-3">
                    <h4 className="font-medium">{kind} Template</h4>
                    <div className="space-y-2">
                      {['csv', 'excel', 'yaml', 'json'].map((format) => (
                        <Button
                          key={format}
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadTemplate(kind, format)}
                          className="w-full justify-start"
                        >
                          <Download className="h-3 w-3 mr-2" />
                          {format.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Entities
              </CardTitle>
              <CardDescription>
                Export your catalog entities to various formats with custom filtering and templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export-format">Export Format</Label>
                  <Select 
                    value={exportOptions.format} 
                    onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yaml">YAML</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="zip">ZIP (all formats)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-template">Export Template</Label>
                  <Select 
                    value={exportOptions.template || 'none'} 
                    onValueChange={(value) => setExportOptions(prev => ({ 
                      ...prev, 
                      template: value === 'none' ? undefined : value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      <SelectItem value="service-summary">Service Summary</SelectItem>
                      <SelectItem value="component-inventory">Component Inventory</SelectItem>
                      <SelectItem value="security-audit">Security Audit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-metadata"
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeMetadata: !!checked }))
                    }
                  />
                  <Label htmlFor="include-metadata">Include metadata</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="compression"
                    checked={exportOptions.compression}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, compression: !!checked }))
                    }
                  />
                  <Label htmlFor="compression">Enable compression</Label>
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Export Filters</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                  </Button>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="filter-kinds">Entity Kinds</Label>
                      <Input
                        id="filter-kinds"
                        placeholder="e.g., Component, API, Resource"
                        value={exportFilters.kinds?.join(', ') || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          kinds: e.target.value ? e.target.value.split(',').map(k => k.trim()) : undefined
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-namespaces">Namespaces</Label>
                      <Input
                        id="filter-namespaces"
                        placeholder="e.g., default, production"
                        value={exportFilters.namespaces?.join(', ') || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          namespaces: e.target.value ? e.target.value.split(',').map(n => n.trim()) : undefined
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-owners">Owners</Label>
                      <Input
                        id="filter-owners"
                        placeholder="e.g., platform-team, frontend-team"
                        value={exportFilters.owners?.join(', ') || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          owners: e.target.value ? e.target.value.split(',').map(o => o.trim()) : undefined
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-tags">Tags</Label>
                      <Input
                        id="filter-tags"
                        placeholder="e.g., api, frontend, database"
                        value={exportFilters.tags?.join(', ') || ''}
                        onChange={(e) => setExportFilters(prev => ({
                          ...prev,
                          tags: e.target.value ? e.target.value.split(',').map(t => t.trim()) : undefined
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleExport}
                  disabled={entities.length === 0 || isExporting}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : `Export ${entities.length} Entities`}
                </Button>
              </div>

              {/* Progress */}
              {exportProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{exportProgress.message}</span>
                    <span>{exportProgress.processed}/{exportProgress.total}</span>
                  </div>
                  <Progress value={exportProgress.progress} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {importResult?.preview && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.preview.slice(0, 50).map((entity, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge 
                          variant={
                            entity.status === 'valid' ? 'default' : 
                            entity.status === 'warning' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {entity.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{entity.kind}</TableCell>
                      <TableCell>{entity.metadata.name}</TableCell>
                      <TableCell>{entity.metadata.title || '-'}</TableCell>
                      <TableCell>
                        {entity.issues && entity.issues.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            {entity.issues.join(', ')}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}