'use client';

import React from 'react';
import {
 TrendingUp,
 TrendingDown,
 Minus,
 Activity,
 Clock,
 ChevronRight,
 AlertCircle,
 CheckCircle2,
 XCircle,
 Info
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ServiceHealth {
 id: string;
 name: string;
 team: string;
 score: number;
 previousScore: number;
 checks: {
 passed: number;
 failed: number;
 total: number;
 };
 lastAssessment: string;
 trend: 'up' | 'down' | 'stable';
 criticalIssues: number;
}

interface CategoryScore {
 name: string;
 score: number;
 change: number;
 description: string;
}

export function SoundcheckOverview() {
 // Mock data - in real app, this would come from API
 const overallScore = 78;
 const scoreChange = 3.2;
 const totalServices = 42;
 const assessedServices = 38;
 
 const categoryScores: CategoryScore[] = [
 { name: 'Security', score: 92, change: 2.1, description: 'Authentication, authorization, and vulnerability management' },
 { name: 'Reliability', score: 85, change: -1.2, description: 'Uptime, error rates, and incident response' },
 { name: 'Performance', score: 78, change: 4.5, description: 'Response times, throughput, and resource usage' },
 { name: 'Documentation', score: 65, change: 8.3, description: 'API docs, runbooks, and knowledge sharing' },
 { name: 'Testing', score: 71, change: 0, description: 'Test coverage, quality, and automation' }
 ];

 const recentServices: ServiceHealth[] = [
 {
 id: 'user-service',
 name: 'User Service',
 team: 'Platform Team',
 score: 92,
 previousScore: 89,
 checks: { passed: 23, failed: 2, total: 25 },
 lastAssessment: '2 hours ago',
 trend: 'up',
 criticalIssues: 0
 },
 {
 id: 'payment-api',
 name: 'Payment API',
 team: 'Commerce Team',
 score: 78,
 previousScore: 82,
 checks: { passed: 18, failed: 7, total: 25 },
 lastAssessment: '4 hours ago',
 trend: 'down',
 criticalIssues: 2
 },
 {
 id: 'notification-service',
 name: 'Notification Service',
 team: 'Platform Team',
 score: 85,
 previousScore: 85,
 checks: { passed: 21, failed: 4, total: 25 },
 lastAssessment: '6 hours ago',
 trend: 'stable',
 criticalIssues: 1
 }
 ];

 const getScoreColor = (score: number) => {
 if (score >= 90) return 'text-success-600';
 if (score >= 75) return 'text-warning-600';
 if (score >= 60) return 'text-warning-700';
 return 'text-destructive';
 };

 const getScoreBackground = (score: number) => {
 if (score >= 90) return 'bg-success-50';
 if (score >= 75) return 'bg-warning-50';
 if (score >= 60) return 'bg-warning-100';
 return 'bg-destructive/10';
 };

 const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
 switch (trend) {
 case 'up':
 return <TrendingUp className="h-4 w-4 text-success-600" />;
 case 'down':
 return <TrendingDown className="h-4 w-4 text-destructive" />;
 default:
 return <Minus className="h-4 w-4 text-muted-foreground" />;
 }
 };

 const getChangeColor = (change: number) => {
 if (change > 0) return 'text-success-600';
 if (change < 0) return 'text-destructive';
 return 'text-muted-foreground';
 };

 return (
 <div className="space-y-6">
 {/* Hero Section */}
 <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-xl p-8 border border-primary-100 dark:border-gray-700">
 <div className="max-w-4xl">
 <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
 Service Quality Dashboard
 </h1>
 <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
 Monitor and improve the health of your services with automated quality checks and actionable insights.
 </p>
 
 {/* Key Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Health</span>
 <div className="flex items-center gap-1">
 {scoreChange > 0 ? (
 <TrendingUp className="h-4 w-4 text-success-600" />
 ) : (
 <TrendingDown className="h-4 w-4 text-destructive" />
 )}
 <span className={cn("text-sm font-medium", getChangeColor(scoreChange))}>
 {scoreChange > 0 ? '+' : ''}{scoreChange}%
 </span>
 </div>
 </div>
 <div className="flex items-baseline gap-2">
 <span className={cn("text-3xl font-bold", getScoreColor(overallScore))}>
 {overallScore}%
 </span>
 <span className="text-sm text-gray-500">health score</span>
 </div>
 <Progress value={overallScore} className="mt-3 h-2" />
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Coverage</span>
 <Activity className="h-4 w-4 text-primary-600" />
 </div>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-bold text-gray-900 dark:text-white">
 {assessedServices}/{totalServices}
 </span>
 <span className="text-sm text-gray-500">services</span>
 </div>
 <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
 {Math.round((assessedServices / totalServices) * 100)}% services monitored
 </div>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Issues</span>
 <AlertCircle className="h-4 w-4 text-destructive" />
 </div>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-bold text-destructive">
 3
 </span>
 <span className="text-sm text-gray-500">issues found</span>
 </div>
 <div className="mt-3">
 <Button variant="link" className="h-auto p-0 text-sm">
 View all issues 
 </Button>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Category Scores */}
 <Card>
 <CardHeader>
 <h2 className="text-xl font-semibold">Quality by Category</h2>
 <p className="text-sm text-muted-foreground">
 Track performance across key quality dimensions
 </p>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {categoryScores.map((category) => (
 <div key={category.name} className="space-y-2">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-medium">{category.name}</h3>
 <p className="text-sm text-muted-foreground">{category.description}</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1">
 {category.change !== 0 && (
 <>
 {category.change > 0 ? (
 <TrendingUp className="h-3 w-3 text-success-600" />
 ) : (
 <TrendingDown className="h-3 w-3 text-destructive" />
 )}
 <span className={cn("text-sm", getChangeColor(category.change))}>
 {category.change > 0 ? '+' : ''}{category.change}%
 </span>
 </>
 )}
 </div>
 <span className={cn("text-lg font-semibold", getScoreColor(category.score))}>
 {category.score}%
 </span>
 </div>
 </div>
 <Progress value={category.score} className="h-2" />
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Recent Services */}
 <Card>
 <CardHeader className="flex flex-row items-center justify-between">
 <div>
 <h2 className="text-xl font-semibold">Recent Assessments</h2>
 <p className="text-sm text-muted-foreground">
 Latest service health updates
 </p>
 </div>
 <Button variant="outline" size="sm">
 View all services
 </Button>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {recentServices.map((service) => (
 <div
 key={service.id}
 className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
 >
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-1">
 <h3 className="font-medium">{service.name}</h3>
 <span className="text-sm text-muted-foreground">{service.team}</span>
 </div>
 <div className="flex items-center gap-4 text-sm text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {service.lastAssessment}
 </div>
 <div className="flex items-center gap-2">
 <CheckCircle2 className="h-3 w-3 text-success-600" />
 <span>{service.checks.passed}</span>
 <XCircle className="h-3 w-3 text-destructive" />
 <span>{service.checks.failed}</span>
 </div>
 {service.criticalIssues > 0 && (
 <div className="flex items-center gap-1 text-destructive">
 <AlertCircle className="h-3 w-3" />
 <span>{service.criticalIssues} critical</span>
 </div>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-4">
 <div className="text-right">
 <div className="flex items-center gap-2">
 <span className={cn(
 "text-2xl font-bold",
 getScoreColor(service.score)
 )}>
 {service.score}%
 </span>
 {getTrendIcon(service.trend)}
 </div>
 </div>
 <ChevronRight className="h-5 w-5 text-gray-400" />
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Quick Actions */}
 <div className="bg-primary-50 dark:bg-gray-800 rounded-lg p-6 border border-primary-100 dark:border-gray-700">
 <div className="flex items-start gap-3">
 <Info className="h-5 w-5 text-primary-600 mt-0.5" />
 <div className="flex-1">
 <h3 className="font-medium text-gray-900 dark:text-white mb-1">
 Improve your service quality
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
 Run automated assessments to identify issues and get actionable recommendations for improvement.
 </p>
 <div className="flex gap-3">
 <Button size="sm">
 Run assessment
 </Button>
 <Button variant="outline" size="sm">
 View recommendations
 </Button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}