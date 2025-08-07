'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Pause, Archive, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder';
import { WorkflowDefinition, WorkflowExecution, WorkflowTemplate } from '@/types/workflow';
import { workflowService } from '@/services/workflow/workflow-service';
// Removed date-fns import - using native JavaScript date formatting instead

// Helper function to replace formatDistanceToNow
const getRelativeTimeString = (date: Date): string => {
 const now = new Date();
 const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 if (diffInSeconds < 60) {
 return diffInSeconds <= 1 ? 'just now' : `${diffInSeconds} seconds ago`;
 }

 const diffInMinutes = Math.floor(diffInSeconds / 60);
 if (diffInMinutes < 60) {
 return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
 }

 const diffInHours = Math.floor(diffInMinutes / 60);
 if (diffInHours < 24) {
 return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
 }

 const diffInDays = Math.floor(diffInHours / 24);
 if (diffInDays < 7) {
 return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
 }

 const diffInWeeks = Math.floor(diffInDays / 7);
 if (diffInWeeks < 4) {
 return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
 }

 const diffInMonths = Math.floor(diffInDays / 30);
 if (diffInMonths < 12) {
 return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
 }

 const diffInYears = Math.floor(diffInDays / 365);
 return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
};

export default function WorkflowsPage() {
 const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
 const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
 const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
 const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
 const [showBuilder, setShowBuilder] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('all');
 const [statusFilter, setStatusFilter] = useState('all');

 useEffect(() => {
 loadWorkflows();
 loadExecutions();
 loadTemplates();

 // Subscribe to workflow events
 const handleWorkflowUpdate = () => loadWorkflows();
 const handleExecutionUpdate = () => loadExecutions();

 workflowService.on('workflow_created', handleWorkflowUpdate);
 workflowService.on('workflow_updated', handleWorkflowUpdate);
 workflowService.on('workflow_deleted', handleWorkflowUpdate);
 workflowService.on('execution_started', handleExecutionUpdate);
 workflowService.on('execution_updated', handleExecutionUpdate);

 return () => {
 workflowService.off('workflow_created', handleWorkflowUpdate);
 workflowService.off('workflow_updated', handleWorkflowUpdate);
 workflowService.off('workflow_deleted', handleWorkflowUpdate);
 workflowService.off('execution_started', handleExecutionUpdate);
 workflowService.off('execution_updated', handleExecutionUpdate);
 };
 }, []);

 const loadWorkflows = () => {
 const filter: any = {};
 if (categoryFilter !== 'all') filter.category = categoryFilter;
 if (statusFilter !== 'all') filter.status = statusFilter;
 
 const allWorkflows = workflowService.listWorkflows(filter);
 const filtered = searchQuery
 ? allWorkflows.filter(w => 
 w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 w.description?.toLowerCase().includes(searchQuery.toLowerCase())
 )
 : allWorkflows;
 
 setWorkflows(filtered);
 };

 const loadExecutions = () => {
 setExecutions(workflowService.listExecutions());
 };

 const loadTemplates = () => {
 setTemplates(workflowService.getTemplates());
 };

 useEffect(() => {
 loadWorkflows();
 }, [searchQuery, categoryFilter, statusFilter]);

 const executeWorkflow = async (workflow: WorkflowDefinition) => {
 try {
 await workflowService.executeWorkflow(
 workflow.id,
 {},
 { type: 'user', id: 'current-user', name: 'Current User' }
 );
 } catch (error) {
 console.error('Failed to execute workflow:', error);
 }
 };

 const toggleWorkflowStatus = async (workflow: WorkflowDefinition) => {
 const newStatus = workflow.status === 'active' ? 'paused' : 'active';
 await workflowService.updateWorkflow(workflow.id, { status: newStatus });
 };

 const getCategoryIcon = (category: string) => {
 const icons: Record<string, string> = {
 approval: 'CHECK',
 automation: 'AUTO',
 notification: 'BELL',
 deployment: 'DEPLOY',
 custom: 'GEAR',
 };
 return icons[category] || 'ITEM';
 };

 const getStatusColor = (status: string) => {
 const colors: Record<string, string> = {
 draft: 'secondary',
 active: 'success',
 paused: 'warning',
 archived: 'default',
 };
 return colors[status] || 'default';
 };

 const getExecutionStatusColor = (status: string) => {
 const colors: Record<string, string> = {
 pending: 'secondary',
 running: 'default',
 completed: 'success',
 failed: 'destructive',
 cancelled: 'warning',
 paused: 'warning',
 };
 return colors[status] || 'default';
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold">Workflow Automation</h1>
 <p className="text-gray-600 mt-2">
 Create and manage automated workflows for approvals, deployments, and more
 </p>
 </div>
 <Button onClick={() => setShowBuilder(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Create Workflow
 </Button>
 </div>

 <Tabs defaultValue="workflows" className="space-y-4">
 <TabsList>
 <TabsTrigger value="workflows">Workflows</TabsTrigger>
 <TabsTrigger value="executions">Executions</TabsTrigger>
 <TabsTrigger value="templates">Templates</TabsTrigger>
 </TabsList>

 <TabsContent value="workflows" className="space-y-4">
 {/* Filters */}
 <div className="flex gap-4">
 <div className="flex-1">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input
 placeholder="Search workflows..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10"
 />
 </div>
 </div>
 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Category" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Categories</SelectItem>
 <SelectItem value="approval">Approval</SelectItem>
 <SelectItem value="automation">Automation</SelectItem>
 <SelectItem value="notification">Notification</SelectItem>
 <SelectItem value="deployment">Deployment</SelectItem>
 <SelectItem value="custom">Custom</SelectItem>
 </SelectContent>
 </Select>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="draft">Draft</SelectItem>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="paused">Paused</SelectItem>
 <SelectItem value="archived">Archived</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Workflow List */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {workflows.map((workflow) => (
 <Card key={workflow.id} className="hover:shadow-lg transition-shadow cursor-pointer">
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <span className="text-2xl">{getCategoryIcon(workflow.category)}</span>
 <div>
 <CardTitle className="text-lg">{workflow.name}</CardTitle>
 <CardDescription className="mt-1">
 {workflow.description || 'No description'}
 </CardDescription>
 </div>
 </div>
 <Badge variant={getStatusColor(workflow.status) as any}>
 {workflow.status}
 </Badge>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Steps</span>
 <span className="font-medium">{workflow.steps.length}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Created</span>
 <span className="font-medium">
 {getRelativeTimeString(workflow.metadata.createdAt)}
 </span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Version</span>
 <span className="font-medium">v{workflow.metadata.version}</span>
 </div>
 <div className="flex gap-2 pt-3">
 {workflow.status === 'active' && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => executeWorkflow(workflow)}
 >
 <Play className="h-3 w-3 mr-1" />
 Run
 </Button>
 )}
 <Button
 size="sm"
 variant="outline"
 onClick={() => toggleWorkflowStatus(workflow)}
 >
 {workflow.status === 'active' ? (
 <>
 <Pause className="h-3 w-3 mr-1" />
 Pause
 </>
 ) : (
 <>
 <Play className="h-3 w-3 mr-1" />
 Activate
 </>
 )}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => {
 setSelectedWorkflow(workflow);
 setShowBuilder(true);
 }}
 >
 Edit
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 {workflows.length === 0 && (
 <Card className="p-12 text-center">
 <p className="text-gray-500">No workflows found</p>
 <Button
 variant="outline"
 className="mt-4"
 onClick={() => setShowBuilder(true)}
 >
 Create your first workflow
 </Button>
 </Card>
 )}
 </TabsContent>

 <TabsContent value="executions" className="space-y-4">
 <div className="rounded-lg border">
 <table className="w-full">
 <thead className="border-b bg-gray-50">
 <tr>
 <th className="px-4 py-3 text-left text-sm font-medium">Workflow</th>
 <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
 <th className="px-4 py-3 text-left text-sm font-medium">Started</th>
 <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
 <th className="px-4 py-3 text-left text-sm font-medium">Triggered By</th>
 <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y">
 {executions.map((execution) => {
 const workflow = workflows.find(w => w.id === execution.workflowId);
 const duration = execution.completedAt
 ? new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
 : Date.now() - new Date(execution.startedAt).getTime();
 
 return (
 <tr key={execution.id} className="hover:bg-gray-50">
 <td className="px-4 py-3">
 <div>
 <p className="font-medium">{workflow?.name || 'Unknown'}</p>
 <p className="text-sm text-gray-500">#{execution.id.slice(-8)}</p>
 </div>
 </td>
 <td className="px-4 py-3">
 <Badge variant={getExecutionStatusColor(execution.status) as any}>
 {execution.status}
 </Badge>
 </td>
 <td className="px-4 py-3 text-sm">
 {getRelativeTimeString(execution.startedAt)}
 </td>
 <td className="px-4 py-3 text-sm">
 {Math.round(duration / 1000)}s
 </td>
 <td className="px-4 py-3 text-sm">
 <div>
 <p>{execution.triggeredBy.name}</p>
 <p className="text-gray-500">{execution.triggeredBy.type}</p>
 </div>
 </td>
 <td className="px-4 py-3">
 <Button size="sm" variant="outline">
 View Details
 </Button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {executions.length === 0 && (
 <Card className="p-12 text-center">
 <p className="text-gray-500">No workflow executions yet</p>
 </Card>
 )}
 </TabsContent>

 <TabsContent value="templates" className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {templates.map((template) => (
 <Card key={template.id} className="hover:shadow-lg transition-shadow">
 <CardHeader>
 <div className="flex items-start gap-3">
 <span className="text-2xl">
 {getCategoryIcon(template.category)}
 </span>
 <div>
 <CardTitle className="text-lg">{template.name}</CardTitle>
 <CardDescription className="mt-1">
 {template.description}
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Button
 className="w-full"
 onClick={() => {
 setSelectedWorkflow({
 ...template.definition,
 id: '',
 metadata: {
 createdBy: '',
 createdAt: new Date(),
 updatedAt: new Date(),
 version: 1,
 tags: [],
 },
 } as WorkflowDefinition);
 setShowBuilder(true);
 }}
 >
 Use Template
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>
 </Tabs>

 {/* Workflow Builder Dialog */}
 <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
 <DialogContent className="max-w-[90vw] h-[90vh]">
 <DialogHeader>
 <DialogTitle>
 {selectedWorkflow ? 'Edit Workflow' : 'Create Workflow'}
 </DialogTitle>
 <DialogDescription>
 Design your workflow by dragging and dropping steps onto the canvas
 </DialogDescription>
 </DialogHeader>
 <div className="flex-1 overflow-hidden">
 <WorkflowBuilder
 workflow={selectedWorkflow || undefined}
 onSave={(workflow) => {
 setShowBuilder(false);
 setSelectedWorkflow(null);
 loadWorkflows();
 }}
 />
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}