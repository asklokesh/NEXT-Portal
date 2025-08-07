'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Sparkles,
 TrendingUp,
 Users,
 Clock,
 Star,
 ArrowRight,
 RefreshCw,
 Target,
 Zap,
 ThumbsUp,
 ThumbsDown,
 BookOpen,
 Code,
 Lightbulb,
 Filter,
 X,
 ChevronRight
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useTemplatePreferences } from '@/hooks/useTemplatePreferences';
import { cn } from '@/lib/utils';
import { useTemplates } from '@/services/backstage/hooks/useScaffolder';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateRecommendationEngineProps {
 className?: string;
 maxRecommendations?: number;
 context?: {
 userRole?: 'developer' | 'architect' | 'lead' | 'admin';
 teamType?: 'frontend' | 'backend' | 'fullstack' | 'platform' | 'data';
 experienceLevel?: 'beginner' | 'intermediate' | 'expert';
 currentProject?: string;
 interests?: string[];
 };
}

interface Recommendation {
 template: TemplateEntity;
 score: number;
 reasons: RecommendationReason[];
 confidence: 'high' | 'medium' | 'low';
 category: 'trending' | 'personalized' | 'similar' | 'new' | 'popular';
}

interface RecommendationReason {
 type: 'usage_pattern' | 'team_preference' | 'technology_match' | 'project_similarity' | 'trending' | 'high_rating';
 description: string;
 weight: number;
}

interface UserProfile {
 favoriteTypes: string[];
 frequentTags: string[];
 recentTemplates: string[];
 teamTemplates: string[];
 skillLevel: Record<string, number>;
 projectHistory: Array<{
 templateRef: string;
 projectType: string;
 completionTime: string;
 satisfaction: number;
 }>;
}

const RECOMMENDATION_ALGORITHMS = {
 collaborative_filtering: {
 name: 'Collaborative Filtering',
 description: 'Based on similar users and teams',
 weight: 0.3,
 },
 content_based: {
 name: 'Content-Based',
 description: 'Based on template features and your preferences',
 weight: 0.25,
 },
 trending: {
 name: 'Trending Analysis',
 description: 'Based on recent popularity and adoption',
 weight: 0.2,
 },
 contextual: {
 name: 'Contextual',
 description: 'Based on your current project and role',
 weight: 0.25,
 },
};

const RecommendationCard: React.FC<{
 recommendation: Recommendation;
 onUse: (templateRef: string) => void;
 onFeedback: (templateRef: string, positive: boolean) => void;
 onDismiss: (templateRef: string) => void;
}> = ({ recommendation, onUse, onFeedback, onDismiss }) => {
 const [showReasons, setShowReasons] = useState(false);
 const { template, score, reasons, confidence, category } = recommendation;
 
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 
 const categoryConfig = {
 trending: { color: 'bg-green-100 text-green-800', icon: TrendingUp, label: 'Trending' },
 personalized: { color: 'bg-blue-100 text-blue-800', icon: Target, label: 'For You' },
 similar: { color: 'bg-purple-100 text-purple-800', icon: Users, label: 'Similar Teams' },
 new: { color: 'bg-yellow-100 text-yellow-800', icon: Sparkles, label: 'New' },
 popular: { color: 'bg-red-100 text-red-800', icon: Star, label: 'Popular' },
 };
 
 const config = categoryConfig[category];
 const CategoryIcon = config.icon;
 
 const confidenceColor = {
 high: 'text-green-600',
 medium: 'text-yellow-600',
 low: 'text-gray-600',
 };

 return (
 <div className="group bg-card rounded-lg border p-4 hover:shadow-md transition-all duration-200">
 {/* Header */}
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-medium">{template.metadata.title || template.metadata.name}</h3>
 <div className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
 <CategoryIcon className="w-3 h-3 inline mr-1" />
 {config.label}
 </div>
 </div>
 
 <p className="text-sm text-muted-foreground line-clamp-2">
 {template.metadata.description}
 </p>
 
 <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
 <span>Score: {Math.round(score * 100)}%</span>
 <span className={confidenceColor[confidence]}>
 {confidence} confidence
 </span>
 <span>{template.spec.type}</span>
 </div>
 </div>
 
 <button
 onClick={() => onDismiss(templateRef)}
 className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Tags */}
 {template.metadata.tags && template.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-3">
 {template.metadata.tags.slice(0, 3).map((tag) => (
 <span
 key={tag}
 className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 {template.metadata.tags.length > 3 && (
 <span className="text-xs text-muted-foreground">
 +{template.metadata.tags.length - 3}
 </span>
 )}
 </div>
 )}

 {/* Reasons */}
 <div className="mb-4">
 <button
 onClick={() => setShowReasons(!showReasons)}
 className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
 >
 <Lightbulb className="w-3 h-3" />
 Why recommended?
 <ChevronRight className={cn('w-3 h-3 transition-transform', showReasons && 'rotate-90')} />
 </button>
 
 {showReasons && (
 <div className="mt-2 space-y-1">
 {reasons.slice(0, 3).map((reason, index) => (
 <div key={index} className="flex items-center gap-2 text-xs">
 <div className="w-1 h-1 rounded-full bg-primary" />
 <span className="text-muted-foreground">{reason.description}</span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1">
 <button
 onClick={() => onFeedback(templateRef, true)}
 className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors"
 title="This recommendation is helpful"
 >
 <ThumbsUp className="w-3 h-3" />
 </button>
 <button
 onClick={() => onFeedback(templateRef, false)}
 className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
 title="This recommendation is not helpful"
 >
 <ThumbsDown className="w-3 h-3" />
 </button>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => console.log('View template:', templateRef)}
 className="text-sm text-muted-foreground hover:text-foreground transition-colors"
 >
 Learn More
 </button>
 <button
 onClick={() => onUse(templateRef)}
 className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
 >
 Use Template
 <ArrowRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 </div>
 );
};

export const TemplateRecommendationEngine: React.FC<TemplateRecommendationEngineProps> = ({
 className,
 maxRecommendations = 6,
 context = {},
}) => {
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [dismissedTemplates, setDismissedTemplates] = useState<Set<string>>(new Set());
 const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
 const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
 
 const { data: templates = [] } = useTemplates();
 const { recentlyUsed, favorites } = useTemplatePreferences();

 // Mock user profile - in real implementation, fetch from user service
 const userProfile: UserProfile = useMemo(() => ({
 favoriteTypes: ['service', 'website'],
 frequentTags: ['react', 'typescript', 'nodejs'],
 recentTemplates: recentlyUsed.map(item => item.templateRef),
 teamTemplates: [], // Templates used by user's team
 skillLevel: { frontend: 0.8, backend: 0.6, devops: 0.4 },
 projectHistory: [
 {
 templateRef: 'template:default/react-service',
 projectType: 'web-app',
 completionTime: '2024-01-15T10:00:00Z',
 satisfaction: 4.5,
 },
 ],
 }), [recentlyUsed]);

 // Generate recommendations using multiple algorithms
 const recommendations = useMemo((): Recommendation[] => {
 if (templates.length === 0) return [];

 const recommendations: Recommendation[] = [];
 
 templates.forEach(template => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 
 // Skip dismissed templates and already used templates
 if (dismissedTemplates.has(templateRef) || userProfile.recentTemplates.includes(templateRef)) {
 return;
 }

 let score = 0;
 const reasons: RecommendationReason[] = [];

 // Content-based filtering
 const templateTags = template.metadata.tags || [];
 const tagMatch = templateTags.filter(tag => 
 userProfile.frequentTags.includes(tag.toLowerCase())
 ).length / Math.max(templateTags.length, 1);
 
 if (tagMatch > 0) {
 score += tagMatch * 0.3;
 reasons.push({
 type: 'technology_match',
 description: `Matches your interests in ${templateTags.filter(tag => 
 userProfile.frequentTags.includes(tag.toLowerCase())
 ).join(', ')}`,
 weight: tagMatch,
 });
 }

 // Type preference
 if (userProfile.favoriteTypes.includes(template.spec.type)) {
 score += 0.25;
 reasons.push({
 type: 'usage_pattern',
 description: `You frequently use ${template.spec.type} templates`,
 weight: 0.25,
 });
 }

 // Context matching
 if (context.teamType) {
 const teamRelevance = {
 frontend: ['website', 'react', 'vue', 'angular'],
 backend: ['service', 'api', 'microservice'],
 fullstack: ['website', 'service', 'react', 'nodejs'],
 platform: ['infrastructure', 'kubernetes', 'terraform'],
 data: ['pipeline', 'analytics', 'etl'],
 };
 
 const relevantKeywords = teamRelevance[context.teamType] || [];
 const contextMatch = relevantKeywords.some(keyword =>
 template.metadata.name.toLowerCase().includes(keyword) ||
 template.metadata.description?.toLowerCase().includes(keyword) ||
 templateTags.some(tag => tag.toLowerCase().includes(keyword))
 );
 
 if (contextMatch) {
 score += 0.2;
 reasons.push({
 type: 'team_preference',
 description: `Relevant for ${context.teamType} teams`,
 weight: 0.2,
 });
 }
 }

 // Trending boost (mock)
 const isTrending = Math.random() > 0.7; // Mock trending detection
 if (isTrending) {
 score += 0.15;
 reasons.push({
 type: 'trending',
 description: 'Currently trending in your organization',
 weight: 0.15,
 });
 }

 // High rating boost (mock)
 const hasHighRating = Math.random() > 0.6; // Mock rating
 if (hasHighRating) {
 score += 0.1;
 reasons.push({
 type: 'high_rating',
 description: 'Highly rated by other developers',
 weight: 0.1,
 });
 }

 // Determine category and confidence
 let category: Recommendation['category'] = 'personalized';
 if (isTrending) category = 'trending';
 else if (hasHighRating) category = 'popular';
 else if (reasons.some(r => r.type === 'team_preference')) category = 'similar';

 const confidence: Recommendation['confidence'] = 
 score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';

 if (score > 0.1) { // Only include if minimum score threshold is met
 recommendations.push({
 template,
 score,
 reasons,
 confidence,
 category,
 });
 }
 });

 // Sort by score and limit results
 return recommendations
 .sort((a, b) => b.score - a.score)
 .slice(0, maxRecommendations);
 }, [templates, userProfile, dismissedTemplates, context, maxRecommendations]);

 // Filter recommendations by category
 const filteredRecommendations = useMemo(() => {
 if (selectedCategories.includes('all')) return recommendations;
 return recommendations.filter(rec => selectedCategories.includes(rec.category));
 }, [recommendations, selectedCategories]);

 const handleRefresh = async () => {
 setIsRefreshing(true);
 // Simulate API call to refresh recommendations
 await new Promise(resolve => setTimeout(resolve, 1000));
 setIsRefreshing(false);
 };

 const handleUseTemplate = (templateRef: string) => {
 console.log('Using template:', templateRef);
 // In real implementation, navigate to template execution
 };

 const handleFeedback = (templateRef: string, positive: boolean) => {
 setFeedbackGiven(prev => new Set(prev).add(templateRef));
 console.log('Feedback:', templateRef, positive ? 'positive' : 'negative');
 // In real implementation, send feedback to analytics service
 };

 const handleDismiss = (templateRef: string) => {
 setDismissedTemplates(prev => new Set(prev).add(templateRef));
 };

 const toggleCategory = (category: string) => {
 if (category === 'all') {
 setSelectedCategories(['all']);
 } else {
 const newCategories = selectedCategories.includes('all') 
 ? [category]
 : selectedCategories.includes(category)
 ? selectedCategories.filter(c => c !== category)
 : [...selectedCategories.filter(c => c !== 'all'), category];
 
 setSelectedCategories(newCategories.length === 0 ? ['all'] : newCategories);
 }
 };

 const categories = [
 { id: 'all', label: 'All', icon: Filter },
 { id: 'personalized', label: 'For You', icon: Target },
 { id: 'trending', label: 'Trending', icon: TrendingUp },
 { id: 'popular', label: 'Popular', icon: Star },
 { id: 'similar', label: 'Similar Teams', icon: Users },
 { id: 'new', label: 'New', icon: Sparkles },
 ];

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Sparkles className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-2xl font-bold">Recommended Templates</h2>
 <p className="text-sm text-muted-foreground">
 Personalized suggestions based on your preferences and team patterns
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={handleRefresh}
 disabled={isRefreshing}
 className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent disabled:opacity-50"
 >
 <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
 Refresh
 </button>
 </div>
 </div>

 {/* Category filters */}
 <div className="flex flex-wrap gap-2">
 {categories.map(category => {
 const Icon = category.icon;
 const isSelected = selectedCategories.includes(category.id);
 
 return (
 <button
 key={category.id}
 onClick={() => toggleCategory(category.id)}
 className={cn(
 'flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors',
 isSelected
 ? 'bg-primary text-primary-foreground'
 : 'bg-secondary hover:bg-secondary/80'
 )}
 >
 <Icon className="w-3 h-3" />
 {category.label}
 </button>
 );
 })}
 </div>

 {/* Algorithm info */}
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <div className="flex items-start gap-2">
 <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-blue-800 mb-1">Smart Recommendations</p>
 <p className="text-blue-700">
 Powered by machine learning algorithms analyzing your usage patterns, team preferences, 
 and current trends. Recommendations improve over time as you provide feedback.
 </p>
 </div>
 </div>
 </div>

 {/* Recommendations */}
 {filteredRecommendations.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {filteredRecommendations.map((recommendation) => (
 <RecommendationCard
 key={`${recommendation.template.kind}:${recommendation.template.metadata.namespace || 'default'}/${recommendation.template.metadata.name}`}
 recommendation={recommendation}
 onUse={handleUseTemplate}
 onFeedback={handleFeedback}
 onDismiss={handleDismiss}
 />
 ))}
 </div>
 ) : (
 <div className="text-center py-12">
 <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No recommendations available</h3>
 <p className="text-muted-foreground max-w-md mx-auto">
 {selectedCategories.length > 1 || !selectedCategories.includes('all')
 ? 'Try adjusting your category filters to see more recommendations.'
 : 'Start using templates to get personalized recommendations based on your preferences.'
 }
 </p>
 {selectedCategories.length > 1 || !selectedCategories.includes('all') ? (
 <button
 onClick={() => setSelectedCategories(['all'])}
 className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 Show All Recommendations
 </button>
 ) : (
 <button
 onClick={handleRefresh}
 className="mt-4 px-4 py-2 rounded-md border border-border hover:bg-accent"
 >
 <RefreshCw className="w-4 h-4 mr-2" />
 Refresh Recommendations
 </button>
 )}
 </div>
 )}

 {/* Algorithm explanation */}
 <div className="bg-card rounded-lg border p-4">
 <h4 className="font-medium mb-3 flex items-center gap-2">
 <BookOpen className="w-4 h-4" />
 How Recommendations Work
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
 {Object.entries(RECOMMENDATION_ALGORITHMS).map(([key, algorithm]) => (
 <div key={key} className="flex items-start gap-2">
 <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
 <div>
 <p className="font-medium">{algorithm.name}</p>
 <p className="text-muted-foreground">{algorithm.description}</p>
 <p className="text-xs text-muted-foreground mt-1">
 Weight: {Math.round(algorithm.weight * 100)}%
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};