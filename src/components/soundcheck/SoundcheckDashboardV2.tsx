'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
 Shield,
 CheckCircle2,
 AlertTriangle,
 XCircle,
 TrendingUp,
 Activity,
 Target,
 Award,
 BarChart3,
 FileText,
 Trophy,
 ArrowRight,
 Sparkles,
 BookOpen,
 Users,
 GitBranch,
 Clock,
 Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SoundcheckOverview } from './SoundcheckOverview';
import { SoundcheckChecks } from './SoundcheckChecks';
import { SoundcheckServices } from './SoundcheckServices';
import { SoundcheckInsights } from './SoundcheckInsights';
import { SoundcheckNotifications } from './SoundcheckNotifications';
import { cn } from '@/lib/utils';

export function SoundcheckDashboardV2() {
 const [activeTab, setActiveTab] = useState('overview');

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
 {/* Header */}
 <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
 <div className="container mx-auto px-4 py-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
 <Shield className="h-6 w-6 text-primary-600 dark:text-primary-400" />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
 Soundcheck
 </h1>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Service quality and compliance platform
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-3">
 <SoundcheckNotifications />
 <Button variant="outline" size="sm">
 <BookOpen className="h-4 w-4 mr-2" />
 Docs
 </Button>
 <Button size="sm">
 <Activity className="h-4 w-4 mr-2" />
 Run Assessment
 </Button>
 </div>
 </div>
 </div>
 </div>

 {/* Navigation */}
 <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
 <div className="container mx-auto px-4">
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="h-12 bg-transparent border-0 p-0">
 <TabsTrigger 
 value="overview" 
 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none h-12"
 >
 <BarChart3 className="h-4 w-4 mr-2" />
 Overview
 </TabsTrigger>
 <TabsTrigger 
 value="services" 
 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none h-12"
 >
 <GitBranch className="h-4 w-4 mr-2" />
 Services
 </TabsTrigger>
 <TabsTrigger 
 value="checks" 
 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none h-12"
 >
 <CheckCircle2 className="h-4 w-4 mr-2" />
 Checks
 </TabsTrigger>
 <TabsTrigger 
 value="insights" 
 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none h-12"
 >
 <Sparkles className="h-4 w-4 mr-2" />
 Insights
 </TabsTrigger>
 <TabsTrigger 
 value="certifications" 
 className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none h-12"
 >
 <Trophy className="h-4 w-4 mr-2" />
 Certifications
 </TabsTrigger>
 </TabsList>
 </Tabs>
 </div>
 </div>

 {/* Content */}
 <div className="container mx-auto px-4 py-6">
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsContent value="overview" className="mt-0">
 <SoundcheckOverview />
 </TabsContent>
 
 <TabsContent value="services" className="mt-0">
 <SoundcheckServices />
 </TabsContent>
 
 <TabsContent value="checks" className="mt-0">
 <SoundcheckChecks />
 </TabsContent>
 
 <TabsContent value="insights" className="mt-0">
 <SoundcheckInsights />
 </TabsContent>
 
 <TabsContent value="certifications" className="mt-0">
 <div className="space-y-6">
 {/* Certification Levels */}
 <Card>
 <CardHeader>
 <CardTitle>Service Certifications</CardTitle>
 <CardDescription>
 Recognize and reward high-quality services with certification badges
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="text-center p-6 border rounded-lg border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
 <Trophy className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
 <h3 className="font-semibold mb-1">Bronze</h3>
 <p className="text-sm text-muted-foreground">60-74% Score</p>
 <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">12</p>
 <p className="text-xs text-muted-foreground">services</p>
 </div>
 
 <div className="text-center p-6 border rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
 <Trophy className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
 <h3 className="font-semibold mb-1">Silver</h3>
 <p className="text-sm text-muted-foreground">75-89% Score</p>
 <p className="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-2">18</p>
 <p className="text-xs text-muted-foreground">services</p>
 </div>
 
 <div className="text-center p-6 border rounded-lg border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
 <Trophy className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
 <h3 className="font-semibold mb-1">Gold</h3>
 <p className="text-sm text-muted-foreground">90-94% Score</p>
 <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">7</p>
 <p className="text-xs text-muted-foreground">services</p>
 </div>
 
 <div className="text-center p-6 border rounded-lg border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
 <Trophy className="h-12 w-12 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
 <h3 className="font-semibold mb-1">Platinum</h3>
 <p className="text-sm text-muted-foreground">95%+ Score</p>
 <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">3</p>
 <p className="text-xs text-muted-foreground">services</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Recent Certifications */}
 <Card>
 <CardHeader>
 <CardTitle>Recent Achievements</CardTitle>
 <CardDescription>
 Latest services to earn certifications
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div className="flex items-center justify-between p-4 rounded-lg border">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
 <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-400" />
 </div>
 <div>
 <h4 className="font-medium">User Service</h4>
 <p className="text-sm text-muted-foreground">Achieved Platinum certification</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium">95% Score</p>
 <p className="text-xs text-muted-foreground">2 hours ago</p>
 </div>
 </div>
 
 <div className="flex items-center justify-between p-4 rounded-lg border">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
 <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
 </div>
 <div>
 <h4 className="font-medium">Payment API</h4>
 <p className="text-sm text-muted-foreground">Achieved Gold certification</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium">92% Score</p>
 <p className="text-xs text-muted-foreground">1 day ago</p>
 </div>
 </div>
 
 <div className="flex items-center justify-between p-4 rounded-lg border">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
 <Trophy className="h-6 w-6 text-gray-500 dark:text-gray-400" />
 </div>
 <div>
 <h4 className="font-medium">Analytics Service</h4>
 <p className="text-sm text-muted-foreground">Achieved Silver certification</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium">82% Score</p>
 <p className="text-xs text-muted-foreground">3 days ago</p>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}