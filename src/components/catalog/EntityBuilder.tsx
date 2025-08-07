'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
 Package,
 GitBranch,
 Users,
 Link,
 Tags,
 Calendar,
 Shield,
 Code,
 Database,
 Globe,
 Layers,
 FileCode,
 Plus,
 X,
 Save,
 Upload,
 Download,
 Eye,
 Copy,
 Zap,
 ChevronRight,
 Info,
 Check,
 AlertCircle,
 Search,
 Filter,
 RefreshCw,
 Settings2,
 Sparkles,
 Bot,
 Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import yaml from 'js-yaml';

// Entity schema
const entitySchema = z.object({
 apiVersion: z.string().default('backstage.io/v1alpha1'),
 kind: z.enum(['Component', 'API', 'System', 'Domain', 'Resource', 'Group', 'User', 'Template', 'Location']),
 metadata: z.object({
 name: z.string().min(1, 'Name is required'),
 namespace: z.string().default('default'),
 title: z.string().optional(),
 description: z.string().optional(),
 labels: z.record(z.string()).optional(),
 annotations: z.record(z.string()).optional(),
 tags: z.array(z.string()).optional(),
 links: z.array(z.object({
 url: z.string().url(),
 title: z.string(),
 icon: z.string().optional(),
 })).optional(),
 }),
 spec: z.object({
 type: z.string().optional(),
 lifecycle: z.string().optional(),
 owner: z.string().optional(),
 system: z.string().optional(),
 domain: z.string().optional(),
 subcomponentOf: z.string().optional(),
 providesApis: z.array(z.string()).optional(),
 consumesApis: z.array(z.string()).optional(),
 dependsOn: z.array(z.string()).optional(),
 dependencyOf: z.array(z.string()).optional(),
 }).optional(),
});

type EntityFormData = z.infer<typeof entitySchema>;

interface EntityBuilderProps {
 onSave?: (entity: EntityFormData) => void;
 initialData?: Partial<EntityFormData>;
 existingEntities?: Array<{ kind: string; metadata: { name: string; namespace?: string } }>;
 onCancel?: () => void;
}

// Component type configurations
const componentTypes = {
 service: { label: 'Service', icon: Package, description: 'A backend service or API' },
 website: { label: 'Website', icon: Globe, description: 'A web application or site' },
 library: { label: 'Library', icon: FileCode, description: 'A shared code library' },
 documentation: { label: 'Documentation', icon: FileCode, description: 'Documentation site' },
 tool: { label: 'Tool', icon: Zap, description: 'An internal tool or utility' },
 template: { label: 'Template', icon: Layers, description: 'A project template' },
};

const lifecycles = {
 experimental: { label: 'Experimental', color: 'bg-purple-500' },
 production: { label: 'Production', color: 'bg-green-500' },
 deprecated: { label: 'Deprecated', color: 'bg-red-500' },
};

export function EntityBuilder({
 onSave,
 initialData,
 existingEntities = [],
 onCancel
}: EntityBuilderProps) {
 const [activeTab, setActiveTab] = useState('basic');
 const [showPreview, setShowPreview] = useState(false);
 const [showAiAssist, setShowAiAssist] = useState(false);
 const [suggestedMetadata, setSuggestedMetadata] = useState<any>(null);
 const [isAnalyzing, setIsAnalyzing] = useState(false);

 const {
 register,
 handleSubmit,
 watch,
 setValue,
 formState: { errors, isSubmitting },
 } = useForm<EntityFormData>({
 resolver: zodResolver(entitySchema),
 defaultValues: initialData || {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 namespace: 'default',
 tags: [],
 links: [],
 labels: {},
 annotations: {},
 },
 spec: {
 type: 'service',
 lifecycle: 'experimental',
 },
 },
 });

 const formData = watch();

 // AI-powered metadata suggestions
 const analyzeName = async () => {
 const name = formData.metadata.name;
 if (!name) {
 toast.error('Please enter a name first');
 return;
 }

 setIsAnalyzing(true);
 
 // Simulate AI analysis (in production, this would call an AI service)
 setTimeout(() => {
 const suggestions = {
 description: generateDescription(name, formData.kind),
 tags: generateTags(name, formData.kind),
 type: suggestType(name),
 owner: suggestOwner(name),
 links: suggestLinks(name),
 };
 
 setSuggestedMetadata(suggestions);
 setIsAnalyzing(false);
 setShowAiAssist(true);
 }, 1500);
 };

 // Helper functions for AI suggestions
 const generateDescription = (name: string, kind: string) => {
 const templates = {
 Component: `${name} is a microservice that handles ${name.replace(/-/g, ' ')} functionality`,
 API: `REST API for ${name.replace(/-/g, ' ')} operations`,
 System: `${name} system encompassing related services and resources`,
 Resource: `Infrastructure resource for ${name.replace(/-/g, ' ')}`,
 };
 return templates[kind as keyof typeof templates] || `${kind} for ${name}`;
 };

 const generateTags = (name: string, kind: string) => {
 const baseTags = [];
 
 // Extract technology hints from name
 if (name.includes('api')) baseTags.push('api');
 if (name.includes('frontend') || name.includes('ui')) baseTags.push('frontend');
 if (name.includes('backend')) baseTags.push('backend');
 if (name.includes('auth')) baseTags.push('authentication');
 if (name.includes('payment')) baseTags.push('payment', 'billing');
 if (name.includes('user')) baseTags.push('user-management');
 if (name.includes('data')) baseTags.push('data-processing');
 
 // Add kind-specific tags
 if (kind === 'Component') baseTags.push('microservice');
 if (kind === 'API') baseTags.push('rest', 'http');
 
 return baseTags;
 };

 const suggestType = (name: string) => {
 if (name.includes('api')) return 'service';
 if (name.includes('web') || name.includes('frontend')) return 'website';
 if (name.includes('lib') || name.includes('sdk')) return 'library';
 if (name.includes('docs')) return 'documentation';
 return 'service';
 };

 const suggestOwner = (name: string) => {
 const teamMappings: Record<string, string> = {
 auth: 'platform-team',
 payment: 'payments-team',
 user: 'identity-team',
 frontend: 'frontend-team',
 api: 'backend-team',
 infra: 'infrastructure-team',
 };
 
 for (const [keyword, team] of Object.entries(teamMappings)) {
 if (name.includes(keyword)) return team;
 }
 
 return 'platform-team';
 };

 const suggestLinks = (name: string) => {
 const baseLinks = [
 { title: 'Repository', url: `https://github.com/org/${name}`, icon: 'github' },
 { title: 'Documentation', url: `https://docs.company.com/${name}`, icon: 'docs' },
 ];
 
 if (formData.kind === 'API') {
 baseLinks.push({ title: 'API Docs', url: `https://api.company.com/${name}/docs`, icon: 'api' });
 }
 
 if (formData.spec?.type === 'website') {
 baseLinks.push({ title: 'Live Site', url: `https://${name}.company.com`, icon: 'web' });
 }
 
 return baseLinks;
 };

 const applySuggestions = () => {
 if (suggestedMetadata) {
 setValue('metadata.description', suggestedMetadata.description);
 setValue('metadata.tags', suggestedMetadata.tags);
 setValue('spec.type', suggestedMetadata.type);
 setValue('spec.owner', suggestedMetadata.owner);
 setValue('metadata.links', suggestedMetadata.links);
 setShowAiAssist(false);
 toast.success('AI suggestions applied');
 }
 };

 const onSubmit = async (data: EntityFormData) => {
 try {
 // Clean up empty fields
 if (data.metadata.tags?.length === 0) delete data.metadata.tags;
 if (data.metadata.links?.length === 0) delete data.metadata.links;
 if (Object.keys(data.metadata.labels || {}).length === 0) delete data.metadata.labels;
 if (Object.keys(data.metadata.annotations || {}).length === 0) delete data.metadata.annotations;
 
 if (onSave) {
 onSave(data);
 }
 
 toast.success('Entity created successfully');
 } catch (error) {
 console.error('Error creating entity:', error);
 toast.error('Failed to create entity');
 }
 };

 const exportYaml = () => {
 const yamlContent = yaml.dump(formData);
 const blob = new Blob([yamlContent], { type: 'text/yaml' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${formData.metadata.name || 'entity'}.yaml`;
 a.click();
 URL.revokeObjectURL(url);
 };

 const copyYaml = () => {
 const yamlContent = yaml.dump(formData);
 navigator.clipboard.writeText(yamlContent);
 toast.success('YAML copied to clipboard');
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Entity Builder</h2>
 <p className="text-muted-foreground">
 Create catalog entities with our visual no-code builder
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setShowPreview(true)}
 >
 <Eye className="h-4 w-4 mr-2" />
 Preview YAML
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={analyzeName}
 disabled={isAnalyzing || !formData.metadata.name}
 >
 {isAnalyzing ? (
 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
 ) : (
 <Sparkles className="h-4 w-4 mr-2" />
 )}
 AI Assist
 </Button>
 </div>
 </div>

 <form onSubmit={handleSubmit(onSubmit)}>
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="basic">Basic Info</TabsTrigger>
 <TabsTrigger value="relationships">Relationships</TabsTrigger>
 <TabsTrigger value="metadata">Metadata</TabsTrigger>
 <TabsTrigger value="annotations">Annotations</TabsTrigger>
 <TabsTrigger value="links">Links</TabsTrigger>
 </TabsList>

 <TabsContent value="basic" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Basic Information</CardTitle>
 <CardDescription>
 Define the core properties of your entity
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="kind">Entity Kind</Label>
 <Select
 value={formData.kind}
 onValueChange={(value) => setValue('kind', value as any)}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="Component">Component</SelectItem>
 <SelectItem value="API">API</SelectItem>
 <SelectItem value="System">System</SelectItem>
 <SelectItem value="Domain">Domain</SelectItem>
 <SelectItem value="Resource">Resource</SelectItem>
 <SelectItem value="Group">Group</SelectItem>
 <SelectItem value="User">User</SelectItem>
 <SelectItem value="Template">Template</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="name">Name</Label>
 <Input
 id="name"
 {...register('metadata.name')}
 placeholder="my-service"
 />
 {errors.metadata?.name && (
 <p className="text-xs text-red-500">
 {errors.metadata.name.message}
 </p>
 )}
 </div>

 <div className="space-y-2">
 <Label htmlFor="namespace">Namespace</Label>
 <Input
 id="namespace"
 {...register('metadata.namespace')}
 placeholder="default"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="title">Display Title</Label>
 <Input
 id="title"
 {...register('metadata.title')}
 placeholder="My Service"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 {...register('metadata.description')}
 placeholder="A detailed description of this entity"
 rows={3}
 />
 </div>

 {formData.kind === 'Component' && (
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label>Component Type</Label>
 <div className="grid grid-cols-2 gap-2">
 {Object.entries(componentTypes).map(([type, config]) => (
 <Card
 key={type}
 className={cn(
 'cursor-pointer transition-colors',
 formData.spec?.type === type && 'border-primary'
 )}
 onClick={() => setValue('spec.type', type)}
 >
 <CardContent className="p-3">
 <div className="flex items-start gap-2">
 <config.icon className="h-4 w-4 mt-0.5" />
 <div className="flex-1">
 <p className="text-sm font-medium">{config.label}</p>
 <p className="text-xs text-muted-foreground">
 {config.description}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>

 <div className="space-y-2">
 <Label>Lifecycle</Label>
 <div className="space-y-2">
 {Object.entries(lifecycles).map(([lifecycle, config]) => (
 <div
 key={lifecycle}
 className={cn(
 'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
 formData.spec?.lifecycle === lifecycle
 ? 'bg-primary/10 border border-primary'
 : 'hover:bg-muted'
 )}
 onClick={() => setValue('spec.lifecycle', lifecycle)}
 >
 <div className={cn('w-2 h-2 rounded-full', config.color)} />
 <span className="text-sm">{config.label}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 <div className="space-y-2">
 <Label htmlFor="owner">Owner</Label>
 <Select
 value={formData.spec?.owner}
 onValueChange={(value) => setValue('spec.owner', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select owner" />
 </SelectTrigger>
 <SelectContent>
 {existingEntities
 .filter((e) => e.kind === 'Group')
 .map((group) => (
 <SelectItem
 key={`${group.metadata.namespace}/${group.metadata.name}`}
 value={`${group.metadata.namespace}/${group.metadata.name}`}
 >
 {group.metadata.name}
 </SelectItem>
 ))}
 <SelectItem value="platform-team">Platform Team</SelectItem>
 <SelectItem value="frontend-team">Frontend Team</SelectItem>
 <SelectItem value="backend-team">Backend Team</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="relationships" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Entity Relationships</CardTitle>
 <CardDescription>
 Define how this entity relates to others in your catalog
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>System</Label>
 <Select
 value={formData.spec?.system}
 onValueChange={(value) => setValue('spec.system', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select system" />
 </SelectTrigger>
 <SelectContent>
 {existingEntities
 .filter((e) => e.kind === 'System')
 .map((system) => (
 <SelectItem
 key={`${system.metadata.namespace}/${system.metadata.name}`}
 value={`${system.metadata.namespace}/${system.metadata.name}`}
 >
 {system.metadata.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Domain</Label>
 <Select
 value={formData.spec?.domain}
 onValueChange={(value) => setValue('spec.domain', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select domain" />
 </SelectTrigger>
 <SelectContent>
 {existingEntities
 .filter((e) => e.kind === 'Domain')
 .map((domain) => (
 <SelectItem
 key={`${domain.metadata.namespace}/${domain.metadata.name}`}
 value={`${domain.metadata.namespace}/${domain.metadata.name}`}
 >
 {domain.metadata.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Subcomponent Of</Label>
 <Select
 value={formData.spec?.subcomponentOf}
 onValueChange={(value) => setValue('spec.subcomponentOf', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select parent component" />
 </SelectTrigger>
 <SelectContent>
 {existingEntities
 .filter((e) => e.kind === 'Component')
 .map((component) => (
 <SelectItem
 key={`${component.metadata.namespace}/${component.metadata.name}`}
 value={`${component.metadata.namespace}/${component.metadata.name}`}
 >
 {component.metadata.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Provides APIs</Label>
 <div className="space-y-2">
 {(formData.spec?.providesApis || []).map((api, index) => (
 <div key={index} className="flex items-center gap-2">
 <Input
 value={api}
 onChange={(e) => {
 const apis = [...(formData.spec?.providesApis || [])];
 apis[index] = e.target.value;
 setValue('spec.providesApis', apis);
 }}
 placeholder="namespace/api-name"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const apis = formData.spec?.providesApis?.filter((_, i) => i !== index);
 setValue('spec.providesApis', apis);
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setValue('spec.providesApis', [
 ...(formData.spec?.providesApis || []),
 '',
 ]);
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add API
 </Button>
 </div>
 </div>

 <div className="space-y-2">
 <Label>Consumes APIs</Label>
 <div className="space-y-2">
 {(formData.spec?.consumesApis || []).map((api, index) => (
 <div key={index} className="flex items-center gap-2">
 <Input
 value={api}
 onChange={(e) => {
 const apis = [...(formData.spec?.consumesApis || [])];
 apis[index] = e.target.value;
 setValue('spec.consumesApis', apis);
 }}
 placeholder="namespace/api-name"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const apis = formData.spec?.consumesApis?.filter((_, i) => i !== index);
 setValue('spec.consumesApis', apis);
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setValue('spec.consumesApis', [
 ...(formData.spec?.consumesApis || []),
 '',
 ]);
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add API
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="metadata" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Tags & Labels</CardTitle>
 <CardDescription>
 Add tags and labels for better organization and discovery
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>Tags</Label>
 <div className="flex flex-wrap gap-2">
 {(formData.metadata.tags || []).map((tag, index) => (
 <Badge key={index} variant="secondary">
 {tag}
 <button
 type="button"
 onClick={() => {
 const tags = formData.metadata.tags?.filter((_, i) => i !== index);
 setValue('metadata.tags', tags);
 }}
 className="ml-1"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 <div className="flex gap-2">
 <Input
 placeholder="Add tag"
 onKeyPress={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const input = e.target as HTMLInputElement;
 if (input.value) {
 setValue('metadata.tags', [
 ...(formData.metadata.tags || []),
 input.value,
 ]);
 input.value = '';
 }
 }
 }}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Labels</Label>
 <div className="space-y-2">
 {Object.entries(formData.metadata.labels || {}).map(([key, value]) => (
 <div key={key} className="flex items-center gap-2">
 <Input
 value={key}
 onChange={(e) => {
 const labels = { ...formData.metadata.labels };
 delete labels[key];
 labels[e.target.value] = value;
 setValue('metadata.labels', labels);
 }}
 placeholder="Key"
 />
 <Input
 value={value}
 onChange={(e) => {
 setValue('metadata.labels', {
 ...formData.metadata.labels,
 [key]: e.target.value,
 });
 }}
 placeholder="Value"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const labels = { ...formData.metadata.labels };
 delete labels[key];
 setValue('metadata.labels', labels);
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setValue('metadata.labels', {
 ...formData.metadata.labels,
 '': '',
 });
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Label
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="annotations" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Annotations</CardTitle>
 <CardDescription>
 Add annotations for integrations and additional metadata
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 {Object.entries(formData.metadata.annotations || {}).map(([key, value]) => (
 <div key={key} className="flex items-center gap-2">
 <Input
 value={key}
 onChange={(e) => {
 const annotations = { ...formData.metadata.annotations };
 delete annotations[key];
 annotations[e.target.value] = value;
 setValue('metadata.annotations', annotations);
 }}
 placeholder="Annotation key"
 />
 <Input
 value={value}
 onChange={(e) => {
 setValue('metadata.annotations', {
 ...formData.metadata.annotations,
 [key]: e.target.value,
 });
 }}
 placeholder="Annotation value"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const annotations = { ...formData.metadata.annotations };
 delete annotations[key];
 setValue('metadata.annotations', annotations);
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setValue('metadata.annotations', {
 ...formData.metadata.annotations,
 '': '',
 });
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Annotation
 </Button>
 </div>

 <div className="rounded-lg bg-muted p-4">
 <h4 className="text-sm font-medium mb-2">Common Annotations</h4>
 <div className="grid gap-2 text-xs">
 <button
 type="button"
 className="text-left hover:underline"
 onClick={() => {
 setValue('metadata.annotations', {
 ...formData.metadata.annotations,
 'github.com/project-slug': 'org/repo',
 });
 }}
 >
 github.com/project-slug
 </button>
 <button
 type="button"
 className="text-left hover:underline"
 onClick={() => {
 setValue('metadata.annotations', {
 ...formData.metadata.annotations,
 'backstage.io/techdocs-ref': 'dir:.',
 });
 }}
 >
 backstage.io/techdocs-ref
 </button>
 <button
 type="button"
 className="text-left hover:underline"
 onClick={() => {
 setValue('metadata.annotations', {
 ...formData.metadata.annotations,
 'pagerduty.com/integration-key': 'YOUR_KEY',
 });
 }}
 >
 pagerduty.com/integration-key
 </button>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="links" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>External Links</CardTitle>
 <CardDescription>
 Add links to related resources and documentation
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 {(formData.metadata.links || []).map((link, index) => (
 <div key={index} className="flex items-center gap-2">
 <Input
 value={link.title}
 onChange={(e) => {
 const links = [...(formData.metadata.links || [])];
 links[index] = { ...links[index], title: e.target.value };
 setValue('metadata.links', links);
 }}
 placeholder="Link title"
 />
 <Input
 value={link.url}
 onChange={(e) => {
 const links = [...(formData.metadata.links || [])];
 links[index] = { ...links[index], url: e.target.value };
 setValue('metadata.links', links);
 }}
 placeholder="https://..."
 />
 <Input
 value={link.icon || ''}
 onChange={(e) => {
 const links = [...(formData.metadata.links || [])];
 links[index] = { ...links[index], icon: e.target.value };
 setValue('metadata.links', links);
 }}
 placeholder="Icon"
 className="w-24"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const links = formData.metadata.links?.filter((_, i) => i !== index);
 setValue('metadata.links', links);
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setValue('metadata.links', [
 ...(formData.metadata.links || []),
 { title: '', url: '' },
 ]);
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Link
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 <div className="flex justify-end gap-2 mt-6">
 {onCancel && (
 <Button type="button" variant="outline" onClick={onCancel}>
 Cancel
 </Button>
 )}
 <Button type="submit" disabled={isSubmitting}>
 <Save className="h-4 w-4 mr-2" />
 {isSubmitting ? 'Creating...' : 'Create Entity'}
 </Button>
 </div>
 </form>

 {/* YAML Preview Dialog */}
 <Dialog open={showPreview} onOpenChange={setShowPreview}>
 <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
 <DialogHeader>
 <DialogTitle>YAML Preview</DialogTitle>
 <DialogDescription>
 This is how your entity will be represented in YAML format
 </DialogDescription>
 </DialogHeader>
 <div className="flex-1 overflow-auto">
 <pre className="bg-muted p-4 rounded-lg text-sm">
 <code>{yaml.dump(formData, { indent: 2 })}</code>
 </pre>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={copyYaml}>
 <Copy className="h-4 w-4 mr-2" />
 Copy
 </Button>
 <Button variant="outline" onClick={exportYaml}>
 <Download className="h-4 w-4 mr-2" />
 Export
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* AI Assist Dialog */}
 <AlertDialog open={showAiAssist} onOpenChange={setShowAiAssist}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>AI-Powered Suggestions</AlertDialogTitle>
 <AlertDialogDescription>
 Based on the entity name and type, here are our suggestions:
 </AlertDialogDescription>
 </AlertDialogHeader>
 {suggestedMetadata && (
 <div className="space-y-4">
 <div>
 <Label>Description</Label>
 <p className="text-sm text-muted-foreground mt-1">
 {suggestedMetadata.description}
 </p>
 </div>
 <div>
 <Label>Tags</Label>
 <div className="flex flex-wrap gap-1 mt-1">
 {suggestedMetadata.tags.map((tag: string) => (
 <Badge key={tag} variant="secondary">
 {tag}
 </Badge>
 ))}
 </div>
 </div>
 <div>
 <Label>Type</Label>
 <p className="text-sm text-muted-foreground mt-1">
 {suggestedMetadata.type}
 </p>
 </div>
 <div>
 <Label>Owner</Label>
 <p className="text-sm text-muted-foreground mt-1">
 {suggestedMetadata.owner}
 </p>
 </div>
 </div>
 )}
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={applySuggestions}>
 Apply Suggestions
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}