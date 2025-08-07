'use client';

import React, { useState } from 'react';
import {
 Shield,
 CheckCircle2,
 Activity,
 Settings,
 FileText,
 Target,
 Cloud,
 GitBranch,
 Lock,
 Zap,
 Search,
 Plus,
 Info,
 AlertTriangle,
 Code,
 Database,
 Users,
 Package
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Check {
 id: string;
 name: string;
 description: string;
 category: string;
 severity: 'critical' | 'high' | 'medium' | 'low';
 automated: boolean;
 enabled: boolean;
 passRate: number;
 lastRun?: string;
 documentation?: string;
 remediation?: {
 steps: string[];
 estimatedTime: string;
 difficulty: 'easy' | 'medium' | 'hard';
 };
}

export function SoundcheckChecks() {
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState('all');
 const [selectedCheck, setSelectedCheck] = useState<Check | null>(null);

 // Category configuration
 const categories = [
 { id: 'all', name: 'All Checks', icon: CheckCircle2, count: 45 },
 { id: 'security', name: 'Security', icon: Shield, count: 12 },
 { id: 'reliability', name: 'Reliability', icon: Activity, count: 8 },
 { id: 'performance', name: 'Performance', icon: Zap, count: 6 },
 { id: 'documentation', name: 'Documentation', icon: FileText, count: 7 },
 { id: 'testing', name: 'Testing', icon: Target, count: 8 },
 { id: 'infrastructure', name: 'Infrastructure', icon: Cloud, count: 4 }
 ];

 // Mock checks data
 const checks: Check[] = [
 {
 id: 'sec-001',
 name: 'API Authentication Required',
 description: 'Ensures all API endpoints require proper authentication',
 category: 'security',
 severity: 'critical',
 automated: true,
 enabled: true,
 passRate: 92,
 lastRun: '2 hours ago',
 remediation: {
 steps: [
 'Review all API endpoints in your service',
 'Add authentication middleware to unprotected endpoints',
 'Verify authentication is properly configured',
 'Run security tests to confirm protection'
 ],
 estimatedTime: '1-2 hours',
 difficulty: 'medium'
 }
 },
 {
 id: 'sec-002',
 name: 'Secrets Not in Code',
 description: 'Verifies no secrets or API keys are hardcoded in the repository',
 category: 'security',
 severity: 'critical',
 automated: true,
 enabled: true,
 passRate: 98,
 lastRun: '2 hours ago'
 },
 {
 id: 'rel-001',
 name: 'Health Check Endpoint',
 description: 'Service exposes a health check endpoint for monitoring',
 category: 'reliability',
 severity: 'high',
 automated: true,
 enabled: true,
 passRate: 85,
 lastRun: '2 hours ago',
 remediation: {
 steps: [
 'Create a /health endpoint in your service',
 'Include basic service health checks',
 'Add dependency checks (database, external services)',
 'Document the health check response format'
 ],
 estimatedTime: '30 minutes',
 difficulty: 'easy'
 }
 },
 {
 id: 'doc-001',
 name: 'README Exists',
 description: 'Repository contains a comprehensive README file',
 category: 'documentation',
 severity: 'medium',
 automated: true,
 enabled: true,
 passRate: 78,
 lastRun: '1 day ago'
 },
 {
 id: 'test-001',
 name: 'Minimum Test Coverage',
 description: 'Code has at least 80% test coverage',
 category: 'testing',
 severity: 'high',
 automated: true,
 enabled: true,
 passRate: 72,
 lastRun: '2 hours ago'
 },
 {
 id: 'perf-001',
 name: 'Response Time SLA',
 description: 'API response times meet defined SLA requirements',
 category: 'performance',
 severity: 'high',
 automated: true,
 enabled: true,
 passRate: 88,
 lastRun: '1 hour ago'
 }
 ];

 const getCategoryIcon = (categoryId: string) => {
 const category = categories.find(c => c.id === categoryId);
 return category?.icon || CheckCircle2;
 };

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical':
 return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
 case 'high':
 return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400';
 case 'medium':
 return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
 case 'low':
 return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
 default:
 return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
 }
 };

 const getPassRateColor = (rate: number) => {
 if (rate >= 90) return 'text-success-600';
 if (rate >= 75) return 'text-warning-600';
 return 'text-destructive';
 };

 const filteredChecks = checks.filter(check => {
 const matchesSearch = check.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 check.description.toLowerCase().includes(searchQuery.toLowerCase());
 const matchesCategory = selectedCategory === 'all' || check.category === selectedCategory;
 return matchesSearch && matchesCategory;
 });

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row gap-4 justify-between">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search checks..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 
 <Button>
 <Plus className="h-4 w-4 mr-2" />
 Create Check
 </Button>
 </div>

 {/* Category Tabs */}
 <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
 <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
 {categories.map((category) => {
 const Icon = category.icon;
 return (
 <TabsTrigger
 key={category.id}
 value={category.id}
 className="flex flex-col gap-1 h-auto py-2"
 >
 <Icon className="h-4 w-4" />
 <span className="text-xs">{category.name}</span>
 <Badge variant="secondary" className="h-5 px-1 text-xs">
 {category.count}
 </Badge>
 </TabsTrigger>
 );
 })}
 </TabsList>

 <TabsContent value={selectedCategory} className="mt-6">
 <div className="grid gap-4">
 {filteredChecks.map((check) => {
 const Icon = getCategoryIcon(check.category);
 
 return (
 <Card
 key={check.id}
 className="hover:shadow-md transition-shadow cursor-pointer"
 onClick={() => setSelectedCheck(check)}
 >
 <CardHeader className="pb-4">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
 <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
 </div>
 <div className="space-y-1">
 <CardTitle className="text-base">{check.name}</CardTitle>
 <CardDescription>{check.description}</CardDescription>
 <div className="flex items-center gap-2 pt-2">
 <Badge className={cn("text-xs", getSeverityColor(check.severity))}>
 {check.severity}
 </Badge>
 {check.automated && (
 <Badge variant="outline" className="text-xs">
 Automated
 </Badge>
 )}
 <Badge
 variant={check.enabled ? "default" : "secondary"}
 className="text-xs"
 >
 {check.enabled ? 'Enabled' : 'Disabled'}
 </Badge>
 </div>
 </div>
 </div>
 <div className="text-right">
 <div className={cn("text-2xl font-bold", getPassRateColor(check.passRate))}>
 {check.passRate}%
 </div>
 <p className="text-xs text-muted-foreground">pass rate</p>
 {check.lastRun && (
 <p className="text-xs text-muted-foreground mt-1">
 {check.lastRun}
 </p>
 )}
 </div>
 </div>
 </CardHeader>
 </Card>
 );
 })}
 </div>
 </TabsContent>
 </Tabs>

 {/* Check Details Dialog */}
 <Dialog open={!!selectedCheck} onOpenChange={(open) => !open && setSelectedCheck(null)}>
 <DialogContent className="max-w-2xl">
 {selectedCheck && (
 <>
 <DialogHeader>
 <DialogTitle>{selectedCheck.name}</DialogTitle>
 <DialogDescription>{selectedCheck.description}</DialogDescription>
 </DialogHeader>
 
 <div className="space-y-6 mt-4">
 {/* Check Info */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm font-medium text-muted-foreground">Category</p>
 <p className="capitalize">{selectedCheck.category}</p>
 </div>
 <div>
 <p className="text-sm font-medium text-muted-foreground">Severity</p>
 <Badge className={cn("capitalize", getSeverityColor(selectedCheck.severity))}>
 {selectedCheck.severity}
 </Badge>
 </div>
 <div>
 <p className="text-sm font-medium text-muted-foreground">Pass Rate</p>
 <p className={cn("font-semibold", getPassRateColor(selectedCheck.passRate))}>
 {selectedCheck.passRate}%
 </p>
 </div>
 <div>
 <p className="text-sm font-medium text-muted-foreground">Last Run</p>
 <p>{selectedCheck.lastRun || 'Never'}</p>
 </div>
 </div>

 {/* Remediation Steps */}
 {selectedCheck.remediation && (
 <div className="space-y-3">
 <h3 className="font-semibold flex items-center gap-2">
 <Info className="h-4 w-4" />
 How to Fix
 </h3>
 <div className="space-y-2">
 <div className="flex items-center gap-4 text-sm">
 <Badge variant="outline">
 {selectedCheck.remediation.estimatedTime}
 </Badge>
 <Badge 
 variant="outline"
 className={cn(
 selectedCheck.remediation.difficulty === 'easy' && 'border-green-200 text-green-700',
 selectedCheck.remediation.difficulty === 'medium' && 'border-yellow-200 text-yellow-700',
 selectedCheck.remediation.difficulty === 'hard' && 'border-red-200 text-red-700'
 )}
 >
 {selectedCheck.remediation.difficulty}
 </Badge>
 </div>
 <ol className="list-decimal list-inside space-y-2">
 {selectedCheck.remediation.steps.map((step, index) => (
 <li key={index} className="text-sm">
 {step}
 </li>
 ))}
 </ol>
 </div>
 </div>
 )}

 {/* Actions */}
 <div className="flex gap-3">
 <Button className="flex-1">
 Run Check Now
 </Button>
 <Button variant="outline">
 View Documentation
 </Button>
 </div>
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}