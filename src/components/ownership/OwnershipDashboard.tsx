'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitBranch, 
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  Eye,
  Edit,
  UserCheck,
  Activity,
  BarChart3,
  PieChart,
  TrendingUp,
  Shield,
  RefreshCw
} from 'lucide-react';

/**
 * Types for ownership dashboard data
 */
interface OwnershipRecord {
  id: string;
  path: string;
  teamId: string;
  teamName: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  score: number;
  source: 'codeowners' | 'git_history' | 'manual' | 'auto_assigned';
  contributors: string[];
  lastActive: string;
  conflicted: boolean;
  manualOverride?: boolean;
}

interface TeamInfo {
  id: string;
  name: string;
  memberCount: number;
  capacityUtilization: number;
  primaryDomains: string[];
  recentActivity: string;
  expertiseAreas: string[];
}

interface OwnershipConflict {
  id: string;
  path: string;
  conflictingTeams: {
    teamId: string;
    teamName: string;
    confidence: string;
    score: number;
  }[];
  status: 'pending' | 'resolved' | 'ignored';
  resolvedBy?: string;
  resolutionStrategy?: string;
  notes?: string;
}

interface OwnershipStats {
  totalFiles: number;
  assignedFiles: number;
  unassignedFiles: number;
  conflictedFiles: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  teamDistribution: Array<{
    teamName: string;
    fileCount: number;
    percentage: number;
  }>;
  sourceDistribution: {
    codeowners: number;
    git_history: number;
    manual: number;
    auto_assigned: number;
  };
}

/**
 * Comprehensive ownership management dashboard
 */
export default function OwnershipDashboard() {
  const [ownershipRecords, setOwnershipRecords] = useState<OwnershipRecord[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [conflicts, setConflicts] = useState<OwnershipConflict[]>([]);
  const [stats, setStats] = useState<OwnershipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);
  
  // Modal states
  const [selectedRecord, setSelectedRecord] = useState<OwnershipRecord | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<OwnershipConflict | null>(null);

  /**
   * Load ownership data from API
   */
  const loadOwnershipData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [recordsRes, teamsRes, conflictsRes, statsRes] = await Promise.all([
        fetch('/api/ownership/analyze'),
        fetch('/api/ownership/teams'),
        fetch('/api/ownership/conflicts'),
        fetch('/api/ownership/stats')
      ]);

      if (!recordsRes.ok || !teamsRes.ok || !conflictsRes.ok || !statsRes.ok) {
        throw new Error('Failed to load ownership data');
      }

      const [recordsData, teamsData, conflictsData, statsData] = await Promise.all([
        recordsRes.json(),
        teamsRes.json(),
        conflictsRes.json(),
        statsRes.json()
      ]);

      setOwnershipRecords(recordsData.records || []);
      setTeams(teamsData.teams || []);
      setConflicts(conflictsData.conflicts || []);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Error loading ownership data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Assign ownership to a team
   */
  const assignOwnership = async (path: string, teamId: string, notes?: string) => {
    try {
      const response = await fetch('/api/ownership/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, teamId, notes, source: 'manual' })
      });

      if (!response.ok) {
        throw new Error('Failed to assign ownership');
      }

      await loadOwnershipData(); // Refresh data
      setShowAssignmentModal(false);
      setSelectedRecord(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    }
  };

  /**
   * Resolve ownership conflict
   */
  const resolveConflict = async (
    conflictId: string, 
    strategy: string, 
    selectedTeamId?: string,
    notes?: string
  ) => {
    try {
      const response = await fetch('/api/ownership/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conflictId, 
          strategy, 
          selectedTeamId, 
          notes 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflict');
      }

      await loadOwnershipData(); // Refresh data
      setShowConflictModal(false);
      setSelectedConflict(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed');
    }
  };

  /**
   * Run ownership analysis
   */
  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ownership/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullAnalysis: true })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      await loadOwnershipData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadOwnershipData();
  }, [loadOwnershipData]);

  // Filter ownership records
  const filteredRecords = ownershipRecords.filter(record => {
    if (searchTerm && !record.path.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !record.teamName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (selectedTeam !== 'all' && record.teamId !== selectedTeam) {
      return false;
    }
    
    if (selectedConfidence !== 'all' && record.confidence !== selectedConfidence) {
      return false;
    }
    
    if (selectedSource !== 'all' && record.source !== selectedSource) {
      return false;
    }
    
    if (showConflictsOnly && !record.conflicted) {
      return false;
    }
    
    return true;
  });

  // Get confidence badge variant
  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'destructive';
    }
  };

  // Get source badge variant
  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'codeowners': return 'default';
      case 'manual': return 'secondary';
      case 'git_history': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading ownership data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Ownership Management</h1>
          <p className="text-muted-foreground">
            Manage team ownership assignments with confidence scoring and conflict resolution
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => runAnalysis()} disabled={loading}>
            <Activity className="h-4 w-4 mr-2" />
            Run Analysis
          </Button>
          <Button variant="outline" onClick={() => loadOwnershipData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFiles.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.assignedFiles} assigned, {stats.unassignedFiles} unassigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assignment Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((stats.assignedFiles / stats.totalFiles) * 100)}%
              </div>
              <Progress value={(stats.assignedFiles / stats.totalFiles) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.conflictedFiles}
              </div>
              <p className="text-xs text-muted-foreground">
                {conflicts.filter(c => c.status === 'pending').length} pending resolution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.confidenceDistribution.high}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.confidenceDistribution.high / stats.assignedFiles) * 100)}% of assignments
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="ownership" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ownership">File Ownership</TabsTrigger>
          <TabsTrigger value="teams">Team Overview</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* File Ownership Tab */}
        <TabsContent value="ownership" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="lg:col-span-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search files or teams..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger>
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Confidence</Label>
                  <Select value={selectedConfidence} onValueChange={setSelectedConfidence}>
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Source</Label>
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="codeowners">CODEOWNERS</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="git_history">Git History</SelectItem>
                      <SelectItem value="auto_assigned">Auto-assigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button 
                    variant={showConflictsOnly ? "default" : "outline"}
                    onClick={() => setShowConflictsOnly(!showConflictsOnly)}
                    className="w-full"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Conflicts Only
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ownership Records Table */}
          <Card>
            <CardHeader>
              <CardTitle>File Ownership ({filteredRecords.length})</CardTitle>
              <CardDescription>
                File-level ownership assignments with confidence scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">File Path</th>
                      <th className="text-left p-2">Team</th>
                      <th className="text-left p-2">Confidence</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Contributors</th>
                      <th className="text-left p-2">Last Active</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 100).map(record => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <code className="text-sm bg-muted px-1 rounded">
                              {record.path}
                            </code>
                            {record.conflicted && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                            {record.manualOverride && (
                              <Shield className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{record.teamName}</Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant={getConfidenceBadgeVariant(record.confidence)}>
                              {record.confidence}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {record.score}%
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <Badge variant={getSourceBadgeVariant(record.source)}>
                            {record.source.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{record.contributors.length}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(record.lastActive).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowAssignmentModal(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRecord(record)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredRecords.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No ownership records match your filters
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {team.name}
                    <Badge variant="outline">{team.memberCount} members</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Capacity Utilization</span>
                      <span>{team.capacityUtilization}%</span>
                    </div>
                    <Progress value={team.capacityUtilization} />
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-1">Primary Domains</p>
                    <div className="flex flex-wrap gap-1">
                      {team.primaryDomains.map(domain => (
                        <Badge key={domain} variant="secondary" className="text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-1">Expertise Areas</p>
                    <div className="flex flex-wrap gap-1">
                      {team.expertiseAreas.slice(0, 3).map(area => (
                        <Badge key={area} variant="outline" className="text-xs">
                          {area}
                        </Badge>
                      ))}
                      {team.expertiseAreas.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{team.expertiseAreas.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Last active: {team.recentActivity}</span>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ownership Conflicts ({conflicts.length})</CardTitle>
              <CardDescription>
                Resolve conflicts where multiple teams claim ownership
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conflicts.map(conflict => (
                  <div key={conflict.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <code className="text-sm bg-muted px-1 rounded">
                          {conflict.path}
                        </code>
                        <Badge 
                          variant={conflict.status === 'pending' ? 'destructive' : 'default'}
                          className="ml-2"
                        >
                          {conflict.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedConflict(conflict);
                          setShowConflictModal(true);
                        }}
                        disabled={conflict.status !== 'pending'}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {conflict.conflictingTeams.map(team => (
                        <div key={team.teamId} className="border rounded p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{team.teamName}</span>
                            <Badge variant={getConfidenceBadgeVariant(team.confidence)}>
                              {team.confidence}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Score: {team.score}%
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {conflict.notes && (
                      <div className="mt-3 p-2 bg-muted rounded text-sm">
                        <strong>Notes:</strong> {conflict.notes}
                      </div>
                    )}
                  </div>
                ))}
                
                {conflicts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    No ownership conflicts found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confidence Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Confidence Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>High Confidence</span>
                      <span className="font-medium">{stats.confidenceDistribution.high}</span>
                    </div>
                    <Progress value={(stats.confidenceDistribution.high / stats.assignedFiles) * 100} />
                    
                    <div className="flex justify-between items-center">
                      <span>Medium Confidence</span>
                      <span className="font-medium">{stats.confidenceDistribution.medium}</span>
                    </div>
                    <Progress value={(stats.confidenceDistribution.medium / stats.assignedFiles) * 100} />
                    
                    <div className="flex justify-between items-center">
                      <span>Low Confidence</span>
                      <span className="font-medium">{stats.confidenceDistribution.low}</span>
                    </div>
                    <Progress value={(stats.confidenceDistribution.low / stats.assignedFiles) * 100} />
                    
                    <div className="flex justify-between items-center">
                      <span>Unknown</span>
                      <span className="font-medium">{stats.confidenceDistribution.unknown}</span>
                    </div>
                    <Progress value={(stats.confidenceDistribution.unknown / stats.assignedFiles) * 100} />
                  </div>
                </CardContent>
              </Card>

              {/* Team Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.teamDistribution.slice(0, 8).map(team => (
                      <div key={team.teamName} className="flex justify-between items-center">
                        <span className="truncate">{team.teamName}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">
                            {team.fileCount}
                          </span>
                          <span className="font-medium">{team.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Source Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>CODEOWNERS</span>
                      <span className="font-medium">{stats.sourceDistribution.codeowners}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Git History</span>
                      <span className="font-medium">{stats.sourceDistribution.git_history}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Manual</span>
                      <span className="font-medium">{stats.sourceDistribution.manual}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Auto-assigned</span>
                      <span className="font-medium">{stats.sourceDistribution.auto_assigned}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Ownership</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div>
                <Label>File Path</Label>
                <code className="block text-sm bg-muted p-2 rounded mt-1">
                  {selectedRecord.path}
                </code>
              </div>
              
              <div>
                <Label>Current Team</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedRecord.teamName} ({selectedRecord.confidence} confidence)
                </p>
              </div>
              
              <div>
                <Label htmlFor="team-select">Assign to Team</Label>
                <Select>
                  <SelectTrigger id="team-select">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea 
                  id="notes"
                  placeholder="Reason for assignment..."
                  className="mt-1"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => assignOwnership(selectedRecord.path, 'selected-team')}>
                  Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict Resolution Modal */}
      <Dialog open={showConflictModal} onOpenChange={setShowConflictModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Ownership Conflict</DialogTitle>
          </DialogHeader>
          {selectedConflict && (
            <div className="space-y-4">
              <div>
                <Label>File Path</Label>
                <code className="block text-sm bg-muted p-2 rounded mt-1">
                  {selectedConflict.path}
                </code>
              </div>
              
              <div>
                <Label>Conflicting Teams</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {selectedConflict.conflictingTeams.map(team => (
                    <div key={team.teamId} className="border rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{team.teamName}</span>
                        <Badge variant={getConfidenceBadgeVariant(team.confidence)}>
                          {team.confidence} ({team.score}%)
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>Resolution Strategy</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose resolution strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="highest_confidence">Highest Confidence</SelectItem>
                    <SelectItem value="most_recent_activity">Most Recent Activity</SelectItem>
                    <SelectItem value="most_contributors">Most Contributors</SelectItem>
                    <SelectItem value="manual_review">Manual Selection</SelectItem>
                    <SelectItem value="shared_ownership">Shared Ownership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="resolution-notes">Resolution Notes</Label>
                <Textarea 
                  id="resolution-notes"
                  placeholder="Explain the reasoning for this resolution..."
                  className="mt-1"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowConflictModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => resolveConflict(selectedConflict.id, 'highest_confidence')}>
                  Resolve Conflict
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}