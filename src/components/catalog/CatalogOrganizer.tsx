'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { 
  FolderIcon, 
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  UndoIcon,
  RedoIcon,
  SaveIcon,
  DownloadIcon,
  UploadIcon,
  SearchIcon,
  FilterIcon,
  SettingsIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  Eye,
  EyeOff,
} from 'lucide-react';

import { DragDropProvider, Draggable, DraggableCard, DroppableZone, DroppableList } from '@/lib/dnd';
import { OrganizationManager, OrganizationLayout, OrganizationNode, MoveOperation } from '@/lib/catalog/OrganizationManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Entity {
  id: string;
  name: string;
  kind: string;
  namespace?: string;
  description?: string;
  metadata?: Record<string, any>;
  relations?: {
    ownedBy?: string[];
    dependsOn?: string[];
    partOf?: string[];
  };
}

interface CatalogOrganizerProps {
  entities: Entity[];
  onEntitiesChange?: (entities: Entity[]) => void;
  onLayoutSave?: (layout: OrganizationLayout) => void;
  onLayoutLoad?: (layoutId: string) => Promise<OrganizationLayout | null>;
  currentUserId?: string;
  className?: string;
}

interface TreeNodeProps {
  node: OrganizationNode;
  layout: OrganizationLayout;
  entities: Entity[];
  level: number;
  onToggleCollapse: (nodeId: string) => void;
  onEditNode: (node: OrganizationNode) => void;
  onDeleteNode: (nodeId: string) => void;
  selectedNodes: Set<string>;
  onSelectNode: (nodeId: string, selected: boolean) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  layout,
  entities,
  level,
  onToggleCollapse,
  onEditNode,
  onDeleteNode,
  selectedNodes,
  onSelectNode,
}) => {
  const hasChildren = node.children.length > 0;
  const isCollapsed = node.collapsed;
  const isSelected = selectedNodes.has(node.id);

  const indent = level * 20;

  const getNodeIcon = () => {
    switch (node.type) {
      case 'domain':
        return <div className="w-4 h-4 bg-blue-500 rounded" />;
      case 'system':
        return <div className="w-4 h-4 bg-green-500 rounded-sm" />;
      case 'team':
        return <div className="w-4 h-4 bg-purple-500 rounded-full" />;
      case 'folder':
        return isCollapsed && hasChildren ? 
          <FolderIcon className="w-4 h-4 text-gray-600" /> : 
          <FolderOpenIcon className="w-4 h-4 text-gray-600" />;
      case 'entity':
        const entity = entities.find(e => e.id === node.id);
        return <div className={cn(
          "w-4 h-4 rounded",
          entity?.kind === 'Component' && "bg-orange-500",
          entity?.kind === 'API' && "bg-red-500",
          entity?.kind === 'Resource' && "bg-cyan-500",
          !entity && "bg-gray-400"
        )} />;
      default:
        return <div className="w-4 h-4 bg-gray-400 rounded" />;
    }
  };

  const entity = node.type === 'entity' ? entities.find(e => e.id === node.id) : null;

  return (
    <div>
      <Draggable
        id={node.id}
        data={{
          id: node.id,
          type: node.type,
          data: { ...node, entity },
        }}
        className={cn(
          "group flex items-center py-1 px-2 hover:bg-gray-50 rounded-md transition-colors",
          isSelected && "bg-blue-50",
          level === 0 && "font-medium"
        )}
      >
        <div className="flex items-center gap-1" style={{ marginLeft: indent }}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectNode(node.id, !!checked)}
            className="mr-2"
          />
          
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0 hover:bg-gray-200"
              onClick={() => onToggleCollapse(node.id)}
            >
              {isCollapsed ? 
                <ChevronRightIcon className="w-3 h-3" /> : 
                <ChevronDownIcon className="w-3 h-3" />
              }
            </Button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          <div className="mr-2">
            {getNodeIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm truncate">
                {node.name}
              </span>
              
              {node.type !== 'entity' && (
                <Badge variant="outline" className="text-xs">
                  {node.type}
                </Badge>
              )}
              
              {entity && (
                <Badge variant="secondary" className="text-xs">
                  {entity.kind}
                </Badge>
              )}
            </div>
            
            {(entity?.description || node.metadata?.description) && (
              <p className="text-xs text-gray-500 truncate mt-1">
                {entity?.description || node.metadata?.description}
              </p>
            )}
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0"
              onClick={() => onEditNode(node)}
            >
              <EditIcon className="w-3 h-3" />
            </Button>
            
            {node.permissions?.canDelete !== false && (
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDeleteNode(node.id)}
              >
                <TrashIcon className="w-3 h-3" />
              </Button>
            )}
            
            <GripVerticalIcon className="w-3 h-3 text-gray-400 cursor-grab" />
          </div>
        </div>
      </Draggable>
      
      {hasChildren && !isCollapsed && (
        <div className="ml-2">
          {node.children.map(childId => {
            const childNode = layout.nodes[childId];
            if (!childNode) return null;
            
            return (
              <TreeNode
                key={childId}
                node={childNode}
                layout={layout}
                entities={entities}
                level={level + 1}
                onToggleCollapse={onToggleCollapse}
                onEditNode={onEditNode}
                onDeleteNode={onDeleteNode}
                selectedNodes={selectedNodes}
                onSelectNode={onSelectNode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CatalogOrganizer: React.FC<CatalogOrganizerProps> = ({
  entities,
  onEntitiesChange,
  onLayoutSave,
  onLayoutLoad,
  currentUserId = 'default-user',
  className,
}) => {
  const [organizationManager] = useState(() => new OrganizationManager(currentUserId));
  const [currentLayout, setCurrentLayout] = useState<OrganizationLayout | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string>('');
  const [editingNode, setEditingNode] = useState<OrganizationNode | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'grid' | 'list'>('tree');

  // Initialize with default layout
  useEffect(() => {
    const initializeLayout = async () => {
      try {
        const defaultLayout = await organizationManager.createLayout('Default Layout', 'Auto-generated default layout');
        setCurrentLayout(defaultLayout);
        
        // Auto-organize entities by domain/system
        await autoOrganizeEntities(defaultLayout, entities);
      } catch (error) {
        console.error('Failed to initialize layout:', error);
        toast.error('Failed to initialize catalog organization');
      }
    };

    if (entities.length > 0 && !currentLayout) {
      initializeLayout();
    }
  }, [entities, currentLayout, organizationManager]);

  const autoOrganizeEntities = async (layout: OrganizationLayout, entities: Entity[]) => {
    const domainNodes = new Map<string, string>();
    const systemNodes = new Map<string, string>();

    for (const entity of entities) {
      const domain = entity.metadata?.domain || 'Uncategorized';
      const system = entity.metadata?.system;

      // Create domain node if it doesn't exist
      let domainNodeId = domainNodes.get(domain);
      if (!domainNodeId) {
        const domainNode = await organizationManager.addNode(layout.id, {
          name: domain,
          type: 'domain',
          parentId: null,
          order: 0,
        });
        if (domainNode) {
          domainNodeId = domainNode.id;
          domainNodes.set(domain, domainNodeId);
        }
      }

      // Create system node if specified
      let systemNodeId = systemNodes.get(system || '');
      if (system && !systemNodeId && domainNodeId) {
        const systemNode = await organizationManager.addNode(layout.id, {
          name: system,
          type: 'system',
          parentId: domainNodeId,
          order: 0,
        });
        if (systemNode) {
          systemNodeId = systemNode.id;
          systemNodes.set(system, systemNodeId);
        }
      }

      // Add entity node
      const parentId = systemNodeId || domainNodeId;
      if (parentId) {
        await organizationManager.addNode(layout.id, {
          name: entity.name,
          type: 'entity',
          parentId,
          order: 0,
          metadata: { entityId: entity.id, ...entity.metadata },
        });
      }
    }

    const updatedLayout = await organizationManager.getLayout(layout.id);
    if (updatedLayout) {
      setCurrentLayout(updatedLayout);
    }
  };

  const handleItemMoved = useCallback(async (dragItem: any, sourceId: string, targetId: string) => {
    if (!currentLayout) return;

    try {
      const success = await organizationManager.moveNode(
        currentLayout.id,
        dragItem.id,
        targetId === 'root' ? null : targetId
      );

      if (success) {
        const updatedLayout = await organizationManager.getLayout(currentLayout.id);
        if (updatedLayout) {
          setCurrentLayout(updatedLayout);
          toast.success('Item moved successfully');
        }
      }
    } catch (error) {
      console.error('Failed to move item:', error);
      toast.error('Failed to move item');
    }
  }, [currentLayout, organizationManager]);

  const handleBulkMove = useCallback(async (operations: MoveOperation[]) => {
    if (!currentLayout) return;

    try {
      await organizationManager.bulkMoveNodes(currentLayout.id, {
        operations,
        description: `Bulk move ${operations.length} items`,
      });

      const updatedLayout = await organizationManager.getLayout(currentLayout.id);
      if (updatedLayout) {
        setCurrentLayout(updatedLayout);
        toast.success(`Moved ${operations.length} items successfully`);
      }
    } catch (error) {
      console.error('Failed to bulk move items:', error);
      toast.error('Failed to move items');
    }
  }, [currentLayout, organizationManager]);

  const handleCreateFolder = useCallback(async () => {
    if (!currentLayout || !newFolderName.trim()) return;

    try {
      const parentId = newFolderParent || null;
      await organizationManager.addNode(currentLayout.id, {
        name: newFolderName.trim(),
        type: 'folder',
        parentId,
        order: 0,
      });

      const updatedLayout = await organizationManager.getLayout(currentLayout.id);
      if (updatedLayout) {
        setCurrentLayout(updatedLayout);
        setShowCreateFolder(false);
        setNewFolderName('');
        setNewFolderParent('');
        toast.success('Folder created successfully');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
    }
  }, [currentLayout, newFolderName, newFolderParent, organizationManager]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    if (!currentLayout) return;

    try {
      const success = await organizationManager.deleteNode(currentLayout.id, nodeId);
      if (success) {
        const updatedLayout = await organizationManager.getLayout(currentLayout.id);
        if (updatedLayout) {
          setCurrentLayout(updatedLayout);
          setSelectedNodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(nodeId);
            return newSet;
          });
          toast.success('Item deleted successfully');
        }
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
    }
  }, [currentLayout, organizationManager]);

  const handleToggleCollapse = useCallback(async (nodeId: string) => {
    if (!currentLayout) return;

    const node = currentLayout.nodes[nodeId];
    if (!node) return;

    const updatedNode = { ...node, collapsed: !node.collapsed };
    const updatedLayout = { ...currentLayout };
    updatedLayout.nodes[nodeId] = updatedNode;
    
    setCurrentLayout(updatedLayout);
  }, [currentLayout]);

  const handleSelectNode = useCallback((nodeId: string, selected: boolean) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleUndo = useCallback(async () => {
    if (!currentLayout) return;

    try {
      const undoneLayout = await organizationManager.undo(currentLayout.id);
      if (undoneLayout) {
        setCurrentLayout(undoneLayout);
        toast.success('Action undone');
      }
    } catch (error) {
      console.error('Failed to undo:', error);
      toast.error('Failed to undo action');
    }
  }, [currentLayout, organizationManager]);

  const handleRedo = useCallback(async () => {
    if (!currentLayout) return;

    try {
      const redoneLayout = await organizationManager.redo(currentLayout.id);
      if (redoneLayout) {
        setCurrentLayout(redoneLayout);
        toast.success('Action redone');
      }
    } catch (error) {
      console.error('Failed to redo:', error);
      toast.error('Failed to redo action');
    }
  }, [currentLayout, organizationManager]);

  const handleSaveLayout = useCallback(async () => {
    if (!currentLayout) return;

    try {
      await organizationManager.saveToStorage(currentLayout.id);
      onLayoutSave?.(currentLayout);
      toast.success('Layout saved successfully');
    } catch (error) {
      console.error('Failed to save layout:', error);
      toast.error('Failed to save layout');
    }
  }, [currentLayout, organizationManager, onLayoutSave]);

  const handleExportLayout = useCallback(async () => {
    if (!currentLayout) return;

    try {
      const exported = await organizationManager.exportLayout(currentLayout.id);
      if (exported) {
        const blob = new Blob([exported], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLayout.name.replace(/\s+/g, '_')}_layout.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Layout exported successfully');
      }
    } catch (error) {
      console.error('Failed to export layout:', error);
      toast.error('Failed to export layout');
    }
  }, [currentLayout, organizationManager]);

  const filteredNodes = useMemo(() => {
    if (!currentLayout || !searchQuery) return currentLayout?.rootNodes || [];

    const matchingNodes = organizationManager.searchNodes(currentLayout.id, searchQuery);
    return matchingNodes.map(node => node.id);
  }, [currentLayout, searchQuery, organizationManager]);

  const folderOptions = useMemo(() => {
    if (!currentLayout) return [];

    return Object.values(currentLayout.nodes)
      .filter(node => node.type === 'folder' || node.type === 'domain' || node.type === 'system')
      .map(node => ({ id: node.id, name: node.name, type: node.type }));
  }, [currentLayout]);

  if (!currentLayout) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing catalog organization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Catalog Organization</h2>
          <Badge variant="outline">{currentLayout.name}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!organizationManager.canUndo()}
          >
            <UndoIcon className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!organizationManager.canRedo()}
          >
            <RedoIcon className="w-4 h-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="w-4 h-4 mr-1" />
                Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Folder Name</label>
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Parent Folder</label>
                  <Select value={newFolderParent} onValueChange={setNewFolderParent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Root Level</SelectItem>
                      {folderOptions.map(folder => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name} ({folder.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={handleSaveLayout}>
            <SaveIcon className="w-4 h-4 mr-1" />
            Save
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExportLayout}>
            <DownloadIcon className="w-4 h-4 mr-1" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities, folders, and groups..."
              className="pl-10"
            />
          </div>
          
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tree">Tree</SelectItem>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>
          
          {selectedNodes.size > 0 && (
            <Badge variant="secondary">
              {selectedNodes.size} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <DragDropProvider
          onItemMoved={handleItemMoved}
          onFolderCreated={(name, parentId) => {
            setNewFolderName(name);
            setNewFolderParent(parentId || '');
            setShowCreateFolder(true);
          }}
        >
          <ScrollArea className="h-full">
            <div className="p-4">
              {viewMode === 'tree' && (
                <div className="space-y-1">
                  {(searchQuery ? filteredNodes : currentLayout.rootNodes).map(nodeId => {
                    const node = currentLayout.nodes[nodeId];
                    if (!node) return null;
                    
                    return (
                      <TreeNode
                        key={nodeId}
                        node={node}
                        layout={currentLayout}
                        entities={entities}
                        level={0}
                        onToggleCollapse={handleToggleCollapse}
                        onEditNode={setEditingNode}
                        onDeleteNode={handleDeleteNode}
                        selectedNodes={selectedNodes}
                        onSelectNode={handleSelectNode}
                      />
                    );
                  })}
                </div>
              )}
              
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Object.values(currentLayout.nodes)
                    .filter(node => !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(node => {
                      const entity = node.type === 'entity' ? entities.find(e => e.id === node.metadata?.entityId) : null;
                      
                      return (
                        <DraggableCard
                          key={node.id}
                          id={node.id}
                          data={{
                            id: node.id,
                            type: node.type,
                            data: { ...node, entity },
                          }}
                          title={node.name}
                          subtitle={entity?.description || node.metadata?.description}
                          icon={node.type === 'folder' ? <FolderIcon className="w-4 h-4" /> : null}
                          onClick={() => handleSelectNode(node.id, !selectedNodes.has(node.id))}
                          className={cn(selectedNodes.has(node.id) && "ring-2 ring-blue-500")}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {node.type}
                            </Badge>
                            {entity && (
                              <Badge variant="secondary" className="text-xs">
                                {entity.kind}
                              </Badge>
                            )}
                          </div>
                        </DraggableCard>
                      );
                    })}
                </div>
              )}
            </div>
          </ScrollArea>
        </DragDropProvider>
      </div>

      {/* Statistics */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Total: {Object.keys(currentLayout.nodes).length} items</span>
            <span>Selected: {selectedNodes.size}</span>
            <span>Version: {currentLayout.version}</span>
          </div>
          <div>
            Last modified: {currentLayout.updatedAt.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogOrganizer;