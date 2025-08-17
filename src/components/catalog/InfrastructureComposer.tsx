/**
 * Drag-and-Drop Infrastructure Composer
 * Visual infrastructure design with real-time deployment and cost estimation
 */

'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  NodeToolbar,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Cloud, 
  Database, 
  Server, 
  Globe, 
  Shield, 
  Zap, 
  HardDrive,
  Network,
  Router,
  MonitorSpeaker,
  Container,
  Cpu,
  MemoryStick,
  Save,
  Download,
  Play,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Eye,
  Code2,
  FileCode,
  Layers,
  GitBranch,
  Lock,
  Key,
  Users,
  Activity,
  BarChart3,
  TrendingUp
} from 'lucide-react';

// Infrastructure component types
interface InfraNode extends Node {
  data: {
    label: string;
    type: string;
    provider: 'aws' | 'gcp' | 'azure' | 'on-premise';
    config: Record<string, any>;
    cost?: {
      monthly: number;
      hourly: number;
    };
    status?: 'planning' | 'deploying' | 'running' | 'error';
    metrics?: {
      cpu: number;
      memory: number;
      network: number;
    };
  };
}

interface InfraEdge extends Edge {
  data: {
    type: 'network' | 'data' | 'dependency' | 'security';
    protocol?: string;
    bandwidth?: string;
    encrypted?: boolean;
  };
}

// Infrastructure components library
const infrastructureComponents = {
  compute: [
    {
      id: 'ec2-instance',
      name: 'EC2 Instance',
      provider: 'aws',
      icon: Server,
      description: 'Virtual machine instance',
      baseConfig: {
        instanceType: 't3.medium',
        region: 'us-east-1',
        os: 'ubuntu-22.04'
      },
      estimatedCost: { monthly: 35, hourly: 0.048 }
    },
    {
      id: 'compute-engine',
      name: 'Compute Engine',
      provider: 'gcp',
      icon: Server,
      description: 'Google Cloud VM instance',
      baseConfig: {
        machineType: 'e2-medium',
        zone: 'us-central1-a',
        os: 'ubuntu-2204-lts'
      },
      estimatedCost: { monthly: 32, hourly: 0.044 }
    },
    {
      id: 'kubernetes-cluster',
      name: 'Kubernetes Cluster',
      provider: 'aws',
      icon: Container,
      description: 'Managed Kubernetes cluster',
      baseConfig: {
        nodeCount: 3,
        nodeType: 't3.medium',
        version: '1.28'
      },
      estimatedCost: { monthly: 220, hourly: 0.30 }
    }
  ],
  storage: [
    {
      id: 'rds-postgres',
      name: 'RDS PostgreSQL',
      provider: 'aws',
      icon: Database,
      description: 'Managed PostgreSQL database',
      baseConfig: {
        instanceClass: 'db.t3.micro',
        storage: 20,
        multiAZ: false
      },
      estimatedCost: { monthly: 25, hourly: 0.034 }
    },
    {
      id: 's3-bucket',
      name: 'S3 Bucket',
      provider: 'aws',
      icon: HardDrive,
      description: 'Object storage bucket',
      baseConfig: {
        storageClass: 'standard',
        versioning: false,
        encryption: true
      },
      estimatedCost: { monthly: 5, hourly: 0.007 }
    }
  ],
  networking: [
    {
      id: 'application-load-balancer',
      name: 'Application Load Balancer',
      provider: 'aws',
      icon: Router,
      description: 'Layer 7 load balancer',
      baseConfig: {
        scheme: 'internet-facing',
        ipAddressType: 'ipv4'
      },
      estimatedCost: { monthly: 22, hourly: 0.030 }
    },
    {
      id: 'vpc',
      name: 'Virtual Private Cloud',
      provider: 'aws',
      icon: Network,
      description: 'Isolated network environment',
      baseConfig: {
        cidrBlock: '10.0.0.0/16',
        enableDnsHostnames: true
      },
      estimatedCost: { monthly: 0, hourly: 0 }
    },
    {
      id: 'api-gateway',
      name: 'API Gateway',
      provider: 'aws',
      icon: Globe,
      description: 'API management service',
      baseConfig: {
        type: 'REST',
        endpointType: 'REGIONAL'
      },
      estimatedCost: { monthly: 15, hourly: 0.020 }
    }
  ],
  security: [
    {
      id: 'security-group',
      name: 'Security Group',
      provider: 'aws',
      icon: Shield,
      description: 'Network firewall rules',
      baseConfig: {
        description: 'Default security group',
        rules: []
      },
      estimatedCost: { monthly: 0, hourly: 0 }
    },
    {
      id: 'waf',
      name: 'Web Application Firewall',
      provider: 'aws',
      icon: Lock,
      description: 'Application layer protection',
      baseConfig: {
        scope: 'REGIONAL',
        defaultAction: 'ALLOW'
      },
      estimatedCost: { monthly: 12, hourly: 0.016 }
    }
  ],
  monitoring: [
    {
      id: 'cloudwatch',
      name: 'CloudWatch',
      provider: 'aws',
      icon: Activity,
      description: 'Monitoring and logging',
      baseConfig: {
        retentionInDays: 30,
        detailedMonitoring: false
      },
      estimatedCost: { monthly: 8, hourly: 0.011 }
    }
  ]
};

// Custom node component for infrastructure resources
const InfrastructureNode = ({ id, data, isConnectable }: any) => {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(data.config);

  const getNodeColor = (type: string, provider: string) => {
    const colors = {
      aws: { bg: 'bg-orange-500', border: 'border-orange-300' },
      gcp: { bg: 'bg-blue-500', border: 'border-blue-300' },
      azure: { bg: 'bg-cyan-500', border: 'border-cyan-300' },
      'on-premise': { bg: 'bg-gray-500', border: 'border-gray-300' }
    };
    return colors[provider] || colors['on-premise'];
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planning: 'bg-yellow-400',
      deploying: 'bg-blue-400',
      running: 'bg-green-400',
      error: 'bg-red-400'
    };
    return colors[status] || 'bg-gray-400';
  };

  const colors = getNodeColor(data.type, data.provider);

  return (
    <>
      <NodeToolbar isVisible={showConfig} position={Position.Top}>
        <Card className="w-80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{data.label} Configuration</CardTitle>
            <CardDescription>Provider: {data.provider.toUpperCase()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(config).map(([key, value]) => (
              <div key={key}>
                <Label htmlFor={`${id}-${key}`} className="text-xs">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
                <Input
                  id={`${id}-${key}`}
                  value={String(value)}
                  onChange={(e) => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                  className="h-7 text-xs"
                />
              </div>
            ))}
            <Separator />
            {data.cost && (
              <div className="text-xs">
                <div className="flex justify-between">
                  <span>Monthly Cost:</span>
                  <span className="font-mono">${data.cost.monthly}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hourly Cost:</span>
                  <span className="font-mono">${data.cost.hourly}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => setShowConfig(false)}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowConfig(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </NodeToolbar>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      
      <div 
        className={`relative px-3 py-2 shadow-md rounded-lg border-2 ${colors.border} ${colors.bg} text-white min-w-[160px] cursor-pointer`}
        onClick={() => setShowConfig(!showConfig)}
      >
        {/* Status indicator */}
        {data.status && (
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusColor(data.status)}`} />
        )}
        
        <div className="flex items-center gap-2 mb-1">
          <div className="text-sm font-medium">{data.label}</div>
        </div>
        
        <div className="text-xs opacity-90">
          {data.provider.toUpperCase()} • {data.type}
        </div>
        
        {data.cost && (
          <div className="text-xs opacity-75 mt-1">
            ${data.cost.monthly}/mo
          </div>
        )}
        
        {/* Metrics bar */}
        {data.metrics && (
          <div className="flex gap-1 mt-2">
            <div className="flex-1 bg-black bg-opacity-20 rounded h-1">
              <div 
                className="bg-white h-1 rounded" 
                style={{ width: `${data.metrics.cpu}%` }}
              />
            </div>
            <div className="flex-1 bg-black bg-opacity-20 rounded h-1">
              <div 
                className="bg-white h-1 rounded" 
                style={{ width: `${data.metrics.memory}%` }}
              />
            </div>
            <div className="flex-1 bg-black bg-opacity-20 rounded h-1">
              <div 
                className="bg-white h-1 rounded" 
                style={{ width: `${data.metrics.network}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </>
  );
};

const nodeTypes = {
  infrastructure: InfrastructureNode,
};

interface InfrastructureComposerProps {
  onSave?: (infrastructure: any) => void;
  onDeploy?: (infrastructure: any) => void;
  collaborative?: boolean;
}

export function InfrastructureComposer({
  onSave,
  onDeploy,
  collaborative = false
}: InfrastructureComposerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedCategory, setSelectedCategory] = useState('compute');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'deployed' | 'error'>('idle');
  const [totalCost, setTotalCost] = useState({ monthly: 0, hourly: 0 });
  const [activeTab, setActiveTab] = useState('design');
  const [generatedCode, setGeneratedCode] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Calculate total cost when nodes change
  useEffect(() => {
    const monthly = nodes.reduce((sum, node) => sum + (node.data.cost?.monthly || 0), 0);
    const hourly = nodes.reduce((sum, node) => sum + (node.data.cost?.hourly || 0), 0);
    setTotalCost({ monthly, hourly });
  }, [nodes]);

  // Generate recommendations based on current architecture
  useEffect(() => {
    if (nodes.length > 0) {
      generateRecommendations();
    }
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const newEdge = {
        ...params,
        data: {
          type: 'network',
          protocol: 'HTTPS',
          bandwidth: '1Gbps',
          encrypted: true
        }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const componentId = event.dataTransfer.getData('application/reactflow');

      if (!componentId) return;

      // Find component in all categories
      let component = null;
      for (const category of Object.values(infrastructureComponents)) {
        component = category.find(c => c.id === componentId);
        if (component) break;
      }

      if (!component) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: InfraNode = {
        id: `${componentId}-${Date.now()}`,
        type: 'infrastructure',
        position,
        data: {
          label: component.name,
          type: componentId,
          provider: component.provider,
          config: { ...component.baseConfig },
          cost: component.estimatedCost,
          status: 'planning',
          metrics: {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            network: Math.random() * 100
          }
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onDragStart = (event: React.DragEvent, componentId: string) => {
    event.dataTransfer.setData('application/reactflow', componentId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const generateRecommendations = () => {
    const recs = [];

    // Check for missing load balancer
    const hasLoadBalancer = nodes.some(n => n.data.type === 'application-load-balancer');
    const hasMultipleServers = nodes.filter(n => n.data.type.includes('instance')).length > 1;
    
    if (hasMultipleServers && !hasLoadBalancer) {
      recs.push({
        type: 'reliability',
        title: 'Add Load Balancer',
        description: 'Multiple servers detected. Consider adding a load balancer for high availability.',
        priority: 'high',
        action: 'Add ALB'
      });
    }

    // Check for monitoring
    const hasMonitoring = nodes.some(n => n.data.type === 'cloudwatch');
    if (nodes.length > 2 && !hasMonitoring) {
      recs.push({
        type: 'observability',
        title: 'Add Monitoring',
        description: 'Complex infrastructure should include monitoring and alerting.',
        priority: 'medium',
        action: 'Add CloudWatch'
      });
    }

    // Check for security
    const hasWAF = nodes.some(n => n.data.type === 'waf');
    const hasPublicServices = nodes.some(n => n.data.config?.scheme === 'internet-facing');
    
    if (hasPublicServices && !hasWAF) {
      recs.push({
        type: 'security',
        title: 'Add WAF Protection',
        description: 'Public-facing services should be protected with a Web Application Firewall.',
        priority: 'high',
        action: 'Add WAF'
      });
    }

    // Cost optimization
    if (totalCost.monthly > 500) {
      recs.push({
        type: 'cost',
        title: 'Cost Optimization',
        description: 'High monthly cost detected. Consider reserved instances or spot instances.',
        priority: 'low',
        action: 'Review pricing'
      });
    }

    setRecommendations(recs);
  };

  const generateInfrastructureCode = async () => {
    const terraformCode = `
# Terraform Infrastructure Code
# Generated from Visual Infrastructure Composer

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

${nodes.map(node => {
  const config = node.data.config;
  
  switch (node.data.type) {
    case 'ec2-instance':
      return `
# ${node.data.label}
resource "aws_instance" "${node.id.replace(/-/g, '_')}" {
  ami           = data.aws_ami.${config.os.replace(/-/g, '_')}.id
  instance_type = "${config.instanceType}"
  
  tags = {
    Name = "${node.data.label}"
  }
}`;
    
    case 'rds-postgres':
      return `
# ${node.data.label}
resource "aws_db_instance" "${node.id.replace(/-/g, '_')}" {
  identifier     = "${node.id}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "${config.instanceClass}"
  allocated_storage = ${config.storage}
  
  db_name  = "mydb"
  username = "admin"
  password = var.db_password
  
  multi_az = ${config.multiAZ}
  
  tags = {
    Name = "${node.data.label}"
  }
}`;
    
    case 's3-bucket':
      return `
# ${node.data.label}
resource "aws_s3_bucket" "${node.id.replace(/-/g, '_')}" {
  bucket = "${node.id}"
  
  tags = {
    Name = "${node.data.label}"
  }
}

resource "aws_s3_bucket_versioning" "${node.id.replace(/-/g, '_')}_versioning" {
  bucket = aws_s3_bucket.${node.id.replace(/-/g, '_')}.id
  versioning_configuration {
    status = "${config.versioning ? 'Enabled' : 'Suspended'}"
  }
}`;
    
    default:
      return `# ${node.data.label} - ${node.data.type} (configuration needed)`;
  }
}).join('\n')}

# Variables
variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# Outputs
${nodes.map(node => `
output "${node.id.replace(/-/g, '_')}_id" {
  value = aws_${node.data.type.replace(/-/g, '_')}.${node.id.replace(/-/g, '_')}.id
}`).join('')}
`;

    const kubernetesCode = `
# Kubernetes Manifests
# Generated from Visual Infrastructure Composer

${nodes.filter(node => node.data.type === 'kubernetes-cluster').map(node => `
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  namespace: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}
spec:
  replicas: ${node.data.config.nodeCount}
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
`).join('')}
`;

    setGeneratedCode(`${terraformCode}\n\n${kubernetesCode}`);
  };

  const handleDeploy = async () => {
    setDeploymentStatus('deploying');
    
    // Simulate deployment process
    for (let i = 0; i < nodes.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNodes(currentNodes => 
        currentNodes.map(node => 
          node.data.status === 'planning' 
            ? { ...node, data: { ...node.data, status: 'deploying' } }
            : node
        )
      );
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setNodes(currentNodes => 
      currentNodes.map(node => ({ 
        ...node, 
        data: { ...node.data, status: 'running' } 
      }))
    );
    
    setDeploymentStatus('deployed');
    
    onDeploy?.({
      nodes,
      edges,
      totalCost,
      deployedAt: new Date()
    });
  };

  const handleSave = () => {
    onSave?.({
      nodes,
      edges,
      totalCost,
      recommendations,
      savedAt: new Date()
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Infrastructure Library */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Infrastructure Composer</h2>
          <p className="text-sm text-gray-600">Drag components to design your infrastructure</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mx-4 mt-2">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="cost">Cost</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="flex-1 p-4">
            <div className="space-y-4">
              {/* Category Selection */}
              <div>
                <Label className="text-sm font-medium">Component Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compute">Compute</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Component Library */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Available Components</Label>
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {infrastructureComponents[selectedCategory]?.map((component) => (
                      <Card
                        key={component.id}
                        className="cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors"
                        draggable
                        onDragStart={(event) => onDragStart(event, component.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              component.provider === 'aws' ? 'bg-orange-100' :
                              component.provider === 'gcp' ? 'bg-blue-100' :
                              component.provider === 'azure' ? 'bg-cyan-100' : 'bg-gray-100'
                            }`}>
                              <component.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{component.name}</div>
                              <div className="text-xs text-gray-500">{component.description}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {component.provider.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-gray-600">
                                  ${component.estimatedCost.monthly}/mo
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cost" className="flex-1 p-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Cost Estimation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        ${totalCost.hourly.toFixed(3)}
                      </div>
                      <div className="text-sm text-gray-600">Per Hour</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        ${totalCost.monthly.toFixed(0)}
                      </div>
                      <div className="text-sm text-gray-600">Per Month</div>
                    </div>
                  </div>
                  
                  {nodes.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Cost Breakdown</h4>
                      <div className="space-y-2">
                        {nodes.map(node => (
                          <div key={node.id} className="flex justify-between text-sm">
                            <span>{node.data.label}</span>
                            <span className="font-mono">
                              ${node.data.cost?.monthly || 0}/mo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {totalCost.monthly > 200 && (
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    Consider using reserved instances or spot instances to reduce costs by up to 60%.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="security" className="flex-1 p-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Security Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.filter(r => r.type === 'security').length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">No security issues detected</p>
                      </div>
                    ) : (
                      recommendations
                        .filter(r => r.type === 'security')
                        .map((rec, index) => (
                          <Alert key={index}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="flex justify-between items-center">
                              <div>
                                <strong>{rec.title}</strong>
                                <p className="text-sm mt-1">{rec.description}</p>
                              </div>
                              <Button size="sm" variant="outline">
                                {rec.action}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Security Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {[
                      { item: 'Network segmentation', complete: edges.length > 0 },
                      { item: 'Encryption in transit', complete: true },
                      { item: 'Access control', complete: nodes.some(n => n.data.type === 'security-group') },
                      { item: 'Monitoring enabled', complete: nodes.some(n => n.data.type === 'cloudwatch') },
                      { item: 'Backup strategy', complete: false }
                    ].map((check, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {check.complete ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={check.complete ? 'text-green-700' : 'text-gray-600'}>
                          {check.item}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="code" className="flex-1 p-4">
            <div className="space-y-4">
              <Button 
                onClick={generateInfrastructureCode}
                className="w-full"
                disabled={nodes.length === 0}
              >
                <Code2 className="w-4 h-4 mr-2" />
                Generate Infrastructure Code
              </Button>
              
              {generatedCode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Generated Code</span>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 w-full">
                      <pre className="text-xs font-mono bg-gray-100 p-3 rounded overflow-x-auto">
                        <code>{generatedCode}</code>
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Infrastructure Design</h1>
            <Badge variant="outline">{nodes.length} resources</Badge>
            <Badge variant={deploymentStatus === 'deployed' ? 'default' : 'secondary'}>
              {deploymentStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button 
              size="sm" 
              onClick={handleDeploy}
              disabled={nodes.length === 0 || deploymentStatus === 'deploying'}
            >
              {deploymentStatus === 'deploying' ? (
                <>
                  <Clock className="w-4 h-4 mr-1 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Deploy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
            
            <Panel position="bottom-left">
              <Card className="w-80">
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Resources</div>
                      <div className="font-semibold">{nodes.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Monthly Cost</div>
                      <div className="font-semibold">${totalCost.monthly.toFixed(0)}</div>
                    </div>
                  </div>
                  
                  {recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        {recommendations.length} recommendations
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Panel>

            <Panel position="bottom-right">
              {deploymentStatus === 'deploying' && (
                <Card className="w-64">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Clock className="w-4 h-4 animate-spin" />
                      Deploying Infrastructure...
                    </div>
                    <Progress value={60} className="h-2" />
                  </CardContent>
                </Card>
              )}
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function InfrastructureComposerWrapper(props: InfrastructureComposerProps) {
  return (
    <ReactFlowProvider>
      <InfrastructureComposer {...props} />
    </ReactFlowProvider>
  );
}