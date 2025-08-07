/**
 * Component-Level Visual Regression Tests
 * 
 * These tests focus on individual components and their various states
 * to ensure consistent visual appearance across different scenarios.
 */
import { test, expect } from '@playwright/test';

test.describe('Component Visual Regression Tests', () => {
  
  test.describe('Plugin Card Component', () => {
    test('should render plugin card in default state', async ({ page }) => {
      // Create a test page with isolated plugin card component
      await page.goto('/test/components/plugin-card');
      
      await expect(page.locator('[data-testid="plugin-card-default"]')).toHaveScreenshot('plugin-card-default.png');
    });

    test('should render plugin card in installed state', async ({ page }) => {
      await page.goto('/test/components/plugin-card?state=installed');
      
      await expect(page.locator('[data-testid="plugin-card-installed"]')).toHaveScreenshot('plugin-card-installed.png');
    });

    test('should render plugin card in installing state', async ({ page }) => {
      await page.goto('/test/components/plugin-card?state=installing');
      
      await expect(page.locator('[data-testid="plugin-card-installing"]')).toHaveScreenshot('plugin-card-installing.png');
    });

    test('should render plugin card with long title', async ({ page }) => {
      await page.goto('/test/components/plugin-card?title=Very+Long+Plugin+Title+That+Should+Wrap+Properly');
      
      await expect(page.locator('[data-testid="plugin-card-long-title"]')).toHaveScreenshot('plugin-card-long-title.png');
    });

    test('should render plugin card with no rating', async ({ page }) => {
      await page.goto('/test/components/plugin-card?rating=none');
      
      await expect(page.locator('[data-testid="plugin-card-no-rating"]')).toHaveScreenshot('plugin-card-no-rating.png');
    });

    test('should render plugin card with multiple tags', async ({ page }) => {
      await page.goto('/test/components/plugin-card?tags=api,monitoring,security,dashboard,analytics');
      
      await expect(page.locator('[data-testid="plugin-card-many-tags"]')).toHaveScreenshot('plugin-card-many-tags.png');
    });
  });

  test.describe('Search Component', () => {
    test('should render search input in default state', async ({ page }) => {
      await page.goto('/test/components/search');
      
      await expect(page.locator('[data-testid="search-component"]')).toHaveScreenshot('search-default.png');
    });

    test('should render search input with placeholder', async ({ page }) => {
      await page.goto('/test/components/search');
      
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.focus();
      
      await expect(page.locator('[data-testid="search-component"]')).toHaveScreenshot('search-focused.png');
    });

    test('should render search suggestions', async ({ page }) => {
      await page.goto('/test/components/search');
      
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('api');
      await page.waitForTimeout(300); // Wait for suggestions
      
      await expect(page.locator('[data-testid="search-component"]')).toHaveScreenshot('search-with-suggestions.png');
    });

    test('should render search with clear button', async ({ page }) => {
      await page.goto('/test/components/search');
      
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('monitoring');
      
      await expect(page.locator('[data-testid="search-component"]')).toHaveScreenshot('search-with-clear-button.png');
    });
  });

  test.describe('Filter Component', () => {
    test('should render category filter closed', async ({ page }) => {
      await page.goto('/test/components/filters');
      
      await expect(page.locator('[data-testid="category-filter"]')).toHaveScreenshot('category-filter-closed.png');
    });

    test('should render category filter opened', async ({ page }) => {
      await page.goto('/test/components/filters');
      
      const filterButton = page.locator('[data-testid="category-filter-button"]');
      await filterButton.click();
      await page.waitForTimeout(200);
      
      await expect(page.locator('[data-testid="category-filter"]')).toHaveScreenshot('category-filter-opened.png');
    });

    test('should render filter with selections', async ({ page }) => {
      await page.goto('/test/components/filters?selected=Documentation,Monitoring');
      
      await expect(page.locator('[data-testid="filter-component"]')).toHaveScreenshot('filters-with-selections.png');
    });

    test('should render rating filter', async ({ page }) => {
      await page.goto('/test/components/filters');
      
      const ratingFilter = page.locator('[data-testid="rating-filter"]');
      await ratingFilter.scrollIntoViewIfNeeded();
      
      await expect(ratingFilter).toHaveScreenshot('rating-filter.png');
    });
  });

  test.describe('Installation Modal Component', () => {
    test('should render basic installation modal', async ({ page }) => {
      await page.goto('/test/components/install-modal');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-basic.png');
    });

    test('should render installation modal with configuration form', async ({ page }) => {
      await page.goto('/test/components/install-modal?hasConfig=true');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-with-config.png');
    });

    test('should render installation modal with dependency warning', async ({ page }) => {
      await page.goto('/test/components/install-modal?hasDependencies=true');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-dependencies.png');
    });

    test('should render installation progress modal', async ({ page }) => {
      await page.goto('/test/components/install-modal?state=installing');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-progress.png');
    });

    test('should render installation success modal', async ({ page }) => {
      await page.goto('/test/components/install-modal?state=success');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-success.png');
    });

    test('should render installation error modal', async ({ page }) => {
      await page.goto('/test/components/install-modal?state=error');
      
      await expect(page.locator('[data-testid="install-modal"]')).toHaveScreenshot('install-modal-error.png');
    });
  });

  test.describe('Plugin Status Component', () => {
    test('should render healthy status indicator', async ({ page }) => {
      await page.goto('/test/components/plugin-status?status=healthy');
      
      await expect(page.locator('[data-testid="plugin-status"]')).toHaveScreenshot('status-healthy.png');
    });

    test('should render unhealthy status indicator', async ({ page }) => {
      await page.goto('/test/components/plugin-status?status=unhealthy');
      
      await expect(page.locator('[data-testid="plugin-status"]')).toHaveScreenshot('status-unhealthy.png');
    });

    test('should render starting status indicator', async ({ page }) => {
      await page.goto('/test/components/plugin-status?status=starting');
      
      await expect(page.locator('[data-testid="plugin-status"]')).toHaveScreenshot('status-starting.png');
    });

    test('should render stopped status indicator', async ({ page }) => {
      await page.goto('/test/components/plugin-status?status=stopped');
      
      await expect(page.locator('[data-testid="plugin-status"]')).toHaveScreenshot('status-stopped.png');
    });
  });

  test.describe('Plugin Metrics Component', () => {
    test('should render metrics dashboard', async ({ page }) => {
      await page.goto('/test/components/plugin-metrics');
      
      await expect(page.locator('[data-testid="plugin-metrics"]')).toHaveScreenshot('plugin-metrics-dashboard.png');
    });

    test('should render metrics with high usage', async ({ page }) => {
      await page.goto('/test/components/plugin-metrics?usage=high');
      
      await expect(page.locator('[data-testid="plugin-metrics"]')).toHaveScreenshot('plugin-metrics-high-usage.png');
    });

    test('should render metrics with errors', async ({ page }) => {
      await page.goto('/test/components/plugin-metrics?errorRate=25');
      
      await expect(page.locator('[data-testid="plugin-metrics"]')).toHaveScreenshot('plugin-metrics-with-errors.png');
    });
  });

  test.describe('Navigation Component', () => {
    test('should render main navigation', async ({ page }) => {
      await page.goto('/test/components/navigation');
      
      await expect(page.locator('[data-testid="main-navigation"]')).toHaveScreenshot('main-navigation.png');
    });

    test('should render navigation with active item', async ({ page }) => {
      await page.goto('/test/components/navigation?active=plugins');
      
      await expect(page.locator('[data-testid="main-navigation"]')).toHaveScreenshot('navigation-active-item.png');
    });

    test('should render mobile navigation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/test/components/navigation');
      
      await expect(page.locator('[data-testid="mobile-navigation"]')).toHaveScreenshot('mobile-navigation.png');
    });

    test('should render user menu dropdown', async ({ page }) => {
      await page.goto('/test/components/navigation');
      
      const userMenuButton = page.locator('[data-testid="user-menu-button"]');
      await userMenuButton.click();
      await page.waitForTimeout(200);
      
      await expect(page.locator('[data-testid="user-menu-dropdown"]')).toHaveScreenshot('user-menu-dropdown.png');
    });
  });

  test.describe('Loading States', () => {
    test('should render plugin card loading skeleton', async ({ page }) => {
      await page.goto('/test/components/loading-states?component=plugin-card');
      
      await expect(page.locator('[data-testid="plugin-card-skeleton"]')).toHaveScreenshot('plugin-card-skeleton.png');
    });

    test('should render plugin grid loading skeleton', async ({ page }) => {
      await page.goto('/test/components/loading-states?component=plugin-grid');
      
      await expect(page.locator('[data-testid="plugin-grid-skeleton"]')).toHaveScreenshot('plugin-grid-skeleton.png');
    });

    test('should render plugin details loading skeleton', async ({ page }) => {
      await page.goto('/test/components/loading-states?component=plugin-details');
      
      await expect(page.locator('[data-testid="plugin-details-skeleton"]')).toHaveScreenshot('plugin-details-skeleton.png');
    });

    test('should render spinner loading indicator', async ({ page }) => {
      await page.goto('/test/components/loading-states?component=spinner');
      
      // Stop animation for consistent screenshot
      await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; }' });
      
      await expect(page.locator('[data-testid="loading-spinner"]')).toHaveScreenshot('loading-spinner.png');
    });
  });

  test.describe('Form Components', () => {
    test('should render plugin configuration form', async ({ page }) => {
      await page.goto('/test/components/config-form');
      
      await expect(page.locator('[data-testid="config-form"]')).toHaveScreenshot('config-form.png');
    });

    test('should render form with validation errors', async ({ page }) => {
      await page.goto('/test/components/config-form?showErrors=true');
      
      await expect(page.locator('[data-testid="config-form"]')).toHaveScreenshot('config-form-errors.png');
    });

    test('should render form field states', async ({ page }) => {
      await page.goto('/test/components/form-fields');
      
      await expect(page.locator('[data-testid="form-fields"]')).toHaveScreenshot('form-field-states.png');
    });

    test('should render multiselect component', async ({ page }) => {
      await page.goto('/test/components/multiselect');
      
      const multiselectButton = page.locator('[data-testid="multiselect-button"]');
      await multiselectButton.click();
      await page.waitForTimeout(200);
      
      await expect(page.locator('[data-testid="multiselect-dropdown"]')).toHaveScreenshot('multiselect-dropdown.png');
    });
  });

  test.describe('Badge and Tag Components', () => {
    test('should render plugin category badges', async ({ page }) => {
      await page.goto('/test/components/badges');
      
      await expect(page.locator('[data-testid="category-badges"]')).toHaveScreenshot('category-badges.png');
    });

    test('should render plugin status badges', async ({ page }) => {
      await page.goto('/test/components/badges?type=status');
      
      await expect(page.locator('[data-testid="status-badges"]')).toHaveScreenshot('status-badges.png');
    });

    test('should render plugin version tags', async ({ page }) => {
      await page.goto('/test/components/tags?type=version');
      
      await expect(page.locator('[data-testid="version-tags"]')).toHaveScreenshot('version-tags.png');
    });

    test('should render plugin compatibility tags', async ({ page }) => {
      await page.goto('/test/components/tags?type=compatibility');
      
      await expect(page.locator('[data-testid="compatibility-tags"]')).toHaveScreenshot('compatibility-tags.png');
    });
  });

  test.describe('Notification Components', () => {
    test('should render success notification', async ({ page }) => {
      await page.goto('/test/components/notifications?type=success');
      
      await expect(page.locator('[data-testid="notification-success"]')).toHaveScreenshot('notification-success.png');
    });

    test('should render error notification', async ({ page }) => {
      await page.goto('/test/components/notifications?type=error');
      
      await expect(page.locator('[data-testid="notification-error"]')).toHaveScreenshot('notification-error.png');
    });

    test('should render warning notification', async ({ page }) => {
      await page.goto('/test/components/notifications?type=warning');
      
      await expect(page.locator('[data-testid="notification-warning"]')).toHaveScreenshot('notification-warning.png');
    });

    test('should render info notification', async ({ page }) => {
      await page.goto('/test/components/notifications?type=info');
      
      await expect(page.locator('[data-testid="notification-info"]')).toHaveScreenshot('notification-info.png');
    });

    test('should render notification stack', async ({ page }) => {
      await page.goto('/test/components/notifications?multiple=true');
      
      await expect(page.locator('[data-testid="notification-stack"]')).toHaveScreenshot('notification-stack.png');
    });
  });

  test.describe('Chart and Graph Components', () => {
    test('should render plugin usage chart', async ({ page }) => {
      await page.goto('/test/components/charts?type=usage');
      
      // Wait for chart to render
      await page.waitForTimeout(1000);
      
      await expect(page.locator('[data-testid="usage-chart"]')).toHaveScreenshot('usage-chart.png');
    });

    test('should render plugin performance metrics', async ({ page }) => {
      await page.goto('/test/components/charts?type=performance');
      
      await page.waitForTimeout(1000);
      
      await expect(page.locator('[data-testid="performance-chart"]')).toHaveScreenshot('performance-chart.png');
    });

    test('should render plugin installation trends', async ({ page }) => {
      await page.goto('/test/components/charts?type=trends');
      
      await page.waitForTimeout(1000);
      
      await expect(page.locator('[data-testid="trends-chart"]')).toHaveScreenshot('trends-chart.png');
    });
  });
});