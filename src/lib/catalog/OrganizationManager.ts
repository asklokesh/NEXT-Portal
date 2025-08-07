import { z } from 'zod';

// Organization structure schemas
export const OrganizationNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['root', 'domain', 'system', 'team', 'folder', 'entity']),
  parentId: z.string().nullable(),
  children: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
  order: z.number().default(0),
  collapsed: z.boolean().default(false),
  permissions: z.object({
    canEdit: z.boolean().default(true),
    canDelete: z.boolean().default(true),
    canMove: z.boolean().default(true),
  }).optional(),
});

export const OrganizationLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.number().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  isDefault: z.boolean().default(false),
  nodes: z.record(z.string(), OrganizationNodeSchema),
  rootNodes: z.array(z.string()),
  settings: z.object({
    showEmptyFolders: z.boolean().default(true),
    autoCollapseEmpty: z.boolean().default(false),
    sortMode: z.enum(['manual', 'alphabetical', 'type', 'lastModified']).default('manual'),
    groupBy: z.enum(['none', 'domain', 'system', 'team', 'type']).default('none'),
    viewMode: z.enum(['tree', 'grid', 'list']).default('tree'),
  }).optional(),
});

export const OrganizationHistorySchema = z.object({
  id: z.string(),
  layoutId: z.string(),
  action: z.enum(['create', 'update', 'delete', 'move', 'rename', 'reorganize']),
  timestamp: z.date(),
  userId: z.string(),
  changes: z.record(z.any()),
  description: z.string().optional(),
});

export type OrganizationNode = z.infer<typeof OrganizationNodeSchema>;
export type OrganizationLayout = z.infer<typeof OrganizationLayoutSchema>;
export type OrganizationHistory = z.infer<typeof OrganizationHistorySchema>;

export interface MoveOperation {
  nodeId: string;
  fromParentId: string | null;
  toParentId: string | null;
  fromIndex: number;
  toIndex: number;
}

export interface BulkMoveOperation {
  operations: MoveOperation[];
  description?: string;
}

export class OrganizationManager {
  private layouts: Map<string, OrganizationLayout> = new Map();
  private history: OrganizationHistory[] = [];
  private undoStack: OrganizationLayout[] = [];
  private redoStack: OrganizationLayout[] = [];
  private maxHistorySize = 50;
  private maxUndoSize = 20;

  constructor(private userId: string = 'system') {}

  // Layout Management
  async createLayout(name: string, description?: string): Promise<OrganizationLayout> {
    const layout: OrganizationLayout = {
      id: `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.userId,
      isDefault: false,
      nodes: {},
      rootNodes: [],
      settings: {
        showEmptyFolders: true,
        autoCollapseEmpty: false,
        sortMode: 'manual',
        groupBy: 'none',
        viewMode: 'tree',
      },
    };

    this.layouts.set(layout.id, layout);
    await this.addToHistory(layout.id, 'create', { layout });
    
    return layout;
  }

  async getLayout(layoutId: string): Promise<OrganizationLayout | null> {
    return this.layouts.get(layoutId) || null;
  }

  async updateLayout(layoutId: string, updates: Partial<OrganizationLayout>): Promise<OrganizationLayout | null> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return null;

    this.saveToUndoStack(layout);

    const updatedLayout = {
      ...layout,
      ...updates,
      updatedAt: new Date(),
      version: layout.version + 1,
    };

    this.layouts.set(layoutId, updatedLayout);
    await this.addToHistory(layoutId, 'update', { updates });

    return updatedLayout;
  }

  async deleteLayout(layoutId: string): Promise<boolean> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    this.layouts.delete(layoutId);
    await this.addToHistory(layoutId, 'delete', { layout });

    return true;
  }

  async duplicateLayout(layoutId: string, newName: string): Promise<OrganizationLayout | null> {
    const originalLayout = this.layouts.get(layoutId);
    if (!originalLayout) return null;

    const duplicatedLayout: OrganizationLayout = {
      ...originalLayout,
      id: `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.userId,
      isDefault: false,
      version: 1,
    };

    this.layouts.set(duplicatedLayout.id, duplicatedLayout);
    await this.addToHistory(duplicatedLayout.id, 'create', { 
      originalLayoutId: layoutId,
      duplicatedLayout,
    });

    return duplicatedLayout;
  }

  // Node Management
  async addNode(
    layoutId: string,
    node: Omit<OrganizationNode, 'id' | 'children'>,
    parentId?: string
  ): Promise<OrganizationNode | null> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return null;

    this.saveToUndoStack(layout);

    const newNode: OrganizationNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      children: [],
      parentId: parentId || null,
    };

    // Validate hierarchy
    if (parentId && !this.isValidParent(layout, parentId, newNode.type)) {
      throw new Error(`Invalid parent for node type ${newNode.type}`);
    }

    layout.nodes[newNode.id] = newNode;

    if (parentId) {
      const parent = layout.nodes[parentId];
      if (parent) {
        parent.children.push(newNode.id);
      }
    } else {
      layout.rootNodes.push(newNode.id);
    }

    layout.updatedAt = new Date();
    layout.version += 1;

    await this.addToHistory(layoutId, 'create', { node: newNode });

    return newNode;
  }

  async moveNode(
    layoutId: string,
    nodeId: string,
    newParentId: string | null,
    position?: number
  ): Promise<boolean> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    const node = layout.nodes[nodeId];
    if (!node) return false;

    // Prevent moving a node into its own subtree
    if (newParentId && this.isDescendant(layout, newParentId, nodeId)) {
      throw new Error('Cannot move node into its own subtree');
    }

    this.saveToUndoStack(layout);

    const oldParentId = node.parentId;

    // Remove from old parent
    if (oldParentId) {
      const oldParent = layout.nodes[oldParentId];
      if (oldParent) {
        oldParent.children = oldParent.children.filter(id => id !== nodeId);
      }
    } else {
      layout.rootNodes = layout.rootNodes.filter(id => id !== nodeId);
    }

    // Add to new parent
    node.parentId = newParentId;
    
    if (newParentId) {
      const newParent = layout.nodes[newParentId];
      if (!newParent) return false;

      if (this.isValidParent(layout, newParentId, node.type)) {
        if (typeof position === 'number') {
          newParent.children.splice(position, 0, nodeId);
        } else {
          newParent.children.push(nodeId);
        }
      } else {
        throw new Error(`Invalid parent for node type ${node.type}`);
      }
    } else {
      if (typeof position === 'number') {
        layout.rootNodes.splice(position, 0, nodeId);
      } else {
        layout.rootNodes.push(nodeId);
      }
    }

    layout.updatedAt = new Date();
    layout.version += 1;

    await this.addToHistory(layoutId, 'move', {
      nodeId,
      oldParentId,
      newParentId,
      position,
    });

    return true;
  }

  async bulkMoveNodes(layoutId: string, operations: BulkMoveOperation): Promise<boolean> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    this.saveToUndoStack(layout);

    try {
      for (const op of operations.operations) {
        await this.moveNode(layoutId, op.nodeId, op.toParentId, op.toIndex);
      }

      await this.addToHistory(layoutId, 'reorganize', {
        operations: operations.operations,
        description: operations.description,
      });

      return true;
    } catch (error) {
      // Rollback on error
      await this.undo(layoutId);
      throw error;
    }
  }

  async deleteNode(layoutId: string, nodeId: string): Promise<boolean> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    const node = layout.nodes[nodeId];
    if (!node) return false;

    this.saveToUndoStack(layout);

    // Check permissions
    if (node.permissions && !node.permissions.canDelete) {
      throw new Error('Node cannot be deleted due to permissions');
    }

    // Recursively delete children
    const childrenToDelete = [...node.children];
    for (const childId of childrenToDelete) {
      await this.deleteNode(layoutId, childId);
    }

    // Remove from parent
    if (node.parentId) {
      const parent = layout.nodes[node.parentId];
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    } else {
      layout.rootNodes = layout.rootNodes.filter(id => id !== nodeId);
    }

    delete layout.nodes[nodeId];

    layout.updatedAt = new Date();
    layout.version += 1;

    await this.addToHistory(layoutId, 'delete', { nodeId, node });

    return true;
  }

  // Validation
  private isValidParent(layout: OrganizationLayout, parentId: string, childType: string): boolean {
    const parent = layout.nodes[parentId];
    if (!parent) return false;

    const validParentTypes: Record<string, string[]> = {
      domain: ['root'],
      system: ['root', 'domain'],
      team: ['root', 'domain', 'system'],
      folder: ['root', 'domain', 'system', 'team', 'folder'],
      entity: ['root', 'domain', 'system', 'team', 'folder'],
    };

    return validParentTypes[childType]?.includes(parent.type) ?? false;
  }

  private isDescendant(layout: OrganizationLayout, ancestorId: string, nodeId: string): boolean {
    const node = layout.nodes[nodeId];
    if (!node || !node.parentId) return false;

    if (node.parentId === ancestorId) return true;

    return this.isDescendant(layout, ancestorId, node.parentId);
  }

  // Undo/Redo Operations
  private saveToUndoStack(layout: OrganizationLayout): void {
    this.undoStack.push(JSON.parse(JSON.stringify(layout)));
    
    if (this.undoStack.length > this.maxUndoSize) {
      this.undoStack.shift();
    }

    // Clear redo stack when new operation is performed
    this.redoStack = [];
  }

  async undo(layoutId: string): Promise<OrganizationLayout | null> {
    const previousState = this.undoStack.pop();
    if (!previousState) return null;

    const currentLayout = this.layouts.get(layoutId);
    if (currentLayout) {
      this.redoStack.push(JSON.parse(JSON.stringify(currentLayout)));
    }

    this.layouts.set(layoutId, previousState);
    await this.addToHistory(layoutId, 'update', { action: 'undo' });

    return previousState;
  }

  async redo(layoutId: string): Promise<OrganizationLayout | null> {
    const nextState = this.redoStack.pop();
    if (!nextState) return null;

    const currentLayout = this.layouts.get(layoutId);
    if (currentLayout) {
      this.undoStack.push(JSON.parse(JSON.stringify(currentLayout)));
    }

    this.layouts.set(layoutId, nextState);
    await this.addToHistory(layoutId, 'update', { action: 'redo' });

    return nextState;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // History Management
  private async addToHistory(
    layoutId: string,
    action: OrganizationHistory['action'],
    changes: Record<string, any>
  ): Promise<void> {
    const historyEntry: OrganizationHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      layoutId,
      action,
      timestamp: new Date(),
      userId: this.userId,
      changes,
    };

    this.history.push(historyEntry);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getHistory(layoutId?: string): OrganizationHistory[] {
    if (layoutId) {
      return this.history.filter(entry => entry.layoutId === layoutId);
    }
    return [...this.history];
  }

  // Import/Export
  async exportLayout(layoutId: string): Promise<string | null> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return null;

    return JSON.stringify(layout, null, 2);
  }

  async importLayout(data: string, name?: string): Promise<OrganizationLayout> {
    const parsed = JSON.parse(data);
    const layout = OrganizationLayoutSchema.parse(parsed);

    // Generate new ID and reset metadata
    layout.id = `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    layout.createdAt = new Date();
    layout.updatedAt = new Date();
    layout.createdBy = this.userId;
    layout.version = 1;
    
    if (name) {
      layout.name = name;
    }

    this.layouts.set(layout.id, layout);
    await this.addToHistory(layout.id, 'create', { imported: true });

    return layout;
  }

  // Search and Query
  searchNodes(layoutId: string, query: string): OrganizationNode[] {
    const layout = this.layouts.get(layoutId);
    if (!layout) return [];

    const searchTerm = query.toLowerCase();
    
    return Object.values(layout.nodes).filter(node =>
      node.name.toLowerCase().includes(searchTerm) ||
      node.type.toLowerCase().includes(searchTerm) ||
      (node.metadata && JSON.stringify(node.metadata).toLowerCase().includes(searchTerm))
    );
  }

  getNodesByType(layoutId: string, type: OrganizationNode['type']): OrganizationNode[] {
    const layout = this.layouts.get(layoutId);
    if (!layout) return [];

    return Object.values(layout.nodes).filter(node => node.type === type);
  }

  getNodePath(layoutId: string, nodeId: string): OrganizationNode[] {
    const layout = this.layouts.get(layoutId);
    if (!layout) return [];

    const path: OrganizationNode[] = [];
    let currentNode = layout.nodes[nodeId];

    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId ? layout.nodes[currentNode.parentId] : null;
    }

    return path;
  }

  // Statistics
  getLayoutStats(layoutId: string) {
    const layout = this.layouts.get(layoutId);
    if (!layout) return null;

    const nodes = Object.values(layout.nodes);
    const typeCount = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalNodes: nodes.length,
      rootNodes: layout.rootNodes.length,
      typeCount,
      maxDepth: this.calculateMaxDepth(layout),
      lastModified: layout.updatedAt,
      version: layout.version,
    };
  }

  private calculateMaxDepth(layout: OrganizationLayout): number {
    let maxDepth = 0;

    const calculateDepth = (nodeId: string, currentDepth: number): void => {
      maxDepth = Math.max(maxDepth, currentDepth);
      const node = layout.nodes[nodeId];
      if (node) {
        node.children.forEach(childId => calculateDepth(childId, currentDepth + 1));
      }
    };

    layout.rootNodes.forEach(rootId => calculateDepth(rootId, 1));

    return maxDepth;
  }

  // Persistence Methods (to be implemented with actual storage)
  async saveToStorage(layoutId: string): Promise<void> {
    // Implementation depends on storage backend (localStorage, API, database, etc.)
    const layout = this.layouts.get(layoutId);
    if (layout && typeof window !== 'undefined') {
      localStorage.setItem(`catalog_layout_${layoutId}`, JSON.stringify(layout));
    }
  }

  async loadFromStorage(layoutId: string): Promise<OrganizationLayout | null> {
    // Implementation depends on storage backend
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`catalog_layout_${layoutId}`);
      if (stored) {
        const layout = OrganizationLayoutSchema.parse(JSON.parse(stored));
        this.layouts.set(layoutId, layout);
        return layout;
      }
    }
    return null;
  }

  async getAllLayouts(): Promise<OrganizationLayout[]> {
    return Array.from(this.layouts.values());
  }
}