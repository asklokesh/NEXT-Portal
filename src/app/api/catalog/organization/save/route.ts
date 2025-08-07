import { NextRequest, NextResponse } from 'next/server';
import { OrganizationManager } from '@/lib/catalog/OrganizationManager';
import { z } from 'zod';

// In-memory storage for demo - replace with database in production
const organizationManagers = new Map<string, OrganizationManager>();

const getOrganizationManager = (userId: string): OrganizationManager => {
  if (!organizationManagers.has(userId)) {
    organizationManagers.set(userId, new OrganizationManager(userId));
  }
  return organizationManagers.get(userId)!;
};

const SaveLayoutRequestSchema = z.object({
  layoutId: z.string(),
  autoSave: z.boolean().optional().default(false),
});

const ImportLayoutRequestSchema = z.object({
  data: z.string(),
  name: z.string().optional(),
});

const AddNodeRequestSchema = z.object({
  layoutId: z.string(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['root', 'domain', 'system', 'team', 'folder', 'entity']),
  parentId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  order: z.number().optional().default(0),
});

const MoveNodeRequestSchema = z.object({
  layoutId: z.string(),
  nodeId: z.string(),
  newParentId: z.string().nullable(),
  position: z.number().optional(),
});

const BulkMoveRequestSchema = z.object({
  layoutId: z.string(),
  operations: z.array(z.object({
    nodeId: z.string(),
    fromParentId: z.string().nullable(),
    toParentId: z.string().nullable(),
    fromIndex: z.number(),
    toIndex: z.number(),
  })),
  description: z.string().optional(),
});

const DeleteNodeRequestSchema = z.object({
  layoutId: z.string(),
  nodeId: z.string(),
});

const UndoRedoRequestSchema = z.object({
  layoutId: z.string(),
  action: z.enum(['undo', 'redo']),
});

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user';
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const manager = getOrganizationManager(userId);
    const body = await request.json();

    switch (action) {
      case 'save':
        const { layoutId, autoSave } = SaveLayoutRequestSchema.parse(body);
        await manager.saveToStorage(layoutId);
        
        return NextResponse.json({
          success: true,
          message: autoSave ? 'Layout auto-saved' : 'Layout saved successfully',
        });

      case 'import':
        const { data, name } = ImportLayoutRequestSchema.parse(body);
        const importedLayout = await manager.importLayout(data, name);
        
        return NextResponse.json({
          success: true,
          data: importedLayout,
        });

      case 'export':
        const exportLayoutId = body.layoutId;
        if (!exportLayoutId) {
          return NextResponse.json(
            { error: 'Layout ID is required' },
            { status: 400 }
          );
        }
        
        const exportedData = await manager.exportLayout(exportLayoutId);
        if (!exportedData) {
          return NextResponse.json(
            { error: 'Layout not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: exportedData,
        });

      case 'duplicate':
        const { layoutId: sourceLayoutId, name: newName } = body;
        if (!sourceLayoutId || !newName) {
          return NextResponse.json(
            { error: 'Source layout ID and new name are required' },
            { status: 400 }
          );
        }
        
        const duplicatedLayout = await manager.duplicateLayout(sourceLayoutId, newName);
        if (!duplicatedLayout) {
          return NextResponse.json(
            { error: 'Source layout not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: duplicatedLayout,
        });

      case 'add-node':
        const { layoutId: addLayoutId, name: nodeName, type, parentId, metadata, order } = AddNodeRequestSchema.parse(body);
        const newNode = await manager.addNode(addLayoutId, {
          name: nodeName,
          type,
          parentId: parentId || null,
          metadata,
          order,
        }, parentId);
        
        if (!newNode) {
          return NextResponse.json(
            { error: 'Failed to create node - layout not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: newNode,
        });

      case 'move-node':
        const { layoutId: moveLayoutId, nodeId, newParentId, position } = MoveNodeRequestSchema.parse(body);
        const moveSuccess = await manager.moveNode(moveLayoutId, nodeId, newParentId, position);
        
        if (!moveSuccess) {
          return NextResponse.json(
            { error: 'Failed to move node' },
            { status: 400 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Node moved successfully',
        });

      case 'bulk-move':
        const { layoutId: bulkLayoutId, operations, description } = BulkMoveRequestSchema.parse(body);
        const bulkSuccess = await manager.bulkMoveNodes(bulkLayoutId, { operations, description });
        
        if (!bulkSuccess) {
          return NextResponse.json(
            { error: 'Failed to perform bulk move' },
            { status: 400 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: `Successfully moved ${operations.length} nodes`,
        });

      case 'delete-node':
        const { layoutId: deleteLayoutId, nodeId: deleteNodeId } = DeleteNodeRequestSchema.parse(body);
        const deleteSuccess = await manager.deleteNode(deleteLayoutId, deleteNodeId);
        
        if (!deleteSuccess) {
          return NextResponse.json(
            { error: 'Failed to delete node' },
            { status: 400 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Node deleted successfully',
        });

      case 'undo-redo':
        const { layoutId: undoRedoLayoutId, action: undoRedoAction } = UndoRedoRequestSchema.parse(body);
        let resultLayout;
        
        if (undoRedoAction === 'undo') {
          resultLayout = await manager.undo(undoRedoLayoutId);
        } else {
          resultLayout = await manager.redo(undoRedoLayoutId);
        }
        
        if (!resultLayout) {
          return NextResponse.json(
            { error: `No ${undoRedoAction} operation available` },
            { status: 400 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: resultLayout,
          message: `${undoRedoAction.charAt(0).toUpperCase() + undoRedoAction.slice(1)} successful`,
        });

      case 'history':
        const historyLayoutId = body.layoutId;
        const history = manager.getHistory(historyLayoutId);
        
        return NextResponse.json({
          success: true,
          data: history,
        });

      case 'search':
        const { layoutId: searchLayoutId, query } = body;
        if (!searchLayoutId || !query) {
          return NextResponse.json(
            { error: 'Layout ID and search query are required' },
            { status: 400 }
          );
        }
        
        const searchResults = manager.searchNodes(searchLayoutId, query);
        
        return NextResponse.json({
          success: true,
          data: searchResults,
        });

      case 'stats':
        const statsLayoutId = body.layoutId;
        if (!statsLayoutId) {
          return NextResponse.json(
            { error: 'Layout ID is required' },
            { status: 400 }
          );
        }
        
        const stats = manager.getLayoutStats(statsLayoutId);
        if (!stats) {
          return NextResponse.json(
            { error: 'Layout not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: stats,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('POST /api/catalog/organization/save error:', error);
    
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const layoutId = searchParams.get('layoutId');
    const userId = request.headers.get('x-user-id') || 'default-user';
    
    const manager = getOrganizationManager(userId);

    switch (action) {
      case 'can-undo':
        return NextResponse.json({
          success: true,
          data: { canUndo: manager.canUndo() },
        });

      case 'can-redo':
        return NextResponse.json({
          success: true,
          data: { canRedo: manager.canRedo() },
        });

      case 'history':
        const history = manager.getHistory(layoutId || undefined);
        return NextResponse.json({
          success: true,
          data: history,
        });

      case 'stats':
        if (!layoutId) {
          return NextResponse.json(
            { error: 'Layout ID is required' },
            { status: 400 }
          );
        }
        
        const stats = manager.getLayoutStats(layoutId);
        if (!stats) {
          return NextResponse.json(
            { error: 'Layout not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: stats,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GET /api/catalog/organization/save error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}