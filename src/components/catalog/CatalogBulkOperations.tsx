'use client';

import { useState, useCallback } from 'react';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
 Edit3,
 Tags,
 Users,
 GitBranch,
 Shield,
 FileText,
 Trash2,
 Download,
 Upload,
 Copy,
 Move,
 Archive,
 CheckCircle2,
 XCircle,
 AlertCircle,
 Loader2,
 Sparkles,
 Wand2,
 Brain,
 Target,
 RefreshCw,
 Save,
 History
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { catalogClient } from '@/services/backstage/clients/catalog.client';
import type { Entity } from '@/services/backstage/types/entities';

interface CatalogBulkOperationsProps {
 selectedEntities: Entity[];
 isOpen: boolean;
 onClose: () => void;
 onOperationComplete: () => void;
}

type OperationType = 
 | 'edit-metadata'
 | 'change-owner'
 | 'add-tags'
 | 'remove-tags'
 | 'change-lifecycle'
 | 'add-annotations'
 | 'export'
 | 'delete'
 | 'move-namespace'
 | 'archive'
 | 'generate-docs'
 | 'validate'
 | 'refresh';

interface OperationResult {
 entityRef: string;
 success: boolean;
 error?: string;
}

export function CatalogBulkOperations({
 selectedEntities,
 isOpen,
 onClose,
 onOperationComplete
}: CatalogBulkOperationsProps) {
 const [operation, setOperation] = useState<OperationType>('edit-metadata');
 const [isProcessing, setIsProcessing] = useState(false);
 const [progress, setProgress] = useState(0);
 const [results, setResults] = useState<OperationResult[]>([]);
 
 // Operation-specific state
 const [bulkChanges, setBulkChanges] = useState({
 owner: '',
 lifecycle: '',
 tags: [] as string[],
 tagsToRemove: [] as string[],
 annotations: {} as Record<string, string>,
 namespace: '',
 description: '',
 title: '',
 });

 const [aiSuggestions, setAiSuggestions] = useState({
 tags: [] as string[],
 owner: '',
 description: '',
 });

 const [validationResults, setValidationResults] = useState<Record<string, any>>({});

 // Get unique values from selected entities for suggestions
 const uniqueOwners = Array.from(new Set(
 selectedEntities.map(e => e.spec?.owner as string).filter(Boolean)
 ));
 
 const uniqueTags = Array.from(new Set(
 selectedEntities.flatMap(e => e.metadata.tags || [])
 ));

 const uniqueLifecycles = Array.from(new Set(
 selectedEntities.map(e => e.spec?.lifecycle as string).filter(Boolean)
 ));

 const performBulkOperation = async () => {
 setIsProcessing(true);
 setProgress(0);
 setResults([]);

 const totalEntities = selectedEntities.length;
 const operationResults: OperationResult[] = [];

 try {
 for (let i = 0; i < selectedEntities.length; i++) {
 const entity = selectedEntities[i];
 const entityRef = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 
 try {
 await performSingleOperation(entity, operation);
 
 operationResults.push({
 entityRef,
 success: true,
 });
 } catch (error) {
 operationResults.push({
 entityRef,
 success: false,
 error: error instanceof Error ? error.message : 'Unknown error',
 });
 }

 setProgress(((i + 1) / totalEntities) * 100);
 setResults([...operationResults]);
 }

 const successCount = operationResults.filter(r => r.success).length;
 
 if (successCount === totalEntities) {
 toast.success(`Successfully processed all ${totalEntities} entities`);
 } else {
 toast.warning(`Processed ${successCount} of ${totalEntities} entities`);
 }

 // Refresh catalog after bulk operation
 onOperationComplete();
 } catch (error) {
 toast.error('Bulk operation failed');
 console.error('Bulk operation error:', error);
 } finally {
 setIsProcessing(false);
 }
 };

 const performSingleOperation = async (entity: Entity, operationType: OperationType) => {
 const backstageUrl = process.env.NEXT_PUBLIC_BACKSTAGE_URL || 'http://localhost:7007';
 
 switch (operationType) {
 case 'change-owner':
 if (!bulkChanges.owner) throw new Error('Owner is required');
 
 const updatedEntity = {
 ...entity,
 spec: {
 ...entity.spec,
 owner: bulkChanges.owner,
 },
 };
 
 // Update via Backstage API
 await fetch(`${backstageUrl}/api/catalog/entities`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(updatedEntity),
 });
 break;

 case 'add-tags':
 if (bulkChanges.tags.length === 0) throw new Error('No tags to add');
 
 const newTags = Array.from(new Set([
 ...(entity.metadata.tags || []),
 ...bulkChanges.tags,
 ]));
 
 await updateEntityMetadata(entity, { tags: newTags });
 break;

 case 'remove-tags':
 if (bulkChanges.tagsToRemove.length === 0) throw new Error('No tags to remove');
 
 const remainingTags = (entity.metadata.tags || []).filter(
 tag => !bulkChanges.tagsToRemove.includes(tag)
 );
 
 await updateEntityMetadata(entity, { tags: remainingTags });
 break;

 case 'change-lifecycle':
 if (!bulkChanges.lifecycle) throw new Error('Lifecycle is required');
 
 await updateEntitySpec(entity, { lifecycle: bulkChanges.lifecycle });
 break;

 case 'add-annotations':
 const newAnnotations = {
 ...entity.metadata.annotations,
 ...bulkChanges.annotations,
 };
 
 await updateEntityMetadata(entity, { annotations: newAnnotations });
 break;

 case 'refresh':
 await catalogClient.refreshEntity(
 `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`
 );
 break;

 case 'validate':
 const validation = await catalogClient.validateEntity(entity);
 setValidationResults(prev => ({
 ...prev,
 [`${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`]: validation,
 }));
 break;

 default:
 throw new Error(`Unsupported operation: ${operationType}`);
 }
 };

 const updateEntityMetadata = async (entity: Entity, updates: Partial<Entity['metadata']>) => {
 const backstageUrl = process.env.NEXT_PUBLIC_BACKSTAGE_URL || 'http://localhost:7007';
 
 const updatedEntity = {
 ...entity,
 metadata: {
 ...entity.metadata,
 ...updates,
 },
 };

 const response = await fetch(`${backstageUrl}/api/catalog/entities`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(updatedEntity),
 });

 if (!response.ok) {
 throw new Error(`Failed to update entity: ${response.statusText}`);
 }
 };

 const updateEntitySpec = async (entity: Entity, updates: Partial<Entity['spec']>) => {
 const backstageUrl = process.env.NEXT_PUBLIC_BACKSTAGE_URL || 'http://localhost:7007';
 
 const updatedEntity = {
 ...entity,
 spec: {
 ...entity.spec,
 ...updates,
 },
 };

 const response = await fetch(`${backstageUrl}/api/catalog/entities`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(updatedEntity),
 });

 if (!response.ok) {
 throw new Error(`Failed to update entity: ${response.statusText}`);
 }
 };

 const generateAISuggestions = async () => {
 // Simulate AI suggestions based on entity patterns
 const commonTags = uniqueTags.slice(0, 5);
 const suggestedTags = [...commonTags, 'needs-review', 'bulk-updated'];
 
 setAiSuggestions({
 tags: suggestedTags,
 owner: uniqueOwners[0] || 'platform-team',
 description: `Bulk updated ${selectedEntities.length} entities for improved catalog organization`,
 });

 toast.success('AI suggestions generated');
 };

 const exportEntities = () => {
 const data = selectedEntities.map(entity => ({
 kind: entity.kind,
 metadata: entity.metadata,
 spec: entity.spec,
 relations: entity.relations,
 }));

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `catalog-export-${Date.now()}.json`;
 a.click();
 URL.revokeObjectURL(url);

 toast.success('Entities exported successfully');
 };

 const getOperationIcon = (op: OperationType) => {
 const icons = {
 'edit-metadata': <Edit3 className="h-4 w-4" />,
 'change-owner': <Users className="h-4 w-4" />,
 'add-tags': <Tags className="h-4 w-4" />,
 'remove-tags': <Tags className="h-4 w-4" />,
 'change-lifecycle': <GitBranch className="h-4 w-4" />,
 'add-annotations': <FileText className="h-4 w-4" />,
 'export': <Download className="h-4 w-4" />,
 'delete': <Trash2 className="h-4 w-4" />,
 'move-namespace': <Move className="h-4 w-4" />,
 'archive': <Archive className="h-4 w-4" />,
 'generate-docs': <FileText className="h-4 w-4" />,
 'validate': <Shield className="h-4 w-4" />,
 'refresh': <RefreshCw className="h-4 w-4" />,
 };
 return icons[op] || <Edit3 className="h-4 w-4" />;
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
 <DialogHeader>
 <DialogTitle>Bulk Operations</DialogTitle>
 <DialogDescription>
 Perform operations on {selectedEntities.length} selected entities
 </DialogDescription>
 </DialogHeader>

 <Tabs value={operation} onValueChange={(v) => setOperation(v as OperationType)} className="flex-1">
 <TabsList className="grid grid-cols-4 gap-2 h-auto">
 <TabsTrigger value="change-owner" className="gap-2">
 <Users className="h-4 w-4" />
 Change Owner
 </TabsTrigger>
 <TabsTrigger value="add-tags" className="gap-2">
 <Tags className="h-4 w-4" />
 Add Tags
 </TabsTrigger>
 <TabsTrigger value="remove-tags" className="gap-2">
 <Tags className="h-4 w-4" />
 Remove Tags
 </TabsTrigger>
 <TabsTrigger value="change-lifecycle" className="gap-2">
 <GitBranch className="h-4 w-4" />
 Lifecycle
 </TabsTrigger>
 <TabsTrigger value="add-annotations" className="gap-2">
 <FileText className="h-4 w-4" />
 Annotations
 </TabsTrigger>
 <TabsTrigger value="validate" className="gap-2">
 <Shield className="h-4 w-4" />
 Validate
 </TabsTrigger>
 <TabsTrigger value="refresh" className="gap-2">
 <RefreshCw className="h-4 w-4" />
 Refresh
 </TabsTrigger>
 <TabsTrigger value="export" className="gap-2">
 <Download className="h-4 w-4" />
 Export
 </TabsTrigger>
 </TabsList>

 <ScrollArea className="flex-1 mt-4">
 <TabsContent value="change-owner" className="space-y-4">
 <div>
 <Label>New Owner</Label>
 <div className="flex gap-2 mt-2">
 <Select
 value={bulkChanges.owner}
 onValueChange={(value) => setBulkChanges(prev => ({ ...prev, owner: value }))}
 >
 <SelectTrigger className="flex-1">
 <SelectValue placeholder="Select new owner" />
 </SelectTrigger>
 <SelectContent>
 {uniqueOwners.map(owner => (
 <SelectItem key={owner} value={owner}>
 {owner}
 </SelectItem>
 ))}
 <SelectItem value="platform-team">platform-team</SelectItem>
 <SelectItem value="infrastructure">infrastructure</SelectItem>
 </SelectContent>
 </Select>
 <Button
 variant="outline"
 size="icon"
 onClick={generateAISuggestions}
 >
 <Sparkles className="h-4 w-4" />
 </Button>
 </div>
 {aiSuggestions.owner && (
 <p className="text-sm text-muted-foreground mt-2">
 AI suggests: <Badge variant="secondary">{aiSuggestions.owner}</Badge>
 </p>
 )}
 </div>

 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 This will change the owner for all {selectedEntities.length} selected entities.
 Make sure the new owner exists in your catalog.
 </AlertDescription>
 </Alert>
 </TabsContent>

 <TabsContent value="add-tags" className="space-y-4">
 <div>
 <Label>Tags to Add</Label>
 <div className="flex gap-2 mt-2">
 <MultiSelect
 options={[
 ...uniqueTags.map(tag => ({ label: tag, value: tag })),
 { label: 'production-ready', value: 'production-ready' },
 { label: 'needs-documentation', value: 'needs-documentation' },
 { label: 'critical', value: 'critical' },
 { label: 'public-api', value: 'public-api' },
 ]}
 selected={bulkChanges.tags}
 onChange={(values) => setBulkChanges(prev => ({ ...prev, tags: values }))}
 placeholder="Select or type tags..."
 className="flex-1"
 />
 <Button
 variant="outline"
 size="icon"
 onClick={generateAISuggestions}
 >
 <Brain className="h-4 w-4" />
 </Button>
 </div>
 {aiSuggestions.tags.length > 0 && (
 <div className="mt-2">
 <p className="text-sm text-muted-foreground mb-1">AI suggested tags:</p>
 <div className="flex flex-wrap gap-1">
 {aiSuggestions.tags.map(tag => (
 <Badge
 key={tag}
 variant="secondary"
 className="cursor-pointer"
 onClick={() => {
 if (!bulkChanges.tags.includes(tag)) {
 setBulkChanges(prev => ({
 ...prev,
 tags: [...prev.tags, tag]
 }));
 }
 }}
 >
 {tag}
 </Badge>
 ))}
 </div>
 </div>
 )}
 </div>
 </TabsContent>

 <TabsContent value="remove-tags" className="space-y-4">
 <div>
 <Label>Tags to Remove</Label>
 <MultiSelect
 options={uniqueTags.map(tag => ({ label: tag, value: tag }))}
 selected={bulkChanges.tagsToRemove}
 onChange={(values) => setBulkChanges(prev => ({ ...prev, tagsToRemove: values }))}
 placeholder="Select tags to remove..."
 className="mt-2"
 />
 </div>
 
 <Alert>
 <AlertDescription>
 Tags will only be removed from entities that have them.
 </AlertDescription>
 </Alert>
 </TabsContent>

 <TabsContent value="change-lifecycle" className="space-y-4">
 <div>
 <Label>New Lifecycle</Label>
 <Select
 value={bulkChanges.lifecycle}
 onValueChange={(value) => setBulkChanges(prev => ({ ...prev, lifecycle: value }))}
 >
 <SelectTrigger className="mt-2">
 <SelectValue placeholder="Select lifecycle" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="experimental">Experimental</SelectItem>
 <SelectItem value="production">Production</SelectItem>
 <SelectItem value="deprecated">Deprecated</SelectItem>
 <SelectItem value="development">Development</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="rounded-lg border p-4">
 <h4 className="font-medium mb-2">Current Lifecycles</h4>
 <div className="space-y-1">
 {uniqueLifecycles.map(lifecycle => {
 const count = selectedEntities.filter(e => e.spec?.lifecycle === lifecycle).length;
 return (
 <div key={lifecycle} className="flex justify-between text-sm">
 <span>{lifecycle}</span>
 <Badge variant="outline">{count}</Badge>
 </div>
 );
 })}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="add-annotations" className="space-y-4">
 <div>
 <Label>Annotations to Add</Label>
 <div className="space-y-2 mt-2">
 <div className="flex gap-2">
 <Input
 placeholder="Key"
 id="annotation-key"
 />
 <Input
 placeholder="Value"
 id="annotation-value"
 />
 <Button
 variant="outline"
 onClick={() => {
 const key = (document.getElementById('annotation-key') as HTMLInputElement).value;
 const value = (document.getElementById('annotation-value') as HTMLInputElement).value;
 if (key && value) {
 setBulkChanges(prev => ({
 ...prev,
 annotations: {
 ...prev.annotations,
 [key]: value,
 }
 }));
 }
 }}
 >
 Add
 </Button>
 </div>
 </div>

 {Object.entries(bulkChanges.annotations).length > 0 && (
 <div className="mt-4 space-y-1">
 <Label>Annotations to be added:</Label>
 {Object.entries(bulkChanges.annotations).map(([key, value]) => (
 <div key={key} className="flex items-center justify-between text-sm">
 <code className="bg-muted px-2 py-1 rounded">
 {key}: {value}
 </code>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 const { [key]: _, ...rest } = bulkChanges.annotations;
 setBulkChanges(prev => ({ ...prev, annotations: rest }));
 }}
 >
 <XCircle className="h-3 w-3" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>
 </TabsContent>

 <TabsContent value="validate" className="space-y-4">
 <Alert>
 <Shield className="h-4 w-4" />
 <AlertDescription>
 Validate all selected entities against Backstage schema and custom rules.
 </AlertDescription>
 </Alert>

 {Object.keys(validationResults).length > 0 && (
 <div className="space-y-2">
 {Object.entries(validationResults).map(([entityRef, result]) => (
 <div key={entityRef} className="rounded-lg border p-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">{entityRef}</span>
 <Badge variant={result.valid ? 'default' : 'destructive'}>
 {result.valid ? 'Valid' : 'Invalid'}
 </Badge>
 </div>
 {!result.valid && result.errors && (
 <ul className="mt-2 text-sm text-muted-foreground">
 {result.errors.map((error: string, i: number) => (
 <li key={i}>• {error}</li>
 ))}
 </ul>
 )}
 </div>
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="refresh" className="space-y-4">
 <Alert>
 <RefreshCw className="h-4 w-4" />
 <AlertDescription>
 Trigger a refresh for all selected entities. This will update their metadata
 from the source location.
 </AlertDescription>
 </Alert>
 </TabsContent>

 <TabsContent value="export" className="space-y-4">
 <div className="space-y-4">
 <Alert>
 <Download className="h-4 w-4" />
 <AlertDescription>
 Export selected entities as JSON for backup or migration purposes.
 </AlertDescription>
 </Alert>

 <Button
 className="w-full"
 onClick={exportEntities}
 >
 <Download className="mr-2 h-4 w-4" />
 Export {selectedEntities.length} Entities
 </Button>
 </div>
 </TabsContent>
 </ScrollArea>

 {/* Progress and Results */}
 {isProcessing && (
 <div className="mt-4 space-y-4">
 <div>
 <div className="flex justify-between text-sm mb-2">
 <span>Processing entities...</span>
 <span>{Math.round(progress)}%</span>
 </div>
 <Progress value={progress} />
 </div>

 {results.length > 0 && (
 <ScrollArea className="h-32 rounded-lg border p-2">
 {results.map((result, index) => (
 <div
 key={index}
 className="flex items-center justify-between text-sm py-1"
 >
 <span className="truncate flex-1">{result.entityRef}</span>
 {result.success ? (
 <CheckCircle2 className="h-4 w-4 text-green-500" />
 ) : (
 <XCircle className="h-4 w-4 text-red-500" />
 )}
 </div>
 ))}
 </ScrollArea>
 )}
 </div>
 )}
 </Tabs>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} disabled={isProcessing}>
 Cancel
 </Button>
 <Button
 onClick={performBulkOperation}
 disabled={isProcessing || selectedEntities.length === 0}
 >
 {isProcessing ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Processing...
 </>
 ) : (
 <>
 {getOperationIcon(operation)}
 <span className="ml-2">
 Apply to {selectedEntities.length} entities
 </span>
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}