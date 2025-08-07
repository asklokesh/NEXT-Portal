import { test, expect, Page, BrowserContext } from '@playwright/test';

// Network failure test scenarios
const NETWORK_FAILURE_SCENARIOS = {
  complete_offline: {
    name: 'Complete Network Offline',
    description: 'Simulate complete network disconnection',
    implementation: (page: Page) => page.route('**/*', route => route.abort()),
    recovery: (page: Page) => page.unroute('**/*')
  },
  
  api_server_down: {
    name: 'API Server Unavailable',
    description: 'Backend API servers return 503 Service Unavailable',
    implementation: (page: Page) => page.route('/api/**', route => 
      route.fulfill({ status: 503, body: 'Service Unavailable' })
    ),
    recovery: (page: Page) => page.unroute('/api/**')
  },
  
  slow_network: {
    name: 'Slow Network Connection',
    description: 'Simulate high latency and slow responses',
    implementation: (page: Page) => page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay
      await route.continue();
    }),
    recovery: (page: Page) => page.unroute('**/*')
  },
  
  intermittent_failures: {
    name: 'Intermittent Network Failures',
    description: 'Random network failures (30% failure rate)',
    implementation: (page: Page) => {
      let requestCount = 0;
      return page.route('**/*', route => {
        requestCount++;
        if (requestCount % 3 === 0) { // Fail every 3rd request
          route.abort();
        } else {
          route.continue();
        }
      });
    },
    recovery: (page: Page) => page.unroute('**/*')
  },
  
  websocket_failure: {
    name: 'WebSocket Connection Failure',
    description: 'WebSocket connections fail to establish or drop frequently',
    implementation: (page: Page) => page.route('ws://**', route => route.abort()),
    recovery: (page: Page) => page.unroute('ws://**')
  },
  
  cdn_failure: {
    name: 'CDN Resource Failure',
    description: 'Static resources fail to load from CDN',
    implementation: (page: Page) => page.route('**/*.{js,css,png,jpg,svg}', route => 
      route.fulfill({ status: 404, body: 'Not Found' })
    ),
    recovery: (page: Page) => page.unroute('**/*.{js,css,png,jpg,svg}')
  },
  
  database_timeout: {
    name: 'Database Connection Timeout',
    description: 'Database queries timeout after extended delays',
    implementation: (page: Page) => page.route('/api/plugins*', async route => {
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30s timeout
      route.fulfill({ status: 408, body: 'Request Timeout' });
    }),
    recovery: (page: Page) => page.unroute('/api/plugins*')
  },
  
  partial_api_failure: {
    name: 'Partial API Failure',
    description: 'Some API endpoints work while others fail',
    implementation: (page: Page) => {
      // Plugin installation fails, but browsing works
      page.route('/api/plugins', async route => {
        const method = route.request().method();
        if (method === 'POST') {
          route.fulfill({ status: 500, body: 'Internal Server Error' });
        } else {
          route.continue();
        }
      });
    },
    recovery: (page: Page) => page.unroute('/api/plugins')
  }
};

const RECOVERY_STRATEGIES = {
  retry_mechanism: 'Automatic retry with exponential backoff',
  offline_mode: 'Offline mode with cached data',
  graceful_degradation: 'Reduced functionality with core features intact',
  user_notification: 'Clear error messages and recovery instructions',
  background_sync: 'Background synchronization when connection restored',
  circuit_breaker: 'Circuit breaker to prevent cascading failures'
};

test.describe('Network Failure and Recovery Testing', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['notifications'],
      recordVideo: { dir: 'tests/e2e/test-results/network-failures/' }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Setup mock APIs for baseline functionality
    await page.route('/api/plugins', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plugins: [
            {
              id: '@backstage/plugin-catalog',
              title: 'Service Catalog',
              version: '1.10.0',
              installed: false
            },
            {
              id: '@backstage/plugin-techdocs',
              title: 'TechDocs',
              version: '1.5.0',
              installed: true
            }
          ]
        })
      });
    });

    // Navigate to plugin marketplace
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Clean up network mocking
    await page.unroute('**/*');
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  // Test each network failure scenario
  for (const [scenarioKey, scenario] of Object.entries(NETWORK_FAILURE_SCENARIOS)) {
    test(`should handle ${scenario.name} gracefully`, async () => {
      console.log(`Testing scenario: ${scenario.description}`);
      
      // Verify initial working state
      await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
      
      // Apply network failure
      await scenario.implementation(page);
      
      // Test different operations under failure conditions
      await testPluginBrowsingUnderFailure(page, scenarioKey);
      await testPluginInstallationUnderFailure(page, scenarioKey);
      await testUserExperienceUnderFailure(page, scenarioKey);
      
      // Test recovery
      await scenario.recovery(page);
      await testRecoveryBehavior(page, scenarioKey);
    });
  }

  async function testPluginBrowsingUnderFailure(page: Page, scenario: string) {
    console.log(`Testing plugin browsing under ${scenario}`);
    
    // Try to refresh plugin list
    const refreshButton = page.locator('[data-testid="refresh-plugins"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Should show appropriate error or loading state
      const errorMessage = page.locator('[data-testid="error-message"]');
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
      
      const hasAppropriateState = await Promise.race([
        errorMessage.waitFor({ timeout: 5000 }).then(() => true).catch(() => false),
        loadingIndicator.waitFor({ timeout: 5000 }).then(() => true).catch(() => false),
        offlineIndicator.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
      ]);
      
      expect(hasAppropriateState).toBeTruthy();
    }
    
    // Try to search plugins
    const searchInput = page.locator('[data-testid="plugin-search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('catalog');
      await page.waitForTimeout(1000);
      
      // Should either show cached results or appropriate error
      const searchResults = page.locator('[data-testid="search-results"]');
      const searchError = page.locator('[data-testid="search-error"]');
      
      const hasSearchFeedback = await Promise.race([
        searchResults.waitFor({ timeout: 3000 }).then(() => true).catch(() => false),
        searchError.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
      ]);
      
      // Some form of feedback should be provided
      expect(hasSearchFeedback).toBeTruthy();
    }
  }

  async function testPluginInstallationUnderFailure(page: Page, scenario: string) {
    console.log(`Testing plugin installation under ${scenario}`);
    
    const installButton = page.locator('[data-testid="install-plugin-btn"]').first();
    
    if (await installButton.isVisible()) {
      await installButton.click();
      
      // Wait for installation attempt
      await page.waitForTimeout(2000);
      
      // Should show appropriate error handling
      const installationError = page.locator('[data-testid="installation-error"]');
      const retryButton = page.locator('[data-testid="retry-installation"]');
      const queuedIndicator = page.locator('[data-testid="installation-queued"]');
      
      const hasInstallationFeedback = await Promise.race([
        installationError.waitFor({ timeout: 10000 }).then(() => 'error').catch(() => null),
        retryButton.waitFor({ timeout: 10000 }).then(() => 'retry').catch(() => null),
        queuedIndicator.waitFor({ timeout: 10000 }).then(() => 'queued').catch(() => null)
      ]);
      
      expect(hasInstallationFeedback).not.toBeNull();
      
      // Test retry mechanism if available
      if (hasInstallationFeedback === 'retry') {
        await retryButton.click();
        // Should attempt retry or show queue status
        await page.waitForTimeout(1000);
        
        const retryIndicator = page.locator('[data-testid="retry-in-progress"]');
        if (await retryIndicator.isVisible()) {
          console.log('Retry mechanism is working');
        }
      }
    }
  }

  async function testUserExperienceUnderFailure(page: Page, scenario: string) {
    console.log(`Testing user experience under ${scenario}`);
    
    // Check for user-friendly error messages
    const errorMessages = page.locator('[data-testid*="error"], [data-testid*="failed"]');
    const errorCount = await errorMessages.count();
    
    if (errorCount > 0) {
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errorText = await errorMessages.nth(i).textContent();
        expect(errorText).toBeDefined();
        expect(errorText?.length).toBeGreaterThan(5); // Should have meaningful error message
      }
    }
    
    // Check for offline/network status indicators
    const networkStatus = page.locator('[data-testid="network-status"]');
    if (await networkStatus.isVisible()) {
      const statusText = await networkStatus.textContent();
      expect(statusText).toContain('offline' || 'disconnected' || 'error');
    }
    
    // Verify application remains navigable
    const navigation = page.locator('[data-testid="main-nav"]');
    await expect(navigation).toBeVisible();
    
    // Try navigation to ensure app doesn't crash
    const homeLink = page.locator('[data-testid="nav-home"]');
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForTimeout(1000);
      
      // Should not crash the application
      const errorBoundary = page.locator('[data-testid="error-boundary"]');
      expect(await errorBoundary.isVisible()).toBeFalsy();
    }
  }

  async function testRecoveryBehavior(page: Page, scenario: string) {
    console.log(`Testing recovery behavior after ${scenario}`);
    
    // Wait for potential auto-recovery
    await page.waitForTimeout(2000);
    
    // Try to refresh or trigger network request
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should recover to working state
    await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible({ timeout: 10000 });
    
    // Check if retry mechanisms work
    const retryButtons = page.locator('[data-testid="retry-button"], [data-testid="retry-installation"]');
    const retryCount = await retryButtons.count();
    
    if (retryCount > 0) {
      await retryButtons.first().click();
      await page.waitForTimeout(2000);
      
      // Should show success or progress after retry
      const successIndicator = page.locator('[data-testid="retry-success"], [data-testid="operation-success"]');
      const progressIndicator = page.locator('[data-testid="retry-in-progress"], [data-testid="loading"]');
      
      const hasRecoveryFeedback = await Promise.race([
        successIndicator.waitFor({ timeout: 5000 }).then(() => true).catch(() => false),
        progressIndicator.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
      ]);
      
      expect(hasRecoveryFeedback).toBeTruthy();
    }
    
    // Test background sync if applicable
    const syncIndicator = page.locator('[data-testid="sync-indicator"]');
    if (await syncIndicator.isVisible()) {
      await page.waitForTimeout(3000); // Wait for background sync
      
      const syncComplete = page.locator('[data-testid="sync-complete"]');
      if (await syncComplete.isVisible()) {
        console.log('Background sync completed successfully');
      }
    }
  }

  test.describe('Specific Recovery Mechanisms', () => {
    test('should implement exponential backoff retry', async () => {
      // Mock API with failure then success
      let requestCount = 0;
      await page.route('/api/plugins', async route => {
        requestCount++;
        if (requestCount <= 3) {
          await route.fulfill({ status: 500, body: 'Server Error' });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ plugins: [] })
          });
        }
      });
      
      // Trigger operation that should retry
      await page.locator('[data-testid="refresh-plugins"]').click();
      
      // Wait for retry mechanism to complete
      await page.waitForTimeout(10000);
      
      // Should eventually succeed after retries
      const successIndicator = page.locator('[data-testid="plugins-loaded"]');
      await expect(successIndicator).toBeVisible({ timeout: 15000 });
      
      expect(requestCount).toBeGreaterThan(3); // Confirms retry attempts
    });

    test('should cache data for offline mode', async () => {
      // First, load data while online
      await expect(page.locator('[data-testid="plugin-card"]')).toHaveCount(2);
      
      // Store indication that data was cached
      const cachedData = await page.evaluate(() => {
        return localStorage.getItem('cached-plugins') || 
               sessionStorage.getItem('cached-plugins') ||
               'cache-check';
      });
      
      // Go offline
      await page.route('**/*', route => route.abort());
      
      // Reload page
      await page.reload();
      
      // Should show cached data or offline indicator
      const offlineMode = page.locator('[data-testid="offline-mode"]');
      const cachedPlugins = page.locator('[data-testid="cached-plugins"]');
      
      const hasOfflineSupport = await Promise.race([
        offlineMode.waitFor({ timeout: 5000 }).then(() => 'offline-mode'),
        cachedPlugins.waitFor({ timeout: 5000 }).then(() => 'cached-data')
      ].map(p => p.catch(() => null)));
      
      expect(hasOfflineSupport).not.toBeNull();
    });

    test('should implement circuit breaker pattern', async () => {
      let failureCount = 0;
      const maxFailures = 5;
      
      await page.route('/api/plugins', async route => {
        failureCount++;
        if (failureCount <= maxFailures) {
          await route.fulfill({ status: 500, body: 'Server Error' });
        } else {
          // After max failures, should implement circuit breaker
          await route.fulfill({ status: 503, body: 'Circuit Breaker Open' });
        }
      });
      
      // Make multiple requests that should trigger circuit breaker
      for (let i = 0; i < maxFailures + 2; i++) {
        await page.locator('[data-testid="refresh-plugins"]').click();
        await page.waitForTimeout(1000);
      }
      
      // Should show circuit breaker indicator or stop making requests
      const circuitBreakerIndicator = page.locator('[data-testid="circuit-breaker-open"]');
      const rateLimitIndicator = page.locator('[data-testid="rate-limit-active"]');
      
      const hasCircuitBreaker = await Promise.race([
        circuitBreakerIndicator.waitFor({ timeout: 2000 }).then(() => true).catch(() => false),
        rateLimitIndicator.waitFor({ timeout: 2000 }).then(() => true).catch(() => false)
      ]);
      
      // Should implement some form of failure protection
      expect(hasCircuitBreaker).toBeTruthy();
    });

    test('should handle WebSocket reconnection', async () => {
      let wsConnections = 0;
      
      page.on('websocket', ws => {
        wsConnections++;
        console.log(`WebSocket connection #${wsConnections}`);
        
        // Simulate connection drops
        setTimeout(() => {
          ws.close();
        }, 2000);
      });
      
      // Navigate to page with WebSocket functionality
      await page.goto('/plugins?realtime=true');
      await page.waitForTimeout(1000);
      
      // Wait for initial connection and reconnection attempts
      await page.waitForTimeout(10000);
      
      // Should attempt reconnection
      expect(wsConnections).toBeGreaterThan(1);
      
      // Check for reconnection indicators
      const reconnectingIndicator = page.locator('[data-testid="websocket-reconnecting"]');
      const reconnectedIndicator = page.locator('[data-testid="websocket-connected"]');
      
      if (await reconnectingIndicator.isVisible() || await reconnectedIndicator.isVisible()) {
        console.log('WebSocket reconnection mechanism is working');
      }
    });
  });

  test.describe('Error Recovery User Experience', () => {
    test('should provide clear error messages and recovery actions', async () => {
      // Simulate API failure
      await page.route('/api/plugins', route => 
        route.fulfill({ 
          status: 503, 
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service Temporarily Unavailable',
            code: 'SERVICE_UNAVAILABLE',
            retryAfter: 30
          })
        })
      );
      
      // Trigger operation that will fail
      await page.locator('[data-testid="refresh-plugins"]').click();
      
      // Should show user-friendly error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/unavailable|error|failed/i);
      
      // Should provide recovery actions
      const retryButton = page.locator('[data-testid="retry-button"]');
      const helpLink = page.locator('[data-testid="error-help-link"]');
      
      const hasRecoveryActions = 
        (await retryButton.isVisible()) || 
        (await helpLink.isVisible());
      
      expect(hasRecoveryActions).toBeTruthy();
    });

    test('should maintain application state during failures', async () => {
      // Set some application state
      await page.locator('[data-testid="plugin-search"]').fill('catalog');
      await page.locator('[data-testid="category-filter"]').click();
      
      // Introduce network failure
      await page.route('/api/**', route => route.abort());
      
      // Try to perform operation that will fail
      await page.locator('[data-testid="apply-filter"]').click();
      await page.waitForTimeout(2000);
      
      // Application state should be preserved
      const searchValue = await page.locator('[data-testid="plugin-search"]').inputValue();
      expect(searchValue).toBe('catalog');
      
      // UI should remain responsive
      await page.locator('[data-testid="clear-search"]').click();
      const clearedValue = await page.locator('[data-testid="plugin-search"]').inputValue();
      expect(clearedValue).toBe('');
    });

    test('should handle multiple simultaneous failures gracefully', async () => {
      // Simulate multiple types of failures
      await page.route('/api/plugins', route => route.abort()); // API failure
      await page.route('**/*.css', route => route.abort()); // CSS loading failure
      await page.route('ws://**', route => route.abort()); // WebSocket failure
      
      // Reload page with multiple failures
      await page.reload();
      await page.waitForTimeout(5000);
      
      // Should not crash and should show appropriate error states
      const errorBoundary = page.locator('[data-testid="error-boundary"]');
      expect(await errorBoundary.isVisible()).toBeFalsy();
      
      // Should show some form of degraded state indicator
      const degradedModeIndicator = page.locator('[data-testid="degraded-mode"], [data-testid="limited-functionality"]');
      const hasGracefulDegradation = await degradedModeIndicator.isVisible();
      
      // Application should either work in degraded mode or show clear error state
      const isNavigable = await page.locator('[data-testid="main-content"]').isVisible();
      expect(hasGracefulDegradation || isNavigable).toBeTruthy();
    });
  });

  test.describe('Performance Under Failure Conditions', () => {
    test('should maintain reasonable performance during intermittent failures', async () => {
      // Setup intermittent failures (50% failure rate)
      let requestCount = 0;
      await page.route('/api/**', async route => {
        requestCount++;
        if (requestCount % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Slow response
          await route.continue();
        } else {
          await route.abort(); // Failed response
        }
      });
      
      const startTime = Date.now();
      
      // Perform operations that should handle failures gracefully
      await page.locator('[data-testid="refresh-plugins"]').click();
      await page.locator('[data-testid="plugin-search"]').fill('test');
      await page.locator('[data-testid="category-all"]').click();
      
      // Wait for operations to complete or timeout
      await page.waitForTimeout(15000);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time despite failures
      expect(totalTime).toBeLessThan(30000); // 30 seconds max
      
      // Application should remain responsive
      const isResponsive = await page.locator('[data-testid="plugin-marketplace"]').isVisible();
      expect(isResponsive).toBeTruthy();
    });

    test('should handle memory efficiently during failure recovery', async () => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      // Create multiple failure and recovery cycles
      for (let i = 0; i < 5; i++) {
        // Introduce failure
        await page.route('/api/**', route => route.abort());
        await page.locator('[data-testid="refresh-plugins"]').click();
        await page.waitForTimeout(2000);
        
        // Recover
        await page.unroute('/api/**');
        await page.locator('[data-testid="retry-button"]').click();
        await page.waitForTimeout(2000);
      }
      
      // Check memory usage after cycles
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        // Memory increase should be reasonable (less than 50% growth)
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });
  });
});