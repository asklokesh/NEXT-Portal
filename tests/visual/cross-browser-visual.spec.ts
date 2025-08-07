/**
 * Cross-Browser Visual Regression Tests
 * 
 * Tests visual consistency across different browsers and configurations
 * to ensure the plugin marketplace renders consistently everywhere.
 */
import { test, expect, devices } from '@playwright/test';
import { VisualTestUtils, VISUAL_BREAKPOINTS, SCREENSHOT_OPTIONS } from './visual-test-utilities';

test.describe('Cross-Browser Visual Regression', () => {
  let visualUtils: VisualTestUtils;

  test.beforeEach(async ({ page }) => {
    visualUtils = new VisualTestUtils(page);
    await visualUtils.setupConsistentEnvironment();
    await visualUtils.mockAuthState('user');
  });

  test.describe('Chrome Specific Tests', () => {
    test.use({ 
      ...devices['Desktop Chrome'],
      viewport: VISUAL_BREAKPOINTS.desktop,
    });

    test('should render plugin marketplace in Chrome', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('chrome-marketplace');
    });

    test('should render plugin details modal in Chrome', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const installButton = page.locator('[data-testid="install-plugin-button"]');
      if (await installButton.isVisible()) {
        await installButton.click();
        await visualUtils.screenshot('chrome-install-modal', undefined, {
          customWait: 300,
        });
      }
    });

    test('should render forms and inputs in Chrome', async ({ page }) => {
      await page.goto('/plugins');
      
      // Focus search input to test focus styles
      const searchInput = page.locator('[data-testid="plugin-search-input"]');
      await searchInput.focus();
      
      await visualUtils.screenshot('chrome-form-inputs');
    });
  });

  test.describe('Firefox Specific Tests', () => {
    test.use({ 
      ...devices['Desktop Firefox'],
      viewport: VISUAL_BREAKPOINTS.desktop,
    });

    test('should render plugin marketplace in Firefox', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('firefox-marketplace');
    });

    test('should render plugin cards layout in Firefox', async ({ page }) => {
      await page.goto('/plugins');
      
      const pluginGrid = page.locator('[data-testid="plugin-grid"]');
      await visualUtils.screenshot('firefox-plugin-grid', pluginGrid);
    });

    test('should render dropdown menus in Firefox', async ({ page }) => {
      await page.goto('/plugins');
      
      const filterDropdown = page.locator('[data-testid="category-filter"]');
      if (await filterDropdown.isVisible()) {
        await filterDropdown.click();
        await visualUtils.screenshot('firefox-dropdown-menu', undefined, {
          customWait: 200,
        });
      }
    });
  });

  test.describe('Safari (WebKit) Specific Tests', () => {
    test.use({ 
      ...devices['Desktop Safari'],
      viewport: VISUAL_BREAKPOINTS.desktop,
    });

    test('should render plugin marketplace in Safari', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('safari-marketplace');
    });

    test('should render buttons and interactive elements in Safari', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const buttonsContainer = page.locator('[data-testid="plugin-actions"]');
      await visualUtils.screenshot('safari-buttons', buttonsContainer);
    });

    test('should render scrollable content in Safari', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const scrollableArea = page.locator('[data-testid="plugin-description"]');
      await scrollableArea.scrollIntoViewIfNeeded();
      
      await visualUtils.screenshot('safari-scrollable-content');
    });
  });

  test.describe('Mobile Chrome Tests', () => {
    test.use({ ...devices['Pixel 5'] });

    test('should render mobile plugin marketplace', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('mobile-chrome-marketplace');
    });

    test('should render mobile navigation menu', async ({ page }) => {
      await page.goto('/plugins');
      
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-toggle"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await visualUtils.screenshot('mobile-chrome-navigation', undefined, {
          customWait: 300,
        });
      }
    });

    test('should render mobile plugin cards', async ({ page }) => {
      await page.goto('/plugins');
      
      const pluginCard = page.locator('[data-testid="plugin-card"]').first();
      await visualUtils.screenshot('mobile-chrome-plugin-card', pluginCard);
    });

    test('should render mobile search interface', async ({ page }) => {
      await page.goto('/plugins');
      
      const searchInput = page.locator('[data-testid="plugin-search-input"]');
      await searchInput.tap();
      
      await visualUtils.screenshot('mobile-chrome-search-focused');
    });
  });

  test.describe('Tablet Tests', () => {
    test.use({ ...devices['iPad Pro'] });

    test('should render tablet plugin marketplace', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('tablet-marketplace');
    });

    test('should render tablet plugin details', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      await visualUtils.screenshot('tablet-plugin-details');
    });

    test('should handle tablet orientation changes', async ({ page }) => {
      await page.goto('/plugins');
      
      // Portrait mode
      await visualUtils.screenshot('tablet-portrait');
      
      // Switch to landscape
      await page.setViewportSize({ width: 1366, height: 1024 });
      await visualUtils.screenshot('tablet-landscape');
    });
  });

  test.describe('High DPI Display Tests', () => {
    test.use({ 
      viewport: VISUAL_BREAKPOINTS.desktopLarge,
      deviceScaleFactor: 2,
    });

    test('should render crisp images on high DPI displays', async ({ page }) => {
      await page.goto('/plugins');
      await visualUtils.screenshot('high-dpi-marketplace');
    });

    test('should render sharp icons on high DPI displays', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const iconContainer = page.locator('[data-testid="plugin-icon"]');
      await visualUtils.screenshot('high-dpi-icons', iconContainer);
    });
  });

  test.describe('Dark Mode Cross-Browser Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
    });

    test('should render dark mode in Chrome', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Chrome-specific test');
      
      await page.goto('/plugins');
      await visualUtils.screenshot('dark-mode-chrome');
    });

    test('should render dark mode in Firefox', async ({ page, browserName }) => {
      test.skip(browserName !== 'firefox', 'Firefox-specific test');
      
      await page.goto('/plugins');
      await visualUtils.screenshot('dark-mode-firefox');
    });

    test('should render dark mode in Safari', async ({ page, browserName }) => {
      test.skip(browserName !== 'webkit', 'Safari-specific test');
      
      await page.goto('/plugins');
      await visualUtils.screenshot('dark-mode-safari');
    });

    test('should render dark mode plugin cards consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      const pluginCard = page.locator('[data-testid="plugin-card"]').first();
      await visualUtils.screenshot('dark-mode-plugin-card', pluginCard);
    });
  });

  test.describe('Font Rendering Cross-Browser', () => {
    test('should render consistent typography in Chrome', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Chrome-specific test');
      
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const textContent = page.locator('[data-testid="plugin-description"]');
      await visualUtils.screenshot('chrome-typography', textContent);
    });

    test('should render consistent typography in Firefox', async ({ page, browserName }) => {
      test.skip(browserName !== 'firefox', 'Firefox-specific test');
      
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const textContent = page.locator('[data-testid="plugin-description"]');
      await visualUtils.screenshot('firefox-typography', textContent);
    });

    test('should render consistent typography in Safari', async ({ page, browserName }) => {
      test.skip(browserName !== 'webkit', 'Safari-specific test');
      
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const textContent = page.locator('[data-testid="plugin-description"]');
      await visualUtils.screenshot('safari-typography', textContent);
    });
  });

  test.describe('CSS Grid and Flexbox Compatibility', () => {
    test('should render grid layouts consistently across browsers', async ({ page }) => {
      await page.goto('/plugins');
      
      const gridContainer = page.locator('[data-testid="plugin-grid"]');
      await visualUtils.screenshot(`${test.info().project.name}-grid-layout`, gridContainer);
    });

    test('should render flexbox layouts consistently across browsers', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const flexContainer = page.locator('[data-testid="plugin-header"]');
      await visualUtils.screenshot(`${test.info().project.name}-flex-layout`, flexContainer);
    });

    test('should render complex layouts consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      await visualUtils.screenshot(`${test.info().project.name}-complex-layout`);
    });
  });

  test.describe('Animation and Transition Consistency', () => {
    test('should handle hover states consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      const pluginCard = page.locator('[data-testid="plugin-card"]').first();
      await pluginCard.hover();
      
      // Disable animations for consistent screenshot
      await page.addStyleTag({
        content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
      });
      
      await visualUtils.screenshot(`${test.info().project.name}-hover-state`, pluginCard);
    });

    test('should handle focus states consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      const searchInput = page.locator('[data-testid="plugin-search-input"]');
      await searchInput.focus();
      
      await visualUtils.screenshot(`${test.info().project.name}-focus-state`);
    });

    test('should handle loading states consistently', async ({ page }) => {
      // Mock slow loading
      await page.route('**/api/plugins**', async (route) => {
        await page.waitForTimeout(1000);
        await route.continue();
      });
      
      await page.goto('/plugins');
      await page.waitForTimeout(500); // Capture loading state
      
      await visualUtils.screenshot(`${test.info().project.name}-loading-state`);
    });
  });

  test.describe('Form Elements Cross-Browser', () => {
    test('should render form inputs consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      const searchForm = page.locator('[data-testid="search-form"]');
      await visualUtils.screenshot(`${test.info().project.name}-form-inputs`, searchForm);
    });

    test('should render select dropdowns consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      const categorySelect = page.locator('[data-testid="category-filter"]');
      if (await categorySelect.isVisible()) {
        await categorySelect.click();
        await visualUtils.screenshot(`${test.info().project.name}-select-dropdown`, undefined, {
          customWait: 200,
        });
      }
    });

    test('should render checkboxes and radio buttons consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      // Look for any filter checkboxes
      const filterOptions = page.locator('[data-testid="filter-options"]');
      if (await filterOptions.isVisible()) {
        await visualUtils.screenshot(`${test.info().project.name}-checkboxes`, filterOptions);
      }
    });
  });

  test.describe('Edge Cases and Browser Quirks', () => {
    test('should handle long text content consistently', async ({ page }) => {
      await page.goto('/plugins/visual-security-scanner'); // Plugin with long description
      
      const description = page.locator('[data-testid="plugin-description"]');
      await visualUtils.screenshot(`${test.info().project.name}-long-text`, description);
    });

    test('should handle empty states consistently', async ({ page }) => {
      await page.goto('/plugins?q=nonexistentplugin');
      
      const emptyState = page.locator('[data-testid="empty-state"]');
      await visualUtils.screenshot(`${test.info().project.name}-empty-state`, emptyState);
    });

    test('should handle overflow content consistently', async ({ page }) => {
      await page.goto('/plugins');
      
      // Create a narrow viewport to test overflow
      await page.setViewportSize({ width: 300, height: 600 });
      
      await visualUtils.screenshot(`${test.info().project.name}-overflow-content`);
    });

    test('should handle RTL text direction consistently', async ({ page }) => {
      await page.addStyleTag({
        content: 'html { direction: rtl; }',
      });
      
      await page.goto('/plugins');
      await visualUtils.screenshot(`${test.info().project.name}-rtl-layout`);
    });
  });
});