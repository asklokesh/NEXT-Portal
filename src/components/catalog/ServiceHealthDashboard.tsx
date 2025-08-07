'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  Cloud,
  Code,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Globe,
  Heart,
  Info,
  Layers,
  LineChart,
  Loader2,
  Minus,
  Package,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  AlertOctagon,
  Timer,
  Cpu,
  HardDrive,
  Network,
  Bug,
  TestTube,
  BookOpen,
  Rocket,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';
import { 
  ServiceHealthMonitor, 
  ServiceHealth, 
  ServiceQuality,
  HealthIndicator,
  QualityRecommendation,
  DependencyHealth,
} from '@/lib/health/ServiceHealthMonitor';
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ServiceHealthDashboardProps {
  entities: Entity[];
  className?: string;
}

interface HealthSummary {
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
}

const STATUS_COLORS = {
  healthy: '#10B981',
  degraded: '#F59E0B',
  unhealthy: '#EF4444',
  unknown: '#6B7280',
};

const GRADE_COLORS = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#F59E0B',
  D: '#F97316',
  F: '#EF4444',
};

const CATEGORY_ICONS = {
  performance: Zap,
  reliability: Shield,
  security: ShieldCheck,
  compliance: FileText,
  cost: Cloud,
};

export function ServiceHealthDashboard({ entities, className }: ServiceHealthDashboardProps) {
  const [monitor] = useState(() => new ServiceHealthMonitor());
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
  const [serviceQuality, setServiceQuality] = useState<ServiceQuality | null>(null);
  const [fleetHealth, setFleetHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(60000); // 1 minute
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'health' | 'quality'>('health');

  // Load fleet health on mount
  useEffect(() => {
    loadFleetHealth();
  }, [entities]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadFleetHealth();
      if (selectedEntity) {
        loadServiceDetails(selectedEntity);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, selectedEntity]);

  const loadFleetHealth = async () => {
    setIsLoading(true);
    try {
      const health = await monitor.getFleetHealth(entities);
      setFleetHealth(health);
    } catch (error) {
      console.error('Failed to load fleet health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadServiceDetails = async (entity: Entity) => {
    setIsLoading(true);
    try {
      const [health, quality] = await Promise.all([
        monitor.getServiceHealth(entity),
        monitor.getServiceQuality(entity),
      ]);
      setServiceHealth(health);
      setServiceQuality(quality);
    } catch (error) {
      console.error('Failed to load service details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntitySelect = (entity: Entity) => {
    setSelectedEntity(entity);
    loadServiceDetails(entity);
  };

  // Filter and sort entities
  const processedEntities = useMemo(() => {
    if (!fleetHealth) return [];

    let results = entities;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(entity => 
        entity.metadata.name.toLowerCase().includes(query) ||
        entity.kind.toLowerCase().includes(query) ||
        entity.metadata.description?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all' && fleetHealth) {
      const statusEntities = fleetHealth.byStatus.get(filterStatus) || [];
      const statusRefs = new Set(statusEntities.map((h: ServiceHealth) => h.entityRef));
      results = results.filter(entity => {
        const ref = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
        return statusRefs.has(ref);
      });
    }

    // Sort
    results.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.metadata.name.localeCompare(b.metadata.name);
        case 'health':
          // Sort by health score (need to look up in fleetHealth)
          return 0; // TODO: Implement health score lookup
        case 'quality':
          // Sort by quality score
          return 0; // TODO: Implement quality score lookup
        default:
          return 0;
      }
    });

    return results;
  }, [entities, searchQuery, filterStatus, sortBy, fleetHealth]);

  // Calculate summary statistics
  const healthSummary = useMemo<HealthSummary>(() => {
    if (!fleetHealth) {
      return { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
    }

    return {
      healthy: fleetHealth.byStatus.get('healthy')?.length || 0,
      degraded: fleetHealth.byStatus.get('degraded')?.length || 0,
      unhealthy: fleetHealth.byStatus.get('unhealthy')?.length || 0,
      unknown: fleetHealth.byStatus.get('unknown')?.length || 0,
    };
  }, [fleetHealth]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.unknown;
  };

  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'degrading':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getGradeColor = (grade: string) => {
    return GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || '#6B7280';
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Service Health & Quality Intelligence</h2>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring and quality insights for your services
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30000">30 seconds</SelectItem>
              <SelectItem value="60000">1 minute</SelectItem>
              <SelectItem value="300000">5 minutes</SelectItem>
              <SelectItem value="600000">10 minutes</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={loadFleetHealth}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer" onClick={() => setFilterStatus('healthy')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy Services</CardTitle>
            <Heart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{healthSummary.healthy}</div>
            <Progress 
              value={(healthSummary.healthy / entities.length) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => setFilterStatus('degraded')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Degraded Services</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{healthSummary.degraded}</div>
            <Progress 
              value={(healthSummary.degraded / entities.length) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => setFilterStatus('unhealthy')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unhealthy Services</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{healthSummary.unhealthy}</div>
            {healthSummary.unhealthy > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Immediate action required</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fleetHealth?.overall?.score || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall health score
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {fleetHealth && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Fleet Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Fleet Metrics</CardTitle>
                  <CardDescription>Aggregated performance across all services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Availability</span>
                        <span className="text-sm font-medium">
                          {fleetHealth.overall.metrics.availability.toFixed(2)}%
                        </span>
                      </div>
                      <Progress value={fleetHealth.overall.metrics.availability} />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Average Latency</span>
                        <span className="text-sm font-medium">
                          {fleetHealth.overall.metrics.latency.toFixed(0)}ms
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, (200 - fleetHealth.overall.metrics.latency) / 2)} 
                        className={cn(
                          fleetHealth.overall.metrics.latency > 200 && "bg-red-100"
                        )}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Error Rate</span>
                        <span className="text-sm font-medium">
                          {fleetHealth.overall.metrics.errorRate.toFixed(2)}%
                        </span>
                      </div>
                      <Progress 
                        value={100 - fleetHealth.overall.metrics.errorRate * 10}
                        className={cn(
                          fleetHealth.overall.metrics.errorRate > 5 && "bg-red-100"
                        )}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Total Throughput</span>
                        <span className="text-sm font-medium">
                          {fleetHealth.overall.metrics.throughput.toFixed(0)} req/s
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Service health status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Healthy', value: healthSummary.healthy, color: STATUS_COLORS.healthy },
                            { name: 'Degraded', value: healthSummary.degraded, color: STATUS_COLORS.degraded },
                            { name: 'Unhealthy', value: healthSummary.unhealthy, color: STATUS_COLORS.unhealthy },
                            { name: 'Unknown', value: healthSummary.unknown, color: STATUS_COLORS.unknown },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {[
                            { name: 'Healthy', value: healthSummary.healthy, color: STATUS_COLORS.healthy },
                            { name: 'Degraded', value: healthSummary.degraded, color: STATUS_COLORS.degraded },
                            { name: 'Unhealthy', value: healthSummary.unhealthy, color: STATUS_COLORS.unhealthy },
                            { name: 'Unknown', value: healthSummary.unknown, color: STATUS_COLORS.unknown },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Critical Services */}
          {fleetHealth?.critical && fleetHealth.critical.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-red-500" />
                  Critical Services
                </CardTitle>
                <CardDescription>Services requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fleetHealth.critical.slice(0, 5).map((health: ServiceHealth) => (
                    <div
                      key={health.entityRef}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const entity = entities.find(e => {
                          const ref = `${e.kind}:${e.metadata.namespace || 'default'}/${e.metadata.name}`;
                          return ref === health.entityRef;
                        });
                        if (entity) handleEntitySelect(entity);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(health.status)}
                        <div>
                          <p className="font-medium">{health.entityName}</p>
                          <p className="text-sm text-muted-foreground">{health.entityKind}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-500">{health.score}%</p>
                        <div className="flex items-center gap-2 mt-1">
                          {health.indicators.filter(i => i.status === 'critical').map((indicator, idx) => (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger>
                                  {getCategoryIcon(indicator.category)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{indicator.name}: {indicator.message}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          {/* Service List Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="unhealthy">Unhealthy</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-1 border rounded-md p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedEntities.map((entity) => {
                const ref = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
                const health = fleetHealth?.byStatus.get('healthy')?.find((h: ServiceHealth) => h.entityRef === ref) ||
                              fleetHealth?.byStatus.get('degraded')?.find((h: ServiceHealth) => h.entityRef === ref) ||
                              fleetHealth?.byStatus.get('unhealthy')?.find((h: ServiceHealth) => h.entityRef === ref);
                
                return (
                  <Card
                    key={ref}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleEntitySelect(entity)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{entity.metadata.name}</CardTitle>
                          <CardDescription>{entity.kind}</CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          style={{ 
                            borderColor: getStatusColor(health?.status || 'unknown'),
                            color: getStatusColor(health?.status || 'unknown')
                          }}
                        >
                          {health?.status || 'unknown'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Health Score</span>
                          <span className="text-2xl font-bold">{health?.score || 0}%</span>
                        </div>
                        
                        {health?.indicators && (
                          <div className="flex flex-wrap gap-2">
                            {health.indicators.slice(0, 3).map((indicator, idx) => (
                              <TooltipProvider key={idx}>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      variant={indicator.status === 'good' ? 'default' : 
                                              indicator.status === 'warning' ? 'secondary' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {indicator.name}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{indicator.message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4">Service</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Health</th>
                      <th className="text-left p-4">Availability</th>
                      <th className="text-left p-4">Latency</th>
                      <th className="text-left p-4">Error Rate</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedEntities.map((entity) => {
                      const ref = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
                      const health = fleetHealth?.byStatus.get('healthy')?.find((h: ServiceHealth) => h.entityRef === ref) ||
                                    fleetHealth?.byStatus.get('degraded')?.find((h: ServiceHealth) => h.entityRef === ref) ||
                                    fleetHealth?.byStatus.get('unhealthy')?.find((h: ServiceHealth) => h.entityRef === ref);
                      
                      return (
                        <tr key={ref} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{entity.metadata.name}</p>
                              <p className="text-sm text-muted-foreground">{entity.kind}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              style={{ 
                                borderColor: getStatusColor(health?.status || 'unknown'),
                                color: getStatusColor(health?.status || 'unknown')
                              }}
                            >
                              {getStatusIcon(health?.status || 'unknown')}
                              <span className="ml-1">{health?.status || 'unknown'}</span>
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{health?.score || 0}%</span>
                          </td>
                          <td className="p-4">
                            {health?.metrics.availability.toFixed(2)}%
                          </td>
                          <td className="p-4">
                            {health?.metrics.latency.toFixed(0)}ms
                          </td>
                          <td className="p-4">
                            {health?.metrics.errorRate.toFixed(2)}%
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEntitySelect(entity)}
                            >
                              View Details
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {processedEntities.slice(0, 8).map((entity) => {
              const ref = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
              
              return (
                <Card
                  key={ref}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleEntitySelect(entity)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{entity.metadata.name}</CardTitle>
                      <Badge
                        style={{ 
                          backgroundColor: getGradeColor('B'),
                          color: 'white'
                        }}
                      >
                        Grade B
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Code Quality</span>
                        <span>85%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Test Coverage</span>
                        <span>72%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Documentation</span>
                        <span>68%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Top Recommendations
                </CardTitle>
                <CardDescription>AI-powered insights for service improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Critical:</strong> 3 services have security vulnerabilities. Update dependencies immediately.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Performance:</strong> Optimize database queries in payment-service to reduce latency by 40%.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <TestTube className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Quality:</strong> Increase test coverage in user-service from 45% to 80% for better reliability.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Fleet Health Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={[
                        { day: 'Mon', health: 85, quality: 78 },
                        { day: 'Tue', health: 87, quality: 79 },
                        { day: 'Wed', health: 86, quality: 80 },
                        { day: 'Thu', health: 88, quality: 81 },
                        { day: 'Fri', health: 85, quality: 82 },
                        { day: 'Sat', health: 89, quality: 83 },
                        { day: 'Sun', health: 91, quality: 84 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="health" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        name="Health Score"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="quality" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        name="Quality Score"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Real-time issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertOctagon className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>auth-service</strong> - Service is down
                        <p className="text-xs mt-1">Started 5 minutes ago</p>
                      </div>
                      <Button size="sm" variant="outline">
                        Investigate
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>payment-api</strong> - High error rate (8.5%)
                        <p className="text-xs mt-1">Started 15 minutes ago</p>
                      </div>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>user-service</strong> - Response time degraded (450ms)
                        <p className="text-xs mt-1">Started 30 minutes ago</p>
                      </div>
                      <Button size="sm" variant="outline">
                        Analyze
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Service Detail Modal */}
      {selectedEntity && serviceHealth && serviceQuality && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {selectedEntity.metadata.name}
                  <Badge variant="outline">{selectedEntity.kind}</Badge>
                </CardTitle>
                <CardDescription>{selectedEntity.metadata.description}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedEntity(null);
                  setServiceHealth(null);
                  setServiceQuality(null);
                }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="health" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>

              <TabsContent value="health" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Health Score */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Health Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center">
                        <div className="relative">
                          <div className="text-4xl font-bold">{serviceHealth.score}%</div>
                          <Badge
                            variant="outline"
                            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
                            style={{ 
                              borderColor: getStatusColor(serviceHealth.status),
                              color: getStatusColor(serviceHealth.status)
                            }}
                          >
                            {serviceHealth.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SLI Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">SLI Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Availability</span>
                          <Badge
                            variant={serviceHealth.metrics.sli.availability.status === 'met' ? 'default' :
                                    serviceHealth.metrics.sli.availability.status === 'at-risk' ? 'secondary' : 'destructive'}
                          >
                            {serviceHealth.metrics.sli.availability.current.toFixed(2)}% / {serviceHealth.metrics.sli.availability.target}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Latency</span>
                          <Badge
                            variant={serviceHealth.metrics.sli.latency.status === 'met' ? 'default' :
                                    serviceHealth.metrics.sli.latency.status === 'at-risk' ? 'secondary' : 'destructive'}
                          >
                            {serviceHealth.metrics.sli.latency.current}ms / {serviceHealth.metrics.sli.latency.target}ms
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Error Rate</span>
                          <Badge
                            variant={serviceHealth.metrics.sli.errorRate.status === 'met' ? 'default' :
                                    serviceHealth.metrics.sli.errorRate.status === 'at-risk' ? 'secondary' : 'destructive'}
                          >
                            {serviceHealth.metrics.sli.errorRate.current.toFixed(2)}% / {serviceHealth.metrics.sli.errorRate.target}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Health Indicators */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Health Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {serviceHealth.indicators.map((indicator, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getCategoryIcon(indicator.category)}
                            <div>
                              <p className="font-medium">{indicator.name}</p>
                              <p className="text-sm text-muted-foreground">{indicator.message}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={indicator.status === 'good' ? 'default' :
                                      indicator.status === 'warning' ? 'secondary' : 'destructive'}
                            >
                              {indicator.status}
                            </Badge>
                            {getTrendIcon(indicator.trend)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metrics History</CardTitle>
                    <CardDescription>Last 24 hours</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={serviceHealth.history.map(h => ({
                            time: new Date(h.timestamp).toLocaleTimeString(),
                            score: h.score,
                            availability: h.metrics.availability,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis domain={[0, 100]} />
                          <RechartsTooltip />
                          <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#3B82F6" 
                            fill="#3B82F6"
                            fillOpacity={0.6}
                            name="Health Score"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quality Score */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quality Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center">
                        <div className="relative">
                          <div className="text-4xl font-bold">{serviceQuality.overallScore}%</div>
                          <Badge
                            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
                            style={{ 
                              backgroundColor: getGradeColor(serviceQuality.grade),
                              color: 'white'
                            }}
                          >
                            Grade {serviceQuality.grade}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quality Metrics Radar */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quality Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart
                            data={[
                              { metric: 'Code', value: serviceQuality.metrics.codeQuality.coverage },
                              { metric: 'Tests', value: (serviceQuality.metrics.testing.unitTestCoverage + serviceQuality.metrics.testing.integrationTestCoverage) / 2 },
                              { metric: 'Docs', value: serviceQuality.metrics.documentation.completeness },
                              { metric: 'Security', value: serviceQuality.metrics.security.complianceScore },
                              { metric: 'Deploy', value: 100 - serviceQuality.metrics.deployment.changeFailureRate },
                            ]}
                          >
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} />
                            <Radar name="Quality" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Code Quality
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Coverage</span>
                        <span>{serviceQuality.metrics.codeQuality.coverage.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Complexity</span>
                        <span>{serviceQuality.metrics.codeQuality.complexity.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Duplications</span>
                        <span>{serviceQuality.metrics.codeQuality.duplications.toFixed(1)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Testing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Unit Tests</span>
                        <span>{serviceQuality.metrics.testing.unitTestCoverage.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Integration</span>
                        <span>{serviceQuality.metrics.testing.integrationTestCoverage.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>E2E Tests</span>
                        <span>{serviceQuality.metrics.testing.e2eTestCoverage.toFixed(0)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Critical</span>
                        <Badge variant="destructive">{serviceQuality.metrics.security.vulnerabilities.critical}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>High</span>
                        <Badge variant="secondary">{serviceQuality.metrics.security.vulnerabilities.high}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Compliance</span>
                        <span>{serviceQuality.metrics.security.complianceScore.toFixed(0)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quality Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quality Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {serviceQuality.trends.map((trend, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm">{trend.metric}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              {trend.direction === 'up' ? <ArrowUp className="h-3 w-3" /> :
                               trend.direction === 'down' ? <ArrowDown className="h-3 w-3" /> :
                               <Minus className="h-3 w-3" />}
                              {trend.change.toFixed(1)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">{trend.period}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dependencies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Service Dependencies</CardTitle>
                    <CardDescription>Health status of dependent services</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {serviceHealth.dependencies.map((dep, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(dep.status)}
                            <div>
                              <p className="font-medium">{dep.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Latency: {dep.latency?.toFixed(0)}ms
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              style={{ 
                                borderColor: getStatusColor(dep.status),
                                color: getStatusColor(dep.status)
                              }}
                            >
                              {dep.status}
                            </Badge>
                            <Badge variant="outline">
                              {dep.impact} impact
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recommendations</CardTitle>
                    <CardDescription>AI-powered suggestions for improvement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {serviceQuality.recommendations.map((rec, idx) => (
                        <AccordionItem key={idx} value={rec.id}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 text-left">
                              <Badge
                                variant={rec.priority === 'critical' ? 'destructive' :
                                        rec.priority === 'high' ? 'secondary' :
                                        rec.priority === 'medium' ? 'outline' : 'outline'}
                              >
                                {rec.priority}
                              </Badge>
                              <div>
                                <p className="font-medium">{rec.title}</p>
                                <p className="text-sm text-muted-foreground">{rec.category}</p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pt-2">
                              <p className="text-sm">{rec.description}</p>
                              
                              <div>
                                <Label className="text-sm">Impact</Label>
                                <p className="text-sm text-muted-foreground">{rec.impact}</p>
                              </div>
                              
                              <div>
                                <Label className="text-sm">Effort Required</Label>
                                <Badge variant="outline">{rec.effort}</Badge>
                              </div>
                              
                              <div>
                                <Label className="text-sm">Action Items</Label>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                  {rec.actions.map((action, i) => (
                                    <li key={i}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}