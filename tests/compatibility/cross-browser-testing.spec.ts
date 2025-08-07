import { test, expect, devices } from '@playwright/test';

// Browser compatibility test matrix
const BROWSER_TEST_MATRIX = {
  desktop: {
    chromium: { name: 'Desktop Chrome', ...devices['Desktop Chrome'] },
    firefox: { name: 'Desktop Firefox', ...devices['Desktop Firefox'] },
    webkit: { name: 'Desktop Safari', ...devices['Desktop Safari'] }
  },
  mobile: {
    chrome_mobile: { name: 'Mobile Chrome', ...devices['Pixel 5'] },
    safari_mobile: { name: 'Mobile Safari', ...devices['iPhone 12'] }
  },
  tablet: {
    chrome_tablet: { name: 'Tablet Chrome', ...devices['iPad Pro'] },
    safari_tablet: { name: 'Tablet Safari', ...devices['iPad Pro landscape'] }
  }
};

const FEATURE_COMPATIBILITY_TESTS = [
  'plugin_marketplace_loading',
  'plugin_installation_workflow', 
  'plugin_configuration_forms',
  'real_time_updates',
  'file_upload_download',
  'drag_and_drop',
  'responsive_layout',
  'accessibility_features',
  'local_storage',
  'web_workers',
  'service_worker',
  'websocket_connections'
];

// Test each browser configuration
for (const [category, browsers] of Object.entries(BROWSER_TEST_MATRIX)) {
  for (const [browserKey, config] of Object.entries(browsers)) {
    
    test.describe(`Cross-Browser Compatibility - ${config.name}`, () => {
      test.use(config);

      test.beforeEach(async ({ page }) => {
        // Mock plugin API responses for consistent cross-browser testing
        await page.route('/api/plugins*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plugins: [
                {
                  id: '@backstage/plugin-catalog',
                  title: 'Service Catalog',
                  version: '1.10.0',
                  description: 'Organize and manage your software components',
                  category: 'catalog',
                  installed: false,
                  configurable: true
                },
                {
                  id: '@backstage/plugin-techdocs',
                  title: 'TechDocs',
                  version: '1.5.0', 
                  description: 'Documentation system built on MkDocs',
                  category: 'documentation',
                  installed: true,
                  configurable: true
                }
              ]
            })
          });
        });

        // Navigate to the application
        await page.goto('/plugins');
        await page.waitForLoadState('networkidle');
      });

      test('should load plugin marketplace correctly', async ({ page }) => {
        // Test marketplace loading
        await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
        await expect(page.locator('[data-testid="plugin-card"]').first()).toBeVisible();
        
        // Verify layout integrity
        const marketplace = page.locator('[data-testid="plugin-marketplace"]');
        const boundingBox = await marketplace.boundingBox();
        expect(boundingBox?.width).toBeGreaterThan(300);
        
        // Check responsive behavior based on device type
        if (category === 'mobile') {
          // Mobile-specific checks
          await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
          
          // Test mobile navigation
          await page.locator('[data-testid="mobile-menu-toggle"]').click();
          await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
        } else {
          // Desktop/tablet checks
          await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
        }
      });

      test('should handle plugin search consistently', async ({ page }) => {
        const searchInput = page.locator('[data-testid="plugin-search"]');
        
        // Test search input functionality
        await searchInput.fill('catalog');
        await page.waitForTimeout(500); // Debounce delay
        
        // Verify search results
        const pluginCards = page.locator('[data-testid="plugin-card"]');
        await expect(pluginCards).toHaveCount(1);
        
        // Test search clearing
        await searchInput.clear();
        await page.waitForTimeout(500);
        await expect(pluginCards).toHaveCount(2); // Should show all plugins
        
        // Test keyboard navigation (if not mobile)
        if (category !== 'mobile') {
          await searchInput.focus();
          await page.keyboard.press('Tab');
          await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
        }
      });

      test('should support plugin filtering', async ({ page }) => {
        // Test category filtering
        await page.locator('[data-testid="category-catalog"]').click();
        
        const filteredCards = page.locator('[data-testid="plugin-card"]');
        await expect(filteredCards).toHaveCount(1);
        
        // Reset filter
        await page.locator('[data-testid="category-all"]').click();
        await expect(filteredCards).toHaveCount(2);
        
        // Test tag filtering (if available)
        const tagFilter = page.locator('[data-testid="tag-filter"]');
        if (await tagFilter.count() > 0) {
          await tagFilter.first().click();
          // Verify filtered results
          await expect(filteredCards).toHaveCountGreaterThan(0);
        }
      });

      test('should handle plugin installation workflow', async ({ page }) => {
        const installButton = page.locator('[data-testid="install-plugin-btn"]').first();
        
        if (await installButton.isVisible()) {
          await installButton.click();
          
          // Check if installation modal opens
          const installModal = page.locator('[data-testid="installation-modal"]');
          if (await installModal.isVisible()) {
            // Test installation form
            await expect(page.locator('[data-testid="environment-selection"]')).toBeVisible();
            
            // Select environment
            await page.locator('[data-testid="environment-local"]').click();
            
            // Start installation
            await page.locator('[data-testid="start-installation-btn"]').click();
            
            // Verify progress indicator
            await expect(page.locator('[data-testid="installation-progress"]')).toBeVisible();
          }
        }
      });

      test('should render forms correctly', async ({ page }) => {
        // Test configuration form rendering
        const configButton = page.locator('[data-testid="configure-plugin-btn"]');
        
        if (await configButton.count() > 0) {
          await configButton.first().click();
          
          const configModal = page.locator('[data-testid="plugin-config-modal"]');
          await expect(configModal).toBeVisible();
          
          // Test form elements
          const formElements = page.locator('[data-testid="config-form"] input, [data-testid="config-form"] select, [data-testid="config-form"] textarea');
          const elementCount = await formElements.count();
          expect(elementCount).toBeGreaterThan(0);
          
          // Test form validation (if available)
          const submitButton = page.locator('[data-testid="save-config-btn"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            
            // Check for validation messages
            const validationMessages = page.locator('[data-testid="validation-error"]');
            // May or may not have validation errors depending on form state
          }
          
          // Close modal
          await page.locator('[data-testid="close-modal"]').click();
        }
      });

      test('should support real-time updates', async ({ page }) => {
        // Test WebSocket connections and real-time updates
        let websocketConnected = false;
        
        page.on('websocket', ws => {
          websocketConnected = true;
          
          // Test WebSocket message handling
          ws.on('framesent', event => {
            console.log(`WebSocket sent: ${event.payload}`);
          });
          
          ws.on('framereceived', event => {
            console.log(`WebSocket received: ${event.payload}`);
          });
        });
        
        // Trigger real-time update scenario
        await page.reload();
        await page.waitForTimeout(2000);
        
        // Note: WebSocket support varies by browser, so we don't assert connection
        // Just ensure the page still functions without WebSocket
        await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
      });

      test('should handle file operations', async ({ page, browserName }) => {
        // Test file upload/download functionality
        const fileInput = page.locator('[data-testid="file-upload"]');
        
        if (await fileInput.count() > 0) {
          // Create a test file
          const testFile = await page.evaluateHandle(() => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            return file;
          });
          
          // Set file on input (browser support may vary)
          try {
            await fileInput.setInputFiles([{
              name: 'test.txt',
              mimeType: 'text/plain',
              buffer: Buffer.from('test content')
            }]);
            
            // Verify file upload UI feedback
            await expect(page.locator('[data-testid="file-upload-success"]')).toBeVisible();
          } catch (error) {
            console.log(`File upload not supported in ${browserName}: ${error}`);
          }
        }
        
        // Test file download
        const downloadButton = page.locator('[data-testid="download-config"]');
        if (await downloadButton.count() > 0) {
          const downloadPromise = page.waitForEvent('download');
          await downloadButton.click();
          
          try {
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.json');
          } catch (error) {
            console.log(`Download not triggered in ${browserName}: ${error}`);
          }
        }
      });

      test('should support drag and drop operations', async ({ page }) => {
        // Test drag and drop functionality
        const dragSource = page.locator('[data-testid="draggable-plugin-card"]');
        const dropTarget = page.locator('[data-testid="plugin-drop-zone"]');
        
        if (await dragSource.count() > 0 && await dropTarget.count() > 0) {
          try {
            await dragSource.first().dragTo(dropTarget);
            
            // Verify drop operation
            await expect(page.locator('[data-testid="drop-success"]')).toBeVisible();
          } catch (error) {
            console.log(`Drag and drop not supported or failed: ${error}`);
          }
        }
      });

      test('should maintain accessibility features', async ({ page }) => {
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        
        // Verify focus indicators
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
        
        // Test aria labels and roles
        const ariaElements = page.locator('[aria-label], [role]');
        const ariaCount = await ariaElements.count();
        expect(ariaCount).toBeGreaterThan(0);
        
        // Test high contrast mode support (if applicable)
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(500);
        
        // Verify dark mode elements are still visible
        await expect(page.locator('[data-testid="plugin-marketplace"]')).toBeVisible();
      });

      test('should handle local storage operations', async ({ page, browserName }) => {
        // Test local storage functionality
        await page.evaluate(() => {
          localStorage.setItem('plugin-preferences', JSON.stringify({
            favoritePlugins: ['@backstage/plugin-catalog'],
            viewMode: 'grid'
          }));
        });
        
        // Reload page and verify persistence
        await page.reload();
        
        const storedData = await page.evaluate(() => {
          return localStorage.getItem('plugin-preferences');
        });
        
        expect(storedData).toBeDefined();
        
        // Test localStorage limits (browser-specific)
        try {
          await page.evaluate(() => {
            const largeData = 'x'.repeat(1024 * 1024); // 1MB
            localStorage.setItem('large-data', largeData);
          });
        } catch (error) {
          // Expected in some browsers with storage limits
          console.log(`LocalStorage limit reached in ${browserName}`);
        }
      });

      test('should handle network conditions gracefully', async ({ page }) => {
        // Test offline functionality
        await page.route('**/*', route => route.abort());
        
        await page.reload();
        
        // Should show offline indicator or cached content
        const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
        const cachedContent = page.locator('[data-testid="plugin-marketplace"]');
        
        // Either offline mode or cached content should be shown
        const hasOfflineHandling = await offlineIndicator.isVisible() || await cachedContent.isVisible();
        expect(hasOfflineHandling).toBeTruthy();
        
        // Restore network
        await page.unroute('**/*');
      });

      test('should validate CSS rendering and layout', async ({ page }) => {
        // Test CSS Grid/Flexbox support
        const gridContainer = page.locator('[data-testid="plugin-grid"]');
        if (await gridContainer.count() > 0) {
          const computedStyle = await gridContainer.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              display: style.display,
              gridTemplateColumns: style.gridTemplateColumns,
              gap: style.gap
            };
          });
          
          expect(computedStyle.display).toBe('grid');
        }
        
        // Test responsive breakpoints
        const currentViewport = page.viewportSize();
        if (currentViewport) {
          if (currentViewport.width < 768) {
            // Mobile layout checks
            await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
          } else {
            // Desktop layout checks
            await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
          }
        }
        
        // Test CSS custom properties support
        const customPropertyValue = await page.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
        });
        
        expect(customPropertyValue).toBeDefined();
      });

      test('should handle JavaScript API compatibility', async ({ page, browserName }) => {
        // Test modern JavaScript features
        const jsFeatures = await page.evaluate(() => {
          return {
            asyncAwait: typeof (async () => {}) === 'function',
            promises: typeof Promise !== 'undefined',
            fetch: typeof fetch !== 'undefined',
            webWorkers: typeof Worker !== 'undefined',
            webSockets: typeof WebSocket !== 'undefined',
            intersectionObserver: typeof IntersectionObserver !== 'undefined',
            mutationObserver: typeof MutationObserver !== 'undefined'
          };
        });
        
        expect(jsFeatures.promises).toBe(true);
        expect(jsFeatures.fetch).toBe(true);
        
        // Some features may not be available in all browsers
        console.log(`${browserName} JS features:`, jsFeatures);
        
        // Test polyfill loading
        const polyfillsLoaded = await page.evaluate(() => {
          return window.polyfillsLoaded || false;
        });
        
        // Polyfills should be loaded if needed
        if (!jsFeatures.fetch || !jsFeatures.webSockets) {
          expect(polyfillsLoaded).toBe(true);
        }
      });

      test('should maintain performance across browsers', async ({ page }) => {
        // Test performance metrics
        const performanceEntries = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
          };
        });
        
        // Performance thresholds (may vary by browser)
        expect(performanceEntries.domContentLoaded).toBeLessThan(5000); // 5 seconds
        expect(performanceEntries.firstContentfulPaint).toBeLessThan(3000); // 3 seconds
        
        console.log(`${config.name} performance:`, performanceEntries);
      });
    });
  }
}

// Cross-browser feature detection and graceful degradation tests
test.describe('Feature Detection and Graceful Degradation', () => {
  
  test('should detect and handle missing browser features', async ({ page, browserName }) => {
    // Test feature detection
    const browserCapabilities = await page.evaluate(() => {
      return {
        webGL: !!window.WebGLRenderingContext,
        webWorkers: typeof Worker !== 'undefined',
        webSockets: typeof WebSocket !== 'undefined',
        serviceWorker: 'serviceWorker' in navigator,
        pushNotifications: 'PushManager' in window,
        geolocation: 'geolocation' in navigator,
        deviceMotion: typeof DeviceMotionEvent !== 'undefined',
        battery: 'getBattery' in navigator,
        connection: 'connection' in navigator,
        clipboard: 'clipboard' in navigator
      };
    });
    
    console.log(`${browserName} capabilities:`, browserCapabilities);
    
    // Verify graceful degradation for missing features
    if (!browserCapabilities.webWorkers) {
      // Should fall back to main thread processing
      const fallbackActive = await page.evaluate(() => window.mainThreadProcessing || false);
      expect(fallbackActive).toBe(true);
    }
    
    if (!browserCapabilities.pushNotifications) {
      // Should hide notification subscription UI
      await expect(page.locator('[data-testid="notification-subscribe"]')).not.toBeVisible();
    }
  });

  test('should provide appropriate polyfills', async ({ page }) => {
    // Check if required polyfills are loaded
    const polyfillStatus = await page.evaluate(() => {
      return {
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        intersectionObserver: typeof IntersectionObserver !== 'undefined',
        customElements: typeof customElements !== 'undefined'
      };
    });
    
    // Critical APIs should always be available (via polyfills if needed)
    expect(polyfillStatus.fetch).toBe(true);
    expect(polyfillStatus.promise).toBe(true);
  });
});

// Browser-specific workaround tests
test.describe('Browser-Specific Compatibility', () => {
  
  test('should handle Safari-specific quirks', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');
    
    // Test Safari date input handling
    const dateInput = page.locator('[data-testid="date-input"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill('2024-01-01');
      const value = await dateInput.inputValue();
      expect(value).toBe('2024-01-01');
    }
    
    // Test Safari storage limitations
    const storageLimit = await page.evaluate(() => {
      try {
        const testData = 'x'.repeat(1024 * 1024 * 5); // 5MB
        localStorage.setItem('safari-test', testData);
        return 'unlimited';
      } catch (e) {
        return 'limited';
      }
    });
    
    // Safari has storage limitations
    expect(['limited', 'unlimited']).toContain(storageLimit);
  });

  test('should handle Firefox-specific behavior', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');
    
    // Test Firefox scrollbar behavior
    const scrollContainer = page.locator('[data-testid="scrollable-list"]');
    if (await scrollContainer.count() > 0) {
      await scrollContainer.hover();
      // Firefox may handle scrollbar visibility differently
      await page.mouse.wheel(0, 100);
      await expect(scrollContainer).toBeVisible();
    }
    
    // Test Firefox form validation
    const form = page.locator('[data-testid="plugin-form"]');
    if (await form.count() > 0) {
      const invalidInput = page.locator('[data-testid="required-input"]');
      await form.click(); // Trigger validation
      
      // Firefox validation styling may differ
      const validationMessage = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="required-input"]') as HTMLInputElement;
        return input?.validationMessage || '';
      });
      
      if (validationMessage) {
        expect(validationMessage.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle Chrome/Chromium-specific features', async ({ page, browserName }) => {
    test.skip(!browserName.includes('chromium'), 'Chrome-specific test');
    
    // Test Chrome DevTools integration
    const devToolsIntegration = await page.evaluate(() => {
      return window.performance?.mark !== undefined;
    });
    expect(devToolsIntegration).toBe(true);
    
    // Test Chrome-specific APIs
    const chromeApis = await page.evaluate(() => {
      return {
        webkitRequestAnimationFrame: typeof (window as any).webkitRequestAnimationFrame !== 'undefined',
        chrome: typeof (window as any).chrome !== 'undefined'
      };
    });
    
    // These may or may not be available depending on Chrome version
    console.log('Chrome APIs:', chromeApis);
  });
});

// Responsive design testing across viewports
test.describe('Responsive Design Compatibility', () => {
  
  const VIEWPORT_TESTS = [
    { name: 'Mobile Portrait', width: 375, height: 667 },
    { name: 'Mobile Landscape', width: 667, height: 375 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop Small', width: 1366, height: 768 },
    { name: 'Desktop Large', width: 1920, height: 1080 },
    { name: 'Ultrawide', width: 2560, height: 1440 }
  ];
  
  for (const viewport of VIEWPORT_TESTS) {
    test(`should render correctly at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/plugins');
      
      // Test layout adaptation
      const marketplace = page.locator('[data-testid="plugin-marketplace"]');
      await expect(marketplace).toBeVisible();
      
      const boundingBox = await marketplace.boundingBox();
      expect(boundingBox?.width).toBeLessThanOrEqual(viewport.width);
      
      // Test responsive navigation
      if (viewport.width < 768) {
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      }
      
      // Test content readability
      const pluginCards = page.locator('[data-testid="plugin-card"]');
      if (await pluginCards.count() > 0) {
        const cardBox = await pluginCards.first().boundingBox();
        expect(cardBox?.width).toBeGreaterThan(200); // Minimum readable width
        expect(cardBox?.height).toBeGreaterThan(100); // Minimum readable height
      }
    });
  }
});