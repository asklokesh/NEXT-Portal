'use client';

import React, { useState } from 'react';
import {
 Search,
 Filter,
 TrendingUp,
 TrendingDown,
 Minus,
 AlertCircle,
 CheckCircle2,
 Clock,
 ChevronRight,
 MoreVertical,
 Play,
 History,
 FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Service {
 id: string;
 name: string;
 description: string;
 team: string;
 score: number;
 previousScore: number;
 trend: 'up' | 'down' | 'stable';
 lastAssessment: string;
 checks: {
 passed: number;
 failed: number;
 total: number;
 };
 issues: {
 critical: number;
 high: number;
 medium: number;
 low: number;
 };
 certification?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export function SoundcheckServices() {
 const [searchQuery, setSearchQuery] = useState('');
 const [teamFilter, setTeamFilter] = useState('all');
 const [statusFilter, setStatusFilter] = useState('all');
 const [sortBy, setSortBy] = useState('score');

 // Mock data - in real app, this would come from API
 const services: Service[] = [
 {
 id: 'user-service',
 name: 'User Service',
 description: 'Core authentication and user management service',
 team: 'Platform Team',
 score: 95,
 previousScore: 92,
 trend: 'up',
 lastAssessment: '2 hours ago',
 checks: { passed: 24, failed: 1, total: 25 },
 issues: { critical: 0, high: 0, medium: 1, low: 2 },
 certification: 'platinum'
 },
 {
 id: 'payment-api',
 name: 'Payment API',
 description: 'Payment processing and transaction management',
 team: 'Commerce Team',
 score: 78,
 previousScore: 82,
 trend: 'down',
 lastAssessment: '4 hours ago',
 checks: { passed: 18, failed: 7, total: 25 },
 issues: { critical: 2, high: 3, medium: 2, low: 1 }
 },
 {
 id: 'notification-service',
 name: 'Notification Service',
 description: 'Email, SMS, and push notification delivery',
 team: 'Platform Team',
 score: 85,
 previousScore: 85,
 trend: 'stable',
 lastAssessment: '6 hours ago',
 checks: { passed: 21, failed: 4, total: 25 },
 issues: { critical: 1, high: 1, medium: 2, low: 3 },
 certification: 'silver'
 },
 {
 id: 'analytics-service',
 name: 'Analytics Service',
 description: 'Data collection and analytics processing',
 team: 'Data Team',
 score: 92,
 previousScore: 88,
 trend: 'up',
 lastAssessment: '1 day ago',
 checks: { passed: 23, failed: 2, total: 25 },
 issues: { critical: 0, high: 1, medium: 1, low: 3 },
 certification: 'gold'
 }
 ];

 const teams = ['All Teams', 'Platform Team', 'Commerce Team', 'Data Team'];

 const getScoreColor = (score: number) => {
 if (score >= 90) return 'text-success-600';
 if (score >= 75) return 'text-warning-600';
 if (score >= 60) return 'text-warning-700';
 return 'text-destructive';
 };

 const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
 if (score >= 90) return 'default';
 if (score >= 75) return 'secondary';
 return 'destructive';
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

 const getCertificationBadge = (certification?: string) => {
 if (!certification) return null;
 
 const colors = {
 bronze: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
 silver: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
 gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
 platinum: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
 };

 return (
 <Badge className={cn('capitalize', colors[certification as keyof typeof colors])}>
 {certification}
 </Badge>
 );
 };

 return (
 <div className="space-y-6">
 {/* Header Actions */}
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search services..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 
 <div className="flex gap-2">
 <Select value={teamFilter} onValueChange={setTeamFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Filter by team" />
 </SelectTrigger>
 <SelectContent>
 {teams.map(team => (
 <SelectItem key={team} value={team.toLowerCase().replace(' ', '-')}>
 {team}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Filter by status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="healthy">Healthy (90%+)</SelectItem>
 <SelectItem value="warning">Warning (75-89%)</SelectItem>
 <SelectItem value="critical">Critical (&lt;75%)</SelectItem>
 </SelectContent>
 </Select>
 
 <Button variant="outline" size="icon">
 <Filter className="h-4 w-4" />
 </Button>
 </div>
 </div>

 {/* Services Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {services.map((service) => (
 <Card key={service.id} className="hover:shadow-lg transition-shadow cursor-pointer">
 <CardHeader className="pb-4">
 <div className="flex items-start justify-between">
 <div className="space-y-1">
 <CardTitle className="text-lg">{service.name}</CardTitle>
 <p className="text-sm text-muted-foreground">{service.description}</p>
 <div className="flex items-center gap-2 pt-2">
 <Badge variant="outline" className="text-xs">
 {service.team}
 </Badge>
 {getCertificationBadge(service.certification)}
 </div>
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreVertical className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem>
 <Play className="h-4 w-4 mr-2" />
 Run Assessment
 </DropdownMenuItem>
 <DropdownMenuItem>
 <History className="h-4 w-4 mr-2" />
 View History
 </DropdownMenuItem>
 <DropdownMenuItem>
 <FileText className="h-4 w-4 mr-2" />
 Generate Report
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Score Section */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="text-center">
 <div className={cn("text-3xl font-bold", getScoreColor(service.score))}>
 {service.score}%
 </div>
 <p className="text-xs text-muted-foreground">Health Score</p>
 </div>
 <div className="flex items-center gap-1">
 {getTrendIcon(service.trend)}
 <span className="text-sm text-muted-foreground">
 {service.trend === 'up' ? '+' : service.trend === 'down' ? '-' : ''}
 {Math.abs(service.score - service.previousScore)}%
 </span>
 </div>
 </div>
 <div className="text-right text-sm text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {service.lastAssessment}
 </div>
 </div>
 </div>

 {/* Progress Bar */}
 <Progress value={service.score} className="h-2" />

 {/* Stats */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <p className="text-sm font-medium">Check Results</p>
 <div className="flex items-center gap-3 text-sm">
 <div className="flex items-center gap-1">
 <CheckCircle2 className="h-3 w-3 text-success-600" />
 <span>{service.checks.passed} passed</span>
 </div>
 <div className="flex items-center gap-1">
 <AlertCircle className="h-3 w-3 text-destructive" />
 <span>{service.checks.failed} failed</span>
 </div>
 </div>
 </div>
 <div className="space-y-1">
 <p className="text-sm font-medium">Issues</p>
 <div className="flex items-center gap-2 text-sm">
 {service.issues.critical > 0 && (
 <Badge variant="destructive" className="text-xs">
 {service.issues.critical} critical
 </Badge>
 )}
 {service.issues.high > 0 && (
 <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300">
 {service.issues.high} high
 </Badge>
 )}
 {service.issues.medium > 0 && (
 <Badge variant="outline" className="text-xs">
 {service.issues.medium} medium
 </Badge>
 )}
 </div>
 </div>
 </div>

 {/* Action Button */}
 <Button variant="ghost" className="w-full justify-between" size="sm">
 View Details
 <ChevronRight className="h-4 w-4" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 );
}