/**
 * Enhanced Service Catalog - No-Code Revolution
 * Ultimate no-code platform inspired by Spotify Portal with advanced capabilities
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search,
  Plus,
  Settings,
  Eye,
  Code2,
  Sparkles,
  Network,
  Database,
  Server,
  Globe,
  Container,
  Zap,
  Activity,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  GitBranch,
  Layers,
  Box,
  Workflow
} from 'lucide-react';

import VisualWorkflowBuilder from '@/components/catalog/VisualWorkflowBuilder';
import { VisualTemplateDesigner } from '@/components/catalog/VisualTemplateDesigner';
import InfrastructureComposer from '@/components/catalog/InfrastructureComposer';

// Enhanced service catalog data
const mockServices = [
  {
    id: 'user-auth-service',
    name: 'User Authentication Service',
    kind: 'Component',
    type: 'service',
    technology: 'Node.js',
    framework: 'Express',
    status: 'healthy',
    owner: 'Platform Team',
    lifecycle: 'production',
    tags: ['authentication', 'api', 'microservice'],
    endpoints: ['https://auth.company.com'],
    dependencies: ['postgres-users', 'redis-sessions'],
    metrics: {
      uptime: 99.9,
      responseTime: 45,
      requests: 15420,
      errors: 12
    },
    documentation: {
      available: true,
      sections: ['api', 'deployment', 'monitoring'],
      lastUpdated: '2024-01-10'
    },
    cost: 285
  },
  {
    id: 'payment-processor',
    name: 'Payment Processing Engine',
    kind: 'Component',
    type: 'service',
    technology: 'Java',
    framework: 'Spring Boot',
    status: 'healthy',
    owner: 'Payments Team',
    lifecycle: 'production',
    tags: ['payments', 'financial', 'pci-compliant'],
    endpoints: ['https://payments.company.com/api'],
    dependencies: ['postgres-payments', 'stripe-api', 'kafka-events'],
    metrics: {
      uptime: 99.95,
      responseTime: 89,
      requests: 8765,
      errors: 3
    },
    documentation: {
      available: true,
      sections: ['api', 'security', 'compliance'],
      lastUpdated: '2024-01-08'
    },
    cost: 450
  },
  {
    id: 'notification-hub',
    name: 'Notification Hub',
    kind: 'Component',
    type: 'service',
    technology: 'Python',
    framework: 'FastAPI',
    status: 'warning',
    owner: 'DevOps Team',
    lifecycle: 'production',
    tags: ['notifications', 'messaging', 'webhooks'],
    endpoints: ['https://notifications.company.com'],
    dependencies: ['redis-notifications', 'sendgrid', 'twilio'],
    metrics: {
      uptime: 98.5,
      responseTime: 120,
      requests: 25430,
      errors: 87
    },
    documentation: {
      available: false,
      sections: [],
      lastUpdated: null
    },
    cost: 180
  },
  {
    id: 'analytics-engine',
    name: 'Real-time Analytics Engine',
    kind: 'Component',
    type: 'service',
    technology: 'Go',
    framework: 'Gin',
    status: 'healthy',
    owner: 'Analytics Team',
    lifecycle: 'production',
    tags: ['analytics', 'real-time', 'streaming'],
    endpoints: ['https://analytics.company.com/api'],
    dependencies: ['clickhouse', 'kafka-analytics', 's3-data-lake'],
    metrics: {
      uptime: 99.8,
      responseTime: 25,
      requests: 45600,
      errors: 15
    },
    documentation: {
      available: true,
      sections: ['api', 'architecture', 'performance'],
      lastUpdated: '2024-01-12'
    },
    cost: 680
  }
];

export default function EnhancedServiceCatalog() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filteredServices, setFilteredServices] = useState(mockServices);

  useEffect(() => {
    let filtered = mockServices;

    if (searchQuery) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        service.technology.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedFilter !== 'all') {
      if (selectedFilter === 'healthy') {
        filtered = filtered.filter(s => s.status === 'healthy');
      } else if (selectedFilter === 'issues') {
        filtered = filtered.filter(s => s.status !== 'healthy');
      } else {
        filtered = filtered.filter(s => s.lifecycle === selectedFilter);
      }
    }

    setFilteredServices(filtered);
  }, [searchQuery, selectedFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return AlertTriangle;
      default: return Clock;
    }
  };

  if (activeTab === 'visual-designer') {
    return <VisualWorkflowBuilder />;
  }

  if (activeTab === 'template-designer') {
    return <VisualTemplateDesigner />;
  }

  if (activeTab === 'infrastructure') {
    return <InfrastructureComposer />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Enhanced Service Catalog</h1>
              <p className="text-gray-600 mt-1">
                Discover, create, and manage your services with advanced no-code tools
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Services</p>
                    <p className="text-2xl font-bold">{mockServices.length}</p>
                  </div>
                  <Server className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Healthy Services</p>
                    <p className="text-2xl font-bold text-green-600">
                      {mockServices.filter(s => s.status === 'healthy').length}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Cost</p>
                    <p className="text-2xl font-bold">${mockServices.reduce((sum, s) => sum + s.cost, 0)}/mo</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Features</p>
                    <p className="text-2xl font-bold">5</p>
                  </div>
                  <Sparkles className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="visual-designer">Visual Designer</TabsTrigger>
            <TabsTrigger value="template-designer">Template Designer</TabsTrigger>
            <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
            <TabsTrigger value="discovery">AI Discovery</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {/* Search and Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search services, technologies, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'healthy', 'issues', 'production', 'development'].map((filter) => (
                  <Button
                    key={filter}
                    variant={selectedFilter === filter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFilter(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredServices.map((service) => {
                const StatusIcon = getStatusIcon(service.status);
                return (
                  <Card key={service.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{service.name}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Badge variant="secondary">{service.technology}</Badge>
                            {service.framework && (
                              <Badge variant="outline">{service.framework}</Badge>
                            )}
                          </div>
                        </div>
                        <div className={`p-1.5 rounded-full ${getStatusColor(service.status)}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-green-600">{service.metrics.uptime}%</div>
                            <div className="text-gray-500">Uptime</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{service.metrics.responseTime}ms</div>
                            <div className="text-gray-500">Response</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">${service.cost}/mo</div>
                            <div className="text-gray-500">Cost</div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {service.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {service.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{service.tags.length - 3}
                            </Badge>
                          )}
                        </div>

                        {/* Owner and Documentation */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Users className="w-3 h-3" />
                            {service.owner}
                          </div>
                          {service.documentation.available ? (
                            <Badge variant="default" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              Documented
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              No docs
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Activity className="w-3 h-3 mr-1" />
                            Monitor
                          </Button>
                          <Button size="sm" variant="outline">
                            <Settings className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="discovery" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AI-Powered Discovery */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    AI Discovery Engine
                  </CardTitle>
                  <CardDescription>
                    Intelligent service discovery with auto-documentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
                      <h4 className="font-medium text-blue-900 mb-2">Active Discovery</h4>
                      <div className="space-y-2 text-sm text-blue-800">
                        <div>• 15 services discovered from Git</div>
                        <div>• 8 services found in Kubernetes</div>
                        <div>• 12 relationships mapped</div>
                        <div>• 6 docs auto-generated</div>
                      </div>
                    </div>
                    
                    <Button className="w-full">
                      <Network className="w-4 h-4 mr-2" />
                      Configure Discovery Sources
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* No-Code Tools */}
              <Card>
                <CardHeader>
                  <CardTitle>No-Code Creation Tools</CardTitle>
                  <CardDescription>
                    Build services and infrastructure without coding
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-20 flex-col"
                      onClick={() => setActiveTab('visual-designer')}
                    >
                      <Workflow className="w-6 h-6 mb-2" />
                      <span className="text-sm">Workflow Builder</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex-col"
                      onClick={() => setActiveTab('template-designer')}
                    >
                      <Code2 className="w-6 h-6 mb-2" />
                      <span className="text-sm">Template Designer</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex-col"
                      onClick={() => setActiveTab('infrastructure')}
                    >
                      <Layers className="w-6 h-6 mb-2" />
                      <span className="text-sm">Infrastructure Composer</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="h-20 flex-col"
                    >
                      <FileText className="w-6 h-6 mb-2" />
                      <span className="text-sm">Auto Documentation</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Platform Intelligence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Platform Intelligence
                  </CardTitle>
                  <CardDescription>
                    AI insights and recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        type: 'optimization',
                        title: 'Cost Optimization',
                        description: 'Save $450/month with rightsizing',
                        priority: 'high',
                        color: 'text-green-600 bg-green-50'
                      },
                      {
                        type: 'security',
                        title: 'Security Enhancement',
                        description: 'Add WAF to public services',
                        priority: 'high',
                        color: 'text-red-600 bg-red-50'
                      },
                      {
                        type: 'performance',
                        title: 'Performance Boost',
                        description: 'Enable caching for 3 services',
                        priority: 'medium',
                        color: 'text-blue-600 bg-blue-50'
                      },
                      {
                        type: 'documentation',
                        title: 'Missing Documentation',
                        description: 'Generate docs for notification-hub',
                        priority: 'low',
                        color: 'text-gray-600 bg-gray-50'
                      }
                    ].map((insight, index) => (
                      <div key={index} className={`p-3 border rounded-lg ${insight.color}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <Badge variant={
                            insight.priority === 'high' ? 'destructive' :
                            insight.priority === 'medium' ? 'default' : 'secondary'
                          } className="text-xs">
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-xs opacity-80 mb-2">{insight.description}</p>
                        <Button size="sm" variant="outline" className="w-full text-xs">
                          Apply Recommendation
                        </Button>
                      </div>
                    ))}
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