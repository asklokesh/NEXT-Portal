'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
 Search,
 Package,
 Download,
 CheckCircle,
 AlertCircle,
 Star,
 GitBranch,
 Users,
 BarChart3,
 Shield,
 Zap,
 Globe,
 Database,
} from 'lucide-react';

interface PluginsSetupProps {
 data: {
 installedPlugins: string[];
 };
 onUpdate: (data: { installedPlugins: string[] }) => void;
}

interface Plugin {
 id: string;
 name: string;
 description: string;
 category: string;
 icon: React.ReactNode;
 popularity: number;
 recommended?: boolean;
 dependencies?: string[];
}

const availablePlugins: Plugin[] = [
 {
 id: 'catalog',
 name: 'Service Catalog',
 description: 'Core plugin for managing services, APIs, and components',
 category: 'Core',
 icon: <Database className="h-5 w-5" />,
 popularity: 5,
 recommended: true,
 },
 {
 id: 'techdocs',
 name: 'TechDocs',
 description: 'Documentation as code using Markdown',
 category: 'Documentation',
 icon: <GitBranch className="h-5 w-5" />,
 popularity: 5,
 recommended: true,
 },
 {
 id: 'kubernetes',
 name: 'Kubernetes',
 description: 'View and manage Kubernetes resources',
 category: 'Infrastructure',
 icon: <Globe className="h-5 w-5" />,
 popularity: 4,
 recommended: true,
 },
 {
 id: 'github-actions',
 name: 'GitHub Actions',
 description: 'Monitor GitHub Actions workflows',
 category: 'CI/CD',
 icon: <Zap className="h-5 w-5" />,
 popularity: 4,
 },
 {
 id: 'cost-insights',
 name: 'Cost Insights',
 description: 'Track and optimize cloud costs',
 category: 'FinOps',
 icon: <BarChart3 className="h-5 w-5" />,
 popularity: 3,
 },
 {
 id: 'security-insights',
 name: 'Security Insights',
 description: 'Security scanning and vulnerability management',
 category: 'Security',
 icon: <Shield className="h-5 w-5" />,
 popularity: 4,
 },
 {
 id: 'pagerduty',
 name: 'PagerDuty',
 description: 'Incident management integration',
 category: 'Operations',
 icon: <AlertCircle className="h-5 w-5" />,
 popularity: 3,
 },
 {
 id: 'rollbar',
 name: 'Rollbar',
 description: 'Error tracking and monitoring',
 category: 'Monitoring',
 icon: <AlertCircle className="h-5 w-5" />,
 popularity: 3,
 },
];

const categories = ['All', 'Core', 'CI/CD', 'Infrastructure', 'Security', 'Monitoring', 'Documentation', 'FinOps', 'Operations'];

export function PluginsSetup({ data, onUpdate }: PluginsSetupProps) {
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(
 new Set(data.installedPlugins)
 );

 const handleTogglePlugin = (pluginId: string, install: boolean) => {
 const newInstalled = new Set(installedPlugins);
 if (install) {
 newInstalled.add(pluginId);
 } else {
 newInstalled.delete(pluginId);
 }
 setInstalledPlugins(newInstalled);
 onUpdate({ installedPlugins: Array.from(newInstalled) });
 };

 const installRecommended = () => {
 const recommended = availablePlugins
 .filter(p => p.recommended)
 .map(p => p.id);
 const newInstalled = new Set([...installedPlugins, ...recommended]);
 setInstalledPlugins(newInstalled);
 onUpdate({ installedPlugins: Array.from(newInstalled) });
 };

 const filteredPlugins = availablePlugins.filter(plugin => {
 const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
 const matchesCategory = selectedCategory === 'All' || plugin.category === selectedCategory;
 return matchesSearch && matchesCategory;
 });

 return (
 <div className="space-y-6">
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 Plugins extend Backstage functionality. You can add more plugins later from the admin panel.
 </AlertDescription>
 </Alert>

 {/* Quick Actions */}
 <div className="flex items-center justify-between">
 <Button
 variant="outline"
 onClick={installRecommended}
 className="gap-2"
 >
 <Star className="h-4 w-4" />
 Install Recommended
 </Button>
 <span className="text-sm text-muted-foreground">
 {installedPlugins.size} plugin{installedPlugins.size !== 1 ? 's' : ''} selected
 </span>
 </div>

 {/* Search and Filter */}
 <div className="flex gap-4 flex-col sm:flex-row">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search plugins..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <div className="flex gap-2 flex-wrap">
 {categories.map(category => (
 <Button
 key={category}
 variant={selectedCategory === category ? 'default' : 'outline'}
 size="sm"
 onClick={() => setSelectedCategory(category)}
 >
 {category}
 </Button>
 ))}
 </div>
 </div>

 {/* Plugins Grid */}
 <div className="grid gap-4 md:grid-cols-2">
 {filteredPlugins.map(plugin => {
 const isInstalled = installedPlugins.has(plugin.id);

 return (
 <Card
 key={plugin.id}
 className={`transition-all ${isInstalled ? 'border-primary ring-1 ring-primary/20' : ''}`}
 >
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 {plugin.icon}
 </div>
 <div className="flex-1">
 <CardTitle className="text-base flex items-center gap-2">
 {plugin.name}
 {plugin.recommended && (
 <Badge variant="secondary" className="text-xs">
 Recommended
 </Badge>
 )}
 </CardTitle>
 <CardDescription className="mt-1">
 {plugin.description}
 </CardDescription>
 </div>
 </div>
 <Switch
 checked={isInstalled}
 onCheckedChange={(checked) => handleTogglePlugin(plugin.id, checked)}
 />
 </div>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between">
 <Badge variant="outline">{plugin.category}</Badge>
 <div className="flex items-center gap-1">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`h-3 w-3 ${
 i < plugin.popularity
 ? 'fill-yellow-400 text-yellow-400'
 : 'text-gray-300'
 }`}
 />
 ))}
 </div>
 </div>
 {plugin.dependencies && plugin.dependencies.length > 0 && (
 <div className="mt-3">
 <p className="text-xs text-muted-foreground mb-1">Dependencies:</p>
 <div className="flex gap-1 flex-wrap">
 {plugin.dependencies.map(dep => (
 <Badge key={dep} variant="secondary" className="text-xs">
 {dep}
 </Badge>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 );
 })}
 </div>

 {/* Summary */}
 {installedPlugins.size > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Selected Plugins</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {Array.from(installedPlugins).map(pluginId => {
 const plugin = availablePlugins.find(p => p.id === pluginId);
 return plugin ? (
 <Badge key={pluginId} variant="default" className="gap-1">
 <CheckCircle className="h-3 w-3" />
 {plugin.name}
 </Badge>
 ) : null;
 })}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}