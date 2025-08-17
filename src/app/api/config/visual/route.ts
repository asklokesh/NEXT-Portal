/**
 * Visual Configuration Management API
 * Zero/Low-code configuration endpoints for enterprise portals
 */

import { NextRequest, NextResponse } from 'next/server';
import VisualConfigManager, { ConfigCategory, FieldType, UIWidget } from '@/services/config-management/VisualConfigManager';

// Singleton configuration manager
let configManager: VisualConfigManager;

function getConfigManager(): VisualConfigManager {
  if (!configManager) {
    configManager = new VisualConfigManager();
  }
  return configManager;
}

// GET /api/config/visual - Get schemas or instances
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'schemas' or 'instances'
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const schemaId = searchParams.get('schemaId');

    const manager = getConfigManager();

    if (type === 'schemas') {
      if (id) {
        // Get specific schema
        const schema = manager.getConfigSchema(id);
        if (!schema) {
          return NextResponse.json({
            success: false,
            error: 'Schema not found'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          schema: {
            id: schema.id,
            name: schema.name,
            description: schema.description,
            category: schema.category,
            version: schema.version,
            fields: schema.fields,
            templates: schema.templates,
            metadata: schema.metadata
          }
        });
      }

      // Get all schemas or by category
      const schemas = category 
        ? manager.getSchemasByCategory(category as ConfigCategory)
        : manager.getAllConfigSchemas();

      return NextResponse.json({
        success: true,
        schemas: schemas.map(schema => ({
          id: schema.id,
          name: schema.name,
          description: schema.description,
          category: schema.category,
          version: schema.version,
          fields: schema.fields.length,
          templates: schema.templates.length,
          created: schema.metadata.created
        }))
      });
    }

    if (type === 'instances') {
      if (id) {
        // Get specific instance with full details
        const instance = manager.getConfigInstance(id);
        if (!instance) {
          return NextResponse.json({
            success: false,
            error: 'Configuration instance not found'
          }, { status: 404 });
        }

        const schema = manager.getConfigSchema(instance.schemaId);

        return NextResponse.json({
          success: true,
          instance: {
            id: instance.id,
            schemaId: instance.schemaId,
            schemaName: schema?.name,
            name: instance.name,
            description: instance.description,
            values: instance.values,
            status: instance.status,
            validation: instance.validation,
            deployment: instance.deployment,
            metadata: instance.metadata
          }
        });
      }

      // Get all instances or by schema
      const instances = schemaId 
        ? manager.getInstancesBySchema(schemaId)
        : manager.getAllConfigInstances();

      return NextResponse.json({
        success: true,
        instances: instances.map(instance => {
          const schema = manager.getConfigSchema(instance.schemaId);
          return {
            id: instance.id,
            schemaId: instance.schemaId,
            schemaName: schema?.name,
            name: instance.name,
            description: instance.description,
            status: instance.status,
            valid: instance.validation.valid,
            deployed: instance.status === 'deployed',
            environment: instance.deployment.environment,
            lastDeployed: instance.deployment.lastDeployed,
            createdAt: instance.metadata.createdAt,
            updatedAt: instance.metadata.updatedAt
          };
        })
      });
    }

    // Default: return categories and summary
    const allSchemas = manager.getAllConfigSchemas();
    const allInstances = manager.getAllConfigInstances();
    
    const categorySummary = Object.values(ConfigCategory).map(category => ({
      category,
      schemas: allSchemas.filter(s => s.category === category).length,
      instances: allInstances.filter(i => {
        const schema = manager.getConfigSchema(i.schemaId);
        return schema?.category === category;
      }).length
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalSchemas: allSchemas.length,
        totalInstances: allInstances.length,
        deployedInstances: allInstances.filter(i => i.status === 'deployed').length,
        categories: categorySummary
      }
    });

  } catch (error) {
    console.error('Failed to get configuration data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get configuration data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/config/visual - Create schema or instance
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, ...payload } = data;

    const manager = getConfigManager();

    if (type === 'schema') {
      const {
        name,
        description,
        category,
        version = '1.0.0',
        fields = [],
        templates = []
      } = payload;

      if (!name || !description || !category) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: name, description, category'
        }, { status: 400 });
      }

      const schema = await manager.createConfigSchema({
        name,
        description,
        category: category as ConfigCategory,
        version,
        fields,
        dependencies: [],
        validation: { global: [], cross_field: [] },
        templates
      });

      return NextResponse.json({
        success: true,
        schema: {
          id: schema.id,
          name: schema.name,
          description: schema.description,
          category: schema.category,
          version: schema.version
        }
      });
    }

    if (type === 'instance') {
      const {
        schemaId,
        name,
        description,
        values = {}
      } = payload;

      if (!schemaId || !name) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: schemaId, name'
        }, { status: 400 });
      }

      const instance = await manager.createConfigInstance(
        schemaId,
        name,
        values,
        description
      );

      return NextResponse.json({
        success: true,
        instance: {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          valid: instance.validation.valid,
          errors: instance.validation.errors,
          warnings: instance.validation.warnings
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid type. Must be "schema" or "instance"'
    }, { status: 400 });

  } catch (error) {
    console.error('Failed to create configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/config/visual - Update schema or instance
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, id, ...updates } = data;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID is required'
      }, { status: 400 });
    }

    const manager = getConfigManager();

    if (type === 'schema') {
      const updatedSchema = await manager.updateConfigSchema(id, updates);
      
      if (!updatedSchema) {
        return NextResponse.json({
          success: false,
          error: 'Schema not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        schema: {
          id: updatedSchema.id,
          name: updatedSchema.name,
          description: updatedSchema.description,
          version: updatedSchema.version,
          updated: updatedSchema.metadata.updated
        }
      });
    }

    if (type === 'instance') {
      const updatedInstance = await manager.updateConfigInstance(id, updates);
      
      if (!updatedInstance) {
        return NextResponse.json({
          success: false,
          error: 'Configuration instance not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        instance: {
          id: updatedInstance.id,
          name: updatedInstance.name,
          status: updatedInstance.status,
          valid: updatedInstance.validation.valid,
          errors: updatedInstance.validation.errors,
          warnings: updatedInstance.validation.warnings,
          updated: updatedInstance.metadata.updatedAt
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid type. Must be "schema" or "instance"'
    }, { status: 400 });

  } catch (error) {
    console.error('Failed to update configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/config/visual - Delete schema or instance (placeholder for future implementation)
export async function DELETE(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Delete operation not yet implemented'
  }, { status: 501 });
}