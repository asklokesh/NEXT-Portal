'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Shield, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Copy,
  Lock,
  Unlock,
  UserPlus,
  Settings,
  Key
} from 'lucide-react';
import { Role, Permission, ResourceType, PermissionAction } from '@/lib/permissions/types';

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/permissions/roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (roleData: any) => {
    try {
      const response = await fetch('/api/permissions/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      });
      
      if (response.ok) {
        await fetchRoles();
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      const response = await fetch(`/api/permissions/roles/${roleId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchRoles();
      }
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Role Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage roles and permissions for your organization
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Role List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      System
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {role.description}
                </p>
              </div>
              {!role.isSystem && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedRole(role)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRole(role.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Permissions: {role.permissions.length}
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 3).map((perm, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {perm.resource}.{perm.action}
                  </Badge>
                ))}
                {role.permissions.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{role.permissions.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateRole}
      />

      {/* Edit Role Dialog */}
      {selectedRole && (
        <EditRoleDialog
          role={selectedRole}
          open={!!selectedRole}
          onOpenChange={(open) => !open && setSelectedRole(null)}
          onSubmit={async (data) => {
            // Handle role update
            await fetchRoles();
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
}

function CreateRoleDialog({ open, onOpenChange, onSubmit }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const resources = Object.values(ResourceType);
  const actions = Object.values(PermissionAction);

  const handleSubmit = () => {
    onSubmit({
      name,
      description,
      permissions
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Define a new role with specific permissions
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Role Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project Manager"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the role"
            />
          </div>
          
          <div>
            <Label>Permissions</Label>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {resources.map((resource) => (
                  <div key={resource} className="space-y-1">
                    <div className="font-medium text-sm">{resource}</div>
                    {actions.map((action) => (
                      <label
                        key={`${resource}-${action}`}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <Checkbox
                          checked={permissions.some(
                            p => p.resource === resource && p.action === action
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPermissions([...permissions, {
                                id: `${resource}-${action}`,
                                resource,
                                action
                              }]);
                            } else {
                              setPermissions(permissions.filter(
                                p => !(p.resource === resource && p.action === action)
                              ));
                            }
                          }}
                        />
                        <span>{action}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Create Role
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditRoleDialog({ role, open, onOpenChange, onSubmit }: any) {
  // Similar to CreateRoleDialog but for editing
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Role: {role.name}</DialogTitle>
          <DialogDescription>
            Modify role permissions and settings
          </DialogDescription>
        </DialogHeader>
        {/* Implementation similar to CreateRoleDialog */}
      </DialogContent>
    </Dialog>
  );
}