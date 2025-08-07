'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from '@/components/ui/accordion';
import {
 Bot,
 Brain,
 CheckCircle,
 X,
 Tag,
 Layers,
 Activity,
 AlertCircle,
 Sparkles,
 RefreshCw,
 Save,
 Loader2,
 TrendingUp,
 Target,
 CheckCheck,
 Info,
 Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';
import { getSmartCategorization } from '@/lib/ai/SmartCategorization';

interface SmartCategorizationPanelProps {
 entities: Entity[];
 selectedEntities?: string[];
 onApplyChanges?: (changes: EntityChanges[]) => void;
 className?: string;
}

interface EntityChanges {
 entityId: string;
 entity: Entity;
 suggestedTags: string[];
 suggestedCategories: string[];
 acceptedTags: string[];
 acceptedCategories: string[];
 qualityScore: number;
 recommendations: string[];
}

interface AnalysisState {
 isAnalyzing: boolean;
 results: Map<string, any>;
 error: string | null;
 progress: number;
}

export function SmartCategorizationPanel({
 entities,
 selectedEntities = [],
 onApplyChanges,
 className
}: SmartCategorizationPanelProps) {
 const [analysisState, setAnalysisState] = useState<AnalysisState>({
 isAnalyzing: false,
 results: new Map(),
 error: null,
 progress: 0,
 });

 const [entityChanges, setEntityChanges] = useState<Map<string, EntityChanges>>(new Map());
 const [showOnlySelected, setShowOnlySelected] = useState(false);
 const [autoApplyHighConfidence, setAutoApplyHighConfidence] = useState(false);

 const smartCategorization = useMemo(() => getSmartCategorization(), []);

 const entitiesToAnalyze = useMemo(() => {
 if (showOnlySelected && selectedEntities.length > 0) {
 return entities.filter(entity => {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 return selectedEntities.includes(entityId);
 });
 }
 return entities;
 }, [entities, selectedEntities, showOnlySelected]);

 const runAnalysis = async () => {
 setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null, progress: 0 }));

 try {
 const results = new Map();
 const changes = new Map<string, EntityChanges>();

 for (let i = 0; i < entitiesToAnalyze.length; i++) {
 const entity = entitiesToAnalyze[i];
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;

 try {
 const analysis = await smartCategorization.analyzeEntity(entity);
 results.set(entityId, analysis);

 // Create initial entity changes
 const suggestedTags = analysis.tags.map(t => t.tag);
 const suggestedCategories = analysis.categories.map(c => c.category);

 changes.set(entityId, {
 entityId,
 entity,
 suggestedTags,
 suggestedCategories,
 acceptedTags: autoApplyHighConfidence 
 ? analysis.tags.filter(t => t.confidence > 0.8).map(t => t.tag)
 : [],
 acceptedCategories: autoApplyHighConfidence
 ? analysis.categories.filter(c => c.confidence > 0.8).map(c => c.category)
 : [],
 qualityScore: (analysis.quality.completeness + analysis.quality.consistency) / 2,
 recommendations: analysis.quality.recommendations,
 });

 } catch (error) {
 console.error(`Failed to analyze entity ${entityId}:`, error);
 }

 setAnalysisState(prev => ({
 ...prev,
 progress: Math.round(((i + 1) / entitiesToAnalyze.length) * 100)
 }));
 }

 setAnalysisState(prev => ({
 ...prev,
 results,
 isAnalyzing: false,
 progress: 100,
 }));

 setEntityChanges(changes);

 } catch (error) {
 setAnalysisState(prev => ({
 ...prev,
 isAnalyzing: false,
 error: error instanceof Error ? error.message : 'Analysis failed'
 }));
 }
 };

 const toggleTagAcceptance = (entityId: string, tag: string) => {
 setEntityChanges(prev => {
 const updated = new Map(prev);
 const current = updated.get(entityId);
 if (!current) return prev;

 const isAccepted = current.acceptedTags.includes(tag);
 updated.set(entityId, {
 ...current,
 acceptedTags: isAccepted
 ? current.acceptedTags.filter(t => t !== tag)
 : [...current.acceptedTags, tag]
 });

 return updated;
 });
 };

 const toggleCategoryAcceptance = (entityId: string, category: string) => {
 setEntityChanges(prev => {
 const updated = new Map(prev);
 const current = updated.get(entityId);
 if (!current) return prev;

 const isAccepted = current.acceptedCategories.includes(category);
 updated.set(entityId, {
 ...current,
 acceptedCategories: isAccepted
 ? current.acceptedCategories.filter(c => c !== category)
 : [...current.acceptedCategories, category]
 });

 return updated;
 });
 };

 const applyAllChanges = async () => {
 if (!onApplyChanges) return;

 const allChanges = Array.from(entityChanges.values());
 onApplyChanges(allChanges);

 // Learn from user feedback
 for (const change of allChanges) {
 const rejectedTags = change.suggestedTags.filter(tag => !change.acceptedTags.includes(tag));
 const rejectedCategories = change.suggestedCategories.filter(cat => !change.acceptedCategories.includes(cat));

 await smartCategorization.learnFromFeedback(
 change.entity,
 change.acceptedTags,
 rejectedTags,
 change.acceptedCategories
 );
 }
 };

 const getQualityColor = (score: number) => {
 if (score >= 0.8) return 'text-green-600';
 if (score >= 0.6) return 'text-yellow-600';
 return 'text-red-600';
 };

 const getQualityLabel = (score: number) => {
 if (score >= 0.8) return 'Excellent';
 if (score >= 0.6) return 'Good';
 return 'Needs Improvement';
 };

 const totalChanges = Array.from(entityChanges.values()).reduce(
 (acc, change) => acc + change.acceptedTags.length + change.acceptedCategories.length,
 0
 );

 return (
 <div className={cn("space-y-6", className)}>
 {/* Header */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Bot className="h-5 w-5" />
 AI-Powered Smart Categorization
 </CardTitle>
 <CardDescription>
 Automatically analyze entities and suggest relevant tags, categories, and quality improvements using machine learning.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Controls */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="flex items-center space-x-2">
 <Checkbox
 id="show-selected"
 checked={showOnlySelected}
 onCheckedChange={setShowOnlySelected}
 />
 <label htmlFor="show-selected" className="text-sm">
 Only analyze selected entities ({selectedEntities.length})
 </label>
 </div>

 <div className="flex items-center space-x-2">
 <Checkbox
 id="auto-apply"
 checked={autoApplyHighConfidence}
 onCheckedChange={setAutoApplyHighConfidence}
 />
 <label htmlFor="auto-apply" className="text-sm">
 Auto-accept high confidence suggestions (80%+)
 </label>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Button
 onClick={runAnalysis}
 disabled={analysisState.isAnalyzing || entitiesToAnalyze.length === 0}
 variant="outline"
 >
 {analysisState.isAnalyzing ? (
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 ) : (
 <Brain className="h-4 w-4 mr-2" />
 )}
 {analysisState.isAnalyzing ? 'Analyzing...' : 'Analyze Entities'}
 </Button>

 {totalChanges > 0 && (
 <Button onClick={applyAllChanges}>
 <Save className="h-4 w-4 mr-2" />
 Apply Changes ({totalChanges})
 </Button>
 )}
 </div>
 </div>

 {/* Progress Bar */}
 {analysisState.isAnalyzing && (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span>Analyzing entities...</span>
 <span>{analysisState.progress}%</span>
 </div>
 <Progress value={analysisState.progress} className="w-full" />
 </div>
 )}

 {/* Error Alert */}
 {analysisState.error && (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{analysisState.error}</AlertDescription>
 </Alert>
 )}

 {/* Summary Stats */}
 {analysisState.results.size > 0 && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="text-center">
 <div className="text-2xl font-bold">{analysisState.results.size}</div>
 <div className="text-xs text-muted-foreground">Entities Analyzed</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold text-blue-600">
 {Array.from(analysisState.results.values()).reduce(
 (acc, result) => acc + result.tags.length, 0
 )}
 </div>
 <div className="text-xs text-muted-foreground">Tag Suggestions</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold text-green-600">
 {Array.from(analysisState.results.values()).reduce(
 (acc, result) => acc + result.categories.length, 0
 )}
 </div>
 <div className="text-xs text-muted-foreground">Category Suggestions</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold text-purple-600">
 {Math.round(
 Array.from(analysisState.results.values()).reduce(
 (acc, result) => acc + (result.quality.completeness + result.quality.consistency) / 2, 0
 ) / analysisState.results.size * 100
 )}%
 </div>
 <div className="text-xs text-muted-foreground">Avg Quality Score</div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Results */}
 {analysisState.results.size > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5" />
 Analysis Results
 </CardTitle>
 <CardDescription>
 Review and accept AI suggestions for each entity. Changes will be applied when you click "Apply Changes".
 </CardDescription>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-[600px]">
 <Accordion type="multiple" className="space-y-2">
 {Array.from(entityChanges.entries()).map(([entityId, changes]) => {
 const analysis = analysisState.results.get(entityId);
 if (!analysis) return null;

 const hasChanges = changes.acceptedTags.length > 0 || changes.acceptedCategories.length > 0;

 return (
 <AccordionItem key={entityId} value={entityId} className="border rounded-lg">
 <AccordionTrigger className="px-4 hover:no-underline">
 <div className="flex items-center justify-between w-full mr-4">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2">
 <Badge variant="outline">{changes.entity.kind}</Badge>
 <span className="font-medium">{changes.entity.metadata.name}</span>
 </div>
 {hasChanges && (
 <Badge variant="secondary" className="gap-1">
 <CheckCheck className="h-3 w-3" />
 {changes.acceptedTags.length + changes.acceptedCategories.length} changes
 </Badge>
 )}
 </div>

 <div className="flex items-center gap-2">
 <div className="text-right">
 <div className={cn("text-sm font-medium", getQualityColor(changes.qualityScore))}>
 {getQualityLabel(changes.qualityScore)}
 </div>
 <div className="text-xs text-muted-foreground">
 {Math.round(changes.qualityScore * 100)}% quality
 </div>
 </div>
 <Progress 
 value={changes.qualityScore * 100} 
 className="w-16 h-2"
 />
 </div>
 </div>
 </AccordionTrigger>
 
 <AccordionContent className="px-4 pb-4">
 <div className="space-y-6">
 {/* Entity Info */}
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">
 {changes.entity.metadata.description || 'No description'}
 </p>
 {changes.entity.metadata.tags && changes.entity.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 <span className="text-xs text-muted-foreground">Current tags:</span>
 {changes.entity.metadata.tags.map(tag => (
 <Badge key={tag} variant="outline" className="text-xs">
 {tag}
 </Badge>
 ))}
 </div>
 )}
 </div>
 </div>

 <Separator />

 {/* Tag Suggestions */}
 {analysis.tags.length > 0 && (
 <div className="space-y-3">
 <h4 className="font-medium flex items-center gap-2">
 <Tag className="h-4 w-4" />
 Tag Suggestions
 </h4>
 <div className="space-y-2">
 {analysis.tags.map((tagSuggestion: any) => {
 const isAccepted = changes.acceptedTags.includes(tagSuggestion.tag);
 const isExisting = changes.entity.metadata.tags?.includes(tagSuggestion.tag);

 return (
 <div
 key={tagSuggestion.tag}
 className={cn(
 "flex items-center justify-between p-3 rounded-lg border transition-colors",
 isAccepted ? "bg-green-50 border-green-200" : "bg-muted/30",
 isExisting && "opacity-50"
 )}
 >
 <div className="flex items-center gap-3">
 <Checkbox
 checked={isAccepted}
 onCheckedChange={() => toggleTagAcceptance(entityId, tagSuggestion.tag)}
 disabled={isExisting}
 />
 <div>
 <div className="flex items-center gap-2">
 <Badge variant={isAccepted ? "default" : "secondary"}>
 {tagSuggestion.tag}
 </Badge>
 {isExisting && (
 <Badge variant="outline" className="text-xs">
 Already applied
 </Badge>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {tagSuggestion.reason}
 </p>
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm font-medium">
 {Math.round(tagSuggestion.confidence * 100)}%
 </div>
 <div className="text-xs text-muted-foreground">
 confidence
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Category Suggestions */}
 {analysis.categories.length > 0 && (
 <div className="space-y-3">
 <h4 className="font-medium flex items-center gap-2">
 <Layers className="h-4 w-4" />
 Category Suggestions
 </h4>
 <div className="space-y-2">
 {analysis.categories.map((categorySuggestion: any) => {
 const isAccepted = changes.acceptedCategories.includes(categorySuggestion.category);

 return (
 <div
 key={categorySuggestion.category}
 className={cn(
 "flex items-center justify-between p-3 rounded-lg border transition-colors",
 isAccepted ? "bg-blue-50 border-blue-200" : "bg-muted/30"
 )}
 >
 <div className="flex items-center gap-3">
 <Checkbox
 checked={isAccepted}
 onCheckedChange={() => toggleCategoryAcceptance(entityId, categorySuggestion.category)}
 />
 <div>
 <Badge variant={isAccepted ? "default" : "secondary"}>
 {categorySuggestion.category}
 </Badge>
 <div className="text-xs text-muted-foreground mt-1">
 {categorySuggestion.reasons.join(', ')}
 </div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm font-medium">
 {Math.round(categorySuggestion.confidence * 100)}%
 </div>
 <div className="text-xs text-muted-foreground">
 confidence
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Quality Recommendations */}
 {analysis.quality.recommendations.length > 0 && (
 <div className="space-y-3">
 <h4 className="font-medium flex items-center gap-2">
 <Target className="h-4 w-4" />
 Quality Recommendations
 </h4>
 <div className="space-y-2">
 {analysis.quality.recommendations.map((recommendation: string, index: number) => (
 <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
 <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
 <span className="text-sm">{recommendation}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </AccordionContent>
 </AccordionItem>
 );
 })}
 </Accordion>
 </ScrollArea>
 </CardContent>
 </Card>
 )}

 {/* No Results State */}
 {!analysisState.isAnalyzing && analysisState.results.size === 0 && (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12">
 <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
 <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
 <p className="text-muted-foreground text-center mb-4">
 Click "Analyze Entities" to start AI-powered categorization and get smart suggestions for your catalog entities.
 </p>
 <div className="text-sm text-muted-foreground">
 {entitiesToAnalyze.length} entities ready for analysis
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}