'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
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
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 GitBranch,
 Globe,
 FileCode,
 Loader2,
 CheckCircle2,
 AlertCircle,
 Copy,
 ExternalLink,
 ArrowRight,
 Info,
 Github,
 Gitlab,
 FileSearch,
 FolderOpen
} from 'lucide-react';
import {
 Alert,
 AlertDescription,
 AlertTitle,
} from '@/components/ui/alert';

interface ImportConfig {
 url: string;
 branch?: string;
 subPath?: string;
 catalogFile?: string;
 dryRun?: boolean;
}

interface ImportResult {
 entities: Array<{
 kind: string;
 metadata: {
 name: string;
 namespace?: string;
 };
 }>;
 errors?: string[];
 warnings?: string[];
}

export function ImportFromUrl() {
 const router = useRouter();
 const [activeTab, setActiveTab] = useState('single');
 const [loading, setLoading] = useState(false);
 const [validating, setValidating] = useState(false);
 const [importResult, setImportResult] = useState<ImportResult | null>(null);
 
 // Single file import state
 const [singleFileUrl, setSingleFileUrl] = useState('');
 
 // Repository import state
 const [repoUrl, setRepoUrl] = useState('');
 const [repoBranch, setRepoBranch] = useState('main');
 const [repoPath, setRepoPath] = useState('');
 const [catalogFileName, setCatalogFileName] = useState('catalog-info.yaml');
 
 // Common templates for quick start
 const templates = [
 {
 name: 'GitHub Repository',
 icon: Github,
 url: 'https://github.com/{owner}/{repo}',
 branch: 'main',
 pattern: 'catalog-info.yaml'
 },
 {
 name: 'GitLab Repository',
 icon: Gitlab,
 url: 'https://gitlab.com/{owner}/{repo}',
 branch: 'main',
 pattern: 'catalog-info.yaml'
 },
 {
 name: 'Monorepo with Services',
 icon: FolderOpen,
 url: 'https://github.com/{owner}/{repo}',
 branch: 'main',
 pattern: 'services/*/catalog-info.yaml'
 }
 ];

 const validateUrl = async (url: string): Promise<boolean> => {
 setValidating(true);
 try {
 // Validate URL format
 const urlObj = new URL(url);
 
 // Check if it's a supported Git provider
 const supportedHosts = ['github.com', 'gitlab.com', 'bitbucket.org'];
 const isSupported = supportedHosts.some(host => urlObj.hostname.includes(host));
 
 if (!isSupported) {
 toast.error('Please use a URL from GitHub, GitLab, or Bitbucket');
 return false;
 }
 
 // Try to fetch the URL to validate it exists
 const response = await fetch(`/api/catalog/validate-url`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ url })
 });
 
 if (!response.ok) {
 const error = await response.json();
 toast.error(error.message || 'Invalid URL');
 return false;
 }
 
 return true;
 } catch (error) {
 toast.error('Invalid URL format');
 return false;
 } finally {
 setValidating(false);
 }
 };

 const handleSingleFileImport = async () => {
 if (!singleFileUrl) {
 toast.error('Please enter a catalog file URL');
 return;
 }

 const isValid = await validateUrl(singleFileUrl);
 if (!isValid) return;

 setLoading(true);
 try {
 const response = await fetch('/api/catalog/import-url', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 url: singleFileUrl,
 type: 'single-file'
 })
 });

 if (!response.ok) {
 throw new Error('Failed to import catalog file');
 }

 const result = await response.json();
 setImportResult(result);
 
 if (result.entities.length > 0) {
 toast.success(`Successfully imported ${result.entities.length} entities`);
 }
 } catch (error) {
 toast.error('Failed to import catalog file');
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const handleRepositoryImport = async () => {
 if (!repoUrl) {
 toast.error('Please enter a repository URL');
 return;
 }

 const isValid = await validateUrl(repoUrl);
 if (!isValid) return;

 setLoading(true);
 try {
 const response = await fetch('/api/catalog/import-url', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 url: repoUrl,
 branch: repoBranch,
 subPath: repoPath,
 catalogFile: catalogFileName,
 type: 'repository'
 })
 });

 if (!response.ok) {
 throw new Error('Failed to import from repository');
 }

 const result = await response.json();
 setImportResult(result);
 
 if (result.entities.length > 0) {
 toast.success(`Successfully imported ${result.entities.length} entities`);
 }
 } catch (error) {
 toast.error('Failed to import from repository');
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const handleTemplateSelect = (template: typeof templates[0]) => {
 setRepoUrl(template.url);
 setRepoBranch(template.branch);
 setCatalogFileName(template.pattern);
 setActiveTab('repository');
 };

 return (
 <div className="space-y-6 max-w-4xl mx-auto">
 {/* Header */}
 <div>
 <h2 className="text-2xl font-bold">Import from URL</h2>
 <p className="text-muted-foreground mt-1">
 Import existing catalog-info.yaml files from a Git repository or direct URL
 </p>
 </div>

 {/* Quick Start Templates */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Quick Start Templates</CardTitle>
 <CardDescription>
 Use these templates to quickly import from common repository structures
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid gap-3 md:grid-cols-3">
 {templates.map((template) => (
 <button
 key={template.name}
 onClick={() => handleTemplateSelect(template)}
 className="flex items-start gap-3 p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
 >
 <template.icon className="h-5 w-5 text-muted-foreground mt-0.5" />
 <div className="space-y-1">
 <div className="font-medium">{template.name}</div>
 <div className="text-sm text-muted-foreground">
 {template.pattern}
 </div>
 </div>
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Import Options */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="single">Single File</TabsTrigger>
 <TabsTrigger value="repository">Repository</TabsTrigger>
 </TabsList>

 <TabsContent value="single" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Import Single Catalog File</CardTitle>
 <CardDescription>
 Import a single catalog-info.yaml file from a direct URL
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="single-url">Catalog File URL</Label>
 <div className="flex gap-2">
 <Input
 id="single-url"
 type="url"
 placeholder="https://github.com/org/repo/blob/main/catalog-info.yaml"
 value={singleFileUrl}
 onChange={(e) => setSingleFileUrl(e.target.value)}
 className="flex-1"
 />
 <Button
 variant="outline"
 size="icon"
 onClick={() => validateUrl(singleFileUrl)}
 disabled={!singleFileUrl || validating}
 >
 {validating ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <FileSearch className="h-4 w-4" />
 )}
 </Button>
 </div>
 <p className="text-sm text-muted-foreground">
 Direct link to a catalog-info.yaml file in your repository
 </p>
 </div>

 <Alert>
 <Info className="h-4 w-4" />
 <AlertTitle>Supported Formats</AlertTitle>
 <AlertDescription>
 The file must be a valid YAML file following the Backstage entity format.
 Supported Git providers: GitHub, GitLab, Bitbucket
 </AlertDescription>
 </Alert>

 <Button
 onClick={handleSingleFileImport}
 disabled={!singleFileUrl || loading}
 className="w-full"
 >
 {loading ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Importing...
 </>
 ) : (
 <>
 <FileCode className="mr-2 h-4 w-4" />
 Import File
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="repository" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Import from Repository</CardTitle>
 <CardDescription>
 Scan a repository for catalog files and import all entities
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="repo-url">Repository URL</Label>
 <Input
 id="repo-url"
 type="url"
 placeholder="https://github.com/backstage/backstage"
 value={repoUrl}
 onChange={(e) => setRepoUrl(e.target.value)}
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="repo-branch">Branch</Label>
 <Input
 id="repo-branch"
 type="text"
 placeholder="main"
 value={repoBranch}
 onChange={(e) => setRepoBranch(e.target.value)}
 />
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="repo-path">Subdirectory (optional)</Label>
 <Input
 id="repo-path"
 type="text"
 placeholder="services/"
 value={repoPath}
 onChange={(e) => setRepoPath(e.target.value)}
 />
 <p className="text-sm text-muted-foreground">
 Limit scanning to a specific directory
 </p>
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="catalog-pattern">Catalog File Pattern</Label>
 <Input
 id="catalog-pattern"
 type="text"
 placeholder="catalog-info.yaml"
 value={catalogFileName}
 onChange={(e) => setCatalogFileName(e.target.value)}
 />
 <p className="text-sm text-muted-foreground">
 File name or pattern to search for
 </p>
 </div>
 </div>

 <Alert>
 <GitBranch className="h-4 w-4" />
 <AlertTitle>Repository Scanning</AlertTitle>
 <AlertDescription>
 We'll scan the repository for all files matching the pattern and import
 all valid entities found. This may take a moment for large repositories.
 </AlertDescription>
 </Alert>

 <Button
 onClick={handleRepositoryImport}
 disabled={!repoUrl || loading}
 className="w-full"
 >
 {loading ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Scanning Repository...
 </>
 ) : (
 <>
 <GitBranch className="mr-2 h-4 w-4" />
 Import from Repository
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Import Results */}
 {importResult && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <CheckCircle2 className="h-5 w-5 text-green-600" />
 Import Results
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-3">
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold">{importResult.entities.length}</div>
 <p className="text-sm text-muted-foreground">Entities Imported</p>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-yellow-600">
 {importResult.warnings?.length || 0}
 </div>
 <p className="text-sm text-muted-foreground">Warnings</p>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-red-600">
 {importResult.errors?.length || 0}
 </div>
 <p className="text-sm text-muted-foreground">Errors</p>
 </div>
 </div>

 {importResult.entities.length > 0 && (
 <div className="space-y-2">
 <h4 className="font-medium">Imported Entities</h4>
 <div className="max-h-60 overflow-y-auto space-y-2">
 {importResult.entities.map((entity, index) => (
 <div
 key={index}
 className="flex items-center justify-between p-3 bg-muted rounded-lg"
 >
 <div>
 <Badge variant="outline" className="mr-2">
 {entity.kind}
 </Badge>
 <span className="font-medium">
 {entity.metadata.namespace || 'default'}/{entity.metadata.name}
 </span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => router.push(`/catalog/${entity.kind.toLowerCase()}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}`)}
 >
 View
 <ExternalLink className="ml-1 h-3 w-3" />
 </Button>
 </div>
 ))}
 </div>
 </div>
 )}

 {importResult.warnings && importResult.warnings.length > 0 && (
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>Warnings</AlertTitle>
 <AlertDescription>
 <ul className="list-disc list-inside space-y-1 mt-2">
 {importResult.warnings.map((warning, index) => (
 <li key={index} className="text-sm">{warning}</li>
 ))}
 </ul>
 </AlertDescription>
 </Alert>
 )}

 <div className="flex gap-3">
 <Button
 variant="outline"
 onClick={() => {
 setImportResult(null);
 setSingleFileUrl('');
 setRepoUrl('');
 }}
 className="flex-1"
 >
 Import More
 </Button>
 <Button
 onClick={() => router.push('/catalog')}
 className="flex-1"
 >
 Go to Catalog
 <ArrowRight className="ml-2 h-4 w-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}