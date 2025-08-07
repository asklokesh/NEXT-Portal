'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle,
  Activity,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Target,
  Bell,
  BellOff,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  BarChart3,
  PieChart,
  Settings,
  Plus,
  Eye,
  EyeOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'closed';
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  affectedServices: string[];
  incidentCommander: User;
  team: User[];
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metrics: IncidentMetrics;
  slaStatus: 'within' | 'warning' | 'breached';
  tags: string[];
  source: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: 'online' | 'offline' | 'busy';
}

interface IncidentMetrics {
  detectionTime: number;
  acknowledgmentTime: number;
  resolutionTime?: number;
  customerImpactTime: number;
  escalations: number;
  runbooksExecuted: number;
}

interface Alert {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'firing' | 'resolved';
  timestamp: Date;
  source: string;
  incidentId?: string;
}

interface DashboardMetrics {
  activeIncidents: number;
  totalIncidents: number;
  mttr: number;
  mtta: number;
  slaCompliance: number;
  criticalIncidents: number;
  trendsData: TrendData[];
  severityDistribution: SeverityData[];
  serviceImpact: ServiceImpactData[];
  responseTeamLoad: TeamLoadData[];
}

interface TrendData {
  time: string;
  incidents: number;
  resolved: number;
  alerts: number;
}

interface SeverityData {
  severity: string;
  count: number;
  color: string;
}

interface ServiceImpactData {
  service: string;
  incidents: number;
  status: 'healthy' | 'degraded' | 'down';
}

interface TeamLoadData {
  team: string;
  activeIncidents: number;
  load: number; // percentage
}

interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  soundAlerts: boolean;
  showResolved: boolean;
  compactView: boolean;
  groupByService: boolean;
}

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeIncidents: 0,
    totalIncidents: 0,
    mttr: 0,
    mtta: 0,
    slaCompliance: 100,
    criticalIncidents: 0,
    trendsData: [],
    severityDistribution: [],
    serviceImpact: [],
    responseTeamLoad: []
  });

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [settings, setSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30,
    soundAlerts: true,
    showResolved: false,
    compactView: false,
    groupByService: false
  });

  // WebSocket connection for real-time updates
  const { socket, isConnected } = useWebSocket('/api/ws', {
    onMessage: handleRealtimeUpdate
  });

  // Load initial data
  useEffect(() => {
    loadDashboardData();
    
    if (settings.autoRefresh) {
      const interval = setInterval(loadDashboardData, settings.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [settings.autoRefresh, settings.refreshInterval, selectedTimeRange]);

  // Handle real-time updates
  function handleRealtimeUpdate(event: string, data: any) {
    switch (event) {
      case 'incident-created':
        setIncidents(prev => [data, ...prev]);
        if (settings.soundAlerts && data.severity === 'critical') {
          playAlertSound();
        }
        break;
      
      case 'incident-updated':
        setIncidents(prev => prev.map(inc => 
          inc.id === data.id ? { ...inc, ...data } : inc
        ));
        break;
      
      case 'incident-resolved':
        setIncidents(prev => prev.map(inc => 
          inc.id === data.id ? { ...inc, ...data } : inc
        ));
        break;
      
      case 'alert-fired':
        setAlerts(prev => [data, ...prev.slice(0, 99)]); // Keep last 100 alerts
        if (settings.soundAlerts && data.severity === 'critical') {
          playAlertSound();
        }
        break;
      
      case 'metrics-updated':
        setMetrics(data);
        break;
    }
  }

  async function loadDashboardData() {
    try {
      const [incidentsRes, alertsRes, metricsRes] = await Promise.all([
        fetch(`/api/incidents?range=${selectedTimeRange}`),
        fetch(`/api/alerts?range=${selectedTimeRange}&limit=100`),
        fetch(`/api/incidents/metrics?range=${selectedTimeRange}`)
      ]);

      const [incidentsData, alertsData, metricsData] = await Promise.all([
        incidentsRes.json(),
        alertsRes.json(),
        metricsRes.json()
      ]);

      setIncidents(incidentsData.incidents || []);
      setAlerts(alertsData.alerts || []);
      setMetrics(metricsData || metrics);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  function playAlertSound() {
    if (typeof window !== 'undefined' && settings.soundAlerts) {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  }

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const matchesSearch = searchQuery === '' || 
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.affectedServices.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && !['resolved', 'closed'].includes(incident.status)) ||
        incident.status === filterStatus;
      
      const matchesSeverity = filterSeverity === 'all' || incident.severity === filterSeverity;
      
      const matchesShowResolved = settings.showResolved || !['resolved', 'closed'].includes(incident.status);
      
      return matchesSearch && matchesStatus && matchesSeverity && matchesShowResolved;
    });
  }, [incidents, searchQuery, filterStatus, filterSeverity, settings.showResolved]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500';
      case 'investigating': return 'bg-yellow-500';
      case 'identified': return 'bg-orange-500';
      case 'monitoring': return 'bg-blue-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const diffMs = end.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-8 w-8" />
              Incident Command Center
            </div>
            <p className="text-muted-foreground mt-2">
              Real-time incident management and response coordination
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-xs font-medium">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettings(s => ({ ...s, soundAlerts: !s.soundAlerts }))}
            className="flex items-center gap-2"
          >
            {settings.soundAlerts ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Sound
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettings(s => ({ ...s, autoRefresh: !s.autoRefresh }))}
            className="flex items-center gap-2"
          >
            {settings.autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Auto Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${
                metrics.activeIncidents > 0 ? 'text-orange-500' : 'text-green-500'
              }`}>
                {metrics.activeIncidents}
              </span>
              <span className="text-sm text-muted-foreground">of {metrics.totalIncidents}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${
                metrics.criticalIncidents > 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                {metrics.criticalIncidents}
              </span>
              {metrics.criticalIncidents > 0 && (
                <Badge className="bg-red-500 text-white">Action Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MTTR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.mttr}</span>
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">-12% vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MTTA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.mtta}</span>
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">-5% vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${
                metrics.slaCompliance >= 95 ? 'text-green-500' : 
                metrics.slaCompliance >= 90 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {metrics.slaCompliance.toFixed(1)}%
              </span>
            </div>
            <Progress value={metrics.slaCompliance} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{alerts.filter(a => a.status === 'firing').length}</span>
              <span className="text-sm text-muted-foreground">firing</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {alerts.length} total in {selectedTimeRange}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search incidents, services, or descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="identified">Identified</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings(s => ({ ...s, showResolved: !s.showResolved }))}
            >
              {settings.showResolved ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {settings.showResolved ? 'Hide Resolved' : 'Show Resolved'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Incidents ({filteredIncidents.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.filter(a => a.status === 'firing').length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="services">Service Status</TabsTrigger>
          <TabsTrigger value="teams">Team Load</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Incident List */}
            <div className="lg:col-span-2">
              <Card className="h-[700px] flex flex-col">
                <CardHeader>
                  <CardTitle>Active Incidents</CardTitle>
                  <CardDescription>
                    {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
                    {filteredIncidents.length > 0 && ` (${filteredIncidents.filter(i => i.severity === 'critical').length} critical)`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className={`space-y-${settings.compactView ? '1' : '3'}`}>
                      {filteredIncidents.map((incident) => (
                        <button
                          key={incident.id}
                          onClick={() => setSelectedIncident(incident)}
                          className={`w-full text-left p-${settings.compactView ? '2' : '4'} rounded-lg border hover:bg-muted transition-colors ${
                            selectedIncident?.id === incident.id ? 'bg-muted border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-2 flex-1">
                              <div className={`mt-1 h-2 w-2 rounded-full ${getSeverityBgColor(incident.severity)}`} />
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium line-clamp-${settings.compactView ? '1' : '2'}`}>
                                  {incident.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {incident.priority}
                                  </Badge>
                                  <Badge className={`${getStatusColor(incident.status)} text-white text-xs`}>
                                    {incident.status}
                                  </Badge>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatDuration(incident.createdAt, incident.resolvedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={incident.slaStatus === 'breached' ? 'destructive' : 'outline'} className="text-xs">
                                SLA: {incident.slaStatus}
                              </Badge>
                            </div>
                          </div>
                          
                          {!settings.compactView && (
                            <>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {incident.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  <span>{incident.incidentCommander.name}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                  {incident.affectedServices.slice(0, 2).map(service => (
                                    <Badge key={service} variant="secondary" className="text-xs">
                                      {service}
                                    </Badge>
                                  ))}
                                  {incident.affectedServices.length > 2 && (
                                    <span className="text-muted-foreground">+{incident.affectedServices.length - 2}</span>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                      
                      {filteredIncidents.length === 0 && (
                        <div className="flex items-center justify-center h-32">
                          <div className="text-center">
                            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No incidents found</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Incident Detail Panel */}
            <div className="lg:col-span-1">
              <Card className="h-[700px] flex flex-col">
                <CardHeader>
                  <CardTitle>Incident Details</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  {selectedIncident ? (
                    <ScrollArea className="h-full">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`h-3 w-3 rounded-full ${getSeverityBgColor(selectedIncident.severity)}`} />
                            <h3 className="font-semibold">{selectedIncident.title}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{selectedIncident.priority}</Badge>
                            <Badge className={`${getStatusColor(selectedIncident.status)} text-white`}>
                              {selectedIncident.status}
                            </Badge>
                            <Badge variant={selectedIncident.slaStatus === 'breached' ? 'destructive' : 'outline'}>
                              SLA: {selectedIncident.slaStatus}
                            </Badge>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Affected Services</h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedIncident.affectedServices.map(service => (
                              <Badge key={service} variant="secondary" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Response Team</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              <span className="text-sm font-medium">Commander:</span>
                              <span className="text-sm">{selectedIncident.incidentCommander.name}</span>
                            </div>
                            {selectedIncident.team.map(member => (
                              <div key={member.id} className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                <span className="text-sm">{member.name} ({member.role})</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Metrics</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Detection:</span>
                              <div>{selectedIncident.metrics.detectionTime}m</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ack Time:</span>
                              <div>{selectedIncident.metrics.acknowledgmentTime}m</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Escalations:</span>
                              <div>{selectedIncident.metrics.escalations}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Runbooks:</span>
                              <div>{selectedIncident.metrics.runbooksExecuted}</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Timeline</h4>
                          <div className="text-sm space-y-1">
                            <div>Created: {selectedIncident.createdAt.toLocaleString()}</div>
                            {selectedIncident.acknowledgedAt && (
                              <div>Acknowledged: {selectedIncident.acknowledgedAt.toLocaleString()}</div>
                            )}
                            {selectedIncident.resolvedAt && (
                              <div>Resolved: {selectedIncident.resolvedAt.toLocaleString()}</div>
                            )}
                            <div>Duration: {formatDuration(selectedIncident.createdAt, selectedIncident.resolvedAt)}</div>
                          </div>
                        </div>

                        <div className="pt-4">
                          <Button className="w-full mb-2">
                            View Full Details
                          </Button>
                          <Button variant="outline" className="w-full">
                            Join Response
                          </Button>
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Select an incident to view details</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>
                Showing latest {alerts.length} alerts from monitoring systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-500' :
                          alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{alert.source}</span>
                            <span>•</span>
                            <span>{alert.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${
                          alert.status === 'firing' ? 'bg-red-500' : 'bg-green-500'
                        } text-white`}>
                          {alert.status}
                        </Badge>
                        {alert.incidentId && (
                          <Badge variant="outline">Incident Created</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incident Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Incident Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="incidents" stroke="#8884d8" name="Created" />
                    <Line type="monotone" dataKey="resolved" stroke="#82ca9d" name="Resolved" />
                    <Line type="monotone" dataKey="alerts" stroke="#ffc658" name="Alerts" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={metrics.severityDistribution}
                      dataKey="count"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      label
                    >
                      {metrics.severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.serviceImpact.map((service) => (
              <Card key={service.service}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {service.service}
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-500' :
                      service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Active Incidents:</span>
                      <span className="font-medium">{service.incidents}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Status:</span>
                      <Badge variant={
                        service.status === 'healthy' ? 'default' :
                        service.status === 'degraded' ? 'secondary' : 'destructive'
                      }>
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.responseTeamLoad.map((team) => (
              <Card key={team.team}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{team.team}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Active Incidents:</span>
                      <span className="font-medium">{team.activeIncidents}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Workload:</span>
                        <span>{team.load}%</span>
                      </div>
                      <Progress value={team.load} className="h-2" />
                    </div>
                    <Badge variant={
                      team.load < 50 ? 'default' :
                      team.load < 80 ? 'secondary' : 'destructive'
                    }>
                      {team.load < 50 ? 'Normal' : team.load < 80 ? 'Busy' : 'Overloaded'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}