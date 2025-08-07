'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  User,
  Building,
  Shield,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart,
  PieChart,
  GitBranch,
  Package,
  Database,
  Cloud,
  Code,
  Settings,
  Eye,
  Download,
  Filter,
  Search,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Mail,
  MessageSquare,
  Phone,
  Loader2,
  UserCheck,
  UserX,
  AlertCircle,
  Hash,
  Layers,
  Target,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface OwnershipMatrixProps {
  entities: Entity[];
  onEntityClick?: (entity: Entity) => void;
  onOwnerClick?: (owner: string) => void;
  className?: string;
}

interface Owner {
  id: string;
  name: string;
  email?: string;
  type: 'team' | 'user' | 'group';
  department?: string;
  entities: Entity[];
  metrics: {
    totalEntities: number;
    components: number;
    apis: number;
    resources: number;
    systems: number;
    healthScore: number;
    incidents: number;
    sla: number;
    coverage: number;
  };
  responsibilities: string[];
  contacts?: {
    slack?: string;
    pagerduty?: string;
    github?: string;
  };
}

interface OwnershipCell {
  owner: string;
  entity: string;
  role: 'owner' | 'maintainer' | 'contributor' | 'viewer';
  since?: string;
  active: boolean;
}

interface OwnershipStats {
  totalOwners: number;
  totalEntities: number;
  orphanedEntities: number;
  sharedOwnership: number;
  avgEntitiesPerOwner: number;
  topOwners: { owner: string; count: number }[];
  ownershipCoverage: number;
  recentChanges: {
    entity: string;
    previousOwner: string;
    newOwner: string;
    date: string;
  }[];
}

const ROLE_COLORS = {
  owner: 'bg-blue-500',
  maintainer: 'bg-green-500',
  contributor: 'bg-yellow-500',
  viewer: 'bg-gray-500',
};

const ROLE_BADGES = {
  owner: { variant: 'default' as const, label: 'Owner' },
  maintainer: { variant: 'secondary' as const, label: 'Maintainer' },
  contributor: { variant: 'outline' as const, label: 'Contributor' },
  viewer: { variant: 'ghost' as const, label: 'Viewer' },
};

export function OwnershipMatrix({
  entities,
  onEntityClick,
  onOwnerClick,
  className,
}: OwnershipMatrixProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownershipCells, setOwnershipCells] = useState<OwnershipCell[]>([]);
  const [stats, setStats] = useState<OwnershipStats | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'tree' | 'list' | 'stats'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'entities' | 'health'>('name');
  const [showOnlyOrphaned, setShowOnlyOrphaned] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract ownership data from entities
  useEffect(() => {
    const extractOwnership = () => {
      setLoading(true);
      
      const ownerMap = new Map<string, Owner>();
      const cells: OwnershipCell[] = [];
      const orphaned: Entity[] = [];
      const shared: Entity[] = [];
      
      // Process entities to extract owners
      entities.forEach(entity => {
        const ownerName = entity.spec?.owner || entity.metadata.annotations?.['backstage.io/owner'];
        
        if (!ownerName) {
          orphaned.push(entity);
          return;
        }
        
        // Get or create owner
        if (!ownerMap.has(ownerName)) {
          ownerMap.set(ownerName, {
            id: ownerName,
            name: ownerName,
            type: ownerName.includes('team:') ? 'team' : 
                  ownerName.includes('group:') ? 'group' : 'user',
            entities: [],
            metrics: {
              totalEntities: 0,
              components: 0,
              apis: 0,
              resources: 0,
              systems: 0,
              healthScore: 90 + Math.random() * 10,
              incidents: Math.floor(Math.random() * 5),
              sla: 95 + Math.random() * 5,
              coverage: 80 + Math.random() * 20,
            },
            responsibilities: [],
          });
        }
        
        const owner = ownerMap.get(ownerName)!;
        owner.entities.push(entity);
        
        // Update metrics
        owner.metrics.totalEntities++;
        switch (entity.kind) {
          case 'Component':
            owner.metrics.components++;
            break;
          case 'API':
            owner.metrics.apis++;
            break;
          case 'Resource':
            owner.metrics.resources++;
            break;
          case 'System':
            owner.metrics.systems++;
            break;
        }
        
        // Create ownership cell
        cells.push({
          owner: ownerName,
          entity: entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`,
          role: 'owner',
          since: entity.metadata.annotations?.['backstage.io/ownership-since'],
          active: true,
        });
        
        // Check for maintainers
        const maintainers = entity.metadata.annotations?.['backstage.io/maintainers'];
        if (maintainers) {
          maintainers.split(',').forEach((maintainer: string) => {
            const maintainerName = maintainer.trim();
            if (!ownerMap.has(maintainerName)) {
              ownerMap.set(maintainerName, {
                id: maintainerName,
                name: maintainerName,
                type: 'user',
                entities: [],
                metrics: {
                  totalEntities: 0,
                  components: 0,
                  apis: 0,
                  resources: 0,
                  systems: 0,
                  healthScore: 85 + Math.random() * 15,
                  incidents: 0,
                  sla: 99,
                  coverage: 90,
                },
                responsibilities: [],
              });
            }
            
            cells.push({
              owner: maintainerName,
              entity: entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`,
              role: 'maintainer',
              active: true,
            });
            
            shared.push(entity);
          });
        }
      });
      
      // Calculate stats
      const ownersArray = Array.from(ownerMap.values());
      const topOwners = ownersArray
        .sort((a, b) => b.metrics.totalEntities - a.metrics.totalEntities)
        .slice(0, 5)
        .map(o => ({ owner: o.name, count: o.metrics.totalEntities }));
      
      const statsData: OwnershipStats = {
        totalOwners: ownersArray.length,
        totalEntities: entities.length,
        orphanedEntities: orphaned.length,
        sharedOwnership: shared.length,
        avgEntitiesPerOwner: entities.length / Math.max(1, ownersArray.length),
        topOwners,
        ownershipCoverage: ((entities.length - orphaned.length) / entities.length) * 100,
        recentChanges: [
          {
            entity: 'user-service',
            previousOwner: 'team:platform',
            newOwner: 'team:backend',
            date: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            entity: 'auth-api',
            previousOwner: 'john.doe',
            newOwner: 'team:security',
            date: new Date(Date.now() - 172800000).toISOString(),
          },
        ],
      };
      
      setOwners(ownersArray);
      setOwnershipCells(cells);
      setStats(statsData);
      setLoading(false);
    };
    
    extractOwnership();
  }, [entities]);

  // Filter and sort owners
  const filteredOwners = useMemo(() => {
    let filtered = owners;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(owner =>
        owner.name.toLowerCase().includes(query) ||
        owner.entities.some(e => e.metadata.name.toLowerCase().includes(query))
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(owner => owner.type === filterType);
    }
    
    if (showOnlyOrphaned) {
      // Show owners with entities that have no clear ownership
      filtered = filtered.filter(owner => 
        owner.entities.some(e => !e.spec?.owner)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'entities':
          return b.metrics.totalEntities - a.metrics.totalEntities;
        case 'health':
          return b.metrics.healthScore - a.metrics.healthScore;
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    return filtered;
  }, [owners, searchQuery, filterType, showOnlyOrphaned, sortBy]);

  // Filter entities
  const filteredEntities = useMemo(() => {
    let filtered = entities;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entity =>
        entity.metadata.name.toLowerCase().includes(query) ||
        entity.kind.toLowerCase().includes(query)
      );
    }
    
    if (showOnlyOrphaned) {
      filtered = filtered.filter(entity => !entity.spec?.owner);
    }
    
    return filtered;
  }, [entities, searchQuery, showOnlyOrphaned]);

  // Handle owner click
  const handleOwnerClick = (owner: Owner) => {
    setSelectedOwner(owner);
    if (onOwnerClick) {
      onOwnerClick(owner.name);
    }
  };

  // Handle entity click
  const handleEntityClick = (entity: Entity) => {
    setSelectedEntity(entity);
    if (onEntityClick) {
      onEntityClick(entity);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Owners</p>
                  <p className="text-2xl font-bold">{stats.totalOwners}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <p className="text-2xl font-bold">{stats.ownershipCoverage.toFixed(0)}%</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Orphaned</p>
                  <p className="text-2xl font-bold text-red-600">{stats.orphanedEntities}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Shared</p>
                  <p className="text-2xl font-bold">{stats.sharedOwnership}</p>
                </div>
                <GitBranch className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search owners or entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* View mode */}
              <div className="flex rounded-lg border">
                {(['matrix', 'tree', 'list', 'stats'] as const).map(mode => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                    className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter by type */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="team">Teams</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="group">Groups</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="entities">Entities</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                </SelectContent>
              </Select>

              {/* Show orphaned */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={showOnlyOrphaned}
                  onCheckedChange={setShowOnlyOrphaned}
                />
                <Label className="text-sm">Orphaned Only</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content based on view mode */}
      {viewMode === 'matrix' && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Matrix</CardTitle>
            <CardDescription>
              Visual representation of entity ownership across teams and individuals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 text-left sticky left-0 bg-white dark:bg-gray-800">
                      Owner / Entity
                    </th>
                    {filteredEntities.slice(0, 10).map(entity => (
                      <th
                        key={entity.metadata.uid}
                        className="border p-2 text-xs text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => handleEntityClick(entity)}
                      >
                        <div className="writing-mode-vertical">
                          {entity.metadata.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOwners.map(owner => (
                    <tr key={owner.id}>
                      <td
                        className="border p-2 sticky left-0 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => handleOwnerClick(owner)}
                      >
                        <div className="flex items-center gap-2">
                          {owner.type === 'team' ? (
                            <Users className="h-4 w-4" />
                          ) : owner.type === 'group' ? (
                            <Building className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">{owner.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {owner.metrics.totalEntities}
                          </Badge>
                        </div>
                      </td>
                      {filteredEntities.slice(0, 10).map(entity => {
                        const cell = ownershipCells.find(
                          c => c.owner === owner.name && 
                               (c.entity === entity.metadata.uid || 
                                c.entity === `${entity.kind}-${entity.metadata.name}`)
                        );
                        
                        return (
                          <td
                            key={entity.metadata.uid}
                            className="border p-1 text-center"
                          >
                            {cell && (
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full mx-auto flex items-center justify-center",
                                  ROLE_COLORS[cell.role],
                                  "text-white text-xs font-bold cursor-pointer",
                                  "hover:scale-110 transition-transform"
                                )}
                                title={`${cell.role} since ${cell.since || 'unknown'}`}
                              >
                                {cell.role[0].toUpperCase()}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              {Object.entries(ROLE_COLORS).map(([role, color]) => (
                <div key={role} className="flex items-center gap-2">
                  <div className={cn("w-4 h-4 rounded-full", color)} />
                  <span className="text-sm capitalize">{role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'tree' && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Tree</CardTitle>
            <CardDescription>
              Hierarchical view of ownership relationships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredOwners.map(owner => (
                <div key={owner.id} className="border rounded-lg p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => handleOwnerClick(owner)}
                  >
                    <div className="flex items-center gap-3">
                      {owner.type === 'team' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                      <div>
                        <div className="font-medium">{owner.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {owner.type} • {owner.metrics.totalEntities} entities
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={owner.metrics.healthScore > 90 ? 'default' : 'secondary'}>
                        {owner.metrics.healthScore.toFixed(0)}% health
                      </Badge>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  
                  {selectedOwner?.id === owner.id && (
                    <div className="mt-4 pl-8 space-y-2">
                      {owner.entities.slice(0, 5).map(entity => (
                        <div
                          key={entity.metadata.uid}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={() => handleEntityClick(entity)}
                        >
                          <div className="flex items-center gap-2">
                            {entity.kind === 'Component' ? <Package className="h-4 w-4" /> :
                             entity.kind === 'API' ? <Cloud className="h-4 w-4" /> :
                             entity.kind === 'Resource' ? <Database className="h-4 w-4" /> :
                             <Layers className="h-4 w-4" />}
                            <span className="text-sm">{entity.metadata.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {entity.kind}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {owner.entities.length > 5 && (
                        <div className="text-sm text-muted-foreground pl-6">
                          +{owner.entities.length - 5} more entities
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership List</CardTitle>
            <CardDescription>
              Detailed list of owners and their responsibilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredOwners.map(owner => (
                <div
                  key={owner.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOwnerClick(owner)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        {owner.type === 'team' ? (
                          <Users className="h-6 w-6" />
                        ) : owner.type === 'group' ? (
                          <Building className="h-6 w-6" />
                        ) : (
                          <User className="h-6 w-6" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold">{owner.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {owner.type} • {owner.department || 'Engineering'}
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div>
                            <span className="text-xs text-muted-foreground">Entities</span>
                            <p className="text-sm font-medium">{owner.metrics.totalEntities}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Health</span>
                            <p className="text-sm font-medium">{owner.metrics.healthScore.toFixed(0)}%</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">SLA</span>
                            <p className="text-sm font-medium">{owner.metrics.sla.toFixed(1)}%</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Incidents</span>
                            <p className="text-sm font-medium">{owner.metrics.incidents}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            {owner.metrics.components} Components
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {owner.metrics.apis} APIs
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {owner.metrics.resources} Resources
                          </Badge>
                          {owner.metrics.systems > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {owner.metrics.systems} Systems
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {owner.contacts?.slack && (
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      {owner.email && (
                        <Button variant="ghost" size="icon">
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'stats' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Owners */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Owners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topOwners.map((item, idx) => (
                  <div key={item.owner} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </div>
                      <span className="font-medium">{item.owner}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{item.count} entities</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(item.count / entities.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Ownership Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentChanges.map((change, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{change.entity}</div>
                      <div className="text-xs text-muted-foreground">
                        {change.previousOwner} → {change.newOwner}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(change.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ownership Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ownership Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Coverage</span>
                    <span className="text-sm font-medium">{stats.ownershipCoverage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${stats.ownershipCoverage}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Shared Ownership</span>
                    <span className="text-sm font-medium">
                      {((stats.sharedOwnership / entities.length) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(stats.sharedOwnership / entities.length) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Orphaned Entities</span>
                    <span className="text-sm font-medium text-red-600">
                      {stats.orphanedEntities}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(stats.orphanedEntities / entities.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Component', 'API', 'Resource', 'System'].map(kind => {
                  const count = entities.filter(e => e.kind === kind).length;
                  const percentage = (count / entities.length) * 100;
                  
                  return (
                    <div key={kind} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {kind === 'Component' ? <Package className="h-4 w-4" /> :
                         kind === 'API' ? <Cloud className="h-4 w-4" /> :
                         kind === 'Resource' ? <Database className="h-4 w-4" /> :
                         <Layers className="h-4 w-4" />}
                        <span className="text-sm">{kind}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{count}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default OwnershipMatrix;