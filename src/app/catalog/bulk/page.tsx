'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, FileText, Upload, Download } from 'lucide-react';
import BulkImportExport from '@/components/catalog/BulkImportExport';
import { ImportResult, ExportResult } from '@/lib/import/BulkImporter';

// Mock entities for demonstration
const mockEntities = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'user-service',
      namespace: 'default',
      title: 'User Management Service',
      description: 'RESTful service for user authentication and management',
      tags: ['auth', 'users', 'rest-api'],
      annotations: {
        'backstage.io/source-location': 'https://github.com/company/user-service',
        'backstage.io/language': 'TypeScript',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
      },
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'authentication',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'user-api',
      namespace: 'default',
      title: 'User Management API',
      description: 'RESTful API for user management',
      tags: ['api', 'users', 'openapi'],
      annotations: {
        'backstage.io/definition-at-location': 'https://api.example.com/openapi.json',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
      },
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'authentication',
      definition: '$ref: https://api.example.com/openapi.json',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'user-database',
      namespace: 'default',
      title: 'User Database',
      description: 'PostgreSQL database for user data',
      tags: ['database', 'postgres', 'storage'],
      annotations: {
        'backstage.io/cloud-provider': 'aws',
        'backstage.io/region': 'us-east-1',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
        environment: 'production',
      },
    },
    spec: {
      type: 'database',
      owner: 'platform-team',
      system: 'authentication',
    },
  },
];

export default function BulkImportExportPage() {
  const [entities, setEntities] = useState(mockEntities);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);

  const handleImportComplete = (result: ImportResult) => {
    setLastImportResult(result);
    
    // In a real application, you would update the catalog with imported entities
    if (result.success && result.imported > 0) {
      console.log('Import completed successfully:', result);
      // Refresh entity list here
    }
  };

  const handleExportComplete = (result: ExportResult) => {
    setLastExportResult(result);
    console.log('Export completed successfully:', result);
  };

  const stats = {
    totalEntities: entities.length,
    byKind: entities.reduce((acc, entity) => {
      acc[entity.kind] = (acc[entity.kind] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byOwner: entities.reduce((acc, entity) => {
      const owner = entity.spec?.owner || 'Unknown';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Bulk Import/Export</h1>
        <p className="text-lg text-muted-foreground">
          Import and export catalog entities in bulk with smart templates and validation.
        </p>
      </div>

      {/* Current Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Catalog
          </CardTitle>
          <CardDescription>
            Overview of entities currently in your catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold">{stats.totalEntities}</div>
              <div className="text-sm text-muted-foreground">Total Entities</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">By Kind</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.byKind).map(([kind, count]) => (
                  <Badge key={kind} variant="secondary">
                    {kind}: {count}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">By Owner</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.byOwner).map(([owner, count]) => (
                  <Badge key={owner} variant="outline">
                    {owner}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Quick Start:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Download a template to get started with importing</li>
              <li>Use the Import tab to upload and validate your data</li>
              <li>Use the Export tab to export existing entities with filters</li>
              <li>All operations support progress tracking and error recovery</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Main Import/Export Component */}
      <BulkImportExport
        entities={entities}
        onImportComplete={handleImportComplete}
        onExportComplete={handleExportComplete}
      />

      {/* Recent Activity */}
      {(lastImportResult || lastExportResult) && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Summary of your recent import/export operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastImportResult && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Import Operation</div>
                    <div className="text-sm text-muted-foreground">
                      {lastImportResult.success ? 'Completed successfully' : 'Completed with errors'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {lastImportResult.imported}/{lastImportResult.processed} entities
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {lastImportResult.errors.length} errors
                  </div>
                </div>
              </div>
            )}

            {lastExportResult && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Export Operation</div>
                    <div className="text-sm text-muted-foreground">
                      {lastExportResult.success ? 'Completed successfully' : 'Failed'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {lastExportResult.metadata.filteredEntities} entities
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {lastExportResult.format.toUpperCase()} format
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help & Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Resources to help you get the most out of bulk import/export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Getting Started</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Download templates for your entity types</li>
                <li>• Start with small batches to test your data</li>
                <li>• Use validation mode to check for errors</li>
                <li>• Review the import preview before committing</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Best Practices</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Keep entity names lowercase with hyphens</li>
                <li>• Use consistent naming conventions</li>
                <li>• Validate entity references exist</li>
                <li>• Back up your data before large imports</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}