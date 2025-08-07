'use client';

import React from 'react';
import {
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 Lightbulb,
 Target,
 Users,
 GitBranch,
 Clock,
 ArrowRight,
 CheckCircle2,
 XCircle,
 Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Insight {
 id: string;
 type: 'improvement' | 'warning' | 'achievement' | 'trend';
 title: string;
 description: string;
 impact: 'high' | 'medium' | 'low';
 category: string;
 affectedServices: string[];
 metrics?: {
 current: number;
 previous: number;
 target?: number;
 };
 actions?: {
 label: string;
 href: string;
 }[];
}

interface TeamPerformance {
 team: string;
 score: number;
 change: number;
 services: number;
 topIssues: string[];
}

export function SoundcheckInsights() {
 // Mock insights data
 const insights: Insight[] = [
 {
 id: '1',
 type: 'warning',
 title: 'Security Scores Declining',
 description: '3 services have shown a 15% decrease in security checks over the past week',
 impact: 'high',
 category: 'security',
 affectedServices: ['payment-api', 'user-service', 'auth-service'],
 metrics: {
 current: 72,
 previous: 87
 },
 actions: [
 { label: 'View Security Report', href: '#' },
 { label: 'Run Security Scan', href: '#' }
 ]
 },
 {
 id: '2',
 type: 'improvement',
 title: 'Documentation Coverage Opportunity',
 description: '8 services could improve their score by 10+ points by adding API documentation',
 impact: 'medium',
 category: 'documentation',
 affectedServices: ['analytics-service', 'notification-service', 'search-api'],
 metrics: {
 current: 65,
 target: 85
 },
 actions: [
 { label: 'Generate Docs Template', href: '#' }
 ]
 },
 {
 id: '3',
 type: 'achievement',
 title: 'Platform Team Excellence',
 description: 'All Platform Team services maintain 90%+ quality scores for 30 days',
 impact: 'high',
 category: 'team',
 affectedServices: ['user-service', 'notification-service', 'config-service'],
 metrics: {
 current: 94,
 previous: 91
 }
 },
 {
 id: '4',
 type: 'trend',
 title: 'Test Coverage Improving',
 description: 'Overall test coverage increased by 12% this month across all services',
 impact: 'medium',
 category: 'testing',
 affectedServices: [],
 metrics: {
 current: 78,
 previous: 66,
 target: 80
 }
 }
 ];

 const teamPerformance: TeamPerformance[] = [
 {
 team: 'Platform Team',
 score: 92,
 change: 3,
 services: 5,
 topIssues: ['Missing health checks', 'Outdated dependencies']
 },
 {
 team: 'Commerce Team',
 score: 78,
 change: -5,
 services: 4,
 topIssues: ['Low test coverage', 'Security vulnerabilities', 'Performance issues']
 },
 {
 team: 'Data Team',
 score: 85,
 change: 2,
 services: 3,
 topIssues: ['Documentation gaps', 'Missing monitoring']
 }
 ];

 const commonIssues = [
 { issue: 'Missing API Documentation', count: 12, change: -2 },
 { issue: 'Low Test Coverage', count: 8, change: -3 },
 { issue: 'No Health Check Endpoint', count: 7, change: 1 },
 { issue: 'Security Headers Missing', count: 6, change: 0 },
 { issue: 'Outdated Dependencies', count: 5, change: 2 }
 ];

 const getInsightIcon = (type: string) => {
 switch (type) {
 case 'warning':
 return AlertTriangle;
 case 'improvement':
 return Lightbulb;
 case 'achievement':
 return Target;
 case 'trend':
 return TrendingUp;
 default:
 return Sparkles;
 }
 };

 const getInsightColor = (type: string) => {
 switch (type) {
 case 'warning':
 return 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20';
 case 'improvement':
 return 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20';
 case 'achievement':
 return 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20';
 case 'trend':
 return 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20';
 default:
 return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
 }
 };

 const getImpactBadgeVariant = (impact: string): "default" | "secondary" | "outline" => {
 switch (impact) {
 case 'high':
 return 'default';
 case 'medium':
 return 'secondary';
 default:
 return 'outline';
 }
 };

 return (
 <div className="space-y-6">
 {/* Key Insights */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-semibold">Key Insights</h2>
 <Badge variant="secondary" className="gap-1">
 <Sparkles className="h-3 w-3" />
 AI-Powered
 </Badge>
 </div>
 
 <div className="grid gap-4">
 {insights.map((insight) => {
 const Icon = getInsightIcon(insight.type);
 
 return (
 <Card
 key={insight.id}
 className={cn(
 "border-l-4 transition-all hover:shadow-md",
 getInsightColor(insight.type)
 )}
 >
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <Icon className="h-5 w-5 mt-0.5 text-gray-600 dark:text-gray-400" />
 <div>
 <CardTitle className="text-base">{insight.title}</CardTitle>
 <CardDescription className="mt-1">
 {insight.description}
 </CardDescription>
 </div>
 </div>
 <Badge variant={getImpactBadgeVariant(insight.impact)}>
 {insight.impact} impact
 </Badge>
 </div>
 </CardHeader>
 
 <CardContent className="space-y-3">
 {insight.metrics && (
 <div className="flex items-center gap-4">
 <div className="flex-1">
 <div className="flex items-center justify-between text-sm mb-1">
 <span className="text-muted-foreground">Progress</span>
 <span className="font-medium">
 {insight.metrics.current}%
 {insight.metrics.target && ` / ${insight.metrics.target}%`}
 </span>
 </div>
 <Progress
 value={insight.metrics.current}
 className="h-2"
 />
 </div>
 {insight.metrics.previous && (
 <div className="flex items-center gap-1 text-sm">
 {insight.metrics.current > insight.metrics.previous ? (
 <TrendingUp className="h-4 w-4 text-success-600" />
 ) : (
 <TrendingDown className="h-4 w-4 text-destructive" />
 )}
 <span className={cn(
 "font-medium",
 insight.metrics.current > insight.metrics.previous
 ? "text-success-600"
 : "text-destructive"
 )}>
 {insight.metrics.current > insight.metrics.previous ? '+' : ''}
 {insight.metrics.current - insight.metrics.previous}%
 </span>
 </div>
 )}
 </div>
 )}
 
 {insight.affectedServices.length > 0 && (
 <div className="flex items-center gap-2 text-sm">
 <GitBranch className="h-4 w-4 text-muted-foreground" />
 <span className="text-muted-foreground">Affects:</span>
 <div className="flex gap-1 flex-wrap">
 {insight.affectedServices.slice(0, 3).map(service => (
 <Badge key={service} variant="outline" className="text-xs">
 {service}
 </Badge>
 ))}
 {insight.affectedServices.length > 3 && (
 <Badge variant="outline" className="text-xs">
 +{insight.affectedServices.length - 3} more
 </Badge>
 )}
 </div>
 </div>
 )}
 
 {insight.actions && (
 <div className="flex gap-2 pt-2">
 {insight.actions.map((action, index) => (
 <Button
 key={index}
 size="sm"
 variant={index === 0 ? "default" : "outline"}
 >
 {action.label}
 <ArrowRight className="h-3 w-3 ml-1" />
 </Button>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 );
 })}
 </div>
 </div>

 {/* Team Performance */}
 <Card>
 <CardHeader>
 <CardTitle>Team Performance</CardTitle>
 <CardDescription>
 Quality scores and trends by team
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {teamPerformance.map((team) => (
 <div key={team.team} className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Users className="h-4 w-4 text-muted-foreground" />
 <div>
 <p className="font-medium">{team.team}</p>
 <p className="text-sm text-muted-foreground">
 {team.services} services
 </p>
 </div>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-2">
 <span className="text-2xl font-bold">{team.score}%</span>
 <div className="flex items-center gap-1">
 {team.change > 0 ? (
 <TrendingUp className="h-4 w-4 text-success-600" />
 ) : (
 <TrendingDown className="h-4 w-4 text-destructive" />
 )}
 <span className={cn(
 "text-sm",
 team.change > 0 ? "text-success-600" : "text-destructive"
 )}>
 {team.change > 0 ? '+' : ''}{team.change}%
 </span>
 </div>
 </div>
 </div>
 </div>
 <Progress value={team.score} className="h-2" />
 <div className="flex gap-2 flex-wrap">
 {team.topIssues.map(issue => (
 <Badge key={issue} variant="outline" className="text-xs">
 {issue}
 </Badge>
 ))}
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Common Issues */}
 <Card>
 <CardHeader>
 <CardTitle>Most Common Issues</CardTitle>
 <CardDescription>
 Top quality issues across all services
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {commonIssues.map((item, index) => (
 <div key={index} className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium">
 {index + 1}
 </div>
 <span className="text-sm">{item.issue}</span>
 </div>
 <div className="flex items-center gap-3">
 <Badge variant="secondary">
 {item.count} services
 </Badge>
 {item.change !== 0 && (
 <div className="flex items-center gap-1">
 {item.change > 0 ? (
 <TrendingUp className="h-3 w-3 text-destructive" />
 ) : (
 <TrendingDown className="h-3 w-3 text-success-600" />
 )}
 <span className={cn(
 "text-xs",
 item.change > 0 ? "text-destructive" : "text-success-600"
 )}>
 {item.change > 0 ? '+' : ''}{item.change}
 </span>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>
 );
}