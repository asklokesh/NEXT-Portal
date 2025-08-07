'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Github, 
  Search, 
  Filter, 
  Download, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  Code,
  Users,
  Star,
  GitFork,
  Clock,
  Settings,
  Loader2,
  ChevronDown,
  ChevronRight,
  Database,
  Shield,
  Zap,
  Upload,
  History,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { Repository, ScanOptions, ScanResult } from '@/lib/discovery/GitHubScanner';

// Form schemas
const ScanConfigSchema = z.object({
  authType: z.enum(['token', 'app']),
  token: z.string().optional(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  installationId: z.string().optional(),
  organizations: z.string(),
  users: z.string(),
  repositories: z.string(),
  includePrivate: z.boolean().default(false),
  includeArchived: z.boolean().default(false),
  includeForks: z.boolean().default(true),
  batchSize: z.number().min(1).max(100).default(50),
  maxConcurrent: z.number().min(1).max(10).default(5),
  dryRun: z.boolean().default(true),
});

type ScanConfigForm = z.infer<typeof ScanConfigSchema>;

interface GitHubDiscoveryProps {
  onRepositoriesScanned?: (repositories: Repository[]) => void;
  onRepositoriesImported?: (count: number) => void;
}

interface ScanProgress {
  phase: 'idle' | 'scanning' | 'processing' | 'completed' | 'error';
  current: number;
  total: number;
  currentRepository?: string;
  message?: string;
}

interface ImportHistoryEntry {
  id: string;
  timestamp: Date;
  totalRepositories: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'success' | 'partial' | 'failed';
}

export function GitHubDiscovery({ onRepositoriesScanned, onRepositoriesImported }: GitHubDiscoveryProps) {
  // State management
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ phase: 'idle', current: 0, total: 0 });
  const [selectedRepositories, setSelectedRepositories] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string }>({ current: 0, total: 0, phase: 'idle' });
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRepository, setPreviewRepository] = useState<Repository | null>(null);

  // Form setup
  const form = useForm<ScanConfigForm>({
    resolver: zodResolver(ScanConfigSchema),
    defaultValues: {
      authType: 'token',
      organizations: '',
      users: '',
      repositories: '',
      includePrivate: false,
      includeArchived: false,
      includeForks: true,
      batchSize: 50,
      maxConcurrent: 5,
      dryRun: true,
    },
  });

  // Computed values
  const filteredRepositories = React.useMemo(() => {
    if (!scanResult?.repositories) return [];

    return scanResult.repositories.filter(repo => {
      // Text filter
      if (filterText) {
        const searchText = filterText.toLowerCase();
        if (!repo.name.toLowerCase().includes(searchText) &&
            !repo.description?.toLowerCase().includes(searchText) &&
            !repo.topics.some(topic => topic.toLowerCase().includes(searchText))) {
          return false;
        }
      }

      // Language filter
      if (languageFilter !== 'all' && repo.language !== languageFilter) {
        return false;
      }

      // Framework filter
      if (frameworkFilter !== 'all' && repo.framework_detection.framework !== frameworkFilter) {
        return false;
      }

      return true;
    });
  }, [scanResult, filterText, languageFilter, frameworkFilter]);

  const availableLanguages = React.useMemo(() => {
    if (!scanResult?.repositories) return [];
    const languages = new Set<string>();
    scanResult.repositories.forEach(repo => {
      if (repo.language) languages.add(repo.language);
    });
    return Array.from(languages).sort();
  }, [scanResult]);

  const availableFrameworks = React.useMemo(() => {
    if (!scanResult?.repositories) return [];
    const frameworks = new Set<string>();
    scanResult.repositories.forEach(repo => {
      if (repo.framework_detection.framework) {
        frameworks.add(repo.framework_detection.framework);
      }
    });
    return Array.from(frameworks).sort();
  }, [scanResult]);

  // Load import history on mount
  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    try {
      // Mock implementation - replace with actual API call
      const mockHistory: ImportHistoryEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 86400000),
          totalRepositories: 45,
          importedCount: 42,
          skippedCount: 2,
          errorCount: 1,
          status: 'partial',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 172800000),
          totalRepositories: 28,
          importedCount: 28,
          skippedCount: 0,
          errorCount: 0,
          status: 'success',
        },
      ];
      setImportHistory(mockHistory);
    } catch (error) {
      console.error('Failed to load import history:', error);
    }
  };

  const handleScan = useCallback(async (data: ScanConfigForm) => {
    setScanProgress({ phase: 'scanning', current: 0, total: 0, message: 'Initializing scan...' });
    setScanResult(null);

    try {
      // Prepare scan options
      const scanOptions: ScanOptions = {
        organizations: data.organizations.split(',').map(s => s.trim()).filter(Boolean),
        users: data.users.split(',').map(s => s.trim()).filter(Boolean),
        repositories: data.repositories.split(',').map(s => s.trim()).filter(Boolean),
        includePrivate: data.includePrivate,
        includeArchived: data.includeArchived,
        includeForks: data.includeForks,
        batchSize: data.batchSize,
        maxConcurrent: data.maxConcurrent,
        dryRun: data.dryRun,
      };

      // Start scanning
      const response = await fetch('/api/catalog/discovery/github/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            token: data.token,
            appId: data.appId ? parseInt(data.appId) : undefined,
            privateKey: data.privateKey,
            installationId: data.installationId ? parseInt(data.installationId) : undefined,
          },
          options: scanOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }

      const result: ScanResult = await response.json();
      setScanResult(result);
      setScanProgress({ phase: 'completed', current: result.totalScanned, total: result.totalScanned });
      
      // Select all repositories by default
      setSelectedRepositories(new Set(result.repositories.map(repo => repo.full_name)));
      
      if (onRepositoriesScanned) {
        onRepositoriesScanned(result.repositories);
      }

    } catch (error) {
      console.error('Scan failed:', error);
      setScanProgress({ 
        phase: 'error', 
        current: 0, 
        total: 0, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [onRepositoriesScanned]);

  const handleImport = useCallback(async () => {
    if (!scanResult || selectedRepositories.size === 0) return;

    const repositoriesToImport = scanResult.repositories.filter(repo => 
      selectedRepositories.has(repo.full_name)
    );

    setImportProgress({ current: 0, total: repositoriesToImport.length, phase: 'importing' });

    try {
      const response = await fetch('/api/catalog/discovery/github/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositories: repositoriesToImport,
        }),
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      setImportProgress({ current: result.imported, total: repositoriesToImport.length, phase: 'completed' });
      
      // Add to import history
      const historyEntry: ImportHistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        totalRepositories: repositoriesToImport.length,
        importedCount: result.imported,
        skippedCount: result.skipped || 0,
        errorCount: result.errors || 0,
        status: result.errors > 0 ? 'partial' : 'success',
      };
      setImportHistory(prev => [historyEntry, ...prev]);

      if (onRepositoriesImported) {
        onRepositoriesImported(result.imported);
      }

    } catch (error) {
      console.error('Import failed:', error);
      setImportProgress({ current: 0, total: 0, phase: 'error' });
    }
  }, [scanResult, selectedRepositories, onRepositoriesImported]);

  const handleSelectAll = () => {
    if (filteredRepositories.length === 0) return;
    
    const allFiltered = new Set(filteredRepositories.map(repo => repo.full_name));
    setSelectedRepositories(allFiltered);
  };

  const handleSelectNone = () => {
    setSelectedRepositories(new Set());
  };

  const handleRepositorySelect = (fullName: string, selected: boolean) => {
    const newSelected = new Set(selectedRepositories);
    if (selected) {
      newSelected.add(fullName);
    } else {
      newSelected.delete(fullName);
    }
    setSelectedRepositories(newSelected);
  };

  const handlePreviewRepository = (repository: Repository) => {
    setPreviewRepository(repository);
    setShowPreview(true);
  };

  const renderScanConfiguration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Scan Configuration
        </CardTitle>
        <CardDescription>
          Configure GitHub authentication and repository discovery settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleScan)} className="space-y-6">
          {/* Authentication */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Authentication</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="authType">Authentication Method</Label>
                <Select
                  value={form.watch('authType')}
                  onValueChange={(value: 'token' | 'app') => form.setValue('authType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select authentication method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Personal Access Token</SelectItem>
                    <SelectItem value="app">GitHub App</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.watch('authType') === 'token' && (
                <div>
                  <Label htmlFor="token">Personal Access Token</Label>
                  <Input
                    {...form.register('token')}
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              {form.watch('authType') === 'app' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="appId">App ID</Label>
                    <Input
                      {...form.register('appId')}
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <Label htmlFor="installationId">Installation ID</Label>
                    <Input
                      {...form.register('installationId')}
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <Label htmlFor="privateKey">Private Key</Label>
                    <Textarea
                      {...form.register('privateKey')}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----"
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Repository Sources */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Repository Sources</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="organizations">Organizations</Label>
                <Input
                  {...form.register('organizations')}
                  placeholder="org1, org2, org3"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Comma-separated list
                </p>
              </div>
              
              <div>
                <Label htmlFor="users">Users</Label>
                <Input
                  {...form.register('users')}
                  placeholder="user1, user2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Comma-separated list
                </p>
              </div>
              
              <div>
                <Label htmlFor="repositories">Specific Repositories</Label>
                <Input
                  {...form.register('repositories')}
                  placeholder="owner/repo1, owner/repo2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  owner/repo format
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Scan Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Scan Options</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includePrivate"
                  checked={form.watch('includePrivate')}
                  onCheckedChange={(checked) => form.setValue('includePrivate', !!checked)}
                />
                <Label htmlFor="includePrivate">Include Private</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeArchived"
                  checked={form.watch('includeArchived')}
                  onCheckedChange={(checked) => form.setValue('includeArchived', !!checked)}
                />
                <Label htmlFor="includeArchived">Include Archived</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeForks"
                  checked={form.watch('includeForks')}
                  onCheckedChange={(checked) => form.setValue('includeForks', !!checked)}
                />
                <Label htmlFor="includeForks">Include Forks</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  {...form.register('batchSize', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="100"
                />
              </div>
              
              <div>
                <Label htmlFor="maxConcurrent">Max Concurrent</Label>
                <Input
                  {...form.register('maxConcurrent', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="10"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dryRun"
                  checked={form.watch('dryRun')}
                  onCheckedChange={(checked) => form.setValue('dryRun', !!checked)}
                />
                <Label htmlFor="dryRun">Dry Run Mode</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={scanProgress.phase === 'scanning'}
              className="min-w-32"
            >
              {scanProgress.phase === 'scanning' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Start Scan
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderScanProgress = () => (
    scanProgress.phase !== 'idle' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {scanProgress.phase === 'scanning' && <Loader2 className="h-5 w-5 animate-spin" />}
            {scanProgress.phase === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {scanProgress.phase === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            Scan Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress 
              value={scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0} 
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{scanProgress.message || `${scanProgress.current} / ${scanProgress.total}`}</span>
              <span>{scanProgress.currentRepository}</span>
            </div>
            {scanProgress.phase === 'error' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {scanProgress.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    )
  );

  const renderRepositoryList = () => (
    scanResult && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Discovered Repositories ({filteredRepositories.length})
              </CardTitle>
              <CardDescription>
                Found {scanResult.totalScanned} repositories, {scanResult.summary.withCatalogInfo} with catalog-info.yaml
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All ({filteredRepositories.length})
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectNone}>
                Select None
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search repositories..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {showAdvancedFilters ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>

            {showAdvancedFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div>
                  <Label>Language</Label>
                  <Select value={languageFilter} onValueChange={setLanguageFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      {availableLanguages.map(lang => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Framework</Label>
                  <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Frameworks</SelectItem>
                      {availableFrameworks.map(framework => (
                        <SelectItem key={framework} value={framework}>{framework}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Repository list */}
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {filteredRepositories.map((repo) => (
                <div key={repo.full_name} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedRepositories.has(repo.full_name)}
                      onCheckedChange={(checked) => handleRepositorySelect(repo.full_name, !!checked)}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium truncate">{repo.full_name}</h4>
                        {repo.private && <Badge variant="secondary">Private</Badge>}
                        {repo.archived && <Badge variant="outline">Archived</Badge>}
                        {repo.has_catalog_info && <Badge variant="default">Has Catalog</Badge>}
                        {repo.auto_generated_catalog && <Badge variant="outline">Auto-Generated</Badge>}
                      </div>
                      
                      {repo.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {repo.language && (
                          <span className="flex items-center gap-1">
                            <Code className="h-3 w-3" />
                            {repo.language}
                          </span>
                        )}
                        {repo.framework_detection.framework && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {repo.framework_detection.framework}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repo.stargazers_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {repo.forks_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(repo.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {repo.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {repo.topics.slice(0, 5).map(topic => (
                            <Badge key={topic} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {repo.topics.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{repo.topics.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewRepository(repo)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview Repository</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(repo.html_url, '_blank')}
                            >
                              <Github className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open in GitHub</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedRepositories.size > 0 && (
            <div className="mt-6 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedRepositories.size} repositories selected</p>
                  <p className="text-sm text-muted-foreground">
                    Ready to import to catalog
                  </p>
                </div>
                <Button 
                  onClick={handleImport}
                  disabled={importProgress.phase === 'importing'}
                  className="min-w-32"
                >
                  {importProgress.phase === 'importing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Selected
                    </>
                  )}
                </Button>
              </div>
              
              {importProgress.phase === 'importing' && (
                <div className="mt-4 space-y-2">
                  <Progress value={(importProgress.current / importProgress.total) * 100} />
                  <p className="text-sm text-muted-foreground">
                    {importProgress.current} / {importProgress.total} imported
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  );

  const renderImportHistory = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Import History
        </CardTitle>
        <CardDescription>
          Previous GitHub repository import sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {importHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No import history available
            </p>
          ) : (
            importHistory.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {entry.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {entry.status === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                    {entry.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="font-medium">
                      {entry.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <Badge variant={entry.status === 'success' ? 'default' : entry.status === 'partial' ? 'secondary' : 'destructive'}>
                    {entry.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <span className="ml-1 font-medium">{entry.totalRepositories}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Imported:</span>
                    <span className="ml-1 font-medium text-green-600">{entry.importedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="ml-1 font-medium text-yellow-600">{entry.skippedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Errors:</span>
                    <span className="ml-1 font-medium text-red-600">{entry.errorCount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderRepositoryPreview = () => (
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            {previewRepository?.full_name}
          </DialogTitle>
          <DialogDescription>
            Repository details and generated catalog entry
          </DialogDescription>
        </DialogHeader>
        
        {previewRepository && (
          <div className="space-y-6">
            {/* Repository Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Repository Details</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Language:</span> {previewRepository.language || 'Unknown'}</div>
                  <div><span className="text-muted-foreground">Framework:</span> {previewRepository.framework_detection.framework || 'Unknown'}</div>
                  <div><span className="text-muted-foreground">Stars:</span> {previewRepository.stargazers_count}</div>
                  <div><span className="text-muted-foreground">Forks:</span> {previewRepository.forks_count}</div>
                  <div><span className="text-muted-foreground">Updated:</span> {new Date(previewRepository.updated_at).toLocaleDateString()}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Detection Results</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Has catalog-info.yaml:</span> {previewRepository.has_catalog_info ? 'Yes' : 'No'}</div>
                  <div><span className="text-muted-foreground">Framework confidence:</span> {previewRepository.framework_detection.confidence}%</div>
                  <div><span className="text-muted-foreground">Dependencies found:</span> {Object.keys(previewRepository.dependencies).length}</div>
                </div>
              </div>
            </div>

            {/* Catalog Entity */}
            <div>
              <h4 className="font-medium mb-2">
                {previewRepository.has_catalog_info ? 'Existing catalog-info.yaml' : 'Generated Catalog Entry'}
              </h4>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(
                  previewRepository.catalog_info || previewRepository.auto_generated_catalog,
                  null,
                  2
                )}
              </pre>
            </div>

            {/* Dependencies */}
            {Object.keys(previewRepository.dependencies).length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Dependencies</h4>
                <div className="space-y-2">
                  {previewRepository.dependencies.package_json && (
                    <div>
                      <h5 className="text-sm font-medium">Node.js (package.json)</h5>
                      <div className="text-sm text-muted-foreground">
                        {Object.keys(previewRepository.dependencies.package_json.dependencies || {}).length} dependencies,{' '}
                        {Object.keys(previewRepository.dependencies.package_json.devDependencies || {}).length} dev dependencies
                      </div>
                    </div>
                  )}
                  {/* Add other dependency types as needed */}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GitHub Discovery</h1>
          <p className="text-muted-foreground">
            Scan GitHub repositories and automatically populate your service catalog
          </p>
        </div>
      </div>

      <Tabs defaultValue="scan" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scan">Repository Scan</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-6">
          {renderScanConfiguration()}
          {renderScanProgress()}
          {renderRepositoryList()}
        </TabsContent>

        <TabsContent value="history">
          {renderImportHistory()}
        </TabsContent>
      </Tabs>

      {renderRepositoryPreview()}
    </div>
  );
}