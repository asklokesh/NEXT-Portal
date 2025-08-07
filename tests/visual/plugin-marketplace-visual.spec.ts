/**
 * Visual Regression Tests for Plugin Marketplace
 * 
 * These tests capture screenshots of the plugin marketplace UI
 * and compare them against baseline images to detect visual regressions.
 */
import { test, expect } from '@playwright/test';

// Test utilities for consistent setup
class VisualTestHelper {
  private page: any;

  constructor(page: any) {
    this.page = page;
  }

  async waitForPageStable(): Promise<void> {
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any animations to complete
    await this.page.waitForTimeout(1000);
    
    // Wait for font loading
    await this.page.evaluate(() => document.fonts.ready);
  }

  async hideVolatileElements(): Promise<void> {
    // Hide elements that change frequently (timestamps, dynamic counters, etc.)
    await this.page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"],
        [data-testid="current-time"],
        .animate-spin,
        .animate-pulse,
        .animate-bounce {
          visibility: hidden !important;
        }
      `,
    });
  }

  async mockAuthState(userRole: 'admin' | 'user' = 'user'): Promise<void> {
    // Mock authentication state
    await this.page.evaluate((role) => {
      window.localStorage.setItem('auth-token', `mock-${role}-token`);
      window.localStorage.setItem('user-role', role);
    }, userRole);
  }

  async screenshot(name: string, options: any = {}): Promise<void> {
    await this.waitForPageStable();
    await this.hideVolatileElements();
    
    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: 'disabled',
      ...options,
    });
  }
}

test.describe('Plugin Marketplace Visual Regression', () => {
  let helper: VisualTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new VisualTestHelper(page);
    
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mock auth state
    await helper.mockAuthState('user');
  });

  test.describe('Homepage and Navigation', () => {
    test('should render homepage correctly', async ({ page }) => {
      await page.goto('/');
      await helper.screenshot('homepage-default');
    });

    test('should render plugin marketplace landing page', async ({ page }) => {
      await page.goto('/plugins');
      await helper.screenshot('marketplace-landing');
    });

    test('should render navigation menu', async ({ page }) => {
      await page.goto('/plugins');
      
      // Open navigation menu if it's hamburger style
      const menuButton = page.locator('[data-testid="nav-menu-button"]');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300); // Animation
      }
      
      await helper.screenshot('navigation-menu-open');
    });

    test('should render user profile dropdown', async ({ page }) => {
      await page.goto('/plugins');
      
      // Click user profile to open dropdown
      const profileButton = page.locator('[data-testid="user-profile-button"]');
      if (await profileButton.isVisible()) {
        await profileButton.click();
        await page.waitForTimeout(200);
        await helper.screenshot('user-profile-dropdown');
      }
    });
  });

  test.describe('Plugin Marketplace Grid', () => {
    test('should render plugin grid with default layout', async ({ page }) => {
      await page.goto('/plugins');
      await helper.screenshot('plugin-grid-default');
    });

    test('should render plugin grid in list view', async ({ page }) => {
      await page.goto('/plugins');
      
      // Switch to list view if toggle exists
      const listViewButton = page.locator('[data-testid="list-view-button"]');
      if (await listViewButton.isVisible()) {
        await listViewButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('plugin-grid-list-view');
      }
    });

    test('should render plugin grid with different sorting', async ({ page }) => {
      await page.goto('/plugins');
      
      // Test different sort options
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
      if (await sortDropdown.isVisible()) {
        await sortDropdown.click();
        await page.locator('[data-testid="sort-rating"]').click();
        await helper.screenshot('plugin-grid-sorted-by-rating');
      }
    });

    test('should render plugin cards with all states', async ({ page }) => {
      await page.goto('/plugins');
      await helper.screenshot('plugin-cards-various-states');
    });

    test('should render empty state when no plugins found', async ({ page }) => {
      await page.goto('/plugins?q=nonexistentplugin');
      await helper.screenshot('plugin-grid-empty-state');
    });
  });

  test.describe('Plugin Search and Filtering', () => {
    test('should render search interface', async ({ page }) => {
      await page.goto('/plugins');
      
      // Focus search input to show any autocomplete/suggestions
      const searchInput = page.locator('[data-testid="plugin-search-input"]');
      await searchInput.click();
      await helper.screenshot('search-interface-focused');
    });

    test('should render search results', async ({ page }) => {
      await page.goto('/plugins');
      
      const searchInput = page.locator('[data-testid="plugin-search-input"]');
      await searchInput.fill('api');
      await searchInput.press('Enter');
      await helper.screenshot('search-results-api');
    });

    test('should render category filters', async ({ page }) => {
      await page.goto('/plugins');
      
      // Open category filter if it's a dropdown
      const categoryFilter = page.locator('[data-testid="category-filter"]');
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        await page.waitForTimeout(200);
        await helper.screenshot('category-filter-dropdown');
      }
    });

    test('should render applied filters', async ({ page }) => {
      await page.goto('/plugins?category=Documentation&rating=4');
      await helper.screenshot('filters-applied');
    });

    test('should render advanced search filters', async ({ page }) => {
      await page.goto('/plugins');
      
      // Open advanced filters if available
      const advancedButton = page.locator('[data-testid="advanced-filters-button"]');
      if (await advancedButton.isVisible()) {
        await advancedButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('advanced-filters-panel');
      }
    });
  });

  test.describe('Plugin Details', () => {
    test('should render plugin detail page', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      await helper.screenshot('plugin-details-page');
    });

    test('should render plugin installation modal', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      const installButton = page.locator('[data-testid="install-plugin-button"]');
      if (await installButton.isVisible()) {
        await installButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('plugin-install-modal');
      }
    });

    test('should render plugin configuration form', async ({ page }) => {
      await page.goto('/plugins/visual-security-scanner');
      
      const configureButton = page.locator('[data-testid="configure-plugin-button"]');
      if (await configureButton.isVisible()) {
        await configureButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('plugin-configuration-form');
      }
    });

    test('should render plugin reviews and ratings', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      
      // Scroll to reviews section
      const reviewsSection = page.locator('[data-testid="plugin-reviews"]');
      if (await reviewsSection.isVisible()) {
        await reviewsSection.scrollIntoViewIfNeeded();
        await helper.screenshot('plugin-reviews-section');
      }
    });

    test('should render plugin dependencies', async ({ page }) => {
      await page.goto('/plugins/visual-analytics-plugin');
      
      // Scroll to dependencies section
      const depsSection = page.locator('[data-testid="plugin-dependencies"]');
      if (await depsSection.isVisible()) {
        await depsSection.scrollIntoViewIfNeeded();
        await helper.screenshot('plugin-dependencies-section');
      }
    });
  });

  test.describe('Plugin Installation Workflow', () => {
    test('should render installation progress', async ({ page }) => {
      await helper.mockAuthState('admin');
      await page.goto('/plugins/visual-monitoring-plugin');
      
      const installButton = page.locator('[data-testid="install-plugin-button"]');
      if (await installButton.isVisible()) {
        await installButton.click();
        
        // Fill out installation form if it exists
        const configForm = page.locator('[data-testid="installation-config-form"]');
        if (await configForm.isVisible()) {
          await page.locator('[data-testid="confirm-install-button"]').click();
        }
        
        // Wait for installation to start
        await page.waitForTimeout(1000);
        await helper.screenshot('plugin-installation-progress');
      }
    });

    test('should render installation success state', async ({ page }) => {
      await page.goto('/plugins/visual-api-docs-plugin');
      await helper.screenshot('plugin-installed-success');
    });

    test('should render installation error state', async ({ page }) => {
      await page.goto('/plugins');
      
      // Mock an installation error scenario
      await page.evaluate(() => {
        window.localStorage.setItem('mock-install-error', 'true');
      });
      
      await page.goto('/plugins/visual-security-scanner');
      const installButton = page.locator('[data-testid="install-plugin-button"]');
      if (await installButton.isVisible()) {
        await installButton.click();
        await page.waitForTimeout(500);
        await helper.screenshot('plugin-installation-error');
      }
    });
  });

  test.describe('Plugin Management Dashboard', () => {
    test('should render installed plugins dashboard', async ({ page }) => {
      await helper.mockAuthState('admin');
      await page.goto('/plugins/installed');
      await helper.screenshot('installed-plugins-dashboard');
    });

    test('should render plugin health monitoring', async ({ page }) => {
      await helper.mockAuthState('admin');
      await page.goto('/plugins/installed');
      
      // Look for health status indicators
      const healthSection = page.locator('[data-testid="plugin-health-status"]');
      if (await healthSection.isVisible()) {
        await helper.screenshot('plugin-health-monitoring');
      }
    });

    test('should render plugin update notifications', async ({ page }) => {
      await helper.mockAuthState('admin');
      await page.goto('/plugins/installed');
      
      // Mock update available state
      await page.evaluate(() => {
        window.localStorage.setItem('mock-updates-available', 'true');
      });
      
      await page.reload();
      await helper.screenshot('plugin-update-notifications');
    });
  });

  test.describe('Responsive Design', () => {
    test('should render marketplace on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/plugins');
      await helper.screenshot('marketplace-tablet');
    });

    test('should render marketplace on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plugins');
      await helper.screenshot('marketplace-mobile');
    });

    test('should render plugin details on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plugins/visual-api-docs-plugin');
      await helper.screenshot('plugin-details-mobile');
    });

    test('should render mobile navigation menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/plugins');
      
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
      if (await mobileMenuButton.isVisible()) {
        await mobileMenuButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('mobile-navigation-menu');
      }
    });
  });

  test.describe('Error States and Edge Cases', () => {
    test('should render plugin loading states', async ({ page }) => {
      // Mock slow network to capture loading states
      await page.route('**/api/plugins**', async (route) => {
        await page.waitForTimeout(2000);
        await route.continue();
      });
      
      await page.goto('/plugins');
      await page.waitForTimeout(500); // Capture loading state
      await helper.screenshot('plugin-loading-state');
    });

    test('should render network error state', async ({ page }) => {
      // Mock network error
      await page.route('**/api/plugins**', (route) => {
        route.abort('internetdisconnected');
      });
      
      await page.goto('/plugins');
      await page.waitForTimeout(1000);
      await helper.screenshot('network-error-state');
    });

    test('should render plugin card hover states', async ({ page }) => {
      await page.goto('/plugins');
      
      const firstPluginCard = page.locator('[data-testid="plugin-card"]').first();
      await firstPluginCard.hover();
      await page.waitForTimeout(200);
      await helper.screenshot('plugin-card-hover');
    });

    test('should render plugin card focus states', async ({ page }) => {
      await page.goto('/plugins');
      
      const firstPluginCard = page.locator('[data-testid="plugin-card"]').first();
      await firstPluginCard.focus();
      await page.waitForTimeout(200);
      await helper.screenshot('plugin-card-focused');
    });
  });

  test.describe('Dark Mode Support', () => {
    test('should render marketplace in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/plugins');
      await helper.screenshot('marketplace-dark-mode');
    });

    test('should render plugin details in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/plugins/visual-api-docs-plugin');
      await helper.screenshot('plugin-details-dark-mode');
    });

    test('should render modals in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/plugins/visual-security-scanner');
      
      const installButton = page.locator('[data-testid="install-plugin-button"]');
      if (await installButton.isVisible()) {
        await installButton.click();
        await page.waitForTimeout(300);
        await helper.screenshot('modal-dark-mode');
      }
    });
  });

  test.describe('Accessibility Focus Indicators', () => {
    test('should render focus indicators for keyboard navigation', async ({ page }) => {
      await page.goto('/plugins');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await helper.screenshot('keyboard-focus-search');
      
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await helper.screenshot('keyboard-focus-filter');
    });

    test('should render skip links', async ({ page }) => {
      await page.goto('/plugins');
      
      // Press Tab to show skip links
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await helper.screenshot('accessibility-skip-links');
    });
  });
});