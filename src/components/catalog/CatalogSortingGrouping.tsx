'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
 DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 ArrowUpDown,
 ChevronUp,
 ChevronDown,
 Filter,
 Group,
 SortAsc,
 SortDesc,
 Users,
 Package,
 Activity,
 Shield,
 DollarSign,
 Calendar,
 Tag,
 Building,
 GitBranch,
 Layers,
 Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface SortOption {
 key: string;
 label: string;
 icon: React.ReactNode;
 type: 'string' | 'number' | 'date';
}

interface GroupOption {
 key: string;
 label: string;
 icon: React.ReactNode;
 getValue: (entity: Entity) => string;
}

interface SortConfig {
 key: string;
 direction: 'asc' | 'desc';
}

interface GroupConfig {
 key: string;
 expanded: Record<string, boolean>;
}

interface CatalogSortingGroupingProps {
 entities: (Entity & {
 metrics?: {
 health: number;
 compliance: number;
 cost: number;
 performance: number;
 };
 lastModified?: string;
 })[];
 onEntitiesChange: (entities: typeof entities) => void;
 className?: string;
}

const SORT_OPTIONS: SortOption[] = [
 { key: 'name', label: 'Name', icon: <Hash className="h-4 w-4" />, type: 'string' },
 { key: 'kind', label: 'Kind', icon: <Package className="h-4 w-4" />, type: 'string' },
 { key: 'owner', label: 'Owner', icon: <Users className="h-4 w-4" />, type: 'string' },
 { key: 'lifecycle', label: 'Lifecycle', icon: <GitBranch className="h-4 w-4" />, type: 'string' },
 { key: 'health', label: 'Health Score', icon: <Activity className="h-4 w-4" />, type: 'number' },
 { key: 'compliance', label: 'Compliance', icon: <Shield className="h-4 w-4" />, type: 'number' },
 { key: 'cost', label: 'Cost', icon: <DollarSign className="h-4 w-4" />, type: 'number' },
 { key: 'lastModified', label: 'Last Modified', icon: <Calendar className="h-4 w-4" />, type: 'date' },
];

const GROUP_OPTIONS: GroupOption[] = [
 {
 key: 'kind',
 label: 'Entity Kind',
 icon: <Package className="h-4 w-4" />,
 getValue: (entity) => entity.kind,
 },
 {
 key: 'owner',
 label: 'Owner',
 icon: <Users className="h-4 w-4" />,
 getValue: (entity) => entity.spec?.owner || 'Unowned',
 },
 {
 key: 'lifecycle',
 label: 'Lifecycle',
 icon: <GitBranch className="h-4 w-4" />,
 getValue: (entity) => entity.spec?.lifecycle || 'Unknown',
 },
 {
 key: 'namespace',
 label: 'Namespace',
 icon: <Building className="h-4 w-4" />,
 getValue: (entity) => entity.metadata.namespace || 'default',
 },
 {
 key: 'health',
 label: 'Health Tier',
 icon: <Activity className="h-4 w-4" />,
 getValue: (entity) => {
 const health = entity.metrics?.health || 0;
 if (health >= 90) return 'Excellent (90-100%)';
 if (health >= 80) return 'Good (80-89%)';
 if (health >= 60) return 'Fair (60-79%)';
 return 'Poor (<60%)';
 },
 },
 {
 key: 'compliance',
 label: 'Compliance Tier',
 icon: <Shield className="h-4 w-4" />,
 getValue: (entity) => {
 const compliance = entity.metrics?.compliance || 0;
 if (compliance >= 95) return 'Fully Compliant (95-100%)';
 if (compliance >= 80) return 'Mostly Compliant (80-94%)';
 if (compliance >= 60) return 'Partially Compliant (60-79%)';
 return 'Non-Compliant (<60%)';
 },
 },
 {
 key: 'tags',
 label: 'Primary Tag',
 icon: <Tag className="h-4 w-4" />,
 getValue: (entity) => entity.metadata.tags?.[0] || 'Untagged',
 },
];

export function CatalogSortingGrouping({
 entities,
 onEntitiesChange,
 className
}: CatalogSortingGroupingProps) {
 const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
 { key: 'name', direction: 'asc' }
 ]);
 const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
 const [showAdvancedSort, setShowAdvancedSort] = useState(false);

 const getValue = (entity: Entity, key: string): any => {
 switch (key) {
 case 'name':
 return entity.metadata.name;
 case 'kind':
 return entity.kind;
 case 'owner':
 return entity.spec?.owner || '';
 case 'lifecycle':
 return entity.spec?.lifecycle || '';
 case 'health':
 return entity.metrics?.health || 0;
 case 'compliance':
 return entity.metrics?.compliance || 0;
 case 'cost':
 return entity.metrics?.cost || 0;
 case 'lastModified':
 return new Date(entity.lastModified || 0);
 default:
 return '';
 }
 };

 const sortedEntities = useMemo(() => {
 if (sortConfigs.length === 0) return entities;

 return [...entities].sort((a, b) => {
 for (const config of sortConfigs) {
 const aVal = getValue(a, config.key);
 const bVal = getValue(b, config.key);
 
 let comparison = 0;
 
 if (aVal < bVal) comparison = -1;
 else if (aVal > bVal) comparison = 1;
 
 if (comparison !== 0) {
 return config.direction === 'asc' ? comparison : -comparison;
 }
 }
 return 0;
 });
 }, [entities, sortConfigs]);

 const groupedEntities = useMemo(() => {
 if (!groupConfig) return null;

 const groupOption = GROUP_OPTIONS.find(opt => opt.key === groupConfig.key);
 if (!groupOption) return null;

 const groups = new Map<string, typeof entities>();
 
 sortedEntities.forEach(entity => {
 const groupValue = groupOption.getValue(entity);
 if (!groups.has(groupValue)) {
 groups.set(groupValue, []);
 }
 groups.get(groupValue)!.push(entity);
 });

 // Sort groups by name
 const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
 
 return sortedGroups.map(([groupName, groupEntities]) => ({
 name: groupName,
 entities: groupEntities,
 count: groupEntities.length,
 expanded: groupConfig.expanded[groupName] ?? true,
 }));
 }, [sortedEntities, groupConfig]);

 const handleAddSort = (key: string) => {
 const existing = sortConfigs.find(config => config.key === key);
 if (existing) {
 // Toggle direction
 setSortConfigs(prev => 
 prev.map(config => 
 config.key === key 
 ? { ...config, direction: config.direction === 'asc' ? 'desc' : 'asc' }
 : config
 )
 );
 } else {
 // Add new sort
 setSortConfigs(prev => [...prev, { key, direction: 'asc' }]);
 }
 };

 const handleRemoveSort = (key: string) => {
 setSortConfigs(prev => prev.filter(config => config.key !== key));
 };

 const handleSetGroup = (key: string | null) => {
 if (key === null) {
 setGroupConfig(null);
 } else {
 setGroupConfig({
 key,
 expanded: {},
 });
 }
 };

 const handleToggleGroup = (groupName: string) => {
 if (!groupConfig) return;
 
 setGroupConfig(prev => ({
 ...prev!,
 expanded: {
 ...prev!.expanded,
 [groupName]: !prev!.expanded[groupName],
 },
 }));
 };

 const clearSorting = () => {
 setSortConfigs([]);
 };

 const clearGrouping = () => {
 setGroupConfig(null);
 };

 // Apply sorting/grouping to entities
 useMemo(() => {
 if (groupedEntities) {
 const flatEntities = groupedEntities.flatMap(group => group.entities);
 onEntitiesChange(flatEntities);
 } else {
 onEntitiesChange(sortedEntities);
 }
 }, [sortedEntities, groupedEntities, onEntitiesChange]);

 const getSortIcon = (key: string) => {
 const config = sortConfigs.find(c => c.key === key);
 if (!config) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
 return config.direction === 'asc' 
 ? <SortAsc className="h-3 w-3 text-primary" />
 : <SortDesc className="h-3 w-3 text-primary" />;
 };

 const getGroupIcon = (key: string) => {
 const option = GROUP_OPTIONS.find(opt => opt.key === key);
 return option?.icon || <Group className="h-4 w-4" />;
 };

 return (
 <div className={cn("space-y-4", className)}>
 {/* Controls Bar */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-2">
 {/* Sort Dropdown */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 <SortAsc className="h-4 w-4 mr-2" />
 Sort
 {sortConfigs.length > 0 && (
 <Badge variant="secondary" className="ml-2 h-5 px-1.5">
 {sortConfigs.length}
 </Badge>
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-64">
 <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
 <DropdownMenuSeparator />
 {SORT_OPTIONS.map((option) => (
 <DropdownMenuItem
 key={option.key}
 onClick={() => handleAddSort(option.key)}
 className="flex items-center justify-between"
 >
 <div className="flex items-center gap-2">
 {option.icon}
 <span>{option.label}</span>
 </div>
 {getSortIcon(option.key)}
 </DropdownMenuItem>
 ))}
 {sortConfigs.length > 0 && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={clearSorting} className="text-red-600">
 Clear All Sorting
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>

 {/* Group Dropdown */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 <Group className="h-4 w-4 mr-2" />
 Group
 {groupConfig && (
 <Badge variant="secondary" className="ml-2 h-5 px-1.5">
 1
 </Badge>
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-64">
 <DropdownMenuLabel>Group By</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => handleSetGroup(null)}>
 <Layers className="h-4 w-4 mr-2" />
 No Grouping
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 {GROUP_OPTIONS.map((option) => (
 <DropdownMenuCheckboxItem
 key={option.key}
 checked={groupConfig?.key === option.key}
 onCheckedChange={(checked) => {
 if (checked) {
 handleSetGroup(option.key);
 } else {
 handleSetGroup(null);
 }
 }}
 >
 <div className="flex items-center gap-2">
 {option.icon}
 <span>{option.label}</span>
 </div>
 </DropdownMenuCheckboxItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>

 {/* Advanced Sort Toggle */}
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowAdvancedSort(!showAdvancedSort)}
 className={cn(showAdvancedSort && "bg-muted")}
 >
 <Filter className="h-4 w-4 mr-2" />
 Advanced
 </Button>
 </div>

 {/* Active Filters Display */}
 <div className="flex items-center gap-2">
 {sortConfigs.map((config, index) => {
 const option = SORT_OPTIONS.find(opt => opt.key === config.key);
 if (!option) return null;
 
 return (
 <Badge key={config.key} variant="secondary" className="gap-1">
 {option.icon}
 <span className="text-xs">
 {option.label} {config.direction === 'asc' ? '' : ''}
 </span>
 <button
 onClick={() => handleRemoveSort(config.key)}
 className="ml-1 hover:bg-background rounded-full p-0.5"
 >
 ×
 </button>
 </Badge>
 );
 })}
 
 {groupConfig && (
 <Badge variant="outline" className="gap-1">
 {getGroupIcon(groupConfig.key)}
 <span className="text-xs">
 Grouped by {GROUP_OPTIONS.find(opt => opt.key === groupConfig.key)?.label}
 </span>
 <button
 onClick={clearGrouping}
 className="ml-1 hover:bg-background rounded-full p-0.5"
 >
 ×
 </button>
 </Badge>
 )}
 </div>
 </div>

 {/* Advanced Sort Panel */}
 {showAdvancedSort && (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm">Multi-Dimensional Sorting</CardTitle>
 <CardDescription className="text-xs">
 Add multiple sort criteria. Items are sorted by the first criterion, then by the second, and so on.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {sortConfigs.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 No sorting applied. Use the Sort dropdown to add criteria.
 </p>
 ) : (
 <div className="space-y-2">
 {sortConfigs.map((config, index) => {
 const option = SORT_OPTIONS.find(opt => opt.key === config.key);
 if (!option) return null;
 
 return (
 <div key={config.key} className="flex items-center justify-between p-2 border rounded-md">
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="text-xs">
 {index + 1}
 </Badge>
 {option.icon}
 <span className="text-sm font-medium">{option.label}</span>
 </div>
 
 <div className="flex items-center gap-2">
 <Select
 value={config.direction}
 onValueChange={(direction: 'asc' | 'desc') => {
 setSortConfigs(prev =>
 prev.map(c => c.key === config.key ? { ...c, direction } : c)
 );
 }}
 >
 <SelectTrigger className="w-32 h-7">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="asc">Ascending</SelectItem>
 <SelectItem value="desc">Descending</SelectItem>
 </SelectContent>
 </Select>
 
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleRemoveSort(config.key)}
 className="h-7 w-7 p-0"
 >
 ×
 </Button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Group Summary */}
 {groupedEntities && groupedEntities.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm flex items-center gap-2">
 {getGroupIcon(groupConfig!.key)}
 Grouped by {GROUP_OPTIONS.find(opt => opt.key === groupConfig!.key)?.label}
 </CardTitle>
 <CardDescription className="text-xs">
 {groupedEntities.length} groups • {entities.length} total entities
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
 {groupedEntities.map((group) => (
 <button
 key={group.name}
 onClick={() => handleToggleGroup(group.name)}
 className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 transition-colors text-left"
 >
 <div className="flex items-center gap-2 min-w-0">
 {group.expanded ? (
 <ChevronDown className="h-3 w-3 flex-shrink-0" />
 ) : (
 <ChevronUp className="h-3 w-3 flex-shrink-0" />
 )}
 <span className="text-sm font-medium truncate">{group.name}</span>
 </div>
 <Badge variant="secondary" className="text-xs">
 {group.count}
 </Badge>
 </button>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}