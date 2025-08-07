import { NextRequest, NextResponse } from 'next/server';
import { OrganizationManager, OrganizationLayoutSchema } from '@/lib/catalog/OrganizationManager';
import { z } from 'zod';

// In-memory storage for demo - replace with database in production
const organizationManagers = new Map<string, OrganizationManager>();

const getOrganizationManager = (userId: string): OrganizationManager => {
  if (!organizationManagers.has(userId)) {
    organizationManagers.set(userId, new OrganizationManager(userId));
  }
  return organizationManagers.get(userId)!;
};

const CreateLayoutRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

const UpdateLayoutRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z.object({
    showEmptyFolders: z.boolean().optional(),
    autoCollapseEmpty: z.boolean().optional(),
    sortMode: z.enum(['manual', 'alphabetical', 'type', 'lastModified']).optional(),
    groupBy: z.enum(['none', 'domain', 'system', 'team', 'type']).optional(),
    viewMode: z.enum(['tree', 'grid', 'list']).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const layoutId = searchParams.get('layoutId');
    const userId = request.headers.get('x-user-id') || 'default-user';

    const manager = getOrganizationManager(userId);

    if (layoutId) {
      // Get specific layout
      const layout = await manager.getLayout(layoutId);
      if (!layout) {
        return NextResponse.json(
          { error: 'Layout not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: layout,
      });
    } else {
      // Get all layouts
      const layouts = await manager.getAllLayouts();
      
      return NextResponse.json({
        success: true,
        data: layouts,
      });
    }
  } catch (error) {
    console.error('GET /api/catalog/organization error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const body = await request.json();
    
    const { name, description } = CreateLayoutRequestSchema.parse(body);
    
    const manager = getOrganizationManager(userId);
    const layout = await manager.createLayout(name, description);

    return NextResponse.json({
      success: true,
      data: layout,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/catalog/organization error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const layoutId = searchParams.get('layoutId');
    const userId = request.headers.get('x-user-id') || 'default-user';

    if (!layoutId) {
      return NextResponse.json(
        { error: 'Layout ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates = UpdateLayoutRequestSchema.parse(body);
    
    const manager = getOrganizationManager(userId);
    const updatedLayout = await manager.updateLayout(layoutId, updates);

    if (!updatedLayout) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedLayout,
    });
  } catch (error) {
    console.error('PUT /api/catalog/organization error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const layoutId = searchParams.get('layoutId');
    const userId = request.headers.get('x-user-id') || 'default-user';

    if (!layoutId) {
      return NextResponse.json(
        { error: 'Layout ID is required' },
        { status: 400 }
      );
    }
    
    const manager = getOrganizationManager(userId);
    const success = await manager.deleteLayout(layoutId);

    if (!success) {
      return NextResponse.json(
        { error: 'Layout not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/catalog/organization error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}