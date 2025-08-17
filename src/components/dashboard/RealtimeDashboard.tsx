'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  GitBranch, 
  Package, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users,
  TrendingUp,
  Zap,
  Globe,
  Database,
  Webhook,
  Bell,
  Eye,
  Settings
} from 'lucide-react';
import { enhancedWebSocketService } from '@/lib/websocket/EnhancedWebSocketService';
import { RealtimeEventService } from '@/lib/events/realtime-event-service';

interface DashboardMetrics {
  totalEvents: number;
  activeConnections: number;
  pluginUpdates: number;
  securityScans: number;
  qualityChecks: number;
  notifications: number;
}

interface RealtimeEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  source: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface PluginActivity {
  id: string;
  name: string;
  repository: string;
  action: string;
  timestamp: string;
  source: 'github' | 'gitlab' | 'azuredevops' | 'npm';
  status: 'success' | 'pending' | 'failed';
}

interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  repository?: string;
  package?: string;
  timestamp: string;
  acknowledged: boolean;
}

interface QualityMetric {
  repository: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'up' | 'down' | 'stable';
  lastEvaluated: string;
}

export default function RealtimeDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalEvents: 0,
    activeConnections: 0,
    pluginUpdates: 0,
    securityScans: 0,
    qualityChecks: 0,
    notifications: 0
  });

  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [pluginActivities, setPluginActivities] = useState<PluginActivity[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetric[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnecting...');

  useEffect(() => {
    initializeRealtimeConnection();
    return () => {
      enhancedWebSocketService.destroy();
    };
  }, []);

  const initializeRealtimeConnection = async () => {
    try {
      await enhancedWebSocketService.connect({
        tenantId: 'default',
        userId: 'dashboard-user',
        metadata: { component: 'realtime-dashboard' }
      });

      setIsConnected(true);
      setConnectionStatus('Connected');

      // Subscribe to various event types
      enhancedWebSocketService.subscribeToPluginUpdates();
      enhancedWebSocketService.subscribeToQualityUpdates();
      enhancedWebSocketService.subscribeToSecurityUpdates();
      enhancedWebSocketService.subscribeToCatalogUpdates();
      enhancedWebSocketService.subscribeToNotifications();

      // Set up event handlers
      setupEventHandlers();

      // Load initial data
      loadInitialData();

    } catch (error) {
      console.error('Failed to connect to realtime service:', error);
      setIsConnected(false);
      setConnectionStatus('Connection Failed');
    }
  };

  const setupEventHandlers = () => {
    // Plugin repository updates
    enhancedWebSocketService.on('plugin.repository.updated', (data) => {
      console.log('Plugin repository updated:', data);
      
      const activity: PluginActivity = {
        id: `activity_${Date.now()}`,
        name: data.repository.name,
        repository: data.repository.fullName,
        action: `Updated ${data.commits.length} commit(s) on ${data.branch}`,
        timestamp: data.timestamp,
        source: data.source || 'github',
        status: 'success'
      };

      setPluginActivities(prev => [activity, ...prev.slice(0, 19)]);
      setMetrics(prev => ({ ...prev, pluginUpdates: prev.pluginUpdates + 1 }));
      addEvent({
        id: `event_${Date.now()}`,
        type: 'plugin.update',
        data,
        timestamp: data.timestamp,
        source: data.source || 'github'
      });
    });

    // Quality evaluation events
    enhancedWebSocketService.on('quality.evaluation.started', (data) => {
      console.log('Quality evaluation started:', data);
      
      setMetrics(prev => ({ ...prev, qualityChecks: prev.qualityChecks + 1 }));
      addEvent({
        id: `event_${Date.now()}`,
        type: 'quality.evaluation',
        data,
        timestamp: data.timestamp,
        source: data.source || 'system'
      });
    });

    // Security scan events
    enhancedWebSocketService.on('security.scan.triggered', (data) => {
      console.log('Security scan triggered:', data);
      
      setMetrics(prev => ({ ...prev, securityScans: prev.securityScans + 1 }));
      addEvent({
        id: `event_${Date.now()}`,
        type: 'security.scan',
        data,
        timestamp: data.timestamp,
        source: data.source || 'system',
        severity: 'medium'
      });
    });

    // GitHub events
    enhancedWebSocketService.on('github.push', (data) => {
      console.log('GitHub push event:', data);
      addEvent({
        id: `event_${Date.now()}`,
        type: 'github.push',
        data,
        timestamp: data.timestamp,
        source: 'github'
      });
    });

    // GitLab events
    enhancedWebSocketService.on('gitlab.push', (data) => {
      console.log('GitLab push event:', data);
      addEvent({
        id: `event_${Date.now()}`,
        type: 'gitlab.push',
        data,
        timestamp: data.timestamp,
        source: 'gitlab'
      });
    });

    // Azure DevOps events
    enhancedWebSocketService.on('azuredevops.push', (data) => {
      console.log('Azure DevOps push event:', data);
      addEvent({
        id: `event_${Date.now()}`,
        type: 'azuredevops.push',
        data,
        timestamp: data.timestamp,
        source: 'azuredevops'
      });
    });

    // NPM events
    enhancedWebSocketService.on('npm.package.published', (data) => {
      console.log('NPM package published:', data);
      
      if (data.isPluginPackage) {
        const activity: PluginActivity = {
          id: `activity_${Date.now()}`,
          name: data.package.name,
          repository: data.package.name,
          action: `Published version ${data.package.version}`,
          timestamp: data.timestamp,
          source: 'npm',
          status: 'success'
        };

        setPluginActivities(prev => [activity, ...prev.slice(0, 19)]);
      }

      addEvent({
        id: `event_${Date.now()}`,
        type: 'npm.publish',
        data,
        timestamp: data.timestamp,
        source: 'npm'
      });
    });

    // Notification events
    enhancedWebSocketService.on('notification', (data) => {
      console.log('Notification received:', data);
      
      setMetrics(prev => ({ ...prev, notifications: prev.notifications + 1 }));
      
      if (data.type.includes('security')) {
        const alert: SecurityAlert = {
          id: data.id,
          title: data.title,
          description: data.message,
          severity: data.priority || 'medium',
          repository: data.data?.repository,
          package: data.data?.package,
          timestamp: data.createdAt,
          acknowledged: false
        };

        setSecurityAlerts(prev => [alert, ...prev.slice(0, 9)]);
      }
    });

    // Connection status events
    enhancedWebSocketService.on('connected', () => {
      setIsConnected(true);
      setConnectionStatus('Connected');
    });

    enhancedWebSocketService.on('disconnected', () => {
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    });

    enhancedWebSocketService.on('error', (error) => {
      setIsConnected(false);
      setConnectionStatus(`Error: ${error.message}`);
    });
  };

  const addEvent = (event: RealtimeEvent) => {
    setEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
    setMetrics(prev => ({ ...prev, totalEvents: prev.totalEvents + 1 }));
  };

  const loadInitialData = () => {
    // Simulate initial data
    setQualityMetrics([
      {
        repository: 'backstage/backstage-plugin-catalog',
        score: 95,
        grade: 'A',
        trend: 'up',
        lastEvaluated: new Date().toISOString()
      },
      {
        repository: 'roadiehq/backstage-plugin-jira',
        score: 88,
        grade: 'B',
        trend: 'stable',
        lastEvaluated: new Date().toISOString()
      },
      {
        repository: 'spotify/backstage-plugin-techdocs',
        score: 92,
        grade: 'A',
        trend: 'up',
        lastEvaluated: new Date().toISOString()
      }
    ]);
  };

  const acknowledgeAlert = (alertId: string) => {
    setSecurityAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'github': return '🐱';
      case 'gitlab': return '🦊';
      case 'azuredevops': return '🔷';
      case 'npm': return '📦';
      default: return '⚡';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Real-time Plugin Portal Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Live monitoring of plugin activities, security, and quality across all platforms
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isConnected ? "default" : "destructive"} className="px-3 py-1">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                {connectionStatus}
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalEvents}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Plugin Updates</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.pluginUpdates}</p>
                </div>
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Security Scans</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.securityScans}</p>
                </div>
                <Shield className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Quality Checks</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.qualityChecks}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Notifications</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.notifications}</p>
                </div>
                <Bell className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Connections</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.activeConnections}</p>
                </div>
                <Users className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="activities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="activities">Plugin Activities</TabsTrigger>
            <TabsTrigger value="security">Security Alerts</TabsTrigger>
            <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
            <TabsTrigger value="events">Live Events</TabsTrigger>
            <TabsTrigger value="sources">Event Sources</TabsTrigger>
          </TabsList>

          <TabsContent value="activities">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GitBranch className="w-5 h-5 mr-2" />
                  Recent Plugin Activities
                </CardTitle>
                <CardDescription>
                  Real-time updates from GitHub, GitLab, Azure DevOps, and NPM
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {pluginActivities.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No plugin activities yet. Activities will appear here in real-time.</p>
                      </div>
                    ) : (
                      pluginActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-4 p-4 bg-white rounded-lg border">
                          <div className="text-2xl">{getSourceIcon(activity.source)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {activity.name}
                              </h4>
                              <Badge variant={activity.status === 'success' ? 'default' : 'destructive'}>
                                {activity.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{activity.repository}</p>
                            <p className="text-sm text-gray-800 mt-1">{activity.action}</p>
                            <p className="text-xs text-gray-500 mt-2">{formatTimestamp(activity.timestamp)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Alerts
                </CardTitle>
                <CardDescription>
                  Real-time security findings and vulnerability alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {securityAlerts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No security alerts. This is good news!</p>
                      </div>
                    ) : (
                      securityAlerts.map((alert) => (
                        <Alert key={alert.id} className={!alert.acknowledged ? getSeverityColor(alert.severity) : 'bg-gray-50'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="flex items-center justify-between">
                            {alert.title}
                            {!alert.acknowledged && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => acknowledgeAlert(alert.id)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Acknowledge
                              </Button>
                            )}
                          </AlertTitle>
                          <AlertDescription>
                            <p className="mt-2">{alert.description}</p>
                            {(alert.repository || alert.package) && (
                              <p className="text-xs mt-2">
                                {alert.repository && `Repository: ${alert.repository}`}
                                {alert.package && `Package: ${alert.package}`}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {formatTimestamp(alert.timestamp)}
                            </p>
                          </AlertDescription>
                        </Alert>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Quality Metrics
                </CardTitle>
                <CardDescription>
                  Plugin quality scores and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {qualityMetrics.map((metric) => (
                    <div key={metric.repository} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900">{metric.repository}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Last evaluated: {formatTimestamp(metric.lastEvaluated)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{metric.score}</div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                        <Badge variant={metric.grade === 'A' ? 'default' : metric.grade === 'B' ? 'secondary' : 'destructive'}>
                          Grade {metric.grade}
                        </Badge>
                        <div className={`w-4 h-4 rounded-full ${
                          metric.trend === 'up' ? 'bg-green-400' : 
                          metric.trend === 'down' ? 'bg-red-400' : 'bg-gray-400'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Live Event Stream
                </CardTitle>
                <CardDescription>
                  Real-time events from all connected sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {events.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No events yet. Events will stream here in real-time.</p>
                      </div>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="flex items-start space-x-3 p-3 bg-white rounded border">
                          <div className="text-lg">{getSourceIcon(event.source)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{event.type}</span>
                              <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1 truncate">
                              Source: {event.source}
                            </p>
                            {event.severity && (
                              <Badge variant="outline" className={`mt-1 ${getSeverityColor(event.severity)}`}>
                                {event.severity}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <div className="text-2xl mr-2">🐱</div>
                    GitHub
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Events</span>
                      <span className="text-sm font-medium">{events.filter(e => e.source === 'github').length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Webhooks</span>
                      <Webhook className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <div className="text-2xl mr-2">🦊</div>
                    GitLab
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Events</span>
                      <span className="text-sm font-medium">{events.filter(e => e.source === 'gitlab').length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Webhooks</span>
                      <Webhook className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <div className="text-2xl mr-2">🔷</div>
                    Azure DevOps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Events</span>
                      <span className="text-sm font-medium">{events.filter(e => e.source === 'azuredevops').length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Webhooks</span>
                      <Webhook className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <div className="text-2xl mr-2">📦</div>
                    NPM Registry
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge variant="default">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Events</span>
                      <span className="text-sm font-medium">{events.filter(e => e.source === 'npm').length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Webhooks</span>
                      <Webhook className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Real-time Plugin Portal Dashboard - Enterprise Grade
            </div>
            <div className="flex items-center space-x-4">
              <span>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</span>
              <span>Events: {metrics.totalEvents}</span>
              <span>Last Update: {events.length > 0 ? formatTimestamp(events[0].timestamp) : 'Never'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}