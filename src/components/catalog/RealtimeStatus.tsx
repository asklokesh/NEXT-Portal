'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  Clock, 
  Users, 
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Bell,
  Settings,
  Eye,
  EyeOff,
  Filter,
  Trash2,
} from 'lucide-react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: number;
  source: string;
  entityId?: string;
  namespace?: string;
  team?: string;
  userId?: string;
}

interface ConnectionStats {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  connectedAt?: number;
  lastActivity?: number;
  reconnectAttempts: number;
  latency?: number;
}

interface RealtimeStatusProps {
  className?: string;
  showActivityFeed?: boolean;
  maxEvents?: number;
  filters?: {
    eventTypes?: string[];
    sources?: string[];
    namespaces?: string[];
  };
}

const getStatusColor = (status: ConnectionStats['status']) => {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'connecting': return 'bg-yellow-500';
    case 'disconnected': return 'bg-gray-500';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getStatusIcon = (status: ConnectionStats['status']) => {
  switch (status) {
    case 'connected': return <Wifi className="h-4 w-4" />;
    case 'connecting': return <RefreshCw className="h-4 w-4 animate-spin" />;
    case 'disconnected': return <WifiOff className="h-4 w-4" />;
    case 'error': return <AlertCircle className="h-4 w-4" />;
    default: return <WifiOff className="h-4 w-4" />;
  }
};

const getEventIcon = (eventType: string) => {
  if (eventType.includes('entity')) return <Server className="h-4 w-4" />;
  if (eventType.includes('template')) return <Zap className="h-4 w-4" />;
  if (eventType.includes('plugin')) return <Settings className="h-4 w-4" />;
  if (eventType.includes('health')) return <Activity className="h-4 w-4" />;
  if (eventType.includes('github')) return <div className="h-4 w-4 rounded-full bg-gray-800" />;
  if (eventType.includes('gitlab')) return <div className="h-4 w-4 rounded-full bg-orange-500" />;
  return <Bell className="h-4 w-4" />;
};

const formatEventTitle = (event: ActivityEvent): string => {
  const { type, data } = event;
  
  if (type.includes('entity')) {
    return `${data.entity?.name || 'Entity'} ${type.split('.').pop()}`;
  }
  
  if (type.includes('template')) {
    return `Template ${data.template?.name || 'execution'} ${type.split('.').pop()}`;
  }
  
  if (type.includes('github')) {
    return `GitHub ${type.split('.').pop()}: ${data.repository || 'repository'}`;
  }
  
  if (type.includes('plugin')) {
    return `Plugin ${data.plugin?.name || 'event'} ${type.split('.').pop()}`;
  }
  
  return type.replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
};

const formatEventDescription = (event: ActivityEvent): string => {
  const { type, data } = event;
  
  if (type.includes('push') && data.commits) {
    return `${data.commits} commit(s) to ${data.branch || 'unknown branch'}`;
  }
  
  if (type.includes('pull_request')) {
    return `PR #${data.pullRequest?.number}: ${data.pullRequest?.title || 'No title'}`;
  }
  
  if (type.includes('entity')) {
    return `${data.kind || 'Entity'} in ${data.namespace || 'default'} namespace`;
  }
  
  if (type.includes('template.execution')) {
    return `Status: ${data.execution?.status || 'unknown'}`;
  }
  
  return JSON.stringify(data).slice(0, 100) + (JSON.stringify(data).length > 100 ? '...' : '');
};

export function RealtimeStatus({ 
  className = '', 
  showActivityFeed = true,
  maxEvents = 50,
  filters = {},
}: RealtimeStatusProps) {
  const { 
    isConnected, 
    connectionStatus, 
    events,
    stats,
    reconnect,
    disconnect,
    subscribe,
    unsubscribe,
  } = useRealtimeSync();

  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [isActivityVisible, setIsActivityVisible] = useState(true);
  const [activeFilters, setActiveFilters] = useState(filters);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    status: 'disconnected',
    reconnectAttempts: 0,
  });

  // Update connection stats
  useEffect(() => {
    setConnectionStats(prev => ({
      ...prev,
      status: isConnected ? 'connected' : connectionStatus || 'disconnected',
      connectedAt: isConnected && !prev.connectedAt ? Date.now() : prev.connectedAt,
      lastActivity: events.length > 0 ? Date.now() : prev.lastActivity,
    }));
  }, [isConnected, connectionStatus, events.length]);

  // Process incoming events
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];
    const activityEvent: ActivityEvent = {
      id: `${latestEvent.timestamp}-${Math.random()}`,
      type: latestEvent.type,
      data: latestEvent.data,
      timestamp: latestEvent.timestamp,
      source: latestEvent.source || 'unknown',
      entityId: latestEvent.data?.entity?.id || latestEvent.data?.entityId,
      namespace: latestEvent.data?.namespace,
      team: latestEvent.data?.team,
      userId: latestEvent.data?.userId,
    };

    // Apply filters
    const passesFilter = (
      (!activeFilters.eventTypes || activeFilters.eventTypes.includes(activityEvent.type)) &&
      (!activeFilters.sources || activeFilters.sources.includes(activityEvent.source)) &&
      (!activeFilters.namespaces || !activityEvent.namespace || 
       activeFilters.namespaces.includes(activityEvent.namespace))
    );

    if (passesFilter) {
      setActivityEvents(prev => {
        const updated = [activityEvent, ...prev].slice(0, maxEvents);
        return updated;
      });
    }
  }, [events, activeFilters, maxEvents]);

  const handleReconnect = useCallback(() => {
    setConnectionStats(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1,
    }));
    reconnect();
  }, [reconnect]);

  const clearActivityFeed = useCallback(() => {
    setActivityEvents([]);
  }, []);

  const toggleActivityVisibility = useCallback(() => {
    setIsActivityVisible(prev => !prev);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(connectionStats.status)}`} />
                {getStatusIcon(connectionStats.status)}
                <span className="font-medium">
                  {connectionStats.status === 'connected' ? 'Connected' : 
                   connectionStats.status === 'connecting' ? 'Connecting...' :
                   connectionStats.status === 'error' ? 'Connection Error' : 'Disconnected'}
                </span>
              </div>
              
              {connectionStats.connectedAt && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDistanceToNow(new Date(connectionStats.connectedAt), { addSuffix: true })}
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {stats && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Users className="h-4 w-4 mr-1" />
                      {stats.activeConnections}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <h4 className="font-medium">Real-time Statistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Active Connections</div>
                          <div className="font-medium">{stats.activeConnections}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Messages Processed</div>
                          <div className="font-medium">{stats.messagesProcessed}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Active Rooms</div>
                          <div className="font-medium">{stats.roomsActive}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Connections</div>
                          <div className="font-medium">{stats.totalConnections}</div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {!isConnected && (
                <Button variant="outline" size="sm" onClick={handleReconnect}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
              )}

              {isConnected && (
                <Button variant="outline" size="sm" onClick={disconnect}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {connectionStats.reconnectAttempts > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              Reconnection attempts: {connectionStats.reconnectAttempts}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      {showActivityFeed && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                Real-time Activity
                <Badge variant="secondary" className="ml-2">
                  {activityEvents.length}
                </Badge>
              </CardTitle>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleActivityVisibility}
                >
                  {isActivityVisible ? 
                    <EyeOff className="h-4 w-4" /> : 
                    <Eye className="h-4 w-4" />
                  }
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <h4 className="font-medium">Activity Filters</h4>
                      <div className="text-sm text-muted-foreground">
                        Filters are applied to incoming events
                      </div>
                      {/* Add filter controls here if needed */}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearActivityFeed}
                  disabled={activityEvents.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {isActivityVisible && (
            <CardContent className="pt-0">
              <ScrollArea className="h-96">
                {activityEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                    <p className="text-xs mt-1">Events will appear here when they occur</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityEvents.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-shrink-0 mt-0.5">
                            {getEventIcon(event.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">
                                {formatEventTitle(event)}
                              </p>
                              <Badge variant="outline" className="text-xs ml-2">
                                {event.source}
                              </Badge>
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {formatEventDescription(event)}
                            </p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                                </span>
                                
                                {event.namespace && (
                                  <>
                                    <Separator orientation="vertical" className="h-3" />
                                    <span>{event.namespace}</span>
                                  </>
                                )}
                              </div>
                              
                              {event.type.includes('error') || event.type.includes('failed') ? (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {index < activityEvents.length - 1 && (
                          <Separator className="ml-9" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}