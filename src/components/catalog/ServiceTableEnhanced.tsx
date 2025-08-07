'use client';

import { useState, useMemo } from 'react';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import {
 Package,
 MoreVertical,
 ChevronUp,
 ChevronDown,
 Filter,
 Search,
 Eye,
 Edit,
 Copy,
 Trash2,
 RefreshCw,
 Download,
 Upload,
 Settings,
 Users,
 Clock,
 Shield,
 DollarSign,
 FileText,
 CheckCircle,
 AlertTriangle,
 XCircle,
 Zap,
 Database,
 Globe,
 Server,
 Square,
 CheckSquare,
 Star,
 TrendingUp,
 TrendingDown,
 Minus,
 ArrowUpDown,
 ChevronLeft,
 ChevronRight,
 RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface ServiceTableEnhancedProps {
 entities: (Entity & {
 metrics?: {
 health: number;
 compliance: number;
 cost: number;
 performance: number;
 };
 lastModified?: string;
 })[];
 selectedEntities?: string[];
 onSelect?: (entityId: string) => void;
 onSelectAll?: (selected: boolean) => void;
 onEntityClick?: (entity: Entity) => void;
 onAction?: (action: string, entity: Entity) => void;
 onBulkAction?: (action: string, entityIds: string[]) => void;
 loading?: boolean;
 showSelection?: boolean;
 className?: string;
}

type SortConfig = {
 key: string;
 direction: 'asc' | 'desc';
};

export function ServiceTableEnhanced({
 entities,
 selectedEntities = [],
 onSelect,
 onSelectAll,
 onEntityClick,
 onAction,
 onBulkAction,
 loading = false,
 showSelection = true,
 className
}: ServiceTableEnhancedProps) {
 const [searchTerm, setSearchTerm] = useState('');
 const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
 const [visibleColumns, setVisibleColumns] = useState({
 name: true,
 kind: true,
 owner: true,
 lifecycle: true,
 health: true,
 cost: true,
 lastModified: true,
 actions: true,
 });
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize, setPageSize] = useState(25);

 const getKindIcon = (kind: string) => {
 const icons = {
 Component: <Package className="h-4 w-4" />,
 API: <Zap className="h-4 w-4" />,
 System: <Server className="h-4 w-4" />,
 Domain: <Globe className="h-4 w-4" />,
 Resource: <Database className="h-4 w-4" />,
 Group: <Users className="h-4 w-4" />,
 User: <Users className="h-4 w-4" />,
 Template: <FileText className="h-4 w-4" />,
 };
 return icons[kind as keyof typeof icons] || <Package className="h-4 w-4" />;
 };

 const getLifecycleColor = (lifecycle?: string) => {
 const colors = {
 production: 'bg-green-100 text-green-800',
 experimental: 'bg-yellow-100 text-yellow-800',
 deprecated: 'bg-red-100 text-red-800',
 development: 'bg-blue-100 text-blue-800',
 };
 return colors[lifecycle as keyof typeof colors] || 'bg-gray-100 text-gray-800';
 };

 const getHealthColor = (score: number) => {
 if (score >= 80) return 'text-green-600';
 if (score >= 60) return 'text-yellow-600';
 return 'text-red-600';
 };

 const getHealthIcon = (score: number) => {
 if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
 if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
 return <XCircle className="h-4 w-4 text-red-600" />;
 };

 const getTrendIcon = (value: number) => {
 if (value > 0) return <TrendingUp className="h-3 w-3 text-green-600" />;
 if (value < 0) return <TrendingDown className="h-3 w-3 text-red-600" />;
 return <Minus className="h-3 w-3 text-gray-400" />;
 };

 const formatCost = (cost: number) => {
 if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}k`;
 return `$${cost}`;
 };

 const formatDate = (date?: string) => {
 if (!date) return 'Unknown';
 const now = new Date();
 const then = new Date(date);
 const diffTime = Math.abs(now.getTime() - then.getTime());
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 
 if (diffDays === 1) return '1d';
 if (diffDays < 7) return `${diffDays}d`;
 if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w`;
 return `${Math.ceil(diffDays / 30)}m`;
 };

 // Filter and sort entities
 const filteredAndSortedEntities = useMemo(() => {
 let filtered = entities.filter(entity =>
 entity.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 entity.metadata.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 entity.kind.toLowerCase().includes(searchTerm.toLowerCase()) ||
 entity.spec?.owner?.toLowerCase().includes(searchTerm.toLowerCase())
 );

 // Sort
 filtered.sort((a, b) => {
 let aVal: any = '';
 let bVal: any = '';

 switch (sortConfig.key) {
 case 'name':
 aVal = a.metadata.name;
 bVal = b.metadata.name;
 break;
 case 'kind':
 aVal = a.kind;
 bVal = b.kind;
 break;
 case 'owner':
 aVal = a.spec?.owner || '';
 bVal = b.spec?.owner || '';
 break;
 case 'lifecycle':
 aVal = a.spec?.lifecycle || '';
 bVal = b.spec?.lifecycle || '';
 break;
 case 'health':
 aVal = a.metrics?.health || 0;
 bVal = b.metrics?.health || 0;
 break;
 case 'cost':
 aVal = a.metrics?.cost || 0;
 bVal = b.metrics?.cost || 0;
 break;
 case 'lastModified':
 aVal = new Date(a.lastModified || 0);
 bVal = new Date(b.lastModified || 0);
 break;
 default:
 return 0;
 }

 if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
 if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
 return 0;
 });

 return filtered;
 }, [entities, searchTerm, sortConfig]);

 // Pagination
 const totalPages = Math.ceil(filteredAndSortedEntities.length / pageSize);
 const startIndex = (currentPage - 1) * pageSize;
 const endIndex = startIndex + pageSize;
 const paginatedEntities = filteredAndSortedEntities.slice(startIndex, endIndex);

 const handleSort = (key: string) => {
 setSortConfig({
 key,
 direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
 });
 };

 const handleSelectAll = () => {
 const allSelected = selectedEntities.length === paginatedEntities.length;
 onSelectAll?.(!allSelected);
 };

 const getSortIcon = (columnKey: string) => {
 if (sortConfig.key !== columnKey) {
 return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
 }
 return sortConfig.direction === 'asc' 
 ? <ChevronUp className="h-3 w-3" />
 : <ChevronDown className="h-3 w-3" />;
 };

 const isStarred = (entity: Entity) => entity.metadata.tags?.includes('starred');
 const hasDocumentation = (entity: Entity) => entity.metadata.annotations?.['backstage.io/techdocs-ref'];
 const hasTests = (entity: Entity) => entity.metadata.tags?.includes('tested');

 return (
 <TooltipProvider>
 <div className={cn("space-y-4", className)}>
 {/* Toolbar */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-2 flex-1">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search entities..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>
 
 {/* Column Visibility */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 <Filter className="h-4 w-4 mr-2" />
 Columns
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
 <DropdownMenuSeparator />
 {Object.entries(visibleColumns).map(([key, visible]) => (
 <DropdownMenuCheckboxItem
 key={key}
 checked={visible}
 onCheckedChange={(checked) =>
 setVisibleColumns(prev => ({ ...prev, [key]: checked }))
 }
 >
 {key.charAt(0).toUpperCase() + key.slice(1)}
 </DropdownMenuCheckboxItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>

 {/* Bulk Actions */}
 {selectedEntities.length > 0 && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 Actions ({selectedEntities.length})
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => onBulkAction?.('refresh', selectedEntities)}>
 <RefreshCw className="mr-2 h-4 w-4" />
 Refresh Selected
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onBulkAction?.('export', selectedEntities)}>
 <Download className="mr-2 h-4 w-4" />
 Export Selected
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onBulkAction?.('tag', selectedEntities)}>
 <Settings className="mr-2 h-4 w-4" />
 Add Tags
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={() => onBulkAction?.('delete', selectedEntities)}
 className="text-red-600"
 >
 <Trash2 className="mr-2 h-4 w-4" />
 Delete Selected
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>

 {/* Action Buttons */}
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm">
 <Upload className="h-4 w-4 mr-2" />
 Import
 </Button>
 <Button variant="outline" size="sm">
 <Download className="h-4 w-4 mr-2" />
 Export
 </Button>
 <Button variant="outline" size="sm">
 <RotateCcw className="h-4 w-4 mr-2" />
 Refresh
 </Button>
 </div>
 </div>

 {/* Table */}
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 {showSelection && visibleColumns.name && (
 <TableHead className="w-[50px]">
 <Button
 variant="ghost"
 size="sm"
 onClick={handleSelectAll}
 className="h-6 w-6 p-0"
 >
 {selectedEntities.length === paginatedEntities.length && paginatedEntities.length > 0 ? (
 <CheckSquare className="h-4 w-4" />
 ) : (
 <Square className="h-4 w-4" />
 )}
 </Button>
 </TableHead>
 )}
 
 {visibleColumns.name && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('name')}
 className="h-auto p-0 font-medium"
 >
 Name
 {getSortIcon('name')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.kind && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('kind')}
 className="h-auto p-0 font-medium"
 >
 Kind
 {getSortIcon('kind')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.owner && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('owner')}
 className="h-auto p-0 font-medium"
 >
 Owner
 {getSortIcon('owner')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.lifecycle && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('lifecycle')}
 className="h-auto p-0 font-medium"
 >
 Lifecycle
 {getSortIcon('lifecycle')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.health && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('health')}
 className="h-auto p-0 font-medium"
 >
 Health
 {getSortIcon('health')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.cost && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('cost')}
 className="h-auto p-0 font-medium"
 >
 Cost
 {getSortIcon('cost')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.lastModified && (
 <TableHead>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleSort('lastModified')}
 className="h-auto p-0 font-medium"
 >
 Modified
 {getSortIcon('lastModified')}
 </Button>
 </TableHead>
 )}

 {visibleColumns.actions && (
 <TableHead className="w-[100px]">Actions</TableHead>
 )}
 </TableRow>
 </TableHeader>
 <TableBody>
 {loading ? (
 <TableRow>
 <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + (showSelection ? 1 : 0)}>
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 </TableCell>
 </TableRow>
 ) : paginatedEntities.length === 0 ? (
 <TableRow>
 <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + (showSelection ? 1 : 0)}>
 <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
 <Package className="h-12 w-12 mb-4 opacity-50" />
 <p className="text-lg font-medium">No entities found</p>
 <p className="text-sm">Try adjusting your search or filters</p>
 </div>
 </TableCell>
 </TableRow>
 ) : (
 paginatedEntities.map((entity) => {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 const isSelected = selectedEntities.includes(entityId);

 return (
 <TableRow
 key={entityId}
 className={cn(
 "cursor-pointer hover:bg-muted/50",
 isSelected && "bg-muted"
 )}
 onClick={() => onEntityClick?.(entity)}
 >
 {showSelection && visibleColumns.name && (
 <TableCell onClick={(e) => e.stopPropagation()}>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => onSelect?.(entityId)}
 className="h-6 w-6 p-0"
 >
 {isSelected ? (
 <CheckSquare className="h-4 w-4 text-primary" />
 ) : (
 <Square className="h-4 w-4" />
 )}
 </Button>
 </TableCell>
 )}

 {visibleColumns.name && (
 <TableCell>
 <div className="flex items-center gap-3">
 <div className="flex-shrink-0">
 {getKindIcon(entity.kind)}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <p className="font-medium text-sm truncate">
 {entity.metadata.name}
 </p>
 {isStarred(entity) && (
 <Star className="h-3 w-3 text-yellow-500 fill-current" />
 )}
 </div>
 {entity.metadata.description && (
 <p className="text-xs text-muted-foreground truncate mt-1">
 {entity.metadata.description}
 </p>
 )}
 {/* Status Indicators */}
 <div className="flex items-center gap-1 mt-1">
 {hasDocumentation(entity) && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-0.5 rounded-full bg-blue-100">
 <FileText className="h-2.5 w-2.5 text-blue-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Has documentation</p>
 </TooltipContent>
 </Tooltip>
 )}
 {hasTests(entity) && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-0.5 rounded-full bg-green-100">
 <CheckCircle className="h-2.5 w-2.5 text-green-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Has tests</p>
 </TooltipContent>
 </Tooltip>
 )}
 {entity.metrics?.compliance && entity.metrics.compliance >= 90 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-0.5 rounded-full bg-green-100">
 <Shield className="h-2.5 w-2.5 text-green-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Compliant ({entity.metrics.compliance}%)</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>
 </div>
 </div>
 </TableCell>
 )}

 {visibleColumns.kind && (
 <TableCell>
 <Badge variant="outline" className="text-xs">
 {entity.kind}
 </Badge>
 </TableCell>
 )}

 {visibleColumns.owner && (
 <TableCell>
 <div className="flex items-center gap-1">
 <Users className="h-3 w-3 text-muted-foreground" />
 <span className="text-sm truncate">
 {entity.spec?.owner || 'Unowned'}
 </span>
 </div>
 </TableCell>
 )}

 {visibleColumns.lifecycle && (
 <TableCell>
 {entity.spec?.lifecycle && (
 <Badge
 variant="secondary"
 className={cn("text-xs", getLifecycleColor(entity.spec.lifecycle))}
 >
 {entity.spec.lifecycle}
 </Badge>
 )}
 </TableCell>
 )}

 {visibleColumns.health && entity.metrics && (
 <TableCell>
 <div className="flex items-center gap-2">
 {getHealthIcon(entity.metrics.health)}
 <span className={cn("text-sm font-medium", getHealthColor(entity.metrics.health))}>
 {entity.metrics.health}%
 </span>
 </div>
 </TableCell>
 )}

 {visibleColumns.cost && (
 <TableCell>
 {entity.metrics?.cost ? (
 <div className="flex items-center gap-1">
 <DollarSign className="h-3 w-3 text-muted-foreground" />
 <span className="text-sm">{formatCost(entity.metrics.cost)}</span>
 {getTrendIcon(Math.random() * 20 - 10)}
 </div>
 ) : (
 <span className="text-muted-foreground text-sm">-</span>
 )}
 </TableCell>
 )}

 {visibleColumns.lastModified && (
 <TableCell>
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3 text-muted-foreground" />
 <span className="text-sm text-muted-foreground">
 {formatDate(entity.lastModified)}
 </span>
 </div>
 </TableCell>
 )}

 {visibleColumns.actions && (
 <TableCell onClick={(e) => e.stopPropagation()}>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
 <MoreVertical className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => onAction?.('view', entity)}>
 <Eye className="mr-2 h-4 w-4" />
 View Details
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('edit', entity)}>
 <Edit className="mr-2 h-4 w-4" />
 Edit Entity
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('clone', entity)}>
 <Copy className="mr-2 h-4 w-4" />
 Clone
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('refresh', entity)}>
 <RefreshCw className="mr-2 h-4 w-4" />
 Refresh
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={() => onAction?.('delete', entity)}
 className="text-red-600"
 >
 <Trash2 className="mr-2 h-4 w-4" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 )}
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>

 {/* Pagination */}
 {!loading && paginatedEntities.length > 0 && (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span>
 Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedEntities.length)} of {filteredAndSortedEntities.length} entities
 </span>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 {pageSize} per page
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start">
 {[10, 25, 50, 100].map((size) => (
 <DropdownMenuItem
 key={size}
 onClick={() => {
 setPageSize(size);
 setCurrentPage(1);
 }}
 >
 {size} per page
 </DropdownMenuItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(1)}
 disabled={currentPage === 1}
 >
 First
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 disabled={currentPage === 1}
 >
 <ChevronLeft className="h-4 w-4" />
 Previous
 </Button>
 
 <div className="flex items-center gap-1">
 <span className="text-sm">Page</span>
 <Input
 type="number"
 min={1}
 max={totalPages}
 value={currentPage}
 onChange={(e) => {
 const page = parseInt(e.target.value, 10);
 if (page >= 1 && page <= totalPages) {
 setCurrentPage(page);
 }
 }}
 className="w-16 h-8 text-center"
 />
 <span className="text-sm">of {totalPages}</span>
 </div>

 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
 disabled={currentPage === totalPages}
 >
 Next
 <ChevronRight className="h-4 w-4" />
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(totalPages)}
 disabled={currentPage === totalPages}
 >
 Last
 </Button>
 </div>
 </div>
 )}
 </div>
 </TooltipProvider>
 );
}