'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/lib/date-extensions';
import {
 ArrowLeft,
 Activity,
 Shield,
 Zap,
 FileText,
 Target,
 Cloud,
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 CheckCircle2,
 XCircle,
 Clock,
 Users,
 GitBranch,
 ExternalLink,
 Download,
 Play,
 RefreshCw,
 Calendar,
 ChevronRight,
 Info,
 Lightbulb,
 Trophy
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ServiceHealthDetailProps {
 serviceId: string;
}

export function ServiceHealthDetail({ serviceId }: ServiceHealthDetailProps) {
 const router = useRouter();
 const [isRunningCheck, setIsRunningCheck] = useState(false);

 // Mock service data - in real app, fetch based on serviceId
 const service = {
 id: serviceId,
 name: 'User Service',
 description: 'Core authentication and user management service',
 team: 'Platform Team',
 owner: 'jane.doe@company.com',
 repository: 'https://github.com/company/user-service',
 documentation: 'https://docs.company.com/user-service',
 score: 92,
 previousScore: 89,
 trend: 'up' as const,
 lastAssessment: new Date('2024-08-04T20:00:00'),
 nextAssessment: new Date('2024-08-05T20:00:00'),
 certification: 'gold' as const,
 categories: {
 security: { score: 95, passed: 11, total: 12 },
 reliability: { score: 88, passed: 7, total: 8 },
 performance: { score: 92, passed: 5, total: 6 },
 documentation: { score: 85, passed: 6, total: 7 },
 testing: { score: 94, passed: 7, total: 8 },
 infrastructure: { score: 90, passed: 3, total: 4 }
 }
 };

 const failedChecks = [
 {
 id: 'sec-003',
 name: 'HTTPS Only',
 category: 'security',
 severity: 'high',
 description: 'All endpoints should enforce HTTPS',
 failureReason: 'HTTP endpoint found at /health',
 impact: 'Potential data exposure over unencrypted connection',
 remediation: {
 steps: [
 'Update nginx configuration to redirect HTTP to HTTPS',
 'Add HSTS header to enforce HTTPS',
 'Update health check endpoint to use HTTPS',
 'Test all endpoints with SSL Labs'
 ],
 estimatedTime: '30 minutes',
 difficulty: 'easy',
 resources: [
 { title: 'HTTPS Configuration Guide', url: '#' },
 { title: 'Security Best Practices', url: '#' }
 ]
 }
 },
 {
 id: 'rel-002',
 name: 'Circuit Breaker Pattern',
 category: 'reliability',
 severity: 'medium',
 description: 'External service calls should use circuit breaker pattern',
 failureReason: 'No circuit breaker configured for payment service calls',
 impact: 'Cascading failures possible during payment service outages',
 remediation: {
 steps: [
 'Install circuit breaker library (e.g., Hystrix, Resilience4j)',
 'Configure circuit breaker for payment service client',
 'Add fallback mechanism for payment failures',
 'Test circuit breaker behavior under load'
 ],
 estimatedTime: '2-3 hours',
 difficulty: 'medium',
 resources: [
 { title: 'Circuit Breaker Pattern', url: '#' },
 { title: 'Resilience Patterns', url: '#' }
 ]
 }
 }
 ];

 const timeline = [
 { date: '2024-08-04', event: 'Gold certification achieved', type: 'achievement' },
 { date: '2024-08-03', event: 'Fixed critical security vulnerability', type: 'fix' },
 { date: '2024-08-01', event: 'Performance optimization deployed', type: 'improvement' },
 { date: '2024-07-28', event: 'New monitoring alerts configured', type: 'update' },
 { date: '2024-07-25', event: 'Test coverage increased to 94%', type: 'improvement' }
 ];

 const recommendations = [
 {
 priority: 'high',
 title: 'Enable distributed tracing',
 description: 'Add OpenTelemetry instrumentation for better observability',
 impact: '+5 points in monitoring category',
 effort: 'medium'
 },
 {
 priority: 'medium',
 title: 'Add API rate limiting',
 description: 'Implement rate limiting to prevent API abuse',
 impact: '+3 points in security category',
 effort: 'low'
 },
 {
 priority: 'low',
 title: 'Improve error messages',
 description: 'Make error responses more helpful for API consumers',
 impact: '+2 points in documentation category',
 effort: 'low'
 }
 ];

 const getCategoryIcon = (category: string) => {
 const icons: Record<string, any> = {
 security: Shield,
 reliability: Activity,
 performance: Zap,
 documentation: FileText,
 testing: Target,
 infrastructure: Cloud
 };
 return icons[category] || CheckCircle2;
 };

 const getCertificationColor = (cert: string) => {
 const colors = {
 bronze: 'bg-amber-100 text-amber-700 border-amber-200',
 silver: 'bg-gray-100 text-gray-700 border-gray-300',
 gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
 platinum: 'bg-purple-100 text-purple-700 border-purple-300'
 };
 return colors[cert as keyof typeof colors] || '';
 };

 const handleRunCheck = async () => {
 setIsRunningCheck(true);
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 2000));
 setIsRunningCheck(false);
 };

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
 <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
 <div className="container mx-auto px-4 py-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => router.push('/soundcheck')}
 >
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <div>
 <div className="flex items-center gap-3">
 <h1 className="text-2xl font-bold">{service.name}</h1>
 <Badge className={cn("capitalize", getCertificationColor(service.certification))}>
 {service.certification} certified
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
 </div>
 </div>
 
 <div className="flex items-center gap-3">
 <Button variant="outline" size="sm">
 <Download className="h-4 w-4 mr-2" />
 Export Report
 </Button>
 <Button 
 size="sm"
 onClick={handleRunCheck}
 disabled={isRunningCheck}
 >
 {isRunningCheck ? (
 <>
 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
 Running...
 </>
 ) : (
 <>
 <Play className="h-4 w-4 mr-2" />
 Run Check
 </>
 )}
 </Button>
 </div>
 </div>
 </div>
 </div>

 <div className="container mx-auto px-4 py-6 space-y-6">
 {/* Health Score Overview */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Card className="lg:col-span-2">
 <CardHeader>
 <CardTitle>Health Score Overview</CardTitle>
 <CardDescription>
 Current health status and recent trends
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between mb-6">
 <div>
 <div className="flex items-baseline gap-3">
 <span className="text-5xl font-bold text-success-600">{service.score}%</span>
 <div className="flex items-center gap-1">
 <TrendingUp className="h-5 w-5 text-success-600" />
 <span className="text-lg text-success-600">+{service.score - service.previousScore}%</span>
 </div>
 </div>
 <p className="text-sm text-muted-foreground mt-1">
 Last assessed {service.lastAssessment.toRelativeTimeString()}
 </p>
 </div>
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Next assessment</p>
 <p className="font-medium">{service.nextAssessment.toLocaleDateString()}</p>
 </div>
 </div>

 <div className="space-y-4">
 {Object.entries(service.categories).map(([category, data]) => {
 const Icon = getCategoryIcon(category);
 return (
 <div key={category} className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Icon className="h-4 w-4 text-muted-foreground" />
 <span className="capitalize font-medium">{category}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground">
 {data.passed}/{data.total} passed
 </span>
 <span className="font-semibold">{data.score}%</span>
 </div>
 </div>
 <Progress value={data.score} className="h-2" />
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Service Information</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <p className="text-sm text-muted-foreground">Team</p>
 <p className="font-medium flex items-center gap-1">
 <Users className="h-4 w-4" />
 {service.team}
 </p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Owner</p>
 <p className="font-medium">{service.owner}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Repository</p>
 <a 
 href={service.repository}
 className="font-medium text-primary hover:underline flex items-center gap-1"
 >
 <GitBranch className="h-4 w-4" />
 View on GitHub
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Documentation</p>
 <a 
 href={service.documentation}
 className="font-medium text-primary hover:underline flex items-center gap-1"
 >
 <FileText className="h-4 w-4" />
 View Docs
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Tabs for detailed information */}
 <Tabs defaultValue="issues" className="space-y-4">
 <TabsList>
 <TabsTrigger value="issues">
 <AlertTriangle className="h-4 w-4 mr-2" />
 Issues ({failedChecks.length})
 </TabsTrigger>
 <TabsTrigger value="recommendations">
 <Lightbulb className="h-4 w-4 mr-2" />
 Recommendations
 </TabsTrigger>
 <TabsTrigger value="timeline">
 <Calendar className="h-4 w-4 mr-2" />
 Timeline
 </TabsTrigger>
 </TabsList>

 <TabsContent value="issues" className="space-y-4">
 {failedChecks.map((check) => {
 const Icon = getCategoryIcon(check.category);
 return (
 <Card key={check.id}>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-destructive/10 rounded-lg">
 <Icon className="h-5 w-5 text-destructive" />
 </div>
 <div>
 <CardTitle className="text-lg">{check.name}</CardTitle>
 <CardDescription>{check.description}</CardDescription>
 <div className="flex items-center gap-2 mt-2">
 <Badge variant="destructive" className="text-xs">
 {check.severity}
 </Badge>
 <Badge variant="outline" className="text-xs capitalize">
 {check.category}
 </Badge>
 </div>
 </div>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <div className="flex items-start gap-2">
 <XCircle className="h-4 w-4 text-destructive mt-0.5" />
 <div>
 <p className="text-sm font-medium">Failure Reason</p>
 <p className="text-sm text-muted-foreground">{check.failureReason}</p>
 </div>
 </div>
 <div className="flex items-start gap-2">
 <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
 <div>
 <p className="text-sm font-medium">Impact</p>
 <p className="text-sm text-muted-foreground">{check.impact}</p>
 </div>
 </div>
 </div>

 <div className="border-t pt-4">
 <h4 className="font-medium mb-3 flex items-center gap-2">
 <Info className="h-4 w-4" />
 How to Fix
 </h4>
 <div className="space-y-3">
 <div className="flex items-center gap-4 text-sm">
 <Badge variant="outline">
 {check.remediation.estimatedTime}
 </Badge>
 <Badge variant="outline" className={cn(
 check.remediation.difficulty === 'easy' && 'border-success-200 text-success-700',
 check.remediation.difficulty === 'medium' && 'border-warning-200 text-warning-700',
 check.remediation.difficulty === 'hard' && 'border-destructive-200 text-destructive'
 )}>
 {check.remediation.difficulty}
 </Badge>
 </div>
 <ol className="list-decimal list-inside space-y-1 text-sm">
 {check.remediation.steps.map((step, index) => (
 <li key={index}>{step}</li>
 ))}
 </ol>
 {check.remediation.resources.length > 0 && (
 <div className="flex gap-2 pt-2">
 {check.remediation.resources.map((resource, index) => (
 <Button key={index} variant="outline" size="sm" asChild>
 <a href={resource.url}>
 {resource.title}
 <ExternalLink className="h-3 w-3 ml-1" />
 </a>
 </Button>
 ))}
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </TabsContent>

 <TabsContent value="recommendations" className="space-y-4">
 {recommendations.map((rec, index) => (
 <Card key={index}>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="text-lg">{rec.title}</CardTitle>
 <CardDescription>{rec.description}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Badge 
 variant={rec.priority === 'high' ? 'default' : rec.priority === 'medium' ? 'secondary' : 'outline'}
 >
 {rec.priority} priority
 </Badge>
 <Badge variant="outline">
 {rec.effort} effort
 </Badge>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="flex items-center gap-2 text-sm text-success-600">
 <TrendingUp className="h-4 w-4" />
 <span className="font-medium">{rec.impact}</span>
 </div>
 <Button className="mt-4" size="sm">
 Start Implementation
 <ChevronRight className="h-4 w-4 ml-1" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </TabsContent>

 <TabsContent value="timeline" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Recent Activity</CardTitle>
 <CardDescription>
 Service health events and milestones
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {timeline.map((event, index) => (
 <div key={index} className="flex gap-4">
 <div className="relative">
 <div className={cn(
 "w-10 h-10 rounded-full flex items-center justify-center",
 event.type === 'achievement' && "bg-success-100",
 event.type === 'fix' && "bg-blue-100",
 event.type === 'improvement' && "bg-purple-100",
 event.type === 'update' && "bg-gray-100"
 )}>
 {event.type === 'achievement' && <Trophy className="h-5 w-5 text-success-600" />}
 {event.type === 'fix' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
 {event.type === 'improvement' && <TrendingUp className="h-5 w-5 text-purple-600" />}
 {event.type === 'update' && <Info className="h-5 w-5 text-gray-600" />}
 </div>
 {index < timeline.length - 1 && (
 <div className="absolute top-10 left-5 w-0.5 h-12 bg-gray-200" />
 )}
 </div>
 <div className="flex-1">
 <p className="font-medium">{event.event}</p>
 <p className="text-sm text-muted-foreground">{event.date}</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}