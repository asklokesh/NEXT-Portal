'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
 Node,
 Edge,
 Controls,
 Background,
 MiniMap,
 useNodesState,
 useEdgesState,
 addEdge,
 Connection,
 MarkerType,
 NodeTypes,
 EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
 Plus, 
 Save, 
 Play, 
 Settings, 
 FileText,
 CheckCircle,
 Bell,
 Zap,
 GitBranch,
 Clock,
 Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from '@/components/ui/sheet';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { WorkflowDefinition, WorkflowStep, WorkflowTrigger } from '@/types/workflow';
import { workflowService } from '@/services/workflow/workflow-service';
import { toast } from 'sonner';

// Custom node components
const ApprovalNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-blue-500">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle className="h-4 w-4 text-blue-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Approval step'}</p>
 </Card>
);

const ActionNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-green-500">
 <div className="flex items-center gap-2 mb-2">
 <Zap className="h-4 w-4 text-green-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Action step'}</p>
 </Card>
);

const NotificationNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-yellow-500">
 <div className="flex items-center gap-2 mb-2">
 <Bell className="h-4 w-4 text-yellow-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Notification step'}</p>
 </Card>
);

const ConditionNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-purple-500">
 <div className="flex items-center gap-2 mb-2">
 <Filter className="h-4 w-4 text-purple-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Condition step'}</p>
 </Card>
);

const ParallelNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-orange-500">
 <div className="flex items-center gap-2 mb-2">
 <GitBranch className="h-4 w-4 text-orange-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Parallel execution'}</p>
 </Card>
);

const WaitNode = ({ data }: { data: any }) => (
 <Card className="p-4 min-w-[200px] border-2 border-gray-500">
 <div className="flex items-center gap-2 mb-2">
 <Clock className="h-4 w-4 text-gray-500" />
 <span className="font-semibold">{data.label}</span>
 </div>
 <p className="text-xs text-gray-600">{data.description || 'Wait step'}</p>
 </Card>
);

const nodeTypes: NodeTypes = {
 approval: ApprovalNode,
 action: ActionNode,
 notification: NotificationNode,
 condition: ConditionNode,
 parallel: ParallelNode,
 wait: WaitNode,
};

interface WorkflowBuilderProps {
 workflow?: WorkflowDefinition;
 onSave?: (workflow: WorkflowDefinition) => void;
}

export default function WorkflowBuilder({ workflow, onSave }: WorkflowBuilderProps) {
 const [nodes, setNodes, onNodesChange] = useNodesState([]);
 const [edges, setEdges, onEdgesChange] = useEdgesState([]);
 const [selectedNode, setSelectedNode] = useState<Node | null>(null);
 const [showNodeConfig, setShowNodeConfig] = useState(false);
 const [workflowName, setWorkflowName] = useState(workflow?.name || 'New Workflow');
 const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
 const [workflowCategory, setWorkflowCategory] = useState(workflow?.category || 'custom');

 const reactFlowWrapper = useRef<HTMLDivElement>(null);
 const nodeId = useRef(1);

 // Initialize from existing workflow
 useEffect(() => {
 if (workflow) {
 // Convert workflow steps to nodes
 const workflowNodes: Node[] = workflow.steps.map((step, index) => ({
 id: step.id,
 type: step.type,
 position: { x: 250 * (index % 3), y: 150 * Math.floor(index / 3) },
 data: { 
 label: step.name,
 description: step.configuration.type === 'approval' 
 ? `Approval by ${(step.configuration as any).approvers.length} approver(s)`
 : step.type,
 ...step 
 },
 }));

 // Convert step connections to edges
 const workflowEdges: Edge[] = [];
 workflow.steps.forEach(step => {
 step.onSuccess?.forEach(nextId => {
 workflowEdges.push({
 id: `${step.id}-${nextId}-success`,
 source: step.id,
 target: nextId,
 type: 'smoothstep',
 animated: true,
 label: 'Success',
 labelStyle: { fill: '#10b981' },
 style: { stroke: '#10b981' },
 markerEnd: {
 type: MarkerType.ArrowClosed,
 color: '#10b981',
 },
 });
 });
 step.onFailure?.forEach(nextId => {
 workflowEdges.push({
 id: `${step.id}-${nextId}-failure`,
 source: step.id,
 target: nextId,
 type: 'smoothstep',
 animated: true,
 label: 'Failure',
 labelStyle: { fill: '#ef4444' },
 style: { stroke: '#ef4444' },
 markerEnd: {
 type: MarkerType.ArrowClosed,
 color: '#ef4444',
 },
 });
 });
 });

 setNodes(workflowNodes);
 setEdges(workflowEdges);
 }
 }, [workflow, setNodes, setEdges]);

 const onConnect = useCallback((params: Connection) => {
 const newEdge = {
 ...params,
 type: 'smoothstep',
 animated: true,
 label: 'Success',
 labelStyle: { fill: '#10b981' },
 style: { stroke: '#10b981' },
 markerEnd: {
 type: MarkerType.ArrowClosed,
 color: '#10b981',
 },
 };
 setEdges((eds) => addEdge(newEdge, eds));
 }, [setEdges]);

 const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
 setSelectedNode(node);
 setShowNodeConfig(true);
 }, []);

 const onDragOver = useCallback((event: React.DragEvent) => {
 event.preventDefault();
 event.dataTransfer.dropEffect = 'move';
 }, []);

 const onDrop = useCallback(
 (event: React.DragEvent) => {
 event.preventDefault();

 const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
 const type = event.dataTransfer.getData('application/reactflow');

 if (typeof type === 'undefined' || !type || !reactFlowBounds) {
 return;
 }

 const position = {
 x: event.clientX - reactFlowBounds.left,
 y: event.clientY - reactFlowBounds.top,
 };

 const newNode: Node = {
 id: `${type}-${nodeId.current}`,
 type,
 position,
 data: { 
 label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeId.current}`,
 description: `${type} step`,
 },
 };

 nodeId.current += 1;
 setNodes((nds) => nds.concat(newNode));
 },
 [setNodes]
 );

 const onDragStart = (event: React.DragEvent, nodeType: string) => {
 event.dataTransfer.setData('application/reactflow', nodeType);
 event.dataTransfer.effectAllowed = 'move';
 };

 const saveWorkflow = async () => {
 try {
 // Convert nodes and edges back to workflow definition
 const steps: WorkflowStep[] = nodes.map(node => {
 const successEdges = edges.filter(e => e.source === node.id && e.label === 'Success');
 const failureEdges = edges.filter(e => e.source === node.id && e.label === 'Failure');

 return {
 id: node.id,
 name: node.data.label,
 type: node.type as WorkflowStep['type'],
 configuration: node.data.configuration || { type: node.type as any },
 onSuccess: successEdges.map(e => e.target),
 onFailure: failureEdges.map(e => e.target),
 };
 });

 const workflowDef: Omit<WorkflowDefinition, 'id' | 'metadata'> = {
 name: workflowName,
 description: workflowDescription,
 category: workflowCategory as WorkflowDefinition['category'],
 triggers: workflow?.triggers || [{
 id: 'trigger-1',
 type: 'manual',
 configuration: {},
 }],
 steps,
 status: 'draft',
 };

 const savedWorkflow = await workflowService.createWorkflow(workflowDef);
 toast.success('Workflow saved successfully');
 onSave?.(savedWorkflow);
 } catch (error) {
 toast.error('Failed to save workflow');
 console.error('Save workflow error:', error);
 }
 };

 const nodeConfigComponents: Record<string, React.ReactNode> = {
 approval: (
 <div className="space-y-4">
 <div>
 <Label htmlFor="approvers">Approvers</Label>
 <Select defaultValue="any">
 <SelectTrigger>
 <SelectValue placeholder="Select approval type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="any">Any approver</SelectItem>
 <SelectItem value="all">All approvers</SelectItem>
 <SelectItem value="threshold">Threshold</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="expires">Expires In (hours)</Label>
 <Input id="expires" type="number" defaultValue="48" />
 </div>
 </div>
 ),
 action: (
 <div className="space-y-4">
 <div>
 <Label htmlFor="actionType">Action Type</Label>
 <Select defaultValue="api_call">
 <SelectTrigger>
 <SelectValue placeholder="Select action type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="api_call">API Call</SelectItem>
 <SelectItem value="script">Script</SelectItem>
 <SelectItem value="backstage_action">Backstage Action</SelectItem>
 <SelectItem value="custom">Custom</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="url">API URL</Label>
 <Input id="url" placeholder="https://api.example.com/endpoint" />
 </div>
 </div>
 ),
 notification: (
 <div className="space-y-4">
 <div>
 <Label htmlFor="channels">Notification Channels</Label>
 <div className="space-y-2">
 <label className="flex items-center gap-2">
 <input type="checkbox" defaultChecked /> Email
 </label>
 <label className="flex items-center gap-2">
 <input type="checkbox" defaultChecked /> In-App
 </label>
 <label className="flex items-center gap-2">
 <input type="checkbox" /> Slack
 </label>
 <label className="flex items-center gap-2">
 <input type="checkbox" /> Teams
 </label>
 </div>
 </div>
 <div>
 <Label htmlFor="template">Message Template</Label>
 <Textarea id="template" placeholder="Enter notification message..." />
 </div>
 </div>
 ),
 };

 return (
 <div className="flex h-full">
 {/* Sidebar */}
 <div className="w-64 bg-white border-r p-4 space-y-4">
 <div>
 <h3 className="font-semibold mb-2">Workflow Details</h3>
 <div className="space-y-3">
 <div>
 <Label htmlFor="name">Name</Label>
 <Input
 id="name"
 value={workflowName}
 onChange={(e) => setWorkflowName(e.target.value)}
 placeholder="Workflow name"
 />
 </div>
 <div>
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 value={workflowDescription}
 onChange={(e) => setWorkflowDescription(e.target.value)}
 placeholder="Workflow description"
 className="resize-none"
 />
 </div>
 <div>
 <Label htmlFor="category">Category</Label>
 <Select value={workflowCategory} onValueChange={setWorkflowCategory}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="approval">Approval</SelectItem>
 <SelectItem value="automation">Automation</SelectItem>
 <SelectItem value="notification">Notification</SelectItem>
 <SelectItem value="deployment">Deployment</SelectItem>
 <SelectItem value="custom">Custom</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 <div>
 <h3 className="font-semibold mb-2">Step Types</h3>
 <div className="space-y-2">
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'approval')}
 draggable
 >
 <CheckCircle className="h-4 w-4 text-blue-500" />
 <span className="text-sm">Approval</span>
 </div>
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'action')}
 draggable
 >
 <Zap className="h-4 w-4 text-green-500" />
 <span className="text-sm">Action</span>
 </div>
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'notification')}
 draggable
 >
 <Bell className="h-4 w-4 text-yellow-500" />
 <span className="text-sm">Notification</span>
 </div>
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'condition')}
 draggable
 >
 <Filter className="h-4 w-4 text-purple-500" />
 <span className="text-sm">Condition</span>
 </div>
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'parallel')}
 draggable
 >
 <GitBranch className="h-4 w-4 text-orange-500" />
 <span className="text-sm">Parallel</span>
 </div>
 <div
 className="p-3 border rounded-lg cursor-move hover:bg-gray-50 flex items-center gap-2"
 onDragStart={(e) => onDragStart(e, 'wait')}
 draggable
 >
 <Clock className="h-4 w-4 text-gray-500" />
 <span className="text-sm">Wait</span>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <Button onClick={saveWorkflow} className="w-full">
 <Save className="h-4 w-4 mr-2" />
 Save Workflow
 </Button>
 <Button variant="outline" className="w-full">
 <Play className="h-4 w-4 mr-2" />
 Test Run
 </Button>
 </div>
 </div>

 {/* Canvas */}
 <div className="flex-1" ref={reactFlowWrapper}>
 <ReactFlow
 nodes={nodes}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 onConnect={onConnect}
 onNodeClick={onNodeClick}
 onDrop={onDrop}
 onDragOver={onDragOver}
 nodeTypes={nodeTypes}
 fitView
 >
 <Background />
 <Controls />
 <MiniMap />
 </ReactFlow>
 </div>

 {/* Node Configuration */}
 <Sheet open={showNodeConfig} onOpenChange={setShowNodeConfig}>
 <SheetContent>
 <SheetHeader>
 <SheetTitle>Configure Step</SheetTitle>
 <SheetDescription>
 Configure the selected workflow step
 </SheetDescription>
 </SheetHeader>
 {selectedNode && (
 <div className="mt-6 space-y-4">
 <div>
 <Label htmlFor="stepName">Step Name</Label>
 <Input
 id="stepName"
 value={selectedNode.data.label}
 onChange={(e) => {
 setNodes((nds) =>
 nds.map((node) =>
 node.id === selectedNode.id
 ? { ...node, data: { ...node.data, label: e.target.value } }
 : node
 )
 );
 }}
 />
 </div>
 <div>
 <Label htmlFor="stepDescription">Description</Label>
 <Textarea
 id="stepDescription"
 value={selectedNode.data.description || ''}
 onChange={(e) => {
 setNodes((nds) =>
 nds.map((node) =>
 node.id === selectedNode.id
 ? { ...node, data: { ...node.data, description: e.target.value } }
 : node
 )
 );
 }}
 />
 </div>
 {nodeConfigComponents[selectedNode.type || 'action']}
 </div>
 )}
 </SheetContent>
 </Sheet>
 </div>
 );
}