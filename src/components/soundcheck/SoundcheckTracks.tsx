'use client';

import { useState, useEffect } from 'react';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import {
 Activity,
 Award,
 Code,
 Database,
 Rocket,
 Shield,
 Star,
 Target,
 TrendingDown,
 TrendingUp,
 Trophy,
 AlertCircle,
 ChevronRight,
 Info,
 CheckCircle2,
 XCircle
} from 'lucide-react';
import {
 LineChart,
 Line,
 BarChart,
 Bar,
 RadarChart,
 PolarGrid,
 PolarAngleAxis,
 PolarRadiusAxis,
 Radar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip as RechartsTooltip,
 Legend,
 ResponsiveContainer,
 Cell
} from 'recharts';

interface Track {
 id: string;
 name: string;
 description: string;
 category: string;
 icon: string;
 weight: number;
 enabled: boolean;
}

interface TrackAssessment {
 trackId: string;
 score: number;
 status: 'pass' | 'warning' | 'fail';
 improvements: string[];
 trendDirection?: 'improving' | 'declining' | 'stable';
 percentile?: number;
}

interface TrackProgress {
 currentScore: number;
 targetScore: number;
 milestones: Array<{
 score: number;
 achievedAt?: string;
 }>;
 nextMilestone?: {
 score: number;
 checksNeeded: string[];
 estimatedEffort: 'low' | 'medium' | 'high';
 };
}

interface LeaderboardEntry {
 rank: number;
 entityId: string;
 entityName: string;
 teamId?: string;
 score: number;
 change: number;
 trend: 'up' | 'down' | 'stable';
}

export function SoundcheckTracks() {
 const [tracks, setTracks] = useState<Track[]>([]);
 const [selectedEntity, setSelectedEntity] = useState<string>('backstage-core');
 const [entityAssessments, setEntityAssessments] = useState<TrackAssessment[]>([]);
 const [selectedTrack, setSelectedTrack] = useState<string>('');
 const [trackProgress, setTrackProgress] = useState<TrackProgress | null>(null);
 const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('overview');

 // Mock data for demonstration
 useEffect(() => {
 // Simulate loading tracks
 const mockTracks: Track[] = [
 {
 id: 'production-readiness',
 name: 'Production Readiness',
 description: 'Essential checks for production deployment',
 category: 'readiness',
 icon: 'rocket',
 weight: 1.5,
 enabled: true
 },
 {
 id: 'security-compliance',
 name: 'Security Compliance',
 description: 'Security standards and compliance requirements',
 category: 'compliance',
 icon: 'shield',
 weight: 1.3,
 enabled: true
 },
 {
 id: 'engineering-excellence',
 name: 'Engineering Excellence',
 description: 'Best practices for high-quality software',
 category: 'excellence',
 icon: 'star',
 weight: 1.0,
 enabled: true
 },
 {
 id: 'operational-maturity',
 name: 'Operational Maturity',
 description: 'Operational readiness and monitoring capabilities',
 category: 'readiness',
 icon: 'activity',
 weight: 1.2,
 enabled: true
 },
 {
 id: 'api-standards',
 name: 'API Standards',
 description: 'API design and documentation standards',
 category: 'excellence',
 icon: 'code',
 weight: 1.0,
 enabled: true
 }
 ];

 const mockAssessments: TrackAssessment[] = [
 {
 trackId: 'production-readiness',
 score: 75,
 status: 'warning',
 improvements: [
 'Add health check endpoint',
 'Configure error rate monitoring',
 'Create runbook documentation'
 ],
 trendDirection: 'improving',
 percentile: 65
 },
 {
 trackId: 'security-compliance',
 score: 92,
 status: 'pass',
 improvements: [
 'Enable API rate limiting'
 ],
 trendDirection: 'stable',
 percentile: 85
 },
 {
 trackId: 'engineering-excellence',
 score: 68,
 status: 'warning',
 improvements: [
 'Increase test coverage to 80%',
 'Add integration tests',
 'Improve API documentation'
 ],
 trendDirection: 'improving',
 percentile: 50
 },
 {
 trackId: 'operational-maturity',
 score: 85,
 status: 'pass',
 improvements: [
 'Configure automated backups'
 ],
 trendDirection: 'stable',
 percentile: 75
 }
 ];

 const mockProgress: TrackProgress = {
 currentScore: 75,
 targetScore: 90,
 milestones: [
 { score: 60, achievedAt: '2024-01-15' },
 { score: 70, achievedAt: '2024-02-01' },
 { score: 80 },
 { score: 90 },
 { score: 95 }
 ],
 nextMilestone: {
 score: 80,
 checksNeeded: ['health-check', 'error-monitoring', 'runbook'],
 estimatedEffort: 'medium'
 }
 };

 const mockLeaderboard: LeaderboardEntry[] = [
 { rank: 1, entityId: 'api-gateway', entityName: 'API Gateway', score: 95, change: 0, trend: 'stable', teamId: 'platform-team' },
 { rank: 2, entityId: 'auth-service', entityName: 'Auth Service', score: 92, change: 2, trend: 'up', teamId: 'security-team' },
 { rank: 3, entityId: 'user-service', entityName: 'User Service', score: 88, change: -1, trend: 'down', teamId: 'backend-team' },
 { rank: 4, entityId: 'backstage-core', entityName: 'Backstage Core', score: 75, change: 1, trend: 'up', teamId: 'platform-team' },
 { rank: 5, entityId: 'notification-service', entityName: 'Notification Service', score: 72, change: -2, trend: 'down', teamId: 'backend-team' }
 ];

 setTracks(mockTracks);
 setEntityAssessments(mockAssessments);
 setSelectedTrack(mockTracks[0].id);
 setTrackProgress(mockProgress);
 setLeaderboard(mockLeaderboard);
 setLoading(false);
 }, []);

 const getIconComponent = (iconName: string) => {
 const iconMap: Record<string, any> = {
 rocket: Rocket,
 shield: Shield,
 star: Star,
 activity: Activity,
 code: Code,
 database: Database
 };
 const Icon = iconMap[iconName] || Activity;
 return <Icon className="h-5 w-5" />;
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'pass': return 'text-green-600';
 case 'warning': return 'text-yellow-600';
 case 'fail': return 'text-red-600';
 default: return 'text-gray-600';
 }
 };

 const getTrendIcon = (trend?: string) => {
 switch (trend) {
 case 'improving':
 case 'up':
 return <TrendingUp className="h-4 w-4 text-green-600" />;
 case 'declining':
 case 'down':
 return <TrendingDown className="h-4 w-4 text-red-600" />;
 default:
 return <div className="h-4 w-4" />;
 }
 };

 const getEffortBadge = (effort?: string) => {
 const colors = {
 low: 'bg-green-100 text-green-800',
 medium: 'bg-yellow-100 text-yellow-800',
 high: 'bg-red-100 text-red-800'
 };
 return (
 <Badge variant="secondary" className={colors[effort as keyof typeof colors] || ''}>
 {effort} effort
 </Badge>
 );
 };

 // Prepare data for radar chart
 const radarData = tracks.map(track => {
 const assessment = entityAssessments.find(a => a.trackId === track.id);
 return {
 track: track.name,
 score: assessment?.score || 0,
 fullMark: 100
 };
 });

 // Prepare data for progress chart
 const progressData = [
 { milestone: '60%', achieved: true, date: 'Jan 15' },
 { milestone: '70%', achieved: true, date: 'Feb 1' },
 { milestone: '80%', achieved: false, date: 'Target' },
 { milestone: '90%', achieved: false, date: 'Target' },
 { milestone: '95%', achieved: false, date: 'Target' }
 ];

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
 <p className="text-muted-foreground">Loading tracks...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Soundcheck Tracks</h2>
 <p className="text-muted-foreground">
 Quality scorecards grouped by focus areas
 </p>
 </div>
 <Select value={selectedEntity} onValueChange={setSelectedEntity}>
 <SelectTrigger className="w-[250px]">
 <SelectValue placeholder="Select entity" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="backstage-core">Backstage Core</SelectItem>
 <SelectItem value="api-gateway">API Gateway</SelectItem>
 <SelectItem value="auth-service">Auth Service</SelectItem>
 <SelectItem value="user-service">User Service</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList>
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="tracks">Tracks</TabsTrigger>
 <TabsTrigger value="progress">Progress</TabsTrigger>
 <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
 </TabsList>

 <TabsContent value="overview" className="space-y-6">
 {/* Overall Score Card */}
 <Card>
 <CardHeader>
 <CardTitle>Entity Overview</CardTitle>
 <CardDescription>
 Quality assessment across all tracks for {selectedEntity}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid gap-6 md:grid-cols-2">
 {/* Radar Chart */}
 <div>
 <h3 className="text-sm font-medium mb-4">Track Scores</h3>
 <ResponsiveContainer width="100%" height={300}>
 <RadarChart data={radarData}>
 <PolarGrid />
 <PolarAngleAxis dataKey="track" />
 <PolarRadiusAxis angle={90} domain={[0, 100]} />
 <Radar
 name="Score"
 dataKey="score"
 stroke="#3b82f6"
 fill="#3b82f6"
 fillOpacity={0.6}
 />
 <RechartsTooltip />
 </RadarChart>
 </ResponsiveContainer>
 </div>

 {/* Summary Stats */}
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <Card>
 <CardContent className="p-4">
 <div className="text-2xl font-bold">78%</div>
 <p className="text-sm text-muted-foreground">Overall Score</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="text-2xl font-bold">65th</div>
 <p className="text-sm text-muted-foreground">Percentile</p>
 </CardContent>
 </Card>
 </div>

 <div>
 <h3 className="text-sm font-medium mb-2">Strongest Track</h3>
 <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
 <Shield className="h-5 w-5 text-green-600" />
 <span className="font-medium">Security Compliance</span>
 <span className="ml-auto text-green-600 font-bold">92%</span>
 </div>
 </div>

 <div>
 <h3 className="text-sm font-medium mb-2">Focus Area</h3>
 <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
 <AlertCircle className="h-5 w-5 text-yellow-600" />
 <span className="text-sm">
 Improve Engineering Excellence (currently at 68%)
 </span>
 </div>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Track Cards Grid */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {entityAssessments.map((assessment) => {
 const track = tracks.find(t => t.id === assessment.trackId);
 if (!track) return null;

 return (
 <Card key={assessment.trackId} className="cursor-pointer hover:shadow-lg transition-shadow">
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {getIconComponent(track.icon)}
 <CardTitle className="text-base">{track.name}</CardTitle>
 </div>
 {getTrendIcon(assessment.trendDirection)}
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between">
 <span className={`text-2xl font-bold ${getStatusColor(assessment.status)}`}>
 {assessment.score}%
 </span>
 <Badge variant={assessment.status === 'pass' ? 'default' : 'secondary'}>
 {assessment.percentile}th percentile
 </Badge>
 </div>
 
 <Progress value={assessment.score} className="h-2" />

 {assessment.improvements.length > 0 && (
 <div className="pt-2">
 <p className="text-xs text-muted-foreground mb-1">
 Top improvement:
 </p>
 <p className="text-sm">
 {assessment.improvements[0]}
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 );
 })}
 </div>
 </TabsContent>

 <TabsContent value="tracks" className="space-y-6">
 {/* Track Details */}
 <div className="grid gap-6 lg:grid-cols-3">
 <div className="lg:col-span-1">
 <Card>
 <CardHeader>
 <CardTitle>Available Tracks</CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 <div className="divide-y">
 {tracks.map((track) => (
 <button
 key={track.id}
 onClick={() => setSelectedTrack(track.id)}
 className={`w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 ${
 selectedTrack === track.id ? 'bg-muted' : ''
 }`}
 >
 {getIconComponent(track.icon)}
 <div className="flex-1">
 <p className="font-medium">{track.name}</p>
 <p className="text-sm text-muted-foreground">
 {track.description}
 </p>
 </div>
 <ChevronRight className="h-4 w-4" />
 </button>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="lg:col-span-2">
 {selectedTrack && (
 <Card>
 <CardHeader>
 <div className="flex items-center gap-3">
 {getIconComponent(tracks.find(t => t.id === selectedTrack)?.icon || 'activity')}
 <div>
 <CardTitle>
 {tracks.find(t => t.id === selectedTrack)?.name}
 </CardTitle>
 <CardDescription>
 {tracks.find(t => t.id === selectedTrack)?.description}
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Track Assessment */}
 {(() => {
 const assessment = entityAssessments.find(a => a.trackId === selectedTrack);
 if (!assessment) return null;

 return (
 <>
 <div className="grid gap-4 md:grid-cols-3">
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className={`text-3xl font-bold ${getStatusColor(assessment.status)}`}>
 {assessment.score}%
 </div>
 <p className="text-sm text-muted-foreground">Current Score</p>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-3xl font-bold">
 {assessment.percentile}th
 </div>
 <p className="text-sm text-muted-foreground">Percentile</p>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="flex items-center justify-center gap-2">
 {getTrendIcon(assessment.trendDirection)}
 <span className="text-lg font-medium capitalize">
 {assessment.trendDirection || 'Stable'}
 </span>
 </div>
 <p className="text-sm text-muted-foreground">Trend</p>
 </div>
 </div>

 <div>
 <h3 className="font-medium mb-3">Required Improvements</h3>
 <div className="space-y-2">
 {assessment.improvements.map((improvement, index) => (
 <div key={index} className="flex items-start gap-2">
 <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
 <span className="text-sm">{improvement}</span>
 </div>
 ))}
 </div>
 </div>

 <div>
 <h3 className="font-medium mb-3">Included Checks</h3>
 <div className="grid gap-2">
 {['Health Check Endpoint', 'Error Rate Monitoring', 'API Documentation', 'Runbook Documentation'].map((check, index) => (
 <div key={index} className="flex items-center gap-2 text-sm">
 {index < 2 ? (
 <CheckCircle2 className="h-4 w-4 text-green-500" />
 ) : (
 <XCircle className="h-4 w-4 text-red-500" />
 )}
 <span>{check}</span>
 </div>
 ))}
 </div>
 </div>
 </>
 );
 })()}
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="progress" className="space-y-6">
 {/* Progress Tracking */}
 <Card>
 <CardHeader>
 <CardTitle>Track Progress</CardTitle>
 <CardDescription>
 Milestone tracking for {tracks.find(t => t.id === selectedTrack)?.name}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {trackProgress && (
 <>
 <div className="flex items-center justify-between">
 <div>
 <div className="text-3xl font-bold">{trackProgress.currentScore}%</div>
 <p className="text-sm text-muted-foreground">Current Score</p>
 </div>
 <div className="text-right">
 <div className="text-3xl font-bold">{trackProgress.targetScore}%</div>
 <p className="text-sm text-muted-foreground">Target Score</p>
 </div>
 </div>

 <div>
 <div className="flex justify-between mb-2">
 <span className="text-sm font-medium">Overall Progress</span>
 <span className="text-sm text-muted-foreground">
 {trackProgress.currentScore}% of {trackProgress.targetScore}%
 </span>
 </div>
 <Progress 
 value={(trackProgress.currentScore / trackProgress.targetScore) * 100} 
 className="h-3"
 />
 </div>

 <div>
 <h3 className="font-medium mb-4">Milestones</h3>
 <div className="space-y-3">
 {trackProgress.milestones.map((milestone, index) => (
 <div key={index} className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
 milestone.achievedAt ? 'bg-green-100' : 'bg-gray-100'
 }`}>
 {milestone.achievedAt ? (
 <CheckCircle2 className="h-5 w-5 text-green-600" />
 ) : (
 <Target className="h-5 w-5 text-gray-400" />
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between">
 <span className={`font-medium ${
 milestone.achievedAt ? '' : 'text-muted-foreground'
 }`}>
 {milestone.score}% Score
 </span>
 {milestone.achievedAt && (
 <span className="text-sm text-muted-foreground">
 Achieved {new Date(milestone.achievedAt).toLocaleDateString()}
 </span>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {trackProgress.nextMilestone && (
 <Card className="bg-primary/5 border-primary/20">
 <CardHeader className="pb-3">
 <CardTitle className="text-base">Next Milestone</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-2xl font-bold">{trackProgress.nextMilestone.score}%</span>
 {getEffortBadge(trackProgress.nextMilestone.estimatedEffort)}
 </div>
 <div>
 <p className="text-sm font-medium mb-2">Required Checks:</p>
 <div className="space-y-1">
 {trackProgress.nextMilestone.checksNeeded.map((check, index) => (
 <div key={index} className="text-sm text-muted-foreground">
 • {check}
 </div>
 ))}
 </div>
 </div>
 </CardContent>
 </Card>
 )}
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="leaderboard" className="space-y-6">
 {/* Leaderboard */}
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Track Leaderboard</CardTitle>
 <CardDescription>
 Top performing entities for {tracks.find(t => t.id === selectedTrack)?.name}
 </CardDescription>
 </div>
 <Select defaultValue="all-time">
 <SelectTrigger className="w-[150px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="week">This Week</SelectItem>
 <SelectItem value="month">This Month</SelectItem>
 <SelectItem value="quarter">This Quarter</SelectItem>
 <SelectItem value="all-time">All Time</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[60px]">Rank</TableHead>
 <TableHead>Entity</TableHead>
 <TableHead>Team</TableHead>
 <TableHead className="text-right">Score</TableHead>
 <TableHead className="text-center">Change</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {leaderboard.map((entry) => (
 <TableRow key={entry.entityId}>
 <TableCell>
 <div className="flex items-center gap-2">
 {entry.rank <= 3 && (
 <Trophy className={`h-4 w-4 ${
 entry.rank === 1 ? 'text-yellow-500' :
 entry.rank === 2 ? 'text-gray-400' :
 'text-orange-600'
 }`} />
 )}
 <span className="font-medium">{entry.rank}</span>
 </div>
 </TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{entry.entityName}</p>
 <p className="text-sm text-muted-foreground">{entry.entityId}</p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">{entry.teamId}</Badge>
 </TableCell>
 <TableCell className="text-right">
 <span className="font-bold">{entry.score}%</span>
 </TableCell>
 <TableCell className="text-center">
 <div className="flex items-center justify-center gap-1">
 {getTrendIcon(entry.trend)}
 <span className={`text-sm ${
 entry.change > 0 ? 'text-green-600' :
 entry.change < 0 ? 'text-red-600' :
 'text-gray-600'
 }`}>
 {entry.change > 0 ? '+' : ''}{entry.change}
 </span>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}