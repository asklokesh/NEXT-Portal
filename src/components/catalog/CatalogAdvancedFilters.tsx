'use client';

import { useState, useEffect } from 'react';
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
 SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
 Filter,
 X,
 Calendar,
 Clock,
 Activity,
 Shield,
 DollarSign,
 Users,
 GitBranch,
 Cpu,
 HardDrive,
 Zap,
 Search,
 Save,
 RotateCcw,
 Star,
 Copy,
 Share2
} from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { MultiSelect } from '@/components/ui/multi-select';
import { catalogClient } from '@/services/backstage/clients/catalog.client';

interface AdvancedFilters {
 // Basic filters
 name?: string;
 kind?: string[];
 type?: string[];
 lifecycle?: string[];
 owner?: string[];
 namespace?: string[];
 tags?: string[];
 
 // Advanced filters
 dateRange?: {
 from: Date;
 to: Date;
 };
 lastModified?: 'today' | '7days' | '30days' | '90days' | 'custom';
 
 // Metrics filters
 healthScore?: [number, number];
 complianceScore?: [number, number];
 responseTime?: [number, number];
 errorRate?: [number, number];
 cpuUsage?: [number, number];
 memoryUsage?: [number, number];
 
 // Cost filters
 monthlyCost?: [number, number];
 costTrend?: 'increasing' | 'decreasing' | 'stable';
 
 // Security filters
 vulnerabilities?: 'none' | 'low' | 'medium' | 'high' | 'critical';
 securityScore?: [number, number];
 
 // Relationship filters
 dependsOn?: string[];
 dependencyOf?: string[];
 partOf?: string[];
 
 // Status filters
 hasDocumentation?: boolean;
 hasTests?: boolean;
 hasMonitoring?: boolean;
 hasAlerts?: boolean;
 hasSLO?: boolean;
 
 // Custom metadata
 customFilters?: Record<string, any>;
}

interface CatalogAdvancedFiltersProps {
 onFiltersChange: (filters: AdvancedFilters) => void;
 onClose?: () => void;
 defaultFilters?: AdvancedFilters;
}

export function CatalogAdvancedFilters({
 onFiltersChange,
 onClose,
 defaultFilters = {}
}: CatalogAdvancedFiltersProps) {
 const [filters, setFilters] = useState<AdvancedFilters>(defaultFilters);
 const [facets, setFacets] = useState<Record<string, Array<{ value: string; count: number }>>>({});
 const [savedFilters, setSavedFilters] = useState<Array<{ name: string; filters: AdvancedFilters }>>([]);
 const [filterName, setFilterName] = useState('');
 const [isLoading, setIsLoading] = useState(true);

 // Load facets and saved filters
 useEffect(() => {
 loadFacets();
 loadSavedFilters();
 }, []);

 const loadFacets = async () => {
 setIsLoading(true);
 try {
 const facetData = await catalogClient.getEntityFacets([
 'kind',
 'spec.type',
 'spec.lifecycle',
 'spec.owner',
 'metadata.namespace',
 'metadata.tags',
 'spec.system',
 'spec.domain'
 ]);
 
 setFacets(facetData.facets);
 } catch (error) {
 console.error('Failed to load facets:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const loadSavedFilters = () => {
 const saved = localStorage.getItem('catalog-saved-filters');
 if (saved) {
 setSavedFilters(JSON.parse(saved));
 }
 };

 const saveCurrentFilters = () => {
 if (!filterName) return;
 
 const newSavedFilters = [
 ...savedFilters,
 { name: filterName, filters }
 ];
 
 setSavedFilters(newSavedFilters);
 localStorage.setItem('catalog-saved-filters', JSON.stringify(newSavedFilters));
 setFilterName('');
 };

 const applySavedFilter = (savedFilter: AdvancedFilters) => {
 setFilters(savedFilter);
 onFiltersChange(savedFilter);
 };

 const updateFilter = (key: keyof AdvancedFilters, value: any) => {
 const newFilters = { ...filters, [key]: value };
 setFilters(newFilters);
 };

 const applyFilters = () => {
 onFiltersChange(filters);
 onClose?.();
 };

 const resetFilters = () => {
 setFilters({});
 onFiltersChange({});
 };

 const activeFilterCount = Object.entries(filters).filter(([_, value]) => {
 if (Array.isArray(value)) return value.length > 0;
 if (typeof value === 'boolean') return value;
 return value !== undefined && value !== null && value !== '';
 }).length;

 return (
 <Sheet>
 <SheetTrigger asChild>
 <Button variant="outline" className="gap-2">
 <Filter className="h-4 w-4" />
 Advanced Filters
 {activeFilterCount > 0 && (
 <Badge variant="secondary" className="ml-1">
 {activeFilterCount}
 </Badge>
 )}
 </Button>
 </SheetTrigger>
 <SheetContent className="w-[600px] overflow-y-auto">
 <SheetHeader>
 <SheetTitle>Advanced Catalog Filters</SheetTitle>
 <SheetDescription>
 Create complex queries to find exactly what you need
 </SheetDescription>
 </SheetHeader>

 <div className="mt-6 space-y-6">
 {/* Saved Filters */}
 {savedFilters.length > 0 && (
 <div className="space-y-3">
 <Label>Saved Filters</Label>
 <div className="grid grid-cols-2 gap-2">
 {savedFilters.map((saved, index) => (
 <Button
 key={index}
 variant="outline"
 size="sm"
 className="justify-start gap-2"
 onClick={() => applySavedFilter(saved.filters)}
 >
 <Star className="h-3 w-3" />
 {saved.name}
 </Button>
 ))}
 </div>
 </div>
 )}

 <Separator />

 <Accordion type="multiple" defaultValue={['basic']} className="w-full">
 {/* Basic Filters */}
 <AccordionItem value="basic">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <Search className="h-4 w-4" />
 Basic Filters
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div>
 <Label>Name Contains</Label>
 <Input
 placeholder="Search by name..."
 value={filters.name || ''}
 onChange={(e) => updateFilter('name', e.target.value)}
 />
 </div>

 <div>
 <Label>Kind</Label>
 <MultiSelect
 options={facets.kind?.map(f => ({ label: `${f.value} (${f.count})`, value: f.value })) || []}
 selected={filters.kind || []}
 onChange={(values) => updateFilter('kind', values)}
 placeholder="Select kinds..."
 />
 </div>

 <div>
 <Label>Type</Label>
 <MultiSelect
 options={facets['spec.type']?.map(f => ({ label: `${f.value} (${f.count})`, value: f.value })) || []}
 selected={filters.type || []}
 onChange={(values) => updateFilter('type', values)}
 placeholder="Select types..."
 />
 </div>

 <div>
 <Label>Lifecycle</Label>
 <MultiSelect
 options={facets['spec.lifecycle']?.map(f => ({ label: `${f.value} (${f.count})`, value: f.value })) || []}
 selected={filters.lifecycle || []}
 onChange={(values) => updateFilter('lifecycle', values)}
 placeholder="Select lifecycles..."
 />
 </div>

 <div>
 <Label>Owner</Label>
 <MultiSelect
 options={facets['spec.owner']?.map(f => ({ label: `${f.value} (${f.count})`, value: f.value })) || []}
 selected={filters.owner || []}
 onChange={(values) => updateFilter('owner', values)}
 placeholder="Select owners..."
 />
 </div>

 <div>
 <Label>Tags</Label>
 <MultiSelect
 options={facets['metadata.tags']?.map(f => ({ label: `${f.value} (${f.count})`, value: f.value })) || []}
 selected={filters.tags || []}
 onChange={(values) => updateFilter('tags', values)}
 placeholder="Select tags..."
 />
 </div>
 </AccordionContent>
 </AccordionItem>

 {/* Time-based Filters */}
 <AccordionItem value="time">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 Time & Activity
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div>
 <Label>Last Modified</Label>
 <Select
 value={filters.lastModified || ''}
 onValueChange={(value) => updateFilter('lastModified', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select time range" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="today">Today</SelectItem>
 <SelectItem value="7days">Last 7 days</SelectItem>
 <SelectItem value="30days">Last 30 days</SelectItem>
 <SelectItem value="90days">Last 90 days</SelectItem>
 <SelectItem value="custom">Custom range</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {filters.lastModified === 'custom' && (
 <div>
 <Label>Date Range</Label>
 <DatePickerWithRange
 date={filters.dateRange}
 onDateChange={(range) => updateFilter('dateRange', range)}
 />
 </div>
 )}
 </AccordionContent>
 </AccordionItem>

 {/* Performance Metrics */}
 <AccordionItem value="performance">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <Activity className="h-4 w-4" />
 Performance Metrics
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div>
 <div className="flex justify-between mb-2">
 <Label>Health Score</Label>
 <span className="text-sm text-muted-foreground">
 {filters.healthScore?.[0] || 0}% - {filters.healthScore?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={5}
 value={filters.healthScore || [0, 100]}
 onValueChange={(value) => updateFilter('healthScore', value)}
 className="w-full"
 />
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>Response Time (ms)</Label>
 <span className="text-sm text-muted-foreground">
 {filters.responseTime?.[0] || 0} - {filters.responseTime?.[1] || 1000}ms
 </span>
 </div>
 <Slider
 min={0}
 max={1000}
 step={10}
 value={filters.responseTime || [0, 1000]}
 onValueChange={(value) => updateFilter('responseTime', value)}
 className="w-full"
 />
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>Error Rate</Label>
 <span className="text-sm text-muted-foreground">
 {filters.errorRate?.[0] || 0}% - {filters.errorRate?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={1}
 value={filters.errorRate || [0, 100]}
 onValueChange={(value) => updateFilter('errorRate', value)}
 className="w-full"
 />
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>CPU Usage</Label>
 <span className="text-sm text-muted-foreground">
 {filters.cpuUsage?.[0] || 0}% - {filters.cpuUsage?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={5}
 value={filters.cpuUsage || [0, 100]}
 onValueChange={(value) => updateFilter('cpuUsage', value)}
 className="w-full"
 />
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>Memory Usage</Label>
 <span className="text-sm text-muted-foreground">
 {filters.memoryUsage?.[0] || 0}% - {filters.memoryUsage?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={5}
 value={filters.memoryUsage || [0, 100]}
 onValueChange={(value) => updateFilter('memoryUsage', value)}
 className="w-full"
 />
 </div>
 </AccordionContent>
 </AccordionItem>

 {/* Cost Filters */}
 <AccordionItem value="cost">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <DollarSign className="h-4 w-4" />
 Cost Management
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div>
 <div className="flex justify-between mb-2">
 <Label>Monthly Cost</Label>
 <span className="text-sm text-muted-foreground">
 ${filters.monthlyCost?.[0] || 0} - ${filters.monthlyCost?.[1] || 10000}
 </span>
 </div>
 <Slider
 min={0}
 max={10000}
 step={100}
 value={filters.monthlyCost || [0, 10000]}
 onValueChange={(value) => updateFilter('monthlyCost', value)}
 className="w-full"
 />
 </div>

 <div>
 <Label>Cost Trend</Label>
 <Select
 value={filters.costTrend || ''}
 onValueChange={(value) => updateFilter('costTrend', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select cost trend" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="increasing">Increasing</SelectItem>
 <SelectItem value="decreasing">Decreasing</SelectItem>
 <SelectItem value="stable">Stable</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </AccordionContent>
 </AccordionItem>

 {/* Security Filters */}
 <AccordionItem value="security">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Security & Compliance
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div>
 <Label>Vulnerability Level</Label>
 <Select
 value={filters.vulnerabilities || ''}
 onValueChange={(value) => updateFilter('vulnerabilities', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select vulnerability level" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">No vulnerabilities</SelectItem>
 <SelectItem value="low">Low</SelectItem>
 <SelectItem value="medium">Medium</SelectItem>
 <SelectItem value="high">High</SelectItem>
 <SelectItem value="critical">Critical</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>Security Score</Label>
 <span className="text-sm text-muted-foreground">
 {filters.securityScore?.[0] || 0}% - {filters.securityScore?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={5}
 value={filters.securityScore || [0, 100]}
 onValueChange={(value) => updateFilter('securityScore', value)}
 className="w-full"
 />
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <Label>Compliance Score</Label>
 <span className="text-sm text-muted-foreground">
 {filters.complianceScore?.[0] || 0}% - {filters.complianceScore?.[1] || 100}%
 </span>
 </div>
 <Slider
 min={0}
 max={100}
 step={5}
 value={filters.complianceScore || [0, 100]}
 onValueChange={(value) => updateFilter('complianceScore', value)}
 className="w-full"
 />
 </div>
 </AccordionContent>
 </AccordionItem>

 {/* Status Checks */}
 <AccordionItem value="status">
 <AccordionTrigger>
 <div className="flex items-center gap-2">
 <Zap className="h-4 w-4" />
 Status & Features
 </div>
 </AccordionTrigger>
 <AccordionContent className="space-y-4">
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label htmlFor="has-docs">Has Documentation</Label>
 <Switch
 id="has-docs"
 checked={filters.hasDocumentation || false}
 onCheckedChange={(checked) => updateFilter('hasDocumentation', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="has-tests">Has Tests</Label>
 <Switch
 id="has-tests"
 checked={filters.hasTests || false}
 onCheckedChange={(checked) => updateFilter('hasTests', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="has-monitoring">Has Monitoring</Label>
 <Switch
 id="has-monitoring"
 checked={filters.hasMonitoring || false}
 onCheckedChange={(checked) => updateFilter('hasMonitoring', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="has-alerts">Has Alerts</Label>
 <Switch
 id="has-alerts"
 checked={filters.hasAlerts || false}
 onCheckedChange={(checked) => updateFilter('hasAlerts', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <Label htmlFor="has-slo">Has SLO</Label>
 <Switch
 id="has-slo"
 checked={filters.hasSLO || false}
 onCheckedChange={(checked) => updateFilter('hasSLO', checked)}
 />
 </div>
 </div>
 </AccordionContent>
 </AccordionItem>
 </Accordion>

 <Separator />

 {/* Save Filter */}
 <div className="space-y-3">
 <Label>Save Current Filter</Label>
 <div className="flex gap-2">
 <Input
 placeholder="Filter name..."
 value={filterName}
 onChange={(e) => setFilterName(e.target.value)}
 />
 <Button
 size="sm"
 variant="outline"
 onClick={saveCurrentFilters}
 disabled={!filterName || activeFilterCount === 0}
 >
 <Save className="h-4 w-4" />
 </Button>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex justify-between pt-4">
 <Button
 variant="outline"
 onClick={resetFilters}
 className="gap-2"
 >
 <RotateCcw className="h-4 w-4" />
 Reset All
 </Button>
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={() => {
 navigator.clipboard.writeText(JSON.stringify(filters, null, 2));
 toast.success('Filters copied to clipboard');
 }}
 >
 <Copy className="h-4 w-4" />
 </Button>
 <Button onClick={applyFilters} className="gap-2">
 Apply Filters
 {activeFilterCount > 0 && (
 <Badge variant="secondary">{activeFilterCount}</Badge>
 )}
 </Button>
 </div>
 </div>
 </div>
 </SheetContent>
 </Sheet>
 );
}