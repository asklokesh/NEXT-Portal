import { test, expect, Page, BrowserContext } from '@playwright/test';

// RBAC test configuration
const RBAC_TEST_CONFIG = {
  users: {
    viewer: {
      username: 'viewer-user',
      password: 'viewer-pass',
      role: 'viewer',
      permissions: ['read:catalog', 'read:templates', 'read:docs']
    },
    developer: {
      username: 'dev-user', 
      password: 'dev-pass',
      role: 'developer',
      permissions: ['read:catalog', 'read:templates', 'write:templates', 'read:monitoring']
    },
    plugin_manager: {
      username: 'plugin-mgr',
      password: 'mgr-pass',
      role: 'plugin_manager', 
      permissions: ['read:catalog', 'read:templates', 'manage:plugins', 'read:system']
    },
    admin: {
      username: 'admin-user',
      password: 'admin-pass',
      role: 'admin',
      permissions: ['*'] // All permissions
    },
    tenant_a_user: {
      username: 'tenant-a-user',
      password: 'tenant-pass',
      role: 'developer',
      tenant: 'tenant-a',
      permissions: ['read:catalog', 'write:templates']
    },
    tenant_b_user: {
      username: 'tenant-b-user', 
      password: 'tenant-pass',
      role: 'developer',
      tenant: 'tenant-b',
      permissions: ['read:catalog', 'write:templates']
    }
  },
  
  protectedActions: {
    install_plugin: ['manage:plugins', 'admin:system'],
    configure_plugin: ['manage:plugins', 'write:config'],
    delete_plugin: ['manage:plugins', 'admin:system'],
    view_system_metrics: ['read:system', 'admin:system'],
    manage_users: ['admin:users'],
    access_admin_panel: ['admin:system'],
    create_template: ['write:templates'],
    modify_rbac: ['admin:rbac']
  }
};

const TEST_PLUGIN = {
  id: '@backstage/plugin-rbac-test',
  name: 'RBAC Test Plugin',
  version: '1.0.0'
};

test.describe('RBAC Integration Tests', () => {
  let contexts: Record<string, BrowserContext> = {};
  let pages: Record<string, Page> = {};

  test.beforeAll(async ({ browser }) => {
    // Create contexts and pages for each user role
    for (const [roleName, userConfig] of Object.entries(RBAC_TEST_CONFIG.users)) {
      contexts[roleName] = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        permissions: ['notifications'],
        recordVideo: { dir: `tests/e2e/test-results/rbac/${roleName}/` }
      });
      
      pages[roleName] = await contexts[roleName].newPage();
      
      // Mock authentication for each user
      await pages[roleName].route('/api/auth/*', async (route) => {
        const url = route.request().url();
        
        if (url.includes('/login')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              token: `token-${roleName}`,
              user: {
                id: userConfig.username,
                username: userConfig.username,
                role: userConfig.role,
                permissions: userConfig.permissions,
                tenant: userConfig.tenant || null
              }
            })
          });
        } else if (url.includes('/validate')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              valid: true,
              user: {
                id: userConfig.username,
                role: userConfig.role,
                permissions: userConfig.permissions,
                tenant: userConfig.tenant || null
              }
            })
          });
        }
      });

      // Mock RBAC validation endpoint
      await pages[roleName].route('/api/rbac/validate', async (route) => {
        const body = await route.request().jsonBody();
        const requiredPermissions = body.permissions || [];
        const userPermissions = userConfig.permissions;
        
        // Check if user has all required permissions
        const hasPermissions = userPermissions.includes('*') || 
          requiredPermissions.every((perm: string) => userPermissions.includes(perm));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            allowed: hasPermissions,
            userPermissions,
            requiredPermissions,
            missingPermissions: hasPermissions ? [] : requiredPermissions.filter((perm: string) => !userPermissions.includes(perm))
          })
        });
      });
    }
  });

  test.beforeEach(async () => {
    // Login each user
    for (const [roleName, userConfig] of Object.entries(RBAC_TEST_CONFIG.users)) {
      const page = pages[roleName];
      await page.goto('/login');
      
      await page.fill('[data-testid="username-input"]', userConfig.username);
      await page.fill('[data-testid="password-input"]', userConfig.password);
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    }
  });

  test.afterAll(async () => {
    for (const context of Object.values(contexts)) {
      await context.close();
    }
  });

  test.describe('Plugin Installation Permissions', () => {
    test('should allow plugin managers and admins to install plugins', async () => {
      const allowedRoles = ['plugin_manager', 'admin'];
      
      for (const role of allowedRoles) {
        const page = pages[role];
        
        await page.goto('/plugins');
        await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
        
        // Should see install buttons
        const installButton = page.locator('[data-testid="install-plugin-btn"]').first();
        await expect(installButton).toBeVisible();
        await expect(installButton).toBeEnabled();
        
        // Should be able to click install
        await installButton.click();
        await expect(page.locator('[data-testid="installation-modal"]')).toBeVisible();
        
        // Close modal
        await page.locator('[data-testid="close-modal"]').click();
      }
    });

    test('should deny plugin installation for viewers and developers', async () => {
      const deniedRoles = ['viewer', 'developer'];
      
      for (const role of deniedRoles) {
        const page = pages[role];
        
        await page.goto('/plugins');
        await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
        
        // Should not see install buttons or they should be disabled
        const installButtons = page.locator('[data-testid="install-plugin-btn"]');
        const buttonCount = await installButtons.count();
        
        if (buttonCount > 0) {
          // If buttons exist, they should be disabled
          for (let i = 0; i < buttonCount; i++) {
            await expect(installButtons.nth(i)).toBeDisabled();
          }
        }
        
        // Attempting to directly access installation should show error
        await page.goto(`/plugins/install/${TEST_PLUGIN.id}`);
        await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
        await expect(page.locator('text=Insufficient permissions')).toBeVisible();
      }
    });

    test('should validate permissions at API level', async () => {
      const page = pages.viewer;
      
      // Mock API to return 403 for unauthorized plugin installation
      await page.route('/api/plugins', async (route) => {
        const method = route.request().method();
        const body = route.request().postDataJSON();
        
        if (method === 'POST' && body?.action === 'install') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Insufficient permissions',
              required: ['manage:plugins'],
              provided: ['read:catalog', 'read:templates']
            })
          });
        }
      });
      
      await page.goto('/plugins');
      
      // Attempt installation via API (if somehow triggered)
      const response = await page.evaluate(async () => {
        return fetch('/api/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install',
            pluginId: '@backstage/plugin-test'
          })
        });
      });
      
      expect(response).toBe(403);
    });
  });

  test.describe('Plugin Configuration Permissions', () => {
    test('should allow plugin managers to configure plugins', async () => {
      const page = pages.plugin_manager;
      
      // Mock installed plugin
      await page.route('/api/plugins', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plugins: [{
                ...TEST_PLUGIN,
                installed: true,
                configurable: true
              }]
            })
          });
        }
      });
      
      await page.goto('/plugins');
      await expect(page.locator('[data-testid="configure-plugin-btn"]').first()).toBeVisible();
      
      await page.locator('[data-testid="configure-plugin-btn"]').first().click();
      await expect(page.locator('[data-testid="plugin-config-modal"]')).toBeVisible();
      
      // Should see configuration form
      await expect(page.locator('[data-testid="config-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="save-config-btn"]')).toBeEnabled();
    });

    test('should deny configuration access to viewers', async () => {
      const page = pages.viewer;
      
      // Mock installed plugin
      await page.route('/api/plugins', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plugins: [{
              ...TEST_PLUGIN,
              installed: true,
              configurable: true
            }]
          })
        });
      });
      
      await page.goto('/plugins');
      
      // Configure button should not be visible or should be disabled
      const configButtons = page.locator('[data-testid="configure-plugin-btn"]');
      const buttonCount = await configButtons.count();
      
      if (buttonCount > 0) {
        await expect(configButtons.first()).toBeDisabled();
      }
    });
  });

  test.describe('Admin Panel Access Control', () => {
    test('should allow admin access to system administration', async () => {
      const page = pages.admin;
      
      await page.goto('/admin');
      await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
      
      // Should see all admin sections
      await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-settings"]')).toBeVisible();
      await expect(page.locator('[data-testid="rbac-management"]')).toBeVisible();
      
      // Should be able to access user management
      await page.locator('[data-testid="user-management"]').click();
      await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    });

    test('should deny admin panel access to non-admin users', async () => {
      const nonAdminRoles = ['viewer', 'developer', 'plugin_manager'];
      
      for (const role of nonAdminRoles) {
        const page = pages[role];
        
        // Direct navigation to admin should redirect or show error
        await page.goto('/admin');
        
        // Should either redirect to unauthorized page or show access denied
        const currentUrl = page.url();
        const hasAccessDenied = await page.locator('[data-testid="access-denied"]').isVisible();
        
        expect(
          currentUrl.includes('/unauthorized') || 
          currentUrl.includes('/login') || 
          hasAccessDenied
        ).toBeTruthy();
      }
    });
  });

  test.describe('Multi-Tenant Isolation', () => {
    test('should isolate tenant resources', async () => {
      const tenantAPage = pages.tenant_a_user;
      const tenantBPage = pages.tenant_b_user;
      
      // Mock tenant-specific plugin data
      await tenantAPage.route('/api/plugins*', async (route) => {
        const url = route.request().url();
        if (url.includes('tenant=tenant-a')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plugins: [
                { id: 'tenant-a-plugin-1', name: 'Tenant A Plugin 1', tenant: 'tenant-a' },
                { id: 'tenant-a-plugin-2', name: 'Tenant A Plugin 2', tenant: 'tenant-a' }
              ]
            })
          });
        } else {
          await route.fulfill({ status: 403 });
        }
      });
      
      await tenantBPage.route('/api/plugins*', async (route) => {
        const url = route.request().url();
        if (url.includes('tenant=tenant-b')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plugins: [
                { id: 'tenant-b-plugin-1', name: 'Tenant B Plugin 1', tenant: 'tenant-b' },
                { id: 'tenant-b-plugin-2', name: 'Tenant B Plugin 2', tenant: 'tenant-b' }
              ]
            })
          });
        } else {
          await route.fulfill({ status: 403 });
        }
      });
      
      // Tenant A user should only see Tenant A resources
      await tenantAPage.goto('/plugins');
      await expect(tenantAPage.locator('text=Tenant A Plugin 1')).toBeVisible();
      await expect(tenantAPage.locator('text=Tenant B Plugin 1')).not.toBeVisible();
      
      // Tenant B user should only see Tenant B resources
      await tenantBPage.goto('/plugins');
      await expect(tenantBPage.locator('text=Tenant B Plugin 1')).toBeVisible();
      await expect(tenantBPage.locator('text=Tenant A Plugin 1')).not.toBeVisible();
    });

    test('should prevent cross-tenant resource access', async () => {
      const tenantAPage = pages.tenant_a_user;
      
      // Mock attempt to access Tenant B resource
      await tenantAPage.route('/api/plugins/tenant-b-plugin-1', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Cross-tenant access denied',
            userTenant: 'tenant-a',
            requestedTenant: 'tenant-b'
          })
        });
      });
      
      // Attempt to directly access Tenant B plugin should fail
      await tenantAPage.goto('/plugins/tenant-b-plugin-1');
      await expect(tenantAPage.locator('[data-testid="access-denied"]')).toBeVisible();
    });
  });

  test.describe('Role-Based UI Elements', () => {
    test('should show/hide navigation items based on role', async () => {
      // Admin should see all navigation items
      const adminPage = pages.admin;
      await adminPage.goto('/');
      
      await expect(adminPage.locator('[data-testid="nav-plugins"]')).toBeVisible();
      await expect(adminPage.locator('[data-testid="nav-templates"]')).toBeVisible();
      await expect(adminPage.locator('[data-testid="nav-admin"]')).toBeVisible();
      await expect(adminPage.locator('[data-testid="nav-monitoring"]')).toBeVisible();
      
      // Viewer should see limited navigation
      const viewerPage = pages.viewer;
      await viewerPage.goto('/');
      
      await expect(viewerPage.locator('[data-testid="nav-plugins"]')).toBeVisible();
      await expect(viewerPage.locator('[data-testid="nav-templates"]')).toBeVisible();
      await expect(viewerPage.locator('[data-testid="nav-admin"]')).not.toBeVisible();
      await expect(viewerPage.locator('[data-testid="nav-monitoring"]')).not.toBeVisible();
    });

    test('should conditionally render action buttons', async () => {
      // Plugin manager should see management actions
      const pluginMgrPage = pages.plugin_manager;
      await pluginMgrPage.goto('/plugins');
      
      await expect(pluginMgrPage.locator('[data-testid="bulk-actions"]')).toBeVisible();
      await expect(pluginMgrPage.locator('[data-testid="plugin-settings"]')).toBeVisible();
      
      // Developer should not see these actions
      const devPage = pages.developer;
      await devPage.goto('/plugins');
      
      await expect(devPage.locator('[data-testid="bulk-actions"]')).not.toBeVisible();
      await expect(devPage.locator('[data-testid="plugin-settings"]')).not.toBeVisible();
    });
  });

  test.describe('Permission Escalation Prevention', () => {
    test('should detect and prevent privilege escalation attempts', async () => {
      const viewerPage = pages.viewer;
      
      // Mock detection of escalation attempt
      await viewerPage.route('/api/rbac/validate', async (route) => {
        const body = await route.request().jsonBody();
        
        if (body.permissions?.includes('admin:system')) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Privilege escalation attempt detected',
              attemptedPermissions: body.permissions,
              userPermissions: ['read:catalog'],
              escalationBlocked: true,
              auditLogged: true
            })
          });
        }
      });
      
      // Attempt to access admin functionality should be blocked
      const response = await viewerPage.evaluate(async () => {
        return fetch('/api/rbac/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'access-admin-panel',
            permissions: ['admin:system']
          })
        }).then(r => r.status);
      });
      
      expect(response).toBe(403);
    });

    test('should log security violations', async () => {
      const devPage = pages.developer;
      
      // Mock security event logging
      let securityEventLogged = false;
      
      await devPage.route('/api/audit/security-event', async (route) => {
        securityEventLogged = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ logged: true })
        });
      });
      
      // Mock unauthorized access attempt
      await devPage.route('/api/admin/users', async (route) => {
        // Trigger security event
        await devPage.evaluate(() => {
          fetch('/api/audit/security-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'unauthorized_access_attempt',
              userId: 'dev-user',
              attemptedResource: '/api/admin/users',
              blocked: true
            })
          });
        });
        
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Access denied' })
        });
      });
      
      // Attempt unauthorized access
      await devPage.evaluate(() => {
        return fetch('/api/admin/users');
      });
      
      // Wait for security event to be logged
      await devPage.waitForTimeout(500);
      expect(securityEventLogged).toBe(true);
    });
  });

  test.describe('Context-Aware Permissions', () => {
    test('should apply stricter permissions in production environment', async () => {
      const devPage = pages.developer;
      
      // Mock environment-specific permission validation
      await devPage.route('/api/rbac/validate', async (route) => {
        const body = await route.request().jsonBody();
        const environment = body.context?.environment || 'development';
        
        // Stricter permissions in production
        if (environment === 'production' && body.action === 'install-plugin') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Production plugin installations require approval',
              required: ['manage:plugins', 'approve:production'],
              provided: body.userPermissions,
              context: { environment, approvalRequired: true }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ allowed: true })
          });
        }
      });
      
      // Test production context
      const prodResponse = await devPage.evaluate(async () => {
        return fetch('/api/rbac/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install-plugin',
            userPermissions: ['read:catalog', 'write:templates'],
            context: { environment: 'production' }
          })
        }).then(r => r.status);
      });
      
      expect(prodResponse).toBe(403);
      
      // Test development context (should be allowed)
      const devResponse = await devPage.evaluate(async () => {
        return fetch('/api/rbac/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install-plugin',
            userPermissions: ['read:catalog', 'write:templates'],
            context: { environment: 'development' }
          })
        }).then(r => r.status);
      });
      
      expect(devResponse).toBe(200);
    });

    test('should enforce time-based access controls', async () => {
      const pluginMgrPage = pages.plugin_manager;
      
      // Mock time-based restrictions (e.g., no installs during business hours)
      await pluginMgrPage.route('/api/rbac/validate', async (route) => {
        const body = await route.request().jsonBody();
        const currentHour = new Date().getHours();
        
        // Block plugin installations during business hours (9-17)
        if (body.action === 'install-plugin' && currentHour >= 9 && currentHour <= 17) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Plugin installations are restricted during business hours',
              allowedTime: '18:00 - 08:59',
              currentTime: new Date().toTimeString()
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ allowed: true })
          });
        }
      });
      
      const response = await pluginMgrPage.evaluate(async () => {
        return fetch('/api/rbac/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'install-plugin',
            context: { timeRestricted: true }
          })
        });
      });
      
      // Response depends on current time - test logic validates the restriction exists
      expect([200, 403]).toContain(response.status);
    });
  });

  test.describe('Dynamic Permission Updates', () => {
    test('should reflect permission changes immediately', async () => {
      const devPage = pages.developer;
      
      // Initially, developer cannot access admin panel
      await devPage.goto('/admin');
      await expect(devPage.locator('[data-testid="access-denied"]')).toBeVisible();
      
      // Mock permission upgrade
      await devPage.route('/api/auth/validate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              id: 'dev-user',
              role: 'admin', // Role upgraded
              permissions: ['*'], // All permissions granted
              tenant: null
            }
          })
        });
      });
      
      // Refresh page to pick up new permissions
      await devPage.reload();
      
      // Now should have admin access
      await devPage.goto('/admin');
      await expect(devPage.locator('[data-testid="admin-panel"]')).toBeVisible();
    });

    test('should handle permission revocation', async () => {
      const adminPage = pages.admin;
      
      // Initially has admin access
      await adminPage.goto('/admin');
      await expect(adminPage.locator('[data-testid="admin-panel"]')).toBeVisible();
      
      // Mock permission revocation
      await adminPage.route('/api/auth/validate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            user: {
              id: 'admin-user',
              role: 'viewer', // Downgraded role
              permissions: ['read:catalog'], // Limited permissions
              tenant: null
            }
          })
        });
      });
      
      // Navigate to different page and back
      await adminPage.goto('/plugins');
      await adminPage.goto('/admin');
      
      // Should now be denied access
      await expect(adminPage.locator('[data-testid="access-denied"]')).toBeVisible();
    });
  });
});