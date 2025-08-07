/**
 * User and Authentication Test Fixtures
 * Mock user data for RBAC and authentication testing
 */

export interface UserFixture {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  groups: string[];
  metadata: {
    lastLogin: string;
    createdAt: string;
    active: boolean;
    mfaEnabled: boolean;
    profileComplete: boolean;
  };
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
    defaultDashboard: string;
  };
  organization: {
    id: string;
    name: string;
    domain: string;
    tier: 'free' | 'premium' | 'enterprise';
  };
}

export interface RoleFixture {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits: string[];
  scope: 'global' | 'organization' | 'project';
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    system: boolean;
  };
}

export interface PermissionFixture {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  scope: 'global' | 'organization' | 'project' | 'user';
  conditions?: Record<string, any>;
}

// System roles
export const SYSTEM_ROLES: RoleFixture[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system administrator with all permissions',
    permissions: ['*'],
    inherits: [],
    scope: 'global',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'system',
      system: true
    }
  },
  {
    id: 'plugin-admin',
    name: 'Plugin Administrator',
    description: 'Can install, configure, and manage plugins',
    permissions: [
      'plugins:install',
      'plugins:uninstall',
      'plugins:configure',
      'plugins:read',
      'plugins:update',
      'marketplace:browse',
      'configs:read',
      'configs:write'
    ],
    inherits: ['user'],
    scope: 'organization',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      createdBy: 'admin',
      system: true
    }
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Can use plugins and access development resources',
    permissions: [
      'plugins:read',
      'plugins:use',
      'marketplace:browse',
      'catalog:read',
      'catalog:write',
      'docs:read',
      'docs:write',
      'builds:read',
      'deployments:read'
    ],
    inherits: ['user'],
    scope: 'organization',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-10T14:00:00Z',
      createdBy: 'admin',
      system: true
    }
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to most resources',
    permissions: [
      'plugins:read',
      'marketplace:browse',
      'catalog:read',
      'docs:read',
      'builds:read',
      'deployments:read'
    ],
    inherits: ['user'],
    scope: 'organization',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'admin',
      system: true
    }
  },
  {
    id: 'user',
    name: 'Basic User',
    description: 'Basic user with minimal permissions',
    permissions: [
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    inherits: [],
    scope: 'global',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'system',
      system: true
    }
  }
];

// Permission definitions
export const PERMISSIONS: PermissionFixture[] = [
  // Plugin permissions
  {
    id: 'plugins:install',
    name: 'Install Plugins',
    description: 'Permission to install new plugins',
    resource: 'plugins',
    action: 'install',
    scope: 'organization'
  },
  {
    id: 'plugins:uninstall',
    name: 'Uninstall Plugins',
    description: 'Permission to uninstall plugins',
    resource: 'plugins',
    action: 'uninstall',
    scope: 'organization'
  },
  {
    id: 'plugins:configure',
    name: 'Configure Plugins',
    description: 'Permission to configure plugin settings',
    resource: 'plugins',
    action: 'configure',
    scope: 'organization'
  },
  {
    id: 'plugins:read',
    name: 'Read Plugins',
    description: 'Permission to view plugin information',
    resource: 'plugins',
    action: 'read',
    scope: 'organization'
  },
  {
    id: 'plugins:update',
    name: 'Update Plugins',
    description: 'Permission to update plugins to newer versions',
    resource: 'plugins',
    action: 'update',
    scope: 'organization'
  },
  {
    id: 'plugins:use',
    name: 'Use Plugins',
    description: 'Permission to use installed plugins',
    resource: 'plugins',
    action: 'use',
    scope: 'organization'
  },
  
  // Marketplace permissions
  {
    id: 'marketplace:browse',
    name: 'Browse Marketplace',
    description: 'Permission to browse the plugin marketplace',
    resource: 'marketplace',
    action: 'browse',
    scope: 'global'
  },
  
  // Configuration permissions
  {
    id: 'configs:read',
    name: 'Read Configurations',
    description: 'Permission to read system configurations',
    resource: 'configs',
    action: 'read',
    scope: 'organization'
  },
  {
    id: 'configs:write',
    name: 'Write Configurations',
    description: 'Permission to modify system configurations',
    resource: 'configs',
    action: 'write',
    scope: 'organization'
  },
  
  // Catalog permissions
  {
    id: 'catalog:read',
    name: 'Read Catalog',
    description: 'Permission to read catalog entries',
    resource: 'catalog',
    action: 'read',
    scope: 'organization'
  },
  {
    id: 'catalog:write',
    name: 'Write Catalog',
    description: 'Permission to create and modify catalog entries',
    resource: 'catalog',
    action: 'write',
    scope: 'organization'
  }
];

// Test users with different roles
export const TEST_USERS: UserFixture[] = [
  {
    id: 'admin-user-001',
    email: 'admin@example.com',
    name: 'System Administrator',
    roles: ['admin'],
    permissions: ['*'],
    groups: ['administrators', 'platform-team'],
    metadata: {
      lastLogin: '2024-01-15T09:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      active: true,
      mfaEnabled: true,
      profileComplete: true
    },
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: true,
      defaultDashboard: 'admin-overview'
    },
    organization: {
      id: 'org-enterprise-001',
      name: 'Enterprise Corp',
      domain: 'enterprise.com',
      tier: 'enterprise'
    }
  },
  {
    id: 'plugin-admin-001',
    email: 'plugin.admin@example.com',
    name: 'Plugin Administrator',
    roles: ['plugin-admin'],
    permissions: [
      'plugins:install',
      'plugins:uninstall',
      'plugins:configure',
      'plugins:read',
      'plugins:update',
      'marketplace:browse',
      'configs:read',
      'configs:write',
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['plugin-admins', 'platform-team'],
    metadata: {
      lastLogin: '2024-01-15T08:30:00Z',
      createdAt: '2024-01-02T10:00:00Z',
      active: true,
      mfaEnabled: true,
      profileComplete: true
    },
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: true,
      defaultDashboard: 'plugin-management'
    },
    organization: {
      id: 'org-enterprise-001',
      name: 'Enterprise Corp',
      domain: 'enterprise.com',
      tier: 'enterprise'
    }
  },
  {
    id: 'developer-001',
    email: 'developer@example.com',
    name: 'Senior Developer',
    roles: ['developer'],
    permissions: [
      'plugins:read',
      'plugins:use',
      'marketplace:browse',
      'catalog:read',
      'catalog:write',
      'docs:read',
      'docs:write',
      'builds:read',
      'deployments:read',
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['developers', 'team-alpha'],
    metadata: {
      lastLogin: '2024-01-15T10:15:00Z',
      createdAt: '2024-01-03T14:00:00Z',
      active: true,
      mfaEnabled: false,
      profileComplete: true
    },
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: false,
      defaultDashboard: 'developer-workspace'
    },
    organization: {
      id: 'org-premium-001',
      name: 'Premium Tech',
      domain: 'premium-tech.com',
      tier: 'premium'
    }
  },
  {
    id: 'viewer-001',
    email: 'viewer@example.com',
    name: 'Business Analyst',
    roles: ['viewer'],
    permissions: [
      'plugins:read',
      'marketplace:browse',
      'catalog:read',
      'docs:read',
      'builds:read',
      'deployments:read',
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['viewers', 'business-team'],
    metadata: {
      lastLogin: '2024-01-14T16:45:00Z',
      createdAt: '2024-01-05T09:00:00Z',
      active: true,
      mfaEnabled: false,
      profileComplete: false
    },
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: true,
      defaultDashboard: 'overview'
    },
    organization: {
      id: 'org-free-001',
      name: 'Startup Inc',
      domain: 'startup.com',
      tier: 'free'
    }
  },
  {
    id: 'basic-user-001',
    email: 'user@example.com',
    name: 'Basic User',
    roles: ['user'],
    permissions: [
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['users'],
    metadata: {
      lastLogin: '2024-01-10T12:00:00Z',
      createdAt: '2024-01-10T11:00:00Z',
      active: true,
      mfaEnabled: false,
      profileComplete: false
    },
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: false,
      defaultDashboard: 'welcome'
    },
    organization: {
      id: 'org-free-002',
      name: 'Small Business',
      domain: 'smallbiz.com',
      tier: 'free'
    }
  }
];

// Inactive/Test users for edge cases
export const INACTIVE_TEST_USERS: UserFixture[] = [
  {
    id: 'inactive-user-001',
    email: 'inactive@example.com',
    name: 'Inactive User',
    roles: ['user'],
    permissions: [
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['users'],
    metadata: {
      lastLogin: '2023-12-01T10:00:00Z',
      createdAt: '2023-11-01T10:00:00Z',
      active: false,
      mfaEnabled: false,
      profileComplete: true
    },
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: false,
      defaultDashboard: 'welcome'
    },
    organization: {
      id: 'org-free-003',
      name: 'Dormant Company',
      domain: 'dormant.com',
      tier: 'free'
    }
  },
  {
    id: 'malicious-user-001',
    email: 'malicious@example.com',
    name: 'Test Malicious User',
    roles: ['user'],
    permissions: [
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['users', 'test-group'],
    metadata: {
      lastLogin: '2024-01-15T11:00:00Z',
      createdAt: '2024-01-14T10:00:00Z',
      active: true,
      mfaEnabled: false,
      profileComplete: true
    },
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: true,
      defaultDashboard: 'welcome'
    },
    organization: {
      id: 'org-test-001',
      name: 'Test Organization',
      domain: 'test.com',
      tier: 'free'
    }
  }
];

// User groups for testing
export const USER_GROUPS = {
  administrators: {
    id: 'administrators',
    name: 'Administrators',
    description: 'System administrators',
    members: ['admin-user-001']
  },
  'plugin-admins': {
    id: 'plugin-admins',
    name: 'Plugin Administrators',
    description: 'Plugin management team',
    members: ['plugin-admin-001']
  },
  developers: {
    id: 'developers',
    name: 'Developers',
    description: 'Development team members',
    members: ['developer-001']
  },
  viewers: {
    id: 'viewers',
    name: 'Viewers',
    description: 'Read-only users',
    members: ['viewer-001']
  },
  users: {
    id: 'users',
    name: 'Basic Users',
    description: 'All basic users',
    members: ['basic-user-001', 'inactive-user-001', 'malicious-user-001']
  }
};

// Organizations for testing
export const TEST_ORGANIZATIONS = [
  {
    id: 'org-enterprise-001',
    name: 'Enterprise Corp',
    domain: 'enterprise.com',
    tier: 'enterprise',
    limits: {
      plugins: 100,
      users: 1000,
      storage: '1TB'
    },
    features: ['sso', 'audit-logs', 'advanced-rbac', 'priority-support']
  },
  {
    id: 'org-premium-001',
    name: 'Premium Tech',
    domain: 'premium-tech.com',
    tier: 'premium',
    limits: {
      plugins: 50,
      users: 100,
      storage: '100GB'
    },
    features: ['sso', 'audit-logs']
  },
  {
    id: 'org-free-001',
    name: 'Startup Inc',
    domain: 'startup.com',
    tier: 'free',
    limits: {
      plugins: 10,
      users: 10,
      storage: '1GB'
    },
    features: []
  }
];

// Helper functions
export function getUserByRole(role: string): UserFixture[] {
  return TEST_USERS.filter(user => user.roles.includes(role));
}

export function getUsersByPermission(permission: string): UserFixture[] {
  return TEST_USERS.filter(user => 
    user.permissions.includes(permission) || user.permissions.includes('*')
  );
}

export function createTestUser(overrides?: Partial<UserFixture>): UserFixture {
  const id = `test-user-${Math.random().toString(36).substring(7)}`;
  return {
    id,
    email: `${id}@test.com`,
    name: `Test User ${id}`,
    roles: ['user'],
    permissions: [
      'profile:read',
      'profile:write',
      'preferences:read',
      'preferences:write'
    ],
    groups: ['users'],
    metadata: {
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      active: true,
      mfaEnabled: false,
      profileComplete: Math.random() > 0.5
    },
    preferences: {
      theme: Math.random() > 0.5 ? 'light' : 'dark',
      language: 'en',
      notifications: Math.random() > 0.5,
      defaultDashboard: 'welcome'
    },
    organization: {
      id: 'org-test-001',
      name: 'Test Organization',
      domain: 'test.com',
      tier: 'free'
    },
    ...overrides
  };
}

// Combined exports
export const ALL_USERS = [...TEST_USERS, ...INACTIVE_TEST_USERS];
export const ALL_ROLES = SYSTEM_ROLES;
export const ALL_PERMISSIONS = PERMISSIONS;