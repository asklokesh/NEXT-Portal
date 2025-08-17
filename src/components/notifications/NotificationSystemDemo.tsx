/**
 * Notification System Demo Components
 * 
 * These components demonstrate how to integrate and use the advanced
 * notification and communication system in your React application.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Bell, MessageSquare, AlertTriangle, Settings, Send, Users } from 'lucide-react';
import { notificationSystem } from '@/services/notifications';
import type { Notification } from '@/services/notifications/notification-service';

// Mock user for demo purposes
const DEMO_USER = 'demo-user-123';

interface NotificationSystemDemoProps {
  className?: string;
}

export function NotificationSystemDemo({ className }: NotificationSystemDemoProps) {
  return (
    <div className={`p-6 space-y-6 ${className}`}>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Advanced Notification System Demo
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Experience multi-channel notifications, real-time messaging, and intelligent alerting
        </p>
      </div>
      
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell size={16} />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageSquare size={16} />
            Messaging
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings size={16} />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NotificationSender />
            <NotificationCenter />
          </div>
          <NotificationTemplates />
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MessageComposer />
            <CommunicationStatus />
          </div>
          <ChannelManagement />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertCreator />
            <AlertMetrics />
          </div>
          <IncidentManagement />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NotificationPreferences />
            <IntegrationConfig />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Notification Sender Component
function NotificationSender() {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'critical',
    channel: 'auto',
    userId: DEMO_USER,
  });
  const [sending, setSending] = useState(false);
  const [lastSentId, setLastSentId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    try {
      const notificationId = await notificationSystem.sendNotification({
        userId: formData.userId,
        title: formData.title,
        message: formData.message,
        priority: formData.priority,
        channel: formData.channel === 'auto' ? undefined : formData.channel,
      });
      
      setLastSentId(notificationId);
      
      // Reset form
      setFormData({
        ...formData,
        title: '',
        message: '',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send size={20} />
          Send Notification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Notification title"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Notification message"
              className="w-full p-2 border rounded-md resize-none h-20"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="channel">Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={(value) => setFormData({ ...formData, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto Select</SelectItem>
                  <SelectItem value="in-app">In-App</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button type="submit" disabled={sending} className="w-full">
            {sending ? 'Sending...' : 'Send Notification'}
          </Button>
          
          {lastSentId && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Notification sent successfully! ID: {lastSentId}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// Notification Center Component
function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load initial notifications
    const loadNotifications = () => {
      const allNotifications = notificationSystem.getLegacyNotificationService().getNotifications();
      setNotifications(allNotifications);
      setUnreadCount(notificationSystem.getLegacyNotificationService().getUnreadCount());
    };

    loadNotifications();

    // Listen for new notifications
    const handleNewNotification = (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    const handleNotificationRead = () => {
      setUnreadCount(notificationSystem.getLegacyNotificationService().getUnreadCount());
    };

    const service = notificationSystem.getLegacyNotificationService();
    service.on('new_notification', handleNewNotification);
    service.on('notification_read', handleNotificationRead);
    service.on('all_notifications_read', () => setUnreadCount(0));

    return () => {
      service.off('new_notification', handleNewNotification);
      service.off('notification_read', handleNotificationRead);
    };
  }, []);

  const markAsRead = (id: string) => {
    notificationSystem.getLegacyNotificationService().markAsRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    notificationSystem.getLegacyNotificationService().markAllAsRead();
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} />
            Notification Center
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllAsRead}>
              Mark All Read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notifications yet</p>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                  notification.read
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {notification.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {notification.priority}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Notification Templates Component
function NotificationTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateData, setTemplateData] = useState('{}');

  const templates = [
    {
      id: 'deployment-status',
      name: 'Deployment Status',
      variables: ['serviceName', 'environment', 'version', 'success', 'link'],
    },
    {
      id: 'entity-update',
      name: 'Entity Update',
      variables: ['entityType', 'entityName', 'changes', 'link'],
    },
    {
      id: 'incident-alert',
      name: 'Incident Alert',
      variables: ['title', 'severity', 'service', 'time', 'impact', 'description', 'link'],
    },
  ];

  const sendTemplateNotification = async () => {
    if (!selectedTemplate) return;
    
    try {
      const data = JSON.parse(templateData);
      await notificationSystem.getNotificationEngine().send({
        userId: DEMO_USER,
        templateId: selectedTemplate,
        priority: 'normal',
        data,
      });
    } catch (error) {
      console.error('Failed to send template notification:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="template">Select Template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && (
          <>
            <div>
              <Label htmlFor="template-data">Template Data (JSON)</Label>
              <textarea
                id="template-data"
                value={templateData}
                onChange={(e) => setTemplateData(e.target.value)}
                placeholder="Enter template data as JSON"
                className="w-full p-2 border rounded-md font-mono text-sm h-32"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables:{' '}
                {templates
                  .find(t => t.id === selectedTemplate)
                  ?.variables.join(', ')}
              </p>
            </div>

            <Button onClick={sendTemplateNotification}>
              Send Template Notification
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Message Composer Component
function MessageComposer() {
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('general');
  const [status, setStatus] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setStatus('Sending message...');
    
    // Simulate message sending
    setTimeout(() => {
      setStatus('Message sent to #' + channel);
      setMessage('');
      setTimeout(() => setStatus(null), 2000);
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare size={20} />
          Send Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="channel-select">Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">#general</SelectItem>
              <SelectItem value="incidents">#incidents</SelectItem>
              <SelectItem value="deployments">#deployments</SelectItem>
              <SelectItem value="platform-team">#platform-team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full p-2 border rounded-md resize-none h-24"
          />
        </div>
        
        <Button onClick={sendMessage} disabled={!message.trim()}>
          Send Message
        </Button>
        
        {status && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{status}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Communication Status Component
function CommunicationStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers] = useState(['Alice', 'Bob', 'Charlie', 'David']);
  const [activeChannels] = useState(['#general', '#incidents', '#platform-team']);

  useEffect(() => {
    // Simulate connection status
    const timer = setTimeout(() => setIsConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} />
          Communication Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm">
            {isConnected ? 'Connected to communication hub' : 'Connecting...'}
          </span>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-medium text-sm mb-2">Online Users ({onlineUsers.length})</h4>
          <div className="space-y-1">
            {onlineUsers.map((user) => (
              <div key={user} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{user}</span>
              </div>
            ))}
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-medium text-sm mb-2">Active Channels</h4>
          <div className="space-y-1">
            {activeChannels.map((channel) => (
              <div key={channel} className="text-sm text-gray-600">
                {channel}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Channel Management Component
function ChannelManagement() {
  const [channels] = useState([
    { id: '1', name: 'general', type: 'public', members: 12 },
    { id: '2', name: 'incidents', type: 'public', members: 8 },
    { id: '3', name: 'platform-team', type: 'private', members: 5 },
    { id: '4', name: 'deployments', type: 'public', members: 15 },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="flex items-center justify-between p-3 border rounded-md"
            >
              <div>
                <div className="font-medium">#{channel.name}</div>
                <div className="text-sm text-gray-600">
                  {channel.type} • {channel.members} members
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Join
                </Button>
                <Button size="sm" variant="outline">
                  Settings
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Alert Creator Component
function AlertCreator() {
  const [alertData, setAlertData] = useState({
    name: '',
    severity: 'warning' as 'info' | 'warning' | 'error' | 'critical',
    source: '',
    service: '',
    message: '',
  });
  const [creating, setCreating] = useState(false);

  const createAlert = async () => {
    if (!alertData.name || !alertData.message) return;
    
    setCreating(true);
    try {
      await notificationSystem.createAlert({
        name: alertData.name,
        severity: alertData.severity,
        source: alertData.source || 'demo',
        service: alertData.service,
        message: alertData.message,
        labels: { environment: 'demo' },
      });
      
      // Reset form
      setAlertData({
        name: '',
        severity: 'warning',
        source: '',
        service: '',
        message: '',
      });
    } catch (error) {
      console.error('Failed to create alert:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={20} />
          Create Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="alert-name">Alert Name</Label>
          <Input
            id="alert-name"
            value={alertData.name}
            onChange={(e) => setAlertData({ ...alertData, name: e.target.value })}
            placeholder="e.g., High CPU Usage"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Select
              value={alertData.severity}
              onValueChange={(value) => setAlertData({ ...alertData, severity: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={alertData.source}
              onChange={(e) => setAlertData({ ...alertData, source: e.target.value })}
              placeholder="e.g., monitoring"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="service">Service</Label>
          <Input
            id="service"
            value={alertData.service}
            onChange={(e) => setAlertData({ ...alertData, service: e.target.value })}
            placeholder="e.g., user-service"
          />
        </div>
        
        <div>
          <Label htmlFor="alert-message">Message</Label>
          <textarea
            id="alert-message"
            value={alertData.message}
            onChange={(e) => setAlertData({ ...alertData, message: e.target.value })}
            placeholder="Alert description"
            className="w-full p-2 border rounded-md resize-none h-20"
          />
        </div>
        
        <Button onClick={createAlert} disabled={creating}>
          {creating ? 'Creating Alert...' : 'Create Alert'}
        </Button>
      </CardContent>
    </Card>
  );
}

// Alert Metrics Component
function AlertMetrics() {
  const [metrics] = useState({
    totalAlerts: 42,
    firingAlerts: 3,
    resolvedAlerts: 39,
    mttr: 15.5, // minutes
    alertsBySeverity: {
      critical: 1,
      error: 2,
      warning: 15,
      info: 24,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.totalAlerts}</div>
            <div className="text-sm text-gray-600">Total Alerts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{metrics.firingAlerts}</div>
            <div className="text-sm text-gray-600">Firing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{metrics.resolvedAlerts}</div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{metrics.mttr}m</div>
            <div className="text-sm text-gray-600">MTTR</div>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-medium text-sm mb-2">By Severity</h4>
          <div className="space-y-2">
            {Object.entries(metrics.alertsBySeverity).map(([severity, count]) => (
              <div key={severity} className="flex items-center justify-between">
                <Badge
                  variant={
                    severity === 'critical' ? 'destructive' :
                    severity === 'error' ? 'destructive' :
                    severity === 'warning' ? 'default' : 'secondary'
                  }
                >
                  {severity}
                </Badge>
                <span className="text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Incident Management Component
function IncidentManagement() {
  const [incidents] = useState([
    {
      id: '1',
      title: 'Database Connection Issues',
      severity: 'high',
      status: 'investigating',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: '2',
      title: 'API Rate Limit Exceeded',
      severity: 'medium',
      status: 'resolved',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Incidents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="p-3 border rounded-md">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm">{incident.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={
                        incident.severity === 'high' ? 'destructive' :
                        incident.severity === 'medium' ? 'default' : 'secondary'
                      }
                    >
                      {incident.severity}
                    </Badge>
                    <Badge variant="outline">
                      {incident.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {incident.createdAt.toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Notification Preferences Component
function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    email: { enabled: true, quietHours: false },
    slack: { enabled: true, quietHours: false },
    inApp: { enabled: true, quietHours: false },
    batching: { enabled: false },
  });

  const updatePreference = (channel: string, field: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const savePreferences = async () => {
    try {
      await notificationSystem.getNotificationEngine().setUserPreferences({
        userId: DEMO_USER,
        channels: {
          email: { enabled: preferences.email.enabled },
          slack: { enabled: preferences.slack.enabled },
          'in-app': { enabled: preferences.inApp.enabled },
        },
        batching: {
          enabled: preferences.batching.enabled,
          interval: 60,
          maxBatch: 10,
        },
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(preferences).filter(([key]) => key !== 'batching').map(([channel, prefs]) => (
          <div key={channel} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="capitalize">{channel === 'inApp' ? 'In-App' : channel}</Label>
              <Switch
                checked={prefs.enabled}
                onCheckedChange={(checked) => updatePreference(channel, 'enabled', checked)}
              />
            </div>
            {prefs.enabled && (
              <div className="ml-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`${channel}-quiet`}
                    checked={prefs.quietHours}
                    onCheckedChange={(checked) => updatePreference(channel, 'quietHours', checked)}
                  />
                  <Label htmlFor={`${channel}-quiet`} className="text-sm">
                    Respect quiet hours (10 PM - 8 AM)
                  </Label>
                </div>
              </div>
            )}
          </div>
        ))}
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <Label>Enable Notification Batching</Label>
          <Switch
            checked={preferences.batching.enabled}
            onCheckedChange={(checked) => updatePreference('batching', 'enabled', checked)}
          />
        </div>
        
        <Button onClick={savePreferences} className="w-full">
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

// Integration Configuration Component
function IntegrationConfig() {
  const [integrations] = useState([
    { name: 'Email (SMTP)', status: 'connected', lastTest: '2 hours ago' },
    { name: 'Slack', status: 'disconnected', lastTest: 'Never' },
    { name: 'Microsoft Teams', status: 'connected', lastTest: '1 day ago' },
    { name: 'Discord', status: 'disconnected', lastTest: 'Never' },
    { name: 'PagerDuty', status: 'connected', lastTest: '30 minutes ago' },
    { name: 'OpsGenie', status: 'disconnected', lastTest: 'Never' },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium text-sm">{integration.name}</div>
                <div className="text-xs text-gray-600">
                  Last tested: {integration.lastTest}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={integration.status === 'connected' ? 'default' : 'secondary'}
                >
                  {integration.status}
                </Badge>
                <Button size="sm" variant="outline">
                  {integration.status === 'connected' ? 'Test' : 'Configure'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}