'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Settings, 
  Trash2, 
  TestTube, 
  Copy, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Zap,
  Activity,
  Eye,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
  headers?: Record<string, string>;
  timeout?: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filters?: {
    priorities?: string[];
    environments?: string[];
    serviceIds?: string[];
    types?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface WebhookDelivery {
  id: string;
  eventType: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  responseStatus?: number;
  errorMessage?: string;
  scheduledAt: string;
  deliveredAt?: string;
}

interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageResponseTime: number;
}

const AVAILABLE_EVENTS = [
  'notification.error',
  'notification.warning',
  'notification.success',
  'notification.info',
  'notification.alert',
  'deployment.started',
  'deployment.succeeded',
  'deployment.failed',
  'alert.low',
  'alert.medium',
  'alert.high',
  'alert.critical',
  'system.maintenance',
  'system.outage'
];

const AVAILABLE_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const AVAILABLE_ENVIRONMENTS = ['development', 'staging', 'production'];
const NOTIFICATION_TYPES = ['error', 'warning', 'success', 'info', 'alert', 'system', 'mention'];

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<Record<string, WebhookDelivery[]>>({});
  const [webhookStats, setWebhookStats] = useState<Record<string, WebhookStats>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    enabled: true,
    timeout: 30000,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 5,
      backoffMultiplier: 2
    },
    filters: {
      priorities: [] as string[],
      environments: [] as string[],
      types: [] as string[]
    },
    headers: {} as Record<string, string>
  });

  const [newHeader, setNewHeader] = useState({ key: '', value: '' });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications/webhooks');
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks);
        
        // Fetch stats for each webhook
        data.webhooks.forEach((webhook: Webhook) => {
          fetchWebhookStats(webhook.id);
        });
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebhookStats = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/notifications/webhooks/${webhookId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setWebhookStats(prev => ({
          ...prev,
          [webhookId]: data.stats
        }));
      }
    } catch (error) {
      console.error('Failed to fetch webhook stats:', error);
    }
  };

  const fetchDeliveryHistory = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/notifications/webhooks/${webhookId}/deliveries`);
      if (response.ok) {
        const data = await response.json();
        setDeliveryHistory(prev => ({
          ...prev,
          [webhookId]: data.deliveries
        }));
      }
    } catch (error) {
      console.error('Failed to fetch delivery history:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      enabled: true,
      timeout: 30000,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 5,
        backoffMultiplier: 2
      },
      filters: {
        priorities: [],
        environments: [],
        types: []
      },
      headers: {}
    });
    setNewHeader({ key: '', value: '' });
  };

  const handleCreateWebhook = async () => {
    try {
      const response = await fetch('/api/notifications/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Webhook created successfully');
        setIsCreateDialogOpen(false);
        resetForm();
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create webhook');
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast.error('Failed to create webhook');
    }
  };

  const handleUpdateWebhook = async () => {
    if (!selectedWebhook) return;

    try {
      const response = await fetch(`/api/notifications/webhooks?id=${selectedWebhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Webhook updated successfully');
        setIsEditDialogOpen(false);
        setSelectedWebhook(null);
        resetForm();
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update webhook');
      }
    } catch (error) {
      console.error('Failed to update webhook:', error);
      toast.error('Failed to update webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/notifications/webhooks?id=${webhookId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Webhook deleted successfully');
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete webhook');
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/notifications/webhooks/test?id=${webhookId}`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Webhook test successful');
      } else {
        toast.error(`Webhook test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      toast.error('Failed to test webhook');
    }
  };

  const handleToggleWebhook = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/notifications/webhooks?id=${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook.enabled })
      });

      if (response.ok) {
        toast.success(`Webhook ${webhook.enabled ? 'disabled' : 'enabled'}`);
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to toggle webhook');
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      toast.error('Failed to toggle webhook');
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  const openEditDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      timeout: webhook.timeout || 30000,
      retryConfig: webhook.retryConfig,
      filters: webhook.filters || { priorities: [], environments: [], types: [] },
      headers: webhook.headers || {}
    });
    setIsEditDialogOpen(true);
    fetchDeliveryHistory(webhook.id);
  };

  const addHeader = () => {
    if (newHeader.key && newHeader.value) {
      setFormData(prev => ({
        ...prev,
        headers: { ...prev.headers, [newHeader.key]: newHeader.value }
      }));
      setNewHeader({ key: '', value: '' });
    }
  };

  const removeHeader = (key: string) => {
    setFormData(prev => ({
      ...prev,
      headers: Object.fromEntries(Object.entries(prev.headers).filter(([k]) => k !== key))
    }));
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      retrying: 'bg-blue-100 text-blue-800'
    };
    
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold">Webhook Management</h2>
          <p className="text-gray-600 text-sm sm:text-base">Configure webhooks to receive notifications in external systems</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Webhook</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl h-[90vh] sm:h-auto overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic</TabsTrigger>
                <TabsTrigger value="events" className="text-xs sm:text-sm">Events</TabsTrigger>
                <TabsTrigger value="filters" className="text-xs sm:text-sm">Filters</TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs sm:text-sm">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Webhook"
                  />
                </div>
                
                <div>
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://api.example.com/webhooks"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
              </TabsContent>
              
              <TabsContent value="events" className="space-y-4">
                <Label>Select Events</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map(event => (
                    <label key={event} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <Checkbox
                        checked={formData.events.includes(event)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({
                            ...prev,
                            events: checked 
                              ? [...prev.events, event]
                              : prev.events.filter(e => e !== event)
                          }));
                        }}
                      />
                      <span className="text-xs sm:text-sm break-all">{event}</span>
                    </label>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="filters" className="space-y-4">
                <div>
                  <Label>Priorities</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {AVAILABLE_PRIORITIES.map(priority => (
                      <label key={priority} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <Checkbox
                          checked={formData.filters.priorities.includes(priority)}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              filters: {
                                ...prev.filters,
                                priorities: checked 
                                  ? [...prev.filters.priorities, priority]
                                  : prev.filters.priorities.filter(p => p !== priority)
                              }
                            }));
                          }}
                        />
                        <span className="text-xs sm:text-sm">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>Environments</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    {AVAILABLE_ENVIRONMENTS.map(env => (
                      <label key={env} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <Checkbox
                          checked={formData.filters.environments.includes(env)}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              filters: {
                                ...prev.filters,
                                environments: checked 
                                  ? [...prev.filters.environments, env]
                                  : prev.filters.environments.filter(e => e !== env)
                              }
                            }));
                          }}
                        />
                        <span className="text-xs sm:text-sm">{env}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>Notification Types</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    {NOTIFICATION_TYPES.map(type => (
                      <label key={type} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <Checkbox
                          checked={formData.filters.types.includes(type)}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              filters: {
                                ...prev.filters,
                                types: checked 
                                  ? [...prev.filters.types, type]
                                  : prev.filters.types.filter(t => t !== type)
                              }
                            }));
                          }}
                        />
                        <span className="text-xs sm:text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div>
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                    min={1000}
                    max={60000}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Retry Configuration</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="maxRetries" className="text-xs">Max Retries</Label>
                      <Input
                        id="maxRetries"
                        type="number"
                        value={formData.retryConfig.maxRetries}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          retryConfig: { ...prev.retryConfig, maxRetries: parseInt(e.target.value) }
                        }))}
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <Label htmlFor="retryDelay" className="text-xs">Retry Delay (s)</Label>
                      <Input
                        id="retryDelay"
                        type="number"
                        value={formData.retryConfig.retryDelay}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          retryConfig: { ...prev.retryConfig, retryDelay: parseInt(e.target.value) }
                        }))}
                        min={1}
                        max={300}
                      />
                    </div>
                    <div>
                      <Label htmlFor="backoffMultiplier" className="text-xs">Backoff Multiplier</Label>
                      <Input
                        id="backoffMultiplier"
                        type="number"
                        step="0.1"
                        value={formData.retryConfig.backoffMultiplier}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          retryConfig: { ...prev.retryConfig, backoffMultiplier: parseFloat(e.target.value) }
                        }))}
                        min={1}
                        max={5}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>Custom Headers</Label>
                  <div className="space-y-2">
                    {Object.entries(formData.headers).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Input value={key} readOnly className="flex-1" />
                        <Input value={value} readOnly className="flex-1" />
                        <Button variant="outline" size="sm" onClick={() => removeHeader(key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Input
                        placeholder="Header name"
                        value={newHeader.key}
                        onChange={(e) => setNewHeader(prev => ({ ...prev, key: e.target.value }))}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Header value"
                        value={newHeader.value}
                        onChange={(e) => setNewHeader(prev => ({ ...prev, value: e.target.value }))}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={addHeader} className="px-3">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="order-2 sm:order-1">
                Cancel
              </Button>
              <Button onClick={handleCreateWebhook} className="order-1 sm:order-2">Create Webhook</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Webhooks Configured</h3>
            <p className="text-gray-500 text-center max-w-md">
              Get started by creating your first webhook to receive notifications in external systems.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="space-y-3 sm:space-y-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${webhook.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">{webhook.name}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm truncate">{webhook.url}</CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex sm:hidden items-center space-x-1">
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={() => handleToggleWebhook(webhook)}
                      />
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(webhook)}>
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex items-center justify-between">
                    {webhookStats[webhook.id] && (
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Activity className="h-4 w-4" />
                          <span>{webhookStats[webhook.id].successRate.toFixed(1)}% success</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-4 w-4" />
                          <span>{webhookStats[webhook.id].successfulDeliveries}</span>
                        </div>
                        {webhookStats[webhook.id].failedDeliveries > 0 && (
                          <div className="flex items-center space-x-1">
                            <AlertCircle className="h-4 w-4" />
                            <span>{webhookStats[webhook.id].failedDeliveries}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={() => handleToggleWebhook(webhook)}
                      />
                      
                      <Button variant="outline" size="sm" onClick={() => handleTestWebhook(webhook.id)}>
                        <TestTube className="h-4 w-4" />
                      </Button>
                      
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(webhook)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Mobile stats */}
                  {webhookStats[webhook.id] && (
                    <div className="flex sm:hidden items-center justify-center space-x-4 text-xs text-gray-600 py-2 border-b">
                      <div className="flex items-center space-x-1">
                        <Activity className="h-3 w-3" />
                        <span>{webhookStats[webhook.id].successRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>{webhookStats[webhook.id].successfulDeliveries}</span>
                      </div>
                      {webhookStats[webhook.id].failedDeliveries > 0 && (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3 text-red-500" />
                          <span>{webhookStats[webhook.id].failedDeliveries}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-xs sm:text-sm font-medium">Events ({webhook.events.length})</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.slice(0, 4).map(event => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {webhook.events.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{webhook.events.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">Secret:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {webhook.secret.substring(0, 8)}...
                      </code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copySecret(webhook.secret)}
                        className="p-1"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="text-gray-500">
                      Created {new Date(webhook.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {/* Mobile action buttons */}
                  <div className="flex sm:hidden items-center justify-center space-x-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleTestWebhook(webhook.id)} className="flex-1">
                      <TestTube className="h-3 w-3 mr-1" />
                      Test
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-700 px-3"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] sm:h-auto overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">Edit Webhook: {selectedWebhook?.name}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic</TabsTrigger>
              <TabsTrigger value="events" className="text-xs sm:text-sm">Events</TabsTrigger>
              <TabsTrigger value="filters" className="text-xs sm:text-sm">Filters</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs sm:text-sm">Advanced</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">History</TabsTrigger>
            </TabsList>
            
            {/* Same form content as create dialog */}
            <TabsContent value="basic" className="space-y-4">
              {/* Basic form fields */}
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
                />
                <Label htmlFor="edit-enabled">Enabled</Label>
              </div>
            </TabsContent>
            
            {/* Additional tabs similar to create dialog */}
            
            <TabsContent value="history" className="space-y-4">
              <div className="space-y-4">
                <Label>Recent Deliveries</Label>
                
                {selectedWebhook && deliveryHistory[selectedWebhook.id] ? (
                  <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                    {deliveryHistory[selectedWebhook.id].map(delivery => (
                      <div key={delivery.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <Badge className={getStatusBadge(delivery.status)}>
                            {delivery.status}
                          </Badge>
                          <span className="text-xs sm:text-sm font-medium">{delivery.eventType}</span>
                          {delivery.responseStatus && (
                            <span className="text-xs text-gray-500">HTTP {delivery.responseStatus}</span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {new Date(delivery.scheduledAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No delivery history available</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="order-2 sm:order-1">
              Cancel
            </Button>
            <Button onClick={handleUpdateWebhook} className="order-1 sm:order-2">Update Webhook</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}