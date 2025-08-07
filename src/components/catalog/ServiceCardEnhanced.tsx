'use client';

import { useState } from 'react';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
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
 ExternalLink,
 Edit,
 Copy,
 Trash2,
 GitBranch,
 Users,
 Activity,
 Shield,
 DollarSign,
 Clock,
 FileText,
 AlertTriangle,
 CheckCircle,
 XCircle,
 Zap,
 Database,
 Globe,
 Server,
 Code,
 Square,
 CheckSquare,
 Heart,
 TrendingUp,
 TrendingDown,
 Minus,
 Star,
 Eye,
 RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface ServiceCardEnhancedProps {
 entity: Entity & {
 metrics?: {
 health: number;
 compliance: number;
 cost: number;
 performance: number;
 };
 lastModified?: string;
 isSelected?: boolean;
 };
 isSelected?: boolean;
 onSelect?: () => void;
 onClick?: () => void;
 onAction?: (action: string) => void;
 showSelection?: boolean;
 compact?: boolean;
}

export function ServiceCardEnhanced({
 entity,
 isSelected = false,
 onSelect,
 onClick,
 onAction,
 showSelection = true,
 compact = false
}: ServiceCardEnhancedProps) {
 const [isHovered, setIsHovered] = useState(false);

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
 production: 'bg-green-100 text-green-800 border-green-200',
 experimental: 'bg-yellow-100 text-yellow-800 border-yellow-200',
 deprecated: 'bg-red-100 text-red-800 border-red-200',
 development: 'bg-blue-100 text-blue-800 border-blue-200',
 };
 return colors[lifecycle as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
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
 
 if (diffDays === 1) return '1 day ago';
 if (diffDays < 7) return `${diffDays} days ago`;
 if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
 return `${Math.ceil(diffDays / 30)} months ago`;
 };

 const hasDocumentation = entity.metadata.annotations?.['backstage.io/techdocs-ref'];
 const hasTests = entity.metadata.tags?.includes('tested') || 
 entity.metadata.annotations?.['backstage.io/test-coverage'];
 const isStarred = entity.metadata.tags?.includes('starred');

 return (
 <TooltipProvider>
 <Card
 className={cn(
 "group relative transition-all duration-300 hover:shadow-lg cursor-pointer",
 "border-2 hover:border-primary/20",
 isSelected && "border-primary bg-primary/5",
 isHovered && "shadow-md transform scale-[1.02]",
 compact && "p-2"
 )}
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={() => setIsHovered(false)}
 onClick={(e) => {
 e.stopPropagation();
 onClick?.();
 }}
 >
 {/* Selection Checkbox */}
 {showSelection && (
 <div className="absolute top-3 left-3 z-10">
 <Button
 variant="ghost"
 size="icon"
 className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
 onClick={(e) => {
 e.stopPropagation();
 onSelect?.();
 }}
 >
 {isSelected ? (
 <CheckSquare className="h-4 w-4 text-primary" />
 ) : (
 <Square className="h-4 w-4" />
 )}
 </Button>
 </div>
 )}

 {/* Actions Menu */}
 <div className="absolute top-3 right-3 z-10">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
 onClick={(e) => e.stopPropagation()}
 >
 <MoreVertical className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuLabel>Actions</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => onAction?.('view')}>
 <Eye className="mr-2 h-4 w-4" />
 View Details
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('edit')}>
 <Edit className="mr-2 h-4 w-4" />
 Edit Entity
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('clone')}>
 <Copy className="mr-2 h-4 w-4" />
 Clone Entity
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onAction?.('refresh')}>
 <RefreshCw className="mr-2 h-4 w-4" />
 Refresh
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={() => onAction?.('delete')}
 className="text-red-600"
 >
 <Trash2 className="mr-2 h-4 w-4" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 <CardHeader className={cn("pb-3", compact && "pb-2")}>
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3 flex-1 min-w-0">
 <div className="flex-shrink-0 mt-0.5">
 {getKindIcon(entity.kind)}
 </div>
 <div className="min-w-0 flex-1">
 <CardTitle className={cn("text-base leading-tight", compact && "text-sm")}>
 <div className="flex items-center gap-2">
 <span className="truncate">{entity.metadata.name}</span>
 {isStarred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
 </div>
 </CardTitle>
 {entity.metadata.description && (
 <CardDescription className={cn("text-sm mt-1 line-clamp-2", compact && "text-xs")}>
 {entity.metadata.description}
 </CardDescription>
 )}
 </div>
 </div>
 </div>

 {/* Badges */}
 <div className="flex flex-wrap gap-1 mt-2">
 <Badge variant="outline" className={cn("text-xs", getLifecycleColor(entity.spec?.lifecycle as string))}>
 {entity.kind}
 </Badge>
 {entity.spec?.lifecycle && (
 <Badge variant="outline" className="text-xs">
 {entity.spec.lifecycle}
 </Badge>
 )}
 {entity.spec?.type && (
 <Badge variant="secondary" className="text-xs">
 {entity.spec.type}
 </Badge>
 )}
 </div>
 </CardHeader>

 <CardContent className={cn("pt-0 space-y-3", compact && "space-y-2")}>
 {/* Health Metrics */}
 {entity.metrics && !compact && (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {getHealthIcon(entity.metrics.health)}
 <span className="text-sm font-medium">Health</span>
 </div>
 <span className={cn("text-sm font-semibold", getHealthColor(entity.metrics.health))}>
 {entity.metrics.health}%
 </span>
 </div>
 <Progress value={entity.metrics.health} className="h-1.5" />
 </div>
 )}

 {/* Key Metrics Grid */}
 <div className={cn("grid grid-cols-2 gap-3 text-xs", compact && "gap-2")}>
 {entity.spec?.owner && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="flex items-center gap-1 min-w-0">
 <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
 <span className="truncate">{entity.spec.owner}</span>
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Owner: {entity.spec.owner}</p>
 </TooltipContent>
 </Tooltip>
 )}

 {entity.metrics?.cost && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="flex items-center gap-1">
 <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
 <span>{formatCost(entity.metrics.cost)}</span>
 {getTrendIcon(Math.random() * 20 - 10)}
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Monthly cost: ${entity.metrics.cost}</p>
 </TooltipContent>
 </Tooltip>
 )}

 {entity.lastModified && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="flex items-center gap-1 min-w-0">
 <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
 <span className="truncate">{formatDate(entity.lastModified)}</span>
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Last modified: {new Date(entity.lastModified).toLocaleString()}</p>
 </TooltipContent>
 </Tooltip>
 )}

 {entity.metrics?.compliance && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="flex items-center gap-1">
 <Shield className="h-3 w-3 text-muted-foreground flex-shrink-0" />
 <span>{entity.metrics.compliance}%</span>
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Compliance score: {entity.metrics.compliance}%</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>

 {/* Status Indicators */}
 {!compact && (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {hasDocumentation && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-1 rounded-full bg-blue-100">
 <FileText className="h-3 w-3 text-blue-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Has documentation</p>
 </TooltipContent>
 </Tooltip>
 )}

 {hasTests && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-1 rounded-full bg-green-100">
 <CheckCircle className="h-3 w-3 text-green-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Has tests</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>

 {/* Tags */}
 {entity.metadata.tags && entity.metadata.tags.length > 0 && (
 <div className="flex items-center gap-1">
 {entity.metadata.tags.slice(0, 2).map(tag => (
 <Badge key={tag} variant="outline" className="text-xs h-5">
 {tag}
 </Badge>
 ))}
 {entity.metadata.tags.length > 2 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Badge variant="outline" className="text-xs h-5">
 +{entity.metadata.tags.length - 2}
 </Badge>
 </TooltipTrigger>
 <TooltipContent>
 <div className="space-y-1">
 {entity.metadata.tags.slice(2).map(tag => (
 <div key={tag} className="text-xs">{tag}</div>
 ))}
 </div>
 </TooltipContent>
 </Tooltip>
 )}
 </div>
 )}
 </div>
 )}

 {/* External Links */}
 {entity.metadata.links && entity.metadata.links.length > 0 && !compact && (
 <div className="flex items-center justify-between pt-2 border-t">
 <span className="text-xs text-muted-foreground">Quick Links</span>
 <div className="flex items-center gap-1">
 {entity.metadata.links.slice(0, 3).map((link, index) => (
 <Tooltip key={index}>
 <TooltipTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 className="h-6 w-6"
 onClick={(e) => {
 e.stopPropagation();
 window.open(link.url, '_blank');
 }}
 >
 <ExternalLink className="h-3 w-3" />
 </Button>
 </TooltipTrigger>
 <TooltipContent>
 <p>{link.title || link.url}</p>
 </TooltipContent>
 </Tooltip>
 ))}
 </div>
 </div>
 )}
 </CardContent>

 {/* Hover Overlay */}
 {isHovered && (
 <div className="absolute inset-0 bg-primary/5 rounded-lg pointer-events-none transition-opacity duration-300" />
 )}
 </Card>
 </TooltipProvider>
 );
}