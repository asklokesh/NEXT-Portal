'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Key, Settings, Plus, Search, Filter, 
  Edit, Trash2, Check, X, Eye, AlertTriangle, Lock,
  UserCheck, UserX, Crown, Star, ChevronDown, 
  RefreshCw, Download, Upload, Copy, ExternalLink,
  Activity, BarChart3, TrendingUp, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  users: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  color: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  roles: string[];
  lastLogin: string;
  isActive: boolean;
  department: string;
  team: string;
  manager?: string;
}

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  resource: string;
  action: string;
  isSystem: boolean;
}

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  resource: string;
  actions: string[];
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
  priority: number;
}

interface PolicyCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'in' | 'not_in';
  value: string | string[];
}

const PERMISSION_CATEGORIES = [
  {
    id: 'catalog',
    name: 'Software Catalog',
    description: 'Manage software catalog entities',
    icon: BarChart3,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    id: 'templates',
    name: 'Software Templates',
    description: 'Create and manage templates',
    icon: Copy,
    color: 'text-green-600 bg-green-100'
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Manage technical documentation',
    icon: ExternalLink,
    color: 'text-purple-600 bg-purple-100'
  },
  {
    id: 'plugins',
    name: 'Plugin Management',
    description: 'Install and configure plugins',
    icon: Settings,
    color: 'text-orange-600 bg-orange-100'
  },
  {
    id: 'admin',
    name: 'Administration',
    description: 'System administration tasks',
    icon: Crown,
    color: 'text-red-600 bg-red-100'
  }
];

export default function RBACDashboard() {
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'permissions' | 'policies'>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRBACData();
  }, []);

  const fetchRBACData = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockRoles: Role[] = [
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system access and management capabilities',
        permissions: ['catalog:*', 'templates:*', 'docs:*', 'plugins:*', 'admin:*'],
        users: ['admin@company.com', 'platform-lead@company.com'],
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        color: 'text-red-600 bg-red-100'
      },
      {
        id: 'developer',
        name: 'developer',
        displayName: 'Developer',
        description: 'Standard developer access to catalog and templates',
        permissions: ['catalog:read', 'catalog:write', 'templates:read', 'templates:create', 'docs:read'],
        users: ['dev1@company.com', 'dev2@company.com', 'dev3@company.com'],
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        color: 'text-blue-600 bg-blue-100'
      },
      {
        id: 'viewer',
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access to catalog and documentation',
        permissions: ['catalog:read', 'docs:read'],
        users: ['viewer1@company.com', 'viewer2@company.com'],
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        color: 'text-gray-600 bg-gray-100'
      }
    ];

    const mockUsers: User[] = [
      {
        id: 'admin',
        email: 'admin@company.com',
        name: 'System Administrator',
        roles: ['admin'],
        lastLogin: new Date().toISOString(),
        isActive: true,
        department: 'Engineering',
        team: 'Platform',
        manager: 'platform-lead@company.com'
      },
      {
        id: 'dev1',
        email: 'dev1@company.com',
        name: 'Alice Johnson',
        roles: ['developer'],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        department: 'Engineering',
        team: 'Frontend'
      }
    ];

    const mockPermissions: Permission[] = [
      {
        id: 'catalog-read',
        name: 'catalog:read',
        displayName: 'View Catalog',
        description: 'View software catalog entities',
        category: 'catalog',
        resource: 'catalog',
        action: 'read',
        isSystem: true
      },
      {
        id: 'catalog-write',
        name: 'catalog:write',
        displayName: 'Edit Catalog',
        description: 'Create and edit catalog entities',
        category: 'catalog',
        resource: 'catalog',
        action: 'write',
        isSystem: true
      }
    ];

    setRoles(mockRoles);
    setUsers(mockUsers);
    setPermissions(mockPermissions);
    setLoading(false);
  };

  const stats = {
    totalRoles: roles.length,
    totalUsers: users.length,
    activeUsers: users.filter(u => u.isActive).length,
    systemRoles: roles.filter(r => r.isSystem).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading RBAC
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Setting up role-based access control...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Shield className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">RBAC</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                Premium
              </span>
            </div>
            <p className="text-xl text-indigo-100">
              Role-Based Access Control Management
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchRBACData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center transition-colors"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Role
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Key className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.totalRoles}</div>
                <div className="text-sm text-indigo-100">Roles</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-sm text-indigo-100">Users</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <UserCheck className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.activeUsers}</div>
                <div className="text-sm text-indigo-100">Active</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Lock className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.systemRoles}</div>
                <div className="text-sm text-indigo-100">System</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'roles', label: 'Roles', icon: Key },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'permissions', label: 'Permissions', icon: Lock },
            { id: 'policies', label: 'Policies', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </button>
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'roles' && (
          <RolesTab 
            roles={roles}
            searchQuery={searchQuery}
            onRoleSelect={setSelectedRole}
            onRoleUpdate={setRoles}
          />
        )}
        
        {activeTab === 'users' && (
          <UsersTab 
            users={users}
            roles={roles}
            searchQuery={searchQuery}
            onUserSelect={setSelectedUser}
            onUserUpdate={setUsers}
          />
        )}
        
        {activeTab === 'permissions' && (
          <PermissionsTab 
            permissions={permissions}
            categories={PERMISSION_CATEGORIES}
            searchQuery={searchQuery}
          />
        )}
        
        {activeTab === 'policies' && (
          <PoliciesTab 
            policies={policies}
            searchQuery={searchQuery}
            onPolicyUpdate={setPolicies}
          />
        )}
      </div>

      {/* Role Detail Modal */}
      {selectedRole && (
        <RoleDetailModal
          role={selectedRole}
          permissions={permissions}
          onClose={() => setSelectedRole(null)}
          onUpdate={(updatedRole) => {
            setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
            setSelectedRole(null);
          }}
        />
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          roles={roles}
          onClose={() => setSelectedUser(null)}
          onUpdate={(updatedUser) => {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            setSelectedUser(null);
          }}
        />
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <CreateRoleModal
          permissions={permissions}
          onClose={() => setShowCreateModal(false)}
          onCreate={(newRole) => {
            setRoles(prev => [...prev, newRole]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// Roles Tab Component
const RolesTab = ({ roles, searchQuery, onRoleSelect, onRoleUpdate }: any) => {
  const filteredRoles = roles.filter((role: Role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredRoles.map((role: Role) => (
        <motion.div
          key={role.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onRoleSelect(role)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${role.color} mr-3`}>
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {role.displayName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {role.name}
                </p>
              </div>
            </div>
            {role.isSystem && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-medium">
                System
              </span>
            )}
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            {role.description}
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Users</span>
              <span className="text-sm font-medium">{role.users.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Permissions</span>
              <span className="text-sm font-medium">{role.permissions.length}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// Users Tab Component
const UsersTab = ({ users, roles, searchQuery, onUserSelect, onUserUpdate }: any) => {
  const filteredUsers = users.filter((user: User) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user: User) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.slice(0, 2).map(roleId => {
                      const role = roles.find((r: Role) => r.id === roleId);
                      return role ? (
                        <span
                          key={roleId}
                          className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
                        >
                          {role.displayName}
                        </span>
                      ) : null;
                    })}
                    {user.roles.length > 2 && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                        +{user.roles.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {user.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(user.lastLogin).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onUserSelect(user)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Permissions Tab Component
const PermissionsTab = ({ permissions, categories, searchQuery }: any) => {
  const filteredPermissions = permissions.filter((permission: Permission) =>
    permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    permission.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    permission.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedPermissions = categories.reduce((acc: any, category: any) => {
    acc[category.id] = filteredPermissions.filter((p: Permission) => p.category === category.id);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {categories.map((category: any) => {
        const Icon = category.icon;
        const categoryPermissions = groupedPermissions[category.id] || [];
        
        if (categoryPermissions.length === 0) return null;
        
        return (
          <div
            key={category.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center mb-4">
              <div className={`p-2 rounded-lg ${category.color} mr-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {category.description}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPermissions.map((permission: Permission) => (
                <div
                  key={permission.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {permission.displayName}
                    </h4>
                    {permission.isSystem && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-medium">
                        System
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {permission.description}
                  </p>
                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {permission.name}
                  </code>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Policies Tab Component
const PoliciesTab = ({ policies, searchQuery, onPolicyUpdate }: any) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="text-center py-12">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Policy Builder Coming Soon
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Visual policy builder for advanced access control rules
        </p>
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Get Early Access
        </button>
      </div>
    </div>
  );
};

// Modal components would go here (simplified for space)
const RoleDetailModal = ({ role, permissions, onClose, onUpdate }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Edit Role: {role.displayName}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Role editing interface would be implemented here with form fields for name, description, and permission selection.
        </p>
      </div>
    </div>
  </div>
);

const UserDetailModal = ({ user, roles, onClose, onUpdate }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Edit User: {user.name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">
          User editing interface would be implemented here with form fields for roles, department, and status.
        </p>
      </div>
    </div>
  </div>
);

const CreateRoleModal = ({ permissions, onClose, onCreate }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Create New Role
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Role creation form would be implemented here with fields for name, description, and permission selection.
        </p>
      </div>
    </div>
  </div>
);