import { test, expect, Page, BrowserContext } from '@playwright/test';
import { setTimeout } from 'timers/promises';

// Test data and constants
const TEST_PLUGIN = {
  id: '@backstage/plugin-catalog',
  name: 'Service Catalog',
  version: '1.10.0',
  category: 'catalog'
};

const PERFORMANCE_THRESHOLDS = {
  MARKETPLACE_LOAD_TIME: 3000,
  PLUGIN_SEARCH_TIME: 1000,
  INSTALLATION_START_TIME: 2000,
  CONFIGURATION_SAVE_TIME: 1000
};

test.describe('Plugin Marketplace Workflow', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a persistent context for session management
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['notifications'],
      recordVideo: { dir: 'tests/e2e/test-results/videos/' },
      trace: 'retain-on-failure'
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock API responses for consistent testing
    await page.route('/api/plugins', async (route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: [
              {
                id: TEST_PLUGIN.id,
                title: TEST_PLUGIN.name,
                version: TEST_PLUGIN.version,
                category: TEST_PLUGIN.category,
                description: 'Manage and organize your software components',
                author: 'Backstage Community',
                tags: ['catalog', 'components', 'services'],
                installed: false,
                enabled: false,
                configurable: true,
                npm: 'https://www.npmjs.com/package/@backstage/plugin-catalog',
                downloads: 50000,
                stars: 1200
              }
            ]
          })
        });
      } else if (method === 'POST') {
        const body = await route.request().jsonBody();
        
        if (body.action === 'install') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Plugin installation started'
            })
          });
        }
      }
    });

    // Mock plugin installer API
    await page.route('/api/plugin-installer*', async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      
      if (method === 'GET') {
        const installId = url.searchParams.get('installId');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pluginId: TEST_PLUGIN.id,
            status: 'running',
            installId,
            serviceUrl: 'http://localhost:3000',
            healthCheckUrl: 'http://localhost:3000/health',
            logs: ['Starting installation...', 'Building plugin...', 'Deployment complete'],
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            resources: {
              cpu: '500m',
              memory: '1Gi',
              storage: '2Gi'
            }
          })
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            installId: 'test-install-' + Date.now()
          })
        });
      }
    });

    // Navigate to the plugin marketplace
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load plugin marketplace within performance threshold', async () => {
    const startTime = Date.now();
    
    // Wait for the marketplace to fully load
    await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
    await expect(page.locator('[data-testid="plugin-card"]').first()).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MARKETPLACE_LOAD_TIME);
  });

  test('should display marketplace header and statistics', async () => {
    // Check marketplace header
    await expect(page.locator('h1')).toContainText('Plugin Marketplace');
    await expect(page.locator('text=Browse and install Backstage plugins')).toBeVisible();

    // Check statistics
    await expect(page.locator('[data-testid="available-plugins-count"]')).toContainText('1');
    await expect(page.locator('[data-testid="installed-plugins-count"]')).toContainText('0');
    await expect(page.locator('[data-testid="enabled-plugins-count"]')).toContainText('0');
  });

  test('should filter plugins by category', async () => {
    // Click on catalog category
    await page.locator('[data-testid="category-catalog"]').click();
    
    // Verify filter is applied
    await expect(page.locator('[data-testid="filtered-plugins-count"]')).toContainText('1');
    
    // Click on "All Plugins" to reset filter
    await page.locator('[data-testid="category-all"]').click();
    await expect(page.locator('[data-testid="filtered-plugins-count"]')).toContainText('1');
  });

  test('should search plugins with performance requirements', async () => {
    const searchInput = page.locator('[data-testid="plugin-search"]');
    
    const startTime = Date.now();
    await searchInput.fill('catalog');
    await page.waitForTimeout(300); // Debounce delay
    
    const searchTime = Date.now() - startTime;
    expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PLUGIN_SEARCH_TIME);
    
    // Verify search results
    await expect(page.locator('[data-testid="plugin-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="plugin-card"]').first()).toContainText('Service Catalog');
  });

  test('should handle plugin search with no results', async () => {
    const searchInput = page.locator('[data-testid="plugin-search"]');
    
    await searchInput.fill('nonexistent-plugin');
    await page.waitForTimeout(300);
    
    // Verify empty state
    await expect(page.locator('[data-testid="no-plugins-found"]')).toBeVisible();
    await expect(page.locator('text=No plugins found')).toBeVisible();
  });

  test('should display plugin details modal', async () => {
    // Click on plugin details button
    await page.locator('[data-testid="plugin-details-btn"]').first().click();
    
    // Verify modal opens
    await expect(page.locator('[data-testid="plugin-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="plugin-title"]')).toContainText('Service Catalog');
    await expect(page.locator('[data-testid="plugin-version"]')).toContainText('1.10.0');
    await expect(page.locator('[data-testid="plugin-author"]')).toContainText('Backstage Community');
    
    // Close modal
    await page.locator('[data-testid="close-modal"]').click();
    await expect(page.locator('[data-testid="plugin-details-modal"]')).not.toBeVisible();
  });

  test('should complete plugin installation workflow', async () => {
    // Start installation
    const installButton = page.locator('[data-testid="install-plugin-btn"]').first();
    
    const startTime = Date.now();
    await installButton.click();
    
    // Wait for installation to start
    await expect(page.locator('[data-testid="installation-progress"]')).toBeVisible();
    
    const installStartTime = Date.now() - startTime;
    expect(installStartTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INSTALLATION_START_TIME);
    
    // Verify installation progress indicators
    await expect(page.locator('[data-testid="install-status"]')).toContainText('Installing');
    
    // Wait for installation completion (mocked)
    await page.waitForTimeout(2000);
    
    // Verify successful installation
    await expect(page.locator('[data-testid="install-success"]')).toBeVisible();
    await expect(page.locator('text=installed successfully')).toBeVisible();
  });

  test('should handle installation errors gracefully', async () => {
    // Mock installation failure
    await page.route('/api/plugins', async (route) => {
      const body = await route.request().jsonBody();
      
      if (body.action === 'install') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Installation failed: Network timeout'
          })
        });
      }
    });
    
    // Attempt installation
    await page.locator('[data-testid="install-plugin-btn"]').first().click();
    
    // Verify error handling
    await expect(page.locator('[data-testid="install-error"]')).toBeVisible();
    await expect(page.locator('text=Installation failed: Network timeout')).toBeVisible();
    
    // Verify retry button is available
    await expect(page.locator('[data-testid="retry-installation"]')).toBeVisible();
  });

  test('should manage plugin configuration', async () => {
    // First install the plugin (mock as already installed)
    await page.route('/api/plugins', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: [{
              ...TEST_PLUGIN,
              installed: true,
              enabled: false,
              configurable: true
            }]
          })
        });
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open configuration modal
    await page.locator('[data-testid="configure-plugin-btn"]').first().click();
    
    // Verify configuration modal
    await expect(page.locator('[data-testid="plugin-config-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="config-form"]')).toBeVisible();
    
    // Test configuration save performance
    const configSaveBtn = page.locator('[data-testid="save-config-btn"]');
    
    const startTime = Date.now();
    await configSaveBtn.click();
    
    await page.waitForTimeout(500); // Mock save delay
    const saveTime = Date.now() - startTime;
    expect(saveTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONFIGURATION_SAVE_TIME);
    
    // Verify success message
    await expect(page.locator('text=Plugin configured successfully')).toBeVisible();
  });

  test('should enable/disable installed plugins', async () => {
    // Mock installed plugin
    await page.route('/api/plugins', async (route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: [{
              ...TEST_PLUGIN,
              installed: true,
              enabled: false
            }]
          })
        });
      } else if (method === 'POST') {
        const body = await route.request().jsonBody();
        
        if (body.action === 'configure') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Plugin toggled successfully'
            })
          });
        }
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Enable plugin
    const enableButton = page.locator('[data-testid="enable-plugin-btn"]').first();
    await enableButton.click();
    
    // Verify success message
    await expect(page.locator('text=enabled')).toBeVisible();
  });

  test('should uninstall plugins with confirmation', async () => {
    // Mock installed plugin
    await page.route('/api/plugins', async (route) => {
      const method = route.request().method();
      
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: [{
              ...TEST_PLUGIN,
              installed: true,
              enabled: true
            }]
          })
        });
      } else if (method === 'POST') {
        const body = await route.request().jsonBody();
        
        if (body.action === 'uninstall') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Plugin uninstalled successfully'
            })
          });
        }
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open plugin menu and click uninstall
    await page.locator('[data-testid="plugin-menu"]').first().click();
    await page.locator('[data-testid="uninstall-plugin-btn"]').click();
    
    // Confirm uninstallation
    await expect(page.locator('[data-testid="uninstall-confirmation"]')).toBeVisible();
    await page.locator('[data-testid="confirm-uninstall"]').click();
    
    // Verify success message
    await expect(page.locator('text=Plugin uninstalled successfully')).toBeVisible();
  });

  test('should handle concurrent plugin operations', async () => {
    // Mock multiple plugins
    const multiplePlugins = Array.from({ length: 5 }, (_, i) => ({
      id: `@backstage/plugin-test-${i}`,
      title: `Test Plugin ${i}`,
      version: '1.0.0',
      category: 'testing',
      description: `Test plugin ${i} for concurrent operations`,
      author: 'Test Author',
      tags: ['test'],
      installed: false,
      enabled: false,
      configurable: true
    }));

    await page.route('/api/plugins', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: multiplePlugins
          })
        });
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Start multiple installations concurrently
    const installButtons = page.locator('[data-testid="install-plugin-btn"]');
    const buttonCount = await installButtons.count();
    
    // Click first 3 install buttons rapidly
    for (let i = 0; i < Math.min(3, buttonCount); i++) {
      await installButtons.nth(i).click();
      await page.waitForTimeout(100); // Small delay to simulate user behavior
    }

    // Verify that concurrent installations are handled properly
    const progressIndicators = page.locator('[data-testid="installation-progress"]');
    await expect(progressIndicators).toHaveCount(3);
  });

  test('should maintain state during page navigation', async () => {
    // Search for a plugin
    await page.locator('[data-testid="plugin-search"]').fill('catalog');
    await page.waitForTimeout(300);
    
    // Navigate to different category
    await page.locator('[data-testid="category-monitoring"]').click();
    
    // Navigate back to all plugins
    await page.locator('[data-testid="category-all"]').click();
    
    // Verify search is maintained
    const searchInput = page.locator('[data-testid="plugin-search"]');
    await expect(searchInput).toHaveValue('catalog');
  });

  test('should handle plugin marketplace error states', async () => {
    // Mock API error
    await page.route('/api/plugins', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    await page.reload();
    
    // Verify error state
    await expect(page.locator('[data-testid="marketplace-error"]')).toBeVisible();
    await expect(page.locator('text=Failed to load plugins')).toBeVisible();
    
    // Test retry functionality
    await expect(page.locator('[data-testid="retry-load-plugins"]')).toBeVisible();
  });

  test('should support keyboard navigation', async () => {
    // Focus on search input
    await page.locator('[data-testid="plugin-search"]').focus();
    
    // Tab to first plugin card
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Press Enter to open details
    await page.keyboard.press('Enter');
    
    // Verify modal opened with keyboard navigation
    await expect(page.locator('[data-testid="plugin-details-modal"]')).toBeVisible();
    
    // Close with Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="plugin-details-modal"]')).not.toBeVisible();
  });

  test('should be responsive on mobile viewport', async () => {
    // Change to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify mobile-specific elements
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    // Test category navigation on mobile
    await page.locator('[data-testid="mobile-menu-toggle"]').click();
    await expect(page.locator('[data-testid="mobile-category-menu"]')).toBeVisible();
    
    // Test plugin card layout on mobile
    const pluginCards = page.locator('[data-testid="plugin-card"]');
    const firstCard = pluginCards.first();
    
    // Verify card is properly sized for mobile
    const boundingBox = await firstCard.boundingBox();
    expect(boundingBox?.width).toBeLessThan(400);
  });

  test('should support plugin bulk operations', async () => {
    // Mock multiple plugins
    const multiplePlugins = Array.from({ length: 10 }, (_, i) => ({
      id: `@backstage/plugin-bulk-${i}`,
      title: `Bulk Plugin ${i}`,
      version: '1.0.0',
      category: 'testing',
      description: `Bulk operation test plugin ${i}`,
      author: 'Test Author',
      tags: ['bulk', 'test'],
      installed: false,
      enabled: false,
      configurable: true
    }));

    await page.route('/api/plugins', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            plugins: multiplePlugins
          })
        });
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Enable bulk operations mode
    await page.locator('[data-testid="bulk-operations-toggle"]').click();
    
    // Select multiple plugins
    const checkboxes = page.locator('[data-testid="plugin-checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await checkboxes.nth(2).click();
    
    // Verify bulk actions are available
    await expect(page.locator('[data-testid="bulk-actions-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="selected-count"]')).toContainText('3');
    
    // Execute bulk installation
    await page.locator('[data-testid="bulk-install-btn"]').click();
    
    // Verify confirmation dialog
    await expect(page.locator('[data-testid="bulk-install-confirmation"]')).toBeVisible();
    await page.locator('[data-testid="confirm-bulk-install"]').click();
    
    // Verify bulk operation progress
    await expect(page.locator('[data-testid="bulk-operation-progress"]')).toBeVisible();
  });
});