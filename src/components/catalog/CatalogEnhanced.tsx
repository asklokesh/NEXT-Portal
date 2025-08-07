'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
 Package,
 Github,
 Cloud,
 Database,
 Globe,
 Settings,
 Search,
 RefreshCw,
 Upload,
 GitBranch,
 Container,
 Server,
 Zap,
 Shield,
 Activity,
 CheckCircle,
 AlertCircle,
 Info,
 Plus,
 ArrowRight,
 ArrowUpDown,
 Sparkles,
 FileCode,
 Users,
 Calendar,
 BarChart3,
 Network,
 BookOpen,
 Puzzle,
 Workflow,
 Target,
 TrendingUp,
 Building2,
 Layers,
 Bot,
 Brain,
 Wand2,
 Grid3X3,
 List,
 Table,
 Filter,
 Download,
 Eye,
 LayoutGrid,
 LayoutList,
 AlertTriangle,
 Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';
import { useCatalogSync, useSyncStatus } from '@/hooks/useCatalogSync';

// Import enhanced components
import { CatalogAdvancedFilters } from './CatalogAdvancedFilters';
import { DependencyGraph } from './DependencyGraph';
import { CatalogBulkOperationsBar } from './CatalogBulkOperationsBar';
import { CatalogInsights } from './CatalogInsights';
import { CatalogSortingGrouping } from './CatalogSortingGrouping';
import { SmartCategorizationPanel } from './SmartCategorizationPanel';
import { ServiceCardEnhanced } from './ServiceCardEnhanced';
import { ServiceListEnhanced } from './ServiceListEnhanced';
import { ServiceTableEnhanced } from './ServiceTableEnhanced';
import { BulkMetadataOperations } from './BulkMetadataOperations';
import { ComplianceScanning } from './ComplianceScanning';
import { ServiceHealthDashboard } from './ServiceHealthDashboard';
import { SemanticSearchBar } from './SemanticSearchBar';
import type { SearchFilters, SearchSuggestion, SearchHistory } from '@/lib/search/SemanticSearch';

interface CatalogEnhancedProps {
 className?: string;
}

type ViewMode = 'cards' | 'list' | 'table' | 'visualization';

interface ExtendedEntity extends Entity {
 metrics?: {
 health: number;
 compliance: number;
 cost: number;
 performance: number;
 };
 lastModified?: string;
}

interface FilterState {
 search: string;
 kind: string[];
 owner: string[];
 lifecycle: string[];
 healthScore: [number, number];
 tags: string[];
}

export function CatalogEnhanced({ className }: CatalogEnhancedProps) {
 const [entities, setEntities] = useState<ExtendedEntity[]>([]);
 const [processedEntities, setProcessedEntities] = useState<ExtendedEntity[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
 const [viewMode, setViewMode] = useState<ViewMode>('cards');
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [showInsights, setShowInsights] = useState(true);
 const [showSortingGrouping, setShowSortingGrouping] = useState(false);
 const [showSmartCategorization, setShowSmartCategorization] = useState(false);
 const [showBulkMetadata, setShowBulkMetadata] = useState(false);
 const [showComplianceScanning, setShowComplianceScanning] = useState(false);
 const [showServiceHealth, setShowServiceHealth] = useState(false);
 
 const [filters, setFilters] = useState<FilterState>({
 search: '',
 kind: [],
 owner: [],
 lifecycle: [],
 healthScore: [0, 100],
 tags: [],
 });

 // Semantic search state
 const [semanticSearchResults, setSemanticSearchResults] = useState<ExtendedEntity[]>([]);
 const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
 const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
 const [isSemanticSearchActive, setIsSemanticSearchActive] = useState(false);
 const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
 const [lastSemanticQuery, setLastSemanticQuery] = useState('');
 const [semanticFilters, setSemanticFilters] = useState<SearchFilters>({});

 // Real-time sync integration
 const syncStatus = useSyncStatus();
 const { triggerSync } = useCatalogSync({
 autoStart: true,
 onCatalogRefreshed: useCallback(() => {
 console.log('Catalog refreshed, refetching entities...');
 fetchEntities();
 }, []),
 onEntityUpdated: useCallback((entity: Entity) => {
 console.log('Entity updated:', entity.metadata.name);
 // Update the specific entity in our local state
 setEntities(prev => {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 const existingIndex = prev.findIndex(e => 
 (e.metadata.uid || `${e.kind}-${e.metadata.name}`) === entityId
 );
 
 if (existingIndex >= 0) {
 const updated = [...prev];
 updated[existingIndex] = {
 ...entity,
 metrics: updated[existingIndex].metrics, // Preserve metrics
 lastModified: new Date().toISOString(),
 };
 return updated;
 } else {
 // New entity
 return [...prev, {
 ...entity,
 metrics: {
 health: Math.floor(Math.random() * 40) + 60,
 compliance: Math.floor(Math.random() * 30) + 70,
 cost: Math.floor(Math.random() * 5000) + 100,
 performance: Math.floor(Math.random() * 40) + 60,
 },
 lastModified: new Date().toISOString(),
 }];
 }
 });
 }, []),
 onEntityDeleted: useCallback((entityRef: string) => {
 console.log('Entity deleted:', entityRef);
 // Remove the entity from our local state
 setEntities(prev => prev.filter(entity => {
 const currentRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
 return currentRef !== entityRef;
 }));
 }, []),
 });

 // Fetch entities from catalog API
 const fetchEntities = async () => {
 try {
 setLoading(true);
 setError(null);
 
 const response = await fetch('/api/catalog/entities');
 if (!response.ok) {
 throw new Error(`Failed to fetch entities: ${response.statusText}`);
 }
 
 const data = await response.json();
 
 // Transform and enhance entities with mock metrics for demo
 const enhancedEntities: ExtendedEntity[] = (data.items || []).map((entity: Entity) => ({
 ...entity,
 metrics: {
 health: Math.floor(Math.random() * 40) + 60, // 60-100
 compliance: Math.floor(Math.random() * 30) + 70, // 70-100
 cost: Math.floor(Math.random() * 5000) + 100, // $100-$5100
 performance: Math.floor(Math.random() * 40) + 60, // 60-100
 },
 lastModified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
 }));
 
 setEntities(enhancedEntities);
 } catch (error) {
 console.error('Error fetching entities:', error);
 setError(error instanceof Error ? error.message : 'Failed to fetch entities');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchEntities();
 }, []);

 // Semantic search functions
 const executeSemanticSearch = async (query: string, searchFilters: SearchFilters = {}) => {
 if (!query.trim()) {
 setIsSemanticSearchActive(false);
 setSemanticSearchResults([]);
 return;
 }

 setSemanticSearchLoading(true);
 setLastSemanticQuery(query);
 setSemanticFilters(searchFilters);

 try {
 const params = new URLSearchParams({
 q: query,
 filters: JSON.stringify(searchFilters),
 maxResults: '50',
 includeHighlights: 'true',
 includeRelevanceFactors: 'true',
 });

 const response = await fetch(`/api/catalog/search/semantic?${params}`);
 if (!response.ok) {
 throw new Error(`Search failed: ${response.statusText}`);
 }

 const data = await response.json();
 
 // Transform search results back to ExtendedEntity format
 const transformedResults: ExtendedEntity[] = data.results.map((result: any) => ({
 ...result.item,
 semanticScore: result.score,
 semanticMatches: result.matches,
 semanticHighlights: result.highlights,
 }));

 setSemanticSearchResults(transformedResults);
 setIsSemanticSearchActive(true);

 // Update search history
 const historyEntry: SearchHistory = {
 query,
 timestamp: new Date(),
 resultCount: data.totalCount,
 filters: searchFilters,
 };
 setSearchHistory(prev => [historyEntry, ...prev.slice(0, 19)]); // Keep last 20

 } catch (error) {
 console.error('Semantic search error:', error);
 setError(error instanceof Error ? error.message : 'Semantic search failed');
 } finally {
 setSemanticSearchLoading(false);
 }
 };

 const fetchSearchSuggestions = async (partialQuery: string) => {
 if (partialQuery.length < 2) {
 setSearchSuggestions([]);
 return;
 }

 try {
 const response = await fetch('/api/catalog/search/semantic/suggestions', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 partialQuery,
 maxSuggestions: 8,
 includeHistory: true,
 }),
 });

 if (response.ok) {
 const data = await response.json();
 setSearchSuggestions(data.suggestions || []);
 }
 } catch (error) {
 console.error('Error fetching suggestions:', error);
 }
 };

 const handleSemanticFiltersChange = (newFilters: SearchFilters) => {
 setSemanticFilters(newFilters);
 if (lastSemanticQuery) {
 executeSemanticSearch(lastSemanticQuery, newFilters);
 }
 };

 const clearSemanticSearch = () => {
 setIsSemanticSearchActive(false);
 setSemanticSearchResults([]);
 setLastSemanticQuery('');
 setSemanticFilters({});
 };

 // Filter entities based on current filter state
 const filteredEntities = useMemo(() => {
 // Use semantic search results if active
 if (isSemanticSearchActive && semanticSearchResults.length > 0) {
 return semanticSearchResults;
 }
 
 return (processedEntities.length > 0 ? processedEntities : entities).filter(entity => {
 // Search filter
 if (filters.search) {
 const searchTerm = filters.search.toLowerCase();
 const searchableText = [
 entity.metadata.name,
 entity.metadata.description || '',
 entity.kind,
 entity.spec?.owner || '',
 ...(entity.metadata.tags || [])
 ].join(' ').toLowerCase();
 
 if (!searchableText.includes(searchTerm)) {
 return false;
 }
 }

 // Kind filter
 if (filters.kind.length > 0 && !filters.kind.includes(entity.kind)) {
 return false;
 }

 // Owner filter
 if (filters.owner.length > 0) {
 const owner = entity.spec?.owner || 'unowned';
 if (!filters.owner.includes(owner)) {
 return false;
 }
 }

 // Lifecycle filter
 if (filters.lifecycle.length > 0) {
 const lifecycle = entity.spec?.lifecycle || 'unknown';
 if (!filters.lifecycle.includes(lifecycle)) {
 return false;
 }
 }

 // Health score filter
 if (entity.metrics?.health) {
 const [min, max] = filters.healthScore;
 if (entity.metrics.health < min || entity.metrics.health > max) {
 return false;
 }
 }

 // Tags filter
 if (filters.tags.length > 0) {
 const entityTags = entity.metadata.tags || [];
 if (!filters.tags.some(tag => entityTags.includes(tag))) {
 return false;
 }
 }

 return true;
 });
 }, [entities, processedEntities, filters, isSemanticSearchActive, semanticSearchResults]);

 const handleEntitySelect = (entityId: string) => {
 setSelectedEntities(prev => 
 prev.includes(entityId) 
 ? prev.filter(id => id !== entityId)
 : [...prev, entityId]
 );
 };

 const handleSelectAll = (selected: boolean) => {
 if (selected) {
 const allIds = filteredEntities.map(entity => 
 entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`
 );
 setSelectedEntities(allIds);
 } else {
 setSelectedEntities([]);
 }
 };

 const handleEntityClick = (entity: Entity) => {
 // Navigate to entity detail page
 const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
 window.location.href = `/catalog/${encodeURIComponent(entityRef)}`;
 };

 const handleEntityAction = (action: string, entity: Entity) => {
 const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
 
 switch (action) {
 case 'view':
 window.location.href = `/catalog/${encodeURIComponent(entityRef)}`;
 break;
 case 'edit':
 window.location.href = `/catalog/${encodeURIComponent(entityRef)}/edit`;
 break;
 case 'clone':
 console.log('Clone entity:', entityRef);
 break;
 case 'refresh':
 fetchEntities();
 break;
 case 'delete':
 console.log('Delete entity:', entityRef);
 break;
 default:
 console.log('Unknown action:', action, entityRef);
 }
 };

 const handleBulkAction = (action: string, entityIds: string[]) => {
 console.log('Bulk action:', action, entityIds);
 
 switch (action) {
 case 'refresh':
 fetchEntities();
 break;
 case 'export':
 // Export selected entities
 const selectedEntitiesData = entities.filter(entity => 
 entityIds.includes(entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`)
 );
 const dataStr = JSON.stringify(selectedEntitiesData, null, 2);
 const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
 const exportFileDefaultName = 'catalog-entities.json';
 const linkElement = document.createElement('a');
 linkElement.setAttribute('href', dataUri);
 linkElement.setAttribute('download', exportFileDefaultName);
 linkElement.click();
 break;
 case 'delete':
 console.log('Delete entities:', entityIds);
 break;
 case 'edit-metadata':
 setShowBulkMetadata(true);
 break;
 default:
 console.log('Unknown bulk action:', action, entityIds);
 }
 };

 const handleBulkMetadataComplete = (results: any) => {
 console.log('Bulk metadata operation complete:', results);
 
 // Refresh entities to show updated data
 fetchEntities();
 
 // Close the dialog
 setShowBulkMetadata(false);
 
 // Clear selection
 setSelectedEntities([]);
 
 // Show success message
 if (results.success > 0) {
 console.log(`Successfully updated ${results.success} entities`);
 }
 
 if (results.failed > 0) {
 console.warn(`Failed to update ${results.failed} entities`);
 }
 };

 const handleSmartCategorizationChanges = async (changes: any[]) => {
 try {
 console.log('Applying smart categorization changes:', changes.length);
 
 // Call API to apply changes
 const response = await fetch('/api/catalog/smart-categorization?action=apply', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ changes }),
 });

 if (!response.ok) {
 throw new Error(`Failed to apply changes: ${response.statusText}`);
 }

 const result = await response.json();
 console.log('Smart categorization results:', result);

 // Refresh entities to show updated data
 await fetchEntities();

 // Show success message or handle results
 if (result.summary.successful > 0) {
 console.log(`Successfully applied changes to ${result.summary.successful} entities`);
 }
 
 if (result.summary.failed > 0) {
 console.warn(`Failed to apply changes to ${result.summary.failed} entities`);
 }

 } catch (error) {
 console.error('Failed to apply smart categorization changes:', error);
 }
 };

 const getViewModeIcon = (mode: ViewMode) => {
 switch (mode) {
 case 'cards':
 return <LayoutGrid className="h-4 w-4" />;
 case 'list':
 return <LayoutList className="h-4 w-4" />;
 case 'table':
 return <Table className="h-4 w-4" />;
 case 'visualization':
 return <Network className="h-4 w-4" />;
 default:
 return <LayoutGrid className="h-4 w-4" />;
 }
 };

 // Calculate summary statistics
 const stats = useMemo(() => {
 const total = entities.length;
 const kinds = new Set(entities.map(e => e.kind));
 const avgHealth = entities.reduce((sum, e) => sum + (e.metrics?.health || 0), 0) / total || 0;
 const ownedEntities = entities.filter(e => e.spec?.owner && e.spec.owner !== 'unknown').length;
 
 return {
 total,
 kinds: kinds.size,
 avgHealth: Math.round(avgHealth),
 ownedPercentage: total > 0 ? Math.round((ownedEntities / total) * 100) : 0,
 };
 }, [entities]);

 if (error) {
 return (
 <div className={cn("p-6", className)}>
 <Alert variant="destructive">
 <AlertTriangle className="h-4 w-4" />
 <AlertTitle>Error Loading Catalog</AlertTitle>
 <AlertDescription>
 {error}
 <Button 
 variant="outline" 
 size="sm" 
 onClick={fetchEntities}
 className="ml-2"
 >
 <RefreshCw className="h-4 w-4 mr-2" />
 Retry
 </Button>
 </AlertDescription>
 </Alert>
 </div>
 );
 }

 return (
 <div className={cn("space-y-6", className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold">Software Catalog</h1>
 <p className="text-muted-foreground mt-1">
 Manage and discover all software components, APIs, and resources in your organization
 </p>
 </div>

 <div className="flex items-center gap-2">
 {/* Sync Status Indicator */}
 <div className="flex items-center gap-2 px-2 py-1 rounded border text-xs">
 <div className={cn(
 "w-2 h-2 rounded-full",
 syncStatus.connected ? "bg-green-500" : "bg-gray-400"
 )} />
 <span className="text-muted-foreground">
 {syncStatus.connected ? 'Live' : 'Offline'} • {syncStatus.method}
 </span>
 </div>

 <Button variant="outline" onClick={triggerSync} disabled={loading}>
 <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
 Sync
 </Button>
 <Button>
 <Plus className="h-4 w-4 mr-2" />
 Add Entity
 </Button>
 </div>
 </div>

 {/* Summary Stats */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
 <Package className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.total}</div>
 <p className="text-xs text-muted-foreground">
 {filteredEntities.length} visible after filtering
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
 <Layers className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.kinds}</div>
 <p className="text-xs text-muted-foreground">
 Different kinds of entities
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Avg Health</CardTitle>
 <Activity className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.avgHealth}%</div>
 <p className="text-xs text-muted-foreground">
 Overall catalog health
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Ownership</CardTitle>
 <Users className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.ownedPercentage}%</div>
 <p className="text-xs text-muted-foreground">
 Entities with owners
 </p>
 </CardContent>
 </Card>
 </div>

 {/* Controls */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-2 flex-1">
 {/* Semantic Search */}
 <div className="flex-1">
 <SemanticSearchBar
 entities={entities}
 onSearch={executeSemanticSearch}
 onFiltersChange={handleSemanticFiltersChange}
 initialQuery={lastSemanticQuery}
 initialFilters={semanticFilters}
 suggestions={searchSuggestions}
 searchHistory={searchHistory}
 isLoading={semanticSearchLoading}
 placeholder="Search catalog... (try: &quot;show me all Node.js services owned by platform team&quot;)"
 showQueryBuilder={true}
 showSavedSearches={true}
 className="max-w-2xl"
 />
 </div>
 
 {/* Clear Semantic Search */}
 {isSemanticSearchActive && (
 <Button
 variant="outline"
 onClick={clearSemanticSearch}
 className="text-xs"
 >
 <X className="h-3 w-3 mr-1" />
 Clear AI Search
 </Button>
 )}

 {/* Advanced Filters Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
 className={cn(showAdvancedFilters && "bg-muted")}
 >
 <Filter className="h-4 w-4 mr-2" />
 Filters
 </Button>

 {/* Insights Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowInsights(!showInsights)}
 className={cn(showInsights && "bg-muted")}
 >
 <Brain className="h-4 w-4 mr-2" />
 Insights
 </Button>

 {/* Sorting & Grouping Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowSortingGrouping(!showSortingGrouping)}
 className={cn(showSortingGrouping && "bg-muted")}
 >
 <ArrowUpDown className="h-4 w-4 mr-2" />
 Sort & Group
 </Button>

 {/* Smart Categorization Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowSmartCategorization(!showSmartCategorization)}
 className={cn(showSmartCategorization && "bg-muted")}
 >
 <Bot className="h-4 w-4 mr-2" />
 AI Categorization
 </Button>

 {/* Compliance Scanning Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowComplianceScanning(!showComplianceScanning)}
 className={cn(showComplianceScanning && "bg-muted")}
 >
 <Shield className="h-4 w-4 mr-2" />
 Compliance
 </Button>

 {/* Service Health Toggle */}
 <Button
 variant="outline"
 onClick={() => setShowServiceHealth(!showServiceHealth)}
 className={cn(showServiceHealth && "bg-muted")}
 >
 <Activity className="h-4 w-4 mr-2" />
 Health
 </Button>
 </div>

 {/* View Mode Selector */}
 <div className="flex items-center gap-1 border rounded-md p-1">
 {(['cards', 'list', 'table', 'visualization'] as ViewMode[]).map((mode) => (
 <Button
 key={mode}
 variant={viewMode === mode ? "default" : "ghost"}
 size="sm"
 onClick={() => setViewMode(mode)}
 className="h-8 px-2"
 >
 {getViewModeIcon(mode)}
 </Button>
 ))}
 </div>
 </div>

 {/* Semantic Search Status */}
 {isSemanticSearchActive && (
 <Card className="border-blue-200 bg-blue-50">
 <CardContent className="p-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-blue-600" />
 <span className="text-sm font-medium text-blue-800">
 AI Search Active: "{lastSemanticQuery}"
 </span>
 <Badge variant="secondary" className="text-xs">
 {semanticSearchResults.length} results
 </Badge>
 </div>
 <div className="flex items-center gap-2">
 {semanticSearchLoading && (
 <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
 )}
 <Button
 size="sm"
 variant="ghost"
 onClick={clearSemanticSearch}
 className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
 >
 Switch to Standard Search
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Advanced Filters */}
 {showAdvancedFilters && (
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Advanced Filters</CardTitle>
 <CardDescription>
 Fine-tune your catalog view with detailed filtering options
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CatalogAdvancedFilters
 entities={entities}
 filters={filters}
 onFiltersChange={setFilters}
 />
 </CardContent>
 </Card>
 )}

 {/* Sorting & Grouping Panel */}
 {showSortingGrouping && (
 <CatalogSortingGrouping
 entities={entities}
 onEntitiesChange={setProcessedEntities}
 />
 )}

 {/* Insights Panel */}
 {showInsights && (
 <CatalogInsights entities={filteredEntities} />
 )}

 {/* Smart Categorization Panel */}
 {showSmartCategorization && (
 <SmartCategorizationPanel
 entities={filteredEntities}
 selectedEntities={selectedEntities}
 onApplyChanges={handleSmartCategorizationChanges}
 />
 )}

 {/* Compliance Scanning Panel */}
 {showComplianceScanning && (
 <ComplianceScanning
 entities={filteredEntities}
 />
 )}

 {/* Service Health Dashboard */}
 {showServiceHealth && (
 <ServiceHealthDashboard
 entities={filteredEntities}
 />
 )}

 {/* Bulk Operations */}
 {selectedEntities.length > 0 && (
 <CatalogBulkOperationsBar
 selectedEntities={selectedEntities}
 onBulkAction={handleBulkAction}
 onClearSelection={() => setSelectedEntities([])}
 />
 )}

 {/* Main Content */}
 <div className="space-y-4">
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin" />
 <span className="ml-2 text-muted-foreground">Loading catalog...</span>
 </div>
 ) : (
 <>
 {viewMode === 'cards' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {filteredEntities.map((entity) => {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 return (
 <ServiceCardEnhanced
 key={entityId}
 entity={entity}
 isSelected={selectedEntities.includes(entityId)}
 onSelect={() => handleEntitySelect(entityId)}
 onClick={() => handleEntityClick(entity)}
 onAction={(action) => handleEntityAction(action, entity)}
 />
 );
 })}
 </div>
 )}

 {viewMode === 'list' && (
 <div className="space-y-2">
 {filteredEntities.map((entity) => {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 return (
 <ServiceListEnhanced
 key={entityId}
 entity={entity}
 isSelected={selectedEntities.includes(entityId)}
 onSelect={() => handleEntitySelect(entityId)}
 onClick={() => handleEntityClick(entity)}
 onAction={(action) => handleEntityAction(action, entity)}
 />
 );
 })}
 </div>
 )}

 {viewMode === 'table' && (
 <ServiceTableEnhanced
 entities={filteredEntities}
 selectedEntities={selectedEntities}
 onSelect={handleEntitySelect}
 onSelectAll={handleSelectAll}
 onEntityClick={handleEntityClick}
 onAction={handleEntityAction}
 onBulkAction={handleBulkAction}
 loading={loading}
 />
 )}

 {viewMode === 'visualization' && (
 <DependencyGraph
 entities={filteredEntities}
 onEntityClick={handleEntityClick}
 />
 )}

 {/* Empty State */}
 {filteredEntities.length === 0 && !loading && (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12">
 <Package className="h-12 w-12 text-muted-foreground mb-4" />
 <h3 className="text-lg font-medium mb-2">No entities found</h3>
 <p className="text-muted-foreground text-center mb-4">
 {entities.length === 0 
 ? "Your catalog is empty. Start by adding some entities."
 : "No entities match your current filters. Try adjusting your search criteria."
 }
 </p>
 <div className="flex items-center gap-2">
 {entities.length === 0 ? (
 <Button>
 <Plus className="h-4 w-4 mr-2" />
 Add Your First Entity
 </Button>
 ) : (
 <Button 
 variant="outline" 
 onClick={() => setFilters({
 search: '',
 kind: [],
 owner: [],
 lifecycle: [],
 healthScore: [0, 100],
 tags: [],
 })}
 >
 <RefreshCw className="h-4 w-4 mr-2" />
 Clear Filters
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 )}
 </>
 )}
 </div>

 {/* Bulk Metadata Operations Dialog */}
 {showBulkMetadata && selectedEntities.length > 0 && (
 <BulkMetadataOperations
 entities={entities}
 selectedEntities={selectedEntities}
 onOperationComplete={handleBulkMetadataComplete}
 onClose={() => setShowBulkMetadata(false)}
 />
 )}
 </div>
 );
}