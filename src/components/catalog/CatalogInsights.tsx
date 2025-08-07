'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Alert,
 AlertDescription,
 AlertTitle,
} from '@/components/ui/alert';
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import {
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 CheckCircle,
 Info,
 Brain,
 Sparkles,
 Target,
 Shield,
 DollarSign,
 Clock,
 Users,
 GitBranch,
 Package,
 Activity,
 Zap,
 Award,
 RefreshCw,
 Download,
 ChevronRight,
 BarChart3,
 PieChart,
 LineChart,
 Lightbulb
} from 'lucide-react';
import {
 LineChart as RechartsLineChart,
 Line,
 BarChart,
 Bar,
 PieChart as RechartsPieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip as RechartsTooltip,
 Legend,
 ResponsiveContainer,
 Area,
 AreaChart,
 RadarChart,
 PolarGrid,
 PolarAngleAxis,
 PolarRadiusAxis,
 Radar,
} from 'recharts';
import type { Entity } from '@/services/backstage/types/entities';

interface CatalogInsightsProps {
 entities: Entity[];
 onActionClick?: (action: string, data?: any) => void;
}

interface Insight {
 id: string;
 title: string;
 description: string;
 severity: 'info' | 'warning' | 'error' | 'success';
 category: 'quality' | 'security' | 'cost' | 'performance' | 'compliance';
 impact: 'low' | 'medium' | 'high';
 action?: {
 label: string;
 handler: () => void;
 };
 data?: any;
}

interface MetricTrend {
 date: string;
 value: number;
}

export function CatalogInsights({ entities, onActionClick }: CatalogInsightsProps) {
 const [insights, setInsights] = useState<Insight[]>([]);
 const [isAnalyzing, setIsAnalyzing] = useState(false);
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);

 // Calculate various metrics
 const metrics = useMemo(() => {
 const total = entities.length;
 const byKind = entities.reduce((acc, e) => {
 acc[e.kind] = (acc[e.kind] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 const byLifecycle = entities.reduce((acc, e) => {
 const lifecycle = e.spec?.lifecycle as string || 'unknown';
 acc[lifecycle] = (acc[lifecycle] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 const byOwner = entities.reduce((acc, e) => {
 const owner = e.spec?.owner as string || 'unowned';
 acc[owner] = (acc[owner] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 const withDocs = entities.filter(e => 
 e.metadata.annotations?.['backstage.io/techdocs-ref']
 ).length;

 const withTests = entities.filter(e => 
 e.metadata.tags?.includes('tested') || 
 e.metadata.annotations?.['backstage.io/test-coverage']
 ).length;

 const deprecated = entities.filter(e => 
 e.spec?.lifecycle === 'deprecated'
 ).length;

 const orphaned = entities.filter(e => 
 !e.spec?.owner || e.spec.owner === 'unknown'
 ).length;

 const missingTags = entities.filter(e => 
 !e.metadata.tags || e.metadata.tags.length === 0
 ).length;

 const avgRelations = entities.reduce((sum, e) => 
 sum + (e.relations?.length || 0), 0
 ) / total || 0;

 return {
 total,
 byKind,
 byLifecycle,
 byOwner,
 withDocs,
 withTests,
 deprecated,
 orphaned,
 missingTags,
 avgRelations,
 documentationCoverage: (withDocs / total) * 100,
 testCoverage: (withTests / total) * 100,
 healthScore: 85, // Placeholder score - will be calculated separately
 };
 }, [entities]);

 // Generate insights based on metrics
 useEffect(() => {
 generateInsights();
 }, [metrics]);

 const calculateHealthScore = (entities: Entity[]): number => {
 let score = 100;
 const total = entities.length;
 
 // Deduct points for various issues
 const orphanedPenalty = (metrics.orphaned / total) * 20;
 const missingTagsPenalty = (metrics.missingTags / total) * 15;
 const deprecatedPenalty = (metrics.deprecated / total) * 10;
 const noDocsPenalty = ((total - metrics.withDocs) / total) * 25;
 const noTestsPenalty = ((total - metrics.withTests) / total) * 20;
 const lowRelationsPenalty = metrics.avgRelations < 2 ? 10 : 0;
 
 score -= orphanedPenalty + missingTagsPenalty + deprecatedPenalty + 
 noDocsPenalty + noTestsPenalty + lowRelationsPenalty;
 
 return Math.max(0, Math.round(score));
 };

 const generateInsights = async () => {
 setIsAnalyzing(true);
 const newInsights: Insight[] = [];

 // Quality insights
 if (metrics.documentationCoverage < 80) {
 newInsights.push({
 id: 'low-doc-coverage',
 title: 'Low Documentation Coverage',
 description: `Only ${Math.round(metrics.documentationCoverage)}% of entities have documentation. Consider adding TechDocs to improve developer experience.`,
 severity: metrics.documentationCoverage < 50 ? 'error' : 'warning',
 category: 'quality',
 impact: 'high',
 action: {
 label: 'Add Documentation',
 handler: () => onActionClick?.('add-docs', { 
 entities: entities.filter(e => !e.metadata.annotations?.['backstage.io/techdocs-ref'])
 }),
 },
 });
 }

 if (metrics.orphaned > 0) {
 newInsights.push({
 id: 'orphaned-entities',
 title: 'Orphaned Entities Detected',
 description: `Found ${metrics.orphaned} entities without owners. This can lead to maintenance issues.`,
 severity: 'warning',
 category: 'compliance',
 impact: 'medium',
 action: {
 label: 'Assign Owners',
 handler: () => onActionClick?.('assign-owners', {
 entities: entities.filter(e => !e.spec?.owner)
 }),
 },
 });
 }

 if (metrics.deprecated > 0) {
 newInsights.push({
 id: 'deprecated-entities',
 title: 'Deprecated Entities',
 description: `${metrics.deprecated} entities are marked as deprecated. Consider archiving or removing them.`,
 severity: 'info',
 category: 'quality',
 impact: 'low',
 action: {
 label: 'Review Deprecated',
 handler: () => onActionClick?.('review-deprecated', {
 entities: entities.filter(e => e.spec?.lifecycle === 'deprecated')
 }),
 },
 });
 }

 if (metrics.avgRelations < 2) {
 newInsights.push({
 id: 'low-connectivity',
 title: 'Low Entity Connectivity',
 description: 'Entities have few relationships. This might indicate missing dependency information.',
 severity: 'warning',
 category: 'quality',
 impact: 'medium',
 action: {
 label: 'Discover Relations',
 handler: () => onActionClick?.('discover-relations'),
 },
 });
 }

 if (metrics.testCoverage < 70) {
 newInsights.push({
 id: 'low-test-coverage',
 title: 'Insufficient Test Coverage',
 description: `Only ${Math.round(metrics.testCoverage)}% of services have test indicators. Improve quality with better testing.`,
 severity: 'warning',
 category: 'quality',
 impact: 'high',
 });
 }

 // Cost insights (simulated)
 const highCostServices = entities.filter(e => 
 e.metadata.annotations?.['cost.monthly'] && 
 parseInt(e.metadata.annotations['cost.monthly']) > 1000
 );
 
 if (highCostServices.length > 0) {
 newInsights.push({
 id: 'high-cost-services',
 title: 'High Cost Services',
 description: `${highCostServices.length} services have monthly costs over $1000. Review for optimization opportunities.`,
 severity: 'warning',
 category: 'cost',
 impact: 'high',
 action: {
 label: 'Review Costs',
 handler: () => onActionClick?.('review-costs', { entities: highCostServices }),
 },
 });
 }

 // Security insights
 const missingSecurityTags = entities.filter(e => 
 !e.metadata.tags?.some(tag => 
 ['security-reviewed', 'compliant', 'secure'].includes(tag)
 )
 );

 if (missingSecurityTags.length > metrics.total * 0.3) {
 newInsights.push({
 id: 'security-review-needed',
 title: 'Security Review Needed',
 description: `${missingSecurityTags.length} entities lack security review tags. Ensure all services are properly reviewed.`,
 severity: 'error',
 category: 'security',
 impact: 'high',
 action: {
 label: 'Schedule Reviews',
 handler: () => onActionClick?.('security-review', { entities: missingSecurityTags }),
 },
 });
 }

 // Performance insights
 if (metrics.healthScore < 70) {
 newInsights.push({
 id: 'low-health-score',
 title: 'Low Catalog Health Score',
 description: `Overall catalog health is ${metrics.healthScore}%. Multiple improvements needed across quality metrics.`,
 severity: 'error',
 category: 'quality',
 impact: 'high',
 action: {
 label: 'View Improvement Plan',
 handler: () => onActionClick?.('improvement-plan'),
 },
 });
 }

 setInsights(newInsights);
 
 // Generate AI recommendations
 generateAIRecommendations();
 
 setIsAnalyzing(false);
 };

 const generateAIRecommendations = () => {
 const recommendations = [];
 
 if (metrics.orphaned > metrics.total * 0.1) {
 recommendations.push('Implement automated ownership detection based on repository contributors');
 }
 
 if (metrics.documentationCoverage < 60) {
 recommendations.push('Set up automated documentation generation from code comments');
 }
 
 if (metrics.avgRelations < 1.5) {
 recommendations.push('Enable automatic dependency discovery from package files and imports');
 }
 
 if (Object.keys(metrics.byOwner).length > 20) {
 recommendations.push('Consider consolidating ownership under fewer, well-defined teams');
 }
 
 if (metrics.deprecated > metrics.total * 0.15) {
 recommendations.push('Create a sunset policy and timeline for deprecated services');
 }
 
 setAiRecommendations(recommendations);
 };

 const getInsightIcon = (category: string) => {
 const icons = {
 quality: <Target className="h-4 w-4" />,
 security: <Shield className="h-4 w-4" />,
 cost: <DollarSign className="h-4 w-4" />,
 performance: <Activity className="h-4 w-4" />,
 compliance: <CheckCircle className="h-4 w-4" />,
 };
 return icons[category] || <Info className="h-4 w-4" />;
 };

 const getSeverityColor = (severity: string) => {
 const colors = {
 info: 'text-blue-500',
 warning: 'text-yellow-500',
 error: 'text-red-500',
 success: 'text-green-500',
 };
 return colors[severity] || 'text-gray-500';
 };

 // Chart data
 const kindDistribution = Object.entries(metrics.byKind).map(([kind, count]) => ({
 name: kind,
 value: count,
 }));

 const lifecycleDistribution = Object.entries(metrics.byLifecycle).map(([lifecycle, count]) => ({
 name: lifecycle,
 value: count,
 }));

 const ownershipData = Object.entries(metrics.byOwner)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10)
 .map(([owner, count]) => ({
 owner,
 count,
 }));

 const qualityMetrics = [
 { metric: 'Documentation', value: metrics.documentationCoverage },
 { metric: 'Test Coverage', value: metrics.testCoverage },
 { metric: 'Ownership', value: ((metrics.total - metrics.orphaned) / metrics.total) * 100 },
 { metric: 'Tagging', value: ((metrics.total - metrics.missingTags) / metrics.total) * 100 },
 { metric: 'Active', value: ((metrics.total - metrics.deprecated) / metrics.total) * 100 },
 { metric: 'Connected', value: Math.min(100, metrics.avgRelations * 20) },
 ];

 const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

 const filteredInsights = selectedCategory === 'all' 
 ? insights 
 : insights.filter(i => i.category === selectedCategory);

 return (
 <div className="space-y-6">
 {/* Health Score Card */}
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Catalog Health Score</CardTitle>
 <CardDescription>
 AI-powered analysis of your service catalog
 </CardDescription>
 </div>
 <div className="text-right">
 <div className="text-3xl font-bold">{metrics.healthScore}%</div>
 <Badge 
 variant={metrics.healthScore >= 80 ? 'default' : metrics.healthScore >= 60 ? 'secondary' : 'destructive'}
 >
 {metrics.healthScore >= 80 ? 'Healthy' : metrics.healthScore >= 60 ? 'Needs Attention' : 'Critical'}
 </Badge>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Progress value={metrics.healthScore} className="h-3" />
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
 <div className="text-center">
 <div className="text-2xl font-semibold">{metrics.total}</div>
 <div className="text-sm text-muted-foreground">Total Entities</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-semibold">{Math.round(metrics.documentationCoverage)}%</div>
 <div className="text-sm text-muted-foreground">Documented</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-semibold">{metrics.orphaned}</div>
 <div className="text-sm text-muted-foreground">Orphaned</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-semibold">{metrics.avgRelations.toFixed(1)}</div>
 <div className="text-sm text-muted-foreground">Avg Relations</div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Insights Tabs */}
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <CardTitle>Insights & Recommendations</CardTitle>
 <Button
 variant="outline"
 size="sm"
 onClick={() => generateInsights()}
 disabled={isAnalyzing}
 >
 {isAnalyzing ? (
 <>
 <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
 Analyzing...
 </>
 ) : (
 <>
 <Brain className="mr-2 h-4 w-4" />
 Re-analyze
 </>
 )}
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <Tabs defaultValue="insights">
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="insights">
 <Lightbulb className="mr-2 h-4 w-4" />
 Insights
 </TabsTrigger>
 <TabsTrigger value="analytics">
 <BarChart3 className="mr-2 h-4 w-4" />
 Analytics
 </TabsTrigger>
 <TabsTrigger value="ai">
 <Sparkles className="mr-2 h-4 w-4" />
 AI Recommendations
 </TabsTrigger>
 </TabsList>

 <TabsContent value="insights" className="space-y-4">
 {/* Category Filter */}
 <div className="flex gap-2">
 <Button
 variant={selectedCategory === 'all' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setSelectedCategory('all')}
 >
 All ({insights.length})
 </Button>
 {['quality', 'security', 'cost', 'compliance'].map(cat => {
 const count = insights.filter(i => i.category === cat).length;
 return count > 0 ? (
 <Button
 key={cat}
 variant={selectedCategory === cat ? 'default' : 'outline'}
 size="sm"
 onClick={() => setSelectedCategory(cat)}
 >
 {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
 </Button>
 ) : null;
 })}
 </div>

 {/* Insights List */}
 <div className="space-y-3">
 {filteredInsights.map(insight => (
 <Alert key={insight.id} className="relative">
 <div className="flex items-start gap-3">
 <div className={getSeverityColor(insight.severity)}>
 {getInsightIcon(insight.category)}
 </div>
 <div className="flex-1">
 <AlertTitle className="flex items-center gap-2">
 {insight.title}
 <Badge variant="outline" className="text-xs">
 {insight.impact} impact
 </Badge>
 </AlertTitle>
 <AlertDescription className="mt-2">
 {insight.description}
 </AlertDescription>
 {insight.action && (
 <Button
 variant="outline"
 size="sm"
 className="mt-3"
 onClick={insight.action.handler}
 >
 {insight.action.label}
 <ChevronRight className="ml-1 h-3 w-3" />
 </Button>
 )}
 </div>
 </div>
 </Alert>
 ))}
 </div>
 </TabsContent>

 <TabsContent value="analytics" className="space-y-6">
 {/* Entity Distribution */}
 <div className="grid gap-6 md:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Entity Distribution</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <RechartsPieChart>
 <Pie
 data={kindDistribution}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={entry => `${entry.name} (${entry.value})`}
 outerRadius={80}
 fill="#8884d8"
 dataKey="value"
 >
 {kindDistribution.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <RechartsTooltip />
 </RechartsPieChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Lifecycle Distribution</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={lifecycleDistribution}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="name" />
 <YAxis />
 <RechartsTooltip />
 <Bar dataKey="value" fill="#3b82f6" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Quality Metrics Radar */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Quality Metrics</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-80">
 <ResponsiveContainer width="100%" height="100%">
 <RadarChart data={qualityMetrics}>
 <PolarGrid />
 <PolarAngleAxis dataKey="metric" />
 <PolarRadiusAxis angle={90} domain={[0, 100]} />
 <Radar
 name="Score"
 dataKey="value"
 stroke="#3b82f6"
 fill="#3b82f6"
 fillOpacity={0.6}
 />
 <RechartsTooltip />
 </RadarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>

 {/* Top Owners */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Top Entity Owners</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={ownershipData} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis type="number" />
 <YAxis dataKey="owner" type="category" width={100} />
 <RechartsTooltip />
 <Bar dataKey="count" fill="#10b981" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="ai" className="space-y-4">
 <Alert>
 <Sparkles className="h-4 w-4" />
 <AlertTitle>AI-Powered Recommendations</AlertTitle>
 <AlertDescription>
 Based on your catalog analysis, here are personalized recommendations to improve your developer portal.
 </AlertDescription>
 </Alert>

 <div className="space-y-3">
 {aiRecommendations.map((recommendation, index) => (
 <Card key={index} className="p-4">
 <div className="flex items-start gap-3">
 <div className="rounded-lg bg-primary/10 p-2">
 <Brain className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1">
 <p className="text-sm">{recommendation}</p>
 <Button
 variant="link"
 size="sm"
 className="mt-2 p-0 h-auto"
 onClick={() => onActionClick?.('ai-recommendation', { recommendation })}
 >
 Learn more
 <ChevronRight className="ml-1 h-3 w-3" />
 </Button>
 </div>
 </div>
 </Card>
 ))}
 </div>

 <Card className="border-primary/20 bg-primary/5">
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <Award className="h-5 w-5" />
 Next Best Actions
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm">Enable automated ownership detection</span>
 <Badge variant="outline">+15 health points</Badge>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Set up documentation CI/CD</span>
 <Badge variant="outline">+20 health points</Badge>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Implement cost tagging policy</span>
 <Badge variant="outline">+10 health points</Badge>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </CardContent>
 </Card>
 </div>
 );
}