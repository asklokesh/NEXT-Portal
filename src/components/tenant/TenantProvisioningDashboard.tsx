/**
 * Tenant Provisioning Dashboard
 * Administrative interface for managing tenant provisioning and lifecycle
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Server, 
  Settings,
  Plus,
  Eye,
  Pause,
  Play,
  ArrowUp,
  Archive,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  adminEmail: string;
  customDomain?: string;
  createdAt: string;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  }>;
}

interface ProvisioningRequest {
  organizationName: string;
  adminEmail: string;
  adminName: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  customDomain?: string;
  features: string[];
}

const TIER_COLORS = {
  FREE: 'bg-gray-100 text-gray-800',
  STARTER: 'bg-blue-100 text-blue-800',
  PROFESSIONAL: 'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-gold-100 text-gold-800'
};

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-800'
};

export default function TenantProvisioningDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProvisioningForm, setShowProvisioningForm] = useState(false);
  const [provisioningRequest, setProvisioningRequest] = useState<ProvisioningRequest>({
    organizationName: '',
    adminEmail: '',
    adminName: '',
    tier: 'FREE',
    features: []
  });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      // This would typically fetch from your API
      // For now, using mock data
      const mockTenants: Tenant[] = [
        {
          id: 'tenant_001',
          name: 'Acme Corporation',
          slug: 'acme-corp',
          tier: 'ENTERPRISE',
          status: 'ACTIVE',
          adminEmail: 'admin@acme.com',
          customDomain: 'portal.acme.com',
          createdAt: '2024-01-15T10:00:00Z',
          users: [
            { id: 'u1', email: 'admin@acme.com', name: 'John Admin', role: 'OWNER', isActive: true },
            { id: 'u2', email: 'user@acme.com', name: 'Jane User', role: 'MEMBER', isActive: true }
          ]
        },
        {
          id: 'tenant_002',
          name: 'StartupXYZ',
          slug: 'startupxyz',
          tier: 'STARTER',
          status: 'ACTIVE',
          adminEmail: 'founder@startupxyz.io',
          createdAt: '2024-02-01T14:30:00Z',
          users: [
            { id: 'u3', email: 'founder@startupxyz.io', name: 'Alex Founder', role: 'OWNER', isActive: true }
          ]
        },
        {
          id: 'tenant_003',
          name: 'BigTech Inc',
          slug: 'bigtech',
          tier: 'PROFESSIONAL',
          status: 'SUSPENDED',
          adminEmail: 'admin@bigtech.com',
          createdAt: '2024-01-20T09:15:00Z',
          users: [
            { id: 'u4', email: 'admin@bigtech.com', name: 'Sarah Admin', role: 'OWNER', isActive: false }
          ]
        }
      ];
      setTenants(mockTenants);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/tenant/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-System-Key': process.env.NEXT_PUBLIC_SYSTEM_API_KEY || ''
        },
        body: JSON.stringify(provisioningRequest)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Tenant "${provisioningRequest.organizationName}" provisioned successfully`
        });
        setShowProvisioningForm(false);
        setProvisioningRequest({
          organizationName: '',
          adminEmail: '',
          adminName: '',
          tier: 'FREE',
          features: []
        });
        fetchTenants();
      } else {
        toast({
          title: 'Provisioning Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Provisioning error:', error);
      toast({
        title: 'Error',
        description: 'Failed to provision tenant',
        variant: 'destructive'
      });
    }
  };

  const handleTenantOperation = async (tenantId: string, operation: string, params?: any) => {
    try {
      const response = await fetch('/api/tenant/provision', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-System-Key': process.env.NEXT_PUBLIC_SYSTEM_API_KEY || ''
        },
        body: JSON.stringify({
          tenantId,
          operation,
          ...params
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Tenant ${operation} completed successfully`
        });
        fetchTenants();
      } else {
        toast({
          title: 'Operation Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Tenant operation error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${operation} tenant`,
        variant: 'destructive'
      });
    }
  };

  const renderTenantCard = (tenant: Tenant) => (
    <Card key={tenant.id} className="border">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">
              {tenant.name}
            </CardTitle>
            <CardDescription className="text-sm">
              {tenant.slug} • {tenant.adminEmail}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={TIER_COLORS[tenant.tier]}>
              {tenant.tier}
            </Badge>
            <Badge className={STATUS_COLORS[tenant.status]}>
              {tenant.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{tenant.users.length} users</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              {new Date(tenant.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {tenant.customDomain && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-gray-500" />
              <span className="font-mono text-blue-600">{tenant.customDomain}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTenant(tenant)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>

          {tenant.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTenantOperation(tenant.id, 'suspend', {
                reason: 'Administrative suspension'
              })}
              className="text-orange-600 hover:text-orange-700"
            >
              <Pause className="h-4 w-4 mr-1" />
              Suspend
            </Button>
          )}

          {tenant.status === 'SUSPENDED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTenantOperation(tenant.id, 'reactivate')}
              className="text-green-600 hover:text-green-700"
            >
              <Play className="h-4 w-4 mr-1" />
              Reactivate
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTenantOperation(tenant.id, 'upgrade', {
              newTier: tenant.tier === 'FREE' ? 'STARTER' : 
                     tenant.tier === 'STARTER' ? 'PROFESSIONAL' : 
                     'ENTERPRISE'
            })}
            className="text-purple-600 hover:text-purple-700"
          >
            <ArrowUp className="h-4 w-4 mr-1" />
            Upgrade
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTenantOperation(tenant.id, 'archive')}
            className="text-gray-600 hover:text-gray-700"
          >
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderProvisioningForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Provision New Tenant</CardTitle>
        <CardDescription>
          Create a new tenant organization with admin user
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleProvisionTenant} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                value={provisioningRequest.organizationName}
                onChange={(e) => setProvisioningRequest(prev => ({
                  ...prev,
                  organizationName: e.target.value
                }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <Select
                value={provisioningRequest.tier}
                onValueChange={(value) => setProvisioningRequest(prev => ({
                  ...prev,
                  tier: value as any
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adminName">Admin Name</Label>
              <Input
                id="adminName"
                value={provisioningRequest.adminName}
                onChange={(e) => setProvisioningRequest(prev => ({
                  ...prev,
                  adminName: e.target.value
                }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={provisioningRequest.adminEmail}
                onChange={(e) => setProvisioningRequest(prev => ({
                  ...prev,
                  adminEmail: e.target.value
                }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="customDomain">Custom Domain (optional)</Label>
            <Input
              id="customDomain"
              value={provisioningRequest.customDomain || ''}
              onChange={(e) => setProvisioningRequest(prev => ({
                ...prev,
                customDomain: e.target.value
              }))}
              placeholder="portal.company.com"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit">
              Provision Tenant
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowProvisioningForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderTenantDetails = (tenant: Tenant) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{tenant.name} Details</CardTitle>
            <CardDescription>
              Complete tenant information and management
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setSelectedTenant(null)}
          >
            Back to List
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">Basic Information</h4>
            <div className="space-y-2 text-sm">
              <div><strong>ID:</strong> {tenant.id}</div>
              <div><strong>Name:</strong> {tenant.name}</div>
              <div><strong>Slug:</strong> {tenant.slug}</div>
              <div><strong>Admin Email:</strong> {tenant.adminEmail}</div>
              <div><strong>Custom Domain:</strong> {tenant.customDomain || 'None'}</div>
              <div><strong>Created:</strong> {new Date(tenant.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Status & Tier</h4>
            <div className="space-y-2">
              <Badge className={TIER_COLORS[tenant.tier]}>
                {tenant.tier}
              </Badge>
              <Badge className={STATUS_COLORS[tenant.status]}>
                {tenant.status}
              </Badge>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Users ({tenant.users.length})</h4>
          <div className="space-y-2">
            {tenant.users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-600">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>
                    {user.role}
                  </Badge>
                  {user.isActive ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading tenants...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Tenant Management</h1>
          <p className="text-gray-600">
            Manage tenant provisioning, lifecycle, and operations
          </p>
        </div>
        {!showProvisioningForm && !selectedTenant && (
          <Button onClick={() => setShowProvisioningForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      {!showProvisioningForm && !selectedTenant && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <div className="text-2xl font-bold">{tenants.length}</div>
                  <div className="text-sm text-gray-600">Total Tenants</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="ml-3">
                  <div className="text-2xl font-bold">
                    {tenants.filter(t => t.status === 'ACTIVE').length}
                  </div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="ml-3">
                  <div className="text-2xl font-bold">
                    {tenants.filter(t => t.status === 'SUSPENDED').length}
                  </div>
                  <div className="text-sm text-gray-600">Suspended</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Settings className="h-4 w-4 text-purple-600" />
                </div>
                <div className="ml-3">
                  <div className="text-2xl font-bold">
                    {tenants.filter(t => t.tier === 'ENTERPRISE').length}
                  </div>
                  <div className="text-sm text-gray-600">Enterprise</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Area */}
      {showProvisioningForm ? (
        renderProvisioningForm()
      ) : selectedTenant ? (
        renderTenantDetails(selectedTenant)
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map(renderTenantCard)}
        </div>
      )}
    </div>
  );
}