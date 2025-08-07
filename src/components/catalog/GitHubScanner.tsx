'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import {
 Github,
 GitBranch,
 Package,
 RefreshCw,
 Search,
 Filter,
 Calendar,
 AlertCircle,
 CheckCircle,
 XCircle,
 Info,
 Settings,
 FileCode,
 Users,
 Star,
 GitFork,
 Eye,
 Clock,
 ArrowRight,
 Loader2,
 FolderOpen,
 FileJson,
 AlertTriangle,
 ChevronDown,
 ChevronRight,
 Play,
 Pause,
 SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Repository {
 id: number;
 name: string;
 full_name: string;
 description: string;
 topics: string[];
 language: string;
 stargazers_count: number;
 forks_count: number;
 updated_at: string;
 default_branch: string;
 visibility: string;
 archived: boolean;
 has_catalog_info?: boolean;
 catalog_info_path?: string;
 discovered_entities?: Array<{
 kind: string;
 name: string;
 namespace?: string;
 }>;
 scan_status?: 'pending' | 'scanning' | 'completed' | 'failed' | 'skipped';
 scan_error?: string;
 owner?: string;
 team?: string;
}

interface ScanSettings {
 organization: string;
 includeArchived: boolean;
 includePrivate: boolean;
 includeForks: boolean;
 topicFilter: string[];
 languageFilter: string[];
 catalogFilePatterns: string[];
 autoImport: boolean;
 scanSchedule: 'manual' | 'hourly' | 'daily' | 'weekly';
 teamMapping: Record<string, string>;
}

const defaultSettings: ScanSettings = {
 organization: '',
 includeArchived: false,
 includePrivate: true,
 includeForks: false,
 topicFilter: [],
 languageFilter: [],
 catalogFilePatterns: [
 'catalog-info.yaml',
 'catalog-info.yml',
 '.backstage/catalog-info.yaml',
 'catalog/*.yaml',
 ],
 autoImport: false,
 scanSchedule: 'manual',
 teamMapping: {},
};

export function GitHubScanner() {
 const [settings, setSettings] = useState<ScanSettings>(defaultSettings);
 const [repositories, setRepositories] = useState<Repository[]>([]);
 const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
 const [isScanning, setIsScanning] = useState(false);
 const [scanProgress, setScanProgress] = useState(0);
 const [currentRepo, setCurrentRepo] = useState<string | null>(null);
 const [showSettings, setShowSettings] = useState(false);
 const [showImportDialog, setShowImportDialog] = useState(false);
 const [stats, setStats] = useState({
 total: 0,
 scanned: 0,
 withCatalog: 0,
 entities: 0,
 errors: 0,
 });
 const [expandedRepos, setExpandedRepos] = useState<Set<number>>(new Set());

 // Load saved settings
 useEffect(() => {
 const saved = localStorage.getItem('github-scanner-settings');
 if (saved) {
 setSettings(JSON.parse(saved));
 }
 }, []);

 const saveSettings = () => {
 localStorage.setItem('github-scanner-settings', JSON.stringify(settings));
 setShowSettings(false);
 toast.success('Settings saved');
 };

 const startScan = async () => {
 if (!settings.organization) {
 toast.error('Please configure GitHub organization first');
 setShowSettings(true);
 return;
 }

 setIsScanning(true);
 setScanProgress(0);
 setStats({
 total: 0,
 scanned: 0,
 withCatalog: 0,
 entities: 0,
 errors: 0,
 });

 try {
 // Fetch repositories
 const response = await fetch('/api/catalog/github/scan', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 organization: settings.organization,
 includeArchived: settings.includeArchived,
 includePrivate: settings.includePrivate,
 includeForks: settings.includeForks,
 }),
 });

 if (!response.ok) {
 throw new Error('Failed to fetch repositories');
 }

 const data = await response.json();
 const repos: Repository[] = data.repositories;
 
 // Apply filters
 let filteredRepos = repos;
 
 if (settings.topicFilter.length > 0) {
 filteredRepos = filteredRepos.filter(repo =>
 repo.topics.some(topic => settings.topicFilter.includes(topic))
 );
 }
 
 if (settings.languageFilter.length > 0) {
 filteredRepos = filteredRepos.filter(repo =>
 settings.languageFilter.includes(repo.language)
 );
 }

 setRepositories(filteredRepos);
 setStats(prev => ({ ...prev, total: filteredRepos.length }));

 // Scan each repository for catalog files
 for (let i = 0; i < filteredRepos.length; i++) {
 const repo = filteredRepos[i];
 setCurrentRepo(repo.name);
 setScanProgress(((i + 1) / filteredRepos.length) * 100);

 try {
 const scanResponse = await fetch('/api/catalog/github/scan-repo', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 owner: settings.organization,
 repo: repo.name,
 patterns: settings.catalogFilePatterns,
 }),
 });

 if (scanResponse.ok) {
 const scanData = await scanResponse.json();
 
 filteredRepos[i] = {
 ...repo,
 has_catalog_info: scanData.found,
 catalog_info_path: scanData.path,
 discovered_entities: scanData.entities,
 scan_status: 'completed',
 owner: detectOwner(repo, scanData.entities),
 team: mapTeam(repo),
 };

 setStats(prev => ({
 ...prev,
 scanned: prev.scanned + 1,
 withCatalog: scanData.found ? prev.withCatalog + 1 : prev.withCatalog,
 entities: prev.entities + (scanData.entities?.length || 0),
 }));
 } else {
 filteredRepos[i].scan_status = 'failed';
 filteredRepos[i].scan_error = 'Failed to scan repository';
 setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
 }
 } catch (error) {
 filteredRepos[i].scan_status = 'failed';
 filteredRepos[i].scan_error = error instanceof Error ? error.message : 'Unknown error';
 setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
 }

 setRepositories([...filteredRepos]);
 }

 toast.success(`Scan completed: ${stats.withCatalog} repositories with catalog files found`);
 } catch (error) {
 console.error('Scan error:', error);
 toast.error('Failed to scan repositories');
 } finally {
 setIsScanning(false);
 setCurrentRepo(null);
 }
 };

 const detectOwner = (repo: Repository, entities: any[]): string => {
 // Try to detect owner from entities
 if (entities && entities.length > 0) {
 const owners = entities
 .map(e => e.spec?.owner)
 .filter(Boolean);
 if (owners.length > 0) {
 return owners[0];
 }
 }

 // Use team mapping
 const team = mapTeam(repo);
 if (team) return team;

 // Fallback to topic-based detection
 if (repo.topics.includes('frontend')) return 'frontend-team';
 if (repo.topics.includes('backend')) return 'backend-team';
 if (repo.topics.includes('platform')) return 'platform-team';
 
 return 'unknown';
 };

 const mapTeam = (repo: Repository): string => {
 // Check explicit mappings
 for (const [pattern, team] of Object.entries(settings.teamMapping)) {
 if (repo.name.includes(pattern)) {
 return team;
 }
 }
 
 // Default mappings
 if (repo.name.includes('frontend') || repo.name.includes('ui')) return 'frontend-team';
 if (repo.name.includes('backend') || repo.name.includes('api')) return 'backend-team';
 if (repo.name.includes('infra') || repo.name.includes('platform')) return 'platform-team';
 
 return '';
 };

 const importSelected = async () => {
 const selectedRepoList = repositories.filter(r => selectedRepos.has(r.id));
 
 if (selectedRepoList.length === 0) {
 toast.error('No repositories selected');
 return;
 }

 setShowImportDialog(false);
 
 for (const repo of selectedRepoList) {
 if (repo.has_catalog_info && repo.catalog_info_path) {
 try {
 const response = await fetch('/api/catalog/import-url', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 url: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${repo.catalog_info_path}`,
 type: 'single-file',
 }),
 });

 if (response.ok) {
 toast.success(`Imported entities from ${repo.name}`);
 } else {
 toast.error(`Failed to import ${repo.name}`);
 }
 } catch (error) {
 toast.error(`Error importing ${repo.name}`);
 }
 }
 }
 };

 const toggleRepoExpanded = (repoId: number) => {
 const newExpanded = new Set(expandedRepos);
 if (newExpanded.has(repoId)) {
 newExpanded.delete(repoId);
 } else {
 newExpanded.add(repoId);
 }
 setExpandedRepos(newExpanded);
 };

 const selectAll = () => {
 const withCatalog = repositories.filter(r => r.has_catalog_info);
 setSelectedRepos(new Set(withCatalog.map(r => r.id)));
 };

 const deselectAll = () => {
 setSelectedRepos(new Set());
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">GitHub Repository Scanner</h2>
 <p className="text-muted-foreground">
 Automatically discover and import entities from your GitHub repositories
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setShowSettings(true)}
 >
 <Settings className="h-4 w-4 mr-2" />
 Settings
 </Button>
 <Button
 onClick={startScan}
 disabled={isScanning}
 >
 {isScanning ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Scanning...
 </>
 ) : (
 <>
 <Search className="h-4 w-4 mr-2" />
 Start Scan
 </>
 )}
 </Button>
 </div>
 </div>

 {/* Stats */}
 <div className="grid gap-4 md:grid-cols-5">
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Repos</p>
 <p className="text-2xl font-bold">{stats.total}</p>
 </div>
 <FolderOpen className="h-8 w-8 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Scanned</p>
 <p className="text-2xl font-bold">{stats.scanned}</p>
 </div>
 <Search className="h-8 w-8 text-muted-foreground" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">With Catalog</p>
 <p className="text-2xl font-bold">{stats.withCatalog}</p>
 </div>
 <FileJson className="h-8 w-8 text-green-500" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Entities Found</p>
 <p className="text-2xl font-bold">{stats.entities}</p>
 </div>
 <Package className="h-8 w-8 text-blue-500" />
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Errors</p>
 <p className="text-2xl font-bold">{stats.errors}</p>
 </div>
 <AlertTriangle className="h-8 w-8 text-red-500" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Progress */}
 {isScanning && (
 <Card>
 <CardContent className="p-4">
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Scanning repositories...</span>
 <span className="text-sm text-muted-foreground">
 {Math.round(scanProgress)}%
 </span>
 </div>
 <Progress value={scanProgress} />
 {currentRepo && (
 <p className="text-xs text-muted-foreground">
 Currently scanning: {currentRepo}
 </p>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Repository List */}
 {repositories.length > 0 && (
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Discovered Repositories</CardTitle>
 <CardDescription>
 {stats.withCatalog} repositories contain catalog files
 </CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={selectAll}
 >
 Select All
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={deselectAll}
 >
 Deselect All
 </Button>
 <Button
 size="sm"
 onClick={() => setShowImportDialog(true)}
 disabled={selectedRepos.size === 0}
 >
 Import Selected ({selectedRepos.size})
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-12"></TableHead>
 <TableHead>Repository</TableHead>
 <TableHead>Language</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Owner/Team</TableHead>
 <TableHead>Entities</TableHead>
 <TableHead>Last Updated</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {repositories.map((repo) => (
 <>
 <TableRow key={repo.id}>
 <TableCell>
 <Checkbox
 checked={selectedRepos.has(repo.id)}
 onCheckedChange={(checked) => {
 const newSelected = new Set(selectedRepos);
 if (checked) {
 newSelected.add(repo.id);
 } else {
 newSelected.delete(repo.id);
 }
 setSelectedRepos(newSelected);
 }}
 disabled={!repo.has_catalog_info}
 />
 </TableCell>
 <TableCell>
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 {repo.has_catalog_info && repo.discovered_entities && repo.discovered_entities.length > 0 && (
 <button
 onClick={() => toggleRepoExpanded(repo.id)}
 className="p-0.5"
 >
 {expandedRepos.has(repo.id) ? (
 <ChevronDown className="h-4 w-4" />
 ) : (
 <ChevronRight className="h-4 w-4" />
 )}
 </button>
 )}
 <span className="font-medium">{repo.name}</span>
 {repo.archived && (
 <Badge variant="secondary" className="text-xs">
 Archived
 </Badge>
 )}
 {repo.visibility === 'private' && (
 <Badge variant="secondary" className="text-xs">
 Private
 </Badge>
 )}
 </div>
 {repo.description && (
 <p className="text-xs text-muted-foreground">
 {repo.description}
 </p>
 )}
 {repo.topics.length > 0 && (
 <div className="flex flex-wrap gap-1">
 {repo.topics.map((topic) => (
 <Badge key={topic} variant="outline" className="text-xs">
 {topic}
 </Badge>
 ))}
 </div>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">{repo.language || 'Unknown'}</Badge>
 </TableCell>
 <TableCell>
 {repo.scan_status === 'completed' && repo.has_catalog_info && (
 <div className="flex items-center gap-1 text-green-600">
 <CheckCircle className="h-4 w-4" />
 <span className="text-sm">Found</span>
 </div>
 )}
 {repo.scan_status === 'completed' && !repo.has_catalog_info && (
 <div className="flex items-center gap-1 text-muted-foreground">
 <XCircle className="h-4 w-4" />
 <span className="text-sm">No catalog</span>
 </div>
 )}
 {repo.scan_status === 'failed' && (
 <div className="flex items-center gap-1 text-red-600">
 <AlertCircle className="h-4 w-4" />
 <span className="text-sm">Error</span>
 </div>
 )}
 {repo.scan_status === 'scanning' && (
 <div className="flex items-center gap-1 text-blue-600">
 <Loader2 className="h-4 w-4 animate-spin" />
 <span className="text-sm">Scanning</span>
 </div>
 )}
 </TableCell>
 <TableCell>
 {repo.owner && (
 <Badge variant="secondary">{repo.owner}</Badge>
 )}
 </TableCell>
 <TableCell>
 {repo.discovered_entities ? (
 <span className="text-sm">
 {repo.discovered_entities.length} entities
 </span>
 ) : (
 <span className="text-sm text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell>
 <span className="text-sm text-muted-foreground">
 {new Date(repo.updated_at).toLocaleDateString()}
 </span>
 </TableCell>
 </TableRow>
 {expandedRepos.has(repo.id) && repo.discovered_entities && repo.discovered_entities.length > 0 && (
 <TableRow>
 <TableCell colSpan={7} className="bg-muted/50">
 <div className="p-4">
 <h4 className="text-sm font-medium mb-2">Discovered Entities:</h4>
 <div className="space-y-1">
 {repo.discovered_entities.map((entity, idx) => (
 <div key={idx} className="flex items-center gap-2 text-sm">
 <Badge variant="outline" className="text-xs">
 {entity.kind}
 </Badge>
 <span>
 {entity.namespace ? `${entity.namespace}/` : ''}{entity.name}
 </span>
 </div>
 ))}
 </div>
 {repo.catalog_info_path && (
 <p className="text-xs text-muted-foreground mt-2">
 Path: {repo.catalog_info_path}
 </p>
 )}
 </div>
 </TableCell>
 </TableRow>
 )}
 </>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 )}

 {/* Settings Dialog */}
 <Dialog open={showSettings} onOpenChange={setShowSettings}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Scanner Settings</DialogTitle>
 <DialogDescription>
 Configure how repositories are scanned and imported
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="organization">GitHub Organization</Label>
 <Input
 id="organization"
 value={settings.organization}
 onChange={(e) => setSettings({ ...settings, organization: e.target.value })}
 placeholder="my-org"
 />
 </div>

 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>Include Archived Repositories</Label>
 <p className="text-xs text-muted-foreground">
 Scan archived repositories for catalog files
 </p>
 </div>
 <Switch
 checked={settings.includeArchived}
 onCheckedChange={(checked) =>
 setSettings({ ...settings, includeArchived: checked })
 }
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>Include Private Repositories</Label>
 <p className="text-xs text-muted-foreground">
 Scan private repositories (requires appropriate permissions)
 </p>
 </div>
 <Switch
 checked={settings.includePrivate}
 onCheckedChange={(checked) =>
 setSettings({ ...settings, includePrivate: checked })
 }
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>Include Forks</Label>
 <p className="text-xs text-muted-foreground">
 Include forked repositories in the scan
 </p>
 </div>
 <Switch
 checked={settings.includeForks}
 onCheckedChange={(checked) =>
 setSettings({ ...settings, includeForks: checked })
 }
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>Auto Import</Label>
 <p className="text-xs text-muted-foreground">
 Automatically import discovered entities
 </p>
 </div>
 <Switch
 checked={settings.autoImport}
 onCheckedChange={(checked) =>
 setSettings({ ...settings, autoImport: checked })
 }
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Scan Schedule</Label>
 <Select
 value={settings.scanSchedule}
 onValueChange={(value: any) =>
 setSettings({ ...settings, scanSchedule: value })
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="manual">Manual</SelectItem>
 <SelectItem value="hourly">Hourly</SelectItem>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Catalog File Patterns</Label>
 <div className="space-y-2">
 {settings.catalogFilePatterns.map((pattern, index) => (
 <div key={index} className="flex items-center gap-2">
 <Input
 value={pattern}
 onChange={(e) => {
 const patterns = [...settings.catalogFilePatterns];
 patterns[index] = e.target.value;
 setSettings({ ...settings, catalogFilePatterns: patterns });
 }}
 placeholder="catalog-info.yaml"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => {
 const patterns = settings.catalogFilePatterns.filter(
 (_, i) => i !== index
 );
 setSettings({ ...settings, catalogFilePatterns: patterns });
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
 setSettings({
 ...settings,
 catalogFilePatterns: [...settings.catalogFilePatterns, ''],
 });
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Pattern
 </Button>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowSettings(false)}>
 Cancel
 </Button>
 <Button onClick={saveSettings}>Save Settings</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Import Confirmation Dialog */}
 <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Import Entities</DialogTitle>
 <DialogDescription>
 Are you sure you want to import entities from {selectedRepos.size} selected repositories?
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="rounded-lg bg-muted p-4">
 <h4 className="text-sm font-medium mb-2">Import Summary</h4>
 <div className="space-y-1 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Repositories:</span>
 <span>{selectedRepos.size}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Estimated Entities:</span>
 <span>
 {repositories
 .filter(r => selectedRepos.has(r.id))
 .reduce((sum, r) => sum + (r.discovered_entities?.length || 0), 0)}
 </span>
 </div>
 </div>
 </div>
 <Alert>
 <Info className="h-4 w-4" />
 <AlertTitle>Note</AlertTitle>
 <AlertDescription>
 Imported entities will be added to your catalog and synchronized with your Backstage backend.
 </AlertDescription>
 </Alert>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowImportDialog(false)}>
 Cancel
 </Button>
 <Button onClick={importSelected}>
 <Upload className="h-4 w-4 mr-2" />
 Import
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}