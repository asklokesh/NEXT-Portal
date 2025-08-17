/**
 * User Permission Setup API
 * Handles role creation, permission assignment, and access control configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights } from '@/lib/permissions/SystemPermissions';
import { createAuditLog } from '@/lib/audit/AuditService';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  scope: 'GLOBAL' | 'TENANT' | 'RESOURCE';
  level: 'READ' | 'WRITE' | 'ADMIN' | 'OWNER';
  dangerous?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  type: 'SYSTEM' | 'CUSTOM';
  permissions: string[];
  inheritsFrom?: string;
  isEditable: boolean;
  userCount?: number;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  members: string[];
  roles: string[];
  autoAssignment?: {
    enabled: boolean;
    criteria: Record<string, any>;
  };
}

interface PermissionPolicy {
  id: string;
  name: string;
  description: string;
  type: 'ALLOW' | 'DENY';
  conditions: PolicyCondition[];
  resources: string[];
  actions: string[];
  priority: number;
}

interface PolicyCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'REGEX';
  value: string;
}

interface PermissionSetup {
  organizationSettings: {
    defaultRole: string;
    autoApproval: boolean;
    inviteExpiry: number;
    multiFactorRequired: boolean;
    passwordPolicy: {
      minLength: number;
      requireSpecialChars: boolean;
      requireNumbers: boolean;
      requireUppercase: boolean;
    };
  };
  roles: Role[];
  groups: UserGroup[];
  policies: PermissionPolicy[];
  integrations: {
    ldap?: { enabled: boolean; syncRoles: boolean };
    saml?: { enabled: boolean; roleMapping: Record<string, string> };
    oauth?: { enabled: boolean; autoCreateUsers: boolean };
  };
}

/**
 * GET - Retrieve permission configuration and available permissions
 */
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for permission management'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const response: any = {};

    if (type === 'all' || type === 'permissions') {
      response.availablePermissions = getAvailablePermissions();
    }

    if (type === 'all' || type === 'roles') {
      response.currentRoles = await getCurrentRoles(tenantContext.tenant.id);
    }

    if (type === 'all' || type === 'groups') {
      response.currentGroups = await getCurrentGroups(tenantContext.tenant.id);
    }

    if (type === 'all' || type === 'settings') {
      response.organizationSettings = await getOrganizationSettings(tenantContext.tenant.id);
    }

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Permission configuration retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve permission configuration'
    }, { status: 500 });
  }
}

/**
 * POST - Save permission setup configuration
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for permission management'
      }, { status: 403 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, enum: ['save_setup', 'update_role', 'create_group'] },
      data: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data } = validation.sanitized;

    switch (operation) {
      case 'save_setup':
        return await savePermissionSetup(tenantContext.tenant.id, data);
      
      case 'update_role':
        return await updateRole(tenantContext.tenant.id, data);
      
      case 'create_group':
        return await createGroup(tenantContext.tenant.id, data);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Permission setup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process permission setup'
    }, { status: 500 });
  }
}

/**
 * Save complete permission setup
 */
async function savePermissionSetup(tenantId: string, setup: PermissionSetup) {
  try {
    // Validate the setup
    const validation = validatePermissionSetup(setup);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid permission setup',
        details: validation.errors
      }, { status: 400 });
    }

    // Save organization settings
    await saveOrganizationSettings(tenantId, setup.organizationSettings);

    // Save custom roles
    const customRoles = setup.roles.filter(role => role.type === 'CUSTOM');
    for (const role of customRoles) {
      await saveRole(tenantId, role);
    }

    // Save user groups
    for (const group of setup.groups) {
      await saveGroup(tenantId, group);
    }

    // Save permission policies
    for (const policy of setup.policies) {
      await savePolicy(tenantId, policy);
    }

    // Save integration settings
    await saveIntegrationSettings(tenantId, setup.integrations);

    // Create audit log
    await createAuditLog({
      tenantId,
      action: 'permissions:setup_complete',
      resource: 'permission_system',
      resourceId: `setup-${Date.now()}`,
      metadata: {
        rolesCount: setup.roles.length,
        groupsCount: setup.groups.length,
        policiesCount: setup.policies.length,
        customRolesCount: customRoles.length,
        integrationsEnabled: Object.keys(setup.integrations).filter(
          key => setup.integrations[key as keyof typeof setup.integrations]?.enabled
        )
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Permission setup completed successfully',
        summary: {
          rolesConfigured: setup.roles.length,
          groupsCreated: setup.groups.length,
          policiesCreated: setup.policies.length,
          integrationsEnabled: Object.values(setup.integrations).filter(config => config?.enabled).length
        },
        nextSteps: [
          'Invite users to your organization',
          'Assign roles to users and groups',
          'Configure external authentication if enabled',
          'Test permission assignments',
          'Review and adjust as needed'
        ]
      }
    });

  } catch (error) {
    console.error('Failed to save permission setup:', error);
    throw error;
  }
}

/**
 * Get available system permissions
 */
function getAvailablePermissions(): Permission[] {
  return [
    // Catalog permissions
    { id: 'catalog:read', name: 'View Catalog', description: 'View software catalog entities', category: 'Catalog', scope: 'TENANT', level: 'READ' },
    { id: 'catalog:write', name: 'Edit Catalog', description: 'Create and edit catalog entities', category: 'Catalog', scope: 'TENANT', level: 'WRITE' },
    { id: 'catalog:delete', name: 'Delete Catalog Items', description: 'Delete catalog entities', category: 'Catalog', scope: 'TENANT', level: 'ADMIN', dangerous: true },
    
    // User management permissions
    { id: 'users:read', name: 'View Users', description: 'View user profiles and information', category: 'Users', scope: 'TENANT', level: 'READ' },
    { id: 'users:invite', name: 'Invite Users', description: 'Send user invitations', category: 'Users', scope: 'TENANT', level: 'WRITE' },
    { id: 'users:admin', name: 'Manage Users', description: 'Full user management capabilities', category: 'Users', scope: 'TENANT', level: 'ADMIN', dangerous: true },
    
    // Plugin permissions
    { id: 'plugins:read', name: 'View Plugins', description: 'View installed plugins and marketplace', category: 'Plugins', scope: 'TENANT', level: 'READ' },
    { id: 'plugins:install', name: 'Install Plugins', description: 'Install and configure plugins', category: 'Plugins', scope: 'TENANT', level: 'WRITE' },
    { id: 'plugins:admin', name: 'Manage Plugins', description: 'Full plugin management including uninstall', category: 'Plugins', scope: 'TENANT', level: 'ADMIN' },
    
    // Settings permissions
    { id: 'settings:read', name: 'View Settings', description: 'View organization settings', category: 'Settings', scope: 'TENANT', level: 'READ' },
    { id: 'settings:write', name: 'Edit Settings', description: 'Modify organization settings', category: 'Settings', scope: 'TENANT', level: 'WRITE' },
    { id: 'settings:admin', name: 'Admin Settings', description: 'Manage security and billing settings', category: 'Settings', scope: 'TENANT', level: 'ADMIN', dangerous: true },
    
    // System permissions
    { id: 'system:read', name: 'System View', description: 'View system information and logs', category: 'System', scope: 'GLOBAL', level: 'READ' },
    { id: 'system:admin', name: 'System Admin', description: 'Full system administration', category: 'System', scope: 'GLOBAL', level: 'OWNER', dangerous: true },
    
    // API permissions
    { id: 'api:read', name: 'API Read', description: 'Read access to APIs', category: 'API', scope: 'TENANT', level: 'READ' },
    { id: 'api:write', name: 'API Write', description: 'Write access to APIs', category: 'API', scope: 'TENANT', level: 'WRITE' },
    
    // Documentation permissions
    { id: 'docs:read', name: 'Read Documentation', description: 'View documentation', category: 'Documentation', scope: 'TENANT', level: 'READ' },
    { id: 'docs:write', name: 'Edit Documentation', description: 'Create and edit documentation', category: 'Documentation', scope: 'TENANT', level: 'WRITE' }
  ];
}

/**
 * Get current roles for tenant
 */
async function getCurrentRoles(tenantId: string): Promise<Role[]> {
  // Mock implementation - in real scenario, fetch from database
  return [
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to most resources',
      type: 'SYSTEM',
      permissions: ['catalog:read', 'docs:read', 'api:read'],
      isEditable: false,
      userCount: 5
    },
    {
      id: 'developer',
      name: 'Developer',
      description: 'Standard developer access with write permissions',
      type: 'SYSTEM',
      permissions: ['catalog:read', 'catalog:write', 'docs:read', 'docs:write', 'plugins:read', 'api:read', 'api:write'],
      isEditable: false,
      userCount: 12
    },
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full administrative access',
      type: 'SYSTEM',
      permissions: ['catalog:read', 'catalog:write', 'catalog:delete', 'users:read', 'users:invite', 'users:admin', 'plugins:read', 'plugins:install', 'plugins:admin', 'settings:read', 'settings:write', 'settings:admin', 'api:read', 'api:write', 'docs:read', 'docs:write'],
      isEditable: false,
      userCount: 3
    }
  ];
}

/**
 * Get current groups for tenant
 */
async function getCurrentGroups(tenantId: string): Promise<UserGroup[]> {
  // Mock implementation - in real scenario, fetch from database
  return [];
}

/**
 * Get organization settings
 */
async function getOrganizationSettings(tenantId: string) {
  // Mock implementation - in real scenario, fetch from database
  return {
    defaultRole: 'developer',
    autoApproval: false,
    inviteExpiry: 7,
    multiFactorRequired: false,
    passwordPolicy: {
      minLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      requireUppercase: true
    }
  };
}

/**
 * Validate permission setup
 */
function validatePermissionSetup(setup: PermissionSetup): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate organization settings
  if (!setup.organizationSettings?.defaultRole) {
    errors.push('Default role is required');
  }

  if (setup.organizationSettings?.inviteExpiry && (setup.organizationSettings.inviteExpiry < 1 || setup.organizationSettings.inviteExpiry > 30)) {
    errors.push('Invite expiry must be between 1 and 30 days');
  }

  // Validate roles
  const roleIds = setup.roles.map(r => r.id);
  if (setup.organizationSettings?.defaultRole && !roleIds.includes(setup.organizationSettings.defaultRole)) {
    errors.push('Default role must exist in the roles list');
  }

  // Validate custom roles
  for (const role of setup.roles.filter(r => r.type === 'CUSTOM')) {
    if (!role.name || role.name.trim().length === 0) {
      errors.push(`Role ID ${role.id} must have a name`);
    }
    if (!role.permissions || role.permissions.length === 0) {
      errors.push(`Role ${role.name} must have at least one permission`);
    }
  }

  // Validate groups
  for (const group of setup.groups) {
    if (!group.name || group.name.trim().length === 0) {
      errors.push(`Group ID ${group.id} must have a name`);
    }
    if (group.roles.some(roleId => !roleIds.includes(roleId))) {
      errors.push(`Group ${group.name} references non-existent roles`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Save organization settings
 */
async function saveOrganizationSettings(tenantId: string, settings: any) {
  // Mock implementation - in real scenario, save to database
  console.log('Saving organization settings for tenant:', tenantId, settings);
  
  // Create audit log
  await createAuditLog({
    tenantId,
    action: 'permissions:org_settings_update',
    resource: 'organization_settings',
    resourceId: tenantId,
    metadata: settings
  });
}

/**
 * Save a role
 */
async function saveRole(tenantId: string, role: Role) {
  // Mock implementation - in real scenario, save to database
  console.log('Saving role for tenant:', tenantId, role);
  
  // Create audit log
  await createAuditLog({
    tenantId,
    action: 'permissions:role_create',
    resource: 'role',
    resourceId: role.id,
    metadata: {
      name: role.name,
      type: role.type,
      permissionsCount: role.permissions.length
    }
  });
}

/**
 * Save a user group
 */
async function saveGroup(tenantId: string, group: UserGroup) {
  // Mock implementation - in real scenario, save to database
  console.log('Saving group for tenant:', tenantId, group);
  
  // Create audit log
  await createAuditLog({
    tenantId,
    action: 'permissions:group_create',
    resource: 'user_group',
    resourceId: group.id,
    metadata: {
      name: group.name,
      rolesCount: group.roles.length,
      autoAssignment: group.autoAssignment?.enabled || false
    }
  });
}

/**
 * Save a permission policy
 */
async function savePolicy(tenantId: string, policy: PermissionPolicy) {
  // Mock implementation - in real scenario, save to database
  console.log('Saving policy for tenant:', tenantId, policy);
  
  // Create audit log
  await createAuditLog({
    tenantId,
    action: 'permissions:policy_create',
    resource: 'permission_policy',
    resourceId: policy.id,
    metadata: {
      name: policy.name,
      type: policy.type,
      priority: policy.priority
    }
  });
}

/**
 * Save integration settings
 */
async function saveIntegrationSettings(tenantId: string, integrations: any) {
  // Mock implementation - in real scenario, save to database
  console.log('Saving integration settings for tenant:', tenantId, integrations);
  
  // Create audit log
  await createAuditLog({
    tenantId,
    action: 'permissions:integrations_update',
    resource: 'auth_integrations',
    resourceId: tenantId,
    metadata: {
      ldapEnabled: integrations.ldap?.enabled || false,
      samlEnabled: integrations.saml?.enabled || false,
      oauthEnabled: integrations.oauth?.enabled || false
    }
  });
}

/**
 * Update an existing role
 */
async function updateRole(tenantId: string, roleData: any) {
  try {
    // Validate role data
    const validation = validateRequestBody(roleData, {
      id: { type: 'text', required: true },
      name: { type: 'text', required: true },
      description: { type: 'text', required: false },
      permissions: { type: 'array', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role data',
        details: validation.errors
      }, { status: 400 });
    }

    await saveRole(tenantId, validation.sanitized);

    return NextResponse.json({
      success: true,
      data: { message: 'Role updated successfully' }
    });

  } catch (error) {
    console.error('Failed to update role:', error);
    throw error;
  }
}

/**
 * Create a new user group
 */
async function createGroup(tenantId: string, groupData: any) {
  try {
    // Validate group data
    const validation = validateRequestBody(groupData, {
      name: { type: 'text', required: true },
      description: { type: 'text', required: false },
      roles: { type: 'array', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid group data',
        details: validation.errors
      }, { status: 400 });
    }

    const group: UserGroup = {
      id: `group-${Date.now()}`,
      ...validation.sanitized,
      members: []
    };

    await saveGroup(tenantId, group);

    return NextResponse.json({
      success: true,
      data: { group, message: 'Group created successfully' }
    });

  } catch (error) {
    console.error('Failed to create group:', error);
    throw error;
  }
}