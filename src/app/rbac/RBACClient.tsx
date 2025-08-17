'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Key, Lock, UserCheck, AlertTriangle,
  Plus, Search, Filter, MoreVertical, Edit, Trash2,
  CheckCircle, Clock, Eye, EyeOff, Settings, Download,
  FileText, Globe, Database, Server, Code, Layers
} from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  userCount: number;
  color: string;
  isSystemRole: boolean;
  lastModified: Date;
  createdBy: string;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: 'global' | 'team' | 'personal';
  description: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  roles: string[];
  status: 'active' | 'inactive' | 'pending';
  lastLogin: Date;
  department: string;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  type: 'allow' | 'deny';
  conditions: string[];
  resources: string[];
  actions: string[];
  isActive: boolean;
}

interface AuditLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  resource: string;
  outcome: 'success' | 'denied' | 'error';
  details: string;
}

// Mock data for RBAC
const roles: Role[] = [
  {
    id: '1',
    name: 'Platform Admin',
    description: 'Full access to all platform features and settings',
    permissions: [],
    userCount: 3,
    color: 'red',
    isSystemRole: true,
    lastModified: new Date('2024-01-15'),
    createdBy: 'System'
  },
  {
    id: '2',
    name: 'Developer',
    description: 'Access to development tools, repos, and deployment features',
    permissions: [],
    userCount: 245,
    color: 'blue',
    isSystemRole: false,
    lastModified: new Date('2024-01-14'),
    createdBy: 'admin@company.com'
  },
  {
    id: '3',
    name: 'Team Lead',
    description: 'Team management and project oversight capabilities',
    permissions: [],
    userCount: 45,
    color: 'purple',
    isSystemRole: false,
    lastModified: new Date('2024-01-13'),
    createdBy: 'hr@company.com'
  },
  {
    id: '4',
    name: 'Viewer',
    description: 'Read-only access to catalog and documentation',
    permissions: [],
    userCount: 178,
    color: 'green',
    isSystemRole: false,
    lastModified: new Date('2024-01-12'),
    createdBy: 'admin@company.com'
  }
];

const permissions: Permission[] = [
  {
    id: '1',
    resource: 'catalog.entities',
    action: 'read',
    scope: 'global',
    description: 'View software catalog entities'
  },
  {
    id: '2',
    resource: 'catalog.entities',
    action: 'write',
    scope: 'team',
    description: 'Create and modify catalog entities'
  },
  {
    id: '3',
    resource: 'scaffolder.templates',
    action: 'execute',
    scope: 'global',
    description: 'Execute scaffolder templates'
  },
  {
    id: '4',
    resource: 'techdocs',
    action: 'publish',
    scope: 'team',
    description: 'Publish technical documentation'
  },
  {
    id: '5',
    resource: 'kubernetes.clusters',
    action: 'manage',
    scope: 'global',
    description: 'Manage Kubernetes clusters'
  }
];

const users: User[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah.chen@company.com',
    avatar: '/api/placeholder/40/40',
    roles: ['1', '3'],
    status: 'active',
    lastLogin: new Date('2024-01-15T14:30:00Z'),
    department: 'Platform Engineering'
  },
  {
    id: '2',
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@company.com',
    avatar: '/api/placeholder/40/40',
    roles: ['2'],
    status: 'active',
    lastLogin: new Date('2024-01-15T13:45:00Z'),
    department: 'Product Development'
  },
  {
    id: '3',
    name: 'Jordan Kim',
    email: 'jordan.kim@company.com',
    avatar: '/api/placeholder/40/40',
    roles: ['4'],
    status: 'pending',
    lastLogin: new Date('2024-01-10T09:15:00Z'),
    department: 'Design'
  }
];

const policies: Policy[] = [
  {
    id: '1',
    name: 'Production Environment Access',
    description: 'Restrict production access to senior developers only',
    type: 'allow',
    conditions: ['user.level >= senior', 'environment == production'],
    resources: ['kubernetes.production', 'databases.production'],
    actions: ['read', 'deploy'],
    isActive: true
  },
  {
    id: '2',
    name: 'After Hours Deployment Block',
    description: 'Prevent deployments outside business hours',
    type: 'deny',
    conditions: ['time.hour < 9', 'time.hour > 17'],
    resources: ['scaffolder.deploy'],
    actions: ['execute'],
    isActive: true
  }
];

const auditLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: new Date('2024-01-15T14:30:00Z'),
    user: 'sarah.chen@company.com',
    action: 'role.assign',
    resource: 'user:alex.rodriguez',
    outcome: 'success',
    details: 'Assigned Developer role'
  },
  {
    id: '2',
    timestamp: new Date('2024-01-15T14:25:00Z'),
    user: 'alex.rodriguez@company.com',
    action: 'catalog.create',
    resource: 'service:payment-api',
    outcome: 'success',
    details: 'Created new service entity'
  },
  {
    id: '3',
    timestamp: new Date('2024-01-15T14:20:00Z'),
    user: 'jordan.kim@company.com',
    action: 'kubernetes.access',
    resource: 'cluster:production',
    outcome: 'denied',
    details: 'Insufficient permissions'
  }
];

export default function RBACClient() {
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'policies' | 'audit'>('roles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 border-green-200';
      case 'inactive': return 'text-red-600 bg-red-100 border-red-200';
      case 'pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'global': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'team': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'personal': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const renderRolesTab = () => (
    <div className="space-y-6">
      {/* Roles Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Roles Management</h2>
          <p className="text-sm text-muted-foreground">Define and manage access roles for your organization</p>
        </div>
        <button
          onClick={() => setShowRoleModal(true)}
          className="spotify-button-primary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role, index) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="spotify-card p-6 cursor-pointer hover:spotify-card-hover"
            onClick={() => setSelectedRole(role)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl bg-${role.color}-500/10`}>
                  <Shield className={`h-6 w-6 text-${role.color}-600`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{role.name}</h3>
                  {role.isSystemRole && (
                    <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">
                      System Role
                    </span>
                  )}
                </div>
              </div>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{role.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{role.userCount} users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{role.permissions.length} permissions</span>
                </div>
              </div>
              
              <span className="text-xs text-muted-foreground">
                Modified {role.lastModified.toLocaleDateString()}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      {/* Users Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Users Management</h2>
          <p className="text-sm text-muted-foreground">Manage user access and role assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="spotify-input pl-10 w-64"
            />
          </div>
          <button className="spotify-button-primary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="spotify-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">User</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Roles</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Department</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Last Login</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-full" />
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((roleId) => {
                        const role = roles.find(r => r.id === roleId);
                        return role ? (
                          <span
                            key={roleId}
                            className={`px-2 py-1 rounded text-xs font-medium bg-${role.color}-100 text-${role.color}-600`}
                          >
                            {role.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">{user.department}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {user.lastLogin.toLocaleDateString()}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-muted rounded transition-colors">
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-muted rounded transition-colors">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPoliciesTab = () => (
    <div className="space-y-6">
      {/* Policies Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Access Policies</h2>
          <p className="text-sm text-muted-foreground">Define conditional access rules and restrictions</p>
        </div>
        <button className="spotify-button-primary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Policy
        </button>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        {policies.map((policy, index) => (
          <motion.div
            key={policy.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="spotify-card p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  policy.type === 'allow' ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <Lock className={`h-6 w-6 ${
                    policy.type === 'allow' ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{policy.name}</h3>
                  <p className="text-sm text-muted-foreground">{policy.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  policy.type === 'allow' 
                    ? 'bg-green-100 text-green-600 border border-green-200'
                    : 'bg-red-100 text-red-600 border border-red-200'
                }`}>
                  {policy.type.toUpperCase()}
                </span>
                
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  policy.isActive 
                    ? 'bg-green-100 text-green-600 border border-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {policy.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Conditions</h4>
                <div className="space-y-1">
                  {policy.conditions.map((condition, idx) => (
                    <code key={idx} className="block text-xs bg-muted p-2 rounded">
                      {condition}
                    </code>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Resources</h4>
                <div className="flex flex-wrap gap-1">
                  {policy.resources.map((resource, idx) => (
                    <span key={idx} className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                      {resource}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Actions</h4>
                <div className="flex flex-wrap gap-1">
                  {policy.actions.map((action, idx) => (
                    <span key={idx} className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderAuditTab = () => (
    <div className="space-y-6">
      {/* Audit Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Monitor access events and security activities</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="spotify-input text-sm">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
          <button className="spotify-button-secondary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="spotify-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Timestamp</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">User</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Action</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Resource</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Outcome</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4">
                    <span className="text-sm text-foreground">
                      {log.timestamp.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">{log.user}</span>
                  </td>
                  <td className="p-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{log.action}</code>
                  </td>
                  <td className="p-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{log.resource}</code>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      log.outcome === 'success' ? 'bg-green-100 text-green-600' :
                      log.outcome === 'denied' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{log.details}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="spotify-layout min-h-screen">
      <div className="spotify-main-content">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold spotify-gradient-text">RBAC</h1>
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  Premium
                </span>
              </div>
              <p className="text-muted-foreground">
                No-code role-based access control with policy management and audit logging
              </p>
            </div>
            <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure RBAC
            </button>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-muted/30 p-1 rounded-xl w-fit">
            {[
              { id: 'roles', label: 'Roles', icon: Shield },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'policies', label: 'Policies', icon: Lock },
              { id: 'audit', label: 'Audit Logs', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'spotify-tab-active'
                    : 'spotify-tab-inactive'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'roles' && renderRolesTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'policies' && renderPoliciesTab()}
            {activeTab === 'audit' && renderAuditTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}