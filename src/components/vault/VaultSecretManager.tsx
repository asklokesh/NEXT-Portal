import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Key, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  History,
  RefreshCw,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Shield,
  Database
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SecretVersion {
  version: number;
  created_time: string;
  destroyed: boolean;
  data: Record<string, string>;
}

interface SecretMetadata {
  created_time: string;
  current_version: number;
  max_versions: number;
  oldest_version?: number;
  updated_time: string;
  versions: Record<string, SecretVersion>;
  delete_version_after?: string;
}

interface Secret {
  path: string;
  data: Record<string, string>;
  metadata: SecretMetadata;
  renewable?: boolean;
  ttl?: number;
  lease_id?: string;
  engine: string;
}

interface DynamicCredentials {
  username: string;
  password: string;
  ttl: number;
  renewable: boolean;
  lease_id: string;
  created_time: string;
}

export function VaultSecretManager() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [dynamicCreds, setDynamicCreds] = useState<DynamicCredentials[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [activeEngine, setActiveEngine] = useState('kv');
  const { toast } = useToast();

  // Form states
  const [newSecretPath, setNewSecretPath] = useState('');
  const [newSecretData, setNewSecretData] = useState('');
  const [selectedDBRole, setSelectedDBRole] = useState('readonly');
  const [certCommonName, setCertCommonName] = useState('');
  const [certAltNames, setCertAltNames] = useState('');

  useEffect(() => {
    loadSecrets();
  }, [activeEngine]);

  const loadSecrets = async () => {
    setLoading(true);
    
    // Mock data for demonstration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockSecrets: Secret[] = [
      {
        path: 'secret/backstage/database',
        data: {
          username: 'backstage_user',
          password: 'secure_password_123',
          host: 'postgres.internal.com',
          port: '5432'
        },
        metadata: {
          created_time: '2024-08-07T10:00:00Z',
          current_version: 3,
          max_versions: 10,
          updated_time: '2024-08-07T14:30:00Z',
          versions: {
            '3': {
              version: 3,
              created_time: '2024-08-07T14:30:00Z',
              destroyed: false,
              data: { username: 'backstage_user', password: 'secure_password_123' }
            },
            '2': {
              version: 2,
              created_time: '2024-08-06T10:00:00Z',
              destroyed: false,
              data: { username: 'backstage_user', password: 'old_password_456' }
            }
          }
        },
        engine: 'kv'
      },
      {
        path: 'secret/apps/frontend/config',
        data: {
          api_key: 'api_key_789',
          secret_key: 'secret_key_abc',
          environment: 'production'
        },
        metadata: {
          created_time: '2024-08-05T09:00:00Z',
          current_version: 1,
          max_versions: 10,
          updated_time: '2024-08-05T09:00:00Z',
          versions: {
            '1': {
              version: 1,
              created_time: '2024-08-05T09:00:00Z',
              destroyed: false,
              data: { api_key: 'api_key_789', secret_key: 'secret_key_abc' }
            }
          }
        },
        engine: 'kv'
      }
    ];

    const mockDynamicCreds: DynamicCredentials[] = [
      {
        username: 'v-root-readonly-abc123',
        password: 'temp_password_xyz789',
        ttl: 3600,
        renewable: true,
        lease_id: 'database/creds/readonly/abc123',
        created_time: '2024-08-07T15:00:00Z'
      }
    ];

    setSecrets(mockSecrets);
    setDynamicCreds(mockDynamicCreds);
    setLoading(false);
  };

  const toggleSecretVisibility = (path: string) => {
    const newShowValues = new Set(showValues);
    if (showValues.has(path)) {
      newShowValues.delete(path);
    } else {
      newShowValues.add(path);
    }
    setShowValues(newShowValues);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${label} has been copied to your clipboard.`,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const createSecret = async () => {
    if (!newSecretPath || !newSecretData) {
      toast({
        title: "Validation Error",
        description: "Path and data are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = JSON.parse(newSecretData);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newSecret: Secret = {
        path: newSecretPath,
        data,
        metadata: {
          created_time: new Date().toISOString(),
          current_version: 1,
          max_versions: 10,
          updated_time: new Date().toISOString(),
          versions: {
            '1': {
              version: 1,
              created_time: new Date().toISOString(),
              destroyed: false,
              data
            }
          }
        },
        engine: 'kv'
      };

      setSecrets([...secrets, newSecret]);
      setNewSecretPath('');
      setNewSecretData('');
      setIsCreating(false);

      toast({
        title: "Secret Created",
        description: `Secret at ${newSecretPath} has been created successfully.`,
      });
    } catch (err) {
      toast({
        title: "Creation Failed",
        description: "Invalid JSON data or creation failed.",
        variant: "destructive",
      });
    }
  };

  const generateDynamicCredentials = async (role: string, engine: string) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newCreds: DynamicCredentials = {
        username: `v-root-${role}-${Date.now().toString(36)}`,
        password: `temp_${Math.random().toString(36).substring(7)}`,
        ttl: 3600,
        renewable: true,
        lease_id: `${engine}/creds/${role}/${Date.now()}`,
        created_time: new Date().toISOString()
      };

      setDynamicCreds([...dynamicCreds, newCreds]);

      toast({
        title: "Credentials Generated",
        description: `New ${role} credentials have been generated.`,
      });
    } catch (err) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate dynamic credentials.",
        variant: "destructive",
      });
    }
  };

  const renewCredentials = async (leaseId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Credentials Renewed",
        description: "Lease has been successfully renewed.",
      });
    } catch (err) {
      toast({
        title: "Renewal Failed",
        description: "Failed to renew credentials.",
        variant: "destructive",
      });
    }
  };

  const revokeCredentials = async (leaseId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setDynamicCreds(dynamicCreds.filter(cred => cred.lease_id !== leaseId));
      
      toast({
        title: "Credentials Revoked",
        description: "Credentials have been revoked successfully.",
      });
    } catch (err) {
      toast({
        title: "Revocation Failed",
        description: "Failed to revoke credentials.",
        variant: "destructive",
      });
    }
  };

  const isSecretVisible = (path: string) => showValues.has(path);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-600">Loading secrets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Secret Manager</h2>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Secret
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Secret</DialogTitle>
              <DialogDescription>
                Create a new secret in the selected engine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="path">Secret Path</Label>
                <Input
                  id="path"
                  placeholder="secret/myapp/config"
                  value={newSecretPath}
                  onChange={(e) => setNewSecretPath(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="data">Secret Data (JSON)</Label>
                <Textarea
                  id="data"
                  placeholder='{"username": "admin", "password": "secret123"}'
                  value={newSecretData}
                  onChange={(e) => setNewSecretData(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={createSecret}>Create Secret</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeEngine} onValueChange={setActiveEngine}>
        <TabsList>
          <TabsTrigger value="kv">Key-Value</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="pki">PKI</TabsTrigger>
          <TabsTrigger value="transit">Transit</TabsTrigger>
        </TabsList>

        <TabsContent value="kv">
          <div className="grid gap-4">
            {secrets.map((secret) => (
              <Card key={secret.path}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Key className="h-5 w-5 mr-2" />
                      {secret.path}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        v{secret.metadata.current_version}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSecretVisibility(secret.path)}
                      >
                        {isSecretVisible(secret.path) ? 
                          <EyeOff className="h-4 w-4" /> : 
                          <Eye className="h-4 w-4" />
                        }
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      Created: {new Date(secret.metadata.created_time).toLocaleString()}
                      {secret.metadata.updated_time !== secret.metadata.created_time && (
                        <span className="ml-4">
                          Updated: {new Date(secret.metadata.updated_time).toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    {isSecretVisible(secret.path) ? (
                      <div className="space-y-2">
                        {Object.entries(secret.data).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <span className="font-medium text-sm">{key}:</span>
                              <span className="ml-2 font-mono text-sm">{value}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(value, key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
                        Click the eye icon to reveal secret values
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="database">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Generate Database Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="db-role">Database Role</Label>
                    <select
                      id="db-role"
                      value={selectedDBRole}
                      onChange={(e) => setSelectedDBRole(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="readonly">Read Only</option>
                      <option value="readwrite">Read/Write</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <Button onClick={() => generateDynamicCredentials(selectedDBRole, 'database')}>
                    Generate Credentials
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {dynamicCreds.map((cred) => (
                <Card key={cred.lease_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Dynamic Database Credentials</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {Math.floor(cred.ttl / 60)}m remaining
                        </Badge>
                        {cred.renewable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => renewCredentials(cred.lease_id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Renew
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => revokeCredentials(cred.lease_id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Username:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(cred.username, 'Username')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="font-mono text-sm mt-1">{cred.username}</div>
                      </div>
                      
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Password:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(cred.password, 'Password')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="font-mono text-sm mt-1">{cred.password}</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 text-xs text-gray-500">
                      Lease ID: {cred.lease_id}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pki">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Generate Certificate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="common-name">Common Name</Label>
                  <Input
                    id="common-name"
                    placeholder="app.backstage.local"
                    value={certCommonName}
                    onChange={(e) => setCertCommonName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="alt-names">Alternative Names (comma-separated)</Label>
                  <Input
                    id="alt-names"
                    placeholder="api.backstage.local,web.backstage.local"
                    value={certAltNames}
                    onChange={(e) => setCertAltNames(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={() => toast({
                    title: "Certificate Generated",
                    description: "PKI certificate has been generated successfully.",
                  })}
                  disabled={!certCommonName}
                >
                  Generate Certificate
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Transit Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plaintext">Data to Encrypt</Label>
                  <Textarea
                    id="plaintext"
                    placeholder="Enter sensitive data to encrypt..."
                    rows={4}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button>Encrypt</Button>
                  <Button variant="outline">Decrypt</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}