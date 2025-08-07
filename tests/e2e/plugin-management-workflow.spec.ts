import { test, expect, Page } from '@playwright/test';

// Test data
const mockPlugin = {
  id: 'test-plugin-e2e',
  name: 'E2E Test Plugin',
  version: '1.0.0',
  description: 'A plugin for end-to-end testing',
  author: 'Test Team',
  category: 'Testing',
  tags: ['e2e', 'testing'],
  status: 'available',
};

class PluginMarketplacePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/marketplace');
    await this.page.waitForLoadState('networkidle');
  }

  async searchPlugin(query: string) {
    const searchInput = this.page.getByPlaceholder(/search plugins/i);
    await searchInput.fill(query);
    await this.page.waitForLoadState('networkidle');
  }

  async filterByCategory(category: string) {
    const categoryFilter = this.page.getByRole('button', { name: /all categories/i });
    await categoryFilter.click();
    await this.page.getByRole('option', { name: new RegExp(category, 'i') }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: string) {
    const statusFilter = this.page.getByRole('button', { name: /all statuses/i });
    await statusFilter.click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async sortBy(criteria: string) {
    const sortSelect = this.page.getByRole('combobox', { name: /sort by/i });
    await sortSelect.selectOption(criteria);
    await this.page.waitForLoadState('networkidle');
  }

  async getPluginCard(pluginId: string) {
    return this.page.getByTestId(`plugin-card-${pluginId}`);
  }

  async installPlugin(pluginId: string) {
    const installButton = this.page.getByTestId(`install-plugin-${pluginId}`);
    await installButton.click();
    
    // Wait for installation to complete
    await this.page.waitForSelector(`[data-testid="install-plugin-${pluginId}"][disabled]`, { state: 'hidden' });
  }

  async uninstallPlugin(pluginId: string) {
    const uninstallButton = this.page.getByTestId(`uninstall-plugin-${pluginId}`);
    await uninstallButton.click();
    
    // Confirm uninstallation in modal
    await this.page.getByRole('button', { name: /confirm/i }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async openPluginDetails(pluginId: string) {
    const pluginCard = await this.getPluginCard(pluginId);
    await pluginCard.click();
    await this.page.waitForSelector('[role="dialog"]');
  }

  async closePluginDetails() {
    const closeButton = this.page.getByRole('button', { name: /close/i });
    await closeButton.click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden' });
  }

  async switchToListView() {
    const listViewButton = this.page.getByRole('button', { name: /list view/i });
    await listViewButton.click();
    await this.page.waitForSelector('[data-testid="plugin-list-view"]');
  }

  async switchToGridView() {
    const gridViewButton = this.page.getByRole('button', { name: /grid view/i });
    await gridViewButton.click();
    await this.page.waitForSelector('[data-testid="plugin-grid-view"]');
  }

  async goToNextPage() {
    const nextButton = this.page.getByRole('button', { name: /next page/i });
    await nextButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToPreviousPage() {
    const prevButton = this.page.getByRole('button', { name: /previous page/i });
    await prevButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

class PluginConfigurationPage {
  constructor(private page: Page) {}

  async goto(pluginId: string) {
    await this.page.goto(`/plugins/${pluginId}/config`);
    await this.page.waitForLoadState('networkidle');
  }

  async updateConfiguration(config: Record<string, any>) {
    for (const [key, value] of Object.entries(config)) {
      const field = this.page.getByLabel(new RegExp(key, 'i'));
      await field.fill(String(value));
    }
  }

  async saveConfiguration() {
    const saveButton = this.page.getByRole('button', { name: /save/i });
    await saveButton.click();
    await this.page.waitForSelector('.toast-success', { timeout: 10000 });
  }

  async validateConfiguration() {
    const validateButton = this.page.getByRole('button', { name: /validate/i });
    await validateButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

class PluginHealthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/plugins');
    await this.page.waitForLoadState('networkidle');
  }

  async checkPluginHealth(pluginId: string) {
    const healthIndicator = this.page.getByTestId(`plugin-health-${pluginId}`);
    return await healthIndicator.textContent();
  }

  async viewPluginLogs(pluginId: string) {
    const logsButton = this.page.getByTestId(`view-logs-${pluginId}`);
    await logsButton.click();
    await this.page.waitForSelector('[data-testid="plugin-logs-modal"]');
  }

  async restartPlugin(pluginId: string) {
    const restartButton = this.page.getByTestId(`restart-plugin-${pluginId}`);
    await restartButton.click();
    
    // Confirm restart
    await this.page.getByRole('button', { name: /confirm restart/i }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async getPluginMetrics(pluginId: string) {
    const metricsPanel = this.page.getByTestId(`plugin-metrics-${pluginId}`);
    return {
      uptime: await metricsPanel.getByTestId('uptime').textContent(),
      responseTime: await metricsPanel.getByTestId('response-time').textContent(),
      errorRate: await metricsPanel.getByTestId('error-rate').textContent(),
    };
  }
}

test.describe('Plugin Management Workflow', () => {
  let marketplacePage: PluginMarketplacePage;
  let configPage: PluginConfigurationPage;
  let healthPage: PluginHealthPage;

  test.beforeEach(async ({ page }) => {
    marketplacePage = new PluginMarketplacePage(page);
    configPage = new PluginConfigurationPage(page);
    healthPage = new PluginHealthPage(page);

    // Setup mock API responses
    await page.route('**/api/plugins**', async (route) => {
      const url = new URL(route.request().url());
      
      if (url.pathname === '/api/plugins' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plugins: [mockPlugin],
            total: 1,
            page: 1,
            limit: 20,
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should display plugin marketplace correctly', async ({ page }) => {
    await marketplacePage.goto();

    // Check that the marketplace loads
    await expect(page.getByText('Plugin Marketplace')).toBeVisible();
    await expect(page.getByPlaceholder(/search plugins/i)).toBeVisible();
    
    // Check that plugins are displayed
    await expect(page.getByText(mockPlugin.name)).toBeVisible();
    await expect(page.getByText(mockPlugin.description)).toBeVisible();
    await expect(page.getByText(mockPlugin.author)).toBeVisible();
  });

  test('should search for plugins', async ({ page }) => {
    await marketplacePage.goto();

    // Search for a specific plugin
    await marketplacePage.searchPlugin('E2E Test');

    // Verify search results
    await expect(page.getByText(mockPlugin.name)).toBeVisible();
  });

  test('should filter plugins by category', async ({ page }) => {
    await marketplacePage.goto();

    // Filter by Testing category
    await marketplacePage.filterByCategory('Testing');

    // Verify filtered results
    await expect(page.getByText(mockPlugin.name)).toBeVisible();
  });

  test('should filter plugins by status', async ({ page }) => {
    await marketplacePage.goto();

    // Filter by available status
    await marketplacePage.filterByStatus('Available');

    // Verify filtered results
    await expect(page.getByText(mockPlugin.name)).toBeVisible();
  });

  test('should sort plugins', async ({ page }) => {
    await marketplacePage.goto();

    // Sort by name
    await marketplacePage.sortBy('name');

    // Verify plugins are still visible (sorting doesn't filter)
    await expect(page.getByText(mockPlugin.name)).toBeVisible();
  });

  test('should switch between grid and list views', async ({ page }) => {
    await marketplacePage.goto();

    // Switch to list view
    await marketplacePage.switchToListView();
    await expect(page.getByTestId('plugin-list-view')).toBeVisible();

    // Switch back to grid view
    await marketplacePage.switchToGridView();
    await expect(page.getByTestId('plugin-grid-view')).toBeVisible();
  });

  test('should open and close plugin details modal', async ({ page }) => {
    await marketplacePage.goto();

    // Open plugin details
    await marketplacePage.openPluginDetails(mockPlugin.id);

    // Verify modal is open and contains plugin information
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Plugin Details')).toBeVisible();
    await expect(page.getByText(mockPlugin.name)).toBeVisible();

    // Close modal
    await marketplacePage.closePluginDetails();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should install a plugin', async ({ page }) => {
    // Mock installation API
    await page.route(`**/api/plugins/${mockPlugin.id}/install`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Plugin installed successfully',
          containerId: 'container-123',
        }),
      });
    });

    await marketplacePage.goto();

    // Install the plugin
    await marketplacePage.installPlugin(mockPlugin.id);

    // Verify installation success
    await expect(page.getByText(/installed successfully/i)).toBeVisible({ timeout: 15000 });
  });

  test('should handle plugin installation error', async ({ page }) => {
    // Mock installation error
    await page.route(`**/api/plugins/${mockPlugin.id}/install`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Installation failed: Docker service unavailable',
        }),
      });
    });

    await marketplacePage.goto();

    // Attempt to install the plugin
    await marketplacePage.installPlugin(mockPlugin.id);

    // Verify error is displayed
    await expect(page.getByText(/installation failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should configure an installed plugin', async ({ page }) => {
    // Mock configuration API
    await page.route(`**/api/plugins/${mockPlugin.id}/config`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            config: {
              apiUrl: 'https://api.example.com',
              timeout: 5000,
            },
            schema: {
              type: 'object',
              properties: {
                apiUrl: { type: 'string', title: 'API URL' },
                timeout: { type: 'number', title: 'Timeout (ms)' },
              },
            },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Configuration updated successfully',
          }),
        });
      }
    });

    await configPage.goto(mockPlugin.id);

    // Update configuration
    await configPage.updateConfiguration({
      'API URL': 'https://new-api.example.com',
      'Timeout (ms)': '10000',
    });

    // Save configuration
    await configPage.saveConfiguration();

    // Verify success message
    await expect(page.getByText(/configuration updated/i)).toBeVisible();
  });

  test('should monitor plugin health', async ({ page }) => {
    // Mock health API
    await page.route('**/api/admin/plugins/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            pluginId: mockPlugin.id,
            status: 'healthy',
            uptime: '99.5%',
            responseTime: '45ms',
            errorRate: '0.1%',
            lastCheck: new Date().toISOString(),
          },
        ]),
      });
    });

    await healthPage.goto();

    // Check plugin health status
    const healthStatus = await healthPage.checkPluginHealth(mockPlugin.id);
    expect(healthStatus).toContain('healthy');

    // Get plugin metrics
    const metrics = await healthPage.getPluginMetrics(mockPlugin.id);
    expect(metrics.uptime).toContain('99.5%');
    expect(metrics.responseTime).toContain('45ms');
    expect(metrics.errorRate).toContain('0.1%');
  });

  test('should restart an unhealthy plugin', async ({ page }) => {
    // Mock restart API
    await page.route(`**/api/plugins/${mockPlugin.id}/restart`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Plugin restarted successfully',
        }),
      });
    });

    await healthPage.goto();

    // Restart the plugin
    await healthPage.restartPlugin(mockPlugin.id);

    // Verify restart success
    await expect(page.getByText(/restarted successfully/i)).toBeVisible();
  });

  test('should view plugin logs', async ({ page }) => {
    // Mock logs API
    await page.route(`**/api/plugins/${mockPlugin.id}/logs`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Plugin started' },
            { timestamp: '2024-01-01T10:01:00Z', level: 'info', message: 'Processing request' },
            { timestamp: '2024-01-01T10:02:00Z', level: 'warn', message: 'Slow response detected' },
          ],
        }),
      });
    });

    await healthPage.goto();

    // View plugin logs
    await healthPage.viewPluginLogs(mockPlugin.id);

    // Verify logs modal is displayed
    await expect(page.getByTestId('plugin-logs-modal')).toBeVisible();
    await expect(page.getByText('Plugin started')).toBeVisible();
    await expect(page.getByText('Processing request')).toBeVisible();
  });

  test('should uninstall a plugin', async ({ page }) => {
    // Mock uninstall API
    await page.route(`**/api/plugins/${mockPlugin.id}/uninstall`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Plugin uninstalled successfully',
        }),
      });
    });

    await marketplacePage.goto();

    // Uninstall the plugin
    await marketplacePage.uninstallPlugin(mockPlugin.id);

    // Verify uninstallation success
    await expect(page.getByText(/uninstalled successfully/i)).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await marketplacePage.goto();

    // Focus on search input
    await page.getByPlaceholder(/search plugins/i).focus();
    
    // Tab through interface elements
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /all categories/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /all statuses/i })).toBeFocused();

    // Use Enter key to open dropdown
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();

    // Use Escape to close dropdown
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).not.toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific test');

    await marketplacePage.goto();

    // Check mobile layout adaptations
    await expect(page.getByTestId('mobile-filter-button')).toBeVisible();
    await expect(page.getByTestId('mobile-search-toggle')).toBeVisible();

    // Test mobile search toggle
    await page.getByTestId('mobile-search-toggle').click();
    await expect(page.getByPlaceholder(/search plugins/i)).toBeVisible();
  });

  test('should handle offline scenarios', async ({ page, context }) => {
    await marketplacePage.goto();

    // Simulate offline
    await context.setOffline(true);

    // Try to perform an action that requires network
    await marketplacePage.searchPlugin('offline test');

    // Should show offline indicator
    await expect(page.getByText(/offline/i)).toBeVisible();

    // Simulate back online
    await context.setOffline(false);

    // Should retry automatically
    await expect(page.getByText(/online/i)).toBeVisible({ timeout: 10000 });
  });

  test('should validate plugin dependencies during installation', async ({ page }) => {
    const pluginWithDependencies = {
      ...mockPlugin,
      id: 'plugin-with-deps',
      dependencies: ['missing-dependency'],
    };

    // Mock API with dependency validation
    await page.route('**/api/plugins', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plugins: [pluginWithDependencies],
          total: 1,
        }),
      });
    });

    await page.route(`**/api/plugins/${pluginWithDependencies.id}/install`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Missing dependencies: missing-dependency',
        }),
      });
    });

    await marketplacePage.goto();

    // Attempt installation
    await marketplacePage.installPlugin(pluginWithDependencies.id);

    // Should show dependency error
    await expect(page.getByText(/missing dependencies/i)).toBeVisible();
  });

  test('should support bulk plugin operations', async ({ page }) => {
    // Mock multiple plugins
    await page.route('**/api/plugins', async (route) => {
      const plugins = Array.from({ length: 5 }, (_, i) => ({
        ...mockPlugin,
        id: `plugin-${i}`,
        name: `Test Plugin ${i}`,
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plugins, total: 5 }),
      });
    });

    await marketplacePage.goto();

    // Enable bulk selection mode
    await page.getByRole('button', { name: /bulk actions/i }).click();

    // Select multiple plugins
    await page.getByTestId('select-plugin-plugin-0').check();
    await page.getByTestId('select-plugin-plugin-1').check();
    await page.getByTestId('select-plugin-plugin-2').check();

    // Perform bulk action
    await page.getByRole('button', { name: /install selected/i }).click();

    // Confirm bulk operation
    await page.getByRole('button', { name: /confirm/i }).click();

    // Should show bulk operation progress
    await expect(page.getByText(/installing 3 plugins/i)).toBeVisible();
  });
});