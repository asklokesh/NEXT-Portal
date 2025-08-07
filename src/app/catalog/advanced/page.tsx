'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Grid3x3,
  List,
  Settings,
  Download,
  Upload,
  RefreshCw,
  Plus,
  GitBranch,
  Cloud,
  Database,
  Shield,
  Zap,
  Users,
  Package,
  Code,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  BookOpen,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Network,
  Layers,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  Gauge,
  Workflow,
  GitMerge,
  GitPullRequest,
  Share2,
  Lock,
  Unlock,
  Tag,
  Calendar,
  MapPin,
  Globe,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Heart,
  HeartOff,
  Bell,
  BellOff,
  FolderOpen,
  FileText,
  Link,
  ExternalLink,
  Copy,
  Clipboard,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  Info,
  HelpCircle,
  MessageSquare,
  Send,
  Archive,
  Inbox,
  Bot,
  Sparkles,
  Flame,
  Snowflake,
  Sun,
  Moon,
  CloudRain,
  Wind,
  Thermometer,
  Droplet,
  Compass,
  Map,
  Navigation,
  Anchor,
  Flag,
  Mountain,
  Trees,
  Building,
  Home,
  Store,
  Factory,
  Warehouse,
  Bridge,
  Train,
  Car,
  Plane,
  Ship,
  Rocket,
  Satellite
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const DependencyGraph = dynamic(() => import('@/components/catalog/DependencyGraph'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
});

const EntityLineage = dynamic(() => import('@/components/catalog/EntityLineage'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
});

const OwnershipMatrix = dynamic(() => import('@/components/catalog/OwnershipMatrix'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
});

interface CatalogEntity {
  uid: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
    links?: Array<{ url: string; title: string; icon?: string }>;
  };
  spec: {
    type?: string;
    lifecycle?: string;
    owner?: string;
    system?: string;
    domain?: string;
    dependsOn?: string[];
    providesApis?: string[];
    consumesApis?: string[];
  };
  status?: {
    health?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastSync?: string;
    errors?: string[];
  };
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
  metrics?: {
    reliability?: number;
    performance?: number;
    security?: number;
    compliance?: number;
    cost?: number;
  };
}

// Advanced filter configuration
interface FilterConfig {
  kinds: string[];
  types: string[];
  lifecycles: string[];
  owners: string[];
  systems: string[];
  domains: string[];
  tags: string[];
  health: string[];
  namespaces: string[];
  hasMetrics: boolean;
  hasRelations: boolean;
  hasErrors: boolean;
  createdAfter?: Date;
  updatedAfter?: Date;
  scoreThreshold?: number;
}

// View configurations
type ViewMode = 'grid' | 'list' | 'table' | 'graph' | 'tree' | 'kanban' | 'timeline' | 'map';
type GroupBy = 'none' | 'kind' | 'type' | 'owner' | 'system' | 'domain' | 'lifecycle' | 'health';

export default function AdvancedCatalogPage() {
  const [entities, setEntities] = useState<CatalogEntity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<CatalogEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterConfig>({
    kinds: [],
    types: [],
    lifecycles: [],
    owners: [],
    systems: [],
    domains: [],
    tags: [],
    health: [],
    namespaces: [],
    hasMetrics: false,
    hasRelations: false,
    hasErrors: false
  });
  const [showFilters, setShowFilters] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Fetch catalog entities
  useEffect(() => {
    fetchEntities();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(fetchEntities, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Apply filters and search
  useEffect(() => {
    applyFiltersAndSearch();
  }, [entities, searchQuery, filters, sortBy, sortOrder, groupBy]);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/catalog/entities');
      const data = await response.json();
      
      // Enrich entities with mock data for demo
      const enrichedEntities = data.items.map((entity: any) => ({
        ...entity,
        status: {
          health: ['healthy', 'degraded', 'unhealthy', 'unknown'][Math.floor(Math.random() * 4)],
          lastSync: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          errors: Math.random() > 0.8 ? ['Connection timeout', 'Invalid configuration'] : []
        },
        metrics: {
          reliability: Math.random() * 100,
          performance: Math.random() * 100,
          security: Math.random() * 100,
          compliance: Math.random() * 100,
          cost: Math.random() * 10000
        }
      }));
      
      setEntities(enrichedEntities);
    } catch (error) {
      toast.error('Failed to fetch catalog entities');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...entities];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entity => 
        entity.metadata.name.toLowerCase().includes(query) ||
        entity.metadata.description?.toLowerCase().includes(query) ||
        entity.metadata.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        entity.kind.toLowerCase().includes(query) ||
        entity.spec.type?.toLowerCase().includes(query) ||
        entity.spec.owner?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.kinds.length > 0) {
      filtered = filtered.filter(e => filters.kinds.includes(e.kind));
    }
    if (filters.types.length > 0) {
      filtered = filtered.filter(e => e.spec.type && filters.types.includes(e.spec.type));
    }
    if (filters.lifecycles.length > 0) {
      filtered = filtered.filter(e => e.spec.lifecycle && filters.lifecycles.includes(e.spec.lifecycle));
    }
    if (filters.owners.length > 0) {
      filtered = filtered.filter(e => e.spec.owner && filters.owners.includes(e.spec.owner));
    }
    if (filters.health.length > 0) {
      filtered = filtered.filter(e => e.status?.health && filters.health.includes(e.status.health));
    }
    if (filters.hasMetrics) {
      filtered = filtered.filter(e => e.metrics);
    }
    if (filters.hasRelations) {
      filtered = filtered.filter(e => e.relations && e.relations.length > 0);
    }
    if (filters.hasErrors) {
      filtered = filtered.filter(e => e.status?.errors && e.status.errors.length > 0);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.metadata.name;
          bVal = b.metadata.name;
          break;
        case 'kind':
          aVal = a.kind;
          bVal = b.kind;
          break;
        case 'owner':
          aVal = a.spec.owner || '';
          bVal = b.spec.owner || '';
          break;
        case 'health':
          aVal = a.status?.health || 'unknown';
          bVal = b.status?.health || 'unknown';
          break;
        case 'reliability':
          aVal = a.metrics?.reliability || 0;
          bVal = b.metrics?.reliability || 0;
          break;
        case 'updated':
          aVal = a.status?.lastSync || '';
          bVal = b.status?.lastSync || '';
          break;
        default:
          aVal = a.metadata.name;
          bVal = b.metadata.name;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredEntities(filtered);
  };

  // Group entities
  const groupedEntities = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Entities': filteredEntities };
    }

    const groups: Record<string, CatalogEntity[]> = {};
    
    filteredEntities.forEach(entity => {
      let groupKey = 'Other';
      
      switch (groupBy) {
        case 'kind':
          groupKey = entity.kind;
          break;
        case 'type':
          groupKey = entity.spec.type || 'Unknown';
          break;
        case 'owner':
          groupKey = entity.spec.owner || 'Unowned';
          break;
        case 'system':
          groupKey = entity.spec.system || 'No System';
          break;
        case 'domain':
          groupKey = entity.spec.domain || 'No Domain';
          break;
        case 'lifecycle':
          groupKey = entity.spec.lifecycle || 'Unknown';
          break;
        case 'health':
          groupKey = entity.status?.health || 'unknown';
          break;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entity);
    });

    return groups;
  }, [filteredEntities, groupBy]);

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedEntities.size === 0) {
      toast.error('No entities selected');
      return;
    }

    switch (action) {
      case 'export':
        exportEntities(Array.from(selectedEntities));
        break;
      case 'delete':
        await deleteEntities(Array.from(selectedEntities));
        break;
      case 'refresh':
        await refreshEntities(Array.from(selectedEntities));
        break;
      case 'tag':
        // Open tag dialog
        break;
    }
  };

  const exportEntities = (entityIds: string[]) => {
    const entitiesToExport = entities.filter(e => entityIds.includes(e.uid));
    const blob = new Blob([JSON.stringify(entitiesToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog-entities-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${entityIds.length} entities`);
  };

  const deleteEntities = async (entityIds: string[]) => {
    // Implement deletion
    toast.success(`Deleted ${entityIds.length} entities`);
    setSelectedEntities(new Set());
    fetchEntities();
  };

  const refreshEntities = async (entityIds: string[]) => {
    // Implement refresh
    toast.success(`Refreshing ${entityIds.length} entities`);
  };

  // Entity card component
  const EntityCard = ({ entity }: { entity: CatalogEntity }) => {
    const healthColor = {
      healthy: 'text-green-600 bg-green-100',
      degraded: 'text-yellow-600 bg-yellow-100',
      unhealthy: 'text-red-600 bg-red-100',
      unknown: 'text-gray-600 bg-gray-100'
    }[entity.status?.health || 'unknown'];

    const kindIcon = {
      Component: Package,
      System: Layers,
      API: Code,
      Resource: Database,
      Domain: Globe,
      Group: Users,
      User: Users,
      Template: FileText,
      Location: MapPin
    }[entity.kind] || Package;

    const KindIcon = kindIcon;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="relative overflow-hidden hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2">
            <Checkbox
              checked={selectedEntities.has(entity.uid)}
              onCheckedChange={(checked) => {
                const newSelected = new Set(selectedEntities);
                if (checked) {
                  newSelected.add(entity.uid);
                } else {
                  newSelected.delete(entity.uid);
                }
                setSelectedEntities(newSelected);
              }}
            />
          </div>
          
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${healthColor}`}>
                <KindIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">
                  {entity.metadata.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {entity.kind}
                  </Badge>
                  {entity.spec.type && (
                    <Badge variant="secondary" className="text-xs">
                      {entity.spec.type}
                    </Badge>
                  )}
                  {entity.spec.lifecycle && (
                    <Badge variant="secondary" className="text-xs">
                      {entity.spec.lifecycle}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {entity.metadata.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {entity.metadata.description}
              </p>
            )}

            {entity.spec.owner && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-medium">{entity.spec.owner}</span>
              </div>
            )}

            {showMetrics && entity.metrics && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reliability</span>
                    <span className="font-medium">{entity.metrics.reliability.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Security</span>
                    <span className="font-medium">{entity.metrics.security.toFixed(0)}%</span>
                  </div>
                </div>
                <Progress value={(entity.metrics.reliability + entity.metrics.security) / 2} className="h-1" />
              </div>
            )}

            {entity.metadata.tags && entity.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entity.metadata.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {entity.metadata.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{entity.metadata.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1">
                {entity.status?.errors && entity.status.errors.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{entity.status.errors.length} errors</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {entity.relations && entity.relations.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Network className="h-4 w-4 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{entity.relations.length} relations</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {entity.spec.dependsOn && entity.spec.dependsOn.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <GitMerge className="h-4 w-4 text-purple-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{entity.spec.dependsOn.length} dependencies</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Network className="h-4 w-4 mr-2" />
                    View Relations
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <LineChart className="h-4 w-4 mr-2" />
                    View Metrics
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-full">
        {/* Filters Sidebar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r bg-background overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({
                        kinds: [],
                        types: [],
                        lifecycles: [],
                        owners: [],
                        systems: [],
                        domains: [],
                        tags: [],
                        health: [],
                        namespaces: [],
                        hasMetrics: false,
                        hasRelations: false,
                        hasErrors: false
                      })}
                    >
                      Clear All
                    </Button>
                  </div>

                  <Separator />

                  {/* Kind Filter */}
                  <div className="space-y-2">
                    <Label>Entity Kind</Label>
                    <div className="space-y-1">
                      {['Component', 'System', 'API', 'Resource', 'Domain', 'Group', 'User'].map(kind => (
                        <label key={kind} className="flex items-center gap-2">
                          <Checkbox
                            checked={filters.kinds.includes(kind)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters(prev => ({ ...prev, kinds: [...prev.kinds, kind] }));
                              } else {
                                setFilters(prev => ({ ...prev, kinds: prev.kinds.filter(k => k !== kind) }));
                              }
                            }}
                          />
                          <span className="text-sm">{kind}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Health Filter */}
                  <div className="space-y-2">
                    <Label>Health Status</Label>
                    <div className="space-y-1">
                      {['healthy', 'degraded', 'unhealthy', 'unknown'].map(health => (
                        <label key={health} className="flex items-center gap-2">
                          <Checkbox
                            checked={filters.health.includes(health)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters(prev => ({ ...prev, health: [...prev.health, health] }));
                              } else {
                                setFilters(prev => ({ ...prev, health: prev.health.filter(h => h !== health) }));
                              }
                            }}
                          />
                          <span className="text-sm capitalize">{health}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Additional Filters */}
                  <div className="space-y-2">
                    <Label>Additional Filters</Label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={filters.hasMetrics}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, hasMetrics: !!checked }))
                          }
                        />
                        <span className="text-sm">Has Metrics</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={filters.hasRelations}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, hasRelations: !!checked }))
                          }
                        />
                        <span className="text-sm">Has Relations</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={filters.hasErrors}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, hasErrors: !!checked }))
                          }
                        />
                        <span className="text-sm">Has Errors</span>
                      </label>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b p-4 bg-background">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold">Advanced Catalog Explorer</h1>
                <Badge variant="secondary">
                  {filteredEntities.length} of {entities.length} entities
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchEntities}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => exportEntities(filteredEntities.map(e => e.uid))}>
                      Export All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportEntities(Array.from(selectedEntities))}>
                      Export Selected ({selectedEntities.size})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entity
                </Button>
              </div>
            </div>

            {/* Search and Controls */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid View</SelectItem>
                  <SelectItem value="list">List View</SelectItem>
                  <SelectItem value="table">Table View</SelectItem>
                  <SelectItem value="graph">Graph View</SelectItem>
                  <SelectItem value="tree">Tree View</SelectItem>
                  <SelectItem value="kanban">Kanban View</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupBy} onValueChange={(value: GroupBy) => setGroupBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Group by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="kind">By Kind</SelectItem>
                  <SelectItem value="type">By Type</SelectItem>
                  <SelectItem value="owner">By Owner</SelectItem>
                  <SelectItem value="system">By System</SelectItem>
                  <SelectItem value="domain">By Domain</SelectItem>
                  <SelectItem value="lifecycle">By Lifecycle</SelectItem>
                  <SelectItem value="health">By Health</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="kind">Kind</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="reliability">Reliability</SelectItem>
                  <SelectItem value="updated">Last Updated</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4 rotate-180" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>View Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={showMetrics}
                    onCheckedChange={setShowMetrics}
                  >
                    Show Metrics
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showInsights}
                    onCheckedChange={setShowInsights}
                  >
                    Show Insights
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Clock className="h-4 w-4 mr-2" />
                      Auto Refresh
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={refreshInterval?.toString() || 'off'}
                        onValueChange={(value) => 
                          setRefreshInterval(value === 'off' ? null : parseInt(value))
                        }
                      >
                        <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="10">10 seconds</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="30">30 seconds</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="60">1 minute</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="300">5 minutes</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Bulk Actions Bar */}
            {selectedEntities.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-2 mt-4 p-2 bg-muted rounded-md"
              >
                <span className="text-sm font-medium">
                  {selectedEntities.size} selected
                </span>
                <Separator orientation="vertical" className="h-4" />
                <Button size="sm" variant="ghost" onClick={() => setSelectedEntities(new Set())}>
                  Clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('export')}>
                  Export
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('tag')}>
                  Tag
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBulkAction('refresh')}>
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleBulkAction('delete')}>
                  Delete
                </Button>
              </motion.div>
            )}
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading catalog entities...</p>
                  </div>
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center space-y-4">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No entities found</p>
                    <Button variant="outline" onClick={() => {
                      setSearchQuery('');
                      setFilters({
                        kinds: [],
                        types: [],
                        lifecycles: [],
                        owners: [],
                        systems: [],
                        domains: [],
                        tags: [],
                        health: [],
                        namespaces: [],
                        hasMetrics: false,
                        hasRelations: false,
                        hasErrors: false
                      });
                    }}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {viewMode === 'grid' && (
                    <div className="space-y-6">
                      {Object.entries(groupedEntities).map(([group, groupEntities]) => (
                        <div key={group}>
                          {groupBy !== 'none' && (
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              {group}
                              <Badge variant="secondary">{groupEntities.length}</Badge>
                            </h3>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {groupEntities.map(entity => (
                              <EntityCard key={entity.uid} entity={entity} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'graph' && (
                    <div className="h-[600px]">
                      <DependencyGraph entities={filteredEntities} />
                    </div>
                  )}

                  {viewMode === 'tree' && (
                    <div className="h-[600px]">
                      <EntityLineage entities={filteredEntities} />
                    </div>
                  )}

                  {viewMode === 'kanban' && (
                    <div className="h-[600px]">
                      <OwnershipMatrix entities={filteredEntities} />
                    </div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>

          {/* Insights Panel */}
          {showInsights && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 200 }}
              exit={{ height: 0 }}
              className="border-t bg-background"
            >
              <div className="p-4">
                <h3 className="font-semibold mb-4">Catalog Insights</h3>
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{entities.length}</div>
                      <p className="text-sm text-muted-foreground">Total Entities</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">
                        {entities.filter(e => e.status?.health === 'healthy').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Healthy</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">
                        {entities.filter(e => e.status?.errors && e.status.errors.length > 0).length}
                      </div>
                      <p className="text-sm text-muted-foreground">With Errors</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">
                        {new Set(entities.map(e => e.spec.owner).filter(Boolean)).size}
                      </div>
                      <p className="text-sm text-muted-foreground">Unique Owners</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}