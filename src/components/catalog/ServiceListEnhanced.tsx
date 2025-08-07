'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
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
 Activity,
 Eye,
 RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface ServiceListEnhancedProps {
 entity: Entity & {
 metrics?: {
 health: number;
 compliance: number;
 cost: number;
 performance: number;
 };
 lastModified?: string;
 };
 isSelected?: boolean;
 onSelect?: () => void;
 onClick?: () => void;
 onAction?: (action: string) => void;
 showSelection?: boolean;
}

export function ServiceListEnhanced({
 entity,
 isSelected = false,
 onSelect,
 onClick,
 onAction,
 showSelection = true
}: ServiceListEnhancedProps) {
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

 const hasDocumentation = entity.metadata.annotations?.['backstage.io/techdocs-ref'];
 const hasTests = entity.metadata.tags?.includes('tested');
 const isStarred = entity.metadata.tags?.includes('starred');

 return (
 <TooltipProvider>
 <div
 className={cn(
 "group relative flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
 "hover:bg-accent/50 hover:border-primary/20 cursor-pointer",
 isSelected && "bg-primary/5 border-primary",
 isHovered && "shadow-sm"
 )}
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={() => setIsHovered(false)}
 onClick={(e) => {
 e.stopPropagation();
 onClick?.();
 }}
 >
 {/* Selection */}
 {showSelection && (
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
 )}

 {/* Icon & Basic Info */}
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <div className="flex-shrink-0">
 {getKindIcon(entity.kind)}
 </div>
 
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-medium text-sm truncate">{entity.metadata.name}</h3>
 {isStarred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
 <Badge variant="outline" className={cn("text-xs h-5", getLifecycleColor(entity.spec?.lifecycle as string))}>
 {entity.kind}
 </Badge>
 </div>
 
 {entity.metadata.description && (
 <p className="text-xs text-muted-foreground truncate">
 {entity.metadata.description}
 </p>
 )}
 </div>
 </div>

 {/* Owner */}
 <div className="hidden md:flex items-center gap-1 min-w-0 w-32">
 <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
 <span className="text-xs truncate">{entity.spec?.owner || 'Unowned'}</span>
 </div>

 {/* Lifecycle */}
 <div className="hidden lg:block w-24">
 {entity.spec?.lifecycle && (
 <Badge variant="secondary" className="text-xs">
 {entity.spec.lifecycle}
 </Badge>
 )}
 </div>

 {/* Health Score */}
 {entity.metrics && (
 <div className="hidden xl:flex items-center gap-2 w-20">
 {getHealthIcon(entity.metrics.health)}
 <span className={cn("text-xs font-medium", getHealthColor(entity.metrics.health))}>
 {entity.metrics.health}%
 </span>
 </div>
 )}

 {/* Cost */}
 {entity.metrics?.cost && (
 <div className="hidden xl:flex items-center gap-1 w-16">
 <DollarSign className="h-3 w-3 text-muted-foreground" />
 <span className="text-xs">{formatCost(entity.metrics.cost)}</span>
 </div>
 )}

 {/* Last Modified */}
 <div className="hidden lg:flex items-center gap-1 w-16">
 <Clock className="h-3 w-3 text-muted-foreground" />
 <span className="text-xs text-muted-foreground">
 {formatDate(entity.lastModified)}
 </span>
 </div>

 {/* Status Indicators */}
 <div className="flex items-center gap-1">
 {hasDocumentation && (
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="p-1 rounded-full bg-blue-100">
 <FileText className="h-2.5 w-2.5 text-blue-600" />
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
 <div className="p-1 rounded-full bg-green-100">
 <Shield className="h-2.5 w-2.5 text-green-600" />
 </div>
 </TooltipTrigger>
 <TooltipContent>
 <p>Compliant ({entity.metrics.compliance}%)</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>

 {/* Actions */}
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
 Clone
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

 {/* Mobile Metrics */}
 {entity.metrics && (
 <div className="md:hidden absolute -bottom-2 left-4 right-4">
 <Progress value={entity.metrics.health} className="h-1" />
 </div>
 )}
 </div>
 </TooltipProvider>
 );
}