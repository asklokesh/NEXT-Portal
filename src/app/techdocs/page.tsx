'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Search,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Home,
  Clock,
  Star,
  GitBranch,
  Eye,
  Edit,
  Download,
  Share2,
  Printer,
  Settings,
  Filter,
  Hash,
  Code,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  List,
  Grid,
  FileCode,
  FileJson,
  Image,
  Film,
  Archive,
  Terminal,
  Database,
  Cloud,
  Shield,
  Zap,
  Package,
  Layers,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import { TechDocsViewer } from '@/components/techdocs/TechDocsViewer';
import { TechDocsSearch } from '@/components/techdocs/TechDocsSearch';
import { TechDocsSidebar } from '@/components/techdocs/TechDocsSidebar';

interface DocEntity {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  description?: string;
  owner?: string;
  tags?: string[];
  metadata?: {
    title?: string;
    description?: string;
    lastUpdated?: string;
    version?: string;
    authors?: string[];
  };
  docs?: {
    path: string;
    format: 'markdown' | 'html' | 'asciidoc' | 'restructuredtext';
    toc?: TocItem[];
  };
  stats?: {
    views: number;
    stars: number;
    lastViewed?: string;
    contributors: number;
  };
}

interface TocItem {
  id: string;
  title: string;
  path: string;
  level: number;
  children?: TocItem[];
}

interface RecentDoc {
  entity: DocEntity;
  viewedAt: string;
}

function TechDocsContent() {
  const searchParams = useSearchParams();
  const entityId = searchParams.get('entity');
  const docPath = searchParams.get('path');
  
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<DocEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<DocEntity | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [starredDocs, setStarredDocs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'browse' | 'recent' | 'starred'>('browse');

  useEffect(() => {
    fetchTechDocs();
    loadUserPreferences();
  }, []);

  useEffect(() => {
    if (entityId) {
      const entity = entities.find(e => e.id === entityId);
      if (entity) {
        setSelectedEntity(entity);
        addToRecent(entity);
      }
    }
  }, [entityId, entities]);

  const fetchTechDocs = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockEntities: DocEntity[] = [
      {
        id: 'backstage-backend',
        name: 'backstage-backend',
        namespace: 'default',
        kind: 'Component',
        description: 'Backend service for Backstage platform',
        owner: 'team:platform',
        tags: ['backend', 'nodejs', 'api'],
        metadata: {
          title: 'Backstage Backend Documentation',
          description: 'Complete documentation for the Backstage backend service',
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
          authors: ['Platform Team'],
        },
        docs: {
          path: '/docs/backstage-backend',
          format: 'markdown',
          toc: [
            {
              id: 'getting-started',
              title: 'Getting Started',
              path: 'getting-started.md',
              level: 1,
              children: [
                { id: 'installation', title: 'Installation', path: 'installation.md', level: 2 },
                { id: 'configuration', title: 'Configuration', path: 'configuration.md', level: 2 },
              ],
            },
            {
              id: 'api-reference',
              title: 'API Reference',
              path: 'api-reference.md',
              level: 1,
              children: [
                { id: 'endpoints', title: 'Endpoints', path: 'endpoints.md', level: 2 },
                { id: 'authentication', title: 'Authentication', path: 'authentication.md', level: 2 },
              ],
            },
            {
              id: 'deployment',
              title: 'Deployment',
              path: 'deployment.md',
              level: 1,
            },
          ],
        },
        stats: {
          views: 1234,
          stars: 45,
          contributors: 12,
          lastViewed: new Date(Date.now() - 3600000).toISOString(),
        },
      },
      {
        id: 'user-service',
        name: 'user-service',
        namespace: 'production',
        kind: 'Component',
        description: 'User management microservice',
        owner: 'team:identity',
        tags: ['microservice', 'authentication', 'users'],
        metadata: {
          title: 'User Service Documentation',
          description: 'Documentation for user management and authentication',
          lastUpdated: new Date(Date.now() - 86400000).toISOString(),
          version: '2.1.0',
          authors: ['Identity Team'],
        },
        docs: {
          path: '/docs/user-service',
          format: 'markdown',
          toc: [
            {
              id: 'overview',
              title: 'Overview',
              path: 'overview.md',
              level: 1,
            },
            {
              id: 'architecture',
              title: 'Architecture',
              path: 'architecture.md',
              level: 1,
            },
          ],
        },
        stats: {
          views: 567,
          stars: 23,
          contributors: 8,
        },
      },
      {
        id: 'kubernetes-guide',
        name: 'kubernetes-guide',
        namespace: 'guides',
        kind: 'Documentation',
        description: 'Comprehensive Kubernetes deployment guide',
        owner: 'team:devops',
        tags: ['kubernetes', 'deployment', 'guide'],
        metadata: {
          title: 'Kubernetes Deployment Guide',
          description: 'Step-by-step guide for Kubernetes deployments',
          lastUpdated: new Date(Date.now() - 172800000).toISOString(),
          version: '1.5.0',
          authors: ['DevOps Team'],
        },
        docs: {
          path: '/docs/kubernetes-guide',
          format: 'markdown',
        },
        stats: {
          views: 2345,
          stars: 89,
          contributors: 15,
        },
      },
    ];
    
    setEntities(mockEntities);
    setLoading(false);
  };

  const loadUserPreferences = () => {
    // Load from localStorage
    const saved = localStorage.getItem('techdocs-preferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setStarredDocs(prefs.starred || []);
      setRecentDocs(prefs.recent || []);
      setTheme(prefs.theme || 'light');
      setViewMode(prefs.viewMode || 'grid');
    }
  };

  const saveUserPreferences = () => {
    localStorage.setItem('techdocs-preferences', JSON.stringify({
      starred: starredDocs,
      recent: recentDocs,
      theme,
      viewMode,
    }));
  };

  const addToRecent = (entity: DocEntity) => {
    setRecentDocs(prev => {
      const filtered = prev.filter(r => r.entity.id !== entity.id);
      return [{ entity, viewedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
    });
  };

  const toggleStar = (entityId: string) => {
    setStarredDocs(prev => {
      if (prev.includes(entityId)) {
        return prev.filter(id => id !== entityId);
      }
      return [...prev, entityId];
    });
  };

  const filteredEntities = entities.filter(entity => {
    if (searchQuery && !entity.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !entity.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterKind !== 'all' && entity.kind !== filterKind) {
      return false;
    }
    if (filterOwner !== 'all' && entity.owner !== filterOwner) {
      return false;
    }
    return true;
  });

  const uniqueKinds = Array.from(new Set(entities.map(e => e.kind)));
  const uniqueOwners = Array.from(new Set(entities.map(e => e.owner).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BookOpen className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Documentation
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching technical documentation...
          </p>
        </div>
      </div>
    );
  }

  if (selectedEntity) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 border-r bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <TechDocsSidebar
              entity={selectedEntity}
              onNavigate={(path) => {
                // Handle navigation
                console.log('Navigate to:', path);
              }}
              onClose={() => setSelectedEntity(null)}
            />
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b px-6 py-3">
            <div className="flex items-center justify-between">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedEntity(null);
                      }}
                    >
                      <Home className="h-4 w-4" />
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedEntity(null);
                      }}
                    >
                      TechDocs
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedEntity.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStar(selectedEntity.id)}
                >
                  <Star className={cn(
                    "h-4 w-4",
                    starredDocs.includes(selectedEntity.id) && "fill-yellow-500 text-yellow-500"
                  )} />
                </Button>
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <TechDocsViewer
              entity={selectedEntity}
              path={docPath || 'index.md'}
              theme={theme}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <BookOpen className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">TechDocs</h1>
              <Badge className="ml-3 bg-white/20 text-white">
                {entities.length} Documents
              </Badge>
            </div>
            <p className="text-xl text-blue-100">
              Software documentation for all your services and components
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Add Documentation
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <FileText className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{entities.length}</div>
                <div className="text-sm text-blue-100">Total Docs</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Eye className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {entities.reduce((sum, e) => sum + (e.stats?.views || 0), 0)}
                </div>
                <div className="text-sm text-blue-100">Total Views</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Star className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{starredDocs.length}</div>
                <div className="text-sm text-blue-100">Starred</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{recentDocs.length}</div>
                <div className="text-sm text-blue-100">Recent</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
          </TabsList>
          
          {activeTab === 'browse' && (
            <div className="flex items-center gap-2">
              <TechDocsSearch
                onSearch={setSearchQuery}
                placeholder="Search documentation..."
              />
              
              <Select value={filterKind} onValueChange={setFilterKind}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by kind" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Kinds</SelectItem>
                  {uniqueKinds.map(kind => (
                    <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {uniqueOwners.map(owner => (
                    <SelectItem key={owner} value={owner!}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex rounded-lg border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <TabsContent value="browse">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntities.map(entity => (
                <Card
                  key={entity.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedEntity(entity)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {entity.kind === 'Component' ? <Package className="h-5 w-5" /> :
                         entity.kind === 'API' ? <Cloud className="h-5 w-5" /> :
                         entity.kind === 'Documentation' ? <BookOpen className="h-5 w-5" /> :
                         <FileText className="h-5 w-5" />}
                        <CardTitle className="text-lg">{entity.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(entity.id);
                        }}
                      >
                        <Star className={cn(
                          "h-4 w-4",
                          starredDocs.includes(entity.id) && "fill-yellow-500 text-yellow-500"
                        )} />
                      </Button>
                    </div>
                    <CardDescription>{entity.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Owner</span>
                        <Badge variant="outline">{entity.owner || 'Unknown'}</Badge>
                      </div>
                      
                      {entity.metadata && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Version</span>
                            <span>{entity.metadata.version}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Updated</span>
                            <span>
                              {entity.metadata.lastUpdated
                                ? new Date(entity.metadata.lastUpdated).toLocaleDateString()
                                : 'Unknown'}
                            </span>
                          </div>
                        </>
                      )}
                      
                      {entity.stats && (
                        <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {entity.stats.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {entity.stats.stars}
                          </span>
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {entity.stats.contributors}
                          </span>
                        </div>
                      )}
                      
                      {entity.tags && entity.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {entity.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntities.map(entity => (
                <Card
                  key={entity.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedEntity(entity)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          {entity.kind === 'Component' ? <Package className="h-5 w-5" /> :
                           entity.kind === 'API' ? <Cloud className="h-5 w-5" /> :
                           entity.kind === 'Documentation' ? <BookOpen className="h-5 w-5" /> :
                           <FileText className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{entity.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {entity.kind}
                            </Badge>
                            {entity.metadata?.version && (
                              <Badge variant="secondary" className="text-xs">
                                v{entity.metadata.version}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entity.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{entity.owner || 'No owner'}</span>
                            {entity.metadata?.lastUpdated && (
                              <>
                                <span>•</span>
                                <span>Updated {new Date(entity.metadata.lastUpdated).toLocaleDateString()}</span>
                              </>
                            )}
                            {entity.stats && (
                              <>
                                <span>•</span>
                                <span>{entity.stats.views} views</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {entity.stats && (
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mr-4">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {entity.stats.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {entity.stats.stars}
                            </span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(entity.id);
                          }}
                        >
                          <Star className={cn(
                            "h-4 w-4",
                            starredDocs.includes(entity.id) && "fill-yellow-500 text-yellow-500"
                          )} />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent">
          {recentDocs.length > 0 ? (
            <div className="space-y-2">
              {recentDocs.map(({ entity, viewedAt }) => (
                <Card
                  key={entity.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedEntity(entity)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold">{entity.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Viewed {new Date(viewedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Recent Documents</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Documents you view will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="starred">
          {starredDocs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities
                .filter(e => starredDocs.includes(e.id))
                .map(entity => (
                  <Card
                    key={entity.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedEntity(entity)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{entity.name}</CardTitle>
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      </div>
                      <CardDescription>{entity.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Starred Documents</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Star documents to quickly access them here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TechDocsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BookOpen className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Documentation
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Loading page...
          </p>
        </div>
      </div>
    }>
      <TechDocsContent />
    </Suspense>
  );
}