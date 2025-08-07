import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Key, 
  Shield, 
  Database, 
  FileText, 
  Activity,
  Settings,
  Users,
  Clock,
  Lock,
  Unlock,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Download,
  Search,
  Filter
} from 'lucide-react';
import { VaultApi } from '@/lib/vault/vault-client';
import { DynamicSecretsManager } from '@/lib/vault/dynamic-secrets';
import { VaultGovernanceManager } from '@/lib/vault/governance-manager';

interface Secret {
  path: string;
  version: number;
  created: string;
  ttl?: number;
  renewable?: boolean;
  data?: Record<string, any>;
}

interface HealthStatus {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
}

interface AuditEvent {
  id: string;
  timestamp: Date;
  type: string;
  operation: string;
  path: string;
  user?: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export function VaultDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPath, setSelectedPath] = useState<string>('secret/');
  const [showSecretValues, setShowSecretValues] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for demonstration
  useEffect(() => {
    const fetchVaultData = async () => {
      setLoading(true);
      
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHealth({
        initialized: true,
        sealed: false,
        standby: false,
        performance_standby: false,
        replication_performance_mode: 'disabled',
        replication_dr_mode: 'disabled',
        server_time_utc: Date.now(),
        version: '1.16.1',
        cluster_name: 'vault-ha-cluster',
        cluster_id: 'cluster-123'
      });

      setSecrets([
        {
          path: 'secret/backstage/database',
          version: 3,
          created: '2024-08-07T10:00:00Z',
          ttl: 3600,
          renewable: true
        },
        {
          path: 'secret/backstage/auth/github',
          version: 1,
          created: '2024-08-06T15:30:00Z'
        },
        {
          path: 'secret/apps/frontend/config',
          version: 2,
          created: '2024-08-07T09:15:00Z'
        }
      ]);

      setAuditEvents([
        {
          id: '1',
          timestamp: new Date(Date.now() - 3600000),
          type: 'secret',
          operation: 'read',
          path: 'secret/backstage/database',
          user: 'john.doe',
          risk: 'low'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 7200000),
          type: 'auth',
          operation: 'login',
          path: 'auth/kubernetes/login',
          user: 'service-account',
          risk: 'low'
        }
      ]);

      setLoading(false);
    };

    fetchVaultData();
  }, []);

  const filteredSecrets = secrets.filter(secret =>
    secret.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-600">Loading Vault data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <div className={`p-2 rounded-full ${health?.sealed ? 'bg-red-100' : 'bg-green-100'}`}>
              {health?.sealed ? 
                <Lock className="h-5 w-5 text-red-600" /> : 
                <Unlock className="h-5 w-5 text-green-600" />
              }
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="text-lg font-semibold">
                {health?.sealed ? 'Sealed' : 'Unsealed'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Version</p>
              <p className="text-lg font-semibold">{health?.version}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-purple-100 rounded-full">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Mode</p>
              <p className="text-lg font-semibold">
                {health?.standby ? 'Standby' : 'Active'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-yellow-100 rounded-full">
              <Users className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Cluster</p>
              <p className="text-lg font-semibold">{health?.cluster_name}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Secret Engines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Database className="h-4 w-4 mr-2" />
                      Key-Value v2
                    </span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      PKI
                    </span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Database className="h-4 w-4 mr-2" />
                      Database
                    </span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Lock className="h-4 w-4 mr-2" />
                      Transit
                    </span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <Badge variant={getRiskColor(event.risk)}>
                          {event.risk}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{event.operation}</p>
                          <p className="text-xs text-gray-500">{event.path}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="secrets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Secret Management
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecretValues(!showSecretValues)}
                  >
                    {showSecretValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm">New Secret</Button>
                </div>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search secrets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSecrets.map(secret => (
                  <div key={secret.path} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium flex items-center">
                          {secret.path}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyPath(secret.path)}
                            className="ml-2 h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>Version {secret.version}</span>
                          <span>Created {new Date(secret.created).toLocaleDateString()}</span>
                          {secret.ttl && (
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              TTL: {Math.floor(secret.ttl / 3600)}h
                            </span>
                          )}
                          {secret.renewable && (
                            <Badge variant="outline" className="text-xs">Renewable</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">View</Button>
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {showSecretValues && (
                      <div className="mt-3 p-3 bg-gray-50 rounded border">
                        <p className="text-sm text-gray-600 mb-2">Secret Data:</p>
                        <div className="font-mono text-xs bg-white p-2 rounded border">
                          {JSON.stringify(secret.data || { username: "[REDACTED]", password: "[REDACTED]" }, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Policy Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">admin-policy</h3>
                      <p className="text-sm text-gray-600">Full administrative access</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="destructive">High Risk</Badge>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">developer-policy</h3>
                      <p className="text-sm text-gray-600">Development team access</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Medium Risk</Badge>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">backstage-policy</h3>
                      <p className="text-sm text-gray-600">Backstage application access</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">Low Risk</Badge>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Audit Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditEvents.map(event => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={getRiskColor(event.risk)}>
                            {event.risk}
                          </Badge>
                          <span className="font-medium">{event.operation}</span>
                          <span className="text-gray-500">on</span>
                          <span className="font-mono text-sm">{event.path}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>User: {event.user || 'Unknown'}</span>
                          <span>Type: {event.type}</span>
                          <span>{formatTimeAgo(event.timestamp)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Details</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">GDPR Compliance</span>
                    <Badge variant="outline">Compliant</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">SOX Compliance</span>
                    <Badge variant="outline">Compliant</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">PCI-DSS</span>
                    <Badge variant="secondary">Partial</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">HIPAA</span>
                    <Badge variant="destructive">Non-Compliant</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Policy Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="border-l-4 border-red-500 pl-4">
                    <p className="font-medium text-red-700">Unauthorized Admin Access</p>
                    <p className="text-sm text-gray-600">User attempted root policy access</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <p className="font-medium text-yellow-700">After Hours Access</p>
                    <p className="text-sm text-gray-600">Secret accessed outside business hours</p>
                    <p className="text-xs text-gray-500">5 hours ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}