'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Star,
 Clock,
 TrendingUp,
 Play,
 ChevronRight,
 Heart,
 Package,
 BarChart3,
 Settings,
 Download,
 Upload,
 Trash2,
 MoreVertical,
 ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { useTemplatePreferences } from '@/hooks/useTemplatePreferences';
import { cn } from '@/lib/utils';
import { useTemplates } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateQuickAccessProps {
 className?: string;
 compact?: boolean;
}

interface QuickTemplateCardProps {
 templateRef: string;
 template?: TemplateEntity;
 usage?: {
 usageCount: number;
 lastUsed: string;
 };
 showUsage?: boolean;
 isFavorite?: boolean;
 onToggleFavorite?: () => void;
 onUse?: () => void;
 compact?: boolean;
}

const QuickTemplateCard: React.FC<QuickTemplateCardProps> = ({
 templateRef,
 template,
 usage,
 showUsage,
 isFavorite,
 onToggleFavorite,
 onUse,
 compact,
}) => {
 const [showMenu, setShowMenu] = useState(false);

 const templateName = template?.metadata.title || template?.metadata.name || templateRef.split('/').pop() || 'Unknown Template';
 const templateType = template?.spec.type || 'service';

 return (
 <div className={cn(
 'group relative rounded-lg border bg-card hover:shadow-md transition-all duration-200',
 compact ? 'p-3' : 'p-4'
 )}>
 <div className="flex items-start justify-between mb-2">
 <div className="flex-1 min-w-0">
 <h4 className={cn(
 'font-medium truncate',
 compact ? 'text-sm' : 'text-base'
 )}>
 {templateName}
 </h4>
 <p className="text-xs text-muted-foreground capitalize">
 {templateType} template
 </p>
 </div>
 
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {onToggleFavorite && (
 <button
 onClick={onToggleFavorite}
 className={cn(
 'p-1 rounded hover:bg-accent transition-colors',
 isFavorite ? 'text-red-500' : 'text-muted-foreground'
 )}
 >
 <Heart className={cn('w-3 h-3', isFavorite && 'fill-current')} />
 </button>
 )}
 
 <div className="relative">
 <button
 onClick={() => setShowMenu(!showMenu)}
 className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
 >
 <MoreVertical className="w-3 h-3" />
 </button>
 
 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-32 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={() => {
 onUse?.();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
 >
 <Play className="w-3 h-3" />
 Use Template
 </button>
 <button className="flex items-center gap-2 w-full px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground">
 <ExternalLink className="w-3 h-3" />
 View Details
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {showUsage && usage && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
 <span>{usage.usageCount} use{usage.usageCount !== 1 ? 's' : ''}</span>
 <span>•</span>
 <span>{new Date(usage.lastUsed).toLocaleDateString()}</span>
 </div>
 )}

 <button
 onClick={onUse}
 className={cn(
 'w-full flex items-center justify-center gap-1 rounded border border-primary/20 hover:bg-primary/10 text-primary transition-colors',
 compact ? 'py-1 text-xs' : 'py-2 text-sm'
 )}
 >
 <Play className="w-3 h-3" />
 Use Template
 </button>
 </div>
 );
};

export const TemplateQuickAccess: React.FC<TemplateQuickAccessProps> = ({
 className,
 compact = false,
}) => {
 const router = useRouter();
 const [activeTab, setActiveTab] = useState<'favorites' | 'recent' | 'popular'>('recent');
 const [showSettings, setShowSettings] = useState(false);

 const {
 favorites,
 recentlyUsed,
 getMostUsed,
 toggleFavorite,
 isFavorite,
 addToRecentlyUsed,
 getStats,
 exportPreferences,
 clearAllPreferences,
 } = useTemplatePreferences();

 const { data: templates = [] } = useTemplates();

 // Get template data for favorites
 const favoriteTemplates = favorites
 .map(ref => templates.find(t => `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === ref))
 .filter(Boolean) as TemplateEntity[];

 // Get most used templates
 const mostUsed = getMostUsed(5);

 // Get stats
 const stats = getStats();

 const handleUseTemplate = (templateRef: string) => {
 const template = templates.find(t => 
 `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === templateRef
 );
 
 if (template) {
 addToRecentlyUsed(templateRef, template);
 }
 
 router.push(`/templates?template=${encodeURIComponent(templateRef)}`);
 };

 const renderContent = () => {
 switch (activeTab) {
 case 'favorites':
 return (
 <div className="space-y-2">
 {favoriteTemplates.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No favorite templates yet</p>
 <p className="text-xs">Heart templates to see them here</p>
 </div>
 ) : (
 favoriteTemplates.map(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 return (
 <QuickTemplateCard
 key={templateRef}
 templateRef={templateRef}
 template={template}
 isFavorite={true}
 onToggleFavorite={() => toggleFavorite(templateRef)}
 onUse={() => handleUseTemplate(templateRef)}
 compact={compact}
 />
 );
 })
 )}
 </div>
 );

 case 'recent':
 return (
 <div className="space-y-2">
 {recentlyUsed.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No recent templates</p>
 <p className="text-xs">Use templates to see them here</p>
 </div>
 ) : (
 recentlyUsed.slice(0, 5).map(usage => {
 const template = templates.find(t => 
 `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === usage.templateRef
 );
 return (
 <QuickTemplateCard
 key={usage.templateRef}
 templateRef={usage.templateRef}
 template={template}
 usage={usage}
 showUsage
 isFavorite={isFavorite(usage.templateRef)}
 onToggleFavorite={() => toggleFavorite(usage.templateRef)}
 onUse={() => handleUseTemplate(usage.templateRef)}
 compact={compact}
 />
 );
 })
 )}
 </div>
 );

 case 'popular':
 return (
 <div className="space-y-2">
 {mostUsed.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
 <p className="text-sm">No usage data yet</p>
 <p className="text-xs">Use templates to see popular ones</p>
 </div>
 ) : (
 mostUsed.map(usage => {
 const template = templates.find(t => 
 `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === usage.templateRef
 );
 return (
 <QuickTemplateCard
 key={usage.templateRef}
 templateRef={usage.templateRef}
 template={template}
 usage={usage}
 showUsage
 isFavorite={isFavorite(usage.templateRef)}
 onToggleFavorite={() => toggleFavorite(usage.templateRef)}
 onUse={() => handleUseTemplate(usage.templateRef)}
 compact={compact}
 />
 );
 })
 )}
 </div>
 );

 default:
 return null;
 }
 };

 return (
 <div className={cn('bg-card rounded-lg border', className)}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b">
 <div className="flex items-center gap-2">
 <Package className="w-5 h-5 text-primary" />
 <h3 className="font-semibold">Quick Templates</h3>
 </div>
 
 <div className="flex items-center gap-1">
 <button
 onClick={() => router.push('/templates')}
 className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
 title="View all templates"
 >
 <ExternalLink className="w-4 h-4" />
 </button>
 <button
 onClick={() => setShowSettings(!showSettings)}
 className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
 title="Settings"
 >
 <Settings className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Settings panel */}
 {showSettings && (
 <div className="p-4 border-b bg-muted/50">
 <div className="space-y-3">
 <div className="flex items-center justify-between text-sm">
 <span>Total Templates Used:</span>
 <span className="font-medium">{stats.uniqueTemplates}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span>Total Executions:</span>
 <span className="font-medium">{stats.totalUsage}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span>Favorites:</span>
 <span className="font-medium">{stats.favoriteCount}</span>
 </div>
 
 <div className="flex gap-2 pt-2">
 <button
 onClick={exportPreferences}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-accent transition-colors"
 >
 <Download className="w-3 h-3" />
 Export
 </button>
 <button
 onClick={clearAllPreferences}
 className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
 >
 <Trash2 className="w-3 h-3" />
 Clear All
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Tabs */}
 <div className="flex border-b">
 {[
 { id: 'recent', label: 'Recent', icon: Clock },
 { id: 'favorites', label: 'Favorites', icon: Star },
 { id: 'popular', label: 'Popular', icon: TrendingUp },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as typeof activeTab)}
 className={cn(
 'flex items-center gap-1 px-3 py-2 text-sm transition-colors',
 activeTab === tab.id
 ? 'border-b-2 border-primary text-primary'
 : 'text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-3 h-3" />
 {tab.label}
 </button>
 ))}
 </div>

 {/* Content */}
 <div className="p-4 max-h-96 overflow-y-auto">
 {renderContent()}
 </div>

 {/* Footer */}
 <div className="p-3 border-t bg-muted/30">
 <button
 onClick={() => router.push('/templates')}
 className="w-full flex items-center justify-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
 >
 Browse All Templates
 <ChevronRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 );
};